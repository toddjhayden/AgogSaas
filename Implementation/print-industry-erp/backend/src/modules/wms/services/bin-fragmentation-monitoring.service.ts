/**
 * Bin Fragmentation Monitoring Service
 *
 * Author: Roy (Backend Developer)
 * Requirement: REQ-STRATEGIC-AUTO-1766584106655
 * Purpose: Monitor and minimize bin fragmentation ("honeycombing")
 * Addresses: Sylvia Issue #12 (MEDIUM PRIORITY) + Cynthia OPP-3
 *
 * Fragmentation occurs when available space is scattered across many bins
 * rather than consolidated, leading to inefficient space utilization.
 *
 * Fragmentation Index (FI) = Total Available Space / Largest Contiguous Space
 * - FI = 1.0: Perfect (all space is contiguous)
 * - FI > 2.0: High fragmentation (trigger consolidation)
 * - FI > 3.0: Severe fragmentation (immediate action needed)
 *
 * Expected Impact:
 * - 2-4% space utilization improvement through defragmentation
 * - Reduced "lost" space from scattered availability
 * - Proactive consolidation recommendations
 */

import { Pool, PoolClient } from 'pg';

export interface FragmentationMetrics {
  facilityId: string;
  zoneCode?: string;
  aisleCode?: string;

  // Overall metrics
  totalAvailableCubicFeet: number;
  largestContiguousBlock: number;
  fragmentationIndex: number;
  fragmentationLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

  // Bin statistics
  totalBins: number;
  binsWithAvailableSpace: number;
  averageAvailablePerBin: number;

  // Recommendations
  requiresConsolidation: boolean;
  estimatedSpaceRecovery: number; // Cubic feet
  consolidationOpportunities: ConsolidationOpportunity[];
}

export interface ConsolidationOpportunity {
  sourceLocationIds: string[];
  targetLocationId: string;
  materialId: string;
  materialCode: string;
  quantityToMove: number;
  spaceRecovered: number; // Cubic feet
  estimatedLaborHours: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FragmentationHistory {
  measurementTimestamp: Date;
  fragmentationIndex: number;
  consolidationsPerformed: number;
  spaceRecovered: number;
}

export class BinFragmentationMonitoringService {
  constructor(private pool: Pool) {}

