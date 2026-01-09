import { gql } from '@apollo/client';
import { WORKFLOW_INSTANCE_FRAGMENT } from '../queries/workflow';

/**
 * GraphQL Mutations for Workflow Recovery & Monitoring
 * REQ: REQ-1767126043619 - Workflow Recovery & Monitoring System
 */

// ============================================================================
// Mutations - Checkpoint Management
// ============================================================================

export const RESTORE_FROM_CHECKPOINT = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  mutation RestoreFromCheckpoint($checkpointId: ID!) {
    restoreFromCheckpoint(checkpointId: $checkpointId) {
      ...WorkflowInstanceFields
    }
  }
`;

export const VALIDATE_CHECKPOINT = gql`
  mutation ValidateCheckpoint($checkpointId: ID!) {
    validateCheckpoint(checkpointId: $checkpointId)
  }
`;

export const DELETE_CHECKPOINT = gql`
  mutation DeleteCheckpoint($checkpointId: ID!) {
    deleteCheckpoint(checkpointId: $checkpointId)
  }
`;

// ============================================================================
// Mutations - Circuit Breaker
// ============================================================================

export const RESET_CIRCUIT_BREAKER = gql`
  mutation ResetCircuitBreaker($nodeKey: String!) {
    resetCircuitBreaker(nodeKey: $nodeKey)
  }
`;

// ============================================================================
// Mutations - Dead Letter Queue
// ============================================================================

export const REPLAY_DLQ_MESSAGE = gql`
  mutation ReplayDLQMessage($dlqId: ID!) {
    replayDLQMessage(dlqId: $dlqId)
  }
`;

export const REPLAY_ALL_DLQ_MESSAGES = gql`
  mutation ReplayAllDLQMessages($source: DLQSource) {
    replayAllDLQMessages(source: $source) {
      total
      succeeded
      failed
    }
  }
`;

export const DISCARD_DLQ_MESSAGE = gql`
  mutation DiscardDLQMessage($dlqId: ID!, $reason: String!) {
    discardDLQMessage(dlqId: $dlqId, reason: $reason)
  }
`;

export const ASSIGN_DLQ_MESSAGE = gql`
  mutation AssignDLQMessage($dlqId: ID!, $assignedTo: String!) {
    assignDLQMessage(dlqId: $dlqId, assignedTo: $assignedTo)
  }
`;
