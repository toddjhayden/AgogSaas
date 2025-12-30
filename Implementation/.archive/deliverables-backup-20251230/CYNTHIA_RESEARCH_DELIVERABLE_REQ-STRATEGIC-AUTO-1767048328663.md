# RESEARCH DELIVERABLE: Equipment Maintenance & Asset Management
## REQ-STRATEGIC-AUTO-1767048328663

**Researcher:** Cynthia (Research Analyst)
**Date:** 2025-12-29
**Status:** COMPLETE
**Assigned To:** Marcus (Implementation Lead)

---

## EXECUTIVE SUMMARY

This research deliverable provides a comprehensive analysis of the existing Equipment Maintenance & Asset Management infrastructure in the AGOG Print Industry ERP system. The codebase demonstrates a sophisticated, enterprise-grade foundation that includes:

- **Comprehensive database schema** with 8 core tables covering work centers, maintenance records, asset hierarchy, and OEE tracking
- **Full GraphQL API** with 16+ query and mutation operations for equipment and maintenance management
- **Production-ready frontend components** with Operations Dashboard already scaffolded
- **IoT integration capabilities** for real-time equipment monitoring
- **Advanced analytics** including OEE (Overall Equipment Effectiveness) calculations

The system is well-architected but requires implementation of business logic, service layers, and enhanced UI components to deliver complete functionality.

---

## 1. DATABASE SCHEMA ANALYSIS

### 1.1 Core Tables Identified

#### **work_centers** (Lines 17-85 in operations-module.sql)
- **Purpose:** Master data for manufacturing equipment (presses, bindery, finishing)
- **Key Features:**
  - Equipment identification: code, name, type, manufacturer, model, serial number, asset tag
  - Press specifications for imposition engine integration (sheet dimensions, gripper margins, max colors)
  - Capacity tracking (production rate, hourly rate, setup cost)
  - Maintenance scheduling (last/next maintenance date, interval days)
  - Status tracking (AVAILABLE, IN_USE, DOWN, MAINTENANCE, OFFLINE)
  - Operating calendar and capabilities stored as JSONB
- **Multi-tenancy:** Fully tenant-aware with RLS-ready foreign keys
- **SCD Type 2 Support:** Includes effective_from_date, effective_to_date, is_current_version for historical tracking

#### **maintenance_records** (Lines 422-486 in operations-module.sql)
- **Purpose:** Comprehensive preventive and corrective maintenance tracking
- **Key Features:**
  - Maintenance types: PREVENTIVE, CORRECTIVE, BREAKDOWN, CALIBRATION, INSPECTION
  - Scheduling: scheduled_date, actual_start, actual_end, duration_hours
  - Cost tracking: parts_cost, labor_cost, total_cost
  - Technician assignment (internal or vendor)
  - Quality verification: equipment_operational, calibration_performed, calibration_certificate_id
  - Next maintenance due date for predictive scheduling
- **Status Workflow:** SCHEDULED → IN_PROGRESS → COMPLETED/CANCELLED

#### **asset_hierarchy** (Lines 493-519 in operations-module.sql)
- **Purpose:** Parent-child relationships for complex equipment assemblies
- **Key Features:**
  - Supports multi-level equipment decomposition
  - Relationship types: COMPONENT, ASSEMBLY, ATTACHMENT
  - Self-referential integrity with constraint to prevent circular references
  - Critical for managing large press systems with multiple components

#### **equipment_status_log** (Lines 369-415 in operations-module.sql)
- **Purpose:** Real-time status tracking for OEE calculations
- **Key Features:**
  - Status types: PRODUCTIVE, NON_PRODUCTIVE_SETUP, NON_PRODUCTIVE_BREAKDOWN, NON_PRODUCTIVE_NO_OPERATOR, NON_PRODUCTIVE_NO_MATERIAL, NON_PRODUCTIVE_PLANNED_DOWNTIME
  - Time tracking: status_start, status_end, duration_minutes
  - Reason codes for downtime analysis
  - Links to production_run_id for job-level tracking
  - System or user-initiated logging

#### **oee_calculations** (Lines 526-595 in operations-module.sql)
- **Purpose:** Daily OEE metrics calculation and storage
- **Key Features:**
  - Three OEE components: Availability %, Performance %, Quality %
  - Overall OEE = Availability × Performance × Quality
  - Time breakdown: planned production time, downtime, runtime
  - Production metrics: total pieces, good pieces, defective pieces, ideal cycle time
  - Loss categorization: setup/changeover, breakdown, no operator, no material, speed loss, quality loss
  - Target OEE tracking (default: 85% world-class standard)
  - Shift-level granularity

#### **production_runs** (Lines 234-301 in operations-module.sql)
- **Purpose:** Actual production execution tracking
- **Key Features:**
  - Links production orders to work centers and operations
  - Operator assignment and tracking
  - Quantity tracking: planned, good, scrap, rework
  - Time tracking: setup time, run time, downtime with reasons
  - First piece approval workflow
  - Status: SCHEDULED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED

