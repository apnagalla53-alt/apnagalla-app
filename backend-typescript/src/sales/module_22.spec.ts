import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { PharmacyService } from './pharmacy.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

describe('Module 22 — Pharmacy', () => {
  let pharmacyService: PharmacyService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let finYearId: string;
  let b2bPartyId: string;
  let walkinPartyId: string;
  let normalItemId: string;
  let narcoticItemId: string;
  let unitId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PharmacyService, PrismaService],
    }).compile();

    pharmacyService = module.get<PharmacyService>(PharmacyService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Pharm Org', code: `PH_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Pharm Company Ltd',
        code: `PH_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'Pharm Branch', code: 'PHB' }
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

    const b2bParty = await prisma.party.create({
      data: { company_id: companyId, party_type: 'CUSTOMER', name: 'Licensed Pharmacy', code: 'PH_B2B', is_walkin: false }
    });
    b2bPartyId = b2bParty.id;

    const walkinParty = await prisma.party.create({
      data: { company_id: companyId, party_type: 'CUSTOMER', name: 'Walk-in Customer', code: 'PH_WALKIN', is_walkin: true }
    });
    walkinPartyId = walkinParty.id;

    const unit = await prisma.unit.create({
      data: { company_id: companyId, name: 'Strips', code: 'STR' }
    });
    unitId = unit.id;

    const normalItem = await prisma.item.create({
      data: { company_id: companyId, sku: 'PH-ITM-001', name: 'Paracetamol 500mg', item_type: "STOCK_ITEM", primary_unit_id: unitId }
    });
    normalItemId = normalItem.id;

    const narcoticItem = await prisma.item.create({
      data: { company_id: companyId, sku: 'PH-ITM-002', name: 'Codeine Syrup (Narcotic)', item_type: "STOCK_ITEM", primary_unit_id: unitId }
    });
    narcoticItemId = narcoticItem.id;

    // Create a Sales Invoice with Narcotic Item to populate register
    const godown = await prisma.godown.create({
      data: { branch_id: branchId, name: 'Pharm Godown', code: 'PHG' }
    });

    await prisma.salesInvoice.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: finYearId,
        party_id: b2bPartyId,
        document_number: 'INV-PH-001',
        document_date: new Date(),
        status: 'POSTED',
        lines: {
          create: [
            {
              item_id: narcoticItemId,
              godown_id: godown.id,
              unit_id: unitId,
              quantity: 50,
              rate: 100
            }
          ]
        }
      }
    });

  }, 60000);

  afterAll(async () => {
    await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice: { company_id: companyId } } });
    await prisma.salesInvoice.deleteMany({ where: { company_id: companyId } });
    await prisma.item.deleteMany({ where: { company_id: companyId } });
    await prisma.unit.deleteMany({ where: { company_id: companyId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.godown.deleteMany({ where: { branch: { company_id: companyId } } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should allow B2B party to buy normal and restricted drugs', async () => {
    const res = await pharmacyService.validatePharmacySale(b2bPartyId, [normalItemId, narcoticItemId]);
    expect(res.valid).toBe(true);
    expect(res.restricted_items_flagged).toBe(1);
  });

  it('should allow Walk-in party to buy normal drugs', async () => {
    const res = await pharmacyService.validatePharmacySale(walkinPartyId, [normalItemId]);
    expect(res.valid).toBe(true);
    expect(res.restricted_items_flagged).toBe(0);
  });

  it('should block Walk-in party from buying restricted drugs', async () => {
    await expect(pharmacyService.validatePharmacySale(walkinPartyId, [normalItemId, narcoticItemId]))
      .rejects.toThrow(BadRequestException);
  });

  it('should generate Narcotic Drug Register', async () => {
    const from = new Date();
    from.setDate(from.getDate() - 1); // Yesterday
    const to = new Date();
    to.setDate(to.getDate() + 1); // Tomorrow

    const register = await pharmacyService.getNarcoticRegister(companyId, from.toISOString(), to.toISOString());
    expect(register.length).toBe(1);
    expect(register[0].item_name).toBe('Codeine Syrup (Narcotic)');
    expect(register[0].quantity_sold.toNumber()).toBe(50);
  });

});
