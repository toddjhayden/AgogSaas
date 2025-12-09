**📍 Navigation Path:** [AGOG Home](../../README.md) → [Project Architecture](../README.md) → [API](./README.md) → GraphQL Specification

# GraphQL API Specification

> **Version:** 1.0.0-draft  
> **Last Updated:** 2025-11-03  
> **Status:** Draft - Evolving with implementation  
> **Related:** [REST API Specification](./api-specification.md), [GraphQL Standards](../../Standards/api/graphql-standards.md), [ADR 002](../../Project%20Spirit/adr/002-multi-tenant-saas-edge-architecture.md)

## Overview

AGOG's GraphQL API is built using **Apollo Federation** to compose multiple microservices into a unified graph. This API powers the PWA frontend, BI dashboards, and internal applications requiring flexible, efficient data access.

**GraphQL Endpoint:** `https://api.agog.app/graphql`

**WebSocket (Subscriptions):** `wss://api.agog.app/graphql`

### Why GraphQL for PWA?

- **Client-defined queries:** Fetch exactly what the UI needs, nothing more
- **Single endpoint:** Simplifies frontend development
- **Real-time subscriptions:** Live dashboard updates
- **Type safety:** Auto-generated TypeScript types from schema
- **Developer experience:** GraphQL Playground, Apollo Studio
- **Reduced network overhead:** No over-fetching or under-fetching

