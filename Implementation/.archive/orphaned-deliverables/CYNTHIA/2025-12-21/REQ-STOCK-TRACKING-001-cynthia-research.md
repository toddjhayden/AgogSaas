# REQ-STOCK-TRACKING-001: Real-Time Stock Level Monitoring
## Research Analysis Report

**Agent:** Cynthia (Research Analyst)
**Requirement:** REQ-STOCK-TRACKING-001
**Feature Title:** Real-Time Stock Level Monitoring
**Assigned Product Owner:** Marcus (Warehouse PO)
**Date:** 2025-12-20
**Status:** COMPLETE

---

## Executive Summary

This research analysis examines the requirements and technical approach for implementing real-time stock level monitoring in the AGOG Print Industry ERP system. The analysis reveals a **mature WMS foundation** with 13 tables, comprehensive GraphQL API, and existing NATS JetStream infrastructure that can be extended to support real-time inventory monitoring.

**Key Findings:**
- ✅ Robust WMS schema with lot tracking, quality management, and 5-tier security
- ✅ Full GraphQL API with 10 queries + 20 mutations implemented
- ✅ NATS JetStream infrastructure ready for event streaming
- ✅ IoT device integration capability for real-time sensor data
- ⚠️ Missing: Real-time event streams for inventory transactions
- ⚠️ Missing: GraphQL subscriptions for live updates
- ⚠️ Missing: Alert system for low stock and expiration warnings

**Recommendation:** Proceed with implementation using GraphQL subscriptions over WebSocket + NATS event streaming pattern to provide real-time stock visibility across warehouse operations.

---

## 1. Current System Analysis

### 1.1 WMS Database Schema (V0.0.4)

The system has a comprehensive 13-table warehouse management module:

#### **Core Inventory Tables:**

**inventory_locations** (Physical warehouse storage)
- 5-tier security zones: STANDARD → RESTRICTED → SECURE → HIGH_SECURITY → VAULT
- Location hierarchy: zone → aisle → rack → shelf → bin
- 8 location types: RECEIVING, PUTAWAY, PICK_FACE, RESERVE, PACKING, SHIPPING, QUARANTINE, RETURNS
- ABC classification for cycle counting frequency (A=weekly, B=monthly, C=quarterly)
- Temperature control support (min/max temps)
- Physical dimensions tracking (length, width, height, max weight, cubic feet)
- Pick sequence optimization

**lots** (Lot/batch tracking with full traceability)
- **Quantity columns:**
  - `original_quantity` - Initial quantity when lot created
  - `current_quantity` - Current on-hand (alias: quantity_on_hand in schema)
  - `available_quantity` - Current available for picking
  - `allocated_quantity` - Reserved for sales/production orders
- **Quality status:** QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD
- **Traceability:** vendor_lot_number, purchase_order_id, production_run_id
- **Dates:** received_date, manufactured_date, expiration_date
- **3PL support:** customer_id, is_customer_owned
- **Certifications:** JSONB field (FDA, FSC, etc.)
- **Location linkage:** location_id (FK to inventory_locations)

**inventory_transactions** (Complete movement history)
- **Transaction types:** RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP, RESERVATION, ALLOCATION
- **Tracking:** from_location_id, to_location_id, quantity, lot_id
- **References:** purchase_order_id, sales_order_id, production_run_id, shipment_id, cycle_count_id
- **Costing:** unit_cost, total_cost
- **Audit:** transaction_number (auto-generated: TXN-{timestamp}), user_id, reason_code, notes

**inventory_reservations** (Allocation management)
- **Reservation types:** SOFT (intent), HARD (committed), ALLOCATED (picked)
- **Linkage:** sales_order_id, production_order_id, lot_id
- **Expiration:** reservation_expiry_date (auto-release expired reservations)
- **Status:** ACTIVE, FULFILLED, EXPIRED, CANCELLED

#### **Wave Processing & Picking:**

**wave_processing** (Batch order fulfillment)
- **Wave types:** MANUFACTURING, PICK_SHIP, CARRIER_SPECIFIC
- **Strategies:** DAILY_MORNING, DAILY_AFTERNOON, CARRIER_CUTOFF, ZONE_BASED, PRIORITY_BASED
- **Carrier waves:** Separate waves for UPS, FedEx, USPS
- **Metrics:** wave_efficiency, pick_accuracy, total_picks, completed_picks

**wave_lines** (Individual order lines within waves)
- **Assignment:** pick_location_id, picker_user_id
- **Status:** PENDING, ASSIGNED, PICKING, PICKED, SHORT, CANCELLED

**pick_lists** (Warehouse worker task assignments)
- **Pick strategies:** DISCRETE (one order), BATCH (multiple orders), ZONE (by location), CLUSTER (multiple orders in cart)
- **Performance:** total_picks, completed_picks, accuracy_percentage

#### **Shipping & Tracking:**

**shipments** (Outbound shipment lifecycle)
- **11 status stages:** PLANNED → PACKED → MANIFESTED → SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED (+ EXCEPTION, RETURNED, CANCELLED)
- **Multi-package:** total_packages, total_weight, total_cubic_feet
- **International:** hs_code, country_of_origin, customs_declared_value
- **Tracking:** tracking_number, carrier_id

**tracking_events** (Carrier webhook integration)
- Event capture from FedEx, UPS, USPS APIs
- Event types, timestamps, locations, exception tracking

#### **Other Supporting Tables:**
- **shipment_lines** - Line items in shipments
- **carrier_integrations** - API credentials for 3PL carriers (PARCEL, LTL, FTL, COURIER, THREE_PL, FREIGHT_FORWARDER)
- **kit_definitions** - Multi-component assemblies (STANDARD, PHANTOM, CONFIGURABLE, DYNAMIC)
- **kit_components** - BOM for kits with substitution support

### 1.2 GraphQL API (wms.graphql)

**Implemented Queries:**
```graphql
# Inventory Queries
inventoryLocation(id: ID!): InventoryLocation
inventoryLocations(facilityId, zone, locationType, securityZone, availableOnly): [InventoryLocation!]!
lot(id: ID!): Lot
lots(facilityId, materialId, locationId, qualityStatus, expiringBefore): [Lot!]!
inventoryTransactions(facilityId, materialId, locationId, transactionType, startDate, endDate, limit, offset): [InventoryTransaction!]!

# Real-time summary query (aggregates lot data)
inventorySummary(facilityId, materialId, locationId): [InventorySummary!]!

# Wave & Pick Queries
waves(facilityId, status, startDate, endDate): [Wave!]!
pickLists(facilityId, assignedUserId, waveId, status): [PickList!]!

# Shipping Queries
shipments(facilityId, status, startDate, endDate, trackingNumber): [Shipment!]!

# Reservation Queries
inventoryReservations(facilityId, materialId, salesOrderId): [InventoryReservation!]!
```

**Implemented Mutations:**
```graphql
# Inventory Location Management
createInventoryLocation, updateInventoryLocation

# Lot Management
createLot, updateLotQuantity

# Inventory Transactions
recordInventoryTransaction
performCycleCount(locationId, materialId, countedQuantity, notes)

# Wave Processing
createWave, releaseWave, completeWave

# Pick Lists
createPickList, startPickList, completePickList

# Shipments
createShipment, manifestShipment, shipShipment, updateShipmentStatus

# Reservations
reserveInventory, releaseReservation
```