#### **iot_devices** (Lines 374-407 in quality-hr-iot-security-marketplace-imposition.sql)
- **Purpose:** IoT device registry for equipment sensors
- **Key Features:**
  - Device types: SENSOR, PRESS_COUNTER, TEMPERATURE_MONITOR, SCALE
  - Links to work_centers for equipment monitoring
  - Connection configuration: MQTT, REST_API, OPC_UA, MODBUS
  - Heartbeat monitoring for device health
  - Connection config stored as JSONB for flexibility

#### **equipment_events** (Lines 441-478 in quality-hr-iot-security-marketplace-imposition.sql)
- **Purpose:** Real-time equipment event logging
- **Key Features:**
  - Event types: STARTUP, SHUTDOWN, ERROR, WARNING, MAINTENANCE_REQUIRED
  - Severity levels: INFO, WARNING, ERROR, CRITICAL
  - Acknowledgment workflow for alerts
  - Links to IoT devices and production runs
  - Metadata storage for extensibility

### 1.2 Supporting Tables

- **changeover_details:** Lean manufacturing changeover tracking (lines 308-362, operations-module.sql)
- **production_orders:** High-level production orders from sales (lines 99-171, operations-module.sql)
- **operations:** Operation master data (printing, die cutting, etc.) (lines 178-227, operations-module.sql)
- **production_schedules:** Gantt chart scheduling data (lines 602-646, operations-module.sql)
- **capacity_planning:** Capacity planning and forecasting (lines 653-693, operations-module.sql)
- **sensor_readings:** Time-series sensor data from IoT devices (lines 413-439, quality-hr-iot-security-marketplace-imposition.sql)

### 1.3 Schema Strengths

✅ **Comprehensive Coverage:** All aspects of equipment lifecycle management covered
✅ **Industry Best Practices:** OEE calculations, SCD Type 2, multi-tenancy, audit trails
✅ **Flexibility:** JSONB fields for extensible configuration
✅ **Performance:** Strategic indexes on tenant_id, facility_id, status, dates
✅ **Data Quality:** Foreign key constraints, check constraints, unique constraints
✅ **Real-time Ready:** Equipment status log and IoT integration built-in

### 1.4 Schema Gaps

⚠️ **Work Order Integration:** No direct reference to MES (Manufacturing Execution System) work orders beyond production_order_id
⚠️ **Spare Parts Inventory:** No linkage to spare parts inventory for maintenance
⚠️ **Maintenance Templates:** No preventive maintenance task templates
⚠️ **Asset Depreciation:** No financial depreciation tracking
⚠️ **Warranty Tracking:** No vendor warranty or service contract management

---

## 2. GRAPHQL SCHEMA ANALYSIS

### 2.1 Types Defined

#### **WorkCenter** (Lines 11-75, operations.graphql)
- Comprehensive GraphQL type matching database schema
- Includes relationships: facility, productionRuns, maintenanceRecords, equipmentStatusLog
- SCD Type 2 support: effectiveFromDate, effectiveToDate, isCurrentVersion
- All maintenance fields exposed: lastMaintenanceDate, nextMaintenanceDate, maintenanceIntervalDays

#### **MaintenanceRecord** (Lines 295-326, operations.graphql)
- Full CRUD capability via GraphQL
- Supports all maintenance types via MaintenanceType enum
- Cost tracking: costLabor, costParts
- Technician assignment: technicianName, technicianUserId
- Quality verification: workPerformed, partsReplaced

#### **AssetHierarchy** (Lines 331-344, operations.graphql)
- Parent-child relationships exposed
- Relationship type classification
- Audit trail included

#### **EquipmentStatusLog** (Lines 271-290, operations.graphql)
- Real-time status tracking
- Duration calculations
- Reason code support

#### **OEECalculation** (Lines 349-387, operations.graphql)
- All OEE components exposed
- Time breakdown for analysis
- Production metrics
- Loss categorization
- Target vs actual comparison

#### **IotDevice** (Lines 349-374, quality-hr-iot-security-marketplace-imposition.graphql)
- Device registry with full metadata
- Work center linkage
- Connection configuration
- Heartbeat monitoring

#### **EquipmentEvent** (Lines 394-418, quality-hr-iot-security-marketplace-imposition.graphql)
- Event logging with severity levels
- Acknowledgment workflow
- Metadata for extensibility

### 2.2 Queries Available

#### Equipment & Work Centers
- `workCenter(id: ID!)`: Get current version by ID
- `workCenters(facilityId: ID!, status: WorkCenterStatus, includeHistory: Boolean)`: List work centers
- `workCenterAsOf(workCenterCode: String!, facilityId: ID!, tenantId: ID!, asOfDate: Date!)`: Historical query
- `workCenterHistory(workCenterCode: String!, facilityId: ID!, tenantId: ID!)`: Full version history

