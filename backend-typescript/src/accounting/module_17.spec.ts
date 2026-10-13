import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { ReportsService } from './reports.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

describe('Module 17 — Reports & MIS', () => {
  let reportsService: ReportsService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let finYearId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, PrismaService],
    }).compile();

    reportsService = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Reports Org', code: `REP_ORG_${uuidv4().substring(0, 8)}` }
    });

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Reports Company Ltd',
        code: `REP_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'HQ', code: 'HQ' }
    });
    branchId = branch.id;

    const finYear = await prisma.financialYear.create({
      data: {
        company_id: companyId,
        label: 'FY 2026-27',
        start_date: new Date('2026-04-01'),
        end_date: new Date('2027-03-31'),
        is_active: true
      }
    });
    finYearId = finYear.id;

    // Create Ledger Accounts
    const salesGroup = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Direct Income', account_type: 'INCOME', code: 'GRP_INCOME' }
    });
    
    const salesAccount = await prisma.ledgerAccount.create({
      data: { company_id: companyId, parent_id: salesGroup.id, name: 'Sales Account', account_type: 'INCOME', code: 'L_SALES' }
    });

    const expenseGroup = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Indirect Expenses', account_type: 'EXPENSE', code: 'GRP_EXP' }
    });

    const rentAccount = await prisma.ledgerAccount.create({
      data: { company_id: companyId, parent_id: expenseGroup.id, name: 'Rent Expense', account_type: 'EXPENSE', code: 'L_RENT' }
    });

    const assetGroup = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Current Assets', account_type: 'ASSET', code: 'GRP_ASSET' }
    });

    const cashAccount = await prisma.ledgerAccount.create({
      data: { company_id: companyId, parent_id: assetGroup.id, name: 'Cash', account_type: 'ASSET', code: 'L_CASH' }
    });

    // Post some vouchers
    // 1. Sales Voucher (Cash Sales) - Dr Cash 5000, Cr Sales 5000
    const v1 = await prisma.voucher.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: finYearId,
        voucher_type: 'RECEIPT',
        document_number: 'REC-001',
        voucher_date: new Date('2026-10-10'),
        status: 'POSTED',
        lines: {
          create: [
            { ledger_account_id: cashAccount.id, debit: 5000, credit: 0 },
            { ledger_account_id: salesAccount.id, debit: 0, credit: 5000 }
          ]
        }
      }
    });

    // 2. Rent Payment - Dr Rent 2000, Cr Cash 2000
    const v2 = await prisma.voucher.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: finYearId,
        voucher_type: 'PAYMENT',
        document_number: 'PAY-001',
        voucher_date: new Date('2026-10-15'),
        status: 'POSTED',
        lines: {
          create: [
            { ledger_account_id: rentAccount.id, debit: 2000, credit: 0 },
            { ledger_account_id: cashAccount.id, debit: 0, credit: 2000 }
          ]
        }
      }
    });

  }, 60000);

  afterAll(async () => {
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: companyId } } });
    await prisma.voucher.deleteMany({ where: { company_id: companyId } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: companyId } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    
    // We fetch org.id to clean it up safely
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (company) {
      await prisma.company.delete({ where: { id: companyId } });
      await prisma.organization.delete({ where: { id: company.organization_id } });
    }
    await prisma.$disconnect();
  });

  it('should generate Day Book with correct vouchers', async () => {
    const daybook = await reportsService.getDayBook(companyId, '2026-10-01', '2026-10-31');
    expect(daybook.length).toBe(2);
    expect(daybook[0].document_number).toBe('REC-001');
    expect(daybook[1].document_number).toBe('PAY-001');
  });

  it('should generate accurate Trial Balance', async () => {
    const tb = await reportsService.getTrialBalance(companyId, '2026-10-31');
    
    // 3 ledgers should have balances: Cash, Sales, Rent
    expect(tb.length).toBe(3);

    const cashBal = tb.find(r => r.ledger_name === 'Cash');
    expect(cashBal).toBeDefined();
    // Cash: Dr 5000, Cr 2000
    expect(cashBal!.debit.toNumber()).toBe(5000);
    expect(cashBal!.credit.toNumber()).toBe(2000);

    const salesBal = tb.find(r => r.ledger_name === 'Sales Account');
    expect(salesBal!.credit.toNumber()).toBe(5000);
    expect(salesBal!.debit.toNumber()).toBe(0);

    const rentBal = tb.find(r => r.ledger_name === 'Rent Expense');
    expect(rentBal!.debit.toNumber()).toBe(2000);
    expect(rentBal!.credit.toNumber()).toBe(0);
  });

  it('should calculate Profit and Loss correctly', async () => {
    const pnl = await reportsService.getProfitAndLoss(companyId, '2026-04-01', '2027-03-31');
    
    // Income: 5000, Expense: 2000, Net Profit: 3000
    expect(pnl.total_income.toNumber()).toBe(5000);
    expect(pnl.total_expense.toNumber()).toBe(2000);
    expect(pnl.net_profit.toNumber()).toBe(3000);
  });
});
