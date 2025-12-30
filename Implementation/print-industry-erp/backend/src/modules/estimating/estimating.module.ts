/**
 * Estimating Module
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * Handles estimating operations including:
 * - Estimate creation and management
 * - Operations and materials tracking
 * - Cost calculations and rollups
 * - Template management
 * - Quote conversion workflow
 * - Approval workflows
 */

import { Module } from '@nestjs/common';
import { EstimatingResolver } from '../../graphql/resolvers/estimating.resolver';
import { EstimatingService } from './services/estimating.service';

@Module({
  providers: [
    EstimatingResolver,
    EstimatingService,
  ],
  exports: [
    EstimatingService,
  ],
})
export class EstimatingModule {}
