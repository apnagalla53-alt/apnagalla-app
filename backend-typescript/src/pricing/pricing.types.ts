import { Prisma } from '@prisma/client';

export interface PricingContext {
  unitId?: string;
  branchId?: string;
  documentDate?: Date | string;
  customerType?: string;
  currency?: string;
  isPos?: boolean;
}

export interface AppliedRuleDetail {
  step: string;
  ruleType: 'CUSTOMER_RATE' | 'PRICE_LIST' | 'ITEM_MASTER' | 'QUANTITY_SLAB' | 'PROMOTION_SCHEME' | 'ITEM_DISCOUNT' | 'BILL_DISCOUNT' | 'MANUAL_OVERRIDE';
  ruleId?: string;
  ruleCode?: string;
  ruleName?: string;
  description: string;
  originalValue?: string;
  adjustedValue?: string;
  benefit?: string;
}

export interface ResolvedPriceResult {
  basePrice: Prisma.Decimal;
  resolvedRate: Prisma.Decimal;
  priceListId?: string;
  priceListItemId?: string;
  customerRateId?: string;
  quantitySlabId?: string;
  precedenceReason: string;
  ruleDetails: AppliedRuleDetail[];
}

export interface LinePricingInput {
  itemId: string;
  variantId?: string;
  batchId?: string;
  quantity: number | string | Prisma.Decimal;
  unitId?: string;
  overrideRate?: number | string | Prisma.Decimal;
  overrideDiscountAmount?: number | string | Prisma.Decimal;
  overrideDiscountPercent?: number | string | Prisma.Decimal;
}

export interface PromotionalLineResult {
  itemId: string;
  unitId?: string;
  originalQuantity: Prisma.Decimal;
  chargedQuantity: Prisma.Decimal;
  freeQuantity: Prisma.Decimal;
  basePrice: Prisma.Decimal;
  resolvedRate: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableValue: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  promotionId?: string;
  promotionCode?: string;
  promotionType?: string;
  precedenceReason: string;
  appliedSequence: string[];
  ruleDetails: AppliedRuleDetail[];
  pricingTrace: PricingTraceSnapshot;
}

export interface LinePricingResult {
  itemId: string;
  unitId?: string;
  originalQuantity: Prisma.Decimal;
  chargedQuantity: Prisma.Decimal;
  freeQuantity: Prisma.Decimal;
  basePrice: Prisma.Decimal;
  resolvedRate: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableValue: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  priceListId?: string;
  priceListItemId?: string;
  customerRateId?: string;
  quantitySlabId?: string;
  promotionId?: string;
  promotionCode?: string;
  promotionType?: string;
  precedenceReason: string;
  appliedSequence: string[];
  ruleDetails: AppliedRuleDetail[];
  pricingTrace: PricingTraceSnapshot;
  promotionalLines?: PromotionalLineResult[];
}

export interface PricingTraceSnapshot {
  pricingEngineVersion: string;
  timestamp: string;
  companyId: string;
  partyId?: string;
  itemId: string;
  basePrice: string;
  resolvedRate: string;
  priceListId?: string;
  priceListItemId?: string;
  customerRateId?: string;
  quantitySlabId?: string;
  promotionId?: string;
  promotionCode?: string;
  promotionType?: string;
  originalQuantity: string;
  chargedQuantity: string;
  freeQuantity: string;
  discountPercent: string;
  discountAmount: string;
  finalUnitPrice: string;
  finalLineAmount: string;
  precedenceReason: string;
  appliedSequence: string[];
  ruleDetails: AppliedRuleDetail[];
}

export interface BillDiscountInput {
  discountPercent?: number | string | Prisma.Decimal;
  discountAmount?: number | string | Prisma.Decimal;
  promotionSchemeId?: string;
}

export interface BillPricingResult {
  lines: LinePricingResult[];
  subtotal: Prisma.Decimal;
  lineDiscountTotal: Prisma.Decimal;
  billDiscountAmount: Prisma.Decimal;
  billDiscountPercent: Prisma.Decimal;
  totalDiscountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  billDiscountRuleId?: string;
  billDiscountTrace?: AppliedRuleDetail;
}

export interface PricingExplanation {
  itemId: string;
  itemName: string;
  partyId?: string;
  partyName?: string;
  quantity: string;
  resolvedPrice: ResolvedPriceResult;
  evaluatedSchemes: Array<{
    schemeId: string;
    code: string;
    name: string;
    schemeType: string;
    eligible: boolean;
    applied: boolean;
    reason: string;
  }>;
  finalPricing: LinePricingResult;
}
