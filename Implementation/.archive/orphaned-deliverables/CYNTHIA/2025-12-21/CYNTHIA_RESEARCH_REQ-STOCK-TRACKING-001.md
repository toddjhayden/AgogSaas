# Research Report: REQ-STOCK-TRACKING-001
## Real-Time Stock Level Monitoring

**Agent:** Cynthia (Research Specialist)
**Req Number:** REQ-STOCK-TRACKING-001
**Feature:** Real-Time Stock Level Monitoring
**Date:** 2025-12-20
**Complexity:** Medium
**Estimated Effort:** 2 weeks

---

## Executive Summary

Real-time stock level monitoring is a critical WMS capability for maintaining accurate inventory visibility across physical locations, lots, and SKUs. This research identifies the existing database schema foundation, analyzes consistency requirements, and proposes an event-driven architecture using GraphQL subscriptions backed by NATS Jetstream for scalable real-time updates.

**Key Findings:**
- Existing schema provides solid foundation with `lots` table tracking `quantity_on_hand`, `quantity_available`, and `quantity_allocated`
- Current architecture already uses NATS Jetstream for inter-agent communication
- GraphQL schema exists but lacks real-time subscription support
- Need to implement dual-write pattern: database + NATS event publication
- Critical consistency requirement: quantity_available = quantity_on_hand - quantity_allocated

**Ready for:** Sylvia (Critique Agent) review

---

## 1. Requirements Analysis

### 1.1 Functional Requirements

**What needs to be built:**

1. **Real-Time Stock Level Visibility**
   - Live updates when inventory quantities change
   - Multi-dimensional views: by location, lot, material, facility
   - Support for both on-hand and available quantities
   - Include allocated/reserved quantities

2. **Event-Driven Updates**
   - Trigger updates on inventory transactions (receipts, issues, transfers, adjustments)
   - Trigger updates on reservations (create, fulfill, cancel, expire)
   - Propagate changes immediately to connected clients
   - Support multiple concurrent subscribers

3. **Query Capabilities**
   - Current stock levels by material/item
   - Stock levels by location
   - Stock levels by lot (for traceability)
   - Multi-facility stock aggregation
   - Low stock alerts/thresholds

### 1.2 Acceptance Criteria

**How to know it's done:**

1. ✅ GraphQL subscription implemented for stock level changes
2. ✅ Updates pushed within <1 second of database change
3. ✅ Multiple clients can subscribe simultaneously
4. ✅ Stock levels always consistent (quantity_available = on_hand - allocated)
5. ✅ Support filtering by tenant, facility, material, location
6. ✅ Handle disconnections gracefully (reconnect, catchup)
7. ✅ No duplicate or missed events
8. ✅ Performance: Support 1000+ concurrent subscribers

### 1.3 Assumptions

**What's implied but not stated:**

1. Stock tracking is at the **lot level** (not just material aggregate)
2. Real-time updates required for warehouse operators using handheld devices
3. System must support multi-tenant isolation (each tenant sees only their data)
4. Integration with existing inventory_transactions table
5. Need to track both physical (quantity_on_hand) and logical (quantity_available) inventory
6. Lot-level tracking includes quality status changes (QUARANTINE → RELEASED)

### 1.4 Ambiguities & Questions

**What's unclear or missing:**

1. ❓ **Threshold alerts**: Should system automatically notify when stock falls below safety levels?
   - Recommendation: Yes, include in Phase 2 or as configurable feature

2. ❓ **Historical tracking**: Do we need time-series data (stock levels over time)?
   - Current answer: No, use `inventory_transactions` table for history

3. ❓ **Aggregation level**: Should we support both lot-level AND material-level aggregated views?
   - Recommendation: Yes, provide both for flexibility

4. ❓ **External integrations**: Will external systems (e.g., e-commerce) consume these events?
   - Recommendation: Design for extensibility, use NATS for internal + potential external pub/sub

---

## 2. Codebase Context Research

### 2.1 Existing Database Schema

**Relevant Tables:**

#### `lots` table (V0.0.4__create_wms_module.sql:96-164)
```sql
CREATE TABLE lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Lot identification
    lot_number VARCHAR(100) NOT NULL,
    material_id UUID NOT NULL,

    -- Quantity tracking (STANDARDIZED in V0.0.9)
    original_quantity DECIMAL(18,4) NOT NULL,
    quantity_on_hand DECIMAL(18,4) NOT NULL,      -- Physical inventory
    quantity_available DECIMAL(18,4) NOT NULL,     -- Available for allocation
    quantity_allocated DECIMAL(18,4) DEFAULT 0,    -- Reserved for orders
    unit_of_measure VARCHAR(20),

    -- Location
    location_id UUID,  -- FK to inventory_locations

    -- Traceability
    vendor_lot_number VARCHAR(100),
    received_date DATE,
    expiration_date DATE,

    -- Quality status
    quality_status VARCHAR(20) DEFAULT 'RELEASED',
    -- QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    ...
);
```

