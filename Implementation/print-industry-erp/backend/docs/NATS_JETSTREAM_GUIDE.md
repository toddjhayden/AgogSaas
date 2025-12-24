**📍 Navigation Path:** [AGOG Home](../../../../README.md) → [Implementation](../../../README.md) → [Backend](../../README.md) → NATS Jetstream Guide

# NATS Jetstream Guide - Agent Deliverable System

**Version:** 1.0.0
**Last Updated:** 2025-12-17
**Layer:** 3 (Orchestration)

---

## Overview

NATS Jetstream provides durable message storage for agent deliverables in the AgogSaaS 4-layer AI system. This enables the **AGOG Deliverable Pattern** that achieves ~95% token savings in agent spawning.

### The Problem

Without NATS, spawning agents with full context consumes massive tokens:

```
Orchestrator spawns Roy (Backend Agent)
  ↓
Context includes:
  - Cynthia's full research report (5,000 tokens)
  - Sylvia's full critique report (4,000 tokens)
  - Feature requirements (2,000 tokens)
  - Code context (4,000 tokens)
  ↓
Total spawn cost: 15,000+ tokens
```

### The Solution

With NATS, agents publish full reports and return tiny notices:

```
Orchestrator spawns Roy with tiny notice (200 tokens)
  ↓
Roy fetches only what he needs from NATS:
  - Cynthia's report from NATS (on demand)
  - Sylvia's report from NATS (on demand)
  ↓
Total spawn cost: 200 tokens (95% savings)
```

---

## Architecture

### Streams (6 total - one per agent)

Each agent has their own Jetstream stream:

| Stream Name                   | Agent   | Purpose               | Channel Pattern                            |
| ----------------------------- | ------- | --------------------- | ------------------------------------------ |
| `agog_features_research`      | Cynthia | Research reports      | `agog.deliverables.cynthia.[type].[feature]` |
| `agog_features_critique`      | Sylvia  | Critique reports      | `agog.deliverables.sylvia.[type].[feature]`  |
| `agog_features_backend`       | Roy     | Backend reports       | `agog.deliverables.roy.[type].[feature]`     |
| `agog_features_frontend`      | Jen     | Frontend reports      | `agog.deliverables.jen.[type].[feature]`     |
| `agog_features_qa`            | Billy   | QA reports            | `agog.deliverables.billy.[type].[feature]`   |
| `agog_features_statistics`    | Priya   | Statistics reports    | `agog.deliverables.priya.[type].[feature]`   |

### Channel Naming Pattern

```
agog.deliverables.[agent].[type].[feature]
                    ↑        ↑       ↑
                    |        |       |
                    |        |       └─ Feature name (kebab-case)
                    |        └───────── Task type (research, backend, frontend, etc.)
                    └────────────────── Agent name (cynthia, roy, jen, etc.)
```

**Examples:**

- `agog.deliverables.cynthia.research.customer-search`
- `agog.deliverables.roy.backend.customer-search`
- `agog.deliverables.jen.frontend.customer-search`
- `agog.deliverables.billy.qa.customer-search`

### Stream Configuration

Each stream is configured with:

- **Storage:** File-based (persistent)
- **Retention:** Limits-based (max messages/bytes/age)
- **Max Messages:** 10,000 per stream
- **Max Bytes:** 1GB per stream
- **Max Age:** 7 days
- **Max Message Size:** 10MB (for large reports)
- **Deduplication:** 2-minute window

---

## Getting Started

### 1. Start NATS in Docker Compose

NATS is already configured in `docker-compose.yml`:

```bash
docker-compose up -d nats
```

Check NATS is running:

```bash
docker logs agogsaas-nats
```

View monitoring dashboard:

```
http://localhost:8223
```

### 2. Initialize Streams

Run the initialization script to create all agent streams:

```bash
# Inside backend container
npm run init:nats-streams

# OR directly with docker-compose
docker-compose exec backend npm run init:nats-streams
```