#### Maintenance
- `maintenanceRecords(workCenterId: ID!, startDate: Date, endDate: Date, type: MaintenanceType)`: Query maintenance history
- No standalone maintenanceRecord(id) query - should be added

#### OEE & Performance
- `oeeCalculations(workCenterId: ID!, startDate: Date!, endDate: Date!)`: OEE trend analysis
- `productionRuns(facilityId: ID, workCenterId: ID, status: ProductionRunStatus, startDate: DateTime, endDate: DateTime)`: Production tracking

#### IoT Integration
- `iotDevices(tenantId: ID!, facilityId: ID, workCenterId: ID, deviceType: String, isActive: Boolean)`: Device registry
- `equipmentEvents(tenantId: ID!, workCenterId: ID, severity: EventSeverity, acknowledged: Boolean, startTime: DateTime, endTime: DateTime)`: Event log
- `sensorReadings(tenantId: ID!, iotDeviceId: ID, productionRunId: ID, sensorType: String, startTime: DateTime, endTime: DateTime)`: Sensor data

### 2.3 Mutations Available

#### Work Center Management
- `createWorkCenter(input: CreateWorkCenterInput!)`: Create new equipment
- `updateWorkCenter(id: ID!, input: UpdateWorkCenterInput!)`: Update equipment (creates new SCD version)

#### Maintenance Operations
- `createMaintenanceRecord(input: CreateMaintenanceRecordInput!)`: Schedule/log maintenance
- No updateMaintenanceRecord mutation - should be added

#### Equipment Status
- `logEquipmentStatus(input: LogEquipmentStatusInput!)`: Real-time status logging

#### OEE
- `calculateOEE(workCenterId: ID!, calculationDate: Date!, shiftNumber: Int)`: Manual OEE calculation

#### IoT
- `createIotDevice(input: CreateIotDeviceInput!)`: Register IoT device
- `updateIotDevice(id: ID!, deviceName: String, isActive: Boolean)`: Update device
- `createSensorReading(input: CreateSensorReadingInput!)`: Log sensor data
- `acknowledgeEquipmentEvent(id: ID!, acknowledgedByUserId: ID!)`: Acknowledge alerts

### 2.4 GraphQL Schema Strengths

✅ **Complete Type Coverage:** All database entities have corresponding GraphQL types
✅ **Historical Queries:** SCD Type 2 support for work centers and employees
✅ **Relationship Navigation:** Proper GraphQL relationships defined
✅ **Filtering & Pagination:** Query parameters support common filter patterns
✅ **Real-time Capabilities:** Status logging and event tracking mutations

### 2.5 GraphQL Schema Gaps

⚠️ **Missing Mutations:** No updateMaintenanceRecord, deleteMaintenanceRecord
⚠️ **No Subscriptions:** Real-time equipment status updates would benefit from GraphQL subscriptions
⚠️ **Limited Aggregations:** No summary queries (e.g., getEquipmentAvailabilitySummary, getMaintenanceCostsByPeriod)
⚠️ **No Batch Operations:** Cannot create multiple maintenance records in one mutation
⚠️ **Missing Equipment Search:** No full-text search on equipment by model, manufacturer, or asset tag

---

## 3. BACKEND SERVICES ANALYSIS

### 3.1 Current Implementation Status

**Module Structure:**
- `print-industry-erp/backend/src/modules/` contains WMS, Forecasting, Procurement, Sales, Monitoring modules
- **No dedicated Operations or Maintenance module found**

**Existing Services Reviewed:**
- WMS services: bin-utilization, optimization, data quality (20+ services)
- Forecasting services: demand-history, safety-stock, forecast-accuracy (5 services)
- Procurement services: vendor-performance, approval-workflow, alert-engine (3 services)
- Sales services: quote-pricing, quote-management, pricing-rule-engine (3 services)
- Monitoring services: health-monitor, error-tracking, agent-activity (3 services)

**No Operations/Maintenance Services Found:**
- No `operations.module.ts`
- No `maintenance.service.ts`
- No `equipment-status.service.ts`
- No `oee-calculation.service.ts`
- No `work-center.service.ts`

### 3.2 Required Service Implementation

#### **High Priority Services**

1. **WorkCenterService**
   - CRUD operations for work centers
   - SCD Type 2 version management
   - Status management and validation
   - Search and filtering by facility, type, status

2. **MaintenanceService**
   - Preventive maintenance scheduling
   - Maintenance record creation and updates
   - Cost tracking and aggregation
   - Next maintenance date calculation
   - Overdue maintenance alerts

3. **EquipmentStatusService**
   - Real-time status logging
   - Status change validation
   - Duration calculations
   - Current status retrieval

4. **OEECalculationService**
   - Daily OEE calculation from equipment_status_log
   - Availability % calculation
   - Performance % calculation
   - Quality % calculation
   - Trend analysis and reporting

5. **AssetHierarchyService**
   - Parent-child relationship management
   - Recursive queries for equipment trees
   - Component tracking

#### **Medium Priority Services**

