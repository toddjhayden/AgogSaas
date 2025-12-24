**📍 Navigation Path:** [AGOG Home](../../../README.md) → [Implementation](../../README.md) → [Backend](../README.md) → NATS Quick Start

# NATS Jetstream Quick Start

**Get started with NATS agent deliverables in 5 minutes**

---

## Prerequisites

- Docker and Docker Compose installed
- Backend dependencies installed (`npm install`)

---

## Step 1: Start NATS Server

```bash
# Start NATS in Docker Compose
docker-compose up -d nats

# Verify NATS is running
docker logs agogsaas-nats

# You should see:
# [1] 2025/12/17 10:30:00.123456 [INF] Starting nats-server
# [1] 2025/12/17 10:30:00.123456 [INF] JetStream enabled
```

---

## Step 2: Initialize Streams

```bash
# Initialize all 6 agent streams
docker-compose exec backend npm run init:nats-streams

# OR if running locally
cd Implementation/print-industry-erp/backend
npm run init:nats-streams
```

**Expected output:**

```
🚀 NATS Jetstream Stream Initialization
========================================

📡 Connecting to NATS: nats://localhost:4222

[NATS] Connected to nats://localhost:4222
[NATS] Creating stream: agog_features_research
[NATS] ✅ Stream agog_features_research created
[NATS] Creating stream: agog_features_critique
[NATS] ✅ Stream agog_features_critique created
...

✅ All streams initialized successfully!
```

---

## Step 3: Test the System

```bash
# Run test script to verify everything works
docker-compose exec backend npm run test:nats

# OR if running locally
npm run test:nats
```

**Expected output:**

```
🧪 Testing NATS Deliverable System
===================================

📡 Connecting to NATS...
✅ Connected

👩‍🔬 STEP 1: Cynthia (Research Agent)
─────────────────────────────────────
Publishing research report to NATS...
✅ Research complete

👩‍⚖️ STEP 2: Sylvia (Critique Agent)
────────────────────────────────────
Fetching Cynthia's research from NATS...
✅ Fetched report (1234 chars)
...

💰 Token Savings Analysis
─────────────────────────
Without NATS: ~3000 tokens
With NATS: ~100 tokens
Token Savings: 2900 tokens (97%)

✅ Test complete!
```

---

## Step 4: Start Full Stack

```bash
# Start all services
docker-compose up -d

# Watch logs
docker-compose logs -f backend

# You should see:
# ✅ Database connected
# ✅ Health monitoring started (5s interval)
# ✅ NATS Jetstream connected
# ✅ Orchestrator initialized
# 🚀 Server ready at http://localhost:4001/
```

---

## Verify Installation

### Check NATS Monitoring

Open browser: http://localhost:8223

You should see NATS monitoring dashboard with server stats.

### Check Streams via CLI

```bash
# List all streams
docker exec -it agogsaas-nats nats stream list

# Expected output:
# Streams:
#   agog_features_research
#   agog_features_critique
#   agog_features_backend
#   agog_features_frontend
#   agog_features_qa
#   agog_features_statistics

# View stream info
docker exec -it agogsaas-nats nats stream info agog_features_research
```

---

## Basic Usage Example

### In Your Code

```typescript
import { NATSDeliverableService } from './nats';

// Initialize
const natsService = new NATSDeliverableService();
await natsService.initialize();

// Publish agent report
await natsService.publishReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
  reportContent: fullResearchReport, // Large markdown (5K-15K tokens)
});

// Create tiny completion notice
const notice = natsService.createCompletionNotice(
  'cynthia',
  'customer-search',
  'agog.deliverables.cynthia.research.customer-search',
  'Researched customer search patterns',
  { complexity: 'Medium', ready_for_next_stage: true }
);

// Return tiny notice (not full report)
return notice; // ~200 tokens instead of 5,000+
```

---

## Troubleshooting

### NATS Connection Failed

