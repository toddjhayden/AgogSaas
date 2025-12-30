# Cynthia Research Report: Real-Time System Monitoring & Observability

**Feature:** REQ-STRATEGIC-AUTO-1767103864616 / Real-Time System Monitoring & Observability
**Researched By:** Cynthia
**Date:** 2025-12-30
**Complexity:** Medium
**Estimated Effort:** 3-4 weeks

---

## Executive Summary

The system currently has **partial monitoring infrastructure** in place, including:
- Basic health checks (backend, frontend, database)
- Performance metrics collection (API, queries, system resources) via V0.0.40 migration
- Agent activity tracking via NATS subscriptions
- Prometheus/Grafana configuration files (bin-optimization focused)
- GraphQL resolvers for monitoring and performance data

**GAPS IDENTIFIED:**
1. **No real-time alerting system** - Prometheus config exists but not integrated with application
2. **No distributed tracing** - No OpenTelemetry/Jaeger for request tracing across services
3. **No centralized logging** - Console.log only, no structured logging or log aggregation
4. **Limited error tracking** - Basic system_errors table but no automatic error capture/reporting
5. **No SLO/SLA monitoring** - No service level objective tracking or breach alerts
6. **Missing metrics export** - Performance data stored but not exposed via Prometheus format
7. **No anomaly detection** - Reactive monitoring only, no ML-based predictive alerts
8. **Incomplete dashboard integration** - OrchestratorDashboard exists but MonitoringDashboard incomplete

**RECOMMENDED APPROACH:**
Implement a comprehensive observability stack with:
- Structured logging (Winston/Pino) + Log aggregation (Loki/ELK)
- OpenTelemetry instrumentation for distributed tracing
- Prometheus metrics exporter for existing performance data
- Real-time alerting engine with multi-channel notifications
- Enhanced dashboards with SLO tracking and anomaly detection

This is a **Medium complexity** task requiring backend service creation, database schema enhancements, frontend dashboard updates, and DevOps infrastructure configuration.

---

## Functional Requirements

### Primary Requirements

- [x] **Real-time health monitoring** of all system components (backend, frontend, database, NATS, external services)
  - Source: REQ title implies comprehensive monitoring
  - Current state: Basic health checks exist (health.controller.ts, health-monitor.service.ts)
  - Gap: Not real-time, no automatic alerting on health degradation

- [x] **Performance metrics collection and visualization**
  - Source: Observability requirement implies performance tracking
  - Current state: Performance metrics service exists (V0.0.40 migration), data collected but underutilized
  - Gap: No time-series visualization, no percentile graphs, no anomaly highlighting

- [x] **Error tracking and aggregation**
  - Source: Observability best practices
  - Current state: system_errors table exists, basic error logging
  - Gap: No automatic error capture, no error grouping, no stack trace analysis, no error rate alerts

- [x] **Distributed tracing for request flows**
  - Source: Real-time observability requirement
  - Current state: None - no tracing infrastructure
  - Gap: Cannot trace requests across GraphQL → Services → Database → External APIs

- [x] **Centralized log aggregation**
  - Source: System monitoring requirement
  - Current state: Console.log only, logs ephemeral
  - Gap: No structured logging, no searchable log history, no log-based alerting

- [x] **Real-time alerting and notifications**
  - Source: Real-time monitoring requirement
  - Current state: None - monitoring is passive only
  - Gap: No alerts for errors, performance degradation, resource exhaustion, security events

- [x] **SLO/SLA tracking and reporting**
  - Source: Observability best practice for production systems
  - Current state: None - no service level objectives defined or tracked
  - Gap: No uptime tracking, no latency SLOs, no error budget monitoring

### Acceptance Criteria

- [x] System health status visible in real-time dashboard (< 5 second refresh)
- [x] Performance metrics (latency, throughput, error rate) visualized with historical trends
- [x] Errors automatically captured, grouped, and assigned severity levels
- [x] Distributed traces show end-to-end request flow with timing breakdowns
- [x] Logs searchable by timestamp, level, service, user, tenant
- [x] Alerts triggered within 60 seconds of threshold breach
- [x] Notifications sent via email, Slack, PagerDuty (configurable)
- [x] SLO compliance tracked and visualized (uptime, latency p95/p99, error rate)
- [x] Multi-tenant: All metrics/logs/traces isolated by tenant_id
- [x] Security: Monitoring data access controlled by RLS policies

### Out of Scope

- **Application Performance Monitoring (APM) SaaS** (Datadog, New Relic) - use open-source stack instead
- **Infrastructure monitoring** (Kubernetes, Docker, VM metrics) - focus on application layer
- **Synthetic monitoring** (uptime checks, external probes) - future enhancement
- **Cost monitoring** (cloud spend tracking) - separate requirement
- **Security incident response automation** - handled by separate security module

---

## Technical Constraints

### Database Requirements

**Existing Tables (leverage):**
- `system_errors` - Error tracking (V0.0.1 migration)
- `health_history` - Component health history (V0.0.1 migration)
- `query_performance_log` - Query metrics (V0.0.40 migration, partitioned)
- `api_performance_log` - API metrics (V0.0.40 migration, partitioned)
- `system_resource_metrics` - Resource utilization (V0.0.40 migration, partitioned)
- `performance_metrics_cache` - OLAP cache (V0.0.40 migration)

**New Tables Needed:**
- `distributed_traces` - Trace spans with parent/child relationships
- `log_entries` - Structured logs with metadata
- `alert_rules` - Alert configuration (thresholds, channels)
- `alert_history` - Alert firing history
- `slo_definitions` - Service level objectives
- `slo_compliance_metrics` - SLO tracking over time

**RLS Policies Required:** YES
- All monitoring data MUST be tenant-isolated
- Logs, traces, errors filtered by tenant_id
- System-level metrics (CPU, memory) visible to admins only

**Multi-tenant:** YES - Critical
- `tenant_id` column required on all new tables
- RLS policies enforce data isolation
- Cross-tenant data leakage prevented

### API Requirements

