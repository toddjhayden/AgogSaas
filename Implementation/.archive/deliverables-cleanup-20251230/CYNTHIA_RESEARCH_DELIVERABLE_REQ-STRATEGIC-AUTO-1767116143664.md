# Research Deliverable: Real-Time Business Intelligence & Self-Service Analytics
**REQ-STRATEGIC-AUTO-1767116143664**

**Researcher:** Cynthia (Research Specialist)
**Date:** December 30, 2025
**Status:** COMPLETE

---

## Executive Summary

This research analyzes the current state of Business Intelligence (BI) and Analytics capabilities in the AGOG SaaS ERP system and provides comprehensive recommendations for implementing **Real-Time Business Intelligence** and **Self-Service Analytics** features. The system already has a strong foundation with advanced reporting views, performance monitoring infrastructure, and export capabilities, but lacks real-time streaming, self-service query builders, and interactive drill-down capabilities.

**Key Findings:**
- ✅ Strong foundation: 5 analytics views, executive KPI dashboard, export engine (PDF/Excel/CSV)
- ✅ Performance monitoring infrastructure with OLAP caching and incremental refresh
- ❌ Missing: Real-time data streaming, WebSocket/GraphQL subscriptions
- ❌ Missing: Self-service query builder, ad-hoc report generation
- ❌ Missing: Interactive drill-down, pivot tables, custom dashboards

---

## 1. Current State Analysis

### 1.1 Existing Analytics Infrastructure ✅

#### Database Layer (Excellent Foundation)
**Migration:** `V0.0.42__create_analytics_views.sql`

The system has 5 comprehensive analytics views:

1. **`vendor_production_impact_v`** - Correlates vendor performance with production efficiency
   - Vendor metrics: on-time delivery %, quality acceptance %, avg lead time
   - Production metrics: OEE, downtime hours, material shortage incidents
   - Statistical analysis: correlation coefficients, p-values
   - **Gap:** Correlation calculated as placeholder (0.0), needs real statistical implementation

2. **`customer_profitability_v`** - Multi-dimensional customer profitability analysis
   - Revenue: total revenue, order count, avg order value
   - Costs: warehouse, quality, shipping costs
   - Profitability: gross/net profit, margins
   - Warehouse impact: bin utilization, storage days, cross-dock opportunities
   - **Gap:** Many metrics are placeholders (e.g., avg_bin_utilization = 75.0)

3. **`order_cycle_analysis_v`** - End-to-end order cycle time tracking
   - Breakdown: quote→order→production→warehouse→shipping times
   - Performance: target vs actual, variance, performance rating
   - Bottleneck identification: stage, duration, reason
   - **Gap:** Warehouse/shipping times are hardcoded placeholders

4. **`material_flow_analysis_v`** - Material journey from vendor to production
   - Supply chain: lead time, warehouse dwell, consumption rate
   - Inventory: stock levels, safety stock, reorder points
   - Vendor performance: on-time delivery, quality
   - Warehouse performance: bin utilization, efficiency metrics
   - Demand: monthly demand, variability, stockout risk

5. **`executive_kpi_summary_mv`** (Materialized View)
   - Financial KPIs: revenue, costs, profit, margins
   - Operational KPIs: OEE, bin utilization, on-time delivery, cycle time
   - Vendor/Customer/Forecast KPIs with trends
   - **Refresh:** Manual via `refresh_analytics_materialized_views()` function
   - **Gap:** No scheduled refresh (pg_cron commented out)

**Export Jobs Table:**
- Tracks PDF/Excel/CSV/JSON export requests
- Status tracking: PENDING → PROCESSING → COMPLETED/FAILED
- 24-hour expiration for downloads
- Email delivery capability
- Row-Level Security (RLS) enabled

#### Application Layer (Good Coverage)

**GraphQL Schema:** `backend/src/modules/analytics/analytics.graphql`
- 6 query operations for cross-domain analytics
- 2 mutation operations for exports
- Complete type definitions with scalars (Date, DateTime, JSON)
- Export format enums: PDF, EXCEL, CSV, JSON
- Report type enums: 11 predefined report types

**Services:**
- `AnalyticsService`: Returns mock data for all analytics queries
  - ✅ Methods implemented for all 6 query types
  - ❌ **Critical Gap:** All methods return hardcoded mock data, not real database queries
  - ❌ Missing database integration with analytics views

- `ExportService`: Comprehensive export generation
  - ✅ PDF generation via Puppeteer (HTML → PDF)
  - ✅ Excel generation via ExcelJS with styling
  - ✅ CSV generation with proper formatting
  - ✅ JSON export for data interchange
  - ✅ Report-specific templates and column definitions
  - ❌ **Gap:** File system paths hardcoded (`/tmp/exports/`)
  - ❌ Missing S3/cloud storage integration
  - ❌ Missing email delivery implementation

