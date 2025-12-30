import { gql } from '@apollo/client';

export const GET_PRODUCTION_SUMMARY = gql`
  query GetProductionSummary($facilityId: ID!) {
    productionSummary(facilityId: $facilityId) {
      activeRuns
      scheduledRuns
      completedRunsToday
      totalGoodQuantity
      totalScrapQuantity
      totalReworkQuantity
      averageYield
      currentOEE
      asOfTimestamp
    }
  }
`;

export const GET_WORK_CENTER_SUMMARIES = gql`
  query GetWorkCenterSummaries($facilityId: ID!) {
    workCenterSummaries(facilityId: $facilityId) {
      workCenterId
      workCenterName
      workCenterType
      activeRuns
      scheduledRuns
      completedRunsToday
      totalGoodQuantity
      totalScrapQuantity
      totalReworkQuantity
      averageYield
      currentOEE
    }
  }
`;

export const GET_PRODUCTION_RUN_SUMMARIES = gql`
  query GetProductionRunSummaries(
    $facilityId: ID!
    $workCenterId: ID
    $status: ProductionRunStatus
    $limit: Int
  ) {
    productionRunSummaries(
      facilityId: $facilityId
      workCenterId: $workCenterId
      status: $status
      limit: $limit
    ) {
      id
      productionRunNumber
      productionOrderNumber
      workCenterId
      workCenterName
      operatorName
      status
      scheduledStart
      scheduledEnd
      actualStart
      actualEnd
      quantityPlanned
      quantityGood
      quantityScrap
      quantityRework
      setupTimeMinutes
      runTimeMinutes
      downtimeMinutes
      progressPercentage
      currentOEE
    }
  }
`;

export const GET_OEE_TRENDS = gql`
  query GetOEETrends(
    $facilityId: ID!
    $workCenterId: ID
    $startDate: Date
    $endDate: Date
  ) {
    oEETrends(
      facilityId: $facilityId
      workCenterId: $workCenterId
      startDate: $startDate
      endDate: $endDate
    ) {
      workCenterId
      workCenterName
      calculationDate
      shift
      availabilityPercentage
      performancePercentage
      qualityPercentage
      oeePercentage
      targetOEEPercentage
    }
  }
`;

export const GET_WORK_CENTER_UTILIZATION = gql`
  query GetWorkCenterUtilization($facilityId: ID!) {
    workCenterUtilization(facilityId: $facilityId) {
      workCenterId
      workCenterName
      status
      currentProductionRunNumber
      currentOEE
      todayRuntime
      todayDowntime
      todaySetupTime
      utilizationPercentage
      activeRunProgress
    }
  }
`;

export const GET_PRODUCTION_ALERTS = gql`
  query GetProductionAlerts($facilityId: ID!) {
    productionAlerts(facilityId: $facilityId) {
      id
      severity
      type
      workCenterId
      workCenterName
      productionRunId
      message
      timestamp
    }
  }
`;
