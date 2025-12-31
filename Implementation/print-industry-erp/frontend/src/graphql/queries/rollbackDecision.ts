import { gql } from '@apollo/client';

/**
 * GraphQL queries and mutations for Rollback Decision Page
 */

// ============================================================================
// QUERIES
// ============================================================================

export const GET_ROLLBACK_ELIGIBLE_DEPLOYMENTS = gql`
  query GetRollbackEligibleDeployments(
    $tenantId: String!
    $environment: DeploymentEnvironment
    $limit: Int
    $offset: Int
  ) {
    getRollbackEligibleDeployments(
      tenantId: $tenantId
      environment: $environment
      limit: $limit
      offset: $offset
    ) {
      deploymentId
      deploymentNumber
      tenantId
      title
      environment
      version
      deployedBy
      deployedAt
      gitCommitHash
      gitBranch
      minutesSinceDeployment
      rollbackAvailable
      autoRollbackEnabled
      postDeploymentHealthCheck
      previousDeploymentId
      previousVersion
      currentErrorRatePercent
      currentSuccessRatePercent
      currentAvgResponseTimeMs
      activeAutoRollbackRules
      rollbackCount
    }
  }
`;

export const GET_ROLLBACK_DECISION_CRITERIA = gql`
  query GetRollbackDecisionCriteria(
    $tenantId: String!
    $environment: DeploymentEnvironment
    $isActive: Boolean
  ) {
    getRollbackDecisionCriteria(
      tenantId: $tenantId
      environment: $environment
      isActive: $isActive
    ) {
      id
      tenantId
      criteriaName
      description
      environment
      autoRollbackEnabled
      maxErrorRatePercent
      maxResponseTimeMs
      minSuccessRatePercent
      monitoringWindowMinutes
      decisionWindowMinutes
      requiredHealthyServices
      maxUnhealthyInstancesPercent
      customMetricThresholds
      notifyOnAutoRollback
      notificationChannels
      isActive
      priority
      createdBy
      createdAt
      updatedAt
    }
  }
`;

export const GET_DEPLOYMENT_ROLLBACKS = gql`
  query GetDeploymentRollbacks($deploymentId: String!, $tenantId: String!) {
    getDeploymentRollbacks(deploymentId: $deploymentId, tenantId: $tenantId) {
      id
      deploymentId
      tenantId
      rollbackNumber
      rollbackReason
      rollbackType
      decisionCriteria
      healthCheckStatus
      postDeploymentDurationMinutes
      status
      rollbackStartedAt
      rollbackCompletedAt
      rollbackDurationSeconds
      previousDeploymentId
      previousVersion
      previousGitCommitHash
      affectedServices
      downtimeMinutes
      requiresApproval
      approvedByUserId
      approvedAt
      initiatedByUserId
      createdAt
      updatedAt
    }
  }
`;

export const GET_ROLLBACK_HEALTH_METRICS = gql`
  query GetRollbackHealthMetrics(
    $deploymentId: String!
    $tenantId: String!
    $limit: Int
  ) {
    getRollbackHealthMetrics(
      deploymentId: $deploymentId
      tenantId: $tenantId
      limit: $limit
    ) {
      id
      deploymentId
      tenantId
      metricTimestamp
      minutesSinceDeployment
      errorRatePercent
      successRatePercent
      avgResponseTimeMs
      requestCount
      errorCount
      healthyServicesCount
      unhealthyServicesCount
      totalServicesCount
      cpuUsagePercent
      memoryUsagePercent
      diskUsagePercent
      customMetrics
      triggersRollbackCriteria
      violatedThresholds
      createdAt
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

export const ROLLBACK_DEPLOYMENT = gql`
  mutation RollbackDeployment(
    $deploymentId: String!
    $tenantId: String!
    $rolledBackByUserId: String!
    $rollbackReason: String!
    $rollbackType: String
  ) {
    rollbackDeployment(
      deploymentId: $deploymentId
      tenantId: $tenantId
      rolledBackByUserId: $rolledBackByUserId
      rollbackReason: $rollbackReason
      rollbackType: $rollbackType
    ) {
      id
      deploymentId
      tenantId
      rollbackNumber
      rollbackReason
      rollbackType
      status
      rollbackStartedAt
      rollbackCompletedAt
      rollbackDurationSeconds
      previousVersion
      createdAt
    }
  }
`;
