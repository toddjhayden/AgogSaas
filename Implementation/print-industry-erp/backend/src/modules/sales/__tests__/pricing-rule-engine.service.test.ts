/**
 * Pricing Rule Engine Service Tests
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Unit tests for pricing rule evaluation and action application
 */

import { Pool } from 'pg';
import { PricingRuleEngineService } from '../services/pricing-rule-engine.service';
import { PricingAction, PricingRuleType } from '../interfaces/quote-pricing.interface';

// Mock database pool
const mockQuery = jest.fn();
const mockDb = {
  query: mockQuery
} as unknown as Pool;

describe('PricingRuleEngineService', () => {
  let service: PricingRuleEngineService;

  beforeEach(() => {
    service = new PricingRuleEngineService(mockDb);
    jest.clearAllMocks();
  });

  describe('evaluatePricingRules', () => {
    it('should return base price when no rules match', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [] // No matching rules
      });

      const result = await service.evaluatePricingRules({
        tenantId: 'tenant-1',
        productId: 'product-1',
        productCategory: 'LABELS',
        customerId: 'customer-1',
        customerTier: 'VOLUME',
        customerType: 'DIRECT',
        quantity: 1000,
        basePrice: 100,
        quoteDate: new Date()
      });

      expect(result.finalPrice).toBe(100);
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should apply percentage discount rule', async () => {
      const mockRule = {
        id: 'rule-1',
        tenant_id: 'tenant-1',
        rule_code: 'VOL-DISCOUNT',
        rule_name: 'Volume Discount 10%',
        description: '10% off for orders > 500',
        rule_type: PricingRuleType.VOLUME_DISCOUNT,
        priority: 1,
        conditions: { minimumQuantity: 500 },
        pricing_action: PricingAction.PERCENTAGE_DISCOUNT,
        action_value: 10,
        effective_from: new Date('2025-01-01'),
        effective_to: null,
        is_active: true
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockRule]
      });

      const result = await service.evaluatePricingRules({
        tenantId: 'tenant-1',
        productId: 'product-1',
        productCategory: 'LABELS',
        customerId: 'customer-1',
        customerTier: null,
        customerType: null,
        quantity: 1000,
        basePrice: 100,
        quoteDate: new Date('2025-01-15')
      });

      expect(result.finalPrice).toBe(90); // 100 - 10%
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].ruleCode).toBe('VOL-DISCOUNT');
      expect(result.appliedRules[0].discountApplied).toBe(10);
    });

    it('should apply fixed discount rule', async () => {
      const mockRule = {
        id: 'rule-2',
        tenant_id: 'tenant-1',
        rule_code: 'PROMO-5OFF',
        rule_name: 'Promotional $5 Off',
        description: '$5 off any order',
        rule_type: PricingRuleType.PROMOTIONAL,
        priority: 1,
        conditions: {},
        pricing_action: PricingAction.FIXED_DISCOUNT,
        action_value: 5,
        effective_from: new Date('2025-01-01'),
        effective_to: new Date('2025-12-31'),
        is_active: true
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockRule]
      });

      const result = await service.evaluatePricingRules({
        tenantId: 'tenant-1',
        productId: 'product-1',
        productCategory: null,
        customerId: 'customer-1',
        customerTier: null,
        customerType: null,
        quantity: 100,
        basePrice: 50,
        quoteDate: new Date('2025-06-01')
      });

      expect(result.finalPrice).toBe(45); // 50 - 5
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].discountApplied).toBe(5);
    });

    it('should apply fixed price rule', async () => {
      const mockRule = {
        id: 'rule-3',
        tenant_id: 'tenant-1',
        rule_code: 'CONTRACT-PRICE',
        rule_name: 'Contract Price',
        description: 'Fixed contract price',
        rule_type: PricingRuleType.CONTRACT_PRICING,
        priority: 1,
        conditions: { customerId: 'customer-vip' },
        pricing_action: PricingAction.FIXED_PRICE,
        action_value: 75,
        effective_from: new Date('2025-01-01'),
        effective_to: null,
        is_active: true
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockRule]
      });

      const result = await service.evaluatePricingRules({
        tenantId: 'tenant-1',
        productId: 'product-1',
        productCategory: null,
        customerId: 'customer-vip',
        customerTier: null,
        customerType: null,
        quantity: 100,
        basePrice: 100,
        quoteDate: new Date('2025-06-01')
      });

      expect(result.finalPrice).toBe(75);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].discountApplied).toBe(25); // 100 - 75
    });

    it('should apply multiple rules in priority order', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          tenant_id: 'tenant-1',
          rule_code: 'TIER-DISCOUNT',
          rule_name: 'Tier Discount 5%',
          description: '5% off for premium customers',
          rule_type: PricingRuleType.CUSTOMER_TIER,
          priority: 1,
          conditions: { customerTier: 'PREMIUM' },
          pricing_action: PricingAction.PERCENTAGE_DISCOUNT,
          action_value: 5,
          effective_from: new Date('2025-01-01'),
          effective_to: null,
          is_active: true
        },
        {
          id: 'rule-2',
          tenant_id: 'tenant-1',
          rule_code: 'VOL-DISCOUNT',
          rule_name: 'Volume Discount 10%',
          description: '10% off for orders > 500',
          rule_type: PricingRuleType.VOLUME_DISCOUNT,
          priority: 2,
          conditions: { minimumQuantity: 500 },
          pricing_action: PricingAction.PERCENTAGE_DISCOUNT,
          action_value: 10,
          effective_from: new Date('2025-01-01'),
          effective_to: null,
          is_active: true
        }
      ];

      mockQuery.mockResolvedValueOnce({
        rows: mockRules
      });

      const result = await service.evaluatePricingRules({
        tenantId: 'tenant-1',
        productId: 'product-1',
        productCategory: null,
        customerId: 'customer-1',
        customerTier: 'PREMIUM',
        customerType: null,
        quantity: 1000,
        basePrice: 100,
        quoteDate: new Date('2025-06-01')
      });

      // First rule: 100 - 5% = 95
      // Second rule: 95 - 10% = 85.5
      expect(result.finalPrice).toBe(85.5);
      expect(result.appliedRules).toHaveLength(2);
      expect(result.appliedRules[0].ruleCode).toBe('TIER-DISCOUNT');
      expect(result.appliedRules[1].ruleCode).toBe('VOL-DISCOUNT');
    });

    it('should not apply rules that do not match conditions', async () => {
      const mockRule = {
        id: 'rule-1',
        tenant_id: 'tenant-1',
        rule_code: 'VOL-DISCOUNT',
        rule_name: 'Volume Discount 10%',
        description: '10% off for orders > 1000',
        rule_type: PricingRuleType.VOLUME_DISCOUNT,
        priority: 1,
        conditions: { minimumQuantity: 1000 },
        pricing_action: PricingAction.PERCENTAGE_DISCOUNT,
        action_value: 10,
        effective_from: new Date('2025-01-01'),
        effective_to: null,
        is_active: true
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockRule]
      });

      const result = await service.evaluatePricingRules({
        tenantId: 'tenant-1',
        productId: 'product-1',
        productCategory: null,
        customerId: 'customer-1',
        customerTier: null,
        customerType: null,
        quantity: 500, // Less than minimum
        basePrice: 100,
        quoteDate: new Date('2025-06-01')
      });

      expect(result.finalPrice).toBe(100); // No discount applied
      expect(result.appliedRules).toHaveLength(0);
    });

    it('should prevent negative prices', async () => {
      const mockRule = {
        id: 'rule-1',
        tenant_id: 'tenant-1',
        rule_code: 'MASSIVE-DISCOUNT',
        rule_name: 'Massive Discount',
        description: '200% off (error)',
        rule_type: PricingRuleType.PROMOTIONAL,
        priority: 1,
        conditions: {},
        pricing_action: PricingAction.PERCENTAGE_DISCOUNT,
        action_value: 200, // More than 100%
        effective_from: new Date('2025-01-01'),
        effective_to: null,
        is_active: true
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockRule]
      });

      const result = await service.evaluatePricingRules({
        tenantId: 'tenant-1',
        productId: 'product-1',
        productCategory: null,
        customerId: 'customer-1',
        customerTier: null,
        customerType: null,
        quantity: 100,
        basePrice: 100,
        quoteDate: new Date('2025-06-01')
      });

      expect(result.finalPrice).toBe(0); // Prevented negative, capped at 0
      expect(result.appliedRules).toHaveLength(1);
    });
  });

  describe('testRuleEvaluation', () => {
    it('should test rule evaluation without applying', async () => {
      const mockRule = {
        id: 'rule-1',
        tenant_id: 'tenant-1',
        rule_code: 'VOL-DISCOUNT',
        rule_name: 'Volume Discount 10%',
        conditions: { minimumQuantity: 500 },
        pricing_action: PricingAction.PERCENTAGE_DISCOUNT,
        action_value: 10,
        is_active: true
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockRule]
      });

      const result = await service.testRuleEvaluation('rule-1', {
        quantity: 1000,
        basePrice: 100
      });

      expect(result.matches).toBe(true);
      expect(result.finalPrice).toBe(90);
      expect(result.discountApplied).toBe(10);
    });
  });
});
