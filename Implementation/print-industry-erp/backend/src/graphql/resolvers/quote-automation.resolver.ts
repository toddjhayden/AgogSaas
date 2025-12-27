/**
 * Quote Automation Resolver
 * REQ-STRATEGIC-AUTO-1735253018773: Sales Quote Automation
 *
 * GraphQL resolver that exposes quote automation services through GraphQL API.
 * Implements quote line management, automated pricing, and margin validation.
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { QuoteManagementService } from '../../modules/sales/services/quote-management.service';
import { QuotePricingService } from '../../modules/sales/services/quote-pricing.service';
import { PricingRuleEngineService } from '../../modules/sales/services/pricing-rule-engine.service';

@Resolver('QuoteAutomation')
export class QuoteAutomationResolver {
  private readonly quoteManagementService: QuoteManagementService;
  private readonly quotePricingService: QuotePricingService;
  private readonly pricingRuleEngine: PricingRuleEngineService;

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {
    this.quoteManagementService = new QuoteManagementService(db);
    this.quotePricingService = new QuotePricingService(db);
    this.pricingRuleEngine = new PricingRuleEngineService(db);
  }

  // =====================================================
  // QUOTE AUTOMATION QUERIES
  // =====================================================

  /**
   * Preview pricing for a product without creating a quote line
   */
  @Query('previewQuoteLinePricing')
  async previewQuoteLinePricing(
    @Args('tenantId') tenantId: string,
    @Args('productId') productId: string,
    @Args('customerId') customerId: string,
    @Args('quantity') quantity: number,
    @Args('quoteDate') quoteDate?: Date
  ) {
    const result = await this.quotePricingService.calculateQuoteLinePricing({
      tenantId,
      productId,
      customerId,
      quantity,
      quoteDate: quoteDate || new Date()
    });

    return {
      unitPrice: result.unitPrice,
      lineAmount: result.lineAmount,
      discountPercentage: result.discountPercentage,
      discountAmount: result.discountAmount,
      unitCost: result.unitCost,
      lineCost: result.lineCost,
      lineMargin: result.lineMargin,
      marginPercentage: result.marginPercentage,
      appliedRules: result.appliedRules.map(rule => ({
        ruleId: rule.ruleId,
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        pricingAction: rule.pricingAction,
        actionValue: rule.actionValue,
        priority: rule.priority,
        discountApplied: rule.discountApplied
      })),
      priceSource: result.priceSource
    };
  }

  /**
   * Preview cost calculation for a product
   */
  @Query('previewProductCost')
  async previewProductCost(
    @Args('tenantId') tenantId: string,
    @Args('productId') productId: string,
    @Args('quantity') quantity: number
  ) {
    const costingService = this.quotePricingService['costingService'];
    const result = await costingService.calculateProductCost({
      tenantId,
      productId,
      quantity,
      asOfDate: new Date()
    });

    return {
      unitCost: result.unitCost,
      totalCost: result.totalCost,
      materialCost: result.materialCost,
      laborCost: result.laborCost,
      overheadCost: result.overheadCost,
      setupCost: result.setupCost,
      setupCostPerUnit: result.setupCostPerUnit,
      costMethod: result.costMethod,
      costBreakdown: result.costBreakdown.map(comp => ({
        componentType: comp.componentType,
        componentCode: comp.componentCode,
        componentName: comp.componentName,
        quantity: comp.quantity,
        unitOfMeasure: comp.unitOfMeasure,
        unitCost: comp.unitCost,
        totalCost: comp.totalCost,
        scrapPercentage: comp.scrapPercentage
      }))
    };
  }

  /**
   * Test pricing rule evaluation (for admin UI)
   */
  @Query('testPricingRule')
  async testPricingRule(
    @Args('ruleId') ruleId: string,
    @Args('productId') productId: string | null,
    @Args('customerId') customerId: string | null,
    @Args('quantity') quantity: number | null,
    @Args('basePrice') basePrice: number
  ) {
    const result = await this.pricingRuleEngine.testRuleEvaluation(ruleId, {
      productId: productId || undefined,
      customerId: customerId || undefined,
      quantity: quantity || undefined,
      basePrice
    });

    return {
      matches: result.matches,
      finalPrice: result.finalPrice,
      discountApplied: result.discountApplied
    };
  }

  // =====================================================
  // QUOTE AUTOMATION MUTATIONS
  // =====================================================

  /**
   * Create quote with automated line calculations
   */
  @Mutation('createQuoteWithLines')
  async createQuoteWithLines(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req?.user?.id || 'system';

    // First, create the quote header
    const quote = await this.quoteManagementService.createQuote({
      tenantId: input.tenantId,
      facilityId: input.facilityId,
      customerId: input.customerId,
      quoteDate: input.quoteDate,
      expirationDate: input.expirationDate,
      quoteCurrencyCode: input.quoteCurrencyCode,
      salesRepUserId: input.salesRepUserId,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      notes: input.notes,
      termsAndConditions: input.termsAndConditions,
      createdBy: userId
    });

    // Then, add each quote line
    if (input.lines && input.lines.length > 0) {
      for (const lineInput of input.lines) {
        await this.quoteManagementService.addQuoteLine({
          quoteId: quote.id,
          productId: lineInput.productId,
          quantityQuoted: lineInput.quantityQuoted,
          unitOfMeasure: lineInput.unitOfMeasure,
          description: lineInput.description,
          manufacturingStrategy: lineInput.manufacturingStrategy,
          leadTimeDays: lineInput.leadTimeDays,
          promisedDeliveryDate: lineInput.promisedDeliveryDate,
          manualUnitPrice: lineInput.manualUnitPrice
        });
      }
    }

    // Return the complete quote with lines
    return this.quoteManagementService.getQuote(quote.id);
  }

  /**
   * Add quote line with automatic pricing/costing
   */
  @Mutation('addQuoteLine')
  async addQuoteLine(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const result = await this.quoteManagementService.addQuoteLine({
      quoteId: input.quoteId,
      productId: input.productId,
      quantityQuoted: input.quantityQuoted,
      unitOfMeasure: input.unitOfMeasure,
      description: input.description,
      manufacturingStrategy: input.manufacturingStrategy,
      leadTimeDays: input.leadTimeDays,
      promisedDeliveryDate: input.promisedDeliveryDate,
      manualUnitPrice: input.manualUnitPrice,
      manualDiscountPercentage: input.manualDiscountPercentage
    });

    return {
      id: result.id,
      tenantId: result.tenantId,
      quoteId: result.quoteId,
      lineNumber: result.lineNumber,
      productId: result.productId,
      productCode: result.productCode,
      description: result.description,
      quantityQuoted: result.quantityQuoted,
      unitOfMeasure: result.unitOfMeasure,
      unitPrice: result.unitPrice,
      lineAmount: result.lineAmount,
      discountPercentage: result.discountPercentage,
      discountAmount: result.discountAmount,
      unitCost: result.unitCost,
      lineCost: result.lineCost,
      lineMargin: result.lineMargin,
      marginPercentage: result.marginPercentage,
      manufacturingStrategy: result.manufacturingStrategy,
      leadTimeDays: result.leadTimeDays,
      promisedDeliveryDate: result.promisedDeliveryDate,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    };
  }

  /**
   * Update quote line and recalculate
   */
  @Mutation('updateQuoteLine')
  async updateQuoteLine(
    @Args('input') input: any,
    @Context() context: any
  ) {
    const result = await this.quoteManagementService.updateQuoteLine({
      quoteLineId: input.quoteLineId,
      quantityQuoted: input.quantityQuoted,
      unitOfMeasure: input.unitOfMeasure,
      description: input.description,
      manufacturingStrategy: input.manufacturingStrategy,
      leadTimeDays: input.leadTimeDays,
      promisedDeliveryDate: input.promisedDeliveryDate,
      manualUnitPrice: input.manualUnitPrice,
      manualDiscountPercentage: input.manualDiscountPercentage
    });

    return {
      id: result.id,
      tenantId: result.tenantId,
      quoteId: result.quoteId,
      lineNumber: result.lineNumber,
      productId: result.productId,
      productCode: result.productCode,
      description: result.description,
      quantityQuoted: result.quantityQuoted,
      unitOfMeasure: result.unitOfMeasure,
      unitPrice: result.unitPrice,
      lineAmount: result.lineAmount,
      discountPercentage: result.discountPercentage,
      discountAmount: result.discountAmount,
      unitCost: result.unitCost,
      lineCost: result.lineCost,
      lineMargin: result.lineMargin,
      marginPercentage: result.marginPercentage,
      manufacturingStrategy: result.manufacturingStrategy,
      leadTimeDays: result.leadTimeDays,
      promisedDeliveryDate: result.promisedDeliveryDate,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    };
  }

  /**
   * Delete quote line and recalculate quote totals
   */
  @Mutation('deleteQuoteLine')
  async deleteQuoteLine(
    @Args('quoteLineId') quoteLineId: string,
    @Context() context: any
  ) {
    await this.quoteManagementService.deleteQuoteLine({ quoteLineId });
    return true;
  }

  /**
   * Recalculate all pricing and costs for a quote
   */
  @Mutation('recalculateQuote')
  async recalculateQuote(
    @Args('quoteId') quoteId: string,
    @Args('recalculateCosts') recalculateCosts: boolean = true,
    @Args('recalculatePricing') recalculatePricing: boolean = true,
    @Context() context: any
  ) {
    const result = await this.quoteManagementService.recalculateQuote({
      quoteId,
      recalculateCosts,
      recalculatePricing
    });

    return {
      id: result.id,
      tenantId: result.tenantId,
      facilityId: result.facilityId,
      quoteNumber: result.quoteNumber,
      quoteDate: result.quoteDate,
      expirationDate: result.expirationDate,
      customerId: result.customerId,
      contactName: result.contactName,
      contactEmail: result.contactEmail,
      salesRepUserId: result.salesRepUserId,
      quoteCurrencyCode: result.quoteCurrencyCode,
      subtotal: result.subtotal,
      taxAmount: result.taxAmount,
      shippingAmount: result.shippingAmount,
      discountAmount: result.discountAmount,
      totalAmount: result.totalAmount,
      totalCost: result.totalCost,
      marginAmount: result.marginAmount,
      marginPercentage: result.marginPercentage,
      status: result.status,
      convertedToSalesOrderId: result.convertedToSalesOrderId,
      convertedAt: result.convertedAt,
      notes: result.notes,
      termsAndConditions: result.termsAndConditions,
      lines: result.lines,
      createdAt: result.createdAt,
      createdBy: result.createdBy,
      updatedAt: result.updatedAt,
      updatedBy: result.updatedBy
    };
  }

  /**
   * Validate quote margin requirements
   */
  @Mutation('validateQuoteMargin')
  async validateQuoteMargin(
    @Args('quoteId') quoteId: string,
    @Context() context: any
  ) {
    const quote = await this.quoteManagementService.getQuote(quoteId);

    const validation = await this.quoteManagementService.validateMargin({
      lineMarginPercentage: quote.marginPercentage
    });

    return {
      isValid: validation.isValid,
      minimumMarginPercentage: validation.minimumMarginPercentage,
      actualMarginPercentage: validation.actualMarginPercentage,
      requiresApproval: validation.requiresApproval,
      approvalLevel: validation.approvalLevel
    };
  }
}