This creates all 6 agent streams with proper configuration.

### 3. Verify Streams

Check that all streams are created:

```bash
# Inside NATS container
docker exec -it agogsaas-nats nats stream list

# OR use the monitoring endpoint
curl http://localhost:8223/streaming/serverz
```

---

## Usage

### Import Services

```typescript
import { NATSDeliverableService } from './nats/nats-deliverable.service';
```

### Initialize Service

```typescript
const natsService = new NATSDeliverableService();
await natsService.initialize();
```

### Publish Agent Report (Full Report)

When an agent completes work, publish the FULL report to NATS:

```typescript
await natsService.publishReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
  reportContent: fullResearchReport, // Large markdown document (5K-15K tokens)
  metadata: {
    files_analyzed: 15,
    complexity: 'Medium',
    duration_minutes: 12,
  },
});
```

### Create Completion Notice (Tiny Notice)

After publishing, return a tiny completion notice (~200 tokens):

```typescript
const completionNotice = natsService.createCompletionNotice(
  'cynthia',
  'customer-search',
  'agog.deliverables.cynthia.research.customer-search',
  'Researched customer search patterns and requirements',
  {
    complexity: 'Medium',
    files_modified: 0,
    ready_for_next_stage: true,
  }
);

// Return this to orchestrator (NOT the full report)
return completionNotice;
```

### Fetch Previous Agent's Report

When an agent needs context from a previous agent:

```typescript
// Fetch Cynthia's research report
const researchReport = await natsService.fetchReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
});

if (researchReport) {
  console.log('Research content:', researchReport.content);
  console.log('Metadata:', researchReport.metadata);
  console.log('Published at:', researchReport.timestamp);
}
```

---

## Complete Agent Workflow Example

### Step 1: Cynthia (Research)

```typescript
// CYNTHIA: Do research
const researchReport = `
# Research Report: Customer Search Feature

## Executive Summary
...

## Requirements Analysis
...

## Implementation Recommendations
...
`;

// Publish FULL report to NATS (5,000 tokens)
await natsService.publishReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
  reportContent: researchReport,
});

// Return TINY notice (200 tokens)
return natsService.createCompletionNotice(
  'cynthia',
  'customer-search',
  'agog.deliverables.cynthia.research.customer-search',
  'Researched customer search patterns and requirements',
  { complexity: 'Medium', ready_for_next_stage: true }
);
```

### Step 2: Sylvia (Critique)

```typescript
// SYLVIA: Fetch Cynthia's report from NATS
const researchReport = await natsService.fetchReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
});

// Do critique based on research
const critiqueReport = performCritique(researchReport.content);

// Publish FULL critique to NATS (4,000 tokens)
await natsService.publishReport({
  agent: 'sylvia',
  taskType: 'critique',
  featureName: 'customer-search',
  reportContent: critiqueReport,
});

// Return TINY notice (200 tokens)
return natsService.createCompletionNotice(
  'sylvia',
  'customer-search',
  'agog.deliverables.sylvia.critique.customer-search',
  'Critiqued research and approved for implementation',
  { complexity: 'Simple', ready_for_next_stage: true }
);
```

### Step 3: Roy (Backend)

```typescript
// ROY: Fetch both previous reports from NATS
const researchReport = await natsService.fetchReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
});

const critiqueReport = await natsService.fetchReport({
  agent: 'sylvia',
  taskType: 'critique',
  featureName: 'customer-search',
});

// Implement backend based on research + critique
const backendReport = implementBackend(researchReport, critiqueReport);

// Publish FULL implementation report to NATS (8,000 tokens)
await natsService.publishReport({
  agent: 'roy',
  taskType: 'backend',
  featureName: 'customer-search',
  reportContent: backendReport,
  metadata: { files_modified: 5 },
});

// Return TINY notice (200 tokens)
return natsService.createCompletionNotice(
  'roy',
  'customer-search',
  'agog.deliverables.roy.backend.customer-search',
  'Implemented GraphQL API with customer search filters',
  {
    complexity: 'Medium',
    files_modified: 5,
    ready_for_next_stage: true,
  }
);
```

