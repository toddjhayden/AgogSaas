/**
 * SPC GraphQL Queries
 *
 * REQ: REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
 * Created: 2025-12-29
 */

import { gql } from '@apollo/client';

/**
 * Query: Get SPC dashboard summary
 */
export const GET_SPC_DASHBOARD_SUMMARY = gql`
  query GetSPCDashboardSummary($tenantId: ID!, $facilityId: ID!, $dateRange: DateRangeInput!) {
    spcDashboardSummary(tenantId: $tenantId, facilityId: $facilityId, dateRange: $dateRange) {
      totalParametersMonitored
      parametersInControl
      parametersOutOfControl
      openAlerts
      criticalAlerts
      avgCpk
      avgCp
      capableProcesses
      marginalProcesses
      poorProcesses
      alertsByRuleType {
        ruleType
        count
      }
      topParameters {
        parameterCode
        parameterName
        currentCpk
        alertCount
        status
      }
    }
  }
`;

/**
 * Query: Get control chart data for a parameter
 */
export const GET_SPC_CONTROL_CHART_DATA = gql`
  query GetSPCControlChartData($filter: SPCChartDataFilterInput!) {
    spcControlChartData(filter: $filter) {
      id
      tenantId
      facilityId
      productionRunId
      workCenterId
      productId
      parameterCode
      parameterName
      parameterType
      chartType
      measurementTimestamp
      subgroupNumber
      subgroupSize
      measuredValue
      measurementUnit
      operatorUserId
      measurementMethod
      measurementDeviceId
      qualityInspectionId
      lotNumber
      dataSource
      sensorReadingId
      measurementQuality
      confidenceScore
      calibrationStatus
      dataQualityFlags
      createdAt
      createdBy
    }
  }
`;

/**
 * Query: Get control limits for a parameter
 */
export const GET_SPC_CONTROL_LIMITS = gql`
  query GetSPCControlLimits(
    $tenantId: ID!
    $parameterCode: String!
    $productId: ID
    $workCenterId: ID
    $asOfDate: Date
  ) {
    spcControlLimits(
      tenantId: $tenantId
      parameterCode: $parameterCode
      productId: $productId
      workCenterId: $workCenterId
      asOfDate: $asOfDate
    ) {
      id
      tenantId
      facilityId
      parameterCode
      parameterName
      chartType
      productId
      workCenterId
      materialId
      upperSpecLimit
      lowerSpecLimit
      targetValue
      upperControlLimit
      centerLine
      lowerControlLimit
      processMean
      processStdDev
      processRange
      calculationMethod
      sampleSizeUsed
      dataPeriodStart
      dataPeriodEnd
      effectiveFrom
      effectiveTo
      isActive
      recalculationFrequency
      lastRecalculatedAt
      nextRecalculationAt
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

/**
 * Query: Get all active control limits
 */
export const GET_ALL_SPC_CONTROL_LIMITS = gql`
  query GetAllSPCControlLimits($tenantId: ID!, $facilityId: ID, $isActive: Boolean) {
    spcAllControlLimits(tenantId: $tenantId, facilityId: $facilityId, isActive: $isActive) {
      id
      tenantId
      facilityId
      parameterCode
      parameterName
      chartType
      productId
      workCenterId
      materialId
      upperSpecLimit
      lowerSpecLimit
      targetValue
      upperControlLimit
      centerLine
      lowerControlLimit
      processMean
      processStdDev
      processRange
      effectiveFrom
      effectiveTo
      isActive
    }
  }
`;

/**
 * Query: Get SPC alerts
 */
export const GET_SPC_ALERTS = gql`
  query GetSPCAlerts($filter: SPCAlertFilterInput!) {
    spcAlerts(filter: $filter) {
      id
      tenantId
      facilityId
      productionRunId
      workCenterId
      productId
      alertTimestamp
      parameterCode
      parameterName
      chartType
      ruleType
      ruleDescription
      measuredValue
      controlLimitViolated
      deviationFromCenter
      sigmaLevel
      chartDataIds
      severity
      status
      acknowledgedByUserId
      acknowledgedAt
      rootCause
      correctiveAction
      resolvedByUserId
      resolvedAt
      qualityDefectId
      notificationsSent
      isSuppressed
      suppressedReason
      alertCount
      createdAt
    }
  }
`;

/**
 * Query: Get single alert by ID
 */
export const GET_SPC_ALERT = gql`
  query GetSPCAlert($id: ID!) {
    spcAlert(id: $id) {
      id
      tenantId
      facilityId
      productionRunId
      workCenterId
      productId
      alertTimestamp
      parameterCode
      parameterName
      chartType
      ruleType
      ruleDescription
      measuredValue
      controlLimitViolated
      deviationFromCenter
      sigmaLevel
      chartDataIds
      severity
      status
      acknowledgedByUserId
      acknowledgedAt
      rootCause
      correctiveAction
      resolvedByUserId
      resolvedAt
      qualityDefectId
      notificationsSent
      isSuppressed
      suppressedReason
      alertCount
      createdAt
    }
  }