**Frontend:**
- GraphQL queries defined in `frontend/src/graphql/queries/analytics.ts`
- Chart component available (`Chart.tsx`) - uses Recharts library
- Executive Dashboard page exists but scope unknown

### 1.2 Performance Monitoring Infrastructure ✅

**Migration:** `V0.0.40__add_performance_monitoring_olap.sql`

Excellent real-time performance tracking foundation:

**Tables (Time-Series Partitioned):**
1. `query_performance_log` - Query execution metrics
   - MD5 hash for grouping, execution time, rows returned
   - Partitioned by month for efficient cleanup
   - Indexes on slow queries (>1000ms)

2. `api_performance_log` - API endpoint metrics
   - Response time, status codes, request/response sizes
   - Method and endpoint tracking

3. `system_resource_metrics` - System health metrics
   - CPU, memory, event loop lag, connection pool stats
   - Collected every 10 seconds

4. `performance_metrics_cache` - OLAP hourly aggregates
   - P95/P99 percentiles, health scores (0-100)
   - Incremental refresh via `refresh_performance_metrics_incremental()`
   - **Expected performance:** 50-100ms for 24 hours of data

**Service:** `PerformanceMetricsService`
- ✅ Buffered metrics collection (flush every 10 seconds)
- ✅ Automatic system metrics collection
- ✅ Performance overview with health scoring
- ✅ Slow query detection and bottleneck analysis
- ✅ Endpoint performance tracking with percentiles
- ❌ **Gap:** No real-time streaming/push notifications
- ❌ **Gap:** Event loop lag not actually measured (TODO comment)

---

## 2. Gap Analysis: Real-Time BI Requirements

### 2.1 Real-Time Data Streaming ❌ MISSING

**Current State:**
- No WebSocket support
- No GraphQL subscriptions
- No server-sent events (SSE)
- Performance metrics collected but not pushed to clients
- NATS message broker available but not used for analytics streaming

**Industry Standard Approaches:**

