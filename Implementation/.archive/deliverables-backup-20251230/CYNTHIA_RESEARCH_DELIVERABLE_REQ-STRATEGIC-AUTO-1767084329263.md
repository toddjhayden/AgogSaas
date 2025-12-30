# Research Deliverable: Shop Floor Data Collection - Mobile Production Reporting
## REQ-STRATEGIC-AUTO-1767084329263

**Researcher**: Cynthia (Research Analyst)
**Date**: 2025-12-30
**Status**: COMPLETE

---

## Executive Summary

This research deliverable provides a comprehensive analysis of the Shop Floor Data Collection - Mobile Production Reporting feature for the print manufacturing ERP system. The research reveals that the system already has a robust production execution foundation with production runs, work centers, operations, and quality tracking. The proposed mobile reporting capability will enable real-time data capture from the shop floor using mobile devices (tablets/smartphones), integrating with existing IoT sensors, quality inspection workflows, and Statistical Process Control (SPC) infrastructure.

**Key Finding**: The system architecture supports a Progressive Web App (PWA) approach for mobile access, leveraging the existing React/TypeScript frontend with responsive design patterns and GraphQL API integration.

---

## 1. Current System Architecture Analysis

### 1.1 Existing Production Infrastructure

The system has comprehensive production tracking capabilities already implemented:

#### Core Production Tables (operations-module.sql)
- **work_centers**: Manufacturing equipment (presses, bindery, finishing)
  - Status tracking: AVAILABLE, IN_USE, DOWN, MAINTENANCE, OFFLINE, CHANGEOVER
  - Capacity metrics: production_rate_per_hour, hourly_rate, setup_cost
  - Location: `print-industry-erp/backend/database/schemas/operations-module.sql:17-85`

- **production_orders**: High-level production orders from sales
  - Manufacturing strategies: MTS, MTO, CTO, ETO, POD, VDP, LEAN, DIGITAL
  - Status workflow: PLANNED → RELEASED → IN_PROGRESS → COMPLETED
  - Location: `print-industry-erp/backend/database/schemas/operations-module.sql:95-171`

- **production_runs**: Actual production execution tracking
  - Real-time metrics: quantity_good, quantity_scrap, quantity_rework
  - Time tracking: setup_time_minutes, run_time_minutes, downtime_minutes
  - Operator assignment: operator_user_id, operator_name
  - Status: SCHEDULED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED
  - Location: `print-industry-erp/backend/database/schemas/operations-module.sql:229-301`

- **operations**: Operation master data (printing, die cutting, folding, etc.)
  - 18 operation types supported (PRINTING, DIE_CUTTING, FOLDING, GLUING, etc.)
  - Time standards: setup_time_minutes, run_time_per_unit_seconds
  - Location: `print-industry-erp/backend/database/schemas/operations-module.sql:174-227`

- **changeover_details**: Setup time tracking between jobs
  - Critical for lean manufacturing optimization
  - Breakdown tracking: washup_minutes, plate_change_minutes, material_loading_minutes
  - Location: `print-industry-erp/backend/database/schemas/operations-module.sql:304-362`

- **equipment_status_log**: Real-time equipment status for OEE
  - Status types: PRODUCTIVE, NON_PRODUCTIVE_SETUP, NON_PRODUCTIVE_BREAKDOWN, etc.
  - Duration tracking for availability calculations
  - Location: `print-industry-erp/backend/database/schemas/operations-module.sql:365-415`

- **oee_calculations**: Overall Equipment Effectiveness metrics
  - OEE = Availability × Performance × Quality
  - World-class target: 85% OEE
  - Location: `print-industry-erp/backend/database/schemas/operations-module.sql:521-594`

### 1.2 Quality & Inspection Infrastructure

The system has comprehensive quality management capabilities:

#### Quality Tables (quality-hr-iot-security-marketplace-imposition-module.sql)
- **quality_inspections**: Inspection execution tracking
  - Inspection types: INCOMING, IN_PROCESS, FINAL, FIRST_ARTICLE
  - Pass/fail tracking with detailed results JSONB
  - Disposition workflow: ACCEPT, REJECT, REWORK, USE_AS_IS, QUARANTINE
  - Location: `quality-hr-iot-security-marketplace-imposition-module.sql:77-124`

- **inspection_templates**: Configurable inspection checklists
  - Inspection points with specifications (min/max/target values)
  - Sampling plans: FULL, AQL_2.5, AQL_4.0
  - Location: `quality-hr-iot-security-marketplace-imposition-module.sql:41-75`

- **quality_defects**: Defect tracking and corrective action
  - Severity levels: CRITICAL, MAJOR, MINOR
  - CAPA workflow: root_cause, corrective_action, preventive_action
  - Location: `quality-hr-iot-security-marketplace-imposition-module.sql:126-165`

### 1.3 Statistical Process Control (SPC) Infrastructure

Advanced SPC capabilities for real-time quality monitoring (V0.0.44__create_spc_tables.sql):

- **spc_control_chart_data**: Time-series measurement data (PARTITIONED by month)
  - 26M+ rows/year capacity with efficient queries
  - Chart types: XBAR_R, XBAR_S, I_MR, P_CHART, NP_CHART, C_CHART, U_CHART
  - Parameters: INK_DENSITY, COLOR_DELTA_E, REGISTER, DOT_GAIN, TEMPERATURE, HUMIDITY
  - Data quality tracking: VERIFIED, ESTIMATED, QUESTIONABLE, REJECTED
  - Multi-source: IOT_SENSOR, QUALITY_INSPECTION, MANUAL_ENTRY
  - Location: `V0.0.44__create_spc_tables.sql:14-160`

- **spc_control_limits**: Control chart configurations
  - UCL (Upper Control Limit), CL (Center Line), LCL (Lower Control Limit)
  - Specification limits vs. control limits tracking
  - Effective dating for limit changes
  - Location: `V0.0.44__create_spc_tables.sql:162-200`

- **spc_out_of_control_alerts**: Western Electric Rules violations
  - Automated out-of-control detection
  - Rule violations: RULE_1 (point outside control limits), RULE_2 (9 points on one side)
  - Alert severity and acknowledgment workflow

### 1.4 IoT & Sensor Integration

The system supports automated data collection from shop floor equipment:

- **iot_devices**: IoT device registry
  - Device types: SENSOR, PRESS_COUNTER, TEMPERATURE_MONITOR, SCALE
  - Connection protocols: MQTT, REST_API, OPC_UA, MODBUS
  - Work center association for equipment-specific sensors
  - Location: `quality-hr-iot-security-marketplace-imposition-module.sql:374-409`

- **sensor_readings**: Time-series sensor data
  - Real-time readings linked to production runs
  - Sensor types: TEMPERATURE, HUMIDITY, PRESSURE, SPEED, COUNT, WEIGHT
  - Integration with SPC control charts
  - Location: `quality-hr-iot-security-marketplace-imposition-module.sql:413-440`

---

## 2. Frontend Architecture Analysis

### 2.1 Current Technology Stack

**Technology**: React 18 + TypeScript + Vite
**State Management**: Zustand (lightweight state management)
**API Layer**: Apollo Client (GraphQL)
**UI Framework**: Tailwind CSS + Material-UI (MUI) components
**Charts**: Recharts library
**Icons**: Lucide React
**Internationalization**: react-i18next

**Source**: `print-industry-erp/frontend/package.json`

### 2.2 Existing Production UI Components

The system has production execution UI already implemented:

#### ProductionRunExecutionPage
- **Purpose**: Operator interface for starting/completing production runs
- **Features**:
  - Real-time polling (5-second refresh interval)
  - Production run status display with color-coded badges
  - Start/Complete workflow mutations
  - Quantity tracking (good qty, scrap qty)
  - Operator notes capture
- **GraphQL Integration**:
  - `GET_PRODUCTION_RUN` query
  - `START_PRODUCTION_RUN` mutation
  - `COMPLETE_PRODUCTION_RUN` mutation
- **Location**: `frontend/src/pages/ProductionRunExecutionPage.tsx`

#### Production Analytics Dashboard
- Real-time production metrics aggregation
- Work center utilization monitoring
- OEE trends visualization
- Production alerts and notifications
- **Location**: `frontend/src/pages/ProductionAnalyticsDashboard.tsx`

#### Work Center Monitoring Dashboard
- Live work center status tracking
- Equipment availability visualization
- Downtime reason tracking
- **Location**: `frontend/src/pages/WorkCenterMonitoringDashboard.tsx`

### 2.3 GraphQL Schema Analysis

The Operations GraphQL schema provides comprehensive production tracking capabilities:

#### Key Types (operations.graphql)
- **ProductionRun**: Complete production run entity with relationships
  - Timing: setupStartTime, setupEndTime, startTimestamp, endTimestamp
  - Quantities: targetQuantity, goodQuantity, scrapQuantity
  - Performance: actualSetupMinutes, actualRunMinutes, downtime
  - Status: SCHEDULED, IN_SETUP, RUNNING, PAUSED, COMPLETED, CANCELLED

- **ProductionRunSummary**: Aggregated metrics for dashboards
  - Progress percentage calculation
  - Current OEE calculation
  - Real-time status updates

- **WorkCenter**: Equipment with current status
  - Real-time status: AVAILABLE, IN_USE, DOWN, MAINTENANCE, OFFLINE, CHANGEOVER
  - Capacity metrics for utilization tracking

- **OEECalculation**: Daily OEE snapshots
  - Availability, Performance, Quality percentages
  - Loss breakdown for root cause analysis

#### Key Mutations (operations.graphql)
- `startProductionRun(id: ID!): ProductionRun!`
- `completeProductionRun(id: ID!, goodQuantity: Float!, scrapQuantity: Float!, notes: String): ProductionRun!`
- `logEquipmentStatus(input: LogEquipmentStatusInput!): EquipmentStatusLog!`

**Source**: `backend/src/graphql/schema/operations.graphql:185-685`

---

## 3. Mobile Reporting Requirements Analysis

### 3.1 Shop Floor Data Collection Use Cases

