# Research Report: Real-Time Stock Level Monitoring
**REQ-STOCK-TRACKING-001**

**Agent:** Cynthia (Research)
**Date:** 2025-12-20
**Status:** Complete

---

## Executive Summary

This research report provides a comprehensive analysis of implementing real-time stock level monitoring for the AGOG SaaS print industry ERP system. The analysis covers the existing database schema, NATS messaging infrastructure, real-time update patterns, and recommended implementation approaches.

**Key Findings:**
- Robust inventory schema already exists with lot tracking, locations, and transactions
- NATS Jetstream infrastructure is in place for real-time event streaming
- Frontend already has WebSocket client infrastructure for real-time updates
- Item Master pattern (items.yaml) is being implemented to unify materials/products
- Recommend event-sourced approach using NATS for inventory state changes

---

## 1. Current System Analysis

### 1.1 Database Schema - Inventory Management

The system has a comprehensive WMS (Warehouse Management System) module created in migration `V0.0.4__create_wms_module.sql` with 13 tables:

#### Core Inventory Tables

**`inventory_locations` (D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.4__create_wms_module.sql:19)**
- Physical warehouse locations (racks, bins, zones)
- 5-tier security zones (STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT)
- ABC classification for cycle counting
- Temperature control flags
- Location hierarchy: zone > aisle > rack > shelf > bin
- Location types: RECEIVING, PUTAWAY, PICK_FACE, RESERVE, PACKING, SHIPPING, QUARANTINE, RETURNS

**`lots` (D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.4__create_wms_module.sql:96)**
- Lot/batch tracking for traceability
- Key fields for stock tracking:
  - `original_quantity` - Initial lot quantity
  - `current_quantity` - Current available quantity
  - `available_quantity` - Quantity available for allocation
  - `allocated_quantity` - Quantity reserved but not yet picked
  - `unit_of_measure` - UOM for quantities
- Quality status tracking: QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD
- Location linkage via `location_id` FK
- Expiration date tracking
- Customer ownership support (for 3PL operations)
- Indexes on: tenant, facility, material, location, quality_status, expiration_date

**`inventory_transactions` (D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.4__create_wms_module.sql:171)**
- Complete audit trail of all inventory movements
- Transaction types: RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP
- From/to location tracking
- Quantity and UOM tracking
- Reference document linkage (PO, SO, production run, shipment, cycle count)
- Cost tracking (unit_cost, total_cost)
- Transaction status: PENDING, COMPLETED, REVERSED
- Indexed by: tenant, facility, type, date, material, lot

**`inventory_reservations` (D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.4__create_wms_module.sql:737)**
- Soft allocations/reservations
- Links to sales orders, production orders, shipments
- Reservation expiration dates
- Status: ACTIVE, FULFILLED, EXPIRED, CANCELLED
- Critical for stock availability calculations

### 1.2 Materials and Products Schema

**Current State (Being Migrated):**

**`materials` table (D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.6__create_sales_materials_procurement.sql:25)**
- Material identification: code, name, description
- Material type: RAW_MATERIAL, SUBSTRATE, INK, COATING, ADHESIVE, FINISHED_GOOD, WIP, KIT
- Inventory management flags:
  - `is_lot_tracked` - Requires lot number tracking
  - `is_serialized` - Requires serial number tracking
  - `shelf_life_days` - Expiration tracking
- ABC classification for inventory management
- Safety stock, reorder point, EOQ
- Standard cost, last cost, average cost
- Costing method: FIFO, LIFO, AVERAGE, STANDARD

**Future State (Item Master Pattern):**

From `items.yaml` (D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\data-models\schemas\items.yaml:8):
- Unified `items` table replaces separate materials/products tables
- Role-based flags:
  - `can_be_purchased` - Material role
  - `can_be_sold` - Product role
  - `can_be_manufactured` - Has BOM
  - `can_be_inventoried` - Track inventory
- Measurement types: DISCRETE, CONTINUOUS, BATCH
- Multi-UOM support with context-specific preferences
- Separate attribute tables:
  - `item_material_attributes` - Procurement, storage, consumption
  - `item_product_attributes` - Sales, marketing, fulfillment
  - `item_physical_attributes` - Dimensions, weight, volume

### 1.3 Stock Calculation Logic

**Stock Level Components:**
1. **On-Hand Quantity** = SUM(lots.current_quantity) WHERE location_id IN (active_locations)
2. **Available Quantity** = On-Hand - Allocated - Reserved - Quality Hold
3. **Allocated Quantity** = SUM(lots.allocated_quantity) + SUM(wave_lines.quantity_required WHERE status IN ('PENDING', 'ASSIGNED', 'PICKING'))
4. **Reserved Quantity** = SUM(inventory_reservations.quantity_reserved WHERE status = 'ACTIVE')
5. **Quality Hold** = SUM(lots.current_quantity WHERE quality_status IN ('QUARANTINE', 'HOLD', 'PENDING_INSPECTION'))
6. **In Transit** = SUM(inventory_transactions.quantity WHERE transaction_type = 'TRANSFER' AND status = 'PENDING')

**Stock by Location:**
```sql
SELECT
  l.location_code,
  l.location_type,
  l.zone_code,
  SUM(lot.current_quantity) as on_hand_qty,
  SUM(lot.available_quantity) as available_qty,
  SUM(lot.allocated_quantity) as allocated_qty
FROM lots lot
INNER JOIN inventory_locations l ON lot.location_id = l.id
WHERE lot.material_id = :material_id
  AND lot.tenant_id = :tenant_id
  AND lot.facility_id = :facility_id
  AND lot.is_active = TRUE
GROUP BY l.location_code, l.location_type, l.zone_code
```

**Stock by Lot (FIFO/FEFO):**
```sql
SELECT
  lot_number,
  current_quantity,
  available_quantity,
  quality_status,
  expiration_date,
  manufactured_date,
  location_id
FROM lots
WHERE material_id = :material_id
  AND tenant_id = :tenant_id
  AND facility_id = :facility_id
  AND quality_status = 'RELEASED'
  AND is_active = TRUE
ORDER BY
  CASE WHEN :allocation_method = 'FEFO' THEN expiration_date ELSE received_date END ASC,
  received_date ASC
```

