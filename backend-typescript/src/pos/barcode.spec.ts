import { Test, TestingModule } from '@nestjs/testing';
import { PosService } from './pos.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryPostingService } from '../inventory/posting.service';
import { ConfigModule } from '@nestjs/config';
import { PosModule } from './pos.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BadRequestException } from '@nestjs/common';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeAll: any;
declare const afterAll: any;

describe('POS Module - Barcode Billing and Receipt Verification', () => {
  let posService: PosService;
  let prisma: PrismaService;
  let invService: InventoryPostingService;

  let companyId: string;
  let company2Id: string;
  let branchId: string;
  let godownId: string;
  let unitId: string;
  let userId: string;

  let validItemId: string;
  let inactiveItemId: string;
  let comp2ItemId: string;

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
      data: { name: 'Barcode Org', code: `ORG_BC_${Date.now()}` }
    });
    const comp = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'Barcode Co', code: `CO_BC_${Date.now()}` }
    });
    companyId = comp.id;

    const comp2 = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'Barcode Co 2', code: `CO2_BC_${Date.now()}` }
    });
    company2Id = comp2.id;

    const branch = await prisma.branch.create({
      data: { company_id: comp.id, name: 'BC HQ', code: `HQ_BC_${Date.now()}` }
    });
    branchId = branch.id;

    const godown = await prisma.godown.create({
      data: { branch_id: branchId, name: 'BC Godown', code: `G_BC_${Date.now()}` }
    });
    godownId = godown.id;

    await prisma.financialYear.create({
      data: {
        company_id: companyId,
        label: 'BC-FY',
        start_date: new Date('2020-01-01'),
        end_date: new Date('2030-01-01'),
        is_active: true
      }
    });

    const unit = await prisma.unit.create({
      data: { company_id: companyId, code: `U_BC_${Date.now()}`, name: 'Pieces' }
    });
    unitId = unit.id;

    // Items
    const validItem = await prisma.item.create({
      data: { company_id: companyId, primary_unit_id: unitId, name: 'Valid Item', item_type: "STOCK_ITEM", sku: `SKU_VALID_${Date.now()}`, default_sale_rate: 100, is_active: true }
    });
    validItemId = validItem.id;

    const inactiveItem = await prisma.item.create({
      data: { company_id: companyId, primary_unit_id: unitId, name: 'Inactive Item', item_type: "STOCK_ITEM", sku: `SKU_INACTIVE_${Date.now()}`, is_active: false }
    });
    inactiveItemId = inactiveItem.id;

    const unit2 = await prisma.unit.create({
      data: { company_id: company2Id, code: `U2_BC_${Date.now()}`, name: 'Pieces 2' }
    });

    const comp2Item = await prisma.item.create({
      data: { company_id: company2Id, primary_unit_id: unit2.id, name: 'Comp2 Item', item_type: "STOCK_ITEM", sku: `SKU_COMP2_${Date.now()}`, is_active: true }
    });
    comp2ItemId = comp2Item.id;

    const user = await prisma.user.create({
      data: { organization_id: org.id, username: `u_bc_${Date.now()}`, display_name: 'BC Tester', password_hash: 'xxx' }
    });
    userId = user.id;

    // Add stock
    await invService.postMovement(prisma, {
      company_id: companyId,
      branch_id: branchId,
      movement_type: 'OPENING_IN',
      business_date: new Date(),
      source_document_type: 'OPENING',
      source_document_id: '10000000-0000-0000-0000-000000000001',
      lines: [{
        item_id: validItemId,
        godown_id: godownId,
        quantity: 100,
        unit_id: unitId
      }]
    });

  }, 30000);

  afterAll(async () => {
    // cleanup
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
    await prisma.financialYear.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.item.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.unit.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.party.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.godown.deleteMany({ where: { branch: { company_id: { in: cIds } } } });
    await prisma.branch.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    const comp = await prisma.company.findUnique({ where: { id: companyId } });
    if (comp) {
      await prisma.company.deleteMany({ where: { id: { in: cIds } } });
      await prisma.organization.delete({ where: { id: comp.organization_id } });
    }
  });

  it('Barcode Workflow: Valid Barcode lookup', async () => {
    const validItem = await prisma.item.findUnique({ where: { id: validItemId } });
    const result = await posService.lookupItemByBarcode(companyId, validItem!.sku);
    expect(result.id).toBe(validItemId);
  });

  it('Barcode Workflow: Unknown Barcode lookup', async () => {
    await expect(posService.lookupItemByBarcode(companyId, 'UNKNOWN_SKU')).rejects.toThrow('Item not found or inactive');
  });

  it('Barcode Workflow: Inactive Item', async () => {
    const inactiveItem = await prisma.item.findUnique({ where: { id: inactiveItemId } });
    await expect(posService.lookupItemByBarcode(companyId, inactiveItem!.sku)).rejects.toThrow('Item not found or inactive');
  });

  it('Barcode Workflow: Tenant Isolation', async () => {
    const comp2Item = await prisma.item.findUnique({ where: { id: comp2ItemId } });
    await expect(posService.lookupItemByBarcode(companyId, comp2Item!.sku)).rejects.toThrow('Item not found or inactive');
  });

  it('Receipt Printing: Authoritative backend transaction creates valid receipt data', async () => {
    // 1. Barcode scan -> Item
    const validItem = await prisma.item.findUnique({ where: { id: validItemId } });
    const scannedItem = await posService.lookupItemByBarcode(companyId, validItem!.sku);
    
    // Repeated scan logic (simulated in frontend, tested by sending qty > 1)
    const cart = [
      { item_id: scannedItem.id, godown_id: godownId, unit_id: unitId, quantity: 2, rate: Number(scannedItem.default_sale_rate), discount_amount: 0 }
    ];

    // Checkout
    const sale = await posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      walkin_name: 'Barcode Shopper',
      lines: cart,
      payments: [{ amount: 200, payment_method: 'CASH' }]
    });

    // Receipt verification
    expect(sale.is_pos).toBe(true);
    expect(sale.document_number).toBeDefined(); // receipt/invoice number
    expect(sale.document_date).toBeDefined(); // date/time
    expect(sale.branch_id).toBe(branchId); // branch
    expect(sale.walkin_name).toBe('Barcode Shopper'); // customer/walk-in
    expect(Number(sale.grand_total)).toBe(200); // total
    expect(Number(sale.paid_amount)).toBe(200); // amount paid
    expect(Number(sale.discount_amount)).toBe(0); // discount
    expect(Number(sale.tax_amount)).toBe(0); // tax
    expect(Number(sale.outstanding_amount)).toBe(0); // balance

    // Items
    const fullSale = await prisma.salesInvoice.findUnique({
      where: { id: sale.id },
      include: { lines: true }
    });
    expect(fullSale!.lines.length).toBe(1);
    expect(Number(fullSale!.lines[0].quantity)).toBe(2);
    expect(Number(fullSale!.lines[0].rate)).toBe(100);
    expect(Number(fullSale!.lines[0].line_total)).toBe(200);
  });
});
