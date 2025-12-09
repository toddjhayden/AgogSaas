**📍 Navigation Path:** [AGOG Home](../../README.md) → [Standards](../README.md) → [API Standards](./README.md) → GraphQL Standards

# GraphQL API Standards

> **Purpose:** Define schema design, naming conventions, and federation patterns for AGOG's GraphQL API  
> **Applies To:** All GraphQL subgraphs, Apollo Federation gateway  
> **Related:** [GraphQL Specification](../../Project%20Architecture/api/graphql-specification.md), [API-First Design ADR](../../Project%20Spirit/adr/api-first-design.md)

## Schema Design Principles

### 1. Schema-First Development

**Always design schema before implementation:**

```graphql
# 1. Define schema
type Order {
  id: ID!
  orderNumber: String!
  customer: Customer!
}

# 2. Implement resolvers
# 3. Write tests
# 4. Deploy
```

**Benefits:**
- Contract-driven development
- Frontend/backend teams work in parallel
- Auto-generated TypeScript types
- Schema serves as documentation

### 2. Nullable by Default

**Make fields nullable unless always present:**

```graphql
# ✅ Good: Nullable fields (realistic)
type Order {
  id: ID!              # Always present
  orderNumber: String! # Always present
  invoiceNumber: String  # Nullable (invoiced later)
  shippedAt: DateTime    # Nullable (not yet shipped)
}

# ❌ Bad: Everything non-null (causes errors)
type Order {
  id: ID!
  orderNumber: String!
  invoiceNumber: String!  # Error if not invoiced yet
  shippedAt: DateTime!    # Error if not shipped yet
}
```

**Exception:** IDs and enum fields should be non-null.

### 3. Use Descriptive Names

**Be explicit, avoid abbreviations:**

```graphql
# ✅ Good: Clear, descriptive
type CustomerOrder {
  orderNumber: String!
  estimatedDeliveryDate: DateTime
  totalAmount: Money!
}

# ❌ Bad: Abbreviations, unclear
type CustOrd {
  ordNum: String!
  estDelDt: DateTime
  totAmt: Money!
}
```

### 4. Design for Queries, Not Tables

**Think about UI needs, not database structure:**

```graphql
# ✅ Good: Query matches UI needs
query {
  order(id: "123") {
    orderNumber
    customer {
      name
      email
    }
    items {
      productName
      quantity
      price
    }
    totalAmount
  }
}

# ❌ Bad: Exposing raw database joins
query {
  orders_table(id: "123") {
    order_num
    cust_id
  }
  customers_table(id: "456") {
    name
  }
  order_items_table(order_id: "123") {
    prod_id
    qty
  }
}
```

---

## Naming Conventions

### Types

**PascalCase for type names:**

```graphql
type Order { }
type Customer { }
type WorkOrder { }
type ProductionJob { }
```

### Fields

**camelCase for field names:**

```graphql
type Order {
  orderNumber: String!
  createdAt: DateTime!
  estimatedDeliveryDate: DateTime
  totalAmount: Money!
}
```

### Enums

**SCREAMING_SNAKE_CASE for enum values:**

```graphql
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

enum EquipmentType {
  OFFSET_PRESS
  DIGITAL_PRESS
  LARGE_FORMAT
  BINDERY
  FINISHING
}
```

### Queries

**Noun-based query names:**

```graphql
type Query {
  # Singular: Fetch one
  order(id: ID!): Order
  customer(id: ID!): Customer
  
  # Plural: Fetch list
  orders(first: Int, after: String): OrderConnection!
  customers(search: String): CustomerConnection!
  
  # Dashboard/aggregate queries
  productionDashboard: ProductionDashboard!
  inventoryDashboard: InventoryDashboard!
}
```

### Mutations

**Verb-based mutation names:**

```graphql
type Mutation {
  # Create/Update/Delete pattern
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
  updateOrder(id: ID!, input: UpdateOrderInput!): UpdateOrderPayload!
  deleteOrder(id: ID!): DeleteOrderPayload!
  
  # Action-based mutations
  approveOrder(id: ID!): ApproveOrderPayload!
  cancelOrder(id: ID!, reason: String!): CancelOrderPayload!
  shipOrder(id: ID!, carrier: String!): ShipOrderPayload!
}
```

### Subscriptions

**Event-based subscription names:**

```graphql
type Subscription {
  # Past-tense event names
  orderUpdated(orderId: ID): Order!
  orderStatusChanged(orderId: ID): OrderStatusEvent!
  productionMetricsUpdated: ProductionDashboard!
  
  # Alert subscriptions
  lowStockAlert: Material!
  equipmentDownAlert: Equipment!
}
```

---

## Input/Output Patterns

### Input Objects

**Use dedicated input types for mutations:**

```graphql
# ✅ Good: Dedicated input type
input CreateOrderInput {
  customerId: ID!
  items: [OrderItemInput!]!
  deliveryDate: DateTime
  notes: String
}

input OrderItemInput {
  productId: ID!
  quantity: Int!
  customInstructions: String
}

mutation {
  createOrder(input: CreateOrderInput!) {
    order { id orderNumber }
    errors { field message }
  }
}

# ❌ Bad: Flat arguments
mutation {
  createOrder(
    customerId: ID!
    productId: ID!
    quantity: Int!
    deliveryDate: DateTime
    notes: String
  ) { ... }
}
```

