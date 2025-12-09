**📍 Navigation Path:** [AGOG Home](../../README.md) → [Project Architecture](../README.md) → [API](./README.md) → API Specification

# API Specification

> **Version:** 1.0.0-draft  
> **Last Updated:** 2025-11-03  
> **Status:** Draft - Evolving with implementation  
> **Related:** [Version Management](./version-management.md), [REST Standards](../../Standards/api/rest-standards.md), [GraphQL Specification](./graphql-specification.md)

## Overview

AGOG uses a **hybrid API strategy** to serve different client needs:

- **GraphQL (Apollo Federation):** PWA frontend, BI dashboards, complex queries
- **REST APIs:** External integrations (shipping, payments, equipment), third-party developers
- **gRPC:** Internal microservice communication (not externally exposed)

### REST API Overview

This document defines the REST API surface for external integrations. All REST APIs follow standard REST principles with JWT authentication and multi-tenant isolation.

**API Philosophy:**
- **API-First Design:** APIs defined before implementation
- **Multi-Tenant by Default:** All endpoints require tenant context
- **Versioned:** Breaking changes require new version (see [version-management.md](./version-management.md))
- **Consistent Errors:** Standard error format across all endpoints
- **Paginated by Default:** List endpoints return paginated results

**REST Base URL:** `https://api.agog.app/v1`

**GraphQL Endpoint:** `https://api.agog.app/graphql` (see [graphql-specification.md](./graphql-specification.md))

### When to Use REST vs GraphQL

```
Use REST APIs for:
├─ Shipping carrier integrations (FedEx, UPS, DHL)
├─ Payment processor integrations (Stripe, PayPal)
├─ E-commerce platform integrations (Shopify, WooCommerce)
├─ Equipment integrations (JDF/JMF protocols)
├─ Third-party developer access
├─ Partner/Reseller APIs
├─ Webhook-driven event subscriptions
└─ Simple CRUD operations from external systems

Use GraphQL for:
├─ PWA frontend application
├─ BI dashboards and analytics
├─ Complex queries requiring multiple resources
├─ Real-time updates (subscriptions)
└─ Internal applications needing flexible queries
```

---

## Authentication & Authorization

### Authentication Flow

All API requests (except `/auth/login`) require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt-token>
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh-token-string",
  "expires_in": 3600,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "user@example.com",
    "name": "John Doe",
    "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
    "roles": ["production_manager"],
    "permissions": ["job:read", "job:write", "job:delete"]
  }
}
```

**Errors:**
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account disabled or tenant inactive
- `429 Too Many Requests` - Rate limit exceeded

#### POST /auth/refresh
Refresh an expired JWT token.

**Request:**
```json
{
  "refresh_token": "refresh-token-string"
}
```

**Response (200 OK):**
```json
{
  "token": "new-jwt-token",
  "expires_in": 3600
}
```

#### POST /auth/logout
Invalidate current session tokens.

**Request:** Bearer token in header

**Response (204 No Content)**

---

### Authorization Model

**Role-Based Access Control (RBAC):**
- Roles define collections of permissions
- Users assigned to roles within their tenant
- Permissions checked on every request

**Standard Roles:**
- `super_admin` - Full system access (cross-tenant)
- `tenant_admin` - Full tenant access
- `production_manager` - Production, scheduling, shop floor
- `estimator` - Estimating, quoting
- `csr` - Customer service, order entry
- `operator` - Shop floor data entry only
- `readonly` - View-only access

**Permission Format:** `resource:action`
- Examples: `job:read`, `job:write`, `customer:delete`, `estimate:approve`

---

## Multi-Tenant Isolation

**Every API request is scoped to a tenant:**

1. JWT token contains `tenant_id` claim
2. All database queries filtered by `tenant_id`
3. Cross-tenant access forbidden (except `super_admin`)
4. Sales Point isolation handled within tenant scope

**Tenant Context Header (optional):**
```
X-Tenant-ID: 123e4567-e89b-12d3-a456-426614174000
```

If provided, must match JWT token's `tenant_id` claim.

---

## Pagination Standards

All list endpoints return paginated results.

**Query Parameters:**
- `page` - Page number (default: 1, min: 1)
- `per_page` - Items per page (default: 25, min: 1, max: 100)
- `sort` - Sort field (default varies by endpoint)
- `order` - Sort order: `asc` or `desc` (default: `asc`)

**Response Format:**
```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "per_page": 25,
    "total_pages": 10,
    "total_items": 247,
    "has_next": true,
    "has_prev": false
  },
  "links": {
    "self": "/v1/jobs?page=1&per_page=25",
    "first": "/v1/jobs?page=1&per_page=25",
    "last": "/v1/jobs?page=10&per_page=25",
    "next": "/v1/jobs?page=2&per_page=25",
    "prev": null
  }
}
```

---

## Error Response Standards

All errors follow a consistent format.

**Error Response Structure:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "customer_id",
        "message": "Customer ID is required"
      },
      {
        "field": "quantity",
        "message": "Quantity must be greater than 0"
      }
    ],
    "request_id": "req_123e4567",
    "timestamp": "2025-11-02T14:30:00Z"
  }
}
```

