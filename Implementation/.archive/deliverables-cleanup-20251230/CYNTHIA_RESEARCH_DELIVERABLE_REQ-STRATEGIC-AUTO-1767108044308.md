# Research Analysis: Real-Time Collaboration & Live Editing for Quotes
**REQ-STRATEGIC-AUTO-1767108044308**

**Agent:** Cynthia (Senior Research Analyst)
**Date:** 2025-12-30
**Status:** ✅ COMPLETE

---

## Executive Summary

This research analyzes the requirements and implementation strategy for adding **Real-Time Collaboration & Live Editing** capabilities to the quote management system. The goal is to enable multiple sales representatives to simultaneously view and edit quotes, with live cursor tracking, presence detection, conflict resolution, and change notifications.

**Key Findings:**
- ✅ Solid quote management foundation exists (quotes, quote_lines, pricing, costing)
- ⚠️ **CRITICAL GAP:** No real-time infrastructure for quote collaboration
- ⚠️ **CRITICAL GAP:** No conflict resolution or optimistic locking
- ⚠️ **CRITICAL GAP:** No change tracking/audit trail at field level
- ✅ NATS messaging infrastructure exists (agent monitoring) - can be leveraged
- ✅ GraphQL foundation exists - needs subscription support

**Recommended Architecture:**
1. **WebSocket Layer:** GraphQL Subscriptions via Apollo Server
2. **Event Streaming:** NATS subjects for quote events (quote.*, presence.*)
3. **Conflict Resolution:** Operational Transformation (OT) or CRDT-based approach
4. **Change Tracking:** Field-level audit trail with diffs
5. **Presence System:** Real-time user activity tracking per quote

---

## 1. Current Quote Management Architecture

### 1.1 Database Schema

#### **quotes Table**
```sql
CREATE TABLE quotes (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    facility_id UUID,

    -- Identification
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    quote_date DATE NOT NULL,
    expiration_date DATE,

    -- Customer
    customer_id UUID NOT NULL,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),

    -- Sales rep
    sales_rep_user_id UUID,

    -- Financials
    quote_currency_code VARCHAR(3) NOT NULL,
    subtotal DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    shipping_amount DECIMAL(18,4) DEFAULT 0,
    discount_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,

    -- Margin tracking
    total_cost DECIMAL(18,4),
    margin_amount DECIMAL(18,4),
    margin_percentage DECIMAL(8,4),

    -- Status workflow
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, ISSUED, ACCEPTED, REJECTED, EXPIRED, CONVERTED_TO_ORDER

    -- Conversion to order
    converted_to_sales_order_id UUID,
    converted_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,
    terms_and_conditions TEXT,

    -- Audit trail (HEADER LEVEL ONLY)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID
);
```

**Indexes:**
- `idx_quotes_tenant` (tenant_id)
- `idx_quotes_customer` (customer_id)
- `idx_quotes_date` (quote_date)
- `idx_quotes_status` (status)
- `idx_quotes_sales_rep` (sales_rep_user_id)

#### **quote_lines Table**
```sql
CREATE TABLE quote_lines (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,

    -- Quote linkage
    quote_id UUID NOT NULL,
    line_number INTEGER NOT NULL,

    -- Product
    product_id UUID NOT NULL,
    product_code VARCHAR(100),
    description TEXT,

    -- Quantity
    quantity DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Pricing
    unit_price DECIMAL(18,4) NOT NULL,
    line_amount DECIMAL(18,4) NOT NULL,
    discount_percentage DECIMAL(8,4),
    discount_amount DECIMAL(18,4),

    -- Costing
    unit_cost DECIMAL(18,4),
    line_cost DECIMAL(18,4),
    line_margin DECIMAL(18,4),
    margin_percentage DECIMAL(8,4),

    -- Manufacturing
    manufacturing_strategy VARCHAR(50),
    lead_time_days INTEGER,
    promised_delivery_date DATE,

    -- Audit trail (TIMESTAMPS ONLY - NO USER TRACKING)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
```

**⚠️ CRITICAL ISSUE:** `quote_lines` does NOT track `updated_by` - only timestamps!

### 1.2 GraphQL API

**Current Operations:**

```graphql
type Mutation {
  # Create new quote with lines
  createQuoteWithLines(input: CreateQuoteInput!): Quote!

  # Line operations
  addQuoteLine(input: AddQuoteLineInput!): QuoteLine!
  updateQuoteLine(input: UpdateQuoteLineInput!): QuoteLine!
  deleteQuoteLine(quoteId: ID!, lineId: ID!): Boolean!

  # Recalculation
  recalculateQuote(quoteId: ID!): Quote!
}

type Query {
  # Preview operations (no mutation)
  previewQuoteLinePricing(input: PreviewQuoteLinePricingInput!): QuoteLinePricingPreview!
  previewProductCost(input: PreviewProductCostInput!): ProductCostPreview!

  # Margin validation
  validateQuoteMargin(quoteId: ID!): MarginValidationResult!
}
```

