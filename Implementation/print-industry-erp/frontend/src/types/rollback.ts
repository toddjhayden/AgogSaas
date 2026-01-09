/**
 * TypeScript type definitions for Rollback Decision Page
 *
 * Provides strong typing for all rollback-related data structures.
 * Replaces `any` types throughout the RollbackDecisionPage component.
 *
 * REQ-DEVOPS-ROLLBACK-1767150339448 - P1 Improvement
 */

/**
 * Deployment environment types
 */
export type DeploymentEnvironment =
  | 'PRODUCTION'
  | 'PRE_PRODUCTION'
  | 'STAGING'
  | 'DISASTER_RECOVERY';

/**
 * Health check status types
 */
export type HealthCheckStatus = 'PASSED' | 'FAILED' | 'PENDING' | 'SKIPPED';

/**
 * Rollback type options
 */
export type RollbackType = 'MANUAL' | 'AUTOMATIC' | 'EMERGENCY';

/**
 * Rollback status types
 */
export type RollbackStatus =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Rollback-eligible deployment data structure
 * Matches GraphQL query: GET_ROLLBACK_ELIGIBLE_DEPLOYMENTS
 */
export interface RollbackEligibleDeployment {
  deploymentId: string;
  deploymentNumber: string;
  tenantId: string;
  title: string;
  environment: DeploymentEnvironment;
  version: string;
  deployedBy: string;
  deployedAt: string;
  gitCommitHash: string | null;
  gitBranch: string | null;
  minutesSinceDeployment: number;
  rollbackAvailable: boolean;
  autoRollbackEnabled: boolean;
  postDeploymentHealthCheck: HealthCheckStatus;
  previousDeploymentId: string | null;
  previousVersion: string | null;
  currentErrorRatePercent: number | null;
  currentSuccessRatePercent: number | null;
  currentAvgResponseTimeMs: number | null;
  activeAutoRollbackRules: number | null;
  rollbackCount: number | null;
}

/**
 * Rollback decision criteria configuration
 * Matches GraphQL query: GET_ROLLBACK_DECISION_CRITERIA
 */
export interface RollbackDecisionCriteria {
  id: string;
  tenantId: string;
  criteriaName: string;
  description: string | null;
  environment: DeploymentEnvironment;
  autoRollbackEnabled: boolean;
  maxErrorRatePercent: number;
  maxResponseTimeMs: number;
  minSuccessRatePercent: number;
  monitoringWindowMinutes: number;
  decisionWindowMinutes: number;
  requiredHealthyServices: number | null;
  maxUnhealthyInstancesPercent: number | null;
  customMetricThresholds: Record<string, unknown> | null;
  notifyOnAutoRollback: boolean;
  notificationChannels: string[] | null;
  isActive: boolean;
  priority: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deployment rollback execution record
 * Matches GraphQL query: GET_DEPLOYMENT_ROLLBACKS
 */
export interface DeploymentRollback {
  id: string;
  deploymentId: string;
  tenantId: string;
  rollbackNumber: string;
  rollbackReason: string;
  rollbackType: RollbackType;
  decisionCriteria: Record<string, unknown> | null;
  healthCheckStatus: HealthCheckStatus | null;
  postDeploymentDurationMinutes: number | null;
  status: RollbackStatus;
  rollbackStartedAt: string;
  rollbackCompletedAt: string | null;
  rollbackDurationSeconds: number | null;
  previousDeploymentId: string | null;
  previousVersion: string | null;
  previousGitCommitHash: string | null;
  affectedServices: string[] | null;
  downtimeMinutes: number | null;
  requiresApproval: boolean;
  approvedByUserId: string | null;
  approvedAt: string | null;
  initiatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Rollback health metrics time-series data
 * Matches GraphQL query: GET_ROLLBACK_HEALTH_METRICS
 */
export interface RollbackHealthMetrics {
  id: string;
  deploymentId: string;
  tenantId: string;
  metricTimestamp: string;
  minutesSinceDeployment: number;
  errorRatePercent: number | null;
  successRatePercent: number | null;
  avgResponseTimeMs: number | null;
  requestCount: number | null;
  errorCount: number | null;
  healthyServicesCount: number | null;
  unhealthyServicesCount: number | null;
  totalServicesCount: number | null;
  cpuUsagePercent: number | null;
  memoryUsagePercent: number | null;
  diskUsagePercent: number | null;
  customMetrics: Record<string, unknown> | null;
  triggersRollbackCriteria: boolean;
  violatedThresholds: ViolatedThreshold[] | null;
  createdAt: string;
}

/**
 * Violated threshold information
 */
export interface ViolatedThreshold {
  metric: string;
  threshold: number;
  actualValue: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * GraphQL query response types
 */
export interface GetRollbackEligibleDeploymentsResponse {
  getRollbackEligibleDeployments: RollbackEligibleDeployment[];
}

export interface GetRollbackDecisionCriteriaResponse {
  getRollbackDecisionCriteria: RollbackDecisionCriteria[];
}

export interface GetDeploymentRollbacksResponse {
  getDeploymentRollbacks: DeploymentRollback[];
}

export interface GetRollbackHealthMetricsResponse {
  getRollbackHealthMetrics: RollbackHealthMetrics[];
}

export interface RollbackDeploymentResponse {
  rollbackDeployment: DeploymentRollback;
}

/**
 * GraphQL mutation variables
 */
export interface RollbackDeploymentVariables {
  deploymentId: string;
  tenantId: string;
  rolledBackByUserId: string;
  rollbackReason: string;
  rollbackType?: RollbackType;
}

/**
 * Query variables for filtering and pagination
 */
export interface GetRollbackEligibleDeploymentsVariables {
  tenantId: string;
  environment?: DeploymentEnvironment;
  limit?: number;
  offset?: number;
}

export interface GetRollbackDecisionCriteriaVariables {
  tenantId: string;
  environment?: DeploymentEnvironment;
  isActive?: boolean;
}

export interface GetDeploymentRollbacksVariables {
  deploymentId: string;
  tenantId: string;
}

export interface GetRollbackHealthMetricsVariables {
  deploymentId: string;
  tenantId: string;
  limit?: number;
}
