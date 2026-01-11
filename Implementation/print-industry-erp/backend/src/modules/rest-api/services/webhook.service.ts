/**
 * Webhook Service
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 *
 * Manages webhook configurations and deliveries
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { createHmac } from 'crypto';
import axios from 'axios';

export interface WebhookConfig {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  enabledEvents: string[];
  customHeaders?: Record<string, string>;
  retryEnabled: boolean;
  maxRetries: number;
  retryDelaySeconds: number;
  verifySsl: boolean;
  timeoutSeconds: number;
  isActive: boolean;
  lastTriggeredAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  consecutiveFailures: number;
  createdAt: Date;
}

export interface CreateWebhookDto {
  tenantId: string;
  name: string;
  url: string;
  secret?: string;
  enabledEvents: string[];
  customHeaders?: Record<string, string>;
  retryEnabled?: boolean;
  maxRetries?: number;
  retryDelaySeconds?: number;
  verifySsl?: boolean;
  timeoutSeconds?: number;
}

export interface WebhookDelivery {
  id: string;
  tenantId: string;
  webhookConfigId: string;
  eventType: string;
  eventId: string;
  payload: any;
  attemptNumber: number;
  requestUrl: string;
  responseStatus?: number;
  responseBody?: string;
  responseTimeMs?: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  errorMessage?: string;
  nextRetryAt?: Date;
  createdAt: Date;
  completedAt?: Date;
}

@Injectable()
export class WebhookService {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Create webhook configuration
   */
  async createWebhook(dto: CreateWebhookDto): Promise<WebhookConfig> {
    const client = await this.db.connect();
    try {
      // Hash secret if provided
      const secretHash = dto.secret ? this.hashSecret(dto.secret) : null;

      const result = await client.query(
        `INSERT INTO webhook_configurations (
          tenant_id, name, url, secret_hash, enabled_events,
          custom_headers, retry_enabled, max_retries,
          retry_delay_seconds, verify_ssl, timeout_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, tenant_id, name, url, enabled_events,
                  custom_headers, retry_enabled, max_retries,
                  retry_delay_seconds, verify_ssl, timeout_seconds,
                  is_active, last_triggered_at, last_success_at,
                  last_failure_at, consecutive_failures, created_at`,
        [
          dto.tenantId,
          dto.name,
          dto.url,
          secretHash,
          dto.enabledEvents,
          JSON.stringify(dto.customHeaders || {}),
          dto.retryEnabled !== false,
          dto.maxRetries || 3,
          dto.retryDelaySeconds || 60,
          dto.verifySsl !== false,
          dto.timeoutSeconds || 30,
        ]
      );

      return this.mapWebhookConfig(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Trigger webhook for an event
   */
  async triggerWebhook(
    tenantId: string,
    eventType: string,
    eventId: string,
    payload: any
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      // Get active webhooks for this event type
      const result = await client.query(
        `SELECT id, url, secret_hash, custom_headers, verify_ssl, timeout_seconds
         FROM webhook_configurations
         WHERE tenant_id = $1
           AND $2 = ANY(enabled_events)
           AND is_active = true
           AND deleted_at IS NULL`,
        [tenantId, eventType]
      );

      // Queue delivery for each webhook
      for (const webhook of result.rows) {
        await this.queueDelivery(client, {
          tenantId,
          webhookConfigId: webhook.id,
          eventType,
          eventId,
          payload,
          url: webhook.url,
          secretHash: webhook.secret_hash,
          customHeaders: webhook.custom_headers,
          verifySsl: webhook.verify_ssl,
          timeoutSeconds: webhook.timeout_seconds,
        });
      }
    } finally {
      client.release();
    }
  }

  /**
   * Queue webhook delivery
   */
  private async queueDelivery(
    client: any,
    params: {
      tenantId: string;
      webhookConfigId: string;
      eventType: string;
      eventId: string;
      payload: any;
      url: string;
      secretHash?: string;
      customHeaders?: Record<string, string>;
      verifySsl: boolean;
      timeoutSeconds: number;
    }
  ): Promise<void> {
    // Insert delivery record
    const result = await client.query(
      `INSERT INTO webhook_deliveries (
        tenant_id, webhook_config_id, event_type, event_id,
        payload, request_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        params.tenantId,
        params.webhookConfigId,
        params.eventType,
        params.eventId,
        JSON.stringify(params.payload),
        params.url,
        'pending',
      ]
    );

    const deliveryId = result.rows[0].id;

    // Execute delivery asynchronously
    setImmediate(async () => {
      try {
        await this.executeDelivery(deliveryId, params);
      } catch (error) {
        console.error(`Webhook delivery failed: ${deliveryId}`, error);
      }
    });
  }

  /**
   * Execute webhook delivery
   */
  private async executeDelivery(
    deliveryId: string,
    params: {
      url: string;
      payload: any;
      secretHash?: string;
      customHeaders?: Record<string, string>;
      verifySsl: boolean;
      timeoutSeconds: number;
    }
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      const startTime = Date.now();

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AgogSaaS-Webhooks/1.0',
        ...params.customHeaders,
      };

      // Add signature if secret is configured
      if (params.secretHash) {
        const signature = this.generateSignature(params.payload, params.secretHash);
        headers['X-Webhook-Signature'] = signature;
      }

      // Send request
      const response = await axios.post(params.url, params.payload, {
        headers,
        timeout: params.timeoutSeconds * 1000,
        validateStatus: () => true, // Don't throw on any status
        httpsAgent: params.verifySsl ? undefined : new (require('https').Agent)({
          rejectUnauthorized: false,
        }),
      });

      const responseTimeMs = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      // Update delivery record
      await client.query(
        `UPDATE webhook_deliveries
         SET status = $1,
             response_status = $2,
             response_body = $3,
             response_time_ms = $4,
             completed_at = CURRENT_TIMESTAMP,
             error_message = $5
         WHERE id = $6`,
        [
          success ? 'success' : 'failed',
          response.status,
          JSON.stringify(response.data).substring(0, 5000), // Limit size
          responseTimeMs,
          success ? null : `HTTP ${response.status}: ${response.statusText}`,
          deliveryId,
        ]
      );
    } catch (error: any) {
      // Update delivery with error
      await client.query(
        `UPDATE webhook_deliveries
         SET status = 'failed',
             error_message = $1,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, deliveryId]
      );

      // TODO: Implement retry logic here
    } finally {
      client.release();
    }
  }

  /**
   * List webhooks for tenant
   */
  async listWebhooks(tenantId: string): Promise<WebhookConfig[]> {
    const client = await this.db.connect();
    try {
      const result = await client.query(
        `SELECT id, tenant_id, name, url, enabled_events,
                custom_headers, retry_enabled, max_retries,
                retry_delay_seconds, verify_ssl, timeout_seconds,
                is_active, last_triggered_at, last_success_at,
                last_failure_at, consecutive_failures, created_at
         FROM webhook_configurations
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [tenantId]
      );

      return result.rows.map(row => this.mapWebhookConfig(row));
    } finally {
      client.release();
    }
  }

  /**
   * Get webhook deliveries
   */
  async getDeliveries(
    webhookConfigId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WebhookDelivery[]> {
    const client = await this.db.connect();
    try {
      const result = await client.query(
        `SELECT id, tenant_id, webhook_config_id, event_type,
                event_id, payload, attempt_number, request_url,
                response_status, response_body, response_time_ms,
                status, error_message, next_retry_at, created_at,
                completed_at
         FROM webhook_deliveries
         WHERE webhook_config_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [webhookConfigId, limit, offset]
      );

      return result.rows.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        webhookConfigId: row.webhook_config_id,
        eventType: row.event_type,
        eventId: row.event_id,
        payload: row.payload,
        attemptNumber: row.attempt_number,
        requestUrl: row.request_url,
        responseStatus: row.response_status,
        responseBody: row.response_body,
        responseTimeMs: row.response_time_ms,
        status: row.status,
        errorMessage: row.error_message,
        nextRetryAt: row.next_retry_at,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Hash webhook secret
   */
  private hashSecret(secret: string): string {
    return createHmac('sha256', 'webhook-secret-salt').update(secret).digest('hex');
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: any, secretHash: string): string {
    const payloadString = JSON.stringify(payload);
    return createHmac('sha256', secretHash).update(payloadString).digest('hex');
  }

  /**
   * Map database row to WebhookConfig
   */
  private mapWebhookConfig(row: any): WebhookConfig {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      url: row.url,
      enabledEvents: row.enabled_events,
      customHeaders: row.custom_headers,
      retryEnabled: row.retry_enabled,
      maxRetries: row.max_retries,
      retryDelaySeconds: row.retry_delay_seconds,
      verifySsl: row.verify_ssl,
      timeoutSeconds: row.timeout_seconds,
      isActive: row.is_active,
      lastTriggeredAt: row.last_triggered_at,
      lastSuccessAt: row.last_success_at,
      lastFailureAt: row.last_failure_at,
      consecutiveFailures: row.consecutive_failures,
      createdAt: row.created_at,
    };
  }
}
