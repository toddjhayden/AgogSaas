import { gql } from '@apollo/client';

// =====================================================
// REPLICATION MONITORING QUERIES
// REQ-1767364752529 - Database Replication & HA Architecture
// =====================================================
// GraphQL queries for PostgreSQL replication monitoring
// Provides real-time replication health, lag metrics, and failover tracking
// =====================================================

/**
 * Get comprehensive replication status for current database node
 */
export const GET_REPLICATION_STATUS = gql`
  query GetReplicationStatus {
    replicationStatus {
      isPrimary
      replicaCount
      walPosition
      healthStatus
      replicas {
        applicationName
        clientAddr
        state
        syncState
        replayLag
        replayLagBytes
        writeLag
        flushLag
        replayLagMs
      }
      replicationSlots {
        slotName
        slotType
        active
        walStatus
        safeWalSize
      }
      capturedAt
    }
  }
`;

/**
 * Get summary statistics for replication monitoring dashboard
 */
export const GET_REPLICATION_SUMMARY = gql`
  query GetReplicationSummary {
    replicationSummary {
      configured
      isPrimary
      totalReplicas
      activeReplicas
      maxLagMb
      maxLagSec
      healthStatus
    }
  }
`;

/**
 * Get replication lag anomalies requiring attention
 */
export const GET_REPLICATION_ANOMALIES = gql`
  query GetReplicationAnomalies {
    replicationAnomalies {
      severity
      replicaName
      lagMb
      lagMs
      issue
    }
  }
`;

/**
 * Get historical replication status snapshots
 */
export const GET_REPLICATION_STATUS_HISTORY = gql`
  query GetReplicationStatusHistory(
    $limit: Int = 100
    $offset: Int = 0
    $startTime: DateTime
    $endTime: DateTime
  ) {
    replicationStatusHistory(
      limit: $limit
      offset: $offset
      startTime: $startTime
      endTime: $endTime
    ) {
      nodes {
        id
        snapshotTimestamp
        nodeRole
        isPrimary
        currentWalLsn
        currentWalPosition
        replicationLagBytes
        replicationLagSeconds
        healthStatus
        pgVersion
        systemUptimeSeconds
        createdAt
      }
      totalCount
      hasMore
    }
  }
`;

/**
 * Get replication slots information
 */
export const GET_REPLICATION_SLOTS = gql`
  query GetReplicationSlots {
    replicationSlots {
      slotName
      slotType
      active
      walStatus
      safeWalSize
    }
  }
`;

/**
 * Get replication slot usage history
 */
export const GET_REPLICATION_SLOTS_HISTORY = gql`
  query GetReplicationSlotsHistory(
    $limit: Int = 100
    $offset: Int = 0
    $slotName: String
  ) {
    replicationSlotsHistory(
      limit: $limit
      offset: $offset
      slotName: $slotName
    ) {
      nodes {
        id
        snapshotTimestamp
        slotName
        slotType
        active
        restartLsn
        confirmedFlushLsn
        walStatus
        safeWalSize
        applicationName
        state
        clientAddr
        backendStart
        createdAt
      }
      totalCount
      hasMore
    }
  }
`;

/**
 * Get replication health alerts
 */
export const GET_REPLICATION_ALERTS = gql`
  query GetReplicationAlerts(
    $limit: Int = 50
    $offset: Int = 0
    $status: ReplicationAlertStatus
    $severity: ReplicationAlertSeverity
  ) {
    replicationAlerts(
      limit: $limit
      offset: $offset
      status: $status
      severity: $severity
    ) {
      nodes {
        id
        alertTimestamp
        alertType
        severity
        message
        details
        status
        acknowledgedAt
        acknowledgedBy
        resolvedAt
        resolvedBy
        nodeName
        replicaName
        createdAt
        updatedAt
      }
      totalCount
      hasMore
    }
  }
`;

/**
 * Get failover history
 */
export const GET_FAILOVER_HISTORY = gql`
  query GetFailoverHistory(
    $limit: Int = 50
    $offset: Int = 0
    $startTime: DateTime
    $endTime: DateTime
  ) {
    failoverHistory(
      limit: $limit
      offset: $offset
      startTime: $startTime
      endTime: $endTime
    ) {
      nodes {
        id
        failoverTimestamp
        failoverType
        oldPrimaryHost
        oldPrimaryPort
        oldPrimaryLastWalLsn
        newPrimaryHost
        newPrimaryPort
        newPrimaryFirstWalLsn
        failoverDurationSeconds
        dataLossBytes
        downtimeSeconds
        status
        reason
        triggeredBy
        errorMessage
        notes
        createdAt
        updatedAt
      }
      totalCount
      hasMore
    }
  }
`;

/**
 * Get backup verification history
 */
export const GET_BACKUP_VERIFICATION_HISTORY = gql`
  query GetBackupVerificationHistory(
    $limit: Int = 50
    $offset: Int = 0
  ) {
    backupVerificationHistory(
      limit: $limit
      offset: $offset
    ) {
      nodes {
        id
        verificationTimestamp
        backupIdentifier
        backupTimestamp
        verificationStatus
        verificationDurationSeconds
        customerCount
        orderCount
        tableCount
        databaseSizeBytes
        advancedVerification
        integrityCheckPassed
        errorMessage
        errorDetails
        testLocation
        postgresVersion
        verifiedBy
        logFilePath
        createdAt
      }
      totalCount
      hasMore
    }
  }
`;

/**
 * Get replication health dashboard data
 */
export const GET_REPLICATION_HEALTH_DASHBOARD = gql`
  query GetReplicationHealthDashboard {
    replicationHealthDashboard {
      currentRole
      currentHealth
      currentLagBytes
      criticalAlerts24h
      warningAlerts24h
      lastAlertTime
      lastVerificationStatus
      lastVerificationTime
      hoursSinceLastVerification
      failoversLast30Days
      lastFailoverTime
      snapshotTimestamp
    }
  }
`;
