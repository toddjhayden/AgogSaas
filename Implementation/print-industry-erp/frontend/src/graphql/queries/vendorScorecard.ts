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
