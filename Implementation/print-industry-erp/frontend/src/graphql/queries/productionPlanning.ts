import { gql } from '@apollo/client';

// =====================================================
// PRODUCTION ORDER QUERIES
// =====================================================

export const GET_PRODUCTION_ORDER = gql`
  query GetProductionOrder($id: ID!) {
    productionOrder(id: $id) {
      id
      tenantId
      facilityId
      productionOrderNumber
      salesOrderId
      salesOrderLineId
      productId
      productCode
      productDescription
      quantityOrdered
      quantityCompleted
      quantityScrap
      unitOfMeasure
      manufacturingStrategy
      priority
      dueDate
      plannedStartDate
      plannedCompletionDate
      actualStartDate
      actualCompletionDate
      status
      routingId
      estimatedMaterialCost
      estimatedLaborCost
      estimatedOverheadCost
      actualMaterialCost
      actualLaborCost
      actualOverheadCost
      specialInstructions
      qualityRequirements
      createdAt
      createdBy
      updatedAt
      updatedBy
      productionRuns {
        id
        productionRunNumber
        workCenterId
        operationId
        status
        targetQuantity
        goodQuantity
        scrapQuantity
        startTimestamp
        endTimestamp
      }
    }
  }
`;

export const GET_PRODUCTION_ORDERS = gql`
  query GetProductionOrders(
    $facilityId: ID!
    $status: ProductionOrderStatus
    $dueAfter: Date
    $dueBefore: Date
    $limit: Int
    $offset: Int
  ) {
    productionOrders(
      facilityId: $facilityId
      status: $status
      dueAfter: $dueAfter
      dueBefore: $dueBefore
      limit: $limit
      offset: $offset
    ) {
      edges {
        node {
          id
          productionOrderNumber
          productId
          productCode
          productDescription
          quantityOrdered
          quantityCompleted
          unitOfMeasure
          manufacturingStrategy
          priority
          dueDate
          plannedStartDate
          plannedCompletionDate
          status
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

// =====================================================
// WORK CENTER QUERIES
// =====================================================

export const GET_WORK_CENTER = gql`
  query GetWorkCenter($id: ID!) {
    workCenter(id: $id) {
      id
      tenantId
      facilityId
      workCenterCode
      workCenterName
      workCenterType
      manufacturer
      model
      serialNumber
      assetTag
      sheetWidthMax
      sheetHeightMax
      sheetWidthMin
      sheetHeightMin
      dimensionUnit
      gripperMargin
      sideMargins
      maxColors
      productionRatePerHour
      productionUnit
      hourlyRate
      setupCost
      costPerUnit
      lastMaintenanceDate
      nextMaintenanceDate
      maintenanceIntervalDays
      status
      isActive
      operatingCalendar
      capabilities
      effectiveFromDate
      effectiveToDate
      isCurrentVersion
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

export const GET_WORK_CENTERS = gql`
  query GetWorkCenters($facilityId: ID!, $status: WorkCenterStatus, $includeHistory: Boolean) {
    workCenters(facilityId: $facilityId, status: $status, includeHistory: $includeHistory) {
      id
      workCenterCode
      workCenterName
      workCenterType
      manufacturer
      model
      status
      productionRatePerHour
      productionUnit
      hourlyRate
      lastMaintenanceDate
      nextMaintenanceDate
      isActive
      effectiveFromDate
      effectiveToDate
      isCurrentVersion
    }
  }
`;

// =====================================================
// PRODUCTION RUN QUERIES
// =====================================================

export const GET_PRODUCTION_RUN = gql`
  query GetProductionRun($id: ID!) {
    productionRun(id: $id) {
      id
      tenantId
      facilityId
      productionRunNumber
      productionOrderId
      workCenterId
      operationId
      operatorUserId
      operatorName
      setupStartTime
      setupEndTime
      startTimestamp
      endTimestamp
      targetQuantity
      goodQuantity
      scrapQuantity
      unitOfMeasure
      actualSetupMinutes
      actualRunMinutes
      downtime
      downtimeReason
      status
      notes
      createdAt
      createdBy
      updatedAt
      updatedBy
      productionOrder {
        id
        productionOrderNumber
        productCode
        productDescription
      }
      workCenter {
        id
        workCenterCode
        workCenterName
      }
      operation {
        id
        operationCode
        operationName
        operationType
      }
    }
  }
`;

export const GET_PRODUCTION_RUNS = gql`
  query GetProductionRuns(
    $facilityId: ID
    $workCenterId: ID
    $status: ProductionRunStatus
    $startDate: DateTime
    $endDate: DateTime
    $limit: Int
    $offset: Int
  ) {
    productionRuns(
      facilityId: $facilityId
      workCenterId: $workCenterId
      status: $status
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
    ) {
      id
      productionRunNumber
      productionOrderId
      workCenterId
      operationId
      operatorName
      startTimestamp
      endTimestamp
      targetQuantity
      goodQuantity
      scrapQuantity
      unitOfMeasure
      status
      productionOrder {
        productionOrderNumber
        productCode
        productDescription
      }
      workCenter {
        workCenterCode
        workCenterName
      }
      operation {
        operationCode
        operationName
      }
    }
  }
`;

// =====================================================
// OPERATION QUERIES
// =====================================================

export const GET_OPERATION = gql`
  query GetOperation($id: ID!) {
    operation(id: $id) {
      id
      tenantId
      operationCode
      operationName
      operationType
      defaultWorkCenterId
      setupTimeMinutes
      runTimePerUnitSeconds
      setupCost
      costPerUnit
      inspectionRequired
      inspectionTemplateId
      description
      workInstructions
      isActive
      createdAt
      createdBy
      updatedAt
      updatedBy
      defaultWorkCenter {
        id
        workCenterCode
        workCenterName
      }
    }
  }
`;

export const GET_OPERATIONS = gql`
  query GetOperations($tenantId: ID!, $type: OperationType) {
    operations(tenantId: $tenantId, type: $type) {
      id
      operationCode
      operationName
      operationType
      defaultWorkCenterId
      setupTimeMinutes
      runTimePerUnitSeconds
      setupCost
      costPerUnit
      inspectionRequired
      description
      isActive
      defaultWorkCenter {
        id
        workCenterCode
        workCenterName
      }
    }
  }
`;

// =====================================================
// OEE QUERIES
// =====================================================

export const GET_OEE_CALCULATIONS = gql`
  query GetOEECalculations($workCenterId: ID!, $startDate: Date!, $endDate: Date!) {
    oeeCalculations(workCenterId: $workCenterId, startDate: $startDate, endDate: $endDate) {
      id
      workCenterId
      calculationDate
      shiftNumber
      availabilityPercent
      performancePercent
      qualityPercent
      oeePercent
      plannedProductionTime
      downtime
      operatingTime
      idealCycleTime
      totalPieces
      goodPieces
      rejectPieces
      availabilityLoss
      performanceLoss
      qualityLoss
      notes
      createdAt
      workCenter {
        workCenterCode
        workCenterName
      }
    }
  }
`;

// =====================================================
// PRODUCTION SCHEDULE QUERIES
// =====================================================

export const GET_PRODUCTION_SCHEDULE = gql`
  query GetProductionSchedule(
    $workCenterId: ID
    $facilityId: ID
    $startDate: Date!
    $endDate: Date!
  ) {
    productionSchedule(
      workCenterId: $workCenterId
      facilityId: $facilityId
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      scheduleDate
      shiftNumber
      workCenterId
      productionOrderId
      operationId
      scheduledStartTime
      scheduledEndTime
      durationMinutes
      status
      notes
      createdAt
      workCenter {
        workCenterCode
        workCenterName
      }
      productionOrder {
        productionOrderNumber
        productCode
        productDescription
      }
      operation {
        operationCode
        operationName
      }
    }
  }
`;

// =====================================================
// CAPACITY PLANNING QUERIES
// =====================================================

export const GET_CAPACITY_PLANNING = gql`
  query GetCapacityPlanning(
    $facilityId: ID
    $workCenterId: ID
    $startDate: Date!
    $endDate: Date!
  ) {
    capacityPlanning(
      facilityId: $facilityId
      workCenterId: $workCenterId
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      planName
      planType
      startDate
      endDate
      workCenterId
      facilityId
      totalCapacityHours
      utilizationPercent
      demandForecast
      capacityBreakdown
      notes
      createdAt
    }
  }
`;

// =====================================================
// MAINTENANCE QUERIES
// =====================================================

export const GET_MAINTENANCE_RECORDS = gql`
  query GetMaintenanceRecords(
    $workCenterId: ID!
    $startDate: Date
    $endDate: Date
    $type: MaintenanceType
  ) {
    maintenanceRecords(
      workCenterId: $workCenterId
      startDate: $startDate
      endDate: $endDate
      type: $type
    ) {
      id
      workCenterId
      maintenanceType
      maintenanceDate
      scheduledDate
      completedDate
      downtime
      description
      workPerformed
      partsReplaced
      costLabor
      costParts
      technicianName
      technicianUserId
      nextMaintenanceDate
      createdAt
      createdBy
      updatedAt
      updatedBy
      workCenter {
        workCenterCode
        workCenterName
      }
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

export const CREATE_PRODUCTION_ORDER = gql`
  mutation CreateProductionOrder($input: CreateProductionOrderInput!) {
    createProductionOrder(input: $input) {
      id
      productionOrderNumber
      status
      createdAt
    }
  }
`;

export const UPDATE_PRODUCTION_ORDER = gql`
  mutation UpdateProductionOrder($id: ID!, $input: UpdateProductionOrderInput!) {
    updateProductionOrder(id: $id, input: $input) {
      id
      productionOrderNumber
      status
      updatedAt
    }
  }
`;

export const RELEASE_PRODUCTION_ORDER = gql`
  mutation ReleaseProductionOrder($id: ID!) {
    releaseProductionOrder(id: $id) {
      id
      productionOrderNumber
      status
      updatedAt
    }
  }
`;

export const CREATE_PRODUCTION_RUN = gql`
  mutation CreateProductionRun($input: CreateProductionRunInput!) {
    createProductionRun(input: $input) {
      id
      productionRunNumber
      status
      createdAt
    }
  }
`;

export const START_PRODUCTION_RUN = gql`
  mutation StartProductionRun($id: ID!) {
    startProductionRun(id: $id) {
      id
      productionRunNumber
      status
      startTimestamp
      updatedAt
    }
  }
`;

export const COMPLETE_PRODUCTION_RUN = gql`
  mutation CompleteProductionRun(
    $id: ID!
    $goodQuantity: Float!
    $scrapQuantity: Float!
    $notes: String
  ) {
    completeProductionRun(
      id: $id
      goodQuantity: $goodQuantity
      scrapQuantity: $scrapQuantity
      notes: $notes
    ) {
      id
      productionRunNumber
      status
      goodQuantity
      scrapQuantity
      endTimestamp
      updatedAt
    }
  }
`;

export const CREATE_WORK_CENTER = gql`
  mutation CreateWorkCenter($input: CreateWorkCenterInput!) {
    createWorkCenter(input: $input) {
      id
      workCenterCode
      workCenterName
      status
      createdAt
    }
  }
`;

export const UPDATE_WORK_CENTER = gql`
  mutation UpdateWorkCenter($id: ID!, $input: UpdateWorkCenterInput!) {
    updateWorkCenter(id: $id, input: $input) {
      id
      workCenterCode
      workCenterName
      status
      updatedAt
    }
  }
`;

export const LOG_EQUIPMENT_STATUS = gql`
  mutation LogEquipmentStatus($input: LogEquipmentStatusInput!) {
    logEquipmentStatus(input: $input) {
      id
      workCenterId
      status
      statusStartTime
      createdAt
    }
  }
`;

export const CREATE_MAINTENANCE_RECORD = gql`
  mutation CreateMaintenanceRecord($input: CreateMaintenanceRecordInput!) {
    createMaintenanceRecord(input: $input) {
      id
      workCenterId
      maintenanceType
      maintenanceDate
      createdAt
    }
  }
`;

export const CALCULATE_OEE = gql`
  mutation CalculateOEE($workCenterId: ID!, $calculationDate: Date!, $shiftNumber: Int) {
    calculateOEE(
      workCenterId: $workCenterId
      calculationDate: $calculationDate
      shiftNumber: $shiftNumber
    ) {
      id
      oeePercent
      availabilityPercent
      performancePercent
      qualityPercent
      createdAt
    }
  }
`;
