/**
 * Estimating GraphQL Resolver
 * REQ-STRATEGIC-AUTO-1767066329938: Complete Estimating & Job Costing Module
 *
 * Maps GraphQL operations to EstimatingService methods, handles input validation,
 * and transforms responses for the GraphQL API.
 */

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { EstimatingService } from '../../modules/estimating/services/estimating.service';

@Resolver('Estimate')
export class EstimatingResolver {
  private readonly logger = new Logger(EstimatingResolver.name);

  constructor(private readonly estimatingService: EstimatingService) {}

  // =====================================================
  // QUERIES
  // =====================================================

  @Query('estimate')
  async getEstimate(
    @Args('estimateId') estimateId: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Query: estimate(${estimateId})`);
    const result = await this.estimatingService.getEstimate(estimateId, tenantId);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.estimate;
  }

  @Query('estimateByNumber')
  async getEstimateByNumber(
    @Args('estimateNumber') estimateNumber: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Query: estimateByNumber(${estimateNumber})`);
    const result = await this.estimatingService.getEstimateByNumber(estimateNumber, tenantId);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.estimate;
  }

  @Query('estimates')
  async listEstimates(
    @Args('filters') filters: any,
    @Args('limit') limit?: number,
    @Args('offset') offset?: number
  ) {
    this.logger.log(`Query: estimates with filters`);
    const result = await this.estimatingService.listEstimates(
      filters,
      limit || 50,
      offset || 0
    );

    return result.estimates;
  }

  @Query('estimateTemplates')
  async getEstimateTemplates(
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Query: estimateTemplates for tenant ${tenantId}`);
    const result = await this.estimatingService.listEstimates(
      { tenantId, isTemplate: true },
      100,
      0
    );

    return result.estimates;
  }

  // =====================================================
  // MUTATIONS - Estimate CRUD
  // =====================================================

  @Mutation('createEstimate')
  async createEstimate(@Args('input') input: any) {
    this.logger.log(`Mutation: createEstimate`);
    const result = await this.estimatingService.createEstimate(input);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.estimate;
  }

  @Mutation('updateEstimate')
  async updateEstimate(
    @Args('estimateId') estimateId: string,
    @Args('tenantId') tenantId: string,
    @Args('input') input: any
  ) {
    this.logger.log(`Mutation: updateEstimate(${estimateId})`);
    const result = await this.estimatingService.updateEstimate(estimateId, tenantId, input);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.estimate;
  }

  @Mutation('deleteEstimate')
  async deleteEstimate(
    @Args('estimateId') estimateId: string,
    @Args('tenantId') tenantId: string,
    @Args('deletedBy') deletedBy?: string
  ) {
    this.logger.log(`Mutation: deleteEstimate(${estimateId})`);
    return await this.estimatingService.deleteEstimate(estimateId, tenantId, deletedBy);
  }

  // =====================================================
  // MUTATIONS - Operations
  // =====================================================

  @Mutation('addEstimateOperation')
  async addEstimateOperation(@Args('input') input: any) {
    this.logger.log(`Mutation: addEstimateOperation to estimate ${input.estimateId}`);
    const result = await this.estimatingService.addOperation(input);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.operation;
  }

  @Mutation('updateEstimateOperation')
  async updateEstimateOperation(
    @Args('operationId') operationId: string,
    @Args('tenantId') tenantId: string,
    @Args('input') input: any
  ) {
    this.logger.log(`Mutation: updateEstimateOperation(${operationId})`);
    const result = await this.estimatingService.updateOperation(operationId, tenantId, input);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.operation;
  }

  @Mutation('deleteEstimateOperation')
  async deleteEstimateOperation(
    @Args('operationId') operationId: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Mutation: deleteEstimateOperation(${operationId})`);
    return await this.estimatingService.deleteOperation(operationId, tenantId);
  }

  // =====================================================
  // MUTATIONS - Materials
  // =====================================================

  @Mutation('addEstimateMaterial')
  async addEstimateMaterial(@Args('input') input: any) {
    this.logger.log(`Mutation: addEstimateMaterial to estimate ${input.estimateId}`);
    const result = await this.estimatingService.addMaterial(input);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.material;
  }

  @Mutation('deleteEstimateMaterial')
  async deleteEstimateMaterial(
    @Args('materialId') materialId: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Mutation: deleteEstimateMaterial(${materialId})`);
    return await this.estimatingService.deleteMaterial(materialId, tenantId);
  }

  // =====================================================
  // MUTATIONS - Cost Calculations
  // =====================================================

  @Mutation('recalculateEstimate')
  async recalculateEstimate(
    @Args('estimateId') estimateId: string,
    @Args('tenantId') tenantId: string
  ) {
    this.logger.log(`Mutation: recalculateEstimate(${estimateId})`);
    const result = await this.estimatingService.recalculateEstimate(estimateId, tenantId);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.estimate;
  }

  // =====================================================
  // MUTATIONS - Workflow
  // =====================================================

  @Mutation('approveEstimate')
  async approveEstimate(
    @Args('estimateId') estimateId: string,
    @Args('tenantId') tenantId: string,
    @Args('approvedBy') approvedBy?: string
  ) {
    this.logger.log(`Mutation: approveEstimate(${estimateId})`);
    const result = await this.estimatingService.approveEstimate(estimateId, tenantId, approvedBy);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.estimate;
  }

  @Mutation('rejectEstimate')
  async rejectEstimate(
    @Args('estimateId') estimateId: string,
    @Args('tenantId') tenantId: string,
    @Args('reason') reason?: string,
    @Args('rejectedBy') rejectedBy?: string
  ) {
    this.logger.log(`Mutation: rejectEstimate(${estimateId})`);
    const result = await this.estimatingService.rejectEstimate(estimateId, tenantId, reason, rejectedBy);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result.estimate;
  }
}