**Benefits of input objects:**
- Easier to extend (add new fields)
- Better organization (nested structures)
- Auto-generated TypeScript types

### Payload Objects

**Return structured payloads from mutations:**

```graphql
type CreateOrderPayload {
  order: Order          # The created resource
  errors: [Error!]      # Validation/business errors
  userErrors: [UserError!]  # User-facing errors
}

type Error {
  field: String!
  message: String!
  code: ErrorCode!
}

enum ErrorCode {
  VALIDATION_ERROR
  INSUFFICIENT_INVENTORY
  CUSTOMER_CREDIT_EXCEEDED
  DUPLICATE_ORDER_NUMBER
}
```

**Usage:**

```graphql
mutation {
  createOrder(input: {...}) {
    order {
      id
      orderNumber
    }
    errors {
      field
      message
      code
    }
  }
}
```

**Benefits:**
- Handle errors gracefully (don't throw exceptions)
- Return partial success
- User-friendly error messages

---

## Pagination

**Use Relay-style cursor pagination:**

```graphql
type Query {
  orders(
    first: Int      # Forward pagination
    after: String   # Cursor
    last: Int       # Backward pagination
    before: String  # Cursor
  ): OrderConnection!
}

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

**Why Relay pagination?**
- Cursor-based (handles data changes gracefully)
- Bidirectional (forward/backward navigation)
- Standard pattern (Apollo Client supports natively)
- Works with real-time updates

---

## Apollo Federation Standards

### Entity Keys

**Define entity keys for shared types:**

```graphql
# Orders Service
type Order @key(fields: "id") {
  id: ID!
  orderNumber: String!
  customerId: ID!
}

type Customer @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
}
```

### Extending Types

**Extend types from other subgraphs:**

```graphql
# Production Service extends Order
extend type Order @key(fields: "id") {
  id: ID! @external
  jobs: [Job!]!  # Add production jobs to Order
}

# Implement reference resolver
const resolvers = {
  Order: {
    __resolveReference(order) {
      return findJobsByOrderId(order.id);
    },
    jobs(order) {
      return findJobsByOrderId(order.id);
    }
  }
};
```

### Subgraph Organization

**One subgraph per domain:**

```
graphql/
├─ orders/          # Orders Service
│  ├─ schema.graphql
│  ├─ resolvers.ts
│  └─ dataloaders.ts
├─ production/      # Production Service
│  ├─ schema.graphql
│  ├─ resolvers.ts
│  └─ dataloaders.ts
├─ inventory/       # Inventory Service
│  └─ ...
└─ gateway/         # Apollo Gateway
   └─ index.ts
```

**Each subgraph:**
- Owns its domain data
- Can extend other subgraphs' types
- Independently deployable
- Has its own database (multi-tenant shared DB OK)

---

## Performance Best Practices

### DataLoader for N+1 Prevention

**Always use DataLoader for batching:**

```typescript
import DataLoader from 'dataloader';

// ✅ Good: Batched database queries
const customerLoader = new DataLoader(async (customerIds) => {
  const customers = await db.customers.findAll({
    where: { id: customerIds }
  });
  return customerIds.map(id => 
    customers.find(c => c.id === id)
  );
});

const resolvers = {
  Order: {
    customer(order) {
      return customerLoader.load(order.customerId);
    }
  }
};

// ❌ Bad: N+1 queries
const resolvers = {
  Order: {
    async customer(order) {
      return db.customers.findByPk(order.customerId);
      // Fires 1 query per order!
    }
  }
};
```

### Query Complexity Limits

**Set complexity limits to prevent expensive queries:**

```typescript
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  validationRules: [
    createComplexityLimitRule(1000, {
      onCost: (cost) => console.log('Query cost:', cost),
    }),
  ],
});
```

**Assign complexity scores:**

```graphql
type Query {
  orders: [Order!]! @cost(complexity: 10)
  order(id: ID!): Order @cost(complexity: 1)
}

type Order {
  items: [OrderItem!]! @cost(complexity: 10)
}
```

### Field-Level Caching

**Cache expensive field resolvers:**

```typescript
const resolvers = {
  Order: {
    async totalAmount(order, args, { dataSources }, info) {
      return dataSources.cache.getOrSet(
        `order:${order.id}:totalAmount`,
        () => calculateTotalAmount(order),
        { ttl: 300 }  // 5 minutes
      );
    }
  }
};
```

### Persisted Queries

**Production: Use Automatic Persisted Queries (APQ):**

```typescript
const server = new ApolloServer({
  persistedQueries: {
    ttl: 900,  // 15 minutes
  },
});
```

**Benefits:**
- Reduce request size (send hash instead of query)
- Enable CDN caching
- Whitelist queries (security)

---

## Security Standards

### Multi-Tenant Isolation

**Enforce tenant context in every resolver:**

```typescript
// Context middleware
app.use((req, res, next) => {
  const tenantId = extractTenantFromJWT(req.headers.authorization);
  req.tenantId = tenantId;
  next();
});