---

## 2. Real-Time Infrastructure Analysis

### 2.1 NATS Jetstream Architecture

**Current Implementation:**
- NATS server running via Docker Compose (port 4222 internal, 4223 external)
- Jetstream enabled for persistent messaging
- 6 agent-specific streams for deliverables:
  - `agog_features_research` (cynthia)
  - `agog_features_critique` (sylvia)
  - `agog_features_backend` (roy)
  - `agog_features_frontend` (jen)
  - `agog_features_qa` (billy)
  - `agog_features_statistics` (priya)

**Stream Configuration:**
- Storage: File-based persistence
- Retention: Limits-based (7 days, 10K messages, 1GB per stream)
- Max message size: 10MB
- Deduplication window: 2 minutes

**Client Services (D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\nats\nats-client.service.ts):**
```typescript
class NATSClient {
  async publishDeliverable(options: NATSPublishOptions): Promise<string>
  async subscribeToDeliverables(options: NATSSubscribeOptions): Promise<void>
  async fetchDeliverable(agent, taskType, feature): Promise<any>
  async getStreamInfo(agent): Promise<any>
  async getAllStreamsStatus(): Promise<any[]>
}
```

**Frontend WebSocket Client (D:\GitHub\agogsaas\Implementation\print-industry-erp\frontend\src\websocket\natsClient.ts:3):**
```typescript
class NATSClient {
  async connect(url = 'ws://localhost:4222')
  async subscribe(subject: string, callback: (data: any) => void)
  async publish(subject: string, data: any)
}

// Pre-configured subscriptions:
subscribeToKPIUpdates(callback)
subscribeToProductionEvents(callback)
subscribeToAlerts(callback)
```

### 2.2 Event-Driven Architecture Pattern

**Deliverable Pattern (for agent communication):**
1. Agent performs work (5K-15K tokens of output)
2. Agent publishes FULL report to NATS channel
3. Agent returns TINY completion notice (~200 tokens)
4. Next agent fetches full report from NATS on demand
5. Result: 95%+ token savings

**Subject Naming Convention:**
```
agog.deliverables.[agent].[type].[feature]
                   ↓        ↓       ↓
                 cynthia research customer-search
```

**Recommended Pattern for Stock Events:**
```
agog.inventory.[event_type].[tenant_id].[facility_id]
               ↓            ↓            ↓
             transaction  tenant-123   facility-456

Examples:
- agog.inventory.transaction.tenant-123.facility-456
- agog.inventory.lot-update.tenant-123.facility-456
- agog.inventory.reservation.tenant-123.facility-456
- agog.inventory.location-change.tenant-123.facility-456
- agog.inventory.alert.tenant-123.facility-456
```

---

## 3. Real-Time Stock Tracking Patterns

### 3.1 Event-Sourced Inventory

**Pattern:** Capture all inventory state changes as events

**Advantages:**
- Complete audit trail (already have inventory_transactions)
- Real-time notifications via NATS pub/sub
- Enables time-travel queries (stock at any point in time)
- Supports CQRS (Command Query Responsibility Segregation)

**Implementation Approach:**

```typescript
// Event Types
enum InventoryEventType {
  RECEIPT = 'RECEIPT',
  ISSUE = 'ISSUE',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
  RESERVATION_CREATED = 'RESERVATION_CREATED',
  RESERVATION_FULFILLED = 'RESERVATION_FULFILLED',
  LOT_QUALITY_CHANGE = 'LOT_QUALITY_CHANGE',
  CYCLE_COUNT = 'CYCLE_COUNT'
}

// Event Structure
interface InventoryEvent {
  event_id: string;           // UUIDv7
  event_type: InventoryEventType;
  tenant_id: string;
  facility_id: string;
  material_id: string;
  lot_number?: string;
  location_id?: string;
  quantity_delta: number;     // Positive for receipts, negative for issues
  from_location_id?: string;
  to_location_id?: string;
  transaction_id?: string;    // FK to inventory_transactions
  timestamp: Date;
  user_id: string;
  metadata: {
    reference_type?: 'PO' | 'SO' | 'PRODUCTION' | 'ADJUSTMENT';
    reference_id?: string;
    reason_code?: string;
    [key: string]: any;
  };
}
```

### 3.2 Materialized View Pattern

**Pattern:** Maintain denormalized stock summary tables for fast queries

**Recommended Tables:**

```sql
-- Real-time stock summary by material/facility
CREATE TABLE inventory_stock_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  material_id UUID NOT NULL,

  -- Aggregated quantities
  on_hand_quantity DECIMAL(18,4) DEFAULT 0,
  available_quantity DECIMAL(18,4) DEFAULT 0,
  allocated_quantity DECIMAL(18,4) DEFAULT 0,
  reserved_quantity DECIMAL(18,4) DEFAULT 0,
  quality_hold_quantity DECIMAL(18,4) DEFAULT 0,
  in_transit_quantity DECIMAL(18,4) DEFAULT 0,

  -- Safety stock thresholds
  reorder_point DECIMAL(18,4),
  safety_stock DECIMAL(18,4),

  -- Status flags
  is_below_safety_stock BOOLEAN DEFAULT FALSE,
  is_below_reorder_point BOOLEAN DEFAULT FALSE,
  is_stockout BOOLEAN DEFAULT FALSE,

  -- Timestamps
  last_transaction_at TIMESTAMPTZ,
  last_receipt_at TIMESTAMPTZ,
  last_issue_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_stock_summary_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_stock_summary_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_stock_summary_material FOREIGN KEY (material_id) REFERENCES materials(id),
  CONSTRAINT uq_stock_summary UNIQUE (tenant_id, facility_id, material_id)
);

CREATE INDEX idx_stock_summary_tenant_facility ON inventory_stock_summary(tenant_id, facility_id);
CREATE INDEX idx_stock_summary_material ON inventory_stock_summary(material_id);
CREATE INDEX idx_stock_summary_below_safety ON inventory_stock_summary(is_below_safety_stock) WHERE is_below_safety_stock = TRUE;
CREATE INDEX idx_stock_summary_stockout ON inventory_stock_summary(is_stockout) WHERE is_stockout = TRUE;

-- Real-time stock by location
CREATE TABLE inventory_stock_by_location (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  material_id UUID NOT NULL,
  location_id UUID NOT NULL,
  lot_number VARCHAR(100),

  -- Quantities
  on_hand_quantity DECIMAL(18,4) DEFAULT 0,
  available_quantity DECIMAL(18,4) DEFAULT 0,
  allocated_quantity DECIMAL(18,4) DEFAULT 0,

  -- Lot details (denormalized for speed)
  quality_status VARCHAR(20),
  expiration_date DATE,

  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_stock_location_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_stock_location_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_stock_location_material FOREIGN KEY (material_id) REFERENCES materials(id),
  CONSTRAINT fk_stock_location_location FOREIGN KEY (location_id) REFERENCES inventory_locations(id),
  CONSTRAINT uq_stock_location UNIQUE (tenant_id, facility_id, material_id, location_id, lot_number)
);

CREATE INDEX idx_stock_location_tenant_facility ON inventory_stock_by_location(tenant_id, facility_id);
CREATE INDEX idx_stock_location_material ON inventory_stock_by_location(material_id);
CREATE INDEX idx_stock_location_location ON inventory_stock_by_location(location_id);
```

