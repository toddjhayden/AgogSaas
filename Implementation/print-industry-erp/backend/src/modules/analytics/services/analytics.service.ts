/**
 * Analytics Service
 * Provides cross-domain analytics and aggregations
 * REQ-STRATEGIC-AUTO-1767048328662
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface VendorProductionImpact {
  vendorId: string;
  vendorName: string;
  tenantId: string;
  onTimeDeliveryPct: number;
  qualityAcceptancePct: number;
  avgLeadTimeDays: number;
  productionOEE: number;
  productionDowntimeHours: number;
  materialShortageIncidents: number;
  estimatedCostImpact: number;
  correlationCoefficient: number;
  pValue: number;
  isStatisticallySignificant: boolean;
  startDate: Date;
  endDate: Date;
  dataPoints: number;
}

export interface CustomerProfitability {
  customerId: string;
  customerName: string;
  tenantId: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  warehouseCosts: number;
  qualityCosts: number;
  shippingCosts: number;
  totalCosts: number;
  grossProfit: number;
  grossMarginPct: number;
  netProfit: number;
  netMarginPct: number;
  avgBinUtilizationPct: number;
  totalStorageDays: number;
  crossDockOpportunities: number;
  qualityIssues: number;
  returnRate: number;
  startDate: Date;
  endDate: Date;
}

export interface OrderCycleAnalysis {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  tenantId: string;
  quoteToOrderTime: number;
  orderToProductionTime: number;
  productionTime: number;
  productionToWarehouseTime: number;
  warehouseTime: number;
  shippingTime: number;
  totalCycleTime: number;
  targetCycleTime: number;
  varianceHours: number;
  variancePct: number;
  performanceRating: string;
  bottleneckStage: string;
  bottleneckDuration: number;
  bottleneckReason?: string;
  orderDate: Date;
  completionDate?: Date;
  isComplete: boolean;
}

export interface MaterialFlowAnalysis {
  materialId: string;
  materialCode: string;
  materialDescription: string;
  tenantId: string;
  avgLeadTimeDays: number;
  avgWarehouseDwellDays: number;
  avgProductionConsumptionRate: number;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  avgInventoryValue: number;
  primaryVendorId: string;
  primaryVendorName: string;
  vendorOnTimeDeliveryPct: number;
  vendorQualityPct: number;
  avgBinUtilization: number;
  putawayEfficiency: number;
  pickingEfficiency: number;
  avgMonthlyDemand: number;
  demandVariability: number;
  stockoutRisk: string;
  startDate: Date;
  endDate: Date;
}

export interface ExecutiveKPISummary {
  tenantId: string;
  facilityId?: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  grossMarginPct: number;
  avgOEE: number;
  avgBinUtilization: number;
  avgOnTimeDelivery: number;
  avgOrderCycleTime: number;
  vendorCount: number;
  avgVendorRating: number;
  criticalVendorIssues: number;
  activeCustomers: number;
  avgCustomerMargin: number;
  customerSatisfaction?: number;
  forecastAccuracyPct: number;
  stockoutRiskMaterials: number;
  excessInventoryValue: number;
  revenueTrend: number;
  oeeTrend: number;
  marginTrend: number;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface TrendAnalysis {
  metric: string;
  period: string;
  dataPoints: TimeSeriesDataPoint[];
  avgValue: number;
  minValue: number;
  maxValue: number;
  stdDev: number;
  trend: string;
  trendStrength: number;
  anomalyCount: number;
  lastAnomaly?: Date;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor() {}

  /**
   * Get vendor production impact analysis
   * Correlates vendor performance with manufacturing efficiency
   */
  async getVendorProductionImpact(
    vendorId: string,
    startDate: Date,
    endDate: Date,
    tenantId: string,
  ): Promise<VendorProductionImpact> {
    this.logger.debug(
      `Getting vendor production impact for vendor ${vendorId} from ${startDate} to ${endDate}`,
    );

    // This would query the vendor_production_impact_v view
    // For now, return mock data
    return {
      vendorId,
      vendorName: 'Sample Vendor',
      tenantId,
      onTimeDeliveryPct: 95.5,
      qualityAcceptancePct: 98.2,
      avgLeadTimeDays: 14.5,
      productionOEE: 85.3,
      productionDowntimeHours: 12.5,
      materialShortageIncidents: 2,
      estimatedCostImpact: 15000.0,
      correlationCoefficient: 0.78,
      pValue: 0.001,
      isStatisticallySignificant: true,
      startDate,
      endDate,
      dataPoints: 90,
    };
  }

  /**
   * Get customer profitability analysis
   * Includes sales, warehouse costs, and quality issues
   */
  async getCustomerProfitability(
    customerId: string,
    startDate: Date,
    endDate: Date,
    tenantId: string,
    includeWarehouseCosts: boolean = true,
    includeQualityCosts: boolean = true,
  ): Promise<CustomerProfitability> {
    this.logger.debug(
      `Getting customer profitability for customer ${customerId}`,
    );

    // This would query the customer_profitability_v view
    return {
      customerId,
      customerName: 'Sample Customer',
      tenantId,
      totalRevenue: 500000.0,
      totalOrders: 45,
      avgOrderValue: 11111.11,
      warehouseCosts: includeWarehouseCosts ? 25000.0 : 0,
      qualityCosts: includeQualityCosts ? 5000.0 : 0,
      shippingCosts: 15000.0,
      totalCosts: 350000.0,
      grossProfit: 150000.0,
      grossMarginPct: 30.0,
      netProfit: 135000.0,
      netMarginPct: 27.0,
      avgBinUtilizationPct: 75.5,
      totalStorageDays: 450,
      crossDockOpportunities: 12,
      qualityIssues: 3,
      returnRate: 0.67,
      startDate,
      endDate,
    };
  }

  /**
   * Get order cycle time analysis
   * Tracks order from entry through production, warehouse, and shipping
   */
  async getOrderCycleAnalysis(
    orderId: string,
    tenantId: string,
  ): Promise<OrderCycleAnalysis> {
    this.logger.debug(`Getting order cycle analysis for order ${orderId}`);

    // This would query the order_cycle_analysis_v view
    return {
      orderId,
      orderNumber: 'SO-2025-001',
      customerId: 'customer-123',
      customerName: 'Sample Customer',
      tenantId,
      quoteToOrderTime: 48.0,
      orderToProductionTime: 24.0,
      productionTime: 72.0,
      productionToWarehouseTime: 4.0,
      warehouseTime: 12.0,
      shippingTime: 24.0,
      totalCycleTime: 184.0,
      targetCycleTime: 168.0,
      varianceHours: 16.0,
      variancePct: 9.5,
      performanceRating: 'GOOD',
      bottleneckStage: 'Production',
      bottleneckDuration: 72.0,
      bottleneckReason: 'Equipment changeover time',
      orderDate: new Date('2025-01-01'),
      completionDate: new Date('2025-01-08'),
      isComplete: true,
    };
  }

  /**
   * Get material flow analysis
   * Tracks material from vendor through warehouse to production
   */
  async getMaterialFlowAnalysis(
    materialId: string,
    startDate: Date,
    endDate: Date,
    tenantId: string,
  ): Promise<MaterialFlowAnalysis> {
    this.logger.debug(`Getting material flow analysis for material ${materialId}`);

    // This would query the material_flow_analysis_v view
    return {
      materialId,
      materialCode: 'MAT-001',
      materialDescription: 'Sample Material',
      tenantId,
      avgLeadTimeDays: 14.5,
      avgWarehouseDwellDays: 7.2,
      avgProductionConsumptionRate: 100.5,
      currentStock: 5000.0,
      safetyStock: 1500.0,
      reorderPoint: 2000.0,
      avgInventoryValue: 75000.0,
      primaryVendorId: 'vendor-123',
      primaryVendorName: 'Primary Vendor',
      vendorOnTimeDeliveryPct: 96.5,
      vendorQualityPct: 98.0,
      avgBinUtilization: 72.5,
      putawayEfficiency: 95.0,
      pickingEfficiency: 97.5,
      avgMonthlyDemand: 3000.0,
      demandVariability: 15.5,
      stockoutRisk: 'LOW',
      startDate,
      endDate,
    };
  }

  /**
   * Get executive KPI summary
   */
  async getExecutiveKPISummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    facilityId?: string,
  ): Promise<ExecutiveKPISummary> {
    this.logger.debug(`Getting executive KPI summary for tenant ${tenantId}`);

    // This would aggregate data from multiple sources
    return {
      tenantId,
      facilityId,
      periodStart: startDate,
      periodEnd: endDate,
      totalRevenue: 2500000.0,
      totalCosts: 1750000.0,
      grossProfit: 750000.0,
      grossMarginPct: 30.0,
      avgOEE: 82.5,
      avgBinUtilization: 75.8,
      avgOnTimeDelivery: 94.5,
      avgOrderCycleTime: 156.0,
      vendorCount: 45,
      avgVendorRating: 4.2,
      criticalVendorIssues: 3,
      activeCustomers: 120,
      avgCustomerMargin: 28.5,
      customerSatisfaction: 4.5,
      forecastAccuracyPct: 87.5,
      stockoutRiskMaterials: 5,
      excessInventoryValue: 150000.0,
      revenueTrend: 5.5,
      oeeTrend: 2.3,
      marginTrend: -0.5,
    };
  }

  /**
   * Get trend analysis for a metric
   */
  async getTrendAnalysis(
    metric: string,
    period: string,
    startDate: Date,
    endDate: Date,
    tenantId: string,
    facilityId?: string,
  ): Promise<TrendAnalysis> {
    this.logger.debug(`Getting trend analysis for metric ${metric}`);

    // This would query time-series data and perform statistical analysis
    const dataPoints: TimeSeriesDataPoint[] = [];
    const daysDiff = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Generate mock data points
    for (let i = 0; i <= daysDiff; i++) {
      const timestamp = new Date(startDate);
      timestamp.setDate(timestamp.getDate() + i);
      dataPoints.push({
        timestamp,
        value: 80 + Math.random() * 20,
        label: timestamp.toISOString().split('T')[0],
      });
    }

    const values = dataPoints.map((dp) => dp.value);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Calculate standard deviation
    const squareDiffs = values.map((value) => Math.pow(value - avgValue, 2));
    const avgSquareDiff =
      squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    return {
      metric,
      period,
      dataPoints,
      avgValue,
      minValue,
      maxValue,
      stdDev,
      trend: 'STABLE',
      trendStrength: 0.15,
      anomalyCount: 0,
    };
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
      return 0;
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate p-value for correlation (simplified)
   */
  private calculatePValue(r: number, n: number): number {
    // Fisher transformation for correlation coefficient
    // Simplified p-value calculation
    const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
    // This is a simplified approximation
    return Math.abs(t) > 2.0 ? 0.001 : 0.05;
  }
}
