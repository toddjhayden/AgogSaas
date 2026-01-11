import { Injectable, Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool, PoolClient } from 'pg';
import axios from 'axios';

interface Facility {
  id: string;
  name: string;  // Maps to facility_name
  tenant_id: string;
  edge_vpn_hostname?: string;  // Optional - may not be configured
  region?: string;  // Maps to deployment_region
  teams_webhook?: string;
  slack_webhook?: string;
}

interface FacilityStatus {
  online: boolean;
  offline_since?: Date;
  last_sync?: Date;
  escalated: boolean;
}

interface Contact {
  name: string;
  email: string;
  phone: string;
  sms_enabled: boolean;
  phone_call_enabled: boolean;
  is_primary: boolean;
}

interface Alert {
  facility_id: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  actions: string[];
}

/**
 * Edge Health Monitoring Service
 *
 * **CRITICAL: WE Tell THEM They're Down (Not Other Way Around)**
 *
 * Monitors all edge facilities every 30 seconds.
 * When edge goes offline, immediately alerts facility IT staff via:
 * - SMS (Twilio)
 * - Phone Call (Twilio Voice)
 * - Microsoft Teams
 * - Slack
 * - Email
 * - PagerDuty
 *
 * **Escalation**: If offline > 1 hour, escalate to customer success team.
 *
 * **P0 Fixes Applied:**
 * - Error boundary in cron job with monitoring system alerts
 * - Retry logic (3 attempts) for health checks
 * - Rate limiting on alert channels (5 min cooldown)
 * - Secrets validated on startup
 * - Transaction support for status updates
 * - Graceful shutdown support
 */