**Update Strategy:**
- Trigger-based: Postgres triggers on inventory_transactions, lots, inventory_reservations
- Application-based: Update summary tables in transaction resolver
- Hybrid: Triggers for critical updates, background jobs for reconciliation

### 3.3 WebSocket Subscription Pattern

**Frontend Real-Time Updates:**

```typescript
// Stock level subscription
interface StockLevelUpdate {
  material_id: string;
  material_code: string;
  material_name: string;
  facility_id: string;
  on_hand_quantity: number;
  available_quantity: number;
  allocated_quantity: number;
  reserved_quantity: number;
  is_below_safety_stock: boolean;
  is_stockout: boolean;
  timestamp: string;
}

// Subscribe to stock updates for specific material
natsClient.subscribe(
  `agog.inventory.stock-update.${tenantId}.${facilityId}.${materialId}`,
  (update: StockLevelUpdate) => {
    // Update UI components
    updateStockDisplay(update);

    // Trigger alerts if needed
    if (update.is_below_safety_stock) {
      showLowStockAlert(update);
    }
  }
);

// Subscribe to all stock updates for facility
natsClient.subscribe(
  `agog.inventory.stock-update.${tenantId}.${facilityId}.*`,
  (update: StockLevelUpdate) => {
    // Update dashboard aggregates
    updateDashboardMetrics(update);
  }
);

// Subscribe to stock alerts
natsClient.subscribe(
  `agog.inventory.alert.${tenantId}.${facilityId}.*`,
  (alert: StockAlert) => {
    // Show notification
    showNotification(alert);
  }
);
```

---

## 4. GraphQL Schema Design

### 4.1 Recommended Query Types

```graphql
type Query {
  # Get stock summary for material
  getStockSummary(
    tenantId: ID!
    facilityId: ID!
    materialId: ID!
  ): StockSummary!

  # Get stock across all facilities
  getStockByMaterial(
    tenantId: ID!
    materialId: ID!
  ): [StockSummary!]!

  # Get stock by location
  getStockByLocation(
    tenantId: ID!
    facilityId: ID!
    locationId: ID!
  ): [StockByLocation!]!

  # Get stock by lot (FIFO/FEFO view)
  getStockByLot(
    tenantId: ID!
    facilityId: ID!
    materialId: ID!
    allocationMethod: AllocationMethod = FIFO
  ): [LotStock!]!

  # Get low stock items
  getLowStockItems(
    tenantId: ID!
    facilityId: ID
    includeStockouts: Boolean = true
  ): [LowStockItem!]!

  # Get stock movement history
  getStockMovements(
    tenantId: ID!
    facilityId: ID
    materialId: ID
    fromDate: DateTime!
    toDate: DateTime!
    transactionTypes: [TransactionType!]
  ): [StockMovement!]!
}

type StockSummary {
  material: Material!
  facility: Facility!
  onHandQuantity: Float!
  availableQuantity: Float!
  allocatedQuantity: Float!
  reservedQuantity: Float!
  qualityHoldQuantity: Float!
  inTransitQuantity: Float!
  unitOfMeasure: String!
  reorderPoint: Float
  safetyStock: Float
  isBelowSafetyStock: Boolean!
  isBelowReorderPoint: Boolean!
  isStockout: Boolean!
  lastTransactionAt: DateTime
  lastReceiptAt: DateTime
  lastIssueAt: DateTime
  updatedAt: DateTime!
}

type StockByLocation {
  location: InventoryLocation!
  material: Material!
  lotNumber: String
  onHandQuantity: Float!
  availableQuantity: Float!
  allocatedQuantity: Float!
  qualityStatus: QualityStatus
  expirationDate: Date
  unitOfMeasure: String!
  updatedAt: DateTime!
}

type LotStock {
  lotNumber: String!
  material: Material!
  location: InventoryLocation
  currentQuantity: Float!
  availableQuantity: Float!
  allocatedQuantity: Float!
  qualityStatus: QualityStatus!
  receivedDate: Date
  manufacturedDate: Date
  expirationDate: Date
  vendorLotNumber: String
  unitOfMeasure: String!
}

type LowStockItem {
  material: Material!
  facility: Facility!
  currentQuantity: Float!
  safetyStock: Float!
  reorderPoint: Float!
  quantityBelowSafety: Float!
  daysOfStockRemaining: Float
  suggestedOrderQuantity: Float
  preferredVendor: Vendor
  leadTimeDays: Int
  unitOfMeasure: String!
}

type StockMovement {
  id: ID!
  transactionNumber: String!
  transactionType: TransactionType!
  transactionDate: DateTime!
  material: Material!
  lotNumber: String
  quantity: Float!
  unitOfMeasure: String!
  fromLocation: InventoryLocation
  toLocation: InventoryLocation
  referenceType: String
  referenceId: ID
  reasonCode: String
  performedBy: User!
  status: TransactionStatus!
}

enum AllocationMethod {
  FIFO  # First In, First Out
  LIFO  # Last In, First Out
  FEFO  # First Expired, First Out
}

enum QualityStatus {
  QUARANTINE
  PENDING_INSPECTION
  RELEASED
  REJECTED
  HOLD
}

enum TransactionType {
  RECEIPT
  ISSUE
  TRANSFER
  ADJUSTMENT
  CYCLE_COUNT
  RETURN
  SCRAP
}

enum TransactionStatus {
  PENDING
  COMPLETED
  REVERSED
}
```

