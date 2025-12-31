import { gql } from '@apollo/client';

/**
 * GraphQL queries and mutations for deployment approval workflows
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get pending deployment approvals for current user
 */
export const GET_MY_PENDING_DEPLOYMENT_APPROVALS = gql`
  query GetMyPendingDeploymentApprovals(
    $tenantId: String!
    $userId: String!
    $filters: PendingDeploymentApprovalFilter
  ) {
    getMyPendingDeploymentApprovals(
      tenantId: $tenantId
      userId: $userId
      filters: $filters
    ) {
      deploymentId
      deploymentNumber
      tenantId
      title
      environment
      version
      deployedBy
      requestedAt
      currentStep
      totalSteps
      stepDescription
      pendingApproverId
      urgency
      slaDeadline
      slaRemainingHours
      isOverdue
      urgencyLevel
      preDeploymentHealthCheck
    }
  }
`;

/**
 * Get deployment approval history
 */
export const GET_DEPLOYMENT_APPROVAL_HISTORY = gql`
  query GetDeploymentApprovalHistory($deploymentId: String!, $tenantId: String!) {
    getDeploymentApprovalHistory(deploymentId: $deploymentId, tenantId: $tenantId) {
      id
      deploymentId
      tenantId
      action
      actionByUserId
      actionByUserName
      actionAt
      approvalStep
      comments
      delegatedToUserId
      delegatedToUserName
      isEscalated
      escalationReason
      changeRequest
      metadata
    }
  }
`;

/**
 * Get deployment approval statistics
 */
export const GET_DEPLOYMENT_APPROVAL_STATS = gql`
  query GetDeploymentApprovalStats($tenantId: String!) {
    getDeploymentApprovalStats(tenantId: $tenantId) {
      totalPending
      criticalPending
      overdueCount
      warningCount
      productionPending
      stagingPending
      approvedLast24h
      rejectedLast24h
      deployedLast24h
    }
  }
`;

/**
 * Get deployment approval workflows
 */
export const GET_DEPLOYMENT_APPROVAL_WORKFLOWS = gql`
  query GetDeploymentApprovalWorkflows(
    $tenantId: String!
    $environment: DeploymentEnvironment
    $isActive: Boolean
  ) {
    getDeploymentApprovalWorkflows(
      tenantId: $tenantId
      environment: $environment
      isActive: $isActive
    ) {
      id
      tenantId
      workflowName
      description
      environment
      defaultSlaHours
      escalationEnabled
      autoApproveForMinorUpdates
      autoApproveMaxSeverity
      isActive
      priority
      createdBy
      createdAt
      updatedAt
      steps {
        stepNumber
        stepName
        description
        approverId
        approverRole
        approverGroup
        slaHours
        allowDelegation
        canSkip
        requiresAllApprovers
      }
    }
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new deployment request
 */
export const CREATE_DEPLOYMENT = gql`
  mutation CreateDeployment($input: CreateDeploymentInput!) {
    createDeployment(input: $input) {
      id
      deploymentNumber
      title
      description
      environment
      version
      status
      urgency
      createdAt
    }
  }
`;

/**
 * Submit deployment for approval
 */
export const SUBMIT_DEPLOYMENT_FOR_APPROVAL = gql`
  mutation SubmitDeploymentForApproval($input: SubmitDeploymentForApprovalInput!) {
    submitDeploymentForApproval(input: $input) {
      id
      deploymentNumber
      status
      currentApprovalStep
      pendingApproverId
      slaDeadline
    }
  }
`;

/**
 * Approve a deployment
 */
export const APPROVE_DEPLOYMENT = gql`
  mutation ApproveDeployment($input: ApproveDeploymentInput!) {
    approveDeployment(input: $input) {
      id
      deploymentNumber
      status
      currentApprovalStep
      pendingApproverId
      approvedAt
    }
  }
`;

/**
 * Reject a deployment
 */
export const REJECT_DEPLOYMENT = gql`
  mutation RejectDeployment($input: RejectDeploymentInput!) {
    rejectDeployment(input: $input) {
      id
      deploymentNumber
      status
    }
  }
`;

/**
 * Delegate deployment approval
 */
export const DELEGATE_DEPLOYMENT_APPROVAL = gql`
  mutation DelegateDeploymentApproval($input: DelegateDeploymentApprovalInput!) {
    delegateDeploymentApproval(input: $input) {
      id
      deploymentNumber
      pendingApproverId
    }
  }
`;

/**
 * Request changes to a deployment
 */
export const REQUEST_DEPLOYMENT_CHANGES = gql`
  mutation RequestDeploymentChanges($input: RequestDeploymentChangesInput!) {
    requestDeploymentChanges(input: $input) {
      id
      deploymentNumber
    }
  }
`;

/**
 * Run deployment health check
 */
export const RUN_DEPLOYMENT_HEALTH_CHECK = gql`
  mutation RunDeploymentHealthCheck(
    $deploymentId: String!
    $tenantId: String!
    $checkType: String!
  ) {
    runDeploymentHealthCheck(
      deploymentId: $deploymentId
      tenantId: $tenantId
      checkType: $checkType
    ) {
      id
      preDeploymentHealthCheck
      postDeploymentHealthCheck
    }
  }
`;

/**
 * Execute approved deployment
 */
export const EXECUTE_DEPLOYMENT = gql`
  mutation ExecuteDeployment(
    $deploymentId: String!
    $tenantId: String!
    $executedByUserId: String!
  ) {
    executeDeployment(
      deploymentId: $deploymentId
      tenantId: $tenantId
      executedByUserId: $executedByUserId
    ) {
      id
      deploymentNumber
      status
      deployedAt
    }
  }
`;

/**
 * Rollback a deployment
 */
export const ROLLBACK_DEPLOYMENT = gql`
  mutation RollbackDeployment(
    $deploymentId: String!
    $tenantId: String!
    $rolledBackByUserId: String!
    $rollbackReason: String!
  ) {
    rollbackDeployment(
      deploymentId: $deploymentId
      tenantId: $tenantId
      rolledBackByUserId: $rolledBackByUserId
      rollbackReason: $rollbackReason
    ) {
      id
      deploymentNumber
      status
    }
  }
`;

/**
 * Cancel a deployment
 */
export const CANCEL_DEPLOYMENT = gql`
  mutation CancelDeployment(
    $deploymentId: String!
    $tenantId: String!
    $cancelledByUserId: String!
    $cancellationReason: String
  ) {
    cancelDeployment(
      deploymentId: $deploymentId
      tenantId: $tenantId
      cancelledByUserId: $cancelledByUserId
      cancellationReason: $cancellationReason
    ) {
      id
      deploymentNumber
      status
    }
  }
`;