**Error:** `[NATS] Connection failed: connect ECONNREFUSED`

**Fix:**

```bash
# Make sure NATS is running
docker-compose up -d nats

# Check NATS logs
docker logs agogsaas-nats

# Restart if needed
docker-compose restart nats
```

### Streams Not Created

**Error:** `stream not found`

**Fix:**

```bash
# Re-run initialization
docker-compose exec backend npm run init:nats-streams
```

### Port Conflicts

If port 4223 or 8223 is in use:

```yaml
# Edit docker-compose.yml
ports:
  - "4224:4222"  # Change 4223 to 4224
  - "8224:8222"  # Change 8223 to 8224
```

Then update `.env`:

```bash
NATS_URL=nats://nats:4222  # Internal port stays 4222
```

---

## Next Steps

1. **Read Full Guide:** [NATS_JETSTREAM_GUIDE.md](docs/NATS_JETSTREAM_GUIDE.md)
2. **Review Agent Standards:** [AGOG_AGENT_ONBOARDING.md](../../../.claude/agents/AGOG_AGENT_ONBOARDING.md)
3. **Explore Code:** [src/nats/](src/nats/)
4. **Test Scripts:** [scripts/test-nats-deliverables.ts](scripts/test-nats-deliverables.ts)

---

## Key Concepts

### Deliverable Pattern

1. Agent does work (research, implementation, etc.)
2. Agent publishes FULL report to NATS (5K-15K tokens)
3. Agent returns TINY completion notice (~200 tokens)
4. Next agent fetches full report from NATS on demand
5. **Result:** 95%+ token savings on agent spawning

### Channel Naming

```
agog.deliverables.[agent].[type].[feature]
                   ↓        ↓       ↓
                 cynthia research customer-search
```

### Agents

- **cynthia** - Research
- **sylvia** - Critique
- **roy** - Backend
- **jen** - Frontend
- **billy** - QA
- **priya** - Statistics

---

## Common Commands

```bash
# Start NATS
docker-compose up -d nats

# Initialize streams
docker-compose exec backend npm run init:nats-streams

# Test system
docker-compose exec backend npm run test:nats

# View NATS logs
docker logs -f agogsaas-nats

# List streams
docker exec -it agogsaas-nats nats stream list

# View monitoring
open http://localhost:8223

# Restart NATS
docker-compose restart nats

# Stop NATS
docker-compose stop nats
```

---

## Environment Variables

Already configured in `.env.example`:

```bash
# NATS Configuration
NATS_URL=nats://nats:4222  # For Docker Compose
# OR
NATS_URL=nats://localhost:4223  # For local development
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Orchestrator                       │
│                                                      │
│  Spawns agents with tiny notices (~200 tokens)      │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────────┐
         │     NATS Jetstream         │
         │                            │
         │  6 Streams (1 per agent):  │
         │  - agog_features_research  │
         │  - agog_features_critique  │
         │  - agog_features_backend   │
         │  - agog_features_frontend  │
         │  - agog_features_qa        │
         │  - agog_features_statistics│
         └────────────────────────────┘
                      ▲
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼─────┐            ┌─────▼─────┐
    │ Cynthia  │            │    Roy    │
    │          │            │           │
    │ Publishes│            │  Fetches  │
    │   FULL   │            │   FULL    │
    │  report  │            │  reports  │
    │ (5K tok) │            │  on demand│
    │          │            │           │
    │ Returns  │            │  Returns  │
    │   TINY   │            │   TINY    │
    │  notice  │            │  notice   │
    │ (200 tok)│            │ (200 tok) │
    └──────────┘            └───────────┘
```

---

**You're all set! 🚀**

Full documentation: [NATS_JETSTREAM_GUIDE.md](docs/NATS_JETSTREAM_GUIDE.md)

---

[⬆ Back to top](#nats-jetstream-quick-start) | [🏠 AGOG Home](../../../README.md) | [📚 Backend Home](../README.md)