Based on the existing system architecture, the mobile reporting system should support:

#### UC-1: Production Run Start/Stop
**Actor**: Shop Floor Operator
**Frequency**: 5-20 times per shift per work center
**Data Points**:
- Production run selection/scanning (barcode/QR code)
- Operator login/authentication
- Setup start/end timestamps
- Run start/end timestamps
- Immediate status updates to production_runs table

#### UC-2: Quantity Reporting
**Actor**: Shop Floor Operator
**Frequency**: Continuous during production (real-time or periodic)
**Data Points**:
- Good quantity produced
- Scrap quantity with reason codes
- Rework quantity
- Waste tracking (setup waste, production waste)
- Unit of measure validation

#### UC-3: Downtime Logging
**Actor**: Shop Floor Operator / Maintenance Technician
**Frequency**: As events occur (unplanned stops)
**Data Points**:
- Downtime start/end timestamps
- Downtime reason codes (BREAKDOWN, NO_MATERIAL, NO_OPERATOR, etc.)
- Equipment status change (→ DOWN, → MAINTENANCE)
- Notes/description of issue
- Maintenance work order linkage

#### UC-4: Quality Inspection Entry
**Actor**: Quality Inspector / Operator
**Frequency**: Per sampling plan (every N units, hourly, per batch)
**Data Points**:
- Inspection template loading
- Measurement entry for each inspection point
- Pass/fail determination
- Disposition selection (ACCEPT, REJECT, REWORK, QUARANTINE)
- Photo capture for visual defects
- Inspector signature/approval

#### UC-5: First Article Inspection
**Actor**: Quality Inspector
**Frequency**: Start of each production run
**Data Points**:
- First piece approval workflow
- Critical dimension measurements
- Color/appearance verification
- Approval timestamp and user
- Rejection triggers run halt

#### UC-6: SPC Data Entry
**Actor**: Operator / Quality Technician
**Frequency**: Per control plan (every 15-30 min, per 1000 sheets, etc.)
**Data Points**:
- Parameter selection (INK_DENSITY, REGISTER, DOT_GAIN, etc.)
- Measurement value entry
- Subgroup number/size
- Automatic control limit comparison
- Out-of-control alerts
- Corrective action triggering

#### UC-7: Material Consumption Tracking
**Actor**: Operator
**Frequency**: Start/end of production run
**Data Points**:
- Material lot scanning
- Quantity consumed
- Material waste tracking
- Inventory transaction generation

#### UC-8: Changeover Tracking
**Actor**: Operator / Setup Technician
**Frequency**: Between production runs
**Data Points**:
- Changeover type (COLOR_CHANGE, SUBSTRATE_CHANGE, SIZE_CHANGE, COMPLETE_SETUP)
- Changeover start/end timestamps
- Breakdown by activity (washup, plate change, material loading, calibration, first piece)
- Setup waste quantity
- Crew size
- Improvement opportunities notes

### 3.2 Mobile Device Considerations

#### Device Types
- **Tablets (iPad, Android tablets)**: Primary device for shop floor
  - 10-12" screens for comfortable data entry
  - Rugged cases for industrial environment
  - Mounting options for work center kiosks

- **Smartphones (iPhone, Android phones)**: Secondary/portable option
  - 6-7" screens for quick entries on the move
  - Portable for quality inspections across facility
  - Camera for defect photo capture

#### Environmental Factors
- **Dust/Debris**: Print shop environment with paper dust, ink mist
  - Recommendation: IP54+ rated cases or sealed enclosures

- **Lighting**: Varying lighting conditions (press area, warehouse, inspection booth)
  - Recommendation: High brightness displays (400+ nits), dark mode support

- **Noise**: Loud press environments affecting audio feedback
  - Recommendation: Visual feedback (haptics, color changes) over audio

- **Ink/Chemical Exposure**: Operator hands may have ink, solvents
  - Recommendation: Touchscreen with glove support, stylus option, barcode scanning

#### Connectivity Considerations
- **Wi-Fi Coverage**: Full facility Wi-Fi required
  - 5GHz for speed, 2.4GHz for penetration through equipment
  - Offline mode for temporary connectivity loss

- **Data Synchronization**: Eventual consistency acceptable
  - Real-time sync preferred for immediate dashboard updates
  - Local caching for 1-2 hours of offline operation
  - Conflict resolution for multi-operator scenarios

---

## 4. Technical Architecture Recommendations

### 4.1 Mobile Frontend Architecture

#### Recommended Approach: Progressive Web App (PWA)

**Rationale**:
1. **Code Reuse**: Leverage existing React/TypeScript frontend codebase
2. **Cross-Platform**: Single codebase for iOS, Android, Desktop
3. **No App Store Approval**: Instant updates without app store delays
4. **Installation**: "Add to Home Screen" for app-like experience
5. **Offline Capability**: Service workers for offline data collection
6. **Push Notifications**: Web Push API for alerts (out-of-control, equipment down)

**PWA Features Required**:
- Responsive design breakpoints (mobile-first)
- Service worker for offline caching
- IndexedDB for local data persistence
- Web App Manifest for installation
- Camera API for photo capture
- Geolocation API (optional for facility zone tracking)
- Vibration API for haptic feedback
- Web Share API for sharing reports

**Alternative Considered**: React Native
- **Pros**: Better native performance, richer device API access
- **Cons**: Separate codebase maintenance, app store dependencies, slower update cycle
- **Verdict**: Not recommended unless PWA performance proves insufficient

### 4.2 Mobile-Optimized UI/UX Design

#### Design Principles
1. **Touch-First**: Large touch targets (44×44px minimum)
2. **Simplified Navigation**: Flat hierarchy, max 2-3 levels deep
3. **Contextual Actions**: Most common actions immediately accessible
4. **Visual Feedback**: Clear state changes, loading indicators
5. **Error Prevention**: Validation before submission, confirmation for critical actions
6. **Performance**: Sub-200ms response for interactions, optimistic UI updates

#### Key Mobile Views

**1. Production Run Dashboard (Home View)**
- Active production runs list
- Work center selector/filter
- Quick actions: Start Run, Complete Run, Log Downtime
- Status badges with color coding
- Swipe gestures for common actions

**2. Start Production Run**
- Barcode/QR code scanner for run selection
- Operator login (PIN, badge scan, biometric)
- Setup checklist confirmation
- Material allocation verification
- One-tap "Start Production" button
- Photo capture for setup verification

**3. Production Data Entry**
- Large numeric keypad for quantity entry
- Good/Scrap/Rework counters with +/- buttons
- Reason code dropdown for scrap
- Auto-save on field blur
- Visual progress indicator (% complete)
- Downtime timer with reason selection

**4. Quality Inspection Entry**
- Inspection template with checklist layout
- Numeric entry with spec limit indicators
- In-tolerance/out-of-tolerance visual feedback
- Camera integration for defect photos
- Pass/Fail determination with disposition
- Digital signature capture

**5. SPC Data Entry**
- Parameter selection (autocomplete)
- Value entry with unit display
- Real-time control chart visualization
- Out-of-control alert banner
- Historical trend sparkline
- Corrective action prompt

**6. Downtime Logging**
- Timer auto-start on status change
- Reason code selection (hierarchical: Category → Reason)
- Notes with voice-to-text option
- Maintenance work order creation
- Supervisor notification trigger
- Equipment status update

#### Mobile Component Library
Extend existing component library with mobile-optimized variants:

- **MobileNumericKeypad**: Large number entry with decimal support
- **MobileBarcodeScanner**: Camera-based barcode/QR scanning
- **MobileSignaturePad**: Touch-based signature capture
- **MobilePhotoCapture**: Camera integration with annotation
- **MobileTimerWidget**: Countdown/countup timer for changeovers/downtime
- **MobileStatusBadge**: Larger, touch-friendly status indicators
- **MobileActionSheet**: Bottom sheet for action selection
- **MobileConfirmDialog**: Touch-optimized confirmation modals

### 4.3 Data Synchronization Strategy

#### Hybrid Online/Offline Architecture

**Online Mode (Primary)**:
- GraphQL mutations for immediate server updates
- Optimistic UI updates for responsiveness
- Real-time subscriptions for multi-user coordination
- Server-side validation and business rules

**Offline Mode (Fallback)**:
- IndexedDB queue for pending mutations
- Local timestamp for ordering
- Background sync when connectivity restored
- Conflict detection and resolution

#### Sync Queue Management

**Data Priority Levels**:
1. **Critical (Immediate)**: Production run start/stop, equipment status changes
2. **High (1-minute)**: Quantity updates, quality inspections
3. **Medium (5-minutes)**: SPC measurements, material consumption
4. **Low (15-minutes)**: Notes, attachments, non-critical updates

**Conflict Resolution**:
- **Last Write Wins**: For independent fields (notes, scrap reasons)
- **Server Authoritative**: For quantities (server sum prevails)
- **Manual Resolution**: For competing status changes (supervisor review)

#### Offline Data Storage

**IndexedDB Schema**:
```typescript
// Pending mutations queue
interface PendingMutation {
  id: string;
  mutation: string;  // GraphQL mutation
  variables: Record<string, any>;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
}

// Cached reference data
interface CachedData {
  entityType: 'production_runs' | 'work_centers' | 'operations';
  entityId: string;
  data: any;
  cacheTimestamp: Date;
  ttl: number;  // Time to live in seconds
}
```

**Cache Strategy**:
- Production runs: 1-hour TTL
- Work centers: 4-hour TTL
- Operations: 24-hour TTL
- Inspection templates: 24-hour TTL
- Reference data (reason codes, UOMs): 7-day TTL

### 4.4 Backend API Enhancements

#### New GraphQL Mutations Required

