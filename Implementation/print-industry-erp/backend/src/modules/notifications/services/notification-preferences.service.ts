/**
 * Notification Preferences Service
 * REQ: REQ-1767925582665-67qxb
 *
 * Manages user notification preferences and quiet hours.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface NotificationPreference {
  id: string;
  tenantId: string;
  userId: string;
  notificationTypeId: string;
  channel: string;
  isEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Get enabled channels for a user and notification type
   */
  async getEnabledChannels(
    tenantId: string,
    userId: string,
    notificationTypeCode: string,
  ): Promise<string[]> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query(
        `SELECT unp.channel
         FROM user_notification_preferences unp
         JOIN notification_types nt ON nt.id = unp.notification_type_id
         WHERE unp.tenant_id = $1
           AND unp.user_id = $2
           AND nt.code = $3
           AND unp.is_enabled = TRUE`,
        [tenantId, userId, notificationTypeCode],
      );

      if (result.rows.length === 0) {
        // No preferences set, use notification type defaults
        const defaultResult = await client.query(
          `SELECT default_channel FROM notification_types WHERE code = $1`,
          [notificationTypeCode],
        );

        if (defaultResult.rows.length > 0) {
          return [defaultResult.rows[0].default_channel];
        }

        return ['IN_APP']; // Fallback default
      }

      return result.rows.map((row) => row.channel);
    } finally {
      client.release();
    }
  }

  /**
   * Check if user is in quiet hours
   */
  async isInQuietHours(tenantId: string, userId: string): Promise<boolean> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query(
        `SELECT quiet_hours_start, quiet_hours_end
         FROM user_notification_preferences
         WHERE tenant_id = $1
           AND user_id = $2
           AND quiet_hours_start IS NOT NULL
           AND quiet_hours_end IS NOT NULL
         LIMIT 1`,
        [tenantId, userId],
      );

      if (result.rows.length === 0) {
        return false; // No quiet hours set
      }

      const { quiet_hours_start, quiet_hours_end } = result.rows[0];
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

      // Simple comparison (doesn't handle overnight ranges)
      return currentTime >= quiet_hours_start && currentTime <= quiet_hours_end;
    } finally {
      client.release();
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreference(
    tenantId: string,
    userId: string,
    notificationTypeCode: string,
    channel: string,
    isEnabled: boolean,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      // Get notification type ID
      const typeResult = await client.query(
        `SELECT id FROM notification_types WHERE code = $1`,
        [notificationTypeCode],
      );

      if (typeResult.rows.length === 0) {
        throw new Error(`Notification type ${notificationTypeCode} not found`);
      }

      const notificationTypeId = typeResult.rows[0].id;

      // Upsert preference
      await client.query(
        `INSERT INTO user_notification_preferences
         (tenant_id, user_id, notification_type_id, channel, is_enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, user_id, notification_type_id, channel)
         DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           updated_at = CURRENT_TIMESTAMP`,
        [tenantId, userId, notificationTypeId, channel, isEnabled],
      );

      this.logger.log(
        `Updated preference for user ${userId}: ${notificationTypeCode}/${channel} = ${isEnabled}`,
      );
    } finally {
      client.release();
    }
  }

  /**
   * Set quiet hours for user
   */
  async setQuietHours(
    tenantId: string,
    userId: string,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      await client.query(
        `UPDATE user_notification_preferences
         SET quiet_hours_start = $1,
             quiet_hours_end = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $3 AND user_id = $4`,
        [startTime, endTime, tenantId, userId],
      );

      this.logger.log(
        `Set quiet hours for user ${userId}: ${startTime} - ${endTime}`,
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get all preferences for a user
   */
  async getUserPreferences(
    tenantId: string,
    userId: string,
  ): Promise<NotificationPreference[]> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query(
        `SELECT * FROM user_notification_preferences
         WHERE tenant_id = $1 AND user_id = $2
         ORDER BY notification_type_id, channel`,
        [tenantId, userId],
      );

      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        notificationTypeId: row.notification_type_id,
        channel: row.channel,
        isEnabled: row.is_enabled,
        quietHoursStart: row.quiet_hours_start,
        quietHoursEnd: row.quiet_hours_end,
      }));
    } finally {
      client.release();
    }
  }
}
