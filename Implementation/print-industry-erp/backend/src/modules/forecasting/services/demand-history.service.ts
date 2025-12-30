import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * DEMAND HISTORY SERVICE
 *
 * Purpose: Track and aggregate historical demand data for inventory forecasting
 *
 * Key Features:
 * - Record actual demand from inventory transactions (ISSUE, PRODUCTION_CONSUMPTION)
 * - Aggregate daily demand by material
 * - Backfill historical demand from inventory_transactions
 * - Calculate demand disaggregation (sales orders, production orders, transfers)
 * - Track exogenous variables (price, promotions, campaigns)
 *
 * Integration Points:
 * - WMS: Inventory transactions trigger demand recording
 * - Forecasting: Provides historical data for forecast generation
 * - Accuracy Tracking: Compares actual vs forecasted demand
 *
 * REQ: REQ-STRATEGIC-AUTO-1766675619639 - Inventory Forecasting
 */

export interface DemandHistoryRecord {
  demandHistoryId: string;
  tenantId: string;
  facilityId: string;
  materialId: string;
  demandDate: Date;
  year: number;
  month: number;
  weekOfYear: number;
  dayOfWeek: number;
  quarter: number;
  isHoliday: boolean;
  isPromotionalPeriod: boolean;
  actualDemandQuantity: number;
  forecastedDemandQuantity?: number;
  demandUom: string;
  salesOrderDemand: number;
  productionOrderDemand: number;
  transferOrderDemand: number;
  scrapAdjustment: number;
  avgUnitPrice?: number;
  promotionalDiscountPct?: number;
  marketingCampaignActive: boolean;
  forecastError?: number;
  absolutePercentageError?: number;
  createdAt: Date;
  createdBy?: string;
}

export interface RecordDemandInput {
  tenantId: string;
  facilityId: string;
  materialId: string;
  demandDate: Date;
  actualDemandQuantity: number;
  demandUom: string;
  salesOrderDemand?: number;
  productionOrderDemand?: number;
  transferOrderDemand?: number;
  scrapAdjustment?: number;
  avgUnitPrice?: number;
  promotionalDiscountPct?: number;
  marketingCampaignActive?: boolean;
}

