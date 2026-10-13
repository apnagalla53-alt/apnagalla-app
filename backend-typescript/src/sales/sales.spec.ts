import { Test, TestingModule } from '@nestjs/testing';
import { SalesPostingService } from './posting.service';
import { SalesService } from './sales.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryPostingService } from '../inventory/posting.service';
import { getIntents } from '../intelligence/intent-handlers';

import { ConfigModule } from '@nestjs/config';
import { SalesModule } from './sales.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

// Vitest globals
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeAll: any;
declare const afterAll: any;

describe('Sales Module - End to End Business Logic', () => {
  let postingService: SalesPostingService;
  let salesService: SalesService;
  let prisma: PrismaService;

  let companyId: string;
  let company2Id: string;
  let branchId: string;
  let godownId: string;
  let partyId: string;
  let itemId: string;
  let unitId: string;
  let finYearId: string;
  let userId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        SalesModule,
        AuthModule
      ],
    }).compile();

    postingService = module.get<SalesPostingService>(SalesPostingService);
    salesService = module.get<SalesService>(SalesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Test Data
    const org = await prisma.organization.create({
      data: { name: 'Test Org Sales', code: `ORG_SALES_${Date.now()}` }
    });
    const comp = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'Sales Co Ltd', code: `CO_${Date.now()}` }
    });
    companyId = comp.id;

    const comp2 = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'Other Co Ltd', code: `CO2_${Date.now()}` }
    });
    company2Id = comp2.id;

    const branch = await prisma.branch.create({
      data: { company_id: comp.id, name: 'HQ', code: `HQ_${Date.now()}` }
    });
    branchId = branch.id;

    const godown = await prisma.godown.create({
      data: { branch_id: branchId, name: 'Main Godown', code: `G_${Date.now()}` }
    });
    godownId = godown.id;

    const party = await prisma.party.create({
      data: { company_id: companyId, code: `P_${Date.now()}`, name: 'Customer A', party_type: 'CUSTOMER' }
    });
    partyId = party.id;

    await prisma.ledgerAccount.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        party_id: partyId,
        code: `AR_${Date.now()}`,
        name: 'Accounts Receivable - Customer A',
        account_type: 'ASSET',
        normal_balance: 'DEBIT',
        is_active: true
      }
    });

    const unit = await prisma.unit.create({
      data: { company_id: companyId, code: `U_${Date.now()}`, name: 'Pieces' }
    });
    unitId = unit.id;

    const item = await prisma.item.create({
      data: { company_id: companyId, primary_unit_id: unitId, name: 'Product X', item_type: "STOCK_ITEM", sku: `SKU_${Date.now()}` }
    });
    itemId = item.id;

    const fy = await prisma.financialYear.create({
      data: { company_id: companyId, label: 'FY2026', start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31') }
    });
    finYearId = fy.id;

    const user = await prisma.user.create({
      data: { organization_id: org.id, username: `u_${Date.now()}`, display_name: 'Tester', password_hash: 'xxx' }
    });
    userId = user.id;

    // Set initial stock (100 units)
    const invService = module.get<InventoryPostingService>(InventoryPostingService);
    await invService.postMovement(prisma, {
      company_id: companyId,
      branch_id: branchId,
      movement_type: 'OPENING_IN',
      business_date: new Date(),
      source_document_type: 'OPENING',
      source_document_id: '00000000-0000-0000-0000-000000000123',
      lines: [{
        item_id: itemId,
        godown_id: godownId,
        quantity: 10000,
        unit_id: unitId
      }]
    });
  }, 30000);

  afterAll(async () => {
    // Teardown cascade
    const cIds = [companyId, company2Id].filter(Boolean);
    if (cIds.length === 0) return;

    await prisma.pricingTrace.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.auditLog.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.billAllocation.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: { in: cIds } } } });
    await prisma.voucher.deleteMany({ where: { company_id: { in: cIds } } });
    
    await prisma.stockMovement.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.stockBalanceProjection.deleteMany({ where: { company_id: { in: cIds } } });
    
    await prisma.salesReturnLine.deleteMany({ where: { sales_return: { company_id: { in: cIds } } } });
    await prisma.salesReturn.deleteMany({ where: { company_id: { in: cIds } } });

    await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice: { company_id: { in: cIds } } } });
    await prisma.salesInvoice.deleteMany({ where: { company_id: { in: cIds } } });
    
    await prisma.deliveryChallanLine.deleteMany({ where: { delivery_challan: { company_id: { in: [companyId, company2Id] } } } });
    await prisma.deliveryChallan.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });

    await prisma.salesOrderLine.deleteMany({ where: { sales_order: { company_id: { in: [companyId, company2Id] } } } });
    await prisma.salesOrder.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });

    await prisma.ledgerAccount.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.item.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.unit.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.financialYear.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.party.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.godown.deleteMany({ where: { branch: { company_id: { in: [companyId, company2Id] } } } });
    await prisma.branch.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    
    const comp = await prisma.company.findUnique({ where: { id: companyId } });
    if (comp) {
      await prisma.company.deleteMany({ where: { id: { in: [companyId, company2Id] } } });
      await prisma.organization.delete({ where: { id: comp.organization_id } });
    }
  });

  it('should prevent cross-company isolation violations', async () => {
    // Try to create an invoice for company2 using company1's branch
    await expect(salesService.createSalesInvoice(company2Id, {
      branch_id: branchId,
      party_id: partyId,
      financial_year_id: finYearId,
      document_number: 'INV-ISOLATION',
      document_date: new Date().toISOString(),
      lines: [{
        item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 100
      }]
    })).rejects.toThrow('Branch does not belong to the company');
  });

  it('should execute Wholesale flow: Order -> Challan -> Invoice', async () => {
    // 1. Order
    const order = await salesService.createSalesOrder(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'SO-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, unit_id: unitId, ordered_quantity: 10, rate: 100 }]
    });
    expect(order.status).toBe('DRAFT');
    
    await salesService.confirmSalesOrder(companyId, order.id, userId);

    // 2. Challan
    const challan = await salesService.createDeliveryChallan(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'DC-001', document_date: new Date().toISOString(),
      sales_order_id: order.id,
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, dispatched_quantity: 5, sales_order_line_id: order.lines[0].id }]
    });

    const postedChallan = await postingService.postDeliveryChallan(companyId, challan.id, userId);
    expect(postedChallan.status).toBe('DISPATCHED');

    // Verify stock deduction (100 - 5 = 95)
    let stockProj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockProj?.quantity)).toBe(9995);

    // 3. Invoice
    const invoice = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-W-001', document_date: new Date().toISOString(),
      lines: [{
        item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 5, rate: 100,
        sales_order_line_id: order.lines[0].id, delivery_challan_line_id: challan.lines[0].id
      }]
    });

    const postedInvoice = await postingService.postSalesInvoice(companyId, invoice.id, userId);
    expect(postedInvoice.status).toBe('POSTED');

    // Verify stock is STILL 9995 (no double deduction)
    stockProj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockProj?.quantity)).toBe(9995);
  });

  it('should execute Retail flow, prevent duplicate posting, and reverse', async () => {
    // Retail Invoice
    const invoice = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-R-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 2, rate: 150 }]
    });

    // Stock was 95
    const posted = await postingService.postSalesInvoice(companyId, invoice.id, userId);
    expect(posted.status).toBe('POSTED');

    let stockProj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockProj?.quantity)).toBe(9993);

    // Duplicate prevention
    await expect(postingService.postSalesInvoice(companyId, invoice.id, userId)).rejects.toThrow('Invoice is already posted');

    // Reversal
    const reversed = await postingService.reverseSalesInvoice(companyId, invoice.id, userId);
    expect(reversed.status).toBe('REVERSED');

    // Stock should be back to 9995
    stockProj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockProj?.quantity)).toBe(9995);
  });

  it('should process a Sales Return', async () => {
    // Create an invoice
    const invoice = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-SR-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 4, rate: 100 }]
    });
    await postingService.postSalesInvoice(companyId, invoice.id, userId);

    // Stock was 9995 -> 9991
    let stockProj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockProj?.quantity)).toBe(9991);

    // Return 2 units
    const returnDoc = await salesService.createSalesReturn(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      original_invoice_id: invoice.id, document_number: 'SR-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 2, rate: 100 }]
    });

    const postedReturn = await postingService.postSalesReturn(companyId, returnDoc.id, userId);
    expect(postedReturn.status).toBe('POSTED');

    // Stock 9991 -> 9993
    stockProj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockProj?.quantity)).toBe(9993);

    // Verify Accounting Reversal
    const voucher = await prisma.voucher.findFirst({
      where: { source_document_id: returnDoc.id, voucher_type: 'SALES_RETURN' },
      include: { lines: true }
    });
    
    // Credit Customer (receivable down)
    const credits = voucher!.lines.filter(l => Number(l.credit) > 0);
    expect(Number(credits[0].credit)).toBe(200);
  });

  it('should execute atomic rollback on Accounting failure', async () => {
    // We will create an invoice and then intentionally corrupt the accounting posting service just for this transaction
    // Or simpler: We pass an invalid ledger to force accounting to throw, ensuring Inventory rolls back.
    // However, the easiest way to test transaction rollback is to mock the accounting service locally and throw an error.
    
    // Instead of mocking, we can just delete the Customer account so accounting fails.
    const invoice = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-FAIL', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 10, rate: 100 }]
    });

    const partyAccount = await prisma.ledgerAccount.findFirst({ where: { party_id: partyId } });
    if (partyAccount) {
      await prisma.ledgerAccount.update({ where: { id: partyAccount.id }, data: { party_id: null } }); // Detach it so accounting fails to find it
    }

    // Attempt to post
    let errorCaught = false;
    try {
      await postingService.postSalesInvoice(companyId, invoice.id, userId);
    } catch (e) {
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);

    // Verify Stock didn't change
    const stockMovements = await prisma.stockMovement.findMany({ where: { source_document_id: invoice.id } });
    expect(stockMovements.length).toBe(0);

    // Verify Voucher wasn't created
    const vouchers = await prisma.voucher.findMany({ where: { source_document_id: invoice.id } });
    expect(vouchers.length).toBe(0);

    // Verify Invoice status is still DRAFT
    const checkInv = await prisma.salesInvoice.findUnique({ where: { id: invoice.id } });
    expect(checkInv?.status).toBe('DRAFT');

    // Restore party account for future tests just in case
    if (partyAccount) {
      await prisma.ledgerAccount.update({ where: { id: partyAccount.id }, data: { party_id: partyId } });
    }
  });

  it('should handle over-delivery correctly', async () => {
    // Ordered = 30
    const order = await salesService.createSalesOrder(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'SO-OD-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, unit_id: unitId, ordered_quantity: 30, rate: 100 }]
    });
    await salesService.confirmSalesOrder(companyId, order.id, userId);

    // Delivery 1 = 20
    const dc1 = await salesService.createDeliveryChallan(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'DC-OD-001', document_date: new Date().toISOString(),
      sales_order_id: order.id,
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, dispatched_quantity: 20, sales_order_line_id: order.lines[0].id }]
    });
    await postingService.postDeliveryChallan(companyId, dc1.id, userId);

    // Delivery 2 = 10
    const dc2 = await salesService.createDeliveryChallan(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'DC-OD-002', document_date: new Date().toISOString(),
      sales_order_id: order.id,
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, dispatched_quantity: 10, sales_order_line_id: order.lines[0].id }]
    });
    await postingService.postDeliveryChallan(companyId, dc2.id, userId);

    // Delivery 3 = 1 (should fail either in creation or posting)
    let errorCaught = false;
    let dc3Id = '';
    try {
      const dc3 = await salesService.createDeliveryChallan(companyId, {
        branch_id: branchId, party_id: partyId, document_number: 'DC-OD-003', document_date: new Date().toISOString(),
        sales_order_id: order.id,
        lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, dispatched_quantity: 1, sales_order_line_id: order.lines[0].id }]
      });
      dc3Id = dc3.id;
      await postingService.postDeliveryChallan(companyId, dc3.id, userId);
    } catch (e: any) {
      errorCaught = true;
      expect(e.message).toMatch(/order in status FULLY_DELIVERED|Cannot exceed ordered quantity/i);
    }
    expect(errorCaught).toBe(true);

    // Verify consistency
    if (dc3Id) {
      const stockMovements = await prisma.stockMovement.findMany({ where: { source_document_id: dc3Id } });
      expect(stockMovements.length).toBe(0);

      const checkDc3 = await prisma.deliveryChallan.findUnique({ where: { id: dc3Id } });
      expect(checkDc3?.status).toBe('DRAFT');
    }
  });

  it('should prove complete posting chain and data lineage', async () => {
    const invoice = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-CHAIN-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 500 }]
    });

    await postingService.postSalesInvoice(companyId, invoice.id, userId);

    // Query database
    const postedInv = await prisma.salesInvoice.findUnique({ where: { id: invoice.id } });
    expect(postedInv?.status).toBe('POSTED');

    // 1. StockMovement SALES_OUT
    const stockOut = await prisma.stockMovement.findFirst({ where: { source_document_id: invoice.id } });
    expect(stockOut).toBeDefined();
    expect(stockOut?.movement_type).toBe('SALES_OUT');
    expect(Math.abs(Number(stockOut?.base_quantity_delta))).toBe(1);

    // 2. Voucher & VoucherLines
    const voucher = await prisma.voucher.findFirst({ where: { source_document_id: invoice.id }, include: { lines: true } });
    expect(voucher).toBeDefined();
    expect(voucher?.voucher_type).toBe('SALES');

    // 3. Customer receivable effect
    const arLine = voucher?.lines.find(l => Number(l.debit) > 0);
    expect(arLine).toBeDefined();
    expect(Number(arLine?.debit)).toBe(500);

    // 4. AuditLog
    const auditLogs = await prisma.auditLog.findMany({ where: { source_document_id: invoice.id } });
    expect(auditLogs.length).toBeGreaterThan(0);
    const postAction = auditLogs.find(a => a.action === 'SALES_INVOICE_POSTED');
    expect(postAction).toBeDefined();
  });

  it('should prove idempotency and concurrent duplicate posting', async () => {
    const invoice = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-IDEM-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 100 }]
    });

    // Concurrent duplicate posting
    let successCount = 0;
    let failCount = 0;
    const promises = [
      postingService.postSalesInvoice(companyId, invoice.id, userId).then(() => successCount++).catch(() => failCount++),
      postingService.postSalesInvoice(companyId, invoice.id, userId).then(() => successCount++).catch(() => failCount++),
      postingService.postSalesInvoice(companyId, invoice.id, userId).then(() => successCount++).catch(() => failCount++)
    ];
    await Promise.all(promises);

    expect(successCount).toBe(1);
    expect(failCount).toBe(2);

    // Exact retry should fail
    await expect(postingService.postSalesInvoice(companyId, invoice.id, userId)).rejects.toThrow();

    // Verify effects happened EXACTLY ONCE
    const movements = await prisma.stockMovement.findMany({ where: { source_document_id: invoice.id } });
    expect(movements.length).toBe(1);

    const vouchers = await prisma.voucher.findMany({ where: { source_document_id: invoice.id } });
    expect(vouchers.length).toBe(1);
  });

  it('should prove AUTHORITATIVE CUSTOMER OUTSTANDING == INTELLIGENCE CUSTOMER OUTSTANDING', async () => {
    // 1. Authoritative Truth (Accounting / Bill Allocation)
    const allocations = await prisma.billAllocation.findMany({
      where: { company_id: companyId, party: { party_type: 'CUSTOMER' } }
    });
    let authTotal = 0;
    for (const a of allocations) {
      authTotal += Number(a.amount) * (a.allocation_type === 'NEW_REFERENCE' ? 1 : -1);
    }

    // 2. Intelligence Truth
    const intents = getIntents(prisma);
    const outstandingIntent = intents.find((i: any) => i.intentCode === 'CUSTOMER_OUTSTANDING');
    const result = await outstandingIntent.handle({ organizationId: companyId, branchId: branchId, userId: userId });
    
    expect(result.success).toBe(true);
    // Since some tests might result in 0 or positive, we filter out zeroes in Intelligence
    // If authTotal is > 0, it should exactly match. If it's <= 0, Intelligence reports 0.
    const expectedValue = authTotal > 0 ? authTotal : 0;
    expect(Number(result.answer.value)).toBe(expectedValue);
  });

  it('should prove BillAllocation-derived customer outstanding == exposed SalesInvoice projection', async () => {
    // 1. Credit Invoice
    const invoice = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-PROJ-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 1000 }] // Total 1000
    });
    await postingService.postSalesInvoice(companyId, invoice.id, userId);

    let projInvoice = await salesService.getSalesInvoice(companyId, invoice.id);
    expect(Number((projInvoice as any).outstanding_amount)).toBe(1000);
    expect(Number((projInvoice as any).paid_amount)).toBe(0);

    const vLine = await prisma.voucherLine.findFirst({ where: { voucher: { source_document_id: invoice.id } } });
    if (!vLine) throw new Error('Voucher line not found');

    // 2. Partial Payment Simulation
    await prisma.billAllocation.create({
      data: {
        company_id: companyId,
        party_id: partyId,
        voucher_line_id: vLine.id, // Using the real voucher line
        reference_document_type: 'SALES_INVOICE',
        reference_document_id: invoice.id,
        allocation_type: 'AGAINST_REFERENCE',
        amount: 300,
        due_date: new Date()
      }
    });

    projInvoice = await salesService.getSalesInvoice(companyId, invoice.id);
    expect(Number((projInvoice as any).outstanding_amount)).toBe(700);
    expect(Number((projInvoice as any).paid_amount)).toBe(300);

    // 3. Full Payment Simulation
    await prisma.billAllocation.create({
      data: {
        company_id: companyId,
        party_id: partyId,
        voucher_line_id: vLine.id,
        reference_document_type: 'SALES_INVOICE',
        reference_document_id: invoice.id,
        allocation_type: 'AGAINST_REFERENCE',
        amount: 700,
        due_date: new Date()
      }
    });

    projInvoice = await salesService.getSalesInvoice(companyId, invoice.id);
    expect(Number((projInvoice as any).outstanding_amount)).toBe(0);
    expect(Number((projInvoice as any).paid_amount)).toBe(1000);

    // 4. Sales Return 
    const ret = await salesService.createSalesReturn(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'RET-PROJ-001', document_date: new Date().toISOString(),
      original_invoice_id: invoice.id,
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 1000 }]
    });
    await postingService.postSalesReturn(companyId, ret.id, userId);

    // Sales return posts an AGAINST_REFERENCE to the original invoice
    projInvoice = await salesService.getSalesInvoice(companyId, invoice.id);
    expect(Number((projInvoice as any).outstanding_amount)).toBe(-1000); // 0 balance minus 1000 return 

    // 5. Invoice Reversal Simulation
    const invoice2 = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId, party_id: partyId, financial_year_id: finYearId,
      document_number: 'INV-PROJ-002', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 500 }]
    });
    await postingService.postSalesInvoice(companyId, invoice2.id, userId);
    
    let projInvoice2 = await salesService.getSalesInvoice(companyId, invoice2.id);
    expect(Number((projInvoice2 as any).outstanding_amount)).toBe(500);

    await postingService.reverseSalesInvoice(companyId, invoice2.id, userId);
    
    projInvoice2 = await salesService.getSalesInvoice(companyId, invoice2.id);
    expect(Number((projInvoice2 as any).outstanding_amount)).toBe(0);
  });
});

