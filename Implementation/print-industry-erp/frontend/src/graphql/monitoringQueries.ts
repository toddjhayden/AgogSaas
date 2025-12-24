/**
 * GraphQL Queries
 * Queries for storage locations and lots
 */

import { gql } from '@apollo/client';

export const GET_STORAGE_LOCATIONS = gql`
  query GetStorageLocations($tenantId: ID!, $filters: StorageLocationFiltersInput) {
    storageLocations(tenantId: $tenantId, filters: $filters) {
      locationId
      locationCode
      locationType
      parentLocationId
      zone
      aisle
      row
      level
      capacityWeight
      capacityVolume
      currentUtilization
      isPickable
      isReceivable
      isActive
      notes
      createdAt
      updatedAt
    }
  }
`;

export const GET_STORAGE_LOCATION = gql`
  query GetStorageLocation($tenantId: ID!, $locationId: ID!) {
    storageLocation(tenantId: $tenantId, locationId: $locationId) {
      locationId
      locationCode
      locationType
      parentLocationId
      zone
      aisle
      row
      level
      capacityWeight
      capacityVolume
      currentUtilization
      isPickable
      isReceivable
      isActive
      notes
      createdAt
      updatedAt
      parentLocation {
        locationId
        locationCode
        locationType
      }
      children {
        locationId
        locationCode
        locationType
        currentUtilization
      }
    }
  }
`;

export const GET_LOTS = gql`
  query GetLots($tenantId: ID!, $filters: LotFiltersInput) {
    lots(tenantId: $tenantId, filters: $filters) {
      lotId
      lotNumber
      materialId
      supplierLotNumber
      receiptDate
      manufacturedDate
      expirationDate
      quantityReceived
      quantityOnHand
      unitOfMeasure
      unitCost
      totalValue
      qualityStatus
      qualityNotes
      currentLocationId
      notes
      createdAt
      updatedAt
    }
  }
`;

export const GET_LOT = gql`
  query GetLot($tenantId: ID!, $lotId: ID!) {
    lot(tenantId: $tenantId, lotId: $lotId) {
      lotId
      lotNumber
      materialId
      supplierLotNumber
      purchaseOrderId
      supplierId
      receiptDate
      manufacturedDate
      expirationDate
      quantityReceived
      quantityOnHand
      unitOfMeasure
      unitCost
      totalValue
      qualityStatus
      qualityInspectionId
      qualityNotes
      currentLocationId
      attributes
      parentLotIds
      notes
      createdAt
      createdBy
      updatedAt
      updatedBy
      currentLocation {
        locationId
        locationCode
        locationType
      }
    }
  }
`;

export const GET_TRANSACTION_HISTORY = gql`
  query GetTransactionHistory($tenantId: ID!, $filters: TransactionFiltersInput) {
    transactionHistory(tenantId: $tenantId, filters: $filters) {
      transaction_id
      transaction_type
      transaction_date
      lot_id
      from_location_id
      to_location_id
      quantity
      unit_of_measure
      reason_code
      notes
      performed_by
      created_at
    }
  }
`;

export const GET_LOT_TRANSACTIONS = gql`
  query GetLotTransactions($tenantId: ID!, $lotId: ID!) {
    lotTransactions(tenantId: $tenantId, lotId: $lotId) {
      transaction_id
      transaction_type
      transaction_date
      lot_id
      from_location_id
      to_location_id
      quantity
      unit_of_measure
      reason_code
      notes
      performed_by
      created_at
    }
  }
`;

export const GET_LOT_RUNNING_BALANCE = gql`
  query GetLotRunningBalance($tenantId: ID!, $lotId: ID!) {
    lotRunningBalance(tenantId: $tenantId, lotId: $lotId) {
      transaction {
        transaction_id
        transaction_type
        transaction_date
        quantity
        unit_of_measure
        performed_by
      }
      balance
    }
  }
`;

// Put-Away Queries
export const GET_PUTAWAY_TASKS = gql`
  query GetPutAwayTasks($tenantId: ID!, $status: PutAwayTaskStatus) {
    putAwayTasks(tenantId: $tenantId, status: $status) {
      taskId
      lotId
      materialId
      materialCode
      materialName
      lotNumber
      quantity
      unitOfMeasure
      suggestedLocationId
      suggestedLocationCode
      actualLocationId
      actualLocationCode
      status
      assignedTo
      startedAt
      completedAt
      notes
      createdAt
      updatedAt
      suggestedLocation {
        locationId
        locationCode
        locationType
        zone
        aisle
        row
        level
        currentUtilization
      }
    }
  }
`;

