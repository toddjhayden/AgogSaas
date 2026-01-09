import { gql } from '@apollo/client';

/**
 * GraphQL Queries for Workflow Recovery & Monitoring
 * REQ: REQ-1767126043619 - Workflow Recovery & Monitoring System
 */

// ============================================================================
// Fragment Definitions
// ============================================================================

export const WORKFLOW_CHECKPOINT_FRAGMENT = gql`
  fragment WorkflowCheckpointFields on WorkflowCheckpoint {
    checkpointId
    instanceId
    nodeKey
    stateSnapshot
    sequenceNumber
    canRollback
    createdAt
    tenantId
  }
`;

export const CHECKPOINT_SUMMARY_FRAGMENT = gql`
  fragment CheckpointSummaryFields on CheckpointSummary {
    instanceId
    totalCheckpoints
    latestSequence
    lastCheckpointAt
    rollbackableCheckpoints
  }
`;

export const RETRY_STATE_FRAGMENT = gql`
  fragment RetryStateFields on RetryState {
    instanceId
    nodeKey
    attemptNumber
    nextRetryAt
    lastError
    circuitBreakerOpen
  }
`;

export const CIRCUIT_BREAKER_STATUS_FRAGMENT = gql`
  fragment CircuitBreakerStatusFields on CircuitBreakerStatus {
    nodeKey
    state
    failureRate
    totalAttempts
  }
`;

export const DLQ_MESSAGE_FRAGMENT = gql`
  fragment DLQMessageFields on DLQMessage {
    dlqId
    source
    payload
    error
    metadata
    status
    assignedTo
    resolution
    createdAt
    updatedAt
    tenantId
  }
`;

export const DLQ_METRICS_FRAGMENT = gql`
  fragment DLQMetricsFields on DLQMetrics {
    totalMessages
    bySource
    byStatus
    oldestMessage
    averageAgeHours
  }
`;

// ============================================================================
// Queries - Checkpoints
// ============================================================================

export const GET_WORKFLOW_CHECKPOINTS = gql`
  ${WORKFLOW_CHECKPOINT_FRAGMENT}
  query GetWorkflowCheckpoints($instanceId: ID!) {
    workflowCheckpoints(instanceId: $instanceId) {
      ...WorkflowCheckpointFields
    }
  }
`;

export const GET_CHECKPOINT_SUMMARY = gql`
  ${CHECKPOINT_SUMMARY_FRAGMENT}
  query GetCheckpointSummary($instanceId: ID!) {
    checkpointSummary(instanceId: $instanceId) {
      ...CheckpointSummaryFields
    }
  }
`;

export const GET_LATEST_CHECKPOINT = gql`
  ${WORKFLOW_CHECKPOINT_FRAGMENT}
  query GetLatestCheckpoint($instanceId: ID!) {
    latestCheckpoint(instanceId: $instanceId) {
      ...WorkflowCheckpointFields
    }
  }
`;

// ============================================================================
// Queries - Retries & Circuit Breaker
// ============================================================================

export const GET_PENDING_RETRIES = gql`
  ${RETRY_STATE_FRAGMENT}
  query GetPendingRetries {
    pendingRetries {
      ...RetryStateFields
    }
  }
`;

export const GET_CIRCUIT_BREAKER_STATUS = gql`
  ${CIRCUIT_BREAKER_STATUS_FRAGMENT}
  query GetCircuitBreakerStatus($nodeKey: String!) {
    circuitBreakerStatus(nodeKey: $nodeKey) {
      ...CircuitBreakerStatusFields
    }
  }
`;

// ============================================================================
// Queries - Dead Letter Queue
// ============================================================================

export const GET_DLQ_MESSAGES = gql`
  ${DLQ_MESSAGE_FRAGMENT}
  query GetDLQMessages($source: DLQSource, $status: DLQStatus, $limit: Int) {
    dlqMessages(source: $source, status: $status, limit: $limit) {
      ...DLQMessageFields
    }
  }
`;

export const GET_DLQ_MESSAGE = gql`
  ${DLQ_MESSAGE_FRAGMENT}
  query GetDLQMessage($dlqId: ID!) {
    dlqMessage(dlqId: $dlqId) {
      ...DLQMessageFields
    }
  }
`;

export const GET_DLQ_METRICS = gql`
  ${DLQ_METRICS_FRAGMENT}
  query GetDLQMetrics {
    dlqMetrics {
      ...DLQMetricsFields
    }
  }
`;
