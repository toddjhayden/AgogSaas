**📍 Navigation Path:** [AGOG Home](../README.md) → [Project Architecture](./README.md) → System Overview

# AGOG System Architecture Overview

## Executive Summary

AGOG is a cloud-native, multi-tenant ERP system designed specifically for the packaging industry, including corrugated, commercial print, label printing, shrink film, folding cartons, and flexible packaging. The architecture follows modern design principles: API-first, modular architecture with shared database, event-driven, with a proven ERP core enhanced by intelligent AI optimization.

**Key Architectural Principles:**
1. **API-First:** Hybrid API strategy - GraphQL for PWA/dashboards, REST for external integrations
2. **Multi-Tenant:** Complete data isolation with SCD Type 2 historical tracking
3. **Event-Driven:** Real-time updates via message queuing
4. **Schema-Driven:** YAML schemas as structured pseudocode
5. **Modular Monolith:** Organized as modules (Orders, Production, Inventory) sharing a unified database for ACID transactions
6. **Blue-Green Deployment:** Zero-downtime releases
7. **Hybrid AI:** Proven algorithms first, AI enhancement second

## High-Level Architecture

**Architectural Foundation: Unified Material Tracking**

AGOG's architecture treats material traceability as a core architectural concern integrated across all tiers, enabling complete visibility from receiving through production to shipment:

- **Client Tier:** Real-time waste dashboards, lot traceability viewers, quality investigation tools
- **API Gateway:** Dedicated `/lot-genealogy/*` endpoints for forward/backward tracing
- **Application Tier:** Inventory Service owns lot genealogy; all other services consume it as authoritative source
- **Messaging Tier:** Every material movement publishes genealogy events for real-time updates
- **Data Tier:** Lot genealogy tables with optimized indexes for tree traversal queries

**Architectural Benefits:**
1. **Single Source of Truth:** Lot genealogy centralized in Inventory Service (not fragmented across production, quality, warehouse)
2. **Real-Time Visibility:** Material movements publish events → all dashboards update instantly
3. **Complete Audit Trail:** Every lot split, merge, consumption, and waste event timestamped and attributed
4. **Query Performance:** Recursive CTEs and materialized paths enable instant forward/backward traces across deep genealogies
5. **Compliance Support:** Architecture supports FDA, ISO 9001, and GMP traceability requirements

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Web Portal  │  │ Mobile Apps  │  │Customer      │           │
│  │  (React/TS)  │  │ (iOS/Android)│  │Portal (React)│           │
│  └──────┬───────┘  └───────┬──────┘  └────────┬─────┘           │
│         │                  │                  │                 │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                      API GATEWAY TIER                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │         Hybrid API Layer (GraphQL + REST)                  │  │
│  │                                                            │  │
│  │  GraphQL (Apollo Federation):                              │  │
│  │  • PWA frontend queries/mutations                          │  │
│  │  • BI dashboard data aggregation                           │  │
│  │  • Real-time subscriptions (WebSocket)                     │  │
│  │  • Endpoint: https://api.agog.app/graphql                  │  │
│  │                                                            │  │
│  │  REST APIs (OpenAPI):                                      │  │
│  │  • External integrations (shipping, payments, equipment)   │  │
│  │  • Third-party developer access                            │  │
│  │  • Webhook event subscriptions                             │  │
│  │  • Base: https://api.agog.app/v1                           │  │
│  │                                                            │  │
│  │  Common Layer:                                             │  │
│  │  • Authentication/Authorization (OAuth 2.0, JWT)           │  │
│  │  • Rate limiting & throttling                              │  │
│  │  • Request routing & load balancing                        │  │
│  │  • API versioning                                          │  │
│  │  • Logging & monitoring                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                    APPLICATION TIER                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Core Business Modules (Node.js/TypeScript)                      │
│  Modular Monolith: Shared database, organized as modules         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Orders     │  │  Production  │  │  Inventory   │            │
│  │   Module     │  │   Module     │  │   Module     │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                 │                 │                    │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐            │
│  │  Estimating  │  │  Scheduling  │  │  Warehouse   │            │
│  │   Module     │  │   Module     │  │   Module     │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                  │
│  Integration Modules                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │     JDF      │  │   Shipping   │  │  E-commerce  │            │
│  │  Integration │  │  Integration │  │  Integration │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                  │
│  AI/ML Services (Python)                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Predictive  │  │    Image     │  │ Optimization │            │
│  │  Analytics   │  │  Processing  │  │    Engine    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                    MESSAGING & EVENTS                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │          Azure Service Bus / RabbitMQ / Kafka              │  │
│  │                                                            │  │
│  │  Topics:                                                   │  │
│  │  • orders.created  • production.started                    │  │
│  │  • inventory.updated  • quality.failed                     │  │
│  │  • shipment.dispatched  • equipment.alarm                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                       DATA TIER                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Primary Database (PostgreSQL)                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  • Multi-tenant with row-level security                    │  │
│  │  • SCD Type 2 for historical tracking                      │  │
│  │  • Master/Replica for read scaling                         │  │
│  │  • Point-in-time recovery enabled                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Cache Layer (Redis Cluster)                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  • Session storage                                         │  │
│  │  • Real-time dashboard data                                │  │
│  │  • Frequently accessed reference data                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Document/Blob Storage (Azure Blob / S3)                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  • PDF proofs and job tickets                              │  │
│  │  • Print file assets (images, designs)                     │  │
│  │  • Archived documents and reports                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Time-Series Database (TimescaleDB / InfluxDB)                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  • Equipment metrics and telemetry                         │  │
│  │  • Production performance data                             │  │
│  │  • Quality measurements over time                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Print      │  │   Shipping   │  │   Payment    │            │
│  │  Equipment   │  │   Carriers   │  │  Gateways    │            │
│  │  (JDF/JMF)   │  │ (FedEx/UPS)  │  │(Stripe/etc.) │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## System Components