**Key Insight:** Column naming was standardized in migration V0.0.9:
- `current_quantity` → `quantity_on_hand`
- `available_quantity` → `quantity_available`
- `allocated_quantity` → `quantity_allocated`

This provides semantic clarity for OLAP/dimensional modeling.

#### `inventory_transactions` table (V0.0.4:171-235)
```sql
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    -- RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP

    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    material_id UUID NOT NULL,
    lot_number VARCHAR(100),

    quantity DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    from_location_id UUID,
    to_location_id UUID,

    -- References
    purchase_order_id UUID,
    sales_order_id UUID,
    production_run_id UUID,
    ...
);
```

**Key Insight:** Every inventory movement creates a transaction record. These are prime candidates for triggering real-time stock updates.

#### `inventory_reservations` table (V0.0.4:737-781)
```sql
CREATE TABLE inventory_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    material_id UUID NOT NULL,
    lot_number VARCHAR(100),
    location_id UUID,

    quantity_reserved DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Reference
    sales_order_id UUID,
    production_order_id UUID,

    -- Expiration
    reservation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration_date TIMESTAMPTZ,

    status VARCHAR(20) DEFAULT 'ACTIVE',
    -- ACTIVE, FULFILLED, EXPIRED, CANCELLED
    ...
);
```

**Key Insight:** Reservations affect `quantity_allocated` in lots table. Changes here must trigger stock level updates.

### 2.2 Existing GraphQL Schema

**File:** `src/graphql/schema/wms.graphql`

**Current Lot Type (lines 68-125):**
```graphql
type Lot {
  id: ID!
  tenantId: ID!
  facilityId: ID!

  # Identification
  lotNumber: String!
  materialId: ID!

  # Quantity
  originalQuantity: Float!
  quantityOnHand: Float!
  quantityAvailable: Float!
  quantityAllocated: Float!
  unitOfMeasure: String

  # Location
  locationId: ID
  location: InventoryLocation

  # Traceability
  receivedDate: Date
  expirationDate: Date

  # Quality
  qualityStatus: QualityStatus!
  ...
}
```

**MISSING:** No GraphQL subscription types defined yet.

### 2.3 Existing NATS Infrastructure

**Files:**
- `src/nats/nats-client.service.ts` - NATS Jetstream client
- `scripts/init-nats-streams.ts` - Stream initialization
- `NATS_QUICKSTART.md` - Documentation

**Current NATS Usage:**
- Inter-agent communication (cynthia, sylvia, roy, jen, billy, priya)
- Deliverable pattern: publish full reports, return tiny notices
- Already connected and running in `docker-compose.yml`

**Stream Pattern:**
```
agog.deliverables.[agent].[type].[feature]
```

**Key Insight:** Infrastructure is ready. We can leverage NATS for inventory event pub/sub pattern.

### 2.4 Similar Implementations

**Searched for:**
- GraphQL subscriptions: None found in current codebase
- WebSocket handling: None found
- Real-time patterns: Only NATS agent communication

**External Pattern Research:**
- Apollo Server supports GraphQL subscriptions via WebSocket
- Recommended pattern: `graphql-ws` protocol
- Backend publishes to NATS → GraphQL subscription resolver consumes from NATS → pushes to WebSocket clients

---

## 3. Technical Constraints

### 3.1 Database Schema Requirements

**No schema changes required** ✅

The existing schema already provides:
1. ✅ Lot-level quantity tracking (quantity_on_hand, quantity_available, quantity_allocated)
2. ✅ Multi-tenant isolation (tenant_id on all tables)
3. ✅ Facility-level partitioning (facility_id)
4. ✅ Location tracking (location_id)
5. ✅ Audit columns (created_at, updated_at)
6. ✅ Indexes on tenant_id, facility_id, material_id

**Optional Enhancement:**
```sql
-- Add index for common stock query pattern (if performance testing shows need)
CREATE INDEX idx_lots_stock_lookup
ON lots(tenant_id, facility_id, material_id, quality_status)
WHERE is_active = true;
```

### 3.2 API Contracts

**GraphQL Subscription Schema (NEW):**

```graphql
# Add to wms.graphql

type Subscription {
  """
  Subscribe to real-time stock level changes
  Filters: tenantId (required), facilityId, materialId, locationId, lotNumber
  """
  stockLevelChanged(
    tenantId: ID!
    facilityId: ID
    materialId: ID
    locationId: ID
    lotNumber: String
  ): StockLevelUpdate!
}

type StockLevelUpdate {
  """Update type: QUANTITY_CHANGED, LOCATION_MOVED, QUALITY_STATUS_CHANGED, RESERVATION_CHANGED"""
  updateType: StockUpdateType!

  """Timestamp of the change"""
  timestamp: DateTime!

  """The lot that changed"""
  lot: Lot!

  """Previous values (for delta calculation)"""
  previousQuantityOnHand: Float
  previousQuantityAvailable: Float
  previousQuantityAllocated: Float

  """Transaction that caused the change (if applicable)"""
  transactionId: ID
  transactionType: String

  """Reservation that caused the change (if applicable)"""
  reservationId: ID
}

enum StockUpdateType {
  QUANTITY_CHANGED
  LOCATION_MOVED
  QUALITY_STATUS_CHANGED
  RESERVATION_CHANGED
  LOT_CREATED
  LOT_DEPLETED
}
```

