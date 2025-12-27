import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { BinUtilizationOptimizationService, ItemDimensions, BinCapacity } from './bin-utilization-optimization.service';

/**
 * Fixed Bin Utilization Optimization Service
 *
 * REQ-STRATEGIC-AUTO-1766516942302: Optimize Bin Utilization Algorithm
 *
 * CRITICAL FIXES APPLIED (from Sylvia's Review):
 * 1. Data quality validation (CRITICAL GAP #3)
 * 2. N+1 query optimization (PERFORMANCE RISK #1)
 * 3. Multi-tenancy validation (CONCERN #12)
 * 4. Input validation for extreme values (CONCERN #10)
 * 5. Transaction management for batch operations (CONCERN #2)
 */

// ============================================================================
// VALIDATION INTERFACES
// ============================================================================

export interface DataQualityValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// FIXED SERVICE CLASS
// ============================================================================

@Injectable()
export class BinUtilizationOptimizationFixedService extends BinUtilizationOptimizationService {
  // Validation bounds (CONCERN #10: Input validation)
  private readonly MAX_QUANTITY = 1_000_000;
  private readonly MAX_CUBIC_FEET = 10_000;
  private readonly MAX_WEIGHT_LBS = 50_000;

  constructor(@Inject('DATABASE_POOL') pool: Pool) {
    super(pool);
  }

  /**
   * CRITICAL FIX #3: Pre-flight data quality validation
   * Validates material dimensions, ABC classification, and bin capacity
   */
  async validateDataQuality(
    materialIds: string[],
    tenantId: string
  ): Promise<DataQualityValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for missing dimensions
      const missingDimensions = await this['pool'].query(`
        SELECT
          material_id,
          material_code,
          width_inches,
          height_inches,
          thickness_inches,
          weight_lbs_per_unit
        FROM materials
        WHERE material_id = ANY($1)
          AND tenant_id = $2
          AND (
            width_inches IS NULL OR
            height_inches IS NULL OR
            weight_lbs_per_unit IS NULL
          )
      `, [materialIds, tenantId]);

      if (missingDimensions.rows.length > 0) {
        for (const row of missingDimensions.rows) {
          errors.push(
            `Material ${row.material_code} (${row.material_id}) missing dimensions: ` +
            `width=${row.width_inches}, height=${row.height_inches}, weight=${row.weight_lbs_per_unit}`
          );
        }
      }

      // Check for missing ABC classification
      const missingABC = await this['pool'].query(`
        SELECT material_id, material_code
        FROM materials
        WHERE material_id = ANY($1)
          AND tenant_id = $2
          AND abc_classification IS NULL
      `, [materialIds, tenantId]);

      if (missingABC.rows.length > 0) {
        for (const row of missingABC.rows) {
          warnings.push(
            `Material ${row.material_code} (${row.material_id}) missing ABC classification, will default to 'C'`
          );
        }
      }

      // Check for invalid bin capacity
      const invalidBins = await this['pool'].query(`
        SELECT location_id, location_code, cubic_feet, max_weight_lbs
        FROM inventory_locations
        WHERE tenant_id = $1
          AND is_active = TRUE
          AND (cubic_feet <= 0 OR max_weight_lbs <= 0)
      `, [tenantId]);