`;

/**
 * Query: Get process capability analysis
 */
export const GET_SPC_PROCESS_CAPABILITY = gql`
  query GetSPCProcessCapability($input: SPCCapabilityAnalysisInput!) {
    spcProcessCapability(input: $input) {
      id
      tenantId
      facilityId
      parameterCode
      parameterName
      productId
      workCenterId
      analysisDate
      analysisPeriodStart
      analysisPeriodEnd
      upperSpecLimit
      lowerSpecLimit
      targetValue
      processMean
      processStdDev
      processStdDevWithin
      processStdDevOverall
      sampleSize
      subgroupCount
      cp
      cpk
      cpu
      cpl
      pp
      ppk
      k
      expectedPpmTotal
      expectedPpmUpper
      expectedPpmLower
      sigmaLevel
      capabilityStatus
      isCentered
      isCapable
      recommendations
      createdAt
      createdBy
    }
  }
`;

/**
 * Query: Get capability trends
 */
export const GET_SPC_CAPABILITY_TRENDS = gql`
  query GetSPCCapabilityTrends(
    $tenantId: ID!
    $facilityId: ID
    $parameterCode: String!
    $productId: ID
    $startDate: Date!
    $endDate: Date!
  ) {
    spcCapabilityTrends(
      tenantId: $tenantId
      facilityId: $facilityId
      parameterCode: $parameterCode
      productId: $productId
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      analysisDate
      cpk
      cp
      pp
      ppk
      capabilityStatus
      isCapable
    }
  }
`;

/**
 * Mutation: Record SPC measurement
 */
export const RECORD_SPC_MEASUREMENT = gql`
  mutation RecordSPCMeasurement($input: CreateSPCMeasurementInput!) {
    recordSPCMeasurement(input: $input) {
      id
      tenantId
      facilityId
      parameterCode
      parameterName
      measuredValue
      measurementTimestamp
      chartType
      dataSource
      measurementQuality
    }
  }
`;

/**
 * Mutation: Create control limits
 */
export const CREATE_SPC_CONTROL_LIMITS = gql`
  mutation CreateSPCControlLimits($input: CreateSPCControlLimitsInput!) {
    createSPCControlLimits(input: $input) {
      id
      tenantId
      facilityId
      parameterCode
      parameterName
      chartType
      upperControlLimit
      centerLine
      lowerControlLimit
      effectiveFrom
      isActive
    }
  }
`;

/**
 * Mutation: Update control limits
 */
export const UPDATE_SPC_CONTROL_LIMITS = gql`
  mutation UpdateSPCControlLimits($id: ID!, $input: UpdateSPCControlLimitsInput!) {
    updateSPCControlLimits(id: $id, input: $input) {
      id
      upperControlLimit
      centerLine
      lowerControlLimit
      isActive
      recalculationFrequency
    }
  }
`;

/**
 * Mutation: Recalculate control limits
 */
export const RECALCULATE_SPC_CONTROL_LIMITS = gql`
  mutation RecalculateSPCControlLimits(
    $tenantId: ID!
    $parameterCode: String!
    $facilityId: ID!
    $dataRangeInDays: Int
  ) {
    recalculateSPCControlLimits(
      tenantId: $tenantId
      parameterCode: $parameterCode
      facilityId: $facilityId
      dataRangeInDays: $dataRangeInDays
    ) {
      id
      parameterCode
      upperControlLimit
      centerLine
      lowerControlLimit
      lastRecalculatedAt
    }
  }
`;

/**
 * Mutation: Acknowledge SPC alert
 */
export const ACKNOWLEDGE_SPC_ALERT = gql`
  mutation AcknowledgeSPCAlert($id: ID!, $userId: ID!) {
    acknowledgeSPCAlert(id: $id, userId: $userId) {
      id
      status
      acknowledgedByUserId
      acknowledgedAt
    }
  }
`;

/**
 * Mutation: Resolve SPC alert
 */
export const RESOLVE_SPC_ALERT = gql`
  mutation ResolveSPCAlert(
    $id: ID!
    $userId: ID!
    $rootCause: String!
    $correctiveAction: String!
  ) {
    resolveSPCAlert(
      id: $id
      userId: $userId
      rootCause: $rootCause
      correctiveAction: $correctiveAction
    ) {
      id
      status
      rootCause
      correctiveAction
      resolvedByUserId
      resolvedAt
    }
  }
`;

/**
 * Mutation: Run capability analysis
 */
export const RUN_CAPABILITY_ANALYSIS = gql`
  mutation RunCapabilityAnalysis($input: SPCCapabilityAnalysisInput!) {
    runCapabilityAnalysis(input: $input) {
      id
      parameterCode
      cpk
      cp
      pp
      ppk
      capabilityStatus
      isCapable
      recommendations
    }
  }
`;
