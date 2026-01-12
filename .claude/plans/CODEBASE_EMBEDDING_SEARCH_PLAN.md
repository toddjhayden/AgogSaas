# Codebase Embedding & Search Plan

**Created:** 2026-01-11
**Status:** PLANNING
**Branch:** `feature/sdlc-separation` (same branch as separation work)
**Issue:** Agents using Task tool for codebase exploration, causing EPERM crashes. Need embedded codebase search via NATS.
**Context:** SDLC will become standalone product. Ollama, pgvector, NATS are install requirements.

---

## Dependencies

| Dependency | Plan | Status |
|------------|------|--------|
| **SDLC Separation** | [SDLC_SEPARATION_PLAN.md](./SDLC_SEPARATION_PLAN.md) | PLANNING |
| Fix Ollama 500 errors | Pre-requisite | PENDING |
| Clean tmpclaude files | Pre-requisite | PENDING |

**This plan should be implemented AFTER the SDLC separation is complete.** The codebase indexer will live in `sdlc/core/indexer/` and will read project config from `sdlc.config.json`.

---

## Problem Summary

1. **Agents need codebase context** to do their work (find existing patterns, understand structure)
2. **Task tool crashes** on Windows with EPERM symlink errors in `--print` mode
3. **Embeddings infrastructure exists** (Ollama, pgvector) but codebase isn't indexed
4. **No query mechanism** for agents to search codebase semantically
5. **142 orphaned tmpclaude files** from crashed Task tool sessions

---

## Solution Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     SDLC Infrastructure                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │ Codebase Indexer │───▶│    pgvector      │                  │
│  │     Daemon       │    │ (codebase_index) │                  │
│  └────────┬─────────┘    └────────▲─────────┘                  │
│           │                       │                             │
│           ▼                       │                             │
│  ┌──────────────────┐    ┌────────┴─────────┐                  │
│  │     Ollama       │    │  Search Responder │◀── NATS ──┐     │
│  │ (nomic-embed)    │    │     Service       │           │     │
│  └──────────────────┘    └──────────────────┘           │     │
│                                                          │     │
└──────────────────────────────────────────────────────────┼─────┘
                                                           │
                    agog.codebase.search ──────────────────┘
                                                           │
┌──────────────────────────────────────────────────────────┼─────┐
│                     Host Listener                        │     │
├──────────────────────────────────────────────────────────┼─────┤
│                                                          │     │
│  ┌──────────────────┐                                    │     │
│  │   Roy/Jen/etc    │──── query ─────────────────────────┘     │
│  │   (Agents)       │◀─── results ─────────────────────────────│
│  └──────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema

**Table: `codebase_index`** (in agent_memory database)

```sql
CREATE TABLE codebase_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_content TEXT NOT NULL,
  embedding vector(768),  -- nomic-embed-text dimensions

  -- Metadata for filtering
  file_type TEXT,         -- 'ts', 'tsx', 'graphql', 'sql', etc.
  module TEXT,            -- 'backend', 'frontend', 'agent-backend'
  component_type TEXT,    -- 'service', 'resolver', 'component', 'migration'

  -- For incremental updates
  file_hash TEXT NOT NULL,
  indexed_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(file_path, chunk_index)
);

-- Indexes for fast search
CREATE INDEX idx_codebase_embedding ON codebase_index
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_codebase_file_type ON codebase_index(file_type);
CREATE INDEX idx_codebase_module ON codebase_index(module);
CREATE INDEX idx_codebase_file_path ON codebase_index(file_path);
```

### Phase 2: Codebase Indexer Daemon

**File:** `agent-backend/src/indexer/codebase-indexer.daemon.ts`

**Responsibilities:**
1. Scan source directories on startup
2. Watch for file changes (chokidar)
3. Chunk files intelligently (by function/class/block)
4. Generate embeddings via Ollama
5. Store in pgvector
6. Skip unchanged files (hash comparison)