@Injectable()
export class DemandHistoryService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Record actual demand for a material on a specific date
   * Used by WMS when inventory is consumed
   */
  async recordDemand(input: RecordDemandInput, createdBy?: string): Promise<DemandHistoryRecord> {
    const date = new Date(input.demandDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    const dayOfWeek = date.getDay();

    // Calculate week of year (ISO 8601)
    const firstDayOfYear = new Date(year, 0, 1);
    const daysSinceFirstDay = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekOfYear = Math.ceil((daysSinceFirstDay + firstDayOfYear.getDay() + 1) / 7);

    const query = `
      INSERT INTO demand_history (
        tenant_id, facility_id, material_id, demand_date,
        year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        avg_unit_price, promotional_discount_pct, marketing_campaign_active,
        created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11,
        $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20,
        $21
      )
      ON CONFLICT (tenant_id, facility_id, material_id, demand_date)
      DO UPDATE SET
        actual_demand_quantity = demand_history.actual_demand_quantity + EXCLUDED.actual_demand_quantity,
        sales_order_demand = demand_history.sales_order_demand + EXCLUDED.sales_order_demand,
        production_order_demand = demand_history.production_order_demand + EXCLUDED.production_order_demand,
        transfer_order_demand = demand_history.transfer_order_demand + EXCLUDED.transfer_order_demand,
        scrap_adjustment = demand_history.scrap_adjustment + EXCLUDED.scrap_adjustment,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.created_by
      RETURNING
        demand_history_id, tenant_id, facility_id, material_id, demand_date,
        year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, forecasted_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        avg_unit_price, promotional_discount_pct, marketing_campaign_active,
        forecast_error, absolute_percentage_error,
        created_at, created_by
    `;

    const values = [
      input.tenantId,
      input.facilityId,
      input.materialId,
      input.demandDate,
      year,
      month,
      weekOfYear,
      dayOfWeek,
      quarter,
      false, // is_holiday (would need external calendar integration)
      input.promotionalDiscountPct && input.promotionalDiscountPct > 0 ? true : false,
      input.actualDemandQuantity,
      input.demandUom,
      input.salesOrderDemand || 0,
      input.productionOrderDemand || 0,
      input.transferOrderDemand || 0,
      input.scrapAdjustment || 0,
      input.avgUnitPrice,
      input.promotionalDiscountPct,
      input.marketingCampaignActive || false,
      createdBy
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToDemandHistoryRecord(result.rows[0]);
  }

  /**
   * Get demand history for a material within a date range
   */
  async getDemandHistory(
    tenantId: string,
    facilityId: string,
    materialId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DemandHistoryRecord[]> {
    const query = `
      SELECT
        demand_history_id, tenant_id, facility_id, material_id, demand_date,
        year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, forecasted_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        avg_unit_price, promotional_discount_pct, marketing_campaign_active,
        forecast_error, absolute_percentage_error,
        created_at, created_by
      FROM demand_history
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = $3
        AND demand_date >= $4
        AND demand_date <= $5
        AND deleted_at IS NULL
      ORDER BY demand_date ASC
    `;

    const values = [tenantId, facilityId, materialId, startDate, endDate];
    const result = await this.pool.query(query, values);

    return result.rows.map(row => this.mapRowToDemandHistoryRecord(row));
  }

  /**
   * Get demand history for multiple materials in a single query (batch operation)
   * Eliminates N+1 query problem when forecasting multiple materials
   *
   * Returns a Map keyed by materialId for easy lookup
   */
  async getBatchDemandHistory(
    tenantId: string,
    facilityId: string,
    materialIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, DemandHistoryRecord[]>> {
    if (materialIds.length === 0) {
      return new Map();
    }

    const query = `
      SELECT
        demand_history_id, tenant_id, facility_id, material_id, demand_date,
        year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, forecasted_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        avg_unit_price, promotional_discount_pct, marketing_campaign_active,
        forecast_error, absolute_percentage_error,
        created_at, created_by
      FROM demand_history
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = ANY($3::UUID[])
        AND demand_date >= $4
        AND demand_date <= $5
        AND deleted_at IS NULL
      ORDER BY material_id, demand_date ASC
    `;

    const values = [tenantId, facilityId, materialIds, startDate, endDate];
    const result = await this.pool.query(query, values);

    // Group records by materialId
    const demandByMaterial = new Map<string, DemandHistoryRecord[]>();

    for (const row of result.rows) {
      const materialId = row.material_id;
      const record = this.mapRowToDemandHistoryRecord(row);

      if (!demandByMaterial.has(materialId)) {
        demandByMaterial.set(materialId, []);
      }

      demandByMaterial.get(materialId)!.push(record);
    }

    // Ensure all requested materials have an entry (even if empty)
    for (const materialId of materialIds) {
      if (!demandByMaterial.has(materialId)) {
        demandByMaterial.set(materialId, []);
      }
    }

    return demandByMaterial;
  }

  /**
   * Backfill historical demand from inventory_transactions table
   * Used for initial data population
   */
  async backfillDemandHistory(
    tenantId: string,
    facilityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const query = `
      INSERT INTO demand_history (
        tenant_id, facility_id, material_id, demand_date,
        year, month, week_of_year, day_of_week, quarter,
        is_holiday, is_promotional_period,
        actual_demand_quantity, demand_uom,
        sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
        created_by
      )
      SELECT
        it.tenant_id,
        it.facility_id,
        it.material_id,
        DATE(it.transaction_timestamp) AS demand_date,
        EXTRACT(YEAR FROM it.transaction_timestamp)::INTEGER AS year,
        EXTRACT(MONTH FROM it.transaction_timestamp)::INTEGER AS month,
        EXTRACT(WEEK FROM it.transaction_timestamp)::INTEGER AS week_of_year,
        EXTRACT(DOW FROM it.transaction_timestamp)::INTEGER AS day_of_week,
        EXTRACT(QUARTER FROM it.transaction_timestamp)::INTEGER AS quarter,
        FALSE AS is_holiday,
        FALSE AS is_promotional_period,
        SUM(ABS(it.quantity)) AS actual_demand_quantity,
        it.uom AS demand_uom,
        SUM(CASE WHEN it.transaction_type = 'ISSUE' AND it.sales_order_id IS NOT NULL THEN ABS(it.quantity) ELSE 0 END) AS sales_order_demand,
        SUM(CASE WHEN it.transaction_type = 'ISSUE' AND it.production_order_id IS NOT NULL THEN ABS(it.quantity) ELSE 0 END) AS production_order_demand,
        SUM(CASE WHEN it.transaction_type = 'TRANSFER' THEN ABS(it.quantity) ELSE 0 END) AS transfer_order_demand,
        SUM(CASE WHEN it.transaction_type = 'SCRAP' THEN ABS(it.quantity) ELSE 0 END) AS scrap_adjustment,
        'SYSTEM_BACKFILL' AS created_by
      FROM inventory_transactions it
      WHERE it.tenant_id = $1
        AND it.facility_id = $2
        AND it.transaction_type IN ('ISSUE', 'SCRAP', 'TRANSFER')
        AND it.quantity < 0  -- Only consumption (negative quantities)
        AND DATE(it.transaction_timestamp) >= $3
        AND DATE(it.transaction_timestamp) <= $4
        AND it.deleted_at IS NULL
      GROUP BY
        it.tenant_id, it.facility_id, it.material_id,
        DATE(it.transaction_timestamp),
        EXTRACT(YEAR FROM it.transaction_timestamp),
        EXTRACT(MONTH FROM it.transaction_timestamp),
        EXTRACT(WEEK FROM it.transaction_timestamp),
        EXTRACT(DOW FROM it.transaction_timestamp),
        EXTRACT(QUARTER FROM it.transaction_timestamp),
        it.uom
      ON CONFLICT (tenant_id, facility_id, material_id, demand_date)
      DO NOTHING
    `;

    const values = [tenantId, facilityId, startDate, endDate];
    const result = await this.pool.query(query, values);

    return result.rowCount || 0;
  }

  /**
   * Update forecasted demand quantity for accuracy tracking
   */
  async updateForecastedDemand(
    demandHistoryId: string,
    forecastedQuantity: number,
    updatedBy?: string
  ): Promise<void> {
    const query = `
      UPDATE demand_history
      SET
        forecasted_demand_quantity = $2,
        forecast_error = actual_demand_quantity - $2,
        absolute_percentage_error = CASE
          WHEN actual_demand_quantity > 0 THEN ABS((actual_demand_quantity - $2) / actual_demand_quantity * 100)
          ELSE NULL
        END,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $3
      WHERE demand_history_id = $1
    `;

    const values = [demandHistoryId, forecastedQuantity, updatedBy];
    await this.pool.query(query, values);
  }

  /**
   * Get aggregated demand statistics for forecasting
   */
  async getDemandStatistics(
    tenantId: string,
    facilityId: string,
    materialId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    avgDailyDemand: number;
    stdDevDemand: number;
    totalDemand: number;
    sampleSize: number;
    minDemand: number;
    maxDemand: number;
  }> {
    const query = `
      SELECT
        AVG(actual_demand_quantity) AS avg_daily_demand,
        STDDEV_POP(actual_demand_quantity) AS std_dev_demand,
        SUM(actual_demand_quantity) AS total_demand,
        COUNT(*) AS sample_size,
        MIN(actual_demand_quantity) AS min_demand,
        MAX(actual_demand_quantity) AS max_demand
      FROM demand_history
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = $3
        AND demand_date >= $4
        AND demand_date <= $5
        AND deleted_at IS NULL
    `;

    const values = [tenantId, facilityId, materialId, startDate, endDate];
    const result = await this.pool.query(query, values);

    const row = result.rows[0];
    return {
      avgDailyDemand: parseFloat(row.avg_daily_demand || 0),
      stdDevDemand: parseFloat(row.std_dev_demand || 0),
      totalDemand: parseFloat(row.total_demand || 0),
      sampleSize: parseInt(row.sample_size || 0, 10),
      minDemand: parseFloat(row.min_demand || 0),
      maxDemand: parseFloat(row.max_demand || 0)
    };
  }

  /**
   * Map database row to DemandHistoryRecord
   */
  private mapRowToDemandHistoryRecord(row: any): DemandHistoryRecord {
    return {
      demandHistoryId: row.demand_history_id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      materialId: row.material_id,
      demandDate: row.demand_date,
      year: row.year,
      month: row.month,
      weekOfYear: row.week_of_year,
      dayOfWeek: row.day_of_week,
      quarter: row.quarter,
      isHoliday: row.is_holiday,
      isPromotionalPeriod: row.is_promotional_period,
      actualDemandQuantity: parseFloat(row.actual_demand_quantity),
      forecastedDemandQuantity: row.forecasted_demand_quantity ? parseFloat(row.forecasted_demand_quantity) : undefined,
      demandUom: row.demand_uom,
      salesOrderDemand: parseFloat(row.sales_order_demand || 0),
      productionOrderDemand: parseFloat(row.production_order_demand || 0),
      transferOrderDemand: parseFloat(row.transfer_order_demand || 0),
      scrapAdjustment: parseFloat(row.scrap_adjustment || 0),
      avgUnitPrice: row.avg_unit_price ? parseFloat(row.avg_unit_price) : undefined,
      promotionalDiscountPct: row.promotional_discount_pct ? parseFloat(row.promotional_discount_pct) : undefined,
      marketingCampaignActive: row.marketing_campaign_active,
      forecastError: row.forecast_error ? parseFloat(row.forecast_error) : undefined,
      absolutePercentageError: row.absolute_percentage_error ? parseFloat(row.absolute_percentage_error) : undefined,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }
}
