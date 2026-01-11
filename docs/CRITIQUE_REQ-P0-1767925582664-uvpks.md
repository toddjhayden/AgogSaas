# AUDIT CRITIQUE: Equipment IoT Integration & Real-Time Production Telemetry
**REQ-1767925582664-uvpks**
**Priority: P0 - CATASTROPHIC (Audit Blocker)**
**Date:** 2026-01-10
**Auditor:** Sylvia (Senior Auditor)
**Research Agent:** Cynthia
**Implementation Agent:** Marcus (IoT/Hardware Integration Specialist)

---

## EXECUTIVE SUMMARY

**AUDIT STATUS: ⛔ BLOCKED - CRITICAL COMPILATION FAILURES**

Cynthia's research (CYNTHIA_RESEARCH_REQ-1767925582664-uvpks.md) claimed "WebSocket infrastructure is production-ready" but **THE CODEBASE FAILS TO COMPILE**. This is a **CATASTROPHIC VIOLATION** of Agentic Workflow Rule #2: "Never Downgrade Errors to Warnings".

### Critical Findings

1. ✅ **Database Schema: VERIFIED COMPLETE** - IoT devices, sensor readings, equipment events tables exist
2. ✅ **Business Logic: VERIFIED COMPLETE** - Equipment health scoring, predictive alerts implemented
3. ✅ **GraphQL Queries/Mutations: VERIFIED COMPLETE** - All CRUD operations implemented
4. ⛔ **WebSocket Infrastructure: CLAIMED READY BUT MISSING** - `./common/websocket` module DOES NOT EXIST
5. ⛔ **GraphQL Subscriptions: NOT IMPLEMENTED** - No `@Subscription()` decorators found
6. ⛔ **IoT Protocol Handlers: NOT IMPLEMENTED** - MQTT, OPC-UA, Modbus clients missing

### Compilation Errors (P0 Blockers)

```typescript
src/app.module.ts:26:41 - error TS2307: Cannot find module './common/websocket' or its corresponding type declarations.
import { WebSocketSecurityModule } from './common/websocket';

src/app.module.ts:34:8 - error TS2307: Cannot find module './common/websocket' or its corresponding type declarations.
} from './common/websocket';
```

**Impact:** Backend CANNOT START. All features requiring WebSocket infrastructure are BLOCKED.

---

## MANDATORY CONDITIONS BEFORE IMPLEMENTATION

Marcus **MUST NOT BEGIN IMPLEMENTATION** until these P0 blockers are resolved:

### Condition 1: Fix Compilation Errors (P0 - IMMEDIATE)

**Required Actions:**
1. Create missing `./common/websocket` module structure:
   ```
   backend/src/common/websocket/
   ├── index.ts                              (exports)
   ├── websocket-security.module.ts          (NestJS module)
   ├── services/
   │   ├── websocket-auth.service.ts         (JWT validation, session mgmt)
   │   ├── websocket-rate-limiter.service.ts (connection/subscription limits)
   │   ├── websocket-monitor.service.ts      (event logging, metrics)
   │   ├── websocket-origin-validator.service.ts (CORS protection)
   │   └── websocket-subscription-guard.service.ts (per-subscription auth)
   └── types/
       └── websocket-context.types.ts        (TypeScript interfaces)
   ```

2. Implement 5 missing WebSocket security services referenced in `app.module.ts:29-34`
3. Verify compilation succeeds: `npm run build` MUST complete without errors
4. Verify application starts: `npm run start:dev` MUST complete without crashes

**Acceptance Criteria:**
- ✅ Backend compiles with NO TypeScript errors
- ✅ Backend starts successfully
- ✅ WebSocket connection can be established (even if subscriptions not yet implemented)
- ✅ JWT authentication on WebSocket connect works
- ✅ Origin validation (CORS) works
- ✅ Rate limiting enforced

**Estimated Time:** 1-2 days (based on REQ-1767183219586 scope referenced in code comments)

---

### Condition 2: Implement GraphQL Subscription PubSub Infrastructure (P1 - HIGH)