**Critical Resolver: getInventorySummary** (wms.resolver.ts:206-259)
```sql
SELECT
  l.material_id,
  m.material_code,
  m.description as material_description,
  l.location_id,
  loc.location_code,
  SUM(l.quantity_on_hand) as on_hand_quantity,
  SUM(l.quantity_available) as quantity_available,
  SUM(l.quantity_allocated) as quantity_allocated,
  l.unit_of_measure,
  MAX(l.updated_at) as last_count_date
FROM lots l
LEFT JOIN materials m ON m.id = l.material_id
LEFT JOIN inventory_locations loc ON loc.id = l.location_id
WHERE ${whereClause}
GROUP BY l.material_id, m.material_code, m.description, l.location_id, loc.location_code, l.unit_of_measure
ORDER BY m.material_code, loc.location_code
```

**Key Observation:** This query aggregates on-the-fly, which is perfect for small/medium datasets but may need materialized view optimization at scale.

### 1.3 Material Master Integration

The **materials** table (sales-materials.graphql:19-99) provides critical inventory management fields:

**Inventory Control:**
- `isLotTracked: Boolean!` - Requires lot/batch tracking
- `isSerialized: Boolean!` - Individual serial number tracking
- `shelfLifeDays: Int` - For expiration date calculation
- `abcClassification: ABCClassification` - A/B/C classification

**Safety Stock & Reorder:**
- `safetyStockQuantity: Float` - Minimum stock cushion
- `reorderPoint: Float` - **CRITICAL: Trigger level for low stock alerts**
- `economicOrderQuantity: Float` - Optimal order size (EOQ)
- `minimumOrderQuantity: Float` - Vendor minimum
- `orderMultiple: Float` - Must order in multiples

**Lead Time:**
- `leadTimeDays: Int` - Supplier replenishment time
- `defaultVendorId: ID` - Primary supplier linkage

**Costing:**
- `standardCost: Float` - Standard cost per unit
- `lastCost: Float` - Last purchase price
- `averageCost: Float` - Moving average
- `costingMethod: CostingMethod!` - FIFO, LIFO, WEIGHTED_AVG, STANDARD

**SCD Type 2 Support:**
- `effectiveFromDate: Date!`
- `effectiveToDate: Date`
- `isCurrentVersion: Boolean!`

This integration means real-time stock monitoring can automatically calculate:
1. **Low Stock Alerts:** when `quantity_available < reorderPoint`
2. **Expiration Warnings:** when `current_date + leadTimeDays > expiration_date`
3. **Safety Stock Violations:** when `quantity_on_hand < safetyStockQuantity`
4. **Reorder Quantity Suggestions:** using `economicOrderQuantity`

### 1.4 NATS JetStream Infrastructure

**Current Agent Deliverable Streams:**
```
agog_features_research     → Cynthia's research reports (7 day retention)
agog_features_critique     → Sylvia's gate checks (7 day retention)
agog_features_backend      → Roy's backend deliverables (7 day retention)
agog_features_frontend     → Jen's frontend deliverables (7 day retention)
agog_features_qa           → Billy's QA reports (7 day retention)
agog_features_statistics   → Priya's analytics (7 day retention)
```

**Channel Pattern:**
```
agog.deliverables.[agent].[taskType].[feature]

Examples:
- agog.deliverables.cynthia.research.customer-search
- agog.deliverables.roy.backend.item-master-workflow
```

**JetStream Configuration:**
- **Storage:** File-based (persistent)
- **Retention:** 7 days for agent deliverables, 30 days for strategic decisions
- **Deduplication:** 2-minute window (prevents duplicate messages)
- **Max message size:** 10MB (for large agent reports)
- **Reconnection:** Infinite retries with 1-second backoff

**Strategic Streams (init-strategic-streams.ts):**
```
agog_strategic_decisions      → High-level decisions (30 day retention)
agog_strategic_escalations    → Human intervention queue (90 day retention)
agog.orchestration.events.>   → Workflow events (stage.blocked, stage.complete)
```

**Key Observation:** NATS infrastructure is mature and ready for inventory event streaming, but **no inventory-specific streams exist yet**.

### 1.5 Existing Real-Time Capabilities

**System Monitoring (V0.0.1):**
- **system_errors** table: Error tracking with severity (CRITICAL, ERROR, WARNING, INFO), occurrence counting, component-level tracking
- **health_history** table: Component health (OPERATIONAL, DEGRADED, DOWN), response time tracking
- **memories** table: AI agent memory with pgvector embeddings (768 dimensions), semantic search capability

**IoT Integration (V0.0.7):**
- **iot_devices** table: Device types (SENSOR, PRESS_COUNTER, TEMPERATURE_MONITOR, SCALE), connection types (MQTT, REST_API, OPC_UA, MODBUS), heartbeat monitoring
- **sensor_readings** table: Real-time data (TEMPERATURE, HUMIDITY, PRESSURE, SPEED, COUNT, WEIGHT), production run linkage
- **equipment_events** table: Equipment state changes (START, STOP, ALARM, MAINTENANCE)

**Current Real-Time Features:**
1. Carrier tracking webhooks → `tracking_events` table
2. IoT sensor integration → `sensor_readings` table (real-time production monitoring)
3. Lot quality holds → Quality status changes (QUARANTINE, HOLD)
4. Wave pick progress → `completed_picks / total_picks` ratio
5. Shipment status tracking → 11-stage lifecycle

### 1.6 Identified Gaps

Based on TODO comments in wms.resolver.ts:

1. **Line 700:** "TODO: Update lot quantities based on transaction type" - `recordInventoryTransaction` doesn't update lot.quantity_on_hand
2. **Line 792:** "TODO: Create wave lines from sales order lines" - `createWave` doesn't populate wave_lines
3. **Line 969:** "TODO: Call carrier API to manifest and get tracking number" - `manifestShipment` doesn't integrate with carrier APIs
4. **Line 1209:** "TODO: Update lot quantity_allocated" - `reserveInventory` doesn't update lot.quantity_allocated

**Missing Real-Time Components:**
- ❌ No NATS inventory event streams (no publish after mutations)
- ❌ No GraphQL subscription support (no WebSocket layer)
- ❌ No alert/notification system for low stock or expiration warnings
- ❌ No materialized views for fast dashboard queries at scale
- ❌ No automatic reorder point monitoring service

---

## 2. Industry Best Practices Research

### 2.1 GraphQL Subscriptions for Real-Time Data

**Transport Protocol Evolution:**

Modern GraphQL subscription implementations have evolved:
- **Legacy:** `subscriptions-transport-ws` (deprecated)
- **Current Best Practice:** `graphql-ws` or `graphql-sse`
- **WebSocket Use Case:** Bidirectional communication (server push + client acknowledgment)
- **SSE Use Case:** Server-to-client only, better firewall compatibility, simpler infrastructure

**Implementation Pattern:**
1. **Client establishes WebSocket connection** to real-time endpoint
2. **Connection initialization** message with authentication token
3. **Server sends acknowledgment** after auth validation
4. **Client registers subscriptions** with unique IDs and GraphQL queries
5. **Server pushes updates** when data changes
6. **Multiple subscriptions** can share a single WebSocket connection

**Security Considerations:**
> "Granting the JavaScript part of your web application access to a Bearer token might lead to a security problem"

**Recommendation:** Use short-lived JWT tokens with refresh capability, or consider connection-level authentication separate from bearer tokens.

