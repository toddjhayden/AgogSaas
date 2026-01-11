/**
 * Webhook Event Publisher Service
 * REQ-1767925582664-n6du5
 *
 * Publishes application events and creates delivery tasks for matching subscriptions
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import {
  PublishWebhookEventDto,
  WebhookEventDto,
  ListWebhookEventsDto,
} from '../dto/webhook.dto';
import { WebhookSubscriptionService } from './webhook-subscription.service';

@Injectable()
export class WebhookEventPublisherService {
  private readonly logger = new Logger(WebhookEventPublisherService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly subscriptionService: WebhookSubscriptionService,
  ) {}

  /**
   * Publish a webhook event
   * This creates the event record and schedules deliveries to matching subscriptions
   */
  async publishEvent(dto: PublishWebhookEventDto): Promise<WebhookEventDto> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [dto.tenantId]);

      // Validate event type exists
      const eventTypeResult = await client.query(
        `SELECT event_type, is_enabled FROM webhook_event_types WHERE event_type = $1`,
        [dto.eventType]
      );

      if (eventTypeResult.rows.length === 0) {
        this.logger.warn(`Unknown event type: ${dto.eventType}`);
        // Continue anyway - this allows for dynamic event types
      } else if (!eventTypeResult.rows[0].is_enabled) {
        this.logger.warn(`Event type is disabled: ${dto.eventType}`);
        await client.query('ROLLBACK');
        return null as any; // Skip publishing disabled events
      }

      // Create event record
      const eventResult = await client.query(
        `INSERT INTO webhook_events (
          tenant_id, event_type, event_version, event_timestamp,
          event_data, event_metadata, source_entity_type, source_entity_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          dto.tenantId,
          dto.eventType,
          '1.0', // Default version
          new Date(),
          JSON.stringify(dto.eventData),
          dto.eventMetadata ? JSON.stringify(dto.eventMetadata) : null,
          dto.sourceEntityType || null,
          dto.sourceEntityId || null,
        ]
      );

      const event = eventResult.rows[0];

      // Get matching subscriptions
      const subscriptions = await this.subscriptionService.getMatchingSubscriptions(
        dto.tenantId,
        dto.eventType
      );

      this.logger.log(`Found ${subscriptions.length} matching subscriptions for event ${dto.eventType}`);

      // Create delivery records for each matching subscription
      for (const subscription of subscriptions) {
        // Check if event matches subscription filters
        if (subscription.eventFilters && !this.matchesFilters(dto.eventData, subscription.eventFilters)) {
          this.logger.debug(`Event does not match filters for subscription ${subscription.id}`);
          continue;
        }

        // Check rate limits
        const rateLimitOk = await this.checkRateLimit(client, subscription.id, dto.tenantId);
        if (!rateLimitOk) {
          this.logger.warn(`Rate limit exceeded for subscription ${subscription.id}`);
          continue;
        }

        // Create delivery payload
        const deliveryPayload = {
          event_id: event.id,
          event_type: dto.eventType,
          event_timestamp: event.event_timestamp.toISOString(),
          data: dto.eventData,
          metadata: dto.eventMetadata || {},
        };

        // Generate signature
        const signature = this.subscriptionService.generateSignature(
          JSON.stringify(deliveryPayload),
          subscription.secretKey,
          subscription.signatureAlgorithm
        );

        // Create delivery record
        await client.query(
          `INSERT INTO webhook_deliveries (
            tenant_id, subscription_id, event_id, attempt_number,
            delivery_status, request_url, request_headers, request_body,
            request_signature, retry_count, next_retry_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            dto.tenantId,
            subscription.id,
            event.id,
            1, // First attempt
            'PENDING',
            subscription.endpointUrl,
            JSON.stringify({
              'Content-Type': 'application/json',
              [subscription.signatureHeader]: signature,
              ...subscription.customHeaders,
            }),
            JSON.stringify(deliveryPayload),
            signature,
            0, // retry_count
            new Date(), // Schedule for immediate delivery
          ]
        );
      }

      // Update event with subscription match count
      await client.query(
        `UPDATE webhook_events
        SET total_subscriptions_matched = $1, total_deliveries_pending = $1
        WHERE id = $2`,
        [subscriptions.length, event.id]
      );

      // Update event type statistics
      await client.query(
        `UPDATE webhook_event_types
        SET total_events_published = total_events_published + 1,
            last_published_at = NOW()
        WHERE event_type = $1`,
        [dto.eventType]
      );

      await client.query('COMMIT');

      this.logger.log(`Published event ${event.id} of type ${dto.eventType} with ${subscriptions.length} deliveries`);

      return this.mapRowToDto(event);

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to publish webhook event: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a webhook event by ID
   */
  async getEvent(eventId: string, tenantId: string): Promise<WebhookEventDto> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(
        `SELECT * FROM webhook_events WHERE id = $1 AND tenant_id = $2`,
        [eventId, tenantId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Webhook event ${eventId} not found`);
      }

      return this.mapRowToDto(result.rows[0]);

    } finally {
      client.release();
    }
  }

  /**
   * List webhook events
   */
  async listEvents(dto: ListWebhookEventsDto): Promise<WebhookEventDto[]> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [dto.tenantId]);

      const conditions: string[] = ['tenant_id = $1'];
      const values: any[] = [dto.tenantId];
      let paramIndex = 2;

      if (dto.eventType) {
        conditions.push(`event_type = $${paramIndex++}`);
        values.push(dto.eventType);
      }

      if (dto.sourceEntityType) {
        conditions.push(`source_entity_type = $${paramIndex++}`);
        values.push(dto.sourceEntityType);
      }

      if (dto.sourceEntityId) {
        conditions.push(`source_entity_id = $${paramIndex++}`);
        values.push(dto.sourceEntityId);
      }

      if (dto.startDate) {
        conditions.push(`event_timestamp >= $${paramIndex++}`);
        values.push(dto.startDate);
      }

      if (dto.endDate) {
        conditions.push(`event_timestamp <= $${paramIndex++}`);
        values.push(dto.endDate);
      }

      const limit = dto.limit ?? 100;
      const offset = dto.offset ?? 0;

      const result = await client.query(
        `SELECT * FROM webhook_events
        WHERE ${conditions.join(' AND ')}
        ORDER BY event_timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset]
      );

      return result.rows.map(row => this.mapRowToDto(row));

    } finally {
      client.release();
    }
  }

  /**
   * Check if event data matches subscription filters
   */
  private matchesFilters(eventData: Record<string, any>, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      const eventValue = eventData[key];

      // Handle special filter operators
      if (typeof value === 'object' && value !== null) {
        // Greater than or equal
        if ('$gte' in value && eventValue < value.$gte) return false;
        // Less than or equal
        if ('$lte' in value && eventValue > value.$lte) return false;
        // In array
        if ('$in' in value && !value.$in.includes(eventValue)) return false;
        // Not in array
        if ('$nin' in value && value.$nin.includes(eventValue)) return false;
      } else {
        // Exact match
        if (eventValue !== value) return false;
      }
    }

    return true;
  }

  /**
   * Check rate limits for a subscription
   */
  private async checkRateLimit(client: any, subscriptionId: string, tenantId: string): Promise<boolean> {
    // Get subscription rate limits
    const subResult = await client.query(
      `SELECT max_events_per_minute, max_events_per_hour, max_events_per_day
      FROM webhook_subscriptions
      WHERE id = $1 AND tenant_id = $2`,
      [subscriptionId, tenantId]
    );

    if (subResult.rows.length === 0) return false;

    const limits = subResult.rows[0];

    // Check per-minute limit
    if (limits.max_events_per_minute) {
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM webhook_deliveries
        WHERE subscription_id = $1
          AND created_at >= NOW() - INTERVAL '1 minute'`,
        [subscriptionId]
      );

      if (parseInt(countResult.rows[0].count) >= limits.max_events_per_minute) {
        return false;
      }
    }

    // Check per-hour limit
    if (limits.max_events_per_hour) {
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM webhook_deliveries
        WHERE subscription_id = $1
          AND created_at >= NOW() - INTERVAL '1 hour'`,
        [subscriptionId]
      );

      if (parseInt(countResult.rows[0].count) >= limits.max_events_per_hour) {
        return false;
      }
    }

    // Check per-day limit
    if (limits.max_events_per_day) {
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM webhook_deliveries
        WHERE subscription_id = $1
          AND created_at >= NOW() - INTERVAL '1 day'`,
        [subscriptionId]
      );

      if (parseInt(countResult.rows[0].count) >= limits.max_events_per_day) {
        return false;
      }
    }

    return true;
  }

  /**
   * Map database row to DTO
   */
  private mapRowToDto(row: any): WebhookEventDto {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      eventVersion: row.event_version,
      eventTimestamp: row.event_timestamp,
      eventData: row.event_data,
      eventMetadata: row.event_metadata,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      totalSubscriptionsMatched: row.total_subscriptions_matched,
      totalDeliveriesSucceeded: row.total_deliveries_succeeded,
      totalDeliveriesFailed: row.total_deliveries_failed,
      totalDeliveriesPending: row.total_deliveries_pending,
      createdAt: row.created_at,
    };
  }
}
