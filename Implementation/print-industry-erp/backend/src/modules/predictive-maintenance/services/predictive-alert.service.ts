/**
 * Predictive Maintenance Alert Service
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 *
 * Generates and manages AI-driven predictive maintenance alerts
 * based on equipment health scores and ML model predictions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';

export interface PredictiveAlert {
  id: string;
  workCenterId: string;
  alertType: string;
  predictedFailureMode: string;
  failureProbability: number;
  timeToFailureHours: number;
  severity: string;
  urgency: string;
  recommendedAction: string;
}

@Injectable()
export class PredictiveAlertService {
  private readonly logger = new Logger(PredictiveAlertService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Generate predictive maintenance alert based on health score
   */
  async generateAlertFromHealthScore(
    tenantId: string,
    facilityId: string,
    workCenterId: string,
    healthScore: number,
    riskFactors: any[],
  ): Promise<PredictiveAlert | null> {
    this.logger.log(`Generating alert for work center ${workCenterId}, health score: ${healthScore}`);

    // Only generate alerts for concerning health scores
    if (healthScore > 70) {
      return null; // Equipment is healthy, no alert needed
    }

    // Determine alert characteristics
    const alertType = this.determineAlertType(healthScore, riskFactors);
    const severity = this.determineSeverity(healthScore);
    const urgency = this.determineUrgency(healthScore);
    const failureProbability = this.estimateFailureProbability(healthScore);
    const timeToFailure = this.estimateTimeToFailure(healthScore);
    const predictedFailureMode = this.predictFailureMode(riskFactors);

    // Get model ID (use rule-based model for now)
    const modelId = await this.getRuleBasedModelId(tenantId);

    if (!modelId) {
      this.logger.warn('No predictive maintenance model found');
      return null;
    }

    // Create alert
    const alertId = await this.createAlert({
      tenantId,
      facilityId,
      workCenterId,
      alertType,
      predictedFailureMode,
      failureProbability,
      timeToFailureHours: timeToFailure,
      severity,
      urgency,
      modelId,
      currentHealthScore: healthScore,
    });

    return {
      id: alertId,
      workCenterId,
      alertType,
      predictedFailureMode,
      failureProbability,
      timeToFailureHours: timeToFailure,
      severity,
      urgency,
      recommendedAction: this.getRecommendedAction(urgency, timeToFailure),
    };
  }

  /**
   * Determine alert type based on health score and risk factors
   */
  private determineAlertType(healthScore: number, riskFactors: any[]): string {
    if (healthScore < 30) {
      return 'FAILURE_PREDICTION';
    }

    if (riskFactors.some((r) => r.factor.includes('anomal'))) {
      return 'ANOMALY_DETECTED';
    }

    if (healthScore < 50) {
      return 'DEGRADATION_TREND';
    }

    return 'PERFORMANCE_DECLINE';
  }

  /**
   * Determine severity based on health score
   */
  private determineSeverity(healthScore: number): string {
    if (healthScore < 30) return 'CRITICAL';
    if (healthScore < 50) return 'HIGH';
    if (healthScore < 70) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Determine urgency based on health score
   */
  private determineUrgency(healthScore: number): string {
    if (healthScore < 30) return 'IMMEDIATE';
    if (healthScore < 40) return 'URGENT';
    if (healthScore < 60) return 'SOON';
    return 'ROUTINE';
  }

  /**
   * Estimate failure probability
   */
  private estimateFailureProbability(healthScore: number): number {
    // Simple rule-based estimation
    // In production, this would use ML model predictions
    return Math.max(0, Math.min(1, (100 - healthScore) / 100));
  }

  /**
   * Estimate time to failure in hours
   */
  private estimateTimeToFailure(healthScore: number): number {
    // Simple rule-based estimation
    // Lower health score = less time until failure
    if (healthScore < 30) return 24; // 1 day
    if (healthScore < 40) return 72; // 3 days
    if (healthScore < 50) return 168; // 7 days
    if (healthScore < 60) return 336; // 14 days
    return 720; // 30 days
  }

  /**
   * Predict failure mode from risk factors
   */
  private predictFailureMode(riskFactors: any[]): string {
    if (riskFactors.some((r) => r.factor.includes('temperature') || r.factor.includes('Sensor'))) {
      return 'BEARING_FAILURE';
    }

    if (riskFactors.some((r) => r.factor.includes('vibration'))) {
      return 'MOTOR_FAILURE';
    }

    if (riskFactors.some((r) => r.factor.includes('Quality') || r.factor.includes('quality'))) {
      return 'CALIBRATION_DRIFT';
    }

    if (riskFactors.some((r) => r.factor.includes('breakdown'))) {
      return 'MECHANICAL_FAILURE';
    }

    return 'GENERAL_DEGRADATION';
  }

  /**
   * Get rule-based model ID
   */
  private async getRuleBasedModelId(tenantId: string): Promise<string | null> {
    const query = `
      SELECT id
      FROM predictive_maintenance_models
      WHERE tenant_id = $1
        AND model_type = 'ANOMALY_DETECTION'
        AND deployment_status = 'PRODUCTION'
        AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [tenantId]);

    if (result.rows && result.rows.length > 0) {
      return result.rows[0].id;
    }

    return null;
  }

  /**
   * Create alert in database
   */
  private async createAlert(data: {
    tenantId: string;
    facilityId: string;
    workCenterId: string;
    alertType: string;
    predictedFailureMode: string;
    failureProbability: number;
    timeToFailureHours: number;
    severity: string;
    urgency: string;
    modelId: string;
    currentHealthScore: number;
  }): Promise<string> {
    const query = `
      INSERT INTO predictive_maintenance_alerts (
        tenant_id, facility_id, work_center_id,
        alert_type, predicted_failure_mode,
        failure_probability, time_to_failure_hours,
        severity, urgency, model_id,
        current_health_score, recommended_action,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const recommendedAction = this.getRecommendedAction(
      data.urgency,
      data.timeToFailureHours,
    );

    const result = await this.db.query(query, [
      data.tenantId,
      data.facilityId,
      data.workCenterId,
      data.alertType,
      data.predictedFailureMode,
      data.failureProbability,
      data.timeToFailureHours,
      data.severity,
      data.urgency,
      data.modelId,
      data.currentHealthScore,
      recommendedAction,
      'OPEN',
    ]);

    return result.rows[0].id;
  }

  /**
   * Get recommended action based on urgency
   */
  private getRecommendedAction(urgency: string, timeToFailureHours: number): string {
    if (urgency === 'IMMEDIATE') {
      return `Immediate shutdown and inspection required. Estimated failure within ${Math.round(timeToFailureHours)} hours.`;
    }

    if (urgency === 'URGENT') {
      return `Schedule maintenance within 24-48 hours. Estimated failure within ${Math.round(timeToFailureHours / 24)} days.`;
    }

    if (urgency === 'SOON') {
      return `Schedule maintenance within next week. Estimated failure within ${Math.round(timeToFailureHours / 24)} days.`;
    }

    return `Monitor equipment closely. Schedule maintenance at next available opportunity.`;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string, notes?: string): Promise<void> {
    const query = `
      UPDATE predictive_maintenance_alerts
      SET status = 'ACKNOWLEDGED',
          acknowledged_by_user_id = $2,
          acknowledged_at = NOW(),
          resolution_notes = COALESCE($3, resolution_notes)
      WHERE id = $1
    `;

    await this.db.query(query, [alertId, userId, notes || null]);
    this.logger.log(`Alert ${alertId} acknowledged by user ${userId}`);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(
    alertId: string,
    userId: string,
    resolutionType: string,
    actualFailureOccurred: boolean,
    notes?: string,
  ): Promise<void> {
    const query = `
      UPDATE predictive_maintenance_alerts
      SET status = 'RESOLVED',
          resolved_by_user_id = $2,
          resolved_at = NOW(),
          resolution_type = $3,
          actual_failure_occurred = $4,
          resolution_notes = $5
      WHERE id = $1
    `;

    await this.db.query(query, [
      alertId,
      userId,
      resolutionType,
      actualFailureOccurred,
      notes || null,
    ]);

    this.logger.log(`Alert ${alertId} resolved by user ${userId}`);
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(
    tenantId: string,
    facilityId?: string,
    workCenterId?: string,
  ): Promise<any[]> {
    let query = `
      SELECT *
      FROM predictive_maintenance_alerts
      WHERE tenant_id = $1
        AND status IN ('OPEN', 'ACKNOWLEDGED')
    `;

    const params: any[] = [tenantId];

    if (facilityId) {
      params.push(facilityId);
      query += ` AND facility_id = $${params.length}`;
    }

    if (workCenterId) {
      params.push(workCenterId);
      query += ` AND work_center_id = $${params.length}`;
    }

    query += ` ORDER BY severity DESC, alert_timestamp DESC`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get alerts by severity
   */
  async getAlertsBySeverity(tenantId: string): Promise<any[]> {
    const query = `
      SELECT
        severity,
        COUNT(*) as count
      FROM predictive_maintenance_alerts
      WHERE tenant_id = $1
        AND status IN ('OPEN', 'ACKNOWLEDGED')
      GROUP BY severity
      ORDER BY
        CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END
    `;

    const result = await this.db.query(query, [tenantId]);
    return result.rows;
  }
}