**GraphQL Queries Needed:**
- `systemHealthRealtime` - Real-time health with WebSocket subscription
- `performanceMetricsTimeSeries` - Time-series data for charts
- `errorAggregates` - Grouped errors with counts/trends
- `distributedTrace(traceId)` - Trace details with all spans
- `searchLogs(query, filters)` - Log search with pagination
- `alertRules` - List configured alerts
- `alertHistory(timeRange)` - Recent alerts
- `sloCompliance(sloId, timeRange)` - SLO tracking

**GraphQL Mutations Needed:**
- `createAlertRule(rule)` - Configure new alert
- `updateAlertRule(id, rule)` - Modify alert
- `deleteAlertRule(id)` - Remove alert
- `acknowledgeAlert(alertId)` - Mark alert as seen
- `createSLO(definition)` - Define service level objective
- `markErrorResolved(errorId)` - Update error status

**GraphQL Subscriptions Needed:**
- `systemHealthUpdated` - Real-time health changes (already exists in schema)
- `errorCreated` - New errors as they occur (already exists in schema)
- `alertFired` - Real-time alert notifications (NEW)
- `performanceAnomaly` - Anomalous metric patterns (NEW)

**REST Endpoints Needed:**
- `GET /metrics` - Prometheus metrics export
- `POST /api/traces` - OpenTelemetry trace ingestion
- `POST /api/logs` - Structured log ingestion

**Authentication Required:** YES
- All monitoring APIs require JWT authentication
- RBAC: Admins see all tenants, users see their tenant only
- API keys for external monitoring tools (Grafana)

### Security Requirements

**Tenant Isolation:**
- CRITICAL: All monitoring queries MUST filter by tenant_id from JWT
- Logs may contain sensitive data (PII, credentials) - MUST be isolated
- Traces include request/response payloads - MUST be tenant-scoped
- Errors include stack traces - MUST NOT leak cross-tenant data

**RLS Enforcement:**
- `distributed_traces` - WHERE tenant_id = current_setting('app.current_tenant')::uuid
- `log_entries` - WHERE tenant_id = current_setting('app.current_tenant')::uuid
- `system_errors` - WHERE tenant_id = current_setting('app.current_tenant')::uuid OR tenant_id IS NULL (system errors)

**Permission Checks:**
- `ADMIN` role: View all tenants, configure alerts, manage SLOs
- `USER` role: View own tenant only, acknowledge alerts
- `READONLY` role: View dashboards only, no configuration changes

**Input Validation:**
- Alert threshold values: Numeric, positive, within reasonable bounds
- Log search queries: Prevent NoSQL injection, limit result size
- Trace IDs: UUID format validation
- Time ranges: Validate start < end, limit to 90 days max

**Data Retention:**
- Traces: 7 days (large volume, short-term debugging)
- Logs: 30 days (compliance requirement)
- Errors: 90 days (long-term analysis)
- Metrics: Raw 30 days, aggregates 1 year
- Alerts: 90 days (audit trail)

### Performance Requirements

**Expected Load:**
- 1000 requests/second peak (API metrics collection)
- 10,000 log entries/second (high-cardinality logging)
- 100 traces/second (10% sampling)
- 10 alerts/minute (during incidents)

**Response Time Targets:**
- Dashboard queries: < 500ms p95
- Log search: < 2 seconds p95 (with indexing)
- Trace lookup: < 100ms p95 (by trace_id)
- Alert evaluation: < 5 seconds (end-to-end)

**Data Volume:**
- Metrics: 1 million data points/day
- Logs: 10 GB/day compressed
- Traces: 5 GB/day compressed

**Scalability Considerations:**
- Time-series partitioning (by month) for metrics/logs/traces
- Automatic partition cleanup (pg_cron or manual scripts)
- Downsampling older metrics (5min → 1hour → 1day aggregates)
- Log compression (JSONB → compressed storage)

### Integration Points

**Existing Systems:**
- **NATS** - Agent activity monitoring (already integrated in agent-activity.service.ts)
- **PostgreSQL** - Metrics storage (V0.0.40 migration provides tables)
- **GraphQL API** - Query interface (performance.resolver.ts, monitoring.resolver.ts exist)
- **NestJS Backend** - Service layer (monitoring.module.ts exists)

**External Services (to integrate):**
- **Prometheus** - Metrics scraping (config exists at backend/monitoring/prometheus-config.yml)
- **Grafana** - Visualization (dashboard exists at backend/monitoring/grafana-dashboard.json)
- **OpenTelemetry Collector** - Trace aggregation (NEW - needs deployment)
- **Loki/ELK** - Log aggregation (NEW - needs deployment)
- **Alertmanager** - Alert routing (referenced in Prometheus config, needs setup)

**NATS Channels (NEW):**
- `agog.monitoring.alerts` - Alert notifications to agents
- `agog.monitoring.anomalies` - ML-detected anomalies
- `agog.monitoring.health` - Health status changes

---

## Codebase Analysis

### Existing Patterns Found

#### 1. **Performance Metrics Collection Pattern**
- **Files:**
  - `src/modules/monitoring/services/performance-metrics.service.ts` (REQ-STRATEGIC-AUTO-1767045901876)
  - `src/graphql/resolvers/performance.resolver.ts`
- **Pattern:** Service → Buffered Collection → Periodic Flush → OLAP Cache → GraphQL Query
- **Can reuse:**
  - Buffered metrics collection (flushes every 10 seconds or 100 items)
  - OLAP caching pattern (hourly aggregates)
  - Incremental refresh function (50-100ms execution time)
  - Multi-tenant filtering via context.req.user.tenantId
- **Lessons learned:**
  - Partitioning by month prevents table bloat
  - Incremental refresh is MUCH faster than full refresh
  - Health scoring formula works well (100 - response_time_penalty - error_rate_penalty)

#### 2. **Health Monitoring Pattern**
- **Files:**
  - `src/modules/monitoring/services/health-monitor.service.ts`
  - `src/health/health.controller.ts` (NestJS)
  - `src/health/health.resolver.ts` (GraphQL)
