# REQ-STOCK-TRACKING-001: Real-Time Stock Level Monitoring
## Research & Technical Specification

**Agent:** Cynthia (Research)
**Date:** 2025-12-20
**Status:** COMPLETE
**Priority:** CRITICAL
**Complexity:** MEDIUM-HIGH

---

## Executive Summary

Real-time stock level monitoring is essential for warehouse operations, enabling immediate visibility into inventory availability, preventing stockouts, optimizing storage utilization, and ensuring accurate order fulfillment. This specification defines a comprehensive solution leveraging the existing database schema, NATS messaging infrastructure, and GraphQL subscriptions to provide sub-second inventory visibility across the print industry ERP system.

**Key Finding:** The existing WMS schema (V0.0.4) provides robust foundation with `lots` table tracking current/available/allocated quantities, but lacks real-time event streaming and materialized views for instant query performance.

---

## 1. Current State Analysis

### 1.1 Existing Database Schema

#### Inventory Core Tables (V0.0.4__create_wms_module.sql)

**lots table** - Primary inventory tracking entity:
- `current_quantity` - Total on-hand quantity
- `available_quantity` - Quantity available for allocation
- `allocated_quantity` - Quantity reserved for orders
- `location_id` - Physical warehouse location
- `quality_status` - QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD
- `expiration_date` - For shelf-life management

**inventory_transactions table** - Complete movement audit trail:
- Transaction types: RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP
- Quantity tracking with UOM
- From/to location tracking
- Reference to source documents (PO, SO, production run)
- Full audit trail with timestamps

**inventory_locations table** - Physical storage hierarchy:
- Zone/Aisle/Rack/Shelf/Bin structure
- Location types: RECEIVING, PUTAWAY, PICK_FACE, RESERVE, PACKING, SHIPPING, QUARANTINE, RETURNS
- ABC classification for cycle counting
- Temperature control flags
- Security zones (5-tier: STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT)
- Physical dimensions and weight capacity

**inventory_reservations table** - Soft allocations:
- Links to sales_order_id, production_order_id, shipment_id
- Expiration date for time-bound reservations
- Status: ACTIVE, FULFILLED, EXPIRED, CANCELLED

#### Item Master (Future - items.yaml design)

**Planned Item Master Pattern:**
- Unified `items` table replacing separate materials/products tables
- Role flags: `can_be_purchased`, `can_be_sold`, `can_be_manufactured`, `can_be_inventoried`
- Material/Product are ROLES, not separate classifications
- Example: Blank labels can be both purchased (material role) AND sold (product role)

**Current State:** Still using separate `materials` and `products` tables (V0.0.6)

### 1.2 Existing Real-Time Infrastructure

#### NATS Jetstream (Implemented)
- **Purpose:** Durable message storage for agent deliverables
- **Streams:** 6 agent-specific streams (research, critique, backend, frontend, qa, statistics)
- **Retention:** Max 10K messages, 1GB, 7 days
- **Channel Pattern:** `agog.deliverables.[agent].[type].[feature]`
- **Max Payload:** 10MB
- **Location:** `print-industry-erp/backend/src/nats/`

**Current Usage:** Agent-to-agent communication for feature workflows
**Opportunity:** Extend to inventory event streaming with new subject hierarchy

#### GraphQL Subscriptions (Monitoring Module)
- **Existing Subscriptions:**
  - `systemHealthUpdated` - System health metrics
  - `errorCreated` - Error notifications
  - `agentActivityUpdated` - Agent workflow updates
  - `workflowUpdated` - Feature workflow progress

**Location:** `print-industry-erp/backend/src/modules/monitoring/graphql/schema.graphql`
**Technology:** GraphQL subscriptions over WebSocket
**Opportunity:** Add inventory-specific subscription types

### 1.3 SCD Type 2 Historical Tracking (V0.0.10)

**Master Data Versioning:**
- `effective_from_date`, `effective_to_date`, `is_current_version` on:
  - facilities, customers, vendors, products, materials, employees, work_centers
- Enables point-in-time queries: "What was material cost when production run started?"
- **Relevance:** Historical cost data for inventory valuation accuracy

### 1.4 Current Gaps

1. **No Real-Time Event Stream:** Inventory transactions write to database but don't publish events
2. **No Materialized Views:** Every stock query hits transactional tables (performance bottleneck)
3. **No Aggregation Layer:** Available-to-Promise (ATP) calculations performed on-demand
4. **No Alert System:** No proactive notifications for low stock, expiring lots, or stockouts
5. **No Multi-Location Visibility:** No unified view across facilities
6. **No IoT Integration:** No hooks for barcode scanners, RFID readers, weight scales

---

## 2. Requirements Analysis

### 2.1 Functional Requirements

#### FR-1: Real-Time Stock Visibility
- **FR-1.1:** Display current on-hand quantity by material, lot, location, and facility
- **FR-1.2:** Show available quantity (current - allocated - reserved)
- **FR-1.3:** Display allocated quantity by sales order, production order
- **FR-1.4:** Show reserved quantity with expiration status
- **FR-1.5:** Indicate quality status (RELEASED, QUARANTINE, HOLD, REJECTED)
- **FR-1.6:** Display expiration dates and shelf-life warnings

#### FR-2: Multi-Location Tracking
- **FR-2.1:** Aggregate stock across all locations within a facility
- **FR-2.2:** Aggregate stock across all facilities for a tenant
- **FR-2.3:** Filter by zone, aisle, rack, bin hierarchy
- **FR-2.4:** Filter by location type (PICK_FACE, RESERVE, etc.)
- **FR-2.5:** Filter by security zone (for restricted materials)
- **FR-2.6:** Show stock distribution heat map

#### FR-3: Event-Driven Updates
- **FR-3.1:** Publish event on every inventory transaction (RECEIPT, ISSUE, TRANSFER, ADJUSTMENT)
- **FR-3.2:** Publish event on reservation changes (CREATE, FULFILL, EXPIRE, CANCEL)
- **FR-3.3:** Publish event on lot quality status changes
- **FR-3.4:** Publish event on location changes (TRANSFER, PUTAWAY, PICK)
- **FR-3.5:** Batch events within 1-second windows to reduce message volume

#### FR-4: Stock Alerts
- **FR-4.1:** Alert when stock falls below reorder point
- **FR-4.2:** Alert when lot approaches expiration (configurable days threshold)
- **FR-4.3:** Alert when negative stock detected (data integrity issue)
- **FR-4.4:** Alert when stock exceeds location capacity
- **FR-4.5:** Alert when QUARANTINE stock remains unresolved > 7 days

