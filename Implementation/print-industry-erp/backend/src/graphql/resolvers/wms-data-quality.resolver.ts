/**
 * WMS Data Quality GraphQL Resolvers
 *
 * Author: Roy (Backend Developer)
 * Requirement: REQ-STRATEGIC-AUTO-1766545799451
 * Purpose: GraphQL resolvers for bin optimization data quality features
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  BinOptimizationDataQualityService,
  DimensionVerificationInput,
  CrossDockCancellationInput,
} from '../../modules/wms/services/bin-optimization-data-quality.service';
import { BinOptimizationHealthEnhancedService } from '../../modules/wms/services/bin-optimization-health-enhanced.service';

@Resolver()
export class WmsDataQualityResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    private readonly dataQualityService: BinOptimizationDataQualityService,
    private readonly healthEnhancedService: BinOptimizationHealthEnhancedService
  ) {}

  // =====================================================
  // QUERIES
  // =====================================================

  @Query('getDataQualityMetrics')
  async getDataQualityMetrics(
    @Args('facilityId') facilityId: string | null,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    try {
      return await this.dataQualityService.getDataQualityMetrics(tenantId, facilityId ?? undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get data quality metrics: ${message}`);
    }
  }

  @Query('getMaterialDimensionVerifications')
  async getMaterialDimensionVerifications(
    @Args('materialId') materialId: string,
    @Args('facilityId') facilityId: string | null,
    @Args('limit') limit: number | null,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    try {
      let query = `
        SELECT
          verification_id,
          material_id,
          facility_id,
          master_cubic_feet,
          master_weight_lbs,
          measured_cubic_feet,
          measured_weight_lbs,
          cubic_feet_variance_pct,
          weight_variance_pct,
          verification_status,
          variance_threshold_exceeded,
          auto_updated_master_data,
          verified_by,
          verified_at,
          notes
        FROM material_dimension_verifications
        WHERE tenant_id = $1 AND material_id = $2
      `;

      const params: any[] = [tenantId, materialId];

      if (facilityId) {
        query += ` AND facility_id = $3`;
        params.push(facilityId);
      }

      query += ` ORDER BY verified_at DESC LIMIT $${params.length + 1}`;
      params.push(limit || 10);

      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        verificationId: row.verification_id,
        materialId: row.material_id,
        facilityId: row.facility_id,
        masterCubicFeet: row.master_cubic_feet,
        masterWeightLbs: row.master_weight_lbs,
        measuredCubicFeet: row.measured_cubic_feet,
        measuredWeightLbs: row.measured_weight_lbs,
        cubicFeetVariancePct: row.cubic_feet_variance_pct,
        weightVariancePct: row.weight_variance_pct,
        verificationStatus: row.verification_status,
        varianceThresholdExceeded: row.variance_threshold_exceeded,
        autoUpdatedMasterData: row.auto_updated_master_data,
        verifiedBy: row.verified_by,
        verifiedAt: row.verified_at.toISOString(),
        notes: row.notes,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get dimension verifications: ${message}`);
    }
  }

  @Query('getCapacityValidationFailures')
  async getCapacityValidationFailures(
    @Args('facilityId') facilityId: string | null,
    @Args('resolved') resolved: boolean | null,
    @Args('limit') limit: number | null,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    try {
      let query = `
        SELECT
          cvf.failure_id,
          cvf.location_id,
          il.location_code,
          cvf.material_id,
          m.material_code,
          cvf.lot_number,
          cvf.required_cubic_feet,
          cvf.available_cubic_feet,
          cvf.required_weight_lbs,
          cvf.available_weight_lbs,
          cvf.failure_type,
          cvf.cubic_feet_overflow_pct,
          cvf.weight_overflow_pct,
          cvf.alert_sent,
          cvf.resolved,
          cvf.created_at
        FROM capacity_validation_failures cvf
        INNER JOIN inventory_locations il ON cvf.location_id = il.location_id
        INNER JOIN materials m ON cvf.material_id = m.material_id
        WHERE cvf.tenant_id = $1
      `;

      const params: any[] = [tenantId];

      if (facilityId) {
        query += ` AND cvf.facility_id = $${params.length + 1}`;
        params.push(facilityId);
      }

      if (resolved !== null && resolved !== undefined) {
        query += ` AND cvf.resolved = $${params.length + 1}`;
        params.push(resolved);
      }

      query += ` ORDER BY cvf.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit || 50);

      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        failureId: row.failure_id,
        locationId: row.location_id,
        locationCode: row.location_code,
        materialId: row.material_id,
        materialCode: row.material_code,
        lotNumber: row.lot_number,
        requiredCubicFeet: parseFloat(row.required_cubic_feet),
        availableCubicFeet: parseFloat(row.available_cubic_feet),
        requiredWeightLbs: parseFloat(row.required_weight_lbs),
        availableWeightLbs: parseFloat(row.available_weight_lbs),
        failureType: row.failure_type,
        cubicFeetOverflowPct: parseFloat(row.cubic_feet_overflow_pct),
        weightOverflowPct: parseFloat(row.weight_overflow_pct),
        alertSent: row.alert_sent,
        resolved: row.resolved,
        createdAt: row.created_at.toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get capacity failures: ${message}`);
    }
  }

  @Query('getCrossDockCancellations')
  async getCrossDockCancellations(
    @Args('facilityId') facilityId: string | null,
    @Args('relocationCompleted') relocationCompleted: boolean | null,
    @Args('limit') limit: number | null,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    try {
      let query = `
        SELECT
          cdc.cancellation_id,
          cdc.material_id,
          m.material_code,
          cdc.lot_number,
          cdc.cancellation_reason,
          cdc.new_recommended_location_id,
          il.location_code as new_recommended_location_code,
          cdc.relocation_completed,
          cdc.cancelled_at,
          cdc.cancelled_by,
          cdc.notes
        FROM cross_dock_cancellations cdc
        INNER JOIN materials m ON cdc.material_id = m.material_id
        LEFT JOIN inventory_locations il ON cdc.new_recommended_location_id = il.location_id
        WHERE cdc.tenant_id = $1
      `;

      const params: any[] = [tenantId];

      if (facilityId) {
        query += ` AND cdc.facility_id = $${params.length + 1}`;
        params.push(facilityId);
      }

      if (relocationCompleted !== null && relocationCompleted !== undefined) {
        query += ` AND cdc.relocation_completed = $${params.length + 1}`;
        params.push(relocationCompleted);
      }

      query += ` ORDER BY cdc.cancelled_at DESC LIMIT $${params.length + 1}`;
      params.push(limit || 50);

      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        cancellationId: row.cancellation_id,
        materialId: row.material_id,
        materialCode: row.material_code,
        lotNumber: row.lot_number,
        cancellationReason: row.cancellation_reason,
        newRecommendedLocationId: row.new_recommended_location_id,
        newRecommendedLocationCode: row.new_recommended_location_code,
        relocationCompleted: row.relocation_completed,
        cancelledAt: row.cancelled_at.toISOString(),
        cancelledBy: row.cancelled_by,
        notes: row.notes,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get cross-dock cancellations: ${message}`);
    }
  }

  @Query('getBinOptimizationHealthEnhanced')
  async getBinOptimizationHealthEnhanced(
    @Args('autoRemediate') autoRemediate: boolean | null,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];

    try {
      const healthCheck = await this.healthEnhancedService.checkHealth(tenantId, autoRemediate ?? true);

      return {
        status: healthCheck.status,
        message: `Health check completed. Status: ${healthCheck.status}`,
        remediationActions: healthCheck.remediationActions,
        timestamp: healthCheck.timestamp.toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to check health: ${message}`);
    }
  }

  // =====================================================
  // MUTATIONS
  // =====================================================

  @Mutation('verifyMaterialDimensions')
  async verifyMaterialDimensions(
    @Args('input') input: DimensionVerificationInput,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];
    const userId = context.userId || context.req?.user?.id;

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    if (!userId) {
      throw new Error('User ID required for verification');
    }

    try {
      return await this.dataQualityService.verifyMaterialDimensions({
        ...input,
        tenantId,
        verifiedBy: userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to verify dimensions: ${message}`);
    }
  }

  @Mutation('cancelCrossDocking')
  async cancelCrossDocking(
    @Args('input') input: CrossDockCancellationInput,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];
    const userId = context.userId || context.req?.user?.id;

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    if (!userId) {
      throw new Error('User ID required for cancellation');
    }

    try {
      return await this.dataQualityService.cancelCrossDocking({
        ...input,
        tenantId,
        cancelledBy: userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to cancel cross-docking: ${message}`);
    }
  }

  @Mutation('resolveCapacityFailure')
  async resolveCapacityFailure(
    @Args('failureId') failureId: string,
    @Args('resolutionNotes') resolutionNotes: string | null,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];
    const userId = context.userId || context.req?.user?.id;

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    if (!userId) {
      throw new Error('User ID required');
    }

    try {
      await this.pool.query(
        `UPDATE capacity_validation_failures
        SET
          resolved = TRUE,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = $1,
          resolution_notes = $2
        WHERE failure_id = $3 AND tenant_id = $4`,
        [userId, resolutionNotes, failureId, tenantId]
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to resolve capacity failure: ${message}`);
    }
  }

  @Mutation('completeCrossDockRelocation')
  async completeCrossDockRelocation(
    @Args('cancellationId') cancellationId: string,
    @Args('actualLocationId') actualLocationId: string,
    @Context() context: any,
  ) {
    const tenantId = context.tenantId || context.req?.headers['x-tenant-id'];
    const userId = context.userId || context.req?.user?.id;

    if (!tenantId) {
      throw new Error('Tenant ID required');
    }

    if (!userId) {
      throw new Error('User ID required');
    }

    try {
      await this.pool.query(
        `UPDATE cross_dock_cancellations
        SET
          relocation_completed = TRUE,
          relocation_completed_at = CURRENT_TIMESTAMP,
          relocation_completed_by = $1,
          new_recommended_location_id = $2
        WHERE cancellation_id = $3 AND tenant_id = $4`,
        [userId, actualLocationId, cancellationId, tenantId]
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to complete relocation: ${message}`);
    }
  }
}
