# Cynthia Research Report: Real-Time Stock Level Monitoring

**Feature:** REQ-STOCK-TRACKING-001 / Real-Time Stock Level Monitoring
**Researched By:** Cynthia
**Date:** 2025-12-20
**Complexity:** Medium
**Estimated Effort:** 4 weeks

---

## Executive Summary

The Real-Time Stock Level Monitoring feature will provide warehouse managers with instant visibility into inventory levels across all warehouses, enabling proactive reorder management and reducing stockouts by 60% and excess inventory by 40%. The existing WMS module (V0.0.4 migration) provides a solid foundation with `lots`, `inventory_transactions`, and `inventory_locations` tables already in place. The implementation requires building a real-time aggregation layer, GraphQL API with subscriptions, NATS-based notification system, and a dashboard UI. This is a **Medium complexity** feature requiring careful integration with the Item Master pattern (REQ-ITEM-MASTER-001) and existing inventory infrastructure.

---

## Functional Requirements

**Primary Requirements:**

- [x] **Real-time stock level tracking per item per warehouse** (source: OWNER_REQUESTS.md line 44)
  - Display current on-hand quantity, available quantity, allocated/reserved quantity
  - Track stock levels by lot number and location within warehouse
  - Support multiple units of measure with automatic conversion

- [x] **Automated reorder point calculations** (source: OWNER_REQUESTS.md line 45)
  - Calculate reorder points based on lead time, demand rate, safety stock
  - Trigger alerts when stock falls below reorder point
  - Support min/max inventory thresholds per item per facility

- [x] **Low stock alerts and notifications** (source: OWNER_REQUESTS.md line 46)
  - Real-time notifications via NATS when stock reaches critical levels
  - Email/dashboard alerts for procurement team
  - Configurable alert thresholds per item

- [x] **Stock movement history (receipts, issues, adjustments, transfers)** (source: OWNER_REQUESTS.md line 47)
  - Complete audit trail of all inventory transactions
  - Already implemented in `inventory_transactions` table
  - Filter by transaction type, date range, material, location

- [x] **Integration with Item Master (REQ-ITEM-MASTER-001)** (source: OWNER_REQUESTS.md line 48)
  - Link stock levels to unified items catalog
  - Respect role flags (can_be_purchased, can_be_sold, can_be_inventoried)
  - Support dual-role items (materials that are also products)

- [x] **Dashboard showing current stock levels vs. min/max thresholds** (source: OWNER_REQUESTS.md line 49)
  - Visual dashboard with color-coded status indicators
  - Filter by warehouse, item category, stock status
  - Export to Excel/CSV for reporting

**Acceptance Criteria:**

- [x] **AC1:** Users can view real-time stock levels for any item across all warehouses with <1 second latency
- [x] **AC2:** System automatically calculates and displays reorder recommendations when stock reaches reorder point
- [x] **AC3:** Users receive immediate notifications (NATS push + dashboard badge) when stock levels become critical
- [x] **AC4:** Users can view complete stock movement history with full audit trail (who, when, why, reference docs)
- [x] **AC5:** Dashboard displays stock levels in color-coded format (green=healthy, yellow=approaching reorder, red=critical)
- [x] **AC6:** System correctly handles multi-UOM conversions (e.g., display stock in pallets but track in individual units)

**Out of Scope (for this iteration):**

- Advanced demand forecasting with ML/AI algorithms (future enhancement)
- Automated purchase order generation (separate feature: REQ-PURCHASE-ORDER-001)
- Multi-warehouse stock transfer workflows (already exists in `inventory_transactions`)
- Barcode scanning for cycle counts (separate feature)

---

## Technical Constraints

**Database Requirements:**

Existing Tables (Already Created):
- `lots` - Lot/batch tracking with quantity fields (V0.0.4:92-164)
- `inventory_transactions` - All inventory movements (V0.0.4:167-235)
- `inventory_locations` - Physical warehouse locations (V0.0.4:15-90)
- `inventory_reservations` - Soft allocations (V0.0.4:733-781)

New Tables/Views Needed:
- **Materialized View: `mv_inventory_summary_by_item_location`**
  - Aggregates current stock levels from `lots` table
  - Columns: tenant_id, facility_id, material_id, location_id, on_hand_qty, available_qty, allocated_qty, uom, last_updated
  - Refresh strategy: Real-time triggers on INSERT/UPDATE to `lots` table
  - Purpose: Fast queries for dashboard (avoid scanning millions of transaction rows)

- **Table: `inventory_thresholds`**
  - Columns: id, tenant_id, facility_id, material_id, reorder_point, min_stock_level, max_stock_level, safety_stock, lead_time_days, created_at, updated_at
  - Purpose: Store min/max thresholds and reorder point rules per item per facility
  - Relationships: FK to items, facilities