**Configuration:**
```typescript
const INDEXER_CONFIG = {
  // Directories to index (relative to project root)
  includePaths: [
    'Implementation/print-industry-erp/backend/src',
    'Implementation/print-industry-erp/frontend/src',
    'Implementation/print-industry-erp/agent-backend/src',
    '.claude/agents',
  ],

  // File types to index
  includeExtensions: ['.ts', '.tsx', '.graphql', '.sql', '.md'],

  // Directories to skip
  excludePaths: ['node_modules', 'dist', '.git', 'coverage'],

  // Chunking config
  maxChunkSize: 1500,  // chars (nomic-embed-text limit ~2048 tokens)
  chunkOverlap: 100,   // overlap for context continuity

  // Ollama
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  embeddingModel: 'nomic-embed-text',
};
```

**Chunking Strategy:**
- TypeScript/TSX: Chunk by function/class/interface
- GraphQL: Chunk by type/query/mutation
- SQL: Chunk by statement (CREATE TABLE, etc.)
- Markdown: Chunk by heading sections

### Phase 3: NATS Search Responder

**File:** `agent-backend/src/indexer/codebase-search.service.ts`

**NATS Topics:**
- Subscribe: `agog.codebase.search`
- Respond: inline reply

**Request Format:**
```typescript
interface CodebaseSearchRequest {
  query: string;           // Natural language query
  fileTypes?: string[];    // Filter: ['ts', 'tsx']
  modules?: string[];      // Filter: ['backend', 'frontend']
  limit?: number;          // Default: 5
  minSimilarity?: number;  // Default: 0.7
}
```

**Response Format:**
```typescript
interface CodebaseSearchResponse {
  success: boolean;
  results: Array<{
    filePath: string;
    chunkIndex: number;
    content: string;
    similarity: number;
    module: string;
    componentType: string;
  }>;
  totalFound: number;
  queryEmbeddingTime: number;
  searchTime: number;
}
```

**Implementation:**
```typescript
async handleSearch(request: CodebaseSearchRequest): Promise<CodebaseSearchResponse> {
  // 1. Generate embedding for query
  const queryEmbedding = await this.ollama.embed(request.query);

  // 2. Search pgvector with filters
  const sql = `
    SELECT
      file_path, chunk_index, chunk_content,
      module, component_type,
      1 - (embedding <=> $1::vector) as similarity
    FROM codebase_index
    WHERE 1=1
      ${request.fileTypes ? 'AND file_type = ANY($2)' : ''}
      ${request.modules ? 'AND module = ANY($3)' : ''}
    ORDER BY similarity DESC
    LIMIT $4
  `;

  // 3. Return results above threshold
  return results.filter(r => r.similarity >= request.minSimilarity);
}
```

### Phase 4: Agent Query Mechanism

**Problem:** Agents are Claude Code CLI processes. They can't directly publish to NATS.

**Solution Options:**

| Option | Pros | Cons |
|--------|------|------|
| **A. Bash + nats CLI** | Simple, works now | Requires nats CLI installed |
| **B. Bash + Node script** | No extra install | Verbose, slow startup |
| **C. HTTP endpoint** | Universal | Another port to manage |
| **D. Pre-fetch context** | No agent code needed | May miss relevant context |

**Recommended: Option D - Pre-fetch Context**

The host-agent-listener already fetches learnings and decisions before spawning agents (lines 923-924). Extend this to fetch relevant codebase context:

```typescript
// In host-agent-listener.ts spawnAgent()
const learnings = await this.getLearningsForAgent(agentId);
const previousDecisions = await this.getPreviousDecisions(reqNumber);
const codebaseContext = await this.getCodebaseContext(reqNumber, contextData);  // NEW

const contextInput = `...
RELEVANT CODEBASE CONTEXT (from semantic search):
${codebaseContext}
...`;
```

**How it works:**
1. Orchestrator assigns REQ to agent
2. Host listener receives spawn request
3. Host listener queries `agog.codebase.search` with REQ title/description
4. Host listener includes relevant code snippets in agent's context
5. Agent has context without needing to search

**Benefits:**
- No agent code changes needed
- No Task tool usage
- Consistent with existing pattern (learnings, decisions)
- Works for all agents automatically

### Phase 5: Health Monitoring

**Integrate with existing infrastructure health system:**

