/**
 * DATABASE PERFORMANCE MONITORING QUERIES
 * REQ: REQ-P0-1767915020217-kcl8m
 * Author: Jen (Frontend Developer)
 * Date: 2026-01-08
 *
 * GraphQL queries for database performance dashboard.
 * Integrates with backend database-performance.resolver.ts
 */

import { gql } from '@apollo/client';

// =====================================================
// MAIN DASHBOARD QUERY
// =====================================================

export const GET_DATABASE_PERFORMANCE_DASHBOARD = gql`
  query GetDatabasePerformanceDashboard {
    databasePerformanceDashboard {
      connectionPoolUtilization
      activeConnections
      waitingConnections
      longRunningQueries
      cacheHitRatio
      rollbackRatio
      totalDeadlocks
      databaseSize
      databaseSizeBytes
      totalTables
      tablesNeedingVacuum
      totalTablesSize
      totalIndexes
      unusedIndexes
      totalIndexesSize
      avgQueryTimeMs
      slowQueriesCount
      maxReplicationLagSeconds
      databaseHealthScore
      status
      capturedAt
    }
  }
`;

// =====================================================
// CONNECTION POOL METRICS
// =====================================================

export const GET_DATABASE_CONNECTION_POOL_METRICS = gql`
  query GetDatabaseConnectionPoolMetrics {
    databaseConnectionPoolMetrics {
      activeConnections
      idleConnections
      idleInTransaction
      waitingConnections
      totalConnections
      maxConnections
      utilizationPercent
      longRunningQueries
      capturedAt
    }
  }
`;

// =====================================================
// TABLE METRICS
// =====================================================

export const GET_DATABASE_TABLE_METRICS = gql`
  query GetDatabaseTableMetrics($filter: TableMetricsFilter) {
    databaseTableMetrics(filter: $filter) {
      schemaname
      tablename
      totalSize
      totalSizeBytes
      tableSize
      tableSizeBytes
      indexesSize
      indexesSizeBytes
      liveTuples
      deadTuples
      deadTuplePercent
      lastVacuum
      lastAutovacuum
      lastAnalyze
      lastAutoanalyze
    }
  }
`;

// =====================================================
// INDEX METRICS
// =====================================================

export const GET_DATABASE_INDEX_METRICS = gql`
  query GetDatabaseIndexMetrics($filter: IndexMetricsFilter) {
    databaseIndexMetrics(filter: $filter) {
      schemaname
      tablename
      indexname
      indexSize
      indexSizeBytes
      indexScans
      tuplesRead
      tuplesFetched
      usageCategory
      fetchEfficiencyPercent
    }
  }
`;

// =====================================================
// QUERY STATISTICS
// =====================================================

export const GET_DATABASE_QUERY_STATISTICS = gql`
  query GetDatabaseQueryStatistics($limit: Int) {
    databaseQueryStatistics(limit: $limit) {
      queryPreview
      calls
      totalTimeMs
      meanTimeMs
      minTimeMs
      maxTimeMs
      stddevTimeMs
      rows
      avgRowsPerCall
      sharedBlksHit
      sharedBlksRead
      cacheHitRatioPercent
      tempBlksWritten
      tempBlksRead
    }
  }
`;

// =====================================================
// CACHE METRICS
// =====================================================

export const GET_DATABASE_CACHE_METRICS = gql`
  query GetDatabaseCacheMetrics {
    databaseCacheMetrics {
      cacheHitRatioPercent
      blocksHit
      blocksRead
      totalBlocksAccessed
      transactionsCommitted
      transactionsRolledBack
      rollbackRatioPercent
      totalDeadlocks
      capturedAt
    }
  }
`;

// =====================================================
// VACUUM METRICS
// =====================================================

export const GET_DATABASE_VACUUM_METRICS = gql`
  query GetDatabaseVacuumMetrics($needsVacuum: Boolean) {
    databaseVacuumMetrics(needsVacuum: $needsVacuum) {
      schemaname
      tablename
      lastVacuum
      lastAutovacuum
      vacuumCount
      autovacuumCount
      lastAnalyze
      lastAutoanalyze
      analyzeCount
      autoanalyzeCount
      lastVacuumAny
      hoursSinceLastVacuum
      deadTuples
      liveTuples
      bloatPercent
    }
  }
`;

// =====================================================
// LOCK METRICS
// =====================================================

export const GET_DATABASE_LOCK_METRICS = gql`
  query GetDatabaseLockMetrics {
    databaseLockMetrics {
      pid
      usename
      applicationName
      clientAddr
      locktype
      mode
      granted
      state
      query
      queryAge
      lockStatus
    }
  }
`;

// =====================================================
// ISSUE DETECTION QUERIES
// =====================================================