**⚠️ MISSING:** No subscription support for real-time updates!

### 1.3 Service Layer

**Key Services:**

1. **QuoteManagementService** (`quote-management.service.ts`)
   - CRUD operations for quotes and lines
   - Quote number generation: `QT-YEAR-XXXXXX`
   - Quote total recalculation
   - Margin validation

2. **QuotePricingService** (`quote-pricing.service.ts`)
   - Base price calculation (customer pricing > list price)
   - Pricing rule application
   - Discount calculation
   - Margin calculation

3. **PricingRuleEngineService** (`pricing-rule-engine.service.ts`)
   - Rule evaluation (VOLUME_DISCOUNT, CUSTOMER_TIER, SEASONAL, etc.)
   - Action execution (PERCENTAGE_DISCOUNT, FIXED_PRICE, etc.)
   - Priority-based rule application

4. **QuoteCostingService** (`quote-costing.service.ts`)
   - Material cost calculation
   - Labor cost estimation
   - Overhead allocation

**Transaction Handling:**
- All quote operations wrapped in PostgreSQL transactions
- Quote total recalculation within same transaction as line changes
- **⚠️ NO CONCURRENCY CONTROL:** Last-write-wins scenario

### 1.4 Margin Validation Rules

```typescript
// Hardcoded business rules
MINIMUM_MARGIN_PERCENTAGE = 15;
MANAGER_APPROVAL_THRESHOLD = 20;
VP_APPROVAL_THRESHOLD = 10;

// Approval levels
- Margin >= 15%: ✅ Valid (no approval)
- 10% <= Margin < 20%: ⚠️ Requires SALES_MANAGER approval
- Margin < 10%: 🚫 Requires SALES_VP approval
- Margin < 5%: 🚫 Requires CFO approval (defined but not implemented)
```

**⚠️ ISSUE:** Approval workflow defined in interfaces but NOT enforced in database!

---

## 2. Existing Real-Time Infrastructure Analysis

### 2.1 NATS Messaging (Agent Monitoring Only)

**Current Usage:**
```typescript
// AgentActivityService subscribes to NATS subjects
this.nc.subscribe('agog.deliverables.>');  // Agent deliverables
this.nc.subscribe('agog.workflows.>');      // Workflow updates
```

**NATS Connection:**
```typescript
const nc = await connect({
  servers: process.env.NATS_URL || 'nats://nats:4222',
  user: process.env.NATS_USER,
  pass: process.env.NATS_PASSWORD,
  name: 'monitoring-agent-activity-service'
});
```

**Message Format (JSONCodec):**
```typescript
const jc = JSONCodec();
const data = jc.decode(msg.data) as any;
```

**✅ GOOD NEWS:** NATS infrastructure is already running and functional!

### 2.2 GraphQL PubSub (Monitoring Module Only)

**Current Usage:**
```typescript
// Monitoring dashboard subscriptions
pubsub.publish(SYSTEM_HEALTH_UPDATED, { systemHealthUpdated: healthData });
pubsub.publish(ERROR_CREATED, { errorCreated: errorData });
pubsub.publish(AGENT_ACTIVITY_UPDATED, { agentActivityUpdated: activity });
```

**⚠️ LIMITATION:** Only used for monitoring dashboard, NOT for quote collaboration!

### 2.3 WebSocket Support

**Current Status:**
```typescript
// app.module.ts - GraphQLModule configuration
GraphQLModule.forRootAsync<ApolloDriverConfig>({
  driver: ApolloDriver,
  typePaths: ['./**/*.graphql'],
  playground: process.env.NODE_ENV !== 'production',
  // ⚠️ NO SUBSCRIPTIONS CONFIGURED
});
```

**⚠️ CRITICAL GAP:** No WebSocket server configured for real-time subscriptions!

---

## 3. Critical Gaps for Real-Time Collaboration

### 3.1 Database Schema Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No change history table** | Can't track who changed what field when | 🔴 CRITICAL |
| **Quote lines lack `updated_by`** | Can't attribute line changes to users | 🔴 CRITICAL |
| **No version numbers** | Can't detect conflicts or implement optimistic locking | 🔴 CRITICAL |
| **No lock mechanism** | Multiple users can overwrite each other's changes | 🔴 CRITICAL |
| **No field-level audit trail** | Can't show "User X changed quantity from 100 to 200" | 🟡 HIGH |
| **No user presence tracking** | Can't show who's currently viewing/editing | 🟡 HIGH |

### 3.2 Application Layer Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No WebSocket server** | No real-time communication channel | 🔴 CRITICAL |
| **No GraphQL subscriptions** | Can't push changes to connected clients | 🔴 CRITICAL |
| **No event publishing** | Changes don't trigger notifications | 🔴 CRITICAL |
| **No conflict detection** | Last-write-wins causes data loss | 🔴 CRITICAL |
| **No presence detection** | Can't see who's online or editing | 🟡 HIGH |
| **No cursor tracking** | Can't show where other users are working | 🟡 MEDIUM |
| **No operational transformation** | Concurrent edits cause conflicts | 🟡 HIGH |