**Standard Error Codes:**
- `UNAUTHORIZED` - 401 - Missing or invalid authentication
- `FORBIDDEN` - 403 - Insufficient permissions
- `NOT_FOUND` - 404 - Resource not found
- `VALIDATION_ERROR` - 422 - Invalid input data
- `CONFLICT` - 409 - Resource conflict (duplicate, constraint violation)
- `RATE_LIMIT_EXCEEDED` - 429 - Too many requests
- `INTERNAL_ERROR` - 500 - Server error
- `SERVICE_UNAVAILABLE` - 503 - Temporary outage

---

## Core API Endpoints

### Customers

#### GET /customers
List all customers for tenant.

**Query Parameters:**
- Standard pagination parameters
- `search` - Search by name, code, or email
- `status` - Filter by status: `active`, `inactive`, `all` (default: `active`)
- `sales_point_id` - Filter by sales point (optional)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174002",
      "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
      "sales_point_id": "123e4567-e89b-12d3-a456-426614174003",
      "customer_number": "CUST-001",
      "name": "Acme Corporation",
      "status": "active",
      "contact": {
        "email": "contact@acme.com",
        "phone": "+1-555-0100"
      },
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-10-01T14:20:00Z"
    }
  ],
  "meta": {...},
  "links": {...}
}
```

#### GET /customers/:id
Get single customer by ID.

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174002",
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
  "sales_point_id": "123e4567-e89b-12d3-a456-426614174003",
  "customer_number": "CUST-001",
  "name": "Acme Corporation",
  "status": "active",
  "contact": {
    "email": "contact@acme.com",
    "phone": "+1-555-0100",
    "address": {
      "street": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "postal_code": "62701",
      "country": "USA"
    }
  },
  "billing": {
    "payment_terms": "net_30",
    "credit_limit": 50000.00,
    "credit_available": 45000.00
  },
  "preferences": {
    "paper_preference": "recycled",
    "color_profile": "SWOP2006_Coated3"
  },
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-10-01T14:20:00Z"
}
```

**Errors:**
- `404 Not Found` - Customer not found or belongs to different tenant

#### POST /customers
Create new customer.

**Request:**
```json
{
  "sales_point_id": "123e4567-e89b-12d3-a456-426614174003",
  "customer_number": "CUST-002",
  "name": "Widget Industries",
  "contact": {
    "email": "billing@widget.com",
    "phone": "+1-555-0200"
  },
  "billing": {
    "payment_terms": "net_30",
    "credit_limit": 25000.00
  }
}
```

**Response (201 Created):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174004",
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
  "sales_point_id": "123e4567-e89b-12d3-a456-426614174003",
  "customer_number": "CUST-002",
  "name": "Widget Industries",
  "status": "active",
  "contact": {...},
  "billing": {...},
  "created_at": "2025-11-02T14:30:00Z",
  "updated_at": "2025-11-02T14:30:00Z"
}
```

**Errors:**
- `422 Validation Error` - Invalid data
- `409 Conflict` - Customer number already exists

#### PATCH /customers/:id
Update existing customer.

**Request (partial update):**
```json
{
  "contact": {
    "phone": "+1-555-0201"
  },
  "billing": {
    "credit_limit": 30000.00
  }
}
```

**Response (200 OK):** Updated customer object

#### DELETE /customers/:id
Soft delete customer (sets status to `inactive`).

**Response (204 No Content)**

**Errors:**
- `409 Conflict` - Customer has active jobs

---

### Jobs (Print Jobs)

#### GET /jobs
List all jobs for tenant.

**Query Parameters:**
- Standard pagination parameters
- `status` - Filter: `estimating`, `approved`, `in_production`, `completed`, `shipped`, `all`
- `customer_id` - Filter by customer
- `sales_point_id` - Filter by sales point
- `date_from` - Jobs created after (ISO 8601)
- `date_to` - Jobs created before (ISO 8601)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174010",
      "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
      "sales_point_id": "123e4567-e89b-12d3-a456-426614174003",
      "job_number": "JOB-2025-0001",
      "customer_id": "123e4567-e89b-12d3-a456-426614174002",
      "customer_name": "Acme Corporation",
      "description": "Business Card Printing",
      "status": "in_production",
      "quantity": 5000,
      "due_date": "2025-11-15T17:00:00Z",
      "created_at": "2025-11-01T09:00:00Z",
      "updated_at": "2025-11-02T10:30:00Z"
    }
  ],
  "meta": {...},
  "links": {...}
}
```