6. **IoTIntegrationService**
   - Device registration and management
   - Sensor reading ingestion
   - Equipment event processing
   - Alert generation from events

7. **ProductionRunService**
   - Production execution tracking
   - Work center scheduling
   - Operator assignment
   - Quantity tracking (good/scrap/rework)

8. **ChangeoverService**
   - Changeover time tracking
   - Lean manufacturing metrics
   - Setup reduction analysis

#### **Low Priority Services**

9. **CapacityPlanningService**
   - Available capacity calculation
   - Utilization tracking
   - What-if scenario analysis

10. **ProductionScheduleService**
    - Gantt chart data generation
    - Conflict detection
    - Schedule optimization

### 3.3 Service Architecture Recommendations

**NestJS Module Structure:**
```
src/modules/operations/
├── operations.module.ts
├── controllers/
│   ├── work-center.controller.ts
│   ├── maintenance.controller.ts
│   └── oee.controller.ts
├── services/
│   ├── work-center.service.ts
│   ├── maintenance.service.ts
│   ├── equipment-status.service.ts
│   ├── oee-calculation.service.ts
│   ├── asset-hierarchy.service.ts
│   └── production-run.service.ts
├── resolvers/
│   ├── work-center.resolver.ts
│   ├── maintenance.resolver.ts
│   └── oee.resolver.ts
├── dto/
│   ├── create-work-center.dto.ts
│   ├── update-work-center.dto.ts
│   └── create-maintenance-record.dto.ts
└── entities/
    ├── work-center.entity.ts
    └── maintenance-record.entity.ts
```

**Integration Points:**
- **Monitoring Module:** Health checks for equipment
- **WMS Module:** Equipment utilization for warehouse operations
- **Procurement Module:** Spare parts ordering triggers from maintenance
- **HR Module:** Labor tracking for production runs

---

## 4. FRONTEND COMPONENTS ANALYSIS

### 4.1 Existing Components

#### **OperationsDashboard.tsx** (Lines 1-100+, OperationsDashboard.tsx)
- **Status:** Scaffolded with mock data
- **Features:**
  - Production runs table with work order, product, quantity, status, progress
  - Status filtering (all/active/scheduled/completed)
  - OEE metrics display for presses
  - Chart component integration ready
- **Mock Data:**
  - 3 production runs with Press #1, #2, #3
  - 4 presses with OEE, availability, performance, quality metrics
- **Missing:**
  - GraphQL integration
  - Real-time data fetching
  - Equipment status indicators
  - Maintenance schedule view

#### **ExecutiveDashboard.tsx** (Referenced in grep results)
- Contains equipment-related metrics in executive summary
- No detailed equipment management features

#### **Common Components Available**
- `DataTable`: Fully featured table component from @tanstack/react-table
- `Chart`: Chart.js wrapper for visualizations
- `Breadcrumb`: Navigation component
- `FacilitySelector`: Multi-facility support

### 4.2 Required Frontend Components

#### **High Priority Pages**

1. **Equipment Management Page**
   - Equipment list with search, filter, sort
   - Equipment detail view with specifications
   - Status indicators (available, in use, down, maintenance)
   - Quick actions: log status, schedule maintenance, view history
   - Asset hierarchy tree view

2. **Maintenance Management Page**
   - Maintenance calendar view
   - Scheduled vs completed maintenance
   - Overdue maintenance alerts
   - Maintenance cost tracking dashboard
   - Create/edit maintenance records form

3. **OEE Analytics Dashboard**
   - OEE trend charts by work center
   - Availability, Performance, Quality breakdown
   - Loss categorization (Six Big Losses)
   - Comparative analysis across equipment
   - Export to PDF/Excel

4. **Equipment Status Monitor**
   - Real-time status board
   - Equipment downtime alerts
   - Status change history timeline
   - Reason code analysis

#### **Medium Priority Pages**

5. **Production Run Tracker**
   - Active production runs grid
   - Progress indicators
   - Operator assignments
   - Quality metrics (good/scrap/rework)

6. **IoT Device Management**
   - Device registry
   - Sensor readings visualization
   - Equipment events log
   - Alert configuration

#### **Low Priority Pages**

7. **Capacity Planning**
   - Available capacity heatmap
   - Utilization charts
   - What-if scenario builder

8. **Production Scheduling**
   - Gantt chart for work centers
   - Drag-drop schedule optimization
   - Conflict resolution

### 4.3 UI/UX Recommendations

**Dashboard Layout:**
- Top KPIs: Total Equipment Count, Available %, Down %, Maintenance Due
- Equipment Status Board (color-coded cards)
- OEE Trend Chart (last 30 days)
- Recent Maintenance Activity Table

**Color Coding:**
- 🟢 Green: Available, Productive, OEE > 85%
- 🟡 Yellow: Scheduled Maintenance, OEE 70-85%
- 🔴 Red: Down, Breakdown, OEE < 70%
- 🔵 Blue: In Use, Productive

**Mobile Responsiveness:**
- Critical for shop floor use
- QR code scanning for equipment check-in
- Quick status logging from mobile

