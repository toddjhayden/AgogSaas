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
- **Database:** `agent_memory` (dedicated database for agent memories)
- **User:** `agent_user`
- **Port:** 5434 (external), 5432 (internal to Docker)
- **Container:** `agogsaas-agents-postgres`
- **Connection String (Docker):** `postgresql://agent_user:agent_dev_password_2024@agent-postgres:5432/agent_memory`
- **Connection String (Host):** `postgresql://agent_user:agent_dev_password_2024@localhost:5434/agent_memory`
- **Table:** `memories`
- **Index Type:** HNSW (Hierarchical Navigable Small World) with cosine similarity
- **Search Speed:** <10ms for 100K vectors

### 3. SDLC Control Database (Additional Infrastructure)

- **Database:** `sdlc_control`
- **User:** `sdlc_user`
- **Port:** 5435 (external), 5432 (internal to Docker)
- **Container:** `agogsaas-sdlc-postgres`
- **Purpose:** Entity DAG, Kanban board, and column governance for software development lifecycle management
- **Migrations:** `agent-backend/migrations/sdlc-control/`
- **Connection String (Docker):** `postgresql://sdlc_user:sdlc_dev_password_2024@sdlc-db:5432/sdlc_control`
- **Connection String (Host):** `postgresql://sdlc_user:sdlc_dev_password_2024@localhost:5435/sdlc_control`

### 4. MCP Memory Client

Located at:
- App Backend: `Implementation/print-industry-erp/backend/src/mcp/mcp-client.service.ts`
- Agent Backend: `Implementation/print-industry-erp/agent-backend/src/mcp/mcp-client.service.ts`

**Important:** Both implementations should use the agent memory database connection string. The default fallback in the code currently points to the wrong database (`agogsaas` on port 5433) and should use:
```typescript
// Container context (default in docker-compose.agents.yml)
const connectionString = process.env.DATABASE_URL ||
  'postgresql://agent_user:agent_dev_password_2024@agent-postgres:5432/agent_memory';

// Host context (connecting from outside Docker)
const connectionString = process.env.DATABASE_URL ||
  'postgresql://agent_user:agent_dev_password_2024@localhost:5434/agent_memory';
```

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
docker exec agogsaas-agents-ollama ollama pull nomic-embed-text

# 3. Verify setup (run manual test with the MCP client)
docker exec agogsaas-agents-backend node -e "const {MCPMemoryClient}=require('./dist/mcp/mcp-client.service.js'); console.log('MCP Client loaded successfully')"
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
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(100) NOT NULL,
  memory_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),              -- Ollama nomic-embed-text (768 dimensions)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  relevance_score FLOAT DEFAULT 0.0
);

-- Vector similarity index using HNSW for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON memories USING hnsw (embedding vector_cosine_ops);

-- Additional indexes for filtering
CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
```

**Note on Vector Storage:** The database schema uses the native `vector(768)` type from pgvector (see migration `V1.0.0__init_agent_memory.sql:22`). However, the current MCP client implementation stores embeddings as JSON-stringified arrays (text format) for compatibility with the `pg` library, then casts to vector type during queries using `$1::vector` (see `mcp-client.service.ts:57,79`). This approach works correctly but adds minimal overhead. A future optimization could store directly as binary vector format for improved performance.

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
- **Text Truncation:**
  - **Recommended:** 1,500 characters (~2,000 tokens safely under the 8,192 token limit)
  - **Note:** Current implementations have inconsistent truncation limits:
    - Agent Backend: 1,500 characters (`agent-backend/src/mcp/mcp-client.service.ts:156`)
    - App Backend: 8,000 characters (`backend/src/mcp/mcp-client.service.ts:156`)
  - **Model Limit:** nomic-embed-text supports up to 8,192 tokens of context
  - **Recommendation:** Standardize to 1,500 characters for consistency and safety

### Semantic Search

- **10K memories:** <5ms
- **100K memories:** <10ms
- **1M memories:** <50ms (with HNSW index)

## Testing

### Run Phase 4 Tests

```bash
# Test the MCP Memory Client (manual verification)
# Note: Automated test suite for memory system is pending implementation

# Quick test - store and retrieve a memory
docker exec -it agogsaas-agents-backend node --eval "
const {MCPMemoryClient} = require('./dist/mcp/mcp-client.service.js');
(async () => {
  const client = new MCPMemoryClient();
  const id = await client.storeMemory({
    agent_id: 'test',
    memory_type: 'test',
    content: 'This is a test memory'
  });
  console.log('✅ Stored memory:', id);
  const memories = await client.getAgentMemories('test', 5);
  console.log('✅ Retrieved', memories.length, 'memories');
  await client.close();
})();
"
```

### Manual Testing

```bash
# Check Ollama service
curl http://localhost:11434/api/tags

# Check model is installed
docker exec agogsaas-agents-ollama ollama list

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

# PostgreSQL Health Check (as used in docker-compose)
docker exec agogsaas-agents-postgres pg_isready -U agent_user -d agent_memory

# PostgreSQL pgvector extension (Agent Memory DB)
docker exec agogsaas-agents-postgres psql -U agent_user -d agent_memory \
  -c "SELECT extname FROM pg_extension WHERE extname='vector'"

# Memory count
docker exec agogsaas-agents-postgres psql -U agent_user -d agent_memory \
  -c "SELECT COUNT(*) FROM memories"

# SDLC Database Health Check
docker exec agogsaas-sdlc-postgres pg_isready -U sdlc_user -d sdlc_control
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
docker exec agogsaas-agents-ollama ollama pull nomic-embed-text
```

### Slow Embeddings

**Cause:** First-time model loading
**Expected:** First embedding takes ~2s, subsequent <50ms

### Zero Vector Results

**Cause:** Ollama not running or model not loaded
**Check:**
```bash
curl http://localhost:11434/api/tags
docker logs agogsaas-agents-ollama
```

## Integration with Layer 3 (Orchestration)

**Note:** The following is an example of how the orchestrator *could* integrate with the memory system. This integration is not yet implemented in `agent-backend/src/orchestration/orchestrator.service.ts`. This serves as a reference for future implementation.

```typescript
// EXAMPLE INTEGRATION (Not yet implemented in orchestrator.service.ts)
// Future integration point for storing agent learnings automatically

import { MCPMemoryClient } from '../mcp/mcp-client.service';

async function handleAgentCompletion(agentResult: any) {
  const memoryClient = new MCPMemoryClient();

  // Store agent's work in memory
  await memoryClient.storeMemory({
    agent_id: agentResult.agent,
    memory_type: agentResult.type,
    content: agentResult.summary,
    metadata: {
      feature: agentResult.feature,
      timestamp: Date.now(),
      req_number: agentResult.req_number
    }
  });

  // Search for related past work to provide context to agents
  const relatedMemories = await memoryClient.searchMemories({
    query: agentResult.summary,
    agent_id: agentResult.agent,
    limit: 3
  });

  await memoryClient.close();

  // Agents learn from past work across feature development!
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