### Client Tier

#### Web Portal (Internal Users)
**Technology:** React, TypeScript, Material-UI  
**Purpose:** Primary interface for internal staff

**Modules:**
- Executive Dashboard (KPIs, analytics)
- Order Management (quotes, orders, invoicing)
- Production Control (scheduling, work orders)
- Inventory Management (stock, materials, purchasing)
- Quality Control (inspections, defects)
- Warehouse Operations (pick/pack/ship)
- Equipment Monitoring (status, maintenance)
- Financial Management (GL, AR, AP, reporting)
- Admin/Configuration (users, settings, tenants)

**Key Features:**
- Real-time updates via WebSockets
- Responsive design (desktop, tablet)
- Role-based dashboards
- Offline capability (service workers)

#### Mobile Apps (iOS/Android)
**Technology:** React Native or Flutter  
**Purpose:** Field access for production floor and delivery

**Capabilities:**
- Barcode scanning for inventory/orders
- Mobile work order management
- Equipment status monitoring
- Quality check submissions
- Photo capture for defects
- Delivery confirmations
- Time tracking

#### Customer Portal
**Technology:** React, TypeScript  
**Purpose:** Self-service for print customers

**Features:**
- Online ordering and quoting
- Order status tracking
- Digital proof approval
- Artwork upload
- Invoice viewing and payment
- Reorder previous jobs
- Template management (CTO jobs)

### API Gateway Tier

**Technology:** Azure API Management or NGINX  
**Purpose:** Single entry point for all client requests

**Responsibilities:**
- **Authentication:** OAuth 2.0, JWT token validation
- **Authorization:** Role-based access control (RBAC)
- **Rate Limiting:** Prevent abuse, ensure fair use
- **Load Balancing:** Distribute traffic across instances
- **API Versioning:** Support multiple API versions
- **Monitoring:** Request logging, performance metrics
- **Transformation:** Request/response mapping
- **SSL Termination:** HTTPS encryption

**Design Pattern:**
```
Client → API Gateway → Service Discovery → Module
         ↓
    Authentication
    Authorization
    Rate Limiting
    Logging
```

### Application Tier

**Architecture Note:** AGOG uses a **modular monolith** approach - organized as modules (Orders, Production, Inventory, etc.) that share a unified PostgreSQL database. This provides:
- **ACID transactions** across modules (critical for ERP)
- **Complex joins** for reporting and analytics
- **Simpler deployment** (single application, multiple modules)
- **Better performance** (no network calls between modules)
- **Easier development** (shared schema, unified codebase)

Each module is logically separate but deployed together, sharing the same database for transactional integrity.

#### Core Business Services

**1. Order Management Service**
**Responsibilities:**
- Quote creation and management
- Order entry and processing
- Customer management
- Pricing and discounts
- Order workflow orchestration