export const GET_LOCATION_RECOMMENDATIONS = gql`
  query GetLocationRecommendations($tenantId: ID!, $materialId: ID!, $quantity: Float!) {
    recommendedLocations(tenantId: $tenantId, materialId: $materialId, quantity: $quantity) {
      locationId
      locationCode
      locationType
      zone
      aisle
      row
      level
      score
      reason
      availableCapacity
      currentUtilization
      distance
    }
  }
`;

// Put-Away Mutations
export const CREATE_PUTAWAY_TASK = gql`
  mutation CreatePutAwayTask($tenantId: ID!, $input: PutAwayInput!) {
    createPutAwayTask(tenantId: $tenantId, input: $input) {
      taskId
      lotId
      materialCode
      materialName
      lotNumber
      quantity
      unitOfMeasure
      suggestedLocationId
      suggestedLocationCode
      status
      createdAt
    }
  }
`;

export const COMPLETE_PUTAWAY_TASK = gql`
  mutation CompletePutAwayTask($tenantId: ID!, $input: CompletePutAwayInput!) {
    completePutAwayTask(tenantId: $tenantId, input: $input) {
      taskId
      actualLocationId
      actualLocationCode
      status
      completedAt
    }
  }
`;

export const START_PUTAWAY_TASK = gql`
  mutation StartPutAwayTask($tenantId: ID!, $taskId: ID!) {
    startPutAwayTask(tenantId: $tenantId, taskId: $taskId) {
      taskId
      status
      startedAt
      assignedTo
    }
  }
`;

// FEFO / Expiration Management Queries
export const GET_EXPIRING_LOTS = gql`
  query GetExpiringLots($tenantId: ID!, $withinDays: Int!, $materialId: ID) {
    expiringLots(tenantId: $tenantId, withinDays: $withinDays, materialId: $materialId) {
      lotId
      lotNumber
      materialId
      supplierLotNumber
      receiptDate
      manufacturedDate
      expirationDate
      quantityReceived
      quantityOnHand
      unitOfMeasure
      unitCost
      totalValue
      qualityStatus
      qualityNotes
      currentLocationId
      notes
      createdAt
      updatedAt
      currentLocation {
        locationId
        locationCode
        locationType
        zone
        aisle
      }
    }
  }
`;

// Pick List Queries
export const GET_PICK_LISTS = gql`
  query GetPickLists($tenantId: ID!, $status: PickListStatus) {
    pickLists(tenantId: $tenantId, status: $status) {
      pickListId
      orderId
      orderNumber
      orderType
      status
      priority
      assignedTo
      totalLines
      completedLines
      createdAt
      createdBy
      startedAt
      completedAt
    }
  }
`;

export const GET_PICK_LIST = gql`
  query GetPickList($tenantId: ID!, $pickListId: ID!) {
    pickList(tenantId: $tenantId, pickListId: $pickListId) {
      pickListId
      orderId
      orderNumber
      orderType
      status
      priority
      assignedTo
      totalLines
      completedLines
      createdAt
      createdBy
      startedAt
      completedAt
      pickLines {
        pickLineId
        lineNumber
        materialId
        materialCode
        materialName
        lotId
        lotNumber
        locationId
        locationCode
        zone
        aisle
        row
        level
        quantityRequired
        quantityPicked
        unitOfMeasure
        status
        isFEFO
        expirationDate
        pickedAt
        pickedBy
        varianceReason
      }
    }
  }
`;

export const GENERATE_PICK_LIST = gql`
  mutation GeneratePickList($tenantId: ID!, $orderId: ID!) {
    generatePickList(tenantId: $tenantId, orderId: $orderId) {
      pickListId
      orderId
      orderNumber
      status
      totalLines
    }
  }
`;

export const START_PICKING = gql`
  mutation StartPicking($tenantId: ID!, $pickListId: ID!) {
    startPicking(tenantId: $tenantId, pickListId: $pickListId) {
      pickListId
      status
      startedAt
    }
  }
`;

export const CONFIRM_PICK = gql`
  mutation ConfirmPick(
    $tenantId: ID!
    $pickLineId: ID!
    $actualQuantity: Float!
    $actualLotId: ID
    $varianceReason: String
  ) {
    confirmPick(
      tenantId: $tenantId
      pickLineId: $pickLineId
      actualQuantity: $actualQuantity
      actualLotId: $actualLotId
      varianceReason: $varianceReason
    ) {
      pickLineId
      status
      quantityPicked
      pickedAt
      pickedBy
    }
  }
`;

