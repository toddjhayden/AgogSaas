# REQ-STOCK-TRACKING-001: Real-Time Stock Level Monitoring
## Research Report by Cynthia (Research Agent)

**Date:** 2025-12-20
**Agent:** Cynthia
**Deliverable:** nats://agog.deliverables.cynthia.research.REQ-STOCK-TRACKING-001
**Status:** COMPLETE

---

## Executive Summary

This report provides comprehensive research for implementing **Real-Time Stock Level Monitoring** in the AGOG Print Industry ERP system. The current system has an excellent foundation with PostgreSQL-based warehouse management, NATS JetStream for event streaming, and GraphQL subscriptions for real-time updates. The implementation will require:

1. **Database extensions** for threshold tracking and materialized views
2. **New NATS streams** for inventory events
3. **GraphQL subscription extensions** for real-time stock updates
4. **Event publishing layer** integrated with existing WMS mutations
5. **Low-stock alerting system** with configurable thresholds

**Estimated Complexity:** Medium
**Technical Risk:** Low (all infrastructure already in place)
**Implementation Approach:** Incremental enhancement to existing WMS module

---

## 1. Current System Architecture

### 1.1 Database Schema (WMS Module)

**Primary Stock Tracking Table: `lots`**

Location: `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.4__create_wms_module.sql:96`

```sql
CREATE TABLE lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Lot identification
    lot_number VARCHAR(100) NOT NULL,
    material_id UUID NOT NULL,

    -- Quantity tracking (CRITICAL COLUMNS)
    original_quantity DECIMAL(18,4) NOT NULL,
    current_quantity DECIMAL(18,4) NOT NULL,      -- ⚠️ OLD NAME
    available_quantity DECIMAL(18,4) NOT NULL,
    allocated_quantity DECIMAL(18,4) DEFAULT 0,
    unit_of_measure VARCHAR(20),

    -- Location
    location_id UUID,

    -- Quality status
    quality_status VARCHAR(20) DEFAULT 'RELEASED',
    -- QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
```

**Stock Quantity Semantics:**
- `original_quantity` - Initial received quantity (immutable baseline)
- `current_quantity` - Current on-hand quantity (physical inventory)
- `available_quantity` - Available for allocation (current - allocated)
- `allocated_quantity` - Reserved for orders (soft + hard reservations)

**⚠️ Column Naming Standardization Issue:**
The `lots` table uses the older column name `current_quantity` instead of the standardized `quantity_on_hand` convention (per migrations V0.0.9, V0.0.11). This will need to be addressed during implementation.

**Indexes for Performance:**
```sql
CREATE INDEX idx_lots_material ON lots(material_id);
CREATE INDEX idx_lots_location ON lots(location_id);
CREATE INDEX idx_lots_facility ON lots(facility_id);
CREATE INDEX idx_lots_quality_status ON lots(quality_status);
```

### 1.2 Inventory Transaction History

**Table: `inventory_transactions`**

Location: `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.4__create_wms_module.sql:171`

```sql
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    transaction_type VARCHAR(50) NOT NULL,
    -- RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP

    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    material_id UUID NOT NULL,
    lot_number VARCHAR(100),
    quantity DECIMAL(18,4) NOT NULL,

    -- Locations
    from_location_id UUID,
    to_location_id UUID,

    -- Reference documents
    purchase_order_id UUID,
    sales_order_id UUID,
    production_run_id UUID,
    shipment_id UUID,

    -- Reason tracking
    reason_code VARCHAR(50),
    reason_description TEXT,

    performed_by_user_id UUID NOT NULL
);
```

**Transaction Types That Affect Stock Levels:**
1. **RECEIPT** - Increases stock (from_location = NULL, to_location = destination)
2. **ISSUE** - Decreases stock (from_location = source, to_location = NULL)
3. **TRANSFER** - Moves stock between locations (both locations set)
4. **ADJUSTMENT** - Manual correction (cycle counts, shrinkage, found inventory)
5. **CYCLE_COUNT** - Variance adjustment from physical counts
6. **RETURN** - Increases stock (customer returns)
7. **SCRAP** - Decreases stock (quality issues, damage)

### 1.3 Current GraphQL Schema

**Location:** `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\graphql\schema\wms.graphql`

**Stock-Related Queries:**

```graphql
type Lot {
  id: ID!
  lotNumber: String!
  materialId: ID!

  # Quantity fields (⚠️ Note: Uses new naming convention in GraphQL)
  originalQuantity: Float!
  quantityOnHand: Float!        # Maps to current_quantity in DB
  quantityAvailable: Float!
  quantityAllocated: Float!
  unitOfMeasure: String

  # Location
  locationId: ID
  location: InventoryLocation

  # Quality
  qualityStatus: QualityStatus!
}

type InventorySummary {
  materialId: ID!
  materialCode: String!
  locationId: ID!
  locationCode: String!
  onHandQuantity: Float!         # SUM(current_quantity)
  quantityAvailable: Float!      # SUM(available_quantity)
  quantityAllocated: Float!      # SUM(allocated_quantity)
  unitOfMeasure: String
  lastCountDate: Date
}

extend type Query {
  # Individual lot queries
  lot(id: ID!): Lot
  lots(
    facilityId: ID!
    materialId: ID
    locationId: ID
    qualityStatus: QualityStatus
    expiringBefore: Date
  ): [Lot!]!

  # Aggregated inventory summary
  inventorySummary(
    facilityId: ID!
    materialId: ID
    locationId: ID
  ): [InventorySummary!]!
}
```

**Stock-Affecting Mutations:**

```graphql
extend type Mutation {
  # Create new lot (e.g., receiving)
  createLot(input: CreateLotInput!): Lot!

  # Adjust lot quantity
  updateLotQuantity(
    id: ID!
    newQuantity: Float!
    reason: String
  ): Lot!

  # Record any inventory movement
  recordInventoryTransaction(
    input: RecordInventoryTransactionInput!
  ): InventoryTransaction!

  # Physical cycle count
  performCycleCount(
    locationId: ID!
    materialId: ID!
    countedQuantity: Float!
    notes: String
  ): InventoryTransaction!

  # Reserve/allocate inventory
  reserveInventory(input: ReserveInventoryInput!): InventoryReservation!
  releaseReservation(id: ID!): InventoryReservation!
}
```

### 1.4 NATS JetStream Infrastructure

**Location:** `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\nats/`

**Current Configuration:**
- **NATS Server:** v2.10+ with JetStream enabled
- **Docker Port:** 4222 (internal), 4223 (external)
- **Storage:** File-based persistent streams in `/data/jetstream`
- **Max Payload:** 10MB
- **Retention:** 7 days, 10,000 messages, 1GB max per stream

**Existing Streams (Agent Deliverables):**
```typescript
// Currently configured for 6 agent-specific streams
const AGENT_DELIVERABLE_STREAMS = [
  'agog_features_research',    // agog.deliverables.cynthia.>
  'agog_features_critique',    // agog.deliverables.sylvia.>
  'agog_features_backend',     // agog.deliverables.roy.>
  'agog_features_frontend',    // agog.deliverables.jen.>
  'agog_features_qa',          // agog.deliverables.billy.>
  'agog_features_statistics'   // agog.deliverables.priya.>
];
```

**NATS Services Available:**

**1. NATSClient (Low-level operations)**
Location: `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\nats\nats-client.service.ts`

```typescript
class NATSClient {
  async connect(): Promise<void>
  async close(): Promise<void>

  // Stream management
  async createStream(config: StreamConfig): Promise<StreamInfo>
  async getAllStreamsStatus(): Promise<StreamInfo[]>

  // Publish/Subscribe
  async publish(subject: string, data: any): Promise<void>
  async subscribe(subject: string, callback: (msg: JsMsg) => void): Promise<void>
}
```

**2. NATSDeliverableService (High-level agent API)**
Location: `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\nats\nats-deliverable.service.ts`

```typescript
class NATSDeliverableService {
  // Publish full agent reports
  async publishReport(params: {
    agent: string;
    taskType: string;
    feature: string;
    content: string;
  }): Promise<void>

  // Fetch previous deliverables
  async fetchReport(
    agent: string,
    taskType: string,
    feature: string
  ): Promise<string | null>

  // Create small completion notices
  async createCompletionNotice(notice: {
    agent: string;
    reqNumber: string;
    status: string;
    deliverable: string;
    summary: string;
  }): Promise<string>
}
```

### 1.5 GraphQL Subscription Infrastructure

**Location:** `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\modules\monitoring\graphql\schema.graphql`

**Current Subscription Pattern:**

```graphql
type Subscription {
  # System monitoring
  systemHealthUpdated: SystemHealth!

  # Error tracking
  errorCreated(severity: ErrorSeverity): SystemError!
  errorUpdated(id: ID): SystemError!

  # Agent activity
  agentActivityUpdated(agentId: String): AgentActivity!

  # Workflow tracking
  workflowUpdated(reqNumber: String): FeatureWorkflow!
}
```

**Implementation Pattern (Apollo Server with PubSub):**

```typescript
// Resolver pattern for subscriptions
const subscriptionResolvers = {
  Subscription: {
    systemHealthUpdated: {
      subscribe: () => pubsub.asyncIterator(['SYSTEM_HEALTH_UPDATED']),
    },
    errorCreated: {
      subscribe: (_, { severity }) => {
        const channel = severity
          ? `ERROR_CREATED_${severity}`
          : 'ERROR_CREATED';
        return pubsub.asyncIterator([channel]);
      },
    },
  },
};

// Publishing events
await pubsub.publish('SYSTEM_HEALTH_UPDATED', {
  systemHealthUpdated: healthData
});
```

**WebSocket Transport:** Configured and ready in Apollo Server setup

---

## 2. Gap Analysis

### 2.1 Missing Components for Real-Time Stock Monitoring

#### A. Database-Level Gaps

**1. No Stock Threshold Configuration**

Current schema has no way to define:
- Minimum stock levels (reorder point)
- Maximum stock levels (overstock threshold)
- Safety stock quantities
- Reorder quantities
- Lead time considerations

**Recommendation:** Create new table `stock_thresholds` or add columns to existing materials table.

**2. No Materialized View for Fast Stock Aggregation**

Current `inventorySummary` query computes aggregation on-demand:
```sql
SELECT
  material_id,
  location_id,
  SUM(current_quantity) as on_hand_quantity,
  SUM(available_quantity) as quantity_available,
  SUM(allocated_quantity) as quantity_allocated
FROM lots
GROUP BY material_id, location_id;
```

**Impact:** Slow performance on large datasets (100K+ lots)

**Recommendation:** Create materialized view with automatic refresh trigger.

**3. No Database Trigger for Change Detection**

Stock level changes are not automatically captured. Requires manual event publishing from application layer.

**Recommendation:** Create PostgreSQL trigger function on `lots` table UPDATE operations.