**Key Entities:**
- Customer, Contact, Address
- Quote, QuoteLine
- Order, OrderLine
- PricingRule, Discount

**APIs:**
```
POST   /api/v1/quotes
GET    /api/v1/quotes/{id}
POST   /api/v1/quotes/{id}/convert-to-order
GET    /api/v1/orders
POST   /api/v1/orders
PATCH  /api/v1/orders/{id}/status
```

**2. Production Service**
**Responsibilities:**
- Job creation and management
- Work order generation
- Production scheduling
- Resource allocation
- JDF job ticket generation

**Key Entities:**
- Job, JobSpec
- WorkOrder, WorkOrderStep
- ProductionRun
- ResourceAllocation

**APIs:**
```
POST   /api/v1/jobs
GET    /api/v1/jobs/{id}/work-orders
POST   /api/v1/work-orders/{id}/start
POST   /api/v1/work-orders/{id}/complete
GET    /api/v1/production/schedule
```

**3. Inventory Service**
**Responsibilities:**
- **Unified Material Tracking:** Single source of truth for raw materials, WIP, and finished goods
- **Lot Genealogy:** Complete traceability from substrate roll to finished product
- Stock level management across multiple warehouses
- Material tracking with expiration/aging alerts
- Reorder point automation with demand forecasting
- Storage location management (bin/rack/shelf)
- Stock movements and adjustments with audit trail

**Key Entities:**
- Material, MaterialType, MaterialVariant
- Inventory, InventoryTransaction
- LotNumber, LotGenealogy, LotSplit, LotMerge
- StorageLocation, Warehouse, BinLocation
- MaterialExpiration, SubstrateAging

**Unified Material Tracking:**
AGOG treats material traceability as a first-class concern, not an add-on. The system provides complete end-to-end visibility:
- Incoming substrate roll → lot number assignment → quality inspection
- Roll split into multiple jobs → genealogy preserved
- Waste/scrap tracked back to source lot → pattern analysis
- Finished goods → customer shipment → field issue investigation
- Complete forward/backward traceability for recalls, quality claims, and warranty issues

**Capabilities:**
- Real-time inventory levels across multiple warehouses and sales points
- Automated reorder point calculations based on consumption patterns and demand forecasting
- Lot number tracking with quality metrics captured at every stage
- Substrate aging alerts (paper expiration, ink shelf life, coating degradation)
- Gang run optimization to minimize waste across multiple jobs
- Scrap and waste tracking by job, operator, equipment, and material lot
- Instant recall capability (identify all affected finished goods from source lot)
- Root cause analysis tools (trace quality issues to specific material batches or process steps)

**Business Value:**
- Significant reduction in inventory waste through expiration alerts and FIFO enforcement
- Faster root cause analysis for quality issues via complete traceability
- Compliance support for regulated industries (pharmaceutical packaging, food packaging, medical labels)
- Reduction in emergency material purchases through accurate demand forecasting

**APIs:**
```
GET    /api/v1/inventory/stock-levels
POST   /api/v1/inventory/adjust
GET    /api/v1/materials/{id}/lot-genealogy
POST   /api/v1/inventory/lot/{lotNumber}/split
POST   /api/v1/inventory/lot/{lotNumber}/merge
GET    /api/v1/inventory/lot/{lotNumber}/forward-trace
GET    /api/v1/inventory/lot/{lotNumber}/backward-trace
POST   /api/v1/inventory/transfer
GET    /api/v1/inventory/expiring-materials
GET    /api/v1/inventory/waste-analysis
```

**4. Scheduling Service**
**Responsibilities:**
- Production schedule optimization
- Equipment capacity planning
- Job sequencing
- Bottleneck identification
- What-if scenario analysis

**Algorithms:**
- **Base:** Critical Path Method (CPM), Finite Capacity Scheduling
- **AI Enhancement:** Predictive job duration, optimal sequencing

**APIs:**
```
GET    /api/v1/schedule/current
POST   /api/v1/schedule/optimize
POST   /api/v1/schedule/simulate
GET    /api/v1/schedule/bottlenecks
```

**5. Warehouse Service**
**Responsibilities:**
- Pick/pack/ship workflows
- Bin location management
- Cycle counting
- Kitting and assembly
- Shipping integration

**Key Entities:**
- PickList, PickListLine
- Shipment, ShipmentLine
- PackingSlip
- BinLocation