```typescript
// In sdlc-api.server.ts or health daemon

// Ollama health check
async checkOllamaHealth(): Promise<HealthStatus> {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
    const hasModel = response.data.models?.some(m => m.name.includes('nomic-embed'));
    return {
      component: 'ollama',
      status: hasModel ? 'healthy' : 'degraded',
      details: {
        available: true,
        embeddingModel: hasModel,
        models: response.data.models?.map(m => m.name),
      }
    };
  } catch (error) {
    return { component: 'ollama', status: 'down', error: error.message };
  }
}

// Codebase index health check
async checkCodebaseIndexHealth(): Promise<HealthStatus> {
  const stats = await pgPool.query(`
    SELECT
      COUNT(*) as total_chunks,
      COUNT(DISTINCT file_path) as total_files,
      MAX(indexed_at) as last_indexed
    FROM codebase_index
  `);

  return {
    component: 'codebase_index',
    status: stats.rows[0].total_chunks > 0 ? 'healthy' : 'empty',
    details: stats.rows[0],
  };
}
```

**NATS Heartbeat Topic:** `agog.infrastructure.health.ollama`
**NATS Heartbeat Topic:** `agog.infrastructure.health.codebase_index`

---

## Updated Agent Instructions

Remove Task tool exploration. Add pre-fetched context note:

```markdown
## Codebase Context

Relevant code snippets are provided in your context (RELEVANT CODEBASE CONTEXT section).
This is pre-fetched via semantic search based on your task.

If you need additional context:
1. Use `Glob` to find files by pattern
2. Use `Grep` to search content
3. Use `Read` to read specific files

DO NOT use Claude Code's Task tool - it crashes on Windows.
```

---

## File Changes Required

| File | Change |
|------|--------|
| `agent-backend/src/indexer/codebase-indexer.daemon.ts` | **NEW** - Indexer daemon |
| `agent-backend/src/indexer/codebase-search.service.ts` | **NEW** - NATS search responder |
| `agent-backend/scripts/host-agent-listener.ts` | Add `getCodebaseContext()` |
| `agent-backend/src/api/sdlc-api.server.ts` | Add health endpoints |
| `.claude/agents/AGOG_AGENT_ONBOARDING.md` | Update context instructions |
| `.claude/agents/*.md` | Remove Task tool exploration guidance |
| Database migration | Add `codebase_index` table |

---

## Rollout Plan

### Step 1: Fix Immediate Issues
- [ ] Check Ollama status (500 errors)
- [ ] Clean up 142 tmpclaude files
- [ ] Verify NATS connection

### Step 2: Database
- [ ] Create `codebase_index` table migration
- [ ] Add pgvector indexes

### Step 3: Indexer Daemon
- [ ] Implement codebase-indexer.daemon.ts
- [ ] Add to docker-compose.agents.yml
- [ ] Initial full index

### Step 4: Search Service
- [ ] Implement codebase-search.service.ts
- [ ] Subscribe to `agog.codebase.search`
- [ ] Test with sample queries

### Step 5: Host Listener Integration
- [ ] Add `getCodebaseContext()` method
- [ ] Include in agent context
- [ ] Test with agent spawn

### Step 6: Agent Persona Updates
- [ ] Update AGOG_AGENT_ONBOARDING.md
- [ ] Update individual agent files
- [ ] Remove Task tool references

### Step 7: Health Monitoring
- [ ] Add Ollama health check
- [ ] Add codebase index health check
- [ ] Integrate with SDLC dashboard

---

## SDLC Product Considerations

This architecture is designed for SDLC as a standalone product:

| Requirement | How It's Met |
|-------------|--------------|
| Ollama required | Embedding generation + health check |
| pgvector required | Codebase index storage + similarity search |
| NATS required | Search topic + health heartbeats |
| Works on install | Indexer runs on startup, indexes codebase |
| No Docker MCP dependency | Native services, not MCP |
| Customer deployable | All components in docker-compose |

---

## Success Criteria

1. **No Task tool crashes** - agents don't use Task tool for exploration
2. **Agents have context** - relevant code provided in spawn context
3. **Fast searches** - semantic search < 500ms
4. **Fresh index** - file changes reflected within 60s
5. **Health visible** - Ollama + index health in SDLC dashboard
6. **Clean tmpclaude** - no orphaned temp files accumulating
