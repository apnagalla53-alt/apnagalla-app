import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { DispatchService } from './dispatch.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

describe('Module 18 — Dispatch & Delivery', () => {
  let dispatchService: DispatchService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let partyId: string;
  let challanId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DispatchService, PrismaService],
    }).compile();

    dispatchService = module.get<DispatchService>(DispatchService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Dispatch Org', code: `DISP_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Dispatch Company Ltd',
        code: `DISP_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'Dispatch HQ', code: 'DHQ' }
    });
    branchId = branch.id;

    const party = await prisma.party.create({
      data: { company_id: companyId, party_type: 'CUSTOMER', name: 'Dispatch Customer', code: 'DISP_CUST' }
    });
    partyId = party.id;

    const challan = await prisma.deliveryChallan.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        party_id: partyId,
        document_number: 'DC-001',
        document_date: new Date(),
        status: 'DRAFT',
      }
    });
    challanId = challan.id;

  }, 60000);

  afterAll(async () => {
    await prisma.deliveryChallanLine.deleteMany({ where: { delivery_challan: { company_id: companyId } } });
    await prisma.deliveryChallan.deleteMany({ where: { company_id: companyId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should dispatch a Delivery Challan', async () => {
    const dispatched = await dispatchService.dispatchChallan(challanId, companyId, 'TRK123', 'KA01AB1234');
    expect(dispatched.status).toBe('DISPATCHED');
    expect(dispatched.posted_at).toBeDefined();
  });

  it('should not dispatch an already dispatched challan', async () => {
    await expect(dispatchService.dispatchChallan(challanId, companyId)).rejects.toThrow(BadRequestException);
  });

  it('should record proof of delivery', async () => {
    const delivered = await dispatchService.recordProofOfDelivery(challanId, companyId, 'John Doe', 'Received in good condition');
    expect(delivered.status).toBe('DELIVERED');
  });

});