export const GET_DATABASE_SLOW_QUERIES = gql`
  query GetDatabaseSlowQueries($thresholdMs: Int, $limit: Int) {
    databaseSlowQueries(thresholdMs: $thresholdMs, limit: $limit) {
      queryPreview
      calls
      totalTimeMs
      meanTimeMs
      maxTimeMs
      cacheHitRatio
      rowsAvg
    }
  }
`;

export const GET_DATABASE_BLOATED_TABLES = gql`
  query GetDatabaseBloatedTables($threshold: Float) {
    databaseBloatedTables(threshold: $threshold) {
      schemaName
      tableName
      totalSize
      deadTuples
      liveTuples
      bloatPercent
      lastVacuum
      lastAutovacuum
      hoursSinceVacuum
    }
  }
`;

export const GET_DATABASE_UNUSED_INDEXES = gql`
  query GetDatabaseUnusedIndexes($minSizeMb: Int) {
    databaseUnusedIndexes(minSizeMb: $minSizeMb) {
      schemaName
      tableName
      indexName
      indexSize
      indexScans
    }
  }
`;

// =====================================================
// HISTORICAL TREND QUERY
// =====================================================

export const GET_DATABASE_PERFORMANCE_HISTORY = gql`
  query GetDatabasePerformanceHistory($hoursBack: Int, $interval: String) {
    databasePerformanceHistory(hoursBack: $hoursBack, interval: $interval) {
      capturedAt
      connectionPoolUtilization
      activeConnections
      cacheHitRatio
      avgQueryTimeMs
      databaseHealthScore
    }
  }
`;

// =====================================================
// PG_STAT_STATEMENTS QUERIES (P1 Enhancement)
// =====================================================

export const GET_SLOW_QUERIES_BY_MEAN_TIME = gql`
  query GetSlowQueriesByMeanTime($limit: Int) {
    slowQueriesByMeanTime(limit: $limit) {
      queryid
      queryPreview
      calls
      totalTimeMs
      meanTimeMs
      minTimeMs
      maxTimeMs
      stddevTimeMs
      rows
      avgRowsPerCall
      cacheHitRatioPercent
      tempBlksWritten
      tempBlksRead
      percentOfTotalTime
      sharedBlksHit
      sharedBlksRead
      totalBlocksAccessed
      tempMbWritten
      tempMbRead
    }
  }
`;

export const GET_SLOW_QUERIES_BY_TOTAL_TIME = gql`
  query GetSlowQueriesByTotalTime($limit: Int) {
    slowQueriesByTotalTime(limit: $limit) {
      queryid
      queryPreview
      calls
      totalTimeMs
      meanTimeMs
      minTimeMs
      maxTimeMs
      stddevTimeMs
      rows
      avgRowsPerCall
      cacheHitRatioPercent
      tempBlksWritten
      tempBlksRead
      percentOfTotalTime
      sharedBlksHit
      sharedBlksRead
      totalBlocksAccessed
      tempMbWritten
      tempMbRead
    }
  }
`;

export const GET_QUERIES_WITH_POOR_CACHE_HITS = gql`
  query GetQueriesWithPoorCacheHits($limit: Int) {
    queriesWithPoorCacheHits(limit: $limit) {
      queryid
      queryPreview
      calls
      totalTimeMs
      meanTimeMs
      cacheHitRatioPercent
      sharedBlksHit
      sharedBlksRead
      totalBlocksAccessed
    }
  }
`;

export const GET_QUERIES_USING_TEMP_FILES = gql`
  query GetQueriesUsingTempFiles($limit: Int) {
    queriesUsingTempFiles(limit: $limit) {
      queryid
      queryPreview
      calls
      totalTimeMs
      meanTimeMs
      tempBlksWritten
      tempBlksRead
      tempMbWritten
      tempMbRead
    }
  }
`;

export const DETECT_SLOW_QUERY_ANOMALIES = gql`
  query DetectSlowQueryAnomalies($meanThresholdMs: Int, $totalThresholdMs: Int) {
    detectSlowQueryAnomalies(
      meanThresholdMs: $meanThresholdMs
      totalThresholdMs: $totalThresholdMs
    ) {
      severity
      queryid
      queryPreview
      calls
      meanTimeMs
      totalTimeMs
      issue
    }
  }
`;

export const GET_PG_STAT_STATEMENTS_STATUS = gql`
  query GetPgStatStatementsStatus {
    pgStatStatementsStatus {
      enabled
      queryCount
      configuration
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const CAPTURE_DATABASE_PERFORMANCE_SNAPSHOT = gql`
  mutation CaptureDatabasePerformanceSnapshot {
    captureDatabasePerformanceSnapshot
  }
`;

export const RESET_QUERY_STATISTICS = gql`
  mutation ResetQueryStatistics {
    resetQueryStatistics
  }
`;