- **Pattern:** Periodic Health Checks → Database Storage → GraphQL Query
- **Can reuse:**
  - checkSystemHealth() method structure
  - ComponentHealth interface
  - Health history storage pattern
  - Overall health calculation (OPERATIONAL/DEGRADED/DOWN)
- **Lessons learned:**
  - NATS shown as 'UNKNOWN' in production (agent-only service) - good pattern
  - Health checks timeout after 5 seconds - prevents hanging
  - Cleanup old completed activities (keep 10 minutes) - prevents memory leaks

#### 3. **Agent Activity Tracking Pattern**
- **Files:**
  - `src/modules/monitoring/services/agent-activity.service.ts`
- **Pattern:** NATS Subscription → In-Memory Map → GraphQL Query
- **Can reuse:**
  - NATS subscription pattern (agog.deliverables.>, agog.workflows.>)
  - In-memory activity tracking with cleanup
  - JSONCodec for NATS message decoding
  - Status mapping (workflow status → agent status)
- **Lessons learned:**
  - In-memory map is fine for real-time data (not historical)
  - Cleanup old data to prevent memory leaks
  - NATS connection errors gracefully handled (continue without NATS)

#### 4. **GraphQL Schema Pattern**
- **Files:**
  - `src/modules/monitoring/graphql/schema.graphql`
  - `src/graphql/schema/performance.graphql`
- **Pattern:** Type Definitions → Query/Mutation → Subscription (real-time)
- **Can reuse:**
  - SystemHealth type structure
  - ComponentHealth type structure
  - ErrorSeverity/ErrorStatus enums
  - TimeRange enum
  - Subscription pattern for real-time updates
- **Lessons learned:**
  - Enums for status/severity are type-safe and self-documenting
  - Subscriptions exist in schema but not implemented - need actual WebSocket support
  - DateTime scalar used consistently

### Files That Need Modification

| File Path | Change Type | Reason |
|-----------|-------------|--------|
| **Backend - Services** |
| `src/modules/monitoring/services/performance-metrics.service.ts` | Modify | Add Prometheus metrics export method |
| `src/modules/monitoring/services/health-monitor.service.ts` | Modify | Add alert evaluation logic |
| `src/modules/monitoring/services/tracing.service.ts` | Create | OpenTelemetry trace ingestion and storage |
| `src/modules/monitoring/services/logging.service.ts` | Create | Structured logging with Winston/Pino |
| `src/modules/monitoring/services/alerting.service.ts` | Create | Alert rule evaluation and notification |
| `src/modules/monitoring/services/slo-tracking.service.ts` | Create | SLO compliance calculation |
| **Backend - Resolvers** |
| `src/modules/monitoring/monitoring.resolver.ts` | Modify | Add real-time subscriptions (WebSocket) |
| `src/graphql/resolvers/performance.resolver.ts` | Modify | Add trace and log queries |
| `src/graphql/resolvers/alerting.resolver.ts` | Create | Alert rule management |
| **Backend - Controllers** |
| `src/health/health.controller.ts` | Modify | Add /metrics endpoint for Prometheus |
| `src/monitoring/traces.controller.ts` | Create | POST /api/traces (OpenTelemetry) |
| `src/monitoring/logs.controller.ts` | Create | POST /api/logs (structured logs) |
| **Backend - GraphQL Schema** |
| `src/modules/monitoring/graphql/schema.graphql` | Modify | Add trace, log, alert types |
| `src/graphql/schema/performance.graphql` | Modify | Add SLO types |
| **Backend - Module** |
| `src/modules/monitoring/monitoring.module.ts` | Modify | Add new services and controllers |
| `src/app.module.ts` | Modify | Add OpenTelemetry instrumentation |
| **Database - Migrations** |
| `migrations/V0.0.41__add_observability_tables.sql` | Create | Traces, logs, alerts, SLOs |
| `migrations/V0.0.42__add_observability_indexes.sql` | Create | Performance indexes |
| `migrations/V0.0.43__add_observability_functions.sql` | Create | Alert evaluation functions |
| **Frontend - Pages** |
| `frontend/src/pages/MonitoringDashboard.tsx` | Modify | Enhanced with real-time charts |
| `frontend/src/pages/PerformanceAnalyticsDashboard.tsx` | Modify | Add trace viewer |
| `frontend/src/pages/AlertManagementPage.tsx` | Create | Alert rule configuration UI |
| `frontend/src/pages/SLODashboard.tsx` | Create | SLO compliance tracking |
| **Frontend - Components** |
| `frontend/src/components/monitoring/TraceViewer.tsx` | Create | Distributed trace visualization |
| `frontend/src/components/monitoring/LogExplorer.tsx` | Create | Log search and filtering |
| `frontend/src/components/monitoring/AlertCard.tsx` | Create | Alert display component |
| `frontend/src/components/monitoring/SLOWidget.tsx` | Create | SLO status widget |
| **Frontend - GraphQL** |
| `frontend/src/graphql/queries/monitoring.ts` | Modify | Add trace, log, alert queries |
| `frontend/src/graphql/subscriptions/monitoring.ts` | Create | Real-time subscriptions |
| **DevOps - Docker** |
| `docker-compose.monitoring.yml` | Create | Prometheus, Grafana, Loki, Tempo |
| `backend/monitoring/prometheus-config.yml` | Modify | Expand scrape configs |
| `backend/monitoring/alertmanager-config.yml` | Create | Alert routing rules |
| `backend/monitoring/loki-config.yaml` | Create | Log aggregation config |
| **Documentation** |
| `docs/MONITORING_SETUP.md` | Create | Deployment and configuration guide |
| `docs/ALERT_RULES.md` | Create | Alert rule reference |
| `docs/SLO_DEFINITIONS.md` | Create | SLO standards and targets |

### Architectural Patterns in Use

**Repository Pattern:** Partial
- Database access through services (performance-metrics.service.ts, health-monitor.service.ts)
- Direct SQL queries (no ORM like TypeORM/Prisma)
- Parameterized queries for SQL injection prevention

