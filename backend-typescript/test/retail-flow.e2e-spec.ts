import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { expect, describe, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module';
import { RetailService } from '../src/retail/retail.service';
import { PrismaService } from '../src/database/prisma.service';
import { PosService } from '../src/pos/pos.service';
import { ReportsService } from '../src/retail/reports/reports.service';
import { businessDate } from '../src/common/business-date';
import { v4 as uuidv4 } from 'uuid';

describe('Retail Flow (e2e)', () => {
  const testDate = businessDate();
  let app: INestApplication;
  let retailService: RetailService;
  let prisma: PrismaService;
  let posService: PosService;
  let reportsService: ReportsService;

  // Test data context
  let orgId: string;
  let compAId: string;
  let compBId: string;
  let branchAId: string;
  let godownAId: string;
  let fyAId: string;
  let userAId: string;
  let unitId: string;
  
  let testItemId: string;
  let customerId: string;
  let testInvoiceId: string;
  let supplierId: string;
  let needId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    retailService = app.get(RetailService);
    prisma = app.get(PrismaService);
    posService = app.get(PosService);
    reportsService = app.get(ReportsService);

    // Setup isolated test data
    orgId = uuidv4();
    const org = await prisma.organization.create({ data: { id: orgId, name: 'Test Org', code: `ORG-${Date.now()}` } });
    
    const compA = await prisma.company.create({ data: { organization_id: orgId, legal_name: 'Company A Legal', trade_name: 'Company A', code: `CA-${Date.now()}` } });
    compAId = compA.id;
    
    const compB = await prisma.company.create({ data: { organization_id: orgId, legal_name: 'Company B Legal', trade_name: 'Company B', code: `CB-${Date.now()}` } });
    compBId = compB.id;

    const branchA = await prisma.branch.create({ data: { company_id: compAId, name: 'Main Branch A', code: `MBA-${Date.now()}` } });
    branchAId = branchA.id;

    const godownA = await prisma.godown.create({ data: { branch_id: branchAId, name: 'Main Godown A', code: `MGA-${Date.now()}` } });
    godownAId = godownA.id;

    const fyA = await prisma.financialYear.create({ data: { company_id: compAId, label: '2026-2027', start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31') } });
    fyAId = fyA.id;

    const userA = await prisma.user.create({ data: { organization_id: orgId, username: `usera_${Date.now()}`, display_name: 'User A', password_hash: 'hash' } });
    userAId = userA.id;

    const unit = await prisma.unit.create({ data: { company_id: compAId, name: 'Pieces', code: `PCS-${Date.now()}` } });
    unitId = unit.id;

    // Seed Direct Expenses for Purchase
    await prisma.ledgerAccount.create({ data: { company_id: compAId, name: 'Direct Expenses', account_type: 'EXPENSE', code: 'DIR-EXP' } });
    await prisma.ledgerAccount.create({ data: { company_id: compBId, name: 'Direct Expenses', account_type: 'EXPENSE', code: 'DIR-EXP-B' } });
  });

  afterAll(async () => {
    // Cleanup created data
    if (compAId && compBId) {
      await prisma.auditLog.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.stockMovement.deleteMany({ where: { branch_id: { in: [branchAId] } } });
      await prisma.stockBalanceProjection.deleteMany({ where: { branch_id: { in: [branchAId] } } });
      await prisma.billAllocation.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: { in: [compAId, compBId] } } } });
      await prisma.voucher.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice: { company_id: { in: [compAId, compBId] } } } });
      await prisma.salesInvoice.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.purchaseInvoiceLine.deleteMany({ where: { purchase_invoice: { company_id: { in: [compAId, compBId] } } } });
      await prisma.purchaseInvoice.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.openingStockLine.deleteMany({ where: { opening_stock: { company_id: { in: [compAId, compBId] } } } });
      await prisma.openingStock.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.auditLog.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.salesReturnLine.deleteMany({ where: { sales_return: { company_id: { in: [compAId, compBId] } } } });
      await prisma.salesReturn.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.posHeldBillLine.deleteMany({ where: { pos_held_bill: { company_id: { in: [compAId, compBId] } } } });
      await prisma.posHeldBill.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice: { company_id: { in: [compAId, compBId] } } } });
      await prisma.salesInvoice.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.ledgerAccount.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.needList.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.party.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.pricingTrace.deleteMany({ where: { item: { company_id: { in: [compAId, compBId] } } } });
      await prisma.item.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
    }
    
    // Core structure
    if (compAId && compBId) {
      await prisma.financialYear.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.unit.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
    }
    if (branchAId) await prisma.godown.deleteMany({ where: { branch_id: { in: [branchAId] } } });
    if (compAId && compBId) {
      await prisma.branch.deleteMany({ where: { company_id: { in: [compAId, compBId] } } });
      await prisma.company.deleteMany({ where: { id: { in: [compAId, compBId] } } });
    }
    if (userAId) {
      await prisma.user.deleteMany({ where: { id: userAId } });
    }
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    
    await app.close();
  });

  it('should create a Retail item with opening stock', async () => {
    const item = await retailService.createItem(
      compAId, userAId, fyAId, branchAId,
      { name: 'Coca Cola Retail Test', unit_id: unitId, selling_price: 45, opening_stock: 10, purchase_price: 30 }
    );
    expect(item).toBeDefined();
    testItemId = item!.id;

    // Verify DB
    const itemDb = await prisma.item.findUnique({ where: { id: testItemId } });
    expect(itemDb).not.toBeNull();
    
    const proj = await prisma.stockBalanceProjection.findFirst({
      where: { company_id: compAId, item_id: testItemId }
    });
    expect(Number(proj!.quantity)).toBe(10);
  });

  it('should make a CASH sale and deduct stock', async () => {
    const sale = await posService.postPosSale(compAId, userAId, {
      branch_id: branchAId,
      document_date: testDate,
      walkin_name: 'Walkin',
      lines: [{ item_id: testItemId, godown_id: godownAId, quantity: 2, unit_id: unitId, rate: 45 }],
      payments: [{ payment_method: 'CASH', amount: 90 }]
    });
    expect(sale).toBeDefined();
    testInvoiceId = sale.id;

    const proj = await prisma.stockBalanceProjection.findFirst({
      where: { company_id: compAId, item_id: testItemId }
    });
    expect(Number(proj!.quantity)).toBe(8);
  });

  it('should create a customer for Udhar', async () => {
    const rajesh = await retailService.createCustomer(compAId, { name: 'Rajesh Retail Test' });
    expect(rajesh).toBeDefined();
    customerId = rajesh.id;
  });

  it('should make an UDHAR sale (0 payments) creating outstanding balance', async () => {
    const sale = await posService.postPosSale(compAId, userAId, {
      branch_id: branchAId,
      party_id: customerId,
      document_date: testDate,
      lines: [{ item_id: testItemId, godown_id: godownAId, quantity: 2, unit_id: unitId, rate: 45 }],
      payments: [] // Zero payment = Udhar
    });
    expect(sale).toBeDefined();

    const proj = await prisma.stockBalanceProjection.findFirst({
      where: { company_id: compAId, item_id: testItemId }
    });
    expect(Number(proj!.quantity)).toBe(6);

    const customers = await retailService.getCustomers(compAId);
    const rajesh = customers.find(c => c.id === customerId);
    expect(rajesh!.outstanding_amount).toBe(90);
  });

  it('should receive partial payment correctly', async () => {
    const res = await retailService.receivePayment(compAId, branchAId, fyAId, userAId, customerId, {
      amount: 40,
      payment_method: 'CASH',
      date: new Date().toISOString()
    });
    expect(res.success).toBe(true);

    const customers = await retailService.getCustomers(compAId);
    const rajesh = customers.find(c => c.id === customerId);
    expect(rajesh!.outstanding_amount).toBe(50);
  });
  
  it('should correctly isolate tenants', async () => {
    // User from company B shouldn't see items from Company A
    const itemsB = await retailService.getItems(compBId);
    expect(itemsB.length).toBe(0);
  });

  // ============================================================
  // PHASE 2 FLOW TESTS
  // ============================================================

  it('should create a supplier ABC Phase2 Test', async () => {
    const supplier = await retailService.createSupplier(compAId, {
      name: 'ABC Phase2 Test'
    });
    expect(supplier).toBeDefined();
    expect(supplier.name).toBe('ABC Phase2 Test');
    supplierId = supplier.id;
  });

  it('should add an item to the Need List', async () => {
    const need = await retailService.createNeed(compAId, branchAId, userAId, {
      name: 'Retail Test Oil',
      quantity: 10,
      preferred_supplier_id: supplierId,
      priority: 'NORMAL',
      customer_id: customerId
    });
    expect(need).toBeDefined();
    expect(need.status).toBe('NEED');
    needId = need.id;
  });

  it('should get need list with relationships', async () => {
    const needs = await retailService.getNeeds(compAId);
    expect(needs.length).toBeGreaterThan(0);
    const myNeed = needs.find(n => n.id === needId);
    expect(myNeed).toBeDefined();
    // Validate relations
    expect(myNeed!.customer).toBeDefined();
    expect(myNeed!.preferred_supplier).toBeDefined();
  });

  it('should update need status to ORDERED', async () => {
    const need = await retailService.updateNeedStatus(needId, compAId, { status: 'ORDERED' });
    expect(need.status).toBe('ORDERED');
  });

  it('should process a PURCHASE with partial payment and update Khata', async () => {
    // 1. Create Purchase
    const purchase = await retailService.createPurchase(compAId, branchAId, fyAId, userAId, {
      supplier_id: supplierId,
      total_amount: 1000,
      payment_status: 'PARTIAL',
      paid_amount: 400,
      payment_method: 'CASH',
      lines: [
        {
          item_id: testItemId,
          quantity: 10,
          purchase_rate: 100
        }
      ]
    });
    expect(purchase).toBeDefined();

    // 2. Verify StockProjection updated
    const proj = await prisma.stockBalanceProjection.findFirst({
      where: { company_id: compAId, item_id: testItemId }
    });
    // Original opened with 10, sold 2 (CASH) + 2 (UDHAR) = 6.
    // Now purchased 10 -> 16
    expect(Number(proj!.quantity)).toBe(16);

    // 3. Verify Khata / Outstanding
    // const dash = await retailService.getHomeDashboard(compAId);
    // expect(dash.supplier_due).toBe(600); // 1000 - 400

    const khata = await retailService.getSupplierKhata(compAId, supplierId);
    expect(khata.balance).toBe(600);
    // Should have 2 transactions: PURCHASE (+1000), PAYMENT (-400)
    expect(khata.transactions.length).toBe(2);
    const tPurch = khata.transactions.find(t => t.type === 'PURCHASE');
    const tPay = khata.transactions.find(t => t.type === 'PAYMENT');
    expect(tPurch!.amount).toBe(1000);
    expect(tPay!.amount).toBe(400);
    expect(khata.transactions.map(t => t.balance_after)).toEqual([1000, 600]);

    // 4. Need status to RECEIVED
    const need = await retailService.updateNeedStatus(needId, compAId, { status: 'RECEIVED' });
    expect(need.status).toBe('RECEIVED');
  });

  it('orders same-day supplier debt and payment by posting creation, not document text', async () => {
    const supplier = await retailService.createSupplier(compAId, { name: 'Same-day timeline regression' });
    await retailService.createPurchase(compAId, branchAId, fyAId, userAId, {
      supplier_id: supplier.id, total_amount: 50, payment_status: 'CREDIT',
      purchase_date: '2026-10-07', lines: [],
    });
    await retailService.paySupplier(compAId, branchAId, fyAId, userAId, supplier.id, {
      amount: 10, payment_method: 'CASH', date: '2026-10-07',
    });
    const before = await retailService.getSupplierKhata(compAId, supplier.id);
    for (const entry of before.transactions) {
      await prisma.voucher.update({ where: { id: entry.reference_id }, data: {
        document_number: entry.type === 'PURCHASE' ? 'ZZZ-debt-before-payment' : 'AAA-payment-after-debt',
        created_at: new Date(entry.type === 'PURCHASE' ? '2026-10-07T09:00:00Z' : '2026-10-07T10:00:00Z'),
      } });
    }
    const khata = await retailService.getSupplierKhata(compAId, supplier.id);
    expect(khata.balance).toBe(40);
    expect(khata.transactions.map(t => [t.type, t.amount, t.balance_after])).toEqual([
      ['PURCHASE', 50, 50], ['PAYMENT', 10, 40],
    ]);
  });

  it('should pay remaining supplier balance', async () => {
    await retailService.paySupplier(compAId, branchAId, fyAId, userAId, supplierId, {
      amount: 600,
      payment_method: 'CASH',
      date: new Date().toISOString()
    });

    const khata = await retailService.getSupplierKhata(compAId, supplierId);
    expect(khata.balance).toBe(0);
  });

  it('should process Quick Bill Purchase (no item lines)', async () => {
    // Quick bill shouldn't affect stock projection
    const beforeProj = await prisma.stockBalanceProjection.findFirst({
      where: { company_id: compAId, item_id: testItemId }
    });
    const beforeQty = Number(beforeProj!.quantity);

    await retailService.createPurchase(compAId, branchAId, fyAId, userAId, {
      supplier_id: supplierId,
      total_amount: 500,
      payment_status: 'CREDIT',
      note: 'Quick Bill Supplies',
      lines: []
    });

    const afterProj = await prisma.stockBalanceProjection.findFirst({
      where: { company_id: compAId, item_id: testItemId }
    });
    expect(Number(afterProj!.quantity)).toBe(beforeQty); // unchanged

    const khata = await retailService.getSupplierKhata(compAId, supplierId);
    expect(khata.balance).toBe(500); // 0 + 500
  });

  // ============================================================
  // PHASE 4 FLOW TESTS
  // ============================================================

  it('should hold a bill and then resume it', async () => {
    // Hold bill via BillingController logic
    const holdBill = await posService.holdBill(compAId, userAId, {
      branch_id: branchAId,
      lines: [{
        item_id: testItemId,
        godown_id: godownAId,
        unit_id: unitId,
        quantity: 5,
        rate: 50
      }]
    });
    
    expect(holdBill).toBeDefined();
    
    const heldBills = await posService.getHeldBills(compAId, branchAId, userAId);
    expect(heldBills.length).toBeGreaterThanOrEqual(1);

    const resumedBill = await posService.resumeBill(holdBill.id, compAId, userAId);
    expect(resumedBill).toBeDefined();
    expect(resumedBill.lines.length).toBe(1);

    const afterResume = await posService.getHeldBills(compAId, branchAId, userAId);
    expect(afterResume.find(b => b.id === holdBill.id)).toBeUndefined();
  });

  it('should process a Sale Return for the CASH sale', async () => {
    const sr = await posService.postPosReturn(compAId, userAId, {
      branch_id: branchAId,
      original_invoice_id: testInvoiceId,
      document_date: testDate,
      lines: [{
        item_id: testItemId,
        godown_id: godownAId,
        unit_id: unitId,
        quantity: 1, // Returning 1 qty
        rate: 45
      }]
    });

    expect(sr).toBeDefined();
    expect(Number(sr.taxable_amount)).toBe(45);
  });

  describe('Phase 5 Reports', () => {
    it('should accurately calculate the Dashboard summary based on authoritative data', async () => {
      const dashboard = await reportsService.getDashboard(compAId, { branch_id: branchAId, from: testDate, to: testDate });

      expect(dashboard).toBeDefined();
      expect(Number(dashboard.gross_sales)).toBeGreaterThan(0);
      expect(Number(dashboard.returns)).toBeGreaterThan(0);
      expect(Number(dashboard.net_sales)).toBe(Number(dashboard.gross_sales) - Number(dashboard.returns));

      // Stock should show correctly
      expect(dashboard.low_stock_count).toBeGreaterThanOrEqual(0);
      expect(dashboard.needs_pending).toBeGreaterThanOrEqual(0);
    });

    it('should generate accurate Sales report', async () => {
       const sales = await reportsService.getSalesReport(compAId, { branch_id: branchAId });
       expect(sales).toBeDefined();
       expect(sales.summary).toBeDefined();
       expect(sales.bills.length).toBeGreaterThan(0);
       expect(sales.bills[0].customer_name).toBeDefined();
       expect(sales.bills[0].grand_total).toBeGreaterThan(0);
    });

    it('should generate accurate Expenses report', async () => {
        const exp = await reportsService.getExpenseReport(compAId, { branch_id: branchAId });
        expect(exp).toBeDefined();
        // Since test doesn't explicitly create expense in this flow, length could be 0, but structure must match
        expect(exp.summary).toBeDefined();
        expect(exp.category_breakdown).toBeDefined();
        expect(exp.expenses).toBeDefined();
    });
  });
});
