import { gql } from '@apollo/client';

// =====================================================
// APPROVAL WORKFLOW QUERIES
// =====================================================

/**
 * Get all pending approvals for a specific user
 * Uses the new backend schema from REQ-STRATEGIC-AUTO-1766676891764
 */
export const GET_MY_PENDING_APPROVALS = gql`
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
  }
`;

/**
 * Get approval history for a specific purchase order
 */
export const GET_APPROVAL_HISTORY = gql`
  query GetApprovalHistory($purchaseOrderId: ID!, $tenantId: ID!) {
    getPOApprovalHistory(purchaseOrderId: $purchaseOrderId, tenantId: $tenantId) {
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
      createdAt
    }
  }
`;

/**
 * Get all approval workflows for tenant
 */
export const GET_APPROVAL_WORKFLOWS = gql`
  query GetApprovalWorkflows($tenantId: ID!, $isActive: Boolean) {
    getApprovalWorkflows(tenantId: $tenantId, isActive: $isActive) {
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
        id
        stepNumber
        stepName
        approverRole
        approverUserId
        approverUserGroupId
        isRequired
        canDelegate
        canSkip
        minApprovalLimit
      }
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get specific approval workflow
 */
export const GET_APPROVAL_WORKFLOW = gql`
  query GetApprovalWorkflow($id: ID!, $tenantId: ID!) {
    getApprovalWorkflow(id: $id, tenantId: $tenantId) {
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
        id
        stepNumber
        stepName
        approverRole
        approverUserId
        approverUserGroupId
        isRequired
        canDelegate
        canSkip
        minApprovalLimit
      }
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get applicable workflow for a PO
 */
export const GET_APPLICABLE_WORKFLOW = gql`
  query GetApplicableWorkflow($tenantId: ID!, $facilityId: ID!, $amount: Float!) {
    getApplicableWorkflow(tenantId: $tenantId, facilityId: $facilityId, amount: $amount) {
      id
      workflowName
      description
      approvalType
      slaHoursPerStep
      steps {
        id
        stepNumber
        stepName
        approverRole
        approverUserId
        isRequired
        canDelegate
      }
    }
  }
`;

/**
 * Get user's approval authority
 */
export const GET_USER_APPROVAL_AUTHORITY = gql`
  query GetUserApprovalAuthority($tenantId: ID!, $userId: ID!) {
    getUserApprovalAuthority(tenantId: $tenantId, userId: $userId) {
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
  }
`;

// =====================================================
// APPROVAL WORKFLOW MUTATIONS
// =====================================================

/**
 * Submit a purchase order for approval
 */
export const SUBMIT_PO_FOR_APPROVAL = gql`
  mutation SubmitPOForApproval(
    $purchaseOrderId: ID!
    $submittedByUserId: ID!
    $tenantId: ID!
  ) {
    submitPOForApproval(
      purchaseOrderId: $purchaseOrderId
      submittedByUserId: $submittedByUserId
      tenantId: $tenantId
    ) {
      id
      poNumber
      status
      currentApprovalWorkflowId
      currentApprovalStepNumber
      approvalStartedAt
      pendingApproverUserId
    }
  }
`;

/**
 * Approve a PO workflow step
 */
export const APPROVE_PO_WORKFLOW_STEP = gql`
  mutation ApprovePOWorkflowStep(
    $purchaseOrderId: ID!
    $approvedByUserId: ID!
    $tenantId: ID!
    $comments: String
  ) {
    approvePOWorkflowStep(
      purchaseOrderId: $purchaseOrderId
      approvedByUserId: $approvedByUserId
      tenantId: $tenantId
      comments: $comments
    ) {
      id
      poNumber
      status
      currentApprovalStepNumber
      approvalCompletedAt
      pendingApproverUserId
    }
  }
`;

/**
 * Reject a purchase order
 */
export const REJECT_PO = gql`
  mutation RejectPO(
    $purchaseOrderId: ID!
    $rejectedByUserId: ID!
    $tenantId: ID!
    $rejectionReason: String!
  ) {
    rejectPO(
      purchaseOrderId: $purchaseOrderId
      rejectedByUserId: $rejectedByUserId
      tenantId: $tenantId
      rejectionReason: $rejectionReason
    ) {
      id
      poNumber
      status
    }
  }
`;

/**
 * Delegate approval to another user
 */
export const DELEGATE_APPROVAL = gql`
  mutation DelegateApproval(
    $purchaseOrderId: ID!
    $delegatedByUserId: ID!
    $delegatedToUserId: ID!
    $tenantId: ID!
    $comments: String
  ) {
    delegateApproval(
      purchaseOrderId: $purchaseOrderId
      delegatedByUserId: $delegatedByUserId
      delegatedToUserId: $delegatedToUserId
      tenantId: $tenantId
      comments: $comments
    ) {
      id
      poNumber
      pendingApproverUserId
    }
  }
`;

/**
 * Request changes from requester
 */
export const REQUEST_PO_CHANGES = gql`
  mutation RequestPOChanges(
    $purchaseOrderId: ID!
    $requestedByUserId: ID!
    $tenantId: ID!
    $changeRequest: String!
  ) {
    requestPOChanges(
      purchaseOrderId: $purchaseOrderId
      requestedByUserId: $requestedByUserId
      tenantId: $tenantId
      changeRequest: $changeRequest
    ) {
      id
      poNumber
      status
    }
  }
`;

/**
 * Upsert approval workflow
 */
export const UPSERT_APPROVAL_WORKFLOW = gql`
  mutation UpsertApprovalWorkflow(
    $id: ID
    $tenantId: ID!
    $workflowName: String!
    $description: String
    $minAmount: Float
    $maxAmount: Float
    $approvalType: ApprovalType!
    $slaHoursPerStep: Int
    $escalationEnabled: Boolean
    $escalationUserId: ID
    $autoApproveUnderAmount: Float
    $steps: [ApprovalWorkflowStepInput!]!
  ) {
    upsertApprovalWorkflow(
      id: $id
      tenantId: $tenantId
      workflowName: $workflowName
      description: $description
      minAmount: $minAmount
      maxAmount: $maxAmount
      approvalType: $approvalType
      slaHoursPerStep: $slaHoursPerStep
      escalationEnabled: $escalationEnabled
      escalationUserId: $escalationUserId
      autoApproveUnderAmount: $autoApproveUnderAmount
      steps: $steps
    ) {
      id
      workflowName
      description
      approvalType
      isActive
      steps {
        id
        stepNumber
        stepName
        approverRole
        approverUserId
        isRequired
        canDelegate
      }
    }
  }
`;

/**
 * Delete approval workflow
 */
export const DELETE_APPROVAL_WORKFLOW = gql`
  mutation DeleteApprovalWorkflow($id: ID!, $tenantId: ID!) {
    deleteApprovalWorkflow(id: $id, tenantId: $tenantId)
  }
`;

/**
 * Grant approval authority to user
 */
export const GRANT_APPROVAL_AUTHORITY = gql`
  mutation GrantApprovalAuthority(
    $tenantId: ID!
    $userId: ID!
    $approvalLimit: Float!
    $currencyCode: String
    $roleName: String
    $effectiveFromDate: Date
    $effectiveToDate: Date
    $canDelegate: Boolean
    $grantedByUserId: ID!
  ) {
    grantApprovalAuthority(
      tenantId: $tenantId
      userId: $userId
      approvalLimit: $approvalLimit
      currencyCode: $currencyCode
      roleName: $roleName
      effectiveFromDate: $effectiveFromDate
      effectiveToDate: $effectiveToDate
      canDelegate: $canDelegate
      grantedByUserId: $grantedByUserId
    ) {
      id
      userId
      approvalLimit
      currencyCode
      roleName
      effectiveFromDate
      effectiveToDate
      canDelegate
    }
  }
`;

/**
 * Revoke approval authority
 */
export const REVOKE_APPROVAL_AUTHORITY = gql`
  mutation RevokeApprovalAuthority($id: ID!, $tenantId: ID!) {
    revokeApprovalAuthority(id: $id, tenantId: $tenantId)
  }
`;
