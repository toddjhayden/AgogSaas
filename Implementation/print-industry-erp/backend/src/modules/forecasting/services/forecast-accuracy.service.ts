import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DemandHistoryService } from './demand-history.service';
import { AggregationLevel } from '../dto/forecast.types';

/**
 * FORECAST ACCURACY SERVICE
 *
 * Purpose: Track and calculate forecast accuracy metrics
 *
 * Metrics Implemented:
 * - MAPE (Mean Absolute Percentage Error)
 * - MAD (Mean Absolute Deviation)
 * - RMSE (Root Mean Squared Error)
 * - Bias (Forecast Error)
 * - Tracking Signal
 *
 * REQ: REQ-STRATEGIC-AUTO-1766718736461 - Inventory Forecasting
 */

export interface ForecastAccuracyMetrics {
  metricId: string;
  tenantId: string;
  facilityId: string;
  materialId: string;
  forecastModelId?: string;
  measurementPeriodStart: Date;
  measurementPeriodEnd: Date;
  aggregationLevel: AggregationLevel;
  mape?: number;
  rmse?: number;
  mae?: number;
  mad?: number;
  bias?: number;
  trackingSignal?: number;
  sampleSize: number;
  totalActualDemand: number;
  totalForecastedDemand: number;
  isWithinTolerance: boolean;
  targetMapeThreshold: number;
  createdAt: Date;
}

export interface CalculateAccuracyInput {
  tenantId: string;
  facilityId: string;
  materialId: string;
  periodStart: Date;
  periodEnd: Date;
  aggregationLevel?: AggregationLevel;
}

