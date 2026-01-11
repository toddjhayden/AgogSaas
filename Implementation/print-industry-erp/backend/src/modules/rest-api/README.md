# REST API Framework for External Integrations

**REQ-1767925582664-oqb5y** - REST API Framework for External Integrations

## Overview

This module provides a comprehensive REST API framework for external system integrations with the AgogSaaS ERP platform. It includes:

- **API Key Authentication** - Secure authentication using API keys with scoped permissions
- **Rate Limiting** - Granular rate limiting per API key (minute/hour/day buckets)
- **Request Logging** - Complete audit trail of all API requests
- **Webhook System** - Event-driven integrations with retry logic
- **Tenant Isolation** - Row-level security ensuring data isolation
- **OpenAPI/Swagger** - Interactive API documentation (when enabled)

## Architecture

### Database Schema

The framework uses the following tables:

1. **`api_keys`** - Stores API key configurations and permissions
2. **`api_access_log`** - Audit log of all API requests
3. **`api_rate_limit_buckets`** - Rate limit tracking (minute/hour/day)
4. **`webhook_configurations`** - Webhook endpoint configurations
5. **`webhook_deliveries`** - Delivery tracking for outbound webhooks

### Authentication Flow

```
Client Request → API Key Auth Guard → Validate Key → Check Rate Limit → Check Scopes → Execute Request → Log Access
```

### Components

#### Core Services

- **`ApiKeyService`** - Manages API key lifecycle (create, validate, revoke)
- **`WebhookService`** - Manages webhook configurations and deliveries

#### Guards & Interceptors

- **`ApiKeyAuthGuard`** - Authenticates requests using API keys
- **`ApiLoggingInterceptor`** - Logs all API requests and responses

#### Controllers

- **`ApiKeyManagementController`** - Admin endpoints for managing API keys
- **`OrdersApiController`** - External API for order management
- **`ProductsApiController`** - External API for product catalog
- **`WebhookManagementController`** - Admin endpoints for webhook management

## Getting Started

### 1. Database Migration

Run the migration to create the required tables:

```bash
# The migration V0.0.80__create_api_keys_and_external_api_framework.sql
# will be applied automatically on next database startup
```

### 2. Create an API Key

Use the admin API (requires JWT authentication):

```bash
POST /api/v1/admin/api-keys
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "My Integration",
  "description": "Integration with external system",
  "scopes": ["read:orders", "write:orders", "read:products"],
  "allowedIps": ["203.0.113.0/24"],  // Optional IP whitelist
  "rateLimitPerMinute": 60,
  "rateLimitPerHour": 3600,
  "rateLimitPerDay": 100000,
  "expiresAt": "2025-12-31T23:59:59Z"  // Optional expiration
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "ak_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "name": "My Integration",
  "scopes": ["read:orders", "write:orders", "read:products"],
  "rateLimitPerMinute": 60,
  ...
}
```

**⚠️ IMPORTANT**: Save the `apiKey` value immediately - it's only shown once!

### 3. Make API Requests

Include the API key in the `X-API-Key` header:

```bash
GET /api/v1/orders?limit=10
X-API-Key: ak_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

Alternatively, use the `Authorization` header:

```bash
GET /api/v1/orders?limit=10
Authorization: Bearer ak_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

## API Endpoints

### Orders API

#### List Orders
```
GET /api/v1/orders
Required scope: read:orders

Query parameters:
- status: Filter by order status
- customerId: Filter by customer
- limit: Results per page (default: 50)
- offset: Pagination offset (default: 0)
```

#### Get Order
```
GET /api/v1/orders/:id
Required scope: read:orders
```

#### Create Order
```
POST /api/v1/orders
Required scope: write:orders

Body:
{
  "customerId": "customer-uuid",
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 10,
      "unitPrice": 29.99
    }
  ],
  "metadata": { ... }
}
```

#### Update Order Status
```
PUT /api/v1/orders/:id/status
Required scope: write:orders

Body:
{
  "status": "shipped",
  "notes": "Order shipped via FedEx"
}
```

