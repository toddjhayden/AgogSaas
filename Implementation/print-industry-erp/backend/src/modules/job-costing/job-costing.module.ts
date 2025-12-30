/**
 * Job Costing Module
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * Handles job costing operations including:
 * - Job cost initialization from estimates
 * - Actual cost tracking and updates
 * - Incremental cost updates from production
 * - Variance analysis and reporting
 * - Profitability tracking
 * - Cost reconciliation workflows
 */

import { Module } from '@nestjs/common';
import { JobCostingResolver } from '../../graphql/resolvers/job-costing.resolver';
import { JobCostingService } from './services/job-costing.service';

@Module({
  providers: [
    JobCostingResolver,
    JobCostingService,
  ],
  exports: [
    JobCostingService,
  ],
})
export class JobCostingModule {}