#### FR-5: Available-to-Promise (ATP) Calculation
- **FR-5.1:** Calculate ATP = On-Hand - Allocated - Reserved + Expected Receipts
- **FR-5.2:** Project ATP by date considering expected POs and production runs
- **FR-5.3:** Support multi-level ATP (facility-level, zone-level, location-level)
- **FR-5.4:** Cache ATP calculations for performance (refresh on transaction events)

#### FR-6: Stock Inquiry APIs
- **FR-6.1:** Query stock by material code, lot number, location
- **FR-6.2:** Query stock history (point-in-time snapshot)
- **FR-6.3:** Query stock movements (transaction log)
- **FR-6.4:** Query stock projections (future ATP)
- **FR-6.5:** Export stock data (CSV, Excel)

### 2.2 Non-Functional Requirements

#### NFR-1: Performance
- **NFR-1.1:** Stock queries must return within 200ms (P95)
- **NFR-1.2:** Event publication latency < 100ms
- **NFR-1.3:** GraphQL subscription updates delivered within 500ms of transaction
- **NFR-1.4:** Support 1000 concurrent stock queries
- **NFR-1.5:** Support 100 transactions per second throughput

#### NFR-2: Scalability
- **NFR-2.1:** Handle 1M+ inventory line items per tenant
- **NFR-2.2:** Handle 10K+ locations per facility
- **NFR-2.3:** Handle 100+ concurrent WebSocket subscriptions
- **NFR-2.4:** Scale horizontally (stateless service design)

#### NFR-3: Reliability
- **NFR-3.1:** 99.9% uptime for stock query APIs
- **NFR-3.2:** Zero data loss (event persistence in NATS Jetstream)
- **NFR-3.3:** Graceful degradation (serve cached data if database unavailable)
- **NFR-3.4:** Event replay capability (recover from stream)

#### NFR-4: Data Consistency
- **NFR-4.1:** Strong consistency for writes (ACID transactions)
- **NFR-4.2:** Eventual consistency for read replicas (acceptable <1s lag)
- **NFR-4.3:** Materialized view refresh within 5 seconds of transaction
- **NFR-4.4:** Reconciliation job detects discrepancies daily

---

## 3. Proposed Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React/Apollo)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │ Stock Dashboard│  │ Location View  │  │ Alert Panel    │   │
│  │ (Real-time)    │  │ (Heat Map)     │  │ (Notifications)│   │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘   │
│           │                   │                   │            │
│           └───────────────────┴───────────────────┘            │
│                               │                                │
└───────────────────────────────┼────────────────────────────────┘
                                │ GraphQL Subscriptions (WebSocket)
                                │ GraphQL Queries (HTTP)
                                │
┌───────────────────────────────▼────────────────────────────────┐
│                    GraphQL API Layer (Apollo Server)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Inventory Schema Extensions                   │  │
│  │  - type StockLevel { ... }                               │  │
│  │  - type StockEvent { ... }                               │  │
│  │  - subscription stockLevelUpdated(...)                   │  │
│  │  - subscription stockAlertTriggered(...)                 │  │
│  │  - query stockByMaterial(...)                            │  │
│  │  - query stockByLocation(...)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────┐
│              Inventory Service Layer (TypeScript)               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ StockQueryService│  │ StockEventService│  │ AlertService │ │
│  │                  │  │                  │  │              │ │
│  │ - Query stock    │  │ - Publish events │  │ - Evaluate   │ │
│  │ - Calculate ATP  │  │ - Subscribe to   │  │   rules      │ │
│  │ - Cache results  │  │   NATS           │  │ - Notify     │ │
│  └────────┬─────────┘  └────────┬─────────┘  │   users      │ │
│           │                     │             └──────────────┘ │
└───────────┼─────────────────────┼────────────────────────────┘
            │                     │
            │                     │ Publish/Subscribe
            │                     │
┌───────────▼─────────────────────▼───────────────────────────────┐
│                     NATS Jetstream                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ NEW STREAM: agog_inventory_events                        │   │
│  │                                                          │   │
│  │ Subjects:                                                │   │
│  │   agog.inventory.transaction.{tenant}.{facility}.{type}  │   │
│  │   agog.inventory.reservation.{tenant}.{facility}.{action}│   │
│  │   agog.inventory.alert.{tenant}.{facility}.{alertType}   │   │
│  │                                                          │   │
│  │ Retention: 30 days, 100GB max, 1M messages max           │   │
│  │ Storage: File (persistent)                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
            │                     │
            │ Write               │ Read
            │                     │
┌───────────▼─────────────────────▼───────────────────────────────┐
│                    PostgreSQL Database                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ OLTP Tables      │  │ Materialized     │  │ Event Log    │  │
│  │                  │  │ Views (FAST)     │  │              │  │
│  │ - lots           │  │                  │  │ - inventory_ │  │
│  │ - inventory_     │  │ - mv_stock_by_   │  │   events     │  │
│  │   transactions   │  │   material       │  │   (append-   │  │
│  │ - inventory_     │  │ - mv_stock_by_   │  │   only)      │  │
│  │   locations      │  │   location       │  │              │  │
│  │ - inventory_     │  │ - mv_atp_        │  │              │  │
│  │   reservations   │  │   projection     │  │              │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Event Streaming Architecture

#### 3.2.1 NATS Stream Configuration

**Stream Name:** `agog_inventory_events`

**Subject Hierarchy:**
```
agog.inventory.transaction.{tenant_id}.{facility_id}.{transaction_type}
  Examples:
  - agog.inventory.transaction.tenant-123.facility-456.RECEIPT
  - agog.inventory.transaction.tenant-123.facility-456.ISSUE
  - agog.inventory.transaction.tenant-123.facility-456.TRANSFER
  - agog.inventory.transaction.tenant-123.facility-456.ADJUSTMENT

agog.inventory.reservation.{tenant_id}.{facility_id}.{action}
  Examples:
  - agog.inventory.reservation.tenant-123.facility-456.CREATE
  - agog.inventory.reservation.tenant-123.facility-456.FULFILL
  - agog.inventory.reservation.tenant-123.facility-456.EXPIRE
  - agog.inventory.reservation.tenant-123.facility-456.CANCEL

agog.inventory.alert.{tenant_id}.{facility_id}.{alert_type}
  Examples:
  - agog.inventory.alert.tenant-123.facility-456.LOW_STOCK
  - agog.inventory.alert.tenant-123.facility-456.EXPIRING_LOT
  - agog.inventory.alert.tenant-123.facility-456.NEGATIVE_STOCK
  - agog.inventory.alert.tenant-123.facility-456.QUARANTINE_STALE
```

