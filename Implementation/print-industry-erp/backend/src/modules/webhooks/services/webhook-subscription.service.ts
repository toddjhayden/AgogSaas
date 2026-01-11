/**
 * Webhook Subscription Service
 * REQ-1767925582664-n6du5
 *
 * Manages webhook subscriptions for tenants
 */

import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import {
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
  WebhookSubscriptionDto,
  ListWebhookSubscriptionsDto,
  HealthStatus,
  TestWebhookResponseDto,
} from '../dto/webhook.dto';

@Injectable()
export class WebhookSubscriptionService {
  private readonly logger = new Logger(WebhookSubscriptionService.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
  ) {}

  /**
   * Create a new webhook subscription
   */
  async createSubscription(dto: CreateWebhookSubscriptionDto): Promise<WebhookSubscriptionDto> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [dto.tenantId]);

      // Validate event types exist
      const eventTypesResult = await client.query(
        `SELECT event_type FROM webhook_event_types WHERE event_type = ANY($1::text[]) AND is_enabled = true`,
        [dto.eventTypes]
      );

      const validEventTypes = eventTypesResult.rows.map(r => r.event_type);
      const invalidEventTypes = dto.eventTypes.filter(et => !validEventTypes.includes(et));

      if (invalidEventTypes.length > 0) {
        throw new BadRequestException(`Invalid or disabled event types: ${invalidEventTypes.join(', ')}`);
      }

      // Generate secure secret key for signature verification
      const secretKey = this.generateSecretKey();

      const result = await client.query(
        `INSERT INTO webhook_subscriptions (
          tenant_id, name, description, endpoint_url, is_active,
          event_types, event_filters, secret_key, signature_header, signature_algorithm,
          max_retry_attempts, retry_backoff_multiplier, initial_retry_delay_seconds, max_retry_delay_seconds,
          max_events_per_minute, max_events_per_hour, max_events_per_day,
          timeout_seconds, custom_headers, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *`,
        [
          dto.tenantId,
          dto.name,
          dto.description || null,
          dto.endpointUrl,
          true, // is_active
          dto.eventTypes,
          dto.eventFilters ? JSON.stringify(dto.eventFilters) : null,
          secretKey,
          'X-Webhook-Signature', // Default signature header
          'sha256', // Default algorithm
          dto.maxRetryAttempts ?? 5,
          dto.retryBackoffMultiplier ?? 2.0,
          dto.initialRetryDelaySeconds ?? 60,
          dto.maxRetryDelaySeconds ?? 3600,
          dto.maxEventsPerMinute || null,
          dto.maxEventsPerHour || null,
          dto.maxEventsPerDay || null,
          dto.timeoutSeconds ?? 30,
          dto.customHeaders ? JSON.stringify(dto.customHeaders) : null,
          dto.createdBy,
        ]
      );

      await client.query('COMMIT');

      this.logger.log(`Created webhook subscription ${result.rows[0].id} for tenant ${dto.tenantId}`);

      return this.mapRowToDto(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create webhook subscription: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update a webhook subscription
   */
  async updateSubscription(
    subscriptionId: string,
    tenantId: string,
    dto: UpdateWebhookSubscriptionDto
  ): Promise<WebhookSubscriptionDto> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Verify subscription exists and belongs to tenant
      const existingResult = await client.query(
        `SELECT id FROM webhook_subscriptions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [subscriptionId, tenantId]
      );

      if (existingResult.rows.length === 0) {
        throw new NotFoundException(`Webhook subscription ${subscriptionId} not found`);
      }

      // Validate event types if provided
      if (dto.eventTypes) {
        const eventTypesResult = await client.query(
          `SELECT event_type FROM webhook_event_types WHERE event_type = ANY($1::text[]) AND is_enabled = true`,
          [dto.eventTypes]
        );

        const validEventTypes = eventTypesResult.rows.map(r => r.event_type);
        const invalidEventTypes = dto.eventTypes.filter(et => !validEventTypes.includes(et));

        if (invalidEventTypes.length > 0) {
          throw new BadRequestException(`Invalid or disabled event types: ${invalidEventTypes.join(', ')}`);
        }
      }

      // Build dynamic UPDATE query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (dto.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(dto.name);
      }
      if (dto.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(dto.description);
      }
      if (dto.endpointUrl !== undefined) {
        updates.push(`endpoint_url = $${paramIndex++}`);
        values.push(dto.endpointUrl);
      }
      if (dto.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(dto.isActive);
      }
      if (dto.eventTypes !== undefined) {
        updates.push(`event_types = $${paramIndex++}`);
        values.push(dto.eventTypes);
      }
      if (dto.eventFilters !== undefined) {
        updates.push(`event_filters = $${paramIndex++}`);
        values.push(JSON.stringify(dto.eventFilters));
      }
      if (dto.maxRetryAttempts !== undefined) {
        updates.push(`max_retry_attempts = $${paramIndex++}`);
        values.push(dto.maxRetryAttempts);
      }
      if (dto.retryBackoffMultiplier !== undefined) {
        updates.push(`retry_backoff_multiplier = $${paramIndex++}`);
        values.push(dto.retryBackoffMultiplier);
      }
      if (dto.initialRetryDelaySeconds !== undefined) {
        updates.push(`initial_retry_delay_seconds = $${paramIndex++}`);
        values.push(dto.initialRetryDelaySeconds);
      }
      if (dto.maxRetryDelaySeconds !== undefined) {
        updates.push(`max_retry_delay_seconds = $${paramIndex++}`);
        values.push(dto.maxRetryDelaySeconds);
      }
      if (dto.maxEventsPerMinute !== undefined) {
        updates.push(`max_events_per_minute = $${paramIndex++}`);
        values.push(dto.maxEventsPerMinute);
      }
      if (dto.maxEventsPerHour !== undefined) {
        updates.push(`max_events_per_hour = $${paramIndex++}`);
        values.push(dto.maxEventsPerHour);
      }
      if (dto.maxEventsPerDay !== undefined) {
        updates.push(`max_events_per_day = $${paramIndex++}`);
        values.push(dto.maxEventsPerDay);
      }
      if (dto.timeoutSeconds !== undefined) {
        updates.push(`timeout_seconds = $${paramIndex++}`);
        values.push(dto.timeoutSeconds);
      }
      if (dto.customHeaders !== undefined) {
        updates.push(`custom_headers = $${paramIndex++}`);
        values.push(JSON.stringify(dto.customHeaders));
      }

      updates.push(`updated_by = $${paramIndex++}`);
      values.push(dto.updatedBy);

      updates.push(`updated_at = NOW()`);

      values.push(subscriptionId, tenantId);

      const result = await client.query(
        `UPDATE webhook_subscriptions
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++} AND deleted_at IS NULL
        RETURNING *`,
        values
      );

      await client.query('COMMIT');

      this.logger.log(`Updated webhook subscription ${subscriptionId}`);

      return this.mapRowToDto(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to update webhook subscription: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete (soft delete) a webhook subscription
   */
  async deleteSubscription(subscriptionId: string, tenantId: string, deletedBy: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(
        `UPDATE webhook_subscriptions
        SET deleted_at = NOW(), updated_by = $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [deletedBy, subscriptionId, tenantId]
      );

      if (result.rowCount === 0) {
        throw new NotFoundException(`Webhook subscription ${subscriptionId} not found`);
      }

      this.logger.log(`Deleted webhook subscription ${subscriptionId}`);

    } finally {
      client.release();
    }
  }

  /**
   * Get a webhook subscription by ID
   */
  async getSubscription(subscriptionId: string, tenantId: string): Promise<WebhookSubscriptionDto> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(
        `SELECT * FROM webhook_subscriptions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [subscriptionId, tenantId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundException(`Webhook subscription ${subscriptionId} not found`);
      }

      return this.mapRowToDto(result.rows[0]);

    } finally {
      client.release();
    }
  }

  /**
   * List webhook subscriptions
   */
  async listSubscriptions(dto: ListWebhookSubscriptionsDto): Promise<WebhookSubscriptionDto[]> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [dto.tenantId]);

      const conditions: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];
      const values: any[] = [dto.tenantId];
      let paramIndex = 2;

      if (dto.isActive !== undefined) {
        conditions.push(`is_active = $${paramIndex++}`);
        values.push(dto.isActive);
      }

      if (dto.healthStatus) {
        conditions.push(`health_status = $${paramIndex++}`);
        values.push(dto.healthStatus);
      }

      if (dto.eventType) {
        conditions.push(`$${paramIndex++} = ANY(event_types)`);
        values.push(dto.eventType);
      }

      const limit = dto.limit ?? 100;
      const offset = dto.offset ?? 0;

      const result = await client.query(
        `SELECT * FROM webhook_subscriptions
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, limit, offset]
      );

      return result.rows.map(row => this.mapRowToDto(row));

    } finally {
      client.release();
    }
  }

  /**
   * Regenerate secret key for a subscription
   */
  async regenerateSecretKey(subscriptionId: string, tenantId: string, updatedBy: string): Promise<string> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const newSecretKey = this.generateSecretKey();

      const result = await client.query(
        `UPDATE webhook_subscriptions
        SET secret_key = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
        RETURNING secret_key`,
        [newSecretKey, updatedBy, subscriptionId, tenantId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundException(`Webhook subscription ${subscriptionId} not found`);
      }

      this.logger.log(`Regenerated secret key for webhook subscription ${subscriptionId}`);

      return result.rows[0].secret_key;

    } finally {
      client.release();
    }
  }

  /**
   * Test a webhook subscription by sending a test event
   */
  async testSubscription(subscriptionId: string, tenantId: string): Promise<TestWebhookResponseDto> {
    const subscription = await this.getSubscription(subscriptionId, tenantId);

    const testPayload = {
      event_type: 'webhook.test',
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook event',
        subscription_id: subscriptionId,
      },
    };

    const signature = this.generateSignature(
      JSON.stringify(testPayload),
      subscription.secretKey,
      subscription.signatureAlgorithm
    );

    const startTime = Date.now();

    try {
      const response = await fetch(subscription.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [subscription.signatureHeader]: signature,
          ...subscription.customHeaders,
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(subscription.timeoutSeconds * 1000),
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get subscriptions that match a specific event type
   */
  async getMatchingSubscriptions(tenantId: string, eventType: string): Promise<WebhookSubscriptionDto[]> {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(
        `SELECT * FROM webhook_subscriptions
        WHERE tenant_id = $1
          AND is_active = true
          AND deleted_at IS NULL
          AND $2 = ANY(event_types)
          AND health_status != 'SUSPENDED'
        ORDER BY created_at ASC`,
        [tenantId, eventType]
      );

      return result.rows.map(row => this.mapRowToDto(row));

    } finally {
      client.release();
    }
  }

  /**
   * Generate a secure random secret key
   */
  private generateSecretKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Generate HMAC signature for payload
   */
  generateSignature(payload: string, secretKey: string, algorithm: string): string {
    const hmac = crypto.createHmac(algorithm, secretKey);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Map database row to DTO
   */
  private mapRowToDto(row: any): WebhookSubscriptionDto {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      endpointUrl: row.endpoint_url,
      isActive: row.is_active,
      eventTypes: row.event_types,
      eventFilters: row.event_filters,
      secretKey: row.secret_key,
      signatureHeader: row.signature_header,
      signatureAlgorithm: row.signature_algorithm,
      maxRetryAttempts: row.max_retry_attempts,
      retryBackoffMultiplier: parseFloat(row.retry_backoff_multiplier),
      initialRetryDelaySeconds: row.initial_retry_delay_seconds,
      maxRetryDelaySeconds: row.max_retry_delay_seconds,
      maxEventsPerMinute: row.max_events_per_minute,
      maxEventsPerHour: row.max_events_per_hour,
      maxEventsPerDay: row.max_events_per_day,
      timeoutSeconds: row.timeout_seconds,
      customHeaders: row.custom_headers,
      totalEventsSent: parseInt(row.total_events_sent),
      totalEventsFailed: parseInt(row.total_events_failed),
      lastSuccessfulDeliveryAt: row.last_successful_delivery_at,
      lastFailedDeliveryAt: row.last_failed_delivery_at,
      consecutiveFailures: row.consecutive_failures,
      healthStatus: row.health_status as HealthStatus,
      healthCheckedAt: row.health_checked_at,
      autoDisabledAt: row.auto_disabled_at,
      autoDisabledReason: row.auto_disabled_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}
