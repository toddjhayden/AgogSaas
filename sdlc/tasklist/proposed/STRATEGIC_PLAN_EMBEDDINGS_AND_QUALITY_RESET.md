# Strategic Plan: AgogSaaS Application Embeddings & Quality Reset

**Created:** 2026-01-12
**Status:** PROPOSED
**Priority:** CATASTROPHIC

---

## Background

Due to a recovery daemon bug, all VPS database requests were reset to `backlog` phase. Rather than attempting to recover lost workflow state, this plan uses the incident as an opportunity to:

1. Build application codebase embeddings infrastructure (long overdue)
2. Audit the actual application quality
3. Fix real issues based on testing, not assumptions

---

## Scope Clarification

**EMBEDDING TARGET: AgogSaaS Application (print-industry-erp)**
- `projects/print-industry-erp/backend/` - NestJS API, GraphQL, services
- `projects/print-industry-erp/frontend/` - React application

**NOT embedding:**
- `sdlc/` - The orchestration system itself (separate codebase)

The goal is for agents to understand the **application they are building**, not the tools they run on.

---

## Phase 1: Application Codebase Embeddings

**Goal:** Index the AgogSaaS print-industry-erp application so agents can semantically search "what exists in the application"

### Tasks

1. **Create Embeddings Indexer Daemon**
   - Location: `sdlc/core/src/proactive/embeddings-indexer.daemon.ts`
   - Uses: Ollama with `nomic-embed-text` model (sdlc-ollama container)
   - Indexes: `projects/print-industry-erp/backend/`, `projects/print-industry-erp/frontend/`
   - **Does NOT index:** `sdlc/` directory

2. **Database Schema**
   - Table: `codebase_embeddings`
   - Columns: `file_path`, `chunk_text`, `embedding_vector`, `file_hash`, `indexed_at`
   - Use pgvector for similarity search

3. **Indexing Strategy**
   - Chunk files by function/class boundaries
   - Re-index on file hash change
   - Run on startup + watch for changes

4. **Agent Query Interface**
   - NATS subject: `agog.embeddings.query`
   - Input: natural language query
   - Output: relevant code chunks with file paths

### Acceptance Criteria
- [ ] Indexer daemon runs without errors
- [ ] All .ts/.tsx files indexed
- [ ] Agents can query "where is X implemented?"
- [ ] Results include file path + line numbers

---

## Phase 2: Application Quality Audit

**Goal:** Sam's team tests the actual application and creates REQs for real issues

### Tasks

1. **Sam Startup Audit**
   - Build verification: `npm run build` exits 0
   - Test suite: `npm test` passes
   - Type checking: `tsc --noEmit` passes
   - Security: `npm audit` no critical vulnerabilities

2. **Functional Testing**
   - API endpoints respond correctly
   - Database migrations applied
   - Authentication/authorization works
   - Core business flows functional

3. **Create CATASTROPHIC REQs**
   - Build failures → P0
   - Test failures → P0
   - Security vulnerabilities → P0
   - Type errors → High priority

### Acceptance Criteria
- [ ] Full audit completes without timeout
- [ ] All critical issues have REQs created
- [ ] REQs include reproduction steps

---

## Phase 3: Agent Workflow with Embeddings

**Goal:** Agents use embeddings to check "is this already done?" before working

### Workflow

```
REQ/REC enters workflow
        ↓
Agent queries embeddings: "Has this been implemented?"
        ↓
    ┌───┴───┐
    │       │
  Found   Not Found
    │       │
    ↓       ↓
Verify   Implement
working  the feature
    │       │
    ↓       ↓
Update   Update code
NATS     + embeddings
only     + NATS
```

### Benefits
- No duplicate work
- Self-healing system
- Reality-based progress tracking
- Codebase is source of truth

---

## Implementation Order

1. **Week 1:** Embeddings infrastructure
   - Database schema
   - Indexer daemon
   - Query interface

2. **Week 2:** Sam audit integration
   - Update Sam to use embeddings
   - Enhanced audit checks
   - REQ creation for failures

3. **Week 3:** Agent workflow integration
   - Agents query embeddings before work
   - Update workflow stages
   - Test end-to-end

---

## Success Metrics

- Embeddings index covers 100% of application codebase (print-industry-erp)
- Sam audit identifies all broken code
- Agents successfully skip already-implemented features
- Zero duplicate implementations

---

## Dependencies

| Component | Status | Notes |
|-----------|--------|-------|
| sdlc-ollama | Running | Has nomic-embed-text |
| pgvector | Unknown | Need to verify on VPS |
| NATS JetStream | Running | 12 streams, data intact |
| VPS API | Running | api.agog.fyi |

---

## Risks

1. **pgvector not installed on VPS** - May need migration
2. **Large codebase** - Chunking strategy important
3. **Embedding quality** - May need tuning

---

## Notes

This plan turns an incident (database reset) into an opportunity to build proper infrastructure. The codebase becomes the source of truth, not workflow state.