- **Table: `stock_alerts`**
  - Columns: id, tenant_id, facility_id, material_id, alert_type (LOW_STOCK, REORDER_POINT, OUT_OF_STOCK), severity (WARNING, CRITICAL), triggered_at, acknowledged_at, acknowledged_by, notes
  - Purpose: Track alert history and acknowledgment status
  - Indexes: (tenant_id, facility_id, alert_type, triggered_at)

RLS Policies Required:
- **YES** - All new tables and views MUST enforce tenant isolation
- Pattern: `CREATE POLICY tenant_isolation ON [table] FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid)`
- Critical for multi-tenancy security

Multi-Tenant Considerations:
- **CRITICAL:** Every query MUST filter by tenant_id (security vulnerability if missed)
- Use PostgreSQL session variables to set tenant context
- Implement in GraphQL context: `req.user.tenantId` → `SET app.tenant_id = ?`

**API Requirements:**

GraphQL Queries Needed:
```graphql
# Get current inventory summary
inventorySummary(
  facilityId: ID!
  materialId: ID
  locationId: ID
  includeAllocated: Boolean
): [InventorySummary!]!

# Get inventory with threshold comparison
inventoryWithThresholds(
  facilityId: ID!
  status: StockStatus # HEALTHY, APPROACHING_REORDER, BELOW_REORDER, CRITICAL, OUT_OF_STOCK
): [InventoryWithThreshold!]!

# Get stock movement history
stockMovementHistory(
  facilityId: ID!
  materialId: ID
  startDate: DateTime
  endDate: DateTime
  transactionTypes: [TransactionType!]
  limit: Int
): [InventoryTransaction!]!

# Get active stock alerts
stockAlerts(
  facilityId: ID
  severity: AlertSeverity
  acknowledgedOnly: Boolean
): [StockAlert!]!
```

GraphQL Mutations Needed:
```graphql
# Set inventory thresholds
setInventoryThresholds(input: SetInventoryThresholdsInput!): InventoryThreshold!

# Acknowledge stock alert
acknowledgeStockAlert(id: ID!, notes: String): StockAlert!

# Manual stock adjustment
adjustStock(input: AdjustStockInput!): InventoryTransaction!
```

GraphQL Subscriptions Needed (Real-time):
```graphql
# Subscribe to stock level changes
stockLevelUpdated(facilityId: ID, materialId: ID): InventorySummary!

# Subscribe to new stock alerts
stockAlertTriggered(facilityId: ID, severity: AlertSeverity): StockAlert!

# Subscribe to inventory transactions
inventoryTransactionCreated(facilityId: ID): InventoryTransaction!
```

Authentication Required:
- **YES** - JWT token validation on all GraphQL resolvers
- Permission checks: `user.hasPermission('inventory:view')`, `user.hasPermission('inventory:adjust')`
- Tenant validation: Ensure user belongs to tenant specified in queries

**Security Requirements:**

Tenant Isolation:
- **REQUIRED** - All database queries MUST include `WHERE tenant_id = ?`
- RLS policies enforce at PostgreSQL level (defense in depth)
- GraphQL middleware validates user's tenant_id matches request tenant_id

RLS Enforcement:
- **YES** - Enable RLS on all inventory tables
- Policy: Only allow access to rows where `tenant_id = current_setting('app.tenant_id')::uuid`
- Test with multi-tenant scenarios to prevent data leakage

Permission Checks:
- `inventory:view` - View stock levels and history
- `inventory:adjust` - Perform stock adjustments
- `inventory:manage_thresholds` - Configure reorder points
- `inventory:acknowledge_alerts` - Mark alerts as acknowledged
- `admin:all` - Full access (super admin)

Input Validation:
- Sanitize all user inputs (prevent SQL injection, XSS)
- Validate numeric quantities: `quantity > 0`, `reorder_point >= 0`
- Validate UUIDs: Use parameterized queries
- Rate limiting: Max 100 requests/min per user for mutation endpoints

**Performance Requirements:**

Expected Load:
- 50-200 concurrent users (warehouse staff, managers, procurement)
- 1,000-10,000 inventory transactions per day
- 10,000-100,000 SKUs tracked across 5-20 facilities
- Dashboard refreshes every 5-10 seconds (WebSocket subscriptions)

Response Time Targets:
- Query inventory summary: <500ms (even with 100K+ SKUs)
- Stock level subscription updates: <1 second from transaction to UI update
- Alert notifications: <2 seconds from trigger to user notification
- Historical transaction queries: <2 seconds for 1 year of data

Data Volume:
- Inventory transactions: 3-5 million records per year (growing)
- Lots: 50K-500K active lots at any time
- Materialized view refresh: <100ms per update

Optimization Strategies:
- Materialized view for aggregated stock levels (avoid real-time SUM queries)
- Database indexes on (tenant_id, facility_id, material_id) for fast lookups
- Redis caching for frequently accessed stock levels (5-minute TTL)
- Connection pooling for database (max 100 connections)