---

## Token Savings Calculation

### Without NATS (Traditional Approach)

```
Spawn Roy with full context:
  - Cynthia's report: 5,000 tokens
  - Sylvia's report: 4,000 tokens
  - Feature spec: 2,000 tokens
  - Code context: 4,000 tokens
  ─────────────────────────────
  TOTAL: 15,000 tokens
```

### With NATS (Deliverable Pattern)

```
Spawn Roy with tiny notice:
  - Completion notice: 200 tokens
  ─────────────────────────────
  TOTAL: 200 tokens

Roy fetches reports on demand from NATS:
  - Fetch Cynthia's report (already stored)
  - Fetch Sylvia's report (already stored)

Savings: 14,800 tokens (98.7%)
```

---

## Monitoring

### Stream Status

Get all stream statuses:

```typescript
const statuses = await natsService.getStreamStatuses();
console.log(statuses);
// Output:
// [
//   { name: 'agog_features_research', messages: 15, bytes: 234567, ... },
//   { name: 'agog_features_backend', messages: 12, bytes: 189234, ... },
//   ...
// ]
```

Get specific agent stream status:

```typescript
const cynthiaStatus = await natsService.getAgentStreamStatus('cynthia');
console.log(`Cynthia stream has ${cynthiaStatus.state.messages} messages`);
```

### NATS Monitoring UI

Access the NATS monitoring dashboard at:

```
http://localhost:8223
```

Endpoints:

- `/varz` - Server variables
- `/connz` - Connection information
- `/routez` - Route information
- `/subsz` - Subscription information
- `/streaming/channelsz` - Jetstream channel statistics

---

## Advanced Features

### Subscribe to Deliverables

For real-time monitoring or event-driven workflows:

```typescript
import { NATSClient } from './nats/nats-client.service';

const client = new NATSClient();
await client.connect();

// Subscribe to all Cynthia's deliverables
await client.subscribeToDeliverables({
  agent: 'cynthia',
  callback: async (content, metadata) => {
    console.log(`New research report: ${metadata.feature}`);
    console.log(`Published at: ${metadata.timestamp}`);
    // Process report...
  },
});
```

### Fetch Specific Message Sequence

If you know the message sequence number:

```typescript
const streamName = 'agog_features_research';
const sequence = 42;

const msg = await client.jsm.streams.getMessage(streamName, { seq: sequence });
```

### Stream Purging (Cleanup)

To delete old messages (for maintenance):

```typescript
// Purge stream (delete all messages)
await client.jsm.streams.purge('agog_features_research');

// Or delete specific stream
await client.jsm.streams.delete('agog_features_research');
```

---

## Troubleshooting

### NATS Connection Failed

**Error:** `[NATS] Connection failed: connect ECONNREFUSED`

**Solution:**

1. Check NATS is running: `docker ps | grep nats`
2. Check NATS_URL is correct in `.env`
3. Verify network: `docker network inspect agogsaas-network`

### Stream Not Found

**Error:** `stream not found`

**Solution:**

Run initialization script:

```bash
npm run init:nats-streams
```

### Message Too Large

**Error:** `maximum payload exceeded`

**Solution:**

NATS is configured with 10MB max message size. If reports are larger:

1. Split reports into sections
2. Compress content before publishing
3. Increase `--max_payload` in docker-compose.yml

### Stream Full

**Error:** `maximum messages exceeded`

**Solution:**

Streams auto-discard old messages when full. To increase capacity, update stream configuration:

```typescript
await jsm.streams.update('agog_features_research', {
  max_msgs: 20000, // Increase from 10,000
  max_bytes: 2 * 1024 * 1024 * 1024, // Increase to 2GB
});
```

---

## Best Practices

### 1. Always Publish Then Return