### 3.3 API Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No subscription resolvers** | Can't subscribe to quote changes | 🔴 CRITICAL |
| **No batch update operations** | Inefficient for multi-line updates | 🟡 MEDIUM |
| **No change notification API** | Can't notify other users of changes | 🔴 CRITICAL |
| **No presence API** | Can't track active users per quote | 🟡 HIGH |

---

## 4. Industry Best Practices & Patterns

### 4.1 Collaborative Editing Approaches

#### **Option 1: Operational Transformation (OT)**

**How It Works:**
- Transforms concurrent operations so they can be applied in any order
- Used by Google Docs, Firepad

**Pros:**
- ✅ Well-established pattern
- ✅ Strong consistency guarantees
- ✅ Works with centralized server

**Cons:**
- ❌ Complex to implement
- ❌ Requires careful operation transformation logic

**Example:**
```typescript
// User A: Insert "hello" at position 0
// User B: Insert "world" at position 0
// OT transforms B's operation: Insert "world" at position 5
// Result: "helloworld" (consistent)
```

#### **Option 2: Conflict-Free Replicated Data Types (CRDTs)**

**How It Works:**
- Data structures designed to be merged automatically
- Used by Figma, Notion

**Pros:**
- ✅ Automatic conflict resolution
- ✅ Eventually consistent
- ✅ Works offline

**Cons:**
- ❌ Complex data structures
- ❌ Higher memory overhead
- ❌ Not suitable for all data types

#### **Option 3: Last-Write-Wins with Optimistic Locking**

**How It Works:**
- Track version numbers for each entity
- Reject updates if version doesn't match
- Client retries with latest version

**Pros:**
- ✅ Simple to implement
- ✅ Works well for low-concurrency scenarios
- ✅ Clear conflict detection

**Cons:**
- ❌ Requires user to resolve conflicts
- ❌ Poor UX for high-concurrency scenarios

**Example:**
```typescript
// Database
UPDATE quotes
SET total_amount = $1, version = version + 1
WHERE id = $2 AND version = $3
RETURNING *;

// If no rows affected → version mismatch → conflict!
```

### 4.2 Real-Time Architecture Patterns

#### **Pattern 1: GraphQL Subscriptions + PubSub**

```
Client (WebSocket)
    ↓
Apollo Server (GraphQL Subscriptions)
    ↓
PubSub (Redis or NATS)
    ↓
Event Publishers (Services)
```

**Used By:** Apollo, Hasura, AWS AppSync

#### **Pattern 2: WebSocket + Event Sourcing**

```
Client (WebSocket)
    ↓
WebSocket Gateway
    ↓
Event Store (NATS JetStream or Kafka)
    ↓
Event Handlers → Database
```

**Used By:** Figma, Linear, Notion

#### **Pattern 3: Server-Sent Events (SSE)**

```
Client (EventSource)
    ↓
SSE Endpoint
    ↓
Redis PubSub
    ↓
Event Publishers
```

**Used By:** Stripe Dashboard, GitHub Notifications

**⚠️ Limitation:** One-way communication (server → client only)

### 4.3 Presence Detection Patterns

#### **Heartbeat Pattern**
```typescript
// Client sends heartbeat every 10 seconds
setInterval(() => {
  ws.send(JSON.stringify({ type: 'HEARTBEAT', quoteId }));
}, 10000);

// Server marks user offline if no heartbeat for 30 seconds
```

#### **Cursor Position Tracking**
```typescript
// Client broadcasts cursor position on change
onCursorMove(position) {
  ws.send(JSON.stringify({
    type: 'CURSOR_UPDATE',
    quoteId,
    lineId,
    field: 'quantity',
    position
  }));
}
```

#### **User Activity Feed**
```typescript
// Recent changes visible to all users
{
  timestamp: '2025-12-30T10:15:00Z',
  userId: 'user-123',
  userName: 'John Smith',
  action: 'UPDATED_QUANTITY',
  quoteId: 'quote-456',
  lineNumber: 3,
  oldValue: 100,
  newValue: 200
}
```

---

## 5. Recommended Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  - Apollo Client (GraphQL + WebSocket)                       │
│  - Optimistic UI updates                                     │
│  - Cursor position tracking                                  │
│  - Presence indicators                                       │
└───────────────────┬─────────────────────────────────────────┘
                    │ GraphQL + WebSocket
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              Apollo Server (GraphQL Gateway)                 │
│  - HTTP (Queries + Mutations)                                │
│  - WebSocket (Subscriptions)                                 │
│  - Authentication middleware                                 │
└─────┬───────────────────────────────────────────┬───────────┘
      │                                           │
      ↓                                           ↓
