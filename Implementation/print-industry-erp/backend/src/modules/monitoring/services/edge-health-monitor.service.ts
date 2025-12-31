import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import axios from 'axios';

interface Facility {
  id: string;
  name: string;
  tenant_id: string;
  edge_vpn_hostname: string;
  region: string;
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
 */
@Injectable()
export class EdgeHealthMonitorService {
  private readonly logger = new Logger(EdgeHealthMonitorService.name);

  constructor(
    private readonly pool: Pool
  ) {}

  /**
   * Run every 30 seconds
   * Checks health of ALL edge facilities
   */
  @Cron('*/30 * * * * *')
  async checkAllEdgeFacilities() {
    this.logger.debug('Checking all edge facilities...');

    const facilities = await this.getFacilities();

    for (const facility of facilities) {
      try {
        const isHealthy = await this.checkFacilityHealth(facility);

        if (!isHealthy) {
          await this.handleFacilityOffline(facility);
        } else {
          await this.handleFacilityOnline(facility);
        }
      } catch (err) {
        this.logger.error(`Error checking facility ${facility.id}:`, err);
      }
    }
  }

  /**
   * Get all facilities from database
   */
  async getFacilities(): Promise<Facility[]> {
    const result = await this.pool.query(`
      SELECT
        id,
        name,
        tenant_id,
        edge_vpn_hostname,
        region,
        teams_webhook,
        slack_webhook
      FROM facilities
      WHERE mode = 'normal'  -- Skip facilities in cloud_fallback mode
      ORDER BY name
    `);

    return result.rows;
  }

  /**
   * Check if single facility is healthy
   * Timeout after 5 seconds
   */
  async checkFacilityHealth(facility: Facility): Promise<boolean> {
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
      }

      return healthy;
    } catch (err) {
      this.logger.warn(`Facility ${facility.name} health check failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Handle facility going offline
   * Sends alerts on initial failure, escalates after 1 hour
   */
  async handleFacilityOffline(facility: Facility) {
    const status = await this.getFacilityStatus(facility.id);

    if (status.online) {
      // JUST went offline - trigger initial alerts
      await this.markFacilityOffline(facility.id);

      this.logger.error(`🚨 FACILITY OFFLINE: ${facility.name} (${facility.id})`);

      // Send multi-channel alerts to facility IT staff
      await this.sendAlerts(facility, {
        facility_id: facility.id,
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
      // Already offline - check if we should escalate
      const offlineDuration = Date.now() - status.offline_since.getTime();
      const offlineMinutes = offlineDuration / 1000 / 60;

      if (offlineMinutes > 60 && !status.escalated) {
        // Offline for > 1 hour - escalate to customer success
        this.logger.warn(`⚠️ ESCALATING: ${facility.name} offline ${offlineMinutes.toFixed(0)} minutes`);
        await this.escalateAlert(facility, offlineMinutes);
      }
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
      const offlineDuration = Date.now() - status.offline_since.getTime();
      const offlineMinutes = Math.floor(offlineDuration / 1000 / 60);

      await this.markFacilityOnline(facility.id);

      this.logger.log(`✅ FACILITY ONLINE: ${facility.name} (was offline ${offlineMinutes} min)`);

      // Send recovery notification
      await this.sendRecoveryNotification(facility, offlineMinutes);
    }
  }

  /**
   * Get current facility status
   */
  async getFacilityStatus(facilityId: string): Promise<FacilityStatus> {
    const result = await this.pool.query(`
      SELECT online, offline_since, last_sync, escalated
      FROM facility_status
      WHERE facility_id = $1
    `, [facilityId]);

    if (result.rows.length === 0) {
      // Initialize status
      await this.pool.query(`
        INSERT INTO facility_status (facility_id, online, last_sync)
        VALUES ($1, true, NOW())
      `, [facilityId]);

      return { online: true, escalated: false };
    }

    return result.rows[0];
  }

  /**
   * Mark facility as offline
   */
  async markFacilityOffline(facilityId: string) {
    await this.pool.query(`
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
   */
  async markFacilityOnline(facilityId: string) {
    await this.pool.query(`
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
   * Send alerts to multiple channels
   * SMS, Phone Call, Teams, Slack, Email, PagerDuty
   */
  async sendAlerts(facility: Facility, alert: Alert) {
    // Get notification contacts for facility
    const contacts = await this.getFacilityContacts(facility.id);

    this.logger.log(`Sending alerts for ${facility.name} to ${contacts.length} contacts`);

    // Send to all channels in parallel (fastest response)
    await Promise.allSettled([
      this.sendSMS(contacts, alert),
      this.sendPhoneCall(contacts, alert),
      this.sendTeamsMessage(facility.teams_webhook, alert),
      this.sendSlackMessage(facility.slack_webhook, alert),
      this.sendEmail(contacts, alert),
      this.sendPagerDuty(facility, alert)
    ]);
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
   */
  async sendSMS(contacts: Contact[], alert: Alert) {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
      this.logger.warn('Twilio not configured, skipping SMS');
      return;
    }

    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

    for (const contact of contacts.filter(c => c.sms_enabled)) {
      try {
        await twilio.messages.create({
          to: contact.phone,
          from: process.env.TWILIO_FROM_NUMBER,
          body: `🚨 AgogSaaS Alert\n\n${alert.message}\n\nActions:\n${alert.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
        });

        this.logger.log(`📱 SMS sent to ${contact.name} (${contact.phone})`);
      } catch (err) {
        this.logger.error(`Failed to send SMS to ${contact.phone}:`, err.message);
      }
    }
  }

  /**
   * Send phone call via Twilio Voice
   * Only calls primary contact (not everyone)
   */
  async sendPhoneCall(contacts: Contact[], alert: Alert) {
    if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
      this.logger.warn('Twilio not configured, skipping phone call');
      return;
    }

    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

    // Only call primary contact
    const primary = contacts.find(c => c.is_primary && c.phone_call_enabled);

    if (!primary) {
      this.logger.warn('No primary contact with phone_call_enabled');
      return;
    }

    try {
      await twilio.calls.create({
        to: primary.phone,
        from: process.env.TWILIO_FROM_NUMBER,
        url: `${process.env.API_URL}/twilio/voice/facility-offline?facility=${alert.facility_id}`,
        // TwiML endpoint will say:
        // "This is an AgogSaaS critical alert. [Facility name] is offline. Please check connectivity immediately."
      });

      this.logger.log(`📞 Phone call to ${primary.name} (${primary.phone})`);
    } catch (err) {
      this.logger.error(`Failed to call ${primary.phone}:`, err.message);
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
      this.logger.error('Failed to send Teams message:', err.message);
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
      this.logger.error('Failed to send Slack message:', err.message);
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
   */
  async sendPagerDuty(facility: Facility, alert: Alert) {
    if (!process.env.PAGERDUTY_INTEGRATION_KEY) {
      this.logger.warn('PagerDuty not configured');
      return;
    }

    try {
      await axios.post('https://events.pagerduty.com/v2/enqueue', {
        routing_key: process.env.PAGERDUTY_INTEGRATION_KEY,
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
      });

      this.logger.log(`📟 PagerDuty alert sent`);
    } catch (err) {
      this.logger.error('Failed to send PagerDuty alert:', err.message);
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
      this.sendTeamsRecovery(facility.teams_webhook, facility.name, offlineMinutes),
      this.sendSlackRecovery(facility.slack_webhook, facility.name, offlineMinutes)
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
