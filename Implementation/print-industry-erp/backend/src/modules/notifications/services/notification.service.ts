/**
 * Notification Service
 * REQ: REQ-1767925582665-67qxb
 *
 * Core service for creating and managing notifications across the system.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationTemplateService } from './notification-template.service';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  notificationTypeCode: string;
  title: string;
  message: string;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  category?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  metadata?: Record<string, any>;
  expiresInHours?: number;
  channels?: string[];
  templateVariables?: Record<string, any>;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  notificationTypeId: string;
  title: string;
  message: string;
  severity: string;
  priority: string;
  category: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  metadata: Record<string, any>;
  isRead: boolean;
  readAt: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  /**
   * Create a new notification and deliver it through configured channels
   */
  async createNotification(input: CreateNotificationInput): Promise<string> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [input.tenantId]);

      // 1. Get notification type
      const typeResult = await client.query(
        `SELECT id, default_channel, priority
         FROM notification_types
         WHERE code = $1`,
        [input.notificationTypeCode],
      );

      if (typeResult.rows.length === 0) {
        throw new Error(`Notification type ${input.notificationTypeCode} not found`);
      }

      const notificationType = typeResult.rows[0];

      // 2. Calculate expiration time
      let expiresAt = null;
      if (input.expiresInHours) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + input.expiresInHours);
      }

      // 3. Insert notification
      const insertResult = await client.query(
        `INSERT INTO notifications (
          tenant_id, user_id, notification_type_id,
          title, message, severity, priority, category,
          source_entity_type, source_entity_id, metadata, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          input.tenantId,
          input.userId,
          notificationType.id,
          input.title,
          input.message,
          input.severity || 'INFO',
          input.priority || notificationType.priority,
          input.category || null,
          input.sourceEntityType || null,
          input.sourceEntityId || null,
          JSON.stringify(input.metadata || {}),
          expiresAt,
        ],
      );

      const notificationId = insertResult.rows[0].id;

      // 4. Log creation event
      await client.query(
        `INSERT INTO notification_events (notification_id, event_type, event_data)
         VALUES ($1, $2, $3)`,
        [notificationId, 'CREATED', JSON.stringify({ input })],
      );

      await client.query('COMMIT');

      // 5. Deliver notification through channels (async, after commit)
      setImmediate(async () => {
        try {
          await this.deliveryService.deliverNotification(
            notificationId,
            input.tenantId,
            input.userId,
            input.notificationTypeCode,
            input.channels || [notificationType.default_channel],
            input.templateVariables || {},
          );
        } catch (error) {
          this.logger.error(
            `Failed to deliver notification ${notificationId}:`,
            error,
          );
        }
      });

      this.logger.log(
        `Notification created: ${notificationId} for user ${input.userId}`,
      );

      return notificationId;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to create notification:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create bulk notifications for multiple users
   */
  async createBulkNotifications(
    input: Omit<CreateNotificationInput, 'userId'>,
    userIds: string[],
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    for (const userId of userIds) {
      try {
        const notificationId = await this.createNotification({
          ...input,
          userId,
        });
        notificationIds.push(notificationId);
      } catch (error) {
        this.logger.error(`Failed to create notification for user ${userId}:`, error);
      }
    }

    return notificationIds;
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    tenantId: string,
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      category?: string;
      severity?: string;
    } = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      let whereClause = 'WHERE tenant_id = $1 AND user_id = $2 AND is_archived = FALSE';
      const params: any[] = [tenantId, userId];
      let paramIndex = 3;

      if (options.unreadOnly) {
        whereClause += ' AND is_read = FALSE';
      }

      if (options.category) {
        whereClause += ` AND category = $${paramIndex}`;
        params.push(options.category);
        paramIndex++;
      }

      if (options.severity) {
        whereClause += ` AND severity = $${paramIndex}`;
        params.push(options.severity);
        paramIndex++;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
        params,
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get notifications
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const result = await client.query(
        `SELECT * FROM notifications ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset],
      );

      return {
        notifications: result.rows.map(this.mapNotificationRow),
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE tenant_id = $1
           AND user_id = $2
           AND is_read = FALSE
           AND is_archived = FALSE`,
        [tenantId, userId],
      );

      return parseInt(result.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      await client.query('SELECT mark_notification_read($1)', [notificationId]);

      this.logger.log(`Notification ${notificationId} marked as read`);
    } finally {
      client.release();
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(tenantId: string, userId: string): Promise<number> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1 AND user_id = $2 AND is_read = FALSE
         RETURNING id`,
        [tenantId, userId],
      );

      await client.query('COMMIT');

      return result.rowCount || 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Archive notification
   */
  async archiveNotification(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      await client.query('SELECT archive_notification($1)', [notificationId]);

      this.logger.log(`Notification ${notificationId} archived`);
    } finally {
      client.release();
    }
  }

  /**
   * Delete notification (soft delete via archive)
   */
  async deleteNotification(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.archiveNotification(tenantId, userId, notificationId);
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    tenantId: string,
    notificationId: string,
  ): Promise<Notification | null> {
    const client = await this.db.connect();

    try {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query(
        `SELECT * FROM notifications WHERE id = $1 AND tenant_id = $2`,
        [notificationId, tenantId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapNotificationRow(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Notification object
   */
  private mapNotificationRow(row: any): Notification {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      notificationTypeId: row.notification_type_id,
      title: row.title,
      message: row.message,
      severity: row.severity,
      priority: row.priority,
      category: row.category,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      metadata: row.metadata || {},
      isRead: row.is_read,
      readAt: row.read_at,
      isArchived: row.is_archived,
      archivedAt: row.archived_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
