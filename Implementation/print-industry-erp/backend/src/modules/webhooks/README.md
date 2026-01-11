# Webhook Event System

**REQ-1767925582664-n6du5**

A comprehensive webhook event system allowing tenants to subscribe to application events and receive real-time notifications via HTTP POST to their endpoints.

## Features

- ✅ **Multi-tenant Support** - Each tenant can manage their own webhook subscriptions
- ✅ **Event Type Catalog** - Pre-defined event types for common operations (invoices, payments, orders, etc.)
- ✅ **Event Filtering** - Subscribe to specific events with custom filters
- ✅ **Automatic Retry Logic** - Exponential backoff with configurable retry attempts
- ✅ **Signature Verification** - HMAC-based request signing for security
- ✅ **Health Monitoring** - Automatic health checks and subscription suspension
- ✅ **Rate Limiting** - Per-subscription rate limits (per minute/hour/day)
- ✅ **Delivery Tracking** - Complete audit trail of all delivery attempts
- ✅ **GraphQL API** - Full CRUD operations via GraphQL

## Architecture

### Database Schema

1. **webhook_subscriptions** - Tenant webhook endpoint configurations
2. **webhook_events** - Published events awaiting delivery
3. **webhook_deliveries** - Individual delivery attempts with retry tracking
4. **webhook_event_types** - Catalog of available event types
5. **webhook_delivery_logs** - Detailed logs for debugging

### Services

1. **WebhookSubscriptionService** - Manages webhook subscriptions (CRUD operations)
2. **WebhookEventPublisherService** - Publishes events and matches subscriptions
3. **WebhookDeliveryService** - Handles HTTP delivery with retry logic

## Usage

### 1. Create a Webhook Subscription

```graphql
mutation CreateWebhook {
  createWebhookSubscription(input: {
    name: "Invoice Notifications"
    description: "Receive notifications when invoices are created or updated"
    endpointUrl: "https://your-app.com/webhooks/invoices"
    eventTypes: ["invoice.created", "invoice.updated", "invoice.voided"]
    eventFilters: {
      amount_gte: 1000  # Only invoices >= $1000
    }
    maxRetryAttempts: 5
    timeoutSeconds: 30
  }) {
    id
    secretKey  # Save this - needed for signature verification
    signatureHeader
    signatureAlgorithm
  }
}
```

### 2. Publish an Event

```typescript
import { WebhookEventPublisherService } from '@modules/webhooks/services/webhook-event-publisher.service';

// Inject the service
constructor(
  private readonly webhookPublisher: WebhookEventPublisherService,
) {}

// Publish event when something happens
async createInvoice(invoiceData: any) {
  // ... create invoice logic ...

  // Publish webhook event
  await this.webhookPublisher.publishEvent({
    tenantId: 'tenant-123',
    eventType: 'invoice.created',
    eventData: {
      invoice_id: invoice.id,
      customer_id: invoice.customerId,
      total_amount: invoice.totalAmount,
      currency: invoice.currency,
      status: invoice.status,
    },
    eventMetadata: {
      user_id: currentUser.id,
      ip_address: request.ip,
    },
    sourceEntityType: 'invoice',
    sourceEntityId: invoice.id,
  });

  return invoice;
}
```

### 3. Receive and Verify Webhooks

```typescript
import { WebhookSignatureUtil } from '@modules/webhooks/utils/webhook-signature.util';

@Post('/webhooks/endpoint')
async handleWebhook(@Req() req: Request, @Res() res: Response) {
  // Get raw body (important for signature verification)
  const rawBody = JSON.stringify(req.body);

  // Extract signature from headers
  const signature = WebhookSignatureUtil.extractSignature(
    req.headers,
    'X-Webhook-Signature'
  );

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Verify signature
  const verification = WebhookSignatureUtil.verify(
    rawBody,
    signature,
    'your-webhook-secret-key', // From subscription creation
    'sha256',
    300 // Max age: 5 minutes
  );

  if (!verification.valid) {
    return res.status(401).json({ error: verification.reason });
  }

  // Process webhook
  const payload = req.body;

  console.log('Received event:', payload.event_type);
  console.log('Event data:', payload.data);

  // Handle the event
  switch (payload.event_type) {
    case 'invoice.created':
      await this.handleInvoiceCreated(payload.data);
      break;
    case 'invoice.updated':
      await this.handleInvoiceUpdated(payload.data);
      break;
    // ... other event types
  }

  // Return 200 OK to acknowledge receipt
  return res.status(200).json({ received: true });
}
```

## Available Event Types

### Finance Events
- `invoice.created` - New invoice created
- `invoice.updated` - Invoice modified
- `invoice.voided` - Invoice cancelled
- `payment.received` - Payment successfully processed
- `payment.failed` - Payment attempt failed

### Sales Events
- `quote.created` - New quote created
- `quote.approved` - Quote approved by customer
- `quote.converted` - Quote converted to order
- `order.created` - New order placed
- `order.updated` - Order modified

### Production Events
- `job.created` - Production job created
- `job.started` - Job started on press
- `job.completed` - Job finished

### Inventory Events
- `inventory.low_stock` - Stock below minimum threshold
- `inventory.received` - New inventory received