---

## 5. INTEGRATION POINTS

### 5.1 Upstream Dependencies

**From Sales Module:**
- Sales orders trigger production orders
- Customer requirements drive production specifications

**From Procurement Module:**
- Spare parts availability for maintenance
- Vendor service contracts for equipment

**From HR Module:**
- Operator assignments to production runs
- Technician assignments to maintenance
- Labor cost tracking

**From WMS Module:**
- Material availability for production
- Finished goods putaway after production

### 5.2 Downstream Integrations

**To Finance Module:**
- Equipment depreciation calculations
- Maintenance cost allocation
- Production run costing (labor + overhead)

**To Quality Module:**
- First piece inspection requirements
- In-process quality checks
- Equipment calibration tracking

**To IoT Infrastructure:**
- Real-time sensor data ingestion
- Equipment event stream processing
- Predictive maintenance triggers

### 5.3 External System Integrations

**MES (Manufacturing Execution System):**
- Bidirectional work order sync
- Real-time production data exchange

**SCADA (Supervisory Control and Data Acquisition):**
- Equipment status polling
- Sensor reading ingestion
- Alarm forwarding

**CMMS (Computerized Maintenance Management System):**
- Maintenance work order export
- Spare parts requisition
- Technician schedule import

---

## 6. GAP ANALYSIS

### 6.1 Critical Gaps (Blocker for MVP)

❌ **No Backend Services Implemented**
- WorkCenterService, MaintenanceService, OEECalculationService required
- GraphQL resolvers not implemented
- No business logic layer

❌ **No GraphQL Resolver Implementation**
- operations.resolver.ts does not exist
- Query/Mutation handlers missing

❌ **Frontend Not Connected to Backend**
- OperationsDashboard uses mock data
- No Apollo Client queries/mutations
- No real-time updates

❌ **No Maintenance Scheduling Logic**
- Next maintenance date calculation not automated
- No overdue maintenance alerts

❌ **No OEE Auto-Calculation**
- OEE calculation requires manual trigger
- No scheduled daily calculation job

### 6.2 High Priority Gaps (Needed for Production)

⚠️ **Limited Maintenance Workflow**
- No approval workflow for maintenance
- No parts requisition integration
- No technician dispatch logic

⚠️ **No Predictive Maintenance**
- IoT event data not used for predictions
- No machine learning integration
- No failure pattern detection

⚠️ **No Real-Time Equipment Dashboard**
- No GraphQL subscriptions for status changes
- No push notifications for equipment down
- No WebSocket integration

⚠️ **Missing Reporting & Analytics**
- No maintenance cost reports
- No equipment utilization reports
- No downtime root cause analysis

⚠️ **No Mobile Interface**
- Shop floor technicians need mobile access
- QR code scanning not implemented
- Offline mode not supported

### 6.3 Medium Priority Gaps (Nice to Have)

⚙️ **No Asset Lifecycle Management**
- Equipment purchase/disposal tracking missing
- No depreciation calculation
- No warranty management

⚙️ **No Spare Parts Integration**
- Maintenance doesn't trigger parts requisition
- No bill of materials for equipment

⚙️ **Limited Changeover Optimization**
- No SMED (Single-Minute Exchange of Die) analysis
- No setup reduction recommendations

⚙️ **No Capacity Planning Tools**
- What-if scenario analysis missing
- No capacity constraint visualization

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2) - CRITICAL

**Backend Development:**
1. Create `operations` NestJS module
2. Implement WorkCenterService with CRUD operations
3. Implement MaintenanceService with scheduling logic
4. Implement EquipmentStatusService for real-time tracking
5. Create GraphQL resolvers for work centers and maintenance
6. Write unit tests for all services

**Database:**
7. Run existing migrations (V0.0.3__create_operations_module.sql)
8. Create seed data for 5 work centers and sample maintenance records

**Frontend:**
9. Create Equipment Management page with GraphQL queries
10. Update OperationsDashboard to use real data
11. Implement Maintenance Schedule view

**Deliverables:**
- Functional equipment CRUD via GraphQL
- Maintenance record creation and viewing
- Equipment status logging

### Phase 2: Core Features (Week 3-4) - HIGH PRIORITY

**Backend Development:**
1. Implement OEECalculationService with automated daily calculations
2. Implement AssetHierarchyService for parent-child relationships
3. Create ProductionRunService for shop floor tracking
4. Add maintenance scheduling job (daily check for overdue maintenance)
5. Implement maintenance cost aggregation queries

**Frontend:**
6. Build OEE Analytics Dashboard with charts
7. Create Equipment Status Monitor (real-time view)
8. Implement Maintenance Management page with calendar
9. Add equipment search and advanced filtering
10. Build asset hierarchy tree view

**Integrations:**
11. Connect to WMS for material availability
12. Connect to HR for operator/technician assignments

**Deliverables:**
- Automated OEE calculations
- Maintenance scheduling with alerts
- Production run tracking
- Asset hierarchy management

