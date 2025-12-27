/**
 * Bin Optimization Data Quality Service
 *
 * Author: Roy (Backend Developer)
 * Requirement: REQ-STRATEGIC-AUTO-1766545799451
 * Purpose: Implement data quality validation and tracking for bin utilization algorithm
 * Reference: Sylvia critique lines 999-1049, 1267-1327
 *
 * Features:
 * - Material dimension verification workflow
 * - Capacity validation failure tracking and alerts
 * - Cross-dock cancellation handling
 * - Data quality metrics and reporting
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

// =====================================================
// INTERFACES
// =====================================================

export interface DimensionVerificationInput {
  tenantId: string;
  facilityId: string;
  materialId: string;
  measuredCubicFeet: number;
  measuredWeightLbs: number;
  measuredWidthInches?: number;
  measuredHeightInches?: number;
  measuredThicknessInches?: number;
  verifiedBy: string;
  notes?: string;
}

export interface DimensionVerificationResult {
  verificationId: string;
  success: boolean;
  cubicFeetVariancePct: number;
  weightVariancePct: number;
  varianceThresholdExceeded: boolean;
  autoUpdatedMasterData: boolean;
  verificationStatus: 'VERIFIED' | 'VARIANCE_DETECTED' | 'MASTER_DATA_UPDATED';
  message: string;
}

export interface CapacityValidationFailure {
  locationId: string;
  locationCode: string;
  materialId: string;
  materialCode: string;
  lotNumber?: string;
  requiredCubicFeet: number;
  availableCubicFeet: number;
  requiredWeightLbs: number;
  availableWeightLbs: number;
  failureType: 'CUBIC_FEET_EXCEEDED' | 'WEIGHT_EXCEEDED' | 'BOTH_EXCEEDED';
  cubicFeetOverflowPct: number;
  weightOverflowPct: number;
}

export interface CrossDockCancellationInput {
  tenantId: string;
  facilityId: string;
  materialId: string;
  lotNumber: string;
  originalRecommendationId?: string;
  originalStagingLocationId?: string;
  originalSalesOrderId?: string;
  cancellationReason: 'ORDER_CANCELLED' | 'ORDER_DELAYED' | 'QUANTITY_MISMATCH' | 'MATERIAL_QUALITY_ISSUE' | 'MANUAL_OVERRIDE';
  cancelledBy: string;
  notes?: string;
}

export interface CrossDockCancellationResult {
  cancellationId: string;
  success: boolean;
  newRecommendedLocation?: {
    locationId: string;
    locationCode: string;
  };
  message: string;
}

export interface DataQualityMetrics {
  facilityId: string;
  facilityName: string;
  materialsVerifiedCount: number;
  materialsWithVariance: number;
  avgCubicFeetVariancePct: number;
  avgWeightVariancePct: number;
  capacityFailuresCount: number;
  unresolvedFailuresCount: number;
  crossdockCancellationsCount: number;
  pendingRelocationsCount: number;
  autoRemediationCount: number;
  failedRemediationCount: number;
}

// =====================================================
// SERVICE CLASS
// =====================================================

@Injectable()
export class BinOptimizationDataQualityService {
  // Variance threshold for auto-updating master data (percentage)
  private readonly VARIANCE_THRESHOLD = 10; // 10% variance triggers alert

  // Alert severity thresholds
  private readonly CAPACITY_OVERFLOW_WARNING_PCT = 5; // 5% over capacity = warning
  private readonly CAPACITY_OVERFLOW_CRITICAL_PCT = 20; // 20% over capacity = critical

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Verify material dimensions and update master data if variance is acceptable
   * Reference: Sylvia critique lines 1030-1046
   */
  async verifyMaterialDimensions(
    input: DimensionVerificationInput
  ): Promise<DimensionVerificationResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get master data dimensions
      const masterDataResult = await client.query(
        `SELECT
          material_id,
          material_code,
          cubic_feet,
          weight_lbs_per_unit,
          width_inches,
          height_inches,
          thickness_inches
        FROM materials
        WHERE material_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [input.materialId, input.tenantId]
      );

      if (masterDataResult.rows.length === 0) {
        throw new Error(`Material ${input.materialId} not found`);
      }

      const masterData = masterDataResult.rows[0];

      // Calculate variances
      const cubicFeetVariancePct = this.calculateVariancePercentage(
        masterData.cubic_feet,
        input.measuredCubicFeet
      );

      const weightVariancePct = this.calculateVariancePercentage(
        masterData.weight_lbs_per_unit,
        input.measuredWeightLbs
      );

      // Determine if variance exceeds threshold
      const varianceThresholdExceeded =
        Math.abs(cubicFeetVariancePct) > this.VARIANCE_THRESHOLD ||
        Math.abs(weightVariancePct) > this.VARIANCE_THRESHOLD;

      let verificationStatus: 'VERIFIED' | 'VARIANCE_DETECTED' | 'MASTER_DATA_UPDATED' = 'VERIFIED';
      let autoUpdatedMasterData = false;

      // Auto-update master data if variance is within acceptable range (< threshold)
      if (!varianceThresholdExceeded && (cubicFeetVariancePct !== 0 || weightVariancePct !== 0)) {
        await client.query(
          `UPDATE materials
          SET
            cubic_feet = $1,
            weight_lbs_per_unit = $2,
            width_inches = $3,
            height_inches = $4,
            thickness_inches = $5,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $6
          WHERE material_id = $7 AND tenant_id = $8`,
          [
            input.measuredCubicFeet,
            input.measuredWeightLbs,
            input.measuredWidthInches,
            input.measuredHeightInches,
            input.measuredThicknessInches,
            input.verifiedBy,
            input.materialId,
            input.tenantId,
          ]
        );

        verificationStatus = 'MASTER_DATA_UPDATED';
        autoUpdatedMasterData = true;
      } else if (varianceThresholdExceeded) {
        verificationStatus = 'VARIANCE_DETECTED';
      }

      // Record verification
      const verificationResult = await client.query(
        `INSERT INTO material_dimension_verifications (
          tenant_id,
          material_id,
          facility_id,
          master_cubic_feet,
          master_weight_lbs,
          master_width_inches,
          master_height_inches,
          master_thickness_inches,
          measured_cubic_feet,
          measured_weight_lbs,
          measured_width_inches,
          measured_height_inches,
          measured_thickness_inches,
          cubic_feet_variance_pct,
          weight_variance_pct,
          verification_status,
          variance_threshold_exceeded,
          auto_updated_master_data,
          verified_by,
          notes,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING verification_id`,
        [
          input.tenantId,
          input.materialId,
          input.facilityId,
          masterData.cubic_feet,
          masterData.weight_lbs_per_unit,
          masterData.width_inches,
          masterData.height_inches,
          masterData.thickness_inches,
          input.measuredCubicFeet,
          input.measuredWeightLbs,
          input.measuredWidthInches,
          input.measuredHeightInches,
          input.measuredThicknessInches,
          cubicFeetVariancePct,
          weightVariancePct,
          verificationStatus,
          varianceThresholdExceeded,
          autoUpdatedMasterData,
          input.verifiedBy,
          input.notes,
          input.verifiedBy,
        ]
      );

      await client.query('COMMIT');

      const message = this.getVerificationMessage(
        verificationStatus,
        cubicFeetVariancePct,
        weightVariancePct
      );

      return {
        verificationId: verificationResult.rows[0].verification_id,
        success: true,
        cubicFeetVariancePct,
        weightVariancePct,
        varianceThresholdExceeded,
        autoUpdatedMasterData,
        verificationStatus,
        message,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Dimension verification failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Record capacity validation failure and send alerts
   * Reference: Sylvia critique lines 1291-1317
   */
  async recordCapacityValidationFailure(
    failure: CapacityValidationFailure,
    tenantId: string,
    facilityId: string,
    recommendationId?: string,
    putawayUserId?: string
  ): Promise<string> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Determine failure type
      const cubicFeetExceeded = failure.requiredCubicFeet > failure.availableCubicFeet;
      const weightExceeded = failure.requiredWeightLbs > failure.availableWeightLbs;

      let failureType: 'CUBIC_FEET_EXCEEDED' | 'WEIGHT_EXCEEDED' | 'BOTH_EXCEEDED';
      if (cubicFeetExceeded && weightExceeded) {
        failureType = 'BOTH_EXCEEDED';
      } else if (cubicFeetExceeded) {
        failureType = 'CUBIC_FEET_EXCEEDED';
      } else {
        failureType = 'WEIGHT_EXCEEDED';
      }

      // Calculate overflow percentages
      const cubicFeetOverflowPct = failure.availableCubicFeet > 0
        ? ((failure.requiredCubicFeet - failure.availableCubicFeet) / failure.availableCubicFeet) * 100
        : 100;

      const weightOverflowPct = failure.availableWeightLbs > 0
        ? ((failure.requiredWeightLbs - failure.availableWeightLbs) / failure.availableWeightLbs) * 100
        : 100;

      // Insert failure record
      const result = await client.query(
        `INSERT INTO capacity_validation_failures (
          tenant_id,
          facility_id,
          location_id,
          material_id,
          lot_number,
          required_cubic_feet,
          available_cubic_feet,
          required_weight_lbs,
          available_weight_lbs,
          failure_type,
          cubic_feet_overflow_pct,
          weight_overflow_pct,
          recommendation_id,
          putaway_user_id,
          alert_sent,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE, $15)
        RETURNING failure_id`,
        [
          tenantId,
          facilityId,
          failure.locationId,
          failure.materialId,
          failure.lotNumber,
          failure.requiredCubicFeet,
          failure.availableCubicFeet,
          failure.requiredWeightLbs,
          failure.availableWeightLbs,
          failureType,
          cubicFeetOverflowPct,
          weightOverflowPct,
          recommendationId,
          putawayUserId,
          putawayUserId,
        ]
      );

      const failureId = result.rows[0].failure_id;

      // Determine alert severity
      const maxOverflowPct = Math.max(cubicFeetOverflowPct, weightOverflowPct);
      const severity = this.getAlertSeverity(maxOverflowPct);

      // Send alert (integrate with your alert system)
      await this.sendCapacityFailureAlert(
        client,
        failureId,
        failure,
        failureType,
        severity,
        tenantId,
        facilityId
      );

      await client.query('COMMIT');

      return failureId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to record capacity validation failure: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Cancel cross-dock recommendation and suggest new location
   * Reference: Sylvia critique lines 390-417
   */
  async cancelCrossDocking(
    input: CrossDockCancellationInput
  ): Promise<CrossDockCancellationResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current staging location for the lot
      const lotResult = await client.query(
        `SELECT location_id FROM lots
        WHERE lot_number = $1 AND material_id = $2 AND tenant_id = $3 AND deleted_at IS NULL
        LIMIT 1`,
        [input.lotNumber, input.materialId, input.tenantId]
      );

      const currentLocationId = lotResult.rows[0]?.location_id;

      // Get a new recommended location (bulk storage instead of staging)
      const newLocationResult = await client.query(
        `SELECT
          il.location_id,
          il.location_code,
          buc.volume_utilization_pct
        FROM inventory_locations il
        INNER JOIN bin_utilization_cache buc ON il.location_id = buc.location_id
        WHERE il.facility_id = $1
          AND il.tenant_id = $2
          AND il.location_type != 'STAGING'  -- Avoid staging areas
          AND il.is_active = TRUE
          AND il.deleted_at IS NULL
          AND buc.volume_utilization_pct < 80  -- Room for inventory
        ORDER BY buc.volume_utilization_pct ASC
        LIMIT 1`,
        [input.facilityId, input.tenantId]
      );

      const newLocation = newLocationResult.rows[0];

      if (!newLocation) {
        throw new Error('No suitable bulk storage location available');
      }

      // Record cancellation
      const cancellationResult = await client.query(
        `INSERT INTO cross_dock_cancellations (
          tenant_id,
          facility_id,
          material_id,
          lot_number,
          original_recommendation_id,
          original_staging_location_id,
          original_sales_order_id,
          cancellation_reason,
          new_recommended_location_id,
          cancelled_by,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING cancellation_id`,
        [
          input.tenantId,
          input.facilityId,
          input.materialId,
          input.lotNumber,
          input.originalRecommendationId,
          input.originalStagingLocationId,
          input.originalSalesOrderId,
          input.cancellationReason,
          newLocation.location_id,
          input.cancelledBy,
          input.notes,
        ]
      );

      await client.query('COMMIT');

      return {
        cancellationId: cancellationResult.rows[0].cancellation_id,
        success: true,
        newRecommendedLocation: {
          locationId: newLocation.location_id,
          locationCode: newLocation.location_code,
        },
        message: `Cross-dock cancelled. Material should be relocated to ${newLocation.location_code}`,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Cross-dock cancellation failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get data quality metrics for facility
   */
  async getDataQualityMetrics(
    tenantId: string,
    facilityId?: string
  ): Promise<DataQualityMetrics[]> {
    try {
      let query = `
        SELECT
          facility_id,
          facility_name,
          materials_verified_count,
          materials_with_variance,
          avg_cubic_feet_variance_pct,
          avg_weight_variance_pct,
          capacity_failures_count,
          unresolved_failures_count,
          crossdock_cancellations_count,
          pending_relocations_count,
          auto_remediation_count,
          failed_remediation_count
        FROM bin_optimization_data_quality
        WHERE tenant_id = $1
      `;

      const params: any[] = [tenantId];

      if (facilityId) {
        query += ` AND facility_id = $2`;
        params.push(facilityId);
      }

      query += ` ORDER BY facility_name`;

      const result = await this.pool.query(query, params);

      return result.rows.map((row) => ({
        facilityId: row.facility_id,
        facilityName: row.facility_name,
        materialsVerifiedCount: parseInt(row.materials_verified_count) || 0,
        materialsWithVariance: parseInt(row.materials_with_variance) || 0,
        avgCubicFeetVariancePct: parseFloat(row.avg_cubic_feet_variance_pct) || 0,
        avgWeightVariancePct: parseFloat(row.avg_weight_variance_pct) || 0,
        capacityFailuresCount: parseInt(row.capacity_failures_count) || 0,
        unresolvedFailuresCount: parseInt(row.unresolved_failures_count) || 0,
        crossdockCancellationsCount: parseInt(row.crossdock_cancellations_count) || 0,
        pendingRelocationsCount: parseInt(row.pending_relocations_count) || 0,
        autoRemediationCount: parseInt(row.auto_remediation_count) || 0,
        failedRemediationCount: parseInt(row.failed_remediation_count) || 0,
      }));
    } catch (error) {
      throw new Error(`Failed to get data quality metrics: ${error.message}`);
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  private calculateVariancePercentage(masterValue: number, measuredValue: number): number {
    if (!masterValue || masterValue === 0) {
      return 0;
    }

    return ((measuredValue - masterValue) / masterValue) * 100;
  }

  private getVerificationMessage(
    status: string,
    cubicFeetVariance: number,
    weightVariance: number
  ): string {
    switch (status) {
      case 'VERIFIED':
        return 'Dimensions verified successfully. No variance detected.';
      case 'MASTER_DATA_UPDATED':
        return `Dimensions updated in master data. Variance: ${cubicFeetVariance.toFixed(2)}% cubic feet, ${weightVariance.toFixed(2)}% weight.`;
      case 'VARIANCE_DETECTED':
        return `Variance exceeds threshold. Manual review required. Variance: ${cubicFeetVariance.toFixed(2)}% cubic feet, ${weightVariance.toFixed(2)}% weight.`;
      default:
        return 'Verification completed.';
    }
  }

  private getAlertSeverity(overflowPct: number): 'WARNING' | 'CRITICAL' {
    if (overflowPct > this.CAPACITY_OVERFLOW_CRITICAL_PCT) {
      return 'CRITICAL';
    }
    return 'WARNING';
  }

  private async sendCapacityFailureAlert(
    client: PoolClient,
    failureId: string,
    failure: CapacityValidationFailure,
    failureType: string,
    severity: 'WARNING' | 'CRITICAL',
    tenantId: string,
    facilityId: string
  ): Promise<void> {
    // This would integrate with your alert/notification system
    // For now, we'll just log it and mark alert as sent

    const alertMessage = `
      [${severity}] Capacity Validation Failure
      Location: ${failure.locationCode}
      Material: ${failure.materialCode}
      Failure Type: ${failureType}
      Cubic Feet: Required ${failure.requiredCubicFeet}, Available ${failure.availableCubicFeet}
      Weight: Required ${failure.requiredWeightLbs} lbs, Available ${failure.availableWeightLbs} lbs
      Overflow: ${failure.cubicFeetOverflowPct.toFixed(2)}% (cubic feet), ${failure.weightOverflowPct.toFixed(2)}% (weight)
    `;

    console.error(alertMessage);

    // Mark alert as sent
    await client.query(
      `UPDATE capacity_validation_failures
      SET alert_sent = TRUE, alert_sent_at = CURRENT_TIMESTAMP
      WHERE failure_id = $1`,
      [failureId]
    );

    // TODO: Integrate with notification system (email, Slack, etc.)
    // await notificationService.sendAlert({
    //   severity,
    //   message: alertMessage,
    //   tenantId,
    //   facilityId,
    // });
  }
}
