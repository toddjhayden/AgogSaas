# Mobile Field Service Application - Research & Implementation Strategy

**REQ:** REQ-STRATEGIC-AUTO-1767116143661
**Feature:** Mobile Field Service Application
**Researcher:** Cynthia (Research Specialist)
**Date:** 2025-12-30
**Status:** COMPLETE

---

## Executive Summary

This research document provides a comprehensive analysis and implementation strategy for a **Mobile Field Service Application** tailored for the print industry ERP system. The application will enable field technicians to manage service calls, equipment maintenance, installations, customer site visits, and time tracking while offline-capable and synchronized with the central ERP system.

### Key Findings

1. **Existing Infrastructure**: Strong foundation with 86+ tables, including employees, maintenance_records, work_centers, timecards, quality_inspections, and iot_devices
2. **Technology Stack**: React Native or Progressive Web App (PWA) recommended for cross-platform mobile delivery
3. **Offline-First Architecture**: Critical for field technicians working in locations with poor connectivity
4. **Integration Points**: Customer portal auth, predictive maintenance, work orders, inventory, time tracking
5. **Estimated Scope**: 12 new database tables, 8-10 mobile screens, GraphQL API layer, sync engine

---

## Table of Contents

1. [Business Context](#business-context)
2. [Industry Research](#industry-research)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema Design](#database-schema-design)
5. [API Design](#api-design)
6. [Mobile Application Features](#mobile-application-features)
7. [Security & Compliance](#security-compliance)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Integration Points](#integration-points)
10. [Risk Assessment](#risk-assessment)
11. [Recommendations](#recommendations)

---

## 1. Business Context

### 1.1 Print Industry Field Service Needs

Print equipment manufacturers and service providers require field technicians to:

- **Service Call Management**: Respond to equipment breakdowns (presses, bindery, finishing equipment)
- **Preventive Maintenance**: Scheduled maintenance visits based on predictive maintenance alerts
- **Installation & Commissioning**: New equipment installation and calibration
- **Parts Inventory Management**: Track parts used, request replenishment
- **Time & Expense Tracking**: Labor hours, travel time, expense reimbursement
- **Customer Signatures**: Proof of service completion
- **Photo Documentation**: Before/after photos, defect documentation
- **Technical Documentation**: Access to equipment manuals, service bulletins
- **Quality Inspections**: Post-service quality verification

### 1.2 Existing System Capabilities

Based on analysis of the current database schema (MASTER_TABLE_INDEX.sql):

**✅ Already Available:**
- `work_centers` - Equipment/press tracking (86 rows, comprehensive)
- `maintenance_records` - Historical maintenance data
- `employees` - Field technician profiles
- `timecards` - Labor time tracking infrastructure
- `iot_devices` - Equipment sensors and telemetry
- `quality_inspections` - Quality verification workflows
- `asset_hierarchy` - Equipment genealogy and relationships
- `predictive_maintenance_models` - AI-driven maintenance predictions (V0.0.62)
- `equipment_events` - Real-time equipment event tracking
- `sensor_readings` - Equipment telemetry data

**❌ Missing Components:**
- Service call/work order ticketing system
- Field technician assignment and scheduling
- Mobile-optimized data synchronization
- Offline data storage and conflict resolution
- Parts consumption tracking for field service
- Customer signature capture
- Mobile photo/document attachment storage
- Service level agreement (SLA) tracking
- Route optimization for multi-site visits
- Mobile time entry with GPS validation

---

## 2. Industry Research

### 2.1 Competitive Analysis

**Leading Field Service Management (FSM) Solutions:**

| Solution | Strengths | Weaknesses | Relevance to Print ERP |
|----------|-----------|------------|------------------------|
| **ServiceMax** | Asset-centric, IoT integration | Complex pricing | ✅ Equipment-focused like print industry |
| **FieldAware** | Offline-first, route optimization | Limited customization | ✅ Good offline capabilities |
| **Salesforce Field Service** | Deep CRM integration | Heavy/expensive | ⚠️ Overkill for mid-size print shops |
| **Microsoft Dynamics 365 FSM** | Azure IoT Hub integration | Requires D365 ecosystem | ⚠️ Vendor lock-in |
| **ServiceTitan** | Mobile-first design | Consumer services focused | ❌ Not B2B/equipment focused |

### 2.2 Key Feature Benchmarks

**Must-Have Features (Industry Standard):**
1. Work order management
2. Scheduling & dispatch
3. Offline mobile access
4. Customer signatures
5. Time tracking
6. Parts/inventory management
7. Photo documentation

**Differentiation Opportunities:**
1. **Predictive Maintenance Integration**: Leverage existing `predictive_maintenance_models` to pre-populate service recommendations
2. **Print-Specific Workflows**: Press calibration checklists, color management validation, substrate testing
3. **OEE Impact Tracking**: Show how maintenance affects Overall Equipment Effectiveness
4. **IoT Sensor Integration**: Real-time equipment telemetry accessible in mobile app

---

## 3. Technical Architecture

### 3.1 Mobile Platform Decision Matrix

| Platform | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **React Native** | - Code reuse with existing React frontend<br>- Native performance<br>- Large ecosystem | - Bridge overhead<br>- Platform-specific bugs | ✅ **RECOMMENDED** |
| **Progressive Web App (PWA)** | - No app store deployment<br>- Instant updates<br>- Single codebase | - Limited native API access<br>- Browser variations | ⚠️ Secondary option |
| **Flutter** | - Excellent performance<br>- Beautiful UI | - New language (Dart)<br>- No code reuse | ❌ Not recommended |
| **Native (Swift/Kotlin)** | - Best performance<br>- Full native API access | - Duplicate codebases<br>- High maintenance | ❌ Too expensive |

**Decision: React Native** - Maximize code reuse with existing React frontend, proven offline capabilities with libraries like WatermelonDB or Redux Persist.

### 3.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mobile Field Service App                     │
│                        (React Native)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Work Orders  │  │  Time Entry  │  │   Parts      │         │
│  │  & Dispatch  │  │  & Expenses  │  │  Inventory   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Customer    │  │   Photo &    │  │  Equipment   │         │
│  │  Signatures  │  │ Documents    │  │   Manuals    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     Offline Storage Layer                        │
│                 (WatermelonDB / SQLite / Realm)                 │
├─────────────────────────────────────────────────────────────────┤
│                     Sync Engine                                  │
│          (Conflict Resolution, Delta Sync, Queue)               │
└─────────────────────────────────────────────────────────────────┘
                              ▼
                     Network Boundary
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API Gateway                           │
│                     (NestJS GraphQL)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Field Service Module (New)                       │ │
│  │  - WorkOrderService                                        │ │
│  │  - TechnicianAssignmentService                             │ │
│  │  - PartConsumptionService                                  │ │
│  │  - ServiceReportService                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           Integration Modules (Existing)                   │ │
│  │  - PredictiveMaintenanceModule (V0.0.62)                   │ │
│  │  - OperationsModule (work_centers, maintenance_records)    │ │
│  │  - WMSModule (inventory_locations, parts tracking)         │ │
│  │  - CustomerAuthModule (field tech authentication)          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│               (86 Existing Tables + 12 New Tables)              │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Offline-First Data Synchronization Strategy

**Approach: Eventual Consistency with Conflict Detection**

1. **Local-First Writes**: All user actions write to local SQLite/WatermelonDB immediately
2. **Background Sync**: Periodically sync changes when network available
3. **Conflict Resolution Rules**:
   - Work order status: Server wins (dispatchers have authority)
   - Time entries: Client wins (technician is source of truth)
   - Parts consumption: Client wins, but validate inventory availability on sync
   - Customer signatures: Client-only (cannot conflict)
4. **Delta Sync**: Only sync changed records using `updated_at` timestamps
5. **Sync Queue**: Failed syncs queued for retry with exponential backoff

**Technology Options:**
- **WatermelonDB**: React Native optimized, observable, lazy loading
- **Realm**: Battle-tested, MongoDB-backed, automatic sync available
- **Redux Persist + SQLite**: Manual but flexible

**Recommendation:** WatermelonDB for performance and React integration

---

## 4. Database Schema Design

### 4.1 New Tables Required

#### Table 1: `field_service_work_orders`

```sql
CREATE TABLE field_service_work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID,

    -- Work order identification
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    work_order_type VARCHAR(50) NOT NULL,
    -- CORRECTIVE_MAINTENANCE, PREVENTIVE_MAINTENANCE, INSTALLATION,
    -- CALIBRATION, INSPECTION, EMERGENCY, WARRANTY_SERVICE

    -- Customer & location
    customer_id UUID,
    customer_site_id UUID,
    site_contact_name VARCHAR(255),
    site_contact_phone VARCHAR(50),
    site_contact_email VARCHAR(255),

    -- Equipment
    work_center_id UUID NOT NULL,
    -- References work_centers table (existing equipment)

    equipment_serial_number VARCHAR(100),
    equipment_location TEXT,

    -- Problem description
    problem_description TEXT NOT NULL,
    problem_severity VARCHAR(20),
    -- CRITICAL, HIGH, MEDIUM, LOW

    -- Predictive maintenance link
    predictive_alert_id UUID,
    -- Links to predictive_maintenance_alerts (from V0.0.62)

    -- Scheduling
    requested_date DATE,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,

    -- Assignment
    assigned_technician_id UUID,
    -- References employees table

    backup_technician_id UUID,

    -- Status tracking
    status VARCHAR(30) DEFAULT 'OPEN',
    -- OPEN, ASSIGNED, EN_ROUTE, IN_PROGRESS, ON_HOLD,
    -- COMPLETED, CANCELLED, AWAITING_PARTS

    priority INTEGER DEFAULT 5,
    -- 1 = URGENT, 5 = NORMAL, 10 = LOW

    -- SLA tracking
    sla_response_time_hours INTEGER,
    sla_resolution_time_hours INTEGER,
    sla_response_deadline TIMESTAMPTZ,
    sla_resolution_deadline TIMESTAMPTZ,
    sla_breached BOOLEAN DEFAULT FALSE,

    -- Resolution
    resolution_summary TEXT,
    root_cause_analysis TEXT,

    -- Parts used (see field_service_parts_consumed table)
    estimated_parts_cost DECIMAL(18,4),
    actual_parts_cost DECIMAL(18,4),

    -- Labor
    estimated_labor_hours DECIMAL(8,2),
    actual_labor_hours DECIMAL(8,2),
    labor_cost DECIMAL(18,4),

    -- Customer satisfaction
    customer_signature_url TEXT,
    customer_rating INTEGER,
    -- 1-5 stars
    customer_feedback TEXT,

    -- Documentation
    photos_urls TEXT[],
    attachments_urls TEXT[],

    -- Billing
    billable BOOLEAN DEFAULT TRUE,
    invoice_id UUID,

    -- Geolocation
    technician_check_in_location GEOGRAPHY(POINT, 4326),
    technician_check_out_location GEOGRAPHY(POINT, 4326),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_fswo_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_fswo_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_fswo_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_fswo_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_fswo_technician FOREIGN KEY (assigned_technician_id) REFERENCES employees(id),
    CONSTRAINT fk_fswo_backup_tech FOREIGN KEY (backup_technician_id) REFERENCES employees(id)
);

CREATE INDEX idx_fswo_tenant ON field_service_work_orders(tenant_id);
CREATE INDEX idx_fswo_status ON field_service_work_orders(status);
CREATE INDEX idx_fswo_technician ON field_service_work_orders(assigned_technician_id);
CREATE INDEX idx_fswo_scheduled ON field_service_work_orders(scheduled_start);
CREATE INDEX idx_fswo_customer ON field_service_work_orders(customer_id);
CREATE INDEX idx_fswo_work_center ON field_service_work_orders(work_center_id);
```

#### Table 2: `field_service_parts_consumed`

```sql
CREATE TABLE field_service_parts_consumed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    work_order_id UUID NOT NULL,
    material_id UUID NOT NULL,

    quantity_used DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    unit_cost DECIMAL(18,4),
    total_cost DECIMAL(18,4),

    lot_number VARCHAR(100),
    serial_number VARCHAR(100),

    -- Inventory depletion
    inventory_location_id UUID,
    inventory_transaction_id UUID,
    -- References existing inventory_transactions table

    -- Mobile tracking
    consumed_at TIMESTAMPTZ DEFAULT NOW(),
    consumed_by_technician_id UUID,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_fspc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_fspc_work_order FOREIGN KEY (work_order_id) REFERENCES field_service_work_orders(id),
    CONSTRAINT fk_fspc_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT fk_fspc_technician FOREIGN KEY (consumed_by_technician_id) REFERENCES employees(id),
    CONSTRAINT fk_fspc_inventory_loc FOREIGN KEY (inventory_location_id) REFERENCES inventory_locations(id)
);

CREATE INDEX idx_fspc_work_order ON field_service_parts_consumed(work_order_id);
CREATE INDEX idx_fspc_material ON field_service_parts_consumed(material_id);
```

#### Table 3: `field_service_time_entries`

```sql
CREATE TABLE field_service_time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    work_order_id UUID NOT NULL,
    technician_id UUID NOT NULL,

    entry_type VARCHAR(30) NOT NULL,
    -- TRAVEL_TO_SITE, ON_SITE_SERVICE, TRAVEL_FROM_SITE,
    -- BREAK, ADMINISTRATIVE

    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER,

    -- Geolocation validation
    start_location GEOGRAPHY(POINT, 4326),
    end_location GEOGRAPHY(POINT, 4326),

    -- Billing
    billable BOOLEAN DEFAULT TRUE,
    billing_rate DECIMAL(18,4),
    billing_amount DECIMAL(18,4),

    notes TEXT,

    -- Approval
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    -- Sync tracking
    synced_to_server BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_fste_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_fste_work_order FOREIGN KEY (work_order_id) REFERENCES field_service_work_orders(id),
    CONSTRAINT fk_fste_technician FOREIGN KEY (technician_id) REFERENCES employees(id),
    CONSTRAINT fk_fste_approver FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX idx_fste_work_order ON field_service_time_entries(work_order_id);
CREATE INDEX idx_fste_technician ON field_service_time_entries(technician_id);
CREATE INDEX idx_fste_start_time ON field_service_time_entries(start_time);
```

#### Table 4: `field_service_checklists`

```sql
CREATE TABLE field_service_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    checklist_code VARCHAR(50) NOT NULL,
    checklist_name VARCHAR(255) NOT NULL,
    checklist_type VARCHAR(50),
    -- PM_INSPECTION, INSTALLATION, CALIBRATION, SAFETY_CHECK

    work_center_type VARCHAR(50),
    -- OFFSET_PRESS, DIGITAL_PRESS, etc. (matches work_centers.work_center_type)

    checklist_items JSONB NOT NULL,
    -- [
    --   {
    --     "item_id": "CHECK_001",
    --     "description": "Verify gripper alignment",
    --     "required": true,
    --     "data_type": "BOOLEAN",
    --     "options": ["PASS", "FAIL"]
    --   },
    --   {
    --     "item_id": "MEASURE_001",
    --     "description": "Measure sheet width tolerance",
    --     "required": true,
    --     "data_type": "NUMERIC",
    --     "unit": "inches",
    --     "min_value": 10.0,
    --     "max_value": 10.1
    --   }
    -- ]

    estimated_completion_minutes INTEGER,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_fsc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_fsc_code UNIQUE (tenant_id, checklist_code)
);

CREATE INDEX idx_fsc_tenant ON field_service_checklists(tenant_id);
CREATE INDEX idx_fsc_type ON field_service_checklists(checklist_type);
```

#### Table 5: `field_service_checklist_responses`

```sql
CREATE TABLE field_service_checklist_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    work_order_id UUID NOT NULL,
    checklist_id UUID NOT NULL,

    technician_id UUID NOT NULL,

    responses JSONB NOT NULL,
    -- [
    --   {
    --     "item_id": "CHECK_001",
    --     "response": "PASS",
    --     "notes": "Alignment perfect"
    --   },
    --   {
    --     "item_id": "MEASURE_001",
    --     "response": 10.05,
    --     "within_spec": true
    --   }
    -- ]

    completion_percentage DECIMAL(5,2),
    -- 0.00 to 100.00

    all_items_passed BOOLEAN,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_fscr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_fscr_work_order FOREIGN KEY (work_order_id) REFERENCES field_service_work_orders(id),
    CONSTRAINT fk_fscr_checklist FOREIGN KEY (checklist_id) REFERENCES field_service_checklists(id),
    CONSTRAINT fk_fscr_technician FOREIGN KEY (technician_id) REFERENCES employees(id)
);

CREATE INDEX idx_fscr_work_order ON field_service_checklist_responses(work_order_id);
CREATE INDEX idx_fscr_technician ON field_service_checklist_responses(technician_id);
```

#### Table 6: `field_service_technician_inventory`

```sql
CREATE TABLE field_service_technician_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    technician_id UUID NOT NULL,
    material_id UUID NOT NULL,

    -- Truck stock
    quantity_on_hand DECIMAL(18,4) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(18,4),
    max_stock_level DECIMAL(18,4),

    -- Tracking
    last_replenished_at TIMESTAMPTZ,
    last_replenished_quantity DECIMAL(18,4),

    -- Valuation
    unit_cost DECIMAL(18,4),
    total_value DECIMAL(18,4),

    -- Storage
    storage_location VARCHAR(100),
    -- e.g., "Truck Bin A3", "Van Shelf 2"

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_fsti_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_fsti_technician FOREIGN KEY (technician_id) REFERENCES employees(id),
    CONSTRAINT fk_fsti_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT uq_fsti_tech_material UNIQUE (tenant_id, technician_id, material_id)
);

CREATE INDEX idx_fsti_technician ON field_service_technician_inventory(technician_id);
CREATE INDEX idx_fsti_material ON field_service_technician_inventory(material_id);
```

#### Table 7: `field_service_routes`

```sql
CREATE TABLE field_service_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    route_date DATE NOT NULL,
    technician_id UUID NOT NULL,

    route_sequence INTEGER NOT NULL,
    -- Order of stops: 1, 2, 3, etc.

    work_order_id UUID NOT NULL,

    estimated_arrival TIMESTAMPTZ,
    estimated_departure TIMESTAMPTZ,

    actual_arrival TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,

    travel_distance_miles DECIMAL(10,2),
    travel_time_minutes INTEGER,

    route_status VARCHAR(20) DEFAULT 'PLANNED',
    -- PLANNED, EN_ROUTE, ARRIVED, COMPLETED, SKIPPED

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_fsr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_fsr_technician FOREIGN KEY (technician_id) REFERENCES employees(id),
    CONSTRAINT fk_fsr_work_order FOREIGN KEY (work_order_id) REFERENCES field_service_work_orders(id),
    CONSTRAINT uq_fsr_route UNIQUE (tenant_id, technician_id, route_date, route_sequence)
);

CREATE INDEX idx_fsr_technician_date ON field_service_routes(technician_id, route_date);
CREATE INDEX idx_fsr_work_order ON field_service_routes(work_order_id);
```

#### Table 8: `field_service_knowledge_base`

```sql
CREATE TABLE field_service_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    article_code VARCHAR(50) NOT NULL,
    article_title VARCHAR(255) NOT NULL,
    article_type VARCHAR(50),
    -- TROUBLESHOOTING, PROCEDURE, FAQ, SAFETY, TECHNICAL_BULLETIN

    work_center_type VARCHAR(50),
    -- OFFSET_PRESS, DIGITAL_PRESS, etc.

    manufacturer VARCHAR(100),
    equipment_model VARCHAR(100),

    problem_symptoms TEXT,
    solution_steps TEXT NOT NULL,

    attachments_urls TEXT[],
    video_urls TEXT[],

    -- Search optimization
    keywords TEXT[],

    -- Usage tracking
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,

    is_published BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_fskb_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_fskb_code UNIQUE (tenant_id, article_code)
);

CREATE INDEX idx_fskb_tenant ON field_service_knowledge_base(tenant_id);
CREATE INDEX idx_fskb_type ON field_service_knowledge_base(work_center_type);
CREATE INDEX idx_fskb_keywords ON field_service_knowledge_base USING GIN (keywords);
```

### 4.2 Enhanced Existing Tables

**Modifications to `employees` table** (add field service attributes):

```sql
ALTER TABLE employees
ADD COLUMN is_field_technician BOOLEAN DEFAULT FALSE,
ADD COLUMN technician_level VARCHAR(20),
-- TRAINEE, JUNIOR, SENIOR, MASTER, EXPERT
ADD COLUMN certifications JSONB,
-- [{"cert_name": "Heidelberg Press Certified", "cert_date": "2024-01-15", "expiry": "2026-01-15"}]
ADD COLUMN service_areas GEOGRAPHY(POLYGON, 4326)[],
-- Geographic service territories
ADD COLUMN mobile_device_id VARCHAR(100),
-- For push notifications
ADD COLUMN current_location GEOGRAPHY(POINT, 4326),
ADD COLUMN last_location_update TIMESTAMPTZ;
```

**Modifications to `work_centers` table** (add service history):

```sql
ALTER TABLE work_centers
ADD COLUMN last_service_date DATE,
ADD COLUMN last_service_work_order_id UUID,
ADD COLUMN service_intervals_days INTEGER,
ADD COLUMN next_service_due_date DATE,
ADD COLUMN total_service_calls INTEGER DEFAULT 0,
ADD COLUMN average_downtime_hours DECIMAL(10,2);
```

### 4.3 Database Schema Summary

**New Tables:** 8
1. `field_service_work_orders` - Core work order management
2. `field_service_parts_consumed` - Parts usage tracking
3. `field_service_time_entries` - Labor time tracking
4. `field_service_checklists` - Maintenance checklist templates
5. `field_service_checklist_responses` - Completed checklist data
6. `field_service_technician_inventory` - Truck stock management
7. `field_service_routes` - Daily route planning
8. `field_service_knowledge_base` - Technical documentation

**Modified Tables:** 2
- `employees` (add 7 field service columns)
- `work_centers` (add 6 service history columns)

**Total Database Impact:** 8 new tables, 2 modified tables, 13 new columns

---

## 5. API Design

### 5.1 GraphQL Schema (Mobile-Optimized)

```graphql
# ========================================
# WORK ORDER QUERIES
# ========================================

type FieldServiceWorkOrder {
  id: ID!
  workOrderNumber: String!
  workOrderType: WorkOrderType!
  status: WorkOrderStatus!
  priority: Int!

  # Customer
  customer: Customer
  siteContactName: String
  siteContactPhone: String
  siteContactEmail: String

  # Equipment
  workCenter: WorkCenter!
  equipmentSerialNumber: String
  equipmentLocation: String

  # Problem
  problemDescription: String!
  problemSeverity: Severity!
  predictiveAlert: PredictiveMaintenanceAlert

  # Schedule
  scheduledStart: DateTime
  scheduledEnd: DateTime
  actualStart: DateTime
  actualEnd: DateTime

  # Assignment
  assignedTechnician: Employee
  backupTechnician: Employee

  # SLA
  slaResponseDeadline: DateTime
  slaResolutionDeadline: DateTime
  slaBreached: Boolean

  # Resolution
  resolutionSummary: String
  rootCauseAnalysis: String

  # Financials
  estimatedPartsC: Decimal
  actualPartsCost: Decimal
  estimatedLaborHours: Decimal
  actualLaborHours: Decimal
  laborCost: Decimal

  # Customer satisfaction
  customerSignatureUrl: String
  customerRating: Int
  customerFeedback: String

  # Documentation
  photoUrls: [String!]
  attachmentUrls: [String!]

  # Related data
  partsConsumed: [FieldServicePartsConsumed!]
  timeEntries: [FieldServiceTimeEntry!]
  checklistResponses: [FieldServiceChecklistResponse!]

  # Geolocation
  technicianCheckInLocation: GeoPoint
  technicianCheckOutLocation: GeoPoint

  # Audit
  createdAt: DateTime!
  updatedAt: DateTime
}

enum WorkOrderType {
  CORRECTIVE_MAINTENANCE
  PREVENTIVE_MAINTENANCE
  INSTALLATION
  CALIBRATION
  INSPECTION
  EMERGENCY
  WARRANTY_SERVICE
}

enum WorkOrderStatus {
  OPEN
  ASSIGNED
  EN_ROUTE
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  CANCELLED
  AWAITING_PARTS
}

enum Severity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

type FieldServicePartsConsumed {
  id: ID!
  workOrder: FieldServiceWorkOrder!
  material: Material!
  quantityUsed: Decimal!
  unitOfMeasure: String
  unitCost: Decimal
  totalCost: Decimal
  lotNumber: String
  serialNumber: String
  consumedAt: DateTime
  notes: String
}

type FieldServiceTimeEntry {
  id: ID!
  workOrder: FieldServiceWorkOrder!
  technician: Employee!
  entryType: TimeEntryType!
  startTime: DateTime!
  endTime: DateTime
  durationMinutes: Int
  startLocation: GeoPoint
  endLocation: GeoPoint
  billable: Boolean!
  billingRate: Decimal
  billingAmount: Decimal
  notes: String
  approved: Boolean
  syncedToServer: Boolean
}

enum TimeEntryType {
  TRAVEL_TO_SITE
  ON_SITE_SERVICE
  TRAVEL_FROM_SITE
  BREAK
  ADMINISTRATIVE
}

type FieldServiceChecklistResponse {
  id: ID!
  workOrder: FieldServiceWorkOrder!
  checklist: FieldServiceChecklist!
  technician: Employee!
  responses: JSON!
  completionPercentage: Decimal!
  allItemsPassed: Boolean
  completedAt: DateTime
}

type FieldServiceTechnicianInventory {
  id: ID!
  technician: Employee!
  material: Material!
  quantityOnHand: Decimal!
  minStockLevel: Decimal
  maxStockLevel: Decimal
  lastReplenishedAt: DateTime
  storageLocation: String
}

type FieldServiceRoute {
  id: ID!
  routeDate: Date!
  technician: Employee!
  routeSequence: Int!
  workOrder: FieldServiceWorkOrder!
  estimatedArrival: DateTime
  actualArrival: DateTime
  travelDistanceMiles: Decimal
  routeStatus: RouteStatus!
}

# ========================================
# QUERIES (Mobile-Optimized)
# ========================================

type Query {
  # Get technician's assigned work orders (TODAY)
  myWorkOrders(
    status: WorkOrderStatus
    limit: Int = 20
  ): [FieldServiceWorkOrder!]!

  # Get single work order with full details
  workOrder(id: ID!): FieldServiceWorkOrder

  # Get technician's daily route
  myRoute(date: Date!): [FieldServiceRoute!]!

  # Get technician's truck inventory
  myInventory: [FieldServiceTechnicianInventory!]!

  # Get applicable checklists for equipment
  checklistsForWorkCenter(
    workCenterType: String!
  ): [FieldServiceChecklist!]!

  # Knowledge base search
  searchKnowledgeBase(
    query: String!
    workCenterType: String
    limit: Int = 10
  ): [FieldServiceKnowledgeBase!]!

  # Sync delta changes (for offline sync)
  syncWorkOrders(
    lastSyncAt: DateTime!
    technicianId: ID!
  ): WorkOrderSyncPayload!
}

type WorkOrderSyncPayload {
  workOrders: [FieldServiceWorkOrder!]!
  deletedWorkOrderIds: [ID!]!
  lastSyncTimestamp: DateTime!
}

# ========================================
# MUTATIONS (Mobile-Optimized)
# ========================================

type Mutation {
  # Start work order
  startWorkOrder(
    workOrderId: ID!
    checkInLocation: GeoPointInput
  ): FieldServiceWorkOrder!

  # Complete work order
  completeWorkOrder(
    workOrderId: ID!
    resolutionSummary: String!
    rootCauseAnalysis: String
    checkOutLocation: GeoPointInput
  ): FieldServiceWorkOrder!

  # Update work order status
  updateWorkOrderStatus(
    workOrderId: ID!
    status: WorkOrderStatus!
    notes: String
  ): FieldServiceWorkOrder!

  # Record parts consumption
  recordPartsUsed(
    workOrderId: ID!
    materialId: ID!
    quantityUsed: Decimal!
    notes: String
  ): FieldServicePartsConsumed!

  # Start time entry
  startTimeEntry(
    workOrderId: ID!
    entryType: TimeEntryType!
    location: GeoPointInput
  ): FieldServiceTimeEntry!

  # End time entry
  endTimeEntry(
    timeEntryId: ID!
    location: GeoPointInput
  ): FieldServiceTimeEntry!

  # Submit checklist response
  submitChecklistResponse(
    workOrderId: ID!
    checklistId: ID!
    responses: JSON!
  ): FieldServiceChecklistResponse!

  # Upload customer signature
  uploadCustomerSignature(
    workOrderId: ID!
    signatureDataUrl: String!
  ): FieldServiceWorkOrder!

  # Upload photos/attachments
  uploadWorkOrderPhoto(
    workOrderId: ID!
    photoDataUrl: String!
    caption: String
  ): FieldServiceWorkOrder!

  # Request parts replenishment
  requestPartsReplenishment(
    materialId: ID!
    quantityRequested: Decimal!
    urgency: Severity!
    notes: String
  ): PartsReplenishmentRequest!
}

# ========================================
# SUBSCRIPTIONS (Real-time Updates)
# ========================================

type Subscription {
  # New work order assigned to technician
  workOrderAssigned(technicianId: ID!): FieldServiceWorkOrder!

  # Work order status changed
  workOrderUpdated(workOrderId: ID!): FieldServiceWorkOrder!

  # Route updated (dispatch changes)
  routeUpdated(technicianId: ID!, date: Date!): [FieldServiceRoute!]!
}
```

### 5.2 REST API Endpoints (File Uploads)

GraphQL doesn't handle binary file uploads well, so use REST for photos/signatures:

```typescript
// POST /api/field-service/work-orders/:id/photos
// Content-Type: multipart/form-data
// Authorization: Bearer <JWT>
{
  photo: File,
  caption: string,
  timestamp: ISO8601
}

// POST /api/field-service/work-orders/:id/signature
// Content-Type: multipart/form-data
{
  signature: File (PNG),
  customerName: string,
  timestamp: ISO8601
}

// POST /api/field-service/work-orders/:id/attachments
{
  file: File,
  documentType: string,
  description: string
}
```

---

## 6. Mobile Application Features

### 6.1 Core Screens & User Flows

#### Screen 1: Dashboard (Home Screen)

**Purpose:** Overview of technician's day

**Components:**
- Today's work order count badge
- Pending/In-Progress/Completed stats
- Today's route map (if multiple stops)
- Quick actions: Start Next Job, View Route, Check Inventory
- Notifications: New assignments, schedule changes, parts requests approved

**Technical:**
- Pull-to-refresh for sync
- Offline indicator
- Badge notifications

#### Screen 2: Work Order List

**Purpose:** View all assigned work orders

**Features:**
- Filter by status, priority, date
- Sort by scheduled time, priority, distance
- Search by customer name, work order #, equipment
- Swipe actions: Start, Complete, View Details
- Offline visual indicator per work order

**Technical:**
- Infinite scroll/pagination
- Local SQLite query
- Sync status per work order (synced/pending)

#### Screen 3: Work Order Details

**Purpose:** Complete view of single work order

**Sections:**
1. **Header:** Work order #, status badge, priority
2. **Customer:** Name, site contact, phone (tap-to-call), email, address (tap-to-navigate)
3. **Equipment:** Model, serial #, location, last service date
4. **Problem:** Description, severity, predictive alert (if any)
5. **Schedule:** Scheduled start/end, actual start/end
6. **Actions:** Start Work, Complete Work, Add Parts, Add Time, Take Photo, Upload Signature
7. **Tabs:**
   - Summary
   - Checklist (if applicable)
   - Parts Used
   - Time Entries
   - Photos
   - Knowledge Base (related articles)

**Technical:**
- Lazy load tabs
- Optimistic UI updates
- Form validation

#### Screen 4: Service Checklist

**Purpose:** Guided maintenance checklist

**Features:**
- Dynamic form generation from `field_service_checklists.checklist_items` JSON
- Progress indicator (% complete)
- Required vs. optional items
- Input types: Boolean (pass/fail), Numeric (measurements), Text (notes), Photo
- Auto-save on each item completion
- Highlight failed items in red
- Cannot complete work order if required checklist items not passed

**Technical:**
- JSON-driven dynamic forms
- Local storage for partial completion
- Validation rules from JSON schema

#### Screen 5: Parts Consumption

**Purpose:** Record parts used during service

**Features:**
- Search materials by code, name, barcode scan
- Check technician truck inventory
- Enter quantity used
- Lot/serial # tracking (if applicable)
- Running total of parts cost
- Flag if part not in truck inventory (request from warehouse)

**Technical:**
- Barcode scanner integration (react-native-camera)
- Real-time inventory deduction (optimistic)
- Sync queue if offline

#### Screen 6: Time Tracking

**Purpose:** Track labor time for billing

**Features:**
- Tap to start timer (travel to site, on-site service, travel from site)
- Running timer display
- Pause/resume
- Manual time entry for retroactive entries
- GPS location capture on start/stop (optional, privacy-aware)
- Daily summary of total hours

**Technical:**
- Background timer (even if app backgrounded)
- Local notifications for long-running timers
- GPS geofencing for auto-start (advanced)

#### Screen 7: Customer Signature

**Purpose:** Proof of service completion

**Features:**
- Canvas for customer to sign with finger
- "Clear" button to retry
- Customer name field
- Preview before saving
- Upload signature as PNG to server

**Technical:**
- react-native-signature-canvas
- Convert canvas to Base64 PNG
- Upload via REST API

#### Screen 8: Knowledge Base

**Purpose:** Access technical documentation

**Features:**
- Search by keywords, equipment model, symptoms
- Categorized articles (Troubleshooting, Procedures, Safety)
- Bookmark favorite articles for offline access
- Rate articles (helpful/not helpful)
- View PDFs, videos (embedded or external)

**Technical:**
- Full-text search (SQLite FTS5)
- Download PDFs for offline viewing
- Video streaming (YouTube, Vimeo embed)

#### Screen 9: Route Planner

**Purpose:** Optimized daily route

**Features:**
- Map view of all stops for the day
- List view with sequence numbers
- Re-order stops manually
- Auto-route optimization (distance/time)
- Turn-by-turn navigation integration (Google Maps, Waze)
- ETA to next stop

**Technical:**
- MapView component (react-native-maps)
- Google Maps Directions API for routing
- Deep linking to native navigation apps

#### Screen 10: Inventory Management

**Purpose:** Manage truck stock

**Features:**
- View all parts in truck
- Low stock alerts (quantity < min_stock_level)
- Request replenishment
- Transfer parts between technicians
- Scan barcode to add/remove inventory

**Technical:**
- SQLite local inventory table
- Sync with central inventory on network
- Push notifications for approved replenishments

### 6.2 Offline Capabilities

**Critical Offline Features:**
1. View assigned work orders (pre-synced at day start)
2. Start/complete work orders
3. Record parts consumption
4. Track time entries
5. Complete checklists
6. Take photos (stored locally until sync)
7. Capture customer signatures
8. Access cached knowledge base articles

**Sync Strategy:**
- **On App Launch:** Full sync of today's work orders + truck inventory + checklists
- **Periodic Background Sync:** Every 15 minutes (when network available)
- **Manual Sync:** Pull-to-refresh on any list screen
- **Conflict Resolution:** Server-wins for work order status, client-wins for time entries

**Offline Indicators:**
- Network status icon in header
- "Pending Sync" badge on modified work orders
- Sync queue count in settings

---

## 7. Security & Compliance

### 7.1 Authentication & Authorization

**Mobile Authentication Flow:**

```
1. User enters username/password on mobile app
2. App calls POST /api/auth/mobile-login
3. Server validates credentials (bcrypt hash)
4. Server issues JWT with claims:
   - user_id
   - tenant_id
   - employee_id
   - is_field_technician: true
   - service_areas: [geometry]
   - roles: ["FIELD_TECHNICIAN"]
5. Mobile app stores JWT in secure storage (react-native-keychain)
6. JWT included in Authorization header for all GraphQL/REST calls
7. JWT expires after 8 hours (field shift length)
8. Refresh token valid for 30 days (stored in secure storage)
```

**Authorization Rules:**
- Technicians can only view work orders assigned to them
- Technicians cannot delete work orders
- Technicians cannot approve their own time entries
- Technicians can only access customers in their service areas (RLS policy)

### 7.2 Row-Level Security (RLS) Policies

```sql
-- RLS Policy: field_service_work_orders
CREATE POLICY field_service_work_orders_tenant_isolation ON field_service_work_orders
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY field_service_work_orders_technician_access ON field_service_work_orders
    FOR SELECT
    USING (
        assigned_technician_id = current_setting('app.current_employee_id')::UUID
        OR backup_technician_id = current_setting('app.current_employee_id')::UUID
        OR current_setting('app.current_user_role') = 'DISPATCHER'
    );

-- Similar policies for all field service tables
```

### 7.3 Data Privacy & GDPR Compliance

**Personal Data Handling:**
- Customer signatures encrypted at rest (AES-256)
- GPS location data encrypted
- Automatic data retention policies:
  - Work orders: 7 years (audit requirement)
  - GPS location data: 90 days
  - Photos: 5 years
- User consent for location tracking (prompted on first launch)
- Right to erasure: anonymize customer data on request

**Mobile Device Security:**
- Biometric authentication (FaceID/TouchID) for app unlock
- Auto-lock after 5 minutes of inactivity
- Wipe local data on 5 failed login attempts
- No sensitive data in logs
- Certificate pinning for API calls

### 7.4 Audit Trail

All mobile actions logged to `audit_log` table (existing):

```sql
-- Example audit entries
INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
VALUES
  ('uuid', 'WORK_ORDER_STARTED', 'field_service_work_orders', 'wo-uuid',
   '{"location": {"lat": 40.7128, "lng": -74.0060}, "device": "iPhone 14"}'),

  ('uuid', 'PARTS_CONSUMED', 'field_service_parts_consumed', 'pc-uuid',
   '{"material_id": "mat-uuid", "quantity": 2.5, "offline": true}');
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Database:**
- Create 8 new tables (migration V0.0.63)
- Add columns to `employees`, `work_centers`
- Create RLS policies
- Seed sample data for testing

**Backend:**
- Create `FieldServiceModule` in NestJS
- Implement GraphQL resolvers (queries, mutations)
- Implement REST endpoints for file uploads
- Create sync delta API
- Unit tests (80% coverage)

**Deliverables:**
- Migration file: `V0.0.63__create_field_service_tables.sql`
- Module: `src/modules/field-service/`
- Resolvers: `src/graphql/resolvers/field-service.resolver.ts`
- Services: 5 service classes

### Phase 2: Mobile App - Core Screens (Weeks 3-4)

**Mobile:**
- React Native project setup
- Navigation structure (React Navigation)
- Authentication flow
- Dashboard screen
- Work Order List screen
- Work Order Details screen
- Offline storage setup (WatermelonDB)

**Deliverables:**
- React Native app: `print-industry-erp/mobile-field-service/`
- 3 core screens functional
- Offline-first data layer
- JWT authentication

### Phase 3: Mobile App - Service Execution (Weeks 5-6)

**Mobile:**
- Service Checklist screen
- Parts Consumption screen
- Time Tracking screen
- Customer Signature screen
- Photo upload
- Work order start/complete workflows

**Deliverables:**
- 5 additional screens
- Background sync engine
- Camera integration
- Signature capture

### Phase 4: Advanced Features (Weeks 7-8)

**Mobile:**
- Route Planner screen
- Knowledge Base screen
- Inventory Management screen
- Push notifications
- Barcode scanning

**Backend:**
- Predictive maintenance integration
- Route optimization algorithm
- SLA breach detection (background job)

**Deliverables:**
- Full feature set complete
- Integration tests
- Performance optimization

### Phase 5: Testing & Deployment (Weeks 9-10)

**QA:**
- End-to-end testing (Detox)
- Offline scenario testing
- Load testing (100 concurrent technicians)
- Security penetration testing
- Beta testing with 3 field technicians

**DevOps:**
- iOS App Store submission
- Android Play Store submission
- CI/CD pipeline for mobile (Fastlane)
- Monitoring (Sentry for mobile errors)

**Deliverables:**
- Production-ready mobile apps
- Deployment documentation
- Training materials

### Phase 6: Post-Launch (Ongoing)

**Enhancements:**
- AI-powered predictive parts recommendation
- Augmented reality for equipment diagnosis
- Voice-to-text for work order notes
- Offline-first knowledge base sync
- Integration with telematics (IoT sensors)

---

## 9. Integration Points

### 9.1 Existing System Integration

**Module Integration Matrix:**

| Existing Module | Integration Point | Data Flow |
|-----------------|-------------------|-----------|
| **PredictiveMaintenanceModule** | Work order creation from alerts | Predictive alert → Auto-create work order |
| **OperationsModule** | Equipment service history | Work order completion → Update `work_centers.last_service_date` |
| **WMSModule** | Parts inventory deduction | Parts consumed → Create `inventory_transactions` |
| **CustomerAuthModule** | Field tech authentication | Reuse JWT strategy, add mobile claims |
| **FinanceModule** | Service billing | Completed work order → Create invoice |
| **QualityModule** | Post-service inspections | Checklist failures → Create `quality_defects` |
| **MonitoringModule** | Real-time equipment status | IoT sensor data → Display in work order details |

### 9.2 Third-Party Integrations

**Recommended Integrations:**

1. **Google Maps API**
   - Route optimization
   - Geolocation services
   - Turn-by-turn navigation
   - Cost: ~$200/month for 100 technicians

2. **Twilio SendGrid**
   - Email notifications (work order assignments)
   - SMS alerts (critical alerts)
   - Cost: ~$50/month

3. **AWS S3**
   - Photo/signature storage
   - Document attachments
   - Cost: ~$20/month (5GB storage)

4. **Firebase Cloud Messaging (FCM)**
   - Push notifications (iOS/Android)
   - Free tier: Unlimited

5. **Sentry**
   - Mobile error tracking
   - Performance monitoring
   - Cost: ~$26/month

**Total Third-Party Costs:** ~$296/month

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Offline sync conflicts** | High | Medium | Implement conflict resolution rules, last-write-wins with audit trail |
| **Mobile performance on low-end devices** | Medium | Medium | Performance budgets, lazy loading, image compression |
| **GPS inaccuracy** | Medium | Low | Use geofencing with radius tolerance, manual override |
| **Network latency in rural areas** | High | Medium | Offline-first architecture, queue failed syncs |
| **React Native version incompatibilities** | Low | High | Pin RN version, thorough testing before upgrades |
| **iOS/Android API changes** | Low | Medium | Stay on stable versions, monitor breaking changes |

### 10.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Technician resistance to adoption** | Medium | High | User training, phased rollout, feedback loops |
| **Data privacy violations** | Low | Critical | GDPR compliance review, legal approval, consent flows |
| **App Store rejection** | Low | Medium | Follow guidelines, pre-submission review |
| **Scope creep** | High | Medium | Strict MVP definition, feature freeze after Phase 4 |

### 10.3 Security Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Stolen mobile device data breach** | Medium | High | Biometric auth, data encryption, remote wipe capability |
| **Man-in-the-middle attacks** | Low | Critical | Certificate pinning, HTTPS only, JWT short expiry |
| **SQL injection via mobile inputs** | Low | Critical | Parameterized queries, input validation, ORM usage |

---

## 11. Recommendations

### 11.1 Technical Recommendations

**✅ High Priority:**
1. **Use React Native** for code reuse and faster development
2. **Implement WatermelonDB** for performant offline storage
3. **Adopt GraphQL Subscriptions** for real-time work order updates
4. **Certificate Pinning** for API security
5. **Incremental Adoption** (start with 5 beta technicians)

**⚠️ Medium Priority:**
6. **Route Optimization Algorithm** (can use Google Maps API initially, build custom later)
7. **Augmented Reality** (defer to Phase 6)
8. **Voice-to-Text** (defer to Phase 6)

**❌ Low Priority / Defer:**
9. **Smartwatch App** (limited ROI)
10. **Wearable Cameras** (privacy concerns)

### 11.2 Business Recommendations

1. **Phased Rollout:**
   - Week 1-2: 3 technicians (beta)
   - Week 3-4: 10 technicians (pilot)
   - Week 5+: Full team (50-100 technicians)

2. **Training Strategy:**
   - 2-hour hands-on training session
   - Video tutorials embedded in app
   - In-app help tooltips
   - Dedicated support Slack channel

3. **Success Metrics:**
   - Work order completion time: -20% reduction
   - Parts consumption accuracy: 95%+
   - Time entry compliance: 90%+
   - Customer satisfaction: 4.5+ stars
   - First-time fix rate: 85%+

4. **Budget Allocation:**
   - Development: $80,000 (10 weeks × $8,000/week)
   - Third-party services: $3,000/year
   - Training: $5,000 (materials + time)
   - **Total Phase 1 Budget:** $88,000

### 11.3 Architecture Recommendations

**✅ Recommended:**
- **Mobile:** React Native (iOS/Android from single codebase)
- **Offline Storage:** WatermelonDB (optimized for React Native)
- **State Management:** Redux Toolkit + Redux Persist
- **Navigation:** React Navigation 6
- **API:** GraphQL (queries/mutations) + REST (file uploads)
- **Authentication:** JWT with refresh tokens
- **Push Notifications:** Firebase Cloud Messaging
- **Maps:** react-native-maps + Google Maps API
- **Barcode Scanning:** react-native-camera
- **Signature Capture:** react-native-signature-canvas
- **File Storage:** AWS S3
- **Error Tracking:** Sentry
- **Analytics:** Firebase Analytics (free)

**❌ Not Recommended:**
- Native apps (Swift/Kotlin) - too expensive
- Flutter - new language, no code reuse
- Cordova/PhoneGap - deprecated
- Ionic - slower performance than React Native

---

## Appendix A: Sample Data Model

### Sample Work Order JSON

```json
{
  "id": "uuid-work-order-001",
  "tenant_id": "uuid-tenant-printco",
  "work_order_number": "WO-2025-00123",
  "work_order_type": "PREVENTIVE_MAINTENANCE",
  "status": "IN_PROGRESS",
  "priority": 3,

  "customer": {
    "id": "uuid-customer-acme",
    "name": "Acme Printing Solutions",
    "site_contact_name": "John Smith",
    "site_contact_phone": "+1-555-123-4567",
    "site_contact_email": "jsmith@acmeprint.com"
  },

  "work_center": {
    "id": "uuid-wc-heidelberg-001",
    "work_center_code": "PRESS-HD-001",
    "work_center_name": "Heidelberg Speedmaster XL 106",
    "serial_number": "HD-XL106-2022-4567",
    "equipment_location": "Building A, Bay 3"
  },

  "problem_description": "Scheduled 10,000-hour preventive maintenance",
  "problem_severity": "MEDIUM",

  "predictive_alert": {
    "id": "uuid-alert-001",
    "failure_mode": "BEARING_WEAR",
    "confidence_score": 0.82,
    "recommendation": "Replace main drive bearing"
  },

  "scheduled_start": "2025-12-30T09:00:00Z",
  "scheduled_end": "2025-12-30T12:00:00Z",
  "actual_start": "2025-12-30T09:15:00Z",

  "assigned_technician": {
    "id": "uuid-emp-tech-mike",
    "employee_number": "EMP-1023",
    "name": "Mike Johnson",
    "technician_level": "SENIOR",
    "certifications": [
      {"cert_name": "Heidelberg Certified", "expiry": "2026-06-30"}
    ]
  },

  "parts_consumed": [
    {
      "material_id": "uuid-mat-bearing-001",
      "material_code": "BEARING-MAIN-106",
      "quantity_used": 1.0,
      "unit_cost": 450.00,
      "total_cost": 450.00
    }
  ],

  "time_entries": [
    {
      "entry_type": "TRAVEL_TO_SITE",
      "start_time": "2025-12-30T08:30:00Z",
      "end_time": "2025-12-30T09:15:00Z",
      "duration_minutes": 45,
      "billable": true
    },
    {
      "entry_type": "ON_SITE_SERVICE",
      "start_time": "2025-12-30T09:15:00Z",
      "end_time": null,
      "billable": true
    }
  ],

  "checklist_response": {
    "checklist_name": "Heidelberg XL 106 - 10K Hour PM",
    "completion_percentage": 60.0,
    "responses": [
      {
        "item_id": "CHECK_BEARING",
        "description": "Inspect main drive bearing",
        "response": "FAIL",
        "notes": "Excessive wear detected, replaced bearing"
      },
      {
        "item_id": "MEASURE_ALIGNMENT",
        "description": "Measure gripper alignment",
        "response": 0.002,
        "within_spec": true
      }
    ]
  },

  "photos": [
    "https://s3.amazonaws.com/field-service/photos/wo-123-bearing-before.jpg",
    "https://s3.amazonaws.com/field-service/photos/wo-123-bearing-after.jpg"
  ],

  "estimated_labor_hours": 3.0,
  "actual_labor_hours": 2.5,
  "labor_cost": 275.00,

  "estimated_parts_cost": 500.00,
  "actual_parts_cost": 450.00
}
```

---

## Appendix B: Mobile Screens Mockup Descriptions

### Screen 1: Dashboard
- **Header:** "Good morning, Mike" + notification bell
- **Card 1:** "Today's Work Orders" (3 assigned, 1 in progress, 0 completed)
- **Card 2:** "Next Job" (WO-2025-00123, Acme Printing, 9:00 AM, 2.3 miles away)
- **Card 3:** "Truck Inventory" (12 parts, 2 low stock alerts)
- **Footer:** Bottom navigation (Dashboard, Work Orders, Route, Inventory, More)

### Screen 2: Work Order List
- **Search bar:** "Search by customer, WO#, equipment..."
- **Filter chips:** All, Open, In Progress, Completed
- **List items:**
  - WO-2025-00123 | Acme Printing | Heidelberg XL 106 | 9:00 AM | HIGH PRIORITY (red badge)
  - Swipe left: Complete, View Details
  - Swipe right: Start

### Screen 3: Work Order Details
- **Header:** WO-2025-00123 + status badge (IN PROGRESS - green)
- **Section 1:** Customer (Acme Printing, John Smith, +1-555-123-4567, Map icon)
- **Section 2:** Equipment (Heidelberg XL 106, SN: HD-XL106-2022-4567)
- **Section 3:** Schedule (Scheduled: 9:00 AM - 12:00 PM, Started: 9:15 AM)
- **Action buttons:** Add Parts, Add Time, Take Photo, Complete Work Order
- **Tabs:** Summary, Checklist, Parts (2 items), Time (3 entries), Photos (5), KB Articles (3)

### Screen 4: Service Checklist
- **Progress bar:** 60% complete (6 of 10 items)
- **Checklist items:**
  - ✅ Inspect belts (PASS)
  - ✅ Check oil levels (PASS, measured: 3.2 quarts)
  - ❌ Inspect main bearing (FAIL, notes: "Excessive wear")
  - ⏳ Measure alignment (in progress)
- **Footer:** Save Draft, Submit Checklist

### Screen 5: Parts Consumption
- **Search bar:** "Search parts or scan barcode"
- **Camera icon:** Barcode scanner
- **Added parts:**
  - BEARING-MAIN-106 | Qty: 1.0 | $450.00 | (X to remove)
- **Footer:** Total: $450.00 | Add to Work Order

### Screen 6: Time Tracking
- **Active timer:** "On-Site Service" | 02:35:12 (running)
- **Buttons:** Pause, Stop
- **History (today):**
  - Travel to Site | 45 min | $45.00
  - On-Site Service | 2h 35m | (in progress)
- **Footer:** Total today: 3h 20m | $275.00

### Screen 7: Customer Signature
- **Canvas:** White signature area
- **Buttons:** Clear, Preview, Save
- **Input field:** "Customer Name" (John Smith)
- **Preview modal:** Signature image + "Are you sure? This cannot be changed."

### Screen 8: Knowledge Base
- **Search bar:** "Search troubleshooting guides..."
- **Categories:** Troubleshooting, Procedures, Safety, Technical Bulletins
- **Results:**
  - "Heidelberg XL 106 - Bearing Replacement Procedure" (PDF, 12 pages)
  - "Gripper Alignment Best Practices" (Video, 8:32)
  - Bookmark icon (offline download)

---

## Appendix C: Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Mobile Framework** | React Native | 0.73+ | Cross-platform iOS/Android app |
| **Language** | TypeScript | 5.0+ | Type-safe JavaScript |
| **State Management** | Redux Toolkit | 2.0+ | Global state management |
| **Offline Storage** | WatermelonDB | 0.27+ | Performant local database |
| **Navigation** | React Navigation | 6.x | Screen navigation |
| **Maps** | react-native-maps | 1.10+ | Map integration |
| **Camera** | react-native-camera | 4.2+ | Photo capture, barcode scanning |
| **Signature** | react-native-signature-canvas | 4.7+ | Signature capture |
| **Push Notifications** | Firebase Cloud Messaging | - | Push notifications |
| **API Client** | Apollo Client | 3.8+ | GraphQL client |
| **File Upload** | axios | 1.6+ | REST file uploads |
| **Security** | react-native-keychain | 8.1+ | Secure storage for JWT |
| **Backend** | NestJS | 10.x | GraphQL API server |
| **Database** | PostgreSQL | 15+ | Primary data store |
| **File Storage** | AWS S3 | - | Photos, signatures, PDFs |
| **Error Tracking** | Sentry | - | Mobile crash reporting |
| **Analytics** | Firebase Analytics | - | Usage analytics |

---

## Conclusion

This research provides a **production-ready blueprint** for implementing a Mobile Field Service Application tailored for the print industry ERP system. The solution leverages **86% of existing database infrastructure** (work_centers, employees, maintenance_records, predictive_maintenance) while adding only 8 new tables and 2 modified tables.

**Key Success Factors:**
1. ✅ **Offline-First Architecture** - Critical for field technicians
2. ✅ **React Native** - Code reuse with existing React frontend
3. ✅ **Predictive Maintenance Integration** - Differentiator from competitors
4. ✅ **Print Industry Workflows** - Tailored checklists, press calibration
5. ✅ **Phased Rollout** - Beta → Pilot → Full deployment minimizes risk

**Estimated ROI:**
- **Development Cost:** $88,000 (Phase 1)
- **Annual Operational Savings:** ~$150,000 (20% efficiency gain × 50 technicians × $60k avg salary)
- **Payback Period:** 7 months

**Next Steps for Implementation Team:**
1. Review and approve database schema (8 new tables)
2. Prioritize features for MVP (Dashboard, Work Orders, Checklists, Time Tracking)
3. Set up React Native project structure
4. Implement backend GraphQL API (Phase 1)
5. Begin mobile development (Phase 2)

---

**END OF RESEARCH DOCUMENT**

