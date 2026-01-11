import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { ScorecardConfig } from './vendor-performance.service';
import { connect, NatsConnection, JSONCodec } from 'nats';

/**
 * Vendor Alert Engine Service
 *
 * Monitors vendor performance metrics and generates alerts for:
 * - Performance threshold breaches (overall score, individual categories)
 * - Tier changes (automated or manual)
 * - ESG risk levels (HIGH, CRITICAL, UNKNOWN)
 * - Review due dates (audit overdue)
 *
 * Alert workflow: OPEN → ACKNOWLEDGED → RESOLVED
 */

export interface PerformanceAlert {
  tenantId: string;
  vendorId: string;
  alertType: 'THRESHOLD_BREACH' | 'TIER_CHANGE' | 'ESG_RISK' | 'REVIEW_DUE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metricCategory?: string;
  currentValue?: number;
  thresholdValue?: number;
  message: string;
}

export interface VendorPerformanceAlertRecord {
  id: string;
  tenantId: string;
  vendorId: string;
  vendorCode?: string;
  vendorName?: string;
  alertType: string;
  severity: string;
  metricCategory?: string;
  currentValue?: number;
  thresholdValue?: number;
  message: string;
  status: string;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
}

// Alert threshold constants
const ALERT_THRESHOLDS = {
  PERFORMANCE: {
    CRITICAL: 60,   // Overall score < 60 (unacceptable tier)
    WARNING: 75,    // Overall score < 75 (needs improvement tier)
    INFO_IMPROVEMENT: 10  // Score improved by >10 points
  },
  ESG_RISK: {
    CRITICAL: ['HIGH', 'CRITICAL', 'UNKNOWN'],
    WARNING: ['MEDIUM']
  },
  AUDIT_OVERDUE: {
    CRITICAL_MONTHS: 18,  // Audit overdue >18 months
    WARNING_MONTHS: 12    // Audit overdue >12 months
  },
  CATEGORY: {
    QUALITY_CRITICAL: 70,     // Quality % < 70
    DELIVERY_CRITICAL: 75,    // On-time delivery % < 75
    DEFECT_RATE_WARNING: 1000 // Defect rate PPM > 1000 (1σ)
  }
};