┌──────────────────────┐          ┌─────────────────────────┐
│  Quote Resolvers     │          │   NATS Message Broker   │
│  - Queries           │          │   - quote.*             │
│  - Mutations         │  Pub     │   - presence.*          │
│  - Subscriptions  ───┼──────────→   - activity.*          │
└──────┬───────────────┘          └───────────┬─────────────┘
       │                                       │ Sub
       ↓                                       ↓
┌──────────────────────┐          ┌─────────────────────────┐
│ QuoteManagement      │          │ Quote Event Listeners   │
│ Service              │          │ - Broadcast to WS       │
│  - CRUD              │  Events  │ - Update presence       │
│  - Validation     ───┼──────────→ - Publish activity      │
│  - Calculations      │          └─────────────────────────┘
└──────┬───────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│               PostgreSQL Database                         │
│  - quotes (with version numbers)                          │
│  - quote_lines (with updated_by)                          │
│  - quote_changes (field-level audit trail)                │
│  - quote_locks (optimistic locking)                       │
│  - active_quote_sessions (presence tracking)              │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Database Schema Extensions

#### **New Table: quote_changes (Field-Level Audit Trail)**

```sql
CREATE TABLE quote_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Change tracking
    quote_id UUID NOT NULL,
    quote_line_id UUID,  -- NULL for header changes

    -- User tracking
    changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Field tracking
    entity_type VARCHAR(20) NOT NULL,  -- QUOTE or QUOTE_LINE
    field_name VARCHAR(50) NOT NULL,

    -- Value tracking (JSONB for flexible types)
    old_value JSONB,
    new_value JSONB,

    -- Change metadata
    change_type VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    session_id UUID,  -- Track which editing session

    -- Conflict tracking
    was_conflict BOOLEAN DEFAULT FALSE,
    conflict_resolution VARCHAR(50),  -- ACCEPTED, REJECTED, MERGED

    CONSTRAINT fk_quote_change_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quote_change_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_quote_change_line FOREIGN KEY (quote_line_id) REFERENCES quote_lines(id),
    CONSTRAINT fk_quote_change_user FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX idx_quote_changes_quote ON quote_changes(quote_id, changed_at DESC);
CREATE INDEX idx_quote_changes_line ON quote_changes(quote_line_id, changed_at DESC);
CREATE INDEX idx_quote_changes_user ON quote_changes(changed_by);
CREATE INDEX idx_quote_changes_session ON quote_changes(session_id);
```

#### **New Table: active_quote_sessions (Presence Tracking)**

```sql
CREATE TABLE active_quote_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Session tracking
    session_id UUID NOT NULL UNIQUE,
    quote_id UUID NOT NULL,

    -- User tracking
    user_id UUID NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),

    -- Activity tracking
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Cursor tracking
    current_line_id UUID,
    current_field VARCHAR(50),
    cursor_position INTEGER,

    -- Status
    is_editing BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'VIEWING',  -- VIEWING, EDITING, IDLE

    CONSTRAINT fk_quote_session_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quote_session_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_quote_session_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_quote_sessions_quote ON active_quote_sessions(quote_id);
CREATE INDEX idx_quote_sessions_user ON active_quote_sessions(user_id);
CREATE INDEX idx_quote_sessions_heartbeat ON active_quote_sessions(last_heartbeat);

-- Auto-cleanup stale sessions (no heartbeat in 30 seconds)
CREATE INDEX idx_quote_sessions_stale ON active_quote_sessions(last_heartbeat)
WHERE last_heartbeat < NOW() - INTERVAL '30 seconds';
```

#### **Schema Modifications: Add Version Control**

```sql
-- Add version column to quotes
ALTER TABLE quotes ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_quotes_version ON quotes(id, version);

-- Add updated_by to quote_lines (MISSING!)
ALTER TABLE quote_lines ADD COLUMN updated_by UUID;
ALTER TABLE quote_lines ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_quote_lines_version ON quote_lines(id, version);

-- Add foreign key for updated_by
ALTER TABLE quote_lines
ADD CONSTRAINT fk_quote_line_updated_by
FOREIGN KEY (updated_by) REFERENCES users(id);
```

### 5.3 NATS Event Subjects

```typescript
// Quote change events
'quote.created.{tenantId}.{quoteId}'
'quote.updated.{tenantId}.{quoteId}'
'quote.deleted.{tenantId}.{quoteId}'
'quote.status_changed.{tenantId}.{quoteId}'

// Quote line events
'quote.line.added.{tenantId}.{quoteId}.{lineId}'
'quote.line.updated.{tenantId}.{quoteId}.{lineId}'
'quote.line.deleted.{tenantId}.{quoteId}.{lineId}'

// Presence events
'presence.joined.{tenantId}.{quoteId}.{userId}'
'presence.left.{tenantId}.{quoteId}.{userId}'
'presence.heartbeat.{tenantId}.{quoteId}.{userId}'
'presence.cursor_moved.{tenantId}.{quoteId}.{userId}'

// Activity feed events
'activity.quote.{tenantId}.{quoteId}'
```