#### GET /jobs/:id
Get single job with full details.

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174010",
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
  "sales_point_id": "123e4567-e89b-12d3-a456-426614174003",
  "job_number": "JOB-2025-0001",
  "customer_id": "123e4567-e89b-12d3-a456-426614174002",
  "customer_name": "Acme Corporation",
  "description": "Business Card Printing",
  "status": "in_production",
  "quantity": 5000,
  "specifications": {
    "size": "3.5x2",
    "stock": "14pt C2S",
    "colors_front": "4/4",
    "colors_back": "4/4",
    "coating": "UV both sides"
  },
  "pricing": {
    "estimate": 450.00,
    "actual": null,
    "currency": "USD"
  },
  "schedule": {
    "due_date": "2025-11-15T17:00:00Z",
    "ship_date": "2025-11-14T17:00:00Z",
    "scheduled_start": "2025-11-05T08:00:00Z"
  },
  "production": {
    "completion_percentage": 35,
    "current_operation": "printing",
    "operations_completed": 2,
    "operations_total": 5
  },
  "created_at": "2025-11-01T09:00:00Z",
  "updated_at": "2025-11-02T10:30:00Z"
}
```

#### POST /jobs
Create new job.

**Request:**
```json
{
  "sales_point_id": "123e4567-e89b-12d3-a456-426614174003",
  "customer_id": "123e4567-e89b-12d3-a456-426614174002",
  "description": "Brochure Printing - Fall Campaign",
  "quantity": 10000,
  "specifications": {
    "size": "8.5x11",
    "stock": "100# Gloss Text",
    "colors_front": "4/4",
    "finishing": "tri-fold"
  },
  "due_date": "2025-11-20T17:00:00Z"
}
```

**Response (201 Created):** Full job object with generated `job_number`

#### PATCH /jobs/:id
Update job details.

#### DELETE /jobs/:id
Cancel/delete job (status-dependent).

---

### Estimates

#### GET /estimates
List estimates.

#### GET /estimates/:id
Get estimate details with line items.

#### POST /estimates
Create estimate from specifications.

**Request:**
```json
{
  "customer_id": "123e4567-e89b-12d3-a456-426614174002",
  "description": "Annual Report Printing",
  "quantity": 5000,
  "specifications": {
    "pages": 24,
    "size": "8.5x11",
    "stock_cover": "100# Gloss Cover",
    "stock_text": "80# Gloss Text",
    "colors": "4/4",
    "binding": "saddle_stitch"
  }
}
```

**Response (201 Created):** Estimate with calculated costs

#### POST /estimates/:id/convert
Convert estimate to job.

**Response (201 Created):** New job object

---

### Inventory

#### GET /inventory/materials
List materials in inventory.

**Query Parameters:**
- `type` - Filter: `paper`, `ink`, `plates`, `consumables`
- `low_stock` - Boolean: show only low stock items
- `location_id` - Filter by warehouse location

#### GET /inventory/materials/:id
Get material details including lot tracking.

**Response includes lot genealogy:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174020",
  "material_code": "PAPER-GLO-100-8511",
  "description": "100# Gloss Text 8.5x11",
  "type": "paper",
  "quantity_on_hand": 15000,
  "unit": "sheets",
  "lots": [
    {
      "lot_number": "LOT-2025-001",
      "quantity": 5000,
      "received_date": "2025-10-15",
      "vendor": "Paper Co",
      "location": "Warehouse A-1"
    },
    {
      "lot_number": "LOT-2025-002",
      "quantity": 10000,
      "received_date": "2025-10-28",
      "vendor": "Paper Co",
      "location": "Warehouse A-1"
    }
  ]
}
```

#### POST /inventory/adjustments
Record inventory adjustment.

#### GET /inventory/transactions
List inventory transactions (usage, receipts, adjustments).

---

### Production

#### GET /production/schedule
Get production schedule.

**Query Parameters:**
- `date_from`, `date_to` - Date range
- `equipment_id` - Filter by equipment
- `status` - Filter: `scheduled`, `in_progress`, `completed`

#### GET /production/work-orders/:id
Get work order details.

#### POST /production/work-orders/:id/start
Start production on work order.

#### POST /production/work-orders/:id/complete
Complete work order operation.

#### POST /production/work-orders/:id/record-waste
Record waste/spoilage.

---

### Equipment

#### GET /equipment
List all equipment.