### 4.2 Subscription Types

```graphql
type Subscription {
  # Subscribe to stock level changes for material
  onStockLevelChanged(
    tenantId: ID!
    facilityId: ID
    materialId: ID
  ): StockLevelChangeEvent!

  # Subscribe to low stock alerts
  onLowStockAlert(
    tenantId: ID!
    facilityId: ID
  ): LowStockAlert!

  # Subscribe to stock transactions
  onStockTransaction(
    tenantId: ID!
    facilityId: ID
    transactionTypes: [TransactionType!]
  ): StockTransactionEvent!
}

type StockLevelChangeEvent {
  eventId: ID!
  eventType: String!
  material: Material!
  facility: Facility!
  previousQuantity: Float!
  newQuantity: Float!
  quantityDelta: Float!
  transactionType: TransactionType
  timestamp: DateTime!
}

type LowStockAlert {
  alertId: ID!
  alertType: LowStockAlertType!
  material: Material!
  facility: Facility!
  currentQuantity: Float!
  thresholdQuantity: Float!
  severity: AlertSeverity!
  suggestedAction: String
  timestamp: DateTime!
}

enum LowStockAlertType {
  BELOW_SAFETY_STOCK
  BELOW_REORDER_POINT
  STOCKOUT
  APPROACHING_EXPIRATION
}

enum AlertSeverity {
  INFO
  WARNING
  CRITICAL
}

type StockTransactionEvent {
  transaction: StockMovement!
  affectedMaterials: [StockSummary!]!
  timestamp: DateTime!
}
```

---

## 5. Technical Implementation Recommendations

### 5.1 Backend Service Layer

**Stock Service Architecture:**

```typescript
// services/stock.service.ts
class StockService {
  constructor(
    private db: Database,
    private natsClient: NATSClient
  ) {}

  // Calculate real-time stock summary
  async getStockSummary(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<StockSummary> {
    // Option 1: Query materialized view (fast)
    const summary = await this.db.query(`
      SELECT * FROM inventory_stock_summary
      WHERE tenant_id = $1 AND facility_id = $2 AND material_id = $3
    `, [tenantId, facilityId, materialId]);

    // Option 2: Calculate on-the-fly (accurate but slower)
    const onHand = await this.calculateOnHand(tenantId, facilityId, materialId);
    const allocated = await this.calculateAllocated(tenantId, facilityId, materialId);
    const reserved = await this.calculateReserved(tenantId, facilityId, materialId);

    return {
      onHandQuantity: onHand,
      availableQuantity: onHand - allocated - reserved,
      allocatedQuantity: allocated,
      reservedQuantity: reserved,
      // ... other fields
    };
  }

  // Record inventory transaction and publish event
  async recordTransaction(
    transaction: InventoryTransaction
  ): Promise<void> {
    // 1. Insert into inventory_transactions table
    const txn = await this.db.insert('inventory_transactions', transaction);

    // 2. Update lot quantities
    await this.updateLotQuantities(transaction);

    // 3. Update materialized view
    await this.updateStockSummary(transaction);

    // 4. Publish NATS event for real-time updates
    await this.publishStockEvent({
      event_type: 'TRANSACTION',
      tenant_id: transaction.tenant_id,
      facility_id: transaction.facility_id,
      material_id: transaction.material_id,
      transaction_id: txn.id,
      quantity_delta: transaction.quantity,
      timestamp: new Date()
    });

    // 5. Check for low stock alerts
    await this.checkStockAlerts(
      transaction.tenant_id,
      transaction.facility_id,
      transaction.material_id
    );
  }

  // Publish stock change event to NATS
  private async publishStockEvent(event: InventoryEvent): Promise<void> {
    const subject = `agog.inventory.transaction.${event.tenant_id}.${event.facility_id}`;

    await this.natsClient.publish(subject, {
      event_id: generateUUIDv7(),
      ...event
    });
  }

  // Check and publish low stock alerts
  private async checkStockAlerts(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<void> {
    const summary = await this.getStockSummary(tenantId, facilityId, materialId);
    const material = await this.db.query('SELECT * FROM materials WHERE id = $1', [materialId]);

    if (summary.availableQuantity <= 0) {
      // STOCKOUT
      await this.publishAlert({
        alert_type: 'STOCKOUT',
        severity: 'CRITICAL',
        material_id: materialId,
        current_quantity: summary.availableQuantity,
        threshold_quantity: 0
      });
    } else if (material.safety_stock && summary.availableQuantity <= material.safety_stock) {
      // BELOW SAFETY STOCK
      await this.publishAlert({
        alert_type: 'BELOW_SAFETY_STOCK',
        severity: 'WARNING',
        material_id: materialId,
        current_quantity: summary.availableQuantity,
        threshold_quantity: material.safety_stock
      });
    } else if (material.reorder_point && summary.availableQuantity <= material.reorder_point) {
      // BELOW REORDER POINT
      await this.publishAlert({
        alert_type: 'BELOW_REORDER_POINT',
        severity: 'INFO',
        material_id: materialId,
        current_quantity: summary.availableQuantity,
        threshold_quantity: material.reorder_point
      });
    }
  }

  private async publishAlert(alert: any): Promise<void> {
    const subject = `agog.inventory.alert.${alert.tenant_id}.${alert.facility_id}`;
    await this.natsClient.publish(subject, alert);
  }
}
```

