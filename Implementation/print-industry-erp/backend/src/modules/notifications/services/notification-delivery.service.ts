/**
 * Notification Delivery Service
 * REQ: REQ-1767925582665-67qxb
 *
 * Handles delivery of notifications through multiple channels.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { EmailNotificationChannel } from '../channels/email-notification.channel';
import { InAppNotificationChannel } from '../channels/in-app-notification.channel';
import { NatsNotificationChannel } from '../channels/nats-notification.channel';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';

export interface DeliveryChannel {
  send(
    recipientAddress: string,
    subject: string,
    body: string,
    metadata?: Record<string, any>,
  ): Promise<string | null>;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);
  private channels: Map<string, DeliveryChannel>;

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly templateService: NotificationTemplateService,
    private readonly emailChannel: EmailNotificationChannel,
    private readonly inAppChannel: InAppNotificationChannel,
    private readonly natsChannel: NatsNotificationChannel,
  ) {
    this.channels = new Map([
      ['EMAIL', emailChannel],
      ['IN_APP', inAppChannel],
      ['NATS', natsChannel],
    ]);
  }

  /**
   * Deliver notification through specified channels
   */
  async deliverNotification(
    notificationId: string,
    tenantId: string,
    userId: string,
    notificationTypeCode: string,
    requestedChannels: string[],
    templateVariables: Record<string, any>,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      // 1. Get user preferences for this notification type
      const enabledChannels = await this.preferencesService.getEnabledChannels(
        tenantId,
        userId,
        notificationTypeCode,
      );

      // 2. Filter channels based on user preferences
      const channelsToUse = requestedChannels.filter((channel) =>
        enabledChannels.includes(channel),
      );

      if (channelsToUse.length === 0) {
        this.logger.warn(
          `No enabled channels for notification ${notificationId}, user ${userId}`,
        );
        return;
      }

      // 3. Check quiet hours
      const inQuietHours = await this.preferencesService.isInQuietHours(
        tenantId,
        userId,
      );

      if (inQuietHours) {
        // Only deliver CRITICAL priority notifications during quiet hours
        const notification = await this.getNotification(notificationId);
        if (notification && notification.priority !== 'CRITICAL') {
          this.logger.log(
            `Skipping notification ${notificationId} - user in quiet hours`,
          );
          await this.recordDeliverySkipped(
            notificationId,
            channelsToUse,
            'QUIET_HOURS',
          );
          return;
        }
      }

      // 4. Get recipient addresses
      const recipientInfo = await this.getRecipientInfo(tenantId, userId);

      // 5. Deliver through each channel
      for (const channelName of channelsToUse) {
        try {
          await this.deliverThroughChannel(
            notificationId,
            channelName,
            recipientInfo,
            notificationTypeCode,
            templateVariables,
          );
        } catch (error) {
          this.logger.error(
            `Failed to deliver notification ${notificationId} through ${channelName}:`,
            error,
          );
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Deliver through a specific channel
   */
  private async deliverThroughChannel(
    notificationId: string,
    channelName: string,
    recipientInfo: any,
    notificationTypeCode: string,
    templateVariables: Record<string, any>,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      // 1. Create delivery record
      const deliveryId = await this.createDeliveryRecord(
        notificationId,
        channelName,
        recipientInfo[channelName.toLowerCase()],
      );

      // 2. Get template and render
      const { subject, body } = await this.templateService.renderTemplate(
        recipientInfo.tenantId,
        notificationTypeCode,
        channelName,
        templateVariables,
      );

      // 3. Send through channel
      const channel = this.channels.get(channelName);
      if (!channel) {
        throw new Error(`Channel ${channelName} not found`);
      }

      await this.updateDeliveryStatus(deliveryId, 'SENDING');

      const externalId = await channel.send(
        recipientInfo[channelName.toLowerCase()],
        subject,
        body,
        { notificationId, deliveryId },
      );

      // 4. Update delivery record
      await this.updateDeliverySuccess(deliveryId, externalId);

      this.logger.log(
        `Notification ${notificationId} delivered via ${channelName}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateDeliveryFailed(
        await this.getDeliveryId(notificationId, channelName),
        errorMessage,
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create delivery record
   */
  private async createDeliveryRecord(
    notificationId: string,
    channel: string,
    recipientAddress: string,
  ): Promise<string> {
    const client = await this.db.connect();

    try {
      const result = await client.query(
        `INSERT INTO notification_deliveries
         (notification_id, channel, recipient_address, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [notificationId, channel, recipientAddress, 'PENDING'],
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Update delivery status
   */
  private async updateDeliveryStatus(
    deliveryId: string,
    status: string,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `UPDATE notification_deliveries
         SET status = $1,
             attempt_count = attempt_count + 1,
             last_attempt_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [status, deliveryId],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update delivery success
   */
  private async updateDeliverySuccess(
    deliveryId: string,
    externalId: string | null,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `UPDATE notification_deliveries
         SET status = $1,
             delivered_at = CURRENT_TIMESTAMP,
             external_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['DELIVERED', externalId, deliveryId],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update delivery failed
   */
  private async updateDeliveryFailed(
    deliveryId: string,
    errorMessage: string,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(
        `UPDATE notification_deliveries
         SET status = $1,
             failed_at = CURRENT_TIMESTAMP,
             error_message = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['FAILED', errorMessage, deliveryId],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Record delivery skipped
   */
  private async recordDeliverySkipped(
    notificationId: string,
    channels: string[],
    reason: string,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      for (const channel of channels) {
        await client.query(
          `INSERT INTO notification_deliveries
           (notification_id, channel, status, error_message)
           VALUES ($1, $2, $3, $4)`,
          [notificationId, channel, 'SKIPPED', reason],
        );
      }
    } finally {
      client.release();
    }
  }

  /**
   * Get notification details
   */
  private async getNotification(notificationId: string): Promise<any> {
    const client = await this.db.connect();

    try {
      const result = await client.query(
        `SELECT * FROM notifications WHERE id = $1`,
        [notificationId],
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  /**
   * Get recipient information
   */
  private async getRecipientInfo(
    tenantId: string,
    userId: string,
  ): Promise<any> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query(
        `SELECT email, phone_number
         FROM users
         WHERE id = $1 AND tenant_id = $2`,
        [userId, tenantId],
      );

      if (result.rows.length === 0) {
        throw new Error(`User ${userId} not found`);
      }

      const user = result.rows[0];

      return {
        tenantId,
        userId,
        email: user.email,
        phone: user.phone_number,
        in_app: userId, // For in-app, we just need the user ID
        nats: `agog.notifications.user.${userId}`, // NATS topic for user
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get delivery ID
   */
  private async getDeliveryId(
    notificationId: string,
    channel: string,
  ): Promise<string> {
    const client = await this.db.connect();

    try {
      const result = await client.query(
        `SELECT id FROM notification_deliveries
         WHERE notification_id = $1 AND channel = $2
         ORDER BY created_at DESC LIMIT 1`,
        [notificationId, channel],
      );

      return result.rows.length > 0 ? result.rows[0].id : '';
    } finally {
      client.release();
    }
  }
}