**Mobile-Optimized Batch Operations**:
```graphql
# Batch update for periodic sync
mutation UpdateProductionRunProgress(
  $runId: ID!
  $goodQuantity: Float!
  $scrapQuantity: Float!
  $scrapReasons: [ScrapReasonInput!]
  $downtimeEntries: [DowntimeEntryInput!]
  $timestamp: DateTime!
) {
  updateProductionRunProgress(input: {
    runId: $runId
    goodQuantity: $goodQuantity
    scrapQuantity: $scrapQuantity
    scrapReasons: $scrapReasons
    downtimeEntries: $downtimeEntries
    timestamp: $timestamp
  }) {
    productionRun {
      id
      goodQuantity
      scrapQuantity
      status
      progressPercentage
    }
    conflicts {
      field
      serverValue
      clientValue
    }
  }
}

# SPC measurement entry
mutation RecordSPCMeasurement(
  $input: SPCMeasurementInput!
) {
  recordSPCMeasurement(input: $input) {
    measurement {
      id
      measuredValue
      isInControl
      violatedRules
    }
    alert {
      id
      severity
      message
      recommendedAction
    }
  }
}

# Quality inspection batch entry
mutation SubmitQualityInspection(
  $input: QualityInspectionInput!
) {
  submitQualityInspection(input: $input) {
    inspection {
      id
      passFailResult
      disposition
    }
    triggeredActions {
      type  # QUARANTINE, NOTIFICATION, PRODUCTION_HOLD
      details
    }
  }
}

# Downtime logging
mutation LogDowntime(
  $workCenterId: ID!
  $downtimeStart: DateTime!
  $downtimeEnd: DateTime
  $reasonCode: String!
  $notes: String
  $productionRunId: ID
) {
  logDowntime(input: {
    workCenterId: $workCenterId
    downtimeStart: $downtimeStart
    downtimeEnd: $downtimeEnd
    reasonCode: $reasonCode
    notes: $notes
    productionRunId: $productionRunId
  }) {
    equipmentStatusLog {
      id
      durationMinutes
    }
    productionRun {
      id
      downtime
      status
    }
    oeeImpact {
      availabilityPercentage
      estimatedLoss
    }
  }
}
```

#### New GraphQL Queries Required

```graphql
# Mobile-optimized production run details
query GetProductionRunForMobile($id: ID!) {
  productionRun(id: $id) {
    id
    productionRunNumber
    status
    targetQuantity
    goodQuantity
    scrapQuantity
    unitOfMeasure
    progressPercentage

    productionOrder {
      productionOrderNumber
      productCode
      productDescription
      specialInstructions
    }

    workCenter {
      workCenterCode
      workCenterName
      status
    }

    operation {
      operationName
      operationType
      workInstructions
      inspectionRequired
      inspectionTemplate {
        id
        templateName
        inspectionPoints
      }
    }

    # Current operator assignment
    operatorName

    # Timing
    scheduledStart
    scheduledEnd
    actualStart
    actualSetupMinutes
    actualRunMinutes
    downtime
  }
}

# Active runs for work center (lightweight)
query GetActiveRunsForWorkCenter($workCenterId: ID!) {
  productionRuns(
    workCenterId: $workCenterId
    status: [IN_SETUP, RUNNING, PAUSED]
  ) {
    id
    productionRunNumber
    productCode
    status
    progressPercentage
    scheduledEnd
  }
}

# Inspection template for mobile
query GetInspectionTemplate($id: ID!) {
  inspectionTemplate(id: $id) {
    id
    templateCode
    templateName
    inspectionType
    inspectionPoints  # JSONB array
    samplingPlan
  }
}

# SPC control limits for parameter
query GetSPCControlLimits(
  $parameterCode: String!
  $workCenterId: ID
  $productId: ID
) {
  spcControlLimits(
    parameterCode: $parameterCode
    workCenterId: $workCenterId
    productId: $productId
  ) {
    id
    upperControlLimit
    centerLine
    lowerControlLimit
    upperSpecLimit
    lowerSpecLimit
    targetValue
    chartType
  }
}
```

#### Real-Time Subscriptions for Multi-User Coordination

```graphql
# Subscribe to production run changes
subscription OnProductionRunUpdated($runId: ID!) {
  productionRunUpdated(runId: $runId) {
    id
    status
    goodQuantity
    scrapQuantity
    operatorName
    updatedBy
    timestamp
  }
}

# Subscribe to work center status changes
subscription OnWorkCenterStatusChanged($workCenterId: ID!) {
  workCenterStatusChanged(workCenterId: $workCenterId) {
    workCenterId
    status
    currentProductionRunId
    timestamp
  }
}

# Subscribe to SPC alerts
subscription OnSPCAlert($tenantId: ID!) {
  spcAlertCreated(tenantId: $tenantId) {
    id
    severity
    parameterCode
    workCenterName
    message
    violatedRules
    timestamp
  }
}
```

### 4.5 Authentication & Authorization

#### Mobile Authentication Methods

**1. Badge Scan Authentication (Recommended)**
- RFID badge reader integration
- Barcode/QR code on employee badge
- Camera-based badge scanning
- Fast operator switching at work centers

**2. PIN Authentication**
- 4-6 digit PIN entry
- Large numeric keypad
- Timeout after inactivity (configurable: 5-15 minutes)
- Suitable for shared tablets

**3. Biometric Authentication (Optional)**
- Fingerprint reader (device hardware)
- Face recognition (device camera)
- Most secure, slowest switching

**Implementation**:
- Session token with refresh token
- Automatic logout after shift end
- Supervisor override capability
- Offline authentication with cached credentials (hash verification)

#### Role-Based Access Control (RBAC)

**Roles**:
- **Operator**: Start/stop runs, log quantities, basic quality checks
- **Quality Inspector**: Full inspection workflows, disposition authority
- **Setup Technician**: Changeover tracking, equipment configuration
- **Supervisor**: Override capability, approval authority, all operator functions
- **Maintenance**: Downtime logging, equipment status changes, work order creation

**Permissions**:
- `production_run:start`
- `production_run:complete`
- `production_run:pause`
- `production_run:cancel` (supervisor only)
- `quality_inspection:create`
- `quality_inspection:approve` (inspector only)
- `equipment:status_change`
- `downtime:log`
- `spc:record_measurement`

---

## 5. Integration Points

### 5.1 Integration with Existing Modules

#### Integration Point 1: Production Planning Module
**Module**: `backend/src/modules/operations/services/production-planning.service.ts`

**Integration Requirements**:
- Mobile app retrieves scheduled production runs for work center
- Production run status updates trigger schedule recalculations
- Completion data feeds capacity planning analytics

**Data Flow**:
```
Mobile App → UPDATE production_run status
           → RoutingManagementService.expandRouting()
           → ProductionPlanningService.updateSchedule()
           → Update production_schedules table
```

#### Integration Point 2: WMS (Warehouse Management System)
**Module**: `backend/src/modules/wms/wms.module.ts`

**Integration Requirements**:
- Material consumption reporting from production runs
- Automatic inventory transactions (issue from stock)
- Finished goods receiving upon production completion
- Scrap material handling

**Data Flow**:
```
Mobile App → COMPLETE production_run
           → WMS.createInventoryTransaction()
           → Update material_inventory (deduct raw materials)
           → Update material_inventory (receive finished goods)
           → Update inventory_transactions log
```

#### Integration Point 3: Quality Management Module
**Module**: `backend/database/schemas/quality-hr-iot-security-marketplace-imposition-module.sql`

**Integration Requirements**:
- Inspection templates loaded from quality_inspections table
- Inspection results written to quality_inspections and quality_defects
- CAPA (Corrective/Preventive Action) workflow triggering
- Customer rejection linkage for traceability

**Data Flow**:
```
Mobile App → GET inspection_template
           → User enters measurements
           → CREATE quality_inspection
           → IF fail THEN CREATE quality_defect
           → IF critical THEN NOTIFY supervisor + PAUSE production_run
```

#### Integration Point 4: Statistical Process Control (SPC)
**Module**: `backend/migrations/V0.0.44__create_spc_tables.sql`

**Integration Requirements**:
- Real-time measurement entry to spc_control_chart_data
- Automatic control limit comparison
- Western Electric Rules violation detection
- Alert generation for out-of-control conditions
- Cpk/Ppk process capability calculations

**Data Flow**:
```
Mobile App → ENTER SPC measurement
           → INSERT spc_control_chart_data
           → Compare to spc_control_limits
           → IF out-of-control THEN
               → INSERT spc_out_of_control_alerts
               → SEND push notification
               → TRIGGER corrective action workflow
```

#### Integration Point 5: IoT & Sensor Integration
**Module**: `quality-hr-iot-security-marketplace-imposition-module.sql (iot_devices, sensor_readings)`

**Integration Requirements**:
- Display real-time sensor readings on mobile (temperature, humidity, press speed)
- Allow manual override/calibration entry
- Sensor data feeds SPC control charts
- Equipment status linked to sensor heartbeat

**Data Flow**:
```
IoT Device → INSERT sensor_readings (auto)
Mobile App → SUBSCRIBE to sensor_readings (real-time)
           → DISPLAY on production run screen
           → ALLOW manual entry if sensor offline
           → Manual entry creates sensor_reading with data_source='MANUAL_ENTRY'
```

#### Integration Point 6: OEE Calculation Engine
**Module**: `backend/src/modules/operations/services/production-analytics.service.ts`

**Integration Requirements**:
- Production run data feeds OEE calculations
- Downtime logging updates availability percentage
- Quantity tracking (good vs. total) updates quality percentage
- Actual runtime vs. ideal cycle time updates performance percentage

**Data Flow**:
```
Mobile App → UPDATE production_run (good_quantity, scrap_quantity, downtime)
           → ProductionAnalyticsService.calculateOEE()
           → INSERT oee_calculations (daily rollup)
           → Update real-time OEE dashboard
```

### 5.2 Third-Party Integrations

#### Barcode/RFID Scanners
**Purpose**: Operator badge scanning, production run identification, material lot tracking

**Options**:
1. **Device Camera + ZXing Library** (Software)
   - Pros: No additional hardware, works with any mobile device
   - Cons: Slower, requires good lighting, user must aim camera

2. **Bluetooth Barcode Scanner** (Hardware)
   - Pros: Fast, ergonomic, works in any lighting
   - Cons: Additional cost ($200-500/scanner), battery management
   - Recommended: Zebra CS4070, Honeywell Voyager 1472g