### Products API

#### List Products
```
GET /api/v1/products
Required scope: read:products

Query parameters:
- category: Filter by category
- search: Search by name or SKU
- limit: Results per page (default: 50)
- offset: Pagination offset (default: 0)
```

#### Get Product
```
GET /api/v1/products/:idOrSku
Required scope: read:products
```

#### Create Product
```
POST /api/v1/products
Required scope: write:products

Body:
{
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "category": "Category Name",
  "unitPrice": 99.99,
  "currency": "USD",
  "stockQuantity": 100
}
```

#### Update Product
```
PUT /api/v1/products/:id
Required scope: write:products

Body:
{
  "name": "Updated Name",
  "unitPrice": 89.99,
  "stockQuantity": 150
}
```

#### Check Availability
```
GET /api/v1/products/:id/availability?quantity=10
Required scope: read:products
```

## Scopes

Available permission scopes:

- `*` - Wildcard (all permissions)
- `read:orders` - Read order data
- `write:orders` - Create/update orders
- `read:products` - Read product catalog
- `write:products` - Create/update products
- `read:customers` - Read customer data
- `write:customers` - Create/update customers

Scope patterns:
- `read:*` - All read permissions
- `write:*` - All write permissions

## Rate Limiting

Rate limits are enforced per API key across three time buckets:

- **Per Minute**: Default 60 requests/minute
- **Per Hour**: Default 3,600 requests/hour
- **Per Day**: Default 100,000 requests/day

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1673625600000
```

When rate limit is exceeded, you receive a `429 Too Many Requests` response:

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

## Webhooks

Webhooks enable event-driven integrations by sending HTTP POST requests to your endpoints when events occur.

### Create Webhook

```bash
POST /api/v1/admin/webhooks
Authorization: Bearer <jwt-token>

{
  "name": "My Webhook",
  "url": "https://example.com/webhooks",
  "secret": "your-webhook-secret",
  "enabledEvents": [
    "order.created",
    "order.updated",
    "order.shipped",
    "product.created",
    "product.updated"
  ],
  "customHeaders": {
    "X-Custom-Header": "value"
  },
  "retryEnabled": true,
  "maxRetries": 3,
  "retryDelaySeconds": 60
}
```

### Webhook Payload

Webhooks receive a POST request with:

```json
{
  "eventType": "order.created",
  "eventId": "order-uuid",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "orderId": "order-uuid",
    "orderNumber": "ORD-12345",
    ...
  }
}
```

### Webhook Security

Webhooks include an `X-Webhook-Signature` header with HMAC-SHA256 signature:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', 'your-webhook-secret')
  .update(JSON.stringify(payload))
  .digest('hex');

if (signature !== req.headers['x-webhook-signature']) {
  throw new Error('Invalid signature');
}
```

### Webhook Delivery Tracking

Track webhook deliveries:

```bash
GET /api/v1/admin/webhooks/:id/deliveries?limit=50&offset=0
Authorization: Bearer <jwt-token>
```

Response:
```json
{
  "data": [
    {
      "id": "delivery-uuid",
      "eventType": "order.created",
      "status": "success",
      "responseStatus": 200,
      "responseTimeMs": 145,
      "attemptNumber": 1,
      "createdAt": "2025-01-10T12:00:00Z",
      "completedAt": "2025-01-10T12:00:00Z"
    }
  ]
}
```

## Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Common Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Invalid or missing API key
- `403 Forbidden` - Insufficient permissions (scope)
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Security Best Practices

1. **Store API Keys Securely**
   - Never commit API keys to source control
   - Use environment variables or secrets management
   - Rotate keys regularly

2. **Use HTTPS Only**
   - All API requests must use HTTPS in production
   - Never send API keys over unencrypted connections

3. **IP Whitelisting**
   - Configure allowed IPs for additional security
   - Use CIDR notation for IP ranges

4. **Minimal Scopes**
   - Only grant scopes that are absolutely necessary
   - Create separate API keys for different integrations