export const COMPLETE_PICK_LIST = gql`
  mutation CompletePickList($tenantId: ID!, $pickListId: ID!) {
    completePickList(tenantId: $tenantId, pickListId: $pickListId) {
      pickListId
      status
      completedAt
      completedLines
    }
  }
`;

// Cycle Counting Queries

export const GET_CYCLE_COUNT_TASKS = gql`
  query GetCycleCountTasks($tenantId: ID!, $status: CycleCountTaskStatus, $assignedTo: String) {
    cycleCountTasks(tenantId: $tenantId, status: $status, assignedTo: $assignedTo) {
      taskId
      tenantId
      locationId
      lotId
      strategy
      abcClassification
      scheduledDate
      completedDate
      assignedTo
      status
      notes
      createdAt
      updatedAt
      location {
        locationId
        locationCode
        locationType
      }
      lot {
        lotId
        lotNumber
        materialId
      }
    }
  }
`;

export const GET_CYCLE_COUNT_TASK = gql`
  query GetCycleCountTask($tenantId: ID!, $taskId: ID!) {
    cycleCountTask(tenantId: $tenantId, taskId: $taskId) {
      taskId
      tenantId
      locationId
      lotId
      strategy
      abcClassification
      scheduledDate
      completedDate
      assignedTo
      status
      notes
      createdAt
      updatedAt
      location {
        locationId
        locationCode
        locationType
        zone
        aisle
        row
        level
      }
      lot {
        lotId
        lotNumber
        materialId
        quantityOnHand
        unitOfMeasure
      }
      counts {
        recordId
        taskId
        lotId
        expectedQuantity
        actualQuantity
        variance
        variancePercentage
        countedAt
        countedBy
        lot {
          lotId
          lotNumber
          materialId
          unitOfMeasure
        }
      }
      variances {
        varianceId
        taskId
        lotId
        expectedQuantity
        actualQuantity
        variance
        variancePercentage
        requiresApproval
        approved
        approvedBy
        approvedAt
        reasonCode
        notes
        adjustmentCreated
        adjustmentTransactionId
        createdAt
        lot {
          lotId
          lotNumber
          materialId
          unitOfMeasure
        }
      }
    }
  }
`;

export const GET_ABC_CLASSIFICATION = gql`
  query GetABCClassification($tenantId: ID!) {
    abcClassification(tenantId: $tenantId) {
      lotId
      materialId
      materialCode
      materialName
      totalValue
      classification
      countFrequency
      lastCountDate
      nextCountDate
    }
  }
`;

export const GET_VARIANCES = gql`
  query GetVariances($tenantId: ID!, $approved: Boolean, $requiresApproval: Boolean) {
    variances(tenantId: $tenantId, approved: $approved, requiresApproval: $requiresApproval) {
      varianceId
      taskId
      lotId
      expectedQuantity
      actualQuantity
      variance
      variancePercentage
      requiresApproval
      approved
      approvedBy
      approvedAt
      reasonCode
      notes
      adjustmentCreated
      adjustmentTransactionId
      createdAt
      lot {
        lotId
        lotNumber
        materialId
        unitOfMeasure
      }
      task {
        taskId
        scheduledDate
        status
        assignedTo
      }
    }
  }
`;

// Cycle Counting Mutations

export const SCHEDULE_CYCLE_COUNT = gql`
  mutation ScheduleCycleCount($tenantId: ID!, $input: CycleCountScheduleInput!) {
    scheduleCycleCount(tenantId: $tenantId, input: $input) {
      taskId
      tenantId
      locationId
      lotId
      strategy
      abcClassification
      scheduledDate
      assignedTo
      status
      notes
      createdAt
    }
  }
`;

export const START_CYCLE_COUNT = gql`
  mutation StartCycleCount($tenantId: ID!, $taskId: ID!) {
    startCycleCount(tenantId: $tenantId, taskId: $taskId) {
      taskId
      status
      updatedAt
    }
  }
`;

export const RECORD_COUNT = gql`
  mutation RecordCount($tenantId: ID!, $input: RecordCountInput!) {
    recordCount(tenantId: $tenantId, input: $input) {
      recordId
      taskId
      lotId
      expectedQuantity
      actualQuantity
      variance
      variancePercentage
      countedAt
      countedBy
    }
  }
`;