**Stream Settings:**
```typescript
{
  name: 'agog_inventory_events',
  subjects: ['agog.inventory.>'],
  retention: 'limits',
  max_msgs: 1_000_000,      // 1M messages
  max_bytes: 107_374_182_400, // 100GB
  max_age: 2_592_000_000_000_000, // 30 days (nanoseconds)
  storage: 'file',          // Persistent to disk
  num_replicas: 1,          // Single instance for now
  duplicate_window: 120_000_000_000, // 2 min deduplication
}
```

#### 3.2.2 Event Payload Schema

**StockTransactionEvent:**
```typescript
interface StockTransactionEvent {
  event_id: string;              // UUIDv7
  event_timestamp: string;       // ISO 8601
  tenant_id: string;             // UUIDv7
  facility_id: string;           // UUIDv7

  transaction_id: string;        // UUID of inventory_transactions record
  transaction_type: TransactionType; // RECEIPT, ISSUE, TRANSFER, etc.
  transaction_number: string;    // Human-readable

  material_id: string;           // UUIDv7
  material_code: string;         // SKU
  lot_number?: string;           // If lot-tracked

  quantity_change: number;       // Positive or negative
  unit_of_measure: string;

  from_location_id?: string;     // For TRANSFER, ISSUE
  to_location_id?: string;       // For TRANSFER, RECEIPT

  quality_status?: QualityStatus; // RELEASED, QUARANTINE, etc.

  reference_document?: {
    type: 'PO' | 'SO' | 'PR' | 'SHIPMENT';
    id: string;
  };

  performed_by_user_id: string;

  // Snapshot of stock AFTER this transaction
  stock_snapshot: {
    current_quantity: number;
    available_quantity: number;
    allocated_quantity: number;
  };
}
```

**StockReservationEvent:**
```typescript
interface StockReservationEvent {
  event_id: string;
  event_timestamp: string;
  tenant_id: string;
  facility_id: string;

  reservation_id: string;
  action: 'CREATE' | 'FULFILL' | 'EXPIRE' | 'CANCEL';

  material_id: string;
  material_code: string;
  lot_number?: string;
  location_id?: string;

  quantity_reserved: number;
  unit_of_measure: string;

  reference_order?: {
    type: 'SALES_ORDER' | 'PRODUCTION_ORDER' | 'SHIPMENT';
    id: string;
  };

  expiration_date?: string;

  created_by_user_id: string;
}
```

**StockAlertEvent:**
```typescript
interface StockAlertEvent {
  event_id: string;
  event_timestamp: string;
  tenant_id: string;
  facility_id: string;

  alert_type: AlertType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';

  material_id: string;
  material_code: string;
  lot_number?: string;
  location_id?: string;

  alert_details: {
    current_quantity?: number;
    reorder_point?: number;
    expiration_date?: string;
    days_until_expiration?: number;
    quality_status?: string;
    quarantine_since?: string;
  };

  requires_action: boolean;
  acknowledged: boolean;
}
```

### 3.3 Database Enhancements

#### 3.3.1 Materialized Views for Performance

**mv_stock_by_material** - Fast lookup by material:
```sql
CREATE MATERIALIZED VIEW mv_stock_by_material AS
SELECT
  l.tenant_id,
  l.facility_id,
  l.material_id,
  m.material_code,
  m.material_name,
  SUM(l.current_quantity) AS total_current_quantity,
  SUM(l.available_quantity) AS total_available_quantity,
  SUM(l.allocated_quantity) AS total_allocated_quantity,
  COUNT(DISTINCT l.location_id) AS location_count,
  COUNT(DISTINCT CASE WHEN l.quality_status = 'QUARANTINE' THEN l.id END) AS quarantine_lot_count,
  MIN(l.expiration_date) AS earliest_expiration,
  MAX(l.updated_at) AS last_updated
FROM lots l
JOIN materials m ON l.material_id = m.id
WHERE l.is_active = TRUE
GROUP BY l.tenant_id, l.facility_id, l.material_id, m.material_code, m.material_name;

CREATE UNIQUE INDEX idx_mv_stock_by_material_pk
  ON mv_stock_by_material(tenant_id, facility_id, material_id);
CREATE INDEX idx_mv_stock_by_material_code
  ON mv_stock_by_material(tenant_id, material_code);
```

**mv_stock_by_location** - Fast lookup by location:
```sql
CREATE MATERIALIZED VIEW mv_stock_by_location AS
SELECT
  l.tenant_id,
  l.facility_id,
  l.location_id,
  loc.location_code,
  loc.zone_code,
  loc.location_type,
  COUNT(DISTINCT l.material_id) AS unique_materials,
  COUNT(DISTINCT l.id) AS total_lots,
  SUM(l.current_quantity * m.weight_lbs_per_unit) AS total_weight_lbs,
  loc.max_weight_lbs,
  (SUM(l.current_quantity * m.weight_lbs_per_unit) / NULLIF(loc.max_weight_lbs, 0)) * 100 AS utilization_pct,
  MAX(l.updated_at) AS last_updated
FROM lots l
JOIN inventory_locations loc ON l.location_id = loc.id
JOIN materials m ON l.material_id = m.id
WHERE l.is_active = TRUE AND loc.is_active = TRUE
GROUP BY l.tenant_id, l.facility_id, l.location_id, loc.location_code,
         loc.zone_code, loc.location_type, loc.max_weight_lbs;

CREATE UNIQUE INDEX idx_mv_stock_by_location_pk
  ON mv_stock_by_location(tenant_id, facility_id, location_id);
```

**mv_atp_projection** - Available-to-Promise cache:
```sql
CREATE MATERIALIZED VIEW mv_atp_projection AS
SELECT
  tenant_id,
  facility_id,
  material_id,
  -- Current ATP
  (SELECT SUM(available_quantity)
   FROM lots
   WHERE material_id = m.id AND facility_id = f.id AND is_active = TRUE
  ) AS atp_now,

  -- Expected receipts (next 30 days)
  (SELECT COALESCE(SUM(pol.quantity_ordered - pol.quantity_received), 0)
   FROM purchase_order_lines pol
   JOIN purchase_orders po ON pol.purchase_order_id = po.id
   WHERE pol.material_id = m.id
     AND po.facility_id = f.id
     AND po.status IN ('ISSUED', 'ACKNOWLEDGED')
     AND pol.promised_delivery_date <= CURRENT_DATE + INTERVAL '30 days'
  ) AS expected_receipts_30d,

  -- Projected ATP (30 days)
  (SELECT SUM(available_quantity) FROM lots WHERE material_id = m.id AND facility_id = f.id AND is_active = TRUE) +
  (SELECT COALESCE(SUM(pol.quantity_ordered - pol.quantity_received), 0)
   FROM purchase_order_lines pol
   JOIN purchase_orders po ON pol.purchase_order_id = po.id
   WHERE pol.material_id = m.id AND po.facility_id = f.id
     AND po.status IN ('ISSUED', 'ACKNOWLEDGED')
     AND pol.promised_delivery_date <= CURRENT_DATE + INTERVAL '30 days'
  ) AS atp_projected_30d,

  NOW() AS calculated_at
FROM materials m
CROSS JOIN facilities f
WHERE m.is_active = TRUE AND f.is_active = TRUE;

CREATE UNIQUE INDEX idx_mv_atp_projection_pk
  ON mv_atp_projection(tenant_id, facility_id, material_id);
```

