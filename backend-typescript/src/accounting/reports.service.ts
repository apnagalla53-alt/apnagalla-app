import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface TrialBalanceRow {
  ledger_id: string;
  ledger_name: string;
  account_type: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a Day Book report showing all vouchers for a specific day or date range.
   */
  async getDayBook(companyId: string, fromDate: string, toDate: string) {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        company_id: companyId,
        voucher_date: {
          gte: new Date(fromDate),
          lte: new Date(toDate)
        },
        status: 'POSTED'
      },
      include: {
        lines: {
          include: { ledger_account: true }
        }
      },
      orderBy: { voucher_date: 'asc' }
    });

    return vouchers;
  }

  /**
   * Generates a Trial Balance as of a specific date.
   * This aggregates all posted voucher lines for each ledger account.
   */
  async getTrialBalance(companyId: string, asOfDate: string): Promise<TrialBalanceRow[]> {
    const ledgers = await this.prisma.ledgerAccount.findMany({
      where: { company_id: companyId }
    });

    const lines = await this.prisma.voucherLine.findMany({
      where: {
        voucher: {
          company_id: companyId,
          status: 'POSTED',
          voucher_date: { lte: new Date(asOfDate) }
        }
      }
    });

    const tb: Map<string, TrialBalanceRow> = new Map();

    for (const ledger of ledgers) {
      tb.set(ledger.id, {
        ledger_id: ledger.id,
        ledger_name: ledger.name,
        account_type: ledger.account_type,
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0)
      });
    }

    for (const line of lines) {
      const row = tb.get(line.ledger_account_id);
      if (row) {
        row.debit = row.debit.add(line.debit);
        row.credit = row.credit.add(line.credit);
      }
    }

    // Filter out zero balance ledgers
    const result = Array.from(tb.values()).filter(
      r => !r.debit.equals(0) || !r.credit.equals(0)
    );

    return result;
  }

  /**
   * Generates a simplified Profit & Loss Statement (P&L) for a date range.
   */
  async getProfitAndLoss(companyId: string, fromDate: string, toDate: string) {
    const lines = await this.prisma.voucherLine.findMany({
      where: {
        ledger_account: { account_type: { in: ['INCOME', 'EXPENSE'] } },
        voucher: {
          company_id: companyId,
          status: 'POSTED',
          voucher_date: {
            gte: new Date(fromDate),
            lte: new Date(toDate)
          }
        }
      },
      include: { ledger_account: true }
    });

    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);

    for (const line of lines) {
      if (line.ledger_account.account_type === 'INCOME') {
        // Income normal balance is credit
        totalIncome = totalIncome.add(line.credit).sub(line.debit);
      } else if (line.ledger_account.account_type === 'EXPENSE') {
        // Expense normal balance is debit
        totalExpense = totalExpense.add(line.debit).sub(line.credit);
      }
    }

    const netProfit = totalIncome.sub(totalExpense);

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_profit: netProfit
    };
  }
}
