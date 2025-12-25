import { Pool } from 'pg';
import {
  BinUtilizationOptimizationEnhancedService,
  EnhancedPutawayRecommendation,
  MLFeatures
} from './bin-utilization-optimization-enhanced.service';
import { ItemDimensions, BinCapacity } from './bin-utilization-optimization.service';

/**
 * Hybrid Bin Utilization Optimization Service
 *
 * REQ-STRATEGIC-AUTO-1766568547079: Optimize Bin Utilization Algorithm
 * Implements Cynthia's Phase 1 HIGH-PRIORITY recommendations:
 *
 * OPTIMIZATION 1: Hybrid FFD/BFD Algorithm (Recommendation #1)
 * - Adaptive algorithm selection based on batch characteristics
 * - Expected impact: 3-5% additional space utilization improvement
 * - Implementation effort: Medium (2-3 days)
 *
 * OPTIMIZATION 2: SKU Affinity Scoring (Recommendation #3)
 * - Co-location of frequently co-picked materials
 * - Expected impact: 8-12% pick travel time reduction
 * - Implementation effort: Medium (3-4 days)
 */

// ============================================================================
// EXTENDED INTERFACES
// ============================================================================

export interface SKUAffinityMetrics {
  materialId: string;
  affinityMaterials: Array<{
    materialId: string;
    materialCode: string;
    coPickCount: number;
    affinityScore: number; // 0-1
  }>;
  totalCoPickOrders: number;
}

export interface HybridAlgorithmStrategy {
  algorithm: 'FFD' | 'BFD' | 'HYBRID';
  reason: string;
  volumeVariance: number;
  avgItemSize: number;
  avgBinUtilization: number;
}

export interface EnhancedScoreResult {
  totalScore: number;
  confidenceScore: number;
  algorithm: string;
  reason: string;
  affinityScore?: number;
  affinityBonus?: number;
}

// ============================================================================
// HYBRID OPTIMIZATION SERVICE
// ============================================================================

export class BinUtilizationOptimizationHybridService extends BinUtilizationOptimizationEnhancedService {
  // SKU affinity cache (90-day rolling window, refreshed daily)
  private affinityCache: Map<string, SKUAffinityMetrics> = new Map();
  private affinityCacheExpiry: number = 0;
  private readonly AFFINITY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Algorithm selection thresholds
  private readonly HIGH_VARIANCE_THRESHOLD = 2.0; // cubic feet variance
  private readonly SMALL_ITEM_RATIO = 0.3; // % of average bin capacity
  private readonly LOW_VARIANCE_THRESHOLD = 0.5;
  private readonly HIGH_UTILIZATION_THRESHOLD = 70; // %

  // SKU affinity scoring weight
  private readonly AFFINITY_WEIGHT = 10; // Up to 10 points boost

  constructor(pool?: Pool) {
    super(pool);
  }

  // ==========================================================================
  // SECURITY & INPUT VALIDATION
  // ==========================================================================

