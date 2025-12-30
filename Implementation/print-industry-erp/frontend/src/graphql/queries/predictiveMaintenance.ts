/**
 * Predictive Maintenance GraphQL Queries
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 */

import { gql } from '@apollo/client';

// ============================================
// FRAGMENTS
// ============================================

export const EQUIPMENT_HEALTH_SCORE_FRAGMENT = gql`
  fragment EquipmentHealthScoreFields on EquipmentHealthScore {
    id
    tenantId
    facilityId
    workCenterId
    scoreTimestamp
    overallHealthScore
    healthStatus
    sensorHealthScore
    oeeHealthScore
    qualityHealthScore
    reliabilityHealthScore
    performanceHealthScore
    anomalyDetected
    anomalySeverity
    anomalyType
    anomalyDescription
    healthScore7dAvg
    healthScore30dAvg
    healthScoreChange7d
    trendDirection
    riskFactors
    recommendedAction
    recommendedActionPriority
    recommendedActionDescription
    calculationMethod
    modelId
    dataQualityScore
    createdAt
  }
`;

export const PREDICTIVE_MAINTENANCE_ALERT_FRAGMENT = gql`
  fragment PredictiveMaintenanceAlertFields on PredictiveMaintenanceAlert {
    id
    tenantId
    facilityId
    workCenterId
    alertTimestamp
    alertType
    predictedFailureMode
    failureProbability
    confidenceIntervalLower
    confidenceIntervalUpper
    predictedFailureDate
    predictedFailureTimestamp
    timeToFailureHours
    timeToFailureUncertaintyHours
    rulHours
    rulConfidence
    severity
    urgency
    businessImpact
    estimatedDowntimeHours
    estimatedRepairCost
    modelId
    modelVersion
    algorithmUsed
    featureValues
    primaryIndicators
    equipmentAgeDays
    hoursSinceLastMaintenance
    totalRuntimeHours
    currentHealthScore
    recommendedAction
    recommendedMaintenanceWindow
    requiredParts
    requiredSkills
    estimatedMaintenanceDurationHours
    recommendedMaintenanceType
    detailedRecommendations
    alternativeScenarios
    status
    acknowledgedAt
    maintenanceScheduled
    scheduledMaintenanceId
    resolutionType
    actualFailureOccurred
    actualFailureDate
    predictionAccuracy
    predictionErrorHours
    resolvedAt
    resolutionNotes
    notificationsSent
    escalationLevel
    createdAt
    updatedAt
  }
`;

export const PREDICTIVE_MAINTENANCE_MODEL_FRAGMENT = gql`
  fragment PredictiveMaintenanceModelFields on PredictiveMaintenanceModel {
    id
    tenantId
    modelCode
    modelName
    modelType
    algorithm
    workCenterId
    workCenterType
    equipmentManufacturer
    equipmentModel
    failureMode
    predictionHorizonHours
    modelParameters
    featureSet
    trainingDataStart
    trainingDataEnd
    trainingSampleCount
    accuracyScore
    precisionScore
    recallScore
    f1Score
    aucRoc
    meanAbsoluteError
    falsePositiveRate
    falseNegativeRate
    modelVersion
    parentModelId
    deploymentStatus
    deployedAt
    productionAccuracy
    lastPredictionAt
    predictionCountTotal
    retrainingFrequency
    lastRetrainedAt
    nextRetrainingAt
    dataDriftDetected
    conceptDriftDetected
    description
    methodology
    featureImportance
    isActive
    createdAt
    updatedAt
  }
`;

export const MAINTENANCE_RECOMMENDATION_FRAGMENT = gql`
  fragment MaintenanceRecommendationFields on MaintenanceRecommendation {
    id
    tenantId
    facilityId
    recommendationNumber
    recommendationDate
    workCenterId
    recommendationType
    currentMaintenanceStrategy
    recommendedMaintenanceStrategy
    currentIntervalDays
    recommendedIntervalDays
    currentIntervalHours
    recommendedIntervalHours
    triggerConditions
    currentAnnualMaintenanceCost
    recommendedAnnualMaintenanceCost
    projectedCostSavings
    projectedDowntimeReductionHours
    projectedFailureReductionPercent
    roiPercentage
    paybackPeriodMonths
    riskLevel
    riskFactors
    analysisPeriodStart
    analysisPeriodEnd
    dataPointsAnalyzed
    historicalFailureCount
    historicalMaintenanceCount
    averageTimeBetweenFailuresHours
    averageTimeToRepairHours
    modelId
    optimizationAlgorithm
    implementationPriority
    implementationEffort
    requiredResources
    implementationTimelineDays
    estimatedStartDate
    approvalRequired
    approvalStatus
    approvedAt
    rejectionReason
    implementationStatus
    implementationStartedAt
    implementationCompletedAt
    actualCostSavings
    actualDowntimeReductionHours
    actualFailureReductionPercent
    resultsValidated
    validationDate
    validationNotes
    detailedAnalysis
    justification
    benefits
    risks
    alternativeRecommendations
    isActive
    createdAt
    updatedAt
  }
`;