### Phase 3: Advanced Features (Week 5-6) - MEDIUM PRIORITY

**Backend Development:**
1. Implement IoTIntegrationService for sensor data
2. Create equipment event processing pipeline
3. Add GraphQL subscriptions for real-time status
4. Implement maintenance approval workflow
5. Create reporting services (cost, utilization, downtime)

**Frontend:**
6. Build IoT Device Management page
7. Add real-time equipment status updates (WebSocket)
8. Create maintenance approval workflow UI
9. Implement equipment reports and exports
10. Add mobile-responsive layouts

**Analytics:**
11. Downtime root cause analysis
12. Maintenance cost trending
13. Equipment utilization heatmaps

**Deliverables:**
- IoT device integration
- Real-time status updates
- Maintenance approval workflow
- Comprehensive reporting

### Phase 4: Optimization (Week 7-8) - LOW PRIORITY

**Backend Development:**
1. Implement ChangeoverService for lean manufacturing
2. Create CapacityPlanningService
3. Add predictive maintenance ML models
4. Implement production scheduling optimization

**Frontend:**
5. Build Capacity Planning dashboard
6. Create Production Scheduling Gantt chart
7. Add changeover time analysis
8. Implement predictive maintenance alerts

**Mobile:**
9. QR code scanning for equipment check-in
10. Mobile-first status logging interface
11. Offline mode support

**Deliverables:**
- Capacity planning tools
- Production scheduling
- Predictive maintenance
- Mobile interface

---

## 8. TECHNICAL RECOMMENDATIONS

### 8.1 Backend Architecture

**Service Layer Pattern:**
- Use NestJS dependency injection
- Implement repository pattern for database access
- Use TypeORM entities matching database schema
- Apply tenant context injection for RLS

**OEE Calculation Strategy:**
- Scheduled CRON job (daily at 1 AM) to calculate previous day OEE
- Real-time OEE estimation for current shift
- Cache frequently accessed OEE data (Redis)

**Maintenance Scheduling:**
- Daily job to identify overdue maintenance
- Email/SMS alerts for maintenance technicians
- Configurable maintenance intervals by equipment type

**Data Validation:**
- Use class-validator for DTO validation
- Ensure work center exists before logging status
- Validate OEE calculation inputs (total pieces > 0, etc.)

### 8.2 Frontend Architecture

**State Management:**
- Apollo Client for GraphQL data
- React Context for equipment filters
- Local storage for user preferences

**Real-Time Updates:**
- GraphQL subscriptions for equipment status changes
- WebSocket fallback for older browsers
- Polling fallback (30-second interval) if subscriptions unavailable

**Performance Optimization:**
- Paginate equipment lists (50 per page)
- Lazy load equipment details
- Virtualize long lists (react-window)
- Memoize expensive calculations

**Accessibility:**
- WCAG 2.1 AA compliance
- Keyboard navigation for all actions
- Screen reader support for status changes

### 8.3 Integration Best Practices

**IoT Data Ingestion:**
- Message queue (NATS/RabbitMQ) for sensor readings
- Batch insert sensor data (every 5 seconds)
- Time-series database for historical sensor data (TimescaleDB)

**External System Integration:**
- REST API for MES/SCADA integration
- Webhook support for equipment status changes
- API rate limiting (100 requests/minute per tenant)

**Data Synchronization:**
- Master data sync from ERP to MES (hourly)
- Transactional data sync from MES to ERP (real-time)
- Conflict resolution strategy (last write wins with audit)

---

## 9. SECURITY & COMPLIANCE

### 9.1 Access Control

**Role-Based Permissions:**
- `EQUIPMENT_VIEW`: View equipment and maintenance records
- `EQUIPMENT_MANAGE`: Create/update equipment
- `MAINTENANCE_SCHEDULE`: Schedule maintenance
- `MAINTENANCE_EXECUTE`: Log maintenance completion
- `STATUS_LOG`: Log equipment status changes
- `OEE_VIEW`: View OEE analytics
- `ADMIN_EQUIPMENT`: Full administrative access

