**📍 Navigation Path:** [AGOG Home](../../../../README.md) → [Implementation](../../../README.md) → [Backend](../../README.md) → NATS Architecture

# NATS Jetstream Architecture

**Version:** 1.0.0
**Last Updated:** 2025-12-17
**Layer:** 3 (Orchestration)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AgogSaaS System                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Layer 3: Orchestration                   │    │
│  │                                                             │    │
│  │  ┌──────────────────┐         ┌────────────────────────┐  │    │
│  │  │  Orchestrator    │         │   NATS Jetstream       │  │    │
│  │  │  Service         │◄───────►│   Message Broker       │  │    │
│  │  │                  │         │                        │  │    │
│  │  │ - Spawn agents   │         │  6 Durable Streams:    │  │    │
│  │  │ - Track workflow │         │  - research (Cynthia)  │  │    │
│  │  │ - Coordinate     │         │  - critique (Sylvia)   │  │    │
│  │  └──────────────────┘         │  - backend (Roy)       │  │    │
│  │           │                   │  - frontend (Jen)      │  │    │
│  │           │                   │  - qa (Billy)          │  │    │
│  │           │                   │  - statistics (Priya)  │  │    │
│  │           │                   └────────────────────────┘  │    │
│  │           │                              ▲                │    │
│  │           │                              │                │    │
│  │           ▼                              │                │    │
│  │  ┌──────────────────┐                   │                │    │
│  │  │   Agent Spawner  │                   │                │    │
│  │  │                  │                   │                │    │
│  │  │ Spawns with tiny │                   │                │    │
│  │  │ notices (~200t)  │                   │                │    │
│  │  └──────────────────┘                   │                │    │
│  │           │                              │                │    │
│  └───────────┼──────────────────────────────┼────────────────┘    │
│              │                              │                     │
│              ▼                              │                     │
│         ┌─────────────────────────────────────────┐              │
│         │           AI Agents                      │              │
│         │                                          │              │
│         │  ┌────────┐  ┌────────┐  ┌────────┐   │              │
│         │  │Cynthia │  │Sylvia  │  │  Roy   │   │              │
│         │  │Research│  │Critique│  │Backend │   │              │
│         │  └────────┘  └────────┘  └────────┘   │              │
│         │       │          │           │         │              │
│         │       └──────────┴───────────┘         │              │
│         │                  │                     │              │
│         │                  │ Publish full reports│              │
│         │                  │ Return tiny notices │              │
│         │                  ▼                     │              │
│         │         NATS Deliverable API          │              │
│         └─────────────────────────────────────────┘              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Orchestrator Service

**Purpose:** Coordinate multi-agent workflows

**Responsibilities:**
- Execute feature workflows (Research → Critique → Implementation → QA)
- Spawn agents with minimal context
- Track workflow progress
- Handle errors and retries

**NATS Integration:**
```typescript
class OrchestratorService {
  private natsService: NATSDeliverableService;

  async executeWorkflow(feature: string) {
    // Spawn Cynthia with tiny context
    const cynthiaNotice = await this.spawnCynthia(feature);

    // Spawn Sylvia (she fetches Cynthia's report from NATS)
    const sylviaNotice = await this.spawnSylvia(feature, {
      previousChannel: cynthiaNotice.nats_channel
    });

    // Continue workflow...
  }
}
```

---

### 2. NATS Jetstream Server

**Purpose:** Durable message storage for agent deliverables

**Configuration:**
- **Version:** NATS 2.10+ (latest)
- **Mode:** Jetstream enabled
- **Storage:** File-based (persistent to disk)
- **Max Payload:** 10MB (for large reports)
- **Ports:**
  - 4222: Client connections (external: 4223)
  - 8222: Monitoring HTTP (external: 8223)

**Docker Command:**
```bash
nats-server -js -sd /data -m 8222 --max_payload 10485760
```

---

### 3. Agent Streams

Each agent has a dedicated stream for their deliverables:

```
Stream: agog_features_research (Cynthia)
├── Subject: agog.deliverables.cynthia.>
├── Storage: File (persistent)
├── Retention: Limits (max 10K msgs, 1GB, 7 days)
└── Messages:
    ├── agog.deliverables.cynthia.research.customer-search
    ├── agog.deliverables.cynthia.research.invoice-generator
    └── ...

Stream: agog_features_backend (Roy)
├── Subject: agog.deliverables.roy.>
├── Storage: File (persistent)
├── Retention: Limits (max 10K msgs, 1GB, 7 days)
└── Messages:
    ├── agog.deliverables.roy.backend.customer-search
    ├── agog.deliverables.roy.backend.invoice-generator
    └── ...
```

---

### 4. NATS Client Services

#### Low-Level Client (`NATSClient`)

Direct NATS operations:
- Connect/disconnect
- Initialize streams
- Publish messages
- Subscribe to subjects
- Fetch by sequence or subject

#### High-Level Service (`NATSDeliverableService`)

Agent-friendly operations:
- Publish agent reports
- Fetch previous reports
- Create completion notices
- Monitor stream status

---

## Data Flow

### Publishing Flow (Agent → NATS)

```
┌──────────────┐
│   Cynthia    │
│   (Agent)    │
└──────┬───────┘
       │
       │ 1. Does research
       │    (5,000 tokens)
       ▼
┌──────────────────────────────────────┐
│ NATSDeliverableService.publishReport()│
└──────┬───────────────────────────────┘
       │
       │ 2. Wrap in metadata
       │    { content, agent, timestamp, ... }
       ▼
┌──────────────────────────────────────┐
│ NATSClient.publishDeliverable()      │
└──────┬───────────────────────────────┘
       │
       │ 3. Encode as JSON
       │    StringCodec.encode()
       ▼
┌──────────────────────────────────────┐
│ NATS Jetstream                        │
│   Stream: agog_features_research      │
│   Subject: agog.deliverables.cynthia. │
│            research.customer-search   │
└──────┬───────────────────────────────┘
       │
       │ 4. Persist to disk
       │    /data/jetstream/...
       ▼
┌──────────────────────────────────────┐
│ Return Message ID                     │
│   "agog_features_research.42"         │
└───────────────────────────────────────┘
```

### Fetching Flow (Agent ← NATS)

```
┌──────────────┐
│     Roy      │
│   (Agent)    │
└──────┬───────┘
       │
       │ 1. Needs Cynthia's research
       ▼
┌──────────────────────────────────────┐
│ NATSDeliverableService.fetchReport()  │
│   agent: 'cynthia'                    │
│   taskType: 'research'                │
│   feature: 'customer-search'          │
└──────┬───────────────────────────────┘
       │
       │ 2. Build subject
       │    agog.deliverables.cynthia.research.customer-search
       ▼
┌──────────────────────────────────────┐
│ NATSClient.fetchDeliverable()        │
│   jsm.streams.getMessage()            │
└──────┬───────────────────────────────┘
       │
       │ 3. Query stream for last message
       ▼
┌──────────────────────────────────────┐
│ NATS Jetstream                        │
│   Stream: agog_features_research      │
│   Fetch: last_by_subj                 │
└──────┬───────────────────────────────┘
       │
       │ 4. Decode JSON
       │    StringCodec.decode()
       ▼
┌──────────────────────────────────────┐
│ Return Report                         │
│   {                                   │
│     content: "# Research Report...",  │
│     metadata: { agent, timestamp },   │
│     sequence: 42                      │
│   }                                   │
└───────────────────────────────────────┘
```

---

## Workflow Sequence

### Complete Feature Workflow

