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
}