**Query Enhancements (NEW):**

```graphql
extend type Query {
  """
  Get current stock levels with filtering and aggregation
  Returns lot-level details
  """
  getStockLevels(
    tenantId: ID!
    facilityId: ID
    materialId: ID
    locationId: ID
    includeAllocated: Boolean = true
    onlyAvailable: Boolean = false
  ): [Lot!]!

  """
  Get aggregated stock summary by material
  Rolls up all lots for a material
  """
  getStockSummaryByMaterial(
    tenantId: ID!
    facilityId: ID
    materialIds: [ID!]
  ): [MaterialStockSummary!]!
}

type MaterialStockSummary {
  materialId: ID!
  materialCode: String!
  materialName: String!

  totalQuantityOnHand: Float!
  totalQuantityAvailable: Float!
  totalQuantityAllocated: Float!

  unitOfMeasure: String!

  """Number of active lots"""
  lotCount: Int!

  """Locations where this material is stored"""
  locations: [LocationStockSummary!]!

  """Lots grouped by quality status"""
  byQualityStatus: [QualityStatusSummary!]!
}

type LocationStockSummary {
  locationId: ID!
  locationCode: String!
  quantityOnHand: Float!
  lotCount: Int!
}

type QualityStatusSummary {
  qualityStatus: QualityStatus!
  quantityOnHand: Float!
  lotCount: Int!
}
```

### 3.3 Security Requirements

**Row-Level Security (RLS):**
- ✅ All queries MUST filter by `tenant_id`
- ✅ Users can only subscribe to their tenant's data
- ✅ JWT token validation required for WebSocket connections
- ✅ Facility-level permissions (user.facility_ids must include requested facility)

**Implementation:**
```typescript
// In subscription resolver
context.user.tenant_id === args.tenantId || throw UnauthorizedError
context.user.facility_ids.includes(args.facilityId) || throw UnauthorizedError
```

### 3.4 Performance Considerations

**Scalability Requirements:**
1. Support 1000+ concurrent WebSocket connections
2. Sub-second latency for stock updates
3. Minimize database queries (use NATS events, not polling)
4. Efficient filtering (push only relevant updates to subscribers)

**Optimization Strategies:**
1. **NATS Pub/Sub:** Decouple database writes from client notifications
2. **Subscription Filtering:** Server-side filtering before pushing to clients
3. **Connection Pooling:** PostgreSQL connection pool for resolver queries
4. **Caching:** Redis for hot stock levels (optional, Phase 2)
5. **Batching:** Group rapid updates (e.g., during bulk transfers)

**Estimated Load:**
- 50 warehouse workers × 2 devices each = 100 active connections
- 10 office users monitoring dashboards = 10 connections
- Peak: 200 concurrent subscribers
- Events: ~1000 inventory transactions/day = ~1/minute average, 10/minute peak

**Verdict:** Well within NATS and GraphQL subscription capabilities.

### 3.5 Integration Points

**Systems that will consume stock updates:**

1. **Warehouse Mobile App (Frontend)**
   - GraphQL subscription via WebSocket
   - Updates pick lists, putaway tasks

2. **Inventory Dashboard (Frontend)**
   - GraphQL subscription via WebSocket
   - Real-time KPI updates

3. **Order Fulfillment System**
   - Internal service
   - Monitors stock availability for order promising

4. **Procurement System (Future)**
   - Triggers reorder points
   - Low stock alerts

5. **Production Planning (Future)**
   - Material availability for job scheduling

---

## 4. Edge Cases & Risks

### 4.1 Edge Cases

**1. Concurrent Updates (Race Conditions)**

**Scenario:** Two users simultaneously pick the same material from the same lot.

```
User A picks 100 units at T1 → lot.quantity_on_hand = 500
User B picks 100 units at T2 → lot.quantity_on_hand = 400
```

**Risk:** Without proper locking, quantity could be incorrect.

**Mitigation:**
- Use PostgreSQL row-level locking: `SELECT ... FOR UPDATE`
- Implement optimistic locking with version numbers
- Database transaction isolation level: READ COMMITTED or higher

**Example:**
```sql
BEGIN;
SELECT quantity_on_hand
FROM lots
WHERE id = $1
FOR UPDATE;  -- Lock this row

UPDATE lots
SET quantity_on_hand = quantity_on_hand - $2,
    updated_at = NOW()
WHERE id = $1;

COMMIT;
```

**2. Negative Stock (Overselling)**

**Scenario:** Order allocation exceeds available quantity.

```
Lot has quantity_available = 50
Order 1 allocates 30 → available = 20
Order 2 tries to allocate 40 → ERROR (only 20 available)
```

