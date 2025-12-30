import { gql } from '@apollo/client';

/**
 * REQ-STRATEGIC-AUTO-1767048328662: Advanced Reporting & Business Intelligence Suite
 * GraphQL queries for analytics and reporting functionality
 */

export const GET_VENDOR_PRODUCTION_IMPACT = gql`
  query GetVendorProductionImpact($startDate: DateTime!, $endDate: DateTime!) {
    vendorProductionImpact(startDate: $startDate, endDate: $endDate) {
      vendorId
      vendorName
      materialCategory
      avgLeadTimeDays
      onTimeDeliveryRate
      qualityRejectRate
      avgProductionDowntimeHours
      productionEfficiencyImpact
      correlation
      pValue
      recommendation
    }
  }
`;

export const GET_CUSTOMER_PROFITABILITY = gql`
  query GetCustomerProfitability(
    $startDate: DateTime!
    $endDate: DateTime!
    $includeWarehouseCosts: Boolean
    $includeQualityCosts: Boolean
  ) {
    customerProfitability(
      startDate: $startDate
      endDate: $endDate
      includeWarehouseCosts: $includeWarehouseCosts
      includeQualityCosts: $includeQualityCosts
    ) {
      customerId
      customerName
      totalRevenue
      totalCosts
      grossProfit
      profitMargin
      orderCount
      avgOrderValue
      warehouseCosts
      qualityCosts
      trend
    }
  }
`;

export const GET_ORDER_CYCLE_ANALYSIS = gql`
  query GetOrderCycleAnalysis($startDate: DateTime!, $endDate: DateTime!) {
    orderCycleAnalysis(startDate: $startDate, endDate: $endDate) {
      orderId
      customerName
      orderDate
      quotingTime
      procurementTime
      productionTime
      qcTime
      shippingTime
      totalCycleTime
      bottleneckStage
      onTimeDelivery
    }
  }
`;

export const GET_MATERIAL_FLOW_ANALYSIS = gql`
  query GetMaterialFlowAnalysis($materialId: UUID, $startDate: DateTime!, $endDate: DateTime!) {
    materialFlowAnalysis(materialId: $materialId, startDate: $startDate, endDate: $endDate) {
      materialId
      materialName
      category
      vendorName
      avgLeadTimeDays
      receivedQuantity
      currentStockLevel
      warehouseTurnoverDays
      productionConsumptionRate
      forecastedDemand
      stockoutRisk
      recommendation
    }
  }
`;

export const GET_EXECUTIVE_KPI_SUMMARY = gql`
  query GetExecutiveKPISummary($period: String!) {
    executiveKPISummary(period: $period) {
      period
      financialKPIs {
        totalRevenue
        totalCosts
        netProfit
        profitMargin
        trend
      }
      operationalKPIs {
        avgCycleTime
        onTimeDeliveryRate
        productionEfficiency
        materialUtilization
        trend
      }
      vendorKPIs {
        avgLeadTime
        avgOnTimeDelivery
        avgQualityScore
        activeVendorCount
        trend
      }
      customerKPIs {
        activeCustomerCount
        avgOrderValue
        customerRetentionRate
        avgProfitMargin
        trend
      }
      forecastKPIs {
        forecastAccuracy
        stockoutRate
        excessInventoryRate
        turnoverDays
        trend
      }
    }
  }
`;

export const GET_TREND_ANALYSIS = gql`
  query GetTrendAnalysis(
    $metric: String!
    $startDate: DateTime!
    $endDate: DateTime!
    $granularity: String!
  ) {
    trendAnalysis(
      metric: $metric
      startDate: $startDate
      endDate: $endDate
      granularity: $granularity
    ) {
      metric
      dataPoints {
        timestamp
        value
      }
      avgValue
      minValue
      maxValue
      stdDev
      trend
      anomalies {
        timestamp
        value
        severity
      }
    }
  }
`;

export const EXPORT_REPORT = gql`
  mutation ExportReport($input: ExportReportInput!) {
    exportReport(input: $input) {
      jobId
      status
      reportType
      format
      downloadUrl
      expiresAt
      requestedAt
      completedAt
      errorMessage
    }
  }
`;

export const GET_EXPORT_STATUS = gql`
  query GetExportStatus($jobId: UUID!) {
    exportStatus(jobId: $jobId) {
      jobId
      status
      reportType
      format
      downloadUrl
      expiresAt
      requestedAt
      completedAt
      errorMessage
    }
  }
`;

export const CANCEL_EXPORT = gql`
  mutation CancelExport($jobId: UUID!) {
    cancelExport(jobId: $jobId)
  }
`;
