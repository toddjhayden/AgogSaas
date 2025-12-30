import { gql } from '@apollo/client';
import { WORKFLOW_DEFINITION_FRAGMENT, WORKFLOW_INSTANCE_FRAGMENT } from '../queries/workflow';

// ============================================================================
// Mutations - Workflow Definition Management
// ============================================================================

export const CREATE_WORKFLOW_DEFINITION = gql`
  ${WORKFLOW_DEFINITION_FRAGMENT}
  mutation CreateWorkflowDefinition($input: CreateWorkflowDefinitionInput!) {
    createWorkflowDefinition(input: $input) {
      ...WorkflowDefinitionFields
    }
  }
`;

export const UPDATE_WORKFLOW_DEFINITION = gql`
  ${WORKFLOW_DEFINITION_FRAGMENT}
  mutation UpdateWorkflowDefinition($id: ID!, $input: UpdateWorkflowDefinitionInput!) {
    updateWorkflowDefinition(id: $id, input: $input) {
      ...WorkflowDefinitionFields
    }
  }
`;

export const PUBLISH_WORKFLOW_DEFINITION = gql`
  ${WORKFLOW_DEFINITION_FRAGMENT}
  mutation PublishWorkflowDefinition($id: ID!) {
    publishWorkflowDefinition(id: $id) {
      ...WorkflowDefinitionFields
    }
  }
`;

export const ARCHIVE_WORKFLOW_DEFINITION = gql`
  ${WORKFLOW_DEFINITION_FRAGMENT}
  mutation ArchiveWorkflowDefinition($id: ID!) {
    archiveWorkflowDefinition(id: $id) {
      ...WorkflowDefinitionFields
    }
  }
`;

// ============================================================================
// Mutations - Workflow Execution
// ============================================================================

export const START_WORKFLOW = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  mutation StartWorkflow($input: StartWorkflowInput!) {
    startWorkflow(input: $input) {
      ...WorkflowInstanceFields
    }
  }
`;

// ============================================================================
// Mutations - User Actions on Tasks
// ============================================================================

export const APPROVE_TASK = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  mutation ApproveTask($taskId: ID!, $comments: String) {
    approveTask(taskId: $taskId, comments: $comments) {
      ...WorkflowInstanceFields
    }
  }
`;

export const REJECT_TASK = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  mutation RejectTask($taskId: ID!, $reason: String!) {
    rejectTask(taskId: $taskId, reason: $reason) {
      ...WorkflowInstanceFields
    }
  }
`;

export const DELEGATE_TASK = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  mutation DelegateTask($taskId: ID!, $delegateToUserId: ID!) {
    delegateTask(taskId: $taskId, delegateToUserId: $delegateToUserId) {
      ...WorkflowInstanceFields
    }
  }
`;

export const COMPLETE_USER_TASK = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  mutation CompleteUserTask($taskId: ID!, $formData: JSON!) {
    completeUserTask(taskId: $taskId, formData: $formData) {
      ...WorkflowInstanceFields
    }
  }
`;

// ============================================================================
// Mutations - Instance Management
// ============================================================================

export const CANCEL_WORKFLOW = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  mutation CancelWorkflow($instanceId: ID!) {
    cancelWorkflow(instanceId: $instanceId) {
      ...WorkflowInstanceFields
    }
  }
`;