5. **Monitor Usage**
   - Review API access logs regularly
   - Set up alerts for unusual activity
   - Monitor rate limit usage

6. **Revoke Compromised Keys**
   - Immediately revoke any compromised API keys
   - Generate new keys and update integrations

## Monitoring & Analytics

### View API Key Usage

```bash
GET /api/v1/admin/api-keys/:id/usage
Authorization: Bearer <jwt-token>
```

Response:
```json
{
  "minute": {
    "currentCount": 12,
    "limitValue": 60,
    "usagePercentage": 20,
    "bucketType": "minute"
  },
  "hour": {
    "currentCount": 450,
    "limitValue": 3600,
    "usagePercentage": 12.5,
    "bucketType": "hour"
  },
  "day": {
    "currentCount": 5234,
    "limitValue": 100000,
    "usagePercentage": 5.2,
    "bucketType": "day"
  }
}
```

### Access Logs

All API requests are logged in the `api_access_log` table with:

- Request method, path, headers, IP
- Response status, size, timing
- Rate limit status
- Scope validation results
- Error details (if any)

Query logs using SQL:

```sql
SELECT
  request_method,
  request_path,
  response_status,
  response_time_ms,
  created_at
FROM api_access_log
WHERE api_key_id = 'your-key-id'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;
```

## OpenAPI/Swagger Documentation

Once `@nestjs/swagger` is installed, interactive API documentation will be available at:

```
http://localhost:4000/api/docs
```

The documentation includes:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Try-it-out functionality

## Testing

### Manual Testing

Use curl to test API endpoints:

```bash
# List orders
curl -X GET http://localhost:4000/api/v1/orders \
  -H "X-API-Key: ak_live_YOUR_API_KEY" \
  -H "Content-Type: application/json"

# Create order
curl -X POST http://localhost:4000/api/v1/orders \
  -H "X-API-Key: ak_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 5,
        "unitPrice": 29.99
      }
    ]
  }'
```

### Automated Testing

Test suite structure:
```
src/modules/rest-api/__tests__/
├── api-key.service.spec.ts
├── api-key-auth.guard.spec.ts
├── orders-api.controller.spec.ts
├── products-api.controller.spec.ts
└── webhook.service.spec.ts
```

Run tests:
```bash
npm test -- --testPathPattern=rest-api
```

## Troubleshooting

### "Invalid API key" Error

- Verify the API key is correct and hasn't been revoked
- Check that the API key hasn't expired
- Ensure you're using the correct header (`X-API-Key`)

### "Insufficient permissions" Error

- Check the required scope for the endpoint
- Verify your API key has the necessary scope
- Review scope configuration in API key settings

### Rate Limit Exceeded

- Check your current usage with `/api/v1/admin/api-keys/:id/usage`
- Wait for the rate limit window to reset
- Contact support to increase limits if needed

### Webhook Not Delivered

- Verify the webhook URL is accessible from the internet
- Check webhook delivery logs for error details
- Ensure your endpoint returns a 2xx status code within 30 seconds
- Verify webhook signature validation logic

## Migration from GraphQL

If you're migrating from GraphQL to REST:

1. **Authentication**: Replace JWT with API key
2. **Queries**: Use GET endpoints instead of GraphQL queries
3. **Mutations**: Use POST/PUT endpoints instead of GraphQL mutations
4. **Filtering**: Use query parameters instead of GraphQL arguments
5. **Nested Data**: May require multiple API calls (REST doesn't support nested queries like GraphQL)

## Support

For issues or questions:

1. Check this documentation
2. Review error logs in `api_access_log` table
3. Contact development team
4. Create an issue in the project repository

## Changelog

### v1.0.0 (2025-01-10)
- Initial release
- API key authentication
- Rate limiting (minute/hour/day)
- Request logging and audit trail
- Webhook system with retry logic
- Orders and Products API endpoints
- Tenant isolation with RLS
- Comprehensive error handling