**Event Payload Example:**
```typescript
{
  eventId: 'evt-123',
  timestamp: '2025-12-30T10:15:00Z',
  tenantId: 'tenant-456',
  quoteId: 'quote-789',
  userId: 'user-abc',
  userName: 'John Smith',
  eventType: 'QUOTE_LINE_UPDATED',
  data: {
    lineId: 'line-def',
    lineNumber: 3,
    changes: [
      {
        field: 'quantity',
        oldValue: 100,
        newValue: 200
      }
    ],
    version: 5  // For optimistic locking
  }
}
```

### 5.4 GraphQL Subscription Schema

```graphql
type Subscription {
  # Subscribe to all changes on a quote
  quoteChanged(quoteId: ID!): QuoteChangeEvent!

  # Subscribe to quote line changes
  quoteLineChanged(quoteId: ID!): QuoteLineChangeEvent!

  # Subscribe to presence updates
  quotePresenceUpdated(quoteId: ID!): QuotePresenceUpdate!

  # Subscribe to activity feed
  quoteActivityFeed(quoteId: ID!): QuoteActivityEvent!
}

type QuoteChangeEvent {
  eventId: ID!
  timestamp: DateTime!
  quoteId: ID!
  userId: ID!
  userName: String!
  changeType: QuoteChangeType!
  changes: [FieldChange!]!
  version: Int!
}

enum QuoteChangeType {
  HEADER_UPDATED
  STATUS_CHANGED
  NOTES_UPDATED
  RECALCULATED
}

type QuoteLineChangeEvent {
  eventId: ID!
  timestamp: DateTime!
  quoteId: ID!
  lineId: ID!
  lineNumber: Int!
  userId: ID!
  userName: String!
  changeType: LineChangeType!
  changes: [FieldChange!]!
  version: Int!
}

enum LineChangeType {
  LINE_ADDED
  LINE_UPDATED
  LINE_DELETED
}

type FieldChange {
  field: String!
  oldValue: JSON
  newValue: JSON
}

type QuotePresenceUpdate {
  quoteId: ID!
  activeUsers: [ActiveUser!]!
}

type ActiveUser {
  userId: ID!
  userName: String!
  userEmail: String!
  status: UserStatus!
  currentLine: Int
  currentField: String
  cursorPosition: Int
  lastSeen: DateTime!
}

enum UserStatus {
  VIEWING
  EDITING
  IDLE
}

type QuoteActivityEvent {
  eventId: ID!
  timestamp: DateTime!
  userId: ID!
  userName: String!
  action: String!
  description: String!
  metadata: JSON
}
```

### 5.5 Optimistic Locking Implementation

```typescript
// In QuoteManagementService
async updateQuoteLine(input: UpdateQuoteLineInput): Promise<QuoteLine> {
  const { lineId, version, changes } = input;

  return await this.dbPool.query(async (client) => {
    // Check version (optimistic locking)
    const currentLine = await client.query(
      `SELECT * FROM quote_lines WHERE id = $1 AND tenant_id = $2`,
      [lineId, this.tenantId]
    );

    if (!currentLine.rows[0]) {
      throw new Error('Quote line not found');
    }

    if (currentLine.rows[0].version !== version) {
      throw new ConflictError(
        `Quote line has been modified by another user.
         Expected version ${version}, found ${currentLine.rows[0].version}`
      );
    }

    // Update with version increment
    const result = await client.query(
      `UPDATE quote_lines
       SET quantity = $1,
           unit_price = $2,
           version = version + 1,
           updated_at = NOW(),
           updated_by = $3
       WHERE id = $4 AND version = $5
       RETURNING *`,
      [changes.quantity, changes.unitPrice, this.userId, lineId, version]
    );

    if (result.rows.length === 0) {
      throw new ConflictError('Concurrent modification detected');
    }

    // Record change in audit trail
    await this.recordChange({
      quoteId: currentLine.rows[0].quote_id,
      lineId,
      changedBy: this.userId,
      changes: [
        {
          field: 'quantity',
          oldValue: currentLine.rows[0].quantity,
          newValue: changes.quantity
        }
      ]
    });

    // Publish NATS event
    await this.publishLineUpdated(result.rows[0]);

    return result.rows[0];
  });
}
```

### 5.6 WebSocket Subscription Flow

