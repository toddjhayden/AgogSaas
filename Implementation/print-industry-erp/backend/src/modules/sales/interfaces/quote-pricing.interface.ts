/**
 * Quote Pricing Service Interfaces
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Defines interfaces for automated quote pricing calculation including
 * pricing rules, customer-specific pricing, and margin calculations.
 */

export interface PricingCalculationInput {
  productId: string;
  quantity: number;
  customerId: string;
  quoteDate: Date;
  tenantId: string;
  facilityId?: string;
}

export interface PricingCalculationResult {
  unitPrice: number;
  lineAmount: number;
  discountPercentage: number;
  discountAmount: number;
  unitCost: number;
  lineCost: number;
  lineMargin: number;
  marginPercentage: number;
  appliedRules: AppliedPricingRule[];
  priceSource: PriceSource;
}

export interface AppliedPricingRule {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  pricingAction: string;
  actionValue: number;
  priority: number;
  discountApplied: number;
}

export enum PriceSource {
  CUSTOMER_PRICING = 'CUSTOMER_PRICING',
  PRICING_RULE = 'PRICING_RULE',
  LIST_PRICE = 'LIST_PRICE',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE'
}

export interface CustomerPricingRecord {
  id: string;
  customerId: string;
  productId: string;
  unitPrice: number;
  priceCurrencyCode: string;
  priceUom: string;
  minimumQuantity: number;
  priceBreaks: PriceBreak[];
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

export interface PriceBreak {
  minimumQuantity: number;
  unitPrice: number;
}

export interface PricingRule {
  id: string;
  tenantId: string;
  ruleCode: string;
  ruleName: string;
  description: string | null;
  ruleType: PricingRuleType;
  priority: number;
  conditions: PricingRuleConditions;
  pricingAction: PricingAction;
  actionValue: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
}

export enum PricingRuleType {
  VOLUME_DISCOUNT = 'VOLUME_DISCOUNT',
  CUSTOMER_TIER = 'CUSTOMER_TIER',
  PRODUCT_CATEGORY = 'PRODUCT_CATEGORY',
  SEASONAL = 'SEASONAL',
  PROMOTIONAL = 'PROMOTIONAL',
  CLEARANCE = 'CLEARANCE',
  CONTRACT_PRICING = 'CONTRACT_PRICING'
}

export enum PricingAction {
  PERCENTAGE_DISCOUNT = 'PERCENTAGE_DISCOUNT',
  FIXED_DISCOUNT = 'FIXED_DISCOUNT',
  FIXED_PRICE = 'FIXED_PRICE',
  MARKUP_PERCENTAGE = 'MARKUP_PERCENTAGE'
}

export interface PricingRuleConditions {
  customerTier?: string;
  customerType?: string;
  productCategory?: string;
  productId?: string;
  minimumQuantity?: number;
  maximumQuantity?: number;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

export interface QuoteTotalsInput {
  quoteId: string;
  tenantId: string;
}

export interface QuoteTotals {
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  marginAmount: number;
  marginPercentage: number;
  lineCount: number;
}
