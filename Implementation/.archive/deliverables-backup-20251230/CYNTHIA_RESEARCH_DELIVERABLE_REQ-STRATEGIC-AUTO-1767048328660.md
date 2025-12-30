# Research Deliverable: Real-Time Production Analytics Dashboard
**REQ-STRATEGIC-AUTO-1767048328660**

**Research Analyst:** Cynthia (Research Specialist)
**Date:** 2025-12-29
**Status:** COMPLETE

---

## Executive Summary

This research deliverable provides a comprehensive analysis of the existing system architecture and recommendations for implementing a Real-Time Production Analytics Dashboard. The system already has robust production tracking infrastructure through the Operations module, including production orders, production runs, work centers, and OEE (Overall Equipment Effectiveness) calculations. The proposed dashboard will leverage existing GraphQL APIs, NATS messaging infrastructure, and comprehensive database schemas to provide real-time visibility into manufacturing operations.

---

## 1. Current System Analysis

### 1.1 Production Data Model (Operations Module)

The system has a well-architected production data model with 12 primary tables:

**Core Production Entities:**
- **work_centers** - Manufacturing equipment (presses, bindery, finishing equipment)
  - Tracks equipment specifications, capacity, costs, maintenance schedules
  - Supports press specifications for imposition engine integration
  - Location: `operations-module.sql:17-85`

- **production_orders** - High-level production orders from sales
  - Links to sales orders and product catalog
  - Tracks quantities (ordered, completed, scrapped)
  - Manufacturing strategy support (MTS, MTO, CTO, ETO, POD, VDP)
  - Location: `operations-module.sql:95-163`

- **production_runs** - Actual production execution tracking
  - Real-time tracking of production progress
  - Operator assignment and time tracking
  - Quantity tracking (planned, good, scrap, rework)
  - Setup/run/downtime tracking
  - Location: `operations-module.sql:230-293`

**Supporting Entities:**
- **operations** - Operation types (printing, die cutting, folding, etc.)
- **changeover_details** - Changeover/setup time tracking for lean manufacturing
- **equipment_status_log** - Real-time equipment status for OEE calculations
- **maintenance_records** - Preventive and corrective maintenance tracking
- **oee_calculations** - Daily OEE snapshots (Availability × Performance × Quality)
- **production_schedules** - Production scheduling (Gantt chart data)
- **capacity_planning** - Capacity planning and utilization tracking

### 1.2 Existing GraphQL API

**Location:** `backend/src/graphql/schema/operations.graphql`

**Available Queries:**
```graphql
# Work Centers
- workCenter(id: ID!)
- workCenters(facilityId: ID!, status: WorkCenterStatus)
- workCenterAsOf(workCenterCode: String!, facilityId: ID!, asOfDate: Date!)
- workCenterHistory(workCenterCode: String!, facilityId: ID!)

# Production Orders
- productionOrder(id: ID!)
- productionOrders(facilityId: ID!, status: ProductionOrderStatus, dueAfter: Date, dueBefore: Date)

# Production Runs
- productionRun(id: ID!)
- productionRuns(facilityId: ID, workCenterId: ID, status: ProductionRunStatus, startDate: DateTime, endDate: DateTime)

# OEE and Analytics
- oeeCalculations(workCenterId: ID!, startDate: Date!, endDate: Date!)
- productionSchedule(workCenterId: ID, facilityId: ID, startDate: Date!, endDate: Date!)
- maintenanceRecords(workCenterId: ID!, startDate: Date, endDate: Date, type: MaintenanceType)
- capacityPlanning(facilityId: ID, workCenterId: ID, startDate: Date!, endDate: Date!)
```

**Resolver Implementation:** `backend/src/graphql/resolvers/operations.resolver.ts` (1207 lines)
- Fully implemented CRUD operations for all production entities
- Direct PostgreSQL integration via connection pool
- Comprehensive row mapping functions

### 1.3 Frontend Dashboard Infrastructure

