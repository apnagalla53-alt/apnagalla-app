import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { FieldSalesService, MobileOrderSyncPayload } from './field-sales.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

describe('Module 19 — Field Sales', () => {
  let fieldSalesService: FieldSalesService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let partyId: string;
  let itemId: string;
  let unitId: string;
  let orgId: string;
  let userId = uuidv4();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FieldSalesService, PrismaService],
    }).compile();

    fieldSalesService = module.get<FieldSalesService>(FieldSalesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Field Org', code: `FLD_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Field Company Ltd',
        code: `FLD_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'Field Branch', code: 'FB1' }
    });
    branchId = branch.id;

    const party = await prisma.party.create({
      data: { company_id: companyId, party_type: 'CUSTOMER', name: 'Field Customer', code: 'FLD_CUST' }
    });
    partyId = party.id;

    const unit = await prisma.unit.create({
      data: { company_id: companyId, name: 'Pieces', code: 'PCS' }
    });
    unitId = unit.id;

    const item = await prisma.item.create({
      data: { company_id: companyId, sku: 'FLD-ITEM-001', name: 'Field Item', item_type: "STOCK_ITEM", primary_unit_id: unitId }
    });
    itemId = item.id;

  }, 60000);

  afterAll(async () => {
    await prisma.salesOrderLine.deleteMany({ where: { sales_order: { company_id: companyId } } });
    await prisma.salesOrder.deleteMany({ where: { company_id: companyId } });
    await prisma.item.deleteMany({ where: { company_id: companyId } });
    await prisma.unit.deleteMany({ where: { company_id: companyId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should retrieve assigned beat for field rep', async () => {
    const beat = await fieldSalesService.getAssignedBeat(companyId, userId);
    expect(beat.beat_name).toBeDefined();
    expect(beat.parties.length).toBeGreaterThan(0);
    expect(beat.parties[0].id).toBe(partyId);
  });

  it('should sync mobile orders correctly', async () => {
    const payload: MobileOrderSyncPayload[] = [
      {
        mobile_reference_id: 'MOB-ORDER-999',
        party_id: partyId,
        document_date: new Date(),
        lines: [
          {
            item_id: itemId,
            unit_id: unitId,
            quantity: 10,
            rate: 150
          }
        ]
      }
    ];

    const results = await fieldSalesService.syncMobileOrders(companyId, branchId, userId, payload);
    
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].erp_sales_order_id).toBeDefined();
    expect(results[0].document_number).toBe('MOB-MOB-ORDER-999');

    // Verify it exists in DB
    const order = await prisma.salesOrder.findUnique({
      where: { id: results[0].erp_sales_order_id },
      include: { lines: true }
    });

    expect(order).toBeDefined();
    expect(order!.total.toNumber()).toBe(1500); // 10 * 150
    expect(order!.lines.length).toBe(1);
    expect(order!.lines[0].line_total.toNumber()).toBe(1500);
  });

});