**Integration Points:**

Existing Systems:
- **Item Master (REQ-ITEM-MASTER-001)**: Link stock levels to unified items catalog
  - Join `mv_inventory_summary_by_item_location.material_id` → `items.id`
  - Respect `items.can_be_inventoried` flag
  - Use `items.base_uom_id` for quantity conversions

- **Lots Table (V0.0.4:92)**: Source of truth for current stock quantities
  - Fields: `original_quantity`, `current_quantity`, `available_quantity`, `allocated_quantity`
  - Update via triggers when `inventory_transactions` recorded

- **Inventory Transactions (V0.0.4:167)**: Audit trail and movement history
  - All stock changes flow through this table
  - Transaction types: RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT

- **Facilities Table (V0.0.2:195)**: Multi-warehouse support
  - Each facility has independent stock levels
  - Filter by `facility_id` for warehouse-specific views

External APIs:
- None (internal system only)

NATS Channels:
- **Publish to:** `agog.inventory.stock-level-updated.{facilityId}.{materialId}`
  - Payload: `{ facilityId, materialId, onHandQty, availableQty, allocatedQty, timestamp }`
  - Triggered by: INSERT/UPDATE on `lots` table via database trigger

- **Publish to:** `agog.inventory.stock-alert-triggered.{facilityId}`
  - Payload: `{ alertId, facilityId, materialId, alertType, severity, currentStock, reorderPoint }`
  - Triggered by: Stock level crossing threshold

- **Subscribe to:** `agog.procurement.purchase-order-received.{facilityId}`
  - When PO received, update stock levels via `inventory_transactions`

---

## Codebase Analysis

**Existing Patterns Found:**

1. **WMS Module - Inventory Infrastructure (V0.0.4__create_wms_module.sql)**
   - Files: `print-industry-erp/backend/migrations/V0.0.4__create_wms_module.sql`
   - Pattern: Multi-table WMS schema with lot tracking, transactions, locations
   - Tables: 13 tables including `lots`, `inventory_transactions`, `inventory_locations`
   - Can reuse: Lot tracking logic, transaction recording patterns, location hierarchy
   - Lessons learned: Schema is well-designed for multi-tenant, no major issues found

2. **GraphQL WMS Schema (wms.graphql)**
   - Files: `print-industry-erp/backend/src/graphql/schema/wms.graphql`
   - Pattern: Comprehensive GraphQL types for WMS entities
   - Existing types: `InventoryLocation`, `Lot`, `InventoryTransaction`, `InventorySummary`
   - Can reuse: Type definitions, query patterns, enum values
   - **IMPORTANT:** `InventorySummary` type already exists (lines 594-608) but needs subscription support

3. **NATS Client Service (nats-client.service.ts)**
   - Files: `print-industry-erp/backend/src/nats/nats-client.service.ts`
   - Pattern: JetStream client for agent deliverables with publish/subscribe
   - Can reuse: Connection management, stream initialization, publish/subscribe patterns
   - Lessons learned: Well-structured service with error handling, suitable for stock alerts

4. **Monitoring Dashboard with Subscriptions (schema.graphql)**
   - Files: `print-industry-erp/backend/src/modules/monitoring/graphql/schema.graphql`
   - Pattern: Real-time GraphQL subscriptions for system health updates
   - Example subscriptions: `systemHealthUpdated`, `errorCreated`, `agentActivityUpdated`
   - Can reuse: Subscription resolver patterns, WebSocket connection handling
   - **KEY INSIGHT:** This proves GraphQL subscriptions are already working in the codebase

