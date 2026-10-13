import { Test, TestingModule } from '@nestjs/testing';
import { PosService } from './pos.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryPostingService } from '../inventory/posting.service';
import { ConfigModule } from '@nestjs/config';
import { PosModule } from './pos.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

// Vitest globals
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeAll: any;
declare const afterAll: any;

describe('POS Module - End to End Business Logic', () => {
  let posService: PosService;
  let prisma: PrismaService;
  let invService: InventoryPostingService;

  let companyId: string;
  let company2Id: string;
  let branchId: string;
  let branch2Id: string;
  let godownId: string;
  let partyId: string;
  let itemId: string;
  let unitId: string;
  let userId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        PosModule
      ],
    }).compile();

    posService = module.get<PosService>(PosService);
    prisma = module.get<PrismaService>(PrismaService);
    invService = module.get<InventoryPostingService>(InventoryPostingService);

    // Setup Test Data
    const org = await prisma.organization.create({
      data: { name: 'Test Org POS', code: `ORG_POS_${Date.now()}` }
    });
    const comp = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'POS Co Ltd', code: `CO_POS_${Date.now()}` }
    });
    companyId = comp.id;

    const comp2 = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'POS Co 2 Ltd', code: `CO2_POS_${Date.now()}` }
    });
    company2Id = comp2.id;

    const branch = await prisma.branch.create({
      data: { company_id: comp.id, name: 'POS HQ', code: `HQ_POS_${Date.now()}` }
    });
    branchId = branch.id;

    const branch2 = await prisma.branch.create({
      data: { company_id: comp2.id, name: 'Other HQ', code: `HQ2_POS_${Date.now()}` }
    });
    branch2Id = branch2.id;

    const godown = await prisma.godown.create({
      data: { branch_id: branchId, name: 'POS Godown', code: `G_POS_${Date.now()}` }
    });
    godownId = godown.id;

    const party = await prisma.party.create({
      data: { company_id: companyId, code: `P_POS_${Date.now()}`, name: 'Customer POS', party_type: 'CUSTOMER' }
    });
    partyId = party.id;

    await prisma.financialYear.create({
      data: {
        company_id: companyId,
        label: 'POS-FY',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2030-01-01'),
        is_active: true
      }
    });

    await prisma.ledgerAccount.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        party_id: partyId,
        code: `AR_POS_${Date.now()}`,
        name: 'Accounts Receivable - POS',
        account_type: 'ASSET',
        normal_balance: 'DEBIT',
        is_active: true
      }
    });

    const unit = await prisma.unit.create({
      data: { company_id: companyId, code: `U_POS_${Date.now()}`, name: 'Pieces' }
    });
    unitId = unit.id;

    const item = await prisma.item.create({
      data: { company_id: companyId, primary_unit_id: unitId, name: 'POS Item', item_type: "STOCK_ITEM", sku: `SKU_POS_${Date.now()}` }
    });
    itemId = item.id;

    const user = await prisma.user.create({
      data: { organization_id: org.id, username: `u_pos_${Date.now()}`, display_name: 'POS Tester', password_hash: 'xxx' }
    });
    userId = user.id;

    // Set initial stock (100 units)
    await invService.postMovement(prisma, {
      company_id: companyId,
      branch_id: branchId,
      movement_type: 'OPENING_IN',
      business_date: new Date(),
      source_document_type: 'OPENING',
      source_document_id: '10000000-0000-0000-0000-000000000001',
      lines: [{
        item_id: itemId,
        godown_id: godownId,
        quantity: 100,
        unit_id: unitId
      }]
    });
  }, 30000);

  afterAll(async () => {
    const cIds = [companyId, company2Id].filter(Boolean);
    if (cIds.length === 0) return;

    await prisma.pricingTrace.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.auditLog.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.billAllocation.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: { in: cIds } } } });
    await prisma.voucher.deleteMany({ where: { company_id: { in: cIds } } });
    
    await prisma.stockMovement.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.stockBalanceProjection.deleteMany({ where: { company_id: { in: cIds } } });
    
    await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice: { company_id: { in: cIds } } } });
    await prisma.salesInvoice.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.salesReturnLine.deleteMany({ where: { sales_return: { company_id: { in: cIds } } } });
    await prisma.salesReturn.deleteMany({ where: { company_id: { in: cIds } } });
    
    await prisma.posHeldBill.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.posShift.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.financialYear.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.item.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
    await prisma.unit.deleteMany({ where: { company_id: { in: [companyId, company2Id] } } });
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

  it('POS-15 & POS-16: should prevent cross-company and cross-branch isolation violations', async () => {
    await expect(posService.postPosSale(company2Id, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 100 }],
      payments: [{ amount: 100, payment_method: 'CASH' }]
    })).rejects.toThrow('Branch not found or belongs to another company');
  });

  it('POS-09: should safely rollback on insufficient stock', async () => {
    await expect(posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 200, rate: 100 }],
      payments: [{ amount: 20000, payment_method: 'CASH' }]
    })).rejects.toThrow('Negative stock blocked');
    
    // Verify rollback
    const invoices = await prisma.salesInvoice.findMany({ where: { company_id: companyId, is_pos: true } });
    expect(invoices.length).toBe(0);
  });

  it('POS-10: should reject invalid payment total', async () => {
    await expect(posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 100 }],
      payments: [{ amount: 50, payment_method: 'CASH' }]
    })).rejects.toThrow('Select a customer with credit enabled');
  });

  it('POS-01, POS-02, POS-03, POS-06: walk-in basic cash sale posting', async () => {
    const sale = await posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      walkin_name: 'John Doe',
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 2, rate: 150 }],
      payments: [{ amount: 300, payment_method: 'CASH' }]
    });

    expect(sale.is_pos).toBe(true);
    expect(sale.walkin_name).toBe('John Doe');
    expect(sale.status).toBe('POSTED');
    expect(Number(sale.paid_amount)).toBe(300);

    // Stock was 100 -> 98
    const stockProj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockProj?.quantity)).toBe(98);

    // Vouchers (Sales + Receipt)
    const vouchers = await prisma.voucher.findMany({ where: { source_document_id: sale.id } });
    expect(vouchers.length).toBe(2);
    
    const salesVoucher = vouchers.find(v => v.voucher_type === 'SALES');
    const receiptVoucher = vouchers.find(v => v.voucher_type === 'RECEIPT');
    expect(salesVoucher).toBeDefined();
    expect(receiptVoucher).toBeDefined();
  });

  it('POS-05 & POS-07: customer sale with split payment', async () => {
    const sale = await posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      party_id: partyId,
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 5, rate: 200 }],
      payments: [
        { amount: 500, payment_method: 'CASH' },
        { amount: 500, payment_method: 'BANK' }
      ]
    });

    expect(sale.is_pos).toBe(true);
    expect(Number(sale.grand_total)).toBe(1000);
    expect(Number(sale.paid_amount)).toBe(1000);

    const receiptVoucher = await prisma.voucher.findFirst({ 
      where: { source_document_id: sale.id, voucher_type: 'RECEIPT' },
      include: { lines: true }
    });

    // One credit line (Customer), two debit lines (Cash, Bank)
    const debits = receiptVoucher!.lines.filter(l => Number(l.debit) > 0);
    expect(debits.length).toBe(2);
    expect(Number(debits[0].debit)).toBe(500);
    expect(Number(debits[1].debit)).toBe(500);
  });

  it('POS-12 & POS-13: should handle Shift Open and Close', async () => {
    // Open shift
    const shift = await posService.openShift(companyId, userId, {
      branch_id: branchId,
      opening_balance: 100,
      notes: 'Morning shift'
    });
    expect(shift.status).toBe('OPEN');
    expect(Number(shift.opening_balance)).toBe(100);

    // Prevent second open
    await expect(posService.openShift(companyId, userId, {
      branch_id: branchId,
      opening_balance: 50
    })).rejects.toThrow('A shift is already open for this user in this branch');

    // Close shift
    const closedShift = await posService.closeShift(shift.id, companyId, userId, {
      closing_balance: 150,
      notes: 'End of day'
    });
    expect(closedShift.status).toBe('CLOSED');
    expect(Number(closedShift.variance)).toBe(50); // 150 - 100
  });

  it('POS-08: should handle Hold and Resume Bill', async () => {
    const held = await posService.holdBill(companyId, userId, {
      branch_id: branchId,
      reference_name: 'Waiting for friend',
      lines: [
        { item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 2, rate: 100 }
      ]
    });

    expect(held.reference_name).toBe('Waiting for friend');
    expect(Number(held.grand_total)).toBe(200);

    const bills = await posService.getHeldBills(companyId, branchId, userId);
    expect(bills.length).toBe(1);

    const resumed = await posService.resumeBill(held.id, companyId, userId);
    expect(resumed.id).toBe(held.id);

    const billsAfter = await posService.getHeldBills(companyId, branchId, userId);
    expect(billsAfter.length).toBe(0);
  });

  it('POS-18: should handle Retail POS Return', async () => {
    // Sell 1 item first
    const sale = await posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 100 }],
      payments: [{ amount: 100, payment_method: 'CASH' }]
    });

    // Stock should be 92 (100 - 2 (sale 1) - 5 (sale 2) - 1 (sale 3))
    // Let's not assert absolute stock unless we know it, just assert the diff.
    const stockBefore = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    const stockQtyBefore = Number(stockBefore?.quantity || 0);

    const posReturn = await posService.postPosReturn(companyId, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      original_invoice_id: sale.id,
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 100 }]
    });

    expect(posReturn.status).toBe('POSTED');
    expect(Number(posReturn.grand_total)).toBe(100);

    const stockAfter = await prisma.stockBalanceProjection.findFirst({ where: { item_id: itemId } });
    expect(Number(stockAfter?.quantity || 0)).toBe(stockQtyBefore + 1);

    // Verify Sales Return Voucher
    const returnVouchers = await prisma.voucher.findMany({ where: { source_document_id: posReturn.id } });
    expect(returnVouchers.length).toBe(1);
    expect(returnVouchers[0].voucher_type).toBe('SALES_RETURN');
  });
});