**Existing Dashboard Pages:** 20 dashboards identified
- ExecutiveDashboard
- OperationsDashboard (production-focused)
- BinUtilizationDashboard, BinDataQualityDashboard, Bin3DOptimizationDashboard
- VendorScorecardDashboard, VendorComparisonDashboard
- SalesQuoteDashboard
- InventoryForecastingDashboard
- MonitoringDashboard, OrchestratorDashboard
- And 11 more specialized dashboards

**Current OperationsDashboard Features:**
- Production run tracking with status filtering (active/scheduled/completed)
- OEE visualization by press with component breakdown
- Work center status cards showing real-time OEE and current jobs
- Progress tracking with visual progress bars
- Mock data implementation - needs real GraphQL integration

**Reusable Components:**
- **DataTable** - Advanced table with sorting, filtering, pagination
- **Chart** - Supports bar, line, area, pie charts via Recharts
- **KPICard** - Standardized KPI display component
- **FacilitySelector** - Multi-facility filtering
- **ErrorBoundary** - Error handling wrapper
- **Breadcrumb** - Navigation breadcrumbs

### 1.4 Real-Time Infrastructure

**NATS Messaging System:**
- Already deployed and operational for agent coordination
- **AgentActivityService** demonstrates real-time subscription pattern
  - Subscribes to `agog.deliverables.>` and `agog.workflows.>`
  - Real-time activity tracking and status updates
  - Location: `backend/src/modules/monitoring/services/agent-activity.service.ts`

**Real-Time Capabilities:**
- NATS connection pooling and auto-reconnect
- JSONCodec for message serialization
- Subject-based pub/sub pattern
- Async iteration over message streams

**Potential Real-Time Subjects:**
```
agog.production.runs.>          # Production run updates
agog.production.equipment.>     # Equipment status changes
agog.production.oee.>          # OEE calculation updates
agog.production.alerts.>       # Production alerts
```

---

## 2. Technology Stack Assessment

### 2.1 Backend Stack
- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL 16 with TimescaleDB extensions
- **GraphQL:** Apollo Server with code-first approach
- **Messaging:** NATS for real-time event streaming
- **ORM:** Direct SQL via pg connection pool (no ORM overhead)

### 2.2 Frontend Stack
- **Framework:** React 18 with TypeScript
- **State Management:** Zustand (app store)
- **GraphQL Client:** Apollo Client
- **Charts:** Recharts library
- **UI Components:** TanStack Table, Lucide icons
- **Styling:** Tailwind CSS with custom design system

### 2.3 Infrastructure
- **Containerization:** Docker Compose
- **Services:** PostgreSQL, NATS, Backend API, Frontend, Agent Backend
- **Monitoring:** Health check endpoints, system error logging

---

## 3. Dashboard Requirements Analysis

### 3.1 Key Performance Indicators (KPIs)

**Production Metrics:**
1. **OEE (Overall Equipment Effectiveness)**
   - Availability % = (Runtime / Planned Production Time) × 100
   - Performance % = (Ideal Cycle Time × Total Pieces / Runtime) × 100
   - Quality % = (Good Pieces / Total Pieces) × 100
   - OEE % = Availability × Performance × Quality
   - World-class target: 85%

2. **Production Throughput**
   - Units produced per hour/shift/day
   - Production run completion rate
   - Schedule adherence percentage

3. **Work Center Utilization**
   - Active vs. idle time
   - Planned vs. actual hours
   - Capacity utilization percentage

4. **Quality Metrics**
   - Scrap rate (scrap quantity / total quantity)
   - First-pass yield
   - Rework percentage

5. **Changeover Performance**
   - Average changeover time by type
   - Setup waste tracking
   - SMED (Single-Minute Exchange of Die) progress

### 3.2 Real-Time Requirements

**Update Frequency:**
- **Production run status:** Real-time (WebSocket/NATS)
- **Equipment status:** Real-time (<5 second latency)
- **OEE calculations:** Every 15 minutes + end-of-shift
- **Schedule updates:** Real-time when schedules change
- **Alerts:** Immediate (<1 second)