// ============================================
// QUERIES
// ============================================

export const GET_EQUIPMENT_HEALTH_SCORES = gql`
  ${EQUIPMENT_HEALTH_SCORE_FRAGMENT}
  query GetEquipmentHealthScores(
    $workCenterId: ID
    $facilityId: ID
    $healthStatus: HealthStatus
    $trendDirection: TrendDirection
    $startDate: DateTime
    $endDate: DateTime
    $limit: Int
  ) {
    equipmentHealthScores(
      workCenterId: $workCenterId
      facilityId: $facilityId
      healthStatus: $healthStatus
      trendDirection: $trendDirection
      startDate: $startDate
      endDate: $endDate
      limit: $limit
    ) {
      ...EquipmentHealthScoreFields
    }
  }
`;

export const GET_EQUIPMENT_HEALTH_SCORE = gql`
  ${EQUIPMENT_HEALTH_SCORE_FRAGMENT}
  query GetEquipmentHealthScore($id: ID!) {
    equipmentHealthScore(id: $id) {
      ...EquipmentHealthScoreFields
    }
  }
`;

export const GET_LATEST_EQUIPMENT_HEALTH_SCORE = gql`
  ${EQUIPMENT_HEALTH_SCORE_FRAGMENT}
  query GetLatestEquipmentHealthScore($workCenterId: ID!) {
    latestEquipmentHealthScore(workCenterId: $workCenterId) {
      ...EquipmentHealthScoreFields
    }
  }
`;

export const GET_PREDICTIVE_MAINTENANCE_ALERTS = gql`
  ${PREDICTIVE_MAINTENANCE_ALERT_FRAGMENT}
  query GetPredictiveMaintenanceAlerts(
    $workCenterId: ID
    $facilityId: ID
    $status: AlertStatus
    $severity: Severity
    $urgency: Urgency
    $alertType: AlertType
    $startDate: DateTime
    $endDate: DateTime
    $limit: Int
  ) {
    predictiveMaintenanceAlerts(
      workCenterId: $workCenterId
      facilityId: $facilityId
      status: $status
      severity: $severity
      urgency: $urgency
      alertType: $alertType
      startDate: $startDate
      endDate: $endDate
      limit: $limit
    ) {
      ...PredictiveMaintenanceAlertFields
    }
  }
`;

export const GET_PREDICTIVE_MAINTENANCE_ALERT = gql`
  ${PREDICTIVE_MAINTENANCE_ALERT_FRAGMENT}
  query GetPredictiveMaintenanceAlert($id: ID!) {
    predictiveMaintenanceAlert(id: $id) {
      ...PredictiveMaintenanceAlertFields
    }
  }
`;

export const GET_PREDICTIVE_MAINTENANCE_MODELS = gql`
  ${PREDICTIVE_MAINTENANCE_MODEL_FRAGMENT}
  query GetPredictiveMaintenanceModels(
    $modelType: ModelType
    $deploymentStatus: DeploymentStatus
    $isActive: Boolean
  ) {
    predictiveMaintenanceModels(
      modelType: $modelType
      deploymentStatus: $deploymentStatus
      isActive: $isActive
    ) {
      ...PredictiveMaintenanceModelFields
    }
  }
`;

export const GET_PREDICTIVE_MAINTENANCE_MODEL = gql`
  ${PREDICTIVE_MAINTENANCE_MODEL_FRAGMENT}
  query GetPredictiveMaintenanceModel($id: ID!) {
    predictiveMaintenanceModel(id: $id) {
      ...PredictiveMaintenanceModelFields
    }
  }
`;

