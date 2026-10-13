import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseService } from './purchase.service';
import { PostingService as PurchasePostingService } from './posting.service';
import { PurchaseConversionService } from './conversion.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { PurchaseModule } from './purchase.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryPostingService } from '../inventory/posting.service';

// Vitest globals
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeAll: any;
declare const afterAll: any;

describe('Module 10 - Purchase Conversion Forensic Closure', () => {
  let purchaseService: PurchaseService;
  let postingService: PurchasePostingService;
  let conversionService: PurchaseConversionService;
  let prisma: PrismaService;

  let companyId: string;
  let branchId: string;
  let godownId: string;
  let partyId: string;
  let itemId: string;
  let unitId: string;
  let finYearId: string;
  let userId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, PurchaseModule, AuthModule],
    }).compile();

    purchaseService = module.get<PurchaseService>(PurchaseService);
    postingService = module.get<PurchasePostingService>(PurchasePostingService);
    conversionService = module.get<PurchaseConversionService>(PurchaseConversionService);
    prisma = module.get<PrismaService>(PrismaService);

    const org = await prisma.organization.create({ data: { name: 'M10 Purc Org', code: `M10P_O_${Date.now()}` } });
    const comp = await prisma.company.create({ data: { organization_id: org.id, legal_name: 'M10 Purc Co', code: `M10P_C_${Date.now()}` } });
    companyId = comp.id;

    const branch = await prisma.branch.create({ data: { company_id: companyId, name: 'HQ', code: `M10P_B_${Date.now()}` } });
    branchId = branch.id;

    const godown = await prisma.godown.create({ data: { branch_id: branchId, name: 'Godown', code: `M10P_G_${Date.now()}` } });
    godownId = godown.id;

    const party = await prisma.party.create({ data: { company_id: companyId, code: `M10P_P_${Date.now()}`, name: 'Supplier A', party_type: 'SUPPLIER' } });
    partyId = party.id;

    const unit = await prisma.unit.create({ data: { company_id: companyId, code: `M10P_U_${Date.now()}`, name: 'Pieces' } });
    unitId = unit.id;

    const item = await prisma.item.create({ data: { company_id: companyId, primary_unit_id: unitId, name: 'Product', item_type: "STOCK_ITEM", sku: `M10P_SKU_${Date.now()}` } });
    itemId = item.id;

    const fy = await prisma.financialYear.create({ data: { company_id: companyId, label: 'FY2026', start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31'), is_active: true } });
    finYearId = fy.id;

    const user = await prisma.user.create({ data: { organization_id: org.id, username: `up10_${Date.now()}`, display_name: 'Test', password_hash: 'xxx' } });
    userId = user.id;
  }, 30000);

  afterAll(async () => {
    // Basic cleanup
    await prisma.stockMovement.deleteMany({ where: { company_id: companyId } });
    await prisma.stockBalanceProjection.deleteMany({ where: { company_id: companyId } });
    await prisma.purchaseInvoiceLine.deleteMany({ where: { purchase_invoice: { company_id: companyId } } });
    await prisma.purchaseInvoice.deleteMany({ where: { company_id: companyId } });
    await prisma.goodsReceiptLine.deleteMany({ where: { goods_receipt: { company_id: companyId } } });
    await prisma.goodsReceipt.deleteMany({ where: { company_id: companyId } });
    await prisma.purchaseOrderLine.deleteMany({ where: { purchase_order: { company_id: companyId } } });
    await prisma.purchaseOrder.deleteMany({ where: { company_id: companyId } });
  });

  it('1. End-to-End Event Chain', async () => {
    const po = await purchaseService.createPurchaseOrder({
      company: { connect: { id: companyId } },
      branch: { connect: { id: branchId } },
      party: { connect: { id: partyId } },
      document_number: 'PO-E2E',
      document_date: new Date(),
      lines: {
        create: [{
          item: { connect: { id: itemId } },
          unit: { connect: { id: unitId } },
          ordered_quantity: 10,
          rate: 100
        }]
      },
      status: 'CONFIRMED'
    });

    // Purchase Order -> No stock movement
    let sm = await prisma.stockMovement.findMany({ where: { source_document_id: po.id } });
    expect(sm.length).toBe(0);

    const grn = await conversionService.convertPurchaseOrderToGoodsReceipt(companyId, po.id, userId, {
      document_number: 'GRN-E2E', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 10, order_line_id: po.lines[0].id }]
    });

    const postedGrn = await purchaseService.postGoodsReceipt(grn.id, userId);
    
    // Exactly one PURCHASE_IN
    sm = await prisma.stockMovement.findMany({ where: { source_document_id: postedGrn.id } });
    expect(sm.length).toBe(1);
    expect(sm[0].movement_type).toBe('PURCHASE_IN');

    const inv = await conversionService.convertGoodsReceiptToPurchaseInvoice(companyId, postedGrn.id, userId, {
      document_number: 'PI-E2E', financial_year_id: finYearId, document_date: new Date().toISOString()
    });

    const postedInv = await purchaseService.postPurchaseInvoice(inv.id, userId);
    
    // Purchase Invoice from GRN -> NO SECOND PURCHASE_IN
    sm = await prisma.stockMovement.findMany({ where: { source_document_id: postedInv.id } });
    expect(sm.length).toBe(0);
  });
});