**Row-Level Security:**
- Tenant isolation enforced at database level
- Facility-based access control (user can only see their facility's equipment)
- Service account for IoT device data ingestion

### 9.2 Audit Logging

**All Mutations Logged:**
- Equipment creation/update/deletion
- Maintenance record creation/completion
- Status changes with reason codes
- OEE calculation triggers

**Audit Fields:**
- created_by, updated_by, deleted_by (user_id)
- created_at, updated_at, deleted_at (timestamp)
- SCD Type 2 history for work centers

### 9.3 Data Privacy

**PII Handling:**
- Operator names and technician names stored
- GDPR compliance: right to erasure requires anonymization
- Data retention policy: 7 years for maintenance records

**Data Encryption:**
- TLS 1.3 for data in transit
- Database column encryption for sensitive fields (if needed)
- API key rotation for IoT devices (every 90 days)

---

## 10. TESTING STRATEGY

### 10.1 Unit Tests

**Backend Services:**
- WorkCenterService: CRUD operations, SCD Type 2 versioning
- MaintenanceService: Scheduling logic, cost aggregation
- OEECalculationService: Calculation accuracy (sample datasets)
- EquipmentStatusService: Status transition validation

**Target Coverage:** 80%+ code coverage

### 10.2 Integration Tests

**GraphQL Resolvers:**
- Query tests with tenant isolation
- Mutation tests with authorization checks
- Error handling tests (invalid IDs, missing fields)

**Database Tests:**
- Foreign key constraint enforcement
- SCD Type 2 update behavior
- Trigger execution (if any)

### 10.3 E2E Tests

**User Flows:**
1. Create new equipment → Schedule maintenance → Log completion
2. Log production run → Calculate OEE → View analytics
3. Equipment goes down → Log status → Create corrective maintenance
4. Register IoT device → Ingest sensor data → View trends

**Browser Testing:**
- Chrome, Firefox, Safari, Edge (latest 2 versions)
- Mobile: iOS Safari, Android Chrome

### 10.4 Performance Tests

**Load Testing:**
- 100 concurrent users accessing equipment dashboard
- 1000 sensor readings/second ingestion
- 50 simultaneous OEE calculations

**Database Performance:**
- Query execution time < 100ms for equipment list
- OEE calculation batch job < 5 minutes for 50 work centers
- Sensor data ingestion batch insert < 500ms for 1000 records

---

## 11. RISKS & MITIGATION

### 11.1 Technical Risks

**Risk:** OEE calculation performance degrades with high data volume
**Impact:** HIGH
**Mitigation:**
- Implement incremental OEE calculation (only new data)
- Partition equipment_status_log by month
- Index optimization on status_start, work_center_id

**Risk:** IoT data ingestion overwhelms database
**Impact:** HIGH
**Mitigation:**
- Use message queue for buffering
- Batch insert sensor readings
- Consider TimescaleDB for time-series data

**Risk:** Real-time updates cause frontend performance issues
**Impact:** MEDIUM
**Mitigation:**
- Throttle WebSocket updates (max 1 per second)
- Use virtual scrolling for long lists
- Implement client-side caching

### 11.2 Business Risks

**Risk:** Maintenance scheduling conflicts with production schedules
**Impact:** HIGH
**Mitigation:**
- Integrate with production scheduling module
- Preventive maintenance windows during planned downtime
- Override capability for emergency maintenance

**Risk:** Inaccurate OEE data due to manual logging errors
**Impact:** MEDIUM
**Mitigation:**
- IoT integration for automated data capture
- Data validation rules on status logging
- Outlier detection and alerting

**Risk:** User adoption resistance (shop floor workers)
**Impact:** HIGH
**Mitigation:**
- Mobile-first interface for ease of use
- QR code scanning for quick equipment selection
- Training and support documentation
- Gradual rollout with pilot facility

---

## 12. SUCCESS METRICS

### 12.1 Technical KPIs

- **API Response Time:** < 200ms for 95th percentile
- **GraphQL Query Success Rate:** > 99.9%
- **Real-Time Update Latency:** < 2 seconds
- **Database Query Performance:** < 100ms for equipment list
- **System Uptime:** > 99.5%

### 12.2 Business KPIs

- **OEE Improvement:** Target 5% increase within 6 months
- **Maintenance Compliance:** > 95% on-time completion
- **Equipment Downtime Reduction:** 20% reduction in unplanned downtime
- **Maintenance Cost Optimization:** 10% reduction through predictive maintenance
- **User Adoption:** > 80% of shop floor workers using system daily

### 12.3 User Satisfaction

- **System Usability Score (SUS):** > 75
- **Mobile Interface Rating:** > 4/5 stars
- **Support Ticket Volume:** < 5 tickets/week after 3 months
- **Training Effectiveness:** < 2 hours onboarding time per user

---

## 13. DEPENDENCIES & PREREQUISITES

### 13.1 Infrastructure

- PostgreSQL 14+ with uuid-ossp and uuid_v7 extensions
- Redis 6+ for caching (optional but recommended)
- Message queue (NATS/RabbitMQ) for IoT data (Phase 3)
- TimescaleDB extension for time-series data (Phase 3)

### 13.2 Third-Party Services

- Email service for maintenance alerts (SendGrid/AWS SES)
- SMS service for critical equipment down alerts (Twilio)
- PDF generation for reports (Puppeteer/wkhtmltopdf)

### 13.3 Development Tools

- NestJS CLI for module scaffolding
- TypeORM for database access
- Apollo Client for GraphQL frontend
- Jest for testing
- GraphQL Code Generator for type safety

### 13.4 Team Skills Required

- Backend: NestJS, TypeORM, PostgreSQL, GraphQL
- Frontend: React, TypeScript, Apollo Client, Tailwind CSS
- DevOps: Docker, PostgreSQL administration, Message queues
- Domain Knowledge: Manufacturing operations, OEE calculations, Lean principles

---

## 14. CONCLUSION

The AGOG Print Industry ERP system has a **robust foundation** for Equipment Maintenance & Asset Management. The database schema is comprehensive, following industry best practices with multi-tenancy, SCD Type 2, and audit trails. The GraphQL schema provides a complete API surface for equipment and maintenance operations.

However, **critical implementation work remains:**

1. **Backend services are completely missing** - WorkCenterService, MaintenanceService, OEECalculationService, EquipmentStatusService need to be built
2. **GraphQL resolvers are not implemented** - Query and mutation handlers must be created
3. **Frontend is scaffolded but not functional** - OperationsDashboard uses mock data and requires GraphQL integration
4. **No automation** - OEE calculation, maintenance scheduling, and overdue alerts require implementation

**Recommended Approach:**

Follow the 4-phase implementation roadmap (8 weeks total):
- **Phase 1 (Weeks 1-2):** Foundation - Basic CRUD and GraphQL integration
- **Phase 2 (Weeks 3-4):** Core Features - OEE, scheduling, production tracking
- **Phase 3 (Weeks 5-6):** Advanced Features - IoT, real-time, workflows
- **Phase 4 (Weeks 7-8):** Optimization - Capacity planning, predictive maintenance, mobile

**Key Success Factors:**

✅ Prioritize backend service implementation first
✅ Start with manual data entry, automate IoT later
✅ Focus on OEE calculation accuracy (drives business value)
✅ Ensure mobile-first design for shop floor adoption
✅ Plan for scalability (message queues, time-series DB)

The architecture is sound, the schema is production-ready, and the GraphQL API is well-designed. Implementation execution is the primary dependency for delivering this feature to production.

---

## APPENDICES

### Appendix A: Database Table Reference

| Table Name | Purpose | Key Fields | Status |
|------------|---------|------------|--------|
| work_centers | Equipment master data | id, work_center_code, status, last_maintenance_date | ✅ Schema ready |
| maintenance_records | Maintenance tracking | id, work_center_id, maintenance_type, status | ✅ Schema ready |
| asset_hierarchy | Parent-child relationships | parent_work_center_id, child_work_center_id | ✅ Schema ready |
| equipment_status_log | Real-time status tracking | work_center_id, status, status_start, duration_minutes | ✅ Schema ready |
| oee_calculations | OEE metrics | work_center_id, oee_percentage, availability, performance, quality | ✅ Schema ready |
| production_runs | Production execution | production_order_id, work_center_id, quantity_good, quantity_scrap | ✅ Schema ready |
| iot_devices | IoT device registry | device_code, work_center_id, connection_type | ✅ Schema ready |
| equipment_events | Equipment event log | work_center_id, event_type, severity, acknowledged | ✅ Schema ready |

### Appendix B: GraphQL Query Examples

```graphql
# Get all work centers for a facility
query GetWorkCenters {
  workCenters(facilityId: "uuid", status: AVAILABLE) {
    id
    workCenterCode
    workCenterName
    status
    lastMaintenanceDate
    nextMaintenanceDate
    maintenanceRecords {
      maintenanceDate
      maintenanceType
      costParts
      costLabor
    }
  }
}

# Get OEE calculations for a work center
query GetOEE {
  oeeCalculations(
    workCenterId: "uuid"
    startDate: "2024-12-01"
    endDate: "2024-12-31"
  ) {
    calculationDate
    oeePercent
    availabilityPercent
    performancePercent
    qualityPercent
  }
}

# Create maintenance record
mutation CreateMaintenance {
  createMaintenanceRecord(input: {
    workCenterId: "uuid"
    maintenanceType: PREVENTIVE
    maintenanceDate: "2024-12-29"
    description: "Quarterly preventive maintenance"
    technicianName: "John Smith"
  }) {
    id
    maintenanceNumber
    status
  }
}
```

### Appendix C: File References

**Database Schema:**
- `print-industry-erp/backend/database/schemas/operations-module.sql` (Lines 17-693)
- `print-industry-erp/backend/database/schemas/quality-hr-iot-security-marketplace-imposition.sql` (Lines 374-478)

**GraphQL Schema:**
- `print-industry-erp/backend/src/graphql/schema/operations.graphql` (Lines 1-816)
- `print-industry-erp/backend/src/graphql/schema/quality-hr-iot-security-marketplace-imposition.graphql` (Lines 349-1243)

**Frontend Components:**
- `print-industry-erp/frontend/src/pages/OperationsDashboard.tsx` (Lines 1-100+)

**Migrations:**
- `V0.0.3__create_operations_module.sql`
- `V0.0.7__create_quality_hr_iot_security_marketplace_imposition.sql`

---

**NATS Publication Channel:** `agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767048328663`

**Next Steps:**
1. Marcus to review research findings
2. Roy to implement backend services (Phase 1)
3. Jen to build frontend components (Phase 1)
4. Billy to create test plan and QA strategy