```
Time ────────────────────────────────────────────────────►

┌───────────┐  Tiny Notice      ┌──────────┐
│Orchestrator├───────(200t)────►│ Cynthia  │
└───────────┘                   └────┬─────┘
                                     │
                                     │ Research
                                     │ (5,000t)
                                     ▼
                              ┌────────────┐
                              │    NATS    │
                              │  [Research]│
                              └────┬───────┘
                                   │
     ┌─────────────────────────────┘
     │
     │  Fetch Report
     │  (5,000t)
     ▼
┌──────────┐  Publish Critique   ┌────────────┐
│  Sylvia  ├────────────────────►│    NATS    │
└──────────┘      (4,000t)       │ [Critique] │
                                 └────┬───────┘
                                      │
                  ┌───────────────────┘
                  │
                  │  Fetch Both Reports
                  │  (9,000t total)
                  ▼
              ┌────────┐  Publish Backend    ┌────────────┐
              │  Roy   ├────────────────────►│    NATS    │
              └────────┘     (8,000t)        │  [Backend] │
                                             └────┬───────┘
                                                  │
                              ┌───────────────────┘
                              │
                              │  Fetch All Reports
                              │  (17,000t total)
                              ▼
                          ┌──────────┐  Publish Frontend  ┌────────────┐
                          │   Jen    ├───────────────────►│    NATS    │
                          └──────────┘     (6,000t)       │ [Frontend] │
                                                          └────────────┘

Spawning Costs:
  Without NATS: 5,000 + 9,000 + 17,000 = 31,000 tokens
  With NATS:       200 +   200 +    200 =    600 tokens
  Savings: 30,400 tokens (98%)
```

---

## Message Format

### Published Message Structure

```json
{
  "content": "[Full markdown report 5K-15K tokens]",
  "metadata": {
    "agent": "cynthia",
    "taskType": "research",
    "feature": "customer-search",
    "timestamp": "2025-12-17T10:30:00.000Z",
    "files_analyzed": 15,
    "duration_minutes": 12,
    "custom_field": "custom_value"
  }
}
```

### Completion Notice Structure

```json
{
  "status": "complete",
  "agent": "cynthia",
  "task": "customer-search",
  "nats_channel": "agog.deliverables.cynthia.research.customer-search",
  "summary": "Researched customer search patterns and requirements",
  "complexity": "Medium",
  "blockers": "None",
  "ready_for_next_stage": true,
  "completion_time": "2025-12-17T10:30:00.000Z",
  "files_modified": 0,
  "metadata": {
    "custom_field": "custom_value"
  }
}
```

---

## Stream Retention Policy

### Limits-Based Retention

When any limit is reached, oldest messages are discarded:

```
┌─────────────────────────────────────────────┐
│ Stream: agog_features_research              │
│                                             │
│ Limits:                                     │
│   max_msgs: 10,000     ◄── Msg #10,001     │
│   max_bytes: 1GB       ◄── Discard oldest  │
│   max_age: 7 days      ◄── Discard old     │
│                                             │
│ Current:                                    │
│   messages: 1,234                           │
│   bytes: 156 MB                             │
│   oldest_msg_age: 2 days                    │
│                                             │
│ Status: ✅ Within limits                    │
└─────────────────────────────────────────────┘
```

### Message Lifecycle

```
Publish ──► Store ──► Retrieve ──► Age/Count ──► Discard
            (Disk)    (On demand)   (After 7d)    (Auto)
                                    (After 10K)
                                    (After 1GB)
```

---

## Scalability Considerations

### Current Scale (Development)

- **Features per day:** ~10
- **Messages per feature:** ~6 (one per agent)
- **Total messages per day:** ~60
- **Avg message size:** 20KB (10K tokens ≈ 20KB)
- **Daily storage:** ~1.2MB

**Conclusion:** With 1GB per stream, can store ~850 days of messages

### Production Scale

- **Features per day:** ~100
- **Messages per feature:** ~6
- **Total messages per day:** ~600
- **Daily storage:** ~12MB
- **7-day retention:** ~84MB

**Conclusion:** Well within 1GB limit per stream

### Extreme Scale

If hitting limits:
1. Increase max_bytes to 5GB or 10GB
2. Reduce max_age to 3 days or 1 day
3. Archive old messages to S3/object storage
4. Implement message compression

---

## Monitoring & Observability

### NATS Monitoring Dashboard

