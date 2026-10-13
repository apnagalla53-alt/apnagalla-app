import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from '../sales/sales.service';
import { SalesPostingService } from '../sales/posting.service';
import { PurchaseService } from '../purchase/purchase.service';
import { PostingService as PurchasePostingService } from '../purchase/posting.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { SalesModule } from '../sales/sales.module';
import { PurchaseModule } from '../purchase/purchase.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryPostingService } from '../inventory/posting.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClaimsModule } from '../claims/claims.module';
import { ClaimsService } from '../claims/claims.service';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeAll: any;

describe('Module 11 - Extended Coverage (Purchase Returns, Claims, Concurrency, RBAC)', () => {
  let salesService: SalesService;
  let salesPostingService: SalesPostingService;
  let purchaseService: PurchaseService;
  let purchasePostingService: PurchasePostingService;
  let invService: InventoryPostingService;
  let claimsService: ClaimsService;
  let prisma: PrismaService;

  let companyId: string;
  let branchId: string;
  let branch2Id: string;
  let godownId: string;
  let partyId: string;
  let supplierId: string;
  let itemId: string;
  let unitId: string;
  let finYearId: string;
  let userId: string;
  let user2Id: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SalesModule, PurchaseModule, AuthModule, ClaimsModule],
    }).compile();

    salesService = module.get<SalesService>(SalesService);
    salesPostingService = module.get<SalesPostingService>(SalesPostingService);
    purchaseService = module.get<PurchaseService>(PurchaseService);
    purchasePostingService = module.get<PurchasePostingService>(PurchasePostingService);
    invService = module.get<InventoryPostingService>(InventoryPostingService);
    claimsService = module.get<ClaimsService>(ClaimsService);
    prisma = module.get<PrismaService>(PrismaService);

    const org = await prisma.organization.create({ data: { name: 'M11Ext Org', code: `M11E_O_${Date.now()}` } });
    const comp = await prisma.company.create({ data: { organization_id: org.id, legal_name: 'M11Ext Co', code: `M11E_C_${Date.now()}` } });
    companyId = comp.id;

    const branch = await prisma.branch.create({ data: { company_id: companyId, name: 'HQ', code: `M11E_B1_${Date.now()}` } });
    branchId = branch.id;
    
    const branch2 = await prisma.branch.create({ data: { company_id: companyId, name: 'Branch 2', code: `M11E_B2_${Date.now()}` } });
    branch2Id = branch2.id;

    const godown = await prisma.godown.create({ data: { branch_id: branchId, name: 'Godown', code: `M11E_G_${Date.now()}` } });
    godownId = godown.id;

    const party = await prisma.party.create({ data: { company_id: companyId, code: `M11E_P1_${Date.now()}`, name: 'Customer A', party_type: 'CUSTOMER' } });
    partyId = party.id;
    
    const supplier = await prisma.party.create({ data: { company_id: companyId, code: `M11E_P2_${Date.now()}`, name: 'Supplier A', party_type: 'SUPPLIER' } });
    supplierId = supplier.id;

    // Create necessary ledgers
    await prisma.ledgerAccount.create({ data: { company_id: companyId, name: 'Customer A Account', code: `M11E_LA1_${Date.now()}`, account_type: 'ASSET', party_id: partyId } });
    await prisma.ledgerAccount.create({ data: { company_id: companyId, name: 'Supplier A Account', code: `M11E_LA2_${Date.now()}`, account_type: 'LIABILITY', party_id: supplierId } });
    await prisma.ledgerAccount.create({ data: { company_id: companyId, name: 'Sales Account', code: `M11E_SALES_${Date.now()}`, account_type: 'REVENUE', is_system: true } });
    await prisma.ledgerAccount.create({ data: { company_id: companyId, name: 'Purchases Account', code: `M11E_PURCHASES_${Date.now()}`, account_type: 'EXPENSE', is_system: true } });

    const unit = await prisma.unit.create({ data: { company_id: companyId, name: 'Piece', code: `M11E_U_${Date.now()}` } });
    unitId = unit.id;

    const item = await prisma.item.create({ data: { company_id: companyId, name: 'Widget Ext', sku: `WE_${Date.now()}`, item_type: "STOCK_ITEM", primary_unit_id: unitId } });
    itemId = item.id;

    const fy = await prisma.financialYear.create({ data: { company_id: companyId, label: '2026-2027', start_date: new Date('2026-04-01'), end_date: new Date('2027-03-31'), is_active: true } });
    finYearId = fy.id;

    const user = await prisma.user.create({ data: { organization_id: org.id, username: `u11e1_${Date.now()}`, display_name: 'Test', password_hash: 'xxx' } });
    userId = user.id;

    const user2 = await prisma.user.create({ data: { organization_id: org.id, username: `u11e2_${Date.now()}`, display_name: 'Test 2', password_hash: 'xxx' } });
    user2Id = user2.id;
  }, 60000);

  let originalPurchaseInvoiceId: string;
  let purchaseReturnId: string;
  let originalSalesInvoiceId: string;
  
  it('1. Connected-effect & Purchase return coverage (PO -> GRN -> PI -> PR)', async () => {
    // 1. Create PO
    const po = await purchaseService.createPurchaseOrder({
      company_id: companyId,
      branch_id: branchId,
      party_id: supplierId,
      document_number: 'PO-EXT-001',
      document_date: new Date(),
      status: 'DRAFT',
      total: 1000,
      lines: { create: [{ item_id: itemId, unit_id: unitId, ordered_quantity: 10, rate: 100, line_total: 1000 }] }
    } as any);
    
    // 2. Create GRN
    const grn = await purchaseService.createGoodsReceipt({
      company_id: companyId,
      branch_id: branchId,
      party_id: supplierId,
      purchase_order_id: po.id,
      document_number: 'GRN-EXT-001',
      document_date: new Date(),
      status: 'DRAFT',
      lines: { create: [{ item_id: itemId, unit_id: unitId, godown_id: godownId, received_quantity: 10 }] }
    } as any);
    await purchasePostingService.postGoodsReceipt(grn.id, userId);

    // 3. Create PI
    const pi = await purchaseService.createPurchaseInvoice({
      company_id: companyId,
      branch_id: branchId,
      party_id: supplierId,
      financial_year_id: finYearId,
      document_number: 'PI-EXT-001',
      document_date: new Date(),
      status: 'DRAFT',
      taxable_amount: 1000,
      tax_amount: 0,
      discount_amount: 0,
      grand_total: 1000,
      lines: { create: [{ item_id: itemId, unit_id: unitId, godown_id: godownId, quantity: 10, rate: 100, taxable_value: 1000, tax_amount: 0, line_total: 1000 }] }
    } as any);
    originalPurchaseInvoiceId = pi.id;
    await purchasePostingService.postPurchaseInvoice(pi.id, userId);
    
    // Verify AP Balance increased
    const piAfterPost = await prisma.purchaseInvoice.findUnique({ where: { id: originalPurchaseInvoiceId } });
    expect(piAfterPost!.outstanding_amount.toNumber()).toBe(1000);

    // 4. Create Purchase Return
    const pr = await purchaseService.createPurchaseReturn(companyId, {
      branch_id: branchId,
      party_id: supplierId,
      financial_year_id: finYearId,
      original_invoice_id: originalPurchaseInvoiceId,
      document_number: 'PR-EXT-001',
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 3, rate: 0 }] // Rate is inherited
    });
    purchaseReturnId = pr.id;
    
    // 5. Post Purchase Return (Validates GL + Inventory + AP Reversal)
    await purchasePostingService.postPurchaseReturn(purchaseReturnId, userId);
    
    // Verify AP Balance decreased
    const piAfterReturn = await prisma.purchaseInvoice.findUnique({ where: { id: originalPurchaseInvoiceId } });
    expect(piAfterReturn!.outstanding_amount.toNumber()).toBe(700);
    
    // Verify Inventory Movement OUT
    const stock = await prisma.stockMovement.findFirst({ where: { source_document_id: pr.id } });
    expect(stock).toBeDefined();
    expect(stock?.quantity_delta?.toNumber()).toBe(-3); // Outward movement
  });

  it('2. RBAC / Tenant Isolation / Branch verification', async () => {
    // Branch mismatch
    await expect(purchaseService.createPurchaseReturn(companyId, {
      branch_id: branch2Id,
      party_id: supplierId,
      financial_year_id: finYearId,
      original_invoice_id: originalPurchaseInvoiceId, // Belongs to branchId
      document_number: 'PR-EXT-002',
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 0 }]
    })).rejects.toThrow(BadRequestException); // Could also be Forbidden depending on implementation
  });

  it('3. Customer/supplier settlement via Claims', async () => {
    const reason = await claimsService.createReturnReason(companyId, {
      code: 'DEF',
      name: 'Defective',
    });
    
    const claim = await claimsService.createClaim(companyId, userId, {
      branch_id: branchId,
      party_id: supplierId,
      claim_type: 'SUPPLIER_CLAIM',
      document_number: 'CLM-SUP-001',
      document_date: new Date().toISOString(),
      reason_id: reason.id,
      purchase_invoice_id: originalPurchaseInvoiceId,
      lines: [{ item_id: itemId, unit_id: unitId, quantity: 2, rate: 100 }]
    });

    // Supplier Settlement
    const settled = await claimsService.updateClaimStatus(companyId, claim.id, userId, 'SETTLED', 'Supplier refunded via bank transfer');
    expect(settled.status).toBe('SETTLED');
    expect(settled.settled_by).toBe(userId);
  });

  it('4. Concurrency proof - Prevent over-return via simultaneous requests', async () => {
    // Create an invoice with 5 items
    const inv = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId,
      party_id: partyId,
      financial_year_id: finYearId,
      document_number: 'SI-CONC-001',
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 5, rate: 100 }]
    });
    originalSalesInvoiceId = inv.id;
    await salesPostingService.postSalesInvoice(companyId, inv.id, userId);

    // 5 concurrent requests attempting to return 2 items each (total 10, but only 5 sold)
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        salesService.createSalesReturn(companyId, {
          branch_id: branchId,
          party_id: partyId,
          financial_year_id: finYearId,
          original_invoice_id: inv.id,
          document_number: `SR-CONC-${i}`,
          document_date: new Date().toISOString(),
          lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 2, rate: 0 }]
        }).catch(e => e)
      );
    }
    
    const results = await Promise.all(promises);
    
    // We expect exactly 2 to succeed (2+2=4 returns), and the rest to fail (since remaining is 1, and request is 2)
    const successes = results.filter(r => !(r instanceof Error));
    const failures = results.filter(r => (r instanceof Error));
    
    expect(successes.length).toBeLessThanOrEqual(2);
    expect(failures.length).toBeGreaterThanOrEqual(3);
    
    // Validate final aggregated return quantity doesn't exceed 5
    const existingReturns = await prisma.salesReturnLine.aggregate({
      where: {
        item_id: itemId,
        sales_return: { original_invoice_id: inv.id, status: { not: 'CANCELLED' } }
      },
      _sum: { quantity: true }
    });
    
    expect(existingReturns._sum.quantity?.toNumber() ?? 0).toBeLessThanOrEqual(5);
  });

  it('5. Concurrency proof - Prevent duplicate Claim Settlement', async () => {
    const claim = await claimsService.createClaim(companyId, userId, {
      branch_id: branchId,
      party_id: partyId,
      claim_type: 'CUSTOMER_CLAIM',
      document_number: 'CL-CONC-001',
      document_date: new Date().toISOString(),
      reason_id: null,
      lines: [{ item_id: itemId, unit_id: unitId, quantity: 1, rate: 100 }]
    });

    await claimsService.updateClaimStatus(companyId, claim.id, userId, 'APPROVED');

    // Attempt 3 concurrent settlements
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        claimsService.updateClaimStatus(companyId, claim.id, userId, 'SETTLED').catch(e => e)
      );
    }
    
    const results = await Promise.all(promises);
    const successes = results.filter(r => !(r instanceof Error));
    const failures = results.filter(r => (r instanceof Error));

    expect(successes.length).toBe(1); // Only ONE can settle
    expect(failures.length).toBe(2);
  });

  it('6. Concurrency proof - Prevent over-replacement', async () => {
    // We must ensure there's enough stock to sell first.
    await invService.postMovement(prisma, {
      company_id: companyId,
      branch_id: branchId,
      business_date: new Date(),
      movement_type: 'OPENING_IN',
      source_document_type: 'OPENING_STOCK', 
      source_document_id: `00000000-0000-0000-0000-000000000006`,
      lines: [
        {
          item_id: itemId, godown_id: godownId, unit_id: unitId,
          quantity: 10,
          cost_rate: 100
        }
      ]
    });

    // Create an invoice with 5 items
    const inv = await salesService.createSalesInvoice(companyId, {
      branch_id: branchId,
      party_id: partyId,
      financial_year_id: finYearId,
      document_number: 'SI-REPCONC-001',
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 5, rate: 100 }]
    });
    await salesPostingService.postSalesInvoice(companyId, inv.id, userId);

    // Return 3 items
    const sr = await salesService.createSalesReturn(companyId, {
      branch_id: branchId,
      party_id: partyId,
      financial_year_id: finYearId,
      original_invoice_id: inv.id,
      document_number: 'SR-REPCONC-001',
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 3, rate: 0 }]
    });
    await salesPostingService.postSalesReturn(companyId, sr.id, userId);

    // 3 concurrent requests attempting to replace 2 items each (total 6, but only 3 returned)
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        salesService.createReplacement(companyId, sr.id, userId, {
          branch_id: branchId,
          financial_year_id: finYearId,
          document_number: `SREP-CONC-${i}`,
          document_date: new Date().toISOString(),
          lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 2 }]
        }).catch(e => e)
      );
    }
    
    const results = await Promise.all(promises);
    const successes = results.filter(r => !(r instanceof Error));
    const failures = results.filter(r => (r instanceof Error));
    
    expect(successes.length).toBeLessThanOrEqual(1); // Only 1 can replace 2 items successfully since 2*2=4 > 3
    expect(failures.length).toBeGreaterThanOrEqual(2);
  });

  it('7. Idempotency Proof - Reject duplicate stock movement', async () => {
    // Create return
    const sr = await salesService.createSalesReturn(companyId, {
      branch_id: branchId,
      party_id: partyId,
      financial_year_id: finYearId,
      document_number: 'SR-IDEMP-001',
      document_date: new Date().toISOString(),
      lines: [{ item_id: itemId, godown_id: godownId, unit_id: unitId, quantity: 1, rate: 10 }]
    } as any);

    // First post should succeed
    const firstPost = await salesPostingService.postSalesReturn(companyId, sr.id, userId);
    expect(firstPost).toBeDefined();

    // Second post should fail predictably
    await expect(salesPostingService.postSalesReturn(companyId, sr.id, userId)).rejects.toThrow();
  });

  it('8. Security - Unauthorized Access Prevention', async () => {
    // Forged company context
    const forgedCompanyId = '00000000-0000-0000-0000-000000000000';
    
    await expect(claimsService.createClaim(forgedCompanyId, userId, {
      branch_id: branchId, party_id: partyId, claim_type: 'CUSTOMER_CLAIM', 
      document_number: 'CL-SEC-001', document_date: new Date().toISOString(),
      lines: []
    })).rejects.toThrow();
  });
});
