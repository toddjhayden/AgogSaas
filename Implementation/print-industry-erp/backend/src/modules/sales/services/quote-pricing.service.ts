/**
 * Quote Pricing Service
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Calculates quote line pricing using customer pricing agreements, pricing rules,
 * and list prices. Integrates with Pricing Rule Engine and Costing Service for
 * complete price and margin calculations.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  PricingCalculationInput,
  PricingCalculationResult,
  PriceSource,
  CustomerPricingRecord,
  PriceBreak,
  QuoteTotalsInput,
  QuoteTotals
} from '../interfaces/quote-pricing.interface';
import { PricingRuleEngineService } from './pricing-rule-engine.service';
import { QuoteCostingService } from './quote-costing.service';

@Injectable()
export class QuotePricingService {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly pricingRuleEngine: PricingRuleEngineService,
    private readonly costingService: QuoteCostingService
  ) {}

  /**
   * Calculate complete pricing for a quote line including price, cost, and margin
   */
  async calculateQuoteLinePricing(
    input: PricingCalculationInput
  ): Promise<PricingCalculationResult> {
    // Step 1: Get base price (customer pricing > list price)
    const { basePrice, priceSource } = await this.getBasePrice(
      input.tenantId,
      input.productId,
      input.customerId,
      input.quantity,
      input.quoteDate
    );

    // Step 2: Get customer and product context for pricing rules
    const context = await this.getCustomerProductContext(
      input.tenantId,
      input.customerId,
      input.productId
    );

    // Step 3: Apply pricing rules
    const pricingResult = await this.pricingRuleEngine.evaluatePricingRules({
      tenantId: input.tenantId,
      productId: input.productId,
      productCategory: context.productCategory,
      customerId: input.customerId,
      customerTier: context.customerTier,
      customerType: context.customerType,
      quantity: input.quantity,
      basePrice,
      quoteDate: input.quoteDate
    });

    const finalUnitPrice = pricingResult.finalPrice;
    const lineAmount = finalUnitPrice * input.quantity;

    // Calculate total discount
    const totalDiscountAmount = (basePrice - finalUnitPrice) * input.quantity;
    const discountPercentage = basePrice > 0 ? ((basePrice - finalUnitPrice) / basePrice) * 100 : 0;

    // Step 4: Calculate cost
    const costResult = await this.costingService.calculateProductCost({
      productId: input.productId,
      quantity: input.quantity,
      tenantId: input.tenantId,
      asOfDate: input.quoteDate
    });

    // Step 5: Calculate margin
    const lineCost = costResult.totalCost;
    const unitCost = costResult.unitCost;
    const lineMargin = lineAmount - lineCost;
    const marginPercentage = lineAmount > 0 ? (lineMargin / lineAmount) * 100 : 0;

    return {
      unitPrice: finalUnitPrice,
      lineAmount,
      discountPercentage,
      discountAmount: totalDiscountAmount,
      unitCost,
      lineCost,
      lineMargin,
      marginPercentage,
      appliedRules: pricingResult.appliedRules,
      priceSource
    };
  }

  /**
   * Get base price from customer pricing or list price
   */
  private async getBasePrice(
    tenantId: string,
    productId: string,
    customerId: string,
    quantity: number,
    asOfDate: Date
  ): Promise<{ basePrice: number; priceSource: PriceSource }> {
    // First, check for customer-specific pricing
    const customerPricing = await this.getCustomerPricing(
      tenantId,
      customerId,
      productId,
      quantity,
      asOfDate
    );

    if (customerPricing) {
      return {
        basePrice: customerPricing.effectivePrice,
        priceSource: PriceSource.CUSTOMER_PRICING
      };
    }

    // Fall back to list price
    const listPriceQuery = `
      SELECT list_price
      FROM products
      WHERE id = $1 AND tenant_id = $2 AND is_current_version = true
    `;

    const result = await this.db.query(listPriceQuery, [productId, tenantId]);

    if (result.rows.length === 0 || result.rows[0].list_price === null) {
      throw new Error(`No price found for product ${productId}`);
    }

    return {
      basePrice: parseFloat(result.rows[0].list_price),
      priceSource: PriceSource.LIST_PRICE
    };
  }

  /**
   * Get customer-specific pricing with quantity break support
   */
  private async getCustomerPricing(
    tenantId: string,
    customerId: string,
    productId: string,
    quantity: number,
    asOfDate: Date
  ): Promise<{ effectivePrice: number; record: CustomerPricingRecord } | null> {
    const query = `
      SELECT
        id,
        customer_id,
        product_id,
        unit_price,
        price_currency_code,
        price_uom,
        minimum_quantity,
        price_breaks,
        effective_from,
        effective_to,
        is_active
      FROM customer_pricing
      WHERE tenant_id = $1
        AND customer_id = $2
        AND product_id = $3
        AND is_active = true
        AND $4 >= effective_from
        AND ($4 <= effective_to OR effective_to IS NULL)
      ORDER BY effective_from DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [tenantId, customerId, productId, asOfDate]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const priceBreaks: PriceBreak[] = row.price_breaks || [];

    // Check if quantity meets minimum
    const minimumQuantity = parseFloat(row.minimum_quantity) || 0;
    if (quantity < minimumQuantity) {
      return null; // Quantity too low for this pricing
    }

    // Find applicable price break
    let effectivePrice = parseFloat(row.unit_price);

    if (priceBreaks.length > 0) {
      // Sort price breaks by minimumQuantity descending
      const sortedBreaks = [...priceBreaks].sort(
        (a, b) => b.minimumQuantity - a.minimumQuantity
      );

      // Find the highest break that applies
      for (const priceBreak of sortedBreaks) {
        if (quantity >= priceBreak.minimumQuantity) {
          effectivePrice = priceBreak.unitPrice;
          break;
        }
      }
    }

    const record: CustomerPricingRecord = {
      id: row.id,
      customerId: row.customer_id,
      productId: row.product_id,
      unitPrice: parseFloat(row.unit_price),
      priceCurrencyCode: row.price_currency_code,
      priceUom: row.price_uom,
      minimumQuantity,
      priceBreaks,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active
    };

    return { effectivePrice, record };
  }

  /**
   * Get customer and product context for pricing rule evaluation
   */
  private async getCustomerProductContext(
    tenantId: string,
    customerId: string,
    productId: string
  ): Promise<{
    customerTier: string | null;
    customerType: string | null;
    productCategory: string | null;
  }> {
    const query = `
      SELECT
        c.pricing_tier as customer_tier,
        c.customer_type,
        p.product_category
      FROM customers c
      CROSS JOIN products p
      WHERE c.id = $1
        AND c.tenant_id = $2
        AND c.is_current_version = true
        AND p.id = $3
        AND p.tenant_id = $2
        AND p.is_current_version = true
    `;

    const result = await this.db.query(query, [customerId, tenantId, productId]);

    if (result.rows.length === 0) {
      return {
        customerTier: null,
        customerType: null,
        productCategory: null
      };
    }

    const row = result.rows[0];

    return {
      customerTier: row.customer_tier,
      customerType: row.customer_type,
      productCategory: row.product_category
    };
  }

  /**
   * Recalculate quote totals from quote lines
   */
  async calculateQuoteTotals(input: QuoteTotalsInput): Promise<QuoteTotals> {
    const query = `
      SELECT
        COALESCE(SUM(line_amount), 0) as subtotal,
        COALESCE(SUM(discount_amount), 0) as discount_amount,
        COALESCE(SUM(line_cost), 0) as total_cost,
        COALESCE(SUM(line_margin), 0) as margin_amount,
        COUNT(*) as line_count
      FROM quote_lines
      WHERE quote_id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [input.quoteId, input.tenantId]);

    if (result.rows.length === 0) {
      return {
        subtotal: 0,
        taxAmount: 0,
        shippingAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        totalCost: 0,
        marginAmount: 0,
        marginPercentage: 0,
        lineCount: 0
      };
    }

    const row = result.rows[0];
    const subtotal = parseFloat(row.subtotal);
    const discountAmount = parseFloat(row.discount_amount);
    const totalCost = parseFloat(row.total_cost);
    const marginAmount = parseFloat(row.margin_amount);
    const lineCount = parseInt(row.line_count);

    // Get tax and shipping from quote header (if calculated separately)
    const quoteQuery = `
      SELECT tax_amount, shipping_amount
      FROM quotes
      WHERE id = $1 AND tenant_id = $2
    `;
    const quoteResult = await this.db.query(quoteQuery, [input.quoteId, input.tenantId]);

    const taxAmount = quoteResult.rows.length > 0
      ? parseFloat(quoteResult.rows[0].tax_amount) || 0
      : 0;

    const shippingAmount = quoteResult.rows.length > 0
      ? parseFloat(quoteResult.rows[0].shipping_amount) || 0
      : 0;

    const totalAmount = subtotal + taxAmount + shippingAmount;
    const marginPercentage = totalAmount > 0 ? (marginAmount / totalAmount) * 100 : 0;

    return {
      subtotal,
      taxAmount,
      shippingAmount,
      discountAmount,
      totalAmount,
      totalCost,
      marginAmount,
      marginPercentage,
      lineCount
    };
  }

  /**
   * Apply manual price override to calculated price
   */
  applyManualPriceOverride(
    calculatedResult: PricingCalculationResult,
    manualUnitPrice: number,
    quantity: number
  ): PricingCalculationResult {
    const lineAmount = manualUnitPrice * quantity;
    const discountAmount = (calculatedResult.unitPrice - manualUnitPrice) * quantity;
    const discountPercentage = calculatedResult.unitPrice > 0
      ? ((calculatedResult.unitPrice - manualUnitPrice) / calculatedResult.unitPrice) * 100
      : 0;

    const lineMargin = lineAmount - calculatedResult.lineCost;
    const marginPercentage = lineAmount > 0 ? (lineMargin / lineAmount) * 100 : 0;

    return {
      ...calculatedResult,
      unitPrice: manualUnitPrice,
      lineAmount,
      discountAmount,
      discountPercentage,
      lineMargin,
      marginPercentage,
      priceSource: PriceSource.MANUAL_OVERRIDE,
      appliedRules: [] // Manual override ignores rules
    };
  }
}