```
http://localhost:8223

Endpoints:
  /varz      - Server variables
  /connz     - Connections
  /routez    - Routes
  /subsz     - Subscriptions
  /jsz       - JetStream info
  /healthz   - Health check
```

### Programmatic Monitoring

```typescript
// Get all streams
const statuses = await natsService.getStreamStatuses();

// Output:
// [
//   {
//     name: 'agog_features_research',
//     messages: 1234,
//     bytes: 15728640,
//     first_seq: 1,
//     last_seq: 1234,
//     consumer_count: 0
//   },
//   ...
// ]
```

### Key Metrics to Monitor

1. **Message count per stream** - Track deliverable volume
2. **Bytes per stream** - Ensure not hitting 1GB limit
3. **Oldest message age** - Should be < 7 days
4. **Consumer count** - Should be 0 (we use fetch, not subscribe)
5. **Connection status** - Backend should always be connected

---

## Disaster Recovery

### Backup Strategy

NATS data is persisted to `/data` volume in Docker:

```bash
# Create backup
docker exec agogsaas-nats tar czf /backup/nats-$(date +%Y%m%d).tar.gz /data

# Copy to host
docker cp agogsaas-nats:/backup/nats-20251217.tar.gz ./backups/

# Restore
docker cp ./backups/nats-20251217.tar.gz agogsaas-nats:/data/
docker exec agogsaas-nats tar xzf /data/nats-20251217.tar.gz
docker-compose restart nats
```

### Message Recovery

If a message is lost:
1. Messages older than 7 days are gone (by design)
2. Messages within 7 days can be recovered from stream
3. Use `fetchDeliverable()` to retrieve by subject

### Stream Recovery

If a stream is corrupted:
1. Stop NATS: `docker-compose stop nats`
2. Delete stream data: `rm -rf /data/jetstream/[stream_name]`
3. Restart NATS: `docker-compose start nats`
4. Re-run init: `npm run init:nats-streams`

**Note:** Messages will be lost. This is acceptable for agent deliverables (not critical business data).

---

## Security Model

### Development Environment

- **No authentication** - Open access
- **No TLS** - Plaintext communication
- **Network isolation** - Docker network only

### Production Environment (Future)

```yaml
# docker-compose.yml
nats:
  command:
    - "-js"
    - "--user"
    - "${NATS_USER}"
    - "--pass"
    - "${NATS_PASSWORD}"
    - "--tls"
    - "--tlscert=/certs/server-cert.pem"
    - "--tlskey=/certs/server-key.pem"
```

Client connection:
```typescript
const nc = await connect({
  servers: process.env.NATS_URL,
  user: process.env.NATS_USER,
  pass: process.env.NATS_PASSWORD,
  tls: {
    certFile: './certs/client-cert.pem',
    keyFile: './certs/client-key.pem',
  }
});
```

---

## Performance Characteristics

### Publish Performance

- **Small messages (< 1KB):** ~1M msgs/sec
- **Large messages (10KB):** ~100K msgs/sec
- **Agent reports (20KB):** ~50K msgs/sec

For AgogSaaS scale (~600 msgs/day), performance is not a concern.

### Fetch Performance

- **By sequence:** ~1ms (direct lookup)
- **By subject:** ~10ms (index lookup)
- **Network latency:** ~1ms (Docker network)

Total fetch time: ~10-20ms per report

### Storage Performance

- **Write throughput:** 1GB/sec (SSD)
- **Read throughput:** 2GB/sec (SSD)
- **Compression:** Optional (not enabled)

---

## Related Documentation

- [NATS Jetstream Guide](./NATS_JETSTREAM_GUIDE.md) - Complete usage guide
- [NATS Quick Start](../NATS_QUICKSTART.md) - 5-minute setup
- [NATS Module](../src/nats/README.md) - Code documentation
- [AGOG Standards](.claude/agents/AGOG_AGENT_ONBOARDING.md) - Agent patterns

---

[⬆ Back to top](#nats-jetstream-architecture) | [🏠 AGOG Home](../../../../README.md) | [📚 Backend Docs](../README.md)