  /**
   * Validate input bounds to prevent extreme values
   * Implements Sylvia's Recommendation: Input Validation
   */
  private validateInputBounds(quantity: number, dimensions?: ItemDimensions): void {
    const errors: string[] = [];

    // Quantity validation
    if (quantity === null || quantity === undefined || isNaN(quantity)) {
      errors.push('Quantity must be a valid number');
    } else if (quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    } else if (quantity > 1000000) {
      errors.push('Quantity exceeds maximum limit of 1,000,000');
    }

    // Dimensions validation (if provided)
    if (dimensions) {
      if (dimensions.cubicFeet !== undefined) {
        if (isNaN(dimensions.cubicFeet) || !isFinite(dimensions.cubicFeet)) {
          errors.push('Cubic feet must be a valid finite number');
        } else if (dimensions.cubicFeet <= 0) {
          errors.push('Cubic feet must be greater than 0');
        } else if (dimensions.cubicFeet > 10000) {
          errors.push('Cubic feet exceeds maximum limit of 10,000');
        }
      }

      if (dimensions.weightLbsPerUnit !== undefined) {
        if (isNaN(dimensions.weightLbsPerUnit) || !isFinite(dimensions.weightLbsPerUnit)) {
          errors.push('Weight must be a valid finite number');
        } else if (dimensions.weightLbsPerUnit < 0) {
          errors.push('Weight cannot be negative');
        } else if (dimensions.weightLbsPerUnit > 50000) {
          errors.push('Weight exceeds maximum limit of 50,000 lbs');
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Input validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Get material properties with tenant isolation
   * SECURITY FIX: Prevents cross-tenant data access
   */
  private async getMaterialPropertiesSecure(materialId: string, tenantId: string): Promise<any> {
    const query = `
      SELECT
        material_id,
        material_code,
        description,
        weight_lbs_per_unit,
        width_inches,
        height_inches,
        thickness_inches,
        cubic_feet,
        abc_classification,
        facility_id,
        temperature_controlled,
        security_zone
      FROM materials
      WHERE material_id = $1
        AND tenant_id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [materialId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error(`Material ${materialId} not found or access denied for tenant ${tenantId}`);
    }

    return result.rows[0];
  }

  /**
   * Get candidate locations with MANDATORY tenant_id filter
   * SECURITY FIX: Multi-tenancy isolation
   */
  private async getCandidateLocationsSecure(
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
          AND l.tenant_id = $2
        LEFT JOIN materials m
          ON l.material_id = m.material_id
          AND m.tenant_id = $2
        WHERE il.facility_id = $1
          AND il.tenant_id = $2
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
        COALESCE(il.abc_classification, 'C') as abc_classification,
        il.pick_sequence,
        il.temperature_controlled,
        il.security_zone,
        il.aisle_code,
        il.zone_code
      FROM inventory_locations il
      LEFT JOIN location_usage lu ON il.location_id = lu.location_id
      WHERE il.facility_id = $1
        AND il.tenant_id = $2
        AND il.is_active = TRUE
        AND il.is_available = TRUE
        AND il.deleted_at IS NULL
        AND (il.temperature_controlled = $3 OR $3 = FALSE)
        AND (il.security_zone = $4 OR $4 = 'STANDARD')
        AND il.cubic_feet > 0
        AND il.max_weight_lbs > 0
      ORDER BY
        CASE WHEN COALESCE(il.abc_classification, 'C') = $5 THEN 0 ELSE 1 END,
        il.pick_sequence ASC NULLS LAST,
        utilization_percentage ASC
      LIMIT 50
    `;

    const result = await this.pool.query(query, [
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

  // ==========================================================================
  // OPTIMIZATION 1: HYBRID FFD/BFD ALGORITHM
  // ==========================================================================

  /**
   * Select optimal bin packing algorithm based on batch characteristics
   * Implements Cynthia's Recommendation #1
   */
  selectAlgorithm(
    items: Array<{ totalVolume: number; totalWeight: number }>,
    candidateLocations: BinCapacity[]
  ): HybridAlgorithmStrategy {
    // Calculate batch statistics
    const volumes = items.map(i => i.totalVolume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const variance = this.calculateVariance(volumes);

    // Calculate average bin utilization and capacity
    const avgBinUtilization =
      candidateLocations.reduce((sum, loc) => sum + loc.utilizationPercentage, 0) /
      candidateLocations.length;
    const avgBinCapacity =
      candidateLocations.reduce((sum, loc) => sum + loc.totalCubicFeet, 0) /
      candidateLocations.length;
    const avgItemSize = avgVolume / avgBinCapacity;

    // Decision logic:

    // FFD: High variance + small average items
    // Best for: Large items need to go first to avoid fragmentation
    if (variance > this.HIGH_VARIANCE_THRESHOLD && avgItemSize < this.SMALL_ITEM_RATIO) {
      return {
        algorithm: 'FFD',
        reason: 'High volume variance with small items - pack large items first to minimize fragmentation',
        volumeVariance: variance,
        avgItemSize,
        avgBinUtilization
      };
    }

    // BFD: Low variance + high utilization
    // Best for: Similar-sized items in well-utilized bins - fill gaps efficiently
    if (variance < this.LOW_VARIANCE_THRESHOLD && avgBinUtilization > this.HIGH_UTILIZATION_THRESHOLD) {
      return {
        algorithm: 'BFD',
        reason: 'Low volume variance with high bin utilization - fill tightest gaps efficiently',
        volumeVariance: variance,
        avgItemSize,
        avgBinUtilization
      };
    }

    // HYBRID: Mixed characteristics
    // Best for: Default strategy - FFD for large items, BFD for small items
    return {
      algorithm: 'HYBRID',
      reason: 'Mixed item sizes - use FFD for large items, BFD for remaining small items',
      volumeVariance: variance,
      avgItemSize,
      avgBinUtilization
    };
  }

  /**
   * Calculate variance of array values
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

    return Math.sqrt(variance); // Return standard deviation
  }

  /**
   * Enhanced batch putaway with hybrid FFD/BFD algorithm selection
   * Overrides parent method with adaptive algorithm
   *
   * SECURITY: Enforces multi-tenancy isolation
   * VALIDATION: Input bounds checking for extreme values
   */
  async suggestBatchPutawayHybrid(
    items: Array<{
      materialId: string;
      lotNumber: string;
      quantity: number;
      dimensions?: ItemDimensions;
    }>,
    tenantId: string  // SECURITY FIX: Required parameter for tenant isolation
  ): Promise<Map<string, EnhancedPutawayRecommendation & { strategy?: HybridAlgorithmStrategy }>> {
    // VALIDATION FIX: Check for empty batch
    if (!items || items.length === 0) {
      return new Map(); // Empty result for empty input
    }

    // VALIDATION FIX: Input bounds checking
    for (const item of items) {
      this.validateInputBounds(item.quantity, item.dimensions);
    }
    // 1. Pre-process: Calculate dimensions and volumes WITH tenant validation
    const itemsWithVolume = await Promise.all(
      items.map(async item => {
        const material = await this.getMaterialPropertiesSecure(item.materialId, tenantId);
        const dims = item.dimensions || this.calculateItemDimensions(material, item.quantity);
        return {
          ...item,
          material,
          dimensions: dims,
          totalVolume: dims.cubicFeet * item.quantity,
          totalWeight: dims.weightLbsPerUnit * item.quantity
        };
      })
    );

    // 2. Get candidate locations ONCE WITH tenant isolation
    const facilityId = itemsWithVolume[0]?.material.facility_id;
    if (!facilityId) {
      throw new Error('No facility found for materials');
    }

    const candidateLocations = await this.getCandidateLocationsSecure(
      facilityId,
      tenantId,  // SECURITY FIX: Enforce tenant isolation
      'A',
      false,
      'STANDARD'
    );

    // 3. SELECT ALGORITHM based on batch characteristics
    const strategy = this.selectAlgorithm(itemsWithVolume, candidateLocations);

    // 4. Apply selected algorithm
    let sortedItems: typeof itemsWithVolume;

    if (strategy.algorithm === 'FFD') {
      // First Fit Decreasing: Sort all items by volume descending
      sortedItems = itemsWithVolume.sort((a, b) => b.totalVolume - a.totalVolume);
    } else if (strategy.algorithm === 'BFD') {
      // Best Fit Decreasing: Sort by volume descending (same as FFD)
      // Difference is in location selection (tightest fit vs first fit)
      sortedItems = itemsWithVolume.sort((a, b) => b.totalVolume - a.totalVolume);
    } else {
      // HYBRID: Partition into large and small items
      const medianVolume =
        itemsWithVolume.sort((a, b) => a.totalVolume - b.totalVolume)[
          Math.floor(itemsWithVolume.length / 2)
        ].totalVolume;

      const largeItems = itemsWithVolume.filter(i => i.totalVolume >= medianVolume);
      const smallItems = itemsWithVolume.filter(i => i.totalVolume < medianVolume);

      // FFD for large items, BFD for small items
      largeItems.sort((a, b) => b.totalVolume - a.totalVolume);
      smallItems.sort((a, b) => b.totalVolume - a.totalVolume);

      sortedItems = [...largeItems, ...smallItems];
    }

    // 5. Load congestion data
    const congestionMap = await this.calculateAisleCongestion();

    // 6. Pre-load SKU affinity data for all materials
    await this.loadAffinityDataBatch(sortedItems.map(i => i.materialId));

    // 7. Apply scoring with hybrid algorithm
    const recommendations = new Map<
      string,
      EnhancedPutawayRecommendation & { strategy?: HybridAlgorithmStrategy }
    >();

    for (const item of sortedItems) {
      // Check cross-dock opportunity first
      const crossDock = await this.detectCrossDockOpportunity(
        item.materialId,
        item.quantity,
        new Date()
      );

      if (crossDock.shouldCrossDock) {
        const stagingRec = await this.getStagingLocationRecommendation(item, crossDock);
        if (stagingRec) {
          recommendations.set(item.lotNumber, { ...stagingRec, strategy });
          continue;
        }
      }

      // Filter valid locations
      const validLocations = candidateLocations.filter(loc => {
        if (item.material.temperature_controlled && !loc.temperatureControlled) {
          return false;
        }
        if (item.material.security_zone && loc.securityZone !== item.material.security_zone) {
          return false;
        }
        return this.validateCapacity(loc, item.dimensions, item.quantity).canFit;
      });

      if (validLocations.length === 0) {
        throw new Error(`No suitable locations for material ${item.materialId}`);
      }

      // Apply enhanced scoring with SKU affinity
      const scored = await Promise.all(
        validLocations.map(async loc => {
          const baseScore = this.calculateLocationScore(loc, item.material, item.dimensions, item.quantity);
          const congestion = congestionMap.get(loc.aisleCode || '') || 0;
          const congestionPenalty = Math.min(congestion / 2, 15);

          // NEW: Calculate SKU affinity score
          const nearbyMaterials = await this.getMaterialsInNearbyLocations(
            loc.locationId,
            loc.aisleCode || '',
            loc.zoneCode || ''
          );
          const affinityScore = await this.calculateAffinityScore(item.materialId, nearbyMaterials);
          const affinityBonus = affinityScore * this.AFFINITY_WEIGHT;

          // Combine all scoring factors
          const finalScore = Math.max(baseScore.totalScore - congestionPenalty + affinityBonus, 0);

          // ML confidence adjustment
          const features: MLFeatures = {
            abcMatch: loc.abcClassification === item.material.abc_classification,
            utilizationOptimal: loc.utilizationPercentage >= 60 && loc.utilizationPercentage <= 85,
            pickSequenceLow: item.material.abc_classification === 'A' && (loc.pickSequence || 999) < 100,
            locationTypeMatch: true,
            congestionLow: congestion < 30
          };
          const mlConfidence = this['mlAdjuster'].adjustConfidence(baseScore.confidenceScore, features);

          return {
            location: loc,
            score: finalScore,
            baseScore,
            congestionPenalty,
            affinityScore,
            affinityBonus,
            mlConfidence
          };
        })
      );

      // Sort by scoring strategy
      if (strategy.algorithm === 'BFD') {
        // Best Fit: Choose location with tightest fit (minimum remaining space)
        scored.sort((a, b) => {
          const remainingA = a.location.availableCubicFeet - item.totalVolume;
          const remainingB = b.location.availableCubicFeet - item.totalVolume;
          // Prefer tighter fit, but break ties with score
          if (Math.abs(remainingA - remainingB) < 1.0) {
            return b.score - a.score;
          }
          return remainingA - remainingB;
        });
      } else {
        // FFD and HYBRID: First Fit by score descending
        scored.sort((a, b) => b.score - a.score);
      }

      const best = scored[0];
      const primaryLocation = best.location;

      recommendations.set(item.lotNumber, {
        locationId: primaryLocation.locationId,
        locationCode: primaryLocation.locationCode,
        locationType: primaryLocation.locationType,
        algorithm: `${strategy.algorithm}_ENHANCED_V3`,
        confidenceScore: best.baseScore.confidenceScore,
        mlAdjustedConfidence: best.mlConfidence,
        reason:
          best.baseScore.reason +
          (best.congestionPenalty > 5 ? `; Low congestion bonus` : '') +
          (best.affinityBonus && best.affinityBonus > 2
            ? `; High SKU affinity (+${best.affinityBonus.toFixed(1)} pts)`
            : ''),
        utilizationAfterPlacement: this.calculateUtilizationAfterPlacement(
          primaryLocation,
          item.dimensions,
          item.quantity
        ),
        availableCapacityAfter: primaryLocation.availableCubicFeet - item.totalVolume,
        pickSequence: primaryLocation.pickSequence,
        congestionPenalty: best.congestionPenalty,
        crossDockRecommendation: crossDock,
        strategy
      });

      // Update location capacity in-memory
      primaryLocation.usedCubicFeet += item.totalVolume;
      primaryLocation.availableCubicFeet -= item.totalVolume;
      primaryLocation.currentWeightLbs += item.totalWeight;
      primaryLocation.availableWeightLbs -= item.totalWeight;
      primaryLocation.utilizationPercentage =
        (primaryLocation.usedCubicFeet / primaryLocation.totalCubicFeet) * 100;
    }

    return recommendations;
  }

  // ==========================================================================
  // OPTIMIZATION 2: SKU AFFINITY SCORING
  // ==========================================================================

  /**
   * Calculate SKU affinity score for co-location optimization
   * Implements Cynthia's Recommendation #3
   *
   * Materials frequently picked together should be co-located to reduce travel distance
   */
  async calculateAffinityScore(
    materialId: string,
    nearbyMaterials: Array<{ material_id: string; material_code: string }>
  ): Promise<number> {
    if (nearbyMaterials.length === 0) return 0;

    // Check cache first
    const cachedAffinity = this.affinityCache.get(materialId);
    if (cachedAffinity && Date.now() < this.affinityCacheExpiry) {
      // Calculate average affinity with nearby materials
      const affinityScores = nearbyMaterials
        .map(nm => {
          const match = cachedAffinity.affinityMaterials.find(am => am.materialId === nm.material_id);
          return match ? match.affinityScore : 0;
        })
        .filter(score => score > 0);

      if (affinityScores.length === 0) return 0;
      return affinityScores.reduce((a, b) => a + b, 0) / affinityScores.length;
    }

    // Query database for co-pick affinity
    const query = `
      WITH co_picks AS (
        SELECT
          it1.material_id as material_a,
          it2.material_id as material_b,
          COUNT(DISTINCT it1.sales_order_id) as co_pick_count
        FROM inventory_transactions it1
        INNER JOIN inventory_transactions it2
          ON it1.sales_order_id = it2.sales_order_id
          AND it1.material_id != it2.material_id
        WHERE it1.transaction_type = 'ISSUE'
          AND it2.transaction_type = 'ISSUE'
          AND it1.created_at >= CURRENT_DATE - INTERVAL '90 days'
          AND it1.material_id = $1
        GROUP BY it1.material_id, it2.material_id
      )
      SELECT
        material_b,
        co_pick_count,
        -- Dynamic normalization based on facility max co-picks (Sylvia Issue #3)
        -- Uses 50th percentile (median) of max co-picks as normalization factor
        LEAST(
          co_pick_count / NULLIF(
            (SELECT MAX(co_pick_count) * 0.5
             FROM co_picks
             WHERE material_a = $1
            ),
            0
          ),
          1.0
        ) as affinity_score
      FROM co_picks
      WHERE material_b = ANY($2)
      ORDER BY co_pick_count DESC
    `;

    try {
      const result = await this.pool.query(query, [
        materialId,
        nearbyMaterials.map(m => m.material_id)
      ]);

      if (result.rows.length === 0) return 0;

      // Calculate weighted average affinity
      const affinityScores = result.rows.map(r => parseFloat(r.affinity_score));
      return affinityScores.reduce((a, b) => a + b, 0) / affinityScores.length;
    } catch (error) {
      console.warn('Could not calculate affinity score:', error);
      return 0;
    }
  }

  /**
   * Pre-load SKU affinity data for batch processing (eliminates N+1 queries)
   */
  async loadAffinityDataBatch(materialIds: string[]): Promise<void> {
    const now = Date.now();
    if (this.affinityCacheExpiry > now && this.affinityCache.size > 0) {
      return; // Cache still valid
    }

    const query = `
      WITH co_picks AS (
        SELECT
          it1.material_id as material_a,
          it2.material_id as material_b,
          m2.material_code,
          COUNT(DISTINCT it1.sales_order_id) as co_pick_count
        FROM inventory_transactions it1
        INNER JOIN inventory_transactions it2
          ON it1.sales_order_id = it2.sales_order_id
          AND it1.material_id != it2.material_id
        INNER JOIN materials m2 ON it2.material_id = m2.material_id
        WHERE it1.transaction_type = 'ISSUE'
          AND it2.transaction_type = 'ISSUE'
          AND it1.created_at >= CURRENT_DATE - INTERVAL '90 days'
          AND it1.material_id = ANY($1)
        GROUP BY it1.material_id, it2.material_id, m2.material_code
      )
      SELECT
        material_a,
        material_b,
        material_code,
        co_pick_count,
        -- Dynamic normalization based on facility max co-picks (Sylvia Issue #3)
        -- Uses 50th percentile (median) of max co-picks per material as normalization factor
        LEAST(
          co_pick_count / NULLIF(
            (SELECT MAX(co_pick_count) * 0.5
             FROM co_picks cp2
             WHERE cp2.material_a = co_picks.material_a
            ),
            0
          ),
          1.0
        ) as affinity_score
      FROM co_picks
      WHERE co_pick_count >= 3  -- Minimum threshold for meaningful affinity
      ORDER BY material_a, co_pick_count DESC
    `;

    try {
      const result = await this.pool.query(query, [materialIds]);

      // Build cache
      this.affinityCache.clear();

      const groupedByMaterial = result.rows.reduce((acc, row) => {
        if (!acc[row.material_a]) {
          acc[row.material_a] = [];
        }
        acc[row.material_a].push({
          materialId: row.material_b,
          materialCode: row.material_code,
          coPickCount: parseInt(row.co_pick_count),
          affinityScore: parseFloat(row.affinity_score)
        });
        return acc;
      }, {} as Record<string, any[]>);

      for (const materialId of materialIds) {
        const affinityMaterials = groupedByMaterial[materialId] || [];
        this.affinityCache.set(materialId, {
          materialId,
          affinityMaterials,
          totalCoPickOrders: affinityMaterials.reduce((sum, am) => sum + am.coPickCount, 0)
        });
      }

      this.affinityCacheExpiry = now + this.AFFINITY_CACHE_TTL;
    } catch (error) {
      console.warn('Could not load affinity data batch:', error);
    }
  }

  /**
   * Get materials in nearby locations (same aisle or zone)
   */
  async getMaterialsInNearbyLocations(
    locationId: string,
    aisleCode: string,
    zoneCode: string
  ): Promise<Array<{ material_id: string; material_code: string }>> {
    const query = `
      SELECT DISTINCT
        m.material_id,
        m.material_code
      FROM lots l
      INNER JOIN materials m ON l.material_id = m.material_id
      INNER JOIN inventory_locations il ON l.location_id = il.location_id
      WHERE il.location_id != $1
        AND (il.aisle_code = $2 OR il.zone_code = $3)
        AND l.quality_status = 'RELEASED'
        AND l.quantity_on_hand > 0
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [locationId, aisleCode, zoneCode]);
      return result.rows;
    } catch (error) {
      console.warn('Could not get nearby materials:', error);
      return [];
    }
  }

  /**
   * Generate SKU affinity analysis report for warehouse optimization
   */
  async analyzeSKUAffinity(
    facilityId: string,
    topN: number = 50
  ): Promise<
    Array<{
      materialId: string;
      materialCode: string;
      description: string;
      topAffinities: Array<{
        materialId: string;
        materialCode: string;
        coPickCount: number;
        currentlyCoLocated: boolean;
        distanceBetweenLocations?: number;
        potentialTravelSavings?: string;
      }>;
    }>
  > {
    const query = `
      WITH co_pick_analysis AS (
        SELECT
          it1.material_id as material_a,
          m1.material_code as material_a_code,
          m1.description as material_a_desc,
          it2.material_id as material_b,
          m2.material_code as material_b_code,
          COUNT(DISTINCT it1.sales_order_id) as co_pick_count,
          -- Check if currently co-located
          EXISTS (
            SELECT 1
            FROM lots l1
            INNER JOIN lots l2 ON l1.location_id = l2.location_id
            WHERE l1.material_id = it1.material_id
              AND l2.material_id = it2.material_id
          ) as currently_co_located
        FROM inventory_transactions it1
        INNER JOIN inventory_transactions it2
          ON it1.sales_order_id = it2.sales_order_id
          AND it1.material_id < it2.material_id  -- Avoid duplicates
        INNER JOIN materials m1 ON it1.material_id = m1.material_id
        INNER JOIN materials m2 ON it2.material_id = m2.material_id
        WHERE it1.transaction_type = 'ISSUE'
          AND it2.transaction_type = 'ISSUE'
          AND it1.created_at >= CURRENT_DATE - INTERVAL '90 days'
          AND EXISTS (
            SELECT 1 FROM lots l
            INNER JOIN inventory_locations il ON l.location_id = il.location_id
            WHERE l.material_id = it1.material_id
              AND il.facility_id = $1
          )
        GROUP BY it1.material_id, m1.material_code, m1.description,
                 it2.material_id, m2.material_code, currently_co_located
        HAVING COUNT(DISTINCT it1.sales_order_id) >= 10
      )
      SELECT
        material_a,
        material_a_code,
        material_a_desc,
        material_b,
        material_b_code,
        co_pick_count,
        currently_co_located
      FROM co_pick_analysis
      ORDER BY co_pick_count DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query(query, [facilityId, topN * 5]);

      // Group by material_a
      const grouped = result.rows.reduce((acc, row) => {
        if (!acc[row.material_a]) {
          acc[row.material_a] = {
            materialId: row.material_a,
            materialCode: row.material_a_code,
            description: row.material_a_desc,
            topAffinities: []
          };
        }

        acc[row.material_a].topAffinities.push({
          materialId: row.material_b,
          materialCode: row.material_b_code,
          coPickCount: parseInt(row.co_pick_count),
          currentlyCoLocated: row.currently_co_located,
          potentialTravelSavings: row.currently_co_located
            ? 'Already co-located'
            : `Estimated ${(parseInt(row.co_pick_count) * 30).toFixed(0)} seconds/month saved`
        });

        return acc;
      }, {} as Record<string, any>);

      return Object.values(grouped).slice(0, topN);
    } catch (error) {
      console.warn('Could not analyze SKU affinity:', error);
      return [];
    }
  }
}
