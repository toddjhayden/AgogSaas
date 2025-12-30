import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * BIN UTILIZATION PREDICTION SERVICE
 *
 * Implements OPP-1 from REQ-STRATEGIC-AUTO-1766600259419 research:
 * Real-Time Utilization Prediction using time-series analysis
 *
 * Purpose:
 * - Forecast bin utilization trends 7, 14, 30 days ahead
 * - Identify seasonal patterns in pick velocity
 * - Enable proactive capacity planning
 * - Trigger pre-emptive re-slotting before peak seasons
 *
 * Expected Impact:
 * - 5-10% reduction in emergency re-slotting
 * - 3-7% improvement in space utilization during peak periods
 * - Proactive capacity planning capabilities
 *
 * Algorithm:
 * - Uses Simple Moving Average (SMA) for short-term trends
 * - Applies Exponential Moving Average (EMA) for weighted recent trends
 * - Detects seasonality using historical patterns
 * - Adjusts predictions based on confidence intervals
 */

interface UtilizationPrediction {
  predictionId: string;
  tenantId: string;
  facilityId: string;
  predictionDate: Date;
  predictionHorizonDays: number;
  predictedAvgUtilization: number;
  predictedLocationsOptimal: number;
  confidenceLevel: number;
  modelVersion: string;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  seasonalityDetected: boolean;
  recommendedActions: string[];
}

interface HistoricalMetric {
  metricDate: Date;
  avgUtilization: number;
  locationsOptimal: number;
}

@Injectable()
export class BinUtilizationPredictionService {
  private readonly MODEL_VERSION = 'SMA_EMA_v1.0';
  private readonly SMA_WINDOW = 7; // 7-day simple moving average
  private readonly EMA_ALPHA = 0.3; // Exponential smoothing factor
  private readonly SEASONALITY_WINDOW = 90; // 90 days for seasonal detection
  private readonly OPTIMAL_RANGE_MIN = 60;
  private readonly OPTIMAL_RANGE_MAX = 85;

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  /**
   * Generate utilization predictions for a facility
   *
   * @param facilityId - Target facility ID
   * @param tenantId - Tenant ID for multi-tenancy
   * @param horizonDays - Prediction horizons: [7, 14, 30]
   * @returns Array of predictions for each horizon
   */
  async generatePredictions(
    facilityId: string,
    tenantId: string,
    horizonDays: number[] = [7, 14, 30]
  ): Promise<UtilizationPrediction[]> {
    // 1. Fetch historical metrics (last 90 days)
    const historicalData = await this.fetchHistoricalMetrics(facilityId, tenantId);

    if (historicalData.length < this.SMA_WINDOW) {
      throw new Error(
        `Insufficient historical data for predictions. Need at least ${this.SMA_WINDOW} days, found ${historicalData.length}`
      );
    }

    // 2. Calculate trend components
    const sma = this.calculateSMA(historicalData, this.SMA_WINDOW);
    const ema = this.calculateEMA(historicalData, this.EMA_ALPHA);
    const trend = this.determineTrend(sma, ema);

    // 3. Detect seasonality
    const seasonalityDetected = this.detectSeasonality(historicalData);

    // 4. Generate predictions for each horizon
    const predictions: UtilizationPrediction[] = [];

    for (const horizon of horizonDays) {
      const prediction = await this.generatePrediction(
        facilityId,
        tenantId,
        horizon,
        historicalData,
        sma,
        ema,
        trend,
        seasonalityDetected
      );

      predictions.push(prediction);

      // 5. Store prediction in database
      await this.storePrediction(prediction);
    }

    return predictions;
  }