1. **GraphQL Subscriptions** (Recommended)
   - Uses WebSocket protocol (ws://)
   - Native support in Apollo Server
   - Client-side: Apollo Client subscription support
   - **Use Cases:**
     - Real-time dashboard updates (KPIs refresh every 5-30 seconds)
     - Live performance monitoring alerts
     - Order status changes, production run updates
     - Inventory level notifications

2. **Server-Sent Events (SSE)** (Alternative)
   - Simpler than WebSockets (one-way: server → client)
   - Better for dashboard data streams
   - Built-in browser reconnection
   - **Use Cases:**
     - Stock ticker-style KPI updates
     - Performance metric streams
     - Alert notifications

3. **Polling with Smart Caching** (Fallback)
   - Client polls at intervals (5-60 seconds)
   - Backend caches hot data in Redis
   - **Use Cases:**
     - Dashboard auto-refresh
     - Less critical real-time needs

**Required Implementation:**

```typescript
// GraphQL Subscription Schema Example
type Subscription {
  # KPI Updates (every 30 seconds)
  executiveKPIUpdates(tenantId: ID!): ExecutiveKPISummary!

  # Performance Alerts (when health score drops)
  performanceAlerts(tenantId: ID!, threshold: Int!): PerformanceAlert!

  # Real-time metrics stream
  metricsStream(tenantId: ID!, metricType: String!): MetricDataPoint!

  # Order status changes
  orderStatusUpdates(tenantId: ID!): OrderStatusUpdate!
}
```

**Dependencies:**
- `@nestjs/websockets` (not currently installed)
- `ws` library for WebSocket protocol
- Redis for pub/sub messaging (optional but recommended)

### 2.2 Self-Service Analytics ❌ MISSING

**Current State:**
- Only predefined reports available
- No ad-hoc query capability
- No user-facing query builder
- Export limited to 11 predefined report types
- Users cannot customize dimensions, filters, or aggregations

**Industry Standard Features:**

1. **Visual Query Builder**
   - Drag-and-drop interface for selecting dimensions
   - Point-and-click filter creation
   - Visual aggregation selection (SUM, AVG, COUNT, etc.)
   - **Libraries:** react-querybuilder, react-awesome-query-builder

2. **Saved Reports & Report Library**
   - Users save custom report configurations
   - Share reports with team members
   - Schedule recurring report generation
   - **Database:** `saved_reports` table with JSON configuration

3. **Custom Dashboard Builder**
   - Drag-and-drop widget placement
   - Multiple chart types (line, bar, pie, scatter, heatmap)
   - KPI cards, tables, maps
   - **Libraries:** react-grid-layout, Recharts/Victory/Nivo

4. **Ad-Hoc Data Exploration**
   - Drill-down capabilities (e.g., Revenue → Customer → Product)
   - Pivot table functionality
   - Dynamic filtering and grouping
   - Export any view to Excel/CSV

**Required Implementation:**

```typescript
// Saved Report Schema
type SavedReport {
  reportId: ID!
  name: String!
  description: String
  reportConfig: JSON! // { dimensions, metrics, filters, sorts }
  chartType: ChartType!
  createdBy: User!
  isPublic: Boolean!
  tags: [String!]
  lastRunAt: DateTime
}

// Ad-Hoc Query API
type Query {
  executeAdHocQuery(input: AdHocQueryInput!): AdHocQueryResult!
}

input AdHocQueryInput {
  dataSource: String! // "sales_orders", "production_runs", etc.
  dimensions: [String!]! // ["customer_name", "product_category"]
  metrics: [MetricDefinition!]! // [{ field: "total_amount", aggregation: "SUM" }]
  filters: [FilterDefinition!] // [{ field: "order_date", operator: ">=", value: "2025-01-01" }]
  sorts: [SortDefinition!]
  limit: Int
}
```

**Dependencies:**
- Query builder UI component library
- Backend dynamic query generator (safe SQL generation)
- Saved report storage schema

### 2.3 Interactive Dashboards ❌ LIMITED

**Current State:**
- Executive Dashboard exists but capabilities unknown
- Static charts (no drill-down)
- No dynamic filtering across widgets
- No dashboard personalization

**Industry Standard Features:**

1. **Cross-Widget Filtering**
   - Click on chart element → filters entire dashboard
   - Global date range picker affects all widgets
   - Filter panel with apply/reset

2. **Drill-Down/Drill-Up**
   - Click revenue bar → see breakdown by customer
   - Click customer → see order details
   - Breadcrumb navigation for drill path

3. **Dashboard Layouts**
   - Responsive grid layout
   - Drag-and-drop widget repositioning
   - Resize widgets
   - Add/remove widgets dynamically

4. **Data Refresh Controls**
   - Manual refresh button
   - Auto-refresh toggle (5s, 30s, 1m, 5m)
   - Last updated timestamp
   - Loading states

**Required Implementation:**
- State management for cross-widget filters (Redux/Zustand)
- Drill-down routing and breadcrumbs
- Grid layout system (react-grid-layout)
- Real-time subscription integration

---

## 3. Technology Stack Recommendations

### 3.1 Real-Time Streaming

**Option 1: GraphQL Subscriptions (Recommended)**
```json
{
  "dependencies": {
    "@nestjs/websockets": "^11.0.0",
    "ws": "^8.16.0",
    "graphql-ws": "^5.14.3",
    "graphql-subscriptions": "^2.0.0"
  }
}
```

**Pros:**
- Native integration with existing GraphQL API
- Type-safe subscriptions (matches schema)
- Apollo Client has built-in support
- Scales with Redis PubSub

**Cons:**
- More complex than SSE
- WebSocket connection overhead

**Option 2: Server-Sent Events (Alternative)**
```json
{
  "dependencies": {
    "@nestjs/sse": "^1.0.0"
  }
}
```

**Pros:**
- Simpler implementation
- HTTP-based (no WebSocket firewall issues)
- Native browser EventSource API

**Cons:**
- One-way only (server → client)
- Less flexible than WebSockets

### 3.2 Self-Service Analytics

**Query Builder UI:**
```json
{
  "dependencies": {
    "react-awesome-query-builder": "^6.5.0",
    "react-querybuilder": "^7.0.0"
  }
}
```

**Dashboard Layout:**
```json
{
  "dependencies": {
    "react-grid-layout": "^1.4.4",
    "@dnd-kit/core": "^6.1.0"
  }
}
```

**Advanced Charting:**
```json
{
  "dependencies": {
    "recharts": "^2.12.0", // Already installed
    "nivo": "^0.84.0", // Alternative for advanced viz
    "react-pivottable": "^0.11.0" // Pivot tables
  }
}
```

**Data Export:**
```json
{
  "dependencies": {
    "exceljs": "^4.4.0", // Already installed
    "jspdf": "^2.5.1", // Client-side PDF generation
    "file-saver": "^2.0.5" // Download trigger
  }
}
```

### 3.3 Infrastructure

**Caching & Pub/Sub:**
```json
{
  "dependencies": {
    "@nestjs/cache-manager": "^2.0.0",
    "cache-manager-redis-store": "^3.0.0",
    "ioredis": "^5.3.0"
  }
}
```

**Why Redis?**
- Cache hot analytics data (5-60 second TTL)
- Pub/Sub for real-time subscriptions
- Session storage for long-running exports
- Leaderboard/ranking calculations

---

## 4. Implementation Roadmap

### Phase 1: Real-Time Infrastructure (1-2 weeks)

**Priority:** HIGH
**Effort:** Medium

1. **Install WebSocket Dependencies**
   - Add `@nestjs/websockets`, `ws`, `graphql-ws`
   - Configure Apollo Server for subscriptions
   - Update frontend Apollo Client for WebSocket link

2. **Implement GraphQL Subscriptions**
   - Schema: `executiveKPIUpdates`, `performanceAlerts`, `metricsStream`
   - Resolver: Publish to subscriptions on data changes
   - PubSub mechanism (in-memory or Redis)

3. **Real-Time Dashboard Updates**
   - Subscribe to KPI updates in Executive Dashboard
   - Auto-refresh every 30 seconds
   - Connection status indicator
   - Fallback to polling if WebSocket fails

**Success Criteria:**
- Dashboard updates automatically without page refresh
- Health score alerts trigger within 5 seconds
- WebSocket connection resilient to network issues

### Phase 2: Self-Service Query Builder (2-3 weeks)

**Priority:** HIGH
**Effort:** High

1. **Backend: Dynamic Query Engine**
   - Safe SQL query builder (parameterized queries)
   - Whitelist of allowed tables/columns
   - Aggregation support (SUM, AVG, COUNT, MIN, MAX)
   - Filter operators (=, !=, <, >, IN, BETWEEN, LIKE)
   - Result pagination and limits

2. **Database: Saved Reports Schema**
   ```sql
   CREATE TABLE saved_reports (
     report_id UUID PRIMARY KEY,
     tenant_id UUID NOT NULL,
     user_id UUID NOT NULL,
     name VARCHAR(255) NOT NULL,
     description TEXT,
     report_config JSONB NOT NULL, -- dimensions, metrics, filters
     chart_type VARCHAR(50),
     is_public BOOLEAN DEFAULT false,
     tags TEXT[],
     last_run_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Frontend: Query Builder UI**
   - Integrate `react-querybuilder` component
   - Data source selector (sales, production, inventory, etc.)
   - Dimension/metric drag-and-drop
   - Filter builder with type-aware operators
   - Preview results in table/chart

4. **Save & Share Reports**
   - Save button → persist to `saved_reports`
   - Report library page (My Reports, Shared Reports)
   - Share with team members
   - Clone/edit existing reports

**Success Criteria:**
- Non-technical users can create custom reports
- Reports execute in <3 seconds for typical datasets
- All queries parameterized (SQL injection safe)
- 100+ saved reports load instantly

### Phase 3: Interactive Dashboards (2-3 weeks)

**Priority:** MEDIUM
**Effort:** High

1. **Dashboard Builder UI**
   - Grid layout with drag-and-drop (react-grid-layout)
   - Widget library: KPI card, chart, table, map
   - Widget configuration panel
   - Save/load dashboard layouts

2. **Cross-Widget Filtering**
   - Global filter state (Zustand store)
   - Click chart → apply filter to dashboard
   - Filter panel UI (date range, categories, etc.)
   - Apply/reset filters

3. **Drill-Down Navigation**
   - Click revenue chart → customer breakdown
   - Click customer → order list
   - Breadcrumb trail
   - Back button navigation

4. **Dashboard Templates**
   - Pre-built dashboards: Executive, Sales, Operations, Finance
   - Clone template → customize
   - Share custom dashboards

**Success Criteria:**
- Users can create custom 5+ widget dashboards
- Cross-filtering works across all widgets
- Drill-down 3+ levels deep
- Dashboard loads in <2 seconds

### Phase 4: Advanced Analytics (3-4 weeks)

**Priority:** LOW
**Effort:** Very High

1. **Pivot Tables**
   - Integrate `react-pivottable`
   - Drag dimensions to rows/columns
   - Multiple aggregations
   - Export to Excel with pivot

2. **Advanced Visualizations**
   - Heatmaps (correlation matrices)
   - Scatter plots (regression analysis)
   - Funnel charts (conversion analysis)
   - Sankey diagrams (flow analysis)

3. **Statistical Analysis**
   - Implement actual correlation calculations (Pearson, Spearman)
   - P-value significance testing
   - Trend analysis (linear regression)
   - Anomaly detection

4. **Scheduled Reports**
   - Cron-based report generation
   - Email delivery with attachments
   - Report scheduling UI
   - Weekly/monthly digest emails

**Success Criteria:**
- Pivot tables handle 100k+ rows
- Statistical analysis matches Excel results
- Scheduled reports deliver on time 99%+

---

## 5. Database Schema Changes Required

### 5.1 Saved Reports & Dashboards

```sql
-- Migration: V0.0.XX__create_self_service_analytics_tables.sql

-- Saved Reports
CREATE TABLE saved_reports (
  report_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,

  -- Report metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- "Sales", "Operations", "Finance", etc.
  tags TEXT[],

  -- Report configuration (JSON)
  report_config JSONB NOT NULL,
  -- Example:
  -- {
  --   "dataSource": "sales_orders",
  --   "dimensions": ["customer_name", "product_category"],
  --   "metrics": [{"field": "total_amount", "aggregation": "SUM", "alias": "Total Revenue"}],
  --   "filters": [{"field": "order_date", "operator": ">=", "value": "2025-01-01"}],
  --   "sorts": [{"field": "Total Revenue", "direction": "DESC"}],
  --   "limit": 1000
  -- }

  -- Visualization
  chart_type VARCHAR(50), -- "bar", "line", "pie", "table", "pivot"
  chart_config JSONB, -- Chart-specific options

  -- Sharing
  is_public BOOLEAN DEFAULT false,
  shared_with_user_ids UUID[], -- Specific users
  shared_with_role_ids UUID[], -- Roles

  -- Metadata
  last_run_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL
);

CREATE INDEX idx_saved_reports_tenant_user ON saved_reports(tenant_id, user_id);
CREATE INDEX idx_saved_reports_public ON saved_reports(tenant_id, is_public) WHERE is_public = true;
CREATE INDEX idx_saved_reports_tags ON saved_reports USING GIN(tags);

-- Row-Level Security
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_saved_reports ON saved_reports
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Custom Dashboards
CREATE TABLE custom_dashboards (
  dashboard_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,

  -- Dashboard metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),

  -- Layout configuration (JSON)
  layout_config JSONB NOT NULL,
  -- Example:
  -- {
  --   "widgets": [
  --     {
  --       "widgetId": "widget-1",
  --       "type": "kpi_card",
  --       "position": {"x": 0, "y": 0, "w": 3, "h": 2},
  --       "dataSource": "executiveKPISummary",
  --       "config": {"metric": "totalRevenue", "title": "Total Revenue"}
  --     },
  --     {
  --       "widgetId": "widget-2",
  --       "type": "chart",
  --       "position": {"x": 3, "y": 0, "w": 6, "h": 4},
  --       "reportId": "uuid-of-saved-report", -- Reference saved report
  --       "config": {"chartType": "bar"}
  --     }
  --   ],
  --   "gridSettings": {"cols": 12, "rowHeight": 60}
  -- }

  -- Refresh settings
  auto_refresh_enabled BOOLEAN DEFAULT false,
  auto_refresh_interval_seconds INTEGER DEFAULT 300, -- 5 minutes

  -- Sharing
  is_public BOOLEAN DEFAULT false,
  shared_with_user_ids UUID[],
  shared_with_role_ids UUID[],

  -- Metadata
  last_viewed_at TIMESTAMP,
  view_count INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL
);

