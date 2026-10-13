import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface AgeingBucket {
  '0-30': Prisma.Decimal;
  '31-60': Prisma.Decimal;
  '61-90': Prisma.Decimal;
  '90+': Prisma.Decimal;
  total: Prisma.Decimal;
}

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate the total net outstanding for a party by summing all their accounting ledger entries.
   * For Customers: Outstanding = Debits - Credits
   * For Suppliers: Outstanding = Credits - Debits
   */
  async getPartyOutstanding(companyId: string, partyId: string): Promise<Prisma.Decimal> {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.company_id !== companyId) {
      throw new BadRequestException('Party not found');
    }

    // Query all non-reversed voucher lines for this party
    const lines = await this.prisma.voucherLine.findMany({
      where: {
        party_id: partyId,
        voucher: {
          company_id: companyId,
          status: 'POSTED',
        }
      }
    });

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of lines) {
      totalDebit = totalDebit.plus(line.debit);
      totalCredit = totalCredit.plus(line.credit);
    }

    if (party.party_type === 'CUSTOMER') {
      return totalDebit.minus(totalCredit);
    } else {
      return totalCredit.minus(totalDebit);
    }
  }

  /**
   * Check if a new transaction amount will exceed the customer's credit limit.
   */
  async checkCreditLimit(companyId: string, partyId: string, newAmount: Prisma.Decimal | number): Promise<{
    allowed: boolean;
    currentOutstanding: Prisma.Decimal;
    creditLimit: Prisma.Decimal | null;
    reason?: string;
  }> {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.company_id !== companyId) {
      throw new BadRequestException('Party not found');
    }

    const currentOutstanding = await this.getPartyOutstanding(companyId, partyId);
    
    // If the party is blocked entirely, reject
    if (party.is_blocked) {
      return {
        allowed: false,
        currentOutstanding,
        creditLimit: party.credit_limit,
        reason: `Party is blocked: ${party.block_reason || 'No reason provided'}`,
      };
    }

    const amt = new Prisma.Decimal(newAmount);
    const projectedOutstanding = currentOutstanding.plus(amt);

    // Determine the effective credit limit (temporary takes precedence if valid)
    let effectiveLimit = party.credit_limit;
    if (
      party.temporary_credit_limit &&
      party.temporary_credit_expiry &&
      party.temporary_credit_expiry >= new Date()
    ) {
      effectiveLimit = party.temporary_credit_limit;
    }

    // If no limit is set, it means unlimited credit
    if (effectiveLimit === null) {
      return { allowed: true, currentOutstanding, creditLimit: null };
    }

    if (projectedOutstanding.greaterThan(effectiveLimit)) {
      return {
        allowed: false,
        currentOutstanding,
        creditLimit: effectiveLimit,
        reason: `Transaction amount ${amt.toString()} exceeds effective credit limit ${effectiveLimit.toString()} (Current outstanding: ${currentOutstanding.toString()})`,
      };
    }

    return { allowed: true, currentOutstanding, creditLimit: effectiveLimit };
  }

  /**
   * Calculate Ageing of outstanding invoices based on BillAllocations
   */
  async getPartyAgeing(companyId: string, partyId: string, asOfDate: Date = new Date()): Promise<AgeingBucket> {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new BadRequestException('Party not found');

    // 1. Fetch all NEW_REFERENCE allocations (invoices)
    const newRefs = await this.prisma.billAllocation.findMany({
      where: {
        company_id: companyId,
        party_id: partyId,
        allocation_type: 'NEW_REFERENCE',
        voucher_line: {
          voucher: { status: 'POSTED' }
        }
      },
      include: {
        voucher_line: {
          include: { voucher: true }
        }
      }
    });

    // 2. Fetch all AGAINST_REFERENCE allocations (payments/receipts)
    const againstRefs = await this.prisma.billAllocation.findMany({
      where: {
        company_id: companyId,
        party_id: partyId,
        allocation_type: 'AGAINST_REFERENCE',
        voucher_line: {
          voucher: { status: 'POSTED' }
        }
      }
    });

    // Group AGAINST_REFERENCE amounts by reference_document_id
    const clearedAmounts: Record<string, Prisma.Decimal> = {};
    for (const alloc of againstRefs) {
      const refId = alloc.reference_document_id;
      if (!clearedAmounts[refId]) clearedAmounts[refId] = new Prisma.Decimal(0);
      clearedAmounts[refId] = clearedAmounts[refId].plus(alloc.amount);
    }

    const buckets: AgeingBucket = {
      '0-30': new Prisma.Decimal(0),
      '31-60': new Prisma.Decimal(0),
      '61-90': new Prisma.Decimal(0),
      '90+': new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    };

    const asOfMs = asOfDate.getTime();

    for (const invoice of newRefs) {
      const cleared = clearedAmounts[invoice.reference_document_id] || new Prisma.Decimal(0);
      const pending = invoice.amount.minus(cleared);

      if (pending.greaterThan(0)) {
        // Age is calculated from due_date (if present) or voucher_date
        const baseDate = invoice.due_date || invoice.voucher_line.voucher.voucher_date;
        const diffMs = asOfMs - baseDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        buckets.total = buckets.total.plus(pending);

        if (diffDays <= 30) buckets['0-30'] = buckets['0-30'].plus(pending);
        else if (diffDays <= 60) buckets['31-60'] = buckets['31-60'].plus(pending);
        else if (diffDays <= 90) buckets['61-90'] = buckets['61-90'].plus(pending);
        else buckets['90+'] = buckets['90+'].plus(pending);
      }
    }

    return buckets;
  }
}
