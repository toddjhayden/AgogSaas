import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DemandHistoryService } from './demand-history.service';
import { CalculationMethod } from '../dto/forecast.types';

/**
 * SAFETY STOCK SERVICE
 *
 * Purpose: Calculate safety stock, reorder points, and EOQ for inventory optimization
 *
 * Formulas Implemented:
 * 1. Basic Safety Stock (fixed days of supply)
 * 2. Demand Variability Safety Stock (for seasonal/promotional items)
 * 3. Lead Time Variability Safety Stock (for unreliable suppliers)
 * 4. Combined Variability Safety Stock (King's Formula - for critical materials)
 * 5. Reorder Point = (Avg Daily Demand × Avg Lead Time) + Safety Stock
 * 6. Economic Order Quantity (EOQ)
 *
 * REQ: REQ-STRATEGIC-AUTO-1766675619639 - Inventory Forecasting
 */

export interface SafetyStockCalculation {
  materialId: string;
  safetyStockQuantity: number;
  reorderPoint: number;
  economicOrderQuantity: number;
  calculationMethod: CalculationMethod;
  avgDailyDemand: number;
  demandStdDev: number;
  avgLeadTimeDays: number;
  leadTimeStdDev: number;
  serviceLevel: number;
  zScore: number;
}

@Injectable()
export class SafetyStockService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private demandHistoryService: DemandHistoryService
  ) {}

  /**
   * Calculate safety stock for a material
   * Automatically selects appropriate formula based on variability
   */
  async calculateSafetyStock(
    tenantId: string,
    facilityId: string,
    materialId: string,
    serviceLevel: number = 0.95 // 95% service level default
  ): Promise<SafetyStockCalculation> {
    // Get demand statistics (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const demandStats = await this.demandHistoryService.getDemandStatistics(
      tenantId,
      facilityId,
      materialId,
      startDate,
      endDate
    );

    // Get material info and lead time
    const materialInfo = await this.getMaterialInfo(materialId);
    const avgLeadTimeDays = materialInfo.leadTimeDays || 14;

    // Get lead time variability from vendor performance
    const leadTimeStats = await this.getLeadTimeStatistics(tenantId, materialId);

    // Calculate coefficients of variation
    const demandCV = demandStats.avgDailyDemand > 0
      ? demandStats.stdDevDemand / demandStats.avgDailyDemand
      : 0;

    const leadTimeCV = leadTimeStats.avgLeadTime > 0
      ? leadTimeStats.stdDevLeadTime / leadTimeStats.avgLeadTime
      : 0;

    // Select calculation method based on variability
    const zScore = this.getZScoreForServiceLevel(serviceLevel);
    let safetyStock: number;
    let method: CalculationMethod;

    if (demandCV < 0.2 && leadTimeCV < 0.1) {
      // Low variability -> Basic formula
      safetyStock = this.calculateBasicSafetyStock(
        demandStats.avgDailyDemand,
        materialInfo.safetyStockDays || 7
      );
      method = CalculationMethod.BASIC;
    } else if (demandCV >= 0.2 && leadTimeCV < 0.1) {
      // High demand variability, low lead time variability
      safetyStock = this.calculateDemandVariabilitySafetyStock(
        demandStats.stdDevDemand,
        avgLeadTimeDays,
        zScore
      );
      method = CalculationMethod.DEMAND_VARIABILITY;
    } else if (demandCV < 0.2 && leadTimeCV >= 0.1) {
      // Low demand variability, high lead time variability
      safetyStock = this.calculateLeadTimeVariabilitySafetyStock(
        demandStats.avgDailyDemand,
        leadTimeStats.stdDevLeadTime,
        zScore
      );
      method = CalculationMethod.LEAD_TIME_VARIABILITY;
    } else {
      // High variability in both -> King's Formula
      safetyStock = this.calculateCombinedVariabilitySafetyStock(
        demandStats.avgDailyDemand,
        demandStats.stdDevDemand,
        avgLeadTimeDays,
        leadTimeStats.stdDevLeadTime,
        zScore
      );
      method = CalculationMethod.COMBINED_VARIABILITY;
    }

    // Calculate reorder point
    const reorderPoint = this.calculateReorderPoint(
      demandStats.avgDailyDemand,
      avgLeadTimeDays,
      safetyStock
    );

    // Calculate EOQ
    const eoq = this.calculateEOQ(
      demandStats.avgDailyDemand * 365, // Annual demand
      materialInfo.standardCost || 100,
      50, // Ordering cost (default)
      0.25 // Holding cost percentage (default 25%)
    );

    return {
      materialId,
      safetyStockQuantity: Math.max(0, safetyStock),
      reorderPoint: Math.max(0, reorderPoint),
      economicOrderQuantity: Math.max(0, eoq),
      calculationMethod: method,
      avgDailyDemand: demandStats.avgDailyDemand,
      demandStdDev: demandStats.stdDevDemand,
      avgLeadTimeDays,
      leadTimeStdDev: leadTimeStats.stdDevLeadTime,
      serviceLevel,
      zScore
    };
  }

  /**
   * Basic Safety Stock (Fixed Days of Supply)
   * Use Case: C-class items, stable demand, reliable suppliers
   */
  private calculateBasicSafetyStock(
    avgDailyDemand: number,
    safetyStockDays: number
  ): number {
    return avgDailyDemand * safetyStockDays;
  }

  /**
   * Demand Variability Safety Stock
   * Use Case: Seasonal materials, promotional periods
   */
  private calculateDemandVariabilitySafetyStock(
    stdDevDemand: number,
    avgLeadTimeDays: number,
    zScore: number
  ): number {
    return zScore * stdDevDemand * Math.sqrt(avgLeadTimeDays);
  }

  /**
   * Lead Time Variability Safety Stock
   * Use Case: International suppliers, port congestion
   */
  private calculateLeadTimeVariabilitySafetyStock(
    avgDailyDemand: number,
    stdDevLeadTimeDays: number,
    zScore: number
  ): number {
    return zScore * avgDailyDemand * stdDevLeadTimeDays;
  }

  /**
   * Combined Variability Safety Stock (King's Formula)
   * Use Case: A-class items, critical materials
   */
  private calculateCombinedVariabilitySafetyStock(
    avgDailyDemand: number,
    stdDevDemand: number,
    avgLeadTimeDays: number,
    stdDevLeadTimeDays: number,
    zScore: number
  ): number {
    // King's formula: SS = Z × √((avgLT × σ²demand) + (avgDemand² × σ²LT))
    const demandVarianceComponent = avgLeadTimeDays * Math.pow(stdDevDemand, 2);
    const leadTimeVarianceComponent = Math.pow(avgDailyDemand, 2) * Math.pow(stdDevLeadTimeDays, 2);

    return zScore * Math.sqrt(demandVarianceComponent + leadTimeVarianceComponent);
  }

  /**
   * Calculate Reorder Point
   * ROP = (Average Daily Demand × Average Lead Time) + Safety Stock
   */
  private calculateReorderPoint(
    avgDailyDemand: number,
    avgLeadTimeDays: number,
    safetyStock: number
  ): number {
    const demandDuringLeadTime = avgDailyDemand * avgLeadTimeDays;
    return demandDuringLeadTime + safetyStock;
  }

  /**
   * Calculate Economic Order Quantity (EOQ)
   * EOQ = √((2 × Annual Demand × Ordering Cost) / Holding Cost per Unit per Year)
   */
  private calculateEOQ(
    annualDemand: number,
    unitCost: number,
    orderingCost: number,
    holdingCostPercentage: number
  ): number {
    const annualHoldingCostPerUnit = unitCost * holdingCostPercentage;

    if (annualHoldingCostPerUnit <= 0 || annualDemand <= 0) {
      return 0;
    }

    return Math.sqrt((2 * annualDemand * orderingCost) / annualHoldingCostPerUnit);
  }

  /**
   * Get Z-score for service level
   * Common service levels:
   * - 90% → 1.28
   * - 95% → 1.65
   * - 99% → 2.33
   */
  private getZScoreForServiceLevel(serviceLevel: number): number {
    if (serviceLevel >= 0.99) return 2.33;
    if (serviceLevel >= 0.95) return 1.65;
    if (serviceLevel >= 0.90) return 1.28;
    if (serviceLevel >= 0.85) return 1.04;
    if (serviceLevel >= 0.80) return 0.84;
    return 1.65; // Default to 95%
  }

  /**
   * Get material information
   */
  private async getMaterialInfo(materialId: string): Promise<{
    leadTimeDays: number;
    safetyStockDays: number;
    standardCost: number;
  }> {
    const query = `
      SELECT
        lead_time_days,
        standard_cost,
        COALESCE(
          (safety_stock_quantity / NULLIF(
            (SELECT AVG(actual_demand_quantity)
             FROM demand_history
             WHERE material_id = materials.id
               AND demand_date >= CURRENT_DATE - INTERVAL '90 days'
               AND deleted_at IS NULL
            ), 0
          ))::INTEGER,
          7
        ) AS safety_stock_days
      FROM materials
      WHERE id = $1
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [materialId]);
    const row = result.rows[0] || {};

    return {
      leadTimeDays: row.lead_time_days || 14,
      safetyStockDays: row.safety_stock_days || 7,
      standardCost: row.standard_cost ? parseFloat(row.standard_cost) : 100
    };
  }

  /**
   * Get lead time statistics from vendor performance
   */
  private async getLeadTimeStatistics(
    tenantId: string,
    materialId: string
  ): Promise<{
    avgLeadTime: number;
    stdDevLeadTime: number;
  }> {
    try {
      // Query actual lead times from purchase orders
      const query = `
        SELECT
          AVG(EXTRACT(EPOCH FROM (receipt_date - order_date)) / 86400) AS avg_lead_time,
          STDDEV_POP(EXTRACT(EPOCH FROM (receipt_date - order_date)) / 86400) AS std_dev_lead_time
        FROM (
          SELECT
            po.order_date,
            MIN(r.receipt_date) AS receipt_date
          FROM purchase_orders po
          JOIN purchase_order_lines pol ON po.id = pol.purchase_order_id
          LEFT JOIN receipts r ON pol.id = r.purchase_order_line_id
          WHERE po.tenant_id = $1
            AND pol.material_id = $2
            AND r.receipt_date IS NOT NULL
            AND po.order_date >= CURRENT_DATE - INTERVAL '6 months'
            AND po.deleted_at IS NULL
            AND pol.deleted_at IS NULL
          GROUP BY po.id, po.order_date
        ) lead_times
      `;

      const result = await this.pool.query(query, [tenantId, materialId]);
      const row = result.rows[0] || {};

      return {
        avgLeadTime: row.avg_lead_time ? parseFloat(row.avg_lead_time) : 14,
        stdDevLeadTime: row.std_dev_lead_time ? parseFloat(row.std_dev_lead_time) : 3
      };
    } catch (error) {
      // If receipts table doesn't exist or query fails, return default values
      console.warn('Failed to fetch lead time statistics, using defaults:', error.message);
      return {
        avgLeadTime: 14,
        stdDevLeadTime: 3
      };
    }
  }

  /**
   * Update material safety stock and reorder point
   */
  async updateMaterialPlanningParameters(
    materialId: string,
    safetyStock: number,
    reorderPoint: number,
    eoq: number,
    updatedBy?: string
  ): Promise<void> {
    const query = `
      UPDATE materials
      SET
        safety_stock_quantity = $2,
        reorder_point = $3,
        economic_order_quantity = $4,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $5
      WHERE id = $1
    `;

    await this.pool.query(query, [materialId, safetyStock, reorderPoint, eoq, updatedBy]);
  }
}