CREATE INDEX idx_custom_dashboards_tenant_user ON custom_dashboards(tenant_id, user_id);
CREATE INDEX idx_custom_dashboards_public ON custom_dashboards(tenant_id, is_public) WHERE is_public = true;

ALTER TABLE custom_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_custom_dashboards ON custom_dashboards
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Report Execution History
CREATE TABLE report_execution_history (
  execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  report_id UUID REFERENCES saved_reports(report_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Execution details
  status VARCHAR(20) NOT NULL, -- RUNNING, COMPLETED, FAILED, CANCELLED
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  execution_time_ms INTEGER,

  -- Results
  row_count INTEGER,
  result_cache_key VARCHAR(255), -- Redis cache key if caching results

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,

  -- Performance tracking
  query_hash VARCHAR(32), -- MD5 of generated SQL
  query_preview TEXT -- First 500 chars
);

CREATE INDEX idx_report_exec_history_report ON report_execution_history(report_id, started_at DESC);
CREATE INDEX idx_report_exec_history_user ON report_execution_history(user_id, started_at DESC);
CREATE INDEX idx_report_exec_history_status ON report_execution_history(status) WHERE status = 'RUNNING';

-- Scheduled Reports
CREATE TABLE scheduled_reports (
  schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  report_id UUID REFERENCES saved_reports(report_id) ON DELETE CASCADE,

  -- Schedule configuration
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  cron_expression VARCHAR(100) NOT NULL, -- "0 8 * * 1" = Every Monday 8am
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Delivery
  delivery_method VARCHAR(50) NOT NULL, -- EMAIL, S3, SFTP
  email_recipients TEXT[], -- For EMAIL delivery
  email_subject VARCHAR(500),
  email_body TEXT,

  -- Export format
  export_format VARCHAR(20) NOT NULL, -- PDF, EXCEL, CSV

  -- Execution tracking
  last_execution_at TIMESTAMP,
  last_execution_status VARCHAR(20),
  next_execution_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL
);

CREATE INDEX idx_scheduled_reports_next_exec ON scheduled_reports(next_execution_at) WHERE enabled = true;
CREATE INDEX idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
```

### 5.2 Real-Time Metrics Cache

```sql
-- Migration: V0.0.XX__add_realtime_metrics_cache.sql

-- Cache for real-time dashboard metrics
CREATE TABLE realtime_metrics_cache (
  cache_key VARCHAR(255) PRIMARY KEY,
  tenant_id UUID NOT NULL,
  metric_type VARCHAR(100) NOT NULL, -- "executive_kpi", "performance_overview", etc.

  -- Cached data
  metric_data JSONB NOT NULL,

  -- Cache metadata
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMP
);

CREATE INDEX idx_realtime_cache_tenant_type ON realtime_metrics_cache(tenant_id, metric_type);
CREATE INDEX idx_realtime_cache_expires ON realtime_metrics_cache(expires_at);

-- Auto-cleanup expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_realtime_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM realtime_metrics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron)
-- SELECT cron.schedule('cleanup-realtime-cache', '*/5 * * * *', 'SELECT cleanup_expired_realtime_cache()');
```

---

## 6. Integration with Existing Systems

### 6.1 Analytics Service Integration

**Current Gap:** `AnalyticsService` returns mock data

**Required Changes:**
```typescript
// backend/src/modules/analytics/services/analytics.service.ts