**Mitigation:**
- Add CHECK constraint: `quantity_available >= 0`
- Application logic validation before insert
- Return error to user with available quantity

**3. Stale Subscriptions (Zombie Clients)**

**Scenario:** Client disconnects without unsubscribing, server keeps sending events.

**Mitigation:**
- WebSocket heartbeat/ping-pong
- Timeout inactive connections (30-60 seconds)
- Clean up subscriptions on disconnect

**4. Event Ordering (Out-of-Order Delivery)**

**Scenario:**
```
Event 1: Receive 100 units (quantity_on_hand = 100)
Event 2: Issue 50 units (quantity_on_hand = 50)
Client receives: Event 2 then Event 1 → displays 100 (WRONG)
```

**Mitigation:**
- Include sequence number or timestamp in events
- Client applies updates in order
- NATS guarantees ordering within same subject

**5. Lot Depletion (Quantity = 0)**

**Scenario:** Lot depleted, should it be marked inactive or deleted?

**Recommendation:**
- Set `is_active = false` (soft delete)
- Keep for audit trail
- Filter in queries: `WHERE is_active = true`

**6. Quality Status Changes**

**Scenario:** Lot in QUARANTINE (quantity_available = 0) → changes to RELEASED (quantity_available = quantity_on_hand)

**Implementation:**
- Trigger stock update event on quality_status change
- Recalculate quantity_available:
  ```sql
  quantity_available = CASE
    WHEN quality_status = 'RELEASED' THEN quantity_on_hand - quantity_allocated
    ELSE 0
  END
  ```

### 4.2 Error Scenarios

**1. Database Connection Lost**
- NATS continues queuing events
- GraphQL subscription pauses
- On reconnect: replay missed events (NATS consumer)

**2. NATS Server Down**
- Database writes continue (no dual-write failure)
- GraphQL subscriptions fail
- Clients reconnect and query current state

**3. Invalid Stock Data**
- Validation rules:
  ```sql
  CHECK (quantity_on_hand >= 0)
  CHECK (quantity_available >= 0)
  CHECK (quantity_allocated >= 0)
  CHECK (quantity_on_hand >= quantity_allocated)
  ```

**4. Tenant Isolation Breach**
- Validate `tenant_id` in every resolver
- Use RLS policies on database
- Never trust client-provided tenant_id (use JWT)

### 4.3 Scalability Concerns

**Potential Bottlenecks:**

1. **Database Write Lock Contention**
   - Problem: High-frequency updates to same lot
   - Solution: Use optimistic locking, partition by location

2. **NATS Message Volume**
   - Problem: 10,000 events/minute overwhelms subscribers
   - Solution: Batching, aggregation, client-side throttling

3. **WebSocket Connection Limits**
   - Problem: Node.js default connection limits
   - Solution: Use connection pooling, horizontal scaling

4. **Query Performance (getStockLevels)**
   - Problem: Complex joins on large datasets
   - Solution: Materialized views, denormalization (Phase 2)

---

## 5. Implementation Recommendations

### 5.1 Architecture: Event-Driven with NATS + GraphQL Subscriptions

**Pattern: Dual-Write with Event Publication**

```
┌─────────────────────────────────────────────────────────┐
│                   GraphQL Mutation                       │
│   (createInventoryTransaction, updateReservation, etc.)  │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  PostgreSQL Database  │
        │                       │
        │  1. Write transaction │
        │  2. Update lot qty    │
        │  3. COMMIT            │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   NATS Publish        │
        │                       │
        │ Subject:              │
        │ wms.inventory.stock   │
        │   .changed.{tenantId} │
        │   .{facilityId}       │
        │                       │
        │ Payload:              │
        │ { lotId, quantities,  │
        │   updateType, ... }   │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ GraphQL Subscription  │
        │ Resolver              │
        │                       │
        │ - Filters by tenant   │
        │ - Filters by facility │
        │ - Publishes to WS     │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  WebSocket Clients    │
        │  (Mobile, Dashboard)  │
        │                       │
        │  Receive real-time    │
        │  stock updates        │
        └───────────────────────┘
```

**Why NATS?**
1. Already integrated in the stack
2. Decouples database writes from client notifications
3. Enables replay, durability, multi-subscriber patterns
4. Can integrate with external systems later

**Why Not PostgreSQL LISTEN/NOTIFY?**
- Limited scalability (not clusterable)
- No message persistence
- No replay capability
- NATS provides better operational characteristics

### 5.2 Technology Stack

**Backend:**
- ✅ **Node.js + TypeScript** (existing)
- ✅ **Apollo Server v4** (upgrade if using v3)
- ✅ **graphql-ws** (WebSocket subprotocol for subscriptions)
- ✅ **NATS Jetstream** (existing)
- ✅ **PostgreSQL 15+** (existing)

**Frontend:**
- ✅ **@apollo/client** (GraphQL client)
- ✅ **graphql-ws** (client-side WebSocket)
- ✅ **React** (existing in frontend module)

