/**
 * Equipment Health Score Service
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 *
 * Calculates real-time equipment health scores using multiple dimensions:
 * - Sensor health (temperature, vibration, etc.)
 * - OEE health (availability, performance, quality)
 * - Quality health (SPC control, defect rates)
 * - Reliability health (breakdown frequency)
 * - Performance health (cycle time degradation)
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';

export interface HealthScoreCalculation {
  workCenterId: string;
  overallHealthScore: number;
  healthStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  sensorHealthScore: number;
  oeeHealthScore: number;
  qualityHealthScore: number;
  reliabilityHealthScore: number;
  performanceHealthScore: number;
  anomalyDetected: boolean;
  trendDirection: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'RAPIDLY_DEGRADING';
  riskFactors: any[];
  recommendedAction: string;
}

@Injectable()
export class EquipmentHealthScoreService {
  private readonly logger = new Logger(EquipmentHealthScoreService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Calculate equipment health score for a work center
   */
  async calculateHealthScore(
    tenantId: string,
    facilityId: string,
    workCenterId: string,
  ): Promise<HealthScoreCalculation> {
    this.logger.log(`Calculating health score for work center ${workCenterId}`);

    // Calculate component scores
    const sensorHealth = await this.calculateSensorHealthScore(workCenterId);
    const oeeHealth = await this.calculateOEEHealthScore(workCenterId);
    const qualityHealth = await this.calculateQualityHealthScore(workCenterId);
    const reliabilityHealth = await this.calculateReliabilityHealthScore(workCenterId);
    const performanceHealth = await this.calculatePerformanceHealthScore(workCenterId);

    // Weights (sum must equal 1.00)
    const weights = {
      sensor: 0.30,
      oee: 0.25,
      quality: 0.20,
      reliability: 0.15,
      performance: 0.10,
    };

    // Calculate overall health score
    const overallScore =
      sensorHealth * weights.sensor +
      oeeHealth * weights.oee +
      qualityHealth * weights.quality +
      reliabilityHealth * weights.reliability +
      performanceHealth * weights.performance;

    // Determine health status
    const healthStatus = this.determineHealthStatus(overallScore);

    // Detect anomalies
    const anomalyDetected = sensorHealth < 60 || overallScore < 50;

    // Analyze trend
    const trendDirection = await this.analyzeTrend(workCenterId, overallScore);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors({
      sensorHealth,
      oeeHealth,
      qualityHealth,
      reliabilityHealth,
      performanceHealth,
    });

    // Determine recommended action
    const recommendedAction = this.determineRecommendedAction(
      healthStatus,
      anomalyDetected,
      trendDirection,
    );

    // Store health score
    await this.storeHealthScore(tenantId, facilityId, workCenterId, {
      overallHealthScore: overallScore,
      healthStatus,
      sensorHealthScore: sensorHealth,
      oeeHealthScore: oeeHealth,
      qualityHealthScore: qualityHealth,
      reliabilityHealthScore: reliabilityHealth,
      performanceHealthScore: performanceHealth,
      anomalyDetected,
      trendDirection,
      riskFactors,
      recommendedAction,
    });

    return {
      workCenterId,
      overallHealthScore: overallScore,
      healthStatus,
      sensorHealthScore: sensorHealth,
      oeeHealthScore: oeeHealth,
      qualityHealthScore: qualityHealth,
      reliabilityHealthScore: reliabilityHealth,
      performanceHealthScore: performanceHealth,
      anomalyDetected,
      trendDirection,
      riskFactors,
      recommendedAction,
    };
  }

  /**
   * Calculate sensor-based health score
   */
  private async calculateSensorHealthScore(workCenterId: string): Promise<number> {
    // Query recent sensor readings (last 24 hours)
    const query = `
      SELECT
        sensor_type,
        AVG(reading_value) as avg_value,
        STDDEV(reading_value) as std_dev,
        MAX(reading_value) as max_value,
        MIN(reading_value) as min_value
      FROM sensor_readings sr
      JOIN iot_devices id ON sr.iot_device_id = id.id
      WHERE id.work_center_id = $1
        AND sr.reading_timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY sensor_type
    `;

    const result = await this.db.query(query, [workCenterId]);

    if (!result.rows || result.rows.length === 0) {
      return 100; // No sensor data = assume healthy
    }

    // Define normal ranges for different sensor types
    const normalRanges: Record<string, { min: number; max: number }> = {
      TEMPERATURE: { min: 60, max: 75 }, // Fahrenheit
      VIBRATION: { min: 0, max: 2.5 }, // RMS
      PRESSURE: { min: 80, max: 120 }, // PSI
    };

    let totalScore = 0;
    let sensorCount = 0;

    for (const row of result.rows) {
      const sensorType = row.sensor_type;
      const avgValue = parseFloat(row.avg_value);
      const range = normalRanges[sensorType];

      if (!range) continue;

      // Calculate deviation from normal range
      let score = 100;
      if (avgValue < range.min) {
        const deviation = ((range.min - avgValue) / range.min) * 100;
        score = Math.max(0, 100 - deviation);
      } else if (avgValue > range.max) {
        const deviation = ((avgValue - range.max) / range.max) * 100;
        score = Math.max(0, 100 - deviation);
      }

      totalScore += score;
      sensorCount++;
    }

    return sensorCount > 0 ? totalScore / sensorCount : 100;
  }

  /**
   * Calculate OEE-based health score
   */
  private async calculateOEEHealthScore(workCenterId: string): Promise<number> {
    // Query recent OEE data (last 7 days)
    const query = `
      SELECT
        AVG(oee_percentage) as avg_oee,
        AVG(availability_percentage) as avg_availability,
        AVG(performance_percentage) as avg_performance,
        AVG(quality_percentage) as avg_quality
      FROM oee_calculations
      WHERE work_center_id = $1
        AND calculation_date > CURRENT_DATE - INTERVAL '7 days'
    `;

    const result = await this.db.query(query, [workCenterId]);

    if (!result.rows || result.rows.length === 0) {
      return 100; // No OEE data = assume healthy
    }

    const avgOEE = parseFloat(result.rows[0].avg_oee || '85');

    // OEE benchmark: 85% is world-class
    // Score based on proximity to world-class OEE
    const score = (avgOEE / 85) * 100;
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate quality-based health score
   */
  private async calculateQualityHealthScore(workCenterId: string): Promise<number> {
    // Query recent SPC alerts and defect rates
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL')) as high_alerts,
        COUNT(*) FILTER (WHERE severity IN ('LOW', 'MEDIUM')) as low_alerts
      FROM spc_out_of_control_alerts
      WHERE work_center_id = $1
        AND alert_timestamp > NOW() - INTERVAL '7 days'
        AND status IN ('OPEN', 'INVESTIGATING')
    `;

    const result = await this.db.query(query, [workCenterId]);

    if (!result.rows || result.rows.length === 0) {
      return 100; // No alerts = excellent quality
    }

    const highAlerts = parseInt(result.rows[0].high_alerts || '0');
    const lowAlerts = parseInt(result.rows[0].low_alerts || '0');

    // Penalty for alerts
    const score = 100 - (highAlerts * 10 + lowAlerts * 5);
    return Math.max(0, score);
  }

  /**
   * Calculate reliability-based health score
   */
  private async calculateReliabilityHealthScore(workCenterId: string): Promise<number> {
    // Query breakdown frequency
    const query = `
      SELECT
        COUNT(*) as breakdown_count,
        SUM(duration_minutes) as total_downtime
      FROM equipment_status_log
      WHERE work_center_id = $1
        AND status = 'NON_PRODUCTIVE_BREAKDOWN'
        AND status_start > NOW() - INTERVAL '30 days'
    `;

    const result = await this.db.query(query, [workCenterId]);

    if (!result.rows || result.rows.length === 0) {
      return 100; // No breakdowns = excellent
    }

    const breakdownCount = parseInt(result.rows[0].breakdown_count || '0');

    // Score based on breakdown frequency
    // 0 breakdowns = 100, 5+ breakdowns = 0
    const score = Math.max(0, 100 - breakdownCount * 20);
    return score;
  }

  /**
   * Calculate performance-based health score
   */
  private async calculatePerformanceHealthScore(workCenterId: string): Promise<number> {
    // Query cycle time degradation
    const query = `
      SELECT
        AVG(performance_percentage) as avg_performance
      FROM oee_calculations
      WHERE work_center_id = $1
        AND calculation_date > CURRENT_DATE - INTERVAL '7 days'
    `;

    const result = await this.db.query(query, [workCenterId]);

    if (!result.rows || result.rows.length === 0) {
      return 100; // No data = assume healthy
    }

    const avgPerformance = parseFloat(result.rows[0].avg_performance || '100');

    // Performance benchmark: 100% is perfect
    return Math.min(100, Math.max(0, avgPerformance));
  }

  /**
   * Determine health status from score
   */
  private determineHealthStatus(
    score: number,
  ): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'FAIR';
    if (score >= 30) return 'POOR';
    return 'CRITICAL';
  }

  /**
   * Analyze health score trend
   */
  private async analyzeTrend(
    workCenterId: string,
    currentScore: number,
  ): Promise<'IMPROVING' | 'STABLE' | 'DEGRADING' | 'RAPIDLY_DEGRADING'> {
    // Query historical scores
    const query = `
      SELECT overall_health_score
      FROM equipment_health_scores
      WHERE work_center_id = $1
        AND score_timestamp > NOW() - INTERVAL '7 days'
      ORDER BY score_timestamp DESC
      LIMIT 10
    `;

    const result = await this.db.query(query, [workCenterId]);

    if (!result.rows || result.rows.length < 2) {
      return 'STABLE'; // Not enough data for trend
    }

    const scores = result.rows.map((r) => parseFloat(r.overall_health_score));
    const avgPast = scores.reduce((a, b) => a + b, 0) / scores.length;

    const change = currentScore - avgPast;

    if (change > 5) return 'IMPROVING';
    if (change < -10) return 'RAPIDLY_DEGRADING';
    if (change < -5) return 'DEGRADING';
    return 'STABLE';
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(scores: {
    sensorHealth: number;
    oeeHealth: number;
    qualityHealth: number;
    reliabilityHealth: number;
    performanceHealth: number;
  }): any[] {
    const risks: any[] = [];

    if (scores.sensorHealth < 60) {
      risks.push({
        factor: 'Sensor anomalies detected',
        severity: 'HIGH',
        measuredValue: scores.sensorHealth,
        threshold: 60,
      });
    }

    if (scores.oeeHealth < 70) {
      risks.push({
        factor: 'OEE below target',
        severity: 'MEDIUM',
        measuredValue: scores.oeeHealth,
        threshold: 70,
      });
    }

    if (scores.qualityHealth < 60) {
      risks.push({
        factor: 'Quality issues detected',
        severity: 'HIGH',
        measuredValue: scores.qualityHealth,
        threshold: 60,
      });
    }

    if (scores.reliabilityHealth < 50) {
      risks.push({
        factor: 'Frequent breakdowns',
        severity: 'CRITICAL',
        measuredValue: scores.reliabilityHealth,
        threshold: 50,
      });
    }

    return risks;
  }

  /**
   * Determine recommended action
   */
  private determineRecommendedAction(
    healthStatus: string,
    anomalyDetected: boolean,
    trendDirection: string,
  ): string {
    if (healthStatus === 'CRITICAL') {
      return 'IMMEDIATE_SHUTDOWN';
    }

    if (healthStatus === 'POOR' || anomalyDetected) {
      return 'SCHEDULE_MAINTENANCE';
    }

    if (trendDirection === 'RAPIDLY_DEGRADING') {
      return 'SCHEDULE_MAINTENANCE';
    }

    if (trendDirection === 'DEGRADING') {
      return 'MONITOR_CLOSELY';
    }

    if (healthStatus === 'FAIR') {
      return 'CALIBRATION_REQUIRED';
    }

    return 'NO_ACTION_REQUIRED';
  }

  /**
   * Store health score in database
   */
  private async storeHealthScore(
    tenantId: string,
    facilityId: string,
    workCenterId: string,
    data: any,
  ): Promise<void> {
    const query = `
      INSERT INTO equipment_health_scores (
        tenant_id, facility_id, work_center_id,
        overall_health_score, health_status,
        sensor_health_score, oee_health_score,
        quality_health_score, reliability_health_score,
        performance_health_score, anomaly_detected,
        trend_direction, risk_factors, recommended_action,
        calculation_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    await this.db.query(query, [
      tenantId,
      facilityId,
      workCenterId,
      data.overallHealthScore,
      data.healthStatus,
      data.sensorHealthScore,
      data.oeeHealthScore,
      data.qualityHealthScore,
      data.reliabilityHealthScore,
      data.performanceHealthScore,
      data.anomalyDetected,
      data.trendDirection,
      JSON.stringify(data.riskFactors),
      data.recommendedAction,
      'RULE_BASED',
    ]);
  }

  /**
   * Get latest health score for a work center
   */
  async getLatestHealthScore(workCenterId: string): Promise<any> {
    const query = `
      SELECT *
      FROM equipment_health_scores
      WHERE work_center_id = $1
      ORDER BY score_timestamp DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [workCenterId]);
    return result.rows[0] || null;
  }

  /**
   * Get health score trends
   */
  async getHealthScoreTrends(
    workCenterId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const query = `
      SELECT
        score_timestamp,
        overall_health_score,
        sensor_health_score,
        oee_health_score,
        quality_health_score
      FROM equipment_health_scores
      WHERE work_center_id = $1
        AND score_timestamp BETWEEN $2 AND $3
      ORDER BY score_timestamp ASC
    `;

    const result = await this.db.query(query, [workCenterId, startDate, endDate]);
    return result.rows;
  }
}