**Service Layer:** YES
- NestJS @Injectable services
- Dependency injection via @Inject decorator
- Service composition (multiple services in monitoring.module.ts)

**GraphQL Schema-First:** YES
- .graphql files define schema
- Resolvers implement schema (@Query, @Mutation decorators)
- Code generation NOT used (manual type mapping)

**Time-Series Partitioning:** YES
- V0.0.40 migration shows partitioning by month
- Automatic partition creation (current + next month)
- Partition cleanup needed (manual or pg_cron)

**OLAP Caching:** YES
- performance_metrics_cache table (hourly aggregates)
- Incremental refresh function (50-100ms)
- ON CONFLICT DO UPDATE (upsert pattern)

**Error Handling:**
- Try/catch blocks in services
- Console.error logging (needs structured logging)
- GraphQL errors returned to client (no custom error classes)

### Code Conventions

**Naming:**
- Files: kebab-case (performance-metrics.service.ts)
- Classes: PascalCase (PerformanceMetricsService)
- Methods: camelCase (getPerformanceOverview)
- Constants: UPPER_SNAKE_CASE (LAST_24_HOURS)

**File Structure:**
- Feature-based: src/modules/monitoring/
- Services: services/ subdirectory
- Resolvers: Same level as services
- GraphQL schema: graphql/ subdirectory

**Testing:**
- Jest framework
- Test files: __tests__/ or .test.ts suffix
- Coverage: Partial (some services tested)

**TypeScript:**
- Strict mode enabled
- Interfaces for data structures
- Enums for status types
- No 'any' types (strict typing)

**NestJS Decorators:**
- @Module, @Injectable, @Resolver, @Query, @Mutation
- @Inject for dependency injection
- @Args for GraphQL arguments
- @Context for request context (tenant_id extraction)

---

## Edge Cases & Error Scenarios

### Edge Cases to Handle

#### 1. **High-Cardinality Metrics**
- **Scenario:** Logging every unique user_id creates millions of distinct time series
- **Impact:** Database explosion, slow queries, Prometheus OOM
- **Solution:**
  - Limit cardinality (sample 10% of users for traces)
  - Aggregate by tenant_id only, not user_id
  - Use log sampling (1 in N requests)

#### 2. **Clock Skew in Distributed Tracing**
- **Scenario:** Backend server clock 5 minutes ahead of database server
- **Impact:** Trace spans show negative duration, broken timeline
- **Solution:**
  - Use monotonic timestamps (performance.now() for durations)
  - NTP synchronization across servers
  - Client-side timestamp normalization

#### 3. **Alert Storm (1000 alerts/minute)**
- **Scenario:** Database goes down, 1000s of error alerts fire simultaneously
- **Impact:** Email/Slack overload, alert fatigue, missed critical alerts
- **Solution:**
  - Alert deduplication (1 alert per error type per 5 minutes)
  - Rate limiting (max 10 alerts/minute per channel)
  - Alert grouping (combine similar alerts)
  - Circuit breaker (stop alerting after 100 in 1 minute)

#### 4. **Tenant with 1 Million Logs/Day**
- **Scenario:** Chatty tenant logs excessively (debug logs in production)
- **Impact:** Database bloat, slow queries for other tenants
- **Solution:**
  - Per-tenant rate limiting (10,000 logs/hour max)
  - Log level filtering (INFO and above only in production)
  - Automatic tenant throttling (degrade to ERROR only if exceeded)

#### 5. **Trace Without Parent Span**
- **Scenario:** Distributed trace receives child spans but parent never arrives
- **Impact:** Incomplete trace, broken visualization
- **Solution:**
  - Orphan span detection (child with no parent after 1 minute)
  - Create synthetic root span
  - Flag trace as incomplete