**Infrastructure:**
- ✅ **Docker Compose** (already configured with NATS)
- ✅ **NATS Server 2.10+** (JetStream enabled)

### 5.3 Files to Modify

**Backend:**

1. **`src/graphql/schema/wms.graphql`**
   - Add `Subscription` type
   - Add `StockLevelUpdate` type
   - Add `StockUpdateType` enum
   - Add enhanced Query types

2. **`src/graphql/resolvers/wms.resolver.ts`**
   - Add subscription resolver: `Subscription.stockLevelChanged`
   - Add query resolver: `Query.getStockLevels`
   - Add query resolver: `Query.getStockSummaryByMaterial`

3. **`src/nats/nats-client.service.ts`** (extend)
   - Add method: `publishStockUpdate(payload)`
   - Add NATS subject: `wms.inventory.stock.changed.{tenantId}.{facilityId}`

4. **`src/services/inventory-transaction.service.ts`** (NEW)
   - Business logic for creating inventory transactions
   - Dual-write: DB + NATS event publication
   - Method: `createTransaction(data) → { transaction, stockEvent }`

5. **`src/services/inventory-reservation.service.ts`** (NEW)
   - Business logic for creating/updating reservations
   - Update lot.quantity_allocated
   - Publish stock event

6. **`src/index.ts`** (Apollo Server configuration)
   - Add WebSocket server initialization
   - Configure `graphql-ws` plugin
   - Add subscription context (JWT validation)

**Database:**

7. **`migrations/V0.0.14__add_stock_monitoring_helpers.sql`** (NEW)
   - Add database function: `calculate_quantity_available(lot_id)`
   - Add trigger: `update_lot_quantity_available_trigger`
   - Add CHECK constraints for data integrity

**Frontend:**

8. **`frontend/src/graphql/subscriptions/stockLevelSubscription.ts`** (NEW)
   - GraphQL subscription query
   - Apollo client subscription configuration

9. **`frontend/src/hooks/useStockLevel.ts`** (NEW)
   - React hook for subscribing to stock updates
   - Connection management, error handling

### 5.4 Implementation Order

**Phase 1: Foundation (Week 1)**
1. ✅ Add GraphQL schema types (Subscription, StockLevelUpdate)
2. ✅ Configure Apollo Server for WebSocket subscriptions
3. ✅ Extend NATS client with stock event publishing
4. ✅ Add database migration with integrity constraints
5. ✅ Write integration tests

**Phase 2: Business Logic (Week 1)**
1. ✅ Implement `inventory-transaction.service.ts`
2. ✅ Implement `inventory-reservation.service.ts`
3. ✅ Add dual-write pattern (DB + NATS)
4. ✅ Implement subscription resolver
5. ✅ Add authorization checks

**Phase 3: Frontend Integration (Week 2)**
1. ✅ Create subscription GraphQL queries
2. ✅ Implement `useStockLevel` React hook
3. ✅ Update inventory dashboard with real-time data
4. ✅ Add connection status indicator
5. ✅ Handle reconnection/error states

**Phase 4: Testing & Refinement (Week 2)**
1. ✅ Load testing (simulate 200 concurrent connections)
2. ✅ Race condition testing (concurrent updates)
3. ✅ Failover testing (NATS/DB restart)
4. ✅ End-to-end testing (mobile app)
5. ✅ Performance optimization

### 5.5 Code Examples

**Subscription Resolver:**

```typescript
// src/graphql/resolvers/wms.resolver.ts

import { withFilter } from 'graphql-subscriptions';
import { NATSClient } from '../../nats/nats-client.service';

const natsClient = new NATSClient();

export const wmsResolvers = {
  Subscription: {
    stockLevelChanged: {
      subscribe: withFilter(
        () => natsClient.subscribeToDeliverables({
          agent: 'wms',
          taskType: 'inventory',
          feature: 'stock-changed',
          callback: async (message, metadata) => {
            // Message processing handled by iterator
          }
        }),
        (payload, variables, context) => {
          // Filter: only send to authorized tenants/facilities
          if (payload.tenantId !== variables.tenantId) {
            return false;
          }

          if (variables.facilityId && payload.facilityId !== variables.facilityId) {
            return false;
          }

          if (variables.materialId && payload.materialId !== variables.materialId) {
            return false;
          }

          return true;
        }
      ),
      resolve: (payload) => payload,
    },
  },

  Query: {
    getStockLevels: async (_, args, context) => {
      // Validate authorization
      if (context.user.tenant_id !== args.tenantId) {
        throw new Error('Unauthorized');
      }

      const { tenantId, facilityId, materialId, locationId, onlyAvailable } = args;

      const query = `
        SELECT l.*
        FROM lots l
        WHERE l.tenant_id = $1
          AND l.is_active = true
          ${facilityId ? 'AND l.facility_id = $2' : ''}
          ${materialId ? 'AND l.material_id = $3' : ''}
          ${locationId ? 'AND l.location_id = $4' : ''}
          ${onlyAvailable ? 'AND l.quantity_available > 0' : ''}
        ORDER BY l.material_id, l.lot_number
      `;

      const lots = await db.query(query, [tenantId, facilityId, materialId, locationId]);
      return lots.rows;
    },
  },
};
```

