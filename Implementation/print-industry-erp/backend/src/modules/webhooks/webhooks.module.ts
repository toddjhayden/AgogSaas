/**
 * Webhooks Module
 * REQ-1767925582664-n6du5
 */

import { Module } from '@nestjs/common';
import { WebhookSubscriptionService } from './services/webhook-subscription.service';
import { WebhookEventPublisherService } from './services/webhook-event-publisher.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhooksResolver } from '../../graphql/resolvers/webhooks.resolver';

@Module({
  providers: [
    WebhookSubscriptionService,
    WebhookEventPublisherService,
    WebhookDeliveryService,
    WebhooksResolver,
  ],
  exports: [
    WebhookSubscriptionService,
    WebhookEventPublisherService,
    WebhookDeliveryService,
  ],
})
export class WebhooksModule {}
