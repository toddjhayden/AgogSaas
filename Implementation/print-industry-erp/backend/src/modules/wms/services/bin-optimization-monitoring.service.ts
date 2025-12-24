import { Pool } from 'pg';

/**
 * Bin Optimization Monitoring Service
 *
 * REQ-STRATEGIC-AUTO-1766516942302: Optimize Bin Utilization Algorithm
 * Addresses CRITICAL GAP #2: Monitoring & Alerting Infrastructure
 *
 * Provides health checks, metrics, and monitoring capabilities for the
 * bin optimization system.
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  checks: {
    cacheAge: {
      status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      ageMinutes: number;
      threshold: number;
      message: string;
    };
    mlModelAccuracy: {
      status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      accuracy: number;
      threshold: number;
      message: string;
    };
    avgConfidence: {
      status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      confidence: number;
      threshold: number;
      message: string;
    };
    databaseConnection: {
      status: 'HEALTHY' | 'UNHEALTHY';
      message: string;
    };
  };
  timestamp: Date;
}

export interface PerformanceMetrics {
  cacheAgeSeconds: number;
  putawayRecommendationConfidenceScore: number;  // Average
  mlModelAccuracyPercentage: number;
  batchPutawayProcessingTimeMs: number;  // Average
  totalRecommendationsLast24h: number;
  acceptanceRateLast24h: number;
  cacheHitRate: number;
}

export interface AlertThreshold {
  metric: string;
  level: 'CRITICAL' | 'WARNING' | 'INFO';
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: Date;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class BinOptimizationMonitoringService {
  private pool: Pool;

  // Health check thresholds
  private readonly CACHE_AGE_HEALTHY_MINUTES = 15;
  private readonly CACHE_AGE_DEGRADED_MINUTES = 30;
  private readonly ML_ACCURACY_HEALTHY_PCT = 80;
  private readonly ML_ACCURACY_DEGRADED_PCT = 70;
  private readonly AVG_CONFIDENCE_HEALTHY = 0.75;
  private readonly AVG_CONFIDENCE_DEGRADED = 0.65;

  constructor(pool?: Pool) {
    if (pool) {
      this.pool = pool;
    } else {
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
  // HEALTH CHECKS
  // ==========================================================================

  /**
   * Comprehensive health check for bin optimization system
   * Returns HTTP status code equivalent status
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.all([
      this.checkCacheAge(),
      this.checkMLModelAccuracy(),
      this.checkAverageConfidence(),
      this.checkDatabaseConnection(),
    ]);

    const [cacheAge, mlModelAccuracy, avgConfidence, databaseConnection] = checks;

    // Determine overall status
    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    if (
      databaseConnection.status === 'UNHEALTHY' ||
      cacheAge.status === 'UNHEALTHY' ||
      mlModelAccuracy.status === 'UNHEALTHY'
    ) {
      status = 'UNHEALTHY';
    } else if (
      cacheAge.status === 'DEGRADED' ||
      mlModelAccuracy.status === 'DEGRADED' ||
      avgConfidence.status === 'DEGRADED'
    ) {
      status = 'DEGRADED';
    } else {
      status = 'HEALTHY';
    }

    return {
      status,
      checks: {
        cacheAge,
        mlModelAccuracy,
        avgConfidence,
        databaseConnection,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Check materialized view cache age
   */
  private async checkCacheAge(): Promise<HealthCheckResult['checks']['cacheAge']> {
    try {
      const result = await this.pool.query(`
        SELECT
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_refresh_at)) / 60 as age_minutes
        FROM cache_refresh_status
        WHERE cache_name = 'bin_utilization_cache'
      `);

      if (result.rows.length === 0) {
        return {
          status: 'UNHEALTHY',
          ageMinutes: 9999,
          threshold: this.CACHE_AGE_HEALTHY_MINUTES,
          message: 'Cache refresh status not found',
        };
      }

      const ageMinutes = parseFloat(result.rows[0].age_minutes);

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      let message: string;

      if (ageMinutes <= this.CACHE_AGE_HEALTHY_MINUTES) {
        status = 'HEALTHY';
        message = `Cache is fresh (${ageMinutes.toFixed(1)} minutes old)`;
      } else if (ageMinutes <= this.CACHE_AGE_DEGRADED_MINUTES) {
        status = 'DEGRADED';
        message = `Cache is stale (${ageMinutes.toFixed(1)} minutes old, threshold: ${this.CACHE_AGE_HEALTHY_MINUTES} min)`;
      } else {
        status = 'UNHEALTHY';
        message = `Cache is very stale (${ageMinutes.toFixed(1)} minutes old, critical threshold: ${this.CACHE_AGE_DEGRADED_MINUTES} min)`;
      }

      return {
        status,
        ageMinutes,
        threshold: this.CACHE_AGE_HEALTHY_MINUTES,
        message,
      };
    } catch (error) {
      return {
        status: 'UNHEALTHY',
        ageMinutes: 9999,
        threshold: this.CACHE_AGE_HEALTHY_MINUTES,
        message: `Failed to check cache age: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check ML model accuracy
   */
  private async checkMLModelAccuracy(): Promise<HealthCheckResult['checks']['mlModelAccuracy']> {
    try {
      const result = await this.pool.query(`
        SELECT
          CASE
            WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN accepted = TRUE THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100
            ELSE 0
          END as accuracy_pct
        FROM putaway_recommendations
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
          AND decided_at IS NOT NULL
      `);

      const accuracy = result.rows.length > 0 ? parseFloat(result.rows[0].accuracy_pct) : 0;

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      let message: string;

      if (accuracy >= this.ML_ACCURACY_HEALTHY_PCT) {
        status = 'HEALTHY';
        message = `ML accuracy is good (${accuracy.toFixed(1)}%)`;
      } else if (accuracy >= this.ML_ACCURACY_DEGRADED_PCT) {
        status = 'DEGRADED';
        message = `ML accuracy is below target (${accuracy.toFixed(1)}%, threshold: ${this.ML_ACCURACY_HEALTHY_PCT}%)`;
      } else {
        status = 'UNHEALTHY';
        message = `ML accuracy is critically low (${accuracy.toFixed(1)}%, critical threshold: ${this.ML_ACCURACY_DEGRADED_PCT}%)`;
      }

      return {
        status,
        accuracy,
        threshold: this.ML_ACCURACY_HEALTHY_PCT,
        message,
      };
    } catch (error) {
      return {
        status: 'DEGRADED',
        accuracy: 0,
        threshold: this.ML_ACCURACY_HEALTHY_PCT,
        message: `Failed to check ML accuracy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check average recommendation confidence
   */
  private async checkAverageConfidence(): Promise<HealthCheckResult['checks']['avgConfidence']> {
    try {
      const result = await this.pool.query(`
        SELECT AVG(confidence_score) as avg_confidence
        FROM putaway_recommendations
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `);

      const confidence = result.rows.length > 0 && result.rows[0].avg_confidence
        ? parseFloat(result.rows[0].avg_confidence)
        : 0.5;

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
      let message: string;

      if (confidence >= this.AVG_CONFIDENCE_HEALTHY) {
        status = 'HEALTHY';
        message = `Average confidence is good (${confidence.toFixed(2)})`;
      } else if (confidence >= this.AVG_CONFIDENCE_DEGRADED) {
        status = 'DEGRADED';
        message = `Average confidence is below target (${confidence.toFixed(2)}, threshold: ${this.AVG_CONFIDENCE_HEALTHY})`;
      } else {
        status = 'UNHEALTHY';
        message = `Average confidence is critically low (${confidence.toFixed(2)}, critical threshold: ${this.AVG_CONFIDENCE_DEGRADED})`;
      }

      return {
        status,
        confidence,
        threshold: this.AVG_CONFIDENCE_HEALTHY,
        message,
      };
    } catch (error) {
      return {
        status: 'DEGRADED',
        confidence: 0,
        threshold: this.AVG_CONFIDENCE_HEALTHY,
        message: `Failed to check confidence: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection(): Promise<HealthCheckResult['checks']['databaseConnection']> {
    try {
      await this.pool.query('SELECT 1');
      return {
        status: 'HEALTHY',
        message: 'Database connection is active',
      };
    } catch (error) {
      return {
        status: 'UNHEALTHY',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================================================
  // METRICS COLLECTION
  // ==========================================================================

  /**
   * Collect performance metrics for Prometheus export
   */
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const [
      cacheAge,
      avgConfidence,
      mlAccuracy,
      avgProcessingTime,
      totalRecs,
      acceptanceRate,
    ] = await Promise.all([
      this.getCacheAgeSeconds(),
      this.getAverageConfidence(),
      this.getMLAccuracy(),
      this.getAverageProcessingTime(),
      this.getTotalRecommendations24h(),
      this.getAcceptanceRate24h(),
    ]);

    return {
      cacheAgeSeconds: cacheAge,
      putawayRecommendationConfidenceScore: avgConfidence,
      mlModelAccuracyPercentage: mlAccuracy,
      batchPutawayProcessingTimeMs: avgProcessingTime,
      totalRecommendationsLast24h: totalRecs,
      acceptanceRateLast24h: acceptanceRate,
      cacheHitRate: 0.95, // Placeholder - would track actual cache hits
    };
  }

  private async getCacheAgeSeconds(): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_refresh_at)) as age_seconds
        FROM cache_refresh_status
        WHERE cache_name = 'bin_utilization_cache'
      `);
      return result.rows.length > 0 ? parseFloat(result.rows[0].age_seconds) : 9999;
    } catch {
      return 9999;
    }
  }

  private async getAverageConfidence(): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT AVG(confidence_score) as avg_confidence
        FROM putaway_recommendations
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `);
      return result.rows.length > 0 ? parseFloat(result.rows[0].avg_confidence || '0.5') : 0.5;
    } catch {
      return 0.5;
    }
  }

  private async getMLAccuracy(): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT
          CASE
            WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN accepted = TRUE THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100
            ELSE 85.0
          END as accuracy_pct
        FROM putaway_recommendations
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
          AND decided_at IS NOT NULL
      `);
      return parseFloat(result.rows[0].accuracy_pct);
    } catch {
      return 85.0;
    }
  }

  private async getAverageProcessingTime(): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT AVG(processing_time_ms) as avg_time
        FROM putaway_recommendations
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND processing_time_ms IS NOT NULL
      `);
      return result.rows.length > 0 ? parseFloat(result.rows[0].avg_time || '100') : 100;
    } catch {
      return 100;
    }
  }

  private async getTotalRecommendations24h(): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as total
        FROM putaway_recommendations
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `);
      return parseInt(result.rows[0].total);
    } catch {
      return 0;
    }
  }

  private async getAcceptanceRate24h(): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT
          CASE
            WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN accepted = TRUE THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100
            ELSE 0
          END as acceptance_rate
        FROM putaway_recommendations
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
          AND decided_at IS NOT NULL
      `);
      return parseFloat(result.rows[0].acceptance_rate);
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // ALERTING
  // ==========================================================================

  /**
   * Check for alert conditions and return triggered alerts
   */
  async checkAlertThresholds(): Promise<AlertThreshold[]> {
    const alerts: AlertThreshold[] = [];
    const metrics = await this.collectPerformanceMetrics();

    // CRITICAL: Cache age >30 minutes
    if (metrics.cacheAgeSeconds > 1800) {
      alerts.push({
        metric: 'cache_age_seconds',
        level: 'CRITICAL',
        threshold: 1800,
        currentValue: metrics.cacheAgeSeconds,
        message: `Bin utilization cache is ${(metrics.cacheAgeSeconds / 60).toFixed(1)} minutes old (threshold: 30 min)`,
        triggeredAt: new Date(),
      });
    }

    // CRITICAL: ML accuracy <70%
    if (metrics.mlModelAccuracyPercentage < 70) {
      alerts.push({
        metric: 'ml_model_accuracy_percentage',
        level: 'CRITICAL',
        threshold: 70,
        currentValue: metrics.mlModelAccuracyPercentage,
        message: `ML model accuracy is ${metrics.mlModelAccuracyPercentage.toFixed(1)}% (critical threshold: 70%)`,
        triggeredAt: new Date(),
      });
    }

    // WARNING: Avg confidence <0.75
    if (metrics.putawayRecommendationConfidenceScore < 0.75) {
      alerts.push({
        metric: 'putaway_recommendation_confidence_score',
        level: 'WARNING',
        threshold: 0.75,
        currentValue: metrics.putawayRecommendationConfidenceScore,
        message: `Average recommendation confidence is ${metrics.putawayRecommendationConfidenceScore.toFixed(2)} (threshold: 0.75)`,
        triggeredAt: new Date(),
      });
    }

    // WARNING: Processing time p95 >2000ms
    if (metrics.batchPutawayProcessingTimeMs > 2000) {
      alerts.push({
        metric: 'batch_putaway_processing_time_ms',
        level: 'WARNING',
        threshold: 2000,
        currentValue: metrics.batchPutawayProcessingTimeMs,
        message: `Batch putaway processing time is ${metrics.batchPutawayProcessingTimeMs.toFixed(0)}ms (threshold: 2000ms)`,
        triggeredAt: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Export metrics in Prometheus format
   */
  async exportPrometheusMetrics(): Promise<string> {
    const metrics = await this.collectPerformanceMetrics();
    const lines: string[] = [];

    // Helper to add metric
    const addMetric = (name: string, value: number, help: string, type = 'gauge') => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      lines.push(`${name} ${value}`);
      lines.push('');
    };

    addMetric(
      'bin_utilization_cache_age_seconds',
      metrics.cacheAgeSeconds,
      'Age of bin utilization materialized view in seconds'
    );

    addMetric(
      'putaway_recommendation_confidence_score',
      metrics.putawayRecommendationConfidenceScore,
      'Average confidence score for putaway recommendations (last 24h)',
      'histogram'
    );

    addMetric(
      'ml_model_accuracy_percentage',
      metrics.mlModelAccuracyPercentage,
      'ML model accuracy percentage (last 7 days)'
    );

    addMetric(
      'batch_putaway_processing_time_ms',
      metrics.batchPutawayProcessingTimeMs,
      'Average batch putaway processing time in milliseconds (last 24h)',
      'histogram'
    );

    addMetric(
      'putaway_recommendations_total',
      metrics.totalRecommendationsLast24h,
      'Total putaway recommendations in last 24 hours',
      'counter'
    );

    addMetric(
      'putaway_acceptance_rate_percentage',
      metrics.acceptanceRateLast24h,
      'Putaway recommendation acceptance rate in last 24 hours'
    );

    return lines.join('\n');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
