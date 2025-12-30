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
 * - Real-time quote collaboration (REQ-STRATEGIC-AUTO-1767108044308)
 *
 * Related Resolvers:
 * - SalesMaterialsResolver
 * - QuoteAutomationResolver
 * - QuoteCollaborationResolver (NEW)
 */

import { Module } from '@nestjs/common';
import { SalesMaterialsResolver } from '../../graphql/resolvers/sales-materials.resolver';
import { QuoteAutomationResolver } from '../../graphql/resolvers/quote-automation.resolver';
import { QuoteCollaborationResolver } from '../../graphql/resolvers/quote-collaboration.resolver';
import { QuoteManagementService } from './services/quote-management.service';
import { QuotePricingService } from './services/quote-pricing.service';
import { PricingRuleEngineService } from './services/pricing-rule-engine.service';
import { QuoteCostingService } from './services/quote-costing.service';
import { QuoteCollaborationService } from './services/quote-collaboration.service';
import { QuoteEventPublisherService } from './services/quote-event-publisher.service';

@Module({
  providers: [
    // Existing resolvers
    SalesMaterialsResolver,
    QuoteAutomationResolver,

    // NEW: Real-time collaboration resolver
    QuoteCollaborationResolver,

    // Existing services
    QuoteManagementService,
    QuotePricingService,
    PricingRuleEngineService,
    QuoteCostingService,

    // NEW: Collaboration services
    QuoteCollaborationService,
    QuoteEventPublisherService,
  ],
  exports: [
    QuoteManagementService,
    QuotePricingService,
    PricingRuleEngineService,
    QuoteCostingService,
    QuoteCollaborationService,
    QuoteEventPublisherService,
  ],
})
export class SalesModule {}