**APIs:**
```
GET    /api/v1/warehouse/pick-lists
POST   /api/v1/warehouse/pick-lists/{id}/pick
POST   /api/v1/warehouse/shipments
POST   /api/v1/warehouse/shipments/{id}/ship
```

**6. Estimating Service**
**Responsibilities:**
- Cost calculation
- Quote generation
- Template management
- Historical cost analysis
- AI-suggested pricing

**APIs:**
```
POST   /api/v1/estimates/calculate
GET    /api/v1/estimates/templates
POST   /api/v1/estimates/templates
GET    /api/v1/estimates/historical/{jobType}
```

#### Integration Services

**7. JDF Integration Service**
**Purpose:** Equipment integration via JDF/JMF protocols

**Capabilities:**
- Generate JDF job tickets
- Send jobs to equipment
- Receive status updates (JMF)
- Equipment capability queries
- Color management profiles

**Protocol Support:**
- JDF 1.5 specification
- JMF messaging
- MIME multipart for file transfer

**8. Shipping Integration Service**
**Purpose:** Connect with shipping carriers

**Supported Carriers:**
- FedEx, UPS, USPS, DHL
- Regional carriers via API

**Capabilities:**
- Rate shopping
- Label generation
- Tracking number retrieval
- Shipment tracking
- Address validation

**9. E-commerce Integration Service**
**Purpose:** Online ordering and customer portal

**Capabilities:**
- Product catalog publishing
- Real-time pricing
- Order ingestion
- Status updates
- Customer account sync

#### AI/ML Services

**10. Predictive Analytics Service**
**Technology:** Python, scikit-learn, TensorFlow

**Models:**
- Job duration prediction
- Equipment failure prediction
- Demand forecasting
- Price optimization

**11. Image Processing Service**
**Technology:** Python, OpenCV, TensorFlow

**Capabilities:**
- Color quality analysis
- Registration checking
- Defect detection
- Barcode reading

**12. Optimization Engine**
**Technology:** Python, OR-Tools

**Algorithms:**
- Gang run optimization (bin packing)
- Cutting stock optimization
- Vehicle routing (delivery)
- Inventory optimization

### Messaging & Events Tier

**Technology:** Azure Service Bus, RabbitMQ, or Apache Kafka

**Purpose:** Asynchronous communication between services

**Event Topics:**
```
orders/
  ├─ created
  ├─ updated
  ├─ approved
  └─ cancelled

production/
  ├─ job-started
  ├─ job-completed
  ├─ equipment-alarm
  └─ quality-issue

inventory/
  ├─ stock-adjusted
  ├─ reorder-triggered
  └─ lot-received

shipments/
  ├─ shipped
  ├─ in-transit
  └─ delivered
```

**Pattern:** Event-Driven Architecture (EDA)
- Services publish events when state changes
- Subscribers react to events asynchronously
- Enables loose coupling and scalability

### Data Tier

#### PostgreSQL (Primary Database)

**Schema Design:**
- **Multi-Tenant:** Every table has `tenant_id` column
- **Row-Level Security:** PostgreSQL RLS for tenant isolation
- **SCD Type 2:** Historical tracking with `valid_from`, `valid_to`, `is_current`
- **Audit Columns:** `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`

**Partitioning Strategy:**
- Partition large tables by `tenant_id` and date
- Improves query performance and maintenance

**Replication:**
- Master-replica setup for read scaling
- Read replicas for reporting and analytics
- Automatic failover for high availability

**Backup Strategy:**
- Full backup daily
- Transaction log backup every 15 minutes
- Point-in-time recovery enabled
- 30-day retention

#### Redis Cluster (Cache)

**Use Cases:**
- Session storage (user authentication tokens)
- Real-time dashboard data (frequently updated)
- Reference data (rarely changing lookups)
- Rate limiting counters
- Job queue for background tasks

**Pattern:** Cache-aside
```typescript
async function getCustomer(id: string): Promise<Customer> {
  // Try cache first
  const cached = await redis.get(`customer:${id}`);
  if (cached) return JSON.parse(cached);
  
  // Cache miss, fetch from DB
  const customer = await db.customers.findById(id);
  
  // Store in cache for next time
  await redis.setex(`customer:${id}`, 3600, JSON.stringify(customer));
  
  return customer;
}
```