**Required Actions:**
1. Create Redis PubSub wrapper service (dependencies already installed: `ioredis ^5.4.1`, `graphql-subscriptions ^3.0.0`)
2. Register PubSub provider in `PredictiveMaintenanceModule`
3. Verify Redis connection works (fail-fast if Redis unavailable per Workflow Rule #1)

**Implementation:**
```typescript
// backend/src/common/pubsub/redis-pubsub.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private pubSub: RedisPubSub;

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.pubSub = new RedisPubSub({
      publisher: new Redis(redisUrl),
      subscriber: new Redis(redisUrl),
    });

    // CRITICAL: Test connection - MUST EXIT if Redis unavailable (Workflow Rule #1)
    try {
      await this.pubSub.publish('HEALTH_CHECK', { timestamp: new Date() });
    } catch (error) {
      console.error('CRITICAL: Redis PubSub connection failed:', error);
      process.exit(1); // MANDATORY EXIT (no graceful degradation)
    }
  }

  async onModuleDestroy() {
    await this.pubSub.close();
  }

  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
    return this.pubSub.asyncIterator(triggers);
  }

  async publish(trigger: string, payload: any): Promise<void> {
    await this.pubSub.publish(trigger, payload);
  }
}
```

**Acceptance Criteria:**
- ✅ Redis PubSub service compiles
- ✅ Service fails fast if Redis unavailable (NOT graceful degradation)
- ✅ Service registered in module providers
- ✅ Can publish and subscribe to test messages

**Estimated Time:** 0.5 days

---

### Condition 3: Implement GraphQL Subscription Resolvers (P1 - HIGH)

**Required Actions:**
1. Add `@Subscription()` decorators to `predictive-maintenance.resolver.ts`
2. Implement 5 critical subscriptions:
   - `equipmentHealthScoreUpdated(workCenterId: ID!)`
   - `equipmentHealthStatusChanged(facilityId: ID!)`
   - `equipmentAnomalyDetected(facilityId: ID!)`
   - `predictiveMaintenanceAlertCreated(facilityId: ID!)`
   - `criticalAlertTriggered(tenantId: ID!)`
3. Modify mutation resolvers to publish events to PubSub
4. Implement tenant isolation in subscription filters

**Critical Pattern (MUST FOLLOW):**
```typescript
@Resolver()
export class PredictiveMaintenanceResolver {
  constructor(
    private readonly healthScoreService: EquipmentHealthScoreService,
    private readonly pubSub: RedisPubSubService,
  ) {}

  @Mutation()
  async calculateEquipmentHealthScore(
    @Args('workCenterId') workCenterId: string,
    @Context() context: any,
  ): Promise<any> {
    const tenantId = context.tenantId;
    const healthScore = await this.healthScoreService.calculateHealthScore(...);

    // PUBLISH EVENT (critical for real-time updates)
    await this.pubSub.publish('HEALTH_SCORE_UPDATED', {
      equipmentHealthScoreUpdated: healthScore,
    });

    return healthScore;
  }

  @Subscription(() => EquipmentHealthScore, {
    // CRITICAL: Tenant isolation filter (MUST implement)
    filter: (payload, variables, context) => {
      // Verify tenant isolation
      if (payload.equipmentHealthScoreUpdated.tenantId !== context.tenantId) {
        return false; // Prevent cross-tenant leakage
      }
      // Verify work center match
      if (variables.workCenterId &&
          payload.equipmentHealthScoreUpdated.workCenterId !== variables.workCenterId) {
        return false;
      }
      return true;
    },
  })
  equipmentHealthScoreUpdated(
    @Args('workCenterId') workCenterId: string,
    @Context() context: WebSocketSubscriptionContext,
  ) {
    return this.pubSub.asyncIterator('HEALTH_SCORE_UPDATED');
  }
}
```

**Acceptance Criteria:**
- ✅ All 5 subscriptions compile and resolve without errors
- ✅ Tenant isolation filters prevent cross-tenant data leakage
- ✅ Mutation resolvers publish events to PubSub
- ✅ WebSocket clients can subscribe and receive updates
- ✅ Subscription filters respect work center / facility scope

**Estimated Time:** 2-3 days

---

### Condition 4: Update GraphQL Schema (P1 - HIGH)

**Required Actions:**
1. Add `Subscription` type to `predictive-maintenance.graphql`
2. Define all subscription signatures
3. Verify schema generation succeeds

**Implementation:**
```graphql
# predictive-maintenance.graphql

extend type Subscription {
  # Equipment Health Subscriptions
  equipmentHealthScoreUpdated(workCenterId: ID!): EquipmentHealthScore!
  equipmentHealthStatusChanged(facilityId: ID!): EquipmentHealthStatusChange!
  equipmentAnomalyDetected(facilityId: ID!): EquipmentAnomaly!

  # Predictive Maintenance Alert Subscriptions
  predictiveMaintenanceAlertCreated(facilityId: ID!): PredictiveMaintenanceAlert!
  criticalAlertTriggered(tenantId: ID!): PredictiveMaintenanceAlert!

  # Sensor Reading Subscriptions (Real-Time Telemetry)
  sensorReadingUpdated(iotDeviceId: ID!): SensorReading!
  equipmentEventTriggered(workCenterId: ID!): EquipmentEvent!
}

# Additional type for status changes
type EquipmentHealthStatusChange {
  workCenterId: ID!
  previousStatus: HealthStatus!
  currentStatus: HealthStatus!
  changeTimestamp: DateTime!
}

type EquipmentAnomaly {
  workCenterId: ID!
  anomalyType: String!
  severity: Severity!
  detectedAt: DateTime!
  sensorReadings: [SensorReading!]!
}

type SensorReading {
  id: ID!
  iotDeviceId: ID!
  readingTimestamp: DateTime!
  sensorType: String!
  readingValue: Float!
  unitOfMeasure: String!
}

type EquipmentEvent {
  id: ID!
  workCenterId: ID!
  eventTimestamp: DateTime!
  eventType: String!
  severity: Severity!
  eventDescription: String!
}
```

**Acceptance Criteria:**
- ✅ Schema compiles without errors
- ✅ GraphQL Playground shows subscription operations
- ✅ Subscription introspection works

**Estimated Time:** 0.5 days

---

### Condition 5: MQTT Integration (P2 - MEDIUM) - OPTIONAL FOR MVP

**Required Actions:**
1. Create `MqttModule` with `MqttSubscriberService`
2. Install dependencies: `npm install mqtt @types/mqtt`
3. Configure environment variables: `MQTT_BROKER_URL`, `MQTT_TOPICS`
4. Implement sensor reading ingestion pipeline
5. Publish sensor readings to GraphQL subscribers

**Critical Implementation Notes:**
- MQTT broker connection MUST fail-fast if unavailable (Workflow Rule #1)
- Use QoS 0 (fire-and-forget) for non-critical data
- Batch database inserts (buffer 100 readings, flush every 1 second)
- Validate data quality before storing (range checks)

**Acceptance Criteria:**
- ✅ MQTT client connects to broker
- ✅ Service fails fast if broker unavailable (NO graceful degradation)
- ✅ Sensor readings stored to `sensor_readings` table
- ✅ GraphQL subscribers receive sensor updates
- ✅ Heartbeat monitoring updates `iot_devices.last_heartbeat`

**Estimated Time:** 3-4 days

---

### Condition 6: Comprehensive Testing (P1 - MANDATORY)

**Required Test Coverage:**

1. **Unit Tests (Backend)**
   - GraphQL subscription resolvers (event publishing)
   - PubSub message filtering (tenant isolation)
   - WebSocket authentication service
   - MQTT message parsing

2. **Integration Tests (Backend)**
   - WebSocket connection lifecycle (connect, auth, disconnect)
   - Subscription message delivery (end-to-end)
   - MQTT to database pipeline (if MQTT implemented)
   - Redis PubSub failover behavior

3. **Performance Tests (Backend)**
   - 1000 concurrent WebSocket connections
   - 1000 messages/second throughput
   - Subscription filtering performance (tenant isolation overhead)

4. **Security Tests (Backend)**
   - Reject WebSocket connections without JWT
   - Prevent cross-tenant subscription leakage
   - Origin validation (CORS) enforcement
   - Rate limiting enforcement

**Acceptance Criteria:**
- ✅ Unit test coverage ≥ 80%
- ✅ All integration tests pass
- ✅ Performance tests meet targets (1000 concurrent connections, <500ms latency)
- ✅ Security tests pass (no cross-tenant leakage)

**Estimated Time:** 3-4 days

---

## VERIFIED EXISTING IMPLEMENTATION (Cynthia's Research ACCURATE)

### ✅ Database Schema - V0.0.7 Migration (VERIFIED)

**Confirmed Tables:**
- `iot_devices` - Multi-protocol support (MQTT, REST_API, OPC_UA, MODBUS)
- `sensor_readings` - Time-series optimized with indexes
- `equipment_events` - Severity-based alerts (INFO, WARNING, ERROR, CRITICAL)

**Partitioning:** Monthly partitions on `sensor_readings` for time-series optimization

**Indexes:** 9 indexes across 3 tables for query performance

---

### ✅ Business Logic - Equipment Health Scoring (VERIFIED)

**Confirmed Implementation:**
- `EquipmentHealthScoreService` - 5-dimensional health scoring algorithm
- `PredictiveAlertService` - Alert generation from health scores
- `ModelManagementService` - ML model CRUD (training stub)
- `MaintenanceRecommendationService` - Maintenance recommendations

**Health Score Algorithm (5 Weighted Dimensions):**
1. Sensor Health Score (30% weight) - Temperature, vibration, pressure
2. OEE Health Score (25% weight) - 7-day historical OEE average
3. Quality Health Score (20% weight) - SPC out-of-control alerts
4. Reliability Health Score (15% weight) - Equipment breakdown frequency
5. Performance Health Score (10% weight) - Cycle time degradation

**Trend Analysis:**
- 7-day/30-day averages
- Trend direction (IMPROVING, STABLE, DEGRADING, RAPIDLY_DEGRADING)

---

### ✅ GraphQL Queries & Mutations (VERIFIED)

**Confirmed Queries (13 total):**
- `equipmentHealthScores()` - Filter by status, work center, date range
- `equipmentHealthScore(id)` - Single score by ID
- `latestEquipmentHealthScore(workCenterId)` - Latest score for work center
- `predictiveMaintenanceAlerts()` - Filter by status, severity, urgency
- `predictiveMaintenanceAlert(id)` - Single alert by ID
- `predictiveMaintenanceModels()` - ML model listing
- `predictiveMaintenanceModel(id)` - Single model by ID
- `maintenanceRecommendations()` - Filter by type, approval, status
- `maintenanceRecommendation(id)` - Single recommendation by ID
- `predictiveMaintenanceDashboard()` - Summary dashboard
- `equipmentHealthTrends()` - Hourly/daily/weekly/monthly trends
- `failurePredictionAccuracy()` - Model accuracy metrics (stub)

**Confirmed Mutations (12 total):**
- `calculateEquipmentHealthScore(workCenterId)` - Trigger calculation
- `acknowledgePredictiveMaintenanceAlert(alertId, notes)` - Workflow action
- `schedulePredictiveMaintenanceAlert(alertId, input)` - Schedule maintenance
- `resolvePredictiveMaintenanceAlert(alertId, ...)` - Resolve alert
- `createPredictiveMaintenanceModel(input)` - Model creation
- `updatePredictiveMaintenanceModel(id, input)` - Model update
- `deployPredictiveMaintenanceModel(id, environment)` - Model deployment
- `retrainPredictiveMaintenanceModel(id, ...)` - Model retraining (stub)
- `createMaintenanceRecommendation(input)` - Recommendation creation
- `approveMaintenanceRecommendation(id, notes)` - Approval workflow
- `rejectMaintenanceRecommendation(id, reason)` - Rejection workflow
- `implementMaintenanceRecommendation(id, startDate)` - Implementation tracking
- `validateMaintenanceRecommendation(id, ...)` - Results validation

---

## CORRECTED IMPLEMENTATION GAPS (Cynthia's Overstatement)

### ❌ WebSocket Infrastructure: CLAIMED READY BUT MISSING

**Cynthia's Claim:** "WebSocket infrastructure is production-ready and secure"

**AUDIT FINDING:** **FALSE** - Code references `./common/websocket` module but **MODULE DOES NOT EXIST**

**Evidence:**
```bash
$ cd backend/src/common && ls -la | grep websocket
# NO OUTPUT - directory does not exist

$ npm run build 2>&1 | grep websocket
src/app.module.ts:26:41 - error TS2307: Cannot find module './common/websocket'
src/app.module.ts:34:8 - error TS2307: Cannot find module './common/websocket'
```

**Impact:** P0 blocker - backend CANNOT compile or start

---

### ❌ GraphQL Subscriptions: SCHEMA DEFINED BUT NOT IMPLEMENTED

**Cynthia's Claim:** "Schema defined but resolver implementations missing"

**AUDIT FINDING:** **ACCURATE** - GraphQL schema exists, but NO `@Subscription()` decorators found in resolvers

**Evidence:**
```bash
$ grep -r "@Subscription()" backend/src/graphql/resolvers/
# NO FILES FOUND

$ grep -n "extend type Subscription" backend/src/graphql/schema/predictive-maintenance.graphql
# NO OUTPUT - Subscription type NOT DEFINED in schema
```

**Correction:** Subscription schema also needs to be ADDED (not just resolvers)

---

### ❌ IoT Protocol Handlers: NOT IMPLEMENTED

**Cynthia's Claim:** "Database schema supports multi-protocol configuration, but NO actual protocol handlers exist"

**AUDIT FINDING:** **ACCURATE** - No MQTT, OPC-UA, or Modbus client implementations found

**Evidence:**
```bash
$ find backend/src -name "*mqtt*" -o -name "*opcua*" -o -name "*modbus*"
# NO FILES FOUND
```

---

## RISK ANALYSIS & MITIGATION

### Risk 1: WebSocket Connection Stability (HIGH)

**Risk:** WebSocket connections drop frequently in production (firewalls, load balancers, NAT timeouts)

**Mitigation (IMPLEMENTED IN app.module.ts):**
- ✅ Heartbeat/ping-pong mechanism (graphql-ws default)
- ✅ Frontend auto-reconnect with exponential backoff (configured in frontend/src/graphql/client.ts)
- ⚠️ Load balancer sticky sessions (DEPLOYMENT REQUIREMENT - document in runbook)
- ⚠️ Timeout configuration (NEEDS ENVIRONMENT VARIABLE)

**Action Items for Marcus:**
1. Add `WEBSOCKET_TIMEOUT_MS` environment variable (default: 60000)
2. Document load balancer sticky session requirement in deployment guide
3. Test connection drop/reconnect handling

---

### Risk 2: Subscription Performance at Scale (MEDIUM)

**Risk:** 1000s of concurrent subscriptions (dashboards, mobile apps) overload server

**Mitigation (PARTIALLY IMPLEMENTED):**
- ✅ Redis PubSub for horizontal scaling (dependency installed)
- ❌ Subscription throttling (NOT IMPLEMENTED - needs rate limiting per subscription)
- ❌ Batch updates (NOT IMPLEMENTED - needs debouncing)

**Action Items for Marcus:**
1. Implement per-subscription rate limiting (max 10 updates/second)
2. Implement batch update debouncing (coalesce events within 1-second window)
3. Monitor WebSocket connection count per tenant
4. Implement circuit breaker for PubSub failures

---

### Risk 3: MQTT Broker Overload (MEDIUM)

**Risk:** High-frequency sensor data (100+ readings/second) saturates broker

**Mitigation (RECOMMENDED BY CYNTHIA):**
- Use QoS 0 (fire-and-forget) for non-critical data
- Batch database inserts (buffer 100 readings, flush every 1 second)
- Downsample high-frequency data (keep max/min/avg per minute)
- Consider Kafka for extreme scale (>10K messages/sec)

**Action Items for Marcus:**
1. Configure MQTT QoS level in device connection config
2. Implement buffered batch inserts in `MqttSubscriberService`
3. Add downsampling configuration per sensor type
4. Monitor MQTT message throughput and database write latency

---

### Risk 4: Database Write Throughput (MEDIUM)

**Risk:** 1000s of sensor readings/second exceed PostgreSQL write capacity

**Mitigation (PARTIALLY IMPLEMENTED):**
- ✅ Connection pooling (configured in database.module.ts)
- ✅ Partitioned tables (monthly partitions on sensor_readings)
- ❌ Batch inserts via `UNNEST()` or `COPY FROM` (NOT IMPLEMENTED)

**Action Items for Marcus:**
1. Implement batch insert using PostgreSQL `UNNEST()` for 100+ row inserts
2. Monitor database write throughput (rows/second)
3. Monitor partition creation (auto-create monthly partitions)
4. Consider TimescaleDB if write throughput exceeds 10K rows/second

---

### Risk 5: Time-Series Data Growth (LOW - LONG-TERM)

**Risk:** Sensor data grows to TBs, slowing queries and increasing storage cost

**Mitigation (RECOMMENDED BY CYNTHIA):**
- Implement data retention policy (keep raw data for 90 days)
- Create aggregated tables (hourly/daily rollups)
- Archive old data to S3 (Parquet format)
- Use continuous aggregates (TimescaleDB) or materialized views

**Action Items for Marcus:**
1. Document data retention policy in system documentation
2. Create migration for materialized view: `sensor_readings_hourly_summary`
3. Schedule monthly archive job (export to S3, delete from database)
4. Monitor table growth and query performance degradation

---

## TECHNOLOGY STACK VALIDATION

### ✅ CONFIRMED: Dependencies Already Installed

```json
{
  "graphql-subscriptions": "^3.0.0",  // PubSub abstraction
  "ioredis": "^5.4.1",                 // Redis client for PubSub
  "@apollo/server": "^4.x",            // Apollo Server v4 with WebSocket support
  "graphql-ws": "^5.x"                 // GraphQL subscriptions over WebSocket
}
```

### ⚠️ REQUIRED: Additional Dependencies for MQTT (if implementing Phase 2)

```bash
npm install mqtt @types/mqtt
```

### ⚠️ OPTIONAL: Additional Dependencies for OPC-UA (if implementing Phase 4)

```bash
npm install node-opcua
```

### ⚠️ OPTIONAL: Additional Dependencies for Modbus (if implementing Phase 4)

```bash
npm install jsmodbus
```

---

## TESTING REQUIREMENTS (COMPLIANCE CRITICAL)

### Unit Test Requirements (Backend)

**Test Files to Create:**
1. `backend/src/common/pubsub/__tests__/redis-pubsub.service.spec.ts`
2. `backend/src/graphql/resolvers/__tests__/predictive-maintenance.resolver.subscriptions.spec.ts`
3. `backend/src/common/websocket/__tests__/websocket-auth.service.spec.ts`
4. `backend/src/common/websocket/__tests__/websocket-rate-limiter.service.spec.ts`
5. `backend/src/modules/mqtt/__tests__/mqtt-subscriber.service.spec.ts` (if MQTT implemented)

**Coverage Target:** ≥ 80% per service

**Critical Test Cases:**
- GraphQL subscription resolver publishes event on mutation
- PubSub message filtering respects tenant isolation
- WebSocket JWT validation rejects invalid tokens
- WebSocket rate limiter enforces connection limits
- MQTT message parser handles malformed payloads

---

### Integration Test Requirements (Backend)

**Test Files to Create:**
1. `backend/src/__tests__/integration/websocket-subscriptions.integration.spec.ts`
2. `backend/src/__tests__/integration/mqtt-pipeline.integration.spec.ts` (if MQTT implemented)

**Critical Test Cases:**
1. **WebSocket Connection Lifecycle**
   - Connect with valid JWT → success
   - Connect without JWT → rejection
   - Connect with invalid JWT → rejection
   - Connection rate limit → rejection after threshold
   - Origin validation → reject non-whitelisted origins

2. **Subscription Message Delivery**
   - Subscribe to `equipmentHealthScoreUpdated` → receive updates on mutation
   - Subscribe with invalid work center ID → no messages received
   - Subscribe to cross-tenant data → filtered out (security)
   - Multiple subscribers → all receive message (broadcast)
   - Subscriber disconnects → no error on publish

3. **MQTT to Database Pipeline** (if implemented)
   - Publish MQTT message → stored in `sensor_readings` table
   - Publish malformed message → logged error, no database insert
   - Publish high-frequency data → batch insert (100 rows at once)
   - MQTT broker disconnect → service exits (fail-fast, no graceful degradation)

---

### Performance Test Requirements (Backend)

**Test Scenarios:**
1. **Concurrent WebSocket Connections**
   - Target: 1000 concurrent connections per backend instance
   - Acceptance: <500ms connection establishment time, <1% connection failures

2. **Subscription Message Throughput**
   - Target: 1000 messages/second broadcast to 1000 subscribers
   - Acceptance: <1 second delivery latency (95th percentile)

3. **MQTT Message Ingestion** (if implemented)
   - Target: 1000 MQTT messages/second → database inserts
   - Acceptance: <100ms insert latency (95th percentile)

4. **Subscription Filtering Performance**
   - Target: Tenant isolation filter overhead <5ms per subscription
   - Acceptance: No cross-tenant data leakage in 10,000 message test

---

### Security Test Requirements (Backend)

**Test Scenarios:**
1. **WebSocket Authentication**
   - ✅ Valid JWT → connection accepted
   - ✅ Missing JWT → connection rejected (401)
   - ✅ Expired JWT → connection rejected (401)
   - ✅ Tampered JWT → connection rejected (401)
   - ✅ JWT for different tenant → connection rejected (403)

2. **Subscription Authorization**
   - ✅ Subscribe to own tenant data → messages received
   - ✅ Subscribe to other tenant data → messages filtered out (security)
   - ✅ Subscribe without tenant context → rejection (400)

3. **Origin Validation (CORS)**
   - ✅ Connection from whitelisted origin → accepted
   - ✅ Connection from non-whitelisted origin → rejected

4. **Rate Limiting**
   - ✅ Connection rate limit (10 connections/minute per user) → enforced
   - ✅ Subscription rate limit (100 subscriptions per connection) → enforced
   - ✅ Message rate limit (10 messages/second per subscription) → enforced

---

## DEPLOYMENT REQUIREMENTS

### Environment Variables (Backend)

**CRITICAL - MUST BE CONFIGURED:**

```env
# Redis PubSub Configuration
REDIS_URL=redis://localhost:6379
REDIS_PUBSUB_MAX_RETRIES=3
REDIS_PUBSUB_RETRY_DELAY_MS=1000

# WebSocket Configuration
WEBSOCKET_TIMEOUT_MS=60000
WEBSOCKET_ALLOWED_ORIGINS=http://localhost:3000,https://app.agogsaas.com
WEBSOCKET_MAX_CONNECTIONS_PER_USER=10
WEBSOCKET_MAX_SUBSCRIPTIONS_PER_CONNECTION=100
WEBSOCKET_MAX_MESSAGES_PER_SECOND=10

# MQTT Configuration (if implementing Phase 2)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=backend-service
MQTT_PASSWORD=<secure-password>
MQTT_TOPICS=facility/+/workcenter/+/sensor/+
MQTT_QOS=0

# Equipment Thresholds (for event generation)
SENSOR_TEMPERATURE_MIN=60
SENSOR_TEMPERATURE_MAX=75
SENSOR_VIBRATION_MAX=2.5
SENSOR_PRESSURE_MIN=80
SENSOR_PRESSURE_MAX=120
```

---

### Infrastructure Requirements

**MUST BE DEPLOYED BEFORE BACKEND START:**

1. **Redis Server** (for PubSub)
   ```bash
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

2. **MQTT Broker** (if implementing Phase 2)
   ```bash
   docker run -d --name mosquitto -p 1883:1883 eclipse-mosquitto
   ```

3. **Load Balancer Configuration** (for WebSocket sticky sessions)
   - Enable sticky sessions based on WebSocket session ID
   - Configure session timeout = `WEBSOCKET_TIMEOUT_MS + 10000` (10 second buffer)

---

### Monitoring & Alerting Requirements

**MUST BE CONFIGURED:**

1. **Grafana Dashboards**
   - WebSocket connection count (per tenant)
   - Subscription count (per tenant, per type)
   - MQTT message throughput (messages/second)
   - Database write throughput (rows/second)
   - Sensor reading latency (MQTT publish → database insert)
   - Alert generation rate (alerts/hour)
   - Health score calculation duration (ms)

2. **PagerDuty/Email Alerts**
   - CRITICAL: Equipment health score < 30 (CRITICAL status)
   - HIGH: MQTT broker connection lost
   - HIGH: Redis PubSub connection lost
   - MEDIUM: Health score calculation failure
   - LOW: Sensor heartbeat timeout (>5 minutes)

---

## CORRECTED IMPLEMENTATION TIMELINE

### Phase 1: Fix Compilation Errors & WebSocket Infrastructure (P0 - IMMEDIATE)

**Duration:** 1-2 days
**Owner:** Marcus

**Tasks:**
1. Create `./common/websocket` module structure
2. Implement 5 missing WebSocket security services
3. Verify backend compiles and starts
4. Test WebSocket connection authentication

**Acceptance:** Backend compiles, starts, WebSocket connections work

---

### Phase 2: GraphQL Subscription Infrastructure (P1 - HIGH)

**Duration:** 0.5 days
**Owner:** Marcus

**Tasks:**
1. Create Redis PubSub service
2. Register in `PredictiveMaintenanceModule`
3. Verify Redis connection works (fail-fast if unavailable)

**Acceptance:** Redis PubSub service works, fail-fast on Redis unavailable

---

### Phase 3: GraphQL Subscription Resolvers (P1 - HIGH)

**Duration:** 2-3 days
**Owner:** Marcus

**Tasks:**
1. Add `Subscription` type to GraphQL schema
2. Implement 5 subscription resolvers with tenant isolation filters
3. Modify mutation resolvers to publish events
4. Test end-to-end subscription delivery

**Acceptance:** All subscriptions work, tenant isolation enforced

---

### Phase 4: Testing & Documentation (P1 - MANDATORY)

**Duration:** 3-4 days
**Owner:** Marcus

**Tasks:**
1. Write unit tests (≥80% coverage)
2. Write integration tests (WebSocket, subscriptions)
3. Write performance tests (1000 concurrent connections)
4. Write security tests (cross-tenant leakage prevention)
5. Document deployment requirements
6. Document monitoring dashboards

**Acceptance:** All tests pass, documentation complete

---

### Phase 5: MQTT Integration (P2 - OPTIONAL FOR MVP)

**Duration:** 3-4 days
**Owner:** Marcus

**Tasks:**
1. Create `MqttModule` with `MqttSubscriberService`
2. Configure MQTT broker connection (fail-fast if unavailable)
3. Implement sensor reading ingestion pipeline
4. Implement batch database inserts
5. Test MQTT to database pipeline

**Acceptance:** MQTT messages stored in database, GraphQL subscribers receive updates

---

### Phase 6: OPC-UA Integration (P3 - OPTIONAL)

**Duration:** 4-5 days
**Owner:** Marcus

**Tasks:**
1. Create `OpcUaModule` with `OpcUaClientService`
2. Configure OPC-UA server connection
3. Implement node subscription setup
4. Test data ingestion

**Acceptance:** OPC-UA data stored in database

---

## MANDATORY AUDIT CONDITIONS (MUST PASS BEFORE DEPLOYMENT)

### Condition 1: Backend Compiles Without Errors ⛔

**Current Status:** FAILED
**Required:** `npm run build` completes with 0 errors
**Blocker:** `./common/websocket` module missing

---

### Condition 2: Backend Starts Without Crashes ⛔

**Current Status:** FAILED (cannot start due to compilation errors)
**Required:** `npm run start:dev` starts successfully
**Blocker:** Compilation errors

---

### Condition 3: WebSocket Connections Work ⛔

**Current Status:** NOT TESTED (blocked by Condition 1)
**Required:** WebSocket client can connect with valid JWT
**Blocker:** WebSocket security services not implemented

---

### Condition 4: GraphQL Subscriptions Work ⛔

**Current Status:** NOT IMPLEMENTED
**Required:** Subscription resolvers work end-to-end
**Blocker:** Subscription resolvers not implemented

---

### Condition 5: Tenant Isolation Enforced ⛔

**Current Status:** NOT TESTED
**Required:** Cross-tenant subscription attempts filtered out
**Blocker:** Subscription filters not implemented

---

### Condition 6: Test Coverage ≥ 80% ⛔

**Current Status:** 0% (no tests written)
**Required:** Unit tests cover ≥80% of new code
**Blocker:** No tests written

---

### Condition 7: Performance Targets Met ⛔

**Current Status:** NOT TESTED
**Required:** 1000 concurrent connections, <500ms latency
**Blocker:** Performance tests not written

---

### Condition 8: Security Tests Pass ⛔

**Current Status:** NOT TESTED
**Required:** No cross-tenant data leakage in 10,000 message test
**Blocker:** Security tests not written

---

## FINAL AUDIT VERDICT

**STATUS:** ⛔ **BLOCKED - CATASTROPHIC COMPILATION FAILURES**

**RECOMMENDATION:** Marcus **MUST NOT BEGIN IMPLEMENTATION** until:

1. ✅ Cynthia's research is corrected (WebSocket infrastructure NOT production-ready)
2. ✅ Missing `./common/websocket` module is created (P0 blocker)
3. ✅ Backend compiles without errors (P0 blocker)
4. ✅ Backend starts without crashes (P0 blocker)

**ESTIMATED TOTAL TIME TO PRODUCTION-READY:**
- Phase 1 (Fix compilation): 1-2 days
- Phase 2 (PubSub infrastructure): 0.5 days
- Phase 3 (Subscription resolvers): 2-3 days
- Phase 4 (Testing & documentation): 3-4 days
- **TOTAL:** 7-9.5 days (WITHOUT MQTT/OPC-UA)

---

## AGENTIC WORKFLOW RULE COMPLIANCE

### ✅ Rule 1: No Graceful Error Handling

**Compliance:** Services MUST EXIT if dependencies unavailable (Redis, MQTT broker)

**Implementation Pattern:**
```typescript
try {
  await this.redisClient.connect();
} catch (error) {
  console.error('CRITICAL: Redis connection failed:', error);
  process.exit(1); // MANDATORY EXIT
}
```

---

### ⛔ Rule 2: Never Downgrade Errors to Warnings (VIOLATED)

**Violation:** Cynthia's research claimed WebSocket infrastructure "production-ready" despite **CRITICAL COMPILATION ERRORS**

**Evidence:**
```
src/app.module.ts:26:41 - error TS2307: Cannot find module './common/websocket'
```

**Corrective Action:** This critique document identifies the violation and blocks implementation until fixed

---

### ✅ Rule 3: Catastrophic Priority Takes Precedence

**Compliance:** This REQ is marked P0 (Catastrophic) due to compilation errors blocking all work

---

### ✅ Rule 4: Workflow Must Be Recoverable

**Compliance:** If Redis or MQTT broker fails, services MUST exit (not degrade gracefully), triggering process supervisor restart

---

### ✅ Rule 5: All Work Must Be Tracked

**Compliance:** This REQ is tracked in SDLC system with deliverable handoff to Marcus

---

## SIGN-OFF

**Auditor:** Sylvia (Senior Auditor)
**Date:** 2026-01-10
**Deliverable:** nats://agog.deliverables.sylvia.critique.REQ-1767925582664-uvpks
**Next Agent:** Marcus (IoT/Hardware Integration Specialist)

**CRITICAL INSTRUCTION TO MARCUS:**

Do NOT begin implementation until:
1. You acknowledge receipt of this critique
2. You confirm understanding of all P0 blockers
3. You create a task breakdown for fixing compilation errors FIRST
4. You receive approval from Orchestrator to proceed

**END OF AUDIT CRITIQUE**
