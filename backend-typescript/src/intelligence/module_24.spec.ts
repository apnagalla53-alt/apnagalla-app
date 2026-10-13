import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { OwnerDashboardService } from './owner-dashboard.service';
import { v4 as uuidv4 } from 'uuid';

describe('Module 24 — Cloud & Remote Owner', () => {
  let dashboardService: OwnerDashboardService;
  let prisma: PrismaService;
  
  let companyId: string;
  let branchId: string;
  let finYearId: string;
  let partyId: string;
  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OwnerDashboardService, PrismaService],
    }).compile();

    dashboardService = module.get<OwnerDashboardService>(OwnerDashboardService);
    prisma = module.get<PrismaService>(PrismaService);

    // Setup Organization and Company
    const org = await prisma.organization.create({
      data: { name: 'Evolix Cloud Org', code: `CL_ORG_${uuidv4().substring(0, 8)}` }
    });
    orgId = org.id;

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        legal_name: 'Evolix Cloud Company Ltd',
        code: `CL_COMP_${uuidv4().substring(0, 8)}`,
        state: 'Delhi',
        country: 'India'
      }
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { company_id: companyId, name: 'Cloud HQ', code: 'CHQ' }
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

    const party = await prisma.party.create({
      data: { company_id: companyId, party_type: 'CUSTOMER', name: 'Cloud Customer', code: 'CL_CUST' }
    });
    partyId = party.id;

    const user = await prisma.user.create({
      data: {
        organization_id: orgId,
        username: `clouduser_${uuidv4().substring(0, 8)}`,
        password_hash: 'hashed',
        email: `cloud_${uuidv4().substring(0, 8)}@evolix.com`,
        display_name: 'Cloud User'
      }
    });
    userId = user.id;
    const ownerRole = await prisma.role.create({ data: { organization_id: orgId, name: 'OWNER' } });
    await prisma.userRole.create({ data: { user_id: userId, role_id: ownerRole.id, company_id: companyId, branch_id: branchId } });
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    // Create Sales Invoice for Today
    await prisma.salesInvoice.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: finYearId,
        party_id: partyId,
        document_number: 'INV-CL-001',
        document_date: new Date(date),
        status: 'POSTED',
        grand_total: 5000,
        taxable_amount: 5000,
        posted_by: userId
      }
    });

    const cashLedger = await prisma.ledgerAccount.create({
      data: { company_id: companyId, name: 'Cash', account_type: 'ASSET', code: 'CL_CASH' }
    });

    const customerLedger = await prisma.ledgerAccount.create({
      data: { company_id: companyId, party_id: partyId, name: 'Customer A/C', account_type: 'ASSET', code: 'CL_CUST_AC' }
    });

    // Create Receipt Voucher for Today
    await prisma.voucher.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        financial_year_id: finYearId,
        voucher_type: 'RECEIPT',
        document_number: 'REC-CL-001',
        voucher_date: new Date(date),
        status: 'POSTED',
        lines: {
          create: [
            { ledger_account_id: cashLedger.id, debit: 2000, credit: 0 },
            { ledger_account_id: customerLedger.id, debit: 0, credit: 2000 }
          ]
        }
      }
    });

  }, 60000);

  afterAll(async () => {
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: companyId } } });
    await prisma.voucher.deleteMany({ where: { company_id: companyId } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: companyId } });
    await prisma.salesInvoice.deleteMany({ where: { company_id: companyId } });
    await prisma.user.deleteMany({ where: { organization_id: orgId } });
    await prisma.role.deleteMany({ where: { organization_id: orgId } });
    await prisma.party.deleteMany({ where: { company_id: companyId } });
    await prisma.financialYear.deleteMany({ where: { company_id: companyId } });
    await prisma.branch.deleteMany({ where: { company_id: companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should generate an accurate owner dashboard summary', async () => {
    const summary = await dashboardService.getOwnerDashboardSummary(companyId, new Date());
    
    expect(summary.total_sales).toBe(5000);
    expect(summary.total_receipts).toBe(2000);
    expect(summary.active_users).toBe(1);
  });

  it('does not fabricate an external sync when no replication provider exists', () => {
    // The previous obsolete test asserted a mock success from a nonexistent service.
    // Production must disclose the actual provider capability instead.
    expect(dashboardService.getExternalSyncStatus()).toMatchObject({ status: 'NOT_CONFIGURED', provider: null });
  });

  it('excludes unposted sales and rejects a nonexistent business', async () => {
    const invoice = await prisma.salesInvoice.create({ data: { company_id: companyId, branch_id: branchId, financial_year_id: finYearId, party_id: partyId,
      document_number: 'INV-CL-DRAFT', document_date: new Date(), status: 'DRAFT', grand_total: 99999, taxable_amount: 99999 } });
    const summary = await dashboardService.getOwnerDashboardSummary(companyId, new Date());
    expect(summary.total_sales).toBe(5000);
    await prisma.salesInvoice.delete({ where: { id: invoice.id } });
    await expect(dashboardService.getOwnerDashboardSummary(uuidv4(), new Date())).rejects.toThrow('Business not found');
  });

});