#### B. NATS Stream Gaps

**1. No Inventory-Specific NATS Streams**

Current NATS setup only has agent deliverable streams. Need new streams for:
- Stock level changes
- Low stock alerts
- High stock alerts
- Stock variance events

**Recommendation:** Create new stream `agog_inventory_events`

**2. No Event Publishing from WMS Mutations**

Current GraphQL mutations update database but don't publish NATS events.

**Example:** `updateLotQuantity` mutation:
```typescript
// Current implementation (simplified)
async updateLotQuantity(id: string, newQuantity: number) {
  // Update database
  await db.query('UPDATE lots SET current_quantity = $1 WHERE id = $2',
    [newQuantity, id]);

  // ❌ Missing: Publish NATS event
  // ❌ Missing: Check threshold violations
  // ❌ Missing: Trigger GraphQL subscription

  return updatedLot;
}
```

**Recommendation:** Extend all stock-affecting mutations to publish events.

#### C. GraphQL Subscription Gaps

**1. No Stock-Level-Specific Subscriptions**

Current subscriptions cover system monitoring, not inventory.

**Missing Subscriptions:**
```graphql
# Not yet implemented
type Subscription {
  stockLevelUpdated(
    materialId: ID
    facilityId: ID
    locationId: ID
  ): StockLevelUpdate!

  lowStockAlert(
    facilityId: ID
    severity: AlertSeverity
  ): LowStockAlert!

  stockAdjustmentMade(
    facilityId: ID
    transactionType: TransactionType
  ): InventoryTransaction!
}
```

**2. No Stock Alert Types Defined**

Need new GraphQL types for alert payloads.

#### D. Real-Time Monitoring Dashboard Gaps

**1. No Frontend Real-Time Components**

Frontend does not have:
- WebSocket subscription client setup
- Real-time stock level widgets
- Alert notification system
- Live inventory dashboard

**Note:** This is out of scope for Marcus (backend). Jen (frontend agent) will handle this.

---

## 3. Recommended Architecture

### 3.1 System Design Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Jen)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  Dashboard   │  │  Alerts      │  │  Stock Level        │  │
│  │  Widget      │  │  Component   │  │  Charts             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────────────┘  │
│         │                 │                 │                  │
│         └─────────────────┴─────────────────┘                  │
│                           │                                     │
│                  WebSocket Connection                          │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                  GRAPHQL SUBSCRIPTIONS (Roy)                    │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────┐        │
│  │  subscription stockLevelUpdated {                  │        │
│  │    materialId, locationId, quantityOnHand, ...     │        │
│  │  }                                                  │        │
│  └────────────────────────┬───────────────────────────┘        │
│                           │                                     │
│                    PubSub.publish()                             │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│              EVENT PUBLISHING LAYER (Roy)                       │
│                           │                                     │
│  ┌────────────────────────▼───────────────────────────┐        │
│  │  StockEventPublisher Service                       │        │
│  │  ┌──────────────────────────────────────────────┐  │        │
│  │  │ 1. Detect stock change                       │  │        │
│  │  │ 2. Check threshold violations                │  │        │
│  │  │ 3. Publish to NATS                           │  │        │
│  │  │ 4. Publish to GraphQL PubSub                 │  │        │
│  │  │ 5. Log event to monitoring                   │  │        │
│  │  └──────────────────────────────────────────────┘  │        │
│  └────────────────────────┬───────────────────────────┘        │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    │                │
                    ▼                ▼
         ┌──────────────┐   ┌────────────────┐
         │     NATS     │   │   PostgreSQL   │
         │  JetStream   │   │   Database     │
         └──────────────┘   └────────────────┘
              │                     │
              │                     │
         ┌────▼─────┐          ┌───▼────┐
         │ Streams  │          │ Trigger│
         │ ├─stock  │          │ AFTER  │
         │ ├─alerts │          │ UPDATE │
         │ └─events │          │ ON lots│
         └──────────┘          └────────┘
```

### 3.2 Data Flow for Stock Level Change

**Scenario:** User performs cycle count adjustment via GraphQL mutation

```typescript
// Step 1: Frontend calls mutation
mutation {
  performCycleCount(
    locationId: "uuid-location-123"
    materialId: "uuid-material-456"
    countedQuantity: 150.0
    notes: "Cycle count - found 10 extra units"
  ) {
    id
    quantityOnHand
    quantityAvailable
  }
}