      if (invalidBins.rows.length > 0) {
        for (const row of invalidBins.rows) {
          errors.push(
            `Location ${row.location_code} (${row.location_id}) has invalid capacity: ` +
            `cubic_feet=${row.cubic_feet}, max_weight=${row.max_weight_lbs}`
          );
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Data quality validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      };
    }
  }

  /**
   * CONCERN #10: Validate input for extreme/malicious values
   */
  validateInputBounds(
    quantity: number,
    dimensions?: ItemDimensions
  ): DataQualityValidation {
    const errors: string[] = [];

    if (quantity > this.MAX_QUANTITY) {
      errors.push(`Quantity ${quantity} exceeds maximum: ${this.MAX_QUANTITY}`);
    }

    if (quantity < 0) {
      errors.push(`Quantity ${quantity} cannot be negative`);
    }

    if (dimensions) {
      if (dimensions.cubicFeet > this.MAX_CUBIC_FEET) {
        errors.push(`Cubic feet ${dimensions.cubicFeet} exceeds maximum: ${this.MAX_CUBIC_FEET}`);
      }

      if (dimensions.weightLbsPerUnit > this.MAX_WEIGHT_LBS) {
        errors.push(`Weight ${dimensions.weightLbsPerUnit} lbs exceeds maximum: ${this.MAX_WEIGHT_LBS}`);
      }

      if (dimensions.cubicFeet <= 0 || dimensions.weightLbsPerUnit <= 0) {
        errors.push(`Dimensions must be positive values`);
      }

      if (
        isNaN(dimensions.cubicFeet) ||
        isNaN(dimensions.weightLbsPerUnit) ||
        !isFinite(dimensions.cubicFeet) ||
        !isFinite(dimensions.weightLbsPerUnit)
      ) {
        errors.push(`Dimensions contain invalid numeric values`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * CONCERN #12: Get candidate locations with MANDATORY tenant_id filter
   * Fixes multi-tenancy security gap
   */
  async getCandidateLocationsSecure(
    facilityId: string,
    tenantId: string,
    abcClassification: string,
    temperatureControlled: boolean,
    securityZone: string,
    preferredLocationType?: string
  ): Promise<BinCapacity[]> {
    const query = `
      WITH location_usage AS (
        SELECT
          il.location_id,
          COALESCE(SUM(
            l.quantity_on_hand *
            (m.width_inches * m.height_inches * COALESCE(m.thickness_inches, 1)) / 1728.0
          ), 0) as used_cubic_feet,
          COALESCE(SUM(l.quantity_on_hand * m.weight_lbs_per_unit), 0) as current_weight
        FROM inventory_locations il
        LEFT JOIN lots l
          ON il.location_id = l.location_id
          AND l.quality_status = 'RELEASED'
          AND l.tenant_id = $2  -- CRITICAL: Tenant isolation
        LEFT JOIN materials m
          ON l.material_id = m.material_id
          AND m.tenant_id = $2  -- CRITICAL: Tenant isolation
        WHERE il.facility_id = $1
          AND il.tenant_id = $2  -- CRITICAL: Tenant isolation
        GROUP BY il.location_id
      )
      SELECT
        il.location_id,
        il.location_code,
        il.location_type,
        il.cubic_feet as total_cubic_feet,
        COALESCE(lu.used_cubic_feet, 0) as used_cubic_feet,
        (il.cubic_feet - COALESCE(lu.used_cubic_feet, 0)) as available_cubic_feet,
        il.max_weight_lbs,
        COALESCE(lu.current_weight, 0) as current_weight_lbs,
        (il.max_weight_lbs - COALESCE(lu.current_weight, 0)) as available_weight_lbs,
        CASE
          WHEN il.cubic_feet > 0
          THEN (COALESCE(lu.used_cubic_feet, 0) / il.cubic_feet) * 100
          ELSE 0
        END as utilization_percentage,
        COALESCE(il.abc_classification, 'C') as abc_classification,  -- CRITICAL: Default fallback
        il.pick_sequence,
        il.temperature_controlled,
        il.security_zone,
        il.aisle_code,
        il.zone_code
      FROM inventory_locations il
      LEFT JOIN location_usage lu ON il.location_id = lu.location_id
      WHERE il.facility_id = $1
        AND il.tenant_id = $2  -- CRITICAL: Tenant isolation
        AND il.is_active = TRUE
        AND il.is_available = TRUE
        AND il.deleted_at IS NULL
        AND (il.temperature_controlled = $3 OR $3 = FALSE)
        AND (il.security_zone = $4 OR $4 = 'STANDARD')
        AND il.cubic_feet > 0  -- CRITICAL: Data quality check
        AND il.max_weight_lbs > 0  -- CRITICAL: Data quality check
      ORDER BY
        CASE WHEN COALESCE(il.abc_classification, 'C') = $5 THEN 0 ELSE 1 END,
        il.pick_sequence ASC NULLS LAST,
        utilization_percentage ASC
      LIMIT 50
    `;

    const result = await this['pool'].query(query, [
      facilityId,
      tenantId,
      temperatureControlled,
      securityZone,
      abcClassification,
    ]);

    return result.rows.map(row => ({
      locationId: row.location_id,
      locationCode: row.location_code,
      locationType: row.location_type,
      totalCubicFeet: parseFloat(row.total_cubic_feet) || 0,
      usedCubicFeet: parseFloat(row.used_cubic_feet) || 0,
      availableCubicFeet: parseFloat(row.available_cubic_feet) || 0,
      maxWeightLbs: parseFloat(row.max_weight_lbs) || 0,
      currentWeightLbs: parseFloat(row.current_weight_lbs) || 0,
      availableWeightLbs: parseFloat(row.available_weight_lbs) || 0,
      utilizationPercentage: parseFloat(row.utilization_percentage) || 0,
      abcClassification: row.abc_classification,
      pickSequence: row.pick_sequence,
      temperatureControlled: row.temperature_controlled,
      securityZone: row.security_zone,
      aisleCode: row.aisle_code,
      zoneCode: row.zone_code,
    }));
  }

  /**
   * PERFORMANCE FIX #1: Batch fetch material properties (eliminates N+1 queries)
   * Single query instead of N queries
   */
  async getMaterialPropertiesBatch(
    materialIds: string[],
    tenantId: string
  ): Promise<Map<string, any>> {
    const result = await this['pool'].query(
      `SELECT
        m.*,
        f.facility_id
      FROM materials m
      LEFT JOIN facilities f ON m.tenant_id = f.tenant_id
      WHERE m.material_id = ANY($1)
        AND m.tenant_id = $2
        AND m.deleted_at IS NULL`,
      [materialIds, tenantId]
    );

    const materialsMap = new Map<string, any>();
    for (const row of result.rows) {
      materialsMap.set(row.material_id, row);
    }

    return materialsMap;
  }

  /**
   * CONCERN #2: Batch operations with transaction management
   * Ensures atomicity for batch putaway recommendations
   */
  async recordBatchRecommendationsAtomic(
    recommendations: Array<{
      lotNumber: string;
      materialId: string;
      recommendedLocationId: string;
      confidenceScore: number;
      algorithm: string;
      reason: string;
    }>,
    tenantId: string
  ): Promise<void> {
    const client = await this['pool'].connect();

    try {
      await client.query('BEGIN');

      for (const rec of recommendations) {
        await client.query(`
          INSERT INTO putaway_recommendations (
            recommendation_id,
            tenant_id,
            lot_number,
            material_id,
            recommended_location_id,
            confidence_score,
            algorithm_used,
            reason,
            created_at
          ) VALUES (
            gen_random_uuid(),
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (lot_number, material_id, DATE(created_at))
          DO UPDATE SET
            recommended_location_id = EXCLUDED.recommended_location_id,
            confidence_score = EXCLUDED.confidence_score,
            algorithm_used = EXCLUDED.algorithm_used,
            reason = EXCLUDED.reason
        `, [
          tenantId,
          rec.lotNumber,
          rec.materialId,
          rec.recommendedLocationId,
          rec.confidenceScore,
          rec.algorithm,
          rec.reason,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Enhanced suggestPutawayLocation with all critical fixes applied
   */
  async suggestPutawayLocationSecure(
    materialId: string,
    lotNumber: string,
    quantity: number,
    tenantId: string,
    dimensions?: ItemDimensions
  ): Promise<any> {
    // CRITICAL FIX: Input validation
    const inputValidation = this.validateInputBounds(quantity, dimensions);
    if (!inputValidation.isValid) {
      throw new Error(`Input validation failed: ${inputValidation.errors.join('; ')}`);
    }

    // CRITICAL FIX: Data quality validation
    const dataValidation = await this.validateDataQuality([materialId], tenantId);
    if (!dataValidation.isValid) {
      throw new Error(`Data quality validation failed: ${dataValidation.errors.join('; ')}`);
    }

    // Log warnings but continue
    if (dataValidation.warnings.length > 0) {
      console.warn('Data quality warnings:', dataValidation.warnings);
    }

    // Get material properties with tenant isolation
    const materialsMap = await this.getMaterialPropertiesBatch([materialId], tenantId);
    const material = materialsMap.get(materialId);

    if (!material) {
      throw new Error(`Material ${materialId} not found for tenant ${tenantId}`);
    }

    // Calculate dimensions if not provided
    const itemDimensions = dimensions || this['calculateItemDimensions'](material, quantity);

    // Get candidate locations with multi-tenancy security
    const candidateLocations = await this.getCandidateLocationsSecure(
      material.facility_id,
      tenantId,
      material.abc_classification || 'C',
      material.temperature_controlled,
      material.security_zone || 'STANDARD',
      material.location_type
    );

    // Filter by capacity
    const validLocations: Array<{ location: BinCapacity; validation: any }> = [];

    for (const location of candidateLocations) {
      const validation = this['validateCapacity'](location, itemDimensions, quantity);
      if (validation.canFit) {
        validLocations.push({ location, validation });
      }
    }

    if (validLocations.length === 0) {
      throw new Error(
        `No suitable locations found for material ${materialId}. ` +
        `May need new bins or consolidation.`
      );
    }

    // Apply scoring algorithm
    const scoredLocations = validLocations.map(({ location, validation }) => ({
      location,
      validation,
      score: this['calculateLocationScore'](location, material, itemDimensions, quantity),
    }));

    // Sort by score descending
    scoredLocations.sort((a, b) => b.score.totalScore - a.score.totalScore);

    // Build recommendations
    const recommendations = scoredLocations.slice(0, 4).map(({ location, validation, score }) => {
      const utilizationAfter = this['calculateUtilizationAfterPlacement'](
        location,
        itemDimensions,
        quantity
      );

      return {
        locationId: location.locationId,
        locationCode: location.locationCode,
        locationType: location.locationType,
        algorithm: score.algorithm,
        confidenceScore: score.confidenceScore,
        reason: score.reason,
        utilizationAfterPlacement: utilizationAfter,
        availableCapacityAfter: location.availableCubicFeet - itemDimensions.cubicFeet * quantity,
        pickSequence: location.pickSequence,
      };
    });

    return {
      primary: recommendations[0],
      alternatives: recommendations.slice(1),
      capacityCheck: scoredLocations[0].validation,
      dataQualityWarnings: dataValidation.warnings,
    };
  }
}
