import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { SalesPostingService } from './posting.service';
import { SalesConversionService } from './conversion.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { SalesModule } from './sales.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryPostingService } from '../inventory/posting.service';

// Vitest globals
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeAll: any;
declare const afterAll: any;

describe('Module 10 - Sales Conversion Forensic Closure', () => {
  let salesService: SalesService;
  let postingService: SalesPostingService;
  let conversionService: SalesConversionService;
  let prisma: PrismaService;
  let invService: InventoryPostingService;

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
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SalesModule, AuthModule],
    }).compile();

    salesService = module.get<SalesService>(SalesService);
    postingService = module.get<SalesPostingService>(SalesPostingService);
    conversionService = module.get<SalesConversionService>(SalesConversionService);
    prisma = module.get<PrismaService>(PrismaService);
    invService = module.get<InventoryPostingService>(InventoryPostingService);

    const org = await prisma.organization.create({ data: { name: 'M10 Org', code: `M10_O_${Date.now()}` } });
    const comp = await prisma.company.create({ data: { organization_id: org.id, legal_name: 'M10 Co', code: `M10_C_${Date.now()}` } });
    companyId = comp.id;

    const branch = await prisma.branch.create({ data: { company_id: companyId, name: 'HQ', code: `M10_B_${Date.now()}` } });
    branchId = branch.id;

    const godown = await prisma.godown.create({ data: { branch_id: branchId, name: 'Godown', code: `M10_G_${Date.now()}` } });
    godownId = godown.id;

    const party = await prisma.party.create({ data: { company_id: companyId, code: `M10_P_${Date.now()}`, name: 'Customer A', party_type: 'CUSTOMER' } });
    partyId = party.id;

    // Create required ledger account for the party so Sales Invoice can post accounting
    await prisma.ledgerAccount.create({ data: { company_id: companyId, name: 'Customer A Account', code: `M10_LA_${Date.now()}`, account_type: 'ASSET', party_id: partyId } });

    const unit = await prisma.unit.create({ data: { company_id: companyId, code: `M10_U_${Date.now()}`, name: 'Pieces' } });
    unitId = unit.id;

    const item = await prisma.item.create({ data: { company_id: companyId, primary_unit_id: unitId, name: 'Product', item_type: "STOCK_ITEM", sku: `M10_SKU_${Date.now()}` } });
    itemId = item.id;

    const fy = await prisma.financialYear.create({ data: { company_id: companyId, label: 'FY2026', start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31'), is_active: true } });
    finYearId = fy.id;

    const user = await prisma.user.create({ data: { organization_id: org.id, username: `u10_${Date.now()}`, display_name: 'Test', password_hash: 'xxx' } });
    userId = user.id;

    await invService.postMovement(prisma, {
      company_id: companyId, branch_id: branchId, movement_type: 'OPENING_IN', business_date: new Date(),
      source_document_type: 'OPENING', source_document_id: '00000000-0000-0000-0000-000000000999',
      lines: [{ item_id: itemId, godown_id: godownId, quantity: 10000, unit_id: unitId }]
    });
  }, 30000);

  afterAll(async () => {
    // Basic cleanup
    await prisma.stockMovement.deleteMany({ where: { company_id: companyId } });
    await prisma.stockBalanceProjection.deleteMany({ where: { company_id: companyId } });
    await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice: { company_id: companyId } } });
    await prisma.salesInvoice.deleteMany({ where: { company_id: companyId } });
    await prisma.deliveryChallanLine.deleteMany({ where: { delivery_challan: { company_id: companyId } } });
    await prisma.deliveryChallan.deleteMany({ where: { company_id: companyId } });
    await prisma.salesOrderLine.deleteMany({ where: { sales_order: { company_id: companyId } } });
    await prisma.salesOrder.deleteMany({ where: { company_id: companyId } });
    await prisma.salesQuotationLine.deleteMany({ where: { sales_quotation: { company_id: companyId } } });
    await prisma.salesQuotation.deleteMany({ where: { company_id: companyId } });
  });

  it('1. Quotation Lifecycle & Conversion Status', async () => {
    const q = await salesService.createSalesQuotation(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'QT-001', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, unit_id: unitId, quantity: 10, rate: 100 }]
    });

    await prisma.salesQuotation.update({ where: { id: q.id }, data: { status: 'ACCEPTED' } });
    
    // Convert quotation
    const so = await conversionService.convertQuotationToSalesOrder(companyId, q.id, userId, {
      document_number: 'SO-Q-001', document_date: new Date().toISOString()
    });
    expect(so).toBeDefined();
    
    // Converted quotation cannot be converted again
    await expect(conversionService.convertQuotationToSalesOrder(companyId, q.id, userId, {
      document_number: 'SO-Q-002', document_date: new Date().toISOString()
    })).rejects.toThrow();

    // Source lineage stored
    const checkSO = await prisma.salesOrder.findUnique({ where: { id: so.id } });
    expect(checkSO?.sales_quotation_id).toBe(q.id);

    // Status change
    const checkQ = await prisma.salesQuotation.findUnique({ where: { id: q.id } });
    expect(checkQ?.status).toBe('CONVERTED');
  });

  it('2. Partial Conversion Test', async () => {
    const so = await salesService.createSalesOrder(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'SO-PARTIAL', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, unit_id: unitId, ordered_quantity: 100, rate: 100 }]
    });
    await salesService.confirmSalesOrder(companyId, so.id, userId);

    // Conversion 1 = 40
    await conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-P1', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 40, order_line_id: so.lines[0].id }]
    });

    // Conversion 2 = 30
    await conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-P2', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 30, order_line_id: so.lines[0].id }]
    });

    // Conversion 3 = 30
    await conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-P3', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 30, order_line_id: so.lines[0].id }]
    });

    // Conversion 4 = 1 -> MUST FAIL
    await expect(conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-P4', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, order_line_id: so.lines[0].id }]
    })).rejects.toThrow();
  });

  it('3. Draft Allocation / Pending Quantity', async () => {
    const so = await salesService.createSalesOrder(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'SO-DRAFT-ALLOC', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, unit_id: unitId, ordered_quantity: 100, rate: 100 }]
    });
    await salesService.confirmSalesOrder(companyId, so.id, userId);

    // Draft A = 60
    const draftA = await conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-DA', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 60, order_line_id: so.lines[0].id }]
    });
    // Available = 40

    // Draft B requesting 50 -> Reject
    await expect(conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-DB', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 50, order_line_id: so.lines[0].id }]
    })).rejects.toThrow();

    // Cancel Draft A (Delete it or mark cancelled)
    await prisma.deliveryChallan.update({ where: { id: draftA.id }, data: { status: 'CANCELLED' } });

    // Now Draft B requesting 50 -> Pass
    await conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-DB', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 50, order_line_id: so.lines[0].id }]
    });
  });

  it('4. Concurrency Test', async () => {
    const so = await salesService.createSalesOrder(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'SO-CONC', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, unit_id: unitId, ordered_quantity: 60, rate: 100 }]
    });
    await salesService.confirmSalesOrder(companyId, so.id, userId);

    // Two concurrent requests for 40 (40 + 40 = 80 > 60)
    let successCount = 0;
    let failCount = 0;
    
    const reqs = [
      conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
        document_number: 'DC-CONC1', document_date: new Date().toISOString(),
        lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 40, order_line_id: so.lines[0].id }]
      }).then(() => successCount++).catch(() => failCount++),
      conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
        document_number: 'DC-CONC2', document_date: new Date().toISOString(),
        lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 40, order_line_id: so.lines[0].id }]
      }).then(() => successCount++).catch(() => failCount++)
    ];

    await Promise.all(reqs);
    expect(successCount).toBe(1);
    expect(failCount).toBe(1);
  });

  it('5. End-to-End Event Chain', async () => {
    const so = await salesService.createSalesOrder(companyId, {
      branch_id: branchId, party_id: partyId, document_number: 'SO-E2E', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, unit_id: unitId, ordered_quantity: 10, rate: 100 }]
    });
    await salesService.confirmSalesOrder(companyId, so.id, userId);

    // Sales Order -> No stock movement
    let sm = await prisma.stockMovement.findMany({ where: { source_document_id: so.id } });
    expect(sm.length).toBe(0);

    const dc = await conversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
      document_number: 'DC-E2E', document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 10, order_line_id: so.lines[0].id }]
    });

    const postedDc = await postingService.postDeliveryChallan(companyId, dc.id, userId);
    
    // Exactly one SALES_OUT
    sm = await prisma.stockMovement.findMany({ where: { source_document_id: postedDc.id } });
    expect(sm.length).toBe(1);
    expect(sm[0].movement_type).toBe('SALES_OUT');

    const inv = await conversionService.convertDeliveryChallanToSalesInvoice(companyId, postedDc.id, userId, {
      document_number: 'INV-E2E', financial_year_id: finYearId, document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 10, delivery_challan_line_id: postedDc.lines[0].id }]
    });

    const postedInv = await postingService.postSalesInvoice(companyId, inv.id, userId);
    
    // Invoice from posted Delivery -> NO SECOND SALES_OUT
    sm = await prisma.stockMovement.findMany({ where: { source_document_id: postedInv.id } });
    expect(sm.length).toBe(0);
  });
});
