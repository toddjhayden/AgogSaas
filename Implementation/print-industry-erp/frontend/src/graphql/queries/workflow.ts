import { gql } from '@apollo/client';

// ============================================================================
// Fragment Definitions
// ============================================================================

export const WORKFLOW_NODE_FRAGMENT = gql`
  fragment WorkflowNodeFields on WorkflowNode {
    id
    nodeType
    name
    approverUserId
    approverRole
    approvalLogic
    serviceType
    serviceConfig
    formFields {
      fieldName
      fieldLabel
      fieldType
      isRequired
      options
    }
    assignedUserId
    assignedRole
    conditionType
    conditionExpression
    slaHours
    timeoutAction
  }
`;

export const WORKFLOW_ROUTE_FRAGMENT = gql`
  fragment WorkflowRouteFields on WorkflowRoute {
    id
    fromNodeId
    toNodeId
    condition
    isDefault
  }
`;

export const WORKFLOW_DEFINITION_FRAGMENT = gql`
  ${WORKFLOW_NODE_FRAGMENT}
  ${WORKFLOW_ROUTE_FRAGMENT}
  fragment WorkflowDefinitionFields on WorkflowDefinition {
    id
    tenantId
    name
    description
    version
    isActive
    category
    triggerConfig
    nodes {
      ...WorkflowNodeFields
    }
    routes {
      ...WorkflowRouteFields
    }
    slaHours
    escalationEnabled
    escalationUserId
    createdBy
    createdAt
    updatedAt
  }
`;

export const WORKFLOW_INSTANCE_NODE_FRAGMENT = gql`
  fragment WorkflowInstanceNodeFields on WorkflowInstanceNode {
    id
    tenantId
    instanceId
    nodeId
    nodeName
    nodeType
    status
    assignedUserId
    startedAt
    completedAt
    slaDeadline
    action
    actionByUserId
    actionDate
    comments
    outputData
    createdAt
  }
`;

export const WORKFLOW_INSTANCE_FRAGMENT = gql`
  ${WORKFLOW_INSTANCE_NODE_FRAGMENT}
  fragment WorkflowInstanceFields on WorkflowInstance {
    id
    tenantId
    workflowDefinitionId
    workflowName
    workflowVersion
    contextEntityType
    contextEntityId
    contextData
    status
    currentNodeId
    startedAt
    completedAt
    slaDeadline
    createdBy
    createdAt
    updatedAt
    nodes {
      ...WorkflowInstanceNodeFields
    }
  }
`;

export const USER_TASK_FRAGMENT = gql`
  fragment UserTaskFields on UserTask {
    taskId
    instanceId
    workflowName
    taskName
    nodeType
    assignedUserId
    slaDeadline
    urgencyLevel
    hoursRemaining
    isOverdue
    contextEntityType
    contextEntityId
    contextData
    taskCreatedAt
    tenantId
  }
`;

export const WORKFLOW_ANALYTICS_FRAGMENT = gql`
  fragment WorkflowAnalyticsFields on WorkflowAnalytics {
    workflowDefinitionId
    workflowName
    workflowVersion
    category
    tenantId
    totalInstances
    completedInstances
    failedInstances
    runningInstances
    escalatedInstances
    avgCompletionHours
    onTimeCompletions
    lateCompletions
    slaCompliancePercentage
  }
`;

// ============================================================================
// Queries - Workflow Definitions
// ============================================================================

export const GET_WORKFLOW_DEFINITIONS = gql`
  ${WORKFLOW_DEFINITION_FRAGMENT}
  query GetWorkflowDefinitions(
    $tenantId: ID!
    $isActive: Boolean
    $category: String
  ) {
    workflowDefinitions(
      tenantId: $tenantId
      isActive: $isActive
      category: $category
    ) {
      ...WorkflowDefinitionFields
    }
  }
`;

export const GET_WORKFLOW_DEFINITION = gql`
  ${WORKFLOW_DEFINITION_FRAGMENT}
  query GetWorkflowDefinition($id: ID!) {
    workflowDefinition(id: $id) {
      ...WorkflowDefinitionFields
    }
  }
`;

// ============================================================================
// Queries - Workflow Instances
// ============================================================================

export const GET_WORKFLOW_INSTANCES = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  query GetWorkflowInstances(
    $status: WorkflowStatus
    $entityType: String
    $limit: Int
  ) {
    workflowInstances(
      status: $status
      entityType: $entityType
      limit: $limit
    ) {
      ...WorkflowInstanceFields
    }
  }
`;

export const GET_WORKFLOW_INSTANCE = gql`
  ${WORKFLOW_INSTANCE_FRAGMENT}
  query GetWorkflowInstance($id: ID!) {
    workflowInstance(id: $id) {
      ...WorkflowInstanceFields
    }
  }
`;

export const GET_WORKFLOW_INSTANCE_HISTORY = gql`
  query GetWorkflowInstanceHistory($instanceId: ID!) {
    workflowInstanceHistory(instanceId: $instanceId) {
      id
      tenantId
      instanceId
      eventType
      eventDate
      eventByUserId
      eventData
      instanceSnapshot
      createdAt
    }
  }
`;

// ============================================================================
// Queries - User Tasks
// ============================================================================

export const GET_MY_PENDING_TASKS = gql`
  ${USER_TASK_FRAGMENT}
  query GetMyPendingTasks($urgencyLevel: UrgencyLevel, $limit: Int) {
    myPendingTasks(urgencyLevel: $urgencyLevel, limit: $limit) {
      ...UserTaskFields
    }
  }
`;

// ============================================================================
// Queries - Analytics
// ============================================================================

export const GET_WORKFLOW_ANALYTICS = gql`
  ${WORKFLOW_ANALYTICS_FRAGMENT}
  query GetWorkflowAnalytics(
    $workflowDefinitionId: ID
    $category: String
  ) {
    workflowAnalytics(
      workflowDefinitionId: $workflowDefinitionId
      category: $category
    ) {
      ...WorkflowAnalyticsFields
    }
  }
`;