**Dual-Write Service:**

```typescript
// src/services/inventory-transaction.service.ts

import { NATSClient } from '../nats/nats-client.service';
import { db } from '../database/connection';

export class InventoryTransactionService {
  private natsClient: NATSClient;

  constructor(natsClient: NATSClient) {
    this.natsClient = natsClient;
  }

  async createTransaction(data: InventoryTransactionInput): Promise<InventoryTransaction> {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // 1. Insert transaction
      const transactionResult = await client.query(`
        INSERT INTO inventory_transactions (
          tenant_id, facility_id, transaction_number, transaction_type,
          material_id, lot_number, quantity, unit_of_measure,
          from_location_id, to_location_id, performed_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        data.tenantId, data.facilityId, data.transactionNumber, data.transactionType,
        data.materialId, data.lotNumber, data.quantity, data.unitOfMeasure,
        data.fromLocationId, data.toLocationId, data.performedByUserId
      ]);

      const transaction = transactionResult.rows[0];

      // 2. Update lot quantities
      let previousQuantityOnHand: number | null = null;

      if (data.lotNumber) {
        const lotResult = await client.query(`
          UPDATE lots
          SET quantity_on_hand = quantity_on_hand + $1,
              quantity_available = quantity_available + $1,
              updated_at = NOW()
          WHERE tenant_id = $2 AND lot_number = $3
          RETURNING
            quantity_on_hand - $1 as prev_quantity_on_hand,
            quantity_on_hand,
            quantity_available,
            quantity_allocated,
            id,
            material_id,
            facility_id,
            location_id
        `, [data.quantity, data.tenantId, data.lotNumber]);

        const lot = lotResult.rows[0];
        previousQuantityOnHand = lot.prev_quantity_on_hand;

        // 3. Publish to NATS
        await this.natsClient.publishDeliverable({
          agent: 'wms',
          taskType: 'inventory',
          feature: 'stock-changed',
          content: JSON.stringify({
            updateType: 'QUANTITY_CHANGED',
            timestamp: new Date().toISOString(),
            lot: {
              id: lot.id,
              lotNumber: data.lotNumber,
              materialId: lot.material_id,
              facilityId: lot.facility_id,
              locationId: lot.location_id,
              quantityOnHand: lot.quantity_on_hand,
              quantityAvailable: lot.quantity_available,
              quantityAllocated: lot.quantity_allocated,
            },
            previousQuantityOnHand,
            previousQuantityAvailable: previousQuantityOnHand - lot.quantity_allocated,
            transactionId: transaction.id,
            transactionType: data.transactionType,
            tenantId: data.tenantId,
            facilityId: data.facilityId,
          }),
        });
      }

      await client.query('COMMIT');

      return transaction;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

**Database Trigger (for quantity_available consistency):**

```sql
-- migrations/V0.0.14__add_stock_monitoring_helpers.sql

-- Function to calculate available quantity
CREATE OR REPLACE FUNCTION calculate_quantity_available()
RETURNS TRIGGER AS $$
BEGIN
  -- Available = On Hand - Allocated
  -- But only if quality status is RELEASED
  IF NEW.quality_status = 'RELEASED' THEN
    NEW.quantity_available := NEW.quantity_on_hand - NEW.quantity_allocated;
  ELSE
    -- QUARANTINE, HOLD, REJECTED → not available
    NEW.quantity_available := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain quantity_available
CREATE TRIGGER update_lot_quantity_available
  BEFORE INSERT OR UPDATE OF quantity_on_hand, quantity_allocated, quality_status
  ON lots
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quantity_available();

-- Add CHECK constraints
ALTER TABLE lots
ADD CONSTRAINT check_quantity_on_hand_non_negative
CHECK (quantity_on_hand >= 0);

ALTER TABLE lots
ADD CONSTRAINT check_quantity_available_non_negative
CHECK (quantity_available >= 0);

ALTER TABLE lots
ADD CONSTRAINT check_quantity_allocated_non_negative
CHECK (quantity_allocated >= 0);

ALTER TABLE lots
ADD CONSTRAINT check_quantity_allocated_not_exceed_on_hand
CHECK (quantity_allocated <= quantity_on_hand);

COMMENT ON TRIGGER update_lot_quantity_available ON lots IS
'Automatically calculates quantity_available based on on_hand, allocated, and quality_status';
```

### 5.6 Testing Strategy

**Unit Tests:**
- Service methods (createTransaction, updateReservation)
- NATS client methods (publishStockUpdate)
- GraphQL resolvers (authorization, filtering)

**Integration Tests:**
- Database + NATS dual-write
- Subscription filtering
- Concurrent transaction handling