  /**
   * Calculate fragmentation metrics for entire facility
   */
  async calculateFacilityFragmentation(
    tenantId: string,
    facilityId: string
  ): Promise<FragmentationMetrics> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        WITH bin_availability AS (
          SELECT
            location_id,
            zone_code,
            aisle_code,
            available_cubic_feet,
            ROW_NUMBER() OVER (PARTITION BY zone_code, aisle_code ORDER BY available_cubic_feet DESC) as space_rank
          FROM inventory_locations
          WHERE tenant_id = $1
            AND facility_id = $2
            AND location_type IN ('PICK_FACE', 'RESERVE', 'BULK')
            AND is_active = true
            AND available_cubic_feet > 0
        ),
        metrics AS (
          SELECT
            SUM(available_cubic_feet) as total_available,
            MAX(available_cubic_feet) as largest_contiguous,
            COUNT(*) as bins_with_space,
            AVG(available_cubic_feet) as avg_available_per_bin,
            (SELECT COUNT(*) FROM inventory_locations
             WHERE tenant_id = $1
               AND facility_id = $2
               AND location_type IN ('PICK_FACE', 'RESERVE', 'BULK')
               AND is_active = true
            ) as total_bins
          FROM bin_availability
        )
        SELECT
          total_available,
          largest_contiguous,
          bins_with_space,
          avg_available_per_bin,
          total_bins,
          -- Fragmentation Index = Total Available / Largest Contiguous
          CASE
            WHEN largest_contiguous > 0
            THEN total_available / largest_contiguous
            ELSE 1.0
          END as fragmentation_index
        FROM metrics
        `,
        [tenantId, facilityId]
      );

      if (result.rows.length === 0 || !result.rows[0].total_available) {
        return {
          facilityId,
          totalAvailableCubicFeet: 0,
          largestContiguousBlock: 0,
          fragmentationIndex: 1.0,
          fragmentationLevel: 'LOW',
          totalBins: 0,
          binsWithAvailableSpace: 0,
          averageAvailablePerBin: 0,
          requiresConsolidation: false,
          estimatedSpaceRecovery: 0,
          consolidationOpportunities: [],
        };
      }

      const metrics = result.rows[0];
      const fragmentationIndex = parseFloat(metrics.fragmentation_index);
      const fragmentationLevel = this.classifyFragmentationLevel(fragmentationIndex);
      const requiresConsolidation = fragmentationIndex >= 2.0;

      // Calculate consolidation opportunities if needed
      let consolidationOpportunities: ConsolidationOpportunity[] = [];
      let estimatedSpaceRecovery = 0;

      if (requiresConsolidation) {
        consolidationOpportunities = await this.identifyConsolidationOpportunities(
          client,
          tenantId,
          facilityId
        );
        estimatedSpaceRecovery = consolidationOpportunities.reduce(
          (sum, opp) => sum + opp.spaceRecovered,
          0
        );
      }

      return {
        facilityId,
        totalAvailableCubicFeet: parseFloat(metrics.total_available),
        largestContiguousBlock: parseFloat(metrics.largest_contiguous),
        fragmentationIndex,
        fragmentationLevel,
        totalBins: parseInt(metrics.total_bins),
        binsWithAvailableSpace: parseInt(metrics.bins_with_space),
        averageAvailablePerBin: parseFloat(metrics.avg_available_per_bin),
        requiresConsolidation,
        estimatedSpaceRecovery,
        consolidationOpportunities,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Calculate fragmentation metrics by zone
   */
  async calculateZoneFragmentation(
    tenantId: string,
    facilityId: string,
    zoneCode: string
  ): Promise<FragmentationMetrics> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        WITH bin_availability AS (
          SELECT
            location_id,
            aisle_code,
            available_cubic_feet
          FROM inventory_locations
          WHERE tenant_id = $1
            AND facility_id = $2
            AND zone_code = $3
            AND location_type IN ('PICK_FACE', 'RESERVE', 'BULK')
            AND is_active = true
            AND available_cubic_feet > 0
        )
        SELECT
          SUM(available_cubic_feet) as total_available,
          MAX(available_cubic_feet) as largest_contiguous,
          COUNT(*) as bins_with_space,
          AVG(available_cubic_feet) as avg_available_per_bin,
          (SELECT COUNT(*) FROM inventory_locations
           WHERE tenant_id = $1
             AND facility_id = $2
             AND zone_code = $3
             AND location_type IN ('PICK_FACE', 'RESERVE', 'BULK')
             AND is_active = true
          ) as total_bins,
          CASE
            WHEN MAX(available_cubic_feet) > 0
            THEN SUM(available_cubic_feet) / MAX(available_cubic_feet)
            ELSE 1.0
          END as fragmentation_index
        FROM bin_availability
        `,
        [tenantId, facilityId, zoneCode]
      );

      const metrics = result.rows[0] || {};
      const fragmentationIndex = parseFloat(metrics.fragmentation_index || '1.0');

