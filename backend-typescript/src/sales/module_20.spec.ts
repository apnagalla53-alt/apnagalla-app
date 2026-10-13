import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { RetailerPortalService, RetailerOrderPayload } from './retailer-portal.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

describe('Module 20 — Retailer Portal', () => {
  let retailerPortalService: RetailerPortalService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let finYearId: string;
  let partyId: string;
  let itemId: string;
  let unitId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetailerPortalService, PrismaService],
    }).compile();

    retailerPortalService = module.get<RetailerPortalService>(RetailerPortalService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Retail Org', code: `RET_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Retail Company Ltd',
        code: `RET_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'Retail HQ', code: 'RHQ' }
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

    const party = await prisma.party.create({
      data: { company_id: companyId, party_type: 'CUSTOMER', name: 'Smart Retailer', code: 'RET_001' }
    });
    partyId = party.id;

    const unit = await prisma.unit.create({
      data: { company_id: companyId, name: 'Pieces', code: 'PCS' }
    });
    unitId = unit.id;

    const item = await prisma.item.create({
      data: { company_id: companyId, sku: 'RET-ITEM-001', name: 'Retail Item', item_type: "STOCK_ITEM", primary_unit_id: unitId }
    });
    itemId = item.id;

    // Create Ledger Account for Party to mock outstanding balance
    const partyLedger = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Smart Retailer A/C', account_type: 'ASSET', code: 'L_RET_001', party_id: partyId }
    });

    // Post a voucher to create an outstanding balance (Debit 1000)
    await prisma.voucher.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: finYearId,
        voucher_type: 'JOURNAL',
        document_number: 'JV-RET-001',
        voucher_date: new Date(),
        status: 'POSTED',
        lines: {
          create: [
            { ledger_account_id: partyLedger.id, debit: 1000, credit: 0 }
          ]
        }
      }
    });

    // Create a past Sales Invoice
    await prisma.salesInvoice.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: finYearId,
        party_id: partyId,
        document_number: 'INV-RET-001',
        document_date: new Date(),
        status: 'POSTED',
        grand_total: 1000,
        taxable_amount: 1000
      }
    });

  }, 60000);

  afterAll(async () => {
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: companyId } } });
    await prisma.voucher.deleteMany({ where: { company_id: companyId } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: companyId } });
    await prisma.salesOrderLine.deleteMany({ where: { sales_order: { company_id: companyId } } });
    await prisma.salesOrder.deleteMany({ where: { company_id: companyId } });
    await prisma.salesInvoice.deleteMany({ where: { company_id: companyId } });
    await prisma.item.deleteMany({ where: { company_id: companyId } });
    await prisma.unit.deleteMany({ where: { company_id: companyId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should retrieve outstanding balance for retailer', async () => {
    const balanceInfo = await retailerPortalService.getOutstandingBalance(partyId);
    expect(balanceInfo.party_id).toBe(partyId);
    expect(balanceInfo.outstanding_balance.toNumber()).toBe(1000);
  });

  it('should retrieve past invoices for retailer', async () => {
    const invoices = await retailerPortalService.getPastInvoices(partyId);
    expect(invoices.length).toBe(1);
    expect(invoices[0].document_number).toBe('INV-RET-001');
    expect(invoices[0].grand_total.toNumber()).toBe(1000);
  });

  it('should allow retailer to place an order', async () => {
    const payload: RetailerOrderPayload = {
      company_id: companyId,
      branch_id: branchId,
      lines: [
        {
          item_id: itemId,
          unit_id: unitId,
          quantity: 20,
          rate: 50
        }
      ]
    };

    const order = await retailerPortalService.placeOrder(partyId, payload);
    expect(order.document_number).toContain('RET-');
    expect(order.total.toNumber()).toBe(1000); // 20 * 50
    expect(order.status).toBe('CONFIRMED');
  });
});
