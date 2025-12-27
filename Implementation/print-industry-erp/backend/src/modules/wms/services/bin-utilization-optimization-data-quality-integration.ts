/**
 * Bin Utilization Optimization - Data Quality Integration
 *
 * Author: Roy (Backend Developer)
 * Requirement: REQ-STRATEGIC-AUTO-1766545799451
 * Purpose: Integrate data quality validation into bin utilization optimization
 * Reference: Sylvia critique lines 1291-1317
 *
 * This module extends the base optimization service to:
 * - Record capacity validation failures
 * - Send alerts for capacity violations
 * - Integrate dimension verification workflow
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import {
  BinOptimizationDataQualityService,
  CapacityValidationFailure,
} from './bin-optimization-data-quality.service';

export interface CapacityValidationResult {
  canFit: boolean;
  volumeRemaining: number;
  weightRemaining: number;
  volumeUtilizationPct: number;
  weightUtilizationPct: number;
  validationFailure?: CapacityValidationFailure;
}

/**
 * Enhanced capacity validation with automatic failure tracking
 */
@Injectable()
export class BinUtilizationOptimizationDataQualityIntegrationService {
  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    private readonly dataQualityService: BinOptimizationDataQualityService
  ) {}

  /**
   * Validate capacity and record failures
   * Reference: Sylvia critique lines 1291-1317
   */
  async validateCapacityWithTracking(
    location: {
      locationId: string;
      locationCode: string;
      totalCubicFeet: number;
      totalWeightLbs: number;
      usedCubicFeet: number;
      usedWeightLbs: number;
    },
    material: {
      materialId: string;
      materialCode: string;
      cubicFeet: number;
      weightLbsPerUnit: number;
    },
    quantity: number,
    lotNumber: string | undefined,
    tenantId: string,
    facilityId: string,
    recommendationId?: string,
    putawayUserId?: string
  ): Promise<CapacityValidationResult> {
    const requiredCubicFeet = material.cubicFeet * quantity;
    const requiredWeightLbs = material.weightLbsPerUnit * quantity;

    const availableCubicFeet = location.totalCubicFeet - location.usedCubicFeet;
    const availableWeightLbs = location.totalWeightLbs - location.usedWeightLbs;

    const volumeFits = requiredCubicFeet <= availableCubicFeet;
    const weightFits = requiredWeightLbs <= availableWeightLbs;

    const canFit = volumeFits && weightFits;

    // Calculate utilization after adding item
    const newUsedCubicFeet = location.usedCubicFeet + requiredCubicFeet;
    const newUsedWeightLbs = location.usedWeightLbs + requiredWeightLbs;

    const volumeUtilizationPct =
      location.totalCubicFeet > 0 ? (newUsedCubicFeet / location.totalCubicFeet) * 100 : 0;
    const weightUtilizationPct =
      location.totalWeightLbs > 0 ? (newUsedWeightLbs / location.totalWeightLbs) * 100 : 0;

    // If validation fails, record it
    if (!canFit) {
      const failure: CapacityValidationFailure = {
        locationId: location.locationId,
        locationCode: location.locationCode,
        materialId: material.materialId,
        materialCode: material.materialCode,
        lotNumber,
        requiredCubicFeet,
        availableCubicFeet,
        requiredWeightLbs,
        availableWeightLbs,
        failureType: !volumeFits && !weightFits
          ? 'BOTH_EXCEEDED'
          : !volumeFits
          ? 'CUBIC_FEET_EXCEEDED'
          : 'WEIGHT_EXCEEDED',
        cubicFeetOverflowPct:
          availableCubicFeet > 0
            ? ((requiredCubicFeet - availableCubicFeet) / availableCubicFeet) * 100
            : 100,
        weightOverflowPct:
          availableWeightLbs > 0
            ? ((requiredWeightLbs - availableWeightLbs) / availableWeightLbs) * 100
            : 100,
      };

      // Record failure asynchronously (don't block the response)
      this.recordFailureAsync(
        failure,
        tenantId,
        facilityId,
        recommendationId,
        putawayUserId
      );

      return {
        canFit: false,
        volumeRemaining: availableCubicFeet - requiredCubicFeet,
        weightRemaining: availableWeightLbs - requiredWeightLbs,
        volumeUtilizationPct,
        weightUtilizationPct,
        validationFailure: failure,
      };
    }

    return {
      canFit: true,
      volumeRemaining: availableCubicFeet - requiredCubicFeet,
      weightRemaining: availableWeightLbs - requiredWeightLbs,
      volumeUtilizationPct,
      weightUtilizationPct,
    };
  }

  /**
   * Record capacity validation failure asynchronously
   */
  private async recordFailureAsync(
    failure: CapacityValidationFailure,
    tenantId: string,
    facilityId: string,
    recommendationId?: string,
    putawayUserId?: string
  ): Promise<void> {
    try {
      await this.dataQualityService.recordCapacityValidationFailure(
        failure,
        tenantId,
        facilityId,
        recommendationId,
        putawayUserId
      );
    } catch (error) {
      // Log error but don't throw - capacity validation failure recording
      // should not break the main flow
      console.error('Failed to record capacity validation failure:', error);
    }
  }

  /**
   * Check if material needs dimension verification
   * Returns true if material has never been verified or last verification is >90 days old
   */
  async needsDimensionVerification(
    materialId: string,
    facilityId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT
          MAX(verified_at) as last_verified
        FROM material_dimension_verifications
        WHERE material_id = $1
          AND facility_id = $2
          AND tenant_id = $3
          AND verification_status IN ('VERIFIED', 'MASTER_DATA_UPDATED')`,
        [materialId, facilityId, tenantId]
      );

      const lastVerified = result.rows[0]?.last_verified;

      if (!lastVerified) {
        return true; // Never verified
      }

      const daysSinceVerification = Math.floor(
        (Date.now() - new Date(lastVerified).getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysSinceVerification > 90; // Re-verify every 90 days
    } catch (error) {
      console.error('Failed to check dimension verification status:', error);
      return false; // Default to not blocking putaway
    }
  }

  /**
   * Get data quality summary for a facility
   */
  async getDataQualitySummary(tenantId: string, facilityId: string): Promise<{
    capacityFailuresLast24Hours: number;
    unresolvedCapacityFailures: number;
    materialsNeedingVerification: number;
    pendingCrossDockRelocations: number;
  }> {
    try {
      const result = await this.pool.query(
        `SELECT
          COUNT(DISTINCT CASE
            WHEN cvf.created_at >= NOW() - INTERVAL '24 hours'
            THEN cvf.failure_id END
          ) as capacity_failures_24h,

          COUNT(DISTINCT CASE
            WHEN cvf.resolved = FALSE
            THEN cvf.failure_id END
          ) as unresolved_failures,

          COUNT(DISTINCT CASE
            WHEN cdc.relocation_completed = FALSE
            THEN cdc.cancellation_id END
          ) as pending_relocations

        FROM facilities f
        LEFT JOIN capacity_validation_failures cvf
          ON f.facility_id = cvf.facility_id AND f.tenant_id = cvf.tenant_id
        LEFT JOIN cross_dock_cancellations cdc
          ON f.facility_id = cdc.facility_id AND f.tenant_id = cdc.tenant_id

        WHERE f.facility_id = $1 AND f.tenant_id = $2`,
        [facilityId, tenantId]
      );

      // Get count of materials needing verification (never verified or >90 days old)
      const verificationResult = await this.pool.query(
        `SELECT COUNT(DISTINCT m.material_id) as materials_needing_verification
        FROM materials m
        INNER JOIN lots l ON m.material_id = l.material_id
        LEFT JOIN material_dimension_verifications mdv
          ON m.material_id = mdv.material_id
          AND mdv.facility_id = $1
          AND mdv.verified_at >= NOW() - INTERVAL '90 days'
        WHERE l.facility_id = $1
          AND l.tenant_id = $2
          AND l.deleted_at IS NULL
          AND mdv.verification_id IS NULL`,
        [facilityId, tenantId]
      );

      return {
        capacityFailuresLast24Hours: parseInt(result.rows[0]?.capacity_failures_24h) || 0,
        unresolvedCapacityFailures: parseInt(result.rows[0]?.unresolved_failures) || 0,
        materialsNeedingVerification:
          parseInt(verificationResult.rows[0]?.materials_needing_verification) || 0,
        pendingCrossDockRelocations: parseInt(result.rows[0]?.pending_relocations) || 0,
      };
    } catch (error) {
      console.error('Failed to get data quality summary:', error);
      return {
        capacityFailuresLast24Hours: 0,
        unresolvedCapacityFailures: 0,
        materialsNeedingVerification: 0,
        pendingCrossDockRelocations: 0,
      };
    }
  }
}