3. **RFID Badge Reader** (Hardware)
   - Pros: Fastest authentication, hands-free, no line-of-sight needed
   - Cons: Higher cost ($300-600/reader), requires RFID badges
   - Recommended: HID Signo Reader, Impinj Speedway

#### Spectrophotometer Integration (Color Measurement)
**Purpose**: Automated color measurement for SPC tracking

**Options**:
1. **X-Rite eXact** (Industry Standard)
   - Bluetooth connectivity to mobile
   - Automatic measurement upload to SPC system
   - Delta-E calculations
   - G7 calibration support

2. **Techkon SpectroDens** (Alternative)
   - Similar capabilities, competitive pricing
   - OEM integration API available

**Integration**:
```typescript
// Bluetooth communication
import { BLE } from '@capacitor/bluetooth-le';

async function readSpectroMeasurement() {
  const measurement = await spectro.getMeasurement();
  // measurement = { L: 95.2, a: -0.8, b: 3.1, deltaE: 1.2 }

  await recordSPCMeasurement({
    parameterCode: 'COLOR_DELTA_E',
    measuredValue: measurement.deltaE,
    measurementMethod: 'AUTO_SPECTRO',
    measurementDeviceId: spectro.deviceId,
    dataSource: 'IOT_SENSOR'
  });
}
```

#### Press Counters (Automatic Quantity Tracking)
**Purpose**: Eliminate manual quantity entry via automatic impression counting

**Options**:
1. **Integrated Press Counters** (OEM)
   - Heidelberg Prinect Press Center
   - Komori K-Station
   - Manroland InlineFoiler Monitoring
   - Direct API integration

2. **Retrofit Sensors** (Aftermarket)
   - Photoelectric sensors on sheet delivery
   - Magnetic encoders on impression cylinders
   - MQTT protocol for IoT integration

**Integration**:
```typescript
// MQTT subscription to press counter
mqtt.subscribe('press/heidelberg-1/impressions', (message) => {
  const count = parseInt(message.payload);

  // Auto-update production run quantity
  updateProductionRunQuantity({
    runId: activeRunId,
    goodQuantity: count,
    timestamp: new Date()
  });
});
```

---

## 6. Data Model Enhancements

### 6.1 New Tables Required

#### scrap_reasons
**Purpose**: Standardized scrap reason codes for root cause analysis

```sql
CREATE TABLE scrap_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    reason_code VARCHAR(50) NOT NULL,
    reason_description VARCHAR(255) NOT NULL,
    reason_category VARCHAR(50),
    -- MATERIAL_DEFECT, EQUIPMENT_FAILURE, OPERATOR_ERROR, PROCESS_VARIATION, etc.

    is_preventable BOOLEAN DEFAULT TRUE,

    parent_reason_id UUID,  -- For hierarchical reasons

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_scrap_reason_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_scrap_reason_parent FOREIGN KEY (parent_reason_id) REFERENCES scrap_reasons(id),
    CONSTRAINT uq_scrap_reason_code UNIQUE (tenant_id, reason_code)
);

CREATE INDEX idx_scrap_reasons_tenant ON scrap_reasons(tenant_id);
CREATE INDEX idx_scrap_reasons_category ON scrap_reasons(reason_category);
```

#### production_run_scrap_details
**Purpose**: Detailed scrap tracking with reasons and quantities

```sql
CREATE TABLE production_run_scrap_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    production_run_id UUID NOT NULL,

    scrap_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scrap_quantity DECIMAL(18,4) NOT NULL,
    scrap_reason_id UUID NOT NULL,
    scrap_notes TEXT,

    operator_user_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_scrap_detail_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_scrap_detail_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_scrap_detail_reason FOREIGN KEY (scrap_reason_id) REFERENCES scrap_reasons(id),
    CONSTRAINT fk_scrap_detail_operator FOREIGN KEY (operator_user_id) REFERENCES users(id)
);

CREATE INDEX idx_scrap_details_run ON production_run_scrap_details(production_run_id);
CREATE INDEX idx_scrap_details_reason ON production_run_scrap_details(scrap_reason_id);
CREATE INDEX idx_scrap_details_timestamp ON production_run_scrap_details(scrap_timestamp);
```

#### downtime_reasons
**Purpose**: Standardized downtime reason codes for OEE loss analysis

```sql
CREATE TABLE downtime_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    reason_code VARCHAR(50) NOT NULL,
    reason_description VARCHAR(255) NOT NULL,
    reason_category VARCHAR(50),
    -- EQUIPMENT, MATERIAL, LABOR, EXTERNAL, PLANNED

    is_planned BOOLEAN DEFAULT FALSE,
    affects_oee BOOLEAN DEFAULT TRUE,

    parent_reason_id UUID,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_downtime_reason_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_downtime_reason_parent FOREIGN KEY (parent_reason_id) REFERENCES downtime_reasons(id),
    CONSTRAINT uq_downtime_reason_code UNIQUE (tenant_id, reason_code)
);

CREATE INDEX idx_downtime_reasons_tenant ON downtime_reasons(tenant_id);
CREATE INDEX idx_downtime_reasons_category ON downtime_reasons(reason_category);
```

#### mobile_sessions
**Purpose**: Track mobile app usage for audit and analytics

```sql
CREATE TABLE mobile_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_end TIMESTAMPTZ,

    device_type VARCHAR(50),  -- TABLET, SMARTPHONE
    device_model VARCHAR(100),
    device_os VARCHAR(50),
    app_version VARCHAR(20),

    work_center_id UUID,
    facility_id UUID,

    login_method VARCHAR(20),  -- BADGE_SCAN, PIN, BIOMETRIC

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mobile_session_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_mobile_session_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_mobile_session_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id)
);

CREATE INDEX idx_mobile_sessions_user ON mobile_sessions(user_id);
CREATE INDEX idx_mobile_sessions_work_center ON mobile_sessions(work_center_id);
CREATE INDEX idx_mobile_sessions_start ON mobile_sessions(session_start);
```

### 6.2 Table Modifications Required

#### production_runs (Add Mobile Tracking Fields)

```sql
-- Add mobile tracking columns to production_runs
ALTER TABLE production_runs
ADD COLUMN last_mobile_update_timestamp TIMESTAMPTZ,
ADD COLUMN last_mobile_update_device_id VARCHAR(100),
ADD COLUMN data_source VARCHAR(20) DEFAULT 'WEB',  -- WEB, MOBILE, IOT, API
ADD COLUMN offline_sync_batch_id UUID;  -- For grouping offline syncs

CREATE INDEX idx_production_runs_mobile_update ON production_runs(last_mobile_update_timestamp);
```

#### work_centers (Add Mobile Configuration)

```sql
-- Add mobile-specific configuration to work_centers
ALTER TABLE work_centers
ADD COLUMN mobile_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN mobile_config JSONB;
-- mobile_config = { barcode_scanner_required: true, auto_quantity_tracking: true, spc_parameters: ['INK_DENSITY', 'REGISTER'] }

CREATE INDEX idx_work_centers_mobile_enabled ON work_centers(mobile_enabled) WHERE mobile_enabled = TRUE;
```

---

## 7. Security & Data Privacy Considerations

### 7.1 Mobile Security Requirements

#### Device Security
1. **Device Encryption**: Enforce full-disk encryption on mobile devices
2. **Screen Lock**: Mandatory PIN/biometric lock with 5-minute timeout
3. **Remote Wipe**: MDM capability to wipe company data remotely
4. **Certificate Pinning**: Prevent man-in-the-middle attacks on API calls
5. **Jailbreak/Root Detection**: Warn or block app usage on compromised devices

#### Data Security
1. **Encryption at Rest**: IndexedDB encryption for cached data
2. **Encryption in Transit**: TLS 1.3+ for all API communication
3. **Token Security**: Secure storage (Keychain/Keystore) for auth tokens
4. **Data Minimization**: Cache only necessary data, auto-purge after 7 days
5. **Photo Security**: Blur PII in defect photos, secure storage with retention policy

#### Authentication Security
1. **Multi-Factor Authentication**: Badge + PIN for high-value operations
2. **Session Management**: Automatic logout after 8 hours or shift end
3. **Privilege Escalation**: Supervisor approval for sensitive operations
4. **Audit Logging**: All actions logged with user, device, timestamp

### 7.2 Compliance Considerations

#### Audit Trail Requirements (ISO 9001, AS9100)
All mobile data entries must maintain:
- **Who**: User ID, name, role
- **What**: Action performed, data changed
- **When**: Timestamp with timezone
- **Where**: Work center, facility
- **How**: Device type, app version
- **Why**: Notes, reason codes (for exceptions)

**Implementation**: Trigger-based audit logging to `audit_log` table

#### Data Retention (GDPR, CCPA)
- Production data: 7 years (regulatory requirement for print industry)
- Operator performance data: 3 years (labor law compliance)
- SPC measurement data: 5 years (quality management system)
- Mobile session logs: 1 year (security audit)
- Defect photos: 2 years with anonymization option

---

## 8. Performance & Scalability Analysis

### 8.1 Estimated Data Volumes

#### Production Runs
- **Frequency**: 5-20 starts/completions per work center per shift
- **Work Centers**: 10-50 per facility
- **Shifts**: 1-3 per day
- **Annual Volume**: 18,000 - 550,000 production runs/year
- **Storage**: ~500 KB per run (with notes, scrap details) = 9 - 275 GB/year

#### SPC Measurements
- **Frequency**: Every 15-30 minutes per parameter per active run
- **Parameters**: 3-5 per work center
- **Work Centers**: 10-50 per facility
- **Annual Volume**: 1.3M - 26M measurements/year (per facility)
- **Storage**: ~1 KB per measurement = 1.3 - 26 GB/year
- **Note**: Already designed with monthly partitioning (V0.0.44__create_spc_tables.sql)

#### Quality Inspections
- **Frequency**: 1-5 per production run
- **Annual Volume**: 18,000 - 2.75M inspections/year
- **Storage**: ~5 KB per inspection + photos (2-5 MB each) = 90 GB - 13.75 TB/year (with photos)
- **Mitigation**: Photo compression, cloud storage archival after 90 days