**Load Tests:**
- 200 concurrent subscribers
- 1000 transactions/minute
- Measure latency, throughput, error rate

**End-to-End Tests:**
- Mobile app receives real-time updates
- Dashboard shows accurate stock levels
- Reconnection after disconnect

---

## 6. Complexity Assessment

**Overall Complexity: Medium**

**Breakdown:**

| Component | Complexity | Reasoning |
|-----------|-----------|-----------|
| Database Schema | Low | No changes needed, schema already supports it |
| GraphQL Schema | Medium | New subscription types, requires WebSocket setup |
| NATS Integration | Low | Infrastructure exists, just add new subjects |
| Business Logic | Medium | Dual-write pattern, transaction management |
| Frontend Integration | Medium | WebSocket handling, reconnection logic |
| Testing | Medium | Need load testing, concurrency testing |
| Security | Medium | JWT validation, tenant isolation, RLS |

**Risk Factors:**
- ⚠️ Race conditions in concurrent updates (mitigated with locking)
- ⚠️ WebSocket connection stability (mitigated with reconnection logic)
- ⚠️ NATS message ordering (NATS guarantees order per subject)

**Confidence Level:** High

The existing architecture provides a solid foundation. NATS is already integrated, schema is well-designed, and patterns are established. Main work is GraphQL subscription setup and dual-write implementation.

---

## 7. Dependencies & Prerequisites

**Infrastructure:**
- ✅ NATS Jetstream running (already configured)
- ✅ PostgreSQL 15+ (already running)
- ⚠️ Apollo Server upgrade to v4 (if currently on v3)
- ⚠️ WebSocket reverse proxy configuration (Nginx/Traefik)

**Libraries (to install):**
```json
{
  "dependencies": {
    "graphql-ws": "^5.14.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0"
  }
}
```

**External Services:**
- None (all internal)

**Data Migration:**
- No data migration needed
- Add new migration for constraints/triggers

---

## 8. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Race conditions in stock updates | High | Medium | Use row-level locking, optimistic locking |
| WebSocket connection drops | Medium | High | Implement reconnection with exponential backoff |
| NATS server downtime | High | Low | Database writes continue, catch up on reconnect |
| High subscription volume | Medium | Medium | Implement server-side filtering, batching |
| Security breach (tenant isolation) | Critical | Low | Enforce RLS, validate tenant_id in all resolvers |
| Performance degradation | Medium | Medium | Load testing, caching, horizontal scaling |

---

## 9. Success Metrics

**Technical KPIs:**
- ✅ Update latency: <1 second (database write → client notification)
- ✅ Concurrent subscribers: Support 200+ simultaneous connections
- ✅ Uptime: 99.9% availability
- ✅ Data consistency: 100% (no stock level discrepancies)
- ✅ Event delivery: 100% (no missed updates)

**Business KPIs:**
- ✅ Reduced inventory discrepancies (fewer cycle count adjustments)
- ✅ Faster order fulfillment (real-time stock visibility)
- ✅ Improved warehouse efficiency (no manual refresh needed)

---

## 10. Next Steps

**Immediate Actions:**
1. ✅ **Sylvia (Critique Agent):** Review this research report
   - Validate architecture decisions
   - Flag gaps or concerns
   - Approve for implementation

2. ✅ **Roy (Backend Agent):** Implement backend components
   - GraphQL schema changes
   - Subscription resolvers
   - Service layer (dual-write)
   - Database migration

3. ✅ **Jen (Frontend Agent):** Implement frontend components
   - GraphQL subscription queries
   - React hooks
   - Dashboard integration

4. ✅ **Billy (QA Agent):** Create test plan
   - Unit tests
   - Integration tests
   - Load tests
   - Security tests

**Timeline:**
- Week 1: Backend implementation + database migration
- Week 2: Frontend integration + testing
- Week 3: Load testing, refinement, deployment

---

## 11. Open Questions for Stakeholders

1. **Alert Thresholds:**
   - Should the system automatically alert when stock falls below safety levels?
   - Who should receive alerts (email, SMS, push notification)?

2. **Historical Data:**
   - Do we need time-series data for stock level trends?
   - If yes, store in separate time-series database (TimescaleDB) or use existing inventory_transactions?

3. **External Integrations:**
   - Will external systems (e.g., e-commerce platform) consume stock updates?
   - If yes, expose via REST API or direct NATS subscription?

4. **Aggregation Granularity:**
   - Prefer lot-level updates (more frequent, detailed) or material-level aggregates (less frequent, summary)?
   - Recommendation: Both options available via subscription filters

5. **Caching Strategy:**
   - Use Redis for hot stock levels to reduce database load?
   - Recommendation: Start without caching, add if performance testing shows need

---

## 12. References

