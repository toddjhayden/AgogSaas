# Phase 4: Memory System (Ollama-Based Semantic Search)

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → Phase 4 Memory System

## Overview

Phase 4 provides intelligent memory and learning capabilities for AI agents using **FREE, local embeddings** via Ollama. No API keys required!

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Workflows (Layer 3)                                  │
│  ↓                                                           │
│  Store memories via MCP Memory Client                       │
│  ↓                                                           │
│  Generate embeddings via Ollama (nomic-embed-text)          │
│  ↓                                                           │
│  Store in PostgreSQL with pgvector extension                │
│  ↓                                                           │
│  Semantic search using vector similarity                    │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Ollama (Embedding Service)

- **Model:** `nomic-embed-text`
- **Dimensions:** 768
- **Cost:** FREE (runs locally)
- **Speed:** ~50ms per embedding
- **URL:** http://localhost:11434

### 2. PostgreSQL + pgvector

- **Extension:** pgvector
- **Table:** `memories`
- **Index Type:** IVFFlat (cosine similarity)
- **Search Speed:** <10ms for 100K vectors

### 3. MCP Memory Client

Located at: `backend/src/mcp/mcp-client.service.ts`

**Methods:**
- `storeMemory()` - Save agent memory with embedding
- `searchMemories()` - Semantic search across memories
- `getAgentMemories()` - Get recent memories by agent
- `updateMemoryRelevance()` - Update relevance scores

## Setup

### Automatic (Recommended)

```bash
# Run quick-start script (includes Ollama model pull)
./quick-start.bat   # Windows
./quick-start.sh    # Linux/Mac
```

### Manual

```bash
# 1. Start services
docker-compose up -d

# 2. Pull embedding model
docker exec agogsaas-ollama ollama pull nomic-embed-text

# 3. Verify setup
docker exec agogsaas-backend npm run test:memory
```

## Usage Examples

### Storing Memories

```typescript
import { MCPMemoryClient } from './mcp/mcp-client.service';

const client = new MCPMemoryClient();

// Store research findings
await client.storeMemory({
  agent_id: 'cynthia',
  memory_type: 'research',
  content: 'Customer module uses UUID v7 primary keys for optimal indexing.',
  metadata: { feature: 'customers', confidence: 0.95 }
});

// Store implementation details
await client.storeMemory({
  agent_id: 'roy',
  memory_type: 'implementation',
  content: 'GraphQL resolvers must filter by tenant_id for security.',
  metadata: { feature: 'customers', layer: 'backend' }
});
```

### Semantic Search

```typescript
// Find relevant memories about database design
const results = await client.searchMemories({
  query: 'How are primary keys configured?',
  limit: 5,
  min_relevance: 0.7
});

results.forEach(memory => {
  console.log(`[${memory.agent_id}] ${memory.content}`);
  console.log(`Relevance: ${memory.relevance_score}`);
});
```

### Agent-Specific Search

```typescript
// Search only Roy's backend memories
const backendMemories = await client.searchMemories({
  query: 'security best practices',
  agent_id: 'roy',
  memory_types: ['implementation', 'review'],
  limit: 10
});
```

### Recent Memories

```typescript
// Get Cynthia's 10 most recent research findings
const recent = await client.getAgentMemories('cynthia', 10);
```

## Database Schema

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID,
  agent_id VARCHAR(50) NOT NULL,
  memory_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),              -- Ollama nomic-embed-text
  metadata JSONB,
  accessed_at TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  relevance_score DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Vector similarity index
CREATE INDEX idx_memories_embedding
  ON memories USING ivfflat (embedding vector_cosine_ops);
```

## Memory Types

Recommended memory types for different agents:

| Agent | Memory Types |
|-------|-------------|
| Cynthia (Research) | `research`, `analysis`, `findings` |
| Roy (Backend) | `implementation`, `review`, `refactor` |
| Jen (Frontend) | `ui`, `component`, `review` |
| Billy (QA) | `testing`, `bug`, `regression` |
| Sylvia (Critique) | `critique`, `suggestion`, `pattern` |
| Priya (Analytics) | `metric`, `insight`, `trend` |

## Performance

### Embedding Generation

- **Speed:** ~50ms per text (nomic-embed-text)
- **Throughput:** ~20 embeddings/second
- **Model Size:** 274MB download

### Semantic Search

- **10K memories:** <5ms
- **100K memories:** <10ms
- **1M memories:** <50ms (with IVFFlat index)

## Testing

### Run Phase 4 Tests

```bash
# Inside container
docker exec agogsaas-backend npm run test:memory

