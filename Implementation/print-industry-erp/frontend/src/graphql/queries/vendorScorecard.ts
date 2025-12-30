import { gql } from '@apollo/client';

// =====================================================
// VENDOR SCORECARD QUERIES
// =====================================================

export const GET_VENDOR_SCORECARD = gql`
  query GetVendorScorecard($tenantId: ID!, $vendorId: ID!) {
    vendorScorecard(tenantId: $tenantId, vendorId: $vendorId) {
      vendorId
      vendorCode
      vendorName
      currentRating

      # 12-month rolling metrics
      rollingOnTimePercentage
      rollingQualityPercentage
      rollingAvgRating

      # Trend indicators
      trendDirection
      monthsTracked

      # Recent performance
      lastMonthRating
      last3MonthsAvgRating
      last6MonthsAvgRating

      # Performance history
      monthlyPerformance {
        id
        evaluationPeriodYear
        evaluationPeriodMonth
        totalPosIssued
        totalPosValue
        onTimeDeliveries
        totalDeliveries
        onTimePercentage
        qualityAcceptances
        qualityRejections
        qualityPercentage
        priceCompetitivenessScore
        responsivenessScore
        overallRating
        notes
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_VENDOR_COMPARISON_REPORT = gql`
  query GetVendorComparisonReport(
    $tenantId: ID!
    $year: Int!
    $month: Int!
    $vendorType: VendorType
    $topN: Int
  ) {
    vendorComparisonReport(
      tenantId: $tenantId
      year: $year
      month: $month
      vendorType: $vendorType
      topN: $topN
    ) {
      evaluationPeriodYear
      evaluationPeriodMonth
      vendorType

      topPerformers {
        vendorId
        vendorCode
        vendorName
        overallRating
        onTimePercentage
        qualityPercentage
      }

      bottomPerformers {
        vendorId
        vendorCode
        vendorName
        overallRating
        onTimePercentage
        qualityPercentage
      }

      averageMetrics {
        avgOnTimePercentage
        avgQualityPercentage
        avgOverallRating
        totalVendorsEvaluated
      }
    }
  }
`;

export const GET_VENDOR_PERFORMANCE = gql`
  query GetVendorPerformance(
    $tenantId: ID!
    $vendorId: ID
    $year: Int
    $month: Int
  ) {
    vendorPerformance(
      tenantId: $tenantId
      vendorId: $vendorId
      year: $year
      month: $month
    ) {
      id
      tenantId
      vendorId
      evaluationPeriodYear
      evaluationPeriodMonth
      totalPosIssued
      totalPosValue
      onTimeDeliveries
      totalDeliveries
      onTimePercentage
      qualityAcceptances
      qualityRejections
      qualityPercentage
      priceCompetitivenessScore
      responsivenessScore
      overallRating
      notes
      createdAt
      updatedAt
    }
  }
`;

// =====================================================
// VENDOR PERFORMANCE MUTATIONS
// =====================================================

export const CALCULATE_VENDOR_PERFORMANCE = gql`
  mutation CalculateVendorPerformance(
    $tenantId: ID!
    $vendorId: ID!
    $year: Int!
    $month: Int!
  ) {
    calculateVendorPerformance(
      tenantId: $tenantId
      vendorId: $vendorId
      year: $year
      month: $month
    ) {
      id
      vendorId
      evaluationPeriodYear
      evaluationPeriodMonth
      totalPosIssued
      totalPosValue
      onTimePercentage
      qualityPercentage
      overallRating
    }
  }
`;

export const CALCULATE_ALL_VENDORS_PERFORMANCE = gql`
  mutation CalculateAllVendorsPerformance(
    $tenantId: ID!
    $year: Int!
    $month: Int!
  ) {
    calculateAllVendorsPerformance(
      tenantId: $tenantId
      year: $year
      month: $month
    ) {
      id
      vendorId
      evaluationPeriodYear
      evaluationPeriodMonth
      totalPosIssued
      totalPosValue
      onTimePercentage
      qualityPercentage
      overallRating
    }
  }
`;

export const UPDATE_VENDOR_PERFORMANCE_SCORES = gql`
  mutation UpdateVendorPerformanceScores(
    $id: ID!
    $priceCompetitivenessScore: Float
    $responsivenessScore: Float
    $notes: String
  ) {
    updateVendorPerformanceScores(
      id: $id
      priceCompetitivenessScore: $priceCompetitivenessScore
      responsivenessScore: $responsivenessScore
      notes: $notes
    ) {
      id
      priceCompetitivenessScore
      responsivenessScore
      overallRating
      notes
      updatedAt
    }
  }
`;

// =====================================================
// ENHANCED VENDOR SCORECARD (ESG + Tier Classification)
// =====================================================

export const GET_VENDOR_SCORECARD_ENHANCED = gql`
  query GetVendorScorecardEnhanced($tenantId: ID!, $vendorId: ID!) {
    getVendorScorecardEnhanced(tenantId: $tenantId, vendorId: $vendorId) {
      vendorId
      vendorCode
      vendorName
      currentRating

      # Tier classification
      vendorTier
      tierClassificationDate

      # 12-month rolling metrics
      rollingOnTimePercentage
      rollingQualityPercentage
      rollingAvgRating

      # Trend indicators
      trendDirection
      monthsTracked

      # Recent performance
      lastMonthRating
      last3MonthsAvgRating
      last6MonthsAvgRating

      # ESG metrics (if available)
      esgOverallScore
      esgRiskLevel

      # Performance history
      monthlyPerformance {
        evaluationPeriodYear
        evaluationPeriodMonth
        totalPosIssued
        totalPosValue
        onTimeDeliveries
        totalDeliveries
        onTimePercentage
        leadTimeAccuracyPercentage
        orderFulfillmentRate
        shippingDamageRate
        qualityAcceptances
        qualityRejections
        qualityPercentage
        defectRatePpm
        returnRatePercentage
        qualityAuditScore
        responsivenessScore
        responseTimeHours
        issueResolutionRate
        communicationScore
        contractCompliancePercentage
        documentationAccuracyPercentage
        priceCompetitivenessScore
        innovationScore
        totalCostOfOwnershipIndex
        paymentComplianceScore
        priceVariancePercentage
        overallRating
        vendorTier
        tierClassificationDate
        notes
      }
    }
  }