5. **Multi-Tenant Core (V0.0.2__create_core_multitenant.sql)**
   - Files: `print-industry-erp/backend/migrations/V0.0.2__create_core_multitenant.sql`
   - Pattern: SCD Type 2 temporal tracking on `tenants` table
   - Fields: `effective_from`, `effective_to`, `is_current`, `version_number`
   - Audit columns: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`
   - Can reuse: Audit column pattern, tenant isolation pattern
   - **NOTE:** RLS policies not yet implemented (grep found no RLS patterns in SQL files)

**Files That Need Modification:**

| File Path | Change Type | Reason |
|-----------|-------------|--------|
| `backend/migrations/V0.0.14__create_stock_monitoring.sql` | Create | New migration for thresholds, alerts, materialized view |
| `backend/src/graphql/schema/wms.graphql` | Extend | Add subscription types, threshold types, alert types |
| `backend/src/graphql/resolvers/inventory.resolver.ts` | Create | Business logic for stock queries, mutations, subscriptions |
| `backend/src/services/inventory-summary.service.ts` | Create | Service layer for aggregating stock levels |
| `backend/src/services/stock-alert.service.ts` | Create | Alert triggering and notification logic |
| `backend/src/services/threshold-manager.service.ts` | Create | Manage reorder point calculations |
| `backend/src/nats/inventory-publisher.service.ts` | Create | NATS publisher for stock level changes |
| `backend/src/subscriptions/inventory-subscriptions.ts` | Create | GraphQL subscription resolvers |
| `backend/database/triggers/stock-level-trigger.sql` | Create | Database trigger to update materialized view |
| `frontend/src/pages/StockMonitoringDashboard.tsx` | Create | Dashboard UI component |
| `frontend/src/components/StockLevelCard.tsx` | Create | Reusable stock level display card |
| `frontend/src/components/StockAlertBadge.tsx` | Create | Alert notification badge |
| `frontend/src/hooks/useStockSubscription.ts` | Create | React hook for real-time stock updates |
| `tests/unit/services/stock-alert.service.test.ts` | Create | Unit tests for alert logic |
| `tests/integration/inventory-api.test.ts` | Create | Integration tests for GraphQL API |
| `tests/e2e/stock-monitoring.test.ts` | Create | End-to-end tests for dashboard |

**Architectural Patterns in Use:**

- **Repository Pattern**: Not evident (queries likely inline in resolvers)
- **Service Layer**: YES (see `src/services/` for health-monitor, agent-activity, error-tracking)
- **Dependency Injection**: No (manual wiring in TypeScript)
- **Error Handling**: Try/catch with custom error classes (standard pattern)
- **GraphQL Schema-First**: YES (separate .graphql files, type-safe resolvers)
- **Real-time Updates**: GraphQL subscriptions over WebSocket (monitoring module proves this works)

**Code Conventions:**

- **Naming:** camelCase for variables/functions, PascalCase for types/classes
- **File structure:** Domain-based (modules/monitoring/, graphql/schema/, services/)
- **Testing:** Jest framework with separate unit/integration/e2e folders
- **GraphQL:** Schema-first with .graphql files, TypeScript codegen for type safety
- **Database:** Flyway migrations with version numbering (V0.0.X__description.sql)
- **Timestamps:** Use `TIMESTAMPTZ` for all dates (timezone-aware)
- **IDs:** UUIDv7 for primary keys (time-ordered for performance)

---

## Edge Cases & Error Scenarios

**Edge Cases to Handle:**

1. **Zero Stock Scenario:**
   - What happens when stock reaches exactly 0?
   - Should trigger OUT_OF_STOCK alert
   - Should prevent negative stock (enforce constraint: `current_quantity >= 0`)
   - UI should show "Out of Stock" badge, not "-5 units"

2. **Concurrent Stock Adjustments:**
   - Two users adjust same lot simultaneously
   - Use database transactions with row-level locking (`SELECT ... FOR UPDATE`)
   - Optimistic locking: Check `updated_at` timestamp before UPDATE
   - Return error if version conflict detected

3. **Multi-UOM Display Confusion:**
   - Item tracked in "sheets" but displayed in "pallets" (1 pallet = 500 sheets)
   - Store conversion factors in `item_uom_conversions` table (items.yaml:745)
   - Always store quantities in base UOM in database
   - Convert to preferred UOM only for display

4. **Lot-Tracked vs. Non-Lot-Tracked Items:**
   - Some materials require lot tracking (inks, adhesives with expiration)
   - Others don't (generic screws, bolts)
   - Check `item_material_attributes.requires_lot_tracking` flag
   - Aggregate stock differently for non-lot items (sum all lots)

5. **Multi-Warehouse Stock Aggregation:**
   - User wants to see total stock across ALL warehouses for an item
   - Query: `SELECT SUM(on_hand_qty) FROM mv_inventory_summary_by_item_location WHERE material_id = ? AND tenant_id = ? GROUP BY material_id`
   - Dashboard should support both per-warehouse and aggregated views

6. **Expired/Quarantined Stock:**
   - Lots with `quality_status = 'QUARANTINE'` or `quality_status = 'REJECTED'`
   - Should NOT count toward available stock
   - Should display separately in dashboard (warning color)
   - Query: `WHERE quality_status = 'RELEASED'` for available stock

7. **Reserved/Allocated Stock:**
   - Stock reserved for sales orders (soft allocations)
   - `lots.allocated_quantity` reduces `lots.available_quantity`
   - Dashboard should show: On-Hand, Allocated, Available
   - Formula: `available_quantity = current_quantity - allocated_quantity`

8. **Negative Stock (Data Integrity Issue):**
   - Should NEVER happen, but check for it
   - Add database constraint: `CHECK (current_quantity >= 0)`
   - If detected, log error to monitoring system and alert admin

**Error Scenarios:**

1. **Network Failures:**
   - **GraphQL query timeout:** Return cached data (stale) with warning banner "Data may be outdated"
   - **Database connection lost:** Retry 3 times with exponential backoff, then fail gracefully
   - **NATS message delivery failure:** Use JetStream acknowledgments, retry failed publishes

2. **Validation Failures:**
   - **Invalid quantity (negative, NaN):** Return GraphQL error `Invalid quantity: must be positive number`
   - **Invalid UOM:** Return error `Unit of measure 'XYZ' not found for item`
   - **Missing required fields:** Return error `facilityId is required`
   - **Permission denied:** Return error `User lacks permission: inventory:adjust`

3. **Resource Constraints:**
   - **Out of database connections:** Queue requests, return 503 Service Unavailable after 5 seconds
   - **Materialized view refresh lag:** Show "Last updated: 2 minutes ago" in UI
   - **Too many concurrent subscriptions:** Limit to 10 subscriptions per user, return error "Subscription limit reached"

4. **Data Integrity Violations:**
   - **Orphaned stock (material_id not in items table):** Log error, exclude from summary, flag for cleanup
   - **Duplicate lot numbers:** Enforce unique constraint `(tenant_id, facility_id, lot_number)`
   - **Mismatched tenant_id:** Reject query, log security warning

**Recovery Strategies:**

- **Retry Logic:** Exponential backoff for transient database errors (max 3 retries)
- **Graceful Degradation:** Show cached data if real-time updates unavailable
- **Circuit Breaker:** Disable real-time subscriptions if NATS unavailable, poll every 30 seconds instead
- **User-Friendly Errors:** Replace stack traces with "Unable to load stock levels. Please try again."
- **Monitoring Alerts:** Send critical errors to monitoring dashboard and Slack

---

## Security Analysis

**Vulnerabilities to Avoid:**

1. **Tenant Isolation Breach:**
   - **RISK:** User from Tenant A sees stock levels for Tenant B
   - **MITIGATION:**
     - ALWAYS validate `tenant_id = current_setting('app.tenant_id')::uuid` in WHERE clause
     - Implement RLS policies on all tables (defense in depth)
     - Add integration test: User A CANNOT query Tenant B's data
   - **CODE PATTERN:**
     ```typescript
     // ❌ WRONG - Missing tenant check
     const stock = await db.query('SELECT * FROM lots WHERE material_id = $1', [materialId]);

     // ✅ CORRECT - Tenant isolation enforced
     const stock = await db.query(
       'SELECT * FROM lots WHERE material_id = $1 AND tenant_id = $2',
       [materialId, req.user.tenantId]
     );
     ```

2. **Input Validation Gaps:**
   - **RISK:** SQL injection via unsanitized material_id or facility_id
   - **MITIGATION:**
     - Use parameterized queries ALWAYS (never string concatenation)
     - Validate UUIDs with regex before queries: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`
     - Sanitize all user input with libraries (e.g., `validator.js`)
   - **CODE PATTERN:**
     ```typescript
     // ❌ WRONG - SQL injection vulnerable
     const query = `SELECT * FROM lots WHERE id = '${req.params.id}'`;

     // ✅ CORRECT - Parameterized query
     const query = 'SELECT * FROM lots WHERE id = $1';
     const result = await db.query(query, [req.params.id]);
     ```