# Expected output:
# ✅ Stored memory 1
# ✅ Stored memory 2
# ✅ Found 3 relevant memories
# ✅ Semantic search working
# ✅ ALL TESTS PASSED!
```

### Manual Testing

```bash
# Check Ollama service
curl http://localhost:11434/api/tags

# Check model is installed
docker exec agogsaas-ollama ollama list

# Test embedding generation
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "test embedding"
  }'
```

## Monitoring

### Health Checks

```bash
# Ollama health
curl http://localhost:11434/api/tags

# PostgreSQL pgvector
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas \
  -c "SELECT extname FROM pg_extension WHERE extname='vector'"

# Memory count
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas \
  -c "SELECT COUNT(*) FROM memories"
```

### Dashboard Integration

Memory metrics are visible in the monitoring dashboard:
- http://localhost:3000/monitoring
- Shows memory count, search performance, embedding latency

## Troubleshooting

### Model Not Found

**Error:** `404 - Model not found`

**Fix:**
```bash
docker exec agogsaas-ollama ollama pull nomic-embed-text
```

### Slow Embeddings

**Cause:** First-time model loading
**Expected:** First embedding takes ~2s, subsequent <50ms

### Zero Vector Results

**Cause:** Ollama not running or model not loaded
**Check:**
```bash
curl http://localhost:11434/api/tags
docker logs agogsaas-ollama
```

## Integration with Layer 3 (Orchestration)

Agents automatically store memories during workflow execution:

```typescript
// In orchestrator.service.ts
async function handleAgentCompletion(agentResult: any) {
  // Store agent's work in memory
  await memoryClient.storeMemory({
    agent_id: agentResult.agent,
    memory_type: agentResult.type,
    content: agentResult.summary,
    metadata: {
      feature: agentResult.feature,
      timestamp: Date.now()
    }
  });

  // Search for related past work
  const relatedMemories = await memoryClient.searchMemories({
    query: agentResult.summary,
    agent_id: agentResult.agent,
    limit: 3
  });

  // Agent can learn from past work!
}
```

## Why Ollama vs OpenAI?

| Feature | Ollama (nomic-embed-text) | OpenAI (text-embedding-3-small) |
|---------|---------------------------|----------------------------------|
| **Cost** | FREE | $0.02 / 1M tokens |
| **Privacy** | 100% local | Cloud-based |
| **Latency** | ~50ms | ~200ms (network) |
| **Dimensions** | 768 | 1536 |
| **Quality** | Excellent | Excellent |
| **Setup** | One command | API key required |

**Winner:** Ollama for AgogSaaS (free, local, fast)

## Advanced Features

### Memory Relevance Scoring

```typescript
// Update memory relevance based on usefulness
await client.updateMemoryRelevance(memoryId, 0.95);

// Search prioritizes high-relevance memories
const topMemories = await client.searchMemories({
  query: 'best practices',
  min_relevance: 0.8  // Only show highly relevant
});
```

### Cross-Agent Learning

```typescript
// Jen (frontend) learns from Roy's (backend) work
const backendPatterns = await client.searchMemories({
  query: 'customer data handling',
  agent_id: 'roy',  // Search Roy's memories
  memory_types: ['implementation']
});

// Jen applies backend patterns to frontend
```

### Temporal Queries

```typescript
// Find recent memories (within 7 days)
const recent = await pool.query(`
  SELECT * FROM memories
  WHERE created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC
`);
```

## Roadmap

- [ ] Memory consolidation (merge similar memories)
- [ ] Automatic relevance decay (old memories fade)
- [ ] Cross-tenant memory sharing (with permission)
- [ ] Memory categories and tagging
- [ ] Memory visualization in dashboard

---

[⬆ Back to top](#phase-4-memory-system-ollama-based-semantic-search) | [🏠 AGOG Home](../README.md) | [📚 Implementation Guide](../Implementation/README.md)