#### Mobile Transactions
- **Total API Calls**: ~10M - 100M per year per facility
- **Peak Load**: 50-200 concurrent users during shift changes
- **Response Time Target**: <200ms for 95th percentile
- **Database Connections**: 100-500 concurrent connections

### 8.2 Performance Optimization Strategies

#### Database Optimization
1. **Partitioning**: Monthly partitions for high-volume tables (already implemented for SPC data)
2. **Indexing**: Strategic indexes on query patterns
   - `(tenant_id, facility_id, work_center_id, production_run_id)` for drill-down queries
   - `(timestamp DESC)` for time-series queries
   - Partial indexes on active/in-progress records
3. **Materialized Views**: Pre-aggregated OEE calculations for dashboards
4. **Connection Pooling**: PgBouncer with 100-500 connections
5. **Read Replicas**: Separate read replica for analytics/reporting queries

#### API Optimization
1. **GraphQL DataLoader**: Batch database queries to prevent N+1 problems
2. **Response Caching**: Redis cache for reference data (work centers, operations, templates)
   - TTL: 1 hour for semi-static data
   - Invalidation: Event-driven cache busting on updates
3. **Query Complexity Analysis**: Limit query depth to 5 levels, max 100 fields
4. **Rate Limiting**: 1000 requests/minute per device to prevent abuse
5. **Compression**: Gzip compression for API responses (70% size reduction)

#### Mobile App Optimization
1. **Lazy Loading**: Load components on demand, not upfront
2. **Image Optimization**: WebP format, responsive images, lazy loading
3. **Code Splitting**: Separate bundles for mobile vs. desktop routes
4. **Service Worker Caching**: Cache static assets (JS, CSS, fonts) for offline use
5. **Debouncing**: Debounce quantity input to prevent excessive API calls (500ms)
6. **Optimistic UI**: Update UI immediately, rollback on server error

#### Network Optimization
1. **CDN**: CloudFlare CDN for static assets (JS, CSS, images)
2. **HTTP/2**: Multiplexing for parallel asset loading
3. **WebSocket**: Persistent connection for real-time subscriptions (reduces overhead)
4. **Payload Minimization**: Return only requested fields via GraphQL
5. **Delta Sync**: Sync only changed data since last update (not full datasets)

---

## 9. Testing Strategy

### 9.1 Functional Testing

#### Unit Testing (Backend)
- **Framework**: Jest + TypeScript
- **Coverage Target**: 80%+ for services, 60%+ for resolvers
- **Focus Areas**:
  - Mutation logic (production run state transitions)
  - SPC calculation accuracy (control limit violations)
  - Conflict resolution algorithms
  - Authentication/authorization logic

#### Integration Testing (Backend)
- **Framework**: Jest + Supertest + GraphQL Testing Library
- **Test Database**: Docker PostgreSQL container with test fixtures
- **Focus Areas**:
  - GraphQL mutation workflows (start → update → complete production run)
  - Cross-module integrations (production → WMS → quality)
  - Real-time subscriptions (multi-client synchronization)

#### Component Testing (Frontend)
- **Framework**: React Testing Library + Vitest
- **Coverage Target**: 70%+
- **Focus Areas**:
  - Mobile-optimized form components (numeric keypad, signature pad)
  - Offline queue management
  - Barcode scanner integration
  - State management (Zustand stores)

#### End-to-End Testing (E2E)
- **Framework**: Playwright
- **Devices**: Mobile viewport emulation (iOS Safari, Android Chrome)
- **Critical User Journeys**:
  1. Operator login → Select work center → Start production run → Enter quantities → Complete run
  2. Quality inspector → Load inspection template → Enter measurements → Fail inspection → Create defect
  3. Operator → Log downtime → Select reason → Resume production
  4. Offline mode → Queue mutations → Go online → Verify sync

### 9.2 Non-Functional Testing

#### Performance Testing
- **Tool**: Apache JMeter + Grafana k6
- **Load Profile**:
  - 100 concurrent users (mobile devices)
  - 5000 requests/minute sustained load
  - Ramp-up over 5 minutes, sustain for 30 minutes
- **Metrics**:
  - Response time: p50 < 100ms, p95 < 200ms, p99 < 500ms
  - Error rate: < 0.1%
  - Database CPU: < 70%
  - Database connections: < 400

#### Stress Testing
- **Tool**: k6
- **Load Profile**:
  - Ramp to 500 concurrent users (2.5× normal load)
  - Identify breaking point
  - Verify graceful degradation (error messages, not crashes)

#### Security Testing
- **OWASP ZAP**: Automated vulnerability scanning
- **Manual Penetration Testing**: Quarterly third-party audits
- **Focus Areas**:
  - SQL injection via GraphQL variables
  - XSS via notes/comments
  - CSRF token validation
  - JWT token expiration and refresh
  - Authorization bypass attempts

#### Usability Testing
- **Participants**: 5-10 shop floor operators (varying tech literacy)
- **Method**: Think-aloud protocol, task completion
- **Scenarios**:
  1. First-time user: Complete a production run end-to-end
  2. Experienced user: Handle a quality failure scenario
  3. Stressful situation: Log downtime during equipment breakdown
- **Metrics**:
  - Task completion rate: >90%
  - Time on task: <2 minutes for routine operations
  - Error rate: <5%
  - Satisfaction: >4/5 (SUS score >70)

#### Accessibility Testing
- **Standards**: WCAG 2.1 Level AA compliance
- **Tools**: axe DevTools, WAVE
- **Focus Areas**:
  - Color contrast (4.5:1 minimum for normal text)
  - Touch target size (44×44px minimum)
  - Screen reader compatibility (VoiceOver, TalkBack)
  - Keyboard navigation (though primarily touch-based)

---

## 10. Deployment Strategy

### 10.1 Phased Rollout Plan

#### Phase 1: Pilot (2-4 weeks)
**Scope**: Single facility, single work center, 5-10 operators
**Features**:
- Production run start/stop/complete
- Quantity reporting (good/scrap)
- Basic downtime logging

**Success Criteria**:
- 100% of production runs tracked via mobile
- <5% data entry errors compared to baseline
- Operator satisfaction >3.5/5
- Zero critical bugs

**Rollback Plan**:
- Return to manual paper forms
- Import backlog data from paper forms

#### Phase 2: Department Expansion (4-8 weeks)
**Scope**: Same facility, expand to 3-5 work centers, 20-30 operators
**Features**: Phase 1 + Quality inspection entry, SPC data entry

**Success Criteria**:
- 95%+ mobile adoption (vs. desktop/paper)
- Quality inspection cycle time reduced by 20%
- SPC data capture increased by 50%

#### Phase 3: Facility Rollout (8-12 weeks)
**Scope**: Full facility, all work centers, 50-100 operators
**Features**: Phase 2 + Changeover tracking, first article inspection

**Success Criteria**:
- OEE data accuracy >95%
- Changeover time tracking on 100% of setups
- Real-time dashboard reliability >99.5%

#### Phase 4: Multi-Facility Expansion (12+ weeks)
**Scope**: 2-5 facilities, 200-500 operators
**Features**: All features + advanced analytics, predictive alerts

**Success Criteria**:
- Cross-facility data aggregation for corporate reporting
- Self-service onboarding for new facilities (<1 week)
- Mobile app performance maintained (<200ms p95) at scale

### 10.2 Infrastructure Requirements

#### Mobile Devices
**Tablets (Primary)**:
- **Model**: iPad 10.9" or Samsung Galaxy Tab A8
- **Quantity**: 1 per work center (10-50 per facility)
- **Accessories**: Rugged case (OtterBox Defender), wall mount, charging cable
- **Cost**: $350-500 per device + $100 accessories = $450-600 total

**Smartphones (Secondary)**:
- **Model**: iPhone SE or Samsung Galaxy A54
- **Quantity**: 5-10 per facility (for quality inspectors, supervisors)
- **Cost**: $400-600 per device

**Total Hardware Budget**: $5,000-30,000 per facility (assuming 10-50 work centers)

#### Network Infrastructure
- **Wi-Fi Access Points**: 1 per 5000 sq ft (for adequate coverage)
  - Ubiquiti UniFi U6-Pro or similar enterprise-grade AP
  - Cost: $200-300 per AP
- **Network Switches**: 1 PoE switch per 24 APs
  - Ubiquiti USW-24-PoE or similar
  - Cost: $400-600 per switch

#### Barcode Scanners (Optional)
- **Bluetooth Scanners**: 1 per tablet (if using hardware scanners)
  - Zebra CS4070 or Honeywell Voyager 1472g
  - Cost: $200-500 per scanner

### 10.3 Training Plan

#### Operator Training
**Format**: Hands-on workshop (2 hours per shift)
**Curriculum**:
1. Device basics (power on, home screen, app launch)
2. Login/logout (badge scan, PIN entry)
3. Production run workflow (start, update, complete)
4. Quantity entry (numeric keypad, scrap reasons)
5. Downtime logging (timer, reason codes)
6. Quality inspection basics (template navigation, pass/fail)
7. Troubleshooting (connectivity issues, app reset)

**Materials**:
- Quick reference card (laminated, 1-page)
- Video tutorials (5-10 min each, accessible from app)
- Train-the-trainer sessions for shift supervisors

#### Quality Inspector Training
**Format**: Hands-on workshop (3 hours)
**Curriculum**:
1. Inspection template configuration
2. Measurement entry (SPC integration)
3. Photo capture and annotation
4. Disposition workflows (accept, reject, quarantine)
5. CAPA triggering

#### IT Administrator Training
**Format**: Technical workshop (1 day)
**Curriculum**:
1. Device enrollment (MDM setup)
2. App deployment and updates
3. User management (role assignment)
4. Troubleshooting (logs, diagnostics)
5. Backup and disaster recovery

---

## 11. Cost-Benefit Analysis

### 11.1 Implementation Costs (Single Facility, 20 Work Centers)

