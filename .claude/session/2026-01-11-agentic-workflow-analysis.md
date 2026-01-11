# Session: Agentic Workflow Analysis & Priority System Fix

**Date:** 2026-01-11
**Repository:** D:\GitHub\agogsaas

---

## Topics Covered

### 1. Agentic Workflow Architecture

- **Orchestrator Service** (`agent-backend/src/orchestration/strategic-orchestrator.service.ts`) - NestJS service that manages workflow state
- **Agent Spawner** - Launches Claude CLI agents via Host Listener
- **NATS JetStream** - Message broker for inter-agent communication
- **SDLC API** - Cloud-hosted at `https://api.agog.fyi` controls work queue

### 2. Priority System Fix (COMPLETED)

Updated P0-P4 mapping to match intended priority levels:

| Level | P-Code | Name | Description |
|-------|--------|------|-------------|
| 1 | P0 | catastrophic | Building on fire - everything stops |
| 2 | P1 | critical | Production down, security issues |
| 3 | P2 | high | Blocking other work, user-facing bugs |
| 4 | P3 | medium | New features, enhancements |
| 5 | P4 | low | Documentation, cleanup |

**Files Modified:**
- `agent-backend/src/proactive/recommendation-publisher.service.ts` - priorityMap, type definition
- `agent-backend/src/proactive/value-chain-expert.daemon.ts` - type definition
- `agent-backend/src/orchestration/strategic-orchestrator.service.ts` - comments

### 3. Current System State (as of session)

| Phase | Count |
|-------|-------|
| backlog | 48 |
| in_progress | 36 (PROBLEM: over 10-item limit) |
| qa | 4 |
| blocked | 71 |
| done | 45 |

**Key Issues Identified:**
- 36 items IN_PROGRESS but only 10 should be (WIP overload)
- 18 items IN_PROGRESS with no agent assigned
- 21 catastrophic items BLOCKED with no escalation path
- Work starts but doesn't finish

### 4. Priority/Preemption Rules Discussed

**Agreed Approach:**
- IN_PROGRESS work continues until finished (no preemption)
- When slot opens, lowest P-code (highest priority) chosen next
- Existing IN_PROGRESS catastrophic continues over new catastrophic (FIFO)
- New catastrophic gets next available slot (skips queue)

### 5. Blocked Catastrophic Escalation Plan (CREATED)

Created plan at: `D:\GitHub\agogsaas\.claude\plans\blocked-catastrophic-escalation.md`

**Phases:**
- **B:** Auto-retry (3 attempts before creating P0)
- **C:** Diagnostic agent (gather failure data)
- **D:** Adaptive timeout (based on historical duration)
- **E:** Root cause fixes (from diagnostic data)
- **A:** Human notification via SDLC GUI (last resort)

### 6. Audit Timeout Root Cause

"Audit timed out after 120 minutes" issues caused by:
- Agent not spawned (Host Listener race condition)
- Agent crashed mid-audit
- Slow database queries
- NATS message loss
- Response not reaching Sam

Currently creates P0 "manual review required" that sits in BLOCKED forever.

---

## Completed Work

### WIP Limit Enforcement (COMPLETED 2026-01-11)

All parts of `wip-limit-enforcement.md` have been implemented (plan archived to `.claude/archive/plans/`):

| Task | Status |
|------|--------|
| Quick Win 1: Reduce MAX_CONCURRENT_WORKFLOWS to 3 | DONE |
| Quick Win 2: Move 18 unassigned IN_PROGRESS to BACKLOG | DONE |
| Quick Win 3: Move 11 marcus/sarah items to BACKLOG | DONE |
| Part 2: Finish-first policy | DONE |
| Part 3: Orphan cleanup service | DONE |
| Part 4: Stage tracking service | DONE |

**Results:**
- IN_PROGRESS reduced from 36 to 7 items
- Created `orphan-cleanup.service.ts` - runs every 15 min
- Created `stage-tracker.service.ts` - monitors workflow progression
- Finish-first policy prevents new work when existing is stalled

### Workflow Directive Enhancements (COMPLETED 2026-01-11)

All parts of `workflow-directive-enhancements.md` have been implemented:

| Task | Status |
|------|--------|
| Part 1: Add targetType 'list' support | DONE |
| Part 2: Add expandBlockers option | DONE |
| Part 3: Fix top-priority (reversible), add escalate-priority | DONE |
| Part 4: Update SDLC-AI-API-REFERENCE.md | DONE |

**Results:**
- Scrum masters can now select hand-picked lists of REQs for weekend sprints
- `expandBlockers: true` auto-includes blockers of blocked items
- `top-priority` is now reversible (creates directive, doesn't mutate priority)
- New `escalate-priority` endpoint for permanent priority changes (rare use)
- API documentation updated with new endpoints and options

### Blocked Catastrophic Escalation (IN PROGRESS 2026-01-11)

Phases B, C, D, E of `blocked-catastrophic-escalation.md` have been implemented:

| Phase | Description | Status |
|-------|-------------|--------|
| Phase B | Auto-retry with exponential backoff (30s, 60s, 120s) | DONE |
| Phase C | Diagnostic Agent for failure analysis | DONE |
| Phase D | Adaptive timeout based on historical data | DONE |
| Phase E | Root cause pattern detection with auto-fix REQs | DONE |
| Phase A | Human notification via SDLC GUI | PENDING (requires SDLC GUI) |

**Results:**
- Created `audit-diagnostics.service.ts` - comprehensive diagnostic checks
- Sam now retries 3 times before creating P0 (transient failure recovery)
- Diagnostic report automatically attached to P0 REQs
- Auto-fix REQs created for 6 known root cause patterns:
  1. Host Listener not running
  2. Database performance degradation
  3. Memory exhaustion
  4. CPU overload
  5. Agent spawn failures
  6. NATS messaging issues
- Timeout adapts to historical audit duration (30min floor, 4hr ceiling, 1.5x buffer)

## Open Items / Next Steps

1. **Phase A: SDLC GUI Escalation Dashboard** - Human notification for unresolved escalations
2. **Tune thresholds** - Adjust STALLED_THRESHOLD_MS and STAGE_TIMEOUTS based on real-world data
3. **Observe timeout rate** - Verify 80%+ reduction in false positives from adaptive timeout

## Plans Created

| Plan | Purpose | Status |
|------|---------|--------|
| `workflow-directive-enhancements.md` | Hand-picked lists, expandBlockers, reversible top-priority | IMPLEMENTED |
| `blocked-catastrophic-escalation.md` | Fix stuck BLOCKED catastrophic items | PHASES B-E IMPLEMENTED |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `agent-backend/src/orchestration/strategic-orchestrator.service.ts` | Main workflow orchestration |
| `agent-backend/src/orchestration/orchestrator.service.ts` | Stage execution |
| `agent-backend/src/orchestration/orphan-cleanup.service.ts` | NEW - Orphan detection/recovery |
| `agent-backend/src/orchestration/stage-tracker.service.ts` | NEW - Stage flow tracking |
| `agent-backend/src/proactive/senior-auditor.daemon.ts` | Sam - audit timeouts, auto-retry, adaptive timeout |
| `agent-backend/src/proactive/audit-diagnostics.service.ts` | NEW - Diagnostic service for failure analysis |
| `agent-backend/src/proactive/recommendation-publisher.service.ts` | Priority mapping |
| `agent-backend/src/api/sdlc-api.client.ts` | SDLC cloud API client |
| `.claude/agents/*.md` | Agent definitions |
| `.claude/plans/blocked-catastrophic-escalation.md` | Escalation plan (Phases B-E implemented) |
| `.claude/plans/workflow-directive-enhancements.md` | Directive enhancements (IMPLEMENTED) |
| `.claude/archive/plans/wip-limit-enforcement.md` | WIP limit plan (ARCHIVED) |
| `.claude/docs/SDLC-AI-API-REFERENCE.md` | SDLC AI API documentation |

---

## Commands to Start System

```bash
cd D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend
START_SYSTEM.bat
```

Starts:
- Docker containers (NATS, PostgreSQL, Ollama)
- Agent Backend (Strategic Orchestrator)
- Host Listener (spawns Claude agents)

---

## Session Context

User is the system owner reviewing why:
1. Work gets started but doesn't complete
2. Catastrophic items get stuck in BLOCKED
3. Priority system wasn't correctly mapped

Goal is to make the agentic workflow system more robust with proper escalation paths.
