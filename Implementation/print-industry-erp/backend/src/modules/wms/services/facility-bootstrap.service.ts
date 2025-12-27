/**
 * Facility Bootstrap Service
 * REQ-STRATEGIC-AUTO-1766516759426: Optimize Bin Utilization Algorithm
 *
 * Handles initialization and bootstrapping of new warehouse facilities:
 * - Location validation and initialization
 * - ABC classification initialization for materials
 * - Default pick sequence assignment
 * - Bin utilization cache initialization
 * - ML model weights initialization
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface FacilityBootstrapResult {
  success: boolean;
  facilityId: string;
  locationCount: number;
  materialsInitialized: number;
  cacheInitialized: boolean;
  mlWeightsInitialized: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class FacilityBootstrapService {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Initialize a new facility with all required data
   */
  async initializeFacility(facilityId: string): Promise<FacilityBootstrapResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Check if facility has any locations
      const locationCount = await this.getLocationCount(facilityId);

      if (locationCount === 0) {
        errors.push(`Facility ${facilityId} has no configured locations`);
        return {
          success: false,
          facilityId,
          locationCount: 0,
          materialsInitialized: 0,
          cacheInitialized: false,
          mlWeightsInitialized: false,
          errors,
          warnings
        };
      }

      // 2. Initialize ABC classifications if missing
      const materialsInitialized = await this.initializeABCClassifications(facilityId);
      if (materialsInitialized === 0) {
        warnings.push('No materials without ABC classification found');
      }

      // 3. Assign default pick sequences if missing
      const locationsSequenced = await this.assignDefaultPickSequences(facilityId);
      if (locationsSequenced === 0) {
        warnings.push('All locations already have pick sequences');
      }

      // 4. Initialize bin utilization cache
      const cacheInitialized = await this.refreshBinUtilizationCache(facilityId);

      // 5. Create initial ML model weights
      const mlWeightsInitialized = await this.initializeMLWeights();

      return {
        success: true,
        facilityId,
        locationCount,
        materialsInitialized,
        cacheInitialized,
        mlWeightsInitialized,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(`Facility initialization failed: ${error.message}`);
      return {
        success: false,
        facilityId,
        locationCount: 0,
        materialsInitialized: 0,
        cacheInitialized: false,
        mlWeightsInitialized: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Get location count for facility
   */
  private async getLocationCount(facilityId: string): Promise<number> {
    const result = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM inventory_locations
      WHERE facility_id = $1 AND is_active = TRUE AND deleted_at IS NULL
    `, [facilityId]);

    return parseInt(result.rows[0]?.count) || 0;
  }

  /**
   * Initialize ABC classifications for materials without them
   * Uses simple cost-based rules for new facilities
   */
  private async initializeABCClassifications(facilityId: string): Promise<number> {
    const result = await this.pool.query(`
      UPDATE materials m
      SET
        abc_classification = CASE
          WHEN m.unit_cost >= 100 THEN 'A'
          WHEN m.unit_cost >= 20 THEN 'B'
          ELSE 'C'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE m.tenant_id IN (
        SELECT tenant_id FROM facilities WHERE facility_id = $1
      )
      AND m.abc_classification IS NULL
      AND m.deleted_at IS NULL
      RETURNING material_id
    `, [facilityId]);

    return result.rowCount || 0;
  }

  /**
   * Assign default pick sequences based on location code
   * Assumes location codes like "A-01-01-01" where A is zone
   */
  private async assignDefaultPickSequences(facilityId: string): Promise<number> {
    const result = await this.pool.query(`
      UPDATE inventory_locations il
      SET
        pick_sequence = subquery.row_num,
        updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT
          location_id,
          ROW_NUMBER() OVER (ORDER BY location_code) as row_num
        FROM inventory_locations
        WHERE facility_id = $1
          AND deleted_at IS NULL
      ) subquery
      WHERE il.location_id = subquery.location_id
        AND il.pick_sequence IS NULL
      RETURNING il.location_id
    `, [facilityId]);

    return result.rowCount || 0;
  }

  /**
   * Refresh bin utilization cache for facility
   */
  private async refreshBinUtilizationCache(facilityId: string): Promise<boolean> {
    try {
      // Delete old cache entries for this facility
      await this.pool.query(`
        DELETE FROM bin_utilization_cache
        WHERE facility_id = $1
      `, [facilityId]);

      // Refresh entire materialized view (includes this facility)
      await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache');

      return true;
    } catch (error) {
      console.error('Failed to refresh bin utilization cache:', error);
      return false;
    }
  }

  /**
   * Initialize ML weights if they don't exist
   */
  private async initializeMLWeights(): Promise<boolean> {
    try {
      // Check if ML weights exist
      const result = await this.pool.query(`
        SELECT model_id FROM ml_model_weights
        WHERE model_name = 'putaway_confidence_adjuster'
      `);

      if (result.rows.length === 0) {
        // Insert default weights
        await this.pool.query(`
          INSERT INTO ml_model_weights (model_name, weights, accuracy_pct)
          VALUES (
            'putaway_confidence_adjuster',
            '{"abcMatch": 0.35, "utilizationOptimal": 0.25, "pickSequenceLow": 0.20, "locationTypeMatch": 0.15, "congestionLow": 0.05}'::jsonb,
            85.0
          )
        `);
        return true;
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize ML weights:', error);
      return false;
    }
  }

  /**
   * Validate facility configuration
   */
  async validateFacilityConfiguration(facilityId: string): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // Check locations exist
      const locationCount = await this.getLocationCount(facilityId);
      if (locationCount === 0) {
        issues.push('No active locations configured');
      } else if (locationCount < 10) {
        warnings.push(`Only ${locationCount} locations configured - may be insufficient`);
      }

      // Check for locations without ABC classification
      const locationsWithoutABC = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM inventory_locations
        WHERE facility_id = $1
          AND abc_classification IS NULL
          AND is_active = TRUE
          AND deleted_at IS NULL
      `, [facilityId]);

      const missingABC = parseInt(locationsWithoutABC.rows[0]?.count) || 0;
      if (missingABC > 0) {
        warnings.push(`${missingABC} locations missing ABC classification`);
      }

      // Check for locations without pick sequence
      const locationsWithoutSeq = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM inventory_locations
        WHERE facility_id = $1
          AND pick_sequence IS NULL
          AND is_active = TRUE
          AND deleted_at IS NULL
      `, [facilityId]);

      const missingSeq = parseInt(locationsWithoutSeq.rows[0]?.count) || 0;
      if (missingSeq > 0) {
        warnings.push(`${missingSeq} locations missing pick sequence`);
      }

      // Check if cache is initialized
      const cacheEntries = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM bin_utilization_cache
        WHERE facility_id = $1
      `, [facilityId]);

      const cacheCount = parseInt(cacheEntries.rows[0]?.count) || 0;
      if (cacheCount === 0) {
        warnings.push('Bin utilization cache not initialized');
      }

      return {
        valid: issues.length === 0,
        issues,
        warnings
      };
    } catch (error) {
      issues.push(`Validation failed: ${error.message}`);
      return {
        valid: false,
        issues,
        warnings
      };
    }
  }

  /**
   * Get facility bootstrap status
   */
  async getFacilityBootstrapStatus(facilityId: string): Promise<{
    facilityId: string;
    locationCount: number;
    locationsWithABC: number;
    locationsWithSequence: number;
    materialsWithABC: number;
    cacheEntries: number;
    mlWeightsInitialized: boolean;
    fullyInitialized: boolean;
  }> {
    const locationCount = await this.getLocationCount(facilityId);

    const locationsWithABC = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM inventory_locations
      WHERE facility_id = $1
        AND abc_classification IS NOT NULL
        AND is_active = TRUE
        AND deleted_at IS NULL
    `, [facilityId]);

    const locationsWithSequence = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM inventory_locations
      WHERE facility_id = $1
        AND pick_sequence IS NOT NULL
        AND is_active = TRUE
        AND deleted_at IS NULL
    `, [facilityId]);

    const materialsWithABC = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM materials m
      INNER JOIN facilities f ON m.tenant_id = f.tenant_id
      WHERE f.facility_id = $1
        AND m.abc_classification IS NOT NULL
        AND m.deleted_at IS NULL
    `, [facilityId]);

    const cacheEntries = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM bin_utilization_cache
      WHERE facility_id = $1
    `, [facilityId]);

    const mlWeights = await this.pool.query(`
      SELECT COUNT(*) as count
      FROM ml_model_weights
      WHERE model_name = 'putaway_confidence_adjuster'
    `);

    const locWithABC = parseInt(locationsWithABC.rows[0]?.count) || 0;
    const locWithSeq = parseInt(locationsWithSequence.rows[0]?.count) || 0;
    const matWithABC = parseInt(materialsWithABC.rows[0]?.count) || 0;
    const cache = parseInt(cacheEntries.rows[0]?.count) || 0;
    const mlInit = parseInt(mlWeights.rows[0]?.count) > 0;

    const fullyInitialized =
      locationCount > 0 &&
      locWithABC === locationCount &&
      locWithSeq === locationCount &&
      cache > 0 &&
      mlInit;

    return {
      facilityId,
      locationCount,
      locationsWithABC: locWithABC,
      locationsWithSequence: locWithSeq,
      materialsWithABC: matWithABC,
      cacheEntries: cache,
      mlWeightsInitialized: mlInit,
      fullyInitialized
    };
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    // Pool is managed externally, nothing to close
  }
}
