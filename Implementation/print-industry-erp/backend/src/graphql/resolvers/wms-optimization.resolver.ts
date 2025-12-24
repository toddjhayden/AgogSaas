/**
 * WMS Optimization Resolvers
 * REQ-STRATEGIC-AUTO-1766476803478: Optimize Bin Utilization Algorithm
 *
 * Provides GraphQL resolvers for enhanced bin utilization optimization features:
 * - Batch putaway with Best Fit Decreasing (FFD)
 * - Congestion avoidance
 * - Cross-dock detection
 * - ML confidence adjustment
 * - Event-driven re-slotting
 */

import { Pool } from 'pg';
import { BinUtilizationOptimizationEnhancedService } from '../../modules/wms/services/bin-utilization-optimization-enhanced.service';
import { BinOptimizationHealthService } from '../../modules/wms/services/bin-optimization-health.service';

interface Context {
  pool: Pool;
  userId?: string;
  tenantId?: string;
}

interface BatchPutawayInput {
  facilityId: string;
  items: Array<{
    materialId: string;
    lotNumber: string;
    quantity: number;
    dimensions?: {
      lengthInches: number;
      widthInches: number;
      heightInches: number;
      weightLbsPerUnit: number;
    };
  }>;
}

interface PutawayDecisionInput {
  recommendationId: string;
  accepted: boolean;
  actualLocationId?: string;
}