### Shipping Events
- `shipment.created` - Shipment created
- `shipment.shipped` - Package shipped
- `shipment.delivered` - Delivery confirmed

## Event Payload Structure

All webhooks follow this structure:

```json
{
  "event_id": "evt-123abc",
  "event_type": "invoice.created",
  "event_timestamp": "2026-01-10T12:00:00Z",
  "data": {
    "invoice_id": "inv-456",
    "customer_id": "cust-789",
    "total_amount": 1500.00,
    "currency": "USD"
  },
  "metadata": {
    "user_id": "user-123",
    "ip_address": "192.168.1.1"
  }
}
```

## Retry Logic

Failed deliveries are automatically retried with exponential backoff:

1. **Attempt 1**: Immediate
2. **Attempt 2**: 60 seconds later (1 minute)
3. **Attempt 3**: 120 seconds later (2 minutes)
4. **Attempt 4**: 240 seconds later (4 minutes)
5. **Attempt 5**: 480 seconds later (8 minutes)

Default configuration:
- Max retry attempts: 5
- Initial delay: 60 seconds
- Backoff multiplier: 2.0
- Max delay: 3600 seconds (1 hour)

## Health Status

Subscriptions are automatically monitored and assigned health status:

- **HEALTHY**: No recent failures, delivering successfully
- **DEGRADED**: Some failures (10-19 consecutive)
- **FAILING**: Many failures (20-49 consecutive)
- **SUSPENDED**: Too many failures (50+ consecutive) - auto-disabled

## Rate Limiting

Configure rate limits per subscription:

```graphql
mutation UpdateWebhook {
  updateWebhookSubscription(
    id: "webhook-123"
    input: {
      maxEventsPerMinute: 60
      maxEventsPerHour: 1000
      maxEventsPerDay: 10000
    }
  ) {
    id
    maxEventsPerMinute
  }
}
```

## Testing

Test your webhook endpoint before going live:

```graphql
mutation TestWebhook {
  testWebhookSubscription(id: "webhook-123") {
    success
    statusCode
    responseTime
    error
  }
}
```

## Security Best Practices

1. **Always verify signatures** - Never trust webhooks without signature verification
2. **Use HTTPS endpoints** - HTTP endpoints are rejected
3. **Validate timestamps** - Reject old webhooks to prevent replay attacks
4. **Rotate secrets regularly** - Use `regenerateWebhookSecret` mutation
5. **Implement idempotency** - Use `event_id` to prevent duplicate processing
6. **Return 200 quickly** - Process webhooks asynchronously, acknowledge receipt immediately

## GraphQL API Reference

### Queries

- `webhookSubscription(id)` - Get single subscription
- `webhookSubscriptions(input)` - List subscriptions with filters
- `webhookEvent(id)` - Get single event
- `webhookEvents(input)` - List events
- `webhookDelivery(id)` - Get delivery details
- `webhookDeliveries(input)` - List deliveries
- `webhookDeliveryLogs(deliveryId)` - Get delivery logs
- `webhookEventTypes(category)` - List available event types
- `webhookStats()` - Get subscription statistics

### Mutations

- `createWebhookSubscription(input)` - Create new subscription
- `updateWebhookSubscription(id, input)` - Update subscription
- `deleteWebhookSubscription(id)` - Delete subscription
- `testWebhookSubscription(id)` - Test endpoint
- `regenerateWebhookSecret(id)` - Rotate secret key
- `publishWebhookEvent(input)` - Publish event (internal use)
- `retryWebhookDelivery(id)` - Manually retry failed delivery

## Monitoring

Monitor webhook health via GraphQL:

```graphql
query WebhookStats {
  webhookStats {
    totalSubscriptions
    activeSubscriptions
    totalEventsSent
    totalEventsSucceeded
    totalEventsFailed
    averageResponseTimeMs
    healthySubscriptions
    degradedSubscriptions
    failingSubscriptions
    suspendedSubscriptions
  }
}
```

## Troubleshooting

### Webhooks not being delivered?

1. Check subscription is active: `isActive: true`
2. Verify health status is not SUSPENDED
3. Check event type matches subscription
4. Verify event filters match event data
5. Check rate limits not exceeded
6. Review delivery logs for errors

### Signature verification failing?

1. Ensure you're using raw request body (not parsed JSON)
2. Verify you're using correct secret key
3. Check signature header name matches
4. Confirm algorithm (sha256 vs sha512)

### High failure rate?

1. Check endpoint is accessible and returning 2xx
2. Verify timeout is sufficient (default: 30s)
3. Check for rate limiting on your endpoint
4. Review delivery logs for specific errors

## Performance Considerations

- **Delivery Processor**: Runs every 30 seconds, processes up to 50 deliveries per batch
- **Concurrent Deliveries**: Max 10 simultaneous HTTP requests
- **Payload Size**: Event data should be < 100KB for optimal performance
- **Response Time**: Endpoints should respond within timeout (default 30s)

## Future Enhancements

Potential improvements for future iterations:

- [ ] Webhook replay functionality
- [ ] Custom retry schedules per subscription
- [ ] Webhook templates/transformations
- [ ] Batch delivery support
- [ ] WebSocket delivery option
- [ ] Circuit breaker pattern
- [ ] Delivery priority levels
- [ ] Event buffering for burst traffic