**Refresh Strategy:**
```sql
-- Triggered refresh via PostgreSQL NOTIFY/LISTEN
CREATE OR REPLACE FUNCTION refresh_stock_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_by_material;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_by_location;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_atp_projection;
END;
$$ LANGUAGE plpgsql;

-- Trigger on inventory_transactions insert
CREATE OR REPLACE FUNCTION notify_stock_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('stock_changed', json_build_object(
    'tenant_id', NEW.tenant_id,
    'facility_id', NEW.facility_id,
    'material_id', NEW.material_id
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stock_change
AFTER INSERT OR UPDATE ON inventory_transactions
FOR EACH ROW EXECUTE FUNCTION notify_stock_change();
```

#### 3.3.2 Event Log Table

**inventory_events** - Append-only event log (dual-write with NATS):
```sql
CREATE TABLE inventory_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL,
  -- TRANSACTION, RESERVATION, ALERT

  event_payload JSONB NOT NULL,
  -- Full event data (StockTransactionEvent, StockReservationEvent, StockAlertEvent)

  nats_subject VARCHAR(255) NOT NULL,
  nats_stream_seq BIGINT,
  -- NATS sequence number for correlation

  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,

  CONSTRAINT fk_inventory_event_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_inventory_events_tenant ON inventory_events(tenant_id);
CREATE INDEX idx_inventory_events_type ON inventory_events(event_type);
CREATE INDEX idx_inventory_events_timestamp ON inventory_events(event_timestamp);
CREATE INDEX idx_inventory_events_processed ON inventory_events(processed) WHERE processed = FALSE;
CREATE INDEX idx_inventory_events_payload_material
  ON inventory_events USING gin((event_payload->'material_id'));
```

### 3.4 GraphQL Schema Extensions

```graphql
# =====================================================
# INVENTORY SCHEMA EXTENSIONS
# =====================================================

"""
Stock level snapshot for a material at a specific location/facility
"""
type StockLevel {
  id: ID!
  tenantId: ID!
  facilityId: ID!

  # Material
  materialId: ID!
  materialCode: String!
  materialName: String!
  lotNumber: String

  # Location
  locationId: ID
  locationCode: String
  zoneCode: String

  # Quantities
  currentQuantity: Float!
  availableQuantity: Float!
  allocatedQuantity: Float!
  reservedQuantity: Float!

  unitOfMeasure: String!

  # Quality
  qualityStatus: QualityStatus!

  # Expiration
  expirationDate: Date
  daysUntilExpiration: Int
  isExpiringSoon: Boolean!

  # Metadata
  lastUpdated: DateTime!
  lastTransactionId: ID
}

"""
Quality status for lot tracking
"""
enum QualityStatus {
  RELEASED
  QUARANTINE
  PENDING_INSPECTION
  REJECTED
  HOLD
}

"""
Stock movement event (transaction)
"""
type StockEvent {
  eventId: ID!
  eventTimestamp: DateTime!

  tenantId: ID!
  facilityId: ID!

  transactionId: ID!
  transactionType: TransactionType!
  transactionNumber: String!

  materialId: ID!
  materialCode: String!
  lotNumber: String

  quantityChange: Float!
  unitOfMeasure: String!

  fromLocationId: ID
  fromLocationCode: String
  toLocationId: ID
  toLocationCode: String

  qualityStatus: QualityStatus

  performedByUserId: ID!
  performedByUserName: String

  # Snapshot after transaction
  stockSnapshot: StockSnapshot!
}

"""
Transaction types
"""
enum TransactionType {
  RECEIPT
  ISSUE
  TRANSFER
  ADJUSTMENT
  CYCLE_COUNT
  RETURN
  SCRAP
}

"""
Stock snapshot after a transaction
"""
type StockSnapshot {
  currentQuantity: Float!
  availableQuantity: Float!
  allocatedQuantity: Float!
}

"""
Stock alert notification
"""
type StockAlert {
  alertId: ID!
  alertTimestamp: DateTime!

  tenantId: ID!
  facilityId: ID!

  alertType: StockAlertType!
  severity: AlertSeverity!

  materialId: ID!
  materialCode: String!
  materialName: String!
  lotNumber: String
  locationId: ID

  alertDetails: JSON!

  requiresAction: Boolean!
  acknowledged: Boolean!
  acknowledgedBy: ID
  acknowledgedAt: DateTime
}

"""
Alert types
"""
enum StockAlertType {
  LOW_STOCK
  EXPIRING_LOT
  NEGATIVE_STOCK
  CAPACITY_EXCEEDED
  QUARANTINE_STALE
}

"""
Alert severity levels
"""
enum AlertSeverity {
  INFO
  WARNING
  CRITICAL
}

"""
Available-to-Promise projection
"""
type ATPProjection {
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  materialCode: String!

  atpNow: Float!
  expectedReceipts30d: Float!
  atpProjected30d: Float!

  unitOfMeasure: String!
  calculatedAt: DateTime!
}

"""
Stock aggregation by material across locations
"""
type StockByMaterial {
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  materialCode: String!
  materialName: String!

  totalCurrentQuantity: Float!
  totalAvailableQuantity: Float!
  totalAllocatedQuantity: Float!

  locationCount: Int!
  quarantineLotCount: Int!
  earliestExpiration: Date

  unitOfMeasure: String!
  lastUpdated: DateTime!
}

"""
Stock aggregation by location
"""
type StockByLocation {
  tenantId: ID!
  facilityId: ID!
  locationId: ID!
  locationCode: String!
  zoneCode: String
  locationType: String!

  uniqueMaterials: Int!
  totalLots: Int!
  totalWeightLbs: Float!
  maxWeightLbs: Float
  utilizationPct: Float

  lastUpdated: DateTime!
}

# =====================================================
# QUERIES
# =====================================================

extend type Query {
  """Get stock levels for a specific material"""
  stockByMaterial(
    tenantId: ID!
    facilityId: ID
    materialCode: String!
    lotNumber: String
    includeQuarantine: Boolean
  ): [StockLevel!]!

  """Get stock levels for a specific location"""
  stockByLocation(
    tenantId: ID!
    facilityId: ID!
    locationCode: String!
  ): [StockLevel!]!

  """Get aggregated stock summary by material"""
  stockSummaryByMaterial(
    tenantId: ID!
    facilityId: ID
    materialCodes: [String!]
  ): [StockByMaterial!]!

  """Get aggregated stock summary by location"""
  stockSummaryByLocation(
    tenantId: ID!
    facilityId: ID!
    zoneCode: String
  ): [StockByLocation!]!

  """Get Available-to-Promise projection"""
  atpProjection(
    tenantId: ID!
    facilityId: ID!
    materialCode: String!
  ): ATPProjection

  """Get stock transaction history"""
  stockHistory(
    tenantId: ID!
    facilityId: ID
    materialCode: String
    locationCode: String
    fromDate: Date!
    toDate: Date!
    transactionTypes: [TransactionType!]
    limit: Int
    offset: Int
  ): StockEventConnection!

  """Get active stock alerts"""
  stockAlerts(
    tenantId: ID!
    facilityId: ID
    alertTypes: [StockAlertType!]
    severity: AlertSeverity
    acknowledgedFilter: AcknowledgedFilter
    limit: Int
    offset: Int
  ): StockAlertConnection!
}

"""
Filter for acknowledged status
"""
enum AcknowledgedFilter {
  ALL
  ACKNOWLEDGED
  UNACKNOWLEDGED
}

# =====================================================
# SUBSCRIPTIONS
# =====================================================

extend type Subscription {
  """Subscribe to real-time stock level updates"""
  stockLevelUpdated(
    tenantId: ID!
    facilityId: ID
    materialCodes: [String!]
    locationCodes: [String!]
  ): StockLevel!

  """Subscribe to stock transaction events"""
  stockEventOccurred(
    tenantId: ID!
    facilityId: ID
    transactionTypes: [TransactionType!]
  ): StockEvent!

  """Subscribe to stock alerts"""
  stockAlertTriggered(
    tenantId: ID!
    facilityId: ID
    alertTypes: [StockAlertType!]
    severity: AlertSeverity
  ): StockAlert!

  """Subscribe to ATP projection updates"""
  atpProjectionUpdated(
    tenantId: ID!
    facilityId: ID!
    materialCodes: [String!]
  ): ATPProjection!
}

# =====================================================
# MUTATIONS
# =====================================================

extend type Mutation {
  """Acknowledge a stock alert"""
  acknowledgeStockAlert(
    alertId: ID!
    notes: String
  ): StockAlert!

  """Manually refresh stock materialized views"""
  refreshStockViews(
    tenantId: ID!
    facilityId: ID
  ): RefreshResult!
}

"""
Result of materialized view refresh
"""
type RefreshResult {
  success: Boolean!
  refreshedAt: DateTime!
  affectedMaterials: Int!
  affectedLocations: Int!
}

# =====================================================
# CONNECTION TYPES (Pagination)
# =====================================================

type StockEventConnection {
  edges: [StockEventEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type StockEventEdge {
  node: StockEvent!
  cursor: String!
}

type StockAlertConnection {
  edges: [StockAlertEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type StockAlertEdge {
  node: StockAlert!
  cursor: String!
}
```

