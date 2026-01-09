import { gql } from '@apollo/client';

// ============================================================================
// Fragment Definitions
// ============================================================================

export const PO_APPROVAL_WORKFLOW_STEP_FRAGMENT = gql`
  fragment POApprovalWorkflowStepFields on POApprovalWorkflowStep {
    id
    workflowId
    stepNumber
    stepName
    approverRole
    approverUserId
    approverUserGroupId
    isRequired
    canDelegate
    canSkip
    minApprovalLimit
    createdAt
  }
`;

export const PO_APPROVAL_WORKFLOW_FRAGMENT = gql`
  ${PO_APPROVAL_WORKFLOW_STEP_FRAGMENT}
  fragment POApprovalWorkflowFields on POApprovalWorkflow {
    id
    tenantId
    workflowName
    description
    appliesToFacilityIds
    minAmount
    maxAmount
    approvalType
    isActive
    priority
    slaHoursPerStep
    escalationEnabled
    escalationUserId
    autoApproveUnderAmount
    steps {
      ...POApprovalWorkflowStepFields
    }
    createdAt
    createdBy
    updatedAt
    updatedBy
  }
`;

export const PO_APPROVAL_HISTORY_FRAGMENT = gql`
  fragment POApprovalHistoryFields on POApprovalHistoryEntry {
    id
    purchaseOrderId
    workflowId
    stepId
    action
    actionByUserId
    actionByUserName
    actionDate
    stepNumber
    stepName
    comments
    rejectionReason
    delegatedFromUserId
    delegatedFromUserName
    delegatedToUserId
    delegatedToUserName
    slaDeadline
    wasEscalated
    poSnapshot
    createdAt
  }
`;

export const PENDING_APPROVAL_ITEM_FRAGMENT = gql`
  fragment PendingApprovalItemFields on PendingApprovalItem {
    purchaseOrderId
    tenantId
    poNumber
    poDate
    vendorId
    vendorName
    facilityId
    facilityName
    totalAmount
    poCurrencyCode
    status
    requestedDeliveryDate
    currentApprovalWorkflowId
    currentApprovalStepNumber
    currentStepName
    approvalStartedAt
    pendingApproverUserId
    slaHoursPerStep
    slaDeadline
    hoursRemaining
    isOverdue
    urgencyLevel
    requesterUserId
    requesterName
    createdAt
    updatedAt
  }
`;

export const APPROVAL_PROGRESS_FRAGMENT = gql`
  fragment ApprovalProgressFields on ApprovalProgress {
    currentStep
    totalSteps
    percentComplete
    nextApproverUserId
    nextApproverName
    slaDeadline
    hoursRemaining
    isOverdue
  }
`;

export const USER_APPROVAL_AUTHORITY_FRAGMENT = gql`
  fragment UserApprovalAuthorityFields on UserApprovalAuthority {
    id
    tenantId
    userId
    approvalLimit
    currencyCode
    roleName
    effectiveFromDate
    effectiveToDate
    canDelegate
    grantedByUserId
    grantedAt
    createdAt
    updatedAt
  }
`;

// ============================================================================
// Queries - Pending Approvals
// ============================================================================

export const GET_MY_PENDING_APPROVALS = gql`
  ${PENDING_APPROVAL_ITEM_FRAGMENT}
  query GetMyPendingApprovals(
    $tenantId: ID!
    $userId: ID!
    $amountMin: Float
    $amountMax: Float
    $urgencyLevel: UrgencyLevel
  ) {
    getMyPendingApprovals(
      tenantId: $tenantId
      userId: $userId
      amountMin: $amountMin
      amountMax: $amountMax
      urgencyLevel: $urgencyLevel
    ) {
      ...PendingApprovalItemFields
    }
  }
`;

// ============================================================================
// Queries - Approval History
// ============================================================================

export const GET_PO_APPROVAL_HISTORY = gql`
  ${PO_APPROVAL_HISTORY_FRAGMENT}
  query GetPOApprovalHistory($purchaseOrderId: ID!, $tenantId: ID!) {
    getPOApprovalHistory(purchaseOrderId: $purchaseOrderId, tenantId: $tenantId) {
      ...POApprovalHistoryFields
    }
  }
`;

// ============================================================================
// Queries - Approval Workflows
// ============================================================================

export const GET_APPROVAL_WORKFLOWS = gql`
  ${PO_APPROVAL_WORKFLOW_FRAGMENT}
  query GetApprovalWorkflows($tenantId: ID!, $isActive: Boolean) {
    getApprovalWorkflows(tenantId: $tenantId, isActive: $isActive) {
      ...POApprovalWorkflowFields
    }
  }
`;

export const GET_APPROVAL_WORKFLOW = gql`
  ${PO_APPROVAL_WORKFLOW_FRAGMENT}
  query GetApprovalWorkflow($id: ID!, $tenantId: ID!) {
    getApprovalWorkflow(id: $id, tenantId: $tenantId) {
      ...POApprovalWorkflowFields
    }
  }
`;

export const GET_APPLICABLE_WORKFLOW = gql`
  ${PO_APPROVAL_WORKFLOW_FRAGMENT}
  query GetApplicableWorkflow($tenantId: ID!, $facilityId: ID!, $amount: Float!) {
    getApplicableWorkflow(tenantId: $tenantId, facilityId: $facilityId, amount: $amount) {
      ...POApprovalWorkflowFields
    }
  }
`;

// ============================================================================
// Queries - User Approval Authority
// ============================================================================

export const GET_USER_APPROVAL_AUTHORITY = gql`
  ${USER_APPROVAL_AUTHORITY_FRAGMENT}
  query GetUserApprovalAuthority($tenantId: ID!, $userId: ID!) {
    getUserApprovalAuthority(tenantId: $tenantId, userId: $userId) {
      ...UserApprovalAuthorityFields
    }
  }
`;

// ============================================================================
// Queries - Extended PurchaseOrder Fields
// ============================================================================

export const GET_PO_APPROVAL_PROGRESS = gql`
  ${APPROVAL_PROGRESS_FRAGMENT}
  ${PO_APPROVAL_HISTORY_FRAGMENT}
  query GetPOApprovalProgress($purchaseOrderId: ID!, $tenantId: ID!) {
    purchaseOrder(id: $purchaseOrderId) {
      id
      currentApprovalWorkflowId
      currentApprovalStepNumber
      approvalStartedAt
      approvalCompletedAt
      pendingApproverUserId
      workflowSnapshot
      approvalProgress {
        ...ApprovalProgressFields
      }
      approvalHistory {
        ...POApprovalHistoryFields
      }
    }
  }
`;