### 5.2 GraphQL Resolver Implementation

```typescript
// resolvers/stock.resolver.ts
export const stockResolvers = {
  Query: {
    getStockSummary: async (
      _: any,
      { tenantId, facilityId, materialId }: any,
      { stockService }: any
    ) => {
      return await stockService.getStockSummary(tenantId, facilityId, materialId);
    },

    getLowStockItems: async (
      _: any,
      { tenantId, facilityId, includeStockouts }: any,
      { db }: any
    ) => {
      return await db.query(`
        SELECT
          s.*,
          m.material_code,
          m.material_name,
          m.safety_stock,
          m.reorder_point
        FROM inventory_stock_summary s
        INNER JOIN materials m ON s.material_id = m.id
        WHERE s.tenant_id = $1
          AND ($2::uuid IS NULL OR s.facility_id = $2)
          AND (s.is_below_safety_stock = TRUE OR (s.is_stockout = TRUE AND $3 = TRUE))
        ORDER BY
          CASE WHEN s.is_stockout THEN 1 ELSE 2 END,
          s.available_quantity ASC
      `, [tenantId, facilityId, includeStockouts]);
    }
  },

  Subscription: {
    onStockLevelChanged: {
      subscribe: async (
        _: any,
        { tenantId, facilityId, materialId }: any,
        { pubsub, natsClient }: any
      ) => {
        // Subscribe to NATS subject
        const subject = materialId
          ? `agog.inventory.transaction.${tenantId}.${facilityId}.${materialId}`
          : `agog.inventory.transaction.${tenantId}.${facilityId}.*`;

        // Create GraphQL subscription from NATS messages
        return pubsub.asyncIterator(['STOCK_LEVEL_CHANGED']);
      },
      resolve: (payload: any) => payload
    },

    onLowStockAlert: {
      subscribe: async (
        _: any,
        { tenantId, facilityId }: any,
        { pubsub }: any
      ) => {
        return pubsub.asyncIterator(['LOW_STOCK_ALERT']);
      },
      resolve: (payload: any) => payload
    }
  }
};
```

### 5.3 Database Triggers for Real-Time Updates

```sql
-- Trigger to update stock summary when lot quantities change
CREATE OR REPLACE FUNCTION update_stock_summary_on_lot_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert stock summary
  INSERT INTO inventory_stock_summary (
    tenant_id, facility_id, material_id,
    on_hand_quantity, available_quantity, allocated_quantity,
    updated_at
  )
  SELECT
    NEW.tenant_id,
    NEW.facility_id,
    NEW.material_id,
    COALESCE(SUM(current_quantity), 0),
    COALESCE(SUM(available_quantity), 0),
    COALESCE(SUM(allocated_quantity), 0),
    NOW()
  FROM lots
  WHERE tenant_id = NEW.tenant_id
    AND facility_id = NEW.facility_id
    AND material_id = NEW.material_id
    AND is_active = TRUE
  ON CONFLICT (tenant_id, facility_id, material_id)
  DO UPDATE SET
    on_hand_quantity = EXCLUDED.on_hand_quantity,
    available_quantity = EXCLUDED.available_quantity,
    allocated_quantity = EXCLUDED.allocated_quantity,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lot_quantity_change_trigger
AFTER INSERT OR UPDATE OF current_quantity, available_quantity, allocated_quantity
ON lots
FOR EACH ROW
EXECUTE FUNCTION update_stock_summary_on_lot_change();

-- Trigger to update stock summary when reservations change
CREATE OR REPLACE FUNCTION update_stock_summary_on_reservation_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_stock_summary
  SET
    reserved_quantity = (
      SELECT COALESCE(SUM(quantity_reserved), 0)
      FROM inventory_reservations
      WHERE tenant_id = NEW.tenant_id
        AND facility_id = NEW.facility_id
        AND material_id = NEW.material_id
        AND status = 'ACTIVE'
    ),
    updated_at = NOW()
  WHERE tenant_id = NEW.tenant_id
    AND facility_id = NEW.facility_id
    AND material_id = NEW.material_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_change_trigger
AFTER INSERT OR UPDATE OF quantity_reserved, status
ON inventory_reservations
FOR EACH ROW
EXECUTE FUNCTION update_stock_summary_on_reservation_change();
```

---

## 6. Frontend Integration

### 6.1 React Component Pattern

