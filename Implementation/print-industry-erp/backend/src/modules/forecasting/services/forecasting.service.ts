import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DemandHistoryService, DemandHistoryRecord } from './demand-history.service';
import { ForecastHorizonType, ForecastAlgorithm, ForecastStatus } from '../dto/forecast.types';

/**
 * FORECASTING SERVICE
 *
 * Purpose: Generate demand forecasts using simple statistical methods
 *
 * Algorithms Implemented (Phase 1):
 * - Moving Average (MA)
 * - Simple Exponential Smoothing (SES)
 *
 * Future Phases:
 * - Phase 2: SARIMA (via Python microservice)
 * - Phase 3: LightGBM ML (via Python microservice)
 * - Phase 4: Demand Sensing (real-time adjustments)
 *
 * REQ: REQ-STRATEGIC-AUTO-1766675619639 - Inventory Forecasting
 */

export interface MaterialForecast {
  forecastId: string;
  tenantId: string;
  facilityId: string;
  materialId: string;
  forecastModelId?: string;
  forecastGenerationTimestamp: Date;
  forecastVersion: number;
  forecastHorizonType: ForecastHorizonType;
  forecastAlgorithm: ForecastAlgorithm;
  forecastDate: Date;
  forecastYear: number;
  forecastMonth: number;
  forecastWeekOfYear: number;
  forecastedDemandQuantity: number;
  forecastUom: string;
  lowerBound80Pct?: number;
  upperBound80Pct?: number;
  lowerBound95Pct?: number;
  upperBound95Pct?: number;
  modelConfidenceScore?: number;
  isManuallyOverridden: boolean;
  manualOverrideQuantity?: number;
  manualOverrideBy?: string;
  manualOverrideReason?: string;
  forecastStatus: ForecastStatus;
  createdAt: Date;
}

export interface GenerateForecastInput {
  tenantId: string;
  facilityId: string;
  materialIds: string[];
  forecastHorizonDays: number;
  forecastAlgorithm?: 'AUTO' | 'MOVING_AVERAGE' | 'EXP_SMOOTHING' | 'HOLT_WINTERS';
}

