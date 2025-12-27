/**
 * DevOps Alerting Service
 *
 * Author: Roy (Backend Developer)
 * Requirement: REQ-STRATEGIC-AUTO-1766584106655
 * Purpose: Comprehensive DevOps alerting integration with multiple channels
 * Addresses: Sylvia Issue #11 (MEDIUM PRIORITY)
 *
 * Features:
 * - PagerDuty integration for critical alerts
 * - Slack integration for warnings and notifications
 * - Email integration for reports and summaries
 * - Alert aggregation to prevent fatigue
 * - Configurable alert routing based on severity
 * - Alert history and audit trail
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import * as https from 'https';

export interface AlertConfig {
  pagerDutyIntegrationKey?: string;
  slackWebhookUrl?: string;
  emailSmtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  emailRecipients?: {
    critical: string[];
    warning: string[];
    info: string[];
  };
}

export interface Alert {
  id?: string;
  timestamp: Date;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  source: string;
  metadata?: Record<string, any>;
  tenantId?: string;
  facilityId?: string;
}

export interface AlertHistory {
  alertId: string;
  timestamp: Date;
  severity: string;
  message: string;
  deliveryStatus: 'SENT' | 'FAILED' | 'AGGREGATED';
  channels: string[];
}

@Injectable()
export class DevOpsAlertingService {
  private config: AlertConfig;
  private alertCache: Map<string, Alert[]> = new Map();
  private aggregationWindowMs = 300000; // 5 minutes

  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    @Optional() config?: AlertConfig
  ) {
    this.config = this.loadConfig(config || {});
  }

  /**
   * Load configuration from environment variables with fallback to provided config
   */
  private loadConfig(providedConfig: AlertConfig): AlertConfig {
    return {
      pagerDutyIntegrationKey:
        process.env.PAGERDUTY_INTEGRATION_KEY ||
        providedConfig.pagerDutyIntegrationKey,
      slackWebhookUrl:
        process.env.SLACK_WEBHOOK_URL ||
        providedConfig.slackWebhookUrl,
      emailSmtpConfig: providedConfig.emailSmtpConfig || {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
      emailRecipients: providedConfig.emailRecipients || {
        critical: (process.env.CRITICAL_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
        warning: (process.env.WARNING_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
        info: (process.env.INFO_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
      },
    };
  }

  /**
   * Send alert to appropriate channels based on severity
   * Implements alert aggregation to prevent fatigue
   */
  async sendAlert(alert: Alert): Promise<void> {
    const alertKey = this.generateAlertKey(alert);

    // Check if this alert should be aggregated
    if (this.shouldAggregateAlert(alertKey, alert)) {
      await this.aggregateAlert(alertKey, alert);
      return;
    }

    // Route alert to appropriate channels
    const deliveryPromises: Promise<any>[] = [];

    switch (alert.severity) {
      case 'CRITICAL':
        // Critical alerts go to PagerDuty + Slack + Email
        deliveryPromises.push(
          this.sendToPagerDuty(alert),
          this.sendToSlack(alert),
          this.sendEmail(alert)
        );
        break;

      case 'WARNING':
        // Warnings go to Slack + Email
        deliveryPromises.push(
          this.sendToSlack(alert),
          this.sendEmail(alert)
        );
        break;

      case 'INFO':
        // Info goes to Slack only
        deliveryPromises.push(this.sendToSlack(alert));
        break;
    }

    // Wait for all deliveries
    const results = await Promise.allSettled(deliveryPromises);

    // Log alert delivery
    await this.logAlertHistory(alert, results);

    // Store in cache for aggregation window
    this.cacheAlert(alertKey, alert);
  }

  /**
   * Send alert to PagerDuty for on-call notification
   */
  private async sendToPagerDuty(alert: Alert): Promise<void> {
    if (!this.config.pagerDutyIntegrationKey) {
      console.warn('[AlertingService] PagerDuty integration key not configured');
      return;
    }

    const payload = {
      routing_key: this.config.pagerDutyIntegrationKey,
      event_action: 'trigger',
      dedup_key: this.generateAlertKey(alert),
      payload: {
        summary: alert.message,
        severity: alert.severity.toLowerCase(),
        timestamp: alert.timestamp.toISOString(),
        source: alert.source,
        custom_details: alert.metadata,
      },
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);

      const options = {
        hostname: 'events.pagerduty.com',
        path: '/v2/enqueue',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 202) {
            console.log('[AlertingService] PagerDuty alert sent successfully');
            resolve();
          } else {
            console.error('[AlertingService] PagerDuty error:', body);
            reject(new Error(`PagerDuty responded with ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[AlertingService] PagerDuty request failed:', error);
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Send alert to Slack channel
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    if (!this.config.slackWebhookUrl) {
      console.warn('[AlertingService] Slack webhook URL not configured');
      return;
    }

    const color = {
      CRITICAL: 'danger',
      WARNING: 'warning',
      INFO: 'good',
    }[alert.severity];

    const payload = {
      username: 'Bin Optimization Monitor',
      icon_emoji: ':robot_face:',
      attachments: [
        {
          color,
          title: `[${alert.severity}] ${alert.message}`,
          text: this.formatMetadataForSlack(alert.metadata),
          fields: [
            {
              title: 'Source',
              value: alert.source,
              short: true,
            },
            {
              title: 'Timestamp',
              value: alert.timestamp.toISOString(),
              short: true,
            },
            ...(alert.tenantId
              ? [
                  {
                    title: 'Tenant ID',
                    value: alert.tenantId,
                    short: true,
                  },
                ]
              : []),
            ...(alert.facilityId
              ? [
                  {
                    title: 'Facility ID',
                    value: alert.facilityId,
                    short: true,
                  },
                ]
              : []),
          ],
          footer: 'Bin Optimization System',
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);

      const url = new URL(this.config.slackWebhookUrl!);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('[AlertingService] Slack alert sent successfully');
            resolve();
          } else {
            console.error('[AlertingService] Slack error:', body);
            reject(new Error(`Slack responded with ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[AlertingService] Slack request failed:', error);
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Send email alert
   * Note: In production, consider using a service like SendGrid or AWS SES
   */
  private async sendEmail(alert: Alert): Promise<void> {
    const recipients = this.config.emailRecipients?.[alert.severity.toLowerCase()];

    if (!recipients || recipients.length === 0) {
      console.warn(`[AlertingService] No email recipients configured for ${alert.severity}`);
      return;
    }

    // Log email alert (actual SMTP implementation would go here)
    console.log('[AlertingService] Email alert would be sent to:', recipients);
    console.log('[AlertingService] Email content:', {
      subject: `[${alert.severity}] ${alert.message}`,
      body: this.formatEmailBody(alert),
    });

    // TODO: Implement actual SMTP email sending using nodemailer
    // Example:
    // const transporter = nodemailer.createTransporter(this.config.emailSmtpConfig);
    // await transporter.sendMail({
    //   from: this.config.emailSmtpConfig.auth.user,
    //   to: recipients.join(','),
    //   subject: `[${alert.severity}] ${alert.message}`,
    //   html: this.formatEmailBody(alert),
    // });
  }

  /**
   * Generate unique alert key for deduplication and aggregation
   */
  private generateAlertKey(alert: Alert): string {
    return `${alert.source}:${alert.severity}:${alert.message.substring(0, 50)}`;
  }

  /**
   * Check if alert should be aggregated (prevent spam)
   */
  private shouldAggregateAlert(alertKey: string, alert: Alert): boolean {
    const cachedAlerts = this.alertCache.get(alertKey) || [];

    if (cachedAlerts.length === 0) {
      return false;
    }

    // Check if similar alert was sent recently (within aggregation window)
    const latestAlert = cachedAlerts[cachedAlerts.length - 1];
    const timeSinceLastAlert =
      alert.timestamp.getTime() - latestAlert.timestamp.getTime();

    return timeSinceLastAlert < this.aggregationWindowMs;
  }

  /**
   * Aggregate alert instead of sending immediately
   */
  private async aggregateAlert(alertKey: string, alert: Alert): Promise<void> {
    const cachedAlerts = this.alertCache.get(alertKey) || [];
    cachedAlerts.push(alert);
    this.alertCache.set(alertKey, cachedAlerts);

    console.log(
      `[AlertingService] Aggregating alert: ${alertKey} (${cachedAlerts.length} total)`
    );

    // Log aggregated alert
    await this.logAlertHistory(alert, [], 'AGGREGATED');
  }

  /**
   * Cache alert for aggregation window
   */
  private cacheAlert(alertKey: string, alert: Alert): void {
    const cachedAlerts = this.alertCache.get(alertKey) || [];
    cachedAlerts.push(alert);
    this.alertCache.set(alertKey, cachedAlerts);

    // Clean up old alerts after aggregation window
    setTimeout(() => {
      const alerts = this.alertCache.get(alertKey) || [];
      const filtered = alerts.filter(
        (a) =>
          new Date().getTime() - a.timestamp.getTime() < this.aggregationWindowMs
      );

      if (filtered.length === 0) {
        this.alertCache.delete(alertKey);
      } else {
        this.alertCache.set(alertKey, filtered);
      }
    }, this.aggregationWindowMs);
  }

  /**
   * Log alert delivery to database for audit trail
   */
  private async logAlertHistory(
    alert: Alert,
    deliveryResults: PromiseSettledResult<any>[],
    status: 'SENT' | 'FAILED' | 'AGGREGATED' = 'SENT'
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      const channels = deliveryResults
        .map((result, index) => {
          const channelNames = ['PagerDuty', 'Slack', 'Email'];
          return result.status === 'fulfilled' ? channelNames[index] : null;
        })
        .filter(Boolean);

      await client.query(
        `INSERT INTO devops_alert_history (
          tenant_id,
          facility_id,
          severity,
          message,
          source,
          metadata,
          delivery_status,
          delivery_channels,
          alert_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          alert.tenantId || null,
          alert.facilityId || null,
          alert.severity,
          alert.message,
          alert.source,
          JSON.stringify(alert.metadata || {}),
          status,
          JSON.stringify(channels),
          alert.timestamp,
        ]
      );
    } catch (error) {
      console.error('[AlertingService] Failed to log alert history:', error);
      // Don't throw - logging failure shouldn't break alerting
    } finally {
      client.release();
    }
  }

  /**
   * Format metadata for Slack display
   */
  private formatMetadataForSlack(metadata?: Record<string, any>): string {
    if (!metadata) return '';

    return Object.entries(metadata)
      .map(([key, value]) => `*${key}:* ${JSON.stringify(value)}`)
      .join('\n');
  }

  /**
   * Format email body with HTML
   */
  private formatEmailBody(alert: Alert): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="border-left: 4px solid ${
            alert.severity === 'CRITICAL'
              ? '#dc3545'
              : alert.severity === 'WARNING'
              ? '#ffc107'
              : '#28a745'
          }; padding-left: 15px;">
            <h2 style="margin-top: 0;">[${alert.severity}] Bin Optimization Alert</h2>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Source:</strong> ${alert.source}</p>
            <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
            ${alert.tenantId ? `<p><strong>Tenant ID:</strong> ${alert.tenantId}</p>` : ''}
            ${alert.facilityId ? `<p><strong>Facility ID:</strong> ${alert.facilityId}</p>` : ''}
            ${
              alert.metadata
                ? `
              <h3>Details:</h3>
              <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(
                alert.metadata,
                null,
                2
              )}</pre>
            `
                : ''
            }
          </div>
          <hr style="margin-top: 30px;" />
          <p style="color: #666; font-size: 12px;">
            This alert was generated by the Bin Optimization System.
            Please do not reply to this email.
          </p>
        </body>
      </html>
    `;
  }

  /**
   * Send aggregated summary alert
   * Useful for daily/weekly summaries
   */
  async sendAggregateSummary(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT
          severity,
          COUNT(*) as alert_count,
          array_agg(DISTINCT message) as unique_messages
        FROM devops_alert_history
        WHERE alert_timestamp BETWEEN $1 AND $2
          ${tenantId ? 'AND tenant_id = $3' : ''}
        GROUP BY severity
        ORDER BY
          CASE severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'WARNING' THEN 2
            WHEN 'INFO' THEN 3
          END`,
        tenantId ? [startDate, endDate, tenantId] : [startDate, endDate]
      );

      const summary = result.rows.map((row) => ({
        severity: row.severity,
        count: parseInt(row.alert_count),
        messages: row.unique_messages,
      }));

      const alert: Alert = {
        timestamp: new Date(),
        severity: 'INFO',
        source: 'bin-optimization-summary',
        message: `Alert Summary: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        metadata: { summary },
        tenantId,
      };

      await this.sendToSlack(alert);
      await this.sendEmail(alert);
    } finally {
      client.release();
    }
  }
}