      return {
        facilityId,
        zoneCode,
        totalAvailableCubicFeet: parseFloat(metrics.total_available || '0'),
        largestContiguousBlock: parseFloat(metrics.largest_contiguous || '0'),
        fragmentationIndex,
        fragmentationLevel: this.classifyFragmentationLevel(fragmentationIndex),
        totalBins: parseInt(metrics.total_bins || '0'),
        binsWithAvailableSpace: parseInt(metrics.bins_with_space || '0'),
        averageAvailablePerBin: parseFloat(metrics.avg_available_per_bin || '0'),
        requiresConsolidation: fragmentationIndex >= 2.0,
        estimatedSpaceRecovery: 0,
        consolidationOpportunities: [],
      };
    } finally {
      client.release();
    }
  }

  /**
   * Identify specific consolidation opportunities
   */
  private async identifyConsolidationOpportunities(
    client: PoolClient,
    tenantId: string,
    facilityId: string
  ): Promise<ConsolidationOpportunity[]> {
    // Find materials stored in multiple small bins that could be consolidated
    const result = await client.query(
      `
      WITH material_spread AS (
        SELECT
          ib.material_id,
          m.material_code,
          COUNT(DISTINCT ib.location_id) as location_count,
          SUM(ib.quantity_on_hand) as total_quantity,
          SUM(ib.quantity_on_hand * m.cubic_feet) as total_volume,
          array_agg(
            json_build_object(
              'locationId', ib.location_id,
              'quantity', ib.quantity_on_hand,
              'volume', ib.quantity_on_hand * m.cubic_feet
            ) ORDER BY ib.quantity_on_hand ASC
          ) as location_details
        FROM inventory_balances ib
        INNER JOIN materials m ON ib.material_id = m.material_id
        WHERE ib.tenant_id = $1
          AND ib.facility_id = $2
          AND ib.quantity_on_hand > 0
        GROUP BY ib.material_id, m.material_code, m.cubic_feet
        HAVING COUNT(DISTINCT ib.location_id) > 1  -- Material in multiple locations
      ),
      consolidation_targets AS (
        SELECT
          ms.*,
          (
            SELECT il.location_id
            FROM inventory_locations il
            WHERE il.tenant_id = $1
              AND il.facility_id = $2
              AND il.available_cubic_feet >= ms.total_volume
              AND il.location_type IN ('RESERVE', 'BULK')
              AND il.is_active = true
            ORDER BY il.available_cubic_feet ASC
            LIMIT 1
          ) as target_location_id
        FROM material_spread ms
        WHERE ms.location_count >= 2  -- At least 2 source locations
          AND ms.total_volume > 1.0   -- Minimum volume to be worth consolidating
      )
      SELECT
        material_id,
        material_code,
        total_quantity,
        total_volume,
        location_count,
        location_details,
        target_location_id
      FROM consolidation_targets
      WHERE target_location_id IS NOT NULL
      ORDER BY total_volume DESC
      LIMIT 20  -- Top 20 consolidation opportunities
      `,
      [tenantId, facilityId]
    );

    return result.rows.map((row) => {
      const locationDetails = row.location_details;
      const sourceLocations = locationDetails
        .slice(0, -1) // Take all but the largest location
        .map((loc: any) => loc.locationId);

      const quantityToMove = locationDetails
        .slice(0, -1)
        .reduce((sum: number, loc: any) => sum + loc.quantity, 0);

      const spaceRecovered = locationDetails
        .slice(0, -1)
        .reduce((sum: number, loc: any) => sum + loc.volume, 0);

      // Estimate 0.1 hours per move (6 minutes per bin)
      const estimatedLaborHours = sourceLocations.length * 0.1;

      // Priority based on space recovered
      let priority: 'LOW' | 'MEDIUM' | 'HIGH';
      if (spaceRecovered >= 20) priority = 'HIGH';
      else if (spaceRecovered >= 10) priority = 'MEDIUM';
      else priority = 'LOW';

      return {
        sourceLocationIds: sourceLocations,
        targetLocationId: row.target_location_id,
        materialId: row.material_id,
        materialCode: row.material_code,
        quantityToMove,
        spaceRecovered,
        estimatedLaborHours,
        priority,
      };
    });
  }

  /**
   * Log fragmentation metrics to database for trend tracking
   */
  async logFragmentationMetrics(
    tenantId: string,
    facilityId: string,
    metrics: FragmentationMetrics
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(
        `INSERT INTO bin_fragmentation_history (
          tenant_id,
          facility_id,
          zone_code,
          measurement_timestamp,
          total_available_cubic_feet,
          largest_contiguous_block,
          fragmentation_index,
          fragmentation_level,
          total_bins,
          bins_with_available_space,
          requires_consolidation,
          estimated_space_recovery,
          consolidation_opportunities_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          tenantId,
          facilityId,
          metrics.zoneCode || null,
          new Date(),
          metrics.totalAvailableCubicFeet,
          metrics.largestContiguousBlock,
          metrics.fragmentationIndex,
          metrics.fragmentationLevel,
          metrics.totalBins,
          metrics.binsWithAvailableSpace,
          metrics.requiresConsolidation,
          metrics.estimatedSpaceRecovery,
          metrics.consolidationOpportunities.length,
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get fragmentation trend history
   */
  async getFragmentationHistory(
    tenantId: string,
    facilityId: string,
    daysBack: number = 30
  ): Promise<FragmentationHistory[]> {
    const result = await this.pool.query(
      `SELECT
        measurement_timestamp,
        fragmentation_index,
        consolidation_opportunities_count as consolidations_performed,
        estimated_space_recovery as space_recovered
      FROM bin_fragmentation_history
      WHERE tenant_id = $1
        AND facility_id = $2
        AND measurement_timestamp >= CURRENT_TIMESTAMP - ($3 || ' days')::INTERVAL
      ORDER BY measurement_timestamp DESC`,
      [tenantId, facilityId, daysBack]
    );

    return result.rows.map((row) => ({
      measurementTimestamp: row.measurement_timestamp,
      fragmentationIndex: parseFloat(row.fragmentation_index),
      consolidationsPerformed: parseInt(row.consolidations_performed || '0'),
      spaceRecovered: parseFloat(row.space_recovered || '0'),
    }));
  }

  /**
   * Classify fragmentation level based on index
   */
  private classifyFragmentationLevel(
    fragmentationIndex: number
  ): 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' {
    if (fragmentationIndex < 1.5) return 'LOW';
    if (fragmentationIndex < 2.0) return 'MODERATE';
    if (fragmentationIndex < 3.0) return 'HIGH';
    return 'SEVERE';
  }

  /**
   * Check if facility needs defragmentation and alert if necessary
   */
  async checkAndAlertFragmentation(
    tenantId: string,
    facilityId: string
  ): Promise<FragmentationMetrics> {
    const metrics = await this.calculateFacilityFragmentation(tenantId, facilityId);

    // Log metrics for trending
    await this.logFragmentationMetrics(tenantId, facilityId, metrics);

    // Alert if fragmentation is high or severe
    if (metrics.fragmentationLevel === 'HIGH' || metrics.fragmentationLevel === 'SEVERE') {
      console.warn(
        `[FragmentationMonitoring] ${metrics.fragmentationLevel} fragmentation detected`,
        {
          facilityId,
          fragmentationIndex: metrics.fragmentationIndex,
          estimatedSpaceRecovery: metrics.estimatedSpaceRecovery,
          consolidationOpportunities: metrics.consolidationOpportunities.length,
        }
      );

      // TODO: Integrate with DevOpsAlertingService
      // await alertingService.sendAlert({
      //   timestamp: new Date(),
      //   severity: metrics.fragmentationLevel === 'SEVERE' ? 'CRITICAL' : 'WARNING',
      //   source: 'bin-fragmentation-monitoring',
      //   message: `${metrics.fragmentationLevel} bin fragmentation detected (FI: ${metrics.fragmentationIndex.toFixed(2)})`,
      //   metadata: {
      //     facilityId,
      //     fragmentationIndex: metrics.fragmentationIndex,
      //     estimatedSpaceRecovery: metrics.estimatedSpaceRecovery,
      //   },
      //   tenantId,
      //   facilityId,
      // });
    }

    return metrics;
  }
}