**Real-Time Event Types:**
- Production run started/paused/completed
- Equipment status change (productive ↔ non-productive)
- Downtime events with reason codes
- Quality alerts (scrap threshold exceeded)
- Maintenance events
- Schedule conflicts

### 3.3 User Experience Requirements

**Dashboard Sections:**
1. **Overview Cards** (Top KPIs)
   - Active production runs count
   - Average OEE across facility
   - Total units produced (today)
   - Current downtime incidents

2. **Work Center Grid** (Real-time status)
   - Visual status indicators (green/yellow/red)
   - Current job assignment
   - Real-time OEE gauge
   - Progress bar for current run

3. **Production Run Table**
   - Filterable by status, work center, operator
   - Sortable columns
   - Drill-down to run details
   - Action buttons (pause, complete, add notes)

4. **OEE Trends Chart**
   - Time-series visualization
   - By work center comparison
   - Component breakdown (A × P × Q)
   - Trend indicators

5. **Alerts & Notifications Panel**
   - Critical: Equipment down, quality issue
   - Warning: Approaching downtime, low OEE
   - Info: Scheduled maintenance, run completed

6. **Schedule Gantt View**
   - Timeline visualization
   - Drag-and-drop rescheduling
   - Conflict highlighting
   - Load balancing visualization

---

## 4. Architecture Recommendations

### 4.1 Real-Time Data Flow

```
[Equipment/Operators] → [Production Run Updates]
           ↓
[Backend API] → [Database Write] → [NATS Publish]
           ↓                              ↓
[GraphQL Subscription] ←─────────────────┘
           ↓
[Frontend WebSocket] → [React State Update] → [UI Re-render]
```

**Implementation Pattern:**
1. Production run mutations publish NATS events
2. GraphQL subscriptions listen to NATS subjects
3. Frontend subscribes via WebSocket
4. Optimistic UI updates for instant feedback

### 4.2 Database Optimization

**Materialized Views for Analytics:**
```sql
-- Real-time production summary (refresh every 1 minute)
CREATE MATERIALIZED VIEW mv_production_summary_realtime AS
SELECT
  pr.facility_id,
  pr.work_center_id,
  wc.work_center_name,
  COUNT(*) FILTER (WHERE pr.status = 'RUNNING') as active_runs,
  COUNT(*) FILTER (WHERE pr.status = 'SCHEDULED') as scheduled_runs,
  SUM(pr.good_quantity) as total_good_quantity,
  SUM(pr.scrap_quantity) as total_scrap_quantity,
  AVG(pr.good_quantity::decimal / NULLIF(pr.target_quantity, 0)) as avg_yield
FROM production_runs pr
JOIN work_centers wc ON pr.work_center_id = wc.id
WHERE pr.start_timestamp >= CURRENT_DATE
GROUP BY pr.facility_id, pr.work_center_id, wc.work_center_name;

-- Incremental refresh on production run updates
CREATE INDEX idx_production_runs_realtime ON production_runs(start_timestamp, status)
  WHERE start_timestamp >= CURRENT_DATE;
```

**Partitioning for Historical Data:**
```sql
-- Partition production_runs by month for performance
CREATE TABLE production_runs (
  -- ... columns ...
) PARTITION BY RANGE (start_timestamp);

CREATE TABLE production_runs_2025_12 PARTITION OF production_runs
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

### 4.3 GraphQL Subscription Schema

**Proposed Schema Addition:**
```graphql
extend type Subscription {
  """Real-time production run updates"""
  productionRunUpdated(facilityId: ID!, workCenterId: ID): ProductionRun!

  """Equipment status changes"""
  equipmentStatusChanged(facilityId: ID!): EquipmentStatusLog!

  """OEE calculation completed"""
  oeeCalculated(workCenterId: ID!): OEECalculation!

  """Production alerts"""
  productionAlert(facilityId: ID!, severity: AlertSeverity): ProductionAlert!
}

type ProductionAlert {
  id: ID!
  severity: AlertSeverity!
  type: AlertType!
  workCenterId: ID
  productionRunId: ID
  message: String!
  timestamp: DateTime!
  acknowledged: Boolean!
}