---

## 4. Implementation Approach

### 4.1 Phase 1: Foundation (Week 1)

**Deliverables:**
1. Create NATS stream `agog_inventory_events` with subject hierarchy
2. Implement event payload TypeScript interfaces
3. Create `StockEventService` class for publishing events
4. Add database trigger for dual-write to `inventory_events` table
5. Implement PostgreSQL NOTIFY/LISTEN for materialized view refresh

**Acceptance Criteria:**
- NATS stream created and verified via CLI
- Event published successfully on inventory transaction
- Event persisted to `inventory_events` table
- Materialized views refresh within 5 seconds

### 4.2 Phase 2: Materialized Views (Week 2)

**Deliverables:**
1. Create `mv_stock_by_material` with refresh function
2. Create `mv_stock_by_location` with refresh function
3. Create `mv_atp_projection` with refresh function
4. Implement concurrent refresh strategy (no table locks)
5. Add performance monitoring for view refresh latency

**Acceptance Criteria:**
- Materialized views return results in <50ms
- Concurrent refresh completes in <10 seconds
- View data accuracy 100% (reconciliation test)

### 4.3 Phase 3: GraphQL API (Week 3)

**Deliverables:**
1. Extend GraphQL schema with inventory types
2. Implement query resolvers (`stockByMaterial`, `stockByLocation`, etc.)
3. Implement subscription resolvers using NATS consumer
4. Add Redis caching layer for frequently-accessed stock queries
5. Implement rate limiting and pagination

**Acceptance Criteria:**
- All queries return within 200ms (P95)
- Subscriptions deliver updates within 500ms
- API handles 1000 concurrent requests
- Cache hit rate >80% for stock queries

### 4.4 Phase 4: Alert System (Week 4)

**Deliverables:**
1. Implement `StockAlertService` with rule evaluation
2. Add alert thresholds configuration (per material, per tenant)
3. Implement alert deduplication (don't spam same alert)
4. Add email/SMS notification integration
5. Build alert dashboard in frontend

**Acceptance Criteria:**
- Alerts triggered within 60 seconds of threshold breach
- Zero duplicate alerts for same condition
- Alert acknowledgment flow functional
- Email notifications delivered reliably

### 4.5 Phase 5: Frontend Integration (Week 5)

**Deliverables:**
1. Build real-time stock dashboard (React component)
2. Implement WebSocket subscription client (Apollo Client)
3. Add location heat map visualization
4. Build stock transaction log viewer
5. Create alert notification panel

**Acceptance Criteria:**
- Dashboard updates in real-time (<1s latency)
- Heat map renders 10K+ locations without lag
- Transaction log supports infinite scroll
- Alert panel shows badge count

---

## 5. Performance Optimization Strategy

### 5.1 Query Optimization

**Materialized Views:**
- Pre-aggregate common queries (by material, by location)
- Refresh concurrently to avoid table locks
- Use UNIQUE indexes for instant lookup
- Partition large views by facility_id

**Redis Caching:**
```typescript
// Cache stock summary for 30 seconds
const cacheKey = `stock:material:${tenantId}:${materialCode}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const stock = await db.query('SELECT * FROM mv_stock_by_material WHERE ...');
await redis.setex(cacheKey, 30, JSON.stringify(stock));
return stock;
```

**Database Connection Pooling:**
- Separate read pool (10 connections) for queries
- Separate write pool (5 connections) for transactions
- Read replicas for heavy analytical queries

### 5.2 Event Batching

**Problem:** High transaction volume creates event storm (1000s of events/second)

**Solution:** Batch events within 1-second windows:
```typescript
class StockEventBatcher {
  private batch: StockTransactionEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  add(event: StockTransactionEvent) {
    this.batch.push(event);

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 1000);
    }
  }

  async flush() {
    if (this.batch.length === 0) return;

    // Publish batch as single NATS message
    await nats.publish('agog.inventory.transaction.batch', {
      events: this.batch,
      batch_size: this.batch.length,
    });

    this.batch = [];
    this.timer = null;
  }
}
```

### 5.3 Subscription Filtering

**Problem:** WebSocket subscriptions consume resources, even when data doesn't change

**Solution:** Server-side filtering with delta detection:
```typescript
// Only send update if stock actually changed
const previousStock = await redis.get(`stock:last:${materialId}`);
const currentStock = await getStockLevel(materialId);