@Injectable()
export class AnalyticsService {
  constructor(@Inject('DATABASE_POOL') private db: Pool) {}

  async getVendorProductionImpact(
    vendorId: string,
    startDate: Date,
    endDate: Date,
    tenantId: string,
  ): Promise<VendorProductionImpact> {
    // BEFORE: return mockData
    // AFTER: Query vendor_production_impact_v view

    const result = await this.db.query(`
      SELECT
        vendor_id,
        vendor_name,
        on_time_delivery_pct,
        quality_acceptance_pct,
        avg_lead_time_days,
        production_oee,
        production_downtime_hours,
        material_shortage_incidents,
        estimated_cost_impact,
        correlation_coefficient,
        p_value,
        is_statistically_significant
      FROM vendor_production_impact_v
      WHERE vendor_id = $1
        AND tenant_id = $2
    `, [vendorId, tenantId]);

    if (result.rows.length === 0) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    const row = result.rows[0];
    return {
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      tenantId,
      onTimeDeliveryPct: parseFloat(row.on_time_delivery_pct),
      qualityAcceptancePct: parseFloat(row.quality_acceptance_pct),
      avgLeadTimeDays: parseFloat(row.avg_lead_time_days),
      productionOEE: parseFloat(row.production_oee),
      productionDowntimeHours: parseFloat(row.production_downtime_hours),
      materialShortageIncidents: row.material_shortage_incidents,
      estimatedCostImpact: parseFloat(row.estimated_cost_impact),
      correlationCoefficient: parseFloat(row.correlation_coefficient),
      pValue: parseFloat(row.p_value),
      isStatisticallySignificant: row.is_statistically_significant,
      startDate,
      endDate,
      dataPoints: 90, // Calculate from actual data
    };
  }