export const COMPLETE_CYCLE_COUNT = gql`
  mutation CompleteCycleCount($tenantId: ID!, $taskId: ID!) {
    completeCycleCount(tenantId: $tenantId, taskId: $taskId) {
      taskId
      status
      completedDate
      updatedAt
    }
  }
`;

export const APPROVE_VARIANCE = gql`
  mutation ApproveVariance($tenantId: ID!, $input: ApproveVarianceInput!) {
    approveVariance(tenantId: $tenantId, input: $input) {
      varianceId
      approved
      approvedBy
      approvedAt
      reasonCode
      notes
      adjustmentCreated
      adjustmentTransactionId
    }
  }
`;

export const REJECT_VARIANCE = gql`
  mutation RejectVariance($tenantId: ID!, $varianceId: ID!, $notes: String) {
    rejectVariance(tenantId: $tenantId, varianceId: $varianceId, notes: $notes) {
      varianceId
      approved
      notes
    }
  }
`;

// Storage Location Mutations

export const CREATE_STORAGE_LOCATION = gql`
  mutation CreateStorageLocation($input: CreateStorageLocationInput!) {
    createStorageLocation(input: $input) {
      locationId
      locationCode
      locationType
      parentLocationId
      zone
      aisle
      row
      level
      capacityWeight
      capacityVolume
      isPickable
      isReceivable
      isActive
      notes
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_STORAGE_LOCATION = gql`
  mutation UpdateStorageLocation(
    $tenantId: ID!
    $locationId: ID!
    $input: UpdateStorageLocationInput!
  ) {
    updateStorageLocation(tenantId: $tenantId, locationId: $locationId, input: $input) {
      locationId
      locationCode
      locationType
      parentLocationId
      zone
      aisle
      row
      level
      capacityWeight
      capacityVolume
      currentUtilization
      isPickable
      isReceivable
      isActive
      notes
      updatedAt
    }
  }
`;

export const DELETE_STORAGE_LOCATION = gql`
  mutation DeleteStorageLocation($tenantId: ID!, $locationId: ID!) {
    deleteStorageLocation(tenantId: $tenantId, locationId: $locationId)
  }
`;

// Lot Mutations

export const CREATE_LOT = gql`
  mutation CreateLot($input: CreateLotInput!) {
    createLot(input: $input) {
      lotId
      lotNumber
      materialId
      supplierLotNumber
      purchaseOrderId
      supplierId
      receiptDate
      manufacturedDate
      expirationDate
      quantityReceived
      quantityOnHand
      unitOfMeasure
      unitCost
      qualityStatus
      currentLocationId
      notes
      createdAt
    }
  }
`;

export const UPDATE_LOT = gql`
  mutation UpdateLot($tenantId: ID!, $lotId: ID!, $input: UpdateLotInput!) {
    updateLot(tenantId: $tenantId, lotId: $lotId, input: $input) {
      lotId
      lotNumber
      qualityStatus
      quantityOnHand
      notes
      updatedAt
    }
  }
`;

export const DELETE_LOT = gql`
  mutation DeleteLot($tenantId: ID!, $lotId: ID!) {
    deleteLot(tenantId: $tenantId, lotId: $lotId)
  }
