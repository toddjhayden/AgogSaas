import { gql } from '@apollo/client';

// =====================================================
// PERFORMANCE ANALYTICS QUERIES
// =====================================================

export const GET_PERFORMANCE_OVERVIEW = gql`
  query GetPerformanceOverview(
    $facilityId: ID
    $timeRange: TimeRange!
  ) {
    performanceOverview(
      facilityId: $facilityId
      timeRange: $timeRange
    ) {
      timeRange
      healthScore
      status
      avgResponseTimeMs
      p95ResponseTimeMs
      p99ResponseTimeMs
      requestsPerSecond
      errorRate
      avgQueryTimeMs
      slowQueryCount
      connectionPoolUtilization
      avgCpuUsagePercent
      avgMemoryUsageMB
      maxMemoryUsageMB
      performanceTrend
      topBottlenecks {
        type
        severity
        description
        impact
        recommendation
        affectedEndpoints
      }
    }
  }
`;

export const GET_SLOW_QUERIES = gql`
  query GetSlowQueries(
    $facilityId: ID
    $threshold: Int
    $timeRange: TimeRange!
    $limit: Int
  ) {
    slowQueries(
      facilityId: $facilityId
      threshold: $threshold
      timeRange: $timeRange
      limit: $limit
    ) {
      id
      queryHash
      queryPreview
      executionTimeMs
      rowsReturned
      endpoint
      timestamp
      occurrenceCount
    }
  }
`;

export const GET_ENDPOINT_METRICS = gql`
  query GetEndpointMetrics(
    $endpoint: String
    $timeRange: TimeRange!
  ) {
    endpointMetrics(
      endpoint: $endpoint
      timeRange: $timeRange
    ) {
      endpoint
      method
      totalRequests
      successfulRequests
      failedRequests
      avgResponseTimeMs
      p50ResponseTimeMs
      p95ResponseTimeMs
      p99ResponseTimeMs
      maxResponseTimeMs
      avgRequestSizeBytes
      avgResponseSizeBytes
      trend
    }
  }
`;

export const GET_RESOURCE_UTILIZATION = gql`
  query GetResourceUtilization(
    $facilityId: ID
    $timeRange: TimeRange!
    $interval: String
  ) {
    resourceUtilization(
      facilityId: $facilityId
      timeRange: $timeRange
      interval: $interval
    ) {
      timestamp
      cpuUsagePercent
      memoryUsedMB
      memoryTotalMB
      eventLoopLagMs
      activeConnections
      heapUsedMB
      heapTotalMB
    }
  }
`;

export const GET_DATABASE_POOL_METRICS = gql`
  query GetDatabasePoolMetrics(
    $timeRange: TimeRange!
  ) {
    databasePoolMetrics(
      timeRange: $timeRange
    ) {
      currentConnections
      idleConnections
      waitingRequests
      totalQueries
      avgQueryTimeMs
      utilizationPercent
      utilizationHistory {
        timestamp
        utilizationPercent
        activeConnections
        queuedRequests
      }
    }
  }
`;

export const GET_DATABASE_STATS = gql`
  query GetDatabaseStats {
    databaseStats {
      connectionStats {
        total
        active
        idle
        waiting
        maxConnections
      }
      queryStats {
        totalQueries
        avgQueryTimeMs
        slowQueries
        cacheHitRatio
      }
      tableStats {
        totalTables
        totalRows
        totalSizeMB
        indexSizeMB
      }
      performanceStats {
        transactionsPerSecond
        blocksRead
        blocksHit
        tuplesReturned
        tuplesFetched
      }
    }
  }
`;