#### Azure Blob Storage / S3 (Files)

**Content Types:**
- PDF proofs and job tickets
- Print-ready files (PDF, TIFF, PS)
- Customer artwork and logos
- Archived documents
- System backups

**Organization:**
```
/{tenant-id}/
  ├─ orders/{order-id}/
  │   ├─ artwork/
  │   ├─ proofs/
  │   └─ final/
  ├─ customers/{customer-id}/
  │   └─ logos/
  └─ archive/
```

**Security:**
- Signed URLs for temporary access
- Encryption at rest
- Tenant isolation

#### TimescaleDB / InfluxDB (Time-Series)

**Metrics Collected:**
- Equipment telemetry (every 5 seconds)
  - Speed, temperature, pressure
  - Material consumption
  - Error counts
- Production metrics (every minute)
  - Job progress
  - Quality measurements
  - Downtime events
- Business metrics (hourly/daily)
  - Revenue, orders, shipments
  - Inventory levels
  - Customer activity

**Retention:**
- Raw data: 90 days
- Aggregated (hourly): 2 years
- Aggregated (daily): 7 years

## Data Flow Examples

### Example 1: Material Lot Genealogy (End-to-End Traceability)

**Scenario:** Complete material tracking from receiving through production to quality investigation and recall management.

```
RECEIVING → STORAGE → PRODUCTION → FINISHED GOODS → SHIPMENT
   ↓           ↓          ↓              ↓              ↓
Complete chain of custody with quality checkpoints

1. Warehouse Receives Paper Roll
   Supplier: "Acme Paper Co., Roll #12345, 50,000 sheets"
   
   → Warehouse scans barcode
   → System creates: LOT-2025-001
   → Quality inspection: moisture %, brightness, thickness
   → Assigns to storage: Warehouse-A, Aisle-3, Rack-B, Shelf-2
   
   Inventory Service → Database
   INSERT INTO lots (tenant_id, lot_number, material_id, supplier_lot, quantity, quality_metrics)
   
   Inventory Service → Message Bus
   Publishes: "inventory.lot-received"

2. Production Splits Roll Across Multiple Jobs
   
   Job-A needs 10,000 sheets → LOT-2025-001-A (child)
   Job-B needs 15,000 sheets → LOT-2025-001-B (child)
   Job-C needs 20,000 sheets → LOT-2025-001-C (child)
   Waste: 5,000 sheets → LOT-2025-001-WASTE
   
   Inventory Service → Database
   INSERT INTO lot_genealogy (parent_lot, child_lot, split_type, quantity)
   
   Production Service tracks consumption:
   - Job-A: 9,800 sheets used, 200 waste (misregistration)
   - Job-B: 14,500 sheets used, 500 waste (color issues)
   - Job-C: 19,900 sheets used, 100 waste (normal trim)

3. Quality Issue Discovered
   
   Customer reports: "Job-B has color banding in zones 3-5"
   
   Quality Manager → Web Portal
   GET /api/v1/inventory/lot/LOT-2025-001-B/backward-trace
   
   System returns complete history:
   ┌─ LOT-2025-001 (parent roll)
   │  ├─ Supplier: Acme Paper Co.
   │  ├─ Received: 2025-10-15 08:30
   │  ├─ Quality: Moisture 4.2%, Brightness 92
   │  └─ Inspector: John Doe
   └─ LOT-2025-001-B (split for Job-B)
      ├─ Quantity: 15,000 sheets
      ├─ Production: Press-3, Operator: Jane Smith
      ├─ Waste: 500 sheets (3.3% - ABOVE NORMAL)
      └─ Timestamp: 2025-10-16 14:20

   Root Cause Analysis:
   - LOT-2025-001-B had 3.3% waste (normal is 0.5-1%)
   - Same paper roll, other jobs (A, C) had normal waste
   - Indicates: Likely press issue on Press-3, not paper quality
   
   Quality Service → Equipment Service
   "Check Press-3 maintenance logs, calibration, roller alignment"

4. Proactive Forward Trace (Recall Scenario)
   
   Supplier calls: "Roll #12345 had manufacturing defect"
   
   Quality Manager → Web Portal
   GET /api/v1/inventory/lot/LOT-2025-001/forward-trace
   
   System returns all affected jobs:
   ┌─ LOT-2025-001 (suspect roll)
   └─ Split into:
      ├─ LOT-2025-001-A → Job-1234 → Order-5001 → Customer: ABC Corp
      │                                           └─ Shipped: 2025-10-18
      ├─ LOT-2025-001-B → Job-1235 → Order-5002 → Customer: XYZ Inc
      │                                           └─ Shipped: 2025-10-19
      ├─ LOT-2025-001-C → Job-1236 → Order-5003 → Customer: MegaCorp
      │                                           └─ In Production
      └─ LOT-2025-001-WASTE → Disposed
   
   Immediate Actions:
   - STOP Job-1236 (still in production)
   - Contact ABC Corp and XYZ Inc (proactive notification)
   - Quarantine remaining inventory from Acme Paper Co.
   - Complete recall in 45 minutes (vs. 2-3 days manual search)

5. Waste Analysis & Continuous Improvement
   
   Production Manager (monthly review)
   GET /api/v1/inventory/waste-analysis?period=2025-10
   
   System aggregates by lot, job, press, operator:
   - Press-3: 3.1% average waste (2x normal)
   - Press-1: 0.8% average waste (normal)
   - Press-2: 1.2% average waste (normal)
   
   → Schedule Press-3 for maintenance
   → Saves $15K/month in paper waste
```

