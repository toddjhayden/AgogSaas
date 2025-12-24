**📍 Navigation Path:** [AGOG Home](../../../../README.md) → [Backend](../../README.md) → [Source](../README.md) → NATS Module

# NATS Module - Agent Deliverable Communication

**Version:** 1.0.0
**Last Updated:** 2025-12-17
**Layer:** 3 (Orchestration)

---

## Overview

This module provides NATS Jetstream integration for the AGOG deliverable pattern. It enables ~95% token savings in agent spawning by publishing full reports to NATS and returning tiny completion notices.

## Files

### Core Services

- **`nats-client.service.ts`** - Low-level NATS Jetstream client
  - Connect to NATS server
  - Initialize agent streams
  - Publish/subscribe to channels
  - Fetch messages by sequence or subject

- **`nats-deliverable.service.ts`** - High-level deliverable service
  - Simplified API for agent operations
  - Publish agent reports
  - Fetch previous agent work
  - Create completion notices

- **`index.ts`** - Module exports

### Scripts

- **`../scripts/init-nats-streams.ts`** - Initialize all agent streams

## Quick Start

### 1. Import Service

```typescript
import { NATSDeliverableService } from './nats';
```

### 2. Initialize

```typescript
const natsService = new NATSDeliverableService();
await natsService.initialize();
```

### 3. Publish Report

```typescript
await natsService.publishReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
  reportContent: fullResearchReport,
});
```

### 4. Fetch Report

```typescript
const report = await natsService.fetchReport({
  agent: 'cynthia',
  taskType: 'research',
  featureName: 'customer-search',
});
```

### 5. Create Completion Notice

```typescript
const notice = natsService.createCompletionNotice(
  'cynthia',
  'customer-search',
  'agog.deliverables.cynthia.research.customer-search',
  'Researched customer search patterns',
  { complexity: 'Medium', ready_for_next_stage: true }
);

return notice; // Return this to orchestrator (~200 tokens)
```

## Channel Pattern

```
agog.deliverables.[agent].[type].[feature]

Examples:
  agog.deliverables.cynthia.research.customer-search
  agog.deliverables.roy.backend.customer-search
  agog.deliverables.jen.frontend.customer-search
```

## Agents & Streams

| Agent   | Stream Name                | Purpose        |
| ------- | -------------------------- | -------------- |
| cynthia | agog_features_research     | Research       |
| sylvia  | agog_features_critique     | Critique       |
| roy     | agog_features_backend      | Backend        |
| jen     | agog_features_frontend     | Frontend       |
| billy   | agog_features_qa           | QA             |
| priya   | agog_features_statistics   | Statistics     |

## Complete Example

See [NATS_JETSTREAM_GUIDE.md](../../docs/NATS_JETSTREAM_GUIDE.md) for complete workflow examples and advanced usage.

## Token Savings

### Without NATS
```
Spawn Roy with full context: 15,000 tokens
```

### With NATS
```
Spawn Roy with tiny notice: 200 tokens
Savings: 98.7%
```

## Documentation

- **[NATS Jetstream Guide](../../docs/NATS_JETSTREAM_GUIDE.md)** - Complete guide with examples
- **[AGOG Agent Onboarding](../../../../.claude/agents/AGOG_AGENT_ONBOARDING.md)** - Agent standards

---

[⬆ Back to top](#nats-module---agent-deliverable-communication) | [🏠 AGOG Home](../../../../README.md) | [📚 Backend Source](../README.md)
