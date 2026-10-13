import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { PostingService, CreateVoucherDto } from './posting.service';

export interface CreateBankAccountDto {
  bank_name: string;
  account_number: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type?: string;
}

export interface RegisterChequeDto {
  branch_id?: string;
  financial_year_id?: string;
  cheque_type: 'ISSUED' | 'RECEIVED';
  cheque_number: string;
  cheque_date: string; // ISO date
  amount: number | Prisma.Decimal;
  party_id?: string;
  bank_account_id?: string;
  drawee_bank_name?: string;
  notes?: string;
}

@Injectable()
export class BankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingService: PostingService,
  ) {}

  async createBankAccount(companyId: string, branchId: string | undefined, dto: CreateBankAccountDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create a Ledger Account for the Bank
      // Under 'Bank Accounts' group
      const group = await tx.ledgerAccount.findFirst({
        where: { company_id: companyId, code: 'BANK_ACCOUNTS' }
      });

      if (!group) {
        throw new BadRequestException('Bank Accounts group not found');
      }

      const ledger = await tx.ledgerAccount.create({
        data: {
          company_id: companyId,
          parent_id: group.id,
          name: `${dto.bank_name} - ${dto.account_number.slice(-4)}`,
          code: `BANK_${dto.account_number}`,
          account_type: 'ASSET',
          is_system: false,
        }
      });

      // 2. Create the BankAccount record
      return tx.bankAccount.create({
        data: {
          company_id: companyId,
          branch_id: branchId,
          ledger_account_id: ledger.id,
          bank_name: dto.bank_name,
          account_number: dto.account_number,
          ifsc_code: dto.ifsc_code,
          branch_name: dto.branch_name,
          account_type: dto.account_type || 'CURRENT'
        }
      });
    });
  }

  async getBankAccounts(companyId: string) {
    return this.prisma.bankAccount.findMany({
      where: { company_id: companyId },
      include: { ledger_account: true }
    });
  }

  async registerCheque(companyId: string, dto: RegisterChequeDto) {
    // Basic validation
    if (dto.cheque_type === 'ISSUED' && !dto.bank_account_id) {
      throw new BadRequestException('Bank account is required for ISSUED cheques');
    }
    if (dto.cheque_type === 'RECEIVED' && !dto.party_id) {
      throw new BadRequestException('Party is required for RECEIVED cheques');
    }

    // Verify isolation
    if (dto.party_id) {
      const party = await this.prisma.party.findUnique({ where: { id: dto.party_id } });
      if (!party || party.company_id !== companyId) throw new BadRequestException('Invalid party');
    }
    if (dto.bank_account_id) {
      const bank = await this.prisma.bankAccount.findUnique({ where: { id: dto.bank_account_id } });
      if (!bank || bank.company_id !== companyId) throw new BadRequestException('Invalid bank account');
    }

    return this.prisma.cheque.create({
      data: {
        company_id: companyId,
        branch_id: dto.branch_id,
        financial_year_id: dto.financial_year_id,
        cheque_type: dto.cheque_type,
        cheque_number: dto.cheque_number,
        cheque_date: new Date(dto.cheque_date),
        amount: new Prisma.Decimal(dto.amount),
        party_id: dto.party_id,
        bank_account_id: dto.bank_account_id,
        drawee_bank_name: dto.drawee_bank_name,
        status: 'PENDING',
        notes: dto.notes,
      }
    });
  }

  async clearCheque(companyId: string, chequeId: string, clearDate: string, postedBy?: string) {
    const cheque = await this.prisma.cheque.findUnique({ 
      where: { id: chequeId },
      include: { bank_account: true, party: true }
    });

    if (!cheque || cheque.company_id !== companyId) throw new NotFoundException('Cheque not found');
    if (cheque.status !== 'PENDING') throw new BadRequestException(`Cannot clear cheque with status ${cheque.status}`);

    return this.prisma.$transaction(async (tx) => {
      // 1. Post Accounting Voucher
      // If RECEIVED: Dr Bank, Cr Party (Receipt)
      // If ISSUED: Dr Party (or Expense), Cr Bank (Payment)

      let debitAccountId: string;
      let creditAccountId: string;
      let voucherType: string;

      if (cheque.cheque_type === 'RECEIVED') {
        if (!cheque.party_id) throw new BadRequestException('Received cheque must have a party');
        // We need a bank account to deposit into
        // For simplicity, let's say the user must select a bank account when clearing, or it was selected when deposited.
        // If bank_account_id is null on the cheque, we can't clear it without knowing where it was deposited.
        // Let's assume bank_account_id is set.
        if (!cheque.bank_account_id) throw new BadRequestException('Bank account is required to clear a received cheque');
        
        const partyLedger = await tx.ledgerAccount.findFirst({ where: { party_id: cheque.party_id } });
        if (!partyLedger) throw new BadRequestException('Party ledger not found');
        debitAccountId = cheque.bank_account!.ledger_account_id;
        creditAccountId = partyLedger.id;
        voucherType = 'RECEIPT';
      } else {
        if (!cheque.party_id) throw new BadRequestException('Issued cheque must have a party');
        if (!cheque.bank_account_id) throw new BadRequestException('Issued cheque must have a bank account');
        
        const partyLedger = await tx.ledgerAccount.findFirst({ where: { party_id: cheque.party_id } });
        if (!partyLedger) throw new BadRequestException('Party ledger not found');
        debitAccountId = partyLedger.id;
        creditAccountId = cheque.bank_account!.ledger_account_id;
        voucherType = 'PAYMENT';
      }

      const branch = await tx.branch.findFirst({ where: { company_id: companyId } });
      const finYear = await tx.financialYear.findFirst({ where: { company_id: companyId, is_active: true } });

      const voucherData: any = {
        company_id: companyId,
        branch_id: cheque.branch_id || branch?.id,
        financial_year_id: cheque.financial_year_id || finYear?.id,
        voucher_type: voucherType,
        document_number: `CHQ-${cheque.cheque_number}`,
        narration: `Cheque clearance: ${cheque.cheque_number}`,
        source_document_type: 'CHEQUE',
        source_document_id: cheque.id,
        voucher_date: new Date(clearDate),
        status: 'POSTED',
      };
      if (postedBy) voucherData.posted_by = postedBy;

      const voucher = await tx.voucher.create({ data: voucherData });

      await tx.voucherLine.createMany({
        data: [
          { voucher_id: voucher.id, ledger_account_id: debitAccountId, debit: cheque.amount, credit: new Prisma.Decimal(0) },
          { voucher_id: voucher.id, ledger_account_id: creditAccountId, debit: new Prisma.Decimal(0), credit: cheque.amount }
        ]
      });

      // Since we need IDs for bill allocations:
      const lines = await tx.voucherLine.findMany({ where: { voucher_id: voucher.id } });
      const partyLineAccountId = cheque.cheque_type === 'RECEIVED' ? creditAccountId : debitAccountId;
      const partyLine = lines.find(l => l.ledger_account_id === partyLineAccountId);
      
      if (partyLine) {
         await tx.billAllocation.create({
           data: {
             company_id: companyId,
             party_id: cheque.party_id!,
             voucher_line_id: partyLine.id,
             allocation_type: 'NEW_REFERENCE',
             reference_document_type: voucherType,
             reference_document_id: voucher.id,
             amount: cheque.amount
           }
         });
      }

      // 2. Update Cheque Status
      return tx.cheque.update({
        where: { id: chequeId },
        data: {
          status: 'CLEARED',
          cleared_date: new Date(clearDate),
          voucher_id: voucher.id
        }
      });
    });
  }

  async bounceCheque(companyId: string, chequeId: string, bounceReason: string) {
    const cheque = await this.prisma.cheque.findUnique({ where: { id: chequeId } });
    if (!cheque || cheque.company_id !== companyId) throw new NotFoundException('Cheque not found');
    if (cheque.status !== 'PENDING') throw new BadRequestException(`Cannot bounce cheque with status ${cheque.status}`);

    return this.prisma.cheque.update({
      where: { id: chequeId },
      data: {
        status: 'BOUNCED',
        bounce_reason: bounceReason
      }
    });
  }
}