enum AlertSeverity {
  CRITICAL
  WARNING
  INFO
}

enum AlertType {
  EQUIPMENT_DOWN
  QUALITY_ISSUE
  SCHEDULE_CONFLICT
  LOW_OEE
  MAINTENANCE_DUE
}
```

### 4.4 Frontend State Management

**Zustand Store Extension:**
```typescript
interface ProductionState {
  // Real-time data
  activeRuns: ProductionRun[];
  equipmentStatus: Map<string, EquipmentStatus>;
  currentAlerts: ProductionAlert[];

  // Filters
  selectedFacility: string | null;
  selectedWorkCenter: string | null;
  statusFilter: 'all' | 'active' | 'scheduled';

  // Actions
  updateProductionRun: (run: ProductionRun) => void;
  updateEquipmentStatus: (status: EquipmentStatus) => void;
  addAlert: (alert: ProductionAlert) => void;
  acknowledgeAlert: (alertId: string) => void;
}
```

---

## 5. Integration Points

### 5.1 Existing System Integration

**Sales Module Integration:**
- Production orders linked to sales orders (`production_orders.sales_order_id`)
- Customer priority propagation to production scheduling
- Due date tracking from sales commitments

**WMS Module Integration:**
- Material consumption tracking during production
- Lot/batch traceability for produced goods
- Finished goods inventory updates on run completion

**Quality Module Integration:**
- First-piece approval workflow
- In-process quality inspections
- Defect tracking and root cause analysis

**Finance Module Integration:**
- Actual cost capture (material, labor, overhead)
- Variance analysis (estimated vs. actual)
- Job costing and profitability analysis

### 5.2 External System Considerations

**MES (Manufacturing Execution System) Integration:**
- Equipment data collection via OPC-UA or MQTT
- Barcode/RFID scanning for operator login and material tracking
- PLC integration for automatic status updates

**ERP Integration:**
- Production order creation from external ERP
- Material requirement planning (MRP) synchronization
- Production confirmation back to ERP

---

## 6. Security & Compliance

### 6.1 Multi-Tenancy

**Row-Level Security (RLS):**
- All production queries filtered by `tenant_id`
- Facility-level access control via user permissions
- Operator can only see assigned work centers

**Data Isolation:**
```sql
-- Example RLS policy
CREATE POLICY production_runs_tenant_isolation ON production_runs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 6.2 Audit Trail

**Comprehensive Audit Fields:**
- `created_at`, `created_by` - Initial record creation
- `updated_at`, `updated_by` - Modification tracking
- `deleted_at`, `deleted_by` - Soft delete support

**Change Data Capture:**
- Track production run modifications (quantity changes, status transitions)
- Equipment status change history
- Schedule adjustment audit log

### 6.3 Print Industry Compliance

**Traceability Requirements:**
- Lot/batch tracking from raw materials to finished goods
- Production run documentation (operator, timestamps, quantities)
- Equipment calibration and maintenance records

**Quality Standards:**
- ISO 9001 compliance documentation
- G7 color management tracking
- Customer-specific quality requirements

---

## 7. Performance Optimization

### 7.1 Database Performance

**Indexing Strategy:**
```sql
-- Existing indexes (from operations-module.sql)
CREATE INDEX idx_production_runs_tenant ON production_runs(tenant_id);
CREATE INDEX idx_production_runs_facility ON production_runs(facility_id);
CREATE INDEX idx_production_runs_work_center ON production_runs(work_center_id);
CREATE INDEX idx_production_runs_status ON production_runs(status);
CREATE INDEX idx_production_runs_scheduled ON production_runs(scheduled_start, scheduled_end);

-- Recommended additional indexes for dashboard queries
CREATE INDEX idx_production_runs_active
  ON production_runs(facility_id, status, start_timestamp)
  WHERE status IN ('SCHEDULED', 'RUNNING', 'PAUSED');

CREATE INDEX idx_oee_calculations_recent
  ON oee_calculations(work_center_id, calculation_date DESC)
  WHERE calculation_date >= CURRENT_DATE - INTERVAL '30 days';
```

