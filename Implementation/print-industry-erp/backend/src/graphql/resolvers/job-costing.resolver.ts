/**
 * Job Costing GraphQL Resolver
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * Maps GraphQL operations for job costing to JobCostingService methods,
 * handles variance analysis, profitability reporting, and real-time updates.
 */

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { JobCostingService } from '../../modules/job-costing/services/job-costing.service';

@Resolver('JobCost')
export class JobCostingResolver {
  private readonly logger = new Logger(JobCostingResolver.name);

  constructor(
    private readonly jobCostingService: JobCostingService
  ) {}

  // =====================================================
  // QUERIES
  // =====================================================

  @Query('jobCost')
  async getJobCost(
    @Args('jobCostId') jobCostId: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Query: jobCost(${jobCostId})`);
    const result = await this.jobCostingService.getJobCost(jobCostId, tenantId);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Query('jobCosts')
  async listJobCosts(
    @Args('filters') filters: any,
    @Args('limit') limit?: number,
    @Args('offset') offset?: number
  ) {
    this.logger.log(`Query: jobCosts with filters`);
    const result = await this.jobCostingService.listJobCosts(
      filters,
      limit || 50,
      offset || 0
    );

    return result.jobCosts;
  }

  @Query('jobProfitability')
  async getJobProfitability(
    @Args('jobId') jobId: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Query: jobProfitability(${jobId})`);
    const profitability = await this.jobCostingService.getJobProfitabilityByJobId(
      jobId,
      tenantId
    );

    if (!profitability) {
      throw new Error('Job profitability data not found');
    }

    return profitability;
  }

  @Query('varianceReport')
  async generateVarianceReport(
    @Args('filters') filters: any
  ) {
    this.logger.log(`Query: varianceReport with filters`);
    const result = await this.jobCostingService.generateVarianceReport(filters);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.report;
  }

  @Query('jobCostHistory')
  async getJobCostHistory(
    @Args('jobCostId') jobCostId: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Query: jobCostHistory(${jobCostId})`);
    return await this.jobCostingService.getJobCostHistory(jobCostId, tenantId);
  }

  // =====================================================
  // MUTATIONS
  // =====================================================

  @Mutation('initializeJobCost')
  async initializeJobCost(@Args('input') input: any) {
    this.logger.log(`Mutation: initializeJobCost for job ${input.jobId}`);
    const result = await this.jobCostingService.initializeJobCost(input);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Mutation('updateActualCosts')
  async updateActualCosts(
    @Args('jobCostId') jobCostId: string,
    @Args('tenantId') tenantId: string,
    @Args('input') input: any
  ) {
    this.logger.log(`Mutation: updateActualCosts(${jobCostId})`);
    const result = await this.jobCostingService.updateActualCosts(
      jobCostId,
      tenantId,
      input
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Mutation('incrementCost')
  async incrementCost(@Args('input') input: any) {
    this.logger.log(`Mutation: incrementCost for job cost ${input.jobCostId}`);
    const result = await this.jobCostingService.incrementCost(
      input.tenantId,
      input
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Mutation('rollupProductionCosts')
  async rollupProductionCosts(@Args('input') input: any) {
    this.logger.log(`Mutation: rollupProductionCosts for job ${input.jobId}`);
    const result = await this.jobCostingService.rollupProductionCosts(
      input.tenantId,
      input
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Mutation('addFinalAdjustment')
  async addFinalAdjustment(@Args('input') input: any) {
    this.logger.log(`Mutation: addFinalAdjustment to job cost ${input.jobCostId}`);
    const result = await this.jobCostingService.addFinalAdjustment(
      input.tenantId,
      input
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Mutation('reconcileJobCost')
  async reconcileJobCost(@Args('input') input: any) {
    this.logger.log(`Mutation: reconcileJobCost(${input.jobCostId})`);
    const result = await this.jobCostingService.reconcileJobCost(
      input.tenantId,
      input
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Mutation('closeJobCosting')
  async closeJobCosting(@Args('input') input: any) {
    this.logger.log(`Mutation: closeJobCosting(${input.jobCostId})`);
    const result = await this.jobCostingService.closeJobCosting(
      input.tenantId,
      input
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }

  @Mutation('updateJobCostStatus')
  async updateJobCostStatus(
    @Args('jobCostId') jobCostId: string,
    @Args('tenantId') tenantId: string,
    @Args('input') input: any
  ) {
    this.logger.log(`Mutation: updateJobCostStatus(${jobCostId})`);
    const result = await this.jobCostingService.updateJobCostStatus(
      jobCostId,
      tenantId,
      input
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.jobCost;
  }
}