```typescript
// Client-side subscription
const { data, loading, error } = useSubscription(
  gql`
    subscription OnQuoteChanged($quoteId: ID!) {
      quoteChanged(quoteId: $quoteId) {
        eventId
        timestamp
        userId
        userName
        changeType
        changes {
          field
          oldValue
          newValue
        }
        version
      }
    }
  `,
  { variables: { quoteId: 'quote-789' } }
);

// Server-side resolver
Subscription: {
  quoteChanged: {
    subscribe: withFilter(
      () => pubSub.asyncIterator('QUOTE_CHANGED'),
      (payload, variables) => {
        return payload.quoteChanged.quoteId === variables.quoteId;
      }
    ),
  },
}
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Database Schema:**
- [ ] Add `version` column to `quotes` table
- [ ] Add `updated_by` and `version` to `quote_lines` table
- [ ] Create `quote_changes` audit trail table
- [ ] Create `active_quote_sessions` presence table
- [ ] Migration script: `V0.0.XX__add_quote_collaboration_tables.sql`

**Backend Infrastructure:**
- [ ] Configure Apollo Server for WebSocket subscriptions
- [ ] Set up NATS subjects for quote events
- [ ] Implement event publishing service
- [ ] Add optimistic locking to quote mutations

**Testing:**
- [ ] Unit tests for version checking
- [ ] Integration tests for conflict detection
- [ ] Load tests for concurrent updates

### Phase 2: Real-Time Events (Weeks 3-4)

**GraphQL Subscriptions:**
- [ ] `quoteChanged` subscription resolver
- [ ] `quoteLineChanged` subscription resolver
- [ ] `quotePresenceUpdated` subscription resolver
- [ ] Event filtering by tenant + quote ID

**Service Layer:**
- [ ] QuoteEventService (publish events)
- [ ] PresenceService (track active users)
- [ ] ChangeTrackingService (record audit trail)

**NATS Integration:**
- [ ] Publish quote.* events on all mutations
- [ ] Publish presence.* events on join/leave/heartbeat
- [ ] Subscribe to events in GraphQL subscription resolvers

**Testing:**
- [ ] WebSocket connection tests
- [ ] Event publishing tests
- [ ] Subscription filtering tests

### Phase 3: Presence & Cursors (Week 5)

**Presence Tracking:**
- [ ] Join/leave session endpoints
- [ ] Heartbeat mechanism (10s interval)
- [ ] Automatic cleanup of stale sessions (30s timeout)
- [ ] Active user list query

**Cursor Tracking:**
- [ ] Cursor position update mutation
- [ ] Cursor position subscription
- [ ] Field-level locking indicators

**Testing:**
- [ ] Presence tracking tests
- [ ] Heartbeat timeout tests
- [ ] Cursor position sync tests

### Phase 4: Frontend Integration (Weeks 6-7)

**React Components:**
- [ ] `<ActiveUsers>` presence indicator
- [ ] `<RemoteCursor>` overlay component
- [ ] `<ActivityFeed>` sidebar
- [ ] `<ConflictResolutionModal>` dialog

**Apollo Client:**
- [ ] WebSocket link configuration
- [ ] Subscription hooks
- [ ] Optimistic UI updates
- [ ] Cache updates on subscription events

**UX Features:**
- [ ] Visual indicators for who's editing what
- [ ] Cursor position highlights
- [ ] Activity feed notifications
- [ ] Conflict resolution UI

**Testing:**
- [ ] E2E tests for multi-user scenarios
- [ ] Conflict resolution flow tests
- [ ] Performance tests (10+ concurrent users)

### Phase 5: Advanced Features (Week 8+)

**Operational Transformation:**
- [ ] OT algorithm for text fields (notes, description)
- [ ] Operation serialization/deserialization
- [ ] Conflict-free merging

**Change History:**
- [ ] "View change history" UI
- [ ] Diff visualization
- [ ] Revert to previous version

**Notifications:**
- [ ] Email notifications for quote updates
- [ ] In-app notification system
- [ ] Configurable notification preferences

---

## 7. Technical Considerations

### 7.1 Scalability

**Challenges:**
- WebSocket connections consume server resources
- NATS message volume increases with user count
- Database audit trail can grow large

**Solutions:**
- **Horizontal Scaling:** Multiple Apollo Server instances behind load balancer
- **Redis Adapter:** Share subscriptions across instances
- **NATS Clustering:** Distribute message load
- **Audit Trail Archival:** Move old changes to cold storage (6+ months)

**Capacity Planning:**
```
Assumptions:
- 100 concurrent users
- 20 quotes actively being edited
- 5 users per quote (average)