  /**
   * Fetch historical utilization metrics
   */
  private async fetchHistoricalMetrics(
    facilityId: string,
    tenantId: string
  ): Promise<HistoricalMetric[]> {
    const query = `
      SELECT
        DATE(metric_timestamp) as metric_date,
        AVG(avg_volume_utilization) as avg_utilization,
        AVG(locations_in_optimal_range) as locations_optimal
      FROM bin_optimization_statistical_metrics
      WHERE facility_id = $1
        AND tenant_id = $2
        AND metric_timestamp >= NOW() - INTERVAL '90 days'
      GROUP BY DATE(metric_timestamp)
      ORDER BY metric_date ASC
    `;

    const result = await this.pool.query(query, [facilityId, tenantId]);

    return result.rows.map((row) => ({
      metricDate: row.metric_date,
      avgUtilization: parseFloat(row.avg_utilization),
      locationsOptimal: parseInt(row.locations_optimal, 10),
    }));
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(data: HistoricalMetric[], window: number): number {
    const recentData = data.slice(-window);
    const sum = recentData.reduce((acc, curr) => acc + curr.avgUtilization, 0);
    return sum / recentData.length;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(data: HistoricalMetric[], alpha: number): number {
    if (data.length === 0) return 0;

    let ema = data[0].avgUtilization;

    for (let i = 1; i < data.length; i++) {
      ema = alpha * data[i].avgUtilization + (1 - alpha) * ema;
    }

    return ema;
  }

  /**
   * Determine trend direction
   */
  private determineTrend(sma: number, ema: number): 'INCREASING' | 'DECREASING' | 'STABLE' {
    const diff = ema - sma;
    const threshold = 2; // 2% threshold for trend detection

    if (diff > threshold) {
      return 'INCREASING';
    } else if (diff < -threshold) {
      return 'DECREASING';
    } else {
      return 'STABLE';
    }
  }

  /**
   * Detect seasonality using autocorrelation
   */
  private detectSeasonality(data: HistoricalMetric[]): boolean {
    if (data.length < this.SEASONALITY_WINDOW) {
      return false;
    }

    // Simple seasonality detection: Check for weekly patterns
    // Compare current week average to same week in previous periods
    const weeklyAverages: number[] = [];

    for (let i = 0; i < data.length - 7; i += 7) {
      const weekData = data.slice(i, i + 7);
      const avg = weekData.reduce((sum, d) => sum + d.avgUtilization, 0) / 7;
      weeklyAverages.push(avg);
    }

    if (weeklyAverages.length < 4) {
      return false; // Need at least 4 weeks
    }

    // Calculate variance in weekly averages
    const mean = weeklyAverages.reduce((sum, val) => sum + val, 0) / weeklyAverages.length;
    const variance =
      weeklyAverages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / weeklyAverages.length;

    // If variance is high, likely seasonal
    return variance > 25; // Threshold: 25% variance indicates seasonality
  }

  /**
   * Generate individual prediction
   */
  private async generatePrediction(
    facilityId: string,
    tenantId: string,
    horizonDays: number,
    historicalData: HistoricalMetric[],
    sma: number,
    ema: number,
    trend: 'INCREASING' | 'DECREASING' | 'STABLE',
    seasonalityDetected: boolean
  ): Promise<UtilizationPrediction> {
    // Base prediction on EMA (more weight to recent data)
    let predictedUtilization = ema;

    // Apply trend adjustment based on horizon
    const trendRate = (ema - sma) / this.SMA_WINDOW; // Daily trend rate
    const trendAdjustment = trendRate * horizonDays;

    predictedUtilization += trendAdjustment;

    // Apply seasonality adjustment if detected
    if (seasonalityDetected) {
      const seasonalAdjustment = this.calculateSeasonalAdjustment(historicalData, horizonDays);
      predictedUtilization += seasonalAdjustment;
    }

    // Clamp to reasonable bounds (0-100%)
    predictedUtilization = Math.max(0, Math.min(100, predictedUtilization));

    // Calculate confidence level (decreases with longer horizons)
    const confidenceLevel = Math.max(50, 95 - horizonDays * 1.5);

    // Estimate predicted locations in optimal range
    // Assume optimal range distribution follows historical patterns
    const historicalOptimalRate =
      historicalData.reduce((sum, d) => sum + d.locationsOptimal, 0) / historicalData.length;

    const predictedLocationsOptimal = Math.round(
      historicalOptimalRate * (predictedUtilization / ema)
    );

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(
      predictedUtilization,
      trend,
      seasonalityDetected,
      horizonDays
    );

    return {
      predictionId: crypto.randomUUID(),
      tenantId,
      facilityId,
      predictionDate: new Date(),
      predictionHorizonDays: horizonDays,
      predictedAvgUtilization: Math.round(predictedUtilization * 100) / 100,
      predictedLocationsOptimal,
      confidenceLevel: Math.round(confidenceLevel * 100) / 100,
      modelVersion: this.MODEL_VERSION,
      trend,
      seasonalityDetected,
      recommendedActions,
    };
  }

  /**
   * Calculate seasonal adjustment factor
   */
  private calculateSeasonalAdjustment(data: HistoricalMetric[], horizonDays: number): number {
    // Find same day of week pattern from history
    const targetDayOfWeek = (new Date().getDay() + horizonDays) % 7;

    const sameDayData = data.filter((d) => d.metricDate.getDay() === targetDayOfWeek);

    if (sameDayData.length < 3) {
      return 0; // Not enough data
    }

    const avg = sameDayData.reduce((sum, d) => sum + d.avgUtilization, 0) / sameDayData.length;
    const overallAvg = data.reduce((sum, d) => sum + d.avgUtilization, 0) / data.length;

    return avg - overallAvg; // Seasonal deviation
  }

  /**
   * Generate recommended actions based on predictions
   */
  private generateRecommendedActions(
    predictedUtilization: number,
    trend: string,
    seasonalityDetected: boolean,
    horizonDays: number
  ): string[] {
    const actions: string[] = [];

    // High utilization warnings
    if (predictedUtilization > this.OPTIMAL_RANGE_MAX) {
      actions.push(`ALERT: Predicted utilization (${predictedUtilization.toFixed(1)}%) exceeds optimal range. Consider capacity expansion.`);

      if (horizonDays <= 7) {
        actions.push('URGENT: Initiate emergency re-slotting within 3 days.');
      } else {
        actions.push('Plan proactive re-slotting to redistribute inventory.');
      }
    }

    // Low utilization warnings
    if (predictedUtilization < this.OPTIMAL_RANGE_MIN) {
      actions.push(`Predicted utilization (${predictedUtilization.toFixed(1)}%) below optimal range. Consider consolidation.`);
      actions.push('Evaluate bin consolidation opportunities to reduce footprint.');
    }

    // Trend-based recommendations
    if (trend === 'INCREASING') {
      actions.push('Increasing trend detected. Monitor capacity closely for next 30 days.');

      if (seasonalityDetected) {
        actions.push('Seasonal pattern detected. Pre-position high-velocity items for peak period.');
      }
    } else if (trend === 'DECREASING') {
      actions.push('Decreasing trend detected. Opportunity for consolidation and space recovery.');
    }

    // Seasonal recommendations
    if (seasonalityDetected && horizonDays >= 30) {
      actions.push('Adjust ABC classifications proactively based on seasonal forecasts.');
    }

    if (actions.length === 0) {
      actions.push('No actions required. Utilization predicted to remain in optimal range.');
    }

    return actions;
  }

  /**
   * Store prediction in database
   */
  private async storePrediction(prediction: UtilizationPrediction): Promise<void> {
    const query = `
      INSERT INTO bin_utilization_predictions (
        prediction_id,
        tenant_id,
        facility_id,
        prediction_date,
        prediction_horizon_days,
        predicted_avg_utilization,
        predicted_locations_optimal,
        confidence_level,
        model_version,
        trend,
        seasonality_detected,
        recommended_actions,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    `;

    await this.pool.query(query, [
      prediction.predictionId,
      prediction.tenantId,
      prediction.facilityId,
      prediction.predictionDate,
      prediction.predictionHorizonDays,
      prediction.predictedAvgUtilization,
      prediction.predictedLocationsOptimal,
      prediction.confidenceLevel,
      prediction.modelVersion,
      prediction.trend,
      prediction.seasonalityDetected,
      JSON.stringify(prediction.recommendedActions),
    ]);
  }

  /**
   * Get latest predictions for a facility
   */
  async getLatestPredictions(
    facilityId: string,
    tenantId: string
  ): Promise<UtilizationPrediction[]> {
    const query = `
      SELECT
        prediction_id,
        tenant_id,
        facility_id,
        prediction_date,
        prediction_horizon_days,
        predicted_avg_utilization,
        predicted_locations_optimal,
        confidence_level,
        model_version,
        trend,
        seasonality_detected,
        recommended_actions
      FROM bin_utilization_predictions
      WHERE facility_id = $1
        AND tenant_id = $2
        AND prediction_date >= NOW() - INTERVAL '1 day'
      ORDER BY prediction_date DESC, prediction_horizon_days ASC
      LIMIT 10
    `;

    const result = await this.pool.query(query, [facilityId, tenantId]);

    return result.rows.map((row) => ({
      predictionId: row.prediction_id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      predictionDate: row.prediction_date,
      predictionHorizonDays: row.prediction_horizon_days,
      predictedAvgUtilization: parseFloat(row.predicted_avg_utilization),
      predictedLocationsOptimal: row.predicted_locations_optimal,
      confidenceLevel: parseFloat(row.confidence_level),
      modelVersion: row.model_version,
      trend: row.trend,
      seasonalityDetected: row.seasonality_detected,
      recommendedActions: JSON.parse(row.recommended_actions),
    }));
  }

  /**
   * Calculate prediction accuracy by comparing past predictions to actuals
   */
  async calculatePredictionAccuracy(
    facilityId: string,
    tenantId: string,
    daysBack: number = 30
  ): Promise<{ mape: number; rmse: number; accuracy: number }> {
    // Fetch predictions made in the past that should have actual data by now
    const query = `
      WITH past_predictions AS (
        SELECT
          prediction_date,
          prediction_horizon_days,
          predicted_avg_utilization,
          prediction_date + (prediction_horizon_days || ' days')::INTERVAL as target_date
        FROM bin_utilization_predictions
        WHERE facility_id = $1
          AND tenant_id = $2
          AND prediction_date >= NOW() - INTERVAL '${daysBack} days'
          AND prediction_date + (prediction_horizon_days || ' days')::INTERVAL <= NOW()
      ),
      actuals AS (
        SELECT
          DATE(metric_timestamp) as metric_date,
          AVG(avg_volume_utilization) as actual_utilization
        FROM bin_optimization_statistical_metrics
        WHERE facility_id = $1
          AND tenant_id = $2
          AND metric_timestamp >= NOW() - INTERVAL '${daysBack} days'
        GROUP BY DATE(metric_timestamp)
      )
      SELECT
        pp.predicted_avg_utilization,
        a.actual_utilization,
        ABS(pp.predicted_avg_utilization - a.actual_utilization) as abs_error,
        POWER(pp.predicted_avg_utilization - a.actual_utilization, 2) as squared_error,
        ABS((pp.predicted_avg_utilization - a.actual_utilization) / NULLIF(a.actual_utilization, 0)) * 100 as pct_error
      FROM past_predictions pp
      JOIN actuals a ON DATE(pp.target_date) = a.metric_date
    `;

    const result = await this.pool.query(query, [facilityId, tenantId]);

    if (result.rows.length === 0) {
      return { mape: 0, rmse: 0, accuracy: 0 };
    }

    // Calculate MAPE (Mean Absolute Percentage Error)
    const mape =
      result.rows.reduce((sum, row) => sum + parseFloat(row.pct_error), 0) / result.rows.length;

    // Calculate RMSE (Root Mean Squared Error)
    const mse =
      result.rows.reduce((sum, row) => sum + parseFloat(row.squared_error), 0) / result.rows.length;
    const rmse = Math.sqrt(mse);

    // Calculate accuracy (100% - MAPE)
    const accuracy = Math.max(0, 100 - mape);

    return {
      mape: Math.round(mape * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
    };
  }
}