### 7.2 Caching Strategy

**Apollo Client Cache:**
- Cache production runs with 30-second TTL
- Cache OEE calculations with 5-minute TTL
- Cache work center metadata indefinitely (rarely changes)

**Backend Caching:**
- Redis cache for aggregated metrics (facility-level summaries)
- Cache invalidation on NATS events

### 7.3 Query Optimization

**Pagination:**
- Production runs: 50 per page
- Infinite scroll for real-time feed
- Cursor-based pagination for stability

**Data Loading:**
- Lazy load historical OEE trends
- Prefetch next page of production runs
- Batch GraphQL queries where possible

---

## 8. Testing Strategy

### 8.1 Unit Testing

**Backend Tests:**
- Operations resolver query/mutation tests
- OEE calculation logic validation
- NATS event publishing verification

**Frontend Tests:**
- Component rendering tests
- GraphQL query mocking
- State management tests

### 8.2 Integration Testing

**End-to-End Scenarios:**
1. Production run creation → NATS event → WebSocket update → UI refresh
2. Equipment status change → OEE recalculation → Dashboard update
3. Alert generation → Notification display → Acknowledgment

### 8.3 Performance Testing

**Load Testing:**
- 100+ concurrent production runs
- 1000+ real-time WebSocket connections
- NATS throughput: 10,000 messages/second

**Stress Testing:**
- Database query performance under load
- GraphQL subscription scalability
- Memory leak detection

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Deliverables:**
- [ ] GraphQL subscription schema implementation
- [ ] NATS event publishers in production mutations
- [ ] Real-time WebSocket connection infrastructure
- [ ] Database materialized views for analytics

**Owner:** Roy (Backend Architect)

### Phase 2: Core Dashboard (Week 3-4)
**Deliverables:**
- [ ] Production run table with real-time updates
- [ ] Work center status grid
- [ ] OEE trend charts
- [ ] Basic filtering and search

**Owner:** Jen (Frontend Specialist)

### Phase 3: Advanced Features (Week 5-6)
**Deliverables:**
- [ ] Real-time alerts and notifications
- [ ] Gantt chart schedule visualization
- [ ] Drill-down detail views
- [ ] Export and reporting

**Owner:** Jen + Roy collaboration

### Phase 4: Optimization & Polish (Week 7-8)
**Deliverables:**
- [ ] Performance optimization
- [ ] Mobile responsive design
- [ ] User preferences and customization
- [ ] Comprehensive testing

**Owners:** Billy (QA), Berry (DevOps)

---

## 10. Risks & Mitigation

### 10.1 Technical Risks

**Risk: Real-time performance degradation**
- **Mitigation:** Implement connection throttling, message batching, and client-side caching
- **Fallback:** Graceful degradation to polling if WebSocket fails

**Risk: Database query performance at scale**
- **Mitigation:** Materialized views, partitioning, aggressive indexing
- **Monitoring:** Query performance tracking, slow query alerts

**Risk: NATS message delivery reliability**
- **Mitigation:** Persistent streams, acknowledgment patterns, retry logic
- **Monitoring:** Message delivery metrics, dead letter queue

### 10.2 Operational Risks

**Risk: Operator adoption challenges**
- **Mitigation:** Comprehensive training, intuitive UI, progressive disclosure
- **Validation:** User acceptance testing with actual operators

**Risk: Data accuracy issues**
- **Mitigation:** Validation rules, operator confirmation workflows, audit trails
- **Monitoring:** Data quality metrics, anomaly detection

---

## 11. Success Metrics

### 11.1 Technical Metrics
- **Real-time latency:** <500ms from event to UI update
- **GraphQL query performance:** p95 <100ms
- **Dashboard load time:** <2 seconds
- **Subscription uptime:** 99.9%