@Injectable()
export class ForecastingService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private demandHistoryService: DemandHistoryService
  ) {}

  /**
   * Generate forecasts for materials
   * Optimized to use batch demand history fetching to eliminate N+1 query problem
   */
  async generateForecasts(
    input: GenerateForecastInput,
    createdBy?: string
  ): Promise<MaterialForecast[]> {
    const allForecasts: MaterialForecast[] = [];

    // Calculate date range (last 90 days for historical data)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    // OPTIMIZATION: Fetch demand history for all materials in a single query
    // This eliminates the N+1 query problem identified in Sylvia's critique
    const batchDemandHistory = await this.demandHistoryService.getBatchDemandHistory(
      input.tenantId,
      input.facilityId,
      input.materialIds,
      startDate,
      endDate
    );

    // Process each material using the batched data
    for (const materialId of input.materialIds) {
      const demandHistory = batchDemandHistory.get(materialId) || [];

      if (demandHistory.length < 7) {
        console.warn(`Insufficient demand history for material ${materialId} (${demandHistory.length} days), skipping`);
        continue;
      }

      // Select algorithm
      const algorithm = this.selectAlgorithm(input.forecastAlgorithm, demandHistory);

      // Generate forecast
      let forecasts: MaterialForecast[];
      if (algorithm === 'MOVING_AVERAGE') {
        forecasts = await this.generateMovingAverageForecast(
          input.tenantId,
          input.facilityId,
          materialId,
          demandHistory,
          input.forecastHorizonDays,
          createdBy
        );
      } else if (algorithm === 'HOLT_WINTERS') {
        forecasts = await this.generateHoltWintersForecast(
          input.tenantId,
          input.facilityId,
          materialId,
          demandHistory,
          input.forecastHorizonDays,
          createdBy
        );
      } else {
        forecasts = await this.generateExponentialSmoothingForecast(
          input.tenantId,
          input.facilityId,
          materialId,
          demandHistory,
          input.forecastHorizonDays,
          createdBy
        );
      }

      allForecasts.push(...forecasts);
    }

    return allForecasts;
  }

  /**
   * Select forecasting algorithm based on data characteristics
   */
  private selectAlgorithm(
    requestedAlgorithm: string | undefined,
    demandHistory: DemandHistoryRecord[]
  ): 'MOVING_AVERAGE' | 'EXP_SMOOTHING' | 'HOLT_WINTERS' {
    if (requestedAlgorithm && requestedAlgorithm !== 'AUTO') {
      return requestedAlgorithm as 'MOVING_AVERAGE' | 'EXP_SMOOTHING' | 'HOLT_WINTERS';
    }

    // Calculate coefficient of variation
    const demands = demandHistory.map(d => d.actualDemandQuantity);
    const mean = demands.reduce((sum, val) => sum + val, 0) / demands.length;
    const variance = demands.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / demands.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

    // Detect seasonality
    const hasSeasonality = this.detectSeasonality(demands);

    // If seasonal pattern detected and enough data -> use Holt-Winters
    if (hasSeasonality && demandHistory.length >= 60) {
      return 'HOLT_WINTERS';
    }

    // High variability -> use exponential smoothing (more responsive)
    // Low variability -> use moving average (more stable)
    return coefficientOfVariation > 0.3 ? 'EXP_SMOOTHING' : 'MOVING_AVERAGE';
  }

  /**
   * Simple seasonality detection using autocorrelation
   */
  private detectSeasonality(demands: number[]): boolean {
    if (demands.length < 30) return false;

    // Check for weekly seasonality (7-day cycle)
    const weeklyAutocorr = this.calculateAutocorrelation(demands, 7);

    // Check for monthly seasonality (30-day cycle)
    const monthlyAutocorr = this.calculateAutocorrelation(demands, 30);

    // If autocorrelation > 0.3 at seasonal lags, consider it seasonal
    return weeklyAutocorr > 0.3 || monthlyAutocorr > 0.3;
  }

  /**
   * Calculate autocorrelation at a given lag
   */
  private calculateAutocorrelation(series: number[], lag: number): number {
    if (lag >= series.length) return 0;

    const n = series.length - lag;
    const mean = series.reduce((sum, val) => sum + val, 0) / series.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (series[i] - mean) * (series[i + lag] - mean);
    }

    for (let i = 0; i < series.length; i++) {
      denominator += Math.pow(series[i] - mean, 2);
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Detect seasonal period by finding peak in autocorrelation function
   * Tests common periods: 7 (weekly), 30 (monthly), 90 (quarterly), 365 (yearly)
   */
  private detectSeasonalPeriod(demands: number[]): number {
    const testPeriods = [7, 30, 90, 180, 365];
    let maxAutocorr = 0;
    let bestPeriod = 7; // Default to weekly

    for (const period of testPeriods) {
      if (period < demands.length / 2) {
        const autocorr = this.calculateAutocorrelation(demands, period);
        if (autocorr > maxAutocorr) {
          maxAutocorr = autocorr;
          bestPeriod = period;
        }
      }
    }

    // If no strong seasonal pattern detected (autocorr < 0.3), use weekly as default
    if (maxAutocorr < 0.3) {
      return 7;
    }

    return bestPeriod;
  }

  /**
   * Generate forecasts using Moving Average
   */
  private async generateMovingAverageForecast(
    tenantId: string,
    facilityId: string,
    materialId: string,
    demandHistory: DemandHistoryRecord[],
    horizonDays: number,
    createdBy?: string
  ): Promise<MaterialForecast[]> {
    // Use last 30 days for MA calculation
    const windowSize = Math.min(30, demandHistory.length);
    const recentDemand = demandHistory.slice(-windowSize);
    const avgDemand = recentDemand.reduce((sum, d) => sum + d.actualDemandQuantity, 0) / windowSize;

    // Calculate standard deviation for confidence intervals
    const variance = recentDemand.reduce((sum, d) => sum + Math.pow(d.actualDemandQuantity - avgDemand, 2), 0) / windowSize;
    const stdDev = Math.sqrt(variance);

    // Get next forecast version
    const version = await this.getNextForecastVersion(tenantId, facilityId, materialId);

    // Mark previous forecasts as SUPERSEDED
    await this.supersedePreviousForecasts(tenantId, facilityId, materialId);

    const forecasts: MaterialForecast[] = [];
    const uom = demandHistory[0]?.demandUom || 'UNITS';
    const generationTimestamp = new Date();

    for (let h = 1; h <= horizonDays; h++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + h);

      // Confidence intervals widen with forecast horizon for MA
      // Error accumulates over time: σ_h = σ × √h
      const horizonStdDev = stdDev * Math.sqrt(h);

      const forecast = await this.insertForecast({
        tenantId,
        facilityId,
        materialId,
        forecastDate,
        forecastedDemandQuantity: avgDemand,
        forecastUom: uom,
        forecastAlgorithm: ForecastAlgorithm.MOVING_AVERAGE,
        forecastHorizonType: horizonDays <= 30 ? ForecastHorizonType.SHORT_TERM : ForecastHorizonType.MEDIUM_TERM,
        forecastVersion: version,
        forecastGenerationTimestamp: generationTimestamp,
        lowerBound80Pct: Math.max(0, avgDemand - 1.28 * horizonStdDev), // 80% confidence, horizon-adjusted
        upperBound80Pct: avgDemand + 1.28 * horizonStdDev,
        lowerBound95Pct: Math.max(0, avgDemand - 1.96 * horizonStdDev), // 95% confidence, horizon-adjusted
        upperBound95Pct: avgDemand + 1.96 * horizonStdDev,
        modelConfidenceScore: 0.7,
        createdBy
      });

      forecasts.push(forecast);
    }

    return forecasts;
  }

  /**
   * Generate forecasts using Simple Exponential Smoothing
   */
  private async generateExponentialSmoothingForecast(
    tenantId: string,
    facilityId: string,
    materialId: string,
    demandHistory: DemandHistoryRecord[],
    horizonDays: number,
    createdBy?: string
  ): Promise<MaterialForecast[]> {
    // Exponential smoothing parameter (alpha)
    // Higher alpha = more weight on recent data
    const alpha = 0.3;

    // Calculate smoothed forecast
    let smoothedValue = demandHistory[0].actualDemandQuantity;
    for (let i = 1; i < demandHistory.length; i++) {
      smoothedValue = alpha * demandHistory[i].actualDemandQuantity + (1 - alpha) * smoothedValue;
    }

    // Calculate MSE for confidence intervals
    let sumSquaredErrors = 0;
    let smoothed = demandHistory[0].actualDemandQuantity;
    for (let i = 1; i < demandHistory.length; i++) {
      const error = demandHistory[i].actualDemandQuantity - smoothed;
      sumSquaredErrors += error * error;
      smoothed = alpha * demandHistory[i].actualDemandQuantity + (1 - alpha) * smoothed;
    }
    const mse = sumSquaredErrors / (demandHistory.length - 1);
    const stdDev = Math.sqrt(mse);

    // Get next forecast version
    const version = await this.getNextForecastVersion(tenantId, facilityId, materialId);

    // Mark previous forecasts as SUPERSEDED
    await this.supersedePreviousForecasts(tenantId, facilityId, materialId);

    const forecasts: MaterialForecast[] = [];
    const uom = demandHistory[0]?.demandUom || 'UNITS';
    const generationTimestamp = new Date();

    for (let h = 1; h <= horizonDays; h++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + h);

      // Confidence intervals widen with forecast horizon for SES
      // Error accumulates over time: σ_h = σ × √h
      const horizonStdDev = stdDev * Math.sqrt(h);

      const forecast = await this.insertForecast({
        tenantId,
        facilityId,
        materialId,
        forecastDate,
        forecastedDemandQuantity: smoothedValue,
        forecastUom: uom,
        forecastAlgorithm: ForecastAlgorithm.EXP_SMOOTHING,
        forecastHorizonType: horizonDays <= 30 ? ForecastHorizonType.SHORT_TERM : ForecastHorizonType.MEDIUM_TERM,
        forecastVersion: version,
        forecastGenerationTimestamp: generationTimestamp,
        lowerBound80Pct: Math.max(0, smoothedValue - 1.28 * horizonStdDev), // 80% confidence, horizon-adjusted
        upperBound80Pct: smoothedValue + 1.28 * horizonStdDev,
        lowerBound95Pct: Math.max(0, smoothedValue - 1.96 * horizonStdDev), // 95% confidence, horizon-adjusted
        upperBound95Pct: smoothedValue + 1.96 * horizonStdDev,
        modelConfidenceScore: 0.75,
        createdBy
      });

      forecasts.push(forecast);
    }

    return forecasts;
  }

  /**
   * Get forecasts for a material
   */
  async getMaterialForecasts(
    tenantId: string,
    facilityId: string,
    materialId: string,
    startDate: Date,
    endDate: Date,
    forecastStatus?: ForecastStatus
  ): Promise<MaterialForecast[]> {
    let query = `
      SELECT
        forecast_id, tenant_id, facility_id, material_id, forecast_model_id,
        forecast_generation_timestamp, forecast_version, forecast_horizon_type, forecast_algorithm,
        forecast_date, forecast_year, forecast_month, forecast_week_of_year,
        forecasted_demand_quantity, forecast_uom,
        lower_bound_80_pct, upper_bound_80_pct, lower_bound_95_pct, upper_bound_95_pct,
        model_confidence_score,
        is_manually_overridden, manual_override_quantity, manual_override_by, manual_override_reason,
        forecast_status, created_at
      FROM material_forecasts
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = $3
        AND forecast_date >= $4
        AND forecast_date <= $5
        AND deleted_at IS NULL
    `;

    const values: any[] = [tenantId, facilityId, materialId, startDate, endDate];

    if (forecastStatus) {
      query += ` AND forecast_status = $6`;
      values.push(forecastStatus);
    }

    query += ` ORDER BY forecast_date ASC`;

    const result = await this.pool.query(query, values);
    return result.rows.map(row => this.mapRowToMaterialForecast(row));
  }

  /**
   * Insert a forecast record
   */
  private async insertForecast(data: {
    tenantId: string;
    facilityId: string;
    materialId: string;
    forecastDate: Date;
    forecastedDemandQuantity: number;
    forecastUom: string;
    forecastAlgorithm: ForecastAlgorithm;
    forecastHorizonType: ForecastHorizonType;
    forecastVersion: number;
    forecastGenerationTimestamp: Date;
    lowerBound80Pct?: number;
    upperBound80Pct?: number;
    lowerBound95Pct?: number;
    upperBound95Pct?: number;
    modelConfidenceScore?: number;
    createdBy?: string;
  }): Promise<MaterialForecast> {
    const date = new Date(data.forecastDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const firstDayOfYear = new Date(year, 0, 1);
    const daysSinceFirstDay = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekOfYear = Math.ceil((daysSinceFirstDay + firstDayOfYear.getDay() + 1) / 7);

    const query = `
      INSERT INTO material_forecasts (
        tenant_id, facility_id, material_id,
        forecast_generation_timestamp, forecast_version, forecast_horizon_type, forecast_algorithm,
        forecast_date, forecast_year, forecast_month, forecast_week_of_year,
        forecasted_demand_quantity, forecast_uom,
        lower_bound_80_pct, upper_bound_80_pct, lower_bound_95_pct, upper_bound_95_pct,
        model_confidence_score,
        forecast_status, created_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13,
        $14, $15, $16, $17,
        $18,
        'ACTIVE', $19
      )
      RETURNING
        forecast_id, tenant_id, facility_id, material_id, forecast_model_id,
        forecast_generation_timestamp, forecast_version, forecast_horizon_type, forecast_algorithm,
        forecast_date, forecast_year, forecast_month, forecast_week_of_year,
        forecasted_demand_quantity, forecast_uom,
        lower_bound_80_pct, upper_bound_80_pct, lower_bound_95_pct, upper_bound_95_pct,
        model_confidence_score,
        is_manually_overridden, manual_override_quantity, manual_override_by, manual_override_reason,
        forecast_status, created_at
    `;

    const values = [
      data.tenantId,
      data.facilityId,
      data.materialId,
      data.forecastGenerationTimestamp,
      data.forecastVersion,
      data.forecastHorizonType,
      data.forecastAlgorithm,
      data.forecastDate,
      year,
      month,
      weekOfYear,
      data.forecastedDemandQuantity,
      data.forecastUom,
      data.lowerBound80Pct,
      data.upperBound80Pct,
      data.lowerBound95Pct,
      data.upperBound95Pct,
      data.modelConfidenceScore,
      data.createdBy
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToMaterialForecast(result.rows[0]);
  }

  /**
   * Get next forecast version for a material
   */
  private async getNextForecastVersion(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<number> {
    const query = `
      SELECT COALESCE(MAX(forecast_version), 0) + 1 AS next_version
      FROM material_forecasts
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = $3
    `;

    const result = await this.pool.query(query, [tenantId, facilityId, materialId]);
    return parseInt(result.rows[0].next_version, 10);
  }

  /**
   * Mark previous forecasts as SUPERSEDED
   */
  private async supersedePreviousForecasts(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<void> {
    const query = `
      UPDATE material_forecasts
      SET
        forecast_status = 'SUPERSEDED',
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1
        AND facility_id = $2
        AND material_id = $3
        AND forecast_status = 'ACTIVE'
        AND forecast_date >= CURRENT_DATE
    `;

    await this.pool.query(query, [tenantId, facilityId, materialId]);
  }

  /**
   * Generate forecasts using Holt-Winters (Seasonal Exponential Smoothing)
   * Handles trend and seasonality
   */
  private async generateHoltWintersForecast(
    tenantId: string,
    facilityId: string,
    materialId: string,
    demandHistory: DemandHistoryRecord[],
    horizonDays: number,
    createdBy?: string
  ): Promise<MaterialForecast[]> {
    // Holt-Winters parameters
    const alpha = 0.2; // Level smoothing
    const beta = 0.1;  // Trend smoothing
    const gamma = 0.1; // Seasonal smoothing

    // Detect seasonal period dynamically
    const seasonalPeriod = this.detectSeasonalPeriod(demandHistory.map(d => d.actualDemandQuantity));

    if (demandHistory.length < seasonalPeriod * 2) {
      // Fall back to exponential smoothing if insufficient data
      return this.generateExponentialSmoothingForecast(
        tenantId,
        facilityId,
        materialId,
        demandHistory,
        horizonDays,
        createdBy
      );
    }

    const demands = demandHistory.map(d => d.actualDemandQuantity);

    // Calculate overall average for proper initialization
    const overallAvg = demands.reduce((sum, d) => sum + d, 0) / demands.length;

    // Initialize level, trend, and seasonal components
    let level = overallAvg;
    let trend = 0;
    const seasonal: number[] = new Array(seasonalPeriod).fill(0);

    // Initialize seasonal indices using additive decomposition
    // For each seasonal position, calculate the average deviation from the mean
    for (let s = 0; s < seasonalPeriod; s++) {
      const seasonValues: number[] = [];
      for (let i = s; i < demands.length; i += seasonalPeriod) {
        seasonValues.push(demands[i] - overallAvg); // Additive: deviation from mean
      }
      if (seasonValues.length > 0) {
        seasonal[s] = seasonValues.reduce((sum, d) => sum + d, 0) / seasonValues.length;
      }
    }

    // Fit the model (one pass through historical data) using ADDITIVE model
    for (let t = 0; t < demands.length; t++) {
      const seasonalIndex = t % seasonalPeriod;
      const deseasonalized = demands[t] - seasonal[seasonalIndex]; // Additive: subtract seasonal component

      // Update level
      const prevLevel = level;
      level = alpha * deseasonalized + (1 - alpha) * (level + trend);

      // Update trend
      trend = beta * (level - prevLevel) + (1 - beta) * trend;

      // Update seasonal component (additive model)
      seasonal[seasonalIndex] = gamma * (demands[t] - level) + (1 - gamma) * seasonal[seasonalIndex];
    }

    // Calculate MSE for confidence intervals (additive model)
    let sumSquaredErrors = 0;
    let currentLevel = overallAvg;
    let currentTrend = 0;
    const currentSeasonal = [...seasonal];

    for (let t = 1; t < demands.length; t++) {
      const seasonalIndex = t % seasonalPeriod;
      const forecast = (currentLevel + currentTrend) + currentSeasonal[seasonalIndex]; // Additive
      const error = demands[t] - forecast;
      sumSquaredErrors += error * error;

      // Update components for next iteration (additive model)
      const deseasonalized = demands[t] - currentSeasonal[seasonalIndex];
      const prevLevel = currentLevel;
      currentLevel = alpha * deseasonalized + (1 - alpha) * (currentLevel + currentTrend);
      currentTrend = beta * (currentLevel - prevLevel) + (1 - beta) * currentTrend;
      currentSeasonal[seasonalIndex] = gamma * (demands[t] - currentLevel) + (1 - gamma) * currentSeasonal[seasonalIndex];
    }

    const mse = sumSquaredErrors / (demands.length - 1);
    const stdDev = Math.sqrt(mse);

    // Get next forecast version
    const version = await this.getNextForecastVersion(tenantId, facilityId, materialId);

    // Mark previous forecasts as SUPERSEDED
    await this.supersedePreviousForecasts(tenantId, facilityId, materialId);

    const forecasts: MaterialForecast[] = [];
    const uom = demandHistory[0]?.demandUom || 'UNITS';
    const generationTimestamp = new Date();

    // Generate forecasts (additive model)
    for (let h = 1; h <= horizonDays; h++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + h);

      // Calculate forecast using additive Holt-Winters model
      // forecast[t+h] = (level_t + h × trend_t) + seasonal[(t+h) mod s]
      const seasonalIndex = (demands.length + h - 1) % seasonalPeriod;
      const forecastValue = level + (h * trend) + seasonal[seasonalIndex]; // Additive model

      const forecast = await this.insertForecast({
        tenantId,
        facilityId,
        materialId,
        forecastDate,
        forecastedDemandQuantity: Math.max(0, forecastValue), // Ensure non-negative
        forecastUom: uom,
        forecastAlgorithm: ForecastAlgorithm.HOLT_WINTERS,
        forecastHorizonType: horizonDays <= 30 ? ForecastHorizonType.SHORT_TERM : horizonDays <= 90 ? ForecastHorizonType.MEDIUM_TERM : ForecastHorizonType.LONG_TERM,
        forecastVersion: version,
        forecastGenerationTimestamp: generationTimestamp,
        lowerBound80Pct: Math.max(0, forecastValue - 1.28 * stdDev * Math.sqrt(h)),
        upperBound80Pct: forecastValue + 1.28 * stdDev * Math.sqrt(h),
        lowerBound95Pct: Math.max(0, forecastValue - 1.96 * stdDev * Math.sqrt(h)),
        upperBound95Pct: forecastValue + 1.96 * stdDev * Math.sqrt(h),
        modelConfidenceScore: 0.80,
        createdBy
      });

      forecasts.push(forecast);
    }

    return forecasts;
  }

  /**
   * Map database row to MaterialForecast
   */
  private mapRowToMaterialForecast(row: any): MaterialForecast {
    return {
      forecastId: row.forecast_id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      materialId: row.material_id,
      forecastModelId: row.forecast_model_id,
      forecastGenerationTimestamp: row.forecast_generation_timestamp,
      forecastVersion: row.forecast_version,
      forecastHorizonType: row.forecast_horizon_type as ForecastHorizonType,
      forecastAlgorithm: row.forecast_algorithm as ForecastAlgorithm,
      forecastDate: row.forecast_date,
      forecastYear: row.forecast_year,
      forecastMonth: row.forecast_month,
      forecastWeekOfYear: row.forecast_week_of_year,
      forecastedDemandQuantity: parseFloat(row.forecasted_demand_quantity),
      forecastUom: row.forecast_uom,
      lowerBound80Pct: row.lower_bound_80_pct ? parseFloat(row.lower_bound_80_pct) : undefined,
      upperBound80Pct: row.upper_bound_80_pct ? parseFloat(row.upper_bound_80_pct) : undefined,
      lowerBound95Pct: row.lower_bound_95_pct ? parseFloat(row.lower_bound_95_pct) : undefined,
      upperBound95Pct: row.upper_bound_95_pct ? parseFloat(row.upper_bound_95_pct) : undefined,
      modelConfidenceScore: row.model_confidence_score ? parseFloat(row.model_confidence_score) : undefined,
      isManuallyOverridden: row.is_manually_overridden,
      manualOverrideQuantity: row.manual_override_quantity ? parseFloat(row.manual_override_quantity) : undefined,
      manualOverrideBy: row.manual_override_by,
      manualOverrideReason: row.manual_override_reason,
      forecastStatus: row.forecast_status as ForecastStatus,
      createdAt: row.created_at
    };
  }
}
