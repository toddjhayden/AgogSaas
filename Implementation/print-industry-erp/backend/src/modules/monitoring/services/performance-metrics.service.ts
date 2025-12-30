/**
 * Performance Metrics Service
 * Collects and aggregates performance data for API, queries, and system resources
 *
 * Features:
 * - Buffered metrics collection (flush every 10 seconds)
 * - Query performance tracking with MD5 hashing
 * - API endpoint performance tracking
 * - System resource monitoring (CPU, memory, event loop)
 * - Performance overview with health scoring
 * - Bottleneck detection and recommendations
 *
 * REQ: REQ-STRATEGIC-AUTO-1767045901876
 */

import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';

interface QueryMetric {
  type: 'query';
  tenantId: string;
  queryHash: string;
  queryPreview: string;
  executionTimeMs: number;
  rowsReturned: number;
  endpoint: string;
  userId?: string;
  timestamp: Date;
}

interface ApiMetric {
  type: 'api';
  tenantId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  requestSizeBytes: number;
  responseSizeBytes: number;
  userId?: string;
  timestamp: Date;
}

type MetricEntry = QueryMetric | ApiMetric;

interface PerformanceOverview {
  timeRange: string;
  healthScore: number;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'CRITICAL';
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  requestsPerSecond: number;
  errorRate: number;
  avgQueryTimeMs: number;
  slowQueryCount: number;
  connectionPoolUtilization: number;
  avgCpuUsagePercent: number;
  avgMemoryUsageMB: number;
  maxMemoryUsageMB: number;
  performanceTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL';
  topBottlenecks: PerformanceBottleneck[];
}

interface PerformanceBottleneck {
  type: 'SLOW_QUERY' | 'HIGH_CPU' | 'MEMORY_LEAK' | 'CONNECTION_POOL_EXHAUSTION' | 'N_PLUS_ONE_QUERY' | 'UNINDEXED_QUERY' | 'LARGE_PAYLOAD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  impact: string;
  recommendation: string;
  affectedEndpoints: string[];
}

interface SlowQuery {
  id: string;
  queryHash: string;
  queryPreview: string;
  executionTimeMs: number;
  rowsReturned: number;
  endpoint: string;
  timestamp: Date;
  occurrenceCount: number;
}

interface EndpointMetric {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  maxResponseTimeMs: number;
  avgRequestSizeBytes: number;
  avgResponseSizeBytes: number;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL';
}

interface ResourceMetric {
  timestamp: Date;
  cpuUsagePercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  eventLoopLagMs: number;
  activeConnections: number;
  heapUsedMB: number;
  heapTotalMB: number;
}

@Injectable()
export class PerformanceMetricsService implements OnModuleInit, OnModuleDestroy {
  private metricsBuffer: MetricEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private systemMetricsInterval: NodeJS.Timeout | null = null;

  constructor(@Inject('DATABASE_POOL') private db: Pool) {}

  onModuleInit() {
    // Flush metrics buffer every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 10000);

    // Start system metrics collection (every 10 seconds)
    this.startSystemMetricsCollection();
  }

  onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    // Final flush
    this.flushMetrics();
  }

  /**
   * Record query performance
   */
  async recordQueryPerformance(
    tenantId: string,
    query: string,
    executionTimeMs: number,
    rowsReturned: number,
    endpoint: string,
    userId?: string
  ) {
    const queryHash = crypto.createHash('md5').update(query).digest('hex');
    const queryPreview = query.substring(0, 500);

    this.metricsBuffer.push({
      type: 'query',
      tenantId,
      queryHash,
      queryPreview,
      executionTimeMs,
      rowsReturned,
      endpoint,
      userId,
      timestamp: new Date()
    });

    // Flush if buffer exceeds 100 items
    if (this.metricsBuffer.length >= 100) {
      await this.flushMetrics();
    }
  }

  /**
   * Record API performance
   */
  async recordApiPerformance(
    tenantId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    requestSizeBytes: number,
    responseSizeBytes: number,
    userId?: string
  ) {
    this.metricsBuffer.push({
      type: 'api',
      tenantId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      requestSizeBytes,
      responseSizeBytes,
      userId,
      timestamp: new Date()
    });

    if (this.metricsBuffer.length >= 100) {
      await this.flushMetrics();
    }
  }

  /**
   * Flush metrics buffer to database
   */
  private async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Insert query metrics
      const queryMetrics = metrics.filter(m => m.type === 'query') as QueryMetric[];
      if (queryMetrics.length > 0) {
        const values = queryMetrics.map((m, idx) => {
          const base = idx * 8;
          return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6}, $${base+7}, $${base+8})`;
        }).join(',');

        const params = queryMetrics.flatMap(m => [
          m.tenantId, m.queryHash, m.queryPreview, m.executionTimeMs,
          m.rowsReturned, m.endpoint, m.userId, m.timestamp
        ]);

        await client.query(`
          INSERT INTO query_performance_log (
            tenant_id, query_hash, query_preview, execution_time_ms,
            rows_returned, endpoint, user_id, timestamp
          ) VALUES ${values}
        `, params);
      }

      // Insert API metrics
      const apiMetrics = metrics.filter(m => m.type === 'api') as ApiMetric[];
      if (apiMetrics.length > 0) {
        const values = apiMetrics.map((m, idx) => {
          const base = idx * 9;
          return `($${base+1}, $${base+2}, $${base+3}, $${base+4}, $${base+5}, $${base+6}, $${base+7}, $${base+8}, $${base+9})`;
        }).join(',');

        const params = apiMetrics.flatMap(m => [
          m.tenantId, m.endpoint, m.method, m.statusCode, m.responseTimeMs,
          m.requestSizeBytes, m.responseSizeBytes, m.userId, m.timestamp
        ]);

        await client.query(`
          INSERT INTO api_performance_log (
            tenant_id, endpoint, method, status_code, response_time_ms,
            request_size_bytes, response_size_bytes, user_id, timestamp
          ) VALUES ${values}
        `, params);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PerformanceMetrics] Failed to flush metrics:', error);
    } finally {
      client.release();
    }
  }

  /**
   * Start system metrics collection (every 10 seconds)
   */
  private startSystemMetricsCollection() {
    this.systemMetricsInterval = setInterval(async () => {
      const cpuUsage = process.cpuUsage();
      const memUsage = process.memoryUsage();

      const metric = {
        tenantId: 'system', // System-level metrics
        cpuUsagePercent: ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2),
        memoryUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
        eventLoopLagMs: 0, // TODO: Implement with perf_hooks
        activeConnections: this.db.totalCount - this.db.idleCount,
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
        timestamp: new Date()
      };

      try {
        await this.db.query(`
          INSERT INTO system_resource_metrics (
            tenant_id, cpu_usage_percent, memory_used_mb, memory_total_mb,
            event_loop_lag_ms, active_connections, heap_used_mb, heap_total_mb, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (tenant_id, timestamp) DO NOTHING
        `, [
          metric.tenantId, metric.cpuUsagePercent, metric.memoryUsedMb,
          metric.memoryTotalMb, metric.eventLoopLagMs, metric.activeConnections,
          metric.heapUsedMb, metric.heapTotalMb, metric.timestamp
        ]);
      } catch (error) {
        console.error('[PerformanceMetrics] Failed to record system metrics:', error);
      }
    }, 10000);
  }

  /**
   * Get performance overview
   */
  async getPerformanceOverview(
    tenantId: string,
    timeRange: string = 'LAST_24_HOURS'
  ): Promise<PerformanceOverview> {
    const hoursBack = this.getHoursFromTimeRange(timeRange);

    const result = await this.db.query(`
      SELECT
        AVG(avg_response_time_ms) AS avg_response_time_ms,
        MAX(p95_response_time_ms) AS p95_response_time_ms,
        MAX(p99_response_time_ms) AS p99_response_time_ms,
        SUM(total_requests) / $2 AS requests_per_second,
        (SUM(failed_requests)::NUMERIC / NULLIF(SUM(total_requests), 0)) * 100 AS error_rate,
        AVG(avg_query_time_ms) AS avg_query_time_ms,
        SUM(slow_query_count) AS slow_query_count,
        AVG(avg_cpu_usage_percent) AS avg_cpu_usage_percent,
        AVG(avg_memory_usage_mb) AS avg_memory_usage_mb,
        MAX(max_memory_usage_mb) AS max_memory_usage_mb,
        AVG(health_score) AS health_score
      FROM performance_metrics_cache
      WHERE tenant_id = $1
        AND hour_bucket >= NOW() - INTERVAL '${hoursBack} hours'
    `, [tenantId, hoursBack * 3600]);

    const row = result.rows[0];
    const healthScore = parseFloat(row.health_score) || 0;

    return {
      timeRange,
      healthScore,
      status: this.getHealthStatus(healthScore),
      avgResponseTimeMs: parseFloat(row.avg_response_time_ms) || 0,
      p95ResponseTimeMs: parseInt(row.p95_response_time_ms) || 0,
      p99ResponseTimeMs: parseInt(row.p99_response_time_ms) || 0,
      requestsPerSecond: parseFloat(row.requests_per_second) || 0,
      errorRate: parseFloat(row.error_rate) || 0,
      avgQueryTimeMs: parseFloat(row.avg_query_time_ms) || 0,
      slowQueryCount: parseInt(row.slow_query_count) || 0,
      connectionPoolUtilization: this.db.totalCount > 0
        ? ((this.db.totalCount - this.db.idleCount) / this.db.totalCount) * 100
        : 0,
      avgCpuUsagePercent: parseFloat(row.avg_cpu_usage_percent) || 0,
      avgMemoryUsageMB: parseInt(row.avg_memory_usage_mb) || 0,
      maxMemoryUsageMB: parseInt(row.max_memory_usage_mb) || 0,
      performanceTrend: await this.calculateTrend(tenantId, hoursBack),
      topBottlenecks: await this.getTopBottlenecks(tenantId, hoursBack)
    };
  }

  /**
   * Get slow queries
   */
  async getSlowQueries(
    tenantId: string,
    timeRange: string,
    threshold: number = 1000,
    limit: number = 100
  ): Promise<SlowQuery[]> {
    const hoursBack = this.getHoursFromTimeRange(timeRange);

    const result = await this.db.query(`
      SELECT
        id,
        query_hash,
        query_preview,
        execution_time_ms,
        rows_returned,
        endpoint,
        timestamp,
        1 as occurrence_count
      FROM query_performance_log
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
        AND execution_time_ms >= $2
      ORDER BY execution_time_ms DESC
      LIMIT $3
    `, [tenantId, threshold, limit]);

    return result.rows.map(row => ({
      id: row.id,
      queryHash: row.query_hash,
      queryPreview: row.query_preview,
      executionTimeMs: row.execution_time_ms,
      rowsReturned: row.rows_returned,
      endpoint: row.endpoint,
      timestamp: row.timestamp,
      occurrenceCount: row.occurrence_count
    }));
  }

  /**
   * Get endpoint metrics
   */
  async getEndpointMetrics(
    tenantId: string,
    timeRange: string,
    endpoint?: string
  ): Promise<EndpointMetric[]> {
    const hoursBack = this.getHoursFromTimeRange(timeRange);

    const endpointFilter = endpoint ? 'AND endpoint = $3' : '';
    const params = endpoint ? [tenantId, hoursBack, endpoint] : [tenantId, hoursBack];

    const result = await this.db.query(`
      SELECT
        endpoint,
        method,
        COUNT(*) AS total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) AS successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) AS failed_requests,
        AVG(response_time_ms) AS avg_response_time_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms) AS p50_response_time_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_response_time_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_response_time_ms,
        MAX(response_time_ms) AS max_response_time_ms,
        AVG(request_size_bytes) AS avg_request_size_bytes,
        AVG(response_size_bytes) AS avg_response_size_bytes
      FROM api_performance_log
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
        ${endpointFilter}
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
    `, params);

    return result.rows.map(row => ({
      endpoint: row.endpoint,
      method: row.method,
      totalRequests: parseInt(row.total_requests),
      successfulRequests: parseInt(row.successful_requests),
      failedRequests: parseInt(row.failed_requests),
      avgResponseTimeMs: parseFloat(row.avg_response_time_ms),
      p50ResponseTimeMs: parseInt(row.p50_response_time_ms),
      p95ResponseTimeMs: parseInt(row.p95_response_time_ms),
      p99ResponseTimeMs: parseInt(row.p99_response_time_ms),
      maxResponseTimeMs: parseInt(row.max_response_time_ms),
      avgRequestSizeBytes: parseInt(row.avg_request_size_bytes),
      avgResponseSizeBytes: parseInt(row.avg_response_size_bytes),
      trend: 'STABLE' // TODO: Calculate trend
    }));
  }

  /**
   * Get resource utilization
   */
  async getResourceUtilization(
    tenantId: string,
    timeRange: string,
    interval: string = '5m'
  ): Promise<ResourceMetric[]> {
    const hoursBack = this.getHoursFromTimeRange(timeRange);

    const result = await this.db.query(`
      SELECT
        timestamp,
        cpu_usage_percent,
        memory_used_mb,
        memory_total_mb,
        event_loop_lag_ms,
        active_connections,
        heap_used_mb,
        heap_total_mb
      FROM system_resource_metrics
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
      ORDER BY timestamp ASC
    `, [tenantId]);

    return result.rows.map(row => ({
      timestamp: row.timestamp,
      cpuUsagePercent: parseFloat(row.cpu_usage_percent),
      memoryUsedMB: row.memory_used_mb,
      memoryTotalMB: row.memory_total_mb,
      eventLoopLagMs: parseFloat(row.event_loop_lag_ms),
      activeConnections: row.active_connections,
      heapUsedMB: row.heap_used_mb,
      heapTotalMB: row.heap_total_mb
    }));
  }

  /**
   * Refresh performance metrics cache
   */
  async refreshMetricsCache(tenantId?: string): Promise<{ hours_refreshed: number; duration_ms: number; status: string }> {
    const result = await this.db.query(
      'SELECT * FROM refresh_performance_metrics_incremental($1)',
      [tenantId]
    );

    return result.rows[0];
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  private getHoursFromTimeRange(timeRange: string): number {
    const map: Record<string, number> = {
      'LAST_HOUR': 1,
      'LAST_6_HOURS': 6,
      'LAST_24_HOURS': 24,
      'LAST_7_DAYS': 168,
      'LAST_30_DAYS': 720
    };
    return map[timeRange] || 24;
  }

  private getHealthStatus(score: number): 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'CRITICAL' {
    if (score >= 80) return 'HEALTHY';
    if (score >= 60) return 'DEGRADED';
    if (score >= 40) return 'UNHEALTHY';
    return 'CRITICAL';
  }

  private async calculateTrend(tenantId: string, hoursBack: number): Promise<'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL'> {
    // Compare recent performance to previous period
    const result = await this.db.query(`
      SELECT
        AVG(health_score) FILTER (WHERE hour_bucket >= NOW() - INTERVAL '${hoursBack/2} hours') AS recent_score,
        AVG(health_score) FILTER (WHERE hour_bucket < NOW() - INTERVAL '${hoursBack/2} hours') AS previous_score
      FROM performance_metrics_cache
      WHERE tenant_id = $1
        AND hour_bucket >= NOW() - INTERVAL '${hoursBack} hours'
    `, [tenantId]);

    const recent = parseFloat(result.rows[0]?.recent_score) || 0;
    const previous = parseFloat(result.rows[0]?.previous_score) || 0;
    const delta = recent - previous;

    if (delta > 10) return 'IMPROVING';
    if (delta < -10) return 'DEGRADING';
    if (recent < 50) return 'CRITICAL';
    return 'STABLE';
  }

  private async getTopBottlenecks(tenantId: string, hoursBack: number): Promise<PerformanceBottleneck[]> {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Get top slow queries
    const slowQueries = await this.db.query(`
      SELECT
        query_hash,
        query_preview,
        AVG(execution_time_ms) AS avg_time,
        COUNT(*) AS occurrence_count
      FROM query_performance_log
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
        AND execution_time_ms > 1000
      GROUP BY query_hash, query_preview
      ORDER BY avg_time DESC
      LIMIT 5
    `, [tenantId]);

    bottlenecks.push(...slowQueries.rows.map(row => ({
      type: 'SLOW_QUERY' as const,
      severity: (row.avg_time > 5000 ? 'CRITICAL' : 'HIGH') as 'CRITICAL' | 'HIGH',
      description: `Slow query detected: ${row.query_preview.substring(0, 100)}...`,
      impact: `Average execution time: ${row.avg_time}ms (${row.occurrence_count} occurrences)`,
      recommendation: 'Add database index or optimize query structure',
      affectedEndpoints: []
    })));

    return bottlenecks;
  }
}
