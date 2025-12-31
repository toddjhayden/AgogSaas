/**
 * Performance Analytics GraphQL Resolver (NestJS)
 * Provides real-time performance monitoring and analytics data
 *
 * Features:
 * - Performance overview with health scoring
 * - Slow query tracking and analysis
 * - API endpoint performance metrics
 * - System resource utilization
 * - Database connection pool health
 *
 * REQ: REQ-STRATEGIC-AUTO-1767045901876
 */

import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { PerformanceMetricsService } from '../../modules/monitoring/services/performance-metrics.service';

@Resolver()
export class PerformanceResolver {
  constructor(private performanceMetricsService: PerformanceMetricsService) {}

  /**
   * Get system-wide performance overview
   */
  @Query()
  async performanceOverview(
    @Args('facilityId') facilityId: string | null,
    @Args('timeRange') timeRange: string,
    @Context() context: any
  ) {
    // Get tenant ID from context (set by authentication middleware)
    const tenantId = context.req?.user?.tenantId || facilityId || 'system';

    return this.performanceMetricsService.getPerformanceOverview(tenantId, timeRange);
  }

  /**
   * Get slow queries in time range
   */
  @Query()
  async slowQueries(
    @Args('facilityId') facilityId: string | null,
    @Args('threshold') threshold: number = 1000,
    @Args('timeRange') timeRange: string,
    @Args('limit') limit: number = 100,
    @Context() context: any
  ) {
    const tenantId = context.req?.user?.tenantId || facilityId || 'system';

    return this.performanceMetricsService.getSlowQueries(
      tenantId,
      timeRange,
      threshold,
      limit
    );
  }

  /**
   * Get API endpoint performance statistics
   */
  @Query()
  async endpointMetrics(
    @Args('endpoint') endpoint: string | null,
    @Args('timeRange') timeRange: string,
    @Context() context: any
  ) {
    const tenantId = context.req?.user?.tenantId || 'system';

    return this.performanceMetricsService.getEndpointMetrics(
      tenantId,
      timeRange,
      endpoint || undefined
    );
  }

  /**
   * Get resource utilization time series
   */
  @Query()
  async resourceUtilization(
    @Args('facilityId') facilityId: string | null,
    @Args('timeRange') timeRange: string,
    @Args('interval') interval: string = '5m',
    @Context() context: any
  ) {
    const tenantId = context.req?.user?.tenantId || facilityId || 'system';

    return this.performanceMetricsService.getResourceUtilization(
      tenantId,
      timeRange,
      interval
    );
  }

  /**
   * Get database connection pool health
   */
  @Query()
  async databasePoolMetrics(
    @Args('timeRange') timeRange: string,
    @Context() context: any
  ) {
    const tenantId = context.req?.user?.tenantId || 'system';

    // Get current pool stats
    const pool = (this.performanceMetricsService as any).db;

    const utilizationHistory = await this.performanceMetricsService.getResourceUtilization(
      tenantId,
      timeRange,
      '5m'
    );

    return {
      currentConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount || 0,
      totalQueries: 0, // TODO: Track from metrics
      avgQueryTimeMs: 0, // TODO: Calculate from metrics
      utilizationPercent: pool.totalCount > 0
        ? ((pool.totalCount - pool.idleCount) / pool.totalCount) * 100
        : 0,
      utilizationHistory: utilizationHistory.map(metric => ({
        timestamp: metric.timestamp,
        utilizationPercent: metric.activeConnections,
        activeConnections: metric.activeConnections,
        queuedRequests: 0
      }))
    };
  }

  /**
   * Get real-time database statistics
   */
  @Query()
  async databaseStats(@Context() context: any) {
    const pool = (this.performanceMetricsService as any).db;

    // Query PostgreSQL system statistics
    const statsQuery = `
      SELECT
        -- Connection stats
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
        (SELECT count(*) FROM pg_stat_activity) AS total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') AS active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') AS idle_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) AS waiting_connections,

        -- Query stats
        (SELECT sum(calls) FROM pg_stat_user_functions) AS total_queries,
        (SELECT avg(mean_exec_time) FROM pg_stat_statements WHERE calls > 0) AS avg_query_time_ms,
        (SELECT count(*) FROM pg_stat_statements WHERE mean_exec_time > 1000) AS slow_queries,

        -- Cache hit ratio
        (SELECT
          CASE
            WHEN (sum(blks_hit) + sum(blks_read)) > 0
            THEN (sum(blks_hit)::float / (sum(blks_hit) + sum(blks_read))) * 100
            ELSE 0
          END
         FROM pg_stat_database) AS cache_hit_ratio,

        -- Table stats
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS total_tables,
        (SELECT sum(n_live_tup) FROM pg_stat_user_tables) AS total_rows,
        (SELECT sum(pg_total_relation_size(schemaname||'.'||tablename)::bigint) / 1024 / 1024
         FROM pg_tables WHERE schemaname = 'public') AS total_size_mb,
        (SELECT sum(pg_indexes_size(schemaname||'.'||tablename)::bigint) / 1024 / 1024
         FROM pg_tables WHERE schemaname = 'public') AS index_size_mb,

        -- Performance stats
        (SELECT sum(xact_commit + xact_rollback) FROM pg_stat_database) AS total_transactions,
        (SELECT sum(blks_read) FROM pg_stat_database) AS blocks_read,
        (SELECT sum(blks_hit) FROM pg_stat_database) AS blocks_hit,
        (SELECT sum(tup_returned) FROM pg_stat_database) AS tuples_returned,
        (SELECT sum(tup_fetched) FROM pg_stat_database) AS tuples_fetched
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    // Calculate transactions per second (approximate based on uptime)
    const uptimeQuery = 'SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) AS uptime_seconds';
    const uptimeResult = await pool.query(uptimeQuery);
    const uptimeSeconds = parseFloat(uptimeResult.rows[0].uptime_seconds);
    const transactionsPerSecond = uptimeSeconds > 0
      ? (parseInt(stats.total_transactions || '0') / uptimeSeconds)
      : 0;

    return {
      connectionStats: {
        total: parseInt(stats.total_connections || '0'),
        active: parseInt(stats.active_connections || '0'),
        idle: parseInt(stats.idle_connections || '0'),
        waiting: parseInt(stats.waiting_connections || '0'),
        maxConnections: parseInt(stats.max_connections || '100'),
      },
      queryStats: {
        totalQueries: parseInt(stats.total_queries || '0'),
        avgQueryTimeMs: parseFloat(stats.avg_query_time_ms || '0'),
        slowQueries: parseInt(stats.slow_queries || '0'),
        cacheHitRatio: parseFloat(stats.cache_hit_ratio || '0'),
      },
      tableStats: {
        totalTables: parseInt(stats.total_tables || '0'),
        totalRows: parseInt(stats.total_rows || '0'),
        totalSizeMB: parseFloat(stats.total_size_mb || '0'),
        indexSizeMB: parseFloat(stats.index_size_mb || '0'),
      },
      performanceStats: {
        transactionsPerSecond,
        blocksRead: parseInt(stats.blocks_read || '0'),
        blocksHit: parseInt(stats.blocks_hit || '0'),
        tuplesReturned: parseInt(stats.tuples_returned || '0'),
        tuplesFetched: parseInt(stats.tuples_fetched || '0'),
      },
    };
  }
}
