import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { GstService } from './gst.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

describe('Module 16 — GST & Compliance', () => {
  let gstService: GstService;
  let prisma: PrismaService;
  
  let companyId: string;
  let taxClassId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GstService, PrismaService],
    }).compile();

    gstService = module.get<GstService>(GstService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix GST Org', code: `GST_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix GST Company Ltd',
        code: `GST_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Maharashtra',
        country: 'India'
      }
    });
    companyId = company.id;

    // Create Tax Class
    const taxClass = await prisma.taxClass.create({
      data: {
        company_id: companyId,
        name: 'GST 18%',
        hsn_code: '999999',
        tax_rate: 18,
        cgst_rate: 9,
        sgst_rate: 9,
        igst_rate: 18
      }
    });
    taxClassId = taxClass.id;
  }, 60000);

  afterAll(async () => {
    await prisma.taxClass.deleteMany({ where: { company_id: companyId } });
    await prisma.auditLog.deleteMany({ where: { company_id: companyId } });
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: companyId } } });
    await prisma.voucher.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should calculate IGST for interstate transaction', async () => {
    const taxClass = await prisma.taxClass.findUnique({ where: { id: taxClassId } });
    
    const result = gstService.calculateGstForLine('Gujarat', 'Maharashtra', 1000, taxClass!);
    
    expect(result.is_interstate).toBe(true);
    expect(result.igst_amount.toNumber()).toBe(180);
    expect(result.cgst_amount.toNumber()).toBe(0);
    expect(result.sgst_amount.toNumber()).toBe(0);
    expect(result.total_tax_amount.toNumber()).toBe(180);
    expect(result.total_amount.toNumber()).toBe(1180);
  });

  it('should calculate CGST and SGST for intrastate transaction', async () => {
    const taxClass = await prisma.taxClass.findUnique({ where: { id: taxClassId } });
    
    const result = gstService.calculateGstForLine('Maharashtra', 'Maharashtra', 1000, taxClass!);
    
    expect(result.is_interstate).toBe(false);
    expect(result.igst_amount.toNumber()).toBe(0);
    expect(result.cgst_amount.toNumber()).toBe(90);
    expect(result.sgst_amount.toNumber()).toBe(90);
    expect(result.total_tax_amount.toNumber()).toBe(180);
    expect(result.total_amount.toNumber()).toBe(1180);
  });

  it('should throw BadRequestException when generating E-Way bill for amount < 50000', async () => {
    await expect(gstService.generateMockEwayBill('INV-001', 45000)).rejects.toThrow(BadRequestException);
  });

  it('should generate Mock E-Way bill for amount >= 50000', async () => {
    const result = await gstService.generateMockEwayBill('INV-002', 55000);
    expect(result.eway_bill_no).toBeDefined();
    expect(result.eway_bill_no.length).toBe(12);
    expect(result.valid_until).toBeDefined();
  });
});