export const GET_MAINTENANCE_RECOMMENDATIONS = gql`
  ${MAINTENANCE_RECOMMENDATION_FRAGMENT}
  query GetMaintenanceRecommendations(
    $workCenterId: ID
    $facilityId: ID
    $recommendationType: RecommendationType
    $approvalStatus: ApprovalStatus
    $implementationStatus: ImplementationStatus
    $limit: Int
  ) {
    maintenanceRecommendations(
      workCenterId: $workCenterId
      facilityId: $facilityId
      recommendationType: $recommendationType
      approvalStatus: $approvalStatus
      implementationStatus: $implementationStatus
      limit: $limit
    ) {
      ...MaintenanceRecommendationFields
    }
  }
`;

export const GET_MAINTENANCE_RECOMMENDATION = gql`
  ${MAINTENANCE_RECOMMENDATION_FRAGMENT}
  query GetMaintenanceRecommendation($id: ID!) {
    maintenanceRecommendation(id: $id) {
      ...MaintenanceRecommendationFields
    }
  }
`;

export const GET_PREDICTIVE_MAINTENANCE_DASHBOARD = gql`
  query GetPredictiveMaintenanceDashboard($facilityId: ID, $timeRange: TimeRange) {
    predictiveMaintenanceDashboard(facilityId: $facilityId, timeRange: $timeRange) {
      tenantId
      facilityId
      totalEquipment
      equipmentByHealthStatus {
        status
        count
        percentage
      }
      averageHealthScore
      totalActiveAlerts
      alertsBySeverity {
        severity
        count
      }
      alertsByUrgency {
        urgency
        count
      }
      predictedFailuresNext7Days
      predictedFailuresNext30Days
      predictedFailuresNext90Days
      activeRecommendations
      potentialAnnualSavings
      averageRoi
      totalModelsDeployed
      averageModelAccuracy
      asOfTimestamp
    }
  }
`;

export const GET_EQUIPMENT_HEALTH_TRENDS = gql`
  query GetEquipmentHealthTrends(
    $workCenterId: ID!
    $startDate: DateTime!
    $endDate: DateTime!
    $aggregation: Aggregation
  ) {
    equipmentHealthTrends(
      workCenterId: $workCenterId
      startDate: $startDate
      endDate: $endDate
      aggregation: $aggregation
    ) {
      timestamp
      overallHealthScore
      sensorHealthScore
      oeeHealthScore
      qualityHealthScore
    }
  }
`;

export const GET_FAILURE_PREDICTION_ACCURACY = gql`
  query GetFailurePredictionAccuracy(
    $modelId: ID
    $startDate: DateTime!
    $endDate: DateTime!
  ) {
    failurePredictionAccuracy(
      modelId: $modelId
      startDate: $startDate
      endDate: $endDate
    ) {
      modelId
      modelName
      totalPredictions
      accuratePredictions
      earlyPredictions
      latePredictions
      incorrectPredictions
      accuracyPercentage
      averageErrorHours
    }
  }
`;

// ============================================
// MUTATIONS
// ============================================

export const CALCULATE_EQUIPMENT_HEALTH_SCORE = gql`
  ${EQUIPMENT_HEALTH_SCORE_FRAGMENT}
  mutation CalculateEquipmentHealthScore($workCenterId: ID!) {
    calculateEquipmentHealthScore(workCenterId: $workCenterId) {
      ...EquipmentHealthScoreFields
    }
  }
`;

export const ACKNOWLEDGE_PREDICTIVE_MAINTENANCE_ALERT = gql`
  ${PREDICTIVE_MAINTENANCE_ALERT_FRAGMENT}
  mutation AcknowledgePredictiveMaintenanceAlert($alertId: ID!, $notes: String) {
    acknowledgePredictiveMaintenanceAlert(alertId: $alertId, notes: $notes) {
      ...PredictiveMaintenanceAlertFields
    }
  }
`;

export const RESOLVE_PREDICTIVE_MAINTENANCE_ALERT = gql`
  ${PREDICTIVE_MAINTENANCE_ALERT_FRAGMENT}
  mutation ResolvePredictiveMaintenanceAlert(
    $alertId: ID!
    $resolutionType: String!
    $actualFailureOccurred: Boolean!
    $actualFailureDate: DateTime
    $notes: String
  ) {
    resolvePredictiveMaintenanceAlert(
      alertId: $alertId
      resolutionType: $resolutionType
      actualFailureOccurred: $actualFailureOccurred
      actualFailureDate: $actualFailureDate
      notes: $notes
    ) {
      ...PredictiveMaintenanceAlertFields
    }
  }
`;

