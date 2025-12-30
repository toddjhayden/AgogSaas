/**
 * Cost Allocation Service
 * REQ-STRATEGIC-AUTO-1767066329940
 *
 * Handles job costing and overhead allocation (Stub for Phase 2)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class CostAllocationService {
  private readonly logger = new Logger(CostAllocationService.name);

  constructor(private readonly db: Pool) {}

  /**
   * Create cost allocation rule
   * TODO: Implement in Phase 2 (Job Costing)
   */
  async createAllocationRule(dto: any, userId: string): Promise<any> {
    this.logger.warn('CostAllocationService.createAllocationRule not yet implemented (Phase 2)');
    throw new Error('Cost allocation service will be implemented in Phase 2');
  }

  /**
   * Run cost allocation for job
   * TODO: Implement in Phase 2 (Job Costing)
   */
  async runAllocation(jobId: string, userId: string): Promise<any> {
    this.logger.warn('CostAllocationService.runAllocation not yet implemented (Phase 2)');
    throw new Error('Cost allocation service will be implemented in Phase 2');
  }
}
