import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { PrismaService } from '../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { SalesService } from '../sales/sales.service';
import { SalesPostingService } from '../sales/posting.service';
import { SalesConversionService } from '../sales/conversion.service';
import { PosModule } from '../pos/pos.module';
import { PosService } from '../pos/pos.service';
import { PricingModule } from './pricing.module';
import { PricingEngineService } from './pricing-engine.service';
import { PricingService } from './pricing.service';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryPostingService } from '../inventory/posting.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Module 13 — Pricing & Schemes Production Forensic Verification Suite', () => {
  let pricingEngine: PricingEngineService;
  let pricingService: PricingService;
  let salesService: SalesService;
  let salesPostingService: SalesPostingService;
  let salesConversionService: SalesConversionService;
  let posService: PosService;
  let prisma: PrismaService;

  let companyId: string;
  let foreignCompanyId: string;
  let branchId: string;
  let godownId: string;
  let unitId: string;
  let financialYearId: string;
  let userId: string;
  let customerAId: string;
  let customerBId: string;
  let itemAId: string;
  let itemBId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        InventoryModule,
        PricingModule,
        SalesModule,
        PosModule,
      ],
    }).compile();

    pricingEngine = module.get<PricingEngineService>(PricingEngineService);
    pricingService = module.get<PricingService>(PricingService);
    salesService = module.get<SalesService>(SalesService);
    salesPostingService = module.get<SalesPostingService>(SalesPostingService);
    salesConversionService = module.get<SalesConversionService>(SalesConversionService);
    posService = module.get<PosService>(PosService);
    prisma = module.get<PrismaService>(PrismaService);

    // ── Setup Test Data ───────────────────────────────────────────────────
    const timestamp = Date.now();
    const org = await prisma.organization.create({
      data: { name: `Pricing Org ${timestamp}`, code: `PORG_${timestamp}` },
    });

    const company = await prisma.company.create({
      data: {
        organization_id: org.id,
        code: `PCMP_${timestamp}`,
        legal_name: `Pricing Company ${timestamp}`,
      },
    });
    companyId = company.id;

    const foreignCompany = await prisma.company.create({
      data: {
        organization_id: org.id,
        code: `FCMP_${timestamp}`,
        legal_name: `Foreign Pricing Company ${timestamp}`,
      },
    });
    foreignCompanyId = foreignCompany.id;

    const branch = await prisma.branch.create({
      data: {
        company_id: companyId,
        code: `PBR_${timestamp}`,
        name: `Pricing Branch ${timestamp}`,
      },
    });
    branchId = branch.id;

    const godown = await prisma.godown.create({
      data: {
        branch_id: branchId,
        code: `PGD_${timestamp}`,
        name: `Pricing Godown ${timestamp}`,
      },
    });
    godownId = godown.id;

    const unit = await prisma.unit.create({
      data: {
        company_id: companyId,
        code: `NOS_${timestamp}`,
        name: 'Numbers',
      },
    });
    unitId = unit.id;

    const fy = await prisma.financialYear.create({
      data: {
        company_id: companyId,
        label: `FY2026_${timestamp}`,
        start_date: new Date('2026-04-01'),
        end_date: new Date('2027-03-31'),
        is_active: true,
      },
    });
    financialYearId = fy.id;

    const user = await prisma.user.create({
      data: {
        organization_id: org.id,
        username: `pricing_admin_${timestamp}`,
        password_hash: 'hashed',
        display_name: 'Pricing Admin',
      },
    });
    userId = user.id;

    // Customers
    const partyA = await prisma.party.create({
      data: {
        company_id: companyId,
        code: `CUSTA_${timestamp}`,
        name: 'VIP Wholesale Customer A',
        party_type: 'CUSTOMER',
      },
    });
    customerAId = partyA.id;

    const partyB = await prisma.party.create({
      data: {
        company_id: companyId,
        code: `CUSTB_${timestamp}`,
        name: 'Regular Retail Customer B',
        party_type: 'CUSTOMER',
      },
    });
    customerBId = partyB.id;

    // Items
    const itemA = await prisma.item.create({
      data: {
        company_id: companyId,
        sku: `ITEM_PRICED_A_${timestamp}`,
        name: 'Premium Widget A',
        item_type: "STOCK_ITEM",
        primary_unit_id: unitId,
        default_sale_rate: 100,
        mrp: 120,
        purchase_rate: 60,
      },
    });
    itemAId = itemA.id;

    const itemB = await prisma.item.create({
      data: {
        company_id: companyId,
        sku: `ITEM_PRICED_B_${timestamp}`,
        name: 'Standard Widget B',
        item_type: "STOCK_ITEM",
        primary_unit_id: unitId,
        default_sale_rate: 50,
        mrp: 60,
        purchase_rate: 30,
      },
    });
    itemBId = itemB.id;

    // Ensure ledgers exist for posting
    await prisma.ledgerAccount.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        code: `REV_${timestamp}`,
        name: 'Sales Revenue',
        account_type: 'INCOME',
        normal_balance: 'CREDIT',
        is_active: true,
      },
    });
    await prisma.ledgerAccount.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        party_id: customerAId,
        code: `AR_A_${timestamp}`,
        name: 'Accounts Receivable - Customer A',
        account_type: 'ASSET',
        normal_balance: 'DEBIT',
        is_active: true,
      },
    });
    await prisma.ledgerAccount.create({
      data: {
        company_id: companyId,
        branch_id: branchId,
        party_id: customerBId,
        code: `AR_B_${timestamp}`,
        name: 'Customer B Receivable',
        account_type: 'ASSET',
        normal_balance: 'DEBIT',
        is_active: true,
      },
    });

    // Provide initial stock for posting tests
    const invService = module.get<InventoryPostingService>(InventoryPostingService);
    await invService.postMovement(prisma, {
      company_id: companyId,
      branch_id: branchId,
      movement_type: 'OPENING_IN',
      business_date: new Date(),
      source_document_type: 'OPENING',
      source_document_id: randomUUID(),
      lines: [
        {
          item_id: itemAId,
          godown_id: godownId,
          quantity: 1000,
          unit_id: unitId,
          source_line_id: randomUUID(),
        },
        {
          item_id: itemBId,
          godown_id: godownId,
          quantity: 1000,
          unit_id: unitId,
          source_line_id: randomUUID(),
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    const cIds = [companyId, foreignCompanyId].filter(Boolean);
    if (cIds.length === 0) return;

    await prisma.auditLog.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.pricingTrace.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.promotionScheme.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.customerItemPrice.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.priceListItem.deleteMany({ where: { price_list: { company_id: { in: cIds } } } });
    await prisma.priceList.deleteMany({ where: { company_id: { in: cIds } } });

    await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice: { company_id: { in: cIds } } } });
    await prisma.salesInvoice.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.salesOrderLine.deleteMany({ where: { sales_order: { company_id: { in: cIds } } } });
    await prisma.salesOrder.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.salesQuotationLine.deleteMany({ where: { sales_quotation: { company_id: { in: cIds } } } });
    await prisma.salesQuotation.deleteMany({ where: { company_id: { in: cIds } } });

    await prisma.deliveryChallanLine.deleteMany({ where: { delivery_challan: { company_id: { in: cIds } } } });
    await prisma.deliveryChallan.deleteMany({ where: { company_id: { in: cIds } } });

    await prisma.stockMovement.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.stockBalanceProjection.deleteMany({ where: { company_id: { in: cIds } } });

    await prisma.billAllocation.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.voucherLine.deleteMany({ where: { voucher: { company_id: { in: cIds } } } });
    await prisma.voucher.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.ledgerAccount.deleteMany({ where: { company_id: { in: cIds } } });

    await prisma.party.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.item.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.unit.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.financialYear.deleteMany({ where: { company_id: { in: cIds } } });
    await prisma.godown.deleteMany({ where: { branch: { company_id: { in: cIds } } } });
    await prisma.branch.deleteMany({ where: { company_id: { in: cIds } } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    const comp = await prisma.company.findUnique({ where: { id: companyId } });
    if (comp) {
      await prisma.company.deleteMany({ where: { id: { in: cIds } } });
      await prisma.organization.delete({ where: { id: comp.organization_id } });
    }
  });

  // =========================================================================
  // 1. FOUNDATION TESTS
  // =========================================================================

  describe('1. Foundation & Master Data', () => {
    it('1.1 should create a Price List with company isolation and priority', async () => {
      const pl = await pricingService.createPriceList(companyId, {
        code: 'WHOLESALE-2026',
        name: 'Wholesale Price List',
        priority: 10,
        currency: 'INR',
      });

      expect(pl).toBeDefined();
      expect(pl.code).toBe('WHOLESALE-2026');
      expect(pl.company_id).toBe(companyId);
      expect(pl.priority).toBe(10);
      expect(pl.is_active).toBe(true);
    });

    it('1.2 should add item rate and quantity slabs to a price list', async () => {
      const pl = await prisma.priceList.findFirst({
        where: { company_id: companyId, code: 'WHOLESALE-2026' },
      });

      // Slab 1: 0 - 9 units @ 95
      const itemSlab1 = await pricingService.addPriceListItem(companyId, pl!.id, {
        item_id: itemAId,
        rate: 95,
        min_qty: 0,
        max_qty: 9,
      });

      // Slab 2: 10+ units @ 90
      const itemSlab2 = await pricingService.addPriceListItem(companyId, pl!.id, {
        item_id: itemAId,
        rate: 90,
        min_qty: 10,
        max_qty: undefined,
      });

      expect(itemSlab1.rate.toNumber()).toBe(95);
      expect(itemSlab1.min_qty.toNumber()).toBe(0);
      expect(itemSlab1.max_qty?.toNumber()).toBe(9);

      expect(itemSlab2.rate.toNumber()).toBe(90);
      expect(itemSlab2.min_qty.toNumber()).toBe(10);
      expect(itemSlab2.max_qty).toBeNull();
    });

    it('1.3 should configure a Customer-specific rate override', async () => {
      const cr = await pricingService.createCustomerRate(companyId, {
        party_id: customerAId,
        item_id: itemAId,
        rate: 85,
        min_qty: 0,
      });

      expect(cr).toBeDefined();
      expect(cr.party_id).toBe(customerAId);
      expect(cr.rate.toNumber()).toBe(85);
    });

    it('1.4 should fallback to Item Master rate when no price list or override applies', async () => {
      // Item B has no price list items or customer overrides configured
      const res = await pricingEngine.resolveItemPrice(companyId, null, itemBId, null, 1);
      expect(res.basePrice.toNumber()).toBe(50); // Item.default_sale_rate = 50
      expect(res.precedenceReason).toBe('ITEM_MASTER_FALLBACK');
    });
  });

  // =========================================================================
  // 2. PRECEDENCE TESTS
  // =========================================================================

  describe('2. Deterministic Price Precedence Hierarchy', () => {
    it('2.1 Customer-specific rate beats Price List rate and Item Master rate', async () => {
      // Customer A has override = 85. Price List = 95/90. Item Master = 100.
      const res = await pricingEngine.resolveItemPrice(companyId, customerAId, itemAId, null, 5);
      expect(res.resolvedRate.toNumber()).toBe(85);
      expect(res.precedenceReason).toBe('CUSTOMER_SPECIFIC_RATE');
      expect(res.customerRateId).toBeDefined();
    });

    it('2.2 Price List rate beats Item Master rate for non-override customer', async () => {
      // Customer B has no customer rate. Selected price list provides 95.
      const res = await pricingEngine.resolveItemPrice(companyId, customerBId, itemAId, null, 5);
      expect(res.resolvedRate.toNumber()).toBe(95);
      expect(res.precedenceReason).toBe('PRICE_LIST_RATE');
      expect(res.priceListId).toBeDefined();
    });

    it('2.3 Quantity slab selection matches applicable quantity tier', async () => {
      // Customer B with qty = 15 should match Slab 2 (10+ units) @ 90
      const res = await pricingEngine.resolveItemPrice(companyId, customerBId, itemAId, null, 15);
      expect(res.resolvedRate.toNumber()).toBe(90);
      expect(res.precedenceReason).toBe('PRICE_LIST_RATE');
    });
  });

  // =========================================================================
  // 3. QUANTITY SLABS & BOUNDARY TESTS
  // =========================================================================

  describe('3. Quantity Slabs & Boundary Values', () => {
    it('3.1 should match exact lower boundary (qty = 10 -> rate 90)', async () => {
      const res = await pricingEngine.resolveItemPrice(companyId, customerBId, itemAId, null, 10);
      expect(res.resolvedRate.toNumber()).toBe(90);
    });

    it('3.2 should match exact upper boundary (qty = 9 -> rate 95)', async () => {
      const res = await pricingEngine.resolveItemPrice(companyId, customerBId, itemAId, null, 9);
      expect(res.resolvedRate.toNumber()).toBe(95);
    });

    it('3.3 should reject overlapping quantity slabs', async () => {
      const pl = await prisma.priceList.findFirst({
        where: { company_id: companyId, code: 'WHOLESALE-2026' },
      });

      // Existing slabs: [0, 9] and [10, ∞]
      // Try to create overlapping slab [5, 15]
      await expect(
        pricingService.addPriceListItem(companyId, pl!.id, {
          item_id: itemAId,
          rate: 88,
          min_qty: 5,
          max_qty: 15,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('3.4 should reject zero or negative quantity for pricing resolution', async () => {
      await expect(pricingEngine.resolveItemPrice(companyId, customerBId, itemAId, null, 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(pricingEngine.resolveItemPrice(companyId, customerBId, itemAId, null, -5)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================================
  // 4. BUY X GET Y & FREE QUANTITY
  // =========================================================================

  describe('4. Buy X Get Y & Free Quantity Evaluation', () => {
    let schemeId: string;

    beforeAll(async () => {
      // Create Buy 10 Get 1 Free scheme
      const scheme = await pricingService.createPromotionScheme(companyId, {
        code: 'BXGY-WIDGET-A',
        name: 'Buy 10 Premium Widget A Get 1 Free',
        scheme_type: 'BUY_X_GET_Y',
        item_id: itemAId,
        buy_quantity: 10,
        get_quantity: 1,
        priority: 5,
        stackable: false,
      });
      schemeId = scheme.id;
    });

    it('4.1 exact qualifying threshold (buy 10 -> get 1 free)', async () => {
      const lineRes = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemAId,
        quantity: 10,
      });

      expect(lineRes.originalQuantity.toNumber()).toBe(10);
      expect(lineRes.chargedQuantity.toNumber()).toBe(10);
      expect(lineRes.freeQuantity.toNumber()).toBe(1);
      expect(lineRes.promotionCode).toBe('BXGY-WIDGET-A');
    });

    it('4.2 multiples of threshold (buy 25 -> get 2 free)', async () => {
      const lineRes = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemAId,
        quantity: 25,
      });

      expect(lineRes.chargedQuantity.toNumber()).toBe(25);
      expect(lineRes.freeQuantity.toNumber()).toBe(2); // 25 / 10 = 2 multiples
    });

    it('4.3 partial qualification (buy 9 -> 0 free)', async () => {
      const lineRes = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemAId,
        quantity: 9,
      });

      expect(lineRes.chargedQuantity.toNumber()).toBe(9);
      expect(lineRes.freeQuantity.toNumber()).toBe(0);
    });

    it('4.4 should reject scheme with buy_quantity <= 0', async () => {
      await expect(
        pricingService.createPromotionScheme(companyId, {
          code: 'INVALID-SCHEME',
          name: 'Invalid Scheme',
          scheme_type: 'BUY_X_GET_Y',
          buy_quantity: 0,
          get_quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 5. ITEM & BILL DISCOUNTS
  // =========================================================================

  describe('5. Item & Bill Discounts', () => {
    it('5.1 item percentage discount calculation', async () => {
      // Rate = 95, Qty = 2, Gross = 190. Discount = 10% -> 19. Net = 171.
      const lineRes = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemAId,
        quantity: 2,
        overrideDiscountPercent: 10,
      });

      expect(lineRes.discountAmount.toNumber()).toBe(19);
      expect(lineRes.taxableValue.toNumber()).toBe(171);
      expect(lineRes.lineTotal.toNumber()).toBe(171);
    });

    it('5.2 item fixed discount amount cannot exceed gross price (no negative selling price)', async () => {
      // Gross = 95 * 1 = 95. Trying discount = 200 -> capped at 95.
      const lineRes = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemAId,
        quantity: 1,
        overrideDiscountAmount: 200,
      });

      expect(lineRes.discountAmount.toNumber()).toBe(95);
      expect(lineRes.taxableValue.toNumber()).toBe(0);
    });

    it('5.3 bill discount calculation on subtotal', async () => {
      const line1 = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemAId,
        quantity: 1,
      }); // 95
      const line2 = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemBId,
        quantity: 1,
      }); // 50

      const billRes = pricingEngine.calculateBillPricing(companyId, [line1, line2], {
        discountPercent: 10, // 10% of 145 = 14.50
      });

      expect(billRes.subtotal.toNumber()).toBe(145);
      expect(billRes.billDiscountAmount.toNumber()).toBe(14.5);
      expect(billRes.taxableAmount.toNumber()).toBe(130.5);
    });

    it('5.4 should reject bill discount exceeding bill subtotal', async () => {
      const line = await pricingEngine.calculateLinePricing(companyId, customerBId, {
        itemId: itemAId,
        quantity: 1,
      }); // 95

      expect(() =>
        pricingEngine.calculateBillPricing(companyId, [line], {
          discountAmount: 150, // Exceeds 95
        }),
      ).toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // 6. APPLIED RULE TRACE (CRITICAL)
  // =========================================================================

  describe('6. Applied Rule Trace Lineage & Auditability', () => {
    it('6.1 generates complete, reconstructable immutable pricing trace snapshot', async () => {
      const lineRes = await pricingEngine.calculateLinePricing(companyId, customerAId, {
        itemId: itemAId,
        quantity: 10,
      });

      const trace = lineRes.pricingTrace;
      expect(trace).toBeDefined();
      expect(trace.pricingEngineVersion).toBe('1.0.0');
      expect(trace.companyId).toBe(companyId);
      expect(trace.itemId).toBe(itemAId);
      expect(trace.precedenceReason).toBe('CUSTOMER_SPECIFIC_RATE');
      expect(trace.basePrice).toBe('85');
      expect(trace.resolvedRate).toBe('85');
      expect(trace.originalQuantity).toBe('10');
      expect(trace.chargedQuantity).toBe('10');
      expect(trace.freeQuantity).toBe('1'); // From active BXGY scheme
      expect(trace.appliedSequence.length).toBeGreaterThan(0);
      expect(trace.ruleDetails.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 7. HISTORICAL IMMUTABILITY
  // =========================================================================

  describe('7. Historical Pricing Immutability', () => {
    it('7.1 changing price lists does NOT alter historical invoices', async () => {
      // 1. Create a draft and post Sales Invoice on Day 1 at current rate (85)
      const invoice = await salesService.createSalesInvoice(companyId, {
        branch_id: branchId,
        party_id: customerAId,
        financial_year_id: financialYearId,
        document_number: `INV-HIST-${Date.now()}`,
        document_date: '2026-05-01',
        lines: [
          {
            item_id: itemAId,
            godown_id: godownId,
            unit_id: unitId,
            quantity: 1,
            rate: 85,
          },
        ],
      });

      await salesPostingService.postSalesInvoice(companyId, invoice.id, userId);

      const postedInvoiceBefore = await salesService.getSalesInvoice(companyId, invoice.id);
      expect(postedInvoiceBefore.lines[0].rate.toNumber()).toBe(85);
      expect(postedInvoiceBefore.grand_total.toNumber()).toBe(85);

      // 2. Modify customer rate and price list on Day 2 (increase to 150)
      const custRate = await prisma.customerItemPrice.findFirst({
        where: { party_id: customerAId, item_id: itemAId },
      });
      await pricingService.updateCustomerRate(companyId, custRate!.id, { rate: 150 });

      // 3. Re-read historical posted invoice - MUST REMAIN EXACTLY 85
      const postedInvoiceAfter = await salesService.getSalesInvoice(companyId, invoice.id);
      expect(postedInvoiceAfter.lines[0].rate.toNumber()).toBe(85);
      expect(postedInvoiceAfter.grand_total.toNumber()).toBe(85);
      expect(postedInvoiceAfter.lines[0].pricing_trace_json).toBeDefined();

      // Restore rate
      await pricingService.updateCustomerRate(companyId, custRate!.id, { rate: 85 });
    });
  });

  // =========================================================================
  // 8. SALES & CONNECTED BUSINESS-EFFECTS INTEGRATION
  // =========================================================================

  describe('8. Sales Integration & Connected Business Effects', () => {
    it('8.1 Sales Invoice creation propagates through existing SalesPostingService', async () => {
      const invoice = await salesService.createSalesInvoice(companyId, {
        branch_id: branchId,
        party_id: customerAId,
        financial_year_id: financialYearId,
        document_number: `INV-POST-${Date.now()}`,
        document_date: '2026-05-10',
        lines: [
          {
            item_id: itemAId,
            godown_id: godownId,
            unit_id: unitId,
            quantity: 10,
            rate: 85,
          },
        ],
      });

      // Post the invoice through authoritative SalesPostingService
      const posted = await salesPostingService.postSalesInvoice(companyId, invoice.id, userId);

      expect(posted.status).toBe('POSTED');

      // Verify stock movement was created by posting service (quantity 10)
      const stockMv = await prisma.stockMovement.findFirst({
        where: { source_document_id: invoice.id, movement_type: 'SALES_OUT' },
      });
      expect(stockMv).toBeDefined();

      // Verify accounting voucher was created by posting service
      const voucher = await prisma.voucher.findFirst({
        where: { source_document_id: invoice.id, source_document_type: 'SALES_INVOICE' },
      });
      expect(voucher).toBeDefined();

      // Verify pricing traces were stored
      const traces = await pricingService.getPricingTraces(companyId, 'SALES_INVOICE', invoice.id);
      expect(traces.length).toBeGreaterThan(0);
      expect(traces[0].resolved_rate.toNumber()).toBe(85);
    });
  });

  // =========================================================================
  // 9. POS INTEGRATION & PARITY
  // =========================================================================

  describe('9. POS Integration & Rate Parity', () => {
    it('9.1 POS sale resolves the same price and schemes as Sales Invoice', async () => {
      const posDocNum = `POS-${Date.now()}`;
      // In POS, for customerA and itemA with qty 1:
      // Customer A rate is 85.
      const posSale = await posService.postPosSale(companyId, userId, {
        branch_id: branchId,
        party_id: customerAId,
        document_date: '2026-05-15',
        lines: [
          {
            item_id: itemAId,
            godown_id: godownId,
            unit_id: unitId,
            quantity: 1,
            rate: 85,
          },
        ],
        payments: [
          {
            payment_method: 'CASH',
            amount: 85,
          },
        ],
      });

      expect(posSale.status).toBe('POSTED');
      expect(posSale.grand_total.toNumber()).toBe(85);
      expect(posSale.lines[0].rate.toNumber()).toBe(85);
      expect(posSale.lines[0].pricing_trace_json).toBeDefined();

      // Check pricing trace created for POS sale
      const traces = await pricingService.getPricingTraces(companyId, 'POS_SALE', posSale.id);
      expect(traces.length).toBe(1);
      expect(traces[0].final_line_amount.toNumber()).toBe(85);
    });
  });

  // =========================================================================
  // 10. ORDERS & CONVERSION INTEGRATION
  // =========================================================================

  describe('10. Order / Quotation Conversion Lineage', () => {
    it('10.1 Quotation -> Order -> Challan -> Invoice preserves historical pricing metadata and free quantities immutably', async () => {
      // 1. Create Quotation with 10 paid
      const quotation = await salesService.createSalesQuotation(companyId, {
        branch_id: branchId,
        party_id: customerAId,
        document_number: `QTN-CONV-${Date.now()}`,
        document_date: '2026-05-20',
        lines: [
          {
            item_id: itemAId,
            unit_id: unitId,
            quantity: 10,
            rate: 85,
          },
        ],
      });

      // Manually inject free_quantity and trace for conversion testing isolation
      await prisma.salesQuotationLine.updateMany({
        where: { sales_quotation_id: quotation.id },
        data: { 
          free_quantity: 2, 
          pricing_trace_json: JSON.stringify({ 
            pricingEngineVersion: '1.0.0',
            itemId: itemAId,
            basePrice: 85,
            resolvedRate: 85,
            chargedQuantity: 10, 
            freeQuantity: 2, 
            originalQuantity: 10, 
            discountPercent: 0,
            discountAmount: 0, 
            finalUnitPrice: 85,
            finalLineAmount: 850 
          }) 
        }
      });

      await salesService.updateQuotationStatus(companyId, quotation.id, 'ACCEPTED', userId);

      // Mutate price globally to prove conversion does NOT invoke pricing engine
      await prisma.item.update({ where: { id: itemAId }, data: { default_sale_rate: 9999 } });

      // 2. Convert to Sales Order
      const so = await salesConversionService.convertQuotationToSalesOrder(companyId, quotation.id, userId, {
        document_number: `SO-FROM-QTN-${Date.now()}`,
      });

      expect(so.status).toBe('DRAFT');
      expect(so.lines[0].rate.toNumber()).toBe(85);
      expect(so.lines[0].free_quantity.toNumber()).toBe(2);
      expect(so.lines[0].pricing_trace_json).toBeTruthy();

      const soTraces = await prisma.pricingTrace.findMany({ where: { document_type: 'SALES_ORDER', document_id: so.id } });
      expect(soTraces.length).toBe(1);
      expect(soTraces[0].free_quantity.toNumber()).toBe(2);
      expect(soTraces[0].charged_quantity.toNumber()).toBe(10);

      await salesService.confirmSalesOrder(companyId, so.id, userId);

      // 3. Convert Partial SO -> DC (5 paid qty)
      const dc = await salesConversionService.convertSalesOrderToDeliveryChallan(companyId, so.id, userId, {
        lines: [
          { order_line_id: so.lines[0].id, godown_id: godownId, quantity: 5 }
        ]
      });

      expect(dc.lines[0].dispatched_quantity.toNumber()).toBe(5);
      expect(dc.lines[0].free_quantity.toNumber()).toBe(1); // Proportional 5/10 * 2 = 1

      await salesPostingService.postDeliveryChallan(companyId, dc.id, userId);

      // 4. Convert DC -> Invoice
      const inv = await salesConversionService.convertDeliveryChallanToSalesInvoice(companyId, dc.id, userId, {});

      expect(inv.lines[0].quantity.toNumber()).toBe(5);
      expect(inv.lines[0].free_quantity.toNumber()).toBe(1);
      expect(inv.lines[0].rate.toNumber()).toBe(85);
      expect(inv.lines[0].line_total.toNumber()).toBe(425); // 5 * 85

      const invTraces = await prisma.pricingTrace.findMany({ where: { document_type: 'SALES_INVOICE', document_id: inv.id } });
      expect(invTraces.length).toBe(1);
      expect(invTraces[0].free_quantity.toNumber()).toBe(1);
      expect(invTraces[0].charged_quantity.toNumber()).toBe(5);
      expect(invTraces[0].final_line_amount.toNumber()).toBe(425);

      // Revert the global price list mutation
      await prisma.item.update({ where: { id: itemAId }, data: { default_sale_rate: 100 } });
    });
  });

  // =========================================================================
  // 11. SECURITY & TENANT ISOLATION
  // =========================================================================

  describe('11. Security & Multi-Tenant Isolation', () => {
    it('11.1 Company 2 cannot read or modify Company 1 price lists', async () => {
      const pl1 = await prisma.priceList.findFirst({
        where: { company_id: companyId, code: 'WHOLESALE-2026' },
      });

      await expect(pricingService.getPriceListById(foreignCompanyId, pl1!.id)).rejects.toThrow(
        NotFoundException,
      );

      await expect(
        pricingService.updatePriceList(foreignCompanyId, pl1!.id, { name: 'Hacked Price List' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('11.2 Cross-tenant customer rate lookups return empty', async () => {
      const rates = await pricingService.getCustomerRates(foreignCompanyId, customerAId);
      expect(rates.length).toBe(0);
    });
  });

  // =========================================================================
  // 12. CONCURRENCY & IDEMPOTENCY
  // =========================================================================

  describe('12. Concurrency & Idempotency Safeguards', () => {
    it('12.1 rejects concurrent creation of duplicate price list codes within same company', async () => {
      const duplicateCode = `PL-CONC-${Date.now()}`;
      await pricingService.createPriceList(companyId, {
        code: duplicateCode,
        name: 'First Price List',
      });

      await expect(
        pricingService.createPriceList(companyId, {
          code: duplicateCode,
          name: 'Conflicting Duplicate Price List',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('12.2 Price evaluation preview produces zero database side-effects', async () => {
      const stockBefore = await prisma.stockMovement.count();
      const vouchersBefore = await prisma.voucher.count();
      const invoicesBefore = await prisma.salesInvoice.count();

      const preview = await pricingService.evaluatePricingPreview(companyId, {
        party_id: customerAId,
        lines: [{ item_id: itemAId, quantity: 5 }],
      });

      expect(preview.subtotal.toNumber()).toBeGreaterThan(0);

      const stockAfter = await prisma.stockMovement.count();
      const vouchersAfter = await prisma.voucher.count();
      const invoicesAfter = await prisma.salesInvoice.count();

      expect(stockAfter).toBe(stockBefore);
      expect(vouchersAfter).toBe(vouchersBefore);
      expect(invoicesAfter).toBe(invoicesBefore);
    });
  });

  // =========================================================================
  // 13. NO DUPLICATE TRUTH GUARANTEE
  // =========================================================================

  describe('13. No Duplicate Truth & Architectural Boundary Invariants', () => {
    it('13.1 Pricing engine does not directly mutate StockMovement or LedgerAccount tables', async () => {
      // Run multiple calculations
      await pricingEngine.calculateLinePricing(companyId, customerAId, {
        itemId: itemAId,
        quantity: 50,
      });

      // Assert no stock movements exist with source_document_type = 'PRICING_ENGINE'
      const orphanMovements = await prisma.stockMovement.findMany({
        where: { source_document_type: 'PRICING_ENGINE' },
      });
      expect(orphanMovements.length).toBe(0);

      // Assert no vouchers exist with source_document_type = 'PRICING_ENGINE'
      const orphanVouchers = await prisma.voucher.findMany({
        where: { source_document_type: 'PRICING_ENGINE' },
      });
      expect(orphanVouchers.length).toBe(0);
    });
  });

  // =========================================================================
  // 14. PHASE 13-C: ALTERNATE FREE ITEM (BUY A GET B)
  // =========================================================================
  describe('14. Phase 13-C Alternate Free Item Integration', () => {
    let alternateSchemeId: string;

    beforeAll(async () => {
      // Create a scheme: Buy 10 Item A, Get 2 Item B free
      const scheme = await prisma.promotionScheme.create({
        data: {
          company_id: companyId,
          code: `B10A_G2B_${Date.now()}`,
          name: 'Buy 10 A Get 2 B Free',
          scheme_type: 'BUY_X_GET_Y',
          item_id: itemAId,
          buy_quantity: 10,
          get_quantity: 2,
          free_item_id: itemBId, // ALTERNATE free item
          is_active: true,
          status: 'ACTIVE',
          stackable: true,
          priority: 10, // Ensure it evaluates before the global scheme
        },
      });
      alternateSchemeId = scheme.id;
    });

    afterAll(async () => {
      await prisma.promotionScheme.delete({ where: { id: alternateSchemeId } });
    });

    it('14.1 PricingEngine returns alternate free item as a separate promotional line', async () => {
      const res = await pricingEngine.calculateLinePricing(companyId, customerAId, {
        itemId: itemAId,
        quantity: 15,
      });

      expect(res.itemId).toBe(itemAId);
      // Same-item free quantity should be 1 because of global Buy 10 Get 1 scheme
      expect(Number(res.freeQuantity)).toBe(1); 

      expect(res.promotionalLines).toBeDefined();
      expect(res.promotionalLines?.length).toBe(1);
      
      const pLine = res.promotionalLines![0];
      expect(pLine.itemId).toBe(itemBId);
      // Buy 10 get 2 -> for 15, gets 1 multiple (10) -> 2 free
      expect(Number(pLine.freeQuantity)).toBe(2);
      expect(Number(pLine.resolvedRate)).toBe(0);
      expect(pLine.pricingTrace.itemId).toBe(itemBId);
    });

    it('14.2 SalesOrder creation adds alternate free item as a discrete zero-cost line', async () => {
      const order = await salesService.createSalesOrder(companyId, {
        branch_id: branchId,
        party_id: customerAId,
        document_number: `SO_ALT_${Date.now()}`,
        document_date: new Date().toISOString(),
        lines: [
          {
            item_id: itemAId,
            unit_id: unitId,
            ordered_quantity: 10, // should trigger 2 Item B
          }
        ]
      });

      expect(order.lines.length).toBe(2);
      
      const paidLine = order.lines.find(l => l.item_id === itemAId);
      const freeLine = order.lines.find(l => l.item_id === itemBId);
      
      expect(paidLine).toBeDefined();
      expect(Number(paidLine!.ordered_quantity)).toBe(10);
      
      expect(freeLine).toBeDefined();
      expect(Number(freeLine!.ordered_quantity)).toBe(2); // The alternate quantity
      expect(Number(freeLine!.rate)).toBe(0);
      expect(Number(freeLine!.line_total)).toBe(0);
      
      await prisma.salesOrderLine.deleteMany({ where: { sales_order_id: order.id } });
      await prisma.pricingTrace.deleteMany({ where: { document_id: order.id } });
      await prisma.salesOrder.delete({ where: { id: order.id } });
    });

    it('14.3 POS integration creates free line and appropriately deducts inventory', async () => {
      // First resolve the price to determine the correct payment amount
      const pricingResult = await pricingEngine.calculateLinePricing(
        companyId,
        customerAId,
        { itemId: itemAId, quantity: 10 },
        { branchId, documentDate: new Date().toISOString(), isPos: true },
      );
      const expectedTotal = pricingResult.taxableValue;

      const randomPosCode = `POS_ALT_${Date.now()}`;
      const result = await posService.postPosSale(companyId, userId, {
        branch_id: branchId,
        party_id: customerAId,
        document_number: randomPosCode,
        document_date: new Date().toISOString(),
        lines: [
          {
            item_id: itemAId,
            unit_id: unitId,
            godown_id: godownId,
            quantity: 10, // Triggers 2 free item B
          }
        ],
        payments: [
          {
            payment_method: 'CASH',
            amount: expectedTotal.toNumber(),
          }
        ]
      });

      // Verify Invoice lines
      const invoice = await prisma.salesInvoice.findUnique({
        where: { id: result.id },
        include: { lines: true }
      });
      
      expect(invoice!.lines.length).toBe(2);
      
      // Check inventory deductions
      const movements = await prisma.stockMovement.findMany({
        where: { source_document_id: result.id },
      });
      
      const aMovement = movements.find(m => m.item_id === itemAId);
      const bMovement = movements.find(m => m.item_id === itemBId);
      
      expect(aMovement).toBeDefined();
      expect(Math.abs(aMovement!.quantity_delta.toNumber())).toBeGreaterThanOrEqual(10); // 10 paid + potential free
      
      expect(bMovement).toBeDefined();
      expect(Math.abs(bMovement!.quantity_delta.toNumber())).toBe(2); // 2 free out

      // Cleanup 14.3
      await prisma.pricingTrace.deleteMany({ where: { document_id: invoice!.id } });
      await prisma.pricingTrace.deleteMany({ where: { document_id: result.id } });
      
      const v = await prisma.voucher.findFirst({ where: { source_document_id: invoice!.id } });
      if (v) {
        await prisma.billAllocation.deleteMany({ where: { voucher_line: { voucher_id: v.id } } });
        await prisma.voucherLine.deleteMany({ where: { voucher_id: v.id } });
        await prisma.voucher.delete({ where: { id: v.id } });
      }

      for (const sm of movements) {
        await prisma.stockMovement.delete({ where: { id: sm.id } });
      }

      await prisma.salesInvoiceLine.deleteMany({ where: { sales_invoice_id: invoice!.id } });
      await prisma.salesInvoice.delete({ where: { id: invoice!.id } });
    });
  });
});