// Resolver checks tenant
const resolvers = {
  Query: {
    orders(parent, args, context) {
      if (!context.tenantId) throw new AuthenticationError();
      return db.orders.findAll({
        where: { tenantId: context.tenantId }
      });
    }
  }
};
```

**Use PostgreSQL Row-Level Security for defense-in-depth** (see [Database Standards](../data/database-standards.md))

### Permission Checks

**Validate permissions before mutations:**

```typescript
import { ForbiddenError } from 'apollo-server';

const resolvers = {
  Mutation: {
    deleteOrder(parent, { id }, context) {
      if (!context.user.hasPermission('order:delete')) {
        throw new ForbiddenError('Insufficient permissions');
      }
      return db.orders.destroy({ where: { id } });
    }
  }
};
```

### Input Validation

**Validate all inputs:**

```typescript
import Joi from 'joi';

const createOrderSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  items: Joi.array().min(1).required(),
  deliveryDate: Joi.date().min('now').optional(),
});

const resolvers = {
  Mutation: {
    createOrder(parent, { input }, context) {
      const { error } = createOrderSchema.validate(input);
      if (error) throw new ValidationError(error.details);
      
      // Proceed with creation...
    }
  }
};
```

---

## Error Handling

### Structured Errors

**Use GraphQL error extensions:**

```typescript
throw new ApolloError('Order not found', 'NOT_FOUND', {
  orderId: args.id,
  timestamp: new Date().toISOString(),
});
```

**Response:**

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

### Error Codes

**Standard error codes:**

```typescript
enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE = 'DUPLICATE',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

### User-Friendly Errors

**Return errors in payload for mutations:**

```graphql
mutation {
  createOrder(input: {...}) {
    order { id }
    errors {
      field: "items[0].quantity"
      message: "Insufficient inventory"
      code: INSUFFICIENT_INVENTORY
    }
  }
}
```

**Frontend can display inline field errors.**

---

## Testing Standards

### Schema Testing

**Validate schema composition:**

```typescript
import { composeServices } from '@apollo/federation';

test('Schema composition succeeds', () => {
  const { schema, errors } = composeServices([
    { name: 'orders', typeDefs: ordersSchema },
    { name: 'production', typeDefs: productionSchema },
  ]);
  
  expect(errors).toBeUndefined();
  expect(schema).toBeDefined();
});
```

### Resolver Testing

**Mock data sources:**

```typescript
import { createTestServer } from './test-utils';

test('Query order by ID', async () => {
  const server = createTestServer({
    dataSources: {
      db: {
        orders: {
          findByPk: jest.fn().mockResolvedValue({
            id: '123',
            orderNumber: 'ORD-001',
          }),
        },
      },
    },
  });
  
  const result = await server.executeOperation({
    query: 'query { order(id: "123") { orderNumber } }',
  });
  
  expect(result.data.order.orderNumber).toBe('ORD-001');
});
```

### Integration Testing

**Test federation gateway:**

```typescript
test('Cross-service query works', async () => {
  const result = await gateway.executeOperation({
    query: `
      query {
        order(id: "123") {
          orderNumber       # From Orders Service
          jobs {            # From Production Service
            jobNumber
            status
          }
        }
      }
    `,
  });
  
  expect(result.data.order.jobs).toHaveLength(2);
});
```

---

## Documentation Standards

### Schema Documentation

**Document all types and fields:**

```graphql
"""
Represents a customer order with items, pricing, and status.
Orders can be in various states from draft to paid.
"""
type Order @key(fields: "id") {
  """
  Unique identifier for the order.
  Format: UUID v4
  """
  id: ID!
  
  """
  Human-readable order number shown to customers.
  Format: ORD-YYYYMMDD-NNNN (e.g., ORD-20251103-0042)
  """
  orderNumber: String!
  
  """
  Current status of the order in the workflow.
  See OrderStatus enum for possible values.
  """
  status: OrderStatus!
}
```

### Deprecation

**Mark deprecated fields:**

```graphql
type Order {
  id: ID!
  orderNumber: String!
  
  """
  @deprecated Use `estimatedDeliveryDate` instead.
  This field will be removed in API v2.0 (2026-01-01)
  """
  deliveryDate: DateTime @deprecated(reason: "Use estimatedDeliveryDate")
  
  estimatedDeliveryDate: DateTime
}
```

---

## Related Documentation

- [GraphQL API Specification](../../Project%20Architecture/api/graphql-specification.md) - Full API reference
- [REST API Standards](./rest-standards.md) - REST API guidelines
- [Database Standards](../data/database-standards.md) - Database design rules
- [ADR 001: API-First Design](../../Project%20Spirit/adr/api-first-design.md) - API strategy
- [ADR 002: Multi-Tenant SaaS Architecture](../../Project%20Spirit/adr/002-multi-tenant-saas-edge-architecture.md) - System architecture

---

[⬆ Back to top](#graphql-api-standards) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../README.md) | [🔌 API Standards](./README.md)
