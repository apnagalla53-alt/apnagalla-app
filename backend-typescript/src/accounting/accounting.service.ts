import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateAccountDto {
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  parent_id?: string;
  party_id?: string;
  is_active?: boolean;
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async getChartOfAccounts(companyId: string) {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { company_id: companyId },
      include: { children: true },
      orderBy: [{ account_type: 'asc' }, { code: 'asc' }],
    });
    return accounts;
  }

  async createAccount(companyId: string, branchId: string, dto: CreateAccountDto) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { company_id: companyId, code: dto.code }
    });

    if (existing) {
      throw new BadRequestException(`Account with code ${dto.code} already exists`);
    }

    if (dto.parent_id) {
      const parent = await this.prisma.ledgerAccount.findUnique({ where: { id: dto.parent_id } });
      if (!parent || parent.company_id !== companyId) {
        throw new BadRequestException('Invalid parent account');
      }
    }

    return this.prisma.ledgerAccount.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        code: dto.code,
        name: dto.name,
        account_type: dto.account_type,
        normal_balance: dto.normal_balance,
        parent_id: dto.parent_id,
        party_id: dto.party_id,
        is_active: dto.is_active ?? true,
      }
    });
  }

  async getAccountBalance(companyId: string, accountId: string) {
    const lines = await this.prisma.voucherLine.findMany({
      where: {
        ledger_account_id: accountId,
        voucher: {
          company_id: companyId,
          status: 'POSTED',
        }
      },
    });

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of lines) {
      totalDebit = totalDebit.plus(line.debit);
      totalCredit = totalCredit.plus(line.credit);
    }

    const account = await this.prisma.ledgerAccount.findUnique({
      where: { id: accountId }
    });

    if (!account || account.company_id !== companyId) {
      throw new BadRequestException('Account not found');
    }

    let netBalance = new Prisma.Decimal(0);
    if (account.normal_balance === 'DEBIT') {
      netBalance = totalDebit.minus(totalCredit);
    } else {
      netBalance = totalCredit.minus(totalDebit);
    }

    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      normal_balance: account.normal_balance,
      total_debit: totalDebit.toString(),
      total_credit: totalCredit.toString(),
      net_balance: netBalance.toString(),
    };
  }

  async getLedger(companyId: string, accountId: string, startDate?: string, endDate?: string) {
    const whereClause: any = {
      ledger_account_id: accountId,
      voucher: {
        company_id: companyId,
        status: 'POSTED',
      }
    };

    if (startDate || endDate) {
      whereClause.voucher.voucher_date = {};
      if (startDate) whereClause.voucher.voucher_date.gte = new Date(startDate);
      if (endDate) whereClause.voucher.voucher_date.lte = new Date(endDate);
    }

    const lines = await this.prisma.voucherLine.findMany({
      where: whereClause,
      include: {
        voucher: {
          select: {
            voucher_date: true,
            document_number: true,
            voucher_type: true,
            narration: true,
            source_document_type: true,
            source_document_id: true,
          }
        },
        party: {
          select: { name: true }
        }
      },
      orderBy: {
        voucher: {
          voucher_date: 'asc'
        }
      }
    });

    return lines;
  }

  async getTrialBalance(companyId: string, asOfDate?: string) {
    const whereClause: any = {
      voucher: {
        company_id: companyId,
        status: 'POSTED',
      }
    };

    if (asOfDate) {
      whereClause.voucher.voucher_date = { lte: new Date(asOfDate) };
    }

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { company_id: companyId },
      orderBy: [{ account_type: 'asc' }, { code: 'asc' }],
    });

    const trialBalance = [];
    let grandTotalDebit = new Prisma.Decimal(0);
    let grandTotalCredit = new Prisma.Decimal(0);

    for (const account of accounts) {
      const lines = await this.prisma.voucherLine.findMany({
        where: { ...whereClause, ledger_account_id: account.id },
      });

      let totalDebit = new Prisma.Decimal(0);
      let totalCredit = new Prisma.Decimal(0);

      for (const line of lines) {
        totalDebit = totalDebit.plus(line.debit);
        totalCredit = totalCredit.plus(line.credit);
      }

      if (totalDebit.equals(0) && totalCredit.equals(0)) continue;

      let netBalance = new Prisma.Decimal(0);
      if (account.normal_balance === 'DEBIT') {
        netBalance = totalDebit.minus(totalCredit);
      } else {
        netBalance = totalCredit.minus(totalDebit);
      }

      trialBalance.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        normal_balance: account.normal_balance,
        total_debit: totalDebit.toString(),
        total_credit: totalCredit.toString(),
        net_balance: netBalance.toString(),
      });

      grandTotalDebit = grandTotalDebit.plus(totalDebit);
      grandTotalCredit = grandTotalCredit.plus(totalCredit);
    }

    return {
      companyId,
      asOfDate,
      accounts: trialBalance,
      grandTotalDebit: grandTotalDebit.toString(),
      grandTotalCredit: grandTotalCredit.toString(),
      isBalanced: grandTotalDebit.equals(grandTotalCredit),
    };
  }
}
