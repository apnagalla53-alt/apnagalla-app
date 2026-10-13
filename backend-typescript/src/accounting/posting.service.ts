import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { businessDate } from '../common/business-date';

export interface CreateVoucherLineDto {
  ledger_account_id: string;
  debit: number | Prisma.Decimal;
  credit: number | Prisma.Decimal;
  party_id?: string;
  narration?: string;
}

export interface CreateVoucherDto {
  company_id: string;
  branch_id: string;
  financial_year_id: string;
  voucher_type: string;
  document_number: string;
  voucher_date: Date;
  source_document_type?: string;
  source_document_id?: string;
  narration?: string;
  lines: CreateVoucherLineDto[];
  posted_by: string;
  payment_method?: string;
}

@Injectable()
export class PostingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Allocate a real party receipt/payment and its journal in the caller's transaction. */
  async settlePartyBalance(tx: Prisma.TransactionClient, context: {
    company_id: string; branch_id: string; financial_year_id: string; user_id: string;
    party_id: string; party_type: 'CUSTOMER' | 'SUPPLIER'; amount: number;
    payment_method: string; date: Date; note?: string; reference_id?: string;
  }) {
    const c = context;
    if (!['CASH', 'UPI', 'CARD', 'BANK'].includes(c.payment_method)) throw new BadRequestException('Invalid payment method');
    const amount = new Prisma.Decimal(c.amount);
    if (!amount.isFinite() || amount.lte(0)) throw new BadRequestException('Payment amount must be positive');
    await tx.$queryRaw`SELECT id FROM parties WHERE id = ${c.party_id}::uuid AND company_id = ${c.company_id}::uuid FOR UPDATE`;
    const party = await tx.party.findFirst({ where: { id: c.party_id, company_id: c.company_id, party_type: c.party_type, is_active: true } });
    if (!party) throw new BadRequestException('Party not found');
    const fy = await tx.financialYear.findFirst({ where: { id: c.financial_year_id, company_id: c.company_id, is_closed: false, start_date: { lte: c.date }, end_date: { gte: new Date(c.date.toISOString().slice(0, 10)) } } });
    const branch = await tx.branch.findFirst({ where: { id: c.branch_id, company_id: c.company_id } });
    if (!fy || !branch) throw new BadRequestException('Select an open financial year covering the payment date and a valid branch');
    const cash = await tx.ledgerAccount.findFirst({ where: { company_id: c.company_id, OR: [{ code: c.payment_method === 'CASH' ? 'CASH_IN_HAND' : 'DEFAULT_BANK' }, { name: c.payment_method === 'CASH' ? 'Cash Account' : 'Bank Account' }] } });
    const account = await tx.ledgerAccount.findFirst({ where: { company_id: c.company_id, party_id: party.id } });
    if (!cash || !account) throw new BadRequestException('Payment or party ledger is not configured');
    const allocations = await tx.billAllocation.findMany({ where: { company_id: c.company_id, party_id: party.id, ...(c.reference_id ? { reference_document_id: c.reference_id } : {}) }, include: { voucher_line: { include: { voucher: true } } } });
    const documents = new Map<string, { type: string; remaining: Prisma.Decimal; date: Date }>();
    for (const a of allocations) {
      const entry = documents.get(a.reference_document_id) || { type: a.reference_document_type, remaining: new Prisma.Decimal(0), date: a.voucher_line.voucher.voucher_date };
      entry.remaining = a.allocation_type === 'NEW_REFERENCE' ? entry.remaining.plus(a.amount) : entry.remaining.minus(a.amount);
      documents.set(a.reference_document_id, entry);
    }
    const totalBalance = [...documents.values()].reduce((sum, b) => sum.plus(b.remaining), new Prisma.Decimal(0));
    if (amount.gt(totalBalance)) throw new BadRequestException('Payment exceeds the outstanding balance');
    const receipt = c.party_type === 'CUSTOMER';
    const voucher = await this.postVoucher(tx, {
      company_id: c.company_id, branch_id: c.branch_id, financial_year_id: c.financial_year_id,
      voucher_type: receipt ? 'RECEIPT' : 'PAYMENT', document_number: (receipt ? 'RCPT-' : 'PMT-') + randomUUID(),
      voucher_date: c.date, payment_method: c.payment_method, narration: c.note, posted_by: c.user_id,
      lines: [
        { ledger_account_id: cash.id, debit: receipt ? amount : 0, credit: receipt ? 0 : amount },
        { ledger_account_id: account.id, party_id: party.id, debit: receipt ? 0 : amount, credit: receipt ? amount : 0 },
      ],
    });
    const partyLine = voucher.lines.find(l => l.party_id === party.id)!;
    let remaining = amount;
    for (const [id, bill] of [...documents.entries()].sort((a, b) => a[1].date.getTime() - b[1].date.getTime())) {
      if (remaining.lte(0)) break;
      if (bill.remaining.lte(0)) continue;
      const allocated = Prisma.Decimal.min(bill.remaining, remaining);
      await tx.billAllocation.create({ data: { company_id: c.company_id, party_id: party.id, voucher_line_id: partyLine.id,
        reference_document_type: bill.type, reference_document_id: id, allocation_type: 'AGAINST_REFERENCE', amount: allocated } });
      if (bill.type === 'SALES_INVOICE') await tx.salesInvoice.updateMany({ where: { id, company_id: c.company_id }, data: { paid_amount: { increment: allocated }, outstanding_amount: { decrement: allocated } } });
      if (bill.type === 'PURCHASE_INVOICE') await tx.purchaseInvoice.updateMany({ where: { id, company_id: c.company_id }, data: { paid_amount: { increment: allocated }, outstanding_amount: { decrement: allocated } } });
      remaining = remaining.minus(allocated);
    }
    return { success: true, payment_id: voucher.id, amount_received: amount.toNumber(), amount_paid: amount.toNumber() };
  }

  async postVoucherWithIsolationChecks(dto: CreateVoucherDto) {
    return this.prisma.$transaction(async (tx) => {
      // Isolate ledger accounts: check if all accounts belong to this company
      for (const line of dto.lines) {
        const account = await tx.ledgerAccount.findUnique({
          where: { id: line.ledger_account_id }
        });
        if (!account) throw new BadRequestException(`Account ${line.ledger_account_id} not found`);
        if (account.company_id !== dto.company_id) {
          throw new ForbiddenException(`Cross-organization posting attempt rejected. Account ${account.name} belongs to ${account.company_id}, but request is for ${dto.company_id}`);
        }
        if (dto.branch_id && account.branch_id && account.branch_id !== dto.branch_id) {
          throw new ForbiddenException(`Cross-branch posting attempt rejected. Account ${account.name} belongs to ${account.branch_id}, but request is for ${dto.branch_id}`);
        }
      }

      return this.postVoucher(tx, dto);
    });
  }

  async postVoucher(tx: Prisma.TransactionClient, dto: CreateVoucherDto) {
    // 1. Validation
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException('Voucher must have at least two lines');
    }

    for (const line of dto.lines) {
      const debitVal = new Prisma.Decimal(line.debit || 0);
      const creditVal = new Prisma.Decimal(line.credit || 0);
      
      if (!debitVal.isFinite() || !creditVal.isFinite() || debitVal.lessThan(0) || creditVal.lessThan(0) || (debitVal.gt(0) && creditVal.gt(0))) {
        throw new BadRequestException('Negative amounts are not allowed in voucher lines');
      }
      
      totalDebit = totalDebit.plus(debitVal);
      totalCredit = totalCredit.plus(creditVal);
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(`Voucher must be balanced. Debit: ${totalDebit.toString()}, Credit: ${totalCredit.toString()}`);
    }

    if (totalDebit.equals(0)) {
      throw new BadRequestException('Voucher total must be greater than zero');
    }

    // Feature services and maintenance jobs share this ownership boundary.
    const [branch, year, accounts, parties] = await Promise.all([
      tx.branch.findFirst({ where: { id: dto.branch_id, company_id: dto.company_id } }),
      tx.financialYear.findFirst({ where: { id: dto.financial_year_id, company_id: dto.company_id, is_closed: false } }),
      tx.ledgerAccount.findMany({ where: { company_id: dto.company_id, id: { in: [...new Set(dto.lines.map(l => l.ledger_account_id))] } } }),
      tx.party.findMany({ where: { company_id: dto.company_id, id: { in: [...new Set(dto.lines.flatMap(l => l.party_id ? [l.party_id] : []))] } } }),
    ]);
    if (!branch || !year) throw new BadRequestException('Journal branch or open financial year is invalid');
    for (const line of dto.lines) {
      const account = accounts.find(a => a.id === line.ledger_account_id);
      if (!account || (account.branch_id && account.branch_id !== dto.branch_id)) throw new ForbiddenException('Journal account is outside the posting scope');
      if (line.party_id && (!parties.some(p => p.id === line.party_id) || (account.party_id && account.party_id !== line.party_id))) throw new ForbiddenException('Journal party is outside the posting scope');
    }

    // Idempotency: Prevent duplicate posting of same source document
    if (dto.source_document_type && dto.source_document_id) {
      const existing = await tx.voucher.findFirst({
        where: {
          company_id: dto.company_id,
          source_document_type: dto.source_document_type,
          source_document_id: dto.source_document_id,
          status: 'POSTED',
        },
      });
      if (existing) {
        throw new BadRequestException(`Duplicate posting prevented. Source document ${dto.source_document_type} ${dto.source_document_id} already posted.`);
      }
    }

    // 2. Create Voucher
    const voucher = await tx.voucher.create({
      data: {
        company_id: dto.company_id,
        branch_id: dto.branch_id,
        financial_year_id: dto.financial_year_id,
        voucher_type: dto.voucher_type,
        document_number: dto.document_number,
        voucher_date: dto.voucher_date,
        status: 'POSTED',
        source_document_type: dto.source_document_type,
        source_document_id: dto.source_document_id,
        narration: dto.narration,
        payment_method: dto.payment_method,
        posted_at: new Date(),
        posted_by: dto.posted_by,
        lines: {
          create: dto.lines.map(line => ({
            ledger_account_id: line.ledger_account_id,
            debit: line.debit,
            credit: line.credit,
            party_id: line.party_id,
            narration: line.narration,
          })),
        },
      },
      include: {
        lines: true
      }
    });

    // 3. Create Audit Trail
    await tx.auditLog.create({
      data: {
        company_id: dto.company_id,
        branch_id: dto.branch_id,
        user_id: dto.posted_by,
        action: 'VOUCHER_POSTED',
        source_document_type: dto.source_document_type,
        source_document_id: dto.source_document_id,
        affected_voucher_id: voucher.id,
      },
    });

    return voucher;
  }

  async reverseVoucherWithIsolationChecks(companyId: string, voucherId: string, reversedBy: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.findUnique({
        where: { id: voucherId }
      });
      if (!voucher) throw new BadRequestException('Voucher not found');
      if (voucher.company_id !== companyId) {
        throw new ForbiddenException('Cannot reverse voucher from another organization');
      }

      return this.reverseVoucher(tx, voucherId, reversedBy, reason);
    });
  }

  async reverseVoucher(tx: Prisma.TransactionClient, voucherId: string, reversedBy: string, reason: string) {
    await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${voucherId}::uuid FOR UPDATE`;
    const voucher = await tx.voucher.findUnique({
      where: { id: voucherId },
      include: { lines: true },
    });

    if (!voucher) throw new BadRequestException('Voucher not found');
    if (voucher.status !== 'POSTED') throw new BadRequestException('Only POSTED vouchers can be reversed');
    if (voucher.reversed_voucher_id) throw new BadRequestException('Voucher is already reversed');
    if (voucher.voucher_type === 'REVERSAL') throw new BadRequestException('Cannot reverse a reversal voucher');

    // Create Reversal Voucher
    const reversalVoucher = await tx.voucher.create({
      data: {
        company_id: voucher.company_id,
        branch_id: voucher.branch_id,
        financial_year_id: voucher.financial_year_id,
        voucher_type: 'REVERSAL',
        document_number: `${voucher.document_number}-REV`,
        voucher_date: new Date(businessDate()),
        status: 'POSTED',
        source_document_type: voucher.source_document_type,
        source_document_id: voucher.source_document_id,
        narration: `Reversal of ${voucher.document_number}: ${reason}`,
        posted_at: new Date(),
        posted_by: reversedBy,
        lines: {
          create: voucher.lines.map(line => ({
            ledger_account_id: line.ledger_account_id,
            debit: line.credit, // SWAP DEBIT AND CREDIT
            credit: line.debit,
            party_id: line.party_id,
            narration: `Reversal of ${line.id}`,
          })),
        },
      },
    });

    // Mark original voucher as reversed
    await tx.voucher.update({
      where: { id: voucher.id },
      data: {
        status: 'REVERSED',
        reversed_voucher_id: reversalVoucher.id,
        reversed_by: reversedBy,
        reversed_at: new Date(),
        reversal_reason: reason,
      },
    });

    // Create Audit Trail
    await tx.auditLog.create({
      data: {
        company_id: voucher.company_id,
        branch_id: voucher.branch_id,
        user_id: reversedBy,
        action: 'VOUCHER_REVERSED',
        affected_voucher_id: voucher.id,
        details: reason,
      },
    });

    return reversalVoucher;
  }
}