**System Capability Demonstrated:**
- Complete material lineage from supplier lot through every production stage
- Instant forward/backward traceability (significantly faster than manual search processes)
- Quality issue root cause analysis with data-driven insights
- Proactive waste reduction through pattern identification

### Example 2: Order to Production Flow

```
1. Customer Portal → API Gateway → Order Service
   POST /api/v1/orders
   Creates order in database

2. Order Service → Message Bus
   Publishes: "orders.created" event

3. Production Service (subscriber)
   Receives event, creates Job and WorkOrders

4. Production Service → Message Bus
   Publishes: "production.job-created" event

5. Scheduling Service (subscriber)
   Receives event, adds job to schedule
   Runs optimization algorithm

6. JDF Integration Service (subscriber)
   Receives event, generates JDF job ticket
   Sends to equipment via JMF

7. Equipment
   Sends JMF status updates back
   "job started", "job progress", "job completed"

8. JDF Integration Service → Production Service
   Updates work order status

9. Production Service → Message Bus
   Publishes: "production.job-completed" event

10. Warehouse Service (subscriber)
    Receives event, creates pick list
    
11. Order Service (subscriber)
    Updates order status to "ready for shipment"
```

### Example 2: Inventory Reorder Flow

```
1. Background Job (runs every hour)
   Queries inventory levels below reorder point

2. Inventory Service → AI/ML Service
   POST /api/ml/predict-demand
   Gets demand forecast for next 30 days

3. Inventory Service
   Calculates optimal reorder quantity
   Creates purchase requisition

4. Inventory Service → Message Bus
   Publishes: "inventory.reorder-triggered" event

5. Notification Service (subscriber)
   Sends email/SMS to purchasing manager

6. Purchasing Manager (via Web Portal)
   Approves/modifies requisition
   Converts to purchase order

7. Inventory Service → Supplier Integration
   Sends PO to supplier (EDI or email)

8. Supplier ships material

9. Warehouse receives material
   Scans lot number, updates inventory

10. Inventory Service → Message Bus
    Publishes: "inventory.lot-received" event

11. Production Service (subscriber)
    Updates job status from "waiting for materials"
    to "ready for production"
```

## Technology Stack

### Backend
- **Runtime:** Node.js 20 LTS
- **Language:** TypeScript 5+
- **Framework:** Express.js or Fastify
- **ORM:** TypeORM or Prisma
- **Validation:** Joi or Zod
- **Testing:** Jest, Supertest

### Frontend
- **Framework:** React 18+
- **Language:** TypeScript 5+
- **State Management:** Redux Toolkit or Zustand
- **UI Library:** Material-UI or Ant Design
- **Charts:** Recharts or Chart.js
- **Real-time:** Socket.io client

### Database
- **Primary:** PostgreSQL 15+
- **Cache:** Redis 7+
- **Time-Series:** TimescaleDB or InfluxDB
- **Search:** Elasticsearch (optional)

### Infrastructure
- **Cloud:** Azure or AWS
- **Containers:** Docker
- **Orchestration:** Kubernetes or Azure Container Apps
- **Message Bus:** Azure Service Bus or RabbitMQ
- **Storage:** Azure Blob Storage or AWS S3
- **CDN:** Azure CDN or CloudFront