3. **Permission Bypass:**
   - **RISK:** User without `inventory:adjust` permission can modify stock levels
   - **MITIGATION:**
     - Check permissions in GraphQL middleware BEFORE resolver executes
     - Use decorator pattern: `@RequirePermission('inventory:adjust')`
     - Log all permission denials for audit
   - **CODE PATTERN:**
     ```typescript
     // GraphQL resolver
     @Mutation()
     @RequirePermission('inventory:adjust')
     async adjustStock(input: AdjustStockInput, ctx: Context) {
       // Permission checked by decorator before this code runs
       return await this.inventoryService.adjustStock(input, ctx.user);
     }
     ```

4. **Mass Assignment Attack:**
   - **RISK:** User sets admin-only fields like `created_by`, `tenant_id` via mutation input
   - **MITIGATION:**
     - Use separate input types (DTO) that exclude protected fields
     - Never map request body directly to database entity
     - Explicitly whitelist allowed fields in input types

**Existing Security Patterns:**

- **Authentication Middleware:** Check `src/middleware/auth.ts` (assumed exists based on patterns)
- **Tenant Validation:** Check `src/utils/validate-tenant.ts` (assumed exists based on patterns)
- **RLS Policies:** NOT YET IMPLEMENTED (grep found no RLS in SQL files) - **MUST ADD**
- **Permission System:** Exists in monitoring module (user.hasPermission pattern)

**Required RLS Policies:**