// Step 2: Backend WMS Resolver
async performCycleCount(parent, args, context) {
  const { locationId, materialId, countedQuantity, notes } = args;

  // 2a. Fetch current lot
  const lot = await db.query(
    'SELECT * FROM lots WHERE location_id = $1 AND material_id = $2',
    [locationId, materialId]
  );

  const variance = countedQuantity - lot.current_quantity;

  // 2b. Create inventory transaction
  const transaction = await db.query(`
    INSERT INTO inventory_transactions (
      transaction_type, material_id, quantity,
      reason_code, reason_description
    ) VALUES (
      'CYCLE_COUNT', $1, $2, 'VARIANCE', $3
    ) RETURNING *
  `, [materialId, variance, notes]);

  // 2c. Update lot quantity
  const updatedLot = await db.query(`
    UPDATE lots
    SET
      current_quantity = $1,
      available_quantity = $1 - allocated_quantity,
      updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [countedQuantity, lot.id]);

  // 2d. ⭐ NEW: Publish stock level event
  await stockEventPublisher.publishStockChange({
    lotId: updatedLot.id,
    materialId: updatedLot.material_id,
    facilityId: updatedLot.facility_id,
    locationId: updatedLot.location_id,
    previousQuantity: lot.current_quantity,
    newQuantity: countedQuantity,
    variance: variance,
    transactionType: 'CYCLE_COUNT',
    timestamp: new Date()
  });

  return updatedLot;
}

// Step 3: StockEventPublisher Service
class StockEventPublisher {
  async publishStockChange(event: StockChangeEvent) {
    // 3a. Fetch threshold configuration
    const threshold = await this.getStockThreshold(
      event.materialId,
      event.facilityId
    );

    // 3b. Check for threshold violations
    const alerts = this.checkThresholds(event.newQuantity, threshold);

    // 3c. Publish to NATS
    await this.natsClient.publish(
      `inventory.stock.${event.facilityId}.${event.materialId}.updated`,
      {
        ...event,
        alerts
      }
    );

    // 3d. Publish to GraphQL PubSub
    await this.pubsub.publish('STOCK_LEVEL_UPDATED', {
      stockLevelUpdated: {
        materialId: event.materialId,
        facilityId: event.facilityId,
        locationId: event.locationId,
        quantityOnHand: event.newQuantity,
        variance: event.variance,
        transactionType: event.transactionType,
        timestamp: event.timestamp
      }
    });

    // 3e. If low stock alert
    if (alerts.includes('LOW_STOCK')) {
      await this.pubsub.publish('LOW_STOCK_ALERT', {
        lowStockAlert: {
          materialId: event.materialId,
          facilityId: event.facilityId,
          currentQuantity: event.newQuantity,
          minimumQuantity: threshold.min_quantity,
          severity: this.calculateSeverity(event.newQuantity, threshold),
          timestamp: new Date()
        }
      });
    }

    // 3f. Log to monitoring system
    await this.monitoringService.logEvent('STOCK_LEVEL_CHANGED', event);
  }

  checkThresholds(quantity, threshold) {
    const alerts = [];

    if (quantity <= threshold.min_quantity) {
      alerts.push('LOW_STOCK');
    }
    if (quantity <= threshold.reorder_point) {
      alerts.push('REORDER_NEEDED');
    }
    if (quantity >= threshold.max_quantity) {
      alerts.push('OVERSTOCK');
    }

    return alerts;
  }

  calculateSeverity(quantity, threshold) {
    const percentOfMin = (quantity / threshold.min_quantity) * 100;

    if (percentOfMin <= 25) return 'CRITICAL';
    if (percentOfMin <= 50) return 'HIGH';
    if (percentOfMin <= 75) return 'MEDIUM';
    return 'LOW';
  }
}

// Step 4: Frontend receives real-time update
const subscription = useSubscription(STOCK_LEVEL_UPDATED_SUBSCRIPTION, {
  variables: {
    materialId: 'uuid-material-456',
    facilityId: 'uuid-facility-789'
  },
  onSubscriptionData: ({ subscriptionData }) => {
    // Update UI with new stock level
    const { quantityOnHand, variance } = subscriptionData.data.stockLevelUpdated;

    updateStockDisplay(quantityOnHand);

    if (variance !== 0) {
      showToast(`Stock adjusted by ${variance} units`);
    }
  }
});
```

---

## 4. Implementation Phases

### Phase 1: Database Extensions ⚙️

**Owner:** Marcus (Backend Agent)
**Estimated Effort:** 2-3 hours
**Dependencies:** None

#### 1.1 Create Stock Thresholds Table

```sql
-- Migration: V0.0.14__add_stock_thresholds.sql

CREATE TABLE stock_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    material_id UUID NOT NULL,

    -- Threshold quantities
    minimum_quantity DECIMAL(18,4) NOT NULL,
    reorder_point DECIMAL(18,4) NOT NULL,
    maximum_quantity DECIMAL(18,4),
    safety_stock_quantity DECIMAL(18,4),
    reorder_quantity DECIMAL(18,4),

    -- Lead time (for reorder calculations)
    lead_time_days INTEGER,

    -- Alert configuration
    enable_low_stock_alerts BOOLEAN DEFAULT TRUE,
    enable_overstock_alerts BOOLEAN DEFAULT FALSE,
    alert_recipient_emails TEXT[],  -- Array of email addresses

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_stock_threshold_tenant FOREIGN KEY (tenant_id)
      REFERENCES tenants(id),
    CONSTRAINT fk_stock_threshold_facility FOREIGN KEY (facility_id)
      REFERENCES facilities(id),
    CONSTRAINT uq_stock_threshold
      UNIQUE (tenant_id, facility_id, material_id),
    CONSTRAINT chk_minimum_less_than_reorder
      CHECK (minimum_quantity <= reorder_point),
    CONSTRAINT chk_reorder_less_than_maximum
      CHECK (maximum_quantity IS NULL OR reorder_point <= maximum_quantity)
);

CREATE INDEX idx_stock_thresholds_material
  ON stock_thresholds(material_id);
CREATE INDEX idx_stock_thresholds_facility
  ON stock_thresholds(facility_id);

COMMENT ON TABLE stock_thresholds IS
  'Stock level thresholds for real-time monitoring and alerting';
```

#### 1.2 Create Materialized View for Stock Aggregation

```sql
-- Migration: V0.0.14__add_stock_thresholds.sql (continued)

CREATE MATERIALIZED VIEW mv_stock_levels AS
SELECT
    l.tenant_id,
    l.facility_id,
    l.material_id,
    l.location_id,

    -- Aggregated quantities
    SUM(l.current_quantity) as total_on_hand,
    SUM(l.available_quantity) as total_available,
    SUM(l.allocated_quantity) as total_allocated,

    -- Lot details
    COUNT(l.id) as lot_count,
    MIN(l.expiration_date) as earliest_expiration,
    MAX(l.updated_at) as last_updated,

    -- Threshold comparison (join with thresholds)
    st.minimum_quantity,
    st.reorder_point,
    st.maximum_quantity,

    -- Alert flags
    CASE
      WHEN SUM(l.available_quantity) <= st.minimum_quantity
      THEN TRUE
      ELSE FALSE
    END as is_low_stock,

    CASE
      WHEN SUM(l.available_quantity) <= st.reorder_point
      THEN TRUE
      ELSE FALSE
    END as needs_reorder,

    CASE
      WHEN st.maximum_quantity IS NOT NULL
        AND SUM(l.current_quantity) >= st.maximum_quantity
      THEN TRUE
      ELSE FALSE
    END as is_overstock

FROM lots l
LEFT JOIN stock_thresholds st
  ON l.tenant_id = st.tenant_id
  AND l.facility_id = st.facility_id
  AND l.material_id = st.material_id
WHERE l.is_active = TRUE
  AND l.quality_status = 'RELEASED'
GROUP BY
  l.tenant_id,
  l.facility_id,
  l.material_id,
  l.location_id,
  st.minimum_quantity,
  st.reorder_point,
  st.maximum_quantity;

-- Indexes for fast queries
CREATE UNIQUE INDEX idx_mv_stock_levels_pk
  ON mv_stock_levels(tenant_id, facility_id, material_id, location_id);

CREATE INDEX idx_mv_stock_levels_low_stock
  ON mv_stock_levels(facility_id, is_low_stock)
  WHERE is_low_stock = TRUE;

CREATE INDEX idx_mv_stock_levels_reorder
  ON mv_stock_levels(facility_id, needs_reorder)
  WHERE needs_reorder = TRUE;

COMMENT ON MATERIALIZED VIEW mv_stock_levels IS
  'Fast aggregated stock levels with threshold comparison';
```

#### 1.3 Create Trigger for Automatic Materialized View Refresh

```sql
-- Migration: V0.0.14__add_stock_thresholds.sql (continued)

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_stock_levels_mv()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the materialized view concurrently (non-blocking)
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_levels;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on lots table updates
CREATE TRIGGER trg_refresh_stock_levels_after_lot_update
AFTER INSERT OR UPDATE OR DELETE ON lots
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_stock_levels_mv();

-- Trigger on stock_thresholds table updates
CREATE TRIGGER trg_refresh_stock_levels_after_threshold_update
AFTER INSERT OR UPDATE OR DELETE ON stock_thresholds
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_stock_levels_mv();

COMMENT ON FUNCTION refresh_stock_levels_mv IS
  'Auto-refresh materialized view when lot quantities or thresholds change';
```

**⚠️ Performance Note:**
`REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index and allows reads during refresh. For large datasets (100K+ rows), consider:
- Scheduled refresh every 5 minutes instead of trigger-based
- Partitioning by facility_id
- Incremental refresh logic

#### 1.4 Create Event Notification Function (PostgreSQL NOTIFY)

```sql
-- Migration: V0.0.14__add_stock_thresholds.sql (continued)

-- Function to emit PostgreSQL NOTIFY for stock changes
CREATE OR REPLACE FUNCTION notify_stock_level_changed()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  -- Only notify on quantity changes
  IF (TG_OP = 'UPDATE'
      AND OLD.current_quantity IS DISTINCT FROM NEW.current_quantity)
  THEN
    payload := json_build_object(
      'operation', TG_OP,
      'lot_id', NEW.id,
      'material_id', NEW.material_id,
      'facility_id', NEW.facility_id,
      'location_id', NEW.location_id,
      'old_quantity', OLD.current_quantity,
      'new_quantity', NEW.current_quantity,
      'variance', NEW.current_quantity - OLD.current_quantity,
      'timestamp', CURRENT_TIMESTAMP
    );

    PERFORM pg_notify('stock_level_changed', payload::text);
  END IF;

  -- Also notify on INSERT (new lot received)
  IF (TG_OP = 'INSERT') THEN
    payload := json_build_object(
      'operation', TG_OP,
      'lot_id', NEW.id,
      'material_id', NEW.material_id,
      'facility_id', NEW.facility_id,
      'location_id', NEW.location_id,
      'new_quantity', NEW.current_quantity,
      'timestamp', CURRENT_TIMESTAMP
    );

    PERFORM pg_notify('stock_level_changed', payload::text);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on lots table
CREATE TRIGGER trg_notify_stock_level_changed
AFTER INSERT OR UPDATE ON lots
FOR EACH ROW
EXECUTE FUNCTION notify_stock_level_changed();

COMMENT ON FUNCTION notify_stock_level_changed IS
  'Emit PostgreSQL NOTIFY event when lot quantities change';
```

**Usage in Backend:**
```typescript
// Listen for PostgreSQL NOTIFY events
db.on('notification', (notification) => {
  if (notification.channel === 'stock_level_changed') {
    const event = JSON.parse(notification.payload);

    // Publish to NATS
    natsClient.publish(
      `inventory.stock.${event.facility_id}.${event.material_id}.updated`,
      event
    );

    // Publish to GraphQL PubSub
    pubsub.publish('STOCK_LEVEL_UPDATED', {
      stockLevelUpdated: event
    });
  }
});

// Setup listener
db.query('LISTEN stock_level_changed');
```

---

### Phase 2: NATS Stream Configuration ⚙️

**Owner:** Marcus (Backend Agent)
**Estimated Effort:** 1-2 hours
**Dependencies:** Phase 1 complete

#### 2.1 Define Inventory Event Streams

```typescript
// File: src/nats/inventory-streams.config.ts

import { StreamConfig, RetentionPolicy, StorageType } from 'nats';

export const INVENTORY_STREAM_CONFIGS: StreamConfig[] = [
  {
    // Main inventory events stream
    name: 'agog_inventory_events',
    subjects: [
      'inventory.stock.*.*.updated',     // facility_id.material_id.updated
      'inventory.stock.*.*.created',
      'inventory.transaction.*.*',       // facility_id.transaction_type
      'inventory.reservation.*.*',       // facility_id.reservation_type
    ],
    storage: StorageType.File,
    retention: RetentionPolicy.Limits,
    max_msgs: 100000,              // 100K events
    max_bytes: 500 * 1024 * 1024,  // 500 MB
    max_age: 30 * 24 * 60 * 60,    // 30 days (in nanoseconds)
    max_msg_size: 1024 * 1024,     // 1 MB per event
    discard: 'old',                // Discard oldest when full
    duplicate_window: 120          // 2 minutes dedup window
  },

  {
    // Alert stream (higher priority, longer retention)
    name: 'agog_inventory_alerts',
    subjects: [
      'inventory.alert.low_stock.*',     // facility_id
      'inventory.alert.reorder.*',
      'inventory.alert.overstock.*',
      'inventory.alert.variance.*',
    ],
    storage: StorageType.File,
    retention: RetentionPolicy.Limits,
    max_msgs: 50000,
    max_bytes: 100 * 1024 * 1024,  // 100 MB
    max_age: 90 * 24 * 60 * 60,    // 90 days
    max_msg_size: 512 * 1024,      // 512 KB
    discard: 'old',
    duplicate_window: 300          // 5 minutes dedup window
  },

  {
    // Audit stream (compliance, never discard)
    name: 'agog_inventory_audit',
    subjects: [
      'inventory.audit.adjustment.*',
      'inventory.audit.cycle_count.*',
      'inventory.audit.scrap.*',
    ],
    storage: StorageType.File,
    retention: RetentionPolicy.Limits,
    max_msgs: -1,                  // Unlimited
    max_bytes: 1024 * 1024 * 1024, // 1 GB
    max_age: 365 * 24 * 60 * 60,   // 1 year
    max_msg_size: 2 * 1024 * 1024, // 2 MB
    discard: 'old'
  }
];
```

#### 2.2 Stream Initialization Script

```typescript
// File: scripts/init-inventory-streams.ts

import { NATSClient } from '../src/nats/nats-client.service';
import { INVENTORY_STREAM_CONFIGS } from '../src/nats/inventory-streams.config';
import dotenv from 'dotenv';

dotenv.config();

async function initInventoryStreams() {
  console.log('🏭 Initializing Inventory NATS Streams');
  console.log('========================================\n');

  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  const client = new NATSClient(natsUrl);

  try {
    await client.connect();

    for (const config of INVENTORY_STREAM_CONFIGS) {
      console.log(`Creating stream: ${config.name}`);
      console.log(`  Subjects: ${config.subjects.join(', ')}`);

      await client.createStream(config);

      console.log(`  ✅ Created\n`);
    }

    console.log('📊 Stream Status:\n');
    const streams = await client.getAllStreamsStatus();

    const inventoryStreams = streams.filter(s =>
      s.name.startsWith('agog_inventory')
    );

    for (const stream of inventoryStreams) {
      console.log(`${stream.name}:`);
      console.log(`  Messages: ${stream.messages}`);
      console.log(`  Bytes: ${(stream.bytes / 1024).toFixed(2)} KB`);
      console.log(`  Consumers: ${stream.consumer_count}\n`);
    }

    await client.close();

    console.log('✅ Inventory streams initialized!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  initInventoryStreams();
}

export { initInventoryStreams };
```

**Run with:**
```bash
npm run init:inventory-streams
# OR
ts-node scripts/init-inventory-streams.ts
```

#### 2.3 Inventory Event Publisher Service

```typescript
// File: src/services/inventory-event-publisher.service.ts

import { NATSClient } from '../nats/nats-client.service';
import { PubSub } from 'graphql-subscriptions';

export interface StockChangeEvent {
  lotId: string;
  materialId: string;
  facilityId: string;
  locationId: string;
  previousQuantity: number;
  newQuantity: number;
  variance: number;
  transactionType: string;
  timestamp: Date;
}

export interface StockAlert {
  alertType: 'LOW_STOCK' | 'REORDER_NEEDED' | 'OVERSTOCK' | 'VARIANCE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  materialId: string;
  facilityId: string;
  currentQuantity: number;
  thresholdQuantity: number;
  variance?: number;
  timestamp: Date;
}

export class InventoryEventPublisher {
  constructor(
    private natsClient: NATSClient,
    private pubsub: PubSub
  ) {}

  /**
   * Publish stock level change event
   */
  async publishStockChange(event: StockChangeEvent): Promise<void> {
    // 1. Publish to NATS
    const subject = `inventory.stock.${event.facilityId}.${event.materialId}.updated`;
    await this.natsClient.publish(subject, event);

    // 2. Publish to GraphQL PubSub for subscriptions
    await this.pubsub.publish('STOCK_LEVEL_UPDATED', {
      stockLevelUpdated: {
        materialId: event.materialId,
        facilityId: event.facilityId,
        locationId: event.locationId,
        quantityOnHand: event.newQuantity,
        quantityChange: event.variance,
        transactionType: event.transactionType,
        timestamp: event.timestamp
      }
    });

    // 3. Fetch threshold and check for alerts
    const threshold = await this.getStockThreshold(
      event.materialId,
      event.facilityId
    );

    if (threshold) {
      const alerts = this.checkThresholds(event.newQuantity, threshold);

      for (const alert of alerts) {
        await this.publishAlert(alert);
      }
    }

    // 4. Audit log
    if (['ADJUSTMENT', 'CYCLE_COUNT', 'SCRAP'].includes(event.transactionType)) {
      await this.publishAuditEvent(event);
    }
  }

  /**
   * Publish stock alert
   */
  async publishAlert(alert: StockAlert): Promise<void> {
    // 1. Publish to NATS alerts stream
    const subject = `inventory.alert.${alert.alertType.toLowerCase()}.${alert.facilityId}`;
    await this.natsClient.publish(subject, alert);

    // 2. Publish to GraphQL PubSub
    if (alert.alertType === 'LOW_STOCK' || alert.alertType === 'REORDER_NEEDED') {
      await this.pubsub.publish('LOW_STOCK_ALERT', {
        lowStockAlert: alert
      });
    }

    // 3. Send email notification (if configured)
    const threshold = await this.getStockThreshold(
      alert.materialId,
      alert.facilityId
    );

    if (threshold?.enable_low_stock_alerts && threshold.alert_recipient_emails) {
      await this.sendAlertEmail(alert, threshold.alert_recipient_emails);
    }
  }

  /**
   * Check threshold violations
   */
  private checkThresholds(
    currentQuantity: number,
    threshold: any
  ): StockAlert[] {
    const alerts: StockAlert[] = [];

    // Low stock check
    if (currentQuantity <= threshold.minimum_quantity) {
      alerts.push({
        alertType: 'LOW_STOCK',
        severity: this.calculateSeverity(currentQuantity, threshold.minimum_quantity),
        materialId: threshold.material_id,
        facilityId: threshold.facility_id,
        currentQuantity,
        thresholdQuantity: threshold.minimum_quantity,
        timestamp: new Date()
      });
    }

    // Reorder point check
    if (currentQuantity <= threshold.reorder_point) {
      alerts.push({
        alertType: 'REORDER_NEEDED',
        severity: 'MEDIUM',
        materialId: threshold.material_id,
        facilityId: threshold.facility_id,
        currentQuantity,
        thresholdQuantity: threshold.reorder_point,
        timestamp: new Date()
      });
    }

    // Overstock check
    if (threshold.maximum_quantity && currentQuantity >= threshold.maximum_quantity) {
      alerts.push({
        alertType: 'OVERSTOCK',
        severity: 'LOW',
        materialId: threshold.material_id,
        facilityId: threshold.facility_id,
        currentQuantity,
        thresholdQuantity: threshold.maximum_quantity,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Calculate alert severity
   */
  private calculateSeverity(
    currentQuantity: number,
    minimumQuantity: number
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    const percentOfMin = (currentQuantity / minimumQuantity) * 100;

    if (percentOfMin <= 25) return 'CRITICAL';
    if (percentOfMin <= 50) return 'HIGH';
    if (percentOfMin <= 75) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Publish audit event
   */
  private async publishAuditEvent(event: StockChangeEvent): Promise<void> {
    const subject = `inventory.audit.${event.transactionType.toLowerCase()}.${event.facilityId}`;

    await this.natsClient.publish(subject, {
      ...event,
      auditTimestamp: new Date(),
      auditUser: 'system' // TODO: Get from context
    });
  }

  /**
   * Get stock threshold configuration
   */
  private async getStockThreshold(
    materialId: string,
    facilityId: string
  ): Promise<any> {
    // TODO: Implement database query
    // Query: SELECT * FROM stock_thresholds
    //        WHERE material_id = $1 AND facility_id = $2
    return null;
  }

  /**
   * Send alert email
   */
  private async sendAlertEmail(
    alert: StockAlert,
    recipients: string[]
  ): Promise<void> {
    // TODO: Implement email notification
    // Use existing email service or integrate with SendGrid/AWS SES
    console.log(`📧 Sending ${alert.alertType} alert to:`, recipients);
  }
}
```

---

### Phase 3: GraphQL Schema Extensions ⚙️

**Owner:** Marcus (Backend Agent)
**Estimated Effort:** 2-3 hours
**Dependencies:** Phase 1, Phase 2 complete

#### 3.1 Stock Monitoring Schema

```graphql
# File: src/graphql/schema/stock-monitoring.graphql

"""
Real-Time Stock Level Monitoring Schema
Provides subscriptions, queries, and mutations for live inventory tracking
"""

scalar DateTime
scalar JSON

# ============================================
# Types
# ============================================

"""
Stock level update event
"""
type StockLevelUpdate {
  """Material identifier"""
  materialId: ID!

  """Material code and description"""
  materialCode: String!
  materialDescription: String

  """Facility and location"""
  facilityId: ID!
  facilityName: String
  locationId: ID
  locationCode: String

  """Quantity changes"""
  quantityOnHand: Float!
  quantityAvailable: Float!
  quantityAllocated: Float!
  quantityChange: Float!

  """Transaction details"""
  transactionType: TransactionType!
  transactionId: ID
  lotNumber: String

  """Threshold status"""
  isLowStock: Boolean!
  needsReorder: Boolean!
  isOverstock: Boolean!

  """Timestamp"""
  timestamp: DateTime!
}

"""
Low stock alert
"""
type LowStockAlert {
  """Alert identifier"""
  id: ID!

  """Alert type"""
  alertType: AlertType!

  """Severity level"""
  severity: AlertSeverity!

  """Material details"""
  materialId: ID!
  materialCode: String!
  materialDescription: String

  """Facility"""
  facilityId: ID!
  facilityName: String

  """Quantities"""
  currentQuantity: Float!
  minimumQuantity: Float!
  reorderPoint: Float!
  shortfall: Float!

  """Percentage of minimum"""
  percentOfMinimum: Float!

  """Estimated stockout date (based on consumption rate)"""
  estimatedStockoutDate: DateTime

  """Recommended action"""
  recommendedAction: String!

  """Timestamp"""
  timestamp: DateTime!
}

"""
Stock threshold configuration
"""
type StockThreshold {
  id: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!

  """Threshold quantities"""
  minimumQuantity: Float!
  reorderPoint: Float!
  maximumQuantity: Float
  safetyStockQuantity: Float
  reorderQuantity: Float

  """Lead time"""
  leadTimeDays: Int

  """Alert settings"""
  enableLowStockAlerts: Boolean!
  enableOverstockAlerts: Boolean!
  alertRecipientEmails: [String!]

  """Audit"""
  createdAt: DateTime!
  updatedAt: DateTime
}

"""
Real-time stock dashboard summary
"""
type StockDashboardSummary {
  """Facility"""
  facilityId: ID!
  facilityName: String!

  """Totals"""
  totalMaterials: Int!
  totalLocations: Int!
  totalLots: Int!

  """Stock status counts"""
  lowStockCount: Int!
  reorderNeededCount: Int!
  overstockCount: Int!
  normalStockCount: Int!

  """Alert counts by severity"""
  criticalAlerts: Int!
  highAlerts: Int!
  mediumAlerts: Int!

  """Last updated"""
  lastUpdated: DateTime!
}

# ============================================
# Enums
# ============================================

enum AlertType {
  LOW_STOCK
  REORDER_NEEDED
  OVERSTOCK
  VARIANCE
}

enum AlertSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

# ============================================
# Queries
# ============================================

extend type Query {
  """Get stock threshold configuration"""
  stockThreshold(
    materialId: ID!
    facilityId: ID!
  ): StockThreshold

  """List stock thresholds"""
  stockThresholds(
    facilityId: ID!
    materialId: ID
  ): [StockThreshold!]!

  """Get low stock alerts"""
  lowStockAlerts(
    facilityId: ID!
    severity: AlertSeverity
    limit: Int = 50
  ): [LowStockAlert!]!

  """Get dashboard summary"""
  stockDashboardSummary(
    facilityId: ID!
  ): StockDashboardSummary!

  """Get stock level history (from NATS stream)"""
  stockLevelHistory(
    materialId: ID!
    facilityId: ID!
    startDate: DateTime!
    endDate: DateTime!
  ): [StockLevelUpdate!]!
}

# ============================================
# Mutations
# ============================================

extend type Mutation {
  """Create or update stock threshold"""
  upsertStockThreshold(
    input: UpsertStockThresholdInput!
  ): StockThreshold!

  """Delete stock threshold"""
  deleteStockThreshold(
    materialId: ID!
    facilityId: ID!
  ): Boolean!

  """Acknowledge low stock alert"""
  acknowledgeAlert(
    id: ID!
    notes: String
  ): LowStockAlert!
}

# ============================================
# Subscriptions
# ============================================

extend type Subscription {
  """
  Subscribe to stock level updates for specific material/facility
  Filters: materialId, facilityId, locationId
  """
  stockLevelUpdated(
    materialId: ID
    facilityId: ID
    locationId: ID
  ): StockLevelUpdate!

  """
  Subscribe to low stock alerts
  Filters: facilityId, severity
  """
  lowStockAlert(
    facilityId: ID
    severity: AlertSeverity
  ): LowStockAlert!

  """
  Subscribe to all inventory transactions
  Filters: facilityId, transactionType
  """
  inventoryTransactionCreated(
    facilityId: ID
    transactionType: TransactionType
  ): InventoryTransaction!
}

# ============================================
# Input Types
# ============================================

input UpsertStockThresholdInput {
  facilityId: ID!
  materialId: ID!
  minimumQuantity: Float!
  reorderPoint: Float!
  maximumQuantity: Float
  safetyStockQuantity: Float
  reorderQuantity: Float
  leadTimeDays: Int
  enableLowStockAlerts: Boolean
  enableOverstockAlerts: Boolean
  alertRecipientEmails: [String!]
}
```

#### 3.2 GraphQL Resolvers

```typescript
// File: src/graphql/resolvers/stock-monitoring.resolver.ts

import { PubSub } from 'graphql-subscriptions';
import { InventoryEventPublisher } from '../../services/inventory-event-publisher.service';
import { NATSClient } from '../../nats/nats-client.service';

const pubsub = new PubSub();

export const stockMonitoringResolvers = {
  Query: {
    /**
     * Get stock threshold
     */
    stockThreshold: async (
      parent: any,
      args: { materialId: string; facilityId: string },
      context: any
    ) => {
      const { materialId, facilityId } = args;

      const result = await context.db.query(`
        SELECT * FROM stock_thresholds
        WHERE material_id = $1 AND facility_id = $2
      `, [materialId, facilityId]);

      return result.rows[0] || null;
    },

    /**
     * List stock thresholds
     */
    stockThresholds: async (
      parent: any,
      args: { facilityId: string; materialId?: string },
      context: any
    ) => {
      const { facilityId, materialId } = args;

      let query = 'SELECT * FROM stock_thresholds WHERE facility_id = $1';
      const params: any[] = [facilityId];

      if (materialId) {
        query += ' AND material_id = $2';
        params.push(materialId);
      }

      const result = await context.db.query(query, params);
      return result.rows;
    },

    /**
     * Get low stock alerts
     */
    lowStockAlerts: async (
      parent: any,
      args: { facilityId: string; severity?: string; limit: number },
      context: any
    ) => {
      const { facilityId, severity, limit } = args;

      // Query materialized view for low stock items
      let query = `
        SELECT
          mv.*,
          m.material_code,
          m.material_description,
          f.facility_name
        FROM mv_stock_levels mv
        JOIN materials m ON mv.material_id = m.id
        JOIN facilities f ON mv.facility_id = f.id
        WHERE mv.facility_id = $1
          AND mv.is_low_stock = TRUE
      `;

      const params: any[] = [facilityId];

      // Add severity filter
      if (severity) {
        // Calculate severity based on percent of minimum
        const severityCondition =
          severity === 'CRITICAL' ? '(mv.total_available / mv.minimum_quantity) <= 0.25' :
          severity === 'HIGH' ? '(mv.total_available / mv.minimum_quantity) <= 0.50' :
          severity === 'MEDIUM' ? '(mv.total_available / mv.minimum_quantity) <= 0.75' :
          'TRUE';

        query += ` AND ${severityCondition}`;
      }

      query += ` ORDER BY (mv.total_available / mv.minimum_quantity) ASC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await context.db.query(query, params);

      // Transform to alert format
      return result.rows.map(row => ({
        id: `alert_${row.material_id}`,
        alertType: row.needs_reorder ? 'REORDER_NEEDED' : 'LOW_STOCK',
        severity: calculateSeverity(row.total_available, row.minimum_quantity),
        materialId: row.material_id,
        materialCode: row.material_code,
        materialDescription: row.material_description,
        facilityId: row.facility_id,
        facilityName: row.facility_name,
        currentQuantity: row.total_available,
        minimumQuantity: row.minimum_quantity,
        reorderPoint: row.reorder_point,
        shortfall: row.minimum_quantity - row.total_available,
        percentOfMinimum: (row.total_available / row.minimum_quantity) * 100,
        recommendedAction: `Order ${row.reorder_quantity || (row.reorder_point - row.total_available)} units`,
        timestamp: new Date()
      }));
    },

    /**
     * Get dashboard summary
     */
    stockDashboardSummary: async (
      parent: any,
      args: { facilityId: string },
      context: any
    ) => {
      const { facilityId } = args;

      const result = await context.db.query(`
        SELECT
          COUNT(DISTINCT material_id) as total_materials,
          COUNT(DISTINCT location_id) as total_locations,
          SUM(lot_count) as total_lots,
          SUM(CASE WHEN is_low_stock THEN 1 ELSE 0 END) as low_stock_count,
          SUM(CASE WHEN needs_reorder THEN 1 ELSE 0 END) as reorder_needed_count,
          SUM(CASE WHEN is_overstock THEN 1 ELSE 0 END) as overstock_count,
          SUM(CASE
            WHEN NOT is_low_stock AND NOT is_overstock
            THEN 1 ELSE 0
          END) as normal_stock_count,
          SUM(CASE
            WHEN is_low_stock
              AND (total_available / minimum_quantity) <= 0.25
            THEN 1 ELSE 0
          END) as critical_alerts,
          SUM(CASE
            WHEN is_low_stock
              AND (total_available / minimum_quantity) > 0.25
              AND (total_available / minimum_quantity) <= 0.50
            THEN 1 ELSE 0
          END) as high_alerts,
          SUM(CASE
            WHEN is_low_stock
              AND (total_available / minimum_quantity) > 0.50
            THEN 1 ELSE 0
          END) as medium_alerts,
          MAX(last_updated) as last_updated
        FROM mv_stock_levels
        WHERE facility_id = $1
      `, [facilityId]);

      const row = result.rows[0];

      return {
        facilityId,
        facilityName: 'Facility Name', // TODO: Join with facilities table
        totalMaterials: parseInt(row.total_materials),
        totalLocations: parseInt(row.total_locations),
        totalLots: parseInt(row.total_lots),
        lowStockCount: parseInt(row.low_stock_count),
        reorderNeededCount: parseInt(row.reorder_needed_count),
        overstockCount: parseInt(row.overstock_count),
        normalStockCount: parseInt(row.normal_stock_count),
        criticalAlerts: parseInt(row.critical_alerts),
        highAlerts: parseInt(row.high_alerts),
        mediumAlerts: parseInt(row.medium_alerts),
        lastUpdated: row.last_updated
      };
    },

    /**
     * Get stock level history from NATS
     */
    stockLevelHistory: async (
      parent: any,
      args: { materialId: string; facilityId: string; startDate: Date; endDate: Date },
      context: any
    ) => {
      const { materialId, facilityId, startDate, endDate } = args;

      // TODO: Query NATS stream for historical events
      // Subject: inventory.stock.{facilityId}.{materialId}.updated
      // Filter by timestamp range

      return [];
    }
  },

  Mutation: {
    /**
     * Create or update stock threshold
     */
    upsertStockThreshold: async (
      parent: any,
      args: { input: any },
      context: any
    ) => {
      const { input } = args;

      const result = await context.db.query(`
        INSERT INTO stock_thresholds (
          tenant_id, facility_id, material_id,
          minimum_quantity, reorder_point, maximum_quantity,
          safety_stock_quantity, reorder_quantity, lead_time_days,
          enable_low_stock_alerts, enable_overstock_alerts,
          alert_recipient_emails,
          created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
        )
        ON CONFLICT (tenant_id, facility_id, material_id)
        DO UPDATE SET
          minimum_quantity = EXCLUDED.minimum_quantity,
          reorder_point = EXCLUDED.reorder_point,
          maximum_quantity = EXCLUDED.maximum_quantity,
          safety_stock_quantity = EXCLUDED.safety_stock_quantity,
          reorder_quantity = EXCLUDED.reorder_quantity,
          lead_time_days = EXCLUDED.lead_time_days,
          enable_low_stock_alerts = EXCLUDED.enable_low_stock_alerts,
          enable_overstock_alerts = EXCLUDED.enable_overstock_alerts,
          alert_recipient_emails = EXCLUDED.alert_recipient_emails,
          updated_by = EXCLUDED.created_by,
          updated_at = NOW()
        RETURNING *
      `, [
        context.tenantId,
        input.facilityId,
        input.materialId,
        input.minimumQuantity,
        input.reorderPoint,
        input.maximumQuantity,
        input.safetyStockQuantity,
        input.reorderQuantity,
        input.leadTimeDays,
        input.enableLowStockAlerts ?? true,
        input.enableOverstockAlerts ?? false,
        input.alertRecipientEmails,
        context.userId
      ]);

      return result.rows[0];
    },

    /**
     * Delete stock threshold
     */
    deleteStockThreshold: async (
      parent: any,
      args: { materialId: string; facilityId: string },
      context: any
    ) => {
      const { materialId, facilityId } = args;

      await context.db.query(`
        DELETE FROM stock_thresholds
        WHERE material_id = $1 AND facility_id = $2
      `, [materialId, facilityId]);

      return true;
    }
  },

  Subscription: {
    /**
     * Stock level updated subscription
     */
    stockLevelUpdated: {
      subscribe: (parent: any, args: any) => {
        const { materialId, facilityId, locationId } = args;

        // Build filter function
        const filterFn = (payload: any) => {
          if (materialId && payload.stockLevelUpdated.materialId !== materialId) {
            return false;
          }
          if (facilityId && payload.stockLevelUpdated.facilityId !== facilityId) {
            return false;
          }
          if (locationId && payload.stockLevelUpdated.locationId !== locationId) {
            return false;
          }
          return true;
        };

        return pubsub.asyncIterator(['STOCK_LEVEL_UPDATED'], filterFn);
      }
    },

    /**
     * Low stock alert subscription
     */
    lowStockAlert: {
      subscribe: (parent: any, args: any) => {
        const { facilityId, severity } = args;

        const filterFn = (payload: any) => {
          if (facilityId && payload.lowStockAlert.facilityId !== facilityId) {
            return false;
          }
          if (severity && payload.lowStockAlert.severity !== severity) {
            return false;
          }
          return true;
        };

        return pubsub.asyncIterator(['LOW_STOCK_ALERT'], filterFn);
      }
    },

    /**
     * Inventory transaction created subscription
     */
    inventoryTransactionCreated: {
      subscribe: (parent: any, args: any) => {
        const { facilityId, transactionType } = args;

        const filterFn = (payload: any) => {
          const tx = payload.inventoryTransactionCreated;
          if (facilityId && tx.facilityId !== facilityId) {
            return false;
          }
          if (transactionType && tx.transactionType !== transactionType) {
            return false;
          }
          return true;
        };

        return pubsub.asyncIterator(['INVENTORY_TRANSACTION_CREATED'], filterFn);
      }
    }
  }
};

/**
 * Calculate alert severity
 */
function calculateSeverity(
  currentQuantity: number,
  minimumQuantity: number
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const percentOfMin = (currentQuantity / minimumQuantity) * 100;

  if (percentOfMin <= 25) return 'CRITICAL';
  if (percentOfMin <= 50) return 'HIGH';
  if (percentOfMin <= 75) return 'MEDIUM';
  return 'LOW';
}

export { pubsub };
```

---

### Phase 4: Integration with WMS Mutations ⚙️

**Owner:** Marcus (Backend Agent)
**Estimated Effort:** 2-3 hours
**Dependencies:** Phase 1, 2, 3 complete

#### 4.1 Extend WMS Resolver to Publish Events

```typescript
// File: src/graphql/resolvers/wms.resolver.ts (modifications)

import { InventoryEventPublisher } from '../../services/inventory-event-publisher.service';
import { pubsub } from './stock-monitoring.resolver';

export class WMSResolver {
  private eventPublisher: InventoryEventPublisher;

  constructor(
    private natsClient: NATSClient,
    private db: any
  ) {
    this.eventPublisher = new InventoryEventPublisher(natsClient, pubsub);
  }

  /**
   * Update lot quantity (MODIFIED)
   */
  async updateLotQuantity(
    parent: any,
    args: { id: string; newQuantity: number; reason?: string },
    context: any
  ) {
    const { id, newQuantity, reason } = args;

    // 1. Fetch current lot
    const lotResult = await this.db.query(
      'SELECT * FROM lots WHERE id = $1',
      [id]
    );
    const lot = lotResult.rows[0];

    if (!lot) {
      throw new Error('Lot not found');
    }

    const previousQuantity = lot.current_quantity;
    const variance = newQuantity - previousQuantity;

    // 2. Update lot quantity
    const updateResult = await this.db.query(`
      UPDATE lots
      SET
        current_quantity = $1,
        available_quantity = $1 - allocated_quantity,
        updated_at = NOW(),
        updated_by = $2
      WHERE id = $3
      RETURNING *
    `, [newQuantity, context.userId, id]);

    const updatedLot = updateResult.rows[0];

    // 3. ⭐ NEW: Publish stock change event
    await this.eventPublisher.publishStockChange({
      lotId: updatedLot.id,
      materialId: updatedLot.material_id,
      facilityId: updatedLot.facility_id,
      locationId: updatedLot.location_id,
      previousQuantity,
      newQuantity,
      variance,
      transactionType: 'ADJUSTMENT',
      timestamp: new Date()
    });

    return updatedLot;
  }

  /**
   * Perform cycle count (MODIFIED)
   */
  async performCycleCount(
    parent: any,
    args: {
      locationId: string;
      materialId: string;
      countedQuantity: number;
      notes?: string;
    },
    context: any
  ) {
    const { locationId, materialId, countedQuantity, notes } = args;

    // 1. Fetch current lot
    const lotResult = await this.db.query(`
      SELECT * FROM lots
      WHERE location_id = $1 AND material_id = $2
    `, [locationId, materialId]);

    const lot = lotResult.rows[0];

    if (!lot) {
      throw new Error('No lot found at this location for this material');
    }

    const previousQuantity = lot.current_quantity;
    const variance = countedQuantity - previousQuantity;

    // 2. Create inventory transaction
    const transactionResult = await this.db.query(`
      INSERT INTO inventory_transactions (
        tenant_id, facility_id, transaction_number, transaction_type,
        material_id, lot_number, quantity,
        from_location_id, to_location_id,
        reason_code, reason_description,
        performed_by_user_id
      ) VALUES (
        $1, $2, $3, 'CYCLE_COUNT',
        $4, $5, $6,
        $7, $7,
        'VARIANCE', $8,
        $9
      ) RETURNING *
    `, [
      context.tenantId,
      lot.facility_id,
      `CC-${Date.now()}`,
      materialId,
      lot.lot_number,
      variance,
      locationId,
      notes || `Variance: ${variance}`,
      context.userId
    ]);

    // 3. Update lot quantity
    const updatedLotResult = await this.db.query(`
      UPDATE lots
      SET
        current_quantity = $1,
        available_quantity = $1 - allocated_quantity,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [countedQuantity, lot.id]);

    const updatedLot = updatedLotResult.rows[0];

    // 4. ⭐ NEW: Publish stock change event
    await this.eventPublisher.publishStockChange({
      lotId: updatedLot.id,
      materialId: updatedLot.material_id,
      facilityId: updatedLot.facility_id,
      locationId: updatedLot.location_id,
      previousQuantity,
      newQuantity: countedQuantity,
      variance,
      transactionType: 'CYCLE_COUNT',
      timestamp: new Date()
    });

    // 5. ⭐ NEW: Publish transaction event
    await pubsub.publish('INVENTORY_TRANSACTION_CREATED', {
      inventoryTransactionCreated: transactionResult.rows[0]
    });

    return transactionResult.rows[0];
  }

  /**
   * Record inventory transaction (MODIFIED)
   */
  async recordInventoryTransaction(
    parent: any,
    args: { input: any },
    context: any
  ) {
    const { input } = args;

    // ... (existing transaction creation logic)

    // ⭐ NEW: Publish event after successful transaction
    if (['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT'].includes(input.transactionType)) {
      // Update lot quantities and publish events
      // (Implementation details omitted for brevity)
    }

    return transaction;
  }
}
```

---

### Phase 5: Frontend Integration (Jen's Scope) 🎨

**Owner:** Jen (Frontend Agent)
**Estimated Effort:** 4-6 hours
**Dependencies:** Phase 1-4 complete

#### 5.1 WebSocket Subscription Setup

```typescript
// File: frontend/src/graphql/subscriptions/stock-monitoring.ts

import { gql } from '@apollo/client';

export const STOCK_LEVEL_UPDATED_SUBSCRIPTION = gql`
  subscription StockLevelUpdated($materialId: ID, $facilityId: ID) {
    stockLevelUpdated(materialId: $materialId, facilityId: $facilityId) {
      materialId
      materialCode
      materialDescription
      facilityId
      locationId
      locationCode
      quantityOnHand
      quantityAvailable
      quantityAllocated
      quantityChange
      transactionType
      isLowStock
      needsReorder
      timestamp
    }
  }
`;

export const LOW_STOCK_ALERT_SUBSCRIPTION = gql`
  subscription LowStockAlert($facilityId: ID, $severity: AlertSeverity) {
    lowStockAlert(facilityId: $facilityId, severity: $severity) {
      id
      alertType
      severity
      materialId
      materialCode
      materialDescription
      facilityId
      currentQuantity
      minimumQuantity
      percentOfMinimum
      recommendedAction
      timestamp
    }
  }
`;
```

#### 5.2 Real-Time Stock Level Widget

```typescript
// File: frontend/src/components/StockLevelWidget.tsx

import React, { useEffect, useState } from 'react';
import { useSubscription, useQuery } from '@apollo/client';
import { STOCK_LEVEL_UPDATED_SUBSCRIPTION } from '../graphql/subscriptions/stock-monitoring';
import { GET_INVENTORY_SUMMARY } from '../graphql/queries/inventory';

interface StockLevelWidgetProps {
  materialId: string;
  facilityId: string;
}

export const StockLevelWidget: React.FC<StockLevelWidgetProps> = ({
  materialId,
  facilityId
}) => {
  const [stockLevel, setStockLevel] = useState<any>(null);

  // Initial data fetch
  const { data, loading } = useQuery(GET_INVENTORY_SUMMARY, {
    variables: { materialId, facilityId }
  });

  // Real-time subscription
  const { data: subscriptionData } = useSubscription(
    STOCK_LEVEL_UPDATED_SUBSCRIPTION,
    {
      variables: { materialId, facilityId },
      onSubscriptionData: ({ subscriptionData }) => {
        const update = subscriptionData.data?.stockLevelUpdated;

        if (update) {
          setStockLevel(update);

          // Show toast notification for changes
          if (update.quantityChange !== 0) {
            showToast(
              `Stock ${update.quantityChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(update.quantityChange)} units`,
              update.isLowStock ? 'warning' : 'info'
            );
          }
        }
      }
    }
  );

  useEffect(() => {
    if (data?.inventorySummary?.[0]) {
      setStockLevel(data.inventorySummary[0]);
    }
  }, [data]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="stock-level-widget">
      <div className="stock-quantity">
        <span className="label">On Hand:</span>
        <span className={`value ${stockLevel?.isLowStock ? 'low-stock' : ''}`}>
          {stockLevel?.quantityOnHand?.toFixed(2)}
        </span>
      </div>

      <div className="stock-quantity">
        <span className="label">Available:</span>
        <span className="value">
          {stockLevel?.quantityAvailable?.toFixed(2)}
        </span>
      </div>

      <div className="stock-quantity">
        <span className="label">Allocated:</span>
        <span className="value">
          {stockLevel?.quantityAllocated?.toFixed(2)}
        </span>
      </div>

      {stockLevel?.isLowStock && (
        <div className="alert low-stock-alert">
          ⚠️ Low Stock - Reorder Needed
        </div>
      )}

      {stockLevel?.needsReorder && (
        <div className="alert reorder-alert">
          📦 Reorder Point Reached
        </div>
      )}
    </div>
  );
};
```

#### 5.3 Real-Time Dashboard

```typescript
// File: frontend/src/pages/StockDashboard.tsx

import React from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { GET_STOCK_DASHBOARD_SUMMARY } from '../graphql/queries/stock-monitoring';
import { LOW_STOCK_ALERT_SUBSCRIPTION } from '../graphql/subscriptions/stock-monitoring';

export const StockDashboard: React.FC = () => {
  const facilityId = 'uuid-facility-123'; // From context

  const { data, loading } = useQuery(GET_STOCK_DASHBOARD_SUMMARY, {
    variables: { facilityId },
    pollInterval: 30000 // Refresh every 30 seconds
  });

  // Listen for real-time alerts
  useSubscription(LOW_STOCK_ALERT_SUBSCRIPTION, {
    variables: { facilityId },
    onSubscriptionData: ({ subscriptionData }) => {
      const alert = subscriptionData.data?.lowStockAlert;

      if (alert) {
        showNotification(
          `Low Stock Alert: ${alert.materialCode}`,
          alert.recommendedAction,
          alert.severity
        );
      }
    }
  });

  if (loading) return <div>Loading dashboard...</div>;

  const summary = data?.stockDashboardSummary;

  return (
    <div className="stock-dashboard">
      <h1>Real-Time Stock Monitoring</h1>

      <div className="dashboard-cards">
        <DashboardCard
          title="Total Materials"
          value={summary?.totalMaterials}
          icon="📦"
        />

        <DashboardCard
          title="Low Stock Items"
          value={summary?.lowStockCount}
          icon="⚠️"
          severity="warning"
        />

        <DashboardCard
          title="Reorder Needed"
          value={summary?.reorderNeededCount}
          icon="🔔"
          severity="high"
        />

        <DashboardCard
          title="Critical Alerts"
          value={summary?.criticalAlerts}
          icon="🚨"
          severity="critical"
        />
      </div>

      <LowStockAlertsTable facilityId={facilityId} />
    </div>
  );
};
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

**Backend (Jest + TypeScript):**

```typescript
// Test: InventoryEventPublisher
describe('InventoryEventPublisher', () => {
  it('should publish stock change event to NATS', async () => {
    const event = {
      lotId: 'uuid-lot-123',
      materialId: 'uuid-material-456',
      facilityId: 'uuid-facility-789',
      locationId: 'uuid-location-012',
      previousQuantity: 100,
      newQuantity: 150,
      variance: 50,
      transactionType: 'RECEIPT',
      timestamp: new Date()
    };

    await eventPublisher.publishStockChange(event);

    expect(natsClient.publish).toHaveBeenCalledWith(
      'inventory.stock.uuid-facility-789.uuid-material-456.updated',
      event
    );
  });

  it('should trigger low stock alert when below minimum', async () => {
    const event = {
      materialId: 'uuid-material-456',
      facilityId: 'uuid-facility-789',
      newQuantity: 5, // Below minimum of 10
      // ...
    };

    await eventPublisher.publishStockChange(event);

    expect(pubsub.publish).toHaveBeenCalledWith('LOW_STOCK_ALERT', {
      lowStockAlert: expect.objectContaining({
        alertType: 'LOW_STOCK',
        severity: 'CRITICAL'
      })
    });
  });
});
```

**Frontend (React Testing Library):**

```typescript
// Test: StockLevelWidget subscription
describe('StockLevelWidget', () => {
  it('should update display when subscription receives new data', async () => {
    const { getByText } = render(
      <MockedProvider mocks={[/* subscription mock */]}>
        <StockLevelWidget materialId="123" facilityId="456" />
      </MockedProvider>
    );

    // Wait for initial data
    await waitFor(() => {
      expect(getByText('100.00')).toBeInTheDocument();
    });

    // Simulate subscription update
    act(() => {
      // Trigger subscription with new data (quantity: 95)
    });

    // Verify UI updated
    await waitFor(() => {
      expect(getByText('95.00')).toBeInTheDocument();
    });
  });
});
```

### 5.2 Integration Tests

**Test Scenario 1: End-to-End Stock Update Flow**

```typescript
describe('Stock Level Monitoring E2E', () => {
  it('should propagate stock change from mutation to subscription', async () => {
    // 1. Subscribe to stock level updates
    const subscription = createSubscription(STOCK_LEVEL_UPDATED, {
      materialId: 'mat-123',
      facilityId: 'fac-456'
    });

    const receivedUpdates: any[] = [];
    subscription.on('data', (data) => {
      receivedUpdates.push(data.stockLevelUpdated);
    });

    // 2. Perform cycle count mutation
    await graphqlClient.mutate({
      mutation: PERFORM_CYCLE_COUNT,
      variables: {
        locationId: 'loc-789',
        materialId: 'mat-123',
        countedQuantity: 85,
        notes: 'Test cycle count'
      }
    });

    // 3. Wait for subscription to receive update
    await waitFor(() => {
      expect(receivedUpdates).toHaveLength(1);
    });

    // 4. Verify update contents
    expect(receivedUpdates[0]).toMatchObject({
      materialId: 'mat-123',
      facilityId: 'fac-456',
      quantityOnHand: 85,
      transactionType: 'CYCLE_COUNT'
    });
  });
});
```

**Test Scenario 2: Low Stock Alert Triggering**

```typescript
describe('Low Stock Alerts', () => {
  it('should trigger alert when stock falls below minimum', async () => {
    // 1. Setup threshold (min: 50, reorder: 75)
    await setupStockThreshold({
      materialId: 'mat-123',
      facilityId: 'fac-456',
      minimumQuantity: 50,
      reorderPoint: 75
    });

    // 2. Subscribe to alerts
    const subscription = createSubscription(LOW_STOCK_ALERT, {
      facilityId: 'fac-456'
    });

    const receivedAlerts: any[] = [];
    subscription.on('data', (data) => {
      receivedAlerts.push(data.lowStockAlert);
    });

    // 3. Update stock to 40 (below minimum)
    await updateLotQuantity('lot-123', 40);

    // 4. Verify alert received
    await waitFor(() => {
      expect(receivedAlerts).toHaveLength(1);
    });

    expect(receivedAlerts[0]).toMatchObject({
      alertType: 'LOW_STOCK',
      severity: 'HIGH',
      currentQuantity: 40,
      minimumQuantity: 50
    });
  });
});
```

### 5.3 Performance Tests

**Test: Materialized View Refresh Performance**

```sql
-- Benchmark: Refresh time for materialized view
EXPLAIN ANALYZE REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_levels;

-- Expected: < 5 seconds for 100K lots
-- Monitor: CPU usage, lock contention
```

**Test: Subscription Scalability**

```typescript
// Load test: 100 concurrent subscriptions
describe('Subscription Scalability', () => {
  it('should handle 100 concurrent stock level subscriptions', async () => {
    const subscriptions = [];

    for (let i = 0; i < 100; i++) {
      const sub = createSubscription(STOCK_LEVEL_UPDATED, {
        facilityId: 'fac-456'
      });
      subscriptions.push(sub);
    }

    // Trigger stock update
    const startTime = Date.now();
    await updateLotQuantity('lot-123', 100);

    // Verify all subscriptions receive update within 1 second
    await waitFor(() => {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000);

      subscriptions.forEach(sub => {
        expect(sub.receivedUpdates).toHaveLength(1);
      });
    });
  });
});
```

---

## 6. Deployment Checklist

### 6.1 Database Migrations

- [ ] Run migration `V0.0.14__add_stock_thresholds.sql`
- [ ] Verify `stock_thresholds` table created
- [ ] Verify `mv_stock_levels` materialized view created
- [ ] Verify triggers created and active
- [ ] Test materialized view refresh performance
- [ ] Initial population of stock thresholds for key materials

### 6.2 NATS Configuration

- [ ] Run `npm run init:inventory-streams`
- [ ] Verify 3 new streams created:
  - `agog_inventory_events`
  - `agog_inventory_alerts`
  - `agog_inventory_audit`
- [ ] Test event publishing to each stream
- [ ] Monitor stream retention and storage

### 6.3 Backend Services

- [ ] Deploy `InventoryEventPublisher` service
- [ ] Deploy updated WMS resolver with event publishing
- [ ] Deploy stock monitoring GraphQL schema and resolvers
- [ ] Setup PostgreSQL NOTIFY listener
- [ ] Verify GraphQL subscriptions working via playground

### 6.4 Frontend Deployment

- [ ] Deploy stock monitoring subscription components
- [ ] Deploy real-time dashboard
- [ ] Deploy alert notification system
- [ ] Test WebSocket connectivity
- [ ] Verify subscription filters working

### 6.5 Monitoring & Alerts

- [ ] Setup error logging for event publishing failures
- [ ] Monitor NATS stream lag
- [ ] Monitor materialized view refresh duration
- [ ] Setup alerts for subscription connection drops
- [ ] Dashboard for real-time monitoring metrics

---

## 7. Potential Challenges & Solutions

### Challenge 1: Materialized View Refresh Performance

**Problem:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` may be slow on large datasets (100K+ lots).

**Solutions:**
1. **Incremental Refresh:** Instead of full refresh, track changed lots and update only affected aggregations
2. **Partitioning:** Partition `mv_stock_levels` by `facility_id`
3. **Scheduled Refresh:** Refresh every 5 minutes instead of trigger-based
4. **Denormalization:** Store aggregated quantities directly in `lots` table

**Recommendation:** Start with trigger-based refresh, monitor performance, switch to scheduled if needed.

---

### Challenge 2: NATS Event Ordering

**Problem:** Events may arrive out of order in distributed systems.

**Solutions:**
1. **Sequence Numbers:** Include monotonic sequence number in events
2. **Timestamp Comparison:** Frontend sorts events by timestamp before processing
3. **Event Sourcing:** Store complete event log, rebuild state from events

**Recommendation:** Include `timestamp` and `sequence_number` in all events. Frontend should handle out-of-order gracefully.

---

### Challenge 3: Subscription Connection Drops

**Problem:** WebSocket connections may drop, causing missed events.

**Solutions:**
1. **Automatic Reconnection:** Apollo Client subscription reconnection logic
2. **State Resync:** On reconnect, fetch current state via query
3. **Event Replay:** Query NATS stream for missed events by timestamp

**Recommendation:** Implement reconnection with state resync on reconnect.

---

### Challenge 4: High-Frequency Updates

**Problem:** Popular materials with frequent transactions may generate excessive events.

**Solutions:**
1. **Event Batching:** Batch multiple updates within 1-second window
2. **Throttling:** Frontend throttles subscription updates to max 1/second
3. **Aggregation:** Publish only net change every N seconds instead of every transaction

**Recommendation:** Start without throttling, add if performance issues arise.

---

## 8. Performance Optimization Strategies

### 8.1 Database Optimizations

**Index Strategy:**
```sql
-- Critical indexes for stock monitoring
CREATE INDEX CONCURRENTLY idx_lots_material_facility_active
  ON lots(material_id, facility_id)
  WHERE is_active = TRUE AND quality_status = 'RELEASED';

CREATE INDEX CONCURRENTLY idx_stock_thresholds_coverage
  ON stock_thresholds(facility_id, material_id)
  INCLUDE (minimum_quantity, reorder_point, maximum_quantity);
```

**Connection Pooling:**
```typescript
// PostgreSQL connection pool configuration
const pool = new Pool({
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000     // Query timeout 5s
});
```

### 8.2 NATS Optimizations

**Consumer Configuration:**
```typescript
// Durable consumer for guaranteed delivery
const consumerConfig = {
  durable_name: 'stock-monitoring-consumer',
  ack_policy: 'explicit',
  ack_wait: 30_000_000_000,  // 30 seconds in nanoseconds
  max_deliver: 3,             // Retry 3 times
  filter_subject: 'inventory.stock.*.*.updated',
  replay_policy: 'instant'    // Start from latest
};
```

**Message Batching:**
```typescript
// Batch publish for high-frequency updates
const eventBatch: StockChangeEvent[] = [];

setInterval(async () => {
  if (eventBatch.length > 0) {
    await natsClient.publishBatch(eventBatch);
    eventBatch.length = 0;
  }
}, 1000); // Flush every 1 second
```

### 8.3 GraphQL Subscription Optimizations

**Subscription Filtering:**
```typescript
// Server-side filtering to reduce client load
const subscriptionResolvers = {
  Subscription: {
    stockLevelUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(['STOCK_LEVEL_UPDATED']),
        (payload, variables) => {
          // Only send to clients subscribed to this specific material
          if (variables.materialId &&
              payload.stockLevelUpdated.materialId !== variables.materialId) {
            return false;
          }
          return true;
        }
      )
    }
  }
};
```

**Subscription Batching:**
```typescript
// Frontend: Batch multiple subscription updates
const [stockUpdates, setStockUpdates] = useState<StockUpdate[]>([]);

useSubscription(STOCK_LEVEL_UPDATED, {
  onSubscriptionData: ({ subscriptionData }) => {
    const update = subscriptionData.data?.stockLevelUpdated;

    // Add to batch
    stockUpdates.push(update);

    // Process batch every 500ms
    if (!batchTimer) {
      batchTimer = setTimeout(() => {
        processBatch(stockUpdates);
        stockUpdates.length = 0;
        batchTimer = null;
      }, 500);
    }
  }
});
```

---

## 9. Security Considerations

### 9.1 Authorization

**Row-Level Security (RLS):**
```sql
-- Enable RLS on stock_thresholds table
ALTER TABLE stock_thresholds ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's thresholds
CREATE POLICY stock_thresholds_tenant_isolation ON stock_thresholds
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy: Only facility managers can update thresholds
CREATE POLICY stock_thresholds_update_policy ON stock_thresholds
  FOR UPDATE
  USING (
    tenant_id = current_setting('app.current_tenant_id')::uuid
    AND current_setting('app.user_role') IN ('FACILITY_MANAGER', 'ADMIN')
  );
```

**GraphQL Authorization:**
```typescript
// Subscription authorization
const subscriptionResolvers = {
  Subscription: {
    stockLevelUpdated: {
      subscribe: async (parent, args, context) => {
        // Verify user has access to this facility
        const hasAccess = await context.authService.canAccessFacility(
          context.userId,
          args.facilityId
        );

        if (!hasAccess) {
          throw new Error('Unauthorized: Cannot access this facility');
        }

        return pubsub.asyncIterator(['STOCK_LEVEL_UPDATED']);
      }
    }
  }
};
```

### 9.2 Rate Limiting

**Subscription Rate Limiting:**
```typescript
// Limit: Max 10 stock level subscriptions per user
const userSubscriptionCounts = new Map<string, number>();

const checkSubscriptionLimit = (userId: string) => {
  const count = userSubscriptionCounts.get(userId) || 0;

  if (count >= 10) {
    throw new Error('Subscription limit reached (max 10 per user)');
  }

  userSubscriptionCounts.set(userId, count + 1);
};

// Cleanup on unsubscribe
subscription.on('close', () => {
  const count = userSubscriptionCounts.get(userId) || 0;
  userSubscriptionCounts.set(userId, Math.max(0, count - 1));
});
```

### 9.3 Data Validation

**Input Validation:**
```typescript
// Validate stock threshold inputs
const validateThresholdInput = (input: UpsertStockThresholdInput) => {
  if (input.minimumQuantity <= 0) {
    throw new Error('Minimum quantity must be greater than 0');
  }

  if (input.reorderPoint < input.minimumQuantity) {
    throw new Error('Reorder point must be >= minimum quantity');
  }

  if (input.maximumQuantity && input.maximumQuantity < input.reorderPoint) {
    throw new Error('Maximum quantity must be >= reorder point');
  }

  // Sanitize email addresses
  if (input.alertRecipientEmails) {
    input.alertRecipientEmails = input.alertRecipientEmails
      .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  }
};
```

---

## 10. Documentation Requirements

### 10.1 API Documentation

**GraphQL Schema Documentation:**
- Add comprehensive descriptions to all types, queries, mutations, subscriptions
- Document filter parameters and their effects
- Provide example queries and subscriptions

**Example:**
```graphql
"""
Subscribe to real-time stock level updates for a specific material and facility.

**Use Cases:**
- Inventory dashboard widgets
- Stock replenishment monitoring
- Material shortage alerts

**Filter Parameters:**
- `materialId`: Optional - Filter updates for specific material
- `facilityId`: Optional - Filter updates for specific facility
- `locationId`: Optional - Filter updates for specific location

**Example Usage:**
```
subscription {
  stockLevelUpdated(materialId: "mat-123", facilityId: "fac-456") {
    materialCode
    quantityOnHand
    isLowStock
    timestamp
  }
}
```

**Update Frequency:** Real-time (immediate upon stock change)
**Authorization:** User must have read access to the specified facility
"""
stockLevelUpdated(
  materialId: ID
  facilityId: ID
  locationId: ID
): StockLevelUpdate!
```

### 10.2 User Documentation

**End-User Guide Topics:**
1. **Setting Up Stock Thresholds**
   - How to configure minimum/maximum quantities
   - Reorder point calculations
   - Alert recipient configuration

2. **Using the Real-Time Dashboard**
   - Dashboard layout and widgets
   - Interpreting alert severity levels
   - Filtering and searching

3. **Understanding Alerts**
   - Alert types (LOW_STOCK, REORDER_NEEDED, OVERSTOCK)
   - Severity levels (CRITICAL, HIGH, MEDIUM, LOW)
   - Recommended actions

4. **Troubleshooting**
   - "Stock levels not updating" - Check WebSocket connection
   - "Alerts not received" - Verify email configuration
   - "Dashboard showing stale data" - Clear cache and refresh

### 10.3 Developer Documentation

**Backend Developer Guide:**
- NATS stream architecture and subject naming conventions
- Event publishing patterns
- Adding new subscription types
- Extending alert logic

**Frontend Developer Guide:**
- Apollo Client subscription setup
- Handling subscription reconnection
- Building real-time widgets
- Performance best practices

---

## 11. Maintenance & Operations

### 11.1 Monitoring Metrics

**Key Performance Indicators (KPIs):**

1. **Stock Monitoring Uptime:** % of time real-time monitoring is operational
2. **Event Latency:** Time from stock change to subscription update (target: < 1 second)
3. **Alert Delivery Rate:** % of alerts successfully delivered (target: > 99%)
4. **Materialized View Lag:** Time since last refresh (target: < 5 minutes)
5. **Active Subscriptions:** Count of concurrent WebSocket connections
6. **NATS Stream Lag:** Number of unprocessed events in streams

**Monitoring Dashboard:**
```typescript
// Expose monitoring metrics via GraphQL
type Query {
  stockMonitoringMetrics: StockMonitoringMetrics!
}

type StockMonitoringMetrics {
  uptimePercentage: Float!
  avgEventLatencyMs: Int!
  alertDeliveryRate: Float!
  materializedViewLagSeconds: Int!
  activeSubscriptions: Int!
  natsStreamLag: Int!
  lastHealthCheck: DateTime!
}
```

### 11.2 Operational Procedures

**Daily Operations:**
- Review low stock alerts dashboard
- Verify materialized view refresh is running
- Check NATS stream storage usage
- Monitor subscription error rates

**Weekly Operations:**
- Review and adjust stock thresholds based on consumption patterns
- Analyze alert false positive rate
- Clean up old NATS events (automated)
- Performance review of slow queries

**Monthly Operations:**
- Review stock monitoring metrics trends
- Optimize database indexes based on query patterns
- Update documentation based on user feedback
- Plan capacity increases if needed

### 11.3 Troubleshooting Guide

**Issue:** Stock levels not updating in real-time

**Diagnosis:**
1. Check GraphQL subscription connection status
2. Verify WebSocket is connected (browser DevTools → Network → WS)
3. Check NATS stream health: `npm run nats:stream-status`
4. Verify PostgreSQL NOTIFY listener is active

**Resolution:**
- Reconnect WebSocket subscription
- Restart NATS listener service if needed
- Check firewall rules for WebSocket traffic

---

**Issue:** Materialized view refresh taking too long

**Diagnosis:**
1. Check number of rows in `lots` table
2. Analyze query execution plan: `EXPLAIN ANALYZE REFRESH MATERIALIZED VIEW mv_stock_levels`
3. Check for missing indexes

**Resolution:**
- Add indexes on frequently filtered columns
- Consider partitioning by `facility_id`
- Switch to scheduled refresh instead of trigger-based

---

## 12. Cost Analysis

### 12.1 Infrastructure Costs

**NATS JetStream Storage:**
- 3 streams @ ~500MB each = 1.5 GB total
- AWS EBS: ~$0.10/GB/month = **$0.15/month**

**PostgreSQL Storage:**
- `stock_thresholds` table: ~10KB per threshold × 10,000 materials = 100 MB
- `mv_stock_levels` materialized view: ~20KB per row × 50,000 aggregations = 1 GB
- Total additional storage: **1.1 GB** = **$0.11/month**

**WebSocket Connections:**
- Assuming 100 concurrent subscriptions
- AWS ELB charge: $0.008/hour × 730 hours = **$5.84/month**
- Data transfer (minimal): **< $1/month**

**Total Monthly Infrastructure Cost:** ~**$7/month** (negligible)

### 12.2 Development Costs

**Phase 1-4 (Backend):** ~10-12 hours
**Phase 5 (Frontend):** ~4-6 hours
**Testing & QA:** ~4-5 hours
**Documentation:** ~2-3 hours

**Total Development Time:** ~20-26 hours

---

## 13. Conclusion & Recommendations

### 13.1 Summary

The AGOG ERP system has an **excellent architectural foundation** for implementing real-time stock level monitoring:

✅ **Strong Database Schema** - Comprehensive WMS module with lot tracking, transactions, and reservations
✅ **NATS JetStream Ready** - Event streaming infrastructure already configured and running
✅ **GraphQL Subscription Framework** - Apollo Server with WebSocket transport and PubSub pattern
✅ **Modular Codebase** - Clean separation between database, services, and resolvers

### 13.2 Implementation Priority

**High Priority (Phase 1-3):**
1. Database extensions (thresholds, materialized view, triggers)
2. NATS stream configuration for inventory events
3. GraphQL schema and resolver extensions

**Medium Priority (Phase 4):**
1. Integration with existing WMS mutations
2. Event publisher service

**Lower Priority (Phase 5):**
1. Frontend real-time components (can be incremental)
2. Advanced dashboard features

### 13.3 Recommended Approach

**Week 1:**
- Marcus implements Phase 1 (Database extensions)
- Marcus implements Phase 2 (NATS streams)
- Marcus implements Phase 3 (GraphQL extensions)

**Week 2:**
- Marcus implements Phase 4 (WMS integration)
- Marcus performs backend testing
- Jen begins Phase 5 (Frontend components)

**Week 3:**
- Jen completes frontend implementation
- Integration testing
- Documentation and deployment

### 13.4 Success Criteria

✅ Stock levels update in UI within **1 second** of database change
✅ Low stock alerts delivered to users in **real-time**
✅ System handles **100+ concurrent subscriptions** without performance degradation
✅ Materialized view refresh completes in **< 5 seconds**
✅ **Zero data loss** - All stock changes are captured and published

### 13.5 Next Steps

1. **Marcus:** Review this research report
2. **Marcus:** Begin Phase 1 implementation (database extensions)
3. **Marcus:** Setup development environment for testing subscriptions
4. **Jen:** Review Phase 5 requirements and prepare frontend development plan
5. **Billy (QA):** Review testing strategy and prepare test cases

---

## Appendix A: SQL Migration Files

See separate files:
- `V0.0.14__add_stock_thresholds.sql` - Complete migration script
- `V0.0.15__sample_stock_thresholds.sql` - Sample data for testing

## Appendix B: NATS Subject Naming Convention

**Pattern:** `inventory.{entity}.{facility_id}.{material_id}.{action}`

**Examples:**
- `inventory.stock.fac-123.mat-456.updated`
- `inventory.stock.fac-123.mat-456.created`
- `inventory.alert.low_stock.fac-123`
- `inventory.transaction.fac-123.CYCLE_COUNT`

## Appendix C: GraphQL Subscription Examples

See separate file: `stock-monitoring-examples.graphql`

---

**End of Research Report**

**Report Prepared By:** Cynthia (Research Agent)
**Date:** 2025-12-20
**Version:** 1.0
**Status:** COMPLETE ✅
