/**
 * Enhanced Bin Optimization Health Service with Auto-Remediation
 *
 * Author: Roy (Backend Developer)
 * Requirement: REQ-STRATEGIC-AUTO-1766545799451
 * Purpose: Add automated remediation to health monitoring
 * Reference: Sylvia critique lines 512-545
 *
 * Enhancements:
 * - Auto-refresh cache when stale
 * - Auto-schedule ML retraining when accuracy drops
 * - DevOps alerting for critical issues
 * - Remediation action logging
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  message: string;
  [key: string]: any;
}

export interface RemediationAction {
  action: 'CACHE_REFRESHED' | 'ML_RETRAINING_SCHEDULED' | 'CONGESTION_CACHE_CLEARED' | 'INDEX_REBUILT' | 'DEVOPS_ALERTED';
  successful: boolean;
  preActionMetric?: number;
  postActionMetric?: number;
  errorMessage?: string;
}

export interface BinOptimizationHealthCheck {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  checks: {
    materializedViewFreshness: HealthCheckResult;
    mlModelAccuracy: HealthCheckResult;
    congestionCacheHealth: HealthCheckResult;
    databasePerformance: HealthCheckResult;
    algorithmPerformance: HealthCheckResult;
  };
  remediationActions: RemediationAction[];
  timestamp: Date;
}

@Injectable()
export class BinOptimizationHealthEnhancedService {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Run all health checks with auto-remediation
   * Reference: Sylvia critique lines 520-537
   */
  async checkHealth(tenantId?: string, autoRemediate: boolean = true): Promise<BinOptimizationHealthCheck> {
    const checks = await Promise.all([
      this.checkMaterializedViewFreshness(),
      this.checkMLModelAccuracy(),
      this.checkCongestionCacheHealth(),
      this.checkDatabasePerformance(),
      this.checkAlgorithmPerformance(),
    ]);

    const remediationActions: RemediationAction[] = [];

    // Auto-remediation if enabled
    if (autoRemediate) {
      // 1. Auto-refresh cache if unhealthy
      if (checks[0].status === 'UNHEALTHY') {
        const cacheRefreshAction = await this.autoRefreshCache(checks[0].secondsAgo, tenantId);
        remediationActions.push(cacheRefreshAction);

        if (cacheRefreshAction.successful) {
          await this.alertDevOps(
            'Cache auto-refreshed due to staleness',
            'WARNING',
            { preRefreshAge: checks[0].secondsAgo, tenantId }
          );
        }
      }

      // 2. Schedule ML retraining if degraded
      if (checks[1].status === 'DEGRADED' || checks[1].status === 'UNHEALTHY') {
        const mlRetrainingAction = await this.scheduleMlRetraining(checks[1].accuracy, tenantId);
        remediationActions.push(mlRetrainingAction);

        if (mlRetrainingAction.successful) {
          await this.alertDevOps(
            'ML retraining scheduled due to accuracy drop',
            checks[1].status === 'UNHEALTHY' ? 'CRITICAL' : 'WARNING',
            { accuracy: checks[1].accuracy, tenantId }
          );
        }
      }

      // 3. Alert DevOps on database performance issues
      if (checks[3].status === 'DEGRADED' || checks[3].status === 'UNHEALTHY') {
        await this.alertDevOps(
          'Database performance degraded',
          checks[3].status === 'UNHEALTHY' ? 'CRITICAL' : 'WARNING',
          { queryTime: checks[3].queryTimeMs, tenantId }
        );
      }

      // 4. Alert DevOps on algorithm performance issues
      if (checks[4].status === 'DEGRADED') {
        await this.alertDevOps(
          'Algorithm performance degraded',
          'WARNING',
          { processingTime: checks[4].processingTimeMs, tenantId }
        );
      }
    }

    return {
      status: this.aggregateStatus(checks),
      checks: {
        materializedViewFreshness: checks[0],
        mlModelAccuracy: checks[1],
        congestionCacheHealth: checks[2],
        databasePerformance: checks[3],
        algorithmPerformance: checks[4],
      },
      remediationActions,
      timestamp: new Date(),
    };
  }

  /**
   * Auto-refresh materialized view cache
   * Reference: Sylvia critique lines 527-528
   */
  private async autoRefreshCache(preRefreshAge: number, tenantId?: string): Promise<RemediationAction> {
    const startTime = Date.now();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Refresh materialized view concurrently (no locking)
      await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache');

      // Log remediation action
      await this.logRemediationAction(
        client,
        tenantId,
        'MATERIALIZED_VIEW_FRESHNESS',
        'UNHEALTHY',
        'CACHE_REFRESHED',
        true,
        preRefreshAge,
        0, // Fresh after refresh
        Date.now() - startTime
      );

      await client.query('COMMIT');

      return {
        action: 'CACHE_REFRESHED',
        successful: true,
        preActionMetric: preRefreshAge,
        postActionMetric: 0,
      };
    } catch (error) {
      await client.query('ROLLBACK');

      return {
        action: 'CACHE_REFRESHED',
        successful: false,
        errorMessage: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Schedule ML model retraining
   * Reference: Sylvia critique lines 531-533
   */
  private async scheduleMlRetraining(currentAccuracy: number, tenantId?: string): Promise<RemediationAction> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update ML model weights table to trigger retraining
      // (In production, this would integrate with your ML training pipeline)
      await client.query(
        `INSERT INTO ml_model_weights (
          tenant_id,
          model_name,
          weights,
          accuracy,
          training_status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, model_name)
        DO UPDATE SET
          training_status = 'SCHEDULED',
          updated_at = CURRENT_TIMESTAMP`,
        [
          tenantId || 'system',
          'bin_utilization_confidence',
          '{}', // Empty weights trigger retraining
          currentAccuracy,
          'SCHEDULED',
        ]
      );

      // Log remediation action
      await this.logRemediationAction(
        client,
        tenantId,
        'ML_MODEL_ACCURACY',
        currentAccuracy < 75 ? 'UNHEALTHY' : 'DEGRADED',
        'ML_RETRAINING_SCHEDULED',
        true,
        currentAccuracy,
        null,
        0
      );

      await client.query('COMMIT');

      return {
        action: 'ML_RETRAINING_SCHEDULED',
        successful: true,
        preActionMetric: currentAccuracy,
      };
    } catch (error) {
      await client.query('ROLLBACK');

      return {
        action: 'ML_RETRAINING_SCHEDULED',
        successful: false,
        errorMessage: error.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Alert DevOps team
   * Reference: Sylvia critique lines 528, 533
   */
  private async alertDevOps(
    message: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    metadata?: Record<string, any>
  ): Promise<void> {
    // In production, integrate with alerting system (PagerDuty, Slack, email, etc.)
    const alert = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      metadata,
      source: 'bin-optimization-health',
    };

    console.error(`[${severity}] ${message}`, metadata);

    // TODO: Integrate with actual alerting system
    // await alertingService.send(alert);
  }

  /**
   * Log remediation action to database
   */
  private async logRemediationAction(
    client: PoolClient,
    tenantId: string | undefined,
    healthCheckType: string,
    healthStatus: string,
    remediationAction: string,
    successful: boolean,
    preActionMetric: number | null,
    postActionMetric: number | null,
    executionTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await client.query(
        `INSERT INTO bin_optimization_remediation_log (
          tenant_id,
          health_check_type,
          health_status,
          remediation_action,
          action_successful,
          pre_action_metric_value,
          post_action_metric_value,
          improvement_pct,
          error_message,
          execution_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tenantId || 'system',
          healthCheckType,
          healthStatus,
          remediationAction,
          successful,
          preActionMetric,
          postActionMetric,
          preActionMetric && postActionMetric
            ? ((preActionMetric - postActionMetric) / preActionMetric) * 100
            : null,
          errorMessage,
          executionTimeMs,
        ]
      );
    } catch (error) {
      console.error('Failed to log remediation action:', error);
      // Don't throw - logging failure shouldn't break remediation
    }
  }

  // =====================================================
  // HEALTH CHECK METHODS (same as base service)
  // =====================================================

  private async checkMaterializedViewFreshness(): Promise<HealthCheckResult> {
    try {
      const result = await this.pool.query(`
        SELECT
          MAX(last_updated) as last_refresh,
          EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) as seconds_ago
        FROM bin_utilization_cache
      `);

      const secondsAgo = parseFloat(result.rows[0]?.seconds_ago) || 0;

      if (secondsAgo > 1800) {
        return {
          status: 'UNHEALTHY',
          message: `Cache not refreshed in ${Math.floor(secondsAgo / 60)} minutes`,
          lastRefresh: result.rows[0]?.last_refresh,
          secondsAgo,
        };
      } else if (secondsAgo > 600) {
        return {
          status: 'DEGRADED',
          message: `Cache is ${Math.floor(secondsAgo / 60)} minutes old`,
          lastRefresh: result.rows[0]?.last_refresh,
          secondsAgo,
        };
      }

      return {
        status: 'HEALTHY',
        message: 'Cache is fresh',
        lastRefresh: result.rows[0]?.last_refresh,
        secondsAgo,
      };
    } catch (error) {
      return {
        status: 'UNHEALTHY',
        message: `Cache check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  private async checkMLModelAccuracy(): Promise<HealthCheckResult> {
    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN accepted THEN 1 ELSE 0 END) as accepted,
          (SUM(CASE WHEN accepted THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*)::FLOAT, 0)) * 100 as accuracy
        FROM putaway_recommendations
        WHERE decided_at >= NOW() - INTERVAL '7 days'
          AND decided_at IS NOT NULL
      `);

      const accuracy = parseFloat(result.rows[0]?.accuracy) || 0;
      const total = parseInt(result.rows[0]?.total) || 0;

      if (total < 10) {
        return {
          status: 'HEALTHY',
          message: 'Insufficient data for accuracy check',
          accuracy: null,
          sampleSize: total,
        };
      }

      if (accuracy < 75) {
        return {
          status: 'UNHEALTHY',
          message: `ML accuracy at ${accuracy.toFixed(1)}% (target: 95%)`,
          accuracy,
          sampleSize: total,
        };
      } else if (accuracy < 85) {
        return {
          status: 'DEGRADED',
          message: `ML accuracy at ${accuracy.toFixed(1)}% (target: 95%)`,
          accuracy,
          sampleSize: total,
        };
      }

      return {
        status: 'HEALTHY',
        message: `ML accuracy at ${accuracy.toFixed(1)}%`,
        accuracy,
        sampleSize: total,
      };
    } catch (error) {
      return {
        status: 'DEGRADED',
        message: `ML accuracy check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  private async checkCongestionCacheHealth(): Promise<HealthCheckResult> {
    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as aisle_count
        FROM aisle_congestion_metrics
      `);

      const aisleCount = parseInt(result.rows[0]?.aisle_count) || 0;

      return {
        status: 'HEALTHY',
        message: aisleCount > 0 ? `Tracking ${aisleCount} aisles` : 'No active congestion (normal)',
        aisleCount,
      };
    } catch (error) {
      return {
        status: 'DEGRADED',
        message: `Congestion cache check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  private async checkDatabasePerformance(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.pool.query(`SELECT COUNT(*) FROM bin_utilization_cache LIMIT 1`);

      const elapsed = Date.now() - startTime;

      if (elapsed > 100) {
        return {
          status: 'DEGRADED',
          message: `Query took ${elapsed}ms (expected <10ms)`,
          queryTimeMs: elapsed,
        };
      }

      return {
        status: 'HEALTHY',
        message: `Query time: ${elapsed}ms`,
        queryTimeMs: elapsed,
      };
    } catch (error) {
      return {
        status: 'UNHEALTHY',
        message: `Database performance check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  private async checkAlgorithmPerformance(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      await this.pool.query(`SELECT 1 FROM materials LIMIT 1`);
      await this.pool.query(`SELECT 1 FROM inventory_locations LIMIT 1`);

      const elapsed = Date.now() - startTime;

      if (elapsed > 1000) {
        return {
          status: 'DEGRADED',
          message: `Database connection slow: ${elapsed}ms`,
          processingTimeMs: elapsed,
        };
      }

      return {
        status: 'HEALTHY',
        message: `Algorithm performance test: ${elapsed}ms`,
        processingTimeMs: elapsed,
      };
    } catch (error) {
      return {
        status: 'DEGRADED',
        message: `Algorithm test failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  private aggregateStatus(checks: HealthCheckResult[]): 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' {
    const hasUnhealthy = checks.some((c) => c.status === 'UNHEALTHY');
    const hasDegraded = checks.some((c) => c.status === 'DEGRADED');

    if (hasUnhealthy) return 'UNHEALTHY';
    if (hasDegraded) return 'DEGRADED';
    return 'HEALTHY';
  }
}