**Codebase Files:**
- `print-industry-erp/backend/migrations/V0.0.4__create_wms_module.sql` - WMS schema
- `print-industry-erp/backend/migrations/V0.0.9__standardize_quantity_amount_columns.sql` - Quantity standardization
- `print-industry-erp/backend/src/graphql/schema/wms.graphql` - GraphQL schema
- `print-industry-erp/backend/src/nats/nats-client.service.ts` - NATS client
- `print-industry-erp/backend/NATS_QUICKSTART.md` - NATS documentation

**External Documentation:**
- [Apollo Server Subscriptions](https://www.apollographql.com/docs/apollo-server/data/subscriptions/)
- [graphql-ws Protocol](https://github.com/enisdenjo/graphql-ws)
- [NATS Jetstream](https://docs.nats.io/nats-concepts/jetstream)
- [PostgreSQL Row Locking](https://www.postgresql.org/docs/current/explicit-locking.html)

**Architecture Patterns:**
- Event-Driven Architecture
- Dual-Write Pattern
- Pub/Sub Messaging
- Real-Time Data Streaming

---

## Appendix A: GraphQL Subscription Example

**Client-Side Usage (React):**

```typescript
// frontend/src/hooks/useStockLevel.ts

import { useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';

const STOCK_LEVEL_SUBSCRIPTION = gql`
  subscription StockLevelChanged(
    $tenantId: ID!
    $facilityId: ID
    $materialId: ID
  ) {
    stockLevelChanged(
      tenantId: $tenantId
      facilityId: $facilityId
      materialId: $materialId
    ) {
      updateType
      timestamp
      lot {
        id
        lotNumber
        materialId
        quantityOnHand
        quantityAvailable
        quantityAllocated
      }
      previousQuantityOnHand
      previousQuantityAvailable
      transactionType
    }
  }
`;

export function useStockLevel(tenantId: string, facilityId?: string, materialId?: string) {
  const { data, loading, error } = useSubscription(STOCK_LEVEL_SUBSCRIPTION, {
    variables: { tenantId, facilityId, materialId },
    shouldResubscribe: true, // Resubscribe on disconnect
  });

  return {
    stockUpdate: data?.stockLevelChanged,
    loading,
    error,
  };
}
```

**Usage in Component:**

```tsx
// frontend/src/components/InventoryDashboard.tsx

import { useStockLevel } from '../hooks/useStockLevel';

function InventoryDashboard() {
  const { stockUpdate } = useStockLevel('tenant-123', 'facility-456');

  useEffect(() => {
    if (stockUpdate) {
      console.log('Stock updated:', stockUpdate.lot.lotNumber);
      console.log('New quantity:', stockUpdate.lot.quantityOnHand);

      // Update local state, trigger notification, etc.
      updateStockInState(stockUpdate.lot);
    }
  }, [stockUpdate]);

  return <div>...</div>;
}
```

---

## Appendix B: NATS Subject Hierarchy

```
wms.inventory.stock.changed.{tenantId}.{facilityId}

Examples:
- wms.inventory.stock.changed.tenant-123.facility-456
- wms.inventory.stock.changed.tenant-123.*  (all facilities for tenant)
- wms.inventory.stock.changed.*.facility-456  (specific facility, all tenants - not allowed for security)

Payload:
{
  "updateType": "QUANTITY_CHANGED",
  "timestamp": "2025-12-20T10:30:00Z",
  "lot": {
    "id": "lot-uuid",
    "lotNumber": "LOT-2025-001",
    "materialId": "material-uuid",
    "facilityId": "facility-456",
    "locationId": "location-uuid",
    "quantityOnHand": 500,
    "quantityAvailable": 400,
    "quantityAllocated": 100
  },
  "previousQuantityOnHand": 600,
  "previousQuantityAvailable": 500,
  "transactionId": "txn-uuid",
  "transactionType": "ISSUE",
  "tenantId": "tenant-123",
  "facilityId": "facility-456"
}
```

---

**END OF RESEARCH REPORT**

---

## Deliverable Summary

**Status:** ✅ COMPLETE

**Complexity:** Medium
**Estimated Effort:** 2 weeks
**Confidence:** High

**Key Findings:**
1. Existing schema provides solid foundation (no changes needed)
2. NATS infrastructure ready for event-driven updates
3. GraphQL subscriptions feasible with Apollo Server + graphql-ws
4. Main work: dual-write pattern, subscription resolvers, frontend integration

**Risks:** Manageable (race conditions, connection stability)
**Dependencies:** Apollo Server v4, graphql-ws library

**Ready for:** Sylvia (Critique Agent) review

**Files to Create:**
- `migrations/V0.0.14__add_stock_monitoring_helpers.sql`
- `src/services/inventory-transaction.service.ts`
- `src/services/inventory-reservation.service.ts`
- `frontend/src/hooks/useStockLevel.ts`

**Files to Modify:**
- `src/graphql/schema/wms.graphql` (add Subscription, types)
- `src/graphql/resolvers/wms.resolver.ts` (add resolvers)
- `src/nats/nats-client.service.ts` (add stock event methods)
- `src/index.ts` (WebSocket configuration)

**Next Agent:** Sylvia → Roy → Jen → Billy → Priya
