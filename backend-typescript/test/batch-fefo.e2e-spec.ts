import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PosService } from '../src/pos/pos.service';
import { PurchaseService } from '../src/purchase/purchase.service';
import { ReportsService } from '../src/retail/reports/reports.service';

describe('Batch FEFO & Expiry Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let posService: PosService;
  let purchaseService: PurchaseService;
  let reportsService: ReportsService;
  
  let companyId: string;
  let branchId: string;
  let godownId: string;
  let supplierId: string;
  let walkinId: string;
  let userId: string;

  let unitBoxId: string;
  let itemId: string;

  const getNextMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const getPastMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    posService = app.get(PosService);
    purchaseService = app.get(PurchaseService);
    reportsService = app.get(ReportsService);
    await app.init();

    // Every run owns a new company; never erase another suite’s documents.

    const org = await prisma.organization.create({ data: { name: 'Batch Org', code: `BORG-${Date.now()}` } });
    const comp = await prisma.company.create({ data: { organization_id: org.id, code: `BC-${Date.now()}`, legal_name: 'Batch Co' } });
    companyId = comp.id;

    const branch = await prisma.branch.create({ data: { company_id: companyId, name: 'Main Branch', code: `MBB-${Date.now()}` } });
    branchId = branch.id;

    const godown = await prisma.godown.create({ data: { branch_id: branchId, name: 'Main Godown', code: `MGB-${Date.now()}` } });
    godownId = godown.id;

    const user = await prisma.user.create({ data: { username: `user-${Date.now()}`, password_hash: 'hash', display_name: 'Test User' } });
    userId = user.id;

    const fy = await prisma.financialYear.create({ data: { company_id: companyId, start_date: new Date('2020-01-01'), end_date: new Date('2030-12-31'), label: 'FY BATCH' } });

    await prisma.ledgerAccount.create({ data: { company_id: companyId, code: 'CASH_IN_HAND', name: 'Cash', account_type: 'ASSET', normal_balance: 'DEBIT' } });
    await prisma.ledgerAccount.create({ data: { company_id: companyId, code: 'DEFAULT_BANK', name: 'Bank', account_type: 'ASSET', normal_balance: 'DEBIT' } });

    const walkin = await prisma.party.create({ data: { company_id: companyId, code: 'WALKIN', party_type: 'CUSTOMER', name: 'Walk-in Customer', is_walkin: true, is_active: true } });
    walkinId = walkin.id;

    const supplier = await prisma.party.create({ data: { company_id: companyId, code: 'SUP', party_type: 'SUPPLIER', name: 'Supplier', is_active: true } });
    supplierId = supplier.id;

    unitBoxId = (await prisma.unit.create({ data: { company_id: companyId, name: 'Box', code: 'BOXB' } })).id;

    const item = await prisma.item.create({
      data: { company_id: companyId, name: 'Paracetamol', sku: 'PARA-123', item_type: "STOCK_ITEM", primary_unit_id: unitBoxId, track_batch: true }
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Receive Batch A (Future Expiry)', async () => {
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId,
      party_id: supplierId,
      document_date: new Date().toISOString(),
      document_number: 'GRN-BATCH-1',
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 10,
          rate: 50,
          batch_number: 'BATCH-A',
          expiry_date: getNextMonth()
        }
      ]
    });
    
    // Post it to affect inventory
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-1' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    const proj = await prisma.stockBalanceProjection.findFirst({ where: { company_id: companyId, item_id: itemId } });
    expect(proj).toBeDefined();
    expect(Number(proj.quantity)).toBe(10);
  });

  it('2. Receive Batch B (Earlier Future Expiry)', async () => {
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId,
      party_id: supplierId,
      document_date: new Date().toISOString(),
      document_number: 'GRN-BATCH-2',
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 5,
          rate: 55,
          batch_number: 'BATCH-B',
          expiry_date: new Date(Date.now() + 15 * 86400000).toISOString() // 15 days
        }
      ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-2' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    const projections = await prisma.stockBalanceProjection.findMany({ where: { company_id: companyId, item_id: itemId } });
    const totalQty = projections.reduce((sum, p) => sum + Number(p.quantity), 0);
    expect(totalQty).toBe(15);
  });

  let salesInvoiceId: string;
  it('3. Sell Qty 6 (FEFO Auto Allocation)', async () => {
    const invoice = await posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      party_id: walkinId,
      document_date: new Date().toISOString(),
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 6,
          rate: 100
        }
      ],
      payments: [{ payment_method: 'CASH', amount: 600 }]
    });
    salesInvoiceId = invoice.id;
      
    // Verify invoice lines allocations
    const inv = await prisma.salesInvoice.findUnique({ where: { id: salesInvoiceId }, include: { lines: { include: { batch_allocations: true } } } });
    expect(inv.lines[0].batch_allocations.length).toBe(2);
    
    const batchB = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-B' } });
    const batchA = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-A' } });
    
    const allocMap = inv.lines[0].batch_allocations.reduce((acc, a) => {
      acc[a.batch_id] = Number(a.quantity);
      return acc;
    }, {});
    
    expect(allocMap[batchB.id]).toBe(5);
    expect(allocMap[batchA.id]).toBe(1);
    
    const projB = await prisma.stockBalanceProjection.findFirst({ where: { batch_id: batchB.id }});
    const projA = await prisma.stockBalanceProjection.findFirst({ where: { batch_id: batchA.id }});
    expect(Number(projB.quantity)).toBe(0);
    expect(Number(projA.quantity)).toBe(9);
  });

  it('4. Receive Batch C (Expired)', async () => {
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId,
      party_id: supplierId,
      document_date: new Date().toISOString(),
      document_number: 'GRN-BATCH-3',
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 4,
          rate: 40,
          batch_number: 'BATCH-C',
          expiry_date: getPastMonth() // Expired!
        }
      ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-3' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);
  });

  it('5. Sell Qty 4 (Should skip expired C, use A)', async () => {
    const invoice = await posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      party_id: walkinId,
      document_date: new Date().toISOString(),
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 4,
          rate: 100
        }
      ],
      payments: [{ payment_method: 'CASH', amount: 400 }]
    });
      
    const inv = await prisma.salesInvoice.findUnique({ where: { id: invoice.id }, include: { lines: { include: { batch_allocations: true } } } });
    expect(inv.lines[0].batch_allocations.length).toBe(1);
    
    const batchA = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-A' } });
    expect(inv.lines[0].batch_allocations[0].batch_id).toBe(batchA.id);
    expect(Number(inv.lines[0].batch_allocations[0].quantity)).toBe(4);
  });

  it('6. Sell Qty 10 (Should fail: insufficient non-expired stock)', async () => {
    await expect(posService.postPosSale(companyId, userId, {
      branch_id: branchId,
      party_id: walkinId,
      document_date: new Date().toISOString(),
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 10,
          rate: 100
        }
      ],
      payments: [{ payment_method: 'CASH', amount: 1000 }]
    })).rejects.toThrow('Insufficient non-expired stock for item Paracetamol.');
  });
  
  it('7. Return Qty 6 (Should restore to B and A)', async () => {
    // Return against the first invoice which consumed B (5) and A (1)
    const ret = await posService.postPosReturn(companyId, userId, {
      branch_id: branchId,
      party_id: walkinId,
      document_date: new Date().toISOString(),
      original_invoice_id: salesInvoiceId,
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 6,
          rate: 100
        }
      ]
    });
    
    const retInv = await prisma.salesReturn.findUnique({ where: { id: ret.id }, include: { lines: { include: { batch_allocations: true } } } });
    expect(retInv.lines[0].batch_allocations.length).toBe(2);
    
    const batchB = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-B' } });
    const batchA = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-A' } });
    
    const allocMap = retInv.lines[0].batch_allocations.reduce((acc, a) => {
      acc[a.batch_id] = Number(a.quantity);
      return acc;
    }, {});
    
    expect(allocMap[batchB.id]).toBe(5);
    expect(allocMap[batchA.id]).toBe(1);
    
    const projB = await prisma.stockBalanceProjection.findFirst({ where: { batch_id: batchB.id }});
    // B was 0, now it should be 5
    expect(Number(projB.quantity)).toBe(5);
  });

  it('8. Verify Reports Exclude Expired Stock from Sellable/Low Stock', async () => {
    const report = await reportsService.getSalesReport(companyId, { date_range: 'today' });
    expect(report.summary).toBeDefined();
    
    const stockReport = await reportsService.getStockReport(companyId, {});
    const myItem = stockReport.items.find(i => i.item_id === itemId);
    // Initial: A(10) + B(5) + C(4) = 19
    // Sold: A(1) + B(5) [Invoice 1] -> Remaining: A(9), B(0), C(4)
    // Sold: A(4) [Invoice 2] -> Remaining: A(5), B(0), C(4)
    // Returned: A(1) + B(5) -> Remaining: A(6), B(5), C(4)
    // Total sellable = A(6) + B(5) = 11. C(4) is expired.
    expect(myItem.quantity).toBe(11);
  });

  it('9. Existing Batch Increment', async () => {
    // Current stock of A is 6.
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId,
      party_id: supplierId,
      document_date: new Date().toISOString(),
      document_number: 'GRN-BATCH-INC',
      lines: [
        {
          item_id: itemId,
          godown_id: godownId,
          unit_id: unitBoxId,
          quantity: 5,
          rate: 50,
          batch_number: 'BATCH-A' // No expiry date provided this time, it should just increment existing
        }
      ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-INC' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    const batches = await prisma.itemBatch.findMany({ where: { item_id: itemId, batch_number: 'BATCH-A' } });
    expect(batches.length).toBe(1); // One logical batch record

    const proj = await prisma.stockBalanceProjection.findFirst({ where: { batch_id: batches[0].id } });
    expect(Number(proj.quantity)).toBe(11); // 6 + 5 = 11
  });

  it('10. No-Expiry Batch Ordering', async () => {
    // Use a fresh item so previous batches don't interfere
    const itemNoExp = await prisma.item.create({
      data: { company_id: companyId, name: 'Paracetamol 2', sku: 'PARA-2', item_type: "STOCK_ITEM", primary_unit_id: unitBoxId, track_batch: true }
    });

    // Receive BATCH-NOEXP (no expiry)
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId,
      party_id: supplierId,
      document_date: new Date().toISOString(),
      document_number: 'GRN-BATCH-NOEXP',
      lines: [
        { item_id: itemNoExp.id, godown_id: godownId, unit_id: unitBoxId, quantity: 10, rate: 50, batch_number: 'BATCH-NOEXP' },
        { item_id: itemNoExp.id, godown_id: godownId, unit_id: unitBoxId, quantity: 5, rate: 50, batch_number: 'BATCH-EXP', expiry_date: getNextMonth() }
      ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-NOEXP' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    // Sell 6
    const invoice = await posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { item_id: itemNoExp.id, godown_id: godownId, unit_id: unitBoxId, quantity: 6, rate: 100 } ],
      payments: [{ payment_method: 'CASH', amount: 600 }]
    });

    const inv = await prisma.salesInvoice.findUnique({ where: { id: invoice.id }, include: { lines: { include: { batch_allocations: true } } } });
    
    // BATCH-EXP (qty 5) should be used first because it has an expiry date, then BATCH-NOEXP (qty 1)
    const batchExp = await prisma.itemBatch.findFirst({ where: { item_id: itemNoExp.id, batch_number: 'BATCH-EXP' } });
    const batchNoExp = await prisma.itemBatch.findFirst({ where: { item_id: itemNoExp.id, batch_number: 'BATCH-NOEXP' } });

    const allocMap = inv.lines[0].batch_allocations.reduce((acc, a) => {
      acc[a.batch_id] = Number(a.quantity); return acc;
    }, {});

    expect(allocMap[batchExp.id]).toBe(5);
    expect(allocMap[batchNoExp.id]).toBe(1);
  });

  it('11. Expiring Today', async () => {
    const today = new Date().toISOString();
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: supplierId, document_date: today, document_number: 'GRN-BATCH-TODAY',
      lines: [ { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 5, rate: 50, batch_number: 'BATCH-TODAY', expiry_date: today } ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-TODAY' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    // Should be sellable
    const invoice = await posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: today,
      lines: [ { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 5, rate: 100, batch_id: (await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-TODAY' } })).id } ],
      payments: [{ payment_method: 'CASH', amount: 500 }]
    });
    expect(invoice.id).toBeDefined();
  });

  it('12. Manual Batch Selection & Invalid Batch Rejection', async () => {
    // Receive BATCH-MANUAL1 and BATCH-MANUAL2
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: supplierId, document_date: new Date().toISOString(), document_number: 'GRN-BATCH-MAN',
      lines: [
        { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 10, rate: 50, batch_number: 'BATCH-M1', expiry_date: getNextMonth() },
        { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 10, rate: 50, batch_number: 'BATCH-M2', expiry_date: new Date(Date.now() + 15 * 86400000).toISOString() }
      ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-MAN' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    const b1 = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-M1' } });
    const b2 = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-M2' } });

    // Explicitly choose B2, even though B1 expires first (b2 is in 15 days, b1 in 30 days) wait! M2 is earlier.
    // Let's explicitly choose B1.
    const invoice = await posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 2, rate: 100, batch_id: b1.id } ],
      payments: [{ payment_method: 'CASH', amount: 200 }]
    });
    const inv = await prisma.salesInvoice.findUnique({ where: { id: invoice.id }, include: { lines: { include: { batch_allocations: true } } } });
    expect(inv.lines[0].batch_allocations[0].batch_id).toBe(b1.id);

    // Invalid selection (expired)
    const bExpired = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-C' } });
    await expect(posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 100, batch_id: bExpired.id } ],
      payments: [{ payment_method: 'CASH', amount: 100 }]
    })).rejects.toThrow();
  });

  it('13. Multi-Unit + Batch', async () => {
    const stripUnit = await prisma.unit.create({ data: { company_id: companyId, name: 'Strip', code: 'STRIP' } });
    const med = await prisma.item.create({ data: { company_id: companyId, name: 'Med', sku: 'MED', item_type: "STOCK_ITEM", primary_unit_id: stripUnit.id, track_batch: true } });
    await prisma.itemUnitConversion.create({ data: { item_id: med.id, from_unit_id: unitBoxId, to_unit_id: stripUnit.id, conversion_factor: 10 } });

    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: supplierId, document_date: new Date().toISOString(), document_number: 'GRN-MED',
      lines: [ { item_id: med.id, godown_id: godownId, unit_id: stripUnit.id, quantity: 30, rate: 5, batch_number: 'M101', expiry_date: getNextMonth() } ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-MED' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    const invoice = await posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { item_id: med.id, godown_id: godownId, unit_id: unitBoxId, quantity: 2, rate: 100 } ],
      payments: [{ payment_method: 'CASH', amount: 200 }]
    });

    const mBatch = await prisma.itemBatch.findFirst({ where: { item_id: med.id } });
    const proj = await prisma.stockBalanceProjection.findFirst({ where: { batch_id: mBatch.id } });
    expect(Number(proj.quantity)).toBe(10); // 30 - (2*10) = 10

    // Return 1 box
    await posService.postPosReturn(companyId, userId, {
      original_invoice_id: invoice.id,
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { original_line_id: null, item_id: med.id, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 100 } ],
      payments: [{ payment_method: 'CASH', amount: 100 }]
    });

    const projReturn = await prisma.stockBalanceProjection.findFirst({ where: { batch_id: mBatch.id } });
    expect(Number(projReturn.quantity)).toBe(20); // 10 + (1*10) = 20
  });

  it('14. Variant + Batch', async () => {
    const lip = await prisma.item.create({ data: { company_id: companyId, name: 'Lipstick', sku: 'LIP', item_type: "STOCK_ITEM", primary_unit_id: unitBoxId, track_batch: true, has_variants: true } });
    const vRed = await prisma.itemVariant.create({ data: { item_id: lip.id, sku: 'LIP-R', attributes: { color: 'Ruby Red' } } });
    const vNude = await prisma.itemVariant.create({ data: { item_id: lip.id, sku: 'LIP-N', attributes: { color: 'Nude' } } });

    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: supplierId, document_date: new Date().toISOString(), document_number: 'GRN-LIP',
      lines: [ 
        { item_id: lip.id, variant_id: vRed.id, godown_id: godownId, unit_id: unitBoxId, quantity: 10, rate: 5, batch_number: 'R101', expiry_date: getNextMonth() },
        { item_id: lip.id, variant_id: vNude.id, godown_id: godownId, unit_id: unitBoxId, quantity: 8, rate: 5, batch_number: 'N101', expiry_date: getNextMonth() }
      ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-LIP' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    await posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { item_id: lip.id, variant_id: vRed.id, godown_id: godownId, unit_id: unitBoxId, quantity: 2, rate: 10 } ],
      payments: [{ payment_method: 'CASH', amount: 20 }]
    });

    const bRed = await prisma.itemBatch.findFirst({ where: { item_id: lip.id, batch_number: 'R101' } });
    const bNude = await prisma.itemBatch.findFirst({ where: { item_id: lip.id, batch_number: 'N101' } });

    const pRed = await prisma.stockBalanceProjection.findFirst({ where: { variant_id: vRed.id, batch_id: bRed.id } });
    const pNude = await prisma.stockBalanceProjection.findFirst({ where: { variant_id: vNude.id, batch_id: bNude.id } });

    expect(Number(pRed.quantity)).toBe(8);
    expect(Number(pNude.quantity)).toBe(8);
  });

  it('15. Tenant Isolation', async () => {
    // Create new tenant
    const org2 = await prisma.organization.create({ data: { name: 'Org 2', code: `ORG2-${Date.now()}` } });
    const comp2 = await prisma.company.create({ data: { organization_id: org2.id, code: `C2-${Date.now()}`, legal_name: 'Co 2' } });
    const branch2 = await prisma.branch.create({ data: { company_id: comp2.id, name: 'B2', code: `B2-${Date.now()}` } });
    const godown2 = await prisma.godown.create({ data: { branch_id: branch2.id, name: 'G2', code: `G2-${Date.now()}` } });
    const user2 = await prisma.user.create({ data: { username: `u2-${Date.now()}`, password_hash: 'h', display_name: 'U2' } });
    const walkin2 = await prisma.party.create({ data: { company_id: comp2.id, code: 'W2', party_type: 'CUSTOMER', name: 'W2' } });

    const bA = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-A' } });

    await expect(posService.postPosSale(comp2.id, user2.id, {
      branch_id: branch2.id, party_id: walkin2.id, document_date: new Date().toISOString(),
      lines: [ { item_id: itemId, godown_id: godown2.id, unit_id: unitBoxId, quantity: 1, rate: 100, batch_id: bA.id } ],
      payments: [{ payment_method: 'CASH', amount: 100 }]
    })).rejects.toThrow(); // Item not found for this company
  });

  it('16. Reject a second return after the original sale was fully returned', async () => {
    const before = await prisma.salesReturn.count({ where: { company_id: companyId } });
    await expect(posService.postPosReturn(companyId, userId, {
      original_invoice_id: salesInvoiceId,
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 4, rate: 100 }]
    })).rejects.toThrow('Return exceeds the quantity sold');
    expect(await prisma.salesReturn.count({ where: { company_id: companyId } })).toBe(before);
  });

  it('17. Expired Return Safety', async () => {
    // Receive Expired BATCH-EXP-RET
    await purchaseService.createGoodsReceiptWithQuantities(companyId, {
      branch_id: branchId, party_id: supplierId, document_date: getPastMonth(), document_number: 'GRN-BATCH-EXP-RET',
      lines: [ { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 5, rate: 50, batch_number: 'BATCH-EXP-RET', expiry_date: getNextMonth() } ]
    });
    const grn = await prisma.goodsReceipt.findFirst({ where: { company_id: companyId, document_number: 'GRN-BATCH-EXP-RET' } });
    await purchaseService.postGoodsReceipt(grn.id, userId);

    // Sell 1 from BATCH-EXP-RET
    const invoice = await posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: getPastMonth(),
      lines: [ { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 100, batch_id: (await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-EXP-RET' } })).id } ],
      payments: [{ payment_method: 'CASH', amount: 100 }]
    });

    // Now update BATCH-EXP-RET to be expired
    await prisma.itemBatch.updateMany({
      where: { batch_number: 'BATCH-EXP-RET' },
      data: { expiry_date: new Date(getPastMonth()) }
    });

    // Customer returns Qty 1
    await posService.postPosReturn(companyId, userId, {
      original_invoice_id: invoice.id,
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { original_line_id: null, item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 100 } ],
      payments: [{ payment_method: 'CASH', amount: 100 }]
    });

    // Verify it is NOT sellable
    const bExpRet = await prisma.itemBatch.findFirst({ where: { company_id: companyId, batch_number: 'BATCH-EXP-RET' } });
    const pExpRet = await prisma.stockBalanceProjection.findFirst({ where: { batch_id: bExpRet.id } });
    expect(Number(pExpRet.quantity)).toBe(5); // Physical stock 5

    // But it's excluded from FEFO allocation because it's expired
    await expect(posService.postPosSale(companyId, userId, {
      branch_id: branchId, party_id: walkinId, document_date: new Date().toISOString(),
      lines: [ { item_id: itemId, godown_id: godownId, unit_id: unitBoxId, quantity: 1, rate: 100, batch_id: bExpRet.id } ],
      payments: [{ payment_method: 'CASH', amount: 100 }]
    })).rejects.toThrow();
  });
});