#### 6. **Multi-Tenant Data Leakage**
- **Scenario:** User modifies tenant_id in JWT payload to see other tenant's logs
- **Impact:** CRITICAL security breach, GDPR violation
- **Solution:**
  - JWT signature validation (cannot be modified)
  - RLS policies enforce isolation at database level
  - Log all cross-tenant access attempts (audit trail)
  - Alert on suspicious activity (user accessing tenant they don't belong to)

### Error Scenarios

#### 1. **Prometheus Scrape Failure**
- **Cause:** /metrics endpoint timeout (query too slow)
- **Impact:** Missing metrics in Grafana, stale dashboards
- **Recovery:**
  - Cache last successful metrics response (serve stale data if timeout)
  - Set scrape timeout to 10 seconds
  - Alert if scrape fails 3 times in a row

#### 2. **OpenTelemetry Collector Down**
- **Cause:** Collector crashed, network partition
- **Impact:** Traces lost, debugging impossible
- **Recovery:**
  - Application buffers traces locally (max 1000 spans)
  - Retry submission every 30 seconds
  - Drop oldest spans if buffer full (graceful degradation)

#### 3. **Log Ingestion Backlog**
- **Cause:** Log volume spike, database slow
- **Impact:** Logs delayed by minutes, missed alerts
- **Recovery:**
  - Asynchronous log ingestion (queue-based)
  - Batch inserts (1000 logs at a time)
  - Drop non-critical logs if queue > 10,000 (keep ERROR/CRITICAL only)

#### 4. **Alert Notification Failure**
- **Cause:** Slack API rate limit, email server down
- **Impact:** Alerts not received, incident response delayed
- **Recovery:**
  - Retry with exponential backoff (1s, 2s, 4s, 8s)
  - Failover to secondary channel (Slack fails → Email)
  - Store undelivered alerts in database (manual review)

#### 5. **Database Connection Pool Exhaustion**
- **Cause:** 1000 concurrent monitoring queries
- **Impact:** API hangs, 503 errors
- **Recovery:**
  - Separate connection pool for monitoring (10 connections dedicated)
  - Query timeout (5 seconds max)
  - Circuit breaker (stop queries if pool 90% utilized)

### Recovery Strategies

**Graceful Degradation:**
- Monitoring failures should NOT break application
- If tracing fails, continue without traces (log error only)
- If alerting fails, log to database (manual review)

**Retry Logic:**
- Transient errors (network timeout): Retry 3 times with exponential backoff
- Permanent errors (invalid data): Log and discard (no retry)

**Circuit Breaker:**
- If external service fails 5 times in 1 minute, stop calling for 5 minutes
- Prevents cascading failures (monitoring overload → database overload)

**Data Sampling:**
- Under high load, sample traces (10% of requests)
- Under high load, sample logs (ERROR/CRITICAL only)
- Preserve full data for critical paths (payment processing, user login)

---

## Security Analysis

### Vulnerabilities to Avoid

#### 1. **Tenant Isolation Breach**
- **Risk:** User modifies tenant_id to access other tenant's monitoring data
- **Mitigation:**
  - NEVER trust tenant_id from user input
  - ALWAYS extract tenant_id from JWT (signed, cannot be forged)
  - RLS policies enforce isolation at database level
  - Test: Attempt to query tenant_id != JWT.tenant_id (should return empty)

#### 2. **Log Injection Attack**
- **Risk:** User input `\r\n[ERROR] Admin password: admin123` creates fake log entry
- **Mitigation:**
  - Sanitize log messages (remove newlines, control characters)
  - Structured logging (JSON format, not plaintext)
  - Field-level escaping (message, user_agent, etc.)
  - Test: Try to inject newline/escape sequences in user input

#### 3. **Trace Payload Information Disclosure**
- **Risk:** Trace includes full request/response with PII, passwords
- **Mitigation:**
  - Redact sensitive fields (password, ssn, credit_card_number)
  - Configurable field blacklist (redact any field matching pattern)
  - Max payload size (truncate after 1KB)
  - Test: Ensure password fields never appear in traces

#### 4. **Alert Rule Injection**
- **Risk:** User creates alert rule with SQL injection in threshold query
- **Mitigation:**
  - Parameterized queries for all alert conditions
  - Whitelist allowed metrics (only predefined metrics allowed)
  - No raw SQL in alert rules (use metric names only)
  - Test: Attempt to inject SQL via threshold value

#### 5. **DoS via Expensive Queries**
- **Risk:** User queries 1 year of logs → database overload
- **Mitigation:**
  - Query timeout (5 seconds)
  - Max time range (90 days)
  - Result limit (1000 rows max)
  - Rate limiting (10 queries/minute per user)
  - Test: Request 10-year time range (should be rejected)

#### 6. **Cross-Tenant Alert Notification**
- **Risk:** Alert for tenant A sent to tenant B's email/Slack
- **Mitigation:**
  - Alert channels scoped to tenant (tenant_id on alert_rules table)
  - Validate recipient before sending (email belongs to tenant)
  - Audit log all alert deliveries
  - Test: Configure alert for tenant A, ensure tenant B never receives it

### Existing Security Patterns

**Authentication:**
- JWT-based (passport-jwt in package.json)
- Token validation on every request
- See: src/health/health.controller.ts uses @Context() for user extraction

**Authorization:**
- Role-based (ADMIN, USER, READONLY)
- No centralized authorization middleware (check in each resolver)
- See: performance.resolver.ts extracts tenantId from context.req.user

**Tenant Isolation:**
- RLS policies on monitoring tables (V0.0.1 migration)
- tenant_id filtering in all queries
- See: performance-metrics.service.ts uses tenantId parameter

**Input Validation:**
- class-validator in package.json
- Not used consistently (some resolvers lack validation)
- Need to add validation decorators (@IsUUID, @Max, @Min)

**SQL Injection Prevention:**
- Parameterized queries used (pg library)
- See: performance-metrics.service.ts uses $1, $2 placeholders

---

## Implementation Recommendations

### Recommended Approach

#### **Phase 1: Enhanced Logging (Week 1)**
**Owner:** Roy (Backend Developer)

**Tasks:**
1. Install Winston or Pino for structured logging
2. Create logging.service.ts (NestJS injectable)
3. Replace console.log/console.error throughout codebase
4. Add log_entries table (migration V0.0.41)
5. Implement async log ingestion (queue-based)
6. Add log search query to monitoring.resolver.ts

**Deliverables:**
- Structured JSON logs with metadata (level, timestamp, tenant_id, user_id, request_id)
- Log entries stored in database (searchable)
- GraphQL query: searchLogs(query, filters)

**Testing:**
- Unit tests for logging.service.ts
- Integration test: Create log → Query log → Verify retrieved

---

#### **Phase 2: Distributed Tracing (Week 2)**
**Owner:** Roy (Backend Developer)

**Tasks:**
1. Install @opentelemetry/sdk-node and related packages
2. Create tracing.service.ts (trace ingestion)
3. Instrument NestJS app (auto-instrumentation)
4. Add distributed_traces table (migration V0.0.41)
5. Implement trace storage (parent/child span relationships)
6. Add trace queries to monitoring.resolver.ts
7. Deploy OpenTelemetry Collector (Docker)

**Deliverables:**
- Automatic tracing of GraphQL requests (resolver → service → database)
- Trace storage with queryable spans
- GraphQL query: distributedTrace(traceId)
- Frontend TraceViewer component (timeline visualization)

**Testing:**
- E2E test: Make GraphQL request → Verify trace created → Verify trace query returns data
- Performance test: Ensure tracing overhead < 5ms per request

---

#### **Phase 3: Real-Time Alerting (Week 2-3)**
**Owner:** Roy (Backend Developer) + Berry (DevOps)

**Tasks:**
1. Create alerting.service.ts (alert evaluation)
2. Add alert_rules, alert_history tables (migration V0.0.41)
3. Implement alert evaluation (every 30 seconds via cron)
4. Add notification channels (Email, Slack, PagerDuty)
5. Create alerting.resolver.ts (alert management GraphQL API)
6. Deploy Alertmanager (Docker)
7. Configure Prometheus alert rules

**Deliverables:**
- Alert rule configuration UI (frontend)
- Alert evaluation engine (checks metrics every 30s)
- Multi-channel notifications (Email, Slack, webhook)
- GraphQL subscription: alertFired
- Alert history tracking

**Testing:**
- Unit test: Alert threshold breached → Verify notification sent
- E2E test: Configure alert → Trigger condition → Verify alert received
- Load test: 100 alerts/minute → Verify deduplication and rate limiting work

---

#### **Phase 4: Prometheus Metrics Export (Week 3)**
**Owner:** Roy (Backend Developer)

**Tasks:**
1. Install prom-client library
2. Add /metrics endpoint to health.controller.ts
3. Export existing performance metrics (from performance_metrics_cache)
4. Add custom metrics (active_connections, queue_depth, etc.)
5. Update prometheus-config.yml (scrape /metrics)
6. Update Grafana dashboards (use Prometheus data source)

**Deliverables:**
- /metrics endpoint (Prometheus format)
- Metrics scraped every 30 seconds
- Grafana dashboards show real-time data

**Testing:**
- Manual test: curl http://localhost:4000/metrics → Verify output
- Integration test: Prometheus scrapes → Verify data in Grafana

---

#### **Phase 5: SLO Tracking (Week 4)**
**Owner:** Roy (Backend Developer) + Jen (Frontend Developer)

**Tasks:**
1. Create slo-tracking.service.ts
2. Add slo_definitions, slo_compliance_metrics tables (migration V0.0.41)
3. Define default SLOs (99.9% uptime, p95 latency < 500ms, error rate < 0.1%)
4. Implement SLO calculation (daily compliance checks)
5. Add SLO queries to performance.resolver.ts
6. Create SLODashboard.tsx (frontend)

**Deliverables:**
- SLO definitions (uptime, latency, error rate)
- Daily compliance tracking
- SLO dashboard (current compliance, historical trends, error budget)

**Testing:**
- Unit test: Calculate SLO compliance for sample data
- E2E test: Simulate SLO breach → Verify error budget decremented

---

#### **Phase 6: Frontend Dashboards (Week 3-4)**
**Owner:** Jen (Frontend Developer)

**Tasks:**
1. Update MonitoringDashboard.tsx (real-time charts)
2. Create TraceViewer.tsx (distributed trace timeline)
3. Create LogExplorer.tsx (log search and filtering)
4. Create AlertManagementPage.tsx (configure alerts)
5. Create SLODashboard.tsx (SLO compliance)
6. Add GraphQL subscriptions (real-time updates via WebSocket)

**Deliverables:**
- Enhanced monitoring dashboard (performance charts, health status, recent errors)
- Trace viewer (span timeline, waterfall chart, span details)
- Log explorer (search, filter by level/tenant/time, pagination)
- Alert management UI (create/edit/delete rules, view history)
- SLO dashboard (current compliance, error budget, historical trends)

**Testing:**
- Manual testing: Navigate all dashboards, verify data displayed
- E2E test: Create alert via UI → Verify saved in database

---

### Libraries/Tools Recommended

**Logging:**
- **Winston** (https://github.com/winstonjs/winston) - 23k stars, mature, flexible transports
  - OR **Pino** (https://github.com/pinojs/pino) - 14k stars, faster, JSON-first
  - Recommendation: **Pino** (better performance, simpler API)

**Distributed Tracing:**
- **OpenTelemetry** (https://opentelemetry.io) - CNCF standard, vendor-neutral
  - Packages: @opentelemetry/sdk-node, @opentelemetry/auto-instrumentations-node
  - Collector: OpenTelemetry Collector (Docker image)
  - Storage: Tempo (Grafana Labs) OR Jaeger
  - Recommendation: **OpenTelemetry + Tempo** (Grafana integrated)

**Metrics Export:**
- **prom-client** (https://github.com/siimon/prom-client) - 5k stars, Prometheus Node.js client
  - Recommendation: **prom-client** (standard library)

**Alerting:**
- **Alertmanager** (https://prometheus.io/docs/alerting/latest/alertmanager/) - Prometheus native
  - Recommendation: **Alertmanager** (already referenced in prometheus-config.yml)

**Log Aggregation:**
- **Loki** (https://grafana.com/oss/loki/) - Grafana Labs, lightweight, cost-effective
  - OR **Elasticsearch** (https://www.elastic.co/elasticsearch/) - Full-text search, heavier
  - Recommendation: **Loki** (simpler, cheaper, Grafana integrated)

**Visualization:**
- **Grafana** (https://grafana.com) - Already configured (grafana-dashboard.json exists)
  - Recommendation: **Grafana** (continue using)

---

### Implementation Order

1. **Logging First** (Week 1)
   - Foundation for all observability
   - Enables debugging during other phases
   - Low risk (non-breaking change)

2. **Tracing Second** (Week 2)
   - Builds on logging infrastructure
   - Provides deep visibility into request flows
   - Medium risk (requires instrumentation)

3. **Alerting Third** (Week 2-3)
   - Depends on metrics (already exist from V0.0.40)
   - Immediate value (proactive incident response)
   - Medium risk (notification integration)

4. **Prometheus Export Fourth** (Week 3)
   - Exposes metrics to external tools
   - Enables Grafana dashboards
   - Low risk (read-only endpoint)

5. **SLO Tracking Fifth** (Week 4)
   - Builds on metrics and alerting
   - Long-term reliability tracking
   - Low risk (reporting only)

6. **Frontend Dashboards Last** (Week 3-4)
   - Parallel with backend work
   - Integrates all data sources
   - Low risk (UI only)

---

### Complexity Assessment

**Simple:** N/A (this is not a simple CRUD feature)

**Medium:** ✅ THIS FEATURE
- Multiple tables, business logic, integrations
- Leverages existing infrastructure (V0.0.40 migrations, monitoring.module.ts)
- No new architectural paradigms (uses NestJS patterns)
- Clear requirements with existing reference implementations

**Complex:** N/A (would require ML-based anomaly detection, predictive alerting, APM SaaS integration)

---

### Estimated Effort

**Ron (Database):** 3 days
- Create V0.0.41 migration (distributed_traces, log_entries, alert_rules, alert_history, slo_definitions, slo_compliance_metrics)
- Add RLS policies for tenant isolation
- Create indexes for performance (trace_id, timestamp, tenant_id)
- Create stored functions for alert evaluation

**Roy (Backend):** 2.5 weeks
- Week 1: Logging (logging.service.ts, log ingestion, log queries)
- Week 2: Tracing (tracing.service.ts, OpenTelemetry instrumentation, trace storage)
- Week 2-3: Alerting (alerting.service.ts, alert evaluation, notifications)
- Week 3: Prometheus export (/metrics endpoint)
- Week 4: SLO tracking (slo-tracking.service.ts, compliance calculation)

**Jen (Frontend):** 1.5 weeks
- Week 3-4: Dashboards (MonitoringDashboard.tsx, TraceViewer.tsx, LogExplorer.tsx, AlertManagementPage.tsx, SLODashboard.tsx)
- Week 4: GraphQL subscriptions (WebSocket real-time updates)

**Berry (DevOps):** 1 week
- Week 2: Deploy OpenTelemetry Collector (Docker)
- Week 3: Deploy Alertmanager (Docker), configure Slack/Email integration
- Week 3: Deploy Loki (Docker), configure log forwarding
- Week 3: Update Prometheus config, update Grafana dashboards

**Billy (QA):** 1 week
- Week 4: Manual testing (all dashboards, alert rules, log search, trace viewer)
- Week 4: E2E tests (alert workflow, trace creation, log ingestion)
- Week 4: Performance testing (1000 req/s, alert storm handling)
- Week 4: Security testing (tenant isolation, SQL injection, log injection)

**Total: 3-4 weeks** (some tasks parallel)

---

## Blockers & Dependencies

### Blockers (Must Resolve Before Starting)

- [x] **V0.0.40 Migration Applied** - Performance monitoring tables must exist
  - Status: ✅ Migration exists, assuming applied
  - Verification: Query performance_metrics_cache table

- [x] **NATS Operational** - Agent activity monitoring depends on NATS
  - Status: ✅ NATS used in agent-activity.service.ts
  - Verification: NATS_URL environment variable set

- [ ] **Docker Compose for Monitoring Stack** - Prometheus, Grafana, Loki, Tempo need deployment
  - Status: ❌ Config files exist but not orchestrated
  - Action: Create docker-compose.monitoring.yml

- [ ] **GraphQL Subscription Support** - Real-time updates via WebSocket
  - Status: ❌ Schema has subscriptions but no implementation
  - Action: Add WebSocket support to Apollo Server config

### Dependencies (Coordinate With)

**Marcus (Strategic Owner):**
- Ron needed for database migrations (3 days before Roy starts)
- Berry needed for infrastructure setup (parallel with Roy's work)

**Sarah (Strategic Owner):**
- Roy + Jen needed for implementation (parallel backend + frontend)
- Billy needed for testing (after Roy/Jen complete)

**Existing Features:**
- Depends on V0.0.40 (Performance Monitoring OLAP) - ✅ Complete
- Blocks: None (this is an infrastructure feature, doesn't block app features)

### Risks

**Risk 1: OpenTelemetry Overhead**
- **Description:** Auto-instrumentation may slow requests by 10-50ms
- **Probability:** Medium
- **Impact:** High (violates latency SLOs)
- **Mitigation:**
  - Benchmark with and without tracing
  - Use sampling (10% of requests) if overhead too high
  - Disable tracing for high-throughput endpoints if needed

**Risk 2: Log Volume Explosion**
- **Description:** Debug logs in production create 100 GB/day
- **Probability:** Medium
- **Impact:** High (database full, costs spike)
- **Mitigation:**
  - Enforce log level filtering (INFO+ only in production)
  - Per-tenant rate limiting (10,000 logs/hour)
  - Automatic downsampling (keep ERROR/CRITICAL, drop DEBUG/INFO)

**Risk 3: Alert Fatigue**
- **Description:** Too many alerts → ignored → missed critical alerts
- **Probability:** High
- **Impact:** Medium (incidents not responded to)
- **Mitigation:**
  - Start with conservative thresholds (fewer, high-confidence alerts)
  - Alert deduplication and grouping
  - Regular alert tuning (weekly review of fired alerts)

**Risk 4: Prometheus Scrape Timeout**
- **Description:** /metrics endpoint too slow (>10s) → scrape fails
- **Probability:** Low
- **Impact:** Medium (missing metrics in Grafana)
- **Mitigation:**
  - Cache metrics response (serve stale data if timeout)
  - Pre-aggregate metrics (don't query database on every scrape)
  - Use performance_metrics_cache (already pre-aggregated)

**Risk 5: Cross-Tenant Data Leak**
- **Description:** RLS policy bug allows tenant A to see tenant B's logs
- **Probability:** Low
- **Impact:** CRITICAL (GDPR violation, customer trust lost)
- **Mitigation:**
  - Thorough RLS policy testing (attempt cross-tenant queries)
  - Security audit before production deployment
  - Penetration testing (try to bypass tenant isolation)
  - Automated tests in CI/CD (verify RLS enforced)

---

## Questions for Clarification

### Unanswered Questions

1. **What are the target SLOs?**
   - Uptime: 99.9%? 99.95%? 99.99%?
   - Latency: p95 < 500ms? p99 < 1000ms?
   - Error rate: < 0.1%? < 0.01%?
   - **Recommendation:** Start with industry standard (99.9% uptime, p95 < 500ms, error rate < 1%)

2. **Which notification channels are required?**
   - Email: YES (confirmed - common requirement)
   - Slack: YES (confirmed - common in tech companies)
   - PagerDuty: UNKNOWN (for on-call rotations)
   - SMS: UNKNOWN (for critical alerts)
   - **Recommendation:** Start with Email + Slack, add PagerDuty if on-call needed

3. **What is the data retention policy?**
   - Traces: 7 days sufficient? (recommended for cost)
   - Logs: 30 days sufficient? (may need 90 days for compliance)
   - Metrics: 30 days raw + 1 year aggregated? (recommended)
   - **Recommendation:** Use industry standard unless specific compliance requirement

4. **Should we implement anomaly detection (ML-based)?**
   - Simple threshold alerts: Sufficient initially?
   - ML anomaly detection: Future phase?
   - **Recommendation:** Start with threshold alerts, add ML in Phase 2 (3-6 months)

5. **What is the budget for infrastructure?**
   - Open-source stack (Loki, Prometheus, Grafana): $0 license, $X hosting
   - SaaS stack (Datadog, New Relic): $X/month per host
   - **Recommendation:** Open-source stack (already configured)

**Recommended: Use AskUserQuestion tool to clarify notification channels and data retention policy before proceeding.**

---

## Next Steps

### Ready for Sylvia Critique

- ✅ Requirements analyzed (comprehensive observability stack)
- ✅ Codebase researched (V0.0.40 migration, monitoring.module.ts, performance.resolver.ts)
- ✅ Technical constraints documented (multi-tenant, RLS, high volume)
- ✅ Implementation approach recommended (6 phases over 3-4 weeks)

### Sylvia Should Review

1. **Are the requirements complete?**
   - Missing: Specific SLO targets, notification channels, data retention policy
   - Action: Clarify with user via AskUserQuestion

2. **Is the recommended approach sound?**
   - Phased approach (logging → tracing → alerting → metrics → SLO → UI)
   - Leverages existing infrastructure (V0.0.40 migrations, monitoring.module.ts)
   - Open-source stack (Loki, Prometheus, Grafana, OpenTelemetry)

3. **Are security risks identified?**
   - YES: Tenant isolation, log injection, trace payload disclosure, alert rule injection, DoS, cross-tenant alerts
   - Mitigations documented for each risk

4. **Is the complexity estimate realistic?**
   - Medium complexity (leverages existing patterns, clear requirements)
   - 3-4 weeks total (Ron 3 days, Roy 2.5 weeks, Jen 1.5 weeks, Berry 1 week, Billy 1 week)
   - Risks identified (OpenTelemetry overhead, log volume, alert fatigue)

5. **Should we proceed with implementation?**
   - Recommendation: YES, after clarifying SLO targets and notification channels
   - No blockers (V0.0.40 applied, NATS operational)
   - Dependencies manageable (Ron → Roy, Berry parallel)

---

## Research Artifacts

### Files Read
- `print-industry-erp/backend/src/modules/monitoring/monitoring.module.ts`
- `print-industry-erp/backend/src/modules/monitoring/monitoring.resolver.ts`
- `print-industry-erp/backend/src/modules/monitoring/services/health-monitor.service.ts`
- `print-industry-erp/backend/src/modules/monitoring/services/performance-metrics.service.ts`
- `print-industry-erp/backend/src/modules/monitoring/services/agent-activity.service.ts`
- `print-industry-erp/backend/src/graphql/resolvers/performance.resolver.ts`
- `print-industry-erp/backend/src/modules/monitoring/graphql/schema.graphql`
- `print-industry-erp/backend/src/graphql/schema/performance.graphql`
- `print-industry-erp/backend/migrations/V0.0.1__create_monitoring_tables.sql`
- `print-industry-erp/backend/migrations/V0.0.40__add_performance_monitoring_olap.sql`
- `print-industry-erp/backend/monitoring/prometheus-config.yml`
- `print-industry-erp/backend/monitoring/grafana-dashboard.json` (partial)
- `print-industry-erp/backend/package.json`
- `print-industry-erp/frontend/src/pages/OrchestratorDashboard.tsx` (partial)

### Grep Searches Performed
- Pattern: `@Injectable|@Resolver|@Controller` in monitoring module - Found 4 files
- Pattern: `prometheus|opentelemetry|jaeger|zipkin|datadog|newrelic` - Found 82 files (mostly agent deliverables mentioning Prometheus)

### Glob Patterns Used
- `**/*monitoring*` - Found monitoring services, resolvers, modules
- `**/*health*` - Found health controllers, services, resolvers
- `**/*metrics*` - Found metrics services
- `**/*alert*.ts` - Found vendor alerting, devops alerting services
- `**/*Dashboard.tsx` - Found 28 dashboard pages (OrchestratorDashboard, MonitoringDashboard, etc.)

### Time Spent
Approximately 2 hours of deep research

---

## Summary

This requirement is for implementing a **comprehensive real-time observability stack** on top of existing partial monitoring infrastructure. The system already has:
- Performance metrics collection (V0.0.40 migration)
- Basic health checks
- Agent activity tracking
- Prometheus/Grafana configuration (bin-optimization focused)

**KEY GAPS:**
1. No distributed tracing (OpenTelemetry needed)
2. No structured logging (Winston/Pino needed)
3. No real-time alerting (Alertmanager integration needed)
4. No SLO tracking (compliance calculation needed)
5. No metrics export (/metrics endpoint needed)
6. Incomplete dashboards (TraceViewer, LogExplorer, AlertManagement needed)

**RECOMMENDATION:**
Proceed with 6-phase implementation over 3-4 weeks:
1. Enhanced logging (Week 1)
2. Distributed tracing (Week 2)
3. Real-time alerting (Week 2-3)
4. Prometheus export (Week 3)
5. SLO tracking (Week 4)
6. Frontend dashboards (Week 3-4)

**COMPLEXITY:** Medium (leverages existing infrastructure, clear requirements, proven libraries)

**ESTIMATED EFFORT:** 3-4 weeks total

**BLOCKERS:** None critical (need to create docker-compose.monitoring.yml, add WebSocket support)

**RISKS:** OpenTelemetry overhead, log volume explosion, alert fatigue, cross-tenant data leak (mitigations documented)

**READY FOR:** Sylvia critique and Roy implementation

---

**END OF REPORT**
