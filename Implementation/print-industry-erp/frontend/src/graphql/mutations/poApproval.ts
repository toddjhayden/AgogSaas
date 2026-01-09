import { gql } from '@apollo/client';
import {
  PO_APPROVAL_WORKFLOW_FRAGMENT,
  USER_APPROVAL_AUTHORITY_FRAGMENT,
} from '../queries/poApproval';

// ============================================================================
// Mutations - PO Approval Actions
// ============================================================================

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
      currentApprovalWorkflowId
      currentApprovalStepNumber
      approvalCompletedAt
      pendingApproverUserId
    }
  }
`;

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
      currentApprovalWorkflowId
      currentApprovalStepNumber
    }
  }
`;

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
      status
      pendingApproverUserId
    }
  }
`;

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

// ============================================================================
// Mutations - Workflow Configuration
// ============================================================================

export const UPSERT_APPROVAL_WORKFLOW = gql`
  ${PO_APPROVAL_WORKFLOW_FRAGMENT}
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
      ...POApprovalWorkflowFields
    }
  }
`;

export const DELETE_APPROVAL_WORKFLOW = gql`
  mutation DeleteApprovalWorkflow($id: ID!, $tenantId: ID!) {
    deleteApprovalWorkflow(id: $id, tenantId: $tenantId)
  }
`;

// ============================================================================
// Mutations - User Approval Authority
// ============================================================================

export const GRANT_APPROVAL_AUTHORITY = gql`
  ${USER_APPROVAL_AUTHORITY_FRAGMENT}
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
      ...UserApprovalAuthorityFields
    }
  }
`;

export const REVOKE_APPROVAL_AUTHORITY = gql`
  mutation RevokeApprovalAuthority($id: ID!, $tenantId: ID!) {
    revokeApprovalAuthority(id: $id, tenantId: $tenantId)
  }
`;