`;

export const GET_VENDOR_ESG_METRICS = gql`
  query GetVendorESGMetrics(
    $tenantId: ID!
    $vendorId: ID!
    $year: Int
    $month: Int
  ) {
    getVendorESGMetrics(
      tenantId: $tenantId
      vendorId: $vendorId
      year: $year
      month: $month
    ) {
      id
      tenantId
      vendorId
      evaluationPeriodYear
      evaluationPeriodMonth

      # Environmental metrics
      carbonFootprintTonsCO2e
      carbonFootprintTrend
      wasteReductionPercentage
      renewableEnergyPercentage
      packagingSustainabilityScore
      environmentalCertifications

      # Social metrics
      laborPracticesScore
      humanRightsComplianceScore
      diversityScore
      workerSafetyRating
      socialCertifications

      # Governance metrics
      ethicsComplianceScore
      antiCorruptionScore
      supplyChainTransparencyScore
      governanceCertifications

      # Overall ESG
      esgOverallScore
      esgRiskLevel

      # Metadata
      dataSource
      lastAuditDate
      nextAuditDueDate
      notes
    }
  }
`;

export const GET_VENDOR_SCORECARD_CONFIGS = gql`
  query GetVendorScorecardConfigs($tenantId: ID!) {
    getScorecardConfigs(tenantId: $tenantId) {
      id
      tenantId
      configName
      vendorType
      vendorTier

      # Metric weights
      qualityWeight
      deliveryWeight
      costWeight
      serviceWeight
      innovationWeight
      esgWeight

      # Thresholds
      excellentThreshold
      goodThreshold
      acceptableThreshold

      # Review frequency
      reviewFrequencyMonths

      # Versioning
      isActive
      effectiveFromDate
      effectiveToDate
    }
  }
`;

export const GET_VENDOR_PERFORMANCE_ALERTS = gql`
  query GetVendorPerformanceAlerts(
    $tenantId: ID!
    $vendorId: ID
    $alertStatus: AlertStatus
    $alertType: AlertType
    $alertCategory: AlertCategory
  ) {
    getVendorPerformanceAlerts(
      tenantId: $tenantId
      vendorId: $vendorId
      alertStatus: $alertStatus
      alertType: $alertType
      alertCategory: $alertCategory
    ) {
      id
      tenantId
      vendorId

      alertType
      alertCategory
      alertMessage
      metricValue
      thresholdValue

      alertStatus
      acknowledgedAt
      acknowledgedByUserId
      resolvedAt
      resolvedByUserId
      dismissalReason

      createdAt
      updatedAt
    }
  }
`;

// =====================================================
// ESG & CONFIG MUTATIONS
// =====================================================

export const RECORD_ESG_METRICS = gql`
  mutation RecordESGMetrics($esgMetrics: VendorESGMetricsInput!) {
    recordESGMetrics(esgMetrics: $esgMetrics) {
      id
      vendorId
      evaluationPeriodYear
      evaluationPeriodMonth
      esgOverallScore
      esgRiskLevel
    }
  }
`;

export const UPSERT_SCORECARD_CONFIG = gql`
  mutation UpsertScorecardConfig($config: ScorecardConfigInput!, $userId: ID) {
    upsertScorecardConfig(config: $config, userId: $userId) {
      id
      tenantId
      configName
      vendorType
      vendorTier
      qualityWeight
      deliveryWeight
      costWeight
      serviceWeight
      innovationWeight
      esgWeight
      excellentThreshold
      goodThreshold
      acceptableThreshold
      reviewFrequencyMonths
      isActive
      effectiveFromDate
      effectiveToDate
    }
  }
`;

export const UPDATE_VENDOR_TIER = gql`
  mutation UpdateVendorTier(
    $tenantId: ID!
    $input: VendorTierUpdateInput!
  ) {
    updateVendorTier(
      tenantId: $tenantId
      input: $input
    )
  }
`;

export const ACKNOWLEDGE_ALERT = gql`
  mutation AcknowledgeAlert($tenantId: ID!, $input: AlertAcknowledgmentInput!) {
    acknowledgeAlert(tenantId: $tenantId, input: $input) {
      id
      alertStatus
      acknowledgedAt
      acknowledgedByUserId
      updatedAt
    }
  }
`;

export const RESOLVE_ALERT = gql`
  mutation ResolveAlert($tenantId: ID!, $input: AlertResolutionInput!) {
    resolveAlert(tenantId: $tenantId, input: $input) {
      id
      alertStatus
      resolvedAt
      resolvedByUserId
      dismissalReason
      updatedAt
    }
  }
`;

export const DISMISS_ALERT = gql`
  mutation DismissAlert($tenantId: ID!, $input: AlertDismissalInput!) {
    dismissAlert(tenantId: $tenantId, input: $input) {
      id
      alertStatus
      dismissalReason
      updatedAt
    }
  }
`;
