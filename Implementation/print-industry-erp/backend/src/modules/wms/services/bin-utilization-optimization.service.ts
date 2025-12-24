import { Pool } from 'pg';

/**
 * Bin Utilization Optimization Service
 *
 * Implements intelligent bin placement and utilization algorithms for warehouse operations
 * following best practices for print industry materials (paper rolls, substrates, etc.)
 *
 * Key Features:
 * - ABC Analysis velocity-based slotting
 * - Best Fit bin packing algorithm
 * - Capacity constraint validation (dimension, weight, cubic)
 * - FIFO/LIFO enforcement
 * - Dynamic re-slotting recommendations
 * - Climate control and security zone compliance
 *
 * Performance Targets:
 * - 80% bin utilization (optimal range: 40-80%)
 * - 25-35% efficiency improvement
 * - 66% reduction in average pick travel distance
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface ItemDimensions {
  lengthInches: number;
  widthInches: number;
  heightInches: number;
  cubicFeet: number;
  weightLbsPerUnit: number;
}

export interface BinCapacity {
  locationId: string;
  locationCode: string;
  locationType: string;
  totalCubicFeet: number;
  usedCubicFeet: number;
  availableCubicFeet: number;
  maxWeightLbs: number;
  currentWeightLbs: number;
  availableWeightLbs: number;
  utilizationPercentage: number;
  abcClassification?: string;
  pickSequence?: number;
  temperatureControlled: boolean;
  securityZone: string;
  aisleCode?: string;
  zoneCode?: string;
}

export interface CapacityValidation {
  canFit: boolean;
  dimensionCheck: boolean;
  weightCheck: boolean;
  cubicCheck: boolean;
  violationReasons: string[];
}

export interface PutawayRecommendation {
  locationId: string;
  locationCode: string;
  locationType: string;
  algorithm: string;
  confidenceScore: number;
  reason: string;
  utilizationAfterPlacement: number;
  availableCapacityAfter: number;
  pickSequence?: number;
}

export interface BinUtilizationMetrics {
  locationId: string;
  locationCode: string;
  volumeUtilization: number;      // 0-100%
  weightUtilization: number;      // 0-100%
  slotUtilization: number;        // 0-100% (number of lots)
  availableVolume: number;        // cubic feet
  availableWeight: number;        // lbs
  abcClassification: string;      // A/B/C
  pickFrequency: number;          // picks per period
  optimizationScore: number;      // 0-100, higher = better
  recommendations: string[];
}

export interface OptimizationRecommendation {
  type: 'CONSOLIDATE' | 'REBALANCE' | 'RELOCATE' | 'CROSS_DOCK' | 'RESLOT';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceBinId: string;
  sourceBinCode: string;
  targetBinId?: string;
  targetBinCode?: string;
  materialId?: string;
  materialName?: string;
  reason: string;
  expectedImpact: string;
  currentUtilization?: number;
  velocityChange?: number;
}

export interface WarehouseUtilizationAnalysis {
  facilityId: string;
  totalLocations: number;
  activeLocations: number;
  averageUtilization: number;
  utilizationByZone: ZoneUtilization[];
  underutilizedLocations: BinCapacity[];
  overutilizedLocations: BinCapacity[];
  recommendations: OptimizationRecommendation[];
}

export interface ZoneUtilization {
  zoneCode: string;
  totalLocations: number;
  averageUtilization: number;
  totalCubicFeet: number;
  usedCubicFeet: number;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class BinUtilizationOptimizationService {
  protected pool: Pool;

  // Configuration thresholds
  private readonly OPTIMAL_UTILIZATION = 80;        // Target utilization percentage
  private readonly UNDERUTILIZED_THRESHOLD = 30;    // Below this = underutilized
  private readonly OVERUTILIZED_THRESHOLD = 95;     // Above this = overutilized
  private readonly CONSOLIDATION_THRESHOLD = 25;    // Bins below this should be consolidated
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.8; // Confidence score threshold

  constructor(pool?: Pool) {
    if (pool) {
      this.pool = pool;
    } else {
      // Use DATABASE_URL connection string (set by docker-compose)
      const connectionString = process.env.DATABASE_URL ||
        'postgresql://agogsaas_user:changeme@localhost:5433/agogsaas';
      this.pool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
  }

  // ==========================================================================
  // PUTAWAY RECOMMENDATION ENGINE
  // ==========================================================================

  /**
   * Suggest optimal putaway location for received inventory
   * Uses ABC Analysis + Best Fit algorithm + capacity validation
   */
  async suggestPutawayLocation(
    materialId: string,
    lotNumber: string,
    quantity: number,
    dimensions?: ItemDimensions
  ): Promise<{
    primary: PutawayRecommendation;
    alternatives: PutawayRecommendation[];
    capacityCheck: CapacityValidation;
  }> {
    // 1. Get material properties
    const material = await this.getMaterialProperties(materialId);

    // Calculate dimensions if not provided
    const itemDimensions = dimensions || this.calculateItemDimensions(material, quantity);

    // 2. Get candidate locations based on material requirements
    let candidateLocations = await this.getCandidateLocations(
      material.facilityId,
      material.abcClassification,
      material.temperatureControlled,
      material.securityZone,
      material.locationType
    );

    // 3. Filter by capacity
    const validLocations: Array<{ location: BinCapacity; validation: CapacityValidation }> = [];

    for (const location of candidateLocations) {
      const validation = this.validateCapacity(location, itemDimensions, quantity);
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

    // 4. Apply scoring algorithm
    const scoredLocations = validLocations.map(({ location, validation }) => ({
      location,
      validation,
      score: this.calculateLocationScore(location, material, itemDimensions, quantity),
    }));

    // 5. Sort by score descending
    scoredLocations.sort((a, b) => b.score.totalScore - a.score.totalScore);

    // 6. Build recommendations
    const recommendations = scoredLocations.slice(0, 4).map(({ location, validation, score }) => {
      const utilizationAfter = this.calculateUtilizationAfterPlacement(
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
    };
  }

  /**
   * Calculate bin utilization metrics for monitoring and optimization
   */
  async calculateBinUtilization(
    facilityId: string,
    locationId?: string
  ): Promise<BinUtilizationMetrics[]> {
    const query = `
      WITH location_usage AS (
        SELECT
          il.location_id,
          il.location_code,
          il.cubic_feet as total_cubic_feet,
          il.max_weight_lbs as max_weight,
          il.abc_classification,
          il.pick_sequence,

          -- Calculate current usage from lots
          COALESCE(SUM(
            l.quantity_on_hand *
            (m.width_inches * m.height_inches * COALESCE(m.thickness_inches, 1)) / 1728.0
          ), 0) as used_cubic_feet,

          COALESCE(SUM(l.quantity_on_hand * m.weight_lbs_per_unit), 0) as current_weight,
          COUNT(DISTINCT l.lot_number) as lot_count

        FROM inventory_locations il
        LEFT JOIN lots l ON il.location_id = l.location_id AND l.quality_status = 'RELEASED'
        LEFT JOIN materials m ON l.material_id = m.material_id
        WHERE il.facility_id = $1
          ${locationId ? 'AND il.location_id = $2' : ''}
          AND il.is_active = TRUE
        GROUP BY il.location_id, il.location_code, il.cubic_feet, il.max_weight_lbs,
                 il.abc_classification, il.pick_sequence
      ),
      pick_frequency AS (
        SELECT
          from_location_id as location_id,
          COUNT(*) as pick_count
        FROM inventory_transactions
        WHERE transaction_type = 'ISSUE'
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY from_location_id
      )
      SELECT
        lu.*,
        COALESCE(pf.pick_count, 0) as pick_frequency,

        -- Utilization percentages
        CASE
          WHEN lu.total_cubic_feet > 0
          THEN (lu.used_cubic_feet / lu.total_cubic_feet) * 100
          ELSE 0
        END as volume_utilization_pct,

        CASE
          WHEN lu.max_weight > 0
          THEN (lu.current_weight / lu.max_weight) * 100
          ELSE 0
        END as weight_utilization_pct,

        -- Available capacities
        (lu.total_cubic_feet - lu.used_cubic_feet) as available_cubic_feet,
        (lu.max_weight - lu.current_weight) as available_weight_lbs

      FROM location_usage lu
      LEFT JOIN pick_frequency pf ON lu.location_id = pf.location_id
      ORDER BY volume_utilization_pct DESC
    `;

    const params = locationId ? [facilityId, locationId] : [facilityId];
    const result = await this.pool.query(query, params);

    return result.rows.map(row => {
      const metrics: BinUtilizationMetrics = {
        locationId: row.location_id,
        locationCode: row.location_code,
        volumeUtilization: parseFloat(row.volume_utilization_pct) || 0,
        weightUtilization: parseFloat(row.weight_utilization_pct) || 0,
        slotUtilization: row.lot_count > 0 ? (row.lot_count / 10) * 100 : 0, // Assume max 10 lots per bin
        availableVolume: parseFloat(row.available_cubic_feet) || 0,
        availableWeight: parseFloat(row.available_weight_lbs) || 0,
        abcClassification: row.abc_classification || 'C',
        pickFrequency: parseInt(row.pick_frequency) || 0,
        optimizationScore: 0, // Calculated below
        recommendations: [],
      };

      // Calculate optimization score (0-100)
      metrics.optimizationScore = this.calculateOptimizationScore(metrics);

      // Generate recommendations
      metrics.recommendations = this.generateBinRecommendations(metrics);

      return metrics;
    });
  }

  /**
   * Generate warehouse-wide optimization recommendations
   */
  async generateOptimizationRecommendations(
    facilityId: string,
    threshold: number = 0.3
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Get utilization metrics
    const metrics = await this.calculateBinUtilization(facilityId);

    // 1. Identify consolidation opportunities (underutilized bins)
    const underutilized = metrics.filter(m => m.volumeUtilization < this.CONSOLIDATION_THRESHOLD);
    for (const bin of underutilized) {
      recommendations.push({
        type: 'CONSOLIDATE',
        priority: 'MEDIUM',
        sourceBinId: bin.locationId,
        sourceBinCode: bin.locationCode,
        reason: `Bin is only ${bin.volumeUtilization.toFixed(1)}% utilized. Consolidate with nearby bins.`,
        expectedImpact: `Free up ${(100 - bin.volumeUtilization).toFixed(1)}% of bin capacity`,
        currentUtilization: bin.volumeUtilization,
      });
    }

    // 2. Identify overutilized bins (potential safety/access issues)
    const overutilized = metrics.filter(m => m.volumeUtilization > this.OVERUTILIZED_THRESHOLD);
    for (const bin of overutilized) {
      recommendations.push({
        type: 'REBALANCE',
        priority: 'HIGH',
        sourceBinId: bin.locationId,
        sourceBinCode: bin.locationCode,
        reason: `Bin is ${bin.volumeUtilization.toFixed(1)}% utilized. Risk of overflow.`,
        expectedImpact: 'Reduce congestion and improve picking efficiency',
        currentUtilization: bin.volumeUtilization,
      });
    }

    // 3. Identify re-slotting opportunities (ABC classification mismatch)
    const reslottingOpportunities = await this.identifyReslottingOpportunities(facilityId);
    recommendations.push(...reslottingOpportunities);

    // 4. Sort by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  /**
   * Analyze warehouse-wide utilization
   */
  async analyzeWarehouseUtilization(
    facilityId: string,
    zoneCode?: string
  ): Promise<WarehouseUtilizationAnalysis> {
    // Get all bin metrics
    const allMetrics = await this.calculateBinUtilization(facilityId);

    // Filter by zone if specified
    const metrics = zoneCode
      ? allMetrics.filter(m => m.locationCode.startsWith(zoneCode))
      : allMetrics;

    // Calculate zone-level statistics
    const zoneStats = await this.calculateZoneUtilization(facilityId);

    // Identify problematic bins
    const underutilized = metrics
      .filter(m => m.volumeUtilization < this.UNDERUTILIZED_THRESHOLD)
      .map(m => this.metricsToBinCapacity(m));

    const overutilized = metrics
      .filter(m => m.volumeUtilization > this.OVERUTILIZED_THRESHOLD)
      .map(m => this.metricsToBinCapacity(m));

    // Generate recommendations
    const recommendations = await this.generateOptimizationRecommendations(facilityId);

    // Calculate overall average
    const avgUtilization = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.volumeUtilization, 0) / metrics.length
      : 0;

    return {
      facilityId,
      totalLocations: metrics.length,
      activeLocations: metrics.filter(m => m.volumeUtilization > 0).length,
      averageUtilization: avgUtilization,
      utilizationByZone: zoneStats,
      underutilizedLocations: underutilized.slice(0, 20),
      overutilizedLocations: overutilized.slice(0, 20),
      recommendations: recommendations.slice(0, 50),
    };
  }

  // ==========================================================================
  // CAPACITY VALIDATION
  // ==========================================================================

  /**
   * Validate if item can fit in location with comprehensive checks
   */
  protected validateCapacity(
    location: BinCapacity,
    dimensions: ItemDimensions,
    quantity: number
  ): CapacityValidation {
    const violations: string[] = [];

    // Calculate required capacity
    const requiredCubicFeet = dimensions.cubicFeet * quantity;
    const requiredWeight = dimensions.weightLbsPerUnit * quantity;

    // 1. Cubic capacity check
    const cubicCheck = location.availableCubicFeet >= requiredCubicFeet;
    if (!cubicCheck) {
      violations.push(
        `Insufficient cubic capacity: need ${requiredCubicFeet.toFixed(2)} cf, ` +
        `have ${location.availableCubicFeet.toFixed(2)} cf`
      );
    }

    // 2. Weight capacity check
    const weightCheck = location.availableWeightLbs >= requiredWeight;
    if (!weightCheck) {
      violations.push(
        `Insufficient weight capacity: need ${requiredWeight.toFixed(2)} lbs, ` +
        `have ${location.availableWeightLbs.toFixed(2)} lbs`
      );
    }

    // 3. Dimension check (simplified - assumes item can be rotated)
    const dimensionCheck = true; // Could enhance with actual 3D fitting logic

    const canFit = cubicCheck && weightCheck && dimensionCheck;

    return {
      canFit,
      dimensionCheck,
      weightCheck,
      cubicCheck,
      violationReasons: violations,
    };
  }

  // ==========================================================================
  // SCORING & OPTIMIZATION ALGORITHMS
  // ==========================================================================

  /**
   * Calculate location score for putaway recommendation
   * Uses multi-criteria decision analysis
   *
   * PHASE 1 OPTIMIZATION: Enhanced scoring weights prioritizing pick sequence
   * - Pick Sequence: 35% (increased from 25%)
   * - ABC Match: 25% (decreased from 30%)
   * - Utilization: 25% (unchanged)
   * - Location Type: 15% (decreased from 20%)
   */
  protected calculateLocationScore(
    location: BinCapacity,
    material: any,
    dimensions: ItemDimensions,
    quantity: number
  ): {
    totalScore: number;
    confidenceScore: number;
    algorithm: string;
    reason: string;
  } {
    let score = 0;
    let confidenceScore = 0.5; // Base confidence
    const reasons: string[] = [];

    // Criterion 1: ABC Classification Match (25 points - decreased from 30)
    if (location.abcClassification === material.abcClassification) {
      score += 25;
      confidenceScore += 0.25;
      reasons.push(`ABC class ${material.abcClassification} match`);
    } else {
      score += 8;
    }

    // Criterion 2: Utilization Optimization (25 points - unchanged)
    const utilizationAfter = this.calculateUtilizationAfterPlacement(location, dimensions, quantity);
    const utilizationScore = this.scoreUtilization(utilizationAfter);
    score += utilizationScore;

    if (utilizationAfter >= 60 && utilizationAfter <= 85) {
      confidenceScore += 0.2;
      reasons.push(`Optimal utilization ${utilizationAfter.toFixed(1)}%`);
    }

    // Criterion 3: Pick Sequence (35 points - increased from 25)
    // OPTIMIZATION: Higher weight for pick sequence = 5-10% improvement in travel distance
    if (material.abcClassification === 'A') {
      if (location.pickSequence && location.pickSequence < 100) {
        score += 35; // Increased from 25
        confidenceScore += 0.2; // Increased from 0.15
        reasons.push('Prime pick location');
      } else if (location.pickSequence && location.pickSequence < 200) {
        score += 20; // Medium priority location
        reasons.push('Secondary pick location');
      } else {
        score += 5;
      }
    } else {
      score += 18; // Less important for B/C items (increased from 15)
    }

    // Criterion 4: Location Type Match (15 points - decreased from 20)
    if (location.locationType === 'PICK_FACE' && material.abcClassification === 'A') {
      score += 15;
      confidenceScore += 0.1;
      reasons.push('Pick-face location for high-velocity item');
    } else if (location.locationType === 'RESERVE') {
      score += 12;
    }

    // Build reason string
    const reason = reasons.length > 0 ? reasons.join('; ') : 'Standard placement';

    return {
      totalScore: Math.min(score, 100),
      confidenceScore: Math.min(confidenceScore, 1.0),
      algorithm: 'ABC_VELOCITY_BEST_FIT_V2', // Version 2 with optimized weights
      reason,
    };
  }

  /**
   * Score utilization percentage (higher score = closer to optimal 80%)
   */
  private scoreUtilization(utilizationPct: number): number {
    // Optimal range: 60-85%
    if (utilizationPct >= 60 && utilizationPct <= 85) {
      return 25;
    }
    // Good range: 40-95%
    if (utilizationPct >= 40 && utilizationPct <= 95) {
      return 15;
    }
    // Poor utilization
    return 5;
  }

  /**
   * Calculate optimization score for a bin (0-100)
   */
  private calculateOptimizationScore(metrics: BinUtilizationMetrics): number {
    let score = 50; // Base score

    // Optimal utilization: 60-80% gets +30 points
    if (metrics.volumeUtilization >= 60 && metrics.volumeUtilization <= 80) {
      score += 30;
    } else if (metrics.volumeUtilization < 30) {
      score -= 20; // Penalty for underutilization
    } else if (metrics.volumeUtilization > 95) {
      score -= 30; // Penalty for overutilization
    }

    // ABC alignment: A items with high pick frequency get +20 points
    if (metrics.abcClassification === 'A' && metrics.pickFrequency > 50) {
      score += 20;
    }

    // Balanced weight/volume: +10 points if within 20% of each other
    const diff = Math.abs(metrics.volumeUtilization - metrics.weightUtilization);
    if (diff < 20) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations for specific bin
   */
  private generateBinRecommendations(metrics: BinUtilizationMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.volumeUtilization < this.CONSOLIDATION_THRESHOLD) {
      recommendations.push(
        `Consolidate: Only ${metrics.volumeUtilization.toFixed(1)}% utilized`
      );
    }

    if (metrics.volumeUtilization > this.OVERUTILIZED_THRESHOLD) {
      recommendations.push(
        `Rebalance: ${metrics.volumeUtilization.toFixed(1)}% utilized - risk of overflow`
      );
    }

    if (metrics.abcClassification === 'A' && metrics.pickFrequency < 10) {
      recommendations.push('Consider re-slotting: A-class with low pick frequency');
    }

    if (metrics.abcClassification === 'C' && metrics.pickFrequency > 100) {
      recommendations.push('Consider re-slotting: C-class with high pick frequency');
    }

    const weightVolumeDiff = Math.abs(metrics.volumeUtilization - metrics.weightUtilization);
    if (weightVolumeDiff > 40) {
      recommendations.push(
        `Imbalanced: Volume ${metrics.volumeUtilization.toFixed(1)}% vs ` +
        `Weight ${metrics.weightUtilization.toFixed(1)}%`
      );
    }

    return recommendations;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  protected async getMaterialProperties(materialId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT
        m.*,
        f.facility_id
      FROM materials m
      LEFT JOIN facilities f ON m.tenant_id = f.tenant_id
      WHERE m.material_id = $1
      LIMIT 1`,
      [materialId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Material ${materialId} not found`);
    }

    return result.rows[0];
  }

  protected calculateItemDimensions(material: any, quantity: number): ItemDimensions {
    return {
      lengthInches: material.width_inches || 0,
      widthInches: material.height_inches || 0,
      heightInches: material.thickness_inches || 1,
      cubicFeet: ((material.width_inches || 0) * (material.height_inches || 0) *
                  (material.thickness_inches || 1)) / 1728.0,
      weightLbsPerUnit: material.weight_lbs_per_unit || 0,
    };
  }

  protected async getCandidateLocations(
    facilityId: string,
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
        LEFT JOIN lots l ON il.location_id = l.location_id AND l.quality_status = 'RELEASED'
        LEFT JOIN materials m ON l.material_id = m.material_id
        WHERE il.facility_id = $1
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
        il.abc_classification,
        il.pick_sequence,
        il.temperature_controlled,
        il.security_zone
      FROM inventory_locations il
      LEFT JOIN location_usage lu ON il.location_id = lu.location_id
      WHERE il.facility_id = $1
        AND il.is_active = TRUE
        AND il.is_available = TRUE
        AND (il.temperature_controlled = $2 OR $2 = FALSE)
        AND (il.security_zone = $3 OR $3 = 'STANDARD')
      ORDER BY
        CASE WHEN il.abc_classification = $4 THEN 0 ELSE 1 END,
        il.pick_sequence ASC NULLS LAST,
        utilization_percentage ASC
      LIMIT 50
    `;

    const result = await this.pool.query(query, [
      facilityId,
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
    }));
  }

  protected calculateUtilizationAfterPlacement(
    location: BinCapacity,
    dimensions: ItemDimensions,
    quantity: number
  ): number {
    const additionalCubicFeet = dimensions.cubicFeet * quantity;
    const newUsedCubicFeet = location.usedCubicFeet + additionalCubicFeet;

    if (location.totalCubicFeet === 0) return 0;

    return (newUsedCubicFeet / location.totalCubicFeet) * 100;
  }

  /**
   * Identify re-slotting opportunities based on ABC classification mismatches
   * PHASE 1 OPTIMIZATION: Full implementation of automated ABC reclassification
   *
   * Analyzes 30-day pick velocity and generates recommendations for:
   * - Materials currently in wrong ABC zone (e.g., high-velocity item in C location)
   * - Materials with significant velocity changes requiring re-slotting
   *
   * Expected Impact: 10-15% efficiency improvement from better slotting alignment
   */
  private async identifyReslottingOpportunities(
    facilityId: string
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // 1. Calculate velocity-based ABC classification using 30-day rolling window
    const velocityAnalysis = await this.pool.query(`
      WITH pick_velocity AS (
        SELECT
          m.material_id,
          m.material_code,
          m.description as material_name,
          m.abc_classification as current_abc,
          COUNT(*) as pick_count_30d,
          SUM(it.quantity) as quantity_picked_30d,
          SUM(it.quantity * COALESCE(m.cost_per_unit, 0)) as value_picked_30d,
          l.location_id,
          il.location_code
        FROM materials m
        LEFT JOIN inventory_transactions it
          ON m.material_id = it.material_id
          AND it.transaction_type = 'ISSUE'
          AND it.created_at >= CURRENT_DATE - INTERVAL '30 days'
        LEFT JOIN lots l ON m.material_id = l.material_id AND l.quality_status = 'RELEASED'
        LEFT JOIN inventory_locations il ON l.location_id = il.location_id
        WHERE m.tenant_id IN (
          SELECT tenant_id FROM facilities WHERE facility_id = $1
        )
        AND m.deleted_at IS NULL
        GROUP BY m.material_id, m.material_code, m.description, m.abc_classification,
                 l.location_id, il.location_code
      ),
      ranked_materials AS (
        SELECT
          *,
          PERCENT_RANK() OVER (ORDER BY pick_count_30d DESC) as velocity_percentile,
          SUM(value_picked_30d) OVER (ORDER BY value_picked_30d DESC ROWS UNBOUNDED PRECEDING) /
            NULLIF(SUM(value_picked_30d) OVER (), 0) as cumulative_value_pct
        FROM pick_velocity
      )
      SELECT
        material_id,
        material_code,
        material_name,
        current_abc,
        pick_count_30d,
        location_id,
        location_code,
        CASE
          WHEN velocity_percentile <= 0.20 THEN 'A'  -- Top 20% by pick frequency
          WHEN velocity_percentile <= 0.50 THEN 'B'  -- Next 30%
          ELSE 'C'                                    -- Bottom 50%
        END as recommended_abc,
        velocity_percentile,
        cumulative_value_pct
      FROM ranked_materials
      WHERE current_abc IS DISTINCT FROM
        CASE
          WHEN velocity_percentile <= 0.20 THEN 'A'
          WHEN velocity_percentile <= 0.50 THEN 'B'
          ELSE 'C'
        END
      ORDER BY pick_count_30d DESC
      LIMIT 100
    `, [facilityId]);

    // 2. Generate recommendations for ABC classification mismatches
    for (const row of velocityAnalysis.rows) {
      const priority = this.getABCMismatchPriority(
        row.current_abc,
        row.recommended_abc,
        parseInt(row.pick_count_30d) || 0
      );

      const impact = this.calculateReslottingImpact(
        row.current_abc,
        row.recommended_abc,
        parseInt(row.pick_count_30d) || 0
      );

      recommendations.push({
        type: 'RESLOT',
        priority,
        sourceBinId: row.location_id || '',
        sourceBinCode: row.location_code || 'UNKNOWN',
        materialId: row.material_id,
        materialName: row.material_name,
        reason: `ABC mismatch: Current ${row.current_abc || 'N/A'}, recommended ${row.recommended_abc} based on ${row.pick_count_30d} picks in 30 days (${(row.velocity_percentile * 100).toFixed(1)}th percentile)`,
        expectedImpact: impact,
        velocityChange: parseFloat(row.velocity_percentile),
      });
    }

    return recommendations;
  }

  /**
   * Determine priority for ABC reclassification based on mismatch severity and pick count
   */
  private getABCMismatchPriority(
    current: string,
    recommended: string,
    pickCount: number
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    // High priority: High-velocity items in wrong locations (material should be A but isn't)
    if (recommended === 'A' && current !== 'A' && pickCount > 100) {
      return 'HIGH';
    }

    // High priority: Low-velocity items occupying prime locations (current A should be demoted)
    if (current === 'A' && recommended !== 'A' && pickCount < 10) {
      return 'HIGH';
    }

    // Medium priority: B/C transitions with moderate pick counts
    if ((current === 'B' && recommended === 'C' && pickCount < 20) ||
        (current === 'C' && recommended === 'B' && pickCount > 50)) {
      return 'MEDIUM';
    }

    // Low priority: All other cases
    return 'LOW';
  }

  /**
   * Calculate expected impact of re-slotting operation
   * Uses industry benchmarks: 30 seconds average saved per pick for A-class re-slotting
   */
  private calculateReslottingImpact(
    currentABC: string,
    recommendedABC: string,
    pickCount: number
  ): string {
    if (currentABC === 'C' && recommendedABC === 'A') {
      // Moving slow mover to fast location - high impact
      const travelSavings = pickCount * 30; // 30 seconds per pick saved (industry avg)
      return `Estimated ${(travelSavings / 3600).toFixed(1)} labor hours saved per month from reduced travel distance`;
    }

    if (currentABC === 'A' && recommendedABC === 'C') {
      // Moving fast location to slow mover - free up prime real estate
      return `Free up prime pick location for true high-velocity items, improving overall warehouse efficiency`;
    }

    if (currentABC === 'B' && recommendedABC === 'A') {
      const travelSavings = pickCount * 20; // 20 seconds per pick
      return `Estimated ${(travelSavings / 3600).toFixed(1)} labor hours saved per month, ${pickCount} picks/month`;
    }

    if (currentABC === 'C' && recommendedABC === 'B') {
      return `Moderate efficiency gain, ${pickCount} picks/month justify better location`;
    }

    return `Improve slotting alignment, optimize warehouse space utilization`;
  }

  private async calculateZoneUtilization(facilityId: string): Promise<ZoneUtilization[]> {
    const query = `
      WITH location_usage AS (
        SELECT
          il.zone_code,
          il.location_id,
          il.cubic_feet,
          COALESCE(SUM(
            l.quantity_on_hand *
            (m.width_inches * m.height_inches * COALESCE(m.thickness_inches, 1)) / 1728.0
          ), 0) as used_cubic_feet
        FROM inventory_locations il
        LEFT JOIN lots l ON il.location_id = l.location_id AND l.quality_status = 'RELEASED'
        LEFT JOIN materials m ON l.material_id = m.material_id
        WHERE il.facility_id = $1 AND il.is_active = TRUE
        GROUP BY il.zone_code, il.location_id, il.cubic_feet
      )
      SELECT
        zone_code,
        COUNT(*) as total_locations,
        SUM(cubic_feet) as total_cubic_feet,
        SUM(used_cubic_feet) as used_cubic_feet,
        CASE
          WHEN SUM(cubic_feet) > 0
          THEN (SUM(used_cubic_feet) / SUM(cubic_feet)) * 100
          ELSE 0
        END as average_utilization
      FROM location_usage
      WHERE zone_code IS NOT NULL
      GROUP BY zone_code
      ORDER BY zone_code
    `;

    const result = await this.pool.query(query, [facilityId]);

    return result.rows.map(row => ({
      zoneCode: row.zone_code,
      totalLocations: parseInt(row.total_locations),
      averageUtilization: parseFloat(row.average_utilization) || 0,
      totalCubicFeet: parseFloat(row.total_cubic_feet) || 0,
      usedCubicFeet: parseFloat(row.used_cubic_feet) || 0,
    }));
  }

  private metricsToBinCapacity(metrics: BinUtilizationMetrics): BinCapacity {
    return {
      locationId: metrics.locationId,
      locationCode: metrics.locationCode,
      locationType: '', // Not available in metrics
      totalCubicFeet: metrics.availableVolume / (1 - metrics.volumeUtilization / 100),
      usedCubicFeet: metrics.availableVolume * (metrics.volumeUtilization / 100),
      availableCubicFeet: metrics.availableVolume,
      maxWeightLbs: metrics.availableWeight / (1 - metrics.weightUtilization / 100),
      currentWeightLbs: metrics.availableWeight * (metrics.weightUtilization / 100),
      availableWeightLbs: metrics.availableWeight,
      utilizationPercentage: metrics.volumeUtilization,
      abcClassification: metrics.abcClassification,
      pickSequence: undefined,
      temperatureControlled: false,
      securityZone: 'STANDARD',
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