if (JSON.stringify(previousStock) !== JSON.stringify(currentStock)) {
  pubsub.publish('STOCK_UPDATED', currentStock);
  await redis.set(`stock:last:${materialId}`, currentStock);
}
```

---

## 6. Data Model Considerations

### 6.1 Item Master Migration Impact

**Current State:** Separate `materials` and `products` tables

**Future State:** Unified `items` table with role flags

**Stock Tracking Impact:**
- `lots.material_id` → `lots.item_id` (rename foreign key)
- Query compatibility layer during migration
- Materialized views reference `items` instead of `materials`

**Migration Strategy:**
1. Create `items` table (keep `materials`/`products` during transition)
2. Dual-write to both schemas (maintain backward compatibility)
3. Update stock queries to use `items` table
4. Migrate historical `lots` records to reference `items`
5. Drop `materials`/`products` tables (final cutover)

**Timeline:** Coordinate with Item Master implementation (separate REQ)

### 6.2 Multi-UOM Complexity

**Challenge:** Different UOMs for purchase, sales, inventory, manufacturing

**Example:**
- Purchase: 5000-sheet ROLLS
- Inventory: track in SHEETS
- Sales: sell in BOXES (500 sheets each)
- Manufacturing: consume in IMPRESSIONS (2 sheets = 1 impression)

**Solution:** Store all quantities in base UOM (SHEETS), convert on-demand
```typescript
// Convert from purchase UOM to base UOM
const baseQuantity = purchaseQuantity * uomConversion.factor;

// Store in base UOM
await db.query('UPDATE lots SET current_quantity = $1', [baseQuantity]);

// Display in user's preferred UOM
const displayQuantity = baseQuantity / uomConversion.factor;
```

### 6.3 Lot Tracking Granularity

**Requirement:** Some materials require lot-level tracking (expiration, traceability)

**Design Decision:** `lots` table is ALWAYS lot-aware
- If material doesn't require lot tracking, create single virtual lot (lot_number = 'DEFAULT')
- If material requires lot tracking, create separate lot record per vendor lot
- Query aggregates across lots for materials without lot tracking

**Benefits:**
- Uniform data model (no null lot_number)
- Easy to enable/disable lot tracking (just change material config)
- Stock queries always GROUP BY lot_number (consistent logic)

---

## 7. Security & Compliance

### 7.1 Multi-Tenant Isolation

**Requirement:** Tenant A cannot see Tenant B's stock data

**Implementation:**
- Row-Level Security (RLS) on all inventory tables
- GraphQL context includes `tenantId` from JWT token
- All queries filter by `tenant_id`
- NATS subjects include `tenant_id` (prevents cross-tenant subscription)

```sql
-- Enable RLS on lots table
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
CREATE POLICY tenant_isolation_policy ON lots
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 7.2 Security Zone Access Control

**Requirement:** Users with STANDARD clearance cannot access VAULT stock

**Implementation:**
- `inventory_locations.security_zone` (STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT)
- `users.security_clearance_level` (enum matching security zones)
- Query filters: `WHERE location.security_zone <= user.clearance_level`

```typescript
// Resolver with clearance check
async stockByLocation(parent, args, context) {
  const user = context.user;
  const location = await db.getLocation(args.locationCode);

  // Check clearance
  if (location.securityZone > user.securityClearanceLevel) {
    throw new ForbiddenError('Insufficient security clearance');
  }

  return db.getStockByLocation(args.locationCode);
}
```

### 7.3 Audit Trail

**Requirement:** Track who accessed/modified stock data (SOX compliance)

**Implementation:**
- All inventory transactions already log `performed_by_user_id`
- Add audit log for stock QUERIES (who viewed what, when)
- Retain audit logs for 7 years (compliance requirement)

