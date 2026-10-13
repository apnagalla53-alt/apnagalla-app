import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { ManufacturingService, ProductionPayload } from './manufacturing.service';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

describe('Module 25 — Manufacturing', () => {
  let manufacturingService: ManufacturingService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let godownId: string;
  let rmItemId: string;
  let fgItemId: string;
  let unitId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManufacturingService, PrismaService],
    }).compile();

    manufacturingService = module.get<ManufacturingService>(ManufacturingService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Mfg Org', code: `MFG_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Mfg Company Ltd',
        code: `MFG_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'Mfg Branch', code: 'MFB' }
    });
    branchId = branch.id;

    const godown = await prisma.godown.create({
      data: { branch_id: branchId, name: 'Mfg Godown', code: 'MFG' }
    });
    godownId = godown.id;

    const unit = await prisma.unit.create({
      data: { company_id: companyId, name: 'Kilograms', code: 'KG' }
    });
    unitId = unit.id;

    const rmItem = await prisma.item.create({
      data: { company_id: companyId, sku: 'RM-001', name: 'Raw Material A', item_type: "STOCK_ITEM", primary_unit_id: unitId }
    });
    rmItemId = rmItem.id;

    const fgItem = await prisma.item.create({
      data: { company_id: companyId, sku: 'FG-001', name: 'Finished Good B', item_type: "STOCK_ITEM", primary_unit_id: unitId }
    });
    fgItemId = fgItem.id;

  }, 60000);

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { company_id: companyId } });
    await prisma.item.deleteMany({ where: { company_id: companyId } });
    await prisma.unit.deleteMany({ where: { company_id: companyId } });
    await prisma.godown.deleteMany({ where: { branch: { company_id: companyId } } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should successfully record production and adjust stock', async () => {
    const payload: ProductionPayload = {
      company_id: companyId,
      branch_id: branchId,
      godown_id: godownId,
      finished_item_id: fgItemId,
      finished_unit_id: unitId,
      produced_quantity: 10,
      raw_materials: [
        {
          item_id: rmItemId,
          unit_id: unitId,
          consumed_quantity: 25
        }
      ]
    };

    const res = await manufacturingService.recordProduction(payload);
    expect(res.success).toBe(true);

    const movements = await prisma.stockMovement.findMany({
      where: { company_id: companyId, source_document_id: res.document_id }
    });

    expect(movements.length).toBe(2);

    const rmMovement = movements.find(m => m.item_id === rmItemId);
    expect(rmMovement!.quantity_delta.toNumber()).toBe(-25);
    expect(rmMovement!.movement_type).toBe('PRODUCTION_CONSUME');

    const fgMovement = movements.find(m => m.item_id === fgItemId);
    expect(fgMovement!.quantity_delta.toNumber()).toBe(10);
    expect(fgMovement!.movement_type).toBe('PRODUCTION_PRODUCE');
  });

  it('should reject production with no raw materials', async () => {
    const payload: ProductionPayload = {
      company_id: companyId,
      branch_id: branchId,
      godown_id: godownId,
      finished_item_id: fgItemId,
      finished_unit_id: unitId,
      produced_quantity: 10,
      raw_materials: []
    };

    await expect(manufacturingService.recordProduction(payload)).rejects.toThrow(BadRequestException);
  });

});