### DevOps
- **CI/CD:** GitHub Actions
- **Infrastructure as Code:** Terraform or Bicep
- **Monitoring:** Application Insights or Datadog
- **Logging:** Azure Monitor or ELK Stack
- **APM:** Application Insights or New Relic

### AI/ML
- **Language:** Python 3.11+
- **Frameworks:** TensorFlow, PyTorch, scikit-learn
- **Optimization:** OR-Tools, PuLP
- **Image Processing:** OpenCV
- **Deployment:** Azure ML or AWS SageMaker

## Security Architecture

### Authentication & Authorization

**Authentication:**
- OAuth 2.0 with JWT tokens
- Multi-factor authentication (MFA)
- Single Sign-On (SSO) via Azure AD, Okta

**Authorization:**
- Role-Based Access Control (RBAC)
- Tenant isolation enforced at database level
- API-level permission checks

**Security Layers:**
```
1. API Gateway: Token validation, rate limiting
2. Application: Role checks, tenant verification
3. Database: Row-level security (PostgreSQL RLS)
```

### Data Security

**Encryption:**
- **At Rest:** AES-256 encryption for database and file storage
- **In Transit:** TLS 1.3 for all API communication
- **Backups:** Encrypted with separate keys

**Tenant Isolation:**
- Every query filtered by `tenant_id`
- Row-Level Security prevents cross-tenant data access
- Separate encryption keys per tenant (optional)

**Compliance:**
- SOC 2 Type II
- GDPR compliant (data residency, right to deletion)
- HIPAA ready (for healthcare printing customers)

### Network Security

**Layers:**
1. **WAF:** Azure Firewall / AWS WAF
2. **DDoS Protection:** Azure DDoS Protection
3. **Private Networks:** VNet/VPC for backend services
4. **Network Segmentation:** Separate subnets for tiers

## Scalability & Performance

### Horizontal Scaling

**Application Tier:**
- Stateless services (can scale to N instances)
- Load balancer distributes traffic
- Auto-scaling based on CPU/memory/request count

**Database Tier:**
- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Partitioning for large tables

**Cache Tier:**
- Redis cluster for high availability
- Sharding for large cache datasets

### Performance Optimizations

**Database:**
- Proper indexing (tenant_id in all composite indexes)
- Query optimization (explain plans reviewed)
- Materialized views for complex reports
- Partitioning for time-series data

**Caching Strategy:**
- Cache frequently accessed reference data
- Cache-aside pattern
- TTL based on data volatility
- Cache invalidation on updates

**API Response:**
- Pagination for list endpoints (max 100 items)
- GraphQL for flexible data fetching (optional)
- Compression (gzip) for large responses
- ETags for conditional requests

### Monitoring & Observability

**Metrics:**
- Application metrics (request rate, latency, errors)
- Business metrics (orders/day, revenue, utilization)
- Infrastructure metrics (CPU, memory, disk, network)

**Logging:**
- Structured logging (JSON format)
- Correlation IDs for request tracing
- Log aggregation (centralized logging)
- Log retention (90 days hot, 1 year archive)

**Tracing:**
- Distributed tracing (OpenTelemetry)
- Service dependency mapping
- Performance bottleneck identification

**Alerting:**
- PagerDuty for critical issues
- Slack for warnings
- Email for info notifications

## Disaster Recovery

**RTO (Recovery Time Objective):** 15 minutes  
**RPO (Recovery Point Objective):** 5 minutes

**Strategy:**
- Multi-region deployment (primary + DR)
- Continuous replication to DR region
- Automated failover for database
- Blue-green deployment for zero-downtime releases

**Testing:**
- DR drill quarterly
- Failover test monthly
- Backup restoration test weekly

## Related Documentation

- [API Specification](./api/api-specification.md) - Detailed API documentation
- [Data Models](../Implementation/print-industry-erp/data-models/README.md) - Entity schemas
- [Deployment Process](./deployment-process.md) - Blue-green deployment strategy
- [Security](./security/access-controls.md) - Detailed security implementation
- [Business Value](../Project%20Spirit/BUSINESS_VALUE.md) - Why we built it this way

---

[⬆ Back to top](#agog-system-architecture-overview) | [🏠 AGOG Home](../README.md) | [🏗️ Project Architecture](./README.md)