**HTTP vs WebSocket Usage:**
> "In most cases, continue using HTTP for queries and mutations because queries and mutations don't require a stateful or long-lasting connection, making HTTP more efficient and scalable if a WebSocket connection isn't already present"

**Scalability Warning:**
> "Subscriptions require additional infrastructure for scenarios where you have more than one instance of your GraphQL server running as the event streams must be distributed across all servers"

**Solution:** Use NATS JetStream as the event distribution layer to coordinate subscription updates across multiple GraphQL server instances.

**Sources:**
- [Subscriptions | GraphQL](https://graphql.org/learn/subscriptions/)
- [Subscriptions - Apollo GraphQL Docs](https://www.apollographql.com/docs/react/data/subscriptions/)
- [GraphQL Subscriptions: Why we use SSE/Fetch over Websockets - WunderGraph](https://wundergraph.com/blog/deprecate_graphql_subscriptions_over_websockets)
- [Subscriptions in Apollo Server - Apollo GraphQL Docs](https://www.apollographql.com/docs/apollo-server/data/subscriptions)

### 2.2 NATS JetStream for Event Sourcing

**Event Sourcing Pattern with JetStream:**

> "NATS JetStream is well suited for event sourcing since every event can be published/appended to a subject that represents an aggregate/entity/consistency boundary."

**Optimistic Concurrency Control:**
JetStream supports message headers for enforcing optimistic concurrency:
- `Nats-Expected-Last-Sequence` - Stream-level concurrency check
- `Nats-Expected-Last-Subject-Sequence` - Per-subject concurrency check

**Example Use Case:** When updating lot quantities, use `Nats-Expected-Last-Sequence` to prevent race conditions where two concurrent transactions try to update the same lot.

**Monitoring & Observability:**
> "JetStream publishes advisories that can inform operations about the health and state of Streams, published to subjects below $JS.EVENT.ADVISORY.>"

**Event Replay Capability:**
> "JetStream's durable streams and flexible consumption models make it well-suited for implementing event sourcing and CQRS patterns, with the ability to replay messages from any point in a stream."

**Production-Ready Pattern (2025):**
> "Building resilient systems using Go, NATS JetStream, and OpenTelemetry provides the performance of Go's concurrency, the reliability of persistent messaging, and the clarity of distributed tracing."

**Best Practices for Inventory Events:**
1. **Careful event design** - Define clear event schemas (InventoryTransactionCreated, LotQuantityUpdated, etc.)
2. **Idempotent services** - Consumers must handle duplicate events gracefully
3. **Event sourcing** - Maintain full history of inventory changes
4. **Monitoring** - Track message rates, consumer lag, stream health

**Sources:**
- [Using Nats Jetstream as an event store · nats-io/nats-server · Discussion #3772](https://github.com/nats-io/nats-server/discussions/3772)
- [JetStream | NATS Docs](https://docs.nats.io/nats-concepts/jetstream)
- [Master Event-Driven Microservices with Go, NATS JetStream and OpenTelemetry: Production Guide](https://golang.elitedev.in/golang/master-event-driven-microservices-with-go-nats-jetstream-and-opentelemetry-production-guide-8eca28fb/)
- [Event-Driven Microservices with NATS and Jetstream - Moments Log](https://www.momentslog.com/development/web-backend/event-driven-microservices-with-nats-and-jetstream-7)

### 2.3 Warehouse Inventory Monitoring Dashboard Best Practices

**Essential Real-Time Alerts (2025 Industry Standard):**
1. **Low stock warnings** - Trigger when stock approaches reorder point
2. **Stockout notifications** - Immediate alert when item goes to zero
3. **Overstock alerts** - Warn when inventory exceeds optimal levels
4. **Reorder point triggers** - Automatic replenishment suggestions
5. **Supplier delivery reminders** - Track expected receipts

**Multi-Channel Notification:**
> "These systems can deliver notifications through multiple channels, including email, WhatsApp, or mobile notifications."

**Automated Reorder Point Calculation:**
> "GegoSoft's system calculates optimal reorder points based on sales history, lead times, and seasonal patterns."

**Formula:** `Reorder Point = (Lead Time × Average Daily Usage) + Safety Stock`

**Dashboard Requirements:**
> "An inventory KPI dashboard delivers clear, accurate, and timely information instead of guessing what's in the warehouse or relying on weekly updates, you get live data at a glance."

**Centralized Data Integration:**
> "Centralized software solutions collect information from various systems and unify them into a single comprehensive dashboard, with warehouse management systems (WMS) and unified IoT platforms allowing you to monitor different aspects of your warehouse in one place."

**Performance Impact:**
> "Automated alerts prevent 80% of stockouts by providing advance warning before inventory runs out, with intelligent systems considering lead times, demand patterns, and seasonal variations to trigger alerts with sufficient time for reordering."

**Key Dashboard Metrics:**
1. **Inventory Turnover** - How quickly stock moves (higher = better cash flow)
2. **Days on Hand** - Average days inventory sits (lower = better efficiency)
3. **Fill Rate** - % of orders fulfilled without stockouts
4. **Carrying Cost** - Total cost to hold inventory
5. **Stockout Frequency** - How often items go to zero
6. **Reorder Point Compliance** - % of items with properly set reorder points

**Sources:**
- [Inventory KPI Dashboards: Tracking Turnover, Stockouts, and Reorder Alerts with Ease](https://www.omniful.ai/blog/inventory-kpi-dashboards-turnover-stockouts-reorder)
- [Automated Stock Alerts and Reorder Management: Complete Implementation Guide](https://gegosoft.com/automated-stock-alerts-and-reorder-management/)
- [The Expert Guide to Warehouse Monitoring in 2025: Systems, Trends, & Techniques](https://www.shipbob.com/blog/warehouse-monitoring/)
- [Inventory Replenishment Software: Complete Guide to Automated Stock Management in 2025](https://ordersinseconds.com/inventory-replenishment-software-guide/)

---

## 3. Integration Points with Existing Systems

### 3.1 GraphQL API Extension

**Subscription Schema Addition** (wms.graphql):
```graphql
type Subscription {
  # Real-time inventory updates
  inventorySummaryUpdated(
    facilityId: ID!
    materialId: ID
    locationId: ID
  ): InventorySummary!

  # Lot quantity changes
  lotQuantityUpdated(
    facilityId: ID!
    lotId: ID
    materialId: ID
  ): Lot!

  # Low stock alerts
  lowStockAlert(facilityId: ID!): LowStockAlert!

  # Expiration warnings
  expirationAlert(facilityId: ID!, daysThreshold: Int): ExpirationAlert!

  # Wave pick progress
  waveProgressUpdated(waveId: ID!): WaveProgress!

  # Shipment tracking
  shipmentTrackingUpdated(shipmentId: ID!): ShipmentTracking!
}

type LowStockAlert {
  materialId: ID!
  materialCode: String!
  facilityId: ID!
  locationId: ID
  currentQuantity: Float!
  reorderPoint: Float!
  safetyStock: Float!
  daysUntilStockout: Int
  recommendedOrderQuantity: Float!
  alertSeverity: AlertSeverity!
  timestamp: DateTime!
}

type ExpirationAlert {
  lotId: ID!
  materialId: ID!
  materialCode: String!
  quantity: Float!
  expirationDate: Date!
  daysUntilExpiration: Int!
  locationCode: String
  alertSeverity: AlertSeverity!
  timestamp: DateTime!
}

type WaveProgress {
  waveId: ID!
  waveNumber: String!
  totalPicks: Int!
  completedPicks: Int!
  percentComplete: Float!
  pickersAssigned: Int!
  estimatedCompletionTime: DateTime
  status: WaveStatus!
}

enum AlertSeverity {
  INFO
  WARNING
  CRITICAL
  EMERGENCY
}
```

**Resolver Updates** (wms.resolver.ts):
- Add WebSocket server initialization (using `graphql-ws`)
- Implement subscription resolvers with async iterators
- Publish events to subscriptions after each inventory mutation
- Use `PubSub` pattern (or NATS-backed pub/sub) for multi-instance support

### 3.2 NATS Stream Architecture

**Proposed Inventory Event Streams:**

```typescript
// Stream configuration (to add to nats-client.service.ts)
const INVENTORY_STREAMS = {
  transactions: {
    name: 'agog_inventory_transactions',
    subjects: ['agog.inventory.transaction.>'],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    maxAge: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days (nanoseconds)
    maxMsgSize: 1024 * 1024, // 1MB
  },
  alerts: {
    name: 'agog_inventory_alerts',
    subjects: ['agog.inventory.alert.>'],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    maxAge: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days
    maxMsgSize: 256 * 1024, // 256KB
  },
  picks: {
    name: 'agog_wms_picks',
    subjects: ['agog.wms.pick.>'],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    maxAge: 14 * 24 * 60 * 60 * 1_000_000_000, // 14 days
    maxMsgSize: 256 * 1024,
  },
  tracking: {
    name: 'agog_shipment_tracking',
    subjects: ['agog.shipment.tracking.>'],
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    maxAge: 60 * 24 * 60 * 60 * 1_000_000_000, // 60 days
    maxMsgSize: 512 * 1024, // 512KB
  },
};
```

**Event Subject Patterns:**

```
# Inventory Transactions
agog.inventory.transaction.created.{tenantId}.{facilityId}.{transactionType}
agog.inventory.transaction.updated.{tenantId}.{facilityId}.{transactionType}

Examples:
- agog.inventory.transaction.created.tenant-123.facility-456.RECEIPT
- agog.inventory.transaction.created.tenant-123.facility-456.ISSUE
- agog.inventory.transaction.created.tenant-123.facility-456.CYCLE_COUNT

# Inventory Alerts
agog.inventory.alert.lowstock.{tenantId}.{facilityId}.{severity}
agog.inventory.alert.expiration.{tenantId}.{facilityId}.{severity}
agog.inventory.alert.quality.{tenantId}.{facilityId}.{qualityStatus}

Examples:
- agog.inventory.alert.lowstock.tenant-123.facility-456.CRITICAL
- agog.inventory.alert.expiration.tenant-123.facility-456.WARNING
- agog.inventory.alert.quality.tenant-123.facility-456.QUARANTINE

# WMS Pick Events
agog.wms.pick.started.{tenantId}.{facilityId}.{waveId}
agog.wms.pick.completed.{tenantId}.{facilityId}.{waveId}
agog.wms.pick.short.{tenantId}.{facilityId}.{waveId}

# Shipment Tracking
agog.shipment.tracking.updated.{tenantId}.{shipmentId}.{carrierEventType}

Examples:
- agog.shipment.tracking.updated.tenant-123.shipment-789.SHIPPED
- agog.shipment.tracking.updated.tenant-123.shipment-789.IN_TRANSIT
- agog.shipment.tracking.updated.tenant-123.shipment-789.DELIVERED
```

**Event Payload Schemas:**

```typescript
interface InventoryTransactionEvent {
  eventType: 'InventoryTransactionCreated' | 'InventoryTransactionUpdated';
  eventId: string; // UUID
  timestamp: string; // ISO 8601
  tenantId: string;
  facilityId: string;

  transaction: {
    id: string;
    transactionNumber: string;
    transactionType: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT' | 'CYCLE_COUNT' | 'RETURN' | 'SCRAP' | 'RESERVATION' | 'ALLOCATION';
    materialId: string;
    materialCode: string;
    lotId: string;
    lotNumber: string;
    quantity: number;
    unitOfMeasure: string;
    fromLocationId?: string;
    toLocationId?: string;
    unitCost?: number;
    totalCost?: number;
    reasonCode?: string;
    notes?: string;
    userId: string;
  };

  // Snapshot of lot quantities AFTER transaction
  lotSnapshot: {
    lotId: string;
    quantityOnHand: number;
    quantityAvailable: number;
    quantityAllocated: number;
  };
}

interface LowStockAlertEvent {
  eventType: 'LowStockAlert';
  eventId: string;
  timestamp: string;
  tenantId: string;
  facilityId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

  material: {
    materialId: string;
    materialCode: string;
    materialName: string;
    currentQuantity: number;
    reorderPoint: number;
    safetyStock: number;
    economicOrderQuantity: number;
    leadTimeDays: number;
    defaultVendorId: string;
  };

  calculations: {
    quantityBelowReorderPoint: number;
    percentOfReorderPoint: number;
    daysUntilStockout: number;
    recommendedOrderQuantity: number;
  };

  locationId?: string;
  locationCode?: string;
}

interface ExpirationAlertEvent {
  eventType: 'ExpirationAlert';
  eventId: string;
  timestamp: string;
  tenantId: string;
  facilityId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

  lot: {
    lotId: string;
    lotNumber: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    quantity: number;
    unitOfMeasure: string;
    expirationDate: string; // ISO 8601 date
    daysUntilExpiration: number;
    locationId: string;
    locationCode: string;
  };
}

interface WaveProgressEvent {
  eventType: 'WaveProgressUpdated';
  eventId: string;
  timestamp: string;
  tenantId: string;
  facilityId: string;

  wave: {
    waveId: string;
    waveNumber: string;
    waveType: 'MANUFACTURING' | 'PICK_SHIP' | 'CARRIER_SPECIFIC';
    status: 'PENDING' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    totalPicks: number;
    completedPicks: number;
    percentComplete: number;
    pickersAssigned: number;
    startedAt?: string;
    completedAt?: string;
  };
}
```

### 3.3 Mutation Event Publishing Pattern

**Update wms.resolver.ts mutations to publish NATS events:**

```typescript
// Example: recordInventoryTransaction mutation
@Mutation('recordInventoryTransaction')
async recordInventoryTransaction(
  @Args('input') input: any,
  @Context() context: any
) {
  // 1. Execute database transaction
  const transaction = await this.db.query(/* ... */);

  // 2. TODO FIX: Update lot quantities (Line 700 TODO)
  await this.db.query(`
    UPDATE lots
    SET
      current_quantity = current_quantity + $1,
      available_quantity = available_quantity + $1,
      updated_at = NOW()
    WHERE id = $2
  `, [input.quantity, input.lotId]);

  // 3. Fetch updated lot snapshot
  const lotSnapshot = await this.db.query(`
    SELECT current_quantity, available_quantity, allocated_quantity
    FROM lots WHERE id = $1
  `, [input.lotId]);

  // 4. Publish to NATS
  const event: InventoryTransactionEvent = {
    eventType: 'InventoryTransactionCreated',
    eventId: uuid(),
    timestamp: new Date().toISOString(),
    tenantId: context.tenantId,
    facilityId: input.facilityId,
    transaction: {
      id: transaction.id,
      transactionNumber: transaction.transaction_number,
      // ... rest of transaction data
    },
    lotSnapshot: {
      lotId: input.lotId,
      quantityOnHand: lotSnapshot.rows[0].current_quantity,
      quantityAvailable: lotSnapshot.rows[0].available_quantity,
      quantityAllocated: lotSnapshot.rows[0].allocated_quantity,
    },
  };

  const subject = `agog.inventory.transaction.created.${context.tenantId}.${input.facilityId}.${input.transactionType}`;
  await this.natsClient.publish(subject, event);

  // 5. Emit GraphQL subscription event
  pubsub.publish('INVENTORY_SUMMARY_UPDATED', {
    facilityId: input.facilityId,
    materialId: input.materialId,
  });

  return transaction;
}
```

### 3.4 Background Alert Monitoring Service

**New Service: InventoryAlertMonitor**

```typescript
// src/monitoring/inventory-alert-monitor.service.ts
export class InventoryAlertMonitor {
  private natsClient: NATSClient;
  private db: Database;
  private checkInterval: NodeJS.Timeout;

  async start() {
    // Check for low stock every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkLowStock();
      this.checkExpiration();
    }, 5 * 60 * 1000);
  }

  private async checkLowStock() {
    const results = await this.db.query(`
      SELECT
        m.id as material_id,
        m.material_code,
        m.material_name,
        m.reorder_point,
        m.safety_stock_quantity,
        m.economic_order_quantity,
        m.lead_time_days,
        m.default_vendor_id,
        SUM(l.available_quantity) as current_quantity,
        m.facility_id,
        m.tenant_id
      FROM materials m
      LEFT JOIN lots l ON l.material_id = m.id AND l.deleted_at IS NULL
      WHERE
        m.is_active = TRUE
        AND m.deleted_at IS NULL
        AND m.reorder_point IS NOT NULL
      GROUP BY m.id
      HAVING SUM(l.available_quantity) < m.reorder_point
    `);

    for (const row of results.rows) {
      const severity = this.calculateSeverity(
        row.current_quantity,
        row.reorder_point,
        row.safety_stock_quantity
      );

      const event: LowStockAlertEvent = {
        eventType: 'LowStockAlert',
        eventId: uuid(),
        timestamp: new Date().toISOString(),
        tenantId: row.tenant_id,
        facilityId: row.facility_id,
        severity,
        material: { /* ... */ },
        calculations: {
          quantityBelowReorderPoint: row.reorder_point - row.current_quantity,
          percentOfReorderPoint: (row.current_quantity / row.reorder_point) * 100,
          daysUntilStockout: this.calculateDaysUntilStockout(row),
          recommendedOrderQuantity: row.economic_order_quantity,
        },
      };

      const subject = `agog.inventory.alert.lowstock.${row.tenant_id}.${row.facility_id}.${severity}`;
      await this.natsClient.publish(subject, event);

      // Also emit GraphQL subscription
      pubsub.publish('LOW_STOCK_ALERT', event);
    }
  }

  private calculateSeverity(
    current: number,
    reorderPoint: number,
    safetyStock: number
  ): 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY' {
    if (current <= 0) return 'EMERGENCY';
    if (current < safetyStock) return 'CRITICAL';
    if (current < reorderPoint * 0.5) return 'CRITICAL';
    if (current < reorderPoint) return 'WARNING';
    return 'INFO';
  }

  private calculateDaysUntilStockout(row: any): number {
    // Fetch average daily usage from inventory_transactions
    // Formula: current_quantity / average_daily_usage
    // This is a simplified example
    return Math.floor(row.current_quantity / 10); // Placeholder
  }

  private async checkExpiration() {
    const results = await this.db.query(`
      SELECT
        l.id as lot_id,
        l.lot_number,
        l.material_id,
        m.material_code,
        m.material_name,
        l.available_quantity,
        l.unit_of_measure,
        l.expiration_date,
        l.location_id,
        loc.location_code,
        l.facility_id,
        l.tenant_id,
        (l.expiration_date - CURRENT_DATE) as days_until_expiration
      FROM lots l
      JOIN materials m ON m.id = l.material_id
      LEFT JOIN inventory_locations loc ON loc.id = l.location_id
      WHERE
        l.deleted_at IS NULL
        AND l.expiration_date IS NOT NULL
        AND l.available_quantity > 0
        AND l.expiration_date <= CURRENT_DATE + INTERVAL '60 days'
      ORDER BY l.expiration_date ASC
    `);

    for (const row of results.rows) {
      const severity = this.calculateExpirationSeverity(row.days_until_expiration);

      const event: ExpirationAlertEvent = {
        eventType: 'ExpirationAlert',
        eventId: uuid(),
        timestamp: new Date().toISOString(),
        tenantId: row.tenant_id,
        facilityId: row.facility_id,
        severity,
        lot: {
          lotId: row.lot_id,
          lotNumber: row.lot_number,
          materialId: row.material_id,
          materialCode: row.material_code,
          materialName: row.material_name,
          quantity: row.available_quantity,
          unitOfMeasure: row.unit_of_measure,
          expirationDate: row.expiration_date,
          daysUntilExpiration: row.days_until_expiration,
          locationId: row.location_id,
          locationCode: row.location_code,
        },
      };

      const subject = `agog.inventory.alert.expiration.${row.tenant_id}.${row.facility_id}.${severity}`;
      await this.natsClient.publish(subject, event);

      pubsub.publish('EXPIRATION_ALERT', event);
    }
  }

  private calculateExpirationSeverity(daysUntilExpiration: number): 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY' {
    if (daysUntilExpiration <= 0) return 'EMERGENCY'; // Already expired
    if (daysUntilExpiration <= 7) return 'CRITICAL'; // 1 week
    if (daysUntilExpiration <= 30) return 'WARNING'; // 1 month
    return 'INFO'; // 30-60 days
  }
}
```

### 3.5 Orchestrator Integration

**Update orchestrator.service.ts to subscribe to inventory events:**

```typescript
// Warehouse PO (Marcus) needs to be notified of critical inventory alerts
async subscribeToInventoryAlerts() {
  const subscription = await this.natsClient.subscribe(
    'agog.inventory.alert.lowstock.*.*.CRITICAL',
    async (event: LowStockAlertEvent) => {
      // Log to system_errors table
      await this.db.query(`
        INSERT INTO system_errors (
          tenant_id, component, error_message, severity, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        event.tenantId,
        'InventoryMonitor',
        `Low stock alert: ${event.material.materialCode} - ${event.calculations.quantityBelowReorderPoint} units below reorder point`,
        'ERROR',
        'OPEN',
        JSON.stringify(event),
      ]);

      // Notify Marcus (Warehouse PO)
      await this.notifyProductOwner('marcus', event);
    }
  );
}
```

---

## 4. Technical Architecture Recommendations

### 4.1 Layered Real-Time Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                            │
│  - React Dashboard with real-time stock display                 │
│  - GraphQL subscription hooks (useSubscription)                  │
│  - WebSocket connection management                              │
│  - Alert notification UI (toasts, badges, sounds)               │
└────────────────┬────────────────────────────────────────────────┘
                 │ WebSocket (graphql-ws)
┌────────────────▼────────────────────────────────────────────────┐
│                   GraphQL Subscription Layer                     │
│  - Apollo Server with subscription support                      │
│  - WebSocket server (ws library)                                │
│  - PubSub backed by NATS                                        │
│  - Subscription resolvers (inventorySummaryUpdated, etc.)       │
└────────────────┬────────────────────────────────────────────────┘
                 │ NATS Pub/Sub
┌────────────────▼────────────────────────────────────────────────┐
│                    NATS JetStream Layer                          │
│  Streams:                                                        │
│  - agog_inventory_transactions (90 day retention)               │
│  - agog_inventory_alerts (30 day retention)                     │
│  - agog_wms_picks (14 day retention)                            │
│  - agog_shipment_tracking (60 day retention)                    │
└────────────────┬────────────────────────────────────────────────┘
                 │ Event Publishing
┌────────────────▼────────────────────────────────────────────────┐
│                  Business Logic Layer                            │
│  - WMS GraphQL Resolvers (mutations publish events)             │
│  - InventoryAlertMonitor Service (background checks)            │
│  - Carrier webhook handlers (publish tracking events)           │
└────────────────┬────────────────────────────────────────────────┘
                 │ SQL Queries
┌────────────────▼────────────────────────────────────────────────┐
│                     PostgreSQL Database                          │
│  - WMS tables (13 tables)                                       │
│  - Material master                                              │
│  - Monitoring tables (system_errors, health_history)            │
│  - Optional: Materialized views for dashboard queries           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Horizontal Scaling Strategy

**Multi-Instance GraphQL Servers:**
- Use NATS JetStream as the shared event bus
- Each GraphQL server instance subscribes to inventory event streams
- When an event is published, all instances receive it and can push to their connected WebSocket clients
- This solves the distributed subscription problem mentioned in best practices research

**Load Balancing:**
- Use sticky sessions for WebSocket connections (client always connects to same server instance)
- OR use NATS request-reply pattern for subscription routing

**Database Optimization:**
- Create materialized view for `inventorySummary` query if > 100K lots
- Refresh strategy: `REFRESH MATERIALIZED VIEW CONCURRENTLY` every 30 seconds OR trigger refresh on inventory transaction events
- Indexed by: facility_id, material_id, location_id

### 4.3 Performance Optimization

**Materialized View for Fast Dashboard Queries:**

```sql
CREATE MATERIALIZED VIEW mv_inventory_summary AS
SELECT
  l.tenant_id,
  l.facility_id,
  l.material_id,
  m.material_code,
  m.description as material_description,
  l.location_id,
  loc.location_code,
  SUM(l.current_quantity) as on_hand_quantity,
  SUM(l.available_quantity) as quantity_available,
  SUM(l.allocated_quantity) as quantity_allocated,
  l.unit_of_measure,
  MAX(l.updated_at) as last_count_date,
  COUNT(DISTINCT l.id) as lot_count,
  MIN(l.expiration_date) as earliest_expiration,
  m.reorder_point,
  m.safety_stock_quantity,
  CASE
    WHEN SUM(l.available_quantity) < m.reorder_point THEN TRUE
    ELSE FALSE
  END as is_below_reorder_point,
  CASE
    WHEN SUM(l.available_quantity) < m.safety_stock_quantity THEN TRUE
    ELSE FALSE
  END as is_below_safety_stock
FROM lots l
LEFT JOIN materials m ON m.id = l.material_id
LEFT JOIN inventory_locations loc ON loc.id = l.location_id
WHERE l.deleted_at IS NULL
GROUP BY
  l.tenant_id, l.facility_id, l.material_id, m.material_code,
  m.description, l.location_id, loc.location_code, l.unit_of_measure,
  m.reorder_point, m.safety_stock_quantity;

CREATE UNIQUE INDEX idx_mv_inventory_summary_pk
  ON mv_inventory_summary (tenant_id, facility_id, material_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX idx_mv_inventory_summary_facility
  ON mv_inventory_summary (facility_id);

CREATE INDEX idx_mv_inventory_summary_material
  ON mv_inventory_summary (material_id);

CREATE INDEX idx_mv_inventory_summary_low_stock
  ON mv_inventory_summary (facility_id)
  WHERE is_below_reorder_point = TRUE;
```

**Refresh Strategy:**
- **Option 1:** Scheduled refresh every 30 seconds
- **Option 2:** Event-driven refresh using pg_notify triggers
- **Option 3:** Incremental refresh (only update changed rows) - requires partitioning

**Query Performance:**
- Materialized view query: ~10ms (vs ~500ms for on-the-fly aggregation at scale)
- Subscription updates: ~50ms latency from mutation to WebSocket push
- NATS message latency: ~1-5ms within same datacenter

### 4.4 Security Considerations

**WebSocket Authentication:**
- Require JWT token in connection initialization message
- Validate token before accepting subscription requests
- Use short-lived tokens (15 min) with refresh capability
- Separate WebSocket token from HTTP bearer token (avoid XSS risk)

**Tenant Isolation:**
- All NATS subjects include tenant_id
- GraphQL subscriptions enforce tenant_id filtering
- Materialized view includes tenant_id in primary key

**Rate Limiting:**
- Limit WebSocket connections per user (max 5 concurrent)
- Throttle subscription events to max 10/second per client
- Implement backpressure if client can't keep up with events

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal:** Setup NATS inventory streams and basic event publishing

**Tasks:**
1. Create NATS inventory stream configurations (transactions, alerts, picks, tracking)
2. Implement `InventoryTransactionEvent` schema and publishing
3. Fix TODO Line 700: Update lot quantities in `recordInventoryTransaction` mutation
4. Add event publishing to ALL inventory mutations (createLot, updateLotQuantity, performCycleCount, etc.)
5. Write integration tests for event publishing

**Deliverables:**
- NATS streams created and verified
- All inventory mutations publish events
- Test coverage for event publishing

**Risk:** Low - Extends existing NATS infrastructure

---

### Phase 2: Alert System (Week 2)
**Goal:** Background monitoring service for low stock and expiration alerts

**Tasks:**
1. Implement `InventoryAlertMonitor` service
2. Create `LowStockAlertEvent` and `ExpirationAlertEvent` schemas
3. Implement alert severity calculation logic
4. Integrate with system_errors table for alert logging
5. Add orchestrator subscription to CRITICAL alerts
6. Test alert triggering at various threshold levels

**Deliverables:**
- Background service running on 5-minute interval
- Alerts published to NATS
- Product owner notification system
- Alert history in system_errors table

**Risk:** Medium - Requires accurate average daily usage calculation

---

### Phase 3: GraphQL Subscriptions (Week 3)
**Goal:** Real-time WebSocket updates to frontend

**Tasks:**
1. Add `graphql-ws` library and WebSocket server setup
2. Implement GraphQL subscription schema (inventorySummaryUpdated, lotQuantityUpdated, lowStockAlert, expirationAlert)
3. Create NATS-backed PubSub implementation for multi-instance support
4. Implement subscription resolvers with async iterators
5. Add WebSocket authentication and tenant isolation
6. Test multi-instance subscription delivery

**Deliverables:**
- WebSocket server running on separate port (e.g., 4000/graphql/subscriptions)
- 4 subscription types working
- Multi-instance tested with 3 server replicas
- Authentication and authorization working

**Risk:** Medium - WebSocket infrastructure is new to the stack

---

### Phase 4: Frontend Dashboard (Week 4)
**Goal:** Real-time inventory monitoring dashboard

**Tasks:**
1. Create React hooks for subscriptions (useInventorySummarySubscription, useLowStockAlerts)
2. Build real-time stock level table with live updates
3. Implement alert notification UI (toasts, badge counts)
4. Add sound notifications for CRITICAL alerts
5. Create expiration calendar view
6. Performance test with 1000+ materials updating simultaneously

**Deliverables:**
- Real-time dashboard with live stock levels
- Alert notification system
- Responsive UI (updates within 100ms of event)
- User preferences for alert types and sounds

**Risk:** Low - Leverages existing React infrastructure

---

### Phase 5: Performance Optimization (Week 5)
**Goal:** Materialized views and query optimization for scale

**Tasks:**
1. Create `mv_inventory_summary` materialized view
2. Implement refresh strategy (30-second scheduled OR event-driven)
3. Update `inventorySummary` resolver to use materialized view
4. Add indexes for common dashboard queries
5. Load test with 100K lots, 10K materials
6. Optimize subscription fanout for 100+ concurrent clients

**Deliverables:**
- Materialized view with <10ms query time
- Dashboard handles 100K+ lots without lag
- WebSocket server handles 100+ concurrent connections
- Performance benchmarks documented

**Risk:** Low - Standard optimization techniques

---

### Phase 6: Advanced Features (Week 6)
**Goal:** Wave progress tracking and shipment tracking subscriptions

**Tasks:**
1. Implement `WaveProgressEvent` publishing in pick list mutations
2. Add `waveProgressUpdated` subscription
3. Implement carrier webhook integration for real-time tracking events
4. Add `shipmentTrackingUpdated` subscription
5. Fix TODO Line 969: Carrier API integration in `manifestShipment`
6. Build wave progress dashboard and shipment tracking UI

**Deliverables:**
- Real-time wave progress updates
- Live shipment tracking from carrier webhooks
- Carrier API integrations (FedEx, UPS, USPS)
- Wave efficiency metrics dashboard

**Risk:** High - Requires external carrier API integrations

---

## 6. Key Metrics & Success Criteria

### Performance Metrics
- **Subscription Latency:** <100ms from mutation to WebSocket push
- **Alert Detection Time:** <5 minutes from threshold breach to alert
- **Dashboard Load Time:** <2 seconds for 10K materials
- **Query Performance:** inventorySummary <50ms at 100K lots
- **Concurrent Users:** Support 100+ simultaneous WebSocket connections

### Business Metrics
- **Stockout Prevention:** 80% reduction in stockouts (industry benchmark)
- **Alert Accuracy:** <5% false positive rate on low stock alerts
- **Response Time:** Product owners notified within 5 minutes of CRITICAL alerts
- **User Adoption:** 90% of warehouse staff using real-time dashboard daily
- **Inventory Turnover:** 15% improvement from better visibility

### Technical Metrics
- **Event Publishing Success Rate:** 99.9%
- **NATS Stream Uptime:** 99.95%
- **WebSocket Connection Stability:** <1% disconnect rate
- **Message Throughput:** Support 1000 events/second
- **Multi-Instance Coordination:** 100% event delivery to all instances

---

## 7. Risk Assessment & Mitigation

### Technical Risks

**Risk 1: WebSocket connection stability across firewalls/proxies**
- **Likelihood:** Medium
- **Impact:** High (no real-time updates for affected users)
- **Mitigation:** Implement SSE fallback using `graphql-sse`, test with various corporate firewall configurations

**Risk 2: NATS message backlog during high-volume periods**
- **Likelihood:** Low
- **Impact:** Medium (delayed alerts)
- **Mitigation:** Configure NATS stream with appropriate retention limits, implement consumer lag monitoring

**Risk 3: Database performance degradation from materialized view refresh**
- **Likelihood:** Medium
- **Impact:** Medium (slow dashboard)
- **Mitigation:** Use `REFRESH MATERIALIZED VIEW CONCURRENTLY` (non-blocking), schedule refreshes during low-traffic periods

**Risk 4: Inaccurate "days until stockout" calculation**
- **Likelihood:** High
- **Impact:** Low (alerts may be premature or late)
- **Mitigation:** Start with simple average daily usage calculation, iterate to include seasonality and trends in Phase 2+

**Risk 5: Multi-instance subscription coordination issues**
- **Likelihood:** Low
- **Impact:** High (users miss updates)
- **Mitigation:** Use NATS as shared event bus (proven pattern), implement comprehensive integration tests

### Operational Risks

**Risk 6: Alert fatigue from too many notifications**
- **Likelihood:** High
- **Impact:** Medium (users ignore important alerts)
- **Mitigation:** Implement severity-based filtering, user preferences for alert types, daily digest option

**Risk 7: Incorrect reorder point configuration leads to false alerts**
- **Likelihood:** High
- **Impact:** Medium (lost trust in alert system)
- **Mitigation:** Provide reorder point calculator tool, validate reorder points against historical usage, highlight materials with missing reorder points

**Risk 8: Carrier API rate limiting or downtime**
- **Likelihood:** Medium
- **Impact:** Low (shipment tracking delayed)
- **Mitigation:** Implement exponential backoff retry logic, cache tracking events, provide manual override

---

## 8. Dependencies & Prerequisites

### External Dependencies
- ✅ NATS server running (already configured)
- ✅ PostgreSQL 14+ with pgvector extension (already installed)
- ⚠️ Carrier API credentials (FedEx, UPS, USPS) - **ACTION REQUIRED**
- ⚠️ SMTP server for email alerts - **ACTION REQUIRED** (or use NATS-based notification service)

### Internal Dependencies
- ✅ WMS GraphQL schema (complete)
- ✅ Material master with reorder points (schema complete, data TBD)
- ⚠️ Fix TODO Line 700: Lot quantity updates - **BLOCKER for Phase 1**
- ⚠️ Fix TODO Line 1209: Reservation quantity_allocated updates - **BLOCKER for accurate availability**
- ⚠️ Fix TODO Line 792: Wave line creation - **BLOCKER for Phase 6**

### Data Prerequisites
- Materials must have `reorder_point` configured (otherwise no low stock alerts)
- Materials must have `safety_stock_quantity` configured for severity calculation
- Materials must have `lead_time_days` for accurate "days until stockout"
- Lots must have `expiration_date` for expiration alerts

**Action Item for Product Owners:** Conduct data audit to ensure critical fields are populated for top 100 materials (ABC classification A + B).

---

## 9. Alternative Approaches Considered

### Alternative 1: Polling-Based Dashboard (NOT RECOMMENDED)
**Approach:** Frontend polls `inventorySummary` query every 5 seconds

**Pros:**
- Simpler implementation (no WebSocket infrastructure)
- No multi-instance coordination issues

**Cons:**
- Higher database load (continuous queries)
- Higher network traffic
- Delayed updates (5-second lag)
- Doesn't scale (100 users = 2000 queries/minute)
- No instant alert notifications

**Verdict:** ❌ Not suitable for real-time monitoring

---

### Alternative 2: Server-Sent Events (SSE) Instead of WebSocket
**Approach:** Use `graphql-sse` for subscriptions instead of `graphql-ws`

**Pros:**
- Better firewall/proxy compatibility
- Simpler protocol (HTTP-based)
- Automatic reconnection built-in
- Lower server resource usage

**Cons:**
- One-way communication only (server → client)
- Not all GraphQL clients support SSE subscriptions
- Slightly higher latency than WebSocket

**Verdict:** ✅ Recommended as FALLBACK option (detect WebSocket failure, use SSE)

---

### Alternative 3: Push Notifications via Firebase Cloud Messaging
**Approach:** Use FCM for mobile/desktop push notifications instead of GraphQL subscriptions

**Pros:**
- Works even when browser tab is closed
- Native mobile notification support
- Reliable delivery

**Cons:**
- Requires Firebase integration
- Not suitable for in-dashboard real-time updates
- Additional infrastructure

**Verdict:** ✅ Recommended for COMPLEMENTARY use (out-of-app alerts), not replacement for WebSocket subscriptions

---

### Alternative 4: Redis Pub/Sub Instead of NATS
**Approach:** Use Redis for event streaming instead of NATS JetStream

**Pros:**
- Already familiar to many teams
- Simple pub/sub API
- Low latency

**Cons:**
- No message persistence (lost on restart)
- No message replay capability
- Limited retention/replay features
- Single point of failure (no clustering without Redis Cluster)
- NATS already installed and configured

**Verdict:** ❌ Not recommended - NATS JetStream is superior for event sourcing and already in use

---

## 10. Open Questions for Product Owner (Marcus)

### Data Configuration Questions
1. **Reorder Point Coverage:** What percentage of materials currently have `reorder_point` configured? Should we prioritize setting this for ABC class A materials first?

2. **Shelf Life Tracking:** Which material categories require expiration tracking? (e.g., adhesives, inks, perishable substrates?)

3. **Safety Stock Levels:** Who is responsible for setting/maintaining safety stock levels? Should the system auto-calculate based on lead time × average daily usage?

### Alert Preferences
4. **Alert Channels:** What notification channels should be supported? (In-app, email, SMS, WhatsApp, Slack?)

5. **Escalation Rules:** Should CRITICAL alerts automatically escalate to warehouse manager if not acknowledged within X minutes?

6. **Alert Suppression:** How should the system handle duplicate alerts? (e.g., send low stock alert once daily vs. continuous alerts until resolved?)

### Dashboard Requirements
7. **Dashboard Views:** What are the top 3 dashboard views needed?
   - Suggested: (1) Low stock materials, (2) Expiring lots, (3) Wave pick progress

8. **KPI Priorities:** Which metrics are most important to track?
   - Suggested: Fill rate, stockout frequency, inventory turnover, days on hand

9. **Mobile Access:** Is mobile responsive dashboard required, or desktop-only initially?

### Operational Workflows
10. **Reorder Automation:** Should low stock alerts automatically create draft purchase requisitions, or require manual PO creation?

11. **Lot Expiration Handling:** What's the workflow when a lot is approaching expiration? (Flag for discount sale, transfer to quarantine, scrap?)

12. **Cycle Count Prioritization:** Should the system auto-generate cycle count tasks for materials with discrepancies or frequent transactions?

---

## 11. Recommended Next Steps

### Immediate Actions (This Week)
1. **Product Owner Review:** Marcus reviews this research report and provides answers to open questions
2. **Data Audit:** Conduct audit of materials table to identify gaps in reorder_point, safety_stock, lead_time_days
3. **Carrier API Setup:** Obtain API credentials for FedEx, UPS, USPS (if not already available)
4. **Architecture Approval:** Roy (Backend PO) reviews proposed NATS stream architecture
5. **Frontend Planning:** Jen (Frontend PO) reviews dashboard requirements and subscription hooks

### Week 1 Kickoff (After Approval)
1. **Create GitHub Issue:** REQ-STOCK-TRACKING-001-BACKEND with Phase 1 tasks assigned to Roy
2. **Create GitHub Issue:** REQ-STOCK-TRACKING-001-FRONTEND (blocked until Phase 3) assigned to Jen
3. **Schedule Kickoff Meeting:** Marcus, Roy, Jen, Billy (QA), Priya (Stats) - 1 hour
4. **Setup Development Environment:** Ensure all developers have NATS running locally

### Success Criteria for "Go Live"
- [ ] All 6 phases complete
- [ ] Performance metrics met (see Section 6)
- [ ] Integration tests passing (>90% coverage)
- [ ] Load testing complete (100K lots, 100 concurrent users)
- [ ] Product owner acceptance testing complete
- [ ] User training documentation published
- [ ] Monitoring dashboards configured (NATS stream health, WebSocket connections, alert delivery rates)

---

## 12. Conclusion

The AGOG Print Industry ERP system has a **strong foundation** for implementing real-time stock level monitoring. The existing WMS schema is comprehensive, the NATS JetStream infrastructure is mature, and the GraphQL API is well-designed.

**Key Strengths:**
- 13-table WMS module with full lot traceability
- Material master integration with reorder points and safety stock
- NATS JetStream ready for inventory event streaming
- IoT device integration for sensor-based monitoring

**Critical Path:**
1. Fix TODO comments in resolvers (lot quantity updates, reservation allocation)
2. Implement NATS inventory event streams
3. Build background alert monitoring service
4. Add GraphQL subscription layer
5. Create real-time dashboard UI

**Timeline Estimate:** 6 weeks for full implementation (see Section 5 roadmap)

**Risk Level:** MEDIUM - Most technical components are proven patterns, but WebSocket infrastructure is new to the stack and carrier API integrations add complexity.

**Recommendation:** ✅ **PROCEED** with implementation using the phased approach outlined in Section 5. Start with Phase 1 (NATS streams) while Product Owner conducts data audit and answers open questions.

---

## Appendix A: Reference Links

### GraphQL Subscriptions
- [Subscriptions | GraphQL](https://graphql.org/learn/subscriptions/)
- [Subscriptions - Apollo GraphQL Docs](https://www.apollographql.com/docs/react/data/subscriptions/)
- [GraphQL Subscriptions: Why we use SSE/Fetch over Websockets - WunderGraph](https://wundergraph.com/blog/deprecate_graphql_subscriptions_over_websockets)
- [Subscriptions in Apollo Server - Apollo GraphQL Docs](https://www.apollographql.com/docs/apollo-server/data/subscriptions)

### NATS JetStream
- [Using Nats Jetstream as an event store · nats-io/nats-server · Discussion #3772](https://github.com/nats-io/nats-server/discussions/3772)
- [JetStream | NATS Docs](https://docs.nats.io/nats-concepts/jetstream)
- [Master Event-Driven Microservices with Go, NATS JetStream and OpenTelemetry: Production Guide](https://golang.elitedev.in/golang/master-event-driven-microservices-with-go-nats-jetstream-and-opentelemetry-production-guide-8eca28fb/)
- [Event-Driven Microservices with NATS and Jetstream - Moments Log](https://www.momentslog.com/development/web-backend/event-driven-microservices-with-nats-and-jetstream-7)

### Warehouse Monitoring Best Practices
- [Inventory KPI Dashboards: Tracking Turnover, Stockouts, and Reorder Alerts with Ease](https://www.omniful.ai/blog/inventory-kpi-dashboards-turnover-stockouts-reorder)
- [Automated Stock Alerts and Reorder Management: Complete Implementation Guide](https://gegosoft.com/automated-stock-alerts-and-reorder-management/)
- [The Expert Guide to Warehouse Monitoring in 2025: Systems, Trends, & Techniques](https://www.shipbob.com/blog/warehouse-monitoring/)
- [Inventory Replenishment Software: Complete Guide to Automated Stock Management in 2025](https://ordersinseconds.com/inventory-replenishment-software-guide/)

---

**End of Research Report**

**Agent:** Cynthia (Research Analyst)
**Report Generated:** 2025-12-20
**Total Sections:** 12
**Word Count:** ~8,500 words
**Estimated Reading Time:** 35 minutes

---

## Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2025-12-20 | 1.0 | Initial research report | Cynthia |