`;

// Kit Management Queries

export const GET_KITS = gql`
  query GetKits($tenantId: ID!, $filters: KitFiltersInput) {
    kits(tenantId: $tenantId, filters: $filters) {
      kitId
      kitCode
      kitName
      kitDescription
      isActive
      components {
        componentId
        materialId
        quantityRequired
        componentType
        isVersionDifferentiator
      }
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

export const GET_KIT = gql`
  query GetKit($tenantId: ID!, $kitId: ID!) {
    kit(tenantId: $tenantId, kitId: $kitId) {
      kitId
      kitCode
      kitName
      kitDescription
      isActive
      components {
        componentId
        materialId
        material {
          materialId
          materialCode
          materialName
          description
        }
        quantityRequired
        componentType
        isVersionDifferentiator
      }
      availability {
        kitId
        totalAvailable
        versions {
          versionLabel
          availableQuantity
        }
        blockingComponents {
          componentId
          materialId
          materialCode
          required
          available
          shortage
        }
      }
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

export const GET_KIT_AVAILABILITY = gql`
  query GetKitAvailability($tenantId: ID!, $kitId: ID!) {
    kitAvailability(tenantId: $tenantId, kitId: $kitId) {
      kitId
      kitCode
      totalAvailable
      versions {
        versionLabel
        availableQuantity
        includedComponents {
          componentId
          materialId
          materialCode
          materialName
        }
        excludedComponents {
          componentId
          materialId
          materialCode
          materialName
        }
      }
      blockingComponents {
        componentId
        materialId
        materialCode
        required
        available
        shortage
      }
    }
  }
`;

// Kit Management Mutations

export const CREATE_KIT = gql`
  mutation CreateKit($input: CreateKitInput!) {
    createKit(input: $input) {
      kitId
      kitCode
      kitName
      kitDescription
      isActive
      components {
        componentId
        materialId
        quantityRequired
        componentType
        isVersionDifferentiator
      }
      createdAt
      createdBy
    }
  }
`;

export const UPDATE_KIT = gql`
  mutation UpdateKit($tenantId: ID!, $kitId: ID!, $input: UpdateKitInput!) {
    updateKit(tenantId: $tenantId, kitId: $kitId, input: $input) {
      kitId
      kitCode
      kitName
      kitDescription
      isActive
      updatedAt
      updatedBy
    }
  }
`;

export const DELETE_KIT = gql`
  mutation DeleteKit($tenantId: ID!, $kitId: ID!) {
    deleteKit(tenantId: $tenantId, kitId: $kitId)
  }
`;

export const ADD_KIT_COMPONENT = gql`
  mutation AddKitComponent($tenantId: ID!, $kitId: ID!, $input: CreateKitComponentInput!) {
    addKitComponent(tenantId: $tenantId, kitId: $kitId, input: $input) {
      componentId
      materialId
      quantityRequired
      componentType
      isVersionDifferentiator
      createdAt
    }
  }
`;

export const UPDATE_KIT_COMPONENT = gql`
  mutation UpdateKitComponent($tenantId: ID!, $componentId: ID!, $input: UpdateKitComponentInput!) {
    updateKitComponent(tenantId: $tenantId, componentId: $componentId, input: $input) {
      componentId
      materialId
      quantityRequired
      componentType
      isVersionDifferentiator
    }
  }
`;

export const REMOVE_KIT_COMPONENT = gql`
  mutation RemoveKitComponent($tenantId: ID!, $componentId: ID!) {
    removeKitComponent(tenantId: $tenantId, componentId: $componentId)
  }
`;

export const CLONE_KIT = gql`
  mutation CloneKit(
    $tenantId: ID!
    $kitId: ID!
    $newKitCode: String!
    $newKitName: String!
    $clonedBy: String!
  ) {
    cloneKit(
      tenantId: $tenantId
      kitId: $kitId
      newKitCode: $newKitCode
      newKitName: $newKitName
      clonedBy: $clonedBy
    ) {
      kitId
      kitCode
      kitName
      kitDescription
      isActive
      components {
        componentId
        materialId
        quantityRequired
        componentType
        isVersionDifferentiator
      }
      createdAt
      createdBy
    }
  }
`;

// ============================================
// MONITORING QUERIES
// ============================================

export const GET_SYSTEM_HEALTH = gql`
  query GetSystemHealth {
    systemHealth {
      overall
      backend {
        name
        status
        lastCheck
        responseTime
        error
      }
      frontend {
        name
        status
        lastCheck
        responseTime
        error
      }
      database {
        name
        status
        lastCheck
        responseTime
        error
      }
      nats {
        name
        status
        lastCheck
        responseTime
        error
      }
      timestamp
    }
  }
`;

export const GET_SYSTEM_ERRORS = gql`
  query GetSystemErrors(
    $severity: ErrorSeverity
    $status: ErrorStatus
    $component: String
    $limit: Int
    $offset: Int
  ) {
    systemErrors(
      severity: $severity
      status: $status
      component: $component
      limit: $limit
      offset: $offset
    ) {
      id
      severity
      status
      message
      stackTrace
      component
      userId
      tenantId
      firstOccurred
      lastOccurred
      occurrenceCount
      assignedTo
      resolvedBy
      resolvedAt
      resolutionNotes
    }
  }
`;

export const GET_ACTIVE_FIXES = gql`
  query GetActiveFixes(
    $owner: String
    $status: FixStatus
    $priority: FixPriority
  ) {
    activeFixes(owner: $owner, status: $status, priority: $priority) {
      reqNumber
      title
      priority
      status
      owner
      requestedAt
      estimatedCompletion
      description
      blockers
      notes
    }
  }
`;

export const GET_AGENT_ACTIVITIES = gql`
  query GetAgentActivities {
    agentActivities {
      agentId
      agentName
      status
      reqNumber
      featureTitle
      currentTask
      progress
      startedAt
      estimatedCompletion
      deliverablePath
      error
    }
  }
`;

export const GET_AGENT_ACTIVITY = gql`
  query GetAgentActivity($agentId: String!) {
    agentActivity(agentId: $agentId) {
      agentId
      agentName
      status
      reqNumber
      featureTitle
      currentTask
      progress
      startedAt
      estimatedCompletion
      deliverablePath
      error
    }
  }
`;

export const GET_FEATURE_WORKFLOWS = gql`
  query GetFeatureWorkflows($status: WorkflowStatus, $assignedTo: String) {
    featureWorkflows(status: $status, assignedTo: $assignedTo) {
      reqNumber
      title
      assignedTo
      status
      currentStage
      startedAt
      completedAt
      totalDuration
      stages {
        name
        agent
        status
        startedAt
        completedAt
        duration
      }
    }
  }
`;

export const GET_MONITORING_STATS = gql`
  query GetMonitoringStats {
    monitoringStats {
      openErrors
      criticalErrors24h
      activeAgents
      avgWorkflowDuration
      uptimePercentage
      completedWorkflows
    }
  }
`;

// ============================================
// MONITORING SUBSCRIPTIONS
// ============================================

export const SUBSCRIBE_SYSTEM_HEALTH = gql`
  subscription OnSystemHealthUpdated {
    systemHealthUpdated {
      overall
      backend { name status responseTime }
      frontend { name status responseTime }
      database { name status responseTime }
      nats { name status responseTime }
      timestamp
    }
  }
`;

export const SUBSCRIBE_ERROR_CREATED = gql`
  subscription OnErrorCreated($severity: ErrorSeverity) {
    errorCreated(severity: $severity) {
      id
      severity
      status
      message
      component
      firstOccurred
    }
  }
`;

export const SUBSCRIBE_AGENT_ACTIVITY = gql`
  subscription OnAgentActivityUpdated($agentId: String) {
    agentActivityUpdated(agentId: $agentId) {
      agentId
      agentName
      status
      reqNumber
      currentTask
      progress
    }
  }
`;

// ============================================
// ORCHESTRATOR MONITORING QUERIES (REQ-PROACTIVE-001)
// ============================================

export const GET_ACTIVE_WORKFLOWS = gql`
  query GetActiveWorkflows {
    activeWorkflows {
      reqNumber
      title
      currentStage
      currentAgent
      status
      elapsedMinutes
      assignedTo
      gitBranch
      startedAt
    }
  }
`;

export const GET_STRATEGIC_DECISIONS = gql`
  query GetStrategicDecisions($last: Int) {
    strategicDecisions(last: $last) {
      decision_id
      req_number
      strategic_agent
      decision
      reasoning
      decision_confidence
      similar_past_decisions
      deviations_from_past
      timestamp
    }
  }
`;

export const GET_ESCALATION_QUEUE = gql`
  query GetEscalationQueue {
    escalationQueue {
      req_number
      priority
      reason
      timestamp
      original_decision
      action_required
    }
  }
`;

export const GET_SYSTEM_HEALTH_ORCHESTRATOR = gql`
  query GetSystemHealthOrchestrator {
    systemHealthOrchestrator {
      nats {
        connected
        responseTime
      }
      postgres {
        connected
        responseTime
      }
      ollama {
        connected
        responseTime
      }
      circuitBreaker {
        status
        failures
        maxFailures
      }
      activeAgents
      maxAgents
    }
  }
`;

// ============================================
// ORCHESTRATOR CONTROL MUTATIONS (REQ-PROACTIVE-001)
// ============================================

export const RESET_CIRCUIT_BREAKER = gql`
  mutation ResetCircuitBreaker {
    resetCircuitBreaker {
      success
      message
    }
  }
`;

export const PAUSE_DAEMON = gql`
  mutation PauseDaemon {
    pauseDaemon {
      success
      message
    }
  }
`;

export const RESUME_DAEMON = gql`
  mutation ResumeDaemon {
    resumeDaemon {
      success
      message
    }
  }
`;

export const ROLLBACK_WORKFLOW = gql`
  mutation RollbackWorkflow($reqNumber: String!, $reason: String!) {
    rollbackWorkflow(reqNumber: $reqNumber, reason: $reason) {
      success
      reqNumber
      rollbackTag
      message
    }
  }
`;
