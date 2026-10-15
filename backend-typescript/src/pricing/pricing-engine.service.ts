import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  PricingContext,
  ResolvedPriceResult,
  LinePricingInput,
  LinePricingResult,
  BillDiscountInput,
  BillPricingResult,
  PricingExplanation,
  AppliedRuleDetail,
  PricingTraceSnapshot,
} from './pricing.types';

@Injectable()
export class PricingEngineService {
  public static readonly VERSION = '1.0.0';

  constructor(private readonly prisma: PrismaService) {}

  // ── Helper: Safe Decimal Conversions ──────────────────────────────────────

  private toDecimal(val: number | string | Prisma.Decimal | null | undefined, defaultVal = '0'): Prisma.Decimal {
    if (val === null || val === undefined) return new Prisma.Decimal(defaultVal);
    if (val instanceof Prisma.Decimal) return val;
    return new Prisma.Decimal(val);
  }

  private roundMoney(val: Prisma.Decimal): Prisma.Decimal {
    return val.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  private roundRate(val: Prisma.Decimal): Prisma.Decimal {
    return val.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);
  }

  // ── 1. Canonical Price Resolution ─────────────────────────────────────────

  async resolveItemPrice(
    companyId: string,
    partyId: string | null | undefined,
    itemId: string,
    variantId: string | null | undefined,
    quantity: number | string | Prisma.Decimal,
    context?: PricingContext,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<ResolvedPriceResult> {
    const db = prismaClient ?? this.prisma;
    const qty = this.toDecimal(quantity);
    if (qty.lte(0)) {
      throw new BadRequestException('Quantity must be greater than zero for pricing evaluation');
    }

    const docDate = context?.documentDate ? new Date(context.documentDate) : new Date();
    const ruleDetails: AppliedRuleDetail[] = [];

    // Verify Item exists and belongs to company
    const item = await db.item.findUnique({
      where: { id: itemId },
      include: { primary_unit: true },
    });

    if (!item || item.company_id !== companyId) {
      throw new NotFoundException(`Item ${itemId} not found or belongs to another company`);
    }

    const selectedUnitId=context?.unitId||item.primary_unit_id;
    const conversion=selectedUnitId===item.primary_unit_id?null:await db.itemUnitConversion.findFirst({where:{item_id:itemId,from_unit_id:selectedUnitId,to_unit_id:item.primary_unit_id}});
    if(selectedUnitId!==item.primary_unit_id&&!conversion)throw new BadRequestException('Unit conversion is not configured');
    const factor=new Prisma.Decimal(conversion?.conversion_factor||1);
    const matchesSlab=(row:any)=>{const q=row.unit_id?qty:qty.mul(factor);return (!row.unit_id||row.unit_id===selectedUnitId)&&q.gte(row.min_qty)&&(!row.max_qty||q.lte(row.max_qty));};
    const byUnit=(a:any,b:any)=>Number(!!b.unit_id)-Number(!!a.unit_id)||new Prisma.Decimal(b.min_qty).comparedTo(a.min_qty);

    let party: any = null;
    if (partyId) {
      party = await db.party.findUnique({
        where: { id: partyId },
        include: { price_list: true },
      });
      if (!party || party.company_id !== companyId) {
        throw new NotFoundException(`Party ${partyId} not found or belongs to another company`);
      }
    }

    // Step 1: Check Customer-specific Rates (Highest Precedence)
    if (partyId) {
      const customerRates = await db.customerItemPrice.findMany({
        where: {
          company_id: companyId,
          party_id: partyId,
          item_id: itemId,
          is_active: true,
          OR: [
            { valid_from: null, valid_to: null },
            { valid_from: { lte: docDate }, valid_to: null },
            { valid_from: null, valid_to: { gte: docDate } },
            { valid_from: { lte: docDate }, valid_to: { gte: docDate } },
          ],
        },
        orderBy: { min_qty: 'desc' },
      });

      // Find matching slab: min_qty <= qty && (max_qty == null || max_qty >= qty)
      const matchingSlab = customerRates.sort(byUnit).find(matchesSlab);

      if (matchingSlab) {
        const rate = this.roundRate(new Prisma.Decimal(matchingSlab.rate).mul(matchingSlab.unit_id?1:factor));
        ruleDetails.push({
          step: '1. CUSTOMER_SPECIFIC_RATE',
          ruleType: 'CUSTOMER_RATE',
          ruleId: matchingSlab.id,
          description: `Applied customer-specific rate for party ${party.name} (${matchingSlab.min_qty} - ${matchingSlab.max_qty ?? '∞'} units)`,
          originalValue: item.default_sale_rate.toString(),
          adjustedValue: rate.toString(),
        });

        return {
          basePrice: rate,
          resolvedRate: rate,
          customerRateId: matchingSlab.id,
          quantitySlabId: matchingSlab.id,
          precedenceReason: 'CUSTOMER_SPECIFIC_RATE',
          ruleDetails,
        };
      }
    }

    // Step 2: Check Price Lists (Party Price List or Highest Priority Active Price List)
    let selectedPriceList: any = null;

    if (party?.price_list_id && party.price_list && party.price_list.is_active && party.price_list.status === 'ACTIVE') {
      const pl = party.price_list;
      const validFromOk = !pl.valid_from || new Date(pl.valid_from) <= docDate;
      const validToOk = !pl.valid_to || new Date(pl.valid_to) >= docDate;
      const branchOk = !pl.branch_id || pl.branch_id === context?.branchId;
      if (validFromOk && validToOk && branchOk) {
        selectedPriceList = pl;
      }
    }

    if (!selectedPriceList) {
      // Find candidate active price lists for this company
      const candidateLists = await db.priceList.findMany({
        where: {
          company_id: companyId,
          is_active: true,
          status: 'ACTIVE',
          OR: [
            { branch_id: null },
            ...(context?.branchId ? [{ branch_id: context.branchId }] : []),
          ],
        },
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      });

      // Filter by date validity and customer type
      selectedPriceList = candidateLists.find((pl) => {
        const validFromOk = !pl.valid_from || new Date(pl.valid_from) <= docDate;
        const validToOk = !pl.valid_to || new Date(pl.valid_to) >= docDate;
        const custTypeOk = !pl.customer_type || pl.customer_type === context?.customerType || (party && pl.customer_type === party.party_type);
        return validFromOk && validToOk;
      });
    }

    if (selectedPriceList) {
      const priceListItems = await db.priceListItem.findMany({
        where: {
          price_list_id: selectedPriceList.id,
          item_id: itemId,
          is_active: true,
        },
        orderBy: { min_qty: 'desc' },
      });

      const matchingItemSlab = priceListItems.sort(byUnit).find(matchesSlab);

      if (matchingItemSlab) {
        const rate = this.roundRate(new Prisma.Decimal(matchingItemSlab.rate).mul(matchingItemSlab.unit_id?1:factor));
        ruleDetails.push({
          step: '2. PRICE_LIST_RATE',
          ruleType: 'PRICE_LIST',
          ruleId: selectedPriceList.id,
          ruleCode: selectedPriceList.code,
          ruleName: selectedPriceList.name,
          description: `Applied rate from price list "${selectedPriceList.name}" (${matchingItemSlab.min_qty} - ${matchingItemSlab.max_qty ?? '∞'} units)`,
          originalValue: item.default_sale_rate.toString(),
          adjustedValue: rate.toString(),
        });

        return {
          basePrice: rate,
          resolvedRate: rate,
          priceListId: selectedPriceList.id,
          priceListItemId: matchingItemSlab.id,
          quantitySlabId: matchingItemSlab.id,
          precedenceReason: 'PRICE_LIST_RATE',
          ruleDetails,
        };
      }
    }

    // Step 3: Standard Fallback to Item Master or Variant
    let defaultRate = new Prisma.Decimal(item.default_sale_rate);
    if (variantId) {
      const variant = await db.itemVariant.findUnique({ where: { id: variantId } });
      if (variant && variant.default_sale_rate !== null) {
        defaultRate = new Prisma.Decimal(variant.default_sale_rate);
      }
    }
    const explicitUnitPrice=conversion?.selling_price!=null;
    defaultRate=explicitUnitPrice?new Prisma.Decimal(conversion.selling_price!):defaultRate.mul(factor);
    const fallbackRate = explicitUnitPrice||defaultRate.gt(0) ? defaultRate : new Prisma.Decimal(item.mrp).mul(factor);
    const finalFallback = this.roundRate(fallbackRate);

    ruleDetails.push({
      step: '3. ITEM_MASTER_FALLBACK',
      ruleType: 'ITEM_MASTER',
      ruleId: item.id,
      ruleCode: item.sku,
      ruleName: item.name,
      description: `Default sale rate from item master (fallback)`,
      originalValue: finalFallback.toString(),
      adjustedValue: finalFallback.toString(),
    });

    return {
      basePrice: finalFallback,
      resolvedRate: finalFallback,
      precedenceReason: 'ITEM_MASTER_FALLBACK',
      ruleDetails,
    };
  }

  // ── 2. Line Pricing & Scheme Calculation ──────────────────────────────────

  async calculateLinePricing(
    companyId: string,
    partyId: string | null | undefined,
    lineInput: LinePricingInput,
    context?: PricingContext,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<LinePricingResult> {
    const db = prismaClient ?? this.prisma;
    const qty = this.toDecimal(lineInput.quantity);
    if (qty.lte(0)) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const docDate = context?.documentDate ? new Date(context.documentDate) : new Date();

    // 1. Resolve base price
    const resolvedPrice = await this.resolveItemPrice(companyId, partyId, lineInput.itemId, lineInput.variantId, qty, {...context,unitId:lineInput.unitId}, db);
    let currentRate = resolvedPrice.resolvedRate;
    const ruleDetails: AppliedRuleDetail[] = [...resolvedPrice.ruleDetails];
    const appliedSequence: string[] = [resolvedPrice.precedenceReason];

    // Check for explicit manual override rate if allowed
    if (lineInput.overrideRate !== undefined && lineInput.overrideRate !== null) {
      const override = this.roundRate(this.toDecimal(lineInput.overrideRate));
      if (override.lt(0)) {
        throw new BadRequestException('Line rate override cannot be negative');
      }
      ruleDetails.push({
        step: 'MANUAL_RATE_OVERRIDE',
        ruleType: 'MANUAL_OVERRIDE',
        description: 'Transaction explicit unit rate override',
        originalValue: currentRate.toString(),
        adjustedValue: override.toString(),
      });
      appliedSequence.push('MANUAL_RATE_OVERRIDE');
      currentRate = override;
    }

    // 2. Evaluate Promotional Schemes (Buy X Get Y, Free Quantity, Promotional Item Discount)
    let freeQty = new Prisma.Decimal(0);
    let promoDiscountPercent = new Prisma.Decimal(0);
    let promoDiscountAmount = new Prisma.Decimal(0);
    let appliedPromotion: any = null;
    const promotionalLines: import('./pricing.types').PromotionalLineResult[] = [];

    const candidateSchemes = await db.promotionScheme.findMany({
      where: {
        company_id: companyId,
        is_active: true,
        status: 'ACTIVE',
        OR: [
          { branch_id: null },
          ...(context?.branchId ? [{ branch_id: context.branchId }] : []),
        ],
        AND: [
          {
            OR: [
              { valid_from: null, valid_to: null },
              { valid_from: { lte: docDate }, valid_to: null },
              { valid_from: null, valid_to: { gte: docDate } },
              { valid_from: { lte: docDate }, valid_to: { gte: docDate } },
            ],
          },
          {
            OR: [
              { party_id: null },
              ...(partyId ? [{ party_id: partyId }] : []),
            ],
          },
          {
            OR: [
              { item_id: null },
              { item_id: lineInput.itemId },
            ],
          },
        ],
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
    });

    for (const scheme of candidateSchemes) {
      // Check customer_type scope
      if (scheme.customer_type && context?.customerType && scheme.customer_type !== context.customerType) {
        continue;
      }

      let isEligible = false;
      let calculatedFree = new Prisma.Decimal(0);
      let calculatedDiscAmt = new Prisma.Decimal(0);
      let calculatedDiscPct = new Prisma.Decimal(0);

      if (scheme.scheme_type === 'BUY_X_GET_Y') {
        const buyQ = scheme.buy_quantity ? new Prisma.Decimal(scheme.buy_quantity) : new Prisma.Decimal(0);
        const getQ = scheme.get_quantity ? new Prisma.Decimal(scheme.get_quantity) : new Prisma.Decimal(0);

        if (buyQ.gt(0) && getQ.gt(0) && qty.gte(buyQ)) {
          isEligible = true;
          // multiples = Math.floor(qty / buyQ)
          const multiples = Math.floor(qty.div(buyQ).toNumber());
          calculatedFree = getQ.mul(multiples);

          if (scheme.max_benefit && calculatedFree.gt(new Prisma.Decimal(scheme.max_benefit))) {
            calculatedFree = new Prisma.Decimal(scheme.max_benefit);
          }
        }
      } else if (scheme.scheme_type === 'FREE_QUANTITY') {
        const buyQ = scheme.buy_quantity ? new Prisma.Decimal(scheme.buy_quantity) : new Prisma.Decimal(0);
        const getQ = scheme.get_quantity ? new Prisma.Decimal(scheme.get_quantity) : new Prisma.Decimal(0);

        if (qty.gte(buyQ) && getQ.gt(0)) {
          isEligible = true;
          calculatedFree = getQ;
          if (scheme.max_benefit && calculatedFree.gt(new Prisma.Decimal(scheme.max_benefit))) {
            calculatedFree = new Prisma.Decimal(scheme.max_benefit);
          }
        }
      } else if (scheme.scheme_type === 'ITEM_DISCOUNT' || scheme.scheme_type === 'PROMOTIONAL') {
        if (scheme.discount_percent && new Prisma.Decimal(scheme.discount_percent).gt(0)) {
          isEligible = true;
          calculatedDiscPct = new Prisma.Decimal(scheme.discount_percent);
        } else if (scheme.discount_amount && new Prisma.Decimal(scheme.discount_amount).gt(0)) {
          isEligible = true;
          calculatedDiscAmt = new Prisma.Decimal(scheme.discount_amount);
        }
      }

      if (isEligible) {
        appliedPromotion = scheme;
        
        let benefitStr = '';
        if (calculatedFree.gt(0)) {
          if (scheme.free_item_id) {
            // Alternate free item
            const freeItemDoc = await db.item.findUnique({ where: { id: scheme.free_item_id } });
            if (freeItemDoc) {
              const freeItemUnit = freeItemDoc.primary_unit_id ?? undefined;
              promotionalLines.push({
                itemId: scheme.free_item_id,
                unitId: freeItemUnit,
                originalQuantity: calculatedFree,
                chargedQuantity: new Prisma.Decimal(0),
                freeQuantity: calculatedFree,
                basePrice: new Prisma.Decimal(0),
                resolvedRate: new Prisma.Decimal(0),
                discountPercent: new Prisma.Decimal(0),
                discountAmount: new Prisma.Decimal(0),
                taxableValue: new Prisma.Decimal(0),
                lineTotal: new Prisma.Decimal(0),
                promotionId: scheme.id,
                promotionCode: scheme.code,
                promotionType: scheme.scheme_type,
                precedenceReason: `PROMOTION_SCHEME_ALTERNATE_${scheme.scheme_type}`,
                appliedSequence: [`PROMOTION_ALTERNATE_${scheme.code}`],
                ruleDetails: [{
                  step: `PROMOTION_SCHEME_ALTERNATE_${scheme.scheme_type}`,
                  ruleType: 'PROMOTION_SCHEME',
                  ruleId: scheme.id,
                  ruleCode: scheme.code,
                  ruleName: scheme.name,
                  description: `Alternate free item from ${scheme.name}`,
                  benefit: `${calculatedFree.toString()} units of ${freeItemDoc.name}`,
                }],
                pricingTrace: {
                  pricingEngineVersion: PricingEngineService.VERSION,
                  timestamp: new Date().toISOString(),
                  companyId,
                  partyId: partyId ?? undefined,
                  itemId: scheme.free_item_id,
                  basePrice: '0',
                  resolvedRate: '0',
                  promotionId: scheme.id,
                  promotionCode: scheme.code,
                  promotionType: scheme.scheme_type,
                  originalQuantity: calculatedFree.toString(),
                  chargedQuantity: '0',
                  freeQuantity: calculatedFree.toString(),
                  discountPercent: '0',
                  discountAmount: '0',
                  finalUnitPrice: '0',
                  finalLineAmount: '0',
                  precedenceReason: `PROMOTION_SCHEME_ALTERNATE_${scheme.scheme_type}`,
                  appliedSequence: [`PROMOTION_ALTERNATE_${scheme.code}`],
                  ruleDetails: [{
                    step: `PROMOTION_SCHEME_ALTERNATE_${scheme.scheme_type}`,
                    ruleType: 'PROMOTION_SCHEME',
                    ruleId: scheme.id,
                    ruleCode: scheme.code,
                    ruleName: scheme.name,
                    description: `Alternate free item from ${scheme.name}`,
                    benefit: `${calculatedFree.toString()} units of ${freeItemDoc.name}`,
                  }]
                }
              });
              benefitStr = `${calculatedFree.toString()} free units of alternate item`;
            }
          } else {
            // Same-item free quantity
            freeQty = freeQty.add(calculatedFree);
            benefitStr = `${calculatedFree.toString()} free units`;
          }
        } else {
          benefitStr = `${calculatedDiscPct.toString()}% discount`;
        }

        promoDiscountPercent = promoDiscountPercent.add(calculatedDiscPct);
        promoDiscountAmount = promoDiscountAmount.add(calculatedDiscAmt);

        ruleDetails.push({
          step: `PROMOTION_SCHEME_${scheme.scheme_type}`,
          ruleType: 'PROMOTION_SCHEME',
          ruleId: scheme.id,
          ruleCode: scheme.code,
          ruleName: scheme.name,
          description: `Promotion applied: ${scheme.name} (${scheme.scheme_type})`,
          benefit: benefitStr,
        });
        appliedSequence.push(`PROMOTION_${scheme.code}`);

        // If scheme is not stackable, highest priority eligible scheme wins
        if (!scheme.stackable) {
          break;
        }
      }
    }

    // 3. Item Discounts Resolution
    let finalDiscountPercent = new Prisma.Decimal(0);
    let finalDiscountAmount = new Prisma.Decimal(0);

    // Check price list item discount percent if available
    if (resolvedPrice.priceListItemId) {
      const pli = await db.priceListItem.findUnique({
        where: { id: resolvedPrice.priceListItemId },
      });
      if (pli && new Prisma.Decimal(pli.discount_percent).gt(0)) {
        finalDiscountPercent = new Prisma.Decimal(pli.discount_percent);
      }
    }

    // Add promotional discount
    if (promoDiscountPercent.gt(0)) {
      finalDiscountPercent = finalDiscountPercent.add(promoDiscountPercent);
    }
    if (promoDiscountAmount.gt(0)) {
      finalDiscountAmount = finalDiscountAmount.add(promoDiscountAmount);
    }

    // Manual discount overrides
    if (lineInput.overrideDiscountPercent !== undefined && lineInput.overrideDiscountPercent !== null) {
      finalDiscountPercent = this.toDecimal(lineInput.overrideDiscountPercent);
    }
    if (lineInput.overrideDiscountAmount !== undefined && lineInput.overrideDiscountAmount !== null) {
      finalDiscountAmount = this.toDecimal(lineInput.overrideDiscountAmount);
    }

    // Validation: discount percent cannot be negative or > 100
    if (finalDiscountPercent.lt(0) || finalDiscountPercent.gt(100)) {
      throw new BadRequestException('Discount percentage must be between 0 and 100');
    }
    if (finalDiscountAmount.lt(0)) {
      throw new BadRequestException('Discount amount cannot be negative');
    }

    // Calculate line amounts
    const grossLineValue = this.roundMoney(qty.mul(currentRate));

    if (finalDiscountPercent.gt(0)) {
      const percentVal = this.roundMoney(grossLineValue.mul(finalDiscountPercent).div(100));
      finalDiscountAmount = finalDiscountAmount.add(percentVal);
    }

    // Total discount cannot exceed gross line total (no negative net rate)
    if (finalDiscountAmount.gt(grossLineValue)) {
      finalDiscountAmount = grossLineValue;
    }
    finalDiscountAmount = this.roundMoney(finalDiscountAmount);

    const taxableValue = grossLineValue.sub(finalDiscountAmount);
    const lineTotal = taxableValue; // Pre-tax line total; tax applied in posting service

    if (finalDiscountAmount.gt(0)) {
      ruleDetails.push({
        step: 'ITEM_DISCOUNT',
        ruleType: 'ITEM_DISCOUNT',
        description: `Applied line discount of ${finalDiscountAmount.toString()} (${finalDiscountPercent.toString()}%)`,
        benefit: finalDiscountAmount.toString(),
      });
      appliedSequence.push('ITEM_DISCOUNT');
    }

    // Create immutable pricing trace snapshot
    const pricingTrace: PricingTraceSnapshot = {
      pricingEngineVersion: PricingEngineService.VERSION,
      timestamp: new Date().toISOString(),
      companyId,
      partyId: partyId ?? undefined,
      itemId: lineInput.itemId,
      basePrice: resolvedPrice.basePrice.toString(),
      resolvedRate: currentRate.toString(),
      priceListId: resolvedPrice.priceListId,
      priceListItemId: resolvedPrice.priceListItemId,
      customerRateId: resolvedPrice.customerRateId,
      quantitySlabId: resolvedPrice.quantitySlabId,
      promotionId: appliedPromotion?.id,
      promotionCode: appliedPromotion?.code,
      promotionType: appliedPromotion?.scheme_type,
      originalQuantity: qty.toString(),
      chargedQuantity: qty.toString(),
      freeQuantity: freeQty.toString(),
      discountPercent: finalDiscountPercent.toString(),
      discountAmount: finalDiscountAmount.toString(),
      finalUnitPrice: currentRate.toString(),
      finalLineAmount: lineTotal.toString(),
      precedenceReason: resolvedPrice.precedenceReason,
      appliedSequence,
      ruleDetails,
    };

    return {
      itemId: lineInput.itemId,
      unitId: lineInput.unitId,
      originalQuantity: qty,
      chargedQuantity: qty,
      freeQuantity: freeQty,
      basePrice: resolvedPrice.basePrice,
      resolvedRate: currentRate,
      discountPercent: finalDiscountPercent,
      discountAmount: finalDiscountAmount,
      taxableValue,
      lineTotal,
      priceListId: resolvedPrice.priceListId,
      priceListItemId: resolvedPrice.priceListItemId,
      customerRateId: resolvedPrice.customerRateId,
      quantitySlabId: resolvedPrice.quantitySlabId,
      promotionId: appliedPromotion?.id,
      promotionCode: appliedPromotion?.code,
      promotionType: appliedPromotion?.scheme_type,
      precedenceReason: resolvedPrice.precedenceReason,
      appliedSequence,
      ruleDetails,
      pricingTrace,
      promotionalLines: promotionalLines.length > 0 ? promotionalLines : undefined,
    };
  }

  // ── 3. Bill-Level Pricing Calculation ─────────────────────────────────────

  calculateBillPricing(
    companyId: string,
    lines: LinePricingResult[],
    billDiscountRule?: BillDiscountInput,
  ): BillPricingResult {
    let subtotal = new Prisma.Decimal(0);
    let lineDiscountTotal = new Prisma.Decimal(0);

    for (const line of lines) {
      subtotal = subtotal.add(line.lineTotal);
      lineDiscountTotal = lineDiscountTotal.add(line.discountAmount);
    }

    let billDiscountAmount = new Prisma.Decimal(0);
    let billDiscountPercent = new Prisma.Decimal(0);
    let billDiscountTrace: AppliedRuleDetail | undefined;

    if (billDiscountRule) {
      if (billDiscountRule.discountPercent !== undefined && billDiscountRule.discountPercent !== null) {
        billDiscountPercent = this.toDecimal(billDiscountRule.discountPercent);
        if (billDiscountPercent.lt(0) || billDiscountPercent.gt(100)) {
          throw new BadRequestException('Bill discount percent must be between 0 and 100');
        }
        billDiscountAmount = this.roundMoney(subtotal.mul(billDiscountPercent).div(100));
      } else if (billDiscountRule.discountAmount !== undefined && billDiscountRule.discountAmount !== null) {
        billDiscountAmount = this.roundMoney(this.toDecimal(billDiscountRule.discountAmount));
        if (billDiscountAmount.lt(0)) {
          throw new BadRequestException('Bill discount amount cannot be negative');
        }
      }

      if (billDiscountAmount.gt(subtotal)) {
        throw new BadRequestException(`Bill discount (${billDiscountAmount.toString()}) cannot exceed subtotal (${subtotal.toString()})`);
      }

      if (billDiscountAmount.gt(0)) {
        billDiscountTrace = {
          step: 'BILL_DISCOUNT',
          ruleType: 'BILL_DISCOUNT',
          ruleId: billDiscountRule.promotionSchemeId,
          description: `Applied bill-level discount of ${billDiscountAmount.toString()}`,
          benefit: billDiscountAmount.toString(),
        };
      }
    }

    const totalDiscountAmount = lineDiscountTotal.add(billDiscountAmount);
    const taxableAmount = subtotal.sub(billDiscountAmount);
    const grandTotal = taxableAmount;

    return {
      lines,
      subtotal,
      lineDiscountTotal,
      billDiscountAmount,
      billDiscountPercent,
      totalDiscountAmount,
      taxableAmount,
      grandTotal,
      billDiscountRuleId: billDiscountRule?.promotionSchemeId,
      billDiscountTrace,
    };
  }

  // ── 4. Pricing Explanation (Inspection & Audit) ───────────────────────────

  async explainPricing(
    companyId: string,
    partyId: string | null | undefined,
    itemId: string,
    variantId: string | null | undefined,
    quantity: number | string | Prisma.Decimal,
    context?: PricingContext,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<PricingExplanation> {
    const db = prismaClient ?? this.prisma;
    const qty = this.toDecimal(quantity);
    const item = await db.item.findUnique({ where: { id: itemId } });
    if (!item || item.company_id !== companyId) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }

    let party: any = null;
    if (partyId) {
      party = await db.party.findUnique({ where: { id: partyId } });
    }

    const resolvedPrice = await this.resolveItemPrice(companyId, partyId, itemId, variantId ?? undefined, qty, context, db);
    const finalPricing = await this.calculateLinePricing(companyId, partyId, { itemId, variantId: variantId ?? undefined, quantity: qty }, context, db);

    // List all candidate schemes and explain eligibility
    const docDate = context?.documentDate ? new Date(context.documentDate) : new Date();
    const allSchemes = await db.promotionScheme.findMany({
      where: { company_id: companyId, is_active: true },
    });

    const evaluatedSchemes = allSchemes.map((s) => {
      const dateOk = (!s.valid_from || new Date(s.valid_from) <= docDate) && (!s.valid_to || new Date(s.valid_to) >= docDate);
      const partyOk = !s.party_id || s.party_id === partyId;
      const itemOk = !s.item_id || s.item_id === itemId;
      const qtyOk = !s.buy_quantity || qty.gte(new Prisma.Decimal(s.buy_quantity));
      const eligible = dateOk && partyOk && itemOk && qtyOk;
      const applied = finalPricing.promotionId === s.id;

      let reason = 'Criteria met';
      if (!dateOk) reason = 'Scheme expired or not yet valid';
      else if (!partyOk) reason = 'Scheme specific to another customer';
      else if (!itemOk) reason = 'Scheme specific to another item';
      else if (!qtyOk) reason = `Quantity ${qty.toString()} below qualifying threshold ${s.buy_quantity?.toString()}`;
      else if (!applied && !s.stackable) reason = 'Higher priority scheme won';

      return {
        schemeId: s.id,
        code: s.code,
        name: s.name,
        schemeType: s.scheme_type,
        eligible,
        applied,
        reason,
      };
    });

    return {
      itemId,
      itemName: item.name,
      partyId: partyId ?? undefined,
      partyName: party?.name,
      quantity: qty.toString(),
      resolvedPrice,
      evaluatedSchemes,
      finalPricing,
    };
  }

  // ── 5. Record Immutable Pricing Traces to DB ──────────────────────────────

  async recordPricingTraces(
    companyId: string,
    documentType: string,
    documentId: string,
    lines: Array<{ lineId?: string; pricingTrace: PricingTraceSnapshot }>,
    prismaClient?: Prisma.TransactionClient,
  ) {
    const db = prismaClient ?? this.prisma;
    if (!lines || lines.length === 0) return [];

    const traceData = lines.map((l) => {
      const t = l.pricingTrace;
      return {
        company_id: companyId,
        document_type: documentType,
        document_id: documentId,
        line_id: l.lineId ?? null,
        item_id: t.itemId,
        party_id: t.partyId ?? null,
        pricing_engine_version: t.pricingEngineVersion,
        base_price: new Prisma.Decimal(t.basePrice),
        resolved_rate: new Prisma.Decimal(t.resolvedRate),
        price_list_id: t.priceListId ?? null,
        price_list_item_id: t.priceListItemId ?? null,
        customer_rate_id: t.customerRateId ?? null,
        quantity_slab_id: t.quantitySlabId ?? null,
        promotion_id: t.promotionId ?? null,
        original_quantity: new Prisma.Decimal(t.originalQuantity),
        charged_quantity: new Prisma.Decimal(t.chargedQuantity),
        free_quantity: new Prisma.Decimal(t.freeQuantity),
        discount_amount: new Prisma.Decimal(t.discountAmount),
        discount_percent: new Prisma.Decimal(t.discountPercent),
        final_unit_price: new Prisma.Decimal(t.finalUnitPrice),
        final_line_amount: new Prisma.Decimal(t.finalLineAmount),
        precedence_reason: t.precedenceReason,
        trace_details_json: JSON.stringify(t),
      };
    });

    return db.pricingTrace.createMany({
      data: traceData,
    });
  }
}