export const CREATE_PREDICTIVE_MAINTENANCE_MODEL = gql`
  ${PREDICTIVE_MAINTENANCE_MODEL_FRAGMENT}
  mutation CreatePredictiveMaintenanceModel($input: CreatePredictiveMaintenanceModelInput!) {
    createPredictiveMaintenanceModel(input: $input) {
      ...PredictiveMaintenanceModelFields
    }
  }
`;

export const UPDATE_PREDICTIVE_MAINTENANCE_MODEL = gql`
  ${PREDICTIVE_MAINTENANCE_MODEL_FRAGMENT}
  mutation UpdatePredictiveMaintenanceModel(
    $id: ID!
    $input: UpdatePredictiveMaintenanceModelInput!
  ) {
    updatePredictiveMaintenanceModel(id: $id, input: $input) {
      ...PredictiveMaintenanceModelFields
    }
  }
`;

export const DEPLOY_PREDICTIVE_MAINTENANCE_MODEL = gql`
  ${PREDICTIVE_MAINTENANCE_MODEL_FRAGMENT}
  mutation DeployPredictiveMaintenanceModel($id: ID!, $environment: DeploymentStatus!) {
    deployPredictiveMaintenanceModel(id: $id, environment: $environment) {
      ...PredictiveMaintenanceModelFields
    }
  }
`;

export const RETRAIN_PREDICTIVE_MAINTENANCE_MODEL = gql`
  ${PREDICTIVE_MAINTENANCE_MODEL_FRAGMENT}
  mutation RetrainPredictiveMaintenanceModel(
    $id: ID!
    $trainingDataStart: DateTime!
    $trainingDataEnd: DateTime!
  ) {
    retrainPredictiveMaintenanceModel(
      id: $id
      trainingDataStart: $trainingDataStart
      trainingDataEnd: $trainingDataEnd
    ) {
      ...PredictiveMaintenanceModelFields
    }
  }
`;

export const CREATE_MAINTENANCE_RECOMMENDATION = gql`
  ${MAINTENANCE_RECOMMENDATION_FRAGMENT}
  mutation CreateMaintenanceRecommendation($input: CreateMaintenanceRecommendationInput!) {
    createMaintenanceRecommendation(input: $input) {
      ...MaintenanceRecommendationFields
    }
  }
`;

export const APPROVE_MAINTENANCE_RECOMMENDATION = gql`
  ${MAINTENANCE_RECOMMENDATION_FRAGMENT}
  mutation ApproveMaintenanceRecommendation($id: ID!, $notes: String) {
    approveMaintenanceRecommendation(id: $id, notes: $notes) {
      ...MaintenanceRecommendationFields
    }
  }
`;

export const REJECT_MAINTENANCE_RECOMMENDATION = gql`
  ${MAINTENANCE_RECOMMENDATION_FRAGMENT}
  mutation RejectMaintenanceRecommendation($id: ID!, $reason: String!) {
    rejectMaintenanceRecommendation(id: $id, reason: $reason) {
      ...MaintenanceRecommendationFields
    }
  }
`;

export const IMPLEMENT_MAINTENANCE_RECOMMENDATION = gql`
  ${MAINTENANCE_RECOMMENDATION_FRAGMENT}
  mutation ImplementMaintenanceRecommendation($id: ID!, $startDate: DateTime) {
    implementMaintenanceRecommendation(id: $id, startDate: $startDate) {
      ...MaintenanceRecommendationFields
    }
  }
`;

export const VALIDATE_MAINTENANCE_RECOMMENDATION = gql`
  ${MAINTENANCE_RECOMMENDATION_FRAGMENT}
  mutation ValidateMaintenanceRecommendation(
    $id: ID!
    $actualCostSavings: Float
    $actualDowntimeReductionHours: Float
    $actualFailureReductionPercent: Float
    $notes: String
  ) {
    validateMaintenanceRecommendation(
      id: $id
      actualCostSavings: $actualCostSavings
      actualDowntimeReductionHours: $actualDowntimeReductionHours
      actualFailureReductionPercent: $actualFailureReductionPercent
      notes: $notes
    ) {
      ...MaintenanceRecommendationFields
    }
  }
`;