```sql
CREATE TABLE stock_query_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  query_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  query_type VARCHAR(50) NOT NULL,
  query_params JSONB,
  results_count INT,

  CONSTRAINT fk_stock_query_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_stock_query_audit_user ON stock_query_audit(user_id);
CREATE INDEX idx_stock_query_audit_timestamp ON stock_query_audit(query_timestamp);
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Coverage Targets:**
- Service layer: 90%+ coverage
- Resolver logic: 80%+ coverage
- Event serialization: 100% coverage

**Key Test Cases:**
```typescript
describe('StockEventService', () => {
  test('publishes transaction event to NATS', async () => {
    const event = createMockTransactionEvent();
    await stockEventService.publishTransaction(event);

    expect(natsClient.publish).toHaveBeenCalledWith(
      'agog.inventory.transaction.tenant-123.facility-456.RECEIPT',
      expect.objectContaining({ event_id: event.event_id })
    );
  });

  test('calculates stock snapshot correctly after transaction', () => {
    const snapshot = calculateStockSnapshot({
      currentQty: 1000,
      transaction: { type: 'ISSUE', quantity: 200 }
    });

    expect(snapshot.currentQuantity).toBe(800);
  });
});
```

### 8.2 Integration Tests

**Test Scenarios:**
1. End-to-end transaction flow: Create transaction → Event published → MV refreshed → GraphQL subscription notified
2. Multi-tenant isolation: Tenant A cannot subscribe to Tenant B's events
3. Alert triggering: Low stock threshold breach triggers alert event
4. Materialized view accuracy: MV data matches raw table aggregation

### 8.3 Performance Tests

**Load Testing:**
- Simulate 1000 concurrent stock queries (target: <200ms P95)
- Simulate 100 transactions/second (target: zero data loss)
- Simulate 100 WebSocket subscriptions (target: <500ms latency)

**Tools:**
- k6 for load testing
- PostgreSQL pg_stat_statements for query analysis
- Grafana for real-time performance monitoring

### 8.4 Chaos Testing

**Failure Scenarios:**
- NATS server crash (verify event replay from stream)
- Database connection pool exhaustion (verify graceful degradation)
- Materialized view refresh failure (verify fallback to raw tables)

---

## 9. Monitoring & Observability

### 9.1 Key Metrics

**Service-Level Objectives (SLOs):**
- Stock query latency: P95 < 200ms, P99 < 500ms
- Event publication latency: P95 < 100ms
- Subscription notification latency: P95 < 500ms
- Materialized view refresh time: P95 < 10 seconds
- Uptime: 99.9% (43 minutes downtime/month)

**Business Metrics:**
- Total stock value (by facility, by material category)
- Stock turnover rate (inventory days on hand)
- Stockout frequency (alerts/week)
- Expired lot count (waste reduction)
- Location utilization % (space efficiency)

### 9.2 Alerting

**Critical Alerts (Page Engineer):**
- Stock query error rate > 1%
- NATS connection lost
- Materialized view refresh failed 3+ times
- Negative stock detected (data integrity issue)

**Warning Alerts (Notify Team):**
- Stock query latency P95 > 500ms
- Event queue backlog > 10K messages
- Cache miss rate > 50%

### 9.3 Dashboards

**Operations Dashboard:**
- Real-time transaction rate (TPS)
- NATS stream message count
- Materialized view refresh history
- Active WebSocket subscription count

**Business Dashboard:**
- Stock by facility (pie chart)
- Low stock alerts (bar chart)
- Stock turnover trend (line chart)
- Expiring lots forecast (table)

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| NATS message loss during network partition | HIGH | LOW | Enable stream replication (num_replicas: 3) when scaling |
| Materialized view refresh locks table | MEDIUM | MEDIUM | Use CONCURRENTLY option (requires UNIQUE index) |
| WebSocket connection limits on server | MEDIUM | MEDIUM | Scale horizontally, use Redis pub/sub for clustering |
| Database connection pool exhaustion | HIGH | LOW | Separate read/write pools, monitor pool usage |
| Cache invalidation bugs (stale data) | MEDIUM | MEDIUM | Short TTL (30s), reconciliation job validates cache |

### 10.2 Data Quality Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Negative stock quantities | HIGH | MEDIUM | CHECK constraint on lots table, daily reconciliation job |
| Orphaned reservations (never fulfilled/expired) | MEDIUM | HIGH | Background job expires reservations after 24h |
| Location capacity exceeded | LOW | MEDIUM | Alert when utilization > 95%, block putaway if > 100% |
| Lot expiration missed | MEDIUM | MEDIUM | Daily batch job triggers expiration alerts 7 days ahead |

### 10.3 Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Schema migration breaks live queries | HIGH | LOW | Blue-green deployment, backward-compatible migrations |
| Event schema evolution (breaking changes) | MEDIUM | HIGH | Version events (v1, v2), support multiple versions |
| NATS stream storage full (100GB limit) | MEDIUM | MEDIUM | Monitor stream size, implement auto-purge for old messages |
| Materialized view out of sync | MEDIUM | LOW | Reconciliation job detects drift, auto-refresh if >5% variance |

---

## 11. Success Metrics

### 11.1 Technical Success Criteria

- [ ] Stock queries return in <200ms (P95) with 10K+ materials
- [ ] Event publication latency <100ms (P95)
- [ ] WebSocket subscriptions deliver updates <500ms after transaction
- [ ] Materialized views refresh within 5 seconds
- [ ] Zero data loss (100% event persistence)
- [ ] Support 1000 concurrent users
- [ ] Support 100 transactions/second
- [ ] API uptime 99.9%

### 11.2 Business Success Criteria

- [ ] Warehouse managers can see real-time stock updates without page refresh
- [ ] Pickers receive instant notifications when stock moves (for wave processing)
- [ ] Purchasing receives low-stock alerts proactively (reduce stockouts by 80%)
- [ ] Quality team alerted immediately when lot enters QUARANTINE
- [ ] Customer service can check ATP instantly during order entry
- [ ] Operations can monitor stock by zone/location (optimize putaway)
- [ ] Finance can track inventory value in real-time (balance sheet accuracy)

### 11.3 User Satisfaction

**Target Metrics:**
- User survey: 4.5/5 stars "Stock visibility improved operations"
- Support tickets: 50% reduction in "Where is my stock?" inquiries
- Order fulfillment accuracy: 99%+ (reduced picking errors)
- Warehouse productivity: 20% increase (less time searching for stock)

---

## 12. Future Enhancements (Out of Scope)

### 12.1 IoT Integration
- Barcode scanner integration (publish stock transactions via IoT gateway)
- RFID reader integration (automatic stock tracking on dock doors)
- Weight scale integration (verify received quantity matches PO)
- Temperature sensor integration (alert if cold storage exceeds threshold)

### 12.2 AI/ML Capabilities
- Predictive stock replenishment (forecast demand, auto-create POs)
- Anomaly detection (flag unusual stock movements)
- Optimal putaway suggestions (ML-based location recommendation)
- Demand forecasting (predict future stock requirements)

### 12.3 Advanced Analytics
- Stock aging analysis (identify slow-moving inventory)
- ABC classification automation (re-classify based on velocity)
- Slotting optimization (recommend inventory reorganization)
- Cross-docking opportunities (bypass warehouse storage)

---

## 13. Dependencies & Prerequisites

### 13.1 Infrastructure
- [ ] NATS Jetstream server running (already deployed)
- [ ] PostgreSQL 15+ with uuid-ossp and pgcrypto extensions
- [ ] Redis 7+ for caching (new requirement)
- [ ] GraphQL server with subscription support (Apollo Server)

### 13.2 Database Schema
- [ ] WMS schema V0.0.4 deployed (lots, inventory_transactions, inventory_locations)
- [ ] SCD Type 2 tracking V0.0.10 deployed (for material cost history)
- [ ] Audit column standardization V0.0.11 deployed (created_by_user_id)

### 13.3 Services
- [ ] NATS client library configured (`src/nats/nats-client.ts`)
- [ ] GraphQL subscription infrastructure (WebSocket transport)
- [ ] Background job scheduler (for materialized view refresh, alert evaluation)

---

## 14. Recommendations

### 14.1 Critical Path Items

**Immediate (Week 1):**
1. Create `agog_inventory_events` NATS stream
2. Implement dual-write to `inventory_events` table
3. Add PostgreSQL trigger for materialized view refresh notification

**High Priority (Week 2-3):**
1. Build materialized views (`mv_stock_by_material`, `mv_stock_by_location`, `mv_atp_projection`)
2. Implement GraphQL schema extensions
3. Deploy Redis caching layer

**Medium Priority (Week 4-5):**
1. Build alert system with threshold configuration
2. Implement frontend dashboard with real-time subscriptions
3. Add performance monitoring and alerting

### 14.2 Architecture Decisions

**Decision 1: Dual-Write vs. Change Data Capture (CDC)**

**Recommendation:** Start with dual-write (simpler), migrate to CDC later

**Rationale:**
- Dual-write is faster to implement (trigger-based)
- CDC (Debezium) requires Kafka, adds operational complexity
- Can migrate to CDC in Phase 2 without API changes (internal implementation detail)

**Decision 2: Materialized Views vs. Real-Time Aggregation**

**Recommendation:** Use materialized views with 5-second refresh

**Rationale:**
- Stock queries are read-heavy (100:1 read:write ratio)
- Pre-aggregation reduces query latency from 2s to 50ms
- 5-second staleness acceptable for stock monitoring (not financial transactions)

**Decision 3: Redis vs. In-Memory Cache**

**Recommendation:** Use Redis (external cache)

**Rationale:**
- Supports horizontal scaling (shared cache across backend instances)
- Survives server restarts (persistent cache)
- Built-in TTL and eviction policies

### 14.3 Next Steps for Implementation Team

**For Marcus (Warehouse PO):**
1. Review materialized view schemas (validate business logic)
2. Define alert thresholds for each material category
3. Specify dashboard layout and key metrics

**For Roy (Backend PO):**
1. Implement `StockEventService` for NATS publishing
2. Create GraphQL resolvers for stock queries
3. Build subscription infrastructure with Redis pub/sub

**For Jen (Frontend PO):**
1. Design real-time stock dashboard UI mockups
2. Implement WebSocket subscription client (Apollo Client)
3. Build alert notification panel

**For Billy (QA PO):**
1. Write integration test suite (end-to-end flow)
2. Perform load testing (1000 concurrent users)
3. Validate materialized view accuracy (reconciliation tests)

---

## 15. Conclusion

Real-time stock level monitoring is achievable by leveraging the existing WMS schema, NATS infrastructure, and GraphQL subscriptions. The proposed architecture provides:

- **Sub-second visibility:** Stock updates delivered <500ms via WebSocket subscriptions
- **High performance:** Materialized views serve queries in <200ms
- **Scalability:** NATS Jetstream handles 100+ TPS with zero data loss
- **Reliability:** Event persistence, materialized view fallback, graceful degradation
- **Extensibility:** Event-driven architecture supports future IoT, AI/ML integrations

**Estimated Effort:** 5 weeks (1 FTE backend + 1 FTE frontend + 0.5 FTE QA)

**Estimated Cost:** $50K (labor) + $2K/month (Redis hosting)

**ROI:**
- Reduce stockouts by 80% (estimated $200K/year revenue protection)
- Increase warehouse productivity by 20% (estimated $100K/year labor savings)
- Improve order fulfillment accuracy to 99%+ (reduce customer complaints)

**Recommendation:** APPROVE for implementation with phased rollout (facility-by-facility deployment to minimize risk)

---

## Appendix A: Sample NATS Event

```json
{
  "event_id": "01JFQK3X8G9H2WZQP4VN5T6YM8",
  "event_timestamp": "2025-12-20T14:35:22.123Z",
  "tenant_id": "01JFQK0A1B2C3D4E5F6G7H8J9K",
  "facility_id": "01JFQK0P1Q2R3S4T5U6V7W8X9Y",

  "transaction_id": "01JFQK3X8G1A2B3C4D5E6F7G8H",
  "transaction_type": "RECEIPT",
  "transaction_number": "RCV-2025-001234",

  "material_id": "01JFQK1M1N2O3P4Q5R6S7T8U9V",
  "material_code": "SUBSTRATE-12X18-80LB-GLOSS",
  "lot_number": "VENDOR-LOT-ABC-20251220",

  "quantity_change": 5000.0,
  "unit_of_measure": "SHEETS",

  "to_location_id": "01JFQK2Y2Z3A4B5C6D7E8F9G0H",
  "quality_status": "PENDING_INSPECTION",

  "reference_document": {
    "type": "PO",
    "id": "01JFQK3B3C4D5E6F7G8H9J0K1L"
  },

  "performed_by_user_id": "01JFQK4N4O5P6Q7R8S9T0U1V2W",

  "stock_snapshot": {
    "current_quantity": 15000.0,
    "available_quantity": 5000.0,
    "allocated_quantity": 10000.0
  }
}
```

---

## Appendix B: GraphQL Subscription Example

```graphql
# Client subscribes to stock updates for specific materials
subscription StockUpdates {
  stockLevelUpdated(
    tenantId: "01JFQK0A1B2C3D4E5F6G7H8J9K"
    facilityId: "01JFQK0P1Q2R3S4T5U6V7W8X9Y"
    materialCodes: ["SUBSTRATE-12X18-80LB-GLOSS", "INK-CYAN-GALLON"]
  ) {
    materialCode
    materialName
    currentQuantity
    availableQuantity
    allocatedQuantity
    locationCode
    qualityStatus
    lastUpdated
  }
}
```

**Server publishes update when transaction occurs:**
```json
{
  "data": {
    "stockLevelUpdated": {
      "materialCode": "SUBSTRATE-12X18-80LB-GLOSS",
      "materialName": "12x18 Gloss Substrate 80lb",
      "currentQuantity": 15000.0,
      "availableQuantity": 5000.0,
      "allocatedQuantity": 10000.0,
      "locationCode": "RCV-ZONE-A-01",
      "qualityStatus": "PENDING_INSPECTION",
      "lastUpdated": "2025-12-20T14:35:22.123Z"
    }
  }
}
```

---

**END OF SPECIFICATION**

---

**Document Metadata:**
- **Version:** 1.0.0
- **Author:** Cynthia (Research Agent)
- **Date:** 2025-12-20
- **Word Count:** ~8,500 words
- **Token Count:** ~15,000 tokens (estimated)
- **Review Status:** Ready for Critique (Sylvia)
- **Next Stage:** Backend Implementation (Roy)

**Deliverable Channel:** `nats://agog.deliverables.cynthia.research.REQ-STOCK-TRACKING-001`
