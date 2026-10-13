import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { BatchExpiryService } from './batch-expiry.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

describe('Module 21 — Batch & Expiry', () => {
  let batchExpiryService: BatchExpiryService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let finYearId: string;
  let partyId: string;
  let itemId: string;
  let unitId: string;
  let godownId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BatchExpiryService, PrismaService],
    }).compile();

    batchExpiryService = module.get<BatchExpiryService>(BatchExpiryService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Batch Org', code: `BAT_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Batch Company Ltd',
        code: `BAT_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'Batch HQ', code: 'BHQ' }
    });
    branchId = branch.id;

    const finYear = await prisma.financialYear.create({
      data: {
        company_id: companyId,
        label: 'FY 2026-27',
        start_date: new Date('2026-04-01'),
        end_date: new Date('2027-03-31'),
        is_active: true
      }
    });
    finYearId = finYear.id;

    const godown = await prisma.godown.create({
      data: { branch_id: branchId, name: 'Main Godown', code: 'MG' }
    });
    godownId = godown.id;

    const party = await prisma.party.create({
      data: { company_id: companyId, party_type: 'SUPPLIER', name: 'Batch Supplier', code: 'BAT_SUP' }
    });
    partyId = party.id;

    const unit = await prisma.unit.create({
      data: { company_id: companyId, name: 'Pieces', code: 'PCS' }
    });
    unitId = unit.id;

    const item = await prisma.item.create({
      data: { company_id: companyId, sku: 'BAT-ITEM-001', name: 'Batch Item', item_type: "STOCK_ITEM", primary_unit_id: unitId }
    });
    itemId = item.id;

    const today = new Date();
    const expiringSoon = new Date();
    expiringSoon.setDate(today.getDate() + 15); // Expires in 15 days
    
    const farFuture = new Date();
    farFuture.setDate(today.getDate() + 90); // Expires in 90 days

    // Create a Goods Receipt with two lines
    await prisma.goodsReceipt.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        party_id: partyId,
        document_number: 'GRN-BAT-001',
        document_date: new Date(),
        status: 'POSTED',
        lines: {
          create: [
            {
              item_id: itemId,
              godown_id: godownId,
              unit_id: unitId,
              received_quantity: 100,
              batch_number: 'BATCH-001',
              expiry_date: expiringSoon
            },
            {
              item_id: itemId,
              godown_id: godownId,
              unit_id: unitId,
              received_quantity: 200,
              batch_number: 'BATCH-002',
              expiry_date: farFuture
            }
          ]
        }
      }
    });

  }, 60000);

  afterAll(async () => {
    await prisma.goodsReceiptLine.deleteMany({ where: { goods_receipt: { company_id: companyId } } });
    await prisma.goodsReceipt.deleteMany({ where: { company_id: companyId } });
    await prisma.item.deleteMany({ where: { company_id: companyId } });
    await prisma.unit.deleteMany({ where: { company_id: companyId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.godown.deleteMany({ where: { branch_id: branchId } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should retrieve batches expiring within 30 days', async () => {
    const expiringBatches = await batchExpiryService.getExpiringBatches(companyId, 30);
    expect(expiringBatches.length).toBe(1);
    expect(expiringBatches[0].batch_number).toBe('BATCH-001');
    expect(expiringBatches[0].received_quantity.toNumber()).toBe(100);
  });

  it('should retrieve no batches if checking for expiration within 10 days', async () => {
    const expiringBatches = await batchExpiryService.getExpiringBatches(companyId, 10);
    expect(expiringBatches.length).toBe(0);
  });

  it('should retrieve all batches if checking for expiration within 100 days', async () => {
    const expiringBatches = await batchExpiryService.getExpiringBatches(companyId, 100);
    expect(expiringBatches.length).toBe(2);
  });
});