### 11.2 Business Metrics
- **OEE improvement:** 5-10% increase within 6 months
- **Schedule adherence:** 90%+ on-time completion
- **Downtime reduction:** 15% reduction in unplanned downtime
- **Operator efficiency:** 20% reduction in manual data entry time

### 11.3 User Satisfaction
- **Dashboard usage:** 80%+ daily active users (operators/supervisors)
- **User satisfaction score:** 4.5/5 or higher
- **Feature adoption rate:** 75%+ of operators using real-time features

---

## 12. Technical Debt Considerations

### 12.1 Current Technical Debt

**OperationsDashboard Mock Data:**
- Current implementation uses hardcoded mock data
- Needs refactoring to use real GraphQL queries
- Location: `frontend/src/pages/OperationsDashboard.tsx`

**Missing GraphQL Queries:**
- Frontend queries defined but not connected to backend
- Location: `frontend/src/graphql/queries/operations.ts`
- Queries reference fields not in actual schema

### 12.2 Recommended Improvements

**Schema Alignment:**
- Align frontend GraphQL queries with backend schema
- Add missing fields to backend resolvers
- Implement proper error handling

**Code Reusability:**
- Extract common chart configurations
- Create reusable production metric components
- Standardize date/time formatting across dashboard

---

## 13. Documentation Requirements

### 13.1 Technical Documentation
- [ ] GraphQL API documentation (queries, mutations, subscriptions)
- [ ] Real-time event schema documentation
- [ ] Database schema documentation with ERD diagrams
- [ ] Deployment and configuration guide

### 13.2 User Documentation
- [ ] Dashboard user guide with screenshots
- [ ] Operator quick start guide
- [ ] Troubleshooting common issues
- [ ] FAQ section

### 13.3 Training Materials
- [ ] Video tutorials for operators
- [ ] Supervisor training deck
- [ ] Administrator setup guide

---

## 14. Conclusion

The AGOGSAAS platform has a robust foundation for implementing a Real-Time Production Analytics Dashboard. The existing Operations module provides comprehensive production tracking capabilities, and the NATS messaging infrastructure enables real-time updates. The primary implementation effort will focus on:

1. **Backend:** Adding GraphQL subscriptions and NATS event publishers
2. **Frontend:** Replacing mock data with real-time GraphQL queries and subscriptions
3. **Database:** Creating materialized views and optimizing indexes for dashboard queries
4. **Integration:** Connecting production events to real-time notification system

**Key Success Factors:**
- Leverage existing infrastructure (NATS, GraphQL, PostgreSQL)
- Incremental implementation with MVP approach
- Strong collaboration between backend, frontend, and DevOps teams
- Continuous operator feedback throughout development

**Estimated Timeline:** 8 weeks (4 sprints)
**Team Required:** Backend (Roy), Frontend (Jen), QA (Billy), DevOps (Berry), Research (Cynthia - ongoing support)

---

## 15. References

### Database Schemas
- `backend/database/schemas/operations-module.sql` (Lines 1-694)
- `backend/database/schemas/MASTER_TABLE_INDEX.sql`

### GraphQL Schemas
- `backend/src/graphql/schema/operations.graphql` (Lines 1-816)
- `backend/src/graphql/resolvers/operations.resolver.ts` (Lines 1-1207)

### Frontend Components
- `frontend/src/pages/OperationsDashboard.tsx` (Lines 1-294)
- `frontend/src/graphql/queries/operations.ts` (Lines 1-79)
- `frontend/src/components/common/` (DataTable, Chart, KPICard)

### Real-Time Infrastructure
- `backend/src/modules/monitoring/services/agent-activity.service.ts` (Lines 1-237)
- `backend/src/modules/monitoring/monitoring.module.ts`

---

**Research Status:** COMPLETE
**Next Steps:** Forward to Marcus (Product Owner) for prioritization and sprint planning
**Recommended Priority:** HIGH - Core production visibility feature with significant ROI potential

---

*This research deliverable provides the foundation for implementing a world-class Real-Time Production Analytics Dashboard that will significantly improve operational visibility and manufacturing efficiency.*