@Injectable()
export class ForecastAccuracyService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private demandHistoryService: DemandHistoryService
  ) {}

  /**
   * Calculate forecast accuracy metrics for a material
   */
  async calculateAccuracyMetrics(
    input: CalculateAccuracyInput,
    createdBy?: string
  ): Promise<ForecastAccuracyMetrics> {
    // Get historical demand with forecasts
    const demandHistory = await this.demandHistoryService.getDemandHistory(
      input.tenantId,
      input.facilityId,
      input.materialId,
      input.periodStart,
      input.periodEnd
    );

    // Filter records that have both actual and forecasted values
    const validRecords = demandHistory.filter(
      d => d.actualDemandQuantity !== undefined && d.forecastedDemandQuantity !== undefined
    );

    if (validRecords.length === 0) {
      throw new Error('No forecast data available for accuracy calculation');
    }

    // Calculate metrics
    const mape = this.calculateMAPE(validRecords);
    const mae = this.calculateMAE(validRecords);
    const mad = this.calculateMAD(validRecords);
    const rmse = this.calculateRMSE(validRecords);
    const bias = this.calculateBias(validRecords);
    const trackingSignal = this.calculateTrackingSignal(validRecords);

    const totalActual = validRecords.reduce((sum, d) => sum + d.actualDemandQuantity, 0);
    const totalForecast = validRecords.reduce((sum, d) => sum + (d.forecastedDemandQuantity || 0), 0);

    // Get target threshold from material configuration
    const targetThreshold = await this.getMaterialTargetMAPE(input.materialId);
    const isWithinTolerance = mape !== undefined && mape <= targetThreshold;

    // Store metrics in database
    const metrics = await this.insertAccuracyMetrics({
      tenantId: input.tenantId,
      facilityId: input.facilityId,
      materialId: input.materialId,
      measurementPeriodStart: input.periodStart,
      measurementPeriodEnd: input.periodEnd,
      aggregationLevel: input.aggregationLevel || AggregationLevel.DAILY,
      mape,
      rmse,
      mae,
      mad,
      bias,
      trackingSignal,
      sampleSize: validRecords.length,
      totalActualDemand: totalActual,
      totalForecastedDemand: totalForecast,
      isWithinTolerance,
      targetMapeThreshold: targetThreshold,
      createdBy
    });

    return metrics;
  }

  /**
   * Calculate MAPE (Mean Absolute Percentage Error)
   * MAPE = (1/n) × Σ |Actual - Forecast| / Actual × 100%
   *
   * Industry Benchmarks:
   * - MAPE < 10%: Excellent
   * - MAPE 10-20%: Good
   * - MAPE 20-50%: Acceptable
   * - MAPE > 50%: Poor
   */
  private calculateMAPE(records: any[]): number | undefined {
    const validRecords = records.filter(d => d.actualDemandQuantity > 0);

    if (validRecords.length === 0) {
      return undefined;
    }

    const sumPercentageErrors = validRecords.reduce((sum, d) => {
      const error = Math.abs(d.actualDemandQuantity - (d.forecastedDemandQuantity || 0));
      return sum + (error / d.actualDemandQuantity);
    }, 0);

    return (sumPercentageErrors / validRecords.length) * 100;
  }

  /**
   * Calculate MAE (Mean Absolute Error)
   * MAE = (1/n) × Σ |Actual - Forecast|
   */
  private calculateMAE(records: any[]): number {
    const sumAbsoluteErrors = records.reduce((sum, d) => {
      const error = Math.abs(d.actualDemandQuantity - (d.forecastedDemandQuantity || 0));
      return sum + error;
    }, 0);

    return sumAbsoluteErrors / records.length;
  }

  /**
   * Calculate MAD (Mean Absolute Deviation)
   * Same as MAE, but often used in different contexts
   */
  private calculateMAD(records: any[]): number {
    return this.calculateMAE(records);
  }

  /**
   * Calculate RMSE (Root Mean Squared Error)
   * RMSE = √((1/n) × Σ (Actual - Forecast)²)
   *
   * Penalizes large errors more heavily than MAE
   */
  private calculateRMSE(records: any[]): number {
    const sumSquaredErrors = records.reduce((sum, d) => {
      const error = d.actualDemandQuantity - (d.forecastedDemandQuantity || 0);
      return sum + (error * error);
    }, 0);

    const mse = sumSquaredErrors / records.length;
    return Math.sqrt(mse);
  }

  /**
   * Calculate Bias (Mean Forecast Error)
   * Bias = (1/n) × Σ (Forecast - Actual)
   *
   * Positive bias = over-forecasting
   * Negative bias = under-forecasting
   */
  private calculateBias(records: any[]): number {
    const sumErrors = records.reduce((sum, d) => {
      const error = (d.forecastedDemandQuantity || 0) - d.actualDemandQuantity;
      return sum + error;
    }, 0);

    return sumErrors / records.length;
  }

  /**
   * Calculate Tracking Signal
   * Tracking Signal = Cumulative Forecast Error / MAD
   *
   * Indicates if forecast is consistently biased
   * Threshold: |TS| > 4 indicates forecast bias issue
   */
  private calculateTrackingSignal(records: any[]): number {
    const mad = this.calculateMAD(records);

    if (mad === 0) {
      return 0;
    }

    const cumulativeError = records.reduce((sum, d) => {
      const error = (d.forecastedDemandQuantity || 0) - d.actualDemandQuantity;
      return sum + error;
    }, 0);

    return cumulativeError / mad;
  }

  /**
   * Get forecast accuracy metrics for a material
   */
  async getAccuracyMetrics(
    tenantId: string,
    facilityId: string,
    materialId: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<ForecastAccuracyMetrics[]> {
    let query = `
      SELECT
        metric_id, tenant_id, facility_id, material_id, forecast_model_id,
        measurement_period_start, measurement_period_end, aggregation_level,
        mape, rmse, mae, bias, tracking_signal,
        sample_size, total_actual_demand, total_forecasted_demand,
        is_within_tolerance, target_mape_threshold,
        created_at
      FROM forecast_accuracy_metrics
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = $3
    `;

    const values: any[] = [tenantId, facilityId, materialId];

    if (periodStart) {
      query += ` AND measurement_period_end >= $${values.length + 1}`;
      values.push(periodStart);
    }

    if (periodEnd) {
      query += ` AND measurement_period_start <= $${values.length + 1}`;
      values.push(periodEnd);
    }

    query += ` ORDER BY measurement_period_end DESC`;

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToAccuracyMetrics(row));
  }

  /**
   * Get best performing forecast method for a material
   */
  async getBestPerformingMethod(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<string | null> {
    const query = `
      SELECT
        fm.model_algorithm,
        AVG(fam.mape) as avg_mape
      FROM forecast_accuracy_metrics fam
      JOIN forecast_models fm ON fam.forecast_model_id = fm.forecast_model_id
      WHERE fam.tenant_id = $1
        AND fam.facility_id = $2
        AND fam.material_id = $3
        AND fam.measurement_period_end >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY fm.model_algorithm
      ORDER BY avg_mape ASC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [tenantId, facilityId, materialId]);

    if (result.rows.length > 0) {
      return result.rows[0].model_algorithm;
    }

    return null;
  }

  /**
   * Compare forecast methods performance
   */
  async compareForecastMethods(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<Array<{ method: string; avgMape: number; avgRmse: number; sampleSize: number }>> {
    const query = `
      SELECT
        fm.model_algorithm as method,
        AVG(fam.mape) as avg_mape,
        AVG(fam.rmse) as avg_rmse,
        SUM(fam.sample_size) as sample_size
      FROM forecast_accuracy_metrics fam
      JOIN forecast_models fm ON fam.forecast_model_id = fm.forecast_model_id
      WHERE fam.tenant_id = $1
        AND fam.facility_id = $2
        AND fam.material_id = $3
        AND fam.measurement_period_end >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY fm.model_algorithm
      ORDER BY avg_mape ASC
    `;

    const result = await this.pool.query(query, [tenantId, facilityId, materialId]);

    return result.rows.map(row => ({
      method: row.method,
      avgMape: parseFloat(row.avg_mape || 0),
      avgRmse: parseFloat(row.avg_rmse || 0),
      sampleSize: parseInt(row.sample_size || 0, 10)
    }));
  }

  /**
   * Get material target MAPE threshold
   */
  private async getMaterialTargetMAPE(materialId: string): Promise<number> {
    const query = `
      SELECT target_forecast_accuracy_pct
      FROM materials
      WHERE id = $1
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query(query, [materialId]);

    if (result.rows.length > 0 && result.rows[0].target_forecast_accuracy_pct) {
      return parseFloat(result.rows[0].target_forecast_accuracy_pct);
    }

    // Default target: 25% MAPE
    return 25.0;
  }

  /**
   * Insert accuracy metrics into database
   */
  private async insertAccuracyMetrics(data: {
    tenantId: string;
    facilityId: string;
    materialId: string;
    forecastModelId?: string;
    measurementPeriodStart: Date;
    measurementPeriodEnd: Date;
    aggregationLevel: AggregationLevel;
    mape?: number;
    rmse?: number;
    mae?: number;
    mad?: number;
    bias?: number;
    trackingSignal?: number;
    sampleSize: number;
    totalActualDemand: number;
    totalForecastedDemand: number;
    isWithinTolerance: boolean;
    targetMapeThreshold: number;
    createdBy?: string;
  }): Promise<ForecastAccuracyMetrics> {
    const query = `
      INSERT INTO forecast_accuracy_metrics (
        tenant_id, facility_id, material_id, forecast_model_id,
        measurement_period_start, measurement_period_end, aggregation_level,
        mape, rmse, mae, bias, tracking_signal,
        sample_size, total_actual_demand, total_forecasted_demand,
        is_within_tolerance, target_mape_threshold,
        created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17,
        $18
      )
      ON CONFLICT (tenant_id, facility_id, material_id, measurement_period_start, measurement_period_end, aggregation_level)
      DO UPDATE SET
        mape = EXCLUDED.mape,
        rmse = EXCLUDED.rmse,
        mae = EXCLUDED.mae,
        bias = EXCLUDED.bias,
        tracking_signal = EXCLUDED.tracking_signal,
        sample_size = EXCLUDED.sample_size,
        total_actual_demand = EXCLUDED.total_actual_demand,
        total_forecasted_demand = EXCLUDED.total_forecasted_demand,
        is_within_tolerance = EXCLUDED.is_within_tolerance,
        target_mape_threshold = EXCLUDED.target_mape_threshold
      RETURNING
        metric_id, tenant_id, facility_id, material_id, forecast_model_id,
        measurement_period_start, measurement_period_end, aggregation_level,
        mape, rmse, mae, bias, tracking_signal,
        sample_size, total_actual_demand, total_forecasted_demand,
        is_within_tolerance, target_mape_threshold,
        created_at
    `;

    const values = [
      data.tenantId,
      data.facilityId,
      data.materialId,
      data.forecastModelId,
      data.measurementPeriodStart,
      data.measurementPeriodEnd,
      data.aggregationLevel,
      data.mape,
      data.rmse,
      data.mae,
      data.bias,
      data.trackingSignal,
      data.sampleSize,
      data.totalActualDemand,
      data.totalForecastedDemand,
      data.isWithinTolerance,
      data.targetMapeThreshold,
      data.createdBy
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToAccuracyMetrics(result.rows[0]);
  }

  /**
   * Map database row to ForecastAccuracyMetrics
   */
  private mapRowToAccuracyMetrics(row: any): ForecastAccuracyMetrics {
    return {
      metricId: row.metric_id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      materialId: row.material_id,
      forecastModelId: row.forecast_model_id,
      measurementPeriodStart: row.measurement_period_start,
      measurementPeriodEnd: row.measurement_period_end,
      aggregationLevel: row.aggregation_level as AggregationLevel,
      mape: row.mape ? parseFloat(row.mape) : undefined,
      rmse: row.rmse ? parseFloat(row.rmse) : undefined,
      mae: row.mae ? parseFloat(row.mae) : undefined,
      mad: row.mae ? parseFloat(row.mae) : undefined, // MAD same as MAE
      bias: row.bias ? parseFloat(row.bias) : undefined,
      trackingSignal: row.tracking_signal ? parseFloat(row.tracking_signal) : undefined,
      sampleSize: parseInt(row.sample_size, 10),
      totalActualDemand: parseFloat(row.total_actual_demand),
      totalForecastedDemand: parseFloat(row.total_forecasted_demand),
      isWithinTolerance: row.is_within_tolerance,
      targetMapeThreshold: parseFloat(row.target_mape_threshold),
      createdAt: row.created_at
    };
  }
}
