import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { PrismaService } from '../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { PosModule } from '../pos/pos.module';
import { PosService } from '../pos/pos.service';
import { PurchaseModule } from '../purchase/purchase.module';
import { PurchaseService } from '../purchase/purchase.service';
import { PostingService as PurchasePostingService } from '../purchase/posting.service';
import { BarcodeModule } from './barcode.module';
import { BarcodeService } from './barcode.service';
import { BarcodePrintService } from './barcode-print.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('Module 12 — Barcode & Labels Production Verification Suite', () => {
  let barcodeService: BarcodeService;
  let barcodePrintService: BarcodePrintService;
  let posService: PosService;
  let purchaseService: PurchaseService;
  let purchasePostingService: PurchasePostingService;
  let prisma: PrismaService;

  let companyId: string;
  let foreignCompanyId: string;
  let branchId: string;
  let godownId: string;
  let unitId: string;
  let userId: string;
  let supplierId: string;

  let item1Id: string;
  let item2Id: string;
  let inactiveItemId: string;
  let foreignItemId: string;

  let grnId: string;
  let grnLineId: string;
  const initialReceivedQty = 50;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        PosModule,
        PurchaseModule,
        BarcodeModule,
      ],
    }).compile();

    barcodeService = module.get<BarcodeService>(BarcodeService);
    barcodePrintService = module.get<BarcodePrintService>(BarcodePrintService);
    posService = module.get<PosService>(PosService);
    purchaseService = module.get<PurchaseService>(PurchaseService);
    purchasePostingService = module.get<PurchasePostingService>(PurchasePostingService);
    prisma = module.get<PrismaService>(PrismaService);

    // 1. Setup Test Organizations & Companies
    const org = await prisma.organization.create({
      data: { name: 'M12 Org', code: `ORG_M12_${Date.now()}` },
    });

    const comp = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'M12 Company', code: `CO_M12_${Date.now()}` },
    });
    companyId = comp.id;

    const foreignComp = await prisma.company.create({
      data: { organization_id: org.id, legal_name: 'M12 Foreign Co', code: `CO_M12_F_${Date.now()}` },
    });
    foreignCompanyId = foreignComp.id;

    // 2. Setup Branch, Godown, Unit, User
    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'M12 Branch', code: `BR_M12_${Date.now()}` },
    });
    branchId = branch.id;

    const godown = await prisma.godown.create({
      data: { branch_id: branchId, name: 'M12 Godown', code: `GD_M12_${Date.now()}` },
    });
    godownId = godown.id;

    const unit = await prisma.unit.create({
      data: { company_id: companyId, name: 'PCS', code: `PCS_${Date.now()}` },
    });
    unitId = unit.id;

    const foreignUnit = await prisma.unit.create({
      data: { company_id: foreignCompanyId, name: 'PCS-F', code: `PCSF_${Date.now()}` },
    });

    const user = await prisma.user.create({
      data: {
        organization_id: org.id,
        username: `user_m12_${Date.now()}`,
        password_hash: 'secret',
        display_name: 'M12 Tester',
      },
    });
    userId = user.id;

    const party = await prisma.party.create({
      data: {
        company_id: companyId,
        name: 'M12 Supplier Ltd',
        code: `SUP_M12_${Date.now()}`,
        party_type: 'SUPPLIER',
      },
    });
    supplierId = party.id;

    // 3. Setup Items
    const itm1 = await prisma.item.create({
      data: {
        company_id: companyId,
        sku: `SKU12_A_${Date.now()}`,
        name: 'Premium Basmati Rice 5kg',
        item_type: "STOCK_ITEM",
        primary_unit_id: unitId,
        mrp: 650.0,
        default_sale_rate: 599.0,
        is_active: true,
      },
    });
    item1Id = itm1.id;

    const itm2 = await prisma.item.create({
      data: {
        company_id: companyId,
        sku: `SKU12_B_${Date.now()}`,
        name: 'Organic Wheat Flour 10kg',
        item_type: "STOCK_ITEM",
        primary_unit_id: unitId,
        mrp: 420.0,
        default_sale_rate: 390.0,
        is_active: true,
      },
    });
    item2Id = itm2.id;

    const itmInactive = await prisma.item.create({
      data: {
        company_id: companyId,
        sku: `SKU12_INACT_${Date.now()}`,
        name: 'Discontinued Item',
        item_type: "STOCK_ITEM",
        primary_unit_id: unitId,
        mrp: 100.0,
        is_active: false,
      },
    });
    inactiveItemId = itmInactive.id;

    const itmForeign = await prisma.item.create({
      data: {
        company_id: foreignCompanyId,
        sku: `SKU12_FOR_${Date.now()}`,
        name: 'Foreign Co Item',
        item_type: "STOCK_ITEM",
        primary_unit_id: foreignUnit.id,
        mrp: 200.0,
        is_active: true,
      },
    });
    foreignItemId = itmForeign.id;

    // 4. Setup Goods Receipt (GRN) for Inward Label verification
    const grn = await prisma.goodsReceipt.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        party_id: supplierId,
        document_number: `GRN-M12-${Date.now()}`,
        document_date: new Date(),
        status: 'POSTED',
        posted_at: new Date(),
        posted_by: userId,
        lines: {
          create: [
            {
              item_id: item1Id,
              godown_id: godownId,
              unit_id: unitId,
              received_quantity: initialReceivedQty,
              batch_number: 'BATCH-2026-X',
              expiry_date: new Date('2028-12-31'),
            },
          ],
        },
      },
      include: { lines: true },
    });
    grnId = grn.id;
    grnLineId = grn.lines[0].id;
  }, 60000);

  afterAll(async () => {
    // Teardown test data cleanly
    const cIds = [companyId, foreignCompanyId].filter(Boolean);
    await prisma.auditLog.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.itemBarcode.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.labelTemplate.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.goodsReceiptLine.deleteMany({ where: { goods_receipt: { company_id: { in: cIds } } } });
    await prisma.goodsReceipt.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.stockMovement.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.stockBalanceProjection.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.item.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.unit.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.godown.deleteMany({ where: { branch: { company_id: { in: cIds } } } });
    await prisma.branch.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.party.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: { in: cIds } } });
    const comp = await prisma.company.findFirst({ where: { id: companyId } });
    if (comp) {
      await prisma.organization.delete({ where: { id: comp.organization_id } }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. FOUNDATION TESTS
  // =========================================================================
  describe('1. Foundation & Barcode Assignment', () => {
    it('BC-01: Should assign a canonical barcode to an active item and set as primary by default', async () => {
      const barcodeValue = `BC-PRI-${Date.now()}`;
      const assigned = await barcodeService.assignBarcode(companyId, userId, {
        item_id: item1Id,
        barcode: barcodeValue,
        barcode_type: 'CODE128',
      });

      expect(assigned).toBeDefined();
      expect(assigned.barcode).toBe(barcodeValue);
      expect(assigned.is_primary).toBe(true);
      expect(assigned.is_active).toBe(true);
      expect(assigned.item_id).toBe(item1Id);

      // Verify audit log creation
      const audit = await prisma.auditLog.findFirst({
        where: {
          company_id: companyId,
          action: 'ITEM_BARCODE_CREATED',
          source_document_id: item1Id,
        },
      });
      expect(audit).toBeDefined();
    });

    it('BC-02: Should retrieve all assigned barcodes for an item', async () => {
      const list = await barcodeService.getBarcodesByItem(companyId, item1Id);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].item_id).toBe(item1Id);
    });

    it('BC-03: Should resolve item by barcode lookup', async () => {
      const list = await barcodeService.getBarcodesByItem(companyId, item1Id);
      const targetBarcode = list[0].barcode;

      const resolved = await barcodeService.lookupBarcode(companyId, targetBarcode);
      expect(resolved.id).toBe(item1Id);
      expect(resolved.name).toBe('Premium Basmati Rice 5kg');
      expect(resolved.primary_unit).toBeDefined();
    });
  });

  // =========================================================================
  // 2. MULTIPLE BARCODES PER ITEM
  // =========================================================================
  describe('2. Multiple Barcode Support', () => {
    let secondBarcodeId: string;
    let secondBarcodeValue: string;

    it('BC-04: Should assign an alternate/secondary barcode without overwriting the primary', async () => {
      secondBarcodeValue = `BC-SEC-${Date.now()}`;
      const secondBarcode = await barcodeService.assignBarcode(companyId, userId, {
        item_id: item1Id,
        barcode: secondBarcodeValue,
        barcode_type: 'SUPPLIER',
        is_primary: false,
      });

      expect(secondBarcode.is_primary).toBe(false);
      secondBarcodeId = secondBarcode.id;

      const barcodes = await barcodeService.getBarcodesByItem(companyId, item1Id);
      expect(barcodes.length).toBeGreaterThanOrEqual(2);
      const primaryCount = barcodes.filter((b) => b.is_primary).length;
      expect(primaryCount).toBe(1);
    });

    it('BC-05: Both primary and secondary barcodes must resolve to the same canonical item', async () => {
      const barcodes = await barcodeService.getBarcodesByItem(companyId, item1Id);
      const primary = barcodes.find((b) => b.is_primary)!;
      const secondary = barcodes.find((b) => !b.is_primary)!;

      const itemFromPrimary = await barcodeService.lookupBarcode(companyId, primary.barcode);
      const itemFromSecondary = await barcodeService.lookupBarcode(companyId, secondary.barcode);

      expect(itemFromPrimary.id).toBe(item1Id);
      expect(itemFromSecondary.id).toBe(item1Id);
      expect(itemFromPrimary.id).toBe(itemFromSecondary.id);
    });

    it('BC-06: Should atomically promote secondary barcode to primary and demote previous primary', async () => {
      await barcodeService.setPrimaryBarcode(companyId, userId, secondBarcodeId);

      const barcodes = await barcodeService.getBarcodesByItem(companyId, item1Id);
      const updatedSecond = barcodes.find((b) => b.id === secondBarcodeId)!;
      expect(updatedSecond.is_primary).toBe(true);

      const primaryList = barcodes.filter((b) => b.is_primary);
      expect(primaryList.length).toBe(1);
    });

    it('BC-07: Should deactivate barcode (soft delete) so it can no longer be looked up', async () => {
      await barcodeService.deactivateBarcode(companyId, userId, secondBarcodeId);

      // Deactivated barcode should fail lookup
      await expect(
        barcodeService.lookupBarcode(companyId, secondBarcodeValue)
      ).rejects.toThrow('Item not found or inactive');
    });
  });

  // =========================================================================
  // 3. NEGATIVE & BOUNDARY VALIDATION
  // =========================================================================
  describe('3. Negative & Boundary Validation', () => {
    it('BC-08: Should reject duplicate barcode assignment to another item in the same company', async () => {
      const barcodes = await barcodeService.getBarcodesByItem(companyId, item1Id);
      const existingBarcode = barcodes[0].barcode;

      await expect(
        barcodeService.assignBarcode(companyId, userId, {
          item_id: item2Id,
          barcode: existingBarcode,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('BC-09: Should reject empty or whitespace-only barcode', async () => {
      await expect(
        barcodeService.assignBarcode(companyId, userId, {
          item_id: item1Id,
          barcode: '   ',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('BC-10: Should reject barcode assignment to an inactive item', async () => {
      await expect(
        barcodeService.assignBarcode(companyId, userId, {
          item_id: inactiveItemId,
          barcode: `BC-INACT-${Date.now()}`,
        })
      ).rejects.toThrow('Cannot assign barcode to an inactive item');
    });

    it('BC-11: Should reject barcode assignment to a non-existent item', async () => {
      await expect(
        barcodeService.assignBarcode(companyId, userId, {
          item_id: '00000000-0000-0000-0000-000000000000',
          barcode: `BC-GHOST-${Date.now()}`,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('BC-12: Should reject lookup for non-existent barcode', async () => {
      await expect(
        barcodeService.lookupBarcode(companyId, 'DEFINITELY_UNKNOWN_BARCODE_XYZ')
      ).rejects.toThrow('Item not found or inactive');
    });
  });

  // =========================================================================
  // 4. POS INTEGRATION VERIFICATION
  // =========================================================================
  describe('4. POS Integration (lookupItemByBarcode)', () => {
    it('BC-13: POS lookupItemByBarcode must resolve item by its assigned ItemBarcode', async () => {
      const posBarcode = `POS-BC-${Date.now()}`;
      await barcodeService.assignBarcode(companyId, userId, {
        item_id: item2Id,
        barcode: posBarcode,
        barcode_type: 'CODE128',
      });

      // Existing POS method lookupItemByBarcode
      const resolved = await posService.lookupItemByBarcode(companyId, posBarcode);
      expect(resolved.id).toBe(item2Id);
      expect(resolved.name).toBe('Organic Wheat Flour 10kg');
    });

    it('BC-14: POS lookupItemByBarcode must still support backward-compatible SKU fallback', async () => {
      const itm2 = await prisma.item.findUnique({ where: { id: item2Id } });
      const resolved = await posService.lookupItemByBarcode(companyId, itm2!.sku);
      expect(resolved.id).toBe(item2Id);
    });

    it('BC-15: POS lookup must reject deactivated barcode or inactive item', async () => {
      const inact = await prisma.item.findUnique({ where: { id: inactiveItemId } });
      await expect(
        posService.lookupItemByBarcode(companyId, inact!.sku)
      ).rejects.toThrow('Item not found or inactive');
    });
  });

  // =========================================================================
  // 5. INWARD BARCODE PRINTING & ZERO-STOCK-MUTATION INVARIANT
  // =========================================================================
  describe('5. Inward Barcode Printing & Zero-Stock Invariant', () => {
    it('BC-16: Should generate inward labels linked to an authoritative GRN', async () => {
      const stockMovementsBefore = await prisma.stockMovement.count({ where: { company_id: companyId } });
      const vouchersBefore = await prisma.voucher.count({ where: { company_id: companyId } });

      const inwardResult = await barcodePrintService.generateInwardLabels(companyId, userId, {
        goods_receipt_id: grnId,
        lines: [
          {
            goods_receipt_line_id: grnLineId,
            quantity: 10,
          },
        ],
      });

      expect(inwardResult.goods_receipt_id).toBe(grnId);
      expect(inwardResult.total_labels_requested).toBe(10);
      expect(inwardResult.labels[0].batch_number).toBe('BATCH-2026-X');
      expect(inwardResult.printable_html).toContain('Premium Basmati Rice 5kg');

      // CRITICAL ERP RULE: Label generation must create ZERO stock movements and ZERO vouchers
      const stockMovementsAfter = await prisma.stockMovement.count({ where: { company_id: companyId } });
      const vouchersAfter = await prisma.voucher.count({ where: { company_id: companyId } });

      expect(stockMovementsAfter).toBe(stockMovementsBefore);
      expect(vouchersAfter).toBe(vouchersBefore);

      // Verify GRN lineage in audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          company_id: companyId,
          action: 'INWARD_LABEL_PRINTED',
          source_document_id: grnId,
        },
      });
      expect(audit).toBeDefined();
    });

    it('BC-17: Should reject inward label generation exceeding received quantity', async () => {
      await expect(
        barcodePrintService.generateInwardLabels(companyId, userId, {
          goods_receipt_id: grnId,
          lines: [
            {
              goods_receipt_line_id: grnLineId,
              quantity: initialReceivedQty + 10, // Over-print attempt
            },
          ],
        })
      ).rejects.toThrow(/exceeds received quantity/);
    });

    it('BC-18: Should reject inward labels for invalid or cross-tenant GRN line', async () => {
      await expect(
        barcodePrintService.generateInwardLabels(companyId, userId, {
          goods_receipt_id: grnId,
          lines: [
            {
              goods_receipt_line_id: '00000000-0000-0000-0000-000000000000',
              quantity: 5,
            },
          ],
        })
      ).rejects.toThrow(/does not belong to GRN/);
    });

    it('BC-19: Reprinting inward labels multiple times must NOT mutate stock or accounting', async () => {
      const stockCount1 = await prisma.stockMovement.count({ where: { company_id: companyId } });

      // Reprint 1
      await barcodePrintService.generateInwardLabels(companyId, userId, {
        goods_receipt_id: grnId,
        lines: [{ goods_receipt_line_id: grnLineId, quantity: 5 }],
      });

      // Reprint 2
      await barcodePrintService.generateInwardLabels(companyId, userId, {
        goods_receipt_id: grnId,
        lines: [{ goods_receipt_line_id: grnLineId, quantity: 5 }],
      });

      const stockCount2 = await prisma.stockMovement.count({ where: { company_id: companyId } });
      expect(stockCount2).toBe(stockCount1); // Unchanged!
    });
  });

  // =========================================================================
  // 6. PRODUCT LABELS, MRP, & THERMAL PRINT PAYLOADS
  // =========================================================================
  describe('6. Product & MRP Labels & Thermal Print', () => {
    it('BC-20: Product label must reflect authoritative MRP snapshot without altering stock or ledger', async () => {
      const stockBefore = await prisma.stockMovement.count({ where: { company_id: companyId } });
      const ledgerBefore = await prisma.voucher.count({ where: { company_id: companyId } });

      const label = await barcodePrintService.generateProductLabel(companyId, userId, {
        item_id: item1Id,
        quantity: 3,
      });

      expect(label.mrp).toBe(650.0);
      expect(label.sale_rate).toBe(599.0);
      expect(label.item_name).toBe('Premium Basmati Rice 5kg');
      expect(label.printable_html).toContain('MRP: ₹650.00');

      // Verify thermal payloads
      expect(label.thermal_payload.zpl).toContain('^XA');
      expect(label.thermal_payload.zpl).toContain('MRP: 650.00');
      expect(label.thermal_payload.escpos).toContain('MRP: Rs.650.00');

      const stockAfter = await prisma.stockMovement.count({ where: { company_id: companyId } });
      const ledgerAfter = await prisma.voucher.count({ where: { company_id: companyId } });
      expect(stockAfter).toBe(stockBefore);
      expect(ledgerAfter).toBe(ledgerBefore);
    });

    it('BC-21: Record print job must write audit log without mutating financial state', async () => {
      const job = await barcodePrintService.recordPrintJob(companyId, userId, {
        document_type: 'Item',
        document_id: item1Id,
        quantity: 20,
        notes: 'Printed on TSC TE200 Thermal Printer',
      });

      expect(job.success).toBe(true);
      expect(job.quantity_printed).toBe(20);

      const audit = await prisma.auditLog.findUnique({
        where: { id: job.audit_id },
      });
      expect(audit?.action).toBe('LABEL_PRINTED');
    });
  });

  // =========================================================================
  // 7. BARCODE GENERATION ALGORITHM
  // =========================================================================
  describe('7. Collision-Safe Barcode Generation', () => {
    it('BC-22: Should generate valid EAN-13 barcode with correct Modulo-10 checksum', async () => {
      const generated = await barcodeService.generateBarcode(companyId, {
        type: 'EAN13',
      });

      expect(generated.barcode.length).toBe(13);
      expect(/^\d{13}$/.test(generated.barcode)).toBe(true);

      // Verify Modulo-10 checksum
      const base12 = generated.barcode.slice(0, 12);
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(base12[i], 10);
        sum += i % 2 === 0 ? digit : digit * 3;
      }
      const expectedChecksum = (10 - (sum % 10)) % 10;
      expect(parseInt(generated.barcode[12], 10)).toBe(expectedChecksum);
    });

    it('BC-23: Should generate valid CODE128 barcode with custom prefix', async () => {
      const generated = await barcodeService.generateBarcode(companyId, {
        type: 'CODE128',
        prefix: 'MYSHOP',
      });

      expect(generated.barcode.startsWith('MYSHOP-')).toBe(true);
      expect(generated.barcode_type).toBe('CODE128');
    });
  });

  // =========================================================================
  // 8. SECURITY & TENANT ISOLATION
  // =========================================================================
  describe('8. Security & Tenant Isolation', () => {
    it('BC-24: Cross-tenant barcode lookup must be blocked', async () => {
      const foreignBarcode = `FOREIGN-BC-${Date.now()}`;
      await barcodeService.assignBarcode(foreignCompanyId, userId, {
        item_id: foreignItemId,
        barcode: foreignBarcode,
      });

      // Company 1 must NOT be able to resolve Company 2's barcode
      await expect(
        barcodeService.lookupBarcode(companyId, foreignBarcode)
      ).rejects.toThrow('Item not found or inactive');
    });

    it('BC-25: Cross-tenant barcode assignment must reject unauthorized item', async () => {
      await expect(
        barcodeService.assignBarcode(companyId, userId, {
          item_id: foreignItemId, // Belongs to foreignCompanyId!
          barcode: `STEAL-BC-${Date.now()}`,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('BC-26: Same barcode string can exist across two different companies (scoped uniqueness)', async () => {
      const sharedBarcode = `SHARED-CODE-${Date.now()}`;

      // Assign in Company 1
      const bc1 = await barcodeService.assignBarcode(companyId, userId, {
        item_id: item1Id,
        barcode: sharedBarcode,
      });
      expect(bc1.company_id).toBe(companyId);

      // Assign exact same string in Foreign Company
      const bc2 = await barcodeService.assignBarcode(foreignCompanyId, userId, {
        item_id: foreignItemId,
        barcode: sharedBarcode,
      });
      expect(bc2.company_id).toBe(foreignCompanyId);

      // Lookups inside each tenant resolve their own tenant item
      const itemComp1 = await barcodeService.lookupBarcode(companyId, sharedBarcode);
      const itemComp2 = await barcodeService.lookupBarcode(foreignCompanyId, sharedBarcode);

      expect(itemComp1.id).toBe(item1Id);
      expect(itemComp2.id).toBe(foreignItemId);
    });
  });

  // =========================================================================
  // 9. IDEMPOTENCY
  // =========================================================================
  describe('9. Idempotency & Repeat Operations', () => {
    it('BC-27: Repeated barcode assignment for the same item must be idempotent and not create duplicate records', async () => {
      const idempotentBarcode = `IDEM-BC-${Date.now()}`;

      const res1 = await barcodeService.assignBarcode(companyId, userId, {
        item_id: item1Id,
        barcode: idempotentBarcode,
        barcode_type: 'CODE128',
      });

      const res2 = await barcodeService.assignBarcode(companyId, userId, {
        item_id: item1Id,
        barcode: idempotentBarcode,
        barcode_type: 'CODE128',
      });

      expect(res1.id).toBe(res2.id);

      const count = await prisma.itemBarcode.count({
        where: { company_id: companyId, barcode: idempotentBarcode },
      });
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // 10. CONCURRENCY & RACE CONDITIONS
  // =========================================================================
  describe('10. Concurrency & Race Conditions', () => {
    it('BC-28: Two concurrent requests assigning the same barcode to different items must have exactly one winner', async () => {
      const contestedBarcode = `RACE-BC-${Date.now()}`;

      const results = await Promise.allSettled([
        barcodeService.assignBarcode(companyId, userId, {
          item_id: item1Id,
          barcode: contestedBarcode,
        }),
        barcodeService.assignBarcode(companyId, userId, {
          item_id: item2Id,
          barcode: contestedBarcode,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Exactly one barcode record exists in database
      const count = await prisma.itemBarcode.count({
        where: { company_id: companyId, barcode: contestedBarcode },
      });
      expect(count).toBe(1);
    });

    it('BC-29: Concurrent barcode generation must produce unique collision-free values', async () => {
      const generations = await Promise.all(
        Array.from({ length: 5 }).map(() =>
          barcodeService.generateBarcode(companyId, { type: 'CODE128' })
        )
      );

      const codes = generations.map((g) => g.barcode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(5);
    });

    it('BC-30: Concurrent inward label requests must not create any stock or ledger duplication', async () => {
      const stockBefore = await prisma.stockMovement.count({ where: { company_id: companyId } });

      await Promise.all([
        barcodePrintService.generateInwardLabels(companyId, userId, {
          goods_receipt_id: grnId,
          lines: [{ goods_receipt_line_id: grnLineId, quantity: 2 }],
        }),
        barcodePrintService.generateInwardLabels(companyId, userId, {
          goods_receipt_id: grnId,
          lines: [{ goods_receipt_line_id: grnLineId, quantity: 3 }],
        }),
      ]);

      const stockAfter = await prisma.stockMovement.count({ where: { company_id: companyId } });
      expect(stockAfter).toBe(stockBefore);
    });
  });

  // =========================================================================
  // 11. LABEL TEMPLATES
  // =========================================================================
  describe('11. Label Templates CRUD', () => {
    let templateId: string;

    it('BC-31: Should create a custom thermal label template', async () => {
      const template = await barcodePrintService.createTemplate(companyId, {
        name: 'Jewelry Tag 38x25mm',
        template_type: 'PRODUCT',
        paper_type: 'ROLL',
        width_mm: 38.0,
        height_mm: 25.0,
        is_default: true,
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Jewelry Tag 38x25mm');
      expect(template.is_default).toBe(true);
      templateId = template.id;
    });

    it('BC-32: Should list and update label templates', async () => {
      const list = await barcodePrintService.getTemplates(companyId);
      expect(list.length).toBeGreaterThanOrEqual(1);

      const updated = await barcodePrintService.updateTemplate(companyId, templateId, {
        name: 'Jewelry Tag Updated 38x25mm',
      });
      expect(updated.name).toBe('Jewelry Tag Updated 38x25mm');
    });

    it('BC-33: Should delete label template', async () => {
      const res = await barcodePrintService.deleteTemplate(companyId, templateId);
      expect(res.success).toBe(true);

      const list = await barcodePrintService.getTemplates(companyId);
      expect(list.find((t) => t.id === templateId)).toBeUndefined();
    });
  });
});