Resources:
- WebSocket connections: 100
- NATS subscriptions: ~100 (per server)
- Database connections: 50 (pooled)
- Memory: ~2GB per server instance
```

### 7.2 Security

**Considerations:**
- Tenant isolation (RLS) applies to all subscriptions
- Users can only subscribe to quotes in their tenant
- Audit trail records ALL changes (compliance)
- Sensitive data (pricing) requires authorization

**Implementation:**
```typescript
// Subscription resolver with tenant check
subscribe: withFilter(
  () => pubSub.asyncIterator('QUOTE_CHANGED'),
  async (payload, variables, context) => {
    // Verify user has access to this quote
    const quote = await getQuote(variables.quoteId);

    if (quote.tenantId !== context.tenantId) {
      throw new ForbiddenError('Access denied');
    }

    return payload.quoteChanged.quoteId === variables.quoteId;
  }
)
```

### 7.3 Performance

**Optimization Strategies:**
- **Debouncing:** Batch rapid changes (e.g., typing) before publishing
- **Delta Updates:** Send only changed fields, not entire object
- **Compression:** Use WebSocket compression (permessage-deflate)
- **Caching:** Cache active user lists, reduce DB queries

**Monitoring:**
- WebSocket connection count
- Message publish rate (events/second)
- Subscription latency (time from mutation to client update)
- NATS queue depth

### 7.4 Error Handling

**Scenarios:**
- **Conflict:** Version mismatch → Show conflict resolution UI
- **Network Disruption:** Reconnect WebSocket → Resync state
- **Stale Data:** User offline for 5+ minutes → Force refresh
- **Simultaneous Deletes:** Line deleted by another user → Show notification

**Recovery Strategies:**
```typescript
// Apollo Client retry logic
const wsLink = new WebSocketLink({
  uri: 'ws://localhost:4000/graphql',
  options: {
    reconnect: true,
    reconnectionAttempts: 5,
    connectionParams: async () => ({
      authToken: await getAuthToken()
    })
  }
});

