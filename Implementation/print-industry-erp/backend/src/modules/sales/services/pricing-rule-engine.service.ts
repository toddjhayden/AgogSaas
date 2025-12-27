/**
 * Pricing Rule Engine Service
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Executes pricing rules with priority-based evaluation, JSONB condition matching,
 * and action application. Supports multiple rule types and actions.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  PricingRule,
  PricingRuleType,
  PricingAction,
  PricingRuleConditions,
  AppliedPricingRule
} from '../interfaces/quote-pricing.interface';

@Injectable()
export class PricingRuleEngineService {
  private readonly MAX_RULES_TO_EVALUATE = 100;

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Evaluate and apply all applicable pricing rules for a quote line
   */
  async evaluatePricingRules(input: {
    tenantId: string;
    productId: string;
    productCategory: string | null;
    customerId: string;
    customerTier: string | null;
    customerType: string | null;
    quantity: number;
    basePrice: number;
    quoteDate: Date;
  }): Promise<{ finalPrice: number; appliedRules: AppliedPricingRule[] }> {
    // Fetch applicable pricing rules
    const rules = await this.fetchApplicableRules(
      input.tenantId,
      input.quoteDate,
      input.productId,
      input.productCategory,
      input.customerId
    );

    if (rules.length === 0) {
      return { finalPrice: input.basePrice, appliedRules: [] };
    }

    // Evaluate conditions and filter matching rules
    const matchingRules = rules.filter(rule =>
      this.evaluateRuleConditions(rule.conditions, {
        productId: input.productId,
        productCategory: input.productCategory,
        customerId: input.customerId,
        customerTier: input.customerTier,
        customerType: input.customerType,
        quantity: input.quantity,
        quoteDate: input.quoteDate
      })
    );

    if (matchingRules.length === 0) {
      return { finalPrice: input.basePrice, appliedRules: [] };
    }

    // Sort by priority (lower number = higher priority)
    matchingRules.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    // Apply rules and track which ones were applied
    let currentPrice = input.basePrice;
    const appliedRules: AppliedPricingRule[] = [];

    for (const rule of matchingRules.slice(0, 10)) { // Limit to top 10 rules
      const { newPrice, discountApplied } = this.applyPricingAction(
        currentPrice,
        rule.pricingAction,
        rule.actionValue,
        input.basePrice
      );

      if (discountApplied > 0) {
        appliedRules.push({
          ruleId: rule.id,
          ruleCode: rule.ruleCode,
          ruleName: rule.ruleName,
          ruleType: rule.ruleType,
          pricingAction: rule.pricingAction,
          actionValue: rule.actionValue,
          priority: rule.priority || 999,
          discountApplied
        });
      }

      currentPrice = newPrice;
    }

    return {
      finalPrice: Math.max(currentPrice, 0), // Prevent negative prices
      appliedRules
    };
  }

  /**
   * Fetch active pricing rules applicable to the given criteria
   */
  private async fetchApplicableRules(
    tenantId: string,
    asOfDate: Date,
    productId?: string,
    productCategory?: string | null,
    customerId?: string
  ): Promise<PricingRule[]> {
    const query = `
      SELECT
        id,
        tenant_id,
        rule_code,
        rule_name,
        description,
        rule_type,
        priority,
        conditions,
        pricing_action,
        action_value,
        effective_from,
        effective_to,
        is_active
      FROM pricing_rules
      WHERE tenant_id = $1
        AND is_active = true
        AND $2 >= effective_from
        AND ($2 <= effective_to OR effective_to IS NULL)
      ORDER BY priority ASC NULLS LAST
      LIMIT $3
    `;

    const result = await this.db.query(query, [
      tenantId,
      asOfDate,
      this.MAX_RULES_TO_EVALUATE
    ]);

    return result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      ruleCode: row.rule_code,
      ruleName: row.rule_name,
      description: row.description,
      ruleType: row.rule_type as PricingRuleType,
      priority: row.priority,
      conditions: row.conditions as PricingRuleConditions,
      pricingAction: row.pricing_action as PricingAction,
      actionValue: parseFloat(row.action_value),
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      isActive: row.is_active
    }));
  }

  /**
   * Evaluate if rule conditions match the given context
   */
  private evaluateRuleConditions(
    conditions: PricingRuleConditions,
    context: {
      productId?: string;
      productCategory?: string | null;
      customerId?: string;
      customerTier?: string | null;
      customerType?: string | null;
      quantity?: number;
      quoteDate?: Date;
    }
  ): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true; // Empty conditions = always match
    }

    // Check product conditions
    if (conditions.productId && conditions.productId !== context.productId) {
      return false;
    }

    if (conditions.productCategory && conditions.productCategory !== context.productCategory) {
      return false;
    }

    // Check customer conditions
    if (conditions.customerId && conditions.customerId !== context.customerId) {
      return false;
    }

    if (conditions.customerTier && conditions.customerTier !== context.customerTier) {
      return false;
    }

    if (conditions.customerType && conditions.customerType !== context.customerType) {
      return false;
    }

    // Check quantity conditions
    if (conditions.minimumQuantity !== undefined && context.quantity !== undefined) {
      if (context.quantity < conditions.minimumQuantity) {
        return false;
      }
    }

    if (conditions.maximumQuantity !== undefined && context.quantity !== undefined) {
      if (context.quantity > conditions.maximumQuantity) {
        return false;
      }
    }

    // Check date conditions (for seasonal/promotional rules)
    if (conditions.startDate && context.quoteDate) {
      const startDate = new Date(conditions.startDate);
      if (context.quoteDate < startDate) {
        return false;
      }
    }

    if (conditions.endDate && context.quoteDate) {
      const endDate = new Date(conditions.endDate);
      if (context.quoteDate > endDate) {
        return false;
      }
    }

    return true; // All conditions passed
  }

  /**
   * Apply pricing action to current price
   */
  private applyPricingAction(
    currentPrice: number,
    action: PricingAction,
    actionValue: number,
    basePrice: number
  ): { newPrice: number; discountApplied: number } {
    let newPrice = currentPrice;
    let discountApplied = 0;

    switch (action) {
      case PricingAction.PERCENTAGE_DISCOUNT:
        // Apply percentage discount to current price
        discountApplied = currentPrice * (actionValue / 100);
        newPrice = currentPrice - discountApplied;
        break;

      case PricingAction.FIXED_DISCOUNT:
        // Apply fixed dollar discount
        discountApplied = Math.min(actionValue, currentPrice);
        newPrice = currentPrice - discountApplied;
        break;

      case PricingAction.FIXED_PRICE:
        // Set to fixed price
        discountApplied = Math.max(0, currentPrice - actionValue);
        newPrice = actionValue;
        break;

      case PricingAction.MARKUP_PERCENTAGE:
        // Apply markup percentage (negative discount)
        const markup = basePrice * (actionValue / 100);
        newPrice = currentPrice + markup;
        discountApplied = -markup; // Negative discount
        break;

      default:
        // Unknown action, no change
        break;
    }

    return {
      newPrice: Math.max(newPrice, 0), // Prevent negative prices
      discountApplied: Math.max(discountApplied, 0) // Discount is always positive
    };
  }

  /**
   * Get all active pricing rules for a tenant
   */
  async getActivePricingRules(tenantId: string): Promise<PricingRule[]> {
    return this.fetchApplicableRules(tenantId, new Date());
  }

  /**
   * Test rule evaluation without applying (for admin UI)
   */
  async testRuleEvaluation(
    ruleId: string,
    testInput: {
      productId?: string;
      productCategory?: string;
      customerId?: string;
      customerTier?: string;
      customerType?: string;
      quantity?: number;
      basePrice: number;
    }
  ): Promise<{
    matches: boolean;
    finalPrice: number;
    discountApplied: number;
  }> {
    const query = `
      SELECT * FROM pricing_rules WHERE id = $1 AND is_active = true
    `;
    const result = await this.db.query(query, [ruleId]);

    if (result.rows.length === 0) {
      throw new Error(`Pricing rule ${ruleId} not found or inactive`);
    }

    const rule = result.rows[0];
    const matches = this.evaluateRuleConditions(rule.conditions, {
      productId: testInput.productId,
      productCategory: testInput.productCategory,
      customerId: testInput.customerId,
      customerTier: testInput.customerTier,
      customerType: testInput.customerType,
      quantity: testInput.quantity,
      quoteDate: new Date()
    });

    if (!matches) {
      return {
        matches: false,
        finalPrice: testInput.basePrice,
        discountApplied: 0
      };
    }

    const { newPrice, discountApplied } = this.applyPricingAction(
      testInput.basePrice,
      rule.pricing_action,
      parseFloat(rule.action_value),
      testInput.basePrice
    );

    return {
      matches: true,
      finalPrice: newPrice,
      discountApplied
    };
  }
}