```typescript
// components/StockMonitor.tsx
import { useEffect, useState } from 'react';
import { natsClient } from '@/websocket/natsClient';

interface StockLevelProps {
  tenantId: string;
  facilityId: string;
  materialId: string;
}

export function StockLevelMonitor({ tenantId, facilityId, materialId }: StockLevelProps) {
  const [stockLevel, setStockLevel] = useState<StockSummary | null>(null);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);

  useEffect(() => {
    // Initial fetch via GraphQL
    fetchStockLevel();

    // Subscribe to real-time updates
    const subject = `agog.inventory.stock-update.${tenantId}.${facilityId}.${materialId}`;
    natsClient.subscribe(subject, (update: StockLevelUpdate) => {
      setStockLevel(prev => ({
        ...prev,
        ...update
      }));
    });

    // Subscribe to alerts
    const alertSubject = `agog.inventory.alert.${tenantId}.${facilityId}.*`;
    natsClient.subscribe(alertSubject, (alert: LowStockAlert) => {
      if (alert.material_id === materialId) {
        setAlerts(prev => [alert, ...prev].slice(0, 10)); // Keep last 10
      }
    });

    return () => {
      // Cleanup subscriptions
      natsClient.disconnect();
    };
  }, [tenantId, facilityId, materialId]);

  const fetchStockLevel = async () => {
    // GraphQL query
    const result = await client.query({
      query: GET_STOCK_SUMMARY,
      variables: { tenantId, facilityId, materialId }
    });
    setStockLevel(result.data.getStockSummary);
  };

  return (
    <div className="stock-monitor">
      <div className="stock-levels">
        <div className="metric">
          <label>On Hand</label>
          <span className={stockLevel?.isStockout ? 'critical' : ''}>
            {stockLevel?.onHandQuantity?.toFixed(2)} {stockLevel?.unitOfMeasure}
          </span>
        </div>
        <div className="metric">
          <label>Available</label>
          <span className={stockLevel?.isBelowSafetyStock ? 'warning' : ''}>
            {stockLevel?.availableQuantity?.toFixed(2)} {stockLevel?.unitOfMeasure}
          </span>
        </div>
        <div className="metric">
          <label>Allocated</label>
          <span>{stockLevel?.allocatedQuantity?.toFixed(2)} {stockLevel?.unitOfMeasure}</span>
        </div>
        <div className="metric">
          <label>Reserved</label>
          <span>{stockLevel?.reservedQuantity?.toFixed(2)} {stockLevel?.unitOfMeasure}</span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map(alert => (
            <div key={alert.alertId} className={`alert ${alert.severity.toLowerCase()}`}>
              {alert.suggestedAction}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6.2 Dashboard Integration

```typescript
// components/InventoryDashboard.tsx
export function InventoryDashboard({ tenantId, facilityId }: Props) {
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  useEffect(() => {
    // Subscribe to facility-wide stock updates
    const subject = `agog.inventory.stock-update.${tenantId}.${facilityId}.*`;
    natsClient.subscribe(subject, (update: StockLevelUpdate) => {
      // Update dashboard metrics
      if (update.is_below_safety_stock || update.is_stockout) {
        refreshLowStockList();
      }
    });
  }, [tenantId, facilityId]);

  const refreshLowStockList = async () => {
    const result = await client.query({
      query: GET_LOW_STOCK_ITEMS,
      variables: { tenantId, facilityId, includeStockouts: true }
    });
    setLowStockItems(result.data.getLowStockItems);
  };

  return (
    <div className="inventory-dashboard">
      <div className="kpi-cards">
        <KPICard title="Total SKUs" value={totalSkus} />
        <KPICard title="Low Stock Items" value={lowStockItems.length} trend="warning" />
        <KPICard title="Stockouts" value={stockoutCount} trend="critical" />
        <KPICard title="Inventory Value" value={formatCurrency(inventoryValue)} />
      </div>

      <div className="low-stock-table">
        <h3>Low Stock Items</h3>
        <table>
          <thead>
            <tr>
              <th>Material Code</th>
              <th>Material Name</th>
              <th>Current Qty</th>
              <th>Safety Stock</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lowStockItems.map(item => (
              <tr key={item.material.id} className={getRowClass(item)}>
                <td>{item.material.materialCode}</td>
                <td>{item.material.materialName}</td>
                <td>{item.currentQuantity.toFixed(2)} {item.unitOfMeasure}</td>
                <td>{item.safetyStock.toFixed(2)}</td>
                <td>
                  {item.currentQuantity === 0 ? (
                    <Badge variant="critical">Stockout</Badge>
                  ) : (
                    <Badge variant="warning">Low Stock</Badge>
                  )}
                </td>
                <td>
                  <Button onClick={() => createPurchaseOrder(item)}>
                    Order {item.suggestedOrderQuantity} {item.unitOfMeasure}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 7. Performance Considerations

### 7.1 Query Optimization

**Indexing Strategy:**
- Material + Facility + Tenant composite indexes
- Partial indexes on status flags (is_active, quality_status)
- Covering indexes for common queries
- Timestamp indexes for historical queries

**Query Patterns:**
```sql
-- Optimized stock summary query (uses materialized view)
EXPLAIN ANALYZE
SELECT * FROM inventory_stock_summary
WHERE tenant_id = :tenant_id
  AND facility_id = :facility_id
  AND material_id = :material_id;
-- Expected: Index Scan on inventory_stock_summary (<1ms)

-- Optimized lot allocation query (FEFO)
EXPLAIN ANALYZE
SELECT lot_number, available_quantity, expiration_date
FROM lots
WHERE tenant_id = :tenant_id
  AND facility_id = :facility_id
  AND material_id = :material_id
  AND quality_status = 'RELEASED'
  AND available_quantity > 0
  AND is_active = TRUE
ORDER BY expiration_date ASC, received_date ASC
LIMIT 10;
-- Expected: Index Scan on lots + Sort (<5ms)
```

### 7.2 Caching Strategy

**Redis Cache Layers:**
```typescript
// Cache stock summaries (TTL: 60 seconds)
const cacheKey = `stock:${tenantId}:${facilityId}:${materialId}`;
let stockSummary = await redis.get(cacheKey);

if (!stockSummary) {
  stockSummary = await stockService.getStockSummary(tenantId, facilityId, materialId);
  await redis.setex(cacheKey, 60, JSON.stringify(stockSummary));
}

// Invalidate cache on inventory transaction
await redis.del(`stock:${tenantId}:${facilityId}:${materialId}`);
await redis.publish(`cache:invalidate:stock`, {
  tenant_id: tenantId,
  facility_id: facilityId,
  material_id: materialId
});
```

### 7.3 Scalability Considerations

**Horizontal Scaling:**
- NATS Jetstream clustering for high availability
- Postgres read replicas for query load distribution
- Redis cluster for distributed caching
- GraphQL federation for microservices architecture

**Partitioning Strategy:**
- Partition inventory_transactions by date (monthly partitions)
- Partition by tenant_id for multi-tenant isolation
- Archive old transactions to separate tables/databases

**Rate Limiting:**
- Limit real-time subscription connections per user
- Throttle NATS event publishing (max 1000 events/sec per tenant)
- Batch stock summary recalculations

---

## 8. Migration and Rollout Strategy

### 8.1 Phase 1: Foundation (Week 1)

**Tasks:**
1. Create materialized view tables (inventory_stock_summary, inventory_stock_by_location)
2. Implement stock calculation functions
3. Create database triggers for real-time updates
4. Set up NATS streams for inventory events
5. Write unit tests for stock calculations

**Deliverables:**
- Migration script: `V0.0.14__create_stock_summary_tables.sql`
- Stock service module
- NATS inventory event publisher

### 8.2 Phase 2: GraphQL API (Week 2)

**Tasks:**
1. Define GraphQL schema for stock queries
2. Implement resolvers for stock queries
3. Implement GraphQL subscriptions
4. Connect NATS events to GraphQL subscriptions
5. Integration tests for API

**Deliverables:**
- GraphQL schema file: `stock.graphql`
- Stock resolvers
- Subscription handlers

### 8.3 Phase 3: Frontend Integration (Week 3)

**Tasks:**
1. Create React stock monitoring components
2. Implement WebSocket connection management
3. Build inventory dashboard
4. Add low stock alerts UI
5. End-to-end testing

**Deliverables:**
- StockLevelMonitor component
- InventoryDashboard component
- Alert notification system

### 8.4 Phase 4: Optimization and Monitoring (Week 4)

**Tasks:**
1. Add Redis caching layer
2. Optimize database queries
3. Set up monitoring dashboards (Grafana)
4. Performance testing and tuning
5. Documentation

**Deliverables:**
- Performance benchmarks
- Monitoring dashboards
- User documentation

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Stock Calculation Tests:**
```typescript
describe('StockService', () => {
  it('should calculate on-hand quantity correctly', async () => {
    // Test data
    const lots = [
      { current_quantity: 100, quality_status: 'RELEASED' },
      { current_quantity: 50, quality_status: 'RELEASED' },
      { current_quantity: 25, quality_status: 'QUARANTINE' }
    ];

    const onHand = await stockService.calculateOnHand('tenant-1', 'facility-1', 'material-1');
    expect(onHand).toBe(175); // Includes quarantine
  });

  it('should calculate available quantity correctly', async () => {
    // Test: available = on-hand - allocated - reserved - quality hold
    const available = await stockService.getStockSummary('tenant-1', 'facility-1', 'material-1');
    expect(available.availableQuantity).toBe(125); // 175 - 25 - 0 - 25
  });

  it('should trigger low stock alert when below safety stock', async () => {
    const alertSpy = jest.spyOn(stockService, 'publishAlert');
    await stockService.recordTransaction({
      transaction_type: 'ISSUE',
      quantity: 100, // This brings stock below safety
      // ... other fields
    });

    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        alert_type: 'BELOW_SAFETY_STOCK'
      })
    );
  });
});
```

### 9.2 Integration Tests

**GraphQL Resolver Tests:**
```typescript
describe('Stock Resolvers', () => {
  it('should return stock summary via GraphQL', async () => {
    const query = `
      query GetStockSummary($tenantId: ID!, $facilityId: ID!, $materialId: ID!) {
        getStockSummary(tenantId: $tenantId, facilityId: $facilityId, materialId: $materialId) {
          onHandQuantity
          availableQuantity
          allocatedQuantity
          isBelowSafetyStock
        }
      }
    `;

    const result = await graphql(schema, query, null, context, {
      tenantId: 'tenant-1',
      facilityId: 'facility-1',
      materialId: 'material-1'
    });

    expect(result.data.getStockSummary).toMatchObject({
      onHandQuantity: 175,
      availableQuantity: 125,
      allocatedQuantity: 25,
      isBelowSafetyStock: false
    });
  });
});
```

### 9.3 E2E Tests

**Real-Time Update Flow:**
```typescript
describe('Real-Time Stock Updates', () => {
  it('should push stock updates to subscribed clients', async (done) => {
    // 1. Client subscribes to stock updates
    const subscription = await client.subscribe({
      query: STOCK_LEVEL_SUBSCRIPTION,
      variables: { tenantId: 'tenant-1', facilityId: 'facility-1', materialId: 'material-1' }
    });

    subscription.subscribe({
      next: (data) => {
        expect(data.onStockLevelChanged).toMatchObject({
          newQuantity: 75,
          quantityDelta: -100
        });
        done();
      }
    });

    // 2. Trigger inventory transaction
    await client.mutate({
      mutation: RECORD_TRANSACTION,
      variables: {
        transaction: {
          transactionType: 'ISSUE',
          quantity: 100,
          // ... other fields
        }
      }
    });

    // 3. Subscription should receive update
  });
});
```

---

## 10. Risk Analysis and Mitigation

### 10.1 Technical Risks

**Risk: NATS Message Loss**
- **Mitigation:** Use Jetstream persistence with replication
- **Fallback:** Database polling for critical updates

**Risk: WebSocket Connection Drops**
- **Mitigation:** Implement automatic reconnection with exponential backoff
- **Fallback:** Periodic polling when WebSocket unavailable

**Risk: Materialized View Lag**
- **Mitigation:** Use triggers for real-time updates + background reconciliation
- **Fallback:** Query base tables directly if summary is stale

**Risk: Race Conditions in Stock Updates**
- **Mitigation:** Use database transactions with row-level locking
- **Fallback:** Optimistic locking with version numbers

### 10.2 Performance Risks

**Risk: High Volume of Real-Time Events**
- **Mitigation:** Implement event batching and debouncing
- **Rate limiting:** Max 1000 events/sec per tenant

**Risk: Slow Query Performance**
- **Mitigation:** Materialized views, caching, and optimized indexes
- **Monitoring:** Set up query performance alerts (>100ms)

### 10.3 Data Integrity Risks

**Risk: Stock Summary Out of Sync**
- **Mitigation:** Daily reconciliation job comparing summaries to base tables
- **Alerting:** Notify on discrepancies > 1%

**Risk: Negative Stock Quantities**
- **Mitigation:** Database check constraints preventing negative values
- **Validation:** Pre-transaction validation in application layer

---

## 11. Monitoring and Observability

### 11.1 Key Metrics

**Performance Metrics:**
- Stock query response time (p50, p95, p99)
- NATS event publishing rate
- WebSocket connection count
- Cache hit ratio

**Business Metrics:**
- Number of low stock items
- Number of stockouts
- Inventory turnover rate
- Days of stock remaining (aggregate)

**System Health Metrics:**
- NATS stream lag
- Database connection pool usage
- Materialized view freshness
- Background job execution time

### 11.2 Dashboards

**Grafana Dashboards:**
1. **Inventory Health Dashboard**
   - Total SKUs tracked
   - Low stock items count
   - Stockout count
   - Inventory value trend

2. **Stock System Performance**
   - Query latency
   - Event throughput
   - Cache performance
   - WebSocket connections

3. **Data Quality Dashboard**
   - Stock summary reconciliation errors
   - Negative quantity incidents
   - Transaction volume by type

### 11.3 Alerts

**Critical Alerts:**
- Stockout detected (immediate notification)
- NATS connection lost
- Database query timeout (>5s)
- Materialized view lag >5 minutes

**Warning Alerts:**
- Low stock threshold breached
- Cache hit ratio <80%
- Event publishing backlog >1000 messages

---

## 12. Security Considerations

### 12.1 Multi-Tenancy Isolation

**Row-Level Security:**
```sql
-- Enable RLS on stock summary table
ALTER TABLE inventory_stock_summary ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's stock
CREATE POLICY tenant_isolation_policy ON inventory_stock_summary
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**GraphQL Context Security:**
```typescript
// Validate tenant access in resolver context
export const stockResolvers = {
  Query: {
    getStockSummary: async (_, { tenantId, facilityId, materialId }, { user, tenantId: userTenantId }) => {
      // Ensure user can only query their own tenant
      if (tenantId !== userTenantId) {
        throw new Error('Unauthorized: Cannot access other tenant data');
      }

      return await stockService.getStockSummary(tenantId, facilityId, materialId);
    }
  }
};
```

### 12.2 Real-Time Subscription Security

**NATS Subject Authorization:**
```typescript
// Only allow subscriptions to user's tenant subjects
const authorizedSubject = `agog.inventory.*.${user.tenantId}.*`;

if (!subject.startsWith(`agog.inventory.*.${user.tenantId}`)) {
  throw new Error('Unauthorized subscription');
}
```

**Rate Limiting:**
```typescript
// Limit subscriptions per user
const maxSubscriptionsPerUser = 10;
const userSubscriptions = await redis.get(`subscriptions:${user.id}`);

if (userSubscriptions >= maxSubscriptionsPerUser) {
  throw new Error('Maximum subscriptions exceeded');
}
```

---

## 13. Future Enhancements

### 13.1 Advanced Features

**Predictive Stock Alerts:**
- ML model to predict stockouts based on historical usage patterns
- Suggest optimal reorder quantities based on demand forecasting

**Multi-Location Inventory Optimization:**
- Automated stock transfer suggestions between facilities
- Load balancing inventory across warehouses

**Blockchain Traceability:**
- Immutable audit trail using blockchain
- Supply chain transparency for regulated industries

### 13.2 Integration Opportunities

**ERP Integration:**
- SAP, Oracle, NetSuite connectors
- Bi-directional sync of inventory levels

**IoT Integration:**
- RFID tag scanning for automatic stock updates
- Weight sensors for continuous inventory monitoring
- Barcode scanning mobile apps

**Third-Party Logistics (3PL):**
- API for 3PL providers to report stock levels
- Automated reconciliation of 3PL inventory

---

## 14. Conclusion

### 14.1 Summary of Findings

The AGOG SaaS system has a solid foundation for implementing real-time stock level monitoring:

**Strengths:**
- Comprehensive WMS schema with lot tracking, locations, and transactions
- NATS Jetstream infrastructure already in place
- Frontend WebSocket client ready for real-time updates
- Modern tech stack (GraphQL, React, TypeScript)

**Recommendations:**
1. Implement materialized view pattern for fast stock queries
2. Use NATS event-driven architecture for real-time updates
3. Leverage existing inventory_transactions table as event source
4. Build GraphQL subscriptions on top of NATS events
5. Add monitoring and alerting from day one

**Estimated Effort:**
- Backend implementation: 2 weeks
- Frontend integration: 1 week
- Testing and optimization: 1 week
- **Total: 4 weeks**

### 14.2 Next Steps

**Immediate Actions:**
1. Review and approve this research report (Sylvia - Critique Agent)
2. Create database migration for materialized views (Roy - Backend)
3. Implement GraphQL schema and resolvers (Roy - Backend)
4. Build React components for stock monitoring (Jen - Frontend)
5. Write comprehensive tests (Billy - QA)

**Success Criteria:**
- Stock queries respond in <100ms (p95)
- Real-time updates delivered to clients within 1 second
- System handles 1000+ concurrent stock monitoring sessions
- Zero data loss during NATS failover
- 99.9% uptime for stock monitoring service

---

## 15. References

### 15.1 Codebase References

- **WMS Migration:** `print-industry-erp/backend/migrations/V0.0.4__create_wms_module.sql`
- **Materials Schema:** `print-industry-erp/backend/migrations/V0.0.6__create_sales_materials_procurement.sql`
- **Item Master Design:** `print-industry-erp/backend/data-models/schemas/items.yaml`
- **NATS Client:** `print-industry-erp/backend/src/nats/nats-client.service.ts`
- **NATS Deliverable Service:** `print-industry-erp/backend/src/nats/nats-deliverable.service.ts`
- **Frontend NATS Client:** `print-industry-erp/frontend/src/websocket/natsClient.ts`
- **NATS Quickstart:** `print-industry-erp/backend/NATS_QUICKSTART.md`

### 15.2 Industry Best Practices

- **Event Sourcing Pattern:** Martin Fowler - Event Sourcing
- **CQRS Pattern:** Greg Young - CQRS Documents
- **Real-Time Inventory Management:** Gartner Research - WMS Best Practices
- **GraphQL Subscriptions:** Apollo GraphQL - Subscription Documentation
- **NATS Jetstream:** NATS.io - Jetstream Documentation

---

**End of Research Report**

**Prepared by:** Cynthia (Research Agent)
**Date:** 2025-12-20
**Request Number:** REQ-STOCK-TRACKING-001
**Status:** Ready for Critique (Next Stage: Sylvia)