#### GET /equipment/:id
Get equipment details including maintenance history.

#### GET /equipment/:id/status
Get real-time equipment status (for JDF-connected equipment).

**Response (200 OK):**
```json
{
  "equipment_id": "123e4567-e89b-12d3-a456-426614174030",
  "status": "running",
  "current_job": "JOB-2025-0001",
  "speed": 8500,
  "speed_unit": "sheets_per_hour",
  "utilization": 87.5,
  "last_update": "2025-11-02T14:35:00Z"
}
```

#### POST /equipment/:id/maintenance
Record maintenance event.

---

## WebSocket Real-Time Events

**WebSocket Endpoint:** `wss://api.agog.app/v1/ws`

**Authentication:** JWT token as query parameter: `?token=<jwt-token>`

### Event Types

#### Job Status Updates
```json
{
  "event": "job.status_changed",
  "timestamp": "2025-11-02T14:30:00Z",
  "data": {
    "job_id": "123e4567-e89b-12d3-a456-426614174010",
    "job_number": "JOB-2025-0001",
    "old_status": "scheduled",
    "new_status": "in_production",
    "tenant_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

#### Equipment Status Updates
```json
{
  "event": "equipment.status_changed",
  "timestamp": "2025-11-02T14:35:00Z",
  "data": {
    "equipment_id": "123e4567-e89b-12d3-a456-426614174030",
    "equipment_name": "Press 1 - Heidelberg",
    "old_status": "idle",
    "new_status": "running",
    "current_job": "JOB-2025-0001",
    "tenant_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

#### Quality Alerts
```json
{
  "event": "quality.alert",
  "timestamp": "2025-11-02T14:40:00Z",
  "data": {
    "job_id": "123e4567-e89b-12d3-a456-426614174010",
    "operation": "printing",
    "alert_type": "color_variance",
    "severity": "warning",
    "message": "Color variance detected on cyan",
    "tenant_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

#### Inventory Low Stock Alerts
```json
{
  "event": "inventory.low_stock",
  "timestamp": "2025-11-02T15:00:00Z",
  "data": {
    "material_id": "123e4567-e89b-12d3-a456-426614174020",
    "material_code": "PAPER-GLO-100-8511",
    "quantity_on_hand": 500,
    "reorder_point": 1000,
    "tenant_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

### Subscription Channels

Clients can subscribe to specific channels:

```json
{
  "action": "subscribe",
  "channels": [
    "job.status_changed",
    "equipment.status_changed",
    "quality.alert",
    "inventory.low_stock"
  ]
}
```

**Tenant Isolation:** WebSocket events automatically filtered by user's `tenant_id` from JWT.

---

## Rate Limiting

**Limits:**
- Authenticated requests: 1000 requests/hour per user
- Unauthenticated requests: 100 requests/hour per IP
- WebSocket connections: 10 concurrent per user

**Rate Limit Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1699028400
```

**Rate Limit Exceeded (429):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 42 seconds.",
    "retry_after": 42,
    "request_id": "req_123e4567"
  }
}
```

---

## Versioning Strategy

See [Version Management](./version-management.md) for complete versioning strategy.

**Summary:**
- Current version: `v1`
- Versioned in URL path: `/v1/...`
- Breaking changes require new version
- Non-breaking changes (additions) deployed to current version
- Deprecated versions supported for 12 months

---

## Related Documentation

- [REST API Standards](../../Standards/api/rest-standards.md) - REST best practices
- [Version Management](./version-management.md) - API versioning strategy
- [Database Standards](../../Standards/data/database-standards.md) - Data models
- [System Overview](../SYSTEM_OVERVIEW.md) - Overall architecture

---

## Status & Roadmap

**Current Status:** Draft specification, evolving with implementation

**Completed Sections:**
- ✅ Authentication & authorization patterns
- ✅ Multi-tenant isolation
- ✅ Pagination standards
- ✅ Error response standards
- ✅ Core endpoints: Customers, Jobs, Estimates, Inventory, Production, Equipment
- ✅ WebSocket real-time events
- ✅ Rate limiting

**Pending Sections:**
- ⏳ Reporting API endpoints
- ⏳ Admin/configuration endpoints
- ⏳ Webhook configuration
- ⏳ Bulk operations
- ⏳ File upload/download endpoints
- ⏳ Search API
- ⏳ Analytics endpoints

**Next Steps:**
1. OpenAPI/Swagger specification generation
2. API documentation website (interactive docs)
3. Client SDK generation (TypeScript, Python)
4. Postman collection
5. API testing suite

---

[⬆ Back to top](#api-specification) | [🏠 AGOG Home](../../README.md) | [📐 Project Architecture](../README.md) | [🔌 API Directory](./README.md)