| Category | Item | Quantity | Unit Cost | Total |
|----------|------|----------|-----------|-------|
| **Hardware** | iPad 10.9" tablets | 20 | $350 | $7,000 |
|  | Rugged cases + mounts | 20 | $150 | $3,000 |
|  | Bluetooth barcode scanners (optional) | 20 | $300 | $6,000 |
|  | Wi-Fi access points | 8 | $250 | $2,000 |
| **Software Development** | Backend GraphQL API development | 160 hrs | $150/hr | $24,000 |
|  | Mobile UI development (React/PWA) | 240 hrs | $150/hr | $36,000 |
|  | QA testing (functional, performance) | 80 hrs | $100/hr | $8,000 |
|  | DevOps (deployment, monitoring) | 40 hrs | $150/hr | $6,000 |
| **Training** | Operator training (40 operators × 2 hrs) | 80 hrs | $50/hr | $4,000 |
|  | Materials (videos, documentation) | - | - | $2,000 |
| **Pilot & Rollout** | Project management | 100 hrs | $125/hr | $12,500 |
|  | On-site support (4 weeks) | 160 hrs | $100/hr | $16,000 |
| **Contingency** | 15% buffer | - | - | $18,825 |
| **TOTAL** | | | | **$145,325** |

### 11.2 Annual Operating Costs

| Category | Cost |
|----------|------|
| Device maintenance & replacement (10% annual) | $1,600 |
| Network connectivity (cellular backup, optional) | $2,400 |
| Cloud hosting (incremental) | $3,600 |
| Support & maintenance (10% of dev cost) | $7,400 |
| **TOTAL ANNUAL** | **$15,000** |

### 11.3 Expected Benefits (Annual, Single Facility)

#### Quantifiable Benefits

| Benefit | Calculation | Annual Value |
|---------|-------------|--------------|
| **Reduced Data Entry Errors** | 5% error rate → 0.5% error rate on 50,000 transactions × $50/error | $112,500 |
| **Eliminated Paper Forms** | 50,000 forms/year × $0.50 (printing, storage, retrieval) | $25,000 |
| **Faster Quality Inspections** | 5,000 inspections × 10 min savings × $30/hr labor | $25,000 |
| **Improved OEE (Availability)** | 2% OEE improvement × $5M annual production × 0.7 margin | $70,000 |
| **Reduced Downtime** | Better downtime tracking → 5% reduction × 500 hrs/year × $200/hr | $5,000 |
| **Scrap Reduction** | Real-time SPC alerts → 1% scrap reduction × $500K scrap cost | $5,000 |
| **Faster Changeovers** | Detailed tracking → 5% reduction × 1000 hrs/year × $150/hr | $7,500 |
| **TOTAL ANNUAL BENEFITS** | | **$250,000** |

#### Intangible Benefits
- **Real-time visibility**: Instant production status for planning and customer communication
- **Compliance**: Automated audit trails for ISO 9001, AS9100, FDA regulations
- **Employee satisfaction**: Reduced paperwork, modern tools, faster feedback
- **Data-driven decisions**: Historical trends for continuous improvement
- **Scalability**: Foundation for advanced analytics, machine learning

### 11.4 Return on Investment (ROI)

**First Year**:
- Total Investment: $145,325
- Annual Benefits: $250,000
- Annual Operating Cost: $15,000
- **Net Benefit Year 1**: $250,000 - $15,000 - $145,325 = **$89,675**
- **ROI Year 1**: ($89,675 / $145,325) × 100 = **61.7%**

**Payback Period**: 145,325 / (250,000 - 15,000) = **7.4 months**

**3-Year NPV** (assuming 8% discount rate):
- Year 0: -$145,325
- Year 1: ($250,000 - $15,000) / 1.08 = $217,593
- Year 2: ($250,000 - $15,000) / 1.08² = $201,475
- Year 3: ($250,000 - $15,000) / 1.08³ = $186,551
- **NPV**: $460,294
- **IRR**: ~152%

**Conclusion**: Strong financial case with sub-1-year payback and 61.7% first-year ROI.

---

## 12. Risk Analysis & Mitigation

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Poor Wi-Fi coverage in shop floor** | Medium | High | Site survey before deployment; Wi-Fi repeaters; 4G/5G cellular backup |
| **Device durability in harsh environment** | Medium | Medium | IP54+ rated cases; tempered glass screen protectors; spare devices (20% buffer) |
| **Battery life insufficient for 8-hour shift** | Low | Medium | USB-C charging stations at work centers; power banks; wall-mounted tablets |
| **Offline mode data loss** | Low | High | IndexedDB with persistence; local backup to device storage; 7-day retention |
| **GraphQL API performance degradation** | Medium | High | Load testing; database indexing; caching (Redis); read replicas; query complexity limits |
| **Third-party scanner compatibility issues** | Medium | Low | Extensive device testing; fallback to camera-based scanning; vendor partnerships |
| **PWA installation friction (iOS)** | Medium | Low | Clear onboarding instructions; QR codes for easy URL access; bookmark fallback |

### 12.2 Organizational Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Operator resistance to technology** | Medium | High | Change management; involve operators in pilot; emphasize benefits (less paperwork, instant feedback); gamification (leaderboards) |
| **Insufficient training time** | High | Medium | Train-the-trainer model; video tutorials; in-app help; shift supervisors as champions |
| **Competing priorities during rollout** | Medium | Medium | Executive sponsorship; dedicated project team; phased rollout (minimize disruption) |
| **Data entry accuracy concerns** | Low | Medium | Validation at entry point; supervisor review workflows; audit reports |
| **Union/labor relations issues** | Low | High | Early engagement with union representatives; transparency on monitoring (productivity, not surveillance); privacy protections |

### 12.3 Data & Security Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
| **Unauthorized access to production data** | Low | High | Role-based access control; session timeouts; badge-based authentication; audit logging |
| **Device theft or loss** | Medium | High | MDM remote wipe; device encryption; "Find My Device" tracking; insurance |
| **Data breach via compromised device** | Low | Critical | Certificate pinning; VPN for API access; jailbreak detection; regular security audits |
| **Insider threat (data exfiltration)** | Low | Medium | Disable USB debugging; prevent screenshots of sensitive data; audit exports; DLP policies |
| **GDPR/CCPA compliance violation** | Low | High | Data minimization; anonymization; consent management; data retention policies; legal review |

---

## 13. Key Recommendations

### 13.1 High Priority (Must-Have for MVP)

1. **Progressive Web App (PWA) Architecture**
   - Leverage existing React/TypeScript stack
   - Responsive mobile-first design
   - Service workers for offline capability
   - IndexedDB for local data persistence

2. **Core Production Workflows**
   - Production run start/stop/complete
   - Quantity reporting (good/scrap with reason codes)
   - Basic downtime logging with reason codes
   - Real-time status updates via GraphQL subscriptions

3. **Mobile-Optimized UI Components**
   - Large touch targets (44×44px minimum)
   - Numeric keypad for quantity entry
   - Barcode scanner (camera-based for MVP)
   - Simple navigation (max 2-3 levels)

4. **Authentication & Authorization**
   - Badge scan authentication (camera-based QR/barcode)
   - PIN authentication as backup
   - Role-based access control (operator, inspector, supervisor)
   - Automatic session timeout (configurable)

5. **Offline Mode**
   - Local mutation queue with IndexedDB
   - Background sync when connectivity restored
   - Clear offline/online status indicator
   - Conflict resolution for concurrent edits

6. **Integration with Existing Systems**
   - Production planning module (scheduled runs)
   - OEE calculation engine (real-time metrics)
   - Equipment status log (downtime tracking)
   - Production analytics dashboard (live updates)

### 13.2 Medium Priority (Phase 2 Enhancements)

7. **Quality Inspection Module**
   - Inspection template loading
   - Measurement entry with spec limits
   - Pass/fail determination
   - Disposition workflows (accept/reject/rework/quarantine)
   - Photo capture for defects

8. **SPC Integration**
   - Real-time measurement entry to control charts
   - Automatic control limit comparison
   - Out-of-control alerts (Western Electric Rules)
   - Visual control chart on mobile

9. **Advanced Downtime Tracking**
   - Hierarchical reason codes (category → reason)
   - Automatic timer start on status change
   - Maintenance work order integration
   - Supervisor escalation workflows

10. **Changeover Tracking**
    - Changeover type selection
    - Breakdown by activity (washup, plate change, etc.)
    - Setup waste tracking
    - Lean improvement opportunities capture

### 13.3 Low Priority (Future Enhancements)

11. **Hardware Scanner Integration**
    - Bluetooth barcode scanner support
    - RFID badge reader integration
    - Spectrophotometer integration (automated color measurement)
    - Press counter integration (automatic quantity tracking)

12. **Advanced Analytics**
    - Operator performance scorecards
    - Work center efficiency benchmarking
    - Predictive maintenance alerts
    - Scrap trend analysis with root cause Pareto charts

13. **Voice Input**
    - Voice-to-text for notes
    - Voice commands for hands-free operation (in press area)
    - Multi-language support (English, Spanish, Chinese)

14. **Augmented Reality (AR)**
    - AR work instructions overlaid on equipment
    - Visual troubleshooting guides
    - Remote expert assistance with AR annotations

---

## 14. Success Metrics & KPIs

### 14.1 Adoption Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Mobile app adoption rate | >90% of production runs tracked via mobile within 3 months | (Mobile-tracked runs / Total runs) × 100 |
| Active daily users | >80% of operators use app daily | Daily active users / Total operators |
| Session duration | 4-6 hours per operator per shift | Average session_end - session_start from mobile_sessions |
| Feature utilization | >70% of operators use quality inspection module | Count distinct users with quality_inspection records |

### 14.2 Data Quality Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Data entry error rate | <1% (down from 5% baseline) | Manual audits; comparison to IoT sensor data |
| Data completeness | >95% of production runs have complete data (quantities, times, notes) | Count NULL fields in production_runs |
| Real-time data latency | <30 seconds from mobile entry to dashboard display | Timestamp comparison: dashboard_display - mobile_entry |
| Offline sync success rate | >99% of offline mutations successfully synced | (Successful syncs / Total offline mutations) × 100 |