### Apollo Federation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Apollo Gateway                          │
│              (Unified GraphQL Endpoint)                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼─────────┐  ┌────────▼─────────┐  ┌────────▼────────┐
│  Orders Service │  │ Inventory Service│  │ Production      │
│  (Subgraph)     │  │  (Subgraph)      │  │ Service         │
└─────────────────┘  └──────────────────┘  └─────────────────┘
```

**Subgraphs (Microservices):**
- **Orders Service:** Customers, quotes, orders, invoices
- **Inventory Service:** Materials, stock levels, suppliers
- **Production Service:** Jobs, schedules, work orders, equipment
- **Quality Service:** Inspections, defects, SPC data
- **Shipping Service:** Carriers, shipments, tracking

Each subgraph owns its domain and can be developed/deployed independently.

---

## Authentication & Authorization

### Authentication Flow

All GraphQL requests require a valid JWT token in the `Authorization` header:

```http
POST https://api.agog.app/graphql
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Obtaining a token:** Use the REST `/auth/login` endpoint (see [api-specification.md](./api-specification.md#authentication-flow))

### Multi-Tenant Context

Every request automatically scoped to the tenant from JWT token:

```graphql
# User only sees their tenant's orders
query {
  orders {
    id
    customerName
    # Automatic tenant_id filter applied
  }
}
```

**Row-Level Security enforced at database layer** (see [ADR 002](../../Project%20Spirit/adr/002-multi-tenant-saas-edge-architecture.md))

### Role-Based Access Control

Queries/mutations restricted by user permissions:

```graphql
# Requires 'order:delete' permission
mutation {
  deleteOrder(id: "123e4567-e89b-12d3-a456-426614174000") {
    success
  }
}
```

---

## Core Schema

### Orders Subgraph

```graphql
type Order @key(fields: "id") {
  id: ID!
  orderNumber: String!
  customer: Customer!
  items: [OrderItem!]!
  status: OrderStatus!
  totalAmount: Money!
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Federation: Reference to Production subgraph
  jobs: [Job!]!
}

type Customer @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
  phone: String
  orders: [Order!]!
  creditLimit: Money
  preferredPaymentTerms: PaymentTerms
}

enum OrderStatus {
  DRAFT
  QUOTED
  APPROVED
  IN_PRODUCTION
  SHIPPED
  INVOICED
  PAID
  CANCELLED
}

type Money {
  amount: Decimal!
  currency: Currency!
}

enum Currency {
  USD
  CAD
  EUR
  GBP
}

# Queries
type Query {
  order(id: ID!): Order
  orders(
    status: OrderStatus
    customerId: ID
    first: Int = 20
    after: String
  ): OrderConnection!
  
  customer(id: ID!): Customer
  customers(
    search: String
    first: Int = 20
    after: String
  ): CustomerConnection!
}

# Mutations
type Mutation {
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
  updateOrder(id: ID!, input: UpdateOrderInput!): UpdateOrderPayload!
  deleteOrder(id: ID!): DeleteOrderPayload!
  
  approveOrder(id: ID!): ApproveOrderPayload!
  cancelOrder(id: ID!, reason: String!): CancelOrderPayload!
}

# Subscriptions (Real-time updates)
type Subscription {
  orderUpdated(orderId: ID): Order!
  orderStatusChanged(orderId: ID): OrderStatusEvent!
}
```

### Production Subgraph

```graphql
type Job @key(fields: "id") {
  id: ID!
  jobNumber: String!
  order: Order!  # Federation reference
  status: JobStatus!
  scheduledStart: DateTime
  actualStart: DateTime
  estimatedDuration: Int  # minutes
  workOrders: [WorkOrder!]!
  equipment: [Equipment!]!
}

type WorkOrder @key(fields: "id") {
  id: ID!
  workOrderNumber: String!
  job: Job!
  operation: String!
  status: WorkOrderStatus!
  assignedTo: Employee
  setupTime: Int
  runTime: Int
  quantity: Int!
  completedQuantity: Int!
}

type Equipment @key(fields: "id") {
  id: ID!
  name: String!
  type: EquipmentType!
  status: EquipmentStatus!
  currentJob: Job
  utilizationRate: Float
  oeeScore: Float
}

enum JobStatus {
  PENDING
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  ON_HOLD
}

# Queries
type Query {
  job(id: ID!): Job
  jobs(
    status: JobStatus
    scheduledAfter: DateTime
    first: Int = 20
  ): JobConnection!
  
  equipment(id: ID!): Equipment
  equipmentList(type: EquipmentType): [Equipment!]!
  
  # Real-time production dashboard
  productionDashboard: ProductionDashboard!
}

type ProductionDashboard {
  activeJobs: [Job!]!
  equipmentUtilization: [EquipmentUtilization!]!
  todayProduction: ProductionMetrics!
  scheduleAdherence: Float!
}

# Subscriptions
type Subscription {
  jobStatusChanged(jobId: ID): Job!
  equipmentStatusChanged(equipmentId: ID): Equipment!
  productionMetricsUpdated: ProductionDashboard!
}
```

### Inventory Subgraph

```graphql
type Material @key(fields: "id") {
  id: ID!
  sku: String!
  name: String!
  category: MaterialCategory!
  unitOfMeasure: UnitOfMeasure!
  currentStock: StockLevel!
  reorderPoint: Int
  reorderQuantity: Int
  supplier: Supplier
}

type StockLevel {
  onHand: Int!
  allocated: Int!
  available: Int!
  onOrder: Int!
  lastUpdated: DateTime!
}

enum MaterialCategory {
  PAPER
  INK
  PLATES
  FILM
  CHEMISTRY
  PACKAGING
  MISCELLANEOUS
}

# Queries
type Query {
  material(id: ID!): Material
  materials(
    category: MaterialCategory
    lowStock: Boolean
    first: Int = 20
  ): MaterialConnection!
  
  # Inventory dashboard
  inventoryDashboard: InventoryDashboard!
}

type InventoryDashboard {
  lowStockMaterials: [Material!]!
  stockValue: Money!
  turnoverRate: Float!
  expiringMaterials: [Material!]!
}

# Subscriptions
type Subscription {
  stockLevelChanged(materialId: ID): Material!
  lowStockAlert: Material!
}
```

---

## Pagination

All list queries use **Cursor-based pagination** (Relay spec):

```graphql
type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrderEdge {
  node: Order!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

**Usage example:**

```graphql
query {
  orders(first: 10, after: "cursor123") {
    edges {
      node {
        id
        orderNumber
        customer { name }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## Error Handling

GraphQL errors include extensions for debugging:

```json
{
  "errors": [
    {
      "message": "Order not found",
      "extensions": {
        "code": "NOT_FOUND",
        "orderId": "123e4567-e89b-12d3-a456-426614174000",
        "timestamp": "2025-11-03T10:30:00Z"
      },
      "path": ["order"]
    }
  ]
}
```

**Error codes:**
- `UNAUTHENTICATED` - No valid JWT token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Input validation failed
- `INTERNAL_ERROR` - Server error

---

## Real-Time Subscriptions

Subscriptions use WebSockets for live updates:

```graphql
subscription {
  productionMetricsUpdated {
    activeJobs {
      id
      jobNumber
      status
    }
    equipmentUtilization {
      equipment { name }
      utilizationRate
    }
  }
}
```

**Frontend implementation (Apollo Client):**

```typescript
import { useSubscription } from '@apollo/client';

const PRODUCTION_METRICS_SUBSCRIPTION = gql`
  subscription {
    productionMetricsUpdated {
      activeJobs { id jobNumber status }
      equipmentUtilization { equipment { name } utilizationRate }
    }
  }
`;

function ProductionDashboard() {
  const { data, loading } = useSubscription(PRODUCTION_METRICS_SUBSCRIPTION);
  
  return <DashboardView metrics={data?.productionMetricsUpdated} />;
}
```

---

## Federation Patterns

### Extending Types Across Subgraphs

**Orders Service defines:**
```graphql
type Order @key(fields: "id") {
  id: ID!
  orderNumber: String!
  customer: Customer!
}
```

**Production Service extends:**
```graphql
extend type Order @key(fields: "id") {
  id: ID! @external
  jobs: [Job!]!  # Add jobs field from Production domain
}
```

**Gateway automatically stitches:**
```graphql
query {
  order(id: "123") {
    orderNumber    # From Orders Service
    customer { name }  # From Orders Service
    jobs {         # From Production Service
      status
    }
  }
}
```

### Entity References

Use `@key` directive for entities shared across subgraphs:

```graphql
type Customer @key(fields: "id") {
  id: ID!
  # Other fields...
}
```

Federation resolves cross-service references automatically.

---

## Development Tools

### GraphQL Playground

**Local:** `http://localhost:4000/graphql`

Interactive query builder with:
- Schema documentation explorer
- Auto-complete for queries
- Query history
- Variable editor

### Apollo Studio

**Production monitoring:**
- Schema registry
- Query performance analytics
- Error tracking
- Trace execution across subgraphs

### Code Generation

Generate TypeScript types from schema:

```bash
npm run codegen
```

Creates type-safe hooks for React:

```typescript
import { useOrdersQuery } from './generated/graphql';

const { data, loading, error } = useOrdersQuery({
  variables: { first: 10 }
});
```

---

## Performance Optimization

### Query Complexity Limits

Prevent expensive queries:

```graphql
# ❌ Rejected: Too deep (complexity > 1000)
query {
  orders {
    items {
      material {
        supplier {
          orders {
            items {
              material { ... }
            }
          }
        }
      }
    }
  }
}
```

**Limit:** 1000 complexity points per query

### DataLoader (N+1 Prevention)

Automatic batching for related entities:

```graphql
query {
  orders {
    customer { name }  # Batched into single query
  }
}
```

### Persisted Queries

Production uses **Automatic Persisted Queries (APQ)** to:
- Reduce request size
- Enable CDN caching
- Improve security (whitelist queries)

---

## Migration from REST

If integrating legacy code expecting REST:

**Option 1: GraphQL queries via REST**
```http
POST /graphql
{ "query": "{ orders { id orderNumber } }" }
```

**Option 2: Use REST API**
See [api-specification.md](./api-specification.md) for REST endpoints

**Recommendation:** New code should use GraphQL, maintain REST for external integrations only.

---

## Related Documentation

- [REST API Specification](./api-specification.md) - For external integrations
- [GraphQL Standards](../../Standards/api/graphql-standards.md) - Schema design guidelines
- [ADR 001: API-First Design](../../Project%20Spirit/adr/api-first-design.md) - API strategy
- [ADR 002: Multi-Tenant SaaS Architecture](../../Project%20Spirit/adr/002-multi-tenant-saas-edge-architecture.md) - System architecture

---

[⬆ Back to top](#graphql-api-specification) | [🏠 AGOG Home](../../README.md) | [🏗️ Project Architecture](../README.md) | [🔌 API](./README.md)
