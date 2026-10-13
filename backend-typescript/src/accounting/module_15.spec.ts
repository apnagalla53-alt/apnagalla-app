import { Test, TestingModule } from '@nestjs/testing';
import { BankingService } from './banking.service';
import { PrismaService } from '../database/prisma.service';
import { PostingService } from './posting.service';
import { AccountingService } from './accounting.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

describe('Module 15 — Banking & PDC', () => {
  let bankingService: BankingService;
  let prisma: PrismaService;
  
  let companyId: string;
  let bankAccountId: string;
  let partyId: string;
  let branchId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BankingService, PostingService, AccountingService, PrismaService],
    }).compile();

    bankingService = module.get<BankingService>(BankingService);
    prisma = module.get<PrismaService>(PrismaService);

    orgId = uuidv4();
    await prisma.organization.create({
      data: { id: orgId, name: 'Bank Test Org', code: `BANKORG_${uuidv4().substring(0,8)}` }
    });
    
    companyId = uuidv4();
    branchId = uuidv4();

    await prisma.company.create({
      data: { id: companyId, organization_id: orgId, code: `BANKTEST_${uuidv4().substring(0,8)}`, legal_name: 'Bank Test Legal Co' }
    });

    await prisma.branch.create({
      data: { id: branchId, company_id: companyId, name: 'Main Branch', code: 'MAIN' }
    });

    const finYear = await prisma.financialYear.create({
      data: { company_id: companyId, start_date: new Date('2026-01-01'), end_date: new Date('2026-12-31'), is_active: true, label: 'FY26' }
    });

    // Create Account Groups as LedgerAccounts
    const assetGroup = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Assets', code: 'ASSETS', parent_id: null, account_type: 'ASSET' }
    });
    const bankGroup = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Bank Accounts', code: 'BANK_ACCOUNTS', parent_id: assetGroup.id, account_type: 'ASSET' }
    });
    const debtorsGroup = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Sundry Debtors', code: 'DEBTORS', parent_id: assetGroup.id, account_type: 'ASSET' }
    });

    // Create party
    const party = await prisma.party.create({
      data: { company_id: companyId, party_type: 'CUSTOMER', name: 'Customer XYZ', code: 'PARTY_XYZ' }
    });
    const partyLedger = await prisma.ledgerAccount.create({
      data: { company_id: companyId, parent_id: debtorsGroup.id, name: 'Customer XYZ', account_type: 'ASSET', code: 'CUST_XYZ', party_id: party.id }
    });
    partyId = party.id;
  }, 60000);

  afterAll(async () => {
    await prisma.billAllocation.deleteMany({ where: { company_id: companyId } });
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: companyId } } });
    await prisma.voucher.deleteMany({ where: { company_id: companyId } });
    await prisma.cheque.deleteMany({ where: { company_id: companyId } });
    await prisma.bankAccount.deleteMany({ where: { company_id: companyId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: companyId } });
    await prisma.auditLog.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it('should create a bank account and its ledger', async () => {
    const bank = await bankingService.createBankAccount(companyId, branchId, {
      bank_name: 'National Bank',
      account_number: 'NB123456',
      ifsc_code: 'NB001'
    });
    
    expect(bank).toBeDefined();
    expect(bank.bank_name).toBe('National Bank');
    expect(bank.ledger_account_id).toBeDefined();
    
    bankAccountId = bank.id;
    
    const ledger = await prisma.ledgerAccount.findUnique({ where: { id: bank.ledger_account_id } });
    expect(ledger).toBeDefined();
    expect(ledger?.name).toContain('3456');
  });

  it('should register a received PDC cheque', async () => {
    const cheque = await bankingService.registerCheque(companyId, {
      cheque_type: 'RECEIVED',
      cheque_number: 'CHQ-999',
      cheque_date: '2026-10-15',
      amount: 500,
      party_id: partyId,
      drawee_bank_name: 'Other Bank'
    });
    
    expect(cheque).toBeDefined();
    expect(cheque.status).toBe('PENDING');
    expect(Number(cheque.amount)).toBe(500);
  });

  it('should clear a received cheque and post accounting voucher', async () => {
    // 1. First assign bank_account_id (deposit into our bank)
    const pendingCheque = await prisma.cheque.findFirst({ where: { cheque_number: 'CHQ-999' } });
    await prisma.cheque.update({
      where: { id: pendingCheque!.id },
      data: { bank_account_id: bankAccountId }
    });

    const cleared = await bankingService.clearCheque(companyId, pendingCheque!.id, '2026-10-16');
    
    expect(cleared.status).toBe('CLEARED');
    expect(cleared.voucher_id).toBeDefined();

    // Verify Voucher
    const voucher = await prisma.voucher.findUnique({ 
      where: { id: cleared.voucher_id! },
      include: { lines: true }
    });
    expect(voucher).toBeDefined();
    expect(voucher?.voucher_type).toBe('RECEIPT');
    expect(voucher?.lines.length).toBe(2);
    
    const bankLine = voucher?.lines.find(l => Number(l.debit) === 500);
    expect(bankLine).toBeDefined(); // Bank is debited 500
    
    // Verify Bill Allocation was created for party line
    const partyLine = voucher?.lines.find(l => Number(l.credit) === 500);
    const alloc = await prisma.billAllocation.findFirst({
      where: { voucher_line_id: partyLine!.id }
    });
    expect(alloc).toBeDefined();
    expect(alloc?.allocation_type).toBe('NEW_REFERENCE'); // advance receipt
  });

  it('should bounce a cheque', async () => {
    const cheque = await bankingService.registerCheque(companyId, {
      cheque_type: 'RECEIVED',
      cheque_number: 'CHQ-888',
      cheque_date: '2026-10-15',
      amount: 300,
      party_id: partyId
    });

    const bounced = await bankingService.bounceCheque(companyId, cheque.id, 'Insufficient Funds');
    expect(bounced.status).toBe('BOUNCED');
    expect(bounced.bounce_reason).toBe('Insufficient Funds');
  });
});
