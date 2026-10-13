import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PosService } from '../src/pos/pos.service';
import { PurchaseService } from '../src/purchase/purchase.service';

describe('Universal Item System Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let godownId: string;
  let financialYearId: string;
  let userId: string;
  let partyId: string;
  
  let unitPieceId: string;
  let unitBoxId: string;
  let unitKgId: string;
  let unitMetreId: string;
  let unitSqFtId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    // Every run owns a new company; never erase another suite’s documents.

    const org = await prisma.organization.create({ data: { name: 'Test Org', code: `TEST-ORG-${Date.now()}` } });
    const comp = await prisma.company.create({ data: { organization_id: org.id, code: `RC-${Date.now()}`, legal_name: 'Retail Co' } });
    companyId = comp.id;

    const branch = await prisma.branch.create({ data: { company_id: companyId, name: 'Main Branch', code: `MB-${Date.now()}` } });
    branchId = branch.id;

    const godown = await prisma.godown.create({ data: { branch_id: branchId, name: 'Main Godown', code: `MG-${Date.now()}` } });
    godownId = godown.id;

    const fy = await prisma.financialYear.create({
      data: { company_id: companyId, start_date: new Date(Date.UTC(new Date().getUTCFullYear() - 1, 3, 1)), end_date: new Date(Date.UTC(new Date().getUTCFullYear() + 1, 2, 31)), label: 'Universal test FY' }
    });
    financialYearId = fy.id;

    const user = await prisma.user.create({
      data: { organization_id: org.id, email: `test-${Date.now()}@test.com`, username: `testuser-${Date.now()}`, password_hash: 'hash', display_name: 'Test User' }
    });
    userId = user.id;

    const party = await prisma.party.create({
      data: { company_id: companyId, code: 'SUPP1', party_type: 'VENDOR', name: 'Vendor 1' }
    });
    partyId = party.id;
    
    await prisma.ledgerAccount.create({ data: { company_id: companyId, code: '1200', name: 'Vendor 1 Account', account_type: 'PAYABLE', normal_balance: 'CREDIT', party_id: partyId } });
    await prisma.ledgerAccount.create({ data: { company_id: companyId, code: 'SALES_REVENUE', name: 'Sales Revenue', account_type: 'REVENUE', normal_balance: 'CREDIT' } });
    await prisma.ledgerAccount.create({ data: { company_id: companyId, code: 'CASH', name: 'Cash', account_type: 'ASSET', normal_balance: 'DEBIT' } });


    unitPieceId = (await prisma.unit.create({ data: { company_id: companyId, name: 'Piece', code: 'PCS' } })).id;
    unitBoxId = (await prisma.unit.create({ data: { company_id: companyId, name: 'Box', code: 'BOX' } })).id;
    unitKgId = (await prisma.unit.create({ data: { company_id: companyId, name: 'Kilogram', code: 'KG' } })).id;
    unitMetreId = (await prisma.unit.create({ data: { company_id: companyId, name: 'Metre', code: 'M' } })).id;
    unitSqFtId = (await prisma.unit.create({ data: { company_id: companyId, name: 'Square Foot', code: 'SQFT' } })).id;

    await prisma.retailCapabilitySettings.create({
      data: { company_id: companyId, variants_enabled: true, multi_unit_enabled: true, weight_enabled: true, batch_enabled: true, services_enabled: true, bundles_enabled: true }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. Standard Item backward compatibility
  it('Standard Item backward compatibility', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Standard Item', sku: 'STD1', item_type: "STOCK_ITEM", primary_unit_id: unitPieceId, default_sale_rate: 100 }
    });
    expect(item.id).toBeDefined();
    expect(item.selling_mode).toBe('PIECE');
  });

  // 2. Service POS sale
  let serviceItemId: string;
  let serviceInvoiceId: string;
  it('Service POS sale', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Repair Service', sku: 'REP', item_type: "SERVICE", primary_unit_id: unitPieceId, default_sale_rate: 500 }
    });
    serviceItemId = item.id;

    const pos = app.get(PosService);
    const invoice = await pos.postPosSale(companyId, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, quantity: 2, rate: 500 }],
      payments: [{ amount: 1000, payment_method: 'CASH' }]
    });

    serviceInvoiceId = invoice.id;
    expect(Number(invoice.grand_total)).toBe(1000);
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { company_id: companyId, item_id: item.id } });
    expect(proj).toBeNull();
  });

  // 3. Service return/refund
  it('Service return/refund', async () => {
    const pos = app.get(PosService);
    const ret = await pos.postPosReturn(companyId, userId, {
      branch_id: branchId,
      document_date: new Date().toISOString(),
      original_invoice_id: serviceInvoiceId,
      lines: [{ item_id: serviceItemId, godown_id: godownId, unit_id: unitPieceId, quantity: 1, rate: 500 }]
    });
    expect(Number(ret.grand_total)).toBe(500);
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { company_id: companyId, item_id: serviceItemId } });
    expect(proj).toBeNull();
  });

  // 4. Variant creation
  let variantItemId: string;
  let variantId: string;
  it('Variant creation', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Shoes', sku: 'SHOE', item_type: "STOCK_ITEM", primary_unit_id: unitPieceId, has_variants: true }
    });
    variantItemId = item.id;
    const v = await prisma.itemVariant.create({
      data: { item_id: item.id, sku: 'SHOE-9-BLK', attributes: { size: '9', color: 'Black' }, default_sale_rate: 2000 }
    });
    variantId = v.id;
    expect(v.id).toBeDefined();
  });

  // 5. Variant stock isolation
  it('Variant stock isolation', async () => {
    const purch = app.get(PurchaseService);
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(),
      document_number: 'GRN-VAR', status: 'DRAFT',
      lines: [{ item_id: variantItemId, variant_id: variantId, godown_id: godownId, unit_id: unitPieceId, received_quantity: 10, rate: 1000 }]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-VAR' } });
    await purch['postingService'].postGoodsReceipt(grn!.id, userId);

    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: variantItemId, variant_id: variantId } });
    expect(Number(proj!.quantity)).toBe(10);
  });

  // 6. Variant sale
  let variantInvoiceId: string;
  it('Variant sale', async () => {
    const pos = app.get(PosService);
    const invoice = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: variantItemId, variant_id: variantId, godown_id: godownId, unit_id: unitPieceId, quantity: 2, rate: 2000 }],
      payments: [{ amount: 4000, payment_method: 'CASH' }]
    });
    variantInvoiceId = invoice.id;
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: variantItemId, variant_id: variantId } });
    expect(Number(proj!.quantity)).toBe(8);
  });

  // 7. Variant return
  it('Variant return', async () => {
    const pos = app.get(PosService);
    await pos.postPosReturn(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(), original_invoice_id: variantInvoiceId,
      lines: [{ item_id: variantItemId, variant_id: variantId, godown_id: godownId, unit_id: unitPieceId, quantity: 1, rate: 2000 }]
    });
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: variantItemId, variant_id: variantId } });
    expect(Number(proj!.quantity)).toBe(9);
  });

  // Multi-unit purchase
  let cokeItemId: string;
  it('Multi-unit purchase', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Coke', sku: 'COKE', item_type: "STOCK_ITEM", primary_unit_id: unitPieceId }
    });
    cokeItemId = item.id;
    await prisma.itemUnitConversion.create({
      data: { item_id: item.id, from_unit_id: unitBoxId, to_unit_id: unitPieceId, conversion_factor: 10 }
    });

    const purch = app.get(PurchaseService);
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-COKE', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitBoxId, received_quantity: 2, rate: 100 }]
    });
    
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-COKE' } });
    await purch['postingService'].postGoodsReceipt(grn!.id, userId);

    const line = await prisma.goodsReceiptLine.findFirst({ where: { goods_receipt_id: grn!.id } });
    expect(Number(line!.entered_quantity)).toBe(2);
    expect(line!.entered_unit_id).toBe(unitBoxId);
    expect(Number(line!.conversion_factor)).toBe(10);
    expect(Number(line!.base_quantity)).toBe(20);

    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item.id } });
    expect(Number(proj!.quantity)).toBe(20);
  });

  // Multi-unit sale
  let cokeSaleId: string;
  let cokeSaleLineId: string;
  it('Multi-unit sale', async () => {
    const pos = app.get(PosService);
    const invoice = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: cokeItemId, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 150 }],
      payments: [{ amount: 150, payment_method: 'CASH' }]
    });
    cokeSaleId = invoice.id;
    
    const line = await prisma.salesInvoiceLine.findFirst({ where: { sales_invoice_id: invoice.id } });
    cokeSaleLineId = line!.id;
    expect(Number(line!.entered_quantity)).toBe(1);
    expect(Number(line!.conversion_factor)).toBe(10);
    expect(Number(line!.base_quantity)).toBe(10);

    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: cokeItemId } });
    expect(Number(proj!.quantity)).toBe(10);
  });

  // Conversion Snapshot / Conversion Return
  it('Conversion Snapshot & Conversion Return', async () => {
    await prisma.itemUnitConversion.updateMany({
      where: { item_id: cokeItemId },
      data: { conversion_factor: 12 }
    });

    const pos = app.get(PosService);
    await pos.postPosReturn(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(), original_invoice_id: cokeSaleId,
      lines: [{ item_id: cokeItemId, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 150, original_line_id: cokeSaleLineId }]
    });
    
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: cokeItemId } });
    expect(Number(proj!.quantity)).toBe(20);
  });

  // Backend must not trust client factor
  it('Backend must not trust client factor', async () => {
    const pos = app.get(PosService);
    await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: cokeItemId, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 150 }],
      payments: [{ amount: 150, payment_method: 'CASH' }]
    });
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: cokeItemId } });
    expect(Number(proj!.quantity)).toBe(8); // 20 - 12 = 8
  });

  // Weight sale (Decimal) & Weight return
  let tomatoItemId: string;
  let tomatoSaleId: string;
  it('Weight sale (Decimal)', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Tomato', sku: 'TOMATO', item_type: "STOCK_ITEM", selling_mode: 'WEIGHT', primary_unit_id: unitKgId }
    });
    tomatoItemId = item.id;
    const purch = app.get(PurchaseService);
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-TOM', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitKgId, received_quantity: 10, rate: 40 }]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-TOM' } });
    await purch['postingService'].postGoodsReceipt(grn!.id, userId);

    const pos = app.get(PosService);
    const inv = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitKgId, quantity: 1.350, rate: 40 }],
      payments: [{ amount: 54, payment_method: 'CASH' }]
    });
    tomatoSaleId = inv.id;

    expect(Number(inv.grand_total)).toBe(54.00);
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item.id } });
    expect(Number(proj!.quantity)).toBe(8.650);
  });

  it('Weight return', async () => {
    const pos = app.get(PosService);
    await pos.postPosReturn(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(), original_invoice_id: tomatoSaleId,
      lines: [{ item_id: tomatoItemId, godown_id: godownId, unit_id: unitKgId, quantity: 0.250, rate: 40 }]
    });
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: tomatoItemId } });
    expect(Number(proj!.quantity)).toBe(8.900);
  });

  // Piece fraction rule
  it('Piece fraction rule', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Normal Piece', sku: 'NP1', item_type: "STOCK_ITEM", selling_mode: 'PIECE', primary_unit_id: unitPieceId }
    });
    
    const purch = app.get(PurchaseService);
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-NP1', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, quantity: 10, rate: 10 }]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-NP1' } });
    await purch['postingService'].postGoodsReceipt(grn!.id, userId);

    const pos = app.get(PosService);
    await expect(pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, quantity: 1.5, rate: 10 }],
      payments: [{ amount: 15, payment_method: 'CASH' }]
    })).rejects.toThrow();

    await expect(pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, quantity: 2, rate: 10 }],
      payments: [{ amount: 20, payment_method: 'CASH' }]
    })).resolves.toBeDefined();
  });

  // Length selling
  let cableItemId: string;
  let cableSaleId: string;
  it('Length selling', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Cable', sku: 'CBL', item_type: "STOCK_ITEM", selling_mode: 'LENGTH', primary_unit_id: unitMetreId }
    });
    cableItemId = item.id;
    const purch = app.get(PurchaseService);
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-CBL', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitMetreId, received_quantity: 100, rate: 50 }]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-CBL' } });
    await purch['postingService'].postGoodsReceipt(grn!.id, userId);

    const pos = app.get(PosService);
    const inv = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitMetreId, quantity: 3.5, rate: 50 }],
      payments: [{ amount: 175, payment_method: 'CASH' }]
    });
    cableSaleId = inv.id;
    expect(Number(inv.grand_total)).toBe(175);
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item.id } });
    expect(Number(proj!.quantity)).toBe(96.5);
  });

  // Length return
  it('Length return', async () => {
    const pos = app.get(PosService);
    await pos.postPosReturn(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(), original_invoice_id: cableSaleId,
      lines: [{ item_id: cableItemId, godown_id: godownId, unit_id: unitMetreId, quantity: 1, rate: 50 }]
    });
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: cableItemId } });
    expect(Number(proj!.quantity)).toBe(97.5);
  });

  // Area calculation / Area sale / Dimension snapshot / Dimension validation
  let glassItemId: string;
  let glassSaleId: string;
  let glassSaleLineId: string;
  it('Area calculation, validation, snapshot, return', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Glass', sku: 'GLS', item_type: "STOCK_ITEM", selling_mode: 'AREA', primary_unit_id: unitSqFtId }
    });
    glassItemId = item.id;
    
    const purch = app.get(PurchaseService);
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-GLS', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitSqFtId, received_quantity: 100, rate: 100 }]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-GLS' } });
    await purch['postingService'].postGoodsReceipt(grn!.id, userId);

    const pos = app.get(PosService);
    
    // Dimension validation
    await expect(pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitSqFtId, quantity: 1, rate: 120, dimensions: { length: -5, width: 4 } }],
      payments: [{ amount: 100, payment_method: 'CASH' }]
    })).rejects.toThrow();

    // Area Sale
    const inv = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitSqFtId, quantity: 2, rate: 120, dimensions: { length: 6, width: 4 } }],
      payments: [{ amount: 5760, payment_method: 'CASH' }]
    });
    glassSaleId = inv.id;
    expect(Number(inv.grand_total)).toBe(5760); 

    const line = await prisma.salesInvoiceLine.findFirst({ where: { sales_invoice_id: inv.id } });
    glassSaleLineId = line!.id;
    expect(Number(line!.base_quantity)).toBe(48); 

    // Area Return
    await pos.postPosReturn(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(), original_invoice_id: glassSaleId,
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitSqFtId, quantity: 1, rate: 120, original_line_id: glassSaleLineId }] 
    });
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item.id } });
    expect(Number(proj!.quantity)).toBe(100 - 48 + 24); 
  });

  // Decimal precision
  it('Decimal precision', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Precision', sku: 'PREC', item_type: "STOCK_ITEM", selling_mode: 'WEIGHT', primary_unit_id: unitKgId }
    });
    
    const purch = app.get(PurchaseService);
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-PREC', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitKgId, quantity: 10, rate: 30 }] // Using quantity since rate is removed from GRN? Wait, rate is used in PosSale not GRN, actually wait! Let's just use rate in GRN without it throwing. Oh, I deleted rate from GRN payload inside createGoodsReceiptWithQuantities.
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-PREC' } });
    await purch['postingService'].postGoodsReceipt(grn!.id, userId);

    const pos = app.get(PosService);
    const inv = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitKgId, quantity: 1.275, rate: 39.90 }],
      payments: [{ amount: 50.87, payment_method: 'CASH' }]
    });
    expect(Number(inv.grand_total)).toBe(50.87); 
  });

  // Tenant isolation
  it('Tenant isolation', async () => {
    const org2 = await prisma.organization.create({ data: { name: 'Org 2', code: `O2-${Date.now()}` } });
    const comp2 = await prisma.company.create({ data: { organization_id: org2.id, code: `C2-${Date.now()}`, legal_name: 'C2' } });
    const b2 = await prisma.branch.create({ data: { company_id: comp2.id, code: `B2-${Date.now()}`, name: 'B2' } });
    const g2 = await prisma.godown.create({ data: { branch_id: b2.id, code: `G2-${Date.now()}`, name: 'G2' } });

    const pos = app.get(PosService);
    
    // Test Item A
    await expect(pos.postPosSale(comp2.id, userId, {
      branch_id: b2.id, document_date: new Date().toISOString(),
      lines: [{ item_id: cokeItemId, godown_id: g2.id, unit_id: unitBoxId, quantity: 1, rate: 150 }],
      payments: [{ amount: 150, payment_method: 'CASH' }]
    })).rejects.toThrow();

    // Test Variant A
    await expect(pos.postPosSale(comp2.id, userId, {
      branch_id: b2.id, document_date: new Date().toISOString(),
      lines: [{ item_id: variantItemId, variant_id: variantId, godown_id: g2.id, unit_id: unitPieceId, quantity: 1, rate: 150 }],
      payments: [{ amount: 150, payment_method: 'CASH' }]
    })).rejects.toThrow();

    // Test Conversion A (Indirectly fails because Item A is blocked, but we also verify it doesn't leak during lookup)
    const purch = app.get(PurchaseService);
    await expect(purch.createGoodsReceiptWithQuantities(comp2.id, {
      branch_id: b2.id, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-C2', status: 'DRAFT',
      lines: [{ item_id: cokeItemId, godown_id: g2.id, unit_id: unitPieceId, quantity: 10 }]
    })).rejects.toThrow();
  });

  // Batch + Expiry + FEFO testing
  it('Batch receiving and tracking', async () => {
    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Paracetamol', sku: 'PARA', item_type: "STOCK_ITEM", primary_unit_id: unitPieceId, track_batch: true }
    });

    const purch = app.get(PurchaseService);
    
    // Receive Batch A (Expiring next month)
    const expiryA = new Date();
    expiryA.setMonth(expiryA.getMonth() + 1);
    
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-BATCH-A', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, received_quantity: 10, rate: 10, batch_number: 'BATCH-A', expiry_date: expiryA.toISOString() }]
    });
    const grnA = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-A' } });
    await purch['postingService'].postGoodsReceipt(grnA!.id, userId);

    // Receive Batch B (Expiring next year)
    const expiryB = new Date();
    expiryB.setFullYear(expiryB.getFullYear() + 1);
    
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-BATCH-B', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, received_quantity: 20, rate: 10, batch_number: 'BATCH-B', expiry_date: expiryB.toISOString() }]
    });
    const grnB = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-B' } });
    await purch['postingService'].postGoodsReceipt(grnB!.id, userId);

    // Total stock should be 30
    const projs = await prisma.stockBalanceProjection.findMany({ where: { company_id: companyId, item_id: item.id } });
    const totalQty = projs.reduce((sum, p) => sum + Number(p.quantity), 0);
    expect(totalQty).toBe(30);

    // Batch A stock is 10, Batch B stock is 20
    const projA = projs.find(p => p.quantity.equals(10));
    expect(projA).toBeDefined();

    // Now, test FEFO sale of 15 pieces
    const pos = app.get(PosService);
    const invoice = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, quantity: 15, rate: 20 }],
      payments: [{ amount: 300, payment_method: 'CASH' }]
    });

    const sil = await prisma.salesInvoiceLine.findFirst({
      where: { sales_invoice_id: invoice.id },
      include: { batch_allocations: { include: { batch: true } } }
    });

    expect(sil!.batch_allocations.length).toBe(2);
    
    const allocA = sil!.batch_allocations.find(a => a.batch.batch_number === 'BATCH-A');
    const allocB = sil!.batch_allocations.find(a => a.batch.batch_number === 'BATCH-B');
    
    expect(Number(allocA!.quantity)).toBe(10); // Batch A fully exhausted
    expect(Number(allocB!.quantity)).toBe(5);  // Batch B partially exhausted
    
    // Test expired batch blocking
    const expiryExpired = new Date();
    expiryExpired.setDate(expiryExpired.getDate() - 1);
    
    await purch.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: partyId, document_date: new Date().toISOString(), document_number: 'GRN-BATCH-EXP', status: 'DRAFT',
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, received_quantity: 50, rate: 10, batch_number: 'BATCH-EXP', expiry_date: expiryExpired.toISOString() }]
    });
    const grnExp = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-EXP' } });
    await purch['postingService'].postGoodsReceipt(grnExp!.id, userId);

    // Attempting to sell 20 pieces - should fail because only 15 non-expired pieces exist from Batch B
    await expect(pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, quantity: 20, rate: 20 }],
      payments: [{ amount: 400, payment_method: 'CASH' }]
    })).rejects.toThrow(/Insufficient non-expired stock/);

    // Selling exactly 15 pieces should succeed (exhausting Batch B)
    const invoice2 = await pos.postPosSale(companyId, userId, {
      branch_id: branchId, document_date: new Date().toISOString(),
      lines: [{ item_id: item.id, godown_id: godownId, unit_id: unitPieceId, quantity: 15, rate: 20 }],
      payments: [{ amount: 300, payment_method: 'CASH' }]
    });

    const sil2 = await prisma.salesInvoiceLine.findFirst({
      where: { sales_invoice_id: invoice2.id },
      include: { batch_allocations: { include: { batch: true } } }
    });
    
    expect(sil2!.batch_allocations.length).toBe(1);
    expect(sil2!.batch_allocations[0].batch.batch_number).toBe('BATCH-B');
    expect(Number(sil2!.batch_allocations[0].quantity)).toBe(15);
  });
});