### 14.3 Operational Efficiency Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| OEE improvement | +2-5% within 6 months | OEE calculations comparison: post-implementation vs. baseline |
| Quality inspection cycle time | -20% reduction | Average inspection duration: inspection_end - inspection_start |
| Scrap rate reduction | -1-2% within 6 months | (Scrap quantity / Total quantity) × 100 |
| Changeover time reduction | -5-10% within 6 months | Average changeover duration: changeover_end - changeover_start |
| Downtime tracking accuracy | >95% of downtime events have reason codes | Count downtime entries with non-null reason_code |

### 14.4 User Experience Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| System Usability Scale (SUS) score | >70 (good usability) | Quarterly user survey (10-question SUS survey) |
| Task completion rate | >90% for routine operations | Usability testing observations |
| Time on task | <2 minutes for production run completion | Timer from "Start" button to "Complete" submission |
| Error recovery rate | >95% of errors resolved without supervisor intervention | Support ticket analysis |
| Net Promoter Score (NPS) | >30 (would recommend to colleagues) | Quarterly user survey |

### 14.5 Technical Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| API response time (p95) | <200ms | GraphQL query execution time (Apollo Server metrics) |
| API error rate | <0.1% | (Failed requests / Total requests) × 100 |
| Mobile app crash rate | <0.5% | Crash reporting tool (Sentry, Crashlytics) |
| Offline sync latency | <5 minutes from connectivity restoration | Background sync completion time |
| PWA installation rate | >60% of users install app to home screen | PWA install event tracking |

---

## 15. Conclusion & Next Steps

### 15.1 Summary of Findings

The research analysis reveals that the print manufacturing ERP system has a **robust foundation** for implementing mobile shop floor data collection:

**Strengths**:
1. **Comprehensive production data model**: Production runs, work centers, operations, OEE tracking already in place
2. **Advanced quality infrastructure**: Inspection templates, SPC control charts, defect tracking fully implemented
3. **IoT integration readiness**: Sensor readings, device management, real-time data ingestion capabilities
4. **Modern technology stack**: React/TypeScript frontend, GraphQL API, PostgreSQL database enable mobile PWA approach

**Gaps Identified**:
1. **Mobile-optimized UI**: Current web UI is not optimized for tablet/smartphone touch interactions
2. **Offline capability**: No service worker or local data persistence for disconnected operation
3. **Barcode scanning**: No integration with mobile device cameras or Bluetooth scanners
4. **Mobile authentication**: No badge scan or biometric login workflows
5. **Scrap/downtime reason codes**: Need standardized reason code tables for root cause analysis

**Recommended Approach**: **Progressive Web App (PWA)** with responsive mobile-first design, service workers for offline mode, and integration with existing GraphQL API. This approach maximizes code reuse, enables cross-platform deployment, and provides rapid update cycles without app store dependencies.

### 15.2 Implementation Roadmap

#### Phase 1: Foundation (Weeks 1-4)
- [ ] PWA architecture setup (service workers, web app manifest)
- [ ] Mobile-optimized UI component library (numeric keypad, touch-friendly buttons)
- [ ] Camera-based barcode scanner integration
- [ ] Badge scan authentication workflow
- [ ] Offline mode with IndexedDB queue

#### Phase 2: Core Workflows (Weeks 5-8)
- [ ] Production run start/stop/complete mobile UI
- [ ] Quantity reporting (good/scrap) with reason codes
- [ ] Downtime logging with reason codes
- [ ] Real-time GraphQL subscriptions for multi-user sync
- [ ] Backend: scrap_reasons and downtime_reasons tables

#### Phase 3: Quality & SPC (Weeks 9-12)
- [ ] Quality inspection mobile UI (template loading, measurement entry)
- [ ] Photo capture for defects
- [ ] SPC measurement entry with control chart visualization
- [ ] Out-of-control alerts and notifications

#### Phase 4: Pilot & Rollout (Weeks 13-16)
- [ ] Single work center pilot (5-10 operators)
- [ ] Usability testing and refinement
- [ ] Operator training materials (videos, quick reference cards)
- [ ] Performance testing and optimization
- [ ] Facility-wide rollout planning

### 15.3 Critical Success Factors

1. **Executive Sponsorship**: C-level commitment to resource allocation and change management
2. **Operator Involvement**: Early engagement of shop floor workers in design and pilot testing
3. **Robust Offline Mode**: Production cannot stop due to Wi-Fi issues; offline capability is non-negotiable
4. **Performance at Scale**: Sub-200ms response times maintained with 100+ concurrent users
5. **Simplicity**: Mobile UI must be intuitive for operators with varying tech literacy; training time <2 hours
6. **Data Accuracy**: Validation and error prevention to ensure mobile data quality matches/exceeds paper forms
7. **Change Management**: Training, communication, and incentives to drive adoption

### 15.4 Open Questions for Product Owner

1. **Device Procurement**: Will the organization provide dedicated tablets, or will operators use personal devices (BYOD)? (Recommendation: Dedicated tablets for hygiene, durability, and standardization)

2. **Barcode Scanner Hardware**: Invest in Bluetooth scanners ($200-500 each) or rely on camera-based scanning? (Recommendation: Start with camera, upgrade to hardware scanners based on pilot feedback)

3. **Offline Data Retention**: How long should mobile devices cache data when offline? (Recommendation: 1-2 hours to balance functionality and storage constraints)

4. **Authentication Method**: Badge scan, PIN, biometric, or combination? (Recommendation: Badge scan primary with PIN backup)

5. **Supervisor Override**: How should supervisor approvals work for mobile? Separate supervisor device, or same tablet with elevated permissions? (Recommendation: Same device with supervisor PIN for convenience)

6. **Multi-Language Support**: Which languages are required for operator UI? (Common in print industry: English, Spanish, Chinese)

7. **Photo Retention**: How long should defect photos be retained, and where (local device, cloud storage, database BLOB)? (Recommendation: Cloud storage with 2-year retention, GDPR anonymization option)

8. **Real-Time Dashboards**: Should production dashboards update in real-time (WebSocket subscriptions) or near-real-time (polling every 5-10 seconds)? (Recommendation: Real-time for critical metrics like OEE, near-real-time for aggregated analytics)

---

## 16. Research Artifacts & References

### 16.1 Database Schema Files Reviewed
1. `print-industry-erp/backend/database/schemas/operations-module.sql`
   - Production orders, production runs, work centers, operations, OEE calculations
2. `print-industry-erp/backend/database/schemas/quality-hr-iot-security-marketplace-imposition-module.sql`
   - Quality inspections, defects, IoT devices, sensor readings
3. `print-industry-erp/backend/migrations/V0.0.40__create_jobs_and_standard_costs_tables.sql`
   - Jobs, cost centers, standard costs
4. `print-industry-erp/backend/migrations/V0.0.40__create_routing_templates.sql`
   - Routing templates, routing operations
5. `print-industry-erp/backend/migrations/V0.0.44__create_spc_tables.sql`
   - SPC control chart data (partitioned), control limits, process capability, alerts

### 16.2 Frontend Files Reviewed
1. `print-industry-erp/frontend/package.json`
   - Technology stack: React 18, TypeScript, Vite, Apollo Client, Zustand
2. `print-industry-erp/frontend/src/pages/ProductionRunExecutionPage.tsx`
   - Existing production run UI, GraphQL mutations
3. `print-industry-erp/frontend/ARCHITECTURE_DIAGRAM.md`
   - Module resolution, GraphQL query structure
4. `print-industry-erp/backend/src/graphql/schema/operations.graphql`
   - Production types, queries, mutations, subscriptions

### 16.3 Backend Service Files Reviewed
1. `print-industry-erp/backend/src/modules/operations/operations.module.ts`
   - Services: RoutingManagementService, ProductionPlanningService, ProductionAnalyticsService
2. GraphQL resolvers (inferred from schema):
   - OperationsResolver, WMSResolver, QualityResolver

### 16.4 Industry Best Practices Consulted
1. **Progressive Web Apps (PWA)**: Google Developers PWA documentation
2. **Offline-First Design**: Service Worker API, IndexedDB, Background Sync API
3. **Touch UI Design**: Apple Human Interface Guidelines (iOS), Material Design (Android)
4. **Statistical Process Control (SPC)**: Western Electric Rules, AIAG SPC manual
5. **Manufacturing Execution Systems (MES)**: ISA-95 standard for enterprise-control system integration
6. **Print Industry Standards**: G7 color management, ISO 12647 process control

---

**End of Research Deliverable**

---

## Appendix A: GraphQL Schema Extensions (Detailed)

### Production Run Progress Tracking

```graphql
input ProductionRunProgressInput {
  runId: ID!
  goodQuantity: Float!
  scrapQuantity: Float!
  scrapDetails: [ScrapDetailInput!]
  downtimeEntries: [DowntimeEntryInput!]
  notes: String
  timestamp: DateTime!
  deviceId: String
  offlineBatchId: ID
}

input ScrapDetailInput {
  quantity: Float!
  reasonCode: String!
  notes: String
  timestamp: DateTime!
}

input DowntimeEntryInput {
  startTimestamp: DateTime!
  endTimestamp: DateTime
  reasonCode: String!
  notes: String
}

type ProductionRunProgressPayload {
  productionRun: ProductionRun!
  conflicts: [DataConflict!]
  validationErrors: [ValidationError!]
}

type DataConflict {
  field: String!
  serverValue: Float!
  clientValue: Float!
  resolution: ConflictResolution!
}

enum ConflictResolution {
  SERVER_WINS
  CLIENT_WINS
  MERGED
  MANUAL_REVIEW_REQUIRED
}
```

### SPC Measurement Input