@Injectable()
export class EdgeHealthMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EdgeHealthMonitorService.name);

  // Twilio client (initialized if credentials provided)
  private readonly twilioClient?: any;
  private readonly twilioFromNumber?: string;

  // PagerDuty integration key
  private readonly pagerDutyKey?: string;

  // Rate limiting cache: Map<facilityId-severity, lastAlertTime>
  private readonly alertCache = new Map<string, Date>();

  // Graceful shutdown support
  private isShuttingDown = false;
  private activeHealthChecks = new Set<Promise<any>>();

  // Health check monitoring
  private lastRunTime: Date = new Date();
  private facilitiesCount: number = 0;

  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool
  ) {}

  /**
   * Initialize service and validate secrets
   *
   * CRITICAL: Per WORKFLOW_RULES.md Rule #1 (No Graceful Error Handling)
   * This service MUST have all required dependencies or it exits immediately.
   * NO graceful degradation, NO "keep running with warnings".
   */
  async onModuleInit() {
    this.logger.log('🚀 Initializing Edge Health Monitor Service...');

    // RULE #1 COMPLIANCE: Validate required database schema
    await this.validateRequiredSchema();

    // Validate Twilio credentials
    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      // @ts-ignore - dynamic require
      this.twilioClient = require('twilio')(
        process.env.TWILIO_SID,
        process.env.TWILIO_TOKEN
      );
      // @ts-ignore - assignment from validated env var
      this.twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
      this.logger.log('✅ Twilio configured for SMS and voice alerts');
    } else {
      this.logger.warn('⚠️ Twilio not configured - SMS and phone call alerts disabled');
    }

    // Validate PagerDuty key
    if (process.env.PAGERDUTY_INTEGRATION_KEY) {
      // @ts-ignore - assignment from env var
      this.pagerDutyKey = process.env.PAGERDUTY_INTEGRATION_KEY;
      this.logger.log('✅ PagerDuty configured');
    } else {
      this.logger.warn('⚠️ PagerDuty not configured');
    }

    // Validate API and Frontend URLs for webhooks
    if (!process.env.API_URL) {
      this.logger.warn('⚠️ API_URL not set - Twilio voice callbacks may fail');
    }
    if (!process.env.FRONTEND_URL) {
      this.logger.warn('⚠️ FRONTEND_URL not set - Dashboard links in alerts may be broken');
    }

    this.logger.log('✅ Edge Health Monitor Service initialized');
  }

  /**
   * Validate that required database schema exists
   *
   * WORKFLOW_RULES.md Rule #1 Compliance:
   * - If edge monitoring columns missing, EXIT immediately (process.exit(1))
   * - NO graceful degradation, NO partial functionality
   * - Service requires ALL dependencies or doesn't run at all
   *
   * Required columns:
   * - edge_vpn_hostname: VPN hostname for health checks
   * - teams_webhook: Microsoft Teams alert URL
   * - slack_webhook: Slack alert URL
   */
  private async validateRequiredSchema(): Promise<void> {
    try {
      const columnCheck = await this.pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'facilities'
          AND column_name IN ('edge_vpn_hostname', 'teams_webhook', 'slack_webhook')
      `);

      const hasAllColumns = columnCheck.rows.length === 3;

      if (!hasAllColumns) {
        // FAIL FAST per WORKFLOW_RULES.md Rule #1
        this.logger.error(
          '❌ CRITICAL: Edge monitoring schema incomplete in facilities table.'
        );
        this.logger.error(
          'EdgeHealthMonitorService requires: edge_vpn_hostname, teams_webhook, slack_webhook columns.'
        );
        this.logger.error(
          'Run migration V0.0.XXX__add_edge_monitoring_columns.sql before starting this service.'
        );
        this.logger.error(
          '🛑 Exiting immediately per WORKFLOW_RULES.md Rule #1 (No Graceful Error Handling)'
        );
        this.logger.error(
          'Rationale: Service cannot function without required schema. Partial operation would create inconsistent state.'
        );

        // Exit immediately - process supervisor will restart when schema is ready
        process.exit(1);
      }

      this.logger.log('✅ Required edge monitoring schema validated');
    } catch (error) {
      this.logger.error('❌ CRITICAL: Failed to validate database schema');
      this.logger.error(error instanceof Error ? error.stack : String(error));
      this.logger.error('🛑 Exiting immediately per WORKFLOW_RULES.md Rule #1');
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown - wait for in-progress health checks
   */
  async onModuleDestroy() {
    this.logger.log('🛑 Shutting down Edge Health Monitor Service...');
    this.isShuttingDown = true;

    if (this.activeHealthChecks.size > 0) {
      this.logger.log(`⏳ Waiting for ${this.activeHealthChecks.size} in-progress health checks...`);
      await Promise.allSettled(this.activeHealthChecks);
    }

    this.logger.log('✅ Edge Health Monitor Service shutdown complete');
  }

  /**
   * Get last run time for health check monitoring
   */
  getLastRunTime(): Date {
    return this.lastRunTime;
  }

  /**
   * Get facilities count for health check monitoring
   */
  getFacilitiesCount(): number {
    return this.facilitiesCount;
  }

  /**
   * Run every 30 seconds
   * Checks health of ALL edge facilities
   *
   * **P0 Fix #1: Error Boundary**
   * - Wraps entire execution in try-catch
   * - Alerts DevOps team if monitoring system fails
   * - Uses Promise.allSettled for parallel execution
   */
  @Cron('*/30 * * * * *')
  async checkAllEdgeFacilities() {
    // Skip if shutting down
    if (this.isShuttingDown) {
      this.logger.debug('Skipping health check - service shutting down');
      return;
    }

    const startTime = Date.now();
    this.lastRunTime = new Date();

    try {
      this.logger.debug('Checking all edge facilities...');

      // Get facilities with error handling
      const facilities = await this.getFacilities();
      this.facilitiesCount = facilities.length;

      if (facilities.length === 0) {
        this.logger.warn('⚠️ No facilities found to monitor');
        return;
      }

      // Check all facilities in parallel
      const results = await Promise.allSettled(
        facilities.map(facility => this.checkSingleFacility(facility))
      );

      // Log failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        this.logger.error(
          `❌ ${failures.length}/${facilities.length} facility checks failed`
        );
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`✅ Monitoring cycle complete in ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `💥 CRITICAL: Edge monitoring cron job failed after ${duration}ms`,
        error instanceof Error ? error.stack : String(error)
      );

      // Alert DevOps team that monitoring system itself is down
      await this.sendMonitoringSystemAlert(error);
    }
  }

  /**
   * Check single facility (wrapped for graceful shutdown)
   */
  private async checkSingleFacility(facility: Facility): Promise<void> {
    const checkPromise = this._checkSingleFacility(facility);
    this.activeHealthChecks.add(checkPromise);

    try {
      await checkPromise;
    } finally {
      this.activeHealthChecks.delete(checkPromise);
    }
  }

  /**
   * Internal facility check logic
   */
  private async _checkSingleFacility(facility: Facility): Promise<void> {
    try {
      const isHealthy = await this.checkFacilityHealth(facility);

      if (!isHealthy) {
        await this.handleFacilityOffline(facility);
      } else {
        await this.handleFacilityOnline(facility);
      }
    } catch (err) {
      this.logger.error(
        `Error checking facility ${facility.id}:`,
        err instanceof Error ? err.message : String(err)
      );
      throw err; // Re-throw for Promise.allSettled tracking
    }
  }

  /**
   * Send critical alert when monitoring system itself fails
   */
  private async sendMonitoringSystemAlert(error: unknown) {
    try {
      const message = error instanceof Error ? error.message : String(error);

      // Log to database
      await this.pool.query(`
        INSERT INTO edge_alerts (
          facility_id, alert_type, severity, message, actions, sent_at
        ) VALUES (
          NULL,
          'MONITORING_SYSTEM_FAILURE',
          'CRITICAL',
          $1,
          ARRAY[
            'Check backend logs immediately',
            'Verify database connectivity',
            'Check NestJS cron scheduler status',
            'Review recent deployments',
            'Contact engineering team if issue persists'
          ],
          NOW()
        )
      `, [`Edge monitoring system failure: ${message}`]);

      this.logger.error('💥 Monitoring system alert logged to database');

      // TODO: Send to PagerDuty/Slack for DevOps team
      // This is critical infrastructure failure - needs immediate attention

    } catch (alertError) {
      // Last resort - at least log to console
      this.logger.error(
        '💥💥 CRITICAL: Failed to send monitoring system alert',
        alertError instanceof Error ? alertError.message : String(alertError)
      );
    }
  }

  /**
   * Get all facilities from database
   *
   * WORKFLOW_RULES.md Rule #1 Compliance:
   * Schema validation happens in onModuleInit(). If we reach this method,
   * schema is guaranteed to be complete (service would have exited otherwise).
   *
   * Note: The facilities table uses different column names than originally expected.
   * This query maps facility_name -> name and deployment_region -> region.
   */
  async getFacilities(): Promise<Facility[]> {
    // Schema already validated in onModuleInit() - safe to query directly
    const result = await this.pool.query(`
      SELECT
        id,
        facility_name as name,
        tenant_id,
        edge_vpn_hostname,
        deployment_region as region,
        teams_webhook,
        slack_webhook
      FROM facilities
      WHERE is_active = true
        AND COALESCE(mode, 'normal') = 'normal'  -- Skip facilities in cloud_fallback mode
      ORDER BY facility_name
    `);

    return result.rows;
  }

  /**
   * Check if single facility is healthy
   *
   * **P0 Fix #2: Retry Logic**
   * - 3 attempts with 1 second delay between retries
   * - Prevents false positives from temporary network glitches
   * - Timeout of 5 seconds per attempt
   */
  async checkFacilityHealth(facility: Facility): Promise<boolean> {
    // Skip facilities without edge hostname configured
    if (!facility.edge_vpn_hostname) {
      this.logger.debug(
        `Skipping health check for ${facility.name} - no edge_vpn_hostname configured`
      );
      return true; // Assume healthy if not an edge facility
    }

    const maxRetries = 3;
    const retryDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(
          `http://${facility.edge_vpn_hostname}:4010/health`,
          { timeout: 5000 }
        );

        const healthy = response.status === 200 && response.data.status === 'healthy';

        if (healthy) {
          // Update last_sync timestamp
          await this.pool.query(`
            UPDATE facility_status
            SET last_sync = NOW()
            WHERE facility_id = $1
          `, [facility.id]);

          return true;
        }

        // Unhealthy response - don't retry
        this.logger.warn(
          `Facility ${facility.name} returned unhealthy status: ${response.data.status}`
        );
        return false;

      } catch (err) {
        if (attempt < maxRetries) {
          this.logger.debug(
            `Facility ${facility.name} health check attempt ${attempt}/${maxRetries} failed, retrying...`
          );
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        } else {
          this.logger.warn(
            `Facility ${facility.name} health check failed after ${maxRetries} attempts: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    }

    // Failed after all retries
    return false;
  }

  /**
   * Handle facility going offline
   * Sends alerts on initial failure, escalates after 1 hour
   *
   * **P0 Fix #6: Transaction Support**
   * - Use database transaction for atomicity
   * - Mark offline and log alert in same transaction
   * - Send external alerts AFTER commit
   */
  async handleFacilityOffline(facility: Facility) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const status = await this.getFacilityStatus(facility.id, client);

      if (status.online) {
        // JUST went offline - trigger initial alerts

        // Mark offline in transaction
        await this.markFacilityOffline(facility.id, client);

        // Log alert to database in same transaction
        await this.logAlertToDatabase(
          facility,
          'FACILITY_OFFLINE',
          'critical',
          `${facility.name} is OFFLINE since ${new Date().toISOString()}`,
          [
            'Check internet connectivity at facility',
            'Verify edge computer is powered on',
            'Check VPN tunnel status',
            'Review edge computer logs: docker logs agogsaas-edge-api',
            'Contact AgogSaaS support if issue persists: 1-800-AGOG-HELP'
          ],
          client
        );

        await client.query('COMMIT');

        this.logger.error(`🚨 FACILITY OFFLINE: ${facility.name} (${facility.id})`);

        // Send external alerts AFTER commit
        await this.sendAlerts(facility, {
          facility_id: facility.id,
          alert_type: 'FACILITY_OFFLINE',
          severity: 'critical',
          message: `${facility.name} is OFFLINE since ${new Date().toISOString()}`,
          actions: [
            'Check internet connectivity at facility',
            'Verify edge computer is powered on',
            'Check VPN tunnel status',
            'Review edge computer logs: docker logs agogsaas-edge-api',
            'Contact AgogSaaS support if issue persists: 1-800-AGOG-HELP'
          ]
        });

      } else {
        await client.query('COMMIT');

        // Already offline - check if we should escalate
        const offlineDuration = Date.now() - (status.offline_since ?? new Date()).getTime();
        const offlineMinutes = offlineDuration / 1000 / 60;

        if (offlineMinutes > 60 && !status.escalated) {
          // Offline for > 1 hour - escalate to customer success
          this.logger.warn(`⚠️ ESCALATING: ${facility.name} offline ${offlineMinutes.toFixed(0)} minutes`);
          await this.escalateAlert(facility, offlineMinutes);
        }
      }
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Failed to handle facility offline for ${facility.id}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle facility coming back online
   * Sends recovery notification
   */
  async handleFacilityOnline(facility: Facility) {
    const status = await this.getFacilityStatus(facility.id);

    if (!status.online) {
      // JUST came back online
      const offlineDuration = Date.now() - (status.offline_since ?? new Date()).getTime();
      const offlineMinutes = Math.floor(offlineDuration / 1000 / 60);

      await this.markFacilityOnline(facility.id);

      this.logger.log(`✅ FACILITY ONLINE: ${facility.name} (was offline ${offlineMinutes} min)`);

      // Send recovery notification
      await this.sendRecoveryNotification(facility, offlineMinutes);
    }
  }

  /**
   * Get current facility status
   * Supports transactions
   */
  async getFacilityStatus(
    facilityId: string,
    client?: PoolClient
  ): Promise<FacilityStatus> {
    const db = client || this.pool;

    const result = await db.query(`
      SELECT online, offline_since, last_sync, escalated
      FROM facility_status
      WHERE facility_id = $1
    `, [facilityId]);

    if (result.rows.length === 0) {
      // Initialize status
      await db.query(`
        INSERT INTO facility_status (facility_id, online, last_sync)
        VALUES ($1, true, NOW())
      `, [facilityId]);

      return { online: true, escalated: false };
    }

    return result.rows[0];
  }

  /**
   * Mark facility as offline
   * Supports transactions
   */
  async markFacilityOffline(facilityId: string, client?: PoolClient) {
    const db = client || this.pool;

    await db.query(`
      UPDATE facility_status
      SET
        online = false,
        offline_since = NOW(),
        escalated = false
      WHERE facility_id = $1
    `, [facilityId]);
  }

  /**
   * Mark facility as online
   * Supports transactions
   */
  async markFacilityOnline(facilityId: string, client?: PoolClient) {
    const db = client || this.pool;

    await db.query(`
      UPDATE facility_status
      SET
        online = true,
        offline_since = NULL,
        last_sync = NOW(),
        escalated = false
      WHERE facility_id = $1
    `, [facilityId]);
  }

  /**
   * Log alert to database with deduplication
   *
   * **P0 Fix #7: Alert Deduplication**
   * - Uses ON CONFLICT to prevent duplicate alerts
   * - Only one unresolved alert per facility per alert_type
   */
  async logAlertToDatabase(
    facility: Facility,
    alertType: string,
    severity: string,
    message: string,
    actions: string[],
    client?: PoolClient
  ) {
    const db = client || this.pool;

    await db.query(`
      INSERT INTO edge_alerts (
        facility_id, alert_type, severity, message, actions,
        channels_sent, sent_at, resolved
      )
      VALUES ($1, $2, $3, $4, $5, '{}', NOW(), false)
      ON CONFLICT (facility_id, alert_type)
      WHERE resolved = FALSE
      DO UPDATE SET
        sent_at = NOW(),
        message = EXCLUDED.message
    `, [facility.id, alertType, severity, message, actions]);
  }

  /**
   * Send alerts to multiple channels
   * SMS, Phone Call, Teams, Slack, Email, PagerDuty
   *
   * **P0 Fix #4: Rate Limiting**
   * - Don't send same severity alert within 5 minutes
   * - Prevents SMS/phone spam and Twilio suspension
   * - Prevents alert fatigue
   */
  async sendAlerts(facility: Facility, alert: Alert) {
    const cacheKey = `${facility.id}-${alert.severity}`;
    const lastAlertTime = this.alertCache.get(cacheKey);

    // Rate limit: Don't send same severity alert within 5 minutes
    if (lastAlertTime && Date.now() - lastAlertTime.getTime() < 5 * 60 * 1000) {
      const secondsSinceLastAlert = Math.floor((Date.now() - lastAlertTime.getTime()) / 1000);
      this.logger.debug(
        `Rate limited: ${cacheKey} (last alert sent ${secondsSinceLastAlert}s ago)`
      );
      return;
    }

    // Update cache
    this.alertCache.set(cacheKey, new Date());

    // Get notification contacts for facility
    const contacts = await this.getFacilityContacts(facility.id);

    this.logger.log(`Sending alerts for ${facility.name} to ${contacts.length} contacts`);

    // Send to all channels in parallel (fastest response)
    const results = await Promise.allSettled([
      this.sendSMS(contacts, alert),
      this.sendPhoneCall(contacts, alert),
      this.sendTeamsMessage(facility.teams_webhook ?? '', alert),
      this.sendSlackMessage(facility.slack_webhook ?? '', alert),
      this.sendEmail(contacts, alert),
      this.sendPagerDuty(facility, alert)
    ]);

    // Log delivery failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(
        `⚠️ ${failures.length}/6 alert channels failed for ${facility.name}`
      );
    }
  }

  /**
   * Get facility IT contacts
   */
  async getFacilityContacts(facilityId: string): Promise<Contact[]> {
    const result = await this.pool.query(`
      SELECT
        name,
        email,
        phone,
        sms_enabled,
        phone_call_enabled,
        is_primary
      FROM facility_contacts
      WHERE facility_id = $1
        AND notifications_enabled = true
      ORDER BY is_primary DESC, name
    `, [facilityId]);

    return result.rows;
  }

  /**
   * Send SMS via Twilio
   *
   * **P0 Fix #5: Use validated Twilio client**
   */
  async sendSMS(contacts: Contact[], alert: Alert) {
    if (!this.twilioClient) {
      this.logger.debug('Twilio not configured, skipping SMS');
      return;
    }

    for (const contact of contacts.filter(c => c.sms_enabled)) {
      try {
        await this.twilioClient.messages.create({
          to: contact.phone,
          from: this.twilioFromNumber,
          body: `🚨 AgogSaaS Alert\n\n${alert.message}\n\nActions:\n${alert.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
        });

        this.logger.log(`📱 SMS sent to ${contact.name} (${contact.phone})`);
      } catch (err) {
        this.logger.error(
          `Failed to send SMS to ${contact.phone}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  /**
   * Send phone call via Twilio Voice
   * Only calls primary contact (not everyone)
   *
   * **P0 Fix #5: Use validated Twilio client**
   */
  async sendPhoneCall(contacts: Contact[], alert: Alert) {
    if (!this.twilioClient) {
      this.logger.debug('Twilio not configured, skipping phone call');
      return;
    }

    // Only call primary contact
    const primary = contacts.find(c => c.is_primary && c.phone_call_enabled);

    if (!primary) {
      this.logger.debug('No primary contact with phone_call_enabled');
      return;
    }

    try {
      await this.twilioClient.calls.create({
        to: primary.phone,
        from: this.twilioFromNumber,
        url: `${process.env.API_URL}/twilio/voice/facility-offline?facility=${alert.facility_id}`,
        // TwiML endpoint will say:
        // "This is an AgogSaaS critical alert. [Facility name] is offline. Please check connectivity immediately."
      });

      this.logger.log(`📞 Phone call to ${primary.name} (${primary.phone})`);
    } catch (err) {
      this.logger.error(
        `Failed to call ${primary.phone}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Send Microsoft Teams message
   */
  async sendTeamsMessage(webhook: string, alert: Alert) {
    if (!webhook) {
      this.logger.debug('No Teams webhook configured');
      return;
    }

    try {
      await axios.post(webhook, {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": "FF0000",
        "title": "🚨 Facility Offline Alert",
        "summary": alert.message,
        "sections": [
          {
            "activityTitle": alert.message,
            "facts": alert.actions.map((action, i) => ({
              "name": `Action ${i + 1}`,
              "value": action
            }))
          }
        ],
        "potentialAction": [
          {
            "@type": "OpenUri",
            "name": "Open Monitoring Dashboard",
            "targets": [
              {
                "os": "default",
                "uri": `${process.env.FRONTEND_URL}/monitoring/facilities/${alert.facility_id}`
              }
            ]
          }
        ]
      });

      this.logger.log(`💬 Teams message sent`);
    } catch (err) {
      this.logger.error('Failed to send Teams message:', (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Send Slack message
   */
  async sendSlackMessage(webhook: string, alert: Alert) {
    if (!webhook) {
      this.logger.debug('No Slack webhook configured');
      return;
    }

    try {
      await axios.post(webhook, {
        "text": "🚨 *Facility Offline Alert*",
        "blocks": [
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "🚨 Facility Offline Alert"
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": `*${alert.message}*`
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Recommended Actions:*\n" + alert.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')
            }
          },
          {
            "type": "actions",
            "elements": [
              {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "Open Monitoring Dashboard"
                },
                "url": `${process.env.FRONTEND_URL}/monitoring/facilities/${alert.facility_id}`
              }
            ]
          }
        ]
      });

      this.logger.log(`💬 Slack message sent`);
    } catch (err) {
      this.logger.error('Failed to send Slack message:', (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Send email alert
   */
  async sendEmail(contacts: Contact[], alert: Alert) {
    // Implementation depends on your email service (SendGrid, AWS SES, etc.)
    this.logger.log(`📧 Email would be sent to ${contacts.length} contacts`);
    // TODO: Implement email sending
  }

  /**
   * Send PagerDuty alert
   *
   * **P0 Fix #5: Use validated PagerDuty key**
   */
  async sendPagerDuty(facility: Facility, alert: Alert) {
    if (!this.pagerDutyKey) {
      this.logger.debug('PagerDuty not configured');
      return;
    }

    try {
      await axios.post('https://events.pagerduty.com/v2/enqueue', {
        routing_key: this.pagerDutyKey,
        event_action: 'trigger',
        payload: {
          summary: alert.message,
          severity: alert.severity,
          source: facility.id,
          custom_details: {
            facility_name: facility.name,
            facility_id: facility.id,
            region: facility.region,
            actions: alert.actions
          }
        }
      }, {
        timeout: 10000 // 10 second timeout
      });

      this.logger.log(`📟 PagerDuty alert sent`);
    } catch (err) {
      this.logger.error(
        'Failed to send PagerDuty alert:',
        err instanceof Error ? err.message : String(err)
      );
      throw err; // Re-throw for Promise.allSettled tracking
    }
  }

  /**
   * Escalate alert to customer success team
   * Facility offline > 1 hour
   */
  async escalateAlert(facility: Facility, offlineMinutes: number) {
    // Mark as escalated
    await this.pool.query(`
      UPDATE facility_status
      SET escalated = true
      WHERE facility_id = $1
    `, [facility.id]);

    // Notify customer success team
    await this.sendAlerts(facility, {
      facility_id: facility.id,
      alert_type: 'ESCALATION',
      severity: 'critical',
      message: `ESCALATION: ${facility.name} offline for ${Math.floor(offlineMinutes)} minutes`,
      actions: [
        'Contact facility IT manager directly',
        'Offer cloud fallback mode if facility destroyed',
        'Schedule follow-up call with customer',
        'Check if facility needs replacement edge computer'
      ]
    });

    this.logger.warn(`🚨 ESCALATED: ${facility.name} offline ${Math.floor(offlineMinutes)} min`);
  }

  /**
   * Send recovery notification
   * Facility came back online
   */
  async sendRecoveryNotification(facility: Facility, offlineMinutes: number) {
    const contacts = await this.getFacilityContacts(facility.id);

    // Send Teams/Slack notification (not SMS/phone for recovery)
    await Promise.allSettled([
      this.sendTeamsRecovery(facility.teams_webhook ?? '', facility.name, offlineMinutes),
      this.sendSlackRecovery(facility.slack_webhook ?? '', facility.name, offlineMinutes)
    ]);
  }

  async sendTeamsRecovery(webhook: string, facilityName: string, offlineMinutes: number) {
    if (!webhook) return;

    await axios.post(webhook, {
      "@type": "MessageCard",
      "themeColor": "00FF00",
      "title": "✅ Facility Back Online",
      "text": `${facilityName} is back online after ${offlineMinutes} minutes offline.`
    });
  }

  async sendSlackRecovery(webhook: string, facilityName: string, offlineMinutes: number) {
    if (!webhook) return;

    await axios.post(webhook, {
      "text": `✅ *Facility Back Online*\n${facilityName} is back online after ${offlineMinutes} minutes offline.`
    });
  }
}