```typescript
// ✅ CORRECT
await natsService.publishReport({ ... });
return natsService.createCompletionNotice({ ... });

// ❌ WRONG - Don't return full report
return { report: fullReport, status: 'complete' };
```

### 2. Use Descriptive Feature Names

```typescript
// ✅ CORRECT
featureName: 'customer-search'
featureName: 'invoice-pdf-generator'
featureName: 'inventory-lot-tracking'

// ❌ WRONG
featureName: 'feature1'
featureName: 'search'
```

### 3. Include Metadata

```typescript
// ✅ CORRECT - Rich metadata
metadata: {
  files_modified: 5,
  complexity: 'Medium',
  duration_minutes: 12,
  dependencies: ['customers', 'orders']
}

// ❌ WRONG - No metadata
metadata: {}
```

### 4. Handle Missing Reports Gracefully

```typescript
// ✅ CORRECT
const report = await natsService.fetchReport({...});
if (!report) {
  console.log('No previous report found, proceeding without context');
  // Handle missing report case
}

// ❌ WRONG - Assume report exists
const report = await natsService.fetchReport({...});
processReport(report.content); // May crash if null
```

---

## Performance Considerations

### Message Size

- **Target:** 5K-15K tokens (5-15KB) per report
- **Maximum:** 10MB per message
- **Compression:** Consider compressing large reports

### Retention

- **Default:** 7 days
- **Maximum:** 10,000 messages per stream
- **Storage:** 1GB per stream

### Throughput

- NATS Jetstream can handle:
  - 1M+ messages/second (small messages)
  - 100K+ messages/second (large messages like agent reports)

For AgogSaaS scale (dozens of features per day), performance is not a concern.

---

## Security Considerations

### Network Isolation

NATS runs in Docker network `agogsaas-network`. Only backend can access it.

### No Authentication (Development)

Current setup has no NATS authentication. For production, add:

```yaml
# docker-compose.yml
command:
  - '-js'
  - '--user'
  - 'agog_user'
  - '--pass'
  - '${NATS_PASSWORD}'
```

### Message Encryption

Messages are not encrypted at rest. For sensitive data:

1. Encrypt content before publishing
2. Decrypt after fetching
3. Use NATS TLS in production

---

## Integration with Orchestrator

The orchestrator uses NATS to coordinate agent workflows:

```typescript
// In orchestrator.service.ts
import { NATSDeliverableService } from '../nats';

export class OrchestratorService {
  private natsService: NATSDeliverableService;

  async initialize() {
    this.natsService = new NATSDeliverableService();
    await this.natsService.initialize();
  }

  async executeFeatureWorkflow(featureName: string) {
    // 1. Spawn Cynthia (Research)
    const cynthiaNotice = await this.spawnAgent('cynthia', featureName);

    // 2. Spawn Sylvia (Critique) - she fetches Cynthia's report from NATS
    const sylviaNotice = await this.spawnAgent('sylvia', featureName, {
      previousAgent: 'cynthia',
      previousChannel: cynthiaNotice.nats_channel,
    });

    // 3. Spawn Roy (Backend) - he fetches both reports from NATS
    const royNotice = await this.spawnAgent('roy', featureName, {
      previousAgents: ['cynthia', 'sylvia'],
    });

    // And so on...
  }
}
```

---

## Related Documentation

- [AGOG Agent Onboarding](../../../../.claude/agents/AGOG_AGENT_ONBOARDING.md) - Agent standards
- [Orchestration Layer](../src/orchestration/README.md) - Layer 3 overview
- [4-Layer System Guide](../../../../docs/PHASE4_COMPLETE.md) - Complete system documentation

---

## Version History

| Version | Date       | Changes                                   |
| ------- | ---------- | ----------------------------------------- |
| 1.0.0   | 2025-12-17 | Initial NATS Jetstream setup and guide    |

---

[⬆ Back to top](#nats-jetstream-guide---agent-deliverable-system) | [🏠 AGOG Home](../../../../README.md) | [📚 Backend Docs](../README.md)
