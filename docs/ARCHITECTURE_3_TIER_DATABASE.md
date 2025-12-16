# 3-Tier Database Architecture: Edge → Regional → Global

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → 3-Tier Database Architecture

**Date:** 2025-12-10
**Critical Insight:** Offline manufacturing capability requires LOCAL databases at edge

---

## The Reality: Manufacturing Can't Stop When Internet Goes Out

### Customer Requirement
> "Our production floor must keep running even if the internet is down. We can't stop printing orders because of a network issue."

### The Solution: 3-Tier Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: EDGE (Per Facility - Operational Database)            │
│  "Day-to-day work happens here - OFFLINE CAPABLE"              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Foo LA Facility (On-Premises)                                 │
│  ├─ Edge Computer (Docker on local hardware)                   │
│  │   ├─ PostgreSQL (LOCAL operational database)                │
│  │   │   ├─ Orders (current production runs)                   │
│  │   │   ├─ Inventory (local stock levels)                     │
│  │   │   ├─ Production logs (real-time data)                   │
│  │   │   └─ Equipment status (from sensors)                    │
│  │   │                                                          │
│  │   ├─ Application Server (GraphQL API)                       │
│  │   │   └─ Workers connect here (http://10.0.1.50:4000)       │
│  │   │                                                          │
│  │   ├─ Replication Agent                                      │
│  │   │   └─ Syncs to US-EAST Cloud (when internet available)   │
│  │   │                                                          │
│  │   └─ Equipment Agent                                        │
│  │       └─ Collects from printers, IoT sensors                │
│  │                                                              │
│  └─ When Internet DOWN:                                        │
│      ✅ Workers access local API (http://10.0.1.50:4000)        │
│      ✅ Orders entered into local PostgreSQL                    │
│      ✅ Production continues                                    │
│      ✅ Data buffers locally                                    │
│      ✅ Syncs to cloud when internet returns                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Near Real-Time Replication ↓
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: REGIONAL CLOUD (Per Region - Aggregated Database)     │
│  "Regional operations, compliance, regional reporting"          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  US-EAST Region (AWS/Azure)                                    │
│  ├─ Blue Environment                                           │
│  │   ├─ PostgreSQL Cluster (Regional aggregation)              │
│  │   │   ├─ Aggregated from: Foo LA, Bar NY, Baz Boston       │
│  │   │   ├─ Historical data (last 90 days hot)                 │
│  │   │   └─ Used for regional reporting                        │
│  │   │                                                          │
│  │   └─ Application Servers (Kubernetes)                       │
│  │       └─ Remote workers connect here (https://us.agog.io)   │
│  │                                                              │
│  └─ Green Environment                                          │
│      └─ (For blue-green deployments)                           │
│                                                                 │
│  EU-CENTRAL Region (AWS/Azure) - GDPR Compliant               │
│  ├─ Blue Environment                                           │
│  │   ├─ PostgreSQL Cluster (Regional aggregation)              │
│  │   │   ├─ Aggregated from: Foo Frankfurt, Bar London         │
│  │   │   ├─ Must stay in EU (data sovereignty)                 │
│  │   │   └─ Used for regional reporting                        │
│  │   │                                                          │
│  │   └─ Application Servers                                    │
│  │       └─ EU workers connect here (https://eu.agog.io)       │
│  │                                                              │
│  └─ Green Environment                                          │
│                                                                 │
│  APAC Region (AWS/Azure) - Data Sovereignty                   │
│  ├─ Blue Environment                                           │
│  │   ├─ PostgreSQL Cluster (Regional aggregation)              │
│  │   │   ├─ Aggregated from: Foo Shanghai, Bar Singapore       │
│  │   │   ├─ Must stay in APAC (data sovereignty)               │
│  │   │   └─ Used for regional reporting                        │
│  │   │                                                          │
│  │   └─ Application Servers                                    │
│  │       └─ APAC workers connect here (https://apac.agog.io)   │
│  │                                                              │
│  └─ Green Environment                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Aggregated/Anonymized Data ↓
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: GLOBAL ANALYTICS (Cross-Region - Executive Database)  │
│  "For traveling executives, board members, global KPIs"         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Global Analytics Database (Likely US-EAST)                    │
│  ├─ Aggregated data from all regions                           │
│  │   ├─ Summary data only (not raw transactions)               │
│  │   ├─ KPIs, trends, forecasts                                │
│  │   └─ Respects data sovereignty (anonymized)                 │
│  │                                                              │
│  ├─ GraphQL Federation Gateway                                 │
│  │   ├─ Routes executive queries to correct regions            │
│  │   ├─ Aggregates cross-region results                        │
│  │   └─ Caches global dashboards                               │
│  │                                                              │
│  └─ Access                                                      │
│      ├─ CEO (traveling): https://global.agog.io                │
│      ├─ CFO (traveling): https://global.agog.io                │
│      └─ Board members: https://global.agog.io                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Patterns

### Pattern 1: Local Worker Entering Order (Normal Internet)

```
Worker (LA Facility) → Enters order
  ↓
Edge Computer (10.0.1.50:4000)
  ↓
Edge PostgreSQL (INSERT order immediately)
  ↓
Replication Agent → Near real-time sync to US-EAST Cloud
  ↓
US-EAST PostgreSQL (receives order within 1-5 seconds)
  ↓
Global Analytics (receives aggregated summary hourly)
```

### Pattern 2: Local Worker Entering Order (Internet DOWN!)

```
Worker (LA Facility) → Enters order
  ↓
Edge Computer (10.0.1.50:4000)
  ↓
Edge PostgreSQL (INSERT order immediately) ✅ WORKS OFFLINE!
  ↓
Replication Agent → BUFFERED (waiting for internet)
  ↓
... 2 hours later, internet returns ...
  ↓
Replication Agent → Syncs buffered orders to US-EAST Cloud
  ↓
US-EAST PostgreSQL (receives all buffered orders)
```

### Pattern 3: Remote Worker (Philippines) Accessing LA Facility

```
Worker (Philippines) → Needs to check LA orders
  ↓
Load Balancer → Routes to US-EAST Cloud (not LA edge)
  ↓
US-EAST PostgreSQL → Returns LA orders (replicated data)
  ↓
Response to Philippines (~200ms latency)
```

**Why not access LA edge directly?**
- Edge is behind firewall (not exposed to internet)
- Regional cloud is secure, scalable endpoint
- Acceptable latency for remote workers

### Pattern 4: CEO in London Needs Global Dashboard

```
CEO (London) → Opens executive dashboard
  ↓
https://global.agog.io
  ↓
GraphQL Federation Gateway:
  ├─ Query US-EAST for US facilities KPIs
  ├─ Query EU-CENTRAL for EU facilities KPIs
  └─ Query APAC for APAC facilities KPIs
  ↓
Aggregate results → Global dashboard
  ↓
Response to CEO (~500ms for all regions)
```

---

## Blue-Green Deployment with 3-Tier Architecture

### Tier 1 (Edge): Blue-Green Connection Strategy

**Edge agents MUST support dual connection (Question 3: Option B):**

```
Foo LA Edge Computer:
├─ Primary Connection: Blue Environment (https://us-blue.agog.io)
├─ Secondary Connection: Green Environment (https://us-green.agog.io)
│
During Deployment:
├─ Blue receives production data (active)
├─ Green receives copy of data (validation)
│
After Cutover:
├─ Switch: Green becomes primary
├─ Blue becomes secondary (for rollback)
│
If Rollback Needed:
└─ Switch back: Blue becomes primary
```

**Why dual connection?**
- ✅ Zero data loss (both Blue and Green receive all edge data)
- ✅ No disconnection during cutover
- ✅ Rollback doesn't lose edge transactions
- ✅ Backward compatibility (Blue-Green DB supports old/new schema for 1 cycle)

### Tier 2 (Regional Cloud): Blue-Green Database Replication

```
US-EAST Region During Deployment:

Blue Environment (v1.2.0 - Currently Live):
├─ PostgreSQL Blue (v1.2.0 schema)
├─ Receives edge data from LA, NY, Boston facilities
└─ Serves remote workers

Green Environment (v1.3.0 - Deploying):
├─ PostgreSQL Green (v1.3.0 schema)
├─ Also receives edge data from LA, NY, Boston facilities (dual write)
├─ Bidirectional replication with Blue
│   └─ Green → Blue (so Blue can rollback with zero data loss)
└─ Validation testing

After 24-48 hours stable:
├─ Green becomes live
├─ Blue updated to v1.3.0 (becomes standby for next release)
└─ Stop dual write from edge (edge only writes to new live)
```

### Tier 3 (Global Analytics): Unaffected by Blue-Green

```
Global Analytics Database:
└─ Receives aggregated data from whichever environment is LIVE
    ├─ Blue live → Analytics reads from Blue
    ├─ Green live → Analytics reads from Green
    └─ Switch happens automatically (follows DNS/routing)
```

---

## Deployment Rollout Strategy (Question 4: Option A)

### Sequential Regional Rollout

```
Sunday 6 PM EST (12 AM Monday CET, 8 AM Monday SGT):
├─ Deploy US-EAST (Blue → Green)
├─ Edge agents at LA, NY, Boston switch to dual-write mode
├─ Monitor for 24 hours
│
Monday 6 AM EST (12 PM CET, 8 PM SGT):
├─ US-EAST validated stable
├─ Deploy EU-CENTRAL (Blue → Green)
├─ Edge agents at Frankfurt, London switch to dual-write mode
├─ Monitor for 24 hours
│
Tuesday 6 AM EST (12 PM Tuesday CET, 8 PM Tuesday SGT):
├─ EU-CENTRAL validated stable
├─ Deploy APAC (Blue → Green)
├─ Edge agents at Shanghai, Singapore switch to dual-write mode
├─ Monitor for 24 hours
│
Wednesday 6 AM EST:
└─ All regions stable, deployment complete
```

**Why Sequential (not parallel)?**
- ✅ Learn from each region before next
- ✅ Limit blast radius (only one region at risk)
- ✅ Easier to rollback single region
- ✅ Time zones: Each region deploys during their low-traffic time
- ✅ Even though backwards compatible, still safer to go region-by-region

---

## Edge Computer Specifications

### Minimum Hardware (Per Facility)

```
Small Facility (< 3 printers):
├─ Intel NUC or Raspberry Pi 4 (8GB RAM)
├─ 256GB SSD
├─ Docker support
└─ Cost: ~$500-800

Medium Facility (3-10 printers):
├─ Mini PC (Intel i5, 16GB RAM)
├─ 512GB SSD
├─ Docker support
└─ Cost: ~$1,200-1,500

Large Facility (10+ printers):
├─ Server (Intel Xeon, 32GB RAM)
├─ 1TB SSD RAID
├─ Docker support
└─ Cost: ~$3,000-5,000
```

### Software Stack (Edge Computer)

```
Docker Containers:
├─ PostgreSQL (operational database)
├─ GraphQL API Server (local access)
├─ Replication Agent (sync to cloud)
├─ Equipment Agent (printers, IoT)
└─ Monitoring Agent (health checks)
```

---

## Data Retention Strategy

### Tier 1 (Edge): Short-Term Operational

```
Edge PostgreSQL:
├─ Current orders: Last 30 days
├─ Production logs: Last 7 days (detailed)
├─ Equipment data: Last 24 hours (real-time)
└─ Older data: Archived to cloud, deleted locally
```

**Why short retention?**
- Limited storage on edge hardware
- Operational data only (not historical)
- Cloud has full history

### Tier 2 (Regional Cloud): Medium-Term Historical

```
Regional PostgreSQL:
├─ Orders: Last 2 years (hot)
├─ Production logs: Last 1 year (hot)
├─ Equipment data: Last 90 days (hot)
└─ Older data: Archived to cold storage (S3/Blob)
```

### Tier 3 (Global Analytics): Long-Term Aggregated

```
Global Analytics Database:
├─ Aggregated KPIs: Last 10 years
├─ Trends, forecasts: All historical
├─ Raw data: Not stored (references regional)
└─ Compliance: 7-year retention for financial
```

---

## Question 2 Clarification Needed

You said: *"Why would the data only live in one location?"*

Here's my understanding now:

### Operational Data (Multiple Locations):
```
Foo LA Order #12345:
├─ Primary: Edge PostgreSQL (LA facility) ← Source of truth
├─ Replica: US-EAST Cloud PostgreSQL ← Near real-time copy
└─ Summary: Global Analytics ← Aggregated in KPIs
```

### Analytical Data (Distributed):
```
Foo Executive Dashboard:
├─ US metrics: From US-EAST Cloud
├─ EU metrics: From EU-CENTRAL Cloud
├─ APAC metrics: From APAC Cloud
└─ Combined: Global Analytics (aggregated only)
```

### Questions for You:

**A. Edge as Source of Truth?**
```
Scenario: Order entered at LA edge, synced to US-EAST cloud
Later: Internet down, worker needs to edit order
```
- Should edge PostgreSQL be authoritative? (I think YES)
- Cloud is replica for redundancy and remote access?

**B. Conflict Resolution?**
```
Scenario: Internet down for 2 hours
- Worker at LA edge edits Order #12345
- Remote worker (Philippines) edits Order #12345 in cloud
```
- Which wins when internet returns? (Edge wins? Cloud wins? Merge?)

**C. Cross-Region Queries?**
```
Scenario: CEO needs total orders across all facilities
```
- Query all 3 regional clouds and aggregate? (I think YES)
- Or pre-aggregate in Global Analytics? (Seems better for performance)

**Please clarify Question 2 with these sub-questions in mind.**

---

## Next Steps

Once Question 2 is clarified, I will:

1. ✅ Create HTML decision forms for multi-region deployment
2. ✅ Update agents (Berry, Miki, Release Manager) with 3-tier edge knowledge
3. ✅ Document edge computer setup procedures
4. ✅ Create docker-compose for LOCAL edge simulation
5. ✅ Write replication strategies for edge → cloud
6. ✅ Design conflict resolution mechanisms

---

[⬆ Back to top](#3-tier-database-architecture-edge--regional--global) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
