/**
 * Sales Module
 *
 * Handles sales, materials, and procurement operations including:
 * - Materials management with ABC classification and costing
 * - Product master with BOM and manufacturing specs
 * - Quote-to-order conversion workflow
 * - Sales order lifecycle management
 * - Dynamic pricing rules engine
 * - Customer management with credit controls
 *
 * Related Resolvers:
 * - SalesMaterialsResolver
 * - QuoteAutomationResolver
 */

import { Module } from '@nestjs/common';
import { SalesMaterialsResolver } from '../../graphql/resolvers/sales-materials.resolver';
import { QuoteAutomationResolver } from '../../graphql/resolvers/quote-automation.resolver';
import { QuoteManagementService } from './services/quote-management.service';
import { QuotePricingService } from './services/quote-pricing.service';
import { PricingRuleEngineService } from './services/pricing-rule-engine.service';
import { QuoteCostingService } from './services/quote-costing.service';

@Module({
  providers: [
    SalesMaterialsResolver,
    QuoteAutomationResolver,
    QuoteManagementService,
    QuotePricingService,
    PricingRuleEngineService,
    QuoteCostingService,
  ],
  exports: [
    QuoteManagementService,
    QuotePricingService,
    PricingRuleEngineService,
    QuoteCostingService,
  ],
})
export class SalesModule {}