export const wmsOptimizationResolvers = {
  Query: {
    /**
     * Get batch putaway recommendations using enhanced FFD algorithm
     */
    getBatchPutawayRecommendations: async (
      _: any,
      { input }: { input: BatchPutawayInput },
      context: Context
    ) => {
      const startTime = Date.now();
      const service = new BinUtilizationOptimizationEnhancedService(context.pool);

      try {
        const recommendations = await service.suggestBatchPutaway(input.items);

        const recommendationsArray = Array.from(recommendations.entries()).map(
          ([lotNumber, rec]) => ({
            lotNumber,
            materialId: input.items.find(i => i.lotNumber === lotNumber)?.materialId || '',
            recommendation: {
              locationId: rec.locationId,
              locationCode: rec.locationCode,
              locationType: rec.locationType,
              algorithm: rec.algorithm,
              confidenceScore: rec.confidenceScore,
              mlAdjustedConfidence: rec.mlAdjustedConfidence,
              reason: rec.reason,
              utilizationAfterPlacement: rec.utilizationAfterPlacement,
              availableCapacityAfter: rec.availableCapacityAfter,
              pickSequence: rec.pickSequence,
              congestionPenalty: rec.congestionPenalty,
              crossDockRecommendation: rec.crossDockRecommendation
            }
          })
        );

        const avgConfidence =
          recommendationsArray.reduce(
            (sum, r) => sum + r.recommendation.confidenceScore,
            0
          ) / recommendationsArray.length;

        const crossDockCount = recommendationsArray.filter(
          r => r.recommendation.crossDockRecommendation?.shouldCrossDock
        ).length;

        return {
          recommendations: recommendationsArray,
          totalItems: input.items.length,
          avgConfidenceScore: avgConfidence,
          crossDockOpportunities: crossDockCount,
          processingTimeMs: Date.now() - startTime
        };
      } finally {
        await service.close();
      }
    },

    /**
     * Get real-time aisle congestion metrics
     */
    getAisleCongestionMetrics: async (
      _: any,
      { facilityId }: { facilityId: string },
      context: Context
    ) => {
      // CRITICAL: Enforce tenant isolation
      if (!context.tenantId) {
        throw new Error('Tenant ID required for authorization');
      }

      const query = `
        SELECT DISTINCT
          acm.aisle_code as "aisleCode",
          acm.active_pick_lists as "currentActivePickLists",
          acm.avg_pick_time_minutes as "avgPickTimeMinutes",
          acm.congestion_score as "congestionScore",
          acm.congestion_level as "congestionLevel"
        FROM aisle_congestion_metrics acm
        INNER JOIN inventory_locations il ON il.aisle_code = acm.aisle_code
        WHERE il.tenant_id = $1
          AND il.facility_id = $2
        ORDER BY acm.congestion_score DESC
      `;

      const result = await context.pool.query(query, [context.tenantId, facilityId]);
      return result.rows;
    },

    /**
     * Detect cross-dock opportunity
     */
    detectCrossDockOpportunity: async (
      _: any,
      { materialId, quantity }: { materialId: string; quantity: number },
      context: Context
    ) => {
      const service = new BinUtilizationOptimizationEnhancedService(context.pool);

      try {
        return await service.detectCrossDockOpportunity(
          materialId,
          quantity,
          new Date()
        );
      } finally {
        await service.close();
      }
    },

    /**
     * Get bin utilization from cache (fast lookup)
     */
    getBinUtilizationCache: async (
      _: any,
      {
        facilityId,
        locationId,
        utilizationStatus
      }: {
        facilityId: string;
        locationId?: string;
        utilizationStatus?: string;
      },
      context: Context
    ) => {
      // CRITICAL: Enforce tenant isolation
      if (!context.tenantId) {
        throw new Error('Tenant ID required for authorization');
      }

      const conditions: string[] = ['buc.tenant_id = $1', 'buc.facility_id = $2'];
      const params: any[] = [context.tenantId, facilityId];
      let paramIndex = 3;

      if (locationId) {
        conditions.push(`buc.location_id = $${paramIndex}`);
        params.push(locationId);
        paramIndex++;
      }

      if (utilizationStatus) {
        conditions.push(`buc.utilization_status = $${paramIndex}`);
        params.push(utilizationStatus);
        paramIndex++;
      }

      const query = `
        SELECT
          location_id as "locationId",
          location_code as "locationCode",
          location_type as "locationType",
          zone_code as "zoneCode",
          aisle_code as "aisleCode",
          volume_utilization_pct as "volumeUtilizationPct",
          weight_utilization_pct as "weightUtilizationPct",
          utilization_status as "utilizationStatus",
          available_cubic_feet as "availableCubicFeet",
          available_weight as "availableWeight",
          lot_count as "lotCount",
          material_count as "materialCount",
          last_updated as "lastUpdated"
        FROM bin_utilization_cache buc
        WHERE ${conditions.join(' AND ')}
        ORDER BY volume_utilization_pct DESC
        LIMIT 500
      `;

      const result = await context.pool.query(query, params);
      return result.rows;
    },

    /**
     * Get re-slotting triggers
     */
    getReSlottingTriggers: async (
      _: any,
      { facilityId }: { facilityId: string },
      context: Context
    ) => {
      const service = new BinUtilizationOptimizationEnhancedService(context.pool);

      try {
        const triggers = await service.monitorVelocityChanges();

        return triggers.map(t => ({
          type: t.type,
          materialId: t.materialId,
          materialName: null, // Would need to join with materials table
          currentABCClass: t.currentABCClass,
          calculatedABCClass: t.calculatedABCClass,
          velocityChange: t.velocityChange,
          triggeredAt: t.triggeredAt.toISOString(),
          priority:
            t.type === 'VELOCITY_SPIKE' || t.type === 'PROMOTION'
              ? 'HIGH'
              : t.type === 'VELOCITY_DROP'
              ? 'MEDIUM'
              : 'LOW'
        }));
      } finally {
        await service.close();
      }
    },

    /**
     * Get material velocity analysis
     */
    getMaterialVelocityAnalysis: async (
      _: any,
      {
        facilityId,
        minVelocityChangePct
      }: { facilityId: string; minVelocityChangePct?: number },
      context: Context
    ) => {
      // CRITICAL: Enforce tenant isolation
      if (!context.tenantId) {
        throw new Error('Tenant ID required for authorization');
      }

      const conditions = ['mva.material_id IN (SELECT material_id FROM materials WHERE tenant_id = $1)'];
      const params: any[] = [context.tenantId];
      let paramIndex = 2;

      if (minVelocityChangePct !== undefined) {
        conditions.push(`ABS(mva.velocity_change_pct) >= $${paramIndex}`);
        params.push(minVelocityChangePct);
        paramIndex++;
      }

      const query = `
        SELECT
          mva.material_id as "materialId",
          mva.material_name as "materialName",
          mva.current_abc as "currentABC",
          mva.recent_picks_30d as "recentPicks30d",
          mva.recent_value_30d as "recentValue30d",
          mva.historical_picks_150d as "historicalPicks150d",
          mva.historical_value_150d as "historicalValue150d",
          mva.velocity_change_pct as "velocityChangePct",
          mva.velocity_spike as "velocitySpike",
          mva.velocity_drop as "velocityDrop",
          CASE
            WHEN mva.velocity_spike THEN 'Consider moving to higher velocity zone'
            WHEN mva.velocity_drop THEN 'Consider moving to lower velocity zone'
            ELSE 'No action required'
          END as "recommendedAction"
        FROM material_velocity_analysis mva
        WHERE ${conditions.join(' AND ')}
        ORDER BY ABS(mva.velocity_change_pct) DESC
        LIMIT 100
      `;

      const result = await context.pool.query(query, params);
      return result.rows;
    },

    /**
     * Get ML accuracy metrics
     */
    getMLAccuracyMetrics: async (_: any, __: any, context: Context) => {
      const service = new BinUtilizationOptimizationEnhancedService(context.pool);

      try {
        const metrics = await service.calculateAccuracyMetrics();

        const byAlgorithm = Array.from(metrics.byAlgorithm.entries()).map(
          ([algorithm, accuracy]) => ({
            algorithm,
            accuracy,
            count: 0 // Would need to track separately
          })
        );

        return {
          overallAccuracy: metrics.overallAccuracy,
          totalRecommendations: metrics.totalRecommendations,
          byAlgorithm,
          lastUpdated: new Date().toISOString()
        };
      } finally {
        await service.close();
      }
    },

    /**
     * Get optimization recommendations
     */
    getOptimizationRecommendations: async (
      _: any,
      { facilityId, limit }: { facilityId: string; limit?: number },
      context: Context
    ) => {
      // CRITICAL: Enforce tenant isolation
      if (!context.tenantId) {
        throw new Error('Tenant ID required for authorization');
      }

      // Verify facility belongs to tenant
      const facilityCheck = await context.pool.query(
        'SELECT facility_id FROM facilities WHERE facility_id = $1 AND tenant_id = $2',
        [facilityId, context.tenantId]
      );

      if (facilityCheck.rows.length === 0) {
        throw new Error('Facility not found or access denied');
      }

      const query = `
        SELECT
          recommendation_type as "type",
          priority,
          location_id as "locationId",
          location_code as "locationCode",
          current_utilization as "currentUtilization",
          reason,
          expected_impact as "expectedImpact"
        FROM get_bin_optimization_recommendations($1, $2)
      `;

      const result = await context.pool.query(query, [facilityId, limit || 50]);
      return result.rows;
    },

    /**
     * Get bin optimization health check
     */
    getBinOptimizationHealth: async (_: any, __: any, context: Context) => {
      const healthService = new BinOptimizationHealthService(context.pool);

      try {
        const health = await healthService.checkHealth();

        return {
          status: health.status,
          checks: {
            materializedViewFreshness: {
              status: health.checks.materializedViewFreshness.status,
              message: health.checks.materializedViewFreshness.message,
              lastRefresh: health.checks.materializedViewFreshness.lastRefresh?.toISOString(),
              ...health.checks.materializedViewFreshness
            },
            mlModelAccuracy: {
              status: health.checks.mlModelAccuracy.status,
              message: health.checks.mlModelAccuracy.message,
              ...health.checks.mlModelAccuracy
            },
            congestionCacheHealth: {
              status: health.checks.congestionCacheHealth.status,
              message: health.checks.congestionCacheHealth.message,
              ...health.checks.congestionCacheHealth
            },
            databasePerformance: {
              status: health.checks.databasePerformance.status,
              message: health.checks.databasePerformance.message,
              ...health.checks.databasePerformance
            },
            algorithmPerformance: {
              status: health.checks.algorithmPerformance.status,
              message: health.checks.algorithmPerformance.message,
              ...health.checks.algorithmPerformance
            }
          },
          timestamp: health.timestamp.toISOString()
        };
      } finally {
        await healthService.close();
      }
    }
  },

  Mutation: {
    /**
     * Record putaway decision for ML training
     */
    recordPutawayDecision: async (
      _: any,
      {
        recommendationId,
        accepted,
        actualLocationId
      }: {
        recommendationId: string;
        accepted: boolean;
        actualLocationId?: string;
      },
      context: Context
    ) => {
      const query = `
        UPDATE putaway_recommendations
        SET
          accepted = $1,
          actual_location_id = $2,
          decided_at = CURRENT_TIMESTAMP,
          decided_by = $3
        WHERE recommendation_id = $4
      `;

      await context.pool.query(query, [
        accepted,
        actualLocationId,
        context.userId,
        recommendationId
      ]);

      return true;
    },

    /**
     * Train ML model with recent feedback
     */
    trainMLModel: async (_: any, __: any, context: Context) => {
      const service = new BinUtilizationOptimizationEnhancedService(context.pool);

      try {
        await service.trainMLModel();
        return true;
      } catch (error) {
        console.error('ML training failed:', error);
        return false;
      } finally {
        await service.close();
      }
    },

    /**
     * Refresh bin utilization cache
     */
    refreshBinUtilizationCache: async (
      _: any,
      { locationId }: { locationId?: string },
      context: Context
    ) => {
      try {
        if (locationId) {
          await context.pool.query('SELECT refresh_bin_utilization_for_location($1)', [
            locationId
          ]);
        } else {
          await context.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache');
        }
        return true;
      } catch (error) {
        console.error('Cache refresh failed:', error);
        return false;
      }
    },

    /**
     * Execute automated re-slotting
     */
    executeAutomatedReSlotting: async (
      _: any,
      { facilityId, materialIds }: { facilityId: string; materialIds: string[] },
      context: Context
    ) => {
      // This would implement the actual re-slotting logic
      // For now, just create recommendations
      const query = `
        INSERT INTO reslotting_history (
          tenant_id,
          facility_id,
          material_id,
          from_location_id,
          to_location_id,
          reslot_type,
          reason,
          status,
          created_at,
          created_by
        )
        SELECT
          m.tenant_id,
          $1,
          m.material_id,
          l.location_id,
          NULL,
          'VELOCITY_CHANGE',
          'Automated re-slotting triggered by velocity analysis',
          'PENDING',
          CURRENT_TIMESTAMP,
          $2
        FROM materials m
        INNER JOIN lots l ON m.material_id = l.material_id
        WHERE m.material_id = ANY($3::uuid[])
        LIMIT 100
      `;

      try {
        await context.pool.query(query, [facilityId, context.userId, materialIds]);
        return true;
      } catch (error) {
        console.error('Re-slotting execution failed:', error);
        return false;
      }
    }
  }
};