```graphql
input SPCMeasurementInput {
  productionRunId: ID
  workCenterId: ID
  productId: ID
  parameterCode: String!
  measuredValue: Float!
  subgroupNumber: Int
  subgroupSize: Int
  measurementMethod: MeasurementMethod!
  measurementDeviceId: ID
  qualityInspectionId: ID
  operatorUserId: ID
  timestamp: DateTime!
}

enum MeasurementMethod {
  AUTO_SENSOR
  MANUAL_SPECTRO
  MANUAL_ENTRY
  VISUAL
}

type SPCMeasurementPayload {
  measurement: SPCMeasurement!
  isInControl: Boolean!
  violatedRules: [String!]
  alert: SPCAlert
}

type SPCMeasurement {
  id: ID!
  parameterCode: String!
  measuredValue: Float!
  timestamp: DateTime!
  isInControl: Boolean!
  upperControlLimit: Float!
  centerLine: Float!
  lowerControlLimit: Float!
}

type SPCAlert {
  id: ID!
  severity: AlertSeverity!
  message: String!
  violatedRules: [WesternElectricRule!]
  recommendedAction: String
}

enum WesternElectricRule {
  RULE_1_OUTSIDE_LIMITS
  RULE_2_NINE_SAME_SIDE
  RULE_3_SIX_INCREASING
  RULE_4_FOURTEEN_ALTERNATING
}
```

### Quality Inspection Input

```graphql
input QualityInspectionInput {
  inspectionTemplateId: ID!
  productionRunId: ID
  purchaseOrderId: ID
  lotNumber: String
  sampleSize: Int!
  inspectionResults: [InspectionResultInput!]!
  passFailResult: PassFail!
  disposition: InspectionDisposition!
  inspectorUserId: ID!
  inspectionDate: DateTime!
  notes: String
  photos: [PhotoUploadInput!]
}

input InspectionResultInput {
  inspectionPointId: String!
  measuredValue: Float
  passFail: PassFail!
  notes: String
}

input PhotoUploadInput {
  fileName: String!
  fileSize: Int!
  mimeType: String!
  base64Data: String!  # Base64-encoded image data
  caption: String
}

enum PassFail {
  PASS
  FAIL
}

enum InspectionDisposition {
  ACCEPT
  REJECT
  REWORK
  USE_AS_IS
  QUARANTINE
}

type QualityInspectionPayload {
  inspection: QualityInspection!
  triggeredActions: [TriggeredAction!]
  defects: [QualityDefect!]
}

type TriggeredAction {
  type: ActionType!
  details: String!
  assignedTo: User
  dueDate: DateTime
}

enum ActionType {
  QUARANTINE
  NOTIFICATION
  PRODUCTION_HOLD
  CAPA_REQUIRED
  SUPERVISOR_REVIEW
}
```

---

## Appendix B: Mobile UI Wireframes (Text Descriptions)

### Screen 1: Production Run Dashboard (Home)
**Layout**: List view with cards

**Header**:
- Facility selector (dropdown)
- Work center filter (dropdown)
- Refresh icon (manual sync)
- Offline/online status indicator (green/red dot)

**Body** (scrollable list):
- Each production run displayed as a card:
  - **Top**: Production run number (large, bold), Status badge (color-coded)
  - **Middle**: Product code, Product description (truncated)
  - **Bottom left**: Progress bar (% complete), Quantity (good/total)
  - **Bottom right**: Swipe-left action: "Complete", "Log Downtime", "Pause"

**Footer** (sticky):
- Large button: "+ Start Production Run" (primary color, full-width)

### Screen 2: Start Production Run
**Layout**: Form view with large touch targets

**Header**:
- Title: "Start Production Run"
- Back button (top-left)

**Body**:
1. **Barcode Scanner Section**:
   - Camera preview window (live video feed)
   - "Scan Production Run Barcode" instruction
   - Manual entry link below: "Or enter run number manually"

2. **Operator Login** (after scan):
   - "Operator Badge Scan" section
   - Camera preview for badge QR code
   - Alternative: PIN entry numeric keypad

3. **Setup Checklist** (expandable):
   - [ ] Materials loaded
   - [ ] Plates installed
   - [ ] First piece approved
   - [ ] Safety check complete

4. **Photo Capture** (optional):
   - "Capture Setup Photo" button
   - Thumbnail preview if photo taken

**Footer**:
- Large button: "Start Production" (green, full-width)
- Cancel button (secondary, full-width)

### Screen 3: Production Data Entry (Active Run)
**Layout**: Dashboard view with real-time updates

**Header**:
- Production run number (title)
- Status: "RUNNING" (green badge)
- Timer: Elapsed time (HH:MM:SS, live countdown)
- Menu icon (top-right): Pause, Complete, Log Downtime

**Body** (2-column layout for tablets, single-column for phones):

**Left Column**:
- **Product Info Card**:
  - Product code, description
  - Target quantity: 10,000 sheets
  - Progress bar: 45% complete

- **Timing Card**:
  - Setup time: 30 min
  - Run time: 2h 15m
  - Downtime: 5 min
  - Projected completion: 3:45 PM

**Right Column**:
- **Quantity Entry Card**:
  - Good Quantity: 4,500 (large numeric input)
  - +100, +500, +1000 quick-add buttons
  - Scrap Quantity: 250 (numeric input)
  - Scrap reason dropdown
  - "Update" button (auto-save on blur)

- **Status Card**:
  - Equipment status: IN_USE (green)
  - Operator: John Smith
  - Last update: 2 min ago

**Bottom Sheet** (swipe-up or tap "Log Downtime"):
- Downtime reason dropdown (hierarchical)
- Timer auto-start
- Notes field (voice-to-text icon)
- "Resume Production" button

**Footer**:
- Large button: "Complete Production Run" (blue, full-width)

### Screen 4: Quality Inspection Entry
**Layout**: Checklist form with inspection points

**Header**:
- Title: "Quality Inspection"
- Inspection template name (subtitle)
- Back button

**Body** (scrollable checklist):
- Each inspection point displayed as a card:
  - **Point Name** (e.g., "Width Measurement")
  - **Spec**: 10.0 ± 0.1 inches
  - **Measured Value**: Numeric input (large)
  - **In Tolerance Indicator**: Green checkmark or red X (auto-calculated)
  - **Notes**: Text field (optional)

- **Photo Capture Section**:
  - "Add Defect Photo" button
  - Thumbnail previews of captured photos
  - Annotation tools (arrow, circle, text)

**Footer**:
- Pass/Fail toggle (large)
- Disposition dropdown (if fail)
- "Submit Inspection" button (green if pass, red if fail)

### Screen 5: SPC Data Entry
**Layout**: Form with real-time chart

**Header**:
- Title: "SPC Measurement"
- Parameter name (subtitle)

**Body**:
1. **Parameter Selection**:
   - Dropdown: INK_DENSITY, REGISTER, DOT_GAIN, COLOR_DELTA_E, etc.
   - Automatically loads control limits for selected parameter

2. **Measurement Entry**:
   - Large numeric input (with unit label)
   - Spec limits displayed: USL, Target, LSL
   - Control limits displayed: UCL, CL, LCL

3. **Real-Time Control Chart** (mini sparkline):
   - Last 20 measurements plotted
   - Control limit lines (dashed)
   - Current measurement highlighted (dot)
   - Out-of-control points (red)

4. **Measurement Details**:
   - Subgroup number (auto-increment)
   - Measurement method: Auto, Manual, Spectro
   - Device (if auto)

**Footer**:
- "Record Measurement" button
- If out-of-control: Alert banner appears above button
  - "OUT OF CONTROL: Rule 1 Violated" (red background)
  - "Corrective Action Required" link (opens modal)

---

## Appendix C: Offline Sync Algorithm (Pseudocode)

```typescript
// Service Worker: Background Sync
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-production-data') {
    event.waitUntil(syncPendingMutations());
  }
});

async function syncPendingMutations() {
  const db = await openIndexedDB();
  const pendingMutations = await db.getAll('pending_mutations', {
    status: 'PENDING',
    orderBy: 'priority,timestamp'
  });

  for (const mutation of pendingMutations) {
    try {
      // Update status to SYNCING
      await db.update('pending_mutations', mutation.id, { status: 'SYNCING' });

      // Execute GraphQL mutation
      const result = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation.mutation,
          variables: mutation.variables
        })
      });

      const data = await result.json();

      if (data.errors) {
        // Check for conflict errors
        if (data.errors[0].extensions?.code === 'CONFLICT') {
          // Apply conflict resolution strategy
          const resolved = await resolveConflict(mutation, data.errors[0]);
          if (resolved) {
            await db.delete('pending_mutations', mutation.id);
          } else {
            // Escalate to manual resolution
            await db.update('pending_mutations', mutation.id, {
              status: 'FAILED',
              errorMessage: 'Conflict resolution required'
            });
          }
        } else {
          // Retry on transient errors
          const retryCount = mutation.retryCount + 1;
          if (retryCount < 3) {
            await db.update('pending_mutations', mutation.id, {
              status: 'PENDING',
              retryCount: retryCount
            });
          } else {
            // Max retries exceeded
            await db.update('pending_mutations', mutation.id, {
              status: 'FAILED',
              errorMessage: data.errors[0].message
            });
          }
        }
      } else {
        // Success: delete from queue
        await db.delete('pending_mutations', mutation.id);

        // Update local cache with server response
        await updateLocalCache(mutation.entityType, mutation.entityId, data.data);
      }
    } catch (error) {
      // Network error: keep in queue for next sync
      await db.update('pending_mutations', mutation.id, {
        status: 'PENDING',
        retryCount: mutation.retryCount + 1
      });
    }
  }
}

async function resolveConflict(mutation, error) {
  const conflictFields = error.extensions.conflicts;

  for (const conflict of conflictFields) {
    if (conflict.field === 'goodQuantity') {
      // For quantities: server value is authoritative (sum of all updates)
      return true;  // Accept server value
    } else if (conflict.field === 'status') {
      // For status: check timestamps
      if (mutation.timestamp > conflict.serverTimestamp) {
        // Client update is newer: retry with force flag
        mutation.variables.force = true;
        return false;  // Retry
      } else {
        // Server update is newer: accept server value
        return true;
      }
    } else {
      // For other fields: last write wins
      return true;  // Accept server value
    }
  }
}
```

---

**END OF RESEARCH DELIVERABLE**