  // Repeat for other 5 analytics methods...
}
```

### 6.2 Export Service Integration

**Required Changes:**
1. Replace `/tmp/exports/` with cloud storage (S3, Azure Blob)
2. Implement email delivery via `nodemailer` (already installed)
3. Add export job database persistence
4. Implement background job processing (Bull queue)

**Example:**
```typescript
// backend/src/modules/analytics/services/export.service.ts

@Injectable()
export class ExportService {
  constructor(
    @Inject('S3_CLIENT') private s3: S3Client,
    @Inject('EMAIL_SERVICE') private emailService: EmailService,
    @Inject('DATABASE_POOL') private db: Pool,
  ) {}

  async exportReport(input: ExportReportInput): Promise<ExportResult> {
    // 1. Create export job record in database
    const exportId = uuidv4();
    await this.db.query(`
      INSERT INTO export_jobs (
        export_id, tenant_id, user_id, report_type, export_format,
        status, start_date, end_date, filters, requested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [exportId, input.tenantId, input.userId, input.reportType,
        input.format, 'PROCESSING', input.startDate, input.endDate,
        JSON.stringify(input.filters)]);

    // 2. Generate export (existing logic)
    const exportPath = await this.generateExport(input, exportId);

    // 3. Upload to S3
    const s3Key = `exports/${input.tenantId}/${exportId}.${input.format.toLowerCase()}`;
    await this.s3.upload({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: fs.createReadStream(exportPath),
    });

    // 4. Generate presigned URL (24-hour expiry)
    const downloadUrl = await this.s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Expires: 86400, // 24 hours
    });

    // 5. Update export job
    await this.db.query(`
      UPDATE export_jobs
      SET status = 'COMPLETED',
          download_url = $1,
          completed_at = NOW(),
          file_size_bytes = $2,
          expires_at = NOW() + INTERVAL '24 hours'
      WHERE export_id = $3
    `, [downloadUrl, fileSize, exportId]);

    // 6. Send email if requested
    if (input.emailTo && input.emailTo.length > 0) {
      await this.emailService.sendExportEmail(
        input.emailTo,
        input.reportType,
        downloadUrl,
      );
      await this.db.query(`
        UPDATE export_jobs SET email_sent_at = NOW() WHERE export_id = $1
      `, [exportId]);
    }

    return { exportId, status: 'COMPLETED', downloadUrl, ... };
  }
}
```

### 6.3 Performance Monitoring Integration

**Leverage Existing Infrastructure:**
- Use `PerformanceMetricsService` for dashboard metrics
- Create GraphQL subscription for `performanceAlerts`
- Add frontend real-time performance widget

**Example Subscription:**
```typescript
// backend/src/modules/monitoring/monitoring.resolver.ts

@Resolver()
export class MonitoringResolver {
  constructor(
    private performanceService: PerformanceMetricsService,
    @Inject('PUBSUB') private pubSub: PubSub,
  ) {}

  @Subscription(() => PerformanceOverview)
  performanceUpdates(
    @Args('tenantId') tenantId: string,
    @Args('interval') interval: number = 30000, // 30 seconds
  ) {
    return this.pubSub.asyncIterator(`performance.${tenantId}`);
  }

  // Background job publishes every 30 seconds
  @Cron('*/30 * * * * *') // Every 30 seconds
  async publishPerformanceUpdates() {
    const tenants = await this.getActiveTenants();
    for (const tenantId of tenants) {
      const overview = await this.performanceService.getPerformanceOverview(
        tenantId,
        'LAST_HOUR',
      );
      await this.pubSub.publish(`performance.${tenantId}`, overview);
    }
  }
}
```

---

## 7. Security & Performance Considerations

### 7.1 Security

**Query Builder Security:**
- ✅ Whitelist allowed tables/columns (never allow arbitrary SQL)
- ✅ Parameterized queries only (prevent SQL injection)
- ✅ Row-Level Security (RLS) enforced for all queries
- ✅ Rate limiting on ad-hoc queries (10 req/min per user)
- ✅ Query execution timeout (30 seconds max)
- ✅ Result size limits (100k rows max, 10 MB max)

**Export Security:**
- ✅ Presigned URLs with 24-hour expiry
- ✅ Tenant isolation (cannot export other tenant data)
- ✅ Role-based access control (RBAC) for sensitive reports
- ✅ Audit trail for all exports (who, when, what)

**Real-Time Security:**
- ✅ JWT authentication for WebSocket connections
- ✅ Tenant ID validation on subscription
- ✅ Subscription authorization (user can only subscribe to own tenant)

### 7.2 Performance

**Caching Strategy:**
- Hot data cached in Redis (5-60 second TTL)
- OLAP cache refreshed every 5 minutes
- Materialized views refreshed hourly
- Query result caching for expensive reports

**Database Optimization:**
- All analytics views have covering indexes
- Time-series tables partitioned by month
- Auto-vacuum configured for analytics tables
- Connection pooling (already configured)

**Scalability:**
- WebSocket connections: 10k concurrent (per instance)
- Horizontal scaling: Add more backend instances (stateless)
- Database: Read replicas for analytics queries
- Redis: Cluster mode for >100k subscriptions

---

## 8. Cost-Benefit Analysis

### Estimated Development Effort

| Phase | Feature | Effort (Person-Days) | Priority |
|-------|---------|---------------------|----------|
| 1 | Real-Time Streaming (WebSocket + Subscriptions) | 8-10 days | HIGH |
| 2 | Self-Service Query Builder (Backend + UI) | 12-15 days | HIGH |
| 2 | Saved Reports & Library | 5-7 days | HIGH |
| 3 | Interactive Dashboards (Drill-Down + Cross-Filter) | 10-12 days | MEDIUM |
| 3 | Dashboard Builder UI | 8-10 days | MEDIUM |
| 4 | Pivot Tables | 5-7 days | LOW |
| 4 | Advanced Visualizations | 5-7 days | LOW |
| 4 | Statistical Analysis (Real Calculations) | 8-10 days | LOW |
| 4 | Scheduled Reports | 5-7 days | LOW |
| **TOTAL** | **All Phases** | **66-85 days** | - |

### Business Value

**Quantitative Benefits:**
- 50% reduction in manual report generation time
- 80% faster insights discovery (ad-hoc queries vs custom dev)
- 90% reduction in "can you pull this data?" requests to dev team
- Real-time issue detection (5 seconds vs 5 minutes)

**Qualitative Benefits:**
- Empowered business users (self-service)
- Data-driven decision making (easier access to insights)
- Improved customer satisfaction (faster issue resolution)
- Competitive advantage (modern BI capabilities)

**ROI Estimate:**
- Development cost: $50k-$70k (at $800/day contractor rate)
- Annual benefit: $150k-$200k (time savings + revenue growth)
- **ROI:** 2-3x in first year

---

## 9. Recommendations

### Immediate Actions (Next Sprint)

1. **Integrate Analytics Views with Services** ✅ PRIORITY 1
   - Replace mock data in `AnalyticsService` with real database queries
   - Add error handling and logging
   - Write integration tests
   - **Effort:** 2-3 days

2. **Implement Real-Time Subscriptions** ✅ PRIORITY 2
   - Install WebSocket dependencies
   - Add `executiveKPIUpdates` subscription
   - Update frontend to subscribe
   - **Effort:** 3-5 days

3. **Fix Export Service File Storage** ✅ PRIORITY 3
   - Replace `/tmp/exports/` with cloud storage
   - Implement email delivery
   - Persist export jobs to database
   - **Effort:** 2-3 days

### Short-Term (1-2 Months)

1. **Self-Service Query Builder** (Phase 2)
   - Backend dynamic query engine
   - Saved reports schema and API
   - Frontend query builder UI
   - Report library page

2. **Dashboard Templates** (Phase 3 Lite)
   - Pre-built Executive/Sales/Operations dashboards
   - Auto-refresh controls
   - Basic cross-widget date filtering

### Long-Term (3-6 Months)

1. **Advanced Interactive Dashboards** (Phase 3 Complete)
   - Drag-and-drop dashboard builder
   - Full cross-widget filtering
   - Multi-level drill-down

2. **Advanced Analytics** (Phase 4)
   - Pivot tables
   - Statistical analysis
   - Scheduled reports

### Technology Choices

**Recommended:**
- GraphQL Subscriptions > SSE (better for interactive dashboards)
- React Query Builder > Custom Builder (faster time to market)
- Redis Caching > In-Memory (better scalability)
- S3 Storage > Local Filesystem (reliability + scalability)

**Not Recommended:**
- Building custom query builder from scratch (reinventing wheel)
- Polling instead of WebSockets (poor UX, higher server load)
- Client-side analytics (data transfer overhead, security risk)

---

## 10. Conclusion

The AGOG SaaS ERP system has an **excellent foundation** for Business Intelligence with comprehensive analytics views, performance monitoring, and export capabilities. However, it is missing critical **real-time** and **self-service** features that modern users expect.

**Key Gaps:**
1. No real-time data streaming (WebSocket/GraphQL subscriptions)
2. No self-service query builder or ad-hoc analysis
3. Limited interactivity in dashboards (no drill-down, cross-filtering)
4. Analytics services return mock data (not connected to database views)

**Recommended Path Forward:**
1. **Week 1-2:** Connect analytics services to database views + basic WebSocket subscriptions
2. **Month 1-2:** Self-service query builder + saved reports
3. **Month 2-4:** Interactive dashboards with drill-down
4. **Month 4-6:** Advanced analytics (pivot tables, scheduling)

**Expected Outcome:**
- Modern, self-service BI platform
- Real-time monitoring and alerts
- 50%+ reduction in manual reporting effort
- Strong competitive advantage in ERP market

The technology stack is already in place (GraphQL, PostgreSQL, React). The main effort is building the UI components and integrating the existing backend views.

---

**Research Completed By:** Cynthia (Research Specialist)
**Date:** December 30, 2025
**Next Steps:** Review with Marcus (Team Lead) and Roy (Backend) for implementation planning