// Optimistic response with rollback on error
mutate({
  optimisticResponse: {
    updateQuoteLine: { ...optimisticData }
  },
  onError: (error) => {
    if (error.message.includes('Concurrent modification')) {
      // Fetch latest and show conflict UI
      refetch();
      showConflictModal();
    }
  }
});
```

---

## 8. Alternative Approaches

### 8.1 Polling (Simple but Inefficient)

**How It Works:**
```typescript
// Client polls every 5 seconds
setInterval(() => {
  refetch(); // Re-fetch quote data
}, 5000);
```

**Pros:**
- ✅ Simple to implement
- ✅ No WebSocket complexity
- ✅ Works with any HTTP load balancer

**Cons:**
- ❌ High server load (unnecessary requests)
- ❌ Delayed updates (5s latency)
- ❌ No real-time feel
- ❌ Wastes bandwidth

**Verdict:** ❌ Not recommended for collaborative editing

### 8.2 Server-Sent Events (SSE) (One-Way Only)

**How It Works:**
```typescript
const eventSource = new EventSource('/api/quotes/quote-789/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update UI
};
```

**Pros:**
- ✅ Simpler than WebSocket
- ✅ Built into HTTP
- ✅ Auto-reconnect

**Cons:**
- ❌ One-way only (server → client)
- ❌ Still need HTTP POST for mutations
- ❌ Less efficient than WebSocket

**Verdict:** ⚠️ Consider if WebSocket is not feasible

### 8.3 Firebase Realtime Database (Third-Party)

**How It Works:**
```typescript
const quoteRef = firebase.database().ref(`quotes/${quoteId}`);
quoteRef.on('value', (snapshot) => {
  const data = snapshot.val();
  // Update UI
});
```

**Pros:**
- ✅ Fully managed real-time infrastructure
- ✅ Built-in presence
- ✅ Offline support

**Cons:**
- ❌ Third-party dependency
- ❌ Additional cost
- ❌ Data duplication (Firebase + PostgreSQL)
- ❌ Complex sync logic

**Verdict:** ❌ Not recommended (adds complexity)

---

## 9. Success Metrics

### 9.1 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Subscription Latency** | < 100ms | Time from mutation to client update |
| **WebSocket Uptime** | > 99.9% | Connection stability |
| **Concurrent Users** | 100+ | Max users per quote without degradation |
| **Conflict Rate** | < 1% | Percentage of updates causing conflicts |
| **Message Throughput** | 1000+ events/sec | NATS message processing rate |

### 9.2 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Quote Turnaround Time** | -20% | Time from creation to customer approval |
| **Collaboration Events** | Tracked | Number of multi-user editing sessions |
| **Error Reduction** | -30% | Fewer pricing/quantity errors due to real-time validation |
| **User Satisfaction** | > 4.5/5 | Survey rating for collaboration features |

### 9.3 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to See Changes** | < 1 second | User-perceived latency |
| **Conflict Resolution Time** | < 30 seconds | Average time to resolve conflicts |
| **Feature Adoption** | > 70% | Percentage of users using collaboration |

---

## 10. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **High WebSocket connection overhead** | 🔴 High | 🟡 Medium | Implement connection pooling, horizontal scaling |
| **NATS message queue backlog** | 🔴 High | 🟢 Low | Monitor queue depth, add consumers |
| **Database audit trail growth** | 🟡 Medium | 🔴 High | Archive old changes, partition table |
| **Complex conflict resolution UX** | 🟡 Medium | 🟡 Medium | User testing, iterative improvements |
| **WebSocket compatibility issues** | 🟢 Low | 🟢 Low | Fallback to polling for unsupported browsers |
| **Real-time sync bugs** | 🔴 High | 🟡 Medium | Extensive testing, gradual rollout |

---

## 11. Dependencies & Prerequisites

### 11.1 Technical Dependencies

**Required:**
- ✅ NATS server (already running)
- ✅ PostgreSQL 14+ (already deployed)
- ✅ Apollo Server 4+ (already configured)
- ⚠️ WebSocket support in Apollo Server (needs configuration)
- ⚠️ Redis adapter for GraphQL subscriptions (if horizontal scaling)

**Optional:**
- Firebase Cloud Messaging (for push notifications)
- Sentry (for error tracking)
- DataDog (for performance monitoring)

### 11.2 Team Skills

**Required:**
- Backend: NestJS, GraphQL subscriptions, NATS
- Frontend: React, Apollo Client, WebSocket
- Database: PostgreSQL, migrations, indexing

**Training Needed:**
- Operational Transformation (OT) algorithms
- Conflict resolution UX patterns
- WebSocket security best practices

### 11.3 Infrastructure

**Production Requirements:**
- Load balancer with WebSocket support (sticky sessions or Redis adapter)
- NATS cluster (for high availability)
- Monitoring: Prometheus + Grafana (already configured)
- Logging: Centralized logging (Loki or CloudWatch)

---

## 12. Recommendations

### 12.1 Immediate Actions (Week 1)

1. **Database Schema Updates**
   - ✅ Add `version` columns to `quotes` and `quote_lines`
   - ✅ Add `updated_by` to `quote_lines`
   - ✅ Create `quote_changes` audit trail table
   - ✅ Create `active_quote_sessions` presence table

2. **Backend Configuration**
   - ✅ Enable WebSocket in Apollo Server
   - ✅ Configure NATS subjects for quote events
   - ✅ Implement optimistic locking in mutations

3. **Proof of Concept**
   - ✅ Simple subscription test (quote header changes)
   - ✅ Verify NATS event publishing
   - ✅ Test conflict detection logic

### 12.2 Phased Rollout Strategy

**Phase 1 (Beta):**
- Enable for 10% of users
- Monitor performance and bugs
- Gather feedback

**Phase 2 (Expansion):**
- Enable for 50% of users
- Optimize based on metrics
- Add advanced features

**Phase 3 (General Availability):**
- Enable for all users
- Full documentation and training
- Ongoing monitoring and improvements

### 12.3 Alternative: Simplified Approach (If Timeline is Tight)

If full real-time collaboration is too complex initially, consider:

1. **Version 1.0: Change Notifications Only**
   - No live cursor tracking
   - No presence detection
   - Just notify users: "Quote was updated by John Smith"
   - Requires manual refresh

2. **Version 1.5: Optimistic Locking**
   - Add version checking
   - Show conflict modal on save
   - No real-time updates, but prevents data loss

3. **Version 2.0: Full Collaboration**
   - WebSocket subscriptions
   - Live updates
   - Presence indicators
   - Full feature set

---

## 13. References & Resources

### 13.1 Documentation

- [Apollo GraphQL Subscriptions](https://www.apollographql.com/docs/apollo-server/data/subscriptions/)
- [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream)
- [Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [CRDTs Explained](https://crdt.tech/)

### 13.2 Example Implementations

- [Google Docs OT Algorithm](https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs.html)
- [Figma Multiplayer Architecture](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [Linear Real-Time Sync](https://linear.app/blog/scaling-the-linear-sync-engine)

### 13.3 Libraries & Tools

- [@apollo/server](https://www.npmjs.com/package/@apollo/server) - GraphQL server
- [graphql-subscriptions](https://www.npmjs.com/package/graphql-subscriptions) - PubSub for subscriptions
- [nats](https://www.npmjs.com/package/nats) - NATS client
- [ot.js](https://github.com/Operational-Transformation/ot.js) - OT library
- [yjs](https://github.com/yjs/yjs) - CRDT library

---

## 14. Conclusion

Implementing real-time collaboration for quote editing is a **complex but achievable** enhancement that will significantly improve the user experience and reduce errors.

**Key Takeaways:**

1. **Foundation is Solid:** The existing quote management system is well-architected and can support real-time features with the right additions.

2. **NATS Infrastructure Exists:** Leveraging the existing NATS setup reduces implementation complexity.

3. **Database Schema Needs Enhancements:** Adding version control, audit trails, and presence tracking is critical.

4. **Recommended Approach:** GraphQL Subscriptions + NATS + Optimistic Locking provides the best balance of features and complexity.

5. **Phased Rollout:** Start with basic conflict detection and notifications, then add full real-time features iteratively.

**Next Steps:**
1. Roy (Backend): Implement database schema changes and optimistic locking
2. Jen (Frontend): Set up Apollo Client WebSocket link and subscription hooks
3. Billy (QA): Design test scenarios for concurrent editing
4. Berry (DevOps): Configure WebSocket load balancing and monitoring

---

**Research Completed:** 2025-12-30
**Deliverable Path:** `nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767108044308`

**Status:** ✅ COMPLETE
