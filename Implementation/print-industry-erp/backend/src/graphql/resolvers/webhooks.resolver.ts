/**
 * Webhook GraphQL Resolver
 * REQ-1767925582664-n6du5
 */

import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContext } from '../../common/decorators/tenant-context.decorator';
import { WebhookSubscriptionService } from '../../modules/webhooks/services/webhook-subscription.service';
import { WebhookEventPublisherService } from '../../modules/webhooks/services/webhook-event-publisher.service';
import { WebhookDeliveryService } from '../../modules/webhooks/services/webhook-delivery.service';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';

@Resolver()
@UseGuards(JwtAuthGuard)
export class WebhooksResolver {
  private readonly logger = new Logger(WebhooksResolver.name);

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly subscriptionService: WebhookSubscriptionService,
    private readonly eventPublisher: WebhookEventPublisherService,
    private readonly deliveryService: WebhookDeliveryService,
  ) {}

  // =====================================================
  // QUERIES - Subscriptions
  // =====================================================

  @Query()
  async webhookSubscription(
    @Args('id') id: string,
    @TenantContext() tenantId: string,
  ) {
    return await this.subscriptionService.getSubscription(id, tenantId);
  }

  @Query()
  async webhookSubscriptions(
    @Args('input') input: any,
    @TenantContext() tenantId: string,
  ) {
    return await this.subscriptionService.listSubscriptions({
      tenantId,
      ...input,
    });
  }

  // =====================================================
  // QUERIES - Events
  // =====================================================

  @Query()
  async webhookEvent(
    @Args('id') id: string,
    @TenantContext() tenantId: string,
  ) {
    return await this.eventPublisher.getEvent(id, tenantId);
  }

  @Query()
  async webhookEvents(
    @Args('input') input: any,
    @TenantContext() tenantId: string,
  ) {
    return await this.eventPublisher.listEvents({
      tenantId,
      ...input,
    });
  }

  // =====================================================
  // QUERIES - Deliveries
  // =====================================================

  @Query()
  async webhookDelivery(
    @Args('id') id: string,
    @TenantContext() tenantId: string,
  ) {
    return await this.deliveryService.getDelivery(id, tenantId);
  }

  @Query()
  async webhookDeliveries(
    @Args('input') input: any,
    @TenantContext() tenantId: string,
  ) {
    return await this.deliveryService.listDeliveries({
      tenantId,
      ...input,
    });
  }

  @Query()
  async webhookDeliveryLogs(
    @Args('deliveryId') deliveryId: string,
    @TenantContext() tenantId: string,
  ) {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      const result = await client.query(
        `SELECT * FROM webhook_delivery_logs
        WHERE delivery_id = $1 AND tenant_id = $2
        ORDER BY created_at ASC`,
        [deliveryId, tenantId]
      );

      return result.rows.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        deliveryId: row.delivery_id,
        logLevel: row.log_level,
        logMessage: row.log_message,
        logData: row.log_data,
        createdAt: row.created_at,
      }));

    } finally {
      client.release();
    }
  }

  // =====================================================
  // QUERIES - Event Types
  // =====================================================

  @Query()
  async webhookEventTypes(
    @Args('category') category: string | null,
  ) {
    const client = await this.db.connect();

    try {
      let query = `SELECT * FROM webhook_event_types WHERE is_enabled = true AND deprecated = false`;
      const params: any[] = [];

      if (category) {
        query += ` AND category = $1`;
        params.push(category);
      }

      query += ` ORDER BY category, display_name`;

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        eventType: row.event_type,
        category: row.category,
        displayName: row.display_name,
        description: row.description,
        currentVersion: row.current_version,
        deprecated: row.deprecated,
        deprecatedAt: row.deprecated_at,
        replacementEventType: row.replacement_event_type,
        payloadSchema: row.payload_schema,
        examplePayload: row.example_payload,
        isEnabled: row.is_enabled,
        totalEventsPublished: parseInt(row.total_events_published),
        lastPublishedAt: row.last_published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

    } finally {
      client.release();
    }
  }

  @Query()
  async webhookEventType(
    @Args('eventType') eventType: string,
  ) {
    const client = await this.db.connect();

    try {
      const result = await client.query(
        `SELECT * FROM webhook_event_types WHERE event_type = $1`,
        [eventType]
      );

      if (result.rows.length === 0) {
        throw new Error(`Event type ${eventType} not found`);
      }

      const row = result.rows[0];

      return {
        eventType: row.event_type,
        category: row.category,
        displayName: row.display_name,
        description: row.description,
        currentVersion: row.current_version,
        deprecated: row.deprecated,
        deprecatedAt: row.deprecated_at,
        replacementEventType: row.replacement_event_type,
        payloadSchema: row.payload_schema,
        examplePayload: row.example_payload,
        isEnabled: row.is_enabled,
        totalEventsPublished: parseInt(row.total_events_published),
        lastPublishedAt: row.last_published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

    } finally {
      client.release();
    }
  }

  // =====================================================
  // QUERIES - Statistics
  // =====================================================

  @Query()
  async webhookStats(
    @TenantContext() tenantId: string,
  ) {
    const client = await this.db.connect();

    try {
      await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);

      // Get subscription stats
      const subStatsResult = await client.query(
        `SELECT
          COUNT(*) as total_subscriptions,
          COUNT(*) FILTER (WHERE is_active = true) as active_subscriptions,
          SUM(total_events_sent) as total_events_sent,
          SUM(total_events_failed) as total_events_failed,
          COUNT(*) FILTER (WHERE health_status = 'HEALTHY') as healthy_subscriptions,
          COUNT(*) FILTER (WHERE health_status = 'DEGRADED') as degraded_subscriptions,
          COUNT(*) FILTER (WHERE health_status = 'FAILING') as failing_subscriptions,
          COUNT(*) FILTER (WHERE health_status = 'SUSPENDED') as suspended_subscriptions
        FROM webhook_subscriptions
        WHERE tenant_id = $1 AND deleted_at IS NULL`,
        [tenantId]
      );

      // Get average response time
      const avgResponseResult = await client.query(
        `SELECT AVG(response_time_ms)::integer as avg_response_time
        FROM webhook_deliveries
        WHERE tenant_id = $1 AND delivery_status = 'SUCCEEDED' AND response_time_ms IS NOT NULL`,
        [tenantId]
      );

      const stats = subStatsResult.rows[0];
      const avgResponse = avgResponseResult.rows[0];

      return {
        totalSubscriptions: parseInt(stats.total_subscriptions) || 0,
        activeSubscriptions: parseInt(stats.active_subscriptions) || 0,
        totalEventsSent: parseInt(stats.total_events_sent) || 0,
        totalEventsSucceeded: (parseInt(stats.total_events_sent) || 0) - (parseInt(stats.total_events_failed) || 0),
        totalEventsFailed: parseInt(stats.total_events_failed) || 0,
        averageResponseTimeMs: parseFloat(avgResponse.avg_response_time) || 0,
        healthySubscriptions: parseInt(stats.healthy_subscriptions) || 0,
        degradedSubscriptions: parseInt(stats.degraded_subscriptions) || 0,
        failingSubscriptions: parseInt(stats.failing_subscriptions) || 0,
        suspendedSubscriptions: parseInt(stats.suspended_subscriptions) || 0,
      };

    } finally {
      client.release();
    }
  }

  // =====================================================
  // MUTATIONS - Subscription Management
  // =====================================================

  @Mutation()
  async createWebhookSubscription(
    @Args('input') input: any,
    @TenantContext() tenantId: string,
    @Context() context: any,
  ) {
    const userId = context.req.user?.id || 'SYSTEM';

    return await this.subscriptionService.createSubscription({
      tenantId,
      ...input,
      createdBy: userId,
    });
  }

  @Mutation()
  async updateWebhookSubscription(
    @Args('id') id: string,
    @Args('input') input: any,
    @TenantContext() tenantId: string,
    @Context() context: any,
  ) {
    const userId = context.req.user?.id || 'SYSTEM';

    return await this.subscriptionService.updateSubscription(id, tenantId, {
      ...input,
      updatedBy: userId,
    });
  }

  @Mutation()
  async deleteWebhookSubscription(
    @Args('id') id: string,
    @TenantContext() tenantId: string,
    @Context() context: any,
  ) {
    const userId = context.req.user?.id || 'SYSTEM';

    await this.subscriptionService.deleteSubscription(id, tenantId, userId);
    return true;
  }

  // =====================================================
  // MUTATIONS - Subscription Actions
  // =====================================================

  @Mutation()
  async testWebhookSubscription(
    @Args('id') id: string,
    @TenantContext() tenantId: string,
  ) {
    return await this.subscriptionService.testSubscription(id, tenantId);
  }

  @Mutation()
  async regenerateWebhookSecret(
    @Args('id') id: string,
    @TenantContext() tenantId: string,
    @Context() context: any,
  ) {
    const userId = context.req.user?.id || 'SYSTEM';

    return await this.subscriptionService.regenerateSecretKey(id, tenantId, userId);
  }

  // =====================================================
  // MUTATIONS - Event Publishing
  // =====================================================

  @Mutation()
  async publishWebhookEvent(
    @Args('input') input: any,
    @TenantContext() tenantId: string,
  ) {
    return await this.eventPublisher.publishEvent({
      tenantId,
      ...input,
    });
  }

  // =====================================================
  // MUTATIONS - Delivery Management
  // =====================================================

  @Mutation()
  async retryWebhookDelivery(
    @Args('id') id: string,
    @TenantContext() tenantId: string,
  ) {
    await this.deliveryService.retryDelivery(id, tenantId);
    return true;
  }
}
