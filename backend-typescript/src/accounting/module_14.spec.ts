import { Test, TestingModule } from '@nestjs/testing';
import { CreditService } from './credit.service';
import { PostingService } from './posting.service';
import { PrismaService } from '../database/prisma.service';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';

describe('Module 14 — Credit & Outstanding', () => {
  let creditService: CreditService;
  let postingService: PostingService;
  let prisma: PrismaService;

  let companyId: string = '';
  let branchId: string = '';
  let fyId: string = '';
  let partyCustomerAId: string = '';
  let partyCustomerBId: string = '';
  let partySupplierAId: string = '';
  let arLedgerId: string = '';
  let apLedgerId: string = '';
  let salesLedgerId: string = '';
  let purchaseLedgerId: string = '';
  let bankLedgerId: string = '';
  let userId: string = '';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreditService, PostingService, PrismaService],
    }).compile();

    creditService = module.get<CreditService>(CreditService);
    postingService = module.get<PostingService>(PostingService);
    prisma = module.get<PrismaService>(PrismaService);

    const timestamp = Date.now();

    // Setup base organization/company
    const org = await prisma.organization.create({
      data: { name: `M14 Org ${timestamp}`, code: `O14_${timestamp}` },
    });
    const company = await prisma.company.create({
      data: { organization_id: org.id, code: `C14_${timestamp}`, legal_name: `Comp 14 ${timestamp}` },
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, code: `B14_${timestamp}`, name: 'HQ' },
    });
    branchId = branch.id;

    const fy = await prisma.financialYear.create({
      data: { company_id: companyId, label: 'FY2026', start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31') },
    });
    fyId = fy.id;

    const user = await prisma.user.create({
      data: { organization_id: org.id, username: `u14_${timestamp}`, password_hash: 'hash', display_name: 'Test' },
    });
    userId = user.id;

    // Create Ledgers
    const arLedger = await prisma.ledgerAccount.create({ data: { company_id: companyId, branch_id: branchId, code: `AR_${timestamp}`, name: 'AR', account_type: 'ASSET', normal_balance: 'DEBIT' } });
    const apLedger = await prisma.ledgerAccount.create({ data: { company_id: companyId, branch_id: branchId, code: `AP_${timestamp}`, name: 'AP', account_type: 'LIABILITY', normal_balance: 'CREDIT' } });
    const salesLedger = await prisma.ledgerAccount.create({ data: { company_id: companyId, branch_id: branchId, code: `SALES_${timestamp}`, name: 'Sales', account_type: 'REVENUE', normal_balance: 'CREDIT' } });
    const purchaseLedger = await prisma.ledgerAccount.create({ data: { company_id: companyId, branch_id: branchId, code: `PURCH_${timestamp}`, name: 'Purchases', account_type: 'EXPENSE', normal_balance: 'DEBIT' } });
    const bankLedger = await prisma.ledgerAccount.create({ data: { company_id: companyId, branch_id: branchId, code: `BANK_${timestamp}`, name: 'Bank', account_type: 'ASSET', normal_balance: 'DEBIT' } });
    
    arLedgerId = arLedger.id;
    apLedgerId = apLedger.id;
    salesLedgerId = salesLedger.id;
    purchaseLedgerId = purchaseLedger.id;
    bankLedgerId = bankLedger.id;

    // Create Parties
    const custA = await prisma.party.create({
      data: { company_id: companyId, code: `CUSTA_${timestamp}`, party_type: 'CUSTOMER', name: 'Customer A', credit_limit: 10000 },
    });
    partyCustomerAId = custA.id;

    const custB = await prisma.party.create({
      data: { company_id: companyId, code: `CUSTB_${timestamp}`, party_type: 'CUSTOMER', name: 'Customer B', is_blocked: true, block_reason: 'Overdue defaults' },
    });
    partyCustomerBId = custB.id;

    const suppA = await prisma.party.create({
      data: { company_id: companyId, code: `SUPPA_${timestamp}`, party_type: 'SUPPLIER', name: 'Supplier A' },
    });
    partySupplierAId = suppA.id;

  }, 60000);

  afterAll(async () => {
    // Teardown
    await prisma.billAllocation.deleteMany({ where: { company_id: companyId } });
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: companyId } } });
    await prisma.voucher.deleteMany({ where: { company_id: companyId } });
    await prisma.creditOverride.deleteMany({ where: { company_id: companyId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: companyId } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.auditLog.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    
    const comp = await prisma.company.findUnique({ where: { id: companyId } });
    if (comp) {
      await prisma.company.deleteMany({ where: { id: companyId } });
      await prisma.organization.deleteMany({ where: { id: comp.organization_id } });
    }
  });

  describe('14.1 Outstanding Calculation (Derived Authoritative Truth)', () => {
    it('calculates 0 outstanding for a new customer', async () => {
      const outstanding = await creditService.getPartyOutstanding(companyId, partyCustomerAId);
      expect(outstanding.toNumber()).toBe(0);
    });

    it('calculates correct outstanding after a Sales Invoice (Debit)', async () => {
      const ts = Date.now();
      const dto = {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: fyId,
        voucher_type: 'SALES',
        document_number: `INV-${ts}`,
        voucher_date: new Date(),
        posted_by: userId,
        lines: [
          { ledger_account_id: arLedgerId, debit: 1500, credit: 0, party_id: partyCustomerAId },
          { ledger_account_id: salesLedgerId, debit: 0, credit: 1500 }
        ]
      };
      
      const v = await postingService.postVoucherWithIsolationChecks(dto);
      
      // Simulate BillAllocation creation (usually done by SalesPostingService)
      await prisma.billAllocation.create({
        data: {
          company_id: companyId,
          party_id: partyCustomerAId,
          voucher_line_id: v.lines.find(l => l.ledger_account_id === arLedgerId)!.id,
          reference_document_type: 'SALES_INVOICE',
          reference_document_id: v.id,
          allocation_type: 'NEW_REFERENCE',
          amount: 1500,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      const outstanding = await creditService.getPartyOutstanding(companyId, partyCustomerAId);
      expect(outstanding.toNumber()).toBe(1500);
    });

    it('calculates correct outstanding after a Receipt (Credit)', async () => {
      const ts = Date.now();
      const dto = {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: fyId,
        voucher_type: 'RECEIPT',
        document_number: `RCT-${ts}`,
        voucher_date: new Date(),
        posted_by: userId,
        lines: [
          { ledger_account_id: bankLedgerId, debit: 500, credit: 0 },
          { ledger_account_id: arLedgerId, debit: 0, credit: 500, party_id: partyCustomerAId }
        ]
      };
      
      const v = await postingService.postVoucherWithIsolationChecks(dto);

      // Simulate AGAINST_REFERENCE allocation
      const invoiceAlloc = await prisma.billAllocation.findFirst({
        where: { party_id: partyCustomerAId, allocation_type: 'NEW_REFERENCE' }
      });

      await prisma.billAllocation.create({
        data: {
          company_id: companyId,
          party_id: partyCustomerAId,
          voucher_line_id: v.lines.find(l => l.ledger_account_id === arLedgerId)!.id,
          reference_document_type: 'SALES_INVOICE',
          reference_document_id: invoiceAlloc!.reference_document_id,
          allocation_type: 'AGAINST_REFERENCE',
          amount: 500
        }
      });

      const outstanding = await creditService.getPartyOutstanding(companyId, partyCustomerAId);
      expect(outstanding.toNumber()).toBe(1000); // 1500 - 500
    });
  });

  describe('14.2 Credit Limit Enforcement', () => {
    it('allows transaction within credit limit', async () => {
      // Limit is 10000, current outstanding is 1000
      const res = await creditService.checkCreditLimit(companyId, partyCustomerAId, 5000);
      expect(res.allowed).toBe(true);
    });

    it('blocks transaction exceeding credit limit', async () => {
      const res = await creditService.checkCreditLimit(companyId, partyCustomerAId, 10000);
      // 1000 + 10000 = 11000 > 10000
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('exceeds effective credit limit');
    });

    it('allows transaction if temporary limit is set and valid', async () => {
      await prisma.party.update({
        where: { id: partyCustomerAId },
        data: {
          temporary_credit_limit: 15000,
          temporary_credit_expiry: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
        }
      });

      const res = await creditService.checkCreditLimit(companyId, partyCustomerAId, 10000);
      // 1000 + 10000 = 11000 <= 15000 (temporary limit)
      expect(res.allowed).toBe(true);
    });

    it('reverts to base limit if temporary limit is expired', async () => {
      await prisma.party.update({
        where: { id: partyCustomerAId },
        data: {
          temporary_credit_expiry: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }
      });

      const res = await creditService.checkCreditLimit(companyId, partyCustomerAId, 10000);
      // Temp limit expired, falls back to 10000 limit. 11000 > 10000
      expect(res.allowed).toBe(false);
    });

    it('blocks transaction entirely if party is marked is_blocked', async () => {
      const res = await creditService.checkCreditLimit(companyId, partyCustomerBId, 100);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Party is blocked');
    });
  });

  describe('14.3 Ageing Calculation', () => {
    it('groups outstanding allocations into correct ageing buckets', async () => {
      const ageing = await creditService.getPartyAgeing(companyId, partyCustomerAId, new Date());
      // Total outstanding should be 1000, and since invoice date is today, it should fall in 0-30 days
      expect(ageing.total.toNumber()).toBe(1000);
      expect(ageing['0-30'].toNumber()).toBe(1000);
      expect(ageing['31-60'].toNumber()).toBe(0);
    });
  });
});