@Injectable()
export class VendorAlertEngineService implements OnModuleInit, OnModuleDestroy {
  private nc?: NatsConnection;
  private jc = JSONCodec();

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
  ) {}

  async onModuleInit() {
    try {
      const natsUrl = process.env.NATS_URL || 'nats://nats:4222';
      const user = process.env.NATS_USER;
      const pass = process.env.NATS_PASSWORD;

      this.nc = await connect({
        servers: natsUrl,
        user,
        pass,
        name: 'vendor-alert-engine-service'
      });

      console.log('[VendorAlertEngine] Connected to NATS');
    } catch (error: any) {
      console.error('[VendorAlertEngine] Failed to connect to NATS:', error.message);
      // Continue without NATS - alerts will still be saved to database
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      await this.nc.close();
    }
  }

  /**
   * Check performance thresholds and detect breaches
   *
   * Analyzes vendor performance metrics and generates alerts when:
   * - Overall weighted score falls below acceptable threshold
   * - Individual category scores fall below critical thresholds
   * - Significant improvement detected (positive reinforcement)
   */
  async checkPerformanceThresholds(
    tenantId: string,
    vendorId: string,
    performance: any,
    esgMetrics: any,
    config: ScorecardConfig,
    weightedScore: number
  ): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    // 1. Check overall weighted score against thresholds
    if (weightedScore < ALERT_THRESHOLDS.PERFORMANCE.CRITICAL) {
      alerts.push({
        tenantId,
        vendorId,
        alertType: 'THRESHOLD_BREACH',
        severity: 'CRITICAL',
        metricCategory: 'OVERALL_SCORE',
        currentValue: weightedScore,
        thresholdValue: ALERT_THRESHOLDS.PERFORMANCE.CRITICAL,
        message: `Overall vendor performance score (${weightedScore.toFixed(1)}) is below acceptable threshold (${ALERT_THRESHOLDS.PERFORMANCE.CRITICAL}). Immediate review required.`
      });
    } else if (weightedScore < ALERT_THRESHOLDS.PERFORMANCE.WARNING) {
      alerts.push({
        tenantId,
        vendorId,
        alertType: 'THRESHOLD_BREACH',
        severity: 'WARNING',
        metricCategory: 'OVERALL_SCORE',
        currentValue: weightedScore,
        thresholdValue: ALERT_THRESHOLDS.PERFORMANCE.WARNING,
        message: `Overall vendor performance score (${weightedScore.toFixed(1)}) is below good threshold (${ALERT_THRESHOLDS.PERFORMANCE.WARNING}). Performance improvement needed.`
      });
    }

    // 2. Check for score improvement (positive reinforcement)
    const previousScore = await this.getPreviousWeightedScore(tenantId, vendorId);
    if (previousScore !== null && (weightedScore - previousScore) >= ALERT_THRESHOLDS.PERFORMANCE.INFO_IMPROVEMENT) {
      alerts.push({
        tenantId,
        vendorId,
        alertType: 'THRESHOLD_BREACH',
        severity: 'INFO',
        metricCategory: 'OVERALL_SCORE',
        currentValue: weightedScore,
        thresholdValue: previousScore,
        message: `Vendor performance improved significantly from ${previousScore.toFixed(1)} to ${weightedScore.toFixed(1)} (+${(weightedScore - previousScore).toFixed(1)} points). Excellent progress!`
      });
    }

    // 3. Check individual category thresholds
    // Quality
    if (performance.quality_percentage !== null && performance.quality_percentage < ALERT_THRESHOLDS.CATEGORY.QUALITY_CRITICAL) {
      alerts.push({
        tenantId,
        vendorId,
        alertType: 'THRESHOLD_BREACH',
        severity: 'CRITICAL',
        metricCategory: 'QUALITY',
        currentValue: performance.quality_percentage,
        thresholdValue: ALERT_THRESHOLDS.CATEGORY.QUALITY_CRITICAL,
        message: `Quality performance (${performance.quality_percentage.toFixed(1)}%) is critically low. Threshold: ${ALERT_THRESHOLDS.CATEGORY.QUALITY_CRITICAL}%. Quality audit recommended.`
      });
    }

    // Delivery
    if (performance.on_time_percentage !== null && performance.on_time_percentage < ALERT_THRESHOLDS.CATEGORY.DELIVERY_CRITICAL) {
      alerts.push({
        tenantId,
        vendorId,
        alertType: 'THRESHOLD_BREACH',
        severity: 'CRITICAL',
        metricCategory: 'DELIVERY',
        currentValue: performance.on_time_percentage,
        thresholdValue: ALERT_THRESHOLDS.CATEGORY.DELIVERY_CRITICAL,
        message: `On-time delivery performance (${performance.on_time_percentage.toFixed(1)}%) is critically low. Threshold: ${ALERT_THRESHOLDS.CATEGORY.DELIVERY_CRITICAL}%. Review vendor capacity.`
      });
    }

    // Defect Rate (PPM - Parts Per Million)
    if (performance.defect_rate_ppm !== null && performance.defect_rate_ppm > ALERT_THRESHOLDS.CATEGORY.DEFECT_RATE_WARNING) {
      alerts.push({
        tenantId,
        vendorId,
        alertType: 'THRESHOLD_BREACH',
        severity: 'WARNING',
        metricCategory: 'DEFECT_RATE',
        currentValue: performance.defect_rate_ppm,
        thresholdValue: ALERT_THRESHOLDS.CATEGORY.DEFECT_RATE_WARNING,
        message: `Defect rate (${performance.defect_rate_ppm.toFixed(0)} PPM) exceeds acceptable threshold (${ALERT_THRESHOLDS.CATEGORY.DEFECT_RATE_WARNING} PPM). Quality improvement plan required.`
      });
    }

    // 4. Check ESG risk level
    if (esgMetrics?.esg_risk_level) {
      if (ALERT_THRESHOLDS.ESG_RISK.CRITICAL.includes(esgMetrics.esg_risk_level)) {
        alerts.push({
          tenantId,
          vendorId,
          alertType: 'ESG_RISK',
          severity: 'CRITICAL',
          metricCategory: 'ESG_RISK',
          currentValue: undefined,
          thresholdValue: undefined,
          message: `ESG risk level is ${esgMetrics.esg_risk_level}. Immediate ESG audit and remediation plan required. Consider vendor relationship review.`
        });
      } else if (ALERT_THRESHOLDS.ESG_RISK.WARNING.includes(esgMetrics.esg_risk_level)) {
        alerts.push({
          tenantId,
          vendorId,
          alertType: 'ESG_RISK',
          severity: 'WARNING',
          metricCategory: 'ESG_RISK',
          currentValue: undefined,
          thresholdValue: undefined,
          message: `ESG risk level is ${esgMetrics.esg_risk_level}. ESG improvement initiatives recommended. Monitor compliance closely.`
        });
      }
    }

    return alerts;
  }

  /**
   * Generate alert record in database
   *
   * Creates alert if it doesn't already exist (duplicate prevention)
   * Publishes alert to NATS channel for real-time notifications
   */
  async generateAlert(
    alert: PerformanceAlert
  ): Promise<string> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [alert.tenantId]);

      // 1. Check if similar alert already exists (avoid duplicates)
      // Consider alerts similar if they're for the same vendor, same alert type, same category, and still OPEN
      const existingAlertResult = await client.query(`
        SELECT id
        FROM vendor_performance_alerts
        WHERE tenant_id = $1
          AND vendor_id = $2
          AND alert_type = $3
          AND metric_category = $4
          AND status = 'OPEN'
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        LIMIT 1
      `, [alert.tenantId, alert.vendorId, alert.alertType, alert.metricCategory || null]);

      if (existingAlertResult.rows.length > 0) {
        // Similar alert exists, don't create duplicate
        await client.query('COMMIT');
        return existingAlertResult.rows[0].id;
      }

      // 2. Insert new alert
      const insertResult = await client.query(`
        INSERT INTO vendor_performance_alerts (
          id,
          tenant_id,
          vendor_id,
          alert_type,
          severity,
          metric_category,
          current_value,
          threshold_value,
          message,
          status,
          created_at
        ) VALUES (
          uuid_generate_v7(),
          $1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', CURRENT_TIMESTAMP
        )
        RETURNING id
      `, [
        alert.tenantId,
        alert.vendorId,
        alert.alertType,
        alert.severity,
        alert.metricCategory || null,
        alert.currentValue !== undefined ? alert.currentValue : null,
        alert.thresholdValue !== undefined ? alert.thresholdValue : null,
        alert.message
      ]);

      const alertId = insertResult.rows[0].id;

      await client.query('COMMIT');

      // 3. Publish to NATS channel: agog.alerts.vendor-performance
      // This will be consumed by notification services for email/Slack/etc.
      if (this.nc) {
        try {
          const payload = {
            alertId,
            tenantId: alert.tenantId,
            vendorId: alert.vendorId,
            severity: alert.severity,
            alertType: alert.alertType,
            message: alert.message,
            timestamp: new Date().toISOString(),
          };
          this.nc.publish('agog.alerts.vendor-performance', this.jc.encode(payload));
        } catch (natsError) {
          // Log NATS error but don't fail the alert creation
          console.error('[VendorAlertEngine] Failed to publish to NATS:', natsError);
        }
      }

      return alertId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Acknowledge alert (mark as seen by user)
   */
  async acknowledgeAlert(
    tenantId: string,
    alertId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // 1. Validate alert exists and belongs to this tenant
      const alertResult = await client.query(`
        SELECT id, status
        FROM vendor_performance_alerts
        WHERE id = $1 AND tenant_id = $2
      `, [alertId, tenantId]);

      if (alertResult.rows.length === 0) {
        throw new Error(`Alert ${alertId} not found for tenant ${tenantId}`);
      }

      if (alertResult.rows[0].status !== 'OPEN') {
        throw new Error(`Alert ${alertId} is already ${alertResult.rows[0].status}`);
      }

      // 2. Update alert status to ACKNOWLEDGED
      await client.query(`
        UPDATE vendor_performance_alerts
        SET
          status = 'ACKNOWLEDGED',
          acknowledged_at = CURRENT_TIMESTAMP,
          acknowledged_by = $1,
          resolution_notes = COALESCE(resolution_notes, '') || $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND tenant_id = $4
      `, [
        userId,
        notes ? `[ACKNOWLEDGED] ${notes}\n` : '',
        alertId,
        tenantId
      ]);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Resolve alert (close with resolution notes)
   */
  async resolveAlert(
    tenantId: string,
    alertId: string,
    userId: string,
    resolution: string
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // 1. Validate alert exists and belongs to this tenant
      const alertResult = await client.query(`
        SELECT id, status, severity
        FROM vendor_performance_alerts
        WHERE id = $1 AND tenant_id = $2
      `, [alertId, tenantId]);

      if (alertResult.rows.length === 0) {
        throw new Error(`Alert ${alertId} not found for tenant ${tenantId}`);
      }

      if (alertResult.rows[0].status === 'RESOLVED') {
        throw new Error(`Alert ${alertId} is already resolved`);
      }

      // 2. Require resolution notes for CRITICAL alerts
      if (alertResult.rows[0].severity === 'CRITICAL' && (!resolution || resolution.trim().length < 10)) {
        throw new Error('Resolution notes required for CRITICAL alerts (minimum 10 characters)');
      }

      // 3. Update alert status to RESOLVED
      await client.query(`
        UPDATE vendor_performance_alerts
        SET
          status = 'RESOLVED',
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = $1,
          resolution_notes = COALESCE(resolution_notes, '') || $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND tenant_id = $4
      `, [
        userId,
        `[RESOLVED] ${resolution}\n`,
        alertId,
        tenantId
      ]);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Dismiss alert without resolution (for false positives or non-actionable alerts)
   */
  async dismissAlert(
    tenantId: string,
    alertId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      await client.query(`
        UPDATE vendor_performance_alerts
        SET
          status = 'DISMISSED',
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = $1,
          resolution_notes = COALESCE(resolution_notes, '') || $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND tenant_id = $4
      `, [
        userId,
        `[DISMISSED] ${reason}\n`,
        alertId,
        tenantId
      ]);

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get open alerts for a tenant (dashboard display)
   */
  async getOpenAlerts(
    tenantId: string,
    severity?: 'INFO' | 'WARNING' | 'CRITICAL',
    status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'
  ): Promise<VendorPerformanceAlertRecord[]> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      let query = `
        SELECT
          a.id,
          a.tenant_id,
          a.vendor_id,
          v.vendor_code,
          v.vendor_name,
          a.alert_type,
          a.severity,
          a.metric_category,
          a.current_value,
          a.threshold_value,
          a.message,
          a.status,
          a.acknowledged_at,
          a.acknowledged_by,
          a.resolved_at,
          a.resolved_by,
          a.resolution_notes,
          a.created_at
        FROM vendor_performance_alerts a
        LEFT JOIN vendors v ON v.id = a.vendor_id AND v.tenant_id = a.tenant_id AND v.is_current_version = TRUE
        WHERE a.tenant_id = $1
      `;

      const params: (string | number)[] = [tenantId];
      let paramIndex = 2;

      if (severity) {
        query += ` AND a.severity = $${paramIndex}`;
        params.push(severity);
        paramIndex++;
      }

      if (status) {
        query += ` AND a.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      } else {
        // Default to non-resolved alerts
        query += ` AND a.status IN ('OPEN', 'ACKNOWLEDGED')`;
      }

      query += `
        ORDER BY
          CASE a.severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'WARNING' THEN 2
            WHEN 'INFO' THEN 3
          END,
          a.created_at DESC
        LIMIT 100
      `;

      const result = await client.query(query, params);

      return result.rows.map(row => this.mapAlertRow(row));

    } finally {
      client.release();
    }
  }

  /**
   * Get alert statistics for dashboard
   */
  async getAlertStatistics(
    tenantId: string
  ): Promise<{
    totalOpen: number;
    criticalOpen: number;
    warningOpen: number;
    infoOpen: number;
    resolvedLast30Days: number;
    averageResolutionTimeHours: number;
  }> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'ACKNOWLEDGED')) as total_open,
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'ACKNOWLEDGED') AND severity = 'CRITICAL') as critical_open,
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'ACKNOWLEDGED') AND severity = 'WARNING') as warning_open,
          COUNT(*) FILTER (WHERE status IN ('OPEN', 'ACKNOWLEDGED') AND severity = 'INFO') as info_open,
          COUNT(*) FILTER (WHERE status = 'RESOLVED' AND resolved_at >= CURRENT_DATE - INTERVAL '30 days') as resolved_last_30_days,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE status = 'RESOLVED') as avg_resolution_hours
        FROM vendor_performance_alerts
        WHERE tenant_id = $1
      `, [tenantId]);

      const stats = result.rows[0];

      return {
        totalOpen: parseInt(stats.total_open ?? '0', 10) || 0,
        criticalOpen: parseInt(stats.critical_open ?? '0', 10) || 0,
        warningOpen: parseInt(stats.warning_open ?? '0', 10) || 0,
        infoOpen: parseInt(stats.info_open ?? '0', 10) || 0,
        resolvedLast30Days: parseInt(stats.resolved_last_30_days ?? '0', 10) || 0,
        averageResolutionTimeHours: parseFloat(stats.avg_resolution_hours ?? '0') || 0
      };

    } finally {
      client.release();
    }
  }

  /**
   * Check ESG audit due dates and generate alerts
   */
  async checkESGAuditDueDates(
    tenantId: string
  ): Promise<number> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // 1. Find vendors with upcoming or overdue ESG audits
      const overdueResult = await client.query(`
        SELECT
          esg.vendor_id,
          v.vendor_code,
          v.vendor_name,
          esg.next_audit_due_date,
          esg.last_audit_date,
          CURRENT_DATE - esg.next_audit_due_date as days_overdue
        FROM vendor_esg_metrics esg
        JOIN vendors v ON v.id = esg.vendor_id AND v.tenant_id = esg.tenant_id AND v.is_current_version = TRUE
        WHERE esg.tenant_id = $1
          AND esg.next_audit_due_date IS NOT NULL
          AND esg.next_audit_due_date < CURRENT_DATE + INTERVAL '30 days'
        ORDER BY esg.next_audit_due_date ASC
      `, [tenantId]);

      let alertsGenerated = 0;

      for (const row of overdueResult.rows) {
        const daysOverdue = parseInt(row.days_overdue);
        const monthsOverdue = Math.floor(daysOverdue / 30);

        let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';
        let message = '';

        if (daysOverdue > 0) {
          // Audit is overdue
          if (monthsOverdue >= ALERT_THRESHOLDS.AUDIT_OVERDUE.CRITICAL_MONTHS) {
            severity = 'CRITICAL';
            message = `ESG audit is CRITICALLY overdue by ${monthsOverdue} months (due: ${row.next_audit_due_date}). Last audit: ${row.last_audit_date || 'NEVER'}. Immediate action required.`;
          } else if (monthsOverdue >= ALERT_THRESHOLDS.AUDIT_OVERDUE.WARNING_MONTHS) {
            severity = 'WARNING';
            message = `ESG audit is overdue by ${monthsOverdue} months (due: ${row.next_audit_due_date}). Last audit: ${row.last_audit_date || 'NEVER'}. Schedule audit immediately.`;
          } else {
            severity = 'WARNING';
            message = `ESG audit is overdue by ${daysOverdue} days (due: ${row.next_audit_due_date}). Last audit: ${row.last_audit_date || 'NEVER'}. Schedule audit soon.`;
          }
        } else {
          // Audit is upcoming (within 30 days)
          const daysUntilDue = Math.abs(daysOverdue);
          severity = 'INFO';
          message = `ESG audit due in ${daysUntilDue} days (due: ${row.next_audit_due_date}). Last audit: ${row.last_audit_date || 'NEVER'}. Plan audit logistics.`;
        }

        // Generate alert
        await this.generateAlert({
          tenantId,
          vendorId: row.vendor_id,
          alertType: 'REVIEW_DUE',
          severity,
          metricCategory: 'ESG_AUDIT',
          message
        });

        alertsGenerated++;
      }

      await client.query('COMMIT');

      return alertsGenerated;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Get previous month's weighted score for comparison
   */
  private async getPreviousWeightedScore(
    tenantId: string,
    vendorId: string
  ): Promise<number | null> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Query for previous period's performance data
      // This assumes you're storing weighted_score or can recalculate it
      // For now, return null (feature enhancement)
      return null;

    } finally {
      client.release();
    }
  }

  /**
   * Helper: Map database row to VendorPerformanceAlertRecord
   */
  private mapAlertRow(row: any): VendorPerformanceAlertRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      vendorId: row.vendor_id,
      vendorCode: row.vendor_code ?? undefined,
      vendorName: row.vendor_name ?? undefined,
      alertType: row.alert_type,
      severity: row.severity,
      metricCategory: row.metric_category ?? undefined,
      currentValue: row.current_value !== null && row.current_value !== undefined ? parseFloat(String(row.current_value)) : undefined,
      thresholdValue: row.threshold_value !== null && row.threshold_value !== undefined ? parseFloat(String(row.threshold_value)) : undefined,
      message: row.message,
      status: row.status,
      acknowledgedAt: row.acknowledged_at ?? undefined,
      acknowledgedBy: row.acknowledged_by ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      resolvedBy: row.resolved_by ?? undefined,
      resolutionNotes: row.resolution_notes ?? undefined,
      createdAt: row.created_at
    };
  }
}
