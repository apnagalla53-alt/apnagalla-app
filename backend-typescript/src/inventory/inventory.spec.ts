import { Test, TestingModule } from '@nestjs/testing';
import { InventoryPostingService } from './posting.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Module 04 - Inventory Core Verification', () => {
  let service: InventoryPostingService;
  let prisma: PrismaService;

  let compId = '';
  let branchId = '';
  let godown1Id = '';
  let godown2Id = '';
  let godownForeignId = '';
  let compForeignId = '';
  let branchForeignId = '';
  let item1Id = '';
  let itemForeignId = '';
  let unitId = '';

  const doc1 = '11111111-1111-1111-1111-111111111111';
  const doc2 = '22222222-2222-2222-2222-222222222222';
  const doc3 = '33333333-3333-3333-3333-333333333333';
  const doc4 = '44444444-4444-4444-4444-444444444444';
  const doc5 = '55555555-5555-5555-5555-555555555555';
  const doc6 = '66666666-6666-6666-6666-666666666666';
  const doc7 = '77777777-7777-7777-7777-777777777777';
  const doc8 = '88888888-8888-8888-8888-888888888888';
  const doc9 = '99999999-9999-9999-9999-999999999999';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryPostingService, PrismaService],
    }).compile();

    service = module.get<InventoryPostingService>(InventoryPostingService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Test Data safely
    const org = await prisma.organization.create({ data: { name: 'Inv Org', code: `INV-ORG-${Date.now()}` } });
    const comp = await prisma.company.create({ data: { organization_id: org.id, code: `INV-C-${Date.now()}`, legal_name: 'Inv Comp' } });
    compId = comp.id;

    const compForeign = await prisma.company.create({ data: { organization_id: org.id, code: `INV-C-F-${Date.now()}`, legal_name: 'Inv Comp Foreign' } });
    compForeignId = compForeign.id;

    const branch = await prisma.branch.create({ data: { company_id: comp.id, code: `INV-B-${Date.now()}`, name: 'Inv Branch' } });
    branchId = branch.id;

    const branchForeign = await prisma.branch.create({ data: { company_id: compForeign.id, code: `INV-B-F-${Date.now()}`, name: 'Inv Branch Foreign' } });
    branchForeignId = branchForeign.id;

    const g1 = await prisma.godown.create({ data: { branch_id: branch.id, code: `G1-${Date.now()}`, name: 'Main Godown' } });
    const g2 = await prisma.godown.create({ data: { branch_id: branch.id, code: `G2-${Date.now()}`, name: 'Secondary Godown' } });
    const gF = await prisma.godown.create({ data: { branch_id: branchForeign.id, code: `GF-${Date.now()}`, name: 'Foreign Godown' } });
    godown1Id = g1.id;
    godown2Id = g2.id;
    godownForeignId = gF.id;

    const unit = await prisma.unit.create({ data: { company_id: comp.id, code: `PCS-${Date.now()}`, name: 'Pieces' } });
    unitId = unit.id;
    const unitF = await prisma.unit.create({ data: { company_id: compForeign.id, code: `PCS-F-${Date.now()}`, name: 'Pieces F' } });

    const i1 = await prisma.item.create({ data: { company_id: comp.id, sku: `SKU1-${Date.now()}`, name: 'Item 1', item_type: "STOCK_ITEM", primary_unit_id: unit.id } });
    const iF = await prisma.item.create({ data: { company_id: compForeign.id, sku: `SKUF-${Date.now()}`, name: 'Item Foreign', item_type: "STOCK_ITEM", primary_unit_id: unitF.id } });
    item1Id = i1.id;
    itemForeignId = iF.id;
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (compId && compForeignId) {
      await prisma.stockMovement.deleteMany({ where: { company_id: { in: [compId, compForeignId] } } });
      await prisma.stockBalanceProjection.deleteMany({ where: { company_id: { in: [compId, compForeignId] } } });
      await prisma.item.deleteMany({ where: { company_id: { in: [compId, compForeignId] } } });
      await prisma.unit.deleteMany({ where: { company_id: { in: [compId, compForeignId] } } });
      await prisma.godown.deleteMany({ where: { branch_id: { in: [branchId, branchForeignId] } } });
      await prisma.branch.deleteMany({ where: { company_id: { in: [compId, compForeignId] } } });
      await prisma.company.deleteMany({ where: { id: { in: [compId, compForeignId] } } });
    } else if (compId) {
      await prisma.stockMovement.deleteMany({ where: { company_id: compId } });
      await prisma.stockBalanceProjection.deleteMany({ where: { company_id: compId } });
      await prisma.item.deleteMany({ where: { company_id: compId } });
      await prisma.unit.deleteMany({ where: { company_id: compId } });
      await prisma.godown.deleteMany({ where: { branch_id: branchId } });
      await prisma.branch.deleteMany({ where: { company_id: compId } });
      await prisma.company.deleteMany({ where: { id: compId } });
    }
    await prisma.$disconnect();
  });

  describe('Core Stock', () => {
    it('1. Purchase IN increases stock', async () => {
      await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'PURCHASE_IN',
          business_date: new Date(),
          source_document_type: 'TEST_GRN',
          source_document_id: doc1,
          lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 100, unit_id: unitId }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(bal?.quantity.toString()).toBe('100');
    });

    it('2. Sales OUT decreases stock', async () => {
      await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'SALES_OUT',
          business_date: new Date(),
          source_document_type: 'TEST_INV',
          source_document_id: doc2,
          lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 20, unit_id: unitId }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(bal?.quantity.toString()).toBe('80');
    });

    it('3. Sales Return IN increases stock', async () => {
      await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'SALES_RETURN_IN',
          business_date: new Date(),
          source_document_type: 'TEST_RET',
          source_document_id: doc3,
          lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 5, unit_id: unitId }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(bal?.quantity.toString()).toBe('85');
    });

    it('4. Purchase Return OUT decreases stock', async () => {
      await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'PURCHASE_RETURN_OUT',
          business_date: new Date(),
          source_document_type: 'TEST_PRET',
          source_document_id: doc4,
          lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 10, unit_id: unitId }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(bal?.quantity.toString()).toBe('75');
    });

    it('5. Transfer OUT decreases source', async () => {
      await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'TRANSFER_OUT',
          business_date: new Date(),
          source_document_type: 'TEST_TRF',
          source_document_id: doc5,
          lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 25, unit_id: unitId, source_line_id: '11111111-2222-3333-4444-555555555555' }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(bal?.quantity.toString()).toBe('50');
    });

    it('6. Transfer IN increases destination', async () => {
      await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'TRANSFER_IN',
          business_date: new Date(),
          source_document_type: 'TEST_TRF',
          source_document_id: doc5,
          lines: [{ item_id: item1Id, godown_id: godown2Id, quantity: 25, unit_id: unitId, source_line_id: '22222222-3333-4444-5555-666666666666' }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown2Id } });
      expect(bal?.quantity.toString()).toBe('25');
    });

    it('7. Adjustment IN', async () => {
      await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'ADJUSTMENT_IN',
          business_date: new Date(),
          source_document_type: 'TEST_ADJ',
          source_document_id: doc6,
          lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 10, unit_id: unitId }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(bal?.quantity.toString()).toBe('60');
    });

    it('8. Adjustment OUT', async () => {
       await prisma.$transaction(async (tx) => {
        await service.postMovement(tx, {
          company_id: compId,
          branch_id: branchId,
          movement_type: 'ADJUSTMENT_OUT',
          business_date: new Date(),
          source_document_type: 'TEST_ADJ2',
          source_document_id: doc7,
          lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 10, unit_id: unitId }],
        });
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(bal?.quantity.toString()).toBe('50');
    });
  });

  describe('Integrity & Isolation', () => {
    it('9. Zero quantity rejected', async () => {
      await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc1,
        lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 0, unit_id: unitId }]
      }))).rejects.toThrow('positive');
    });

    it('10. Negative quantity rejected', async () => {
       await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc2,
        lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: -10, unit_id: unitId }]
      }))).rejects.toThrow('positive');
    });

    it('11. Invalid item rejected', async () => {
       await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc3,
        lines: [{ item_id: '11111111-1111-1111-1111-111111111111', godown_id: godown1Id, quantity: 10, unit_id: unitId }]
      }))).rejects.toThrow('not found or does not belong to company');
    });

    it('12. Invalid warehouse rejected', async () => {
      await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc4,
        lines: [{ item_id: item1Id, godown_id: '11111111-1111-1111-1111-111111111111', quantity: 10, unit_id: unitId }]
      }))).rejects.toThrow('not found or does not belong to branch');
    });
    
    it('13. Cross-company item rejected', async () => {
       await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc5,
        lines: [{ item_id: itemForeignId, godown_id: godown1Id, quantity: 10, unit_id: unitId }]
      }))).rejects.toThrow('not found or does not belong to company');
    });

    it('14. Cross-company warehouse rejected', async () => {
       await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc6,
        lines: [{ item_id: item1Id, godown_id: godownForeignId, quantity: 10, unit_id: unitId }]
      }))).rejects.toThrow('not found or does not belong to branch');
    });

    it('15. Cross-company movement (using different company context)', async () => {
       await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compForeignId, branch_id: branchForeignId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc7,
        lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 10, unit_id: unitId }] // using item1 from comp1 in context of comp2
      }))).rejects.toThrow('not found or does not belong to company');
    });

    it('16. Cross-branch violation', async () => {
       await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchForeignId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'T', source_document_id: doc8,
        lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 10, unit_id: unitId }]
      }))).rejects.toThrow('not found or does not belong to branch');
    });
  });

  describe('Idempotency', () => {
    it('17. Duplicate exact posting rejected', async () => {
      await expect(prisma.$transaction(tx => service.postMovement(tx, {
        company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
        business_date: new Date(), source_document_type: 'TEST_GRN', source_document_id: doc1, // Already exists!
        lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 10, unit_id: unitId }]
      }))).rejects.toThrow('Duplicate');
    });

    it('26. Multiple GRNs (legitimate same parent document allowed)', async () => {
       await prisma.$transaction(async tx => {
         await service.postMovement(tx, {
           company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
           business_date: new Date(), source_document_type: 'GOODS_RECEIPT', source_document_id: doc8,
           lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 10, unit_id: unitId }]
         });
         await service.postMovement(tx, {
           company_id: compId, branch_id: branchId, movement_type: 'PURCHASE_IN',
           business_date: new Date(), source_document_type: 'GOODS_RECEIPT', source_document_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // different GRN, same PO logically
           lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 5, unit_id: unitId }]
         });
       });
       // Allowed since source_document_id is different.
       expect(true).toBe(true);
    });
  });

  describe('Reversal', () => {
    it('19-20. Reversal creates opposite effect', async () => {
      await prisma.$transaction(async (tx) => {
        await service.reverseMovement(tx, compId, 'TEST_INV', '22222222-2222-2222-2222-222222222222', 'TEST_INV_REVERSAL');
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      // Was 50 -> original OUT 20 reversed means IN 20 -> 50 + 20 = 70. However, GRN-001 (+10) and GRN-002 (+5) added 15. So 85.
      expect(bal?.quantity.toString()).toBe('85'); 
    });

    it('21. Double reversal rejected', async () => {
      await expect(prisma.$transaction(async (tx) => {
        await service.reverseMovement(tx, compId, 'TEST_INV', '22222222-2222-2222-2222-222222222222', 'TEST_INV_REVERSAL');
      })).rejects.toThrow('Double reversal rejected');
    });
  });

  describe('Transactions & Rollbacks', () => {
    it('22-23. Atomic rollback on failure', async () => {
      let threw = false;
      try {
        await prisma.$transaction(async (tx) => {
          await service.postMovement(tx, {
            company_id: compId, branch_id: branchId, movement_type: 'TRANSFER_OUT',
            business_date: new Date(), source_document_type: 'TEST_FAIL', source_document_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            lines: [{ item_id: item1Id, godown_id: godown1Id, quantity: 1, unit_id: unitId }]
          });
          // Intentionally throw
          throw new Error('Rollback');
        });
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
      // Verify nothing was posted
      const mov = await prisma.stockMovement.findFirst({ where: { source_document_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' } });
      expect(mov).toBeNull();
    });
  });

  describe('Audit & Ledger', () => {
    it('29-30. Stock Balance Derivation Matches Ledger', async () => {
      const agg = await prisma.stockMovement.aggregate({
        where: { item_id: item1Id, godown_id: godown1Id },
        _sum: { quantity_delta: true }
      });
      const bal = await prisma.stockBalanceProjection.findFirst({ where: { item_id: item1Id, godown_id: godown1Id } });
      expect(agg._sum.quantity_delta?.toString()).toBe(bal?.quantity.toString());
    });
  });
});