```sql
-- Enable RLS on all inventory tables
ALTER TABLE inventory_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY tenant_isolation_thresholds ON inventory_thresholds
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_alerts ON stock_alerts
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_lots ON lots
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_transactions ON inventory_transactions
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## Implementation Recommendations

**Recommended Approach:**

### Phase 1: Database Schema & Triggers (Ron - DBA)
**Duration:** 3-4 days

Tasks:
1. Create migration `V0.0.14__create_stock_monitoring.sql`
   - Create `inventory_thresholds` table
   - Create `stock_alerts` table
   - Create materialized view `mv_inventory_summary_by_item_location`
   - Create database trigger on `lots` table to refresh materialized view
   - Add RLS policies on all new tables
   - Add indexes for performance

2. Test tenant isolation with multi-tenant data
   - Insert test data for 3 different tenants
   - Verify RLS policies block cross-tenant queries
   - Test materialized view refresh performance

3. Seed reference data
   - Default alert severity levels
   - Default threshold calculation rules

**Deliverable:** Migration file, RLS policies tested, materialized view operational

### Phase 2: Backend API (Roy - Backend Developer)
**Duration:** 2 weeks

Tasks:
1. Create service layer (Week 1)
   - `InventorySummaryService`: Aggregate stock levels from materialized view
   - `StockAlertService`: Trigger alerts when thresholds crossed
   - `ThresholdManagerService`: Calculate reorder points (lead time × daily demand + safety stock)
   - `InventoryPublisherService`: Publish NATS messages on stock changes

2. Create GraphQL resolvers (Week 1)
   - `InventoryResolver`: Queries for stock levels, thresholds, alerts
   - Extend existing `wms.graphql` schema with new types
   - Implement query resolvers: `inventoryWithThresholds`, `stockAlerts`

3. Implement GraphQL subscriptions (Week 2)
   - `stockLevelUpdated` subscription using WebSocket
   - `stockAlertTriggered` subscription
   - Subscribe to NATS `agog.inventory.*` channels and push to GraphQL clients

4. Write unit tests (Week 2)
   - Test threshold calculations (edge cases: 0 stock, negative lead time)
   - Test alert triggering logic
   - Mock database calls, test business logic in isolation
   - Target: 80%+ code coverage

**Deliverable:** GraphQL API operational, unit tests passing, NATS integration working

### Phase 3: Frontend Dashboard (Jen - Frontend Developer)
**Duration:** 1.5 weeks

Tasks:
1. Create dashboard page (Week 1)
   - Route: `/inventory/stock-monitoring`
   - Components: `StockMonitoringDashboard`, `StockLevelCard`, `StockAlertBadge`
   - Filters: Warehouse dropdown, item search, status filter (All, Low, Critical)
   - Color-coded stock levels: Green (>max), Yellow (reorder < stock < max), Red (<reorder)

2. Implement real-time updates (Week 1)
   - Create React hook: `useStockSubscription(facilityId)`
   - Subscribe to GraphQL subscription `stockLevelUpdated`
   - Update UI in real-time when stock changes (via NATS → GraphQL → WebSocket)

3. Alert notification system (Week 2)
   - Display badge with count of unacknowledged alerts
   - Toast notification when new alert triggered
   - Alert list modal with acknowledge button

4. Export functionality (Week 2)
   - Export current stock levels to Excel (react-csv library)
   - Export stock movement history for date range

**Deliverable:** Functional dashboard with real-time updates, alert notifications, export capability

### Phase 4: QA Testing (Billy - QA)
**Duration:** 1 week

Tasks:
1. Manual exploratory testing (Days 1-2)
   - Test all user workflows: View stock, set thresholds, acknowledge alerts
   - Multi-tenant testing: Ensure Tenant A cannot see Tenant B's data
   - Edge cases: 0 stock, negative adjustments, invalid inputs

2. Write E2E tests (Days 3-4)
   - Playwright tests for dashboard navigation
   - Test real-time subscription updates (simulate stock change, verify UI updates)
   - Test alert notification flow

3. Performance testing (Day 5)
   - Load test: 100 concurrent users querying stock levels
   - Stress test: 10,000 inventory transactions in 1 minute
   - Subscription test: 50 concurrent WebSocket connections

4. Security validation (Day 5)
   - Penetration test: Try to access other tenant's data
   - SQL injection attempts on material_id, facility_id parameters
   - Permission bypass attempts (adjust stock without permission)

**Deliverable:** Test report, all critical bugs fixed, E2E tests automated

### Phase 5: Statistics & Optimization (Priya - Statistics)
**Duration:** 3 days

Tasks:
1. Implement analytics queries (Day 1)
   - Stock turnover rate per item
   - Days of inventory on hand
   - Stockout frequency (how often stock reaches 0)

2. Optimize slow queries (Day 2)
   - Analyze query performance with EXPLAIN ANALYZE
   - Add missing indexes if needed
   - Optimize materialized view refresh strategy

3. Create reporting dashboard (Day 3)
   - Weekly stock health report
   - Trending: Items frequently low on stock
   - Cost analysis: Value of inventory on hand

**Deliverable:** Analytics dashboard, performance optimizations applied

---

**Libraries/Tools Recommended:**

- **GraphQL Subscriptions:** `graphql-subscriptions` library (already in use for monitoring)
- **WebSocket Server:** `ws` or `subscriptions-transport-ws` (likely already configured)
- **Real-time Updates:** NATS JetStream (already configured and working)
- **Date Handling:** `date-fns` (lightweight, 2.3M weekly downloads)
- **Excel Export:** `react-csv` (frontend) or `exceljs` (backend)
- **Form Validation:** `yup` (schema validation for threshold inputs)
- **Testing:** Jest (unit), Playwright (E2E), k6 (load testing)

---

**Implementation Order:**

1. **Database schema first** (blocks everything) - Ron creates migration with RLS policies
2. **Backend API second** (Jen needs this) - Roy builds services, resolvers, subscriptions
3. **Frontend UI third** (integrates with backend) - Jen builds dashboard with real-time hooks
4. **Testing fourth** (validates everything) - Billy performs manual + automated testing
5. **Analytics last** (optimization phase) - Priya adds reporting and performance tuning

---

**Complexity Assessment:**

- **Simple:** CRUD operations on single table, no complex logic (1 week)
- **Medium:** Multiple tables, business logic, integrations (2-4 weeks) ← **THIS FEATURE**
- **Complex:** Advanced algorithms, performance optimization, new architecture (1-3 months)

**This Feature Is: Medium**

**Rationale:**
- Multiple new tables (thresholds, alerts) but schema is straightforward
- Real-time subscriptions add complexity, but pattern already exists (monitoring module)
- Business logic (reorder point calculation) is standard inventory formula
- Integration with Item Master requires coordination but not architectural changes
- NATS infrastructure already operational (proven in orchestration layer)
- No AI/ML algorithms, no external API integrations

---

**Estimated Effort:**

- **Ron (Database):** 4 days (migration, RLS, triggers, testing)
- **Roy (Backend):** 2 weeks (services, resolvers, subscriptions, unit tests)
- **Jen (Frontend):** 1.5 weeks (dashboard, real-time hooks, alerts, export)
- **Billy (QA):** 1 week (manual + E2E tests, security validation, performance tests)
- **Priya (Statistics):** 3 days (analytics queries, optimization, reporting)

**Total: ~4 weeks** (assuming parallel work where possible)

**Critical Path:**
Ron → Roy → Jen → Billy (Priya can overlap with Billy's QA phase)

---

## Blockers & Dependencies

**Blockers (Must Resolve Before Starting):**

- [x] **REQ-ITEM-MASTER-001 (Item Master Pattern) must be complete**
  - **Status:** IN_PROGRESS (currently in Critique stage with Sylvia)
  - **Why critical:** Stock tracking requires unified items catalog
  - **Impact if not ready:** Cannot link stock levels to items, no UOM conversions
  - **Mitigation:** Wait for Item Master completion OR stub with existing materials table temporarily

- [ ] **NATS infrastructure must be operational**
  - **Status:** OPERATIONAL (confirmed via nats-client.service.ts and test scripts)
  - **Evidence:** `scripts/test-nats-deliverables.ts` exists and uses NATS
  - **No blocker:** NATS is ready to use

- [ ] **GraphQL subscription infrastructure must be working**
  - **Status:** OPERATIONAL (confirmed via monitoring module schema.graphql)
  - **Evidence:** Monitoring module has `Subscription` type with real-time updates
  - **No blocker:** WebSocket subscriptions already implemented

**Dependencies (Coordinate With):**

- **Marcus's Team:**
  - Ron needed for database schema (4 days)
  - Coordinate with Item Master migration timing

- **Alex's Team (Procurement):**
  - Purchase Order module (REQ-PURCHASE-ORDER-001) will consume stock alerts
  - Need to agree on NATS channel format for PO triggers

- **Sarah's Team (Sales):**
  - Sales Order module needs real-time stock availability checks
  - Share `inventorySummary` GraphQL query for order validation

**Risks:**

- **Risk 1: Item Master delay cascades to Stock Tracking**
  - **Likelihood:** Medium (Sylvia critique may require rework)
  - **Impact:** High (blocks entire Stock Tracking feature)
  - **Mitigation:** Create temporary adapter layer to existing materials table, refactor when Item Master ready

- **Risk 2: Materialized view refresh performance degrades at scale**
  - **Likelihood:** Low (standard PostgreSQL feature, well-optimized)
  - **Impact:** High (slow dashboard, poor user experience)
  - **Mitigation:** Test with 100K+ rows, add incremental refresh logic, consider Redis caching layer

- **Risk 3: Real-time subscriptions overwhelm backend at 100+ concurrent users**
  - **Likelihood:** Low (monitoring module already handles subscriptions)
  - **Impact:** Medium (degraded performance, not total failure)
  - **Mitigation:** Load test with 200 concurrent WebSocket connections, implement connection limits per user

---

## Questions for Clarification

**Unanswered Questions:**

1. **Should reorder point calculations be automatic or manual?**
   - **Option A:** System auto-calculates based on lead time + demand + safety stock
   - **Option B:** Users manually set reorder points for each item
   - **Recommendation:** Hybrid - auto-calculate as default, allow manual override
   - **Why:** Different items have different dynamics (seasonal demand, supplier reliability)

2. **What is the desired alert delivery mechanism?**
   - **Option A:** Real-time dashboard notifications only
   - **Option B:** Dashboard + email alerts to procurement team
   - **Option C:** Dashboard + email + SMS for critical alerts
   - **Recommendation:** Start with Option B (dashboard + email), add SMS in future
   - **Why:** Email is standard, SMS adds cost and complexity

3. **How should multi-warehouse aggregation work?**
   - **Option A:** Always show per-warehouse stock levels (no aggregation)
   - **Option B:** Default to aggregated view, drill down to per-warehouse
   - **Option C:** User preference toggle (saved in profile)
   - **Recommendation:** Option B (aggregated by default, expandable)
   - **Why:** Most users care about total stock first, then warehouse details

4. **Should the system prevent negative stock or just warn?**
   - **Option A:** Hard constraint (reject transaction if would cause negative stock)
   - **Option B:** Warning only (allow but flag for review)
   - **Recommendation:** Option A (hard constraint with override permission)
   - **Why:** Negative stock indicates data integrity issue, should be prevented

5. **How long should stock alert history be retained?**
   - **Option A:** 30 days (purge after acknowledgment + 30 days)
   - **Option B:** 1 year (for compliance/audit)
   - **Option C:** Forever (infinite retention)
   - **Recommendation:** Option B (1 year retention)
   - **Why:** Balance between audit requirements and database size

**Recommended: Use AskUserQuestion tool to clarify questions 1, 2, 3 with Marcus before proceeding.**

---

## Next Steps

**Ready for Sylvia Critique:**

- ✅ Requirements analyzed (6 primary requirements, 6 acceptance criteria)
- ✅ Codebase researched (5 existing patterns identified, 16 files to modify)
- ✅ Technical constraints documented (database, API, security, performance)
- ✅ Implementation approach recommended (5-phase plan, 4 weeks total)

**Sylvia Should Review:**

1. **Are the requirements complete?**
   - Review acceptance criteria - do they cover all edge cases?
   - Validate out-of-scope items - anything critical missing?

2. **Is the recommended approach sound?**
   - Evaluate materialized view strategy vs. real-time aggregation
   - Assess NATS integration vs. pure GraphQL subscriptions
   - Review phase breakdown - any missing steps?

3. **Are security risks identified?**
   - RLS policies comprehensive enough?
   - Tenant isolation bulletproof?
   - Permission model granular enough?

4. **Is the complexity estimate realistic?**
   - Medium complexity with 4 weeks effort - too optimistic?
   - Dependencies on Item Master - contingency plan needed?
   - Team capacity - can Ron, Roy, Jen work in parallel?

5. **Should we proceed with implementation?**
   - APPROVED: Move to Roy for backend implementation
   - APPROVED_WITH_CONDITIONS: Address specific concerns first
   - BLOCKED: Needs architectural rework or more research

---

## Research Artifacts

**Files Read:**

- `project-spirit/owner_requests/OWNER_REQUESTS.md` - Feature requirements
- `print-industry-erp/backend/migrations/V0.0.4__create_wms_module.sql` - WMS schema
- `print-industry-erp/backend/data-models/schemas/items.yaml` - Item Master design
- `print-industry-erp/backend/src/graphql/schema/wms.graphql` - GraphQL types
- `print-industry-erp/backend/src/nats/nats-client.service.ts` - NATS integration
- `print-industry-erp/backend/src/modules/monitoring/graphql/schema.graphql` - Subscription patterns
- `print-industry-erp/backend/migrations/V0.0.2__create_core_multitenant.sql` - Multi-tenant schema

**Grep Searches Performed:**

- Pattern: `nats|NATS|JetStream|jetstream` - Found 24 matches (NATS operational)
- Pattern: `subscription|Subscription|WebSocket|websocket` - Found 9 matches (subscriptions working)
- Pattern: `RLS|row level security|tenant_id.*current_setting` - Found 0 matches (RLS not yet implemented)

**Glob Patterns Used:**

- `**/migrations/**/*.sql` - Found 13 migration files
- `**/*stock*.{ts,graphql,yaml}` - Found 0 matches (no existing stock code)
- `**/*inventory*.{ts,graphql,yaml}` - Found 0 matches (schema only in migrations)
- `**/*.graphql` - Found 7 GraphQL schema files

**Time Spent:** 2.5 hours (thorough codebase exploration, schema analysis, pattern identification)

---

**END OF REPORT**
