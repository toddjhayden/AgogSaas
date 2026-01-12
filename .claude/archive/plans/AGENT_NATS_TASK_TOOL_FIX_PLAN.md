# Agent NATS/Task Tool Fix Plan

**Created:** 2026-01-11
**Implemented:** 2026-01-11
**Verified Complete:** 2026-01-12
**Status:** COMPLETE (ALL AGENTS UPDATED)
**Issue:** Agents using Claude Code's Task tool instead of NATS for agent spawning, causing EPERM symlink errors on Windows

## Completion Verification (2026-01-12)

All agent personas now have Task Tool prohibition:

### Original Plan Agents (verified):
- ✅ AGOG_AGENT_ONBOARDING.md
- ✅ WORKFLOW_RULES.md (Rule 6)
- ✅ sam-senior-auditor.md
- ✅ roy-backend.md
- ✅ jen-frontend.md
- ✅ billy-qa.md
- ✅ liz-frontend-tester.md
- ✅ todd-performance-tester.md
- ✅ vic-security-tester.md
- ✅ cynthia-research-new.md
- ✅ sylvia-critique.md
- ✅ priya-statistics.md
- ✅ berry-devops.md
- ✅ tim-documentation.md
- ✅ miki-devops.md

### Additional Agents (added 2026-01-12):
- ✅ chuck-senior-review-agent.md
- ✅ sasha-workflow-expert.md
- ✅ value-chain-expert.md
- ✅ strategic-recommendation-generator.md
- ✅ marcus-warehouse-po.md
- ✅ sarah-sales-po.md
- ✅ alex-procurement-po.md
- ✅ orchestrator.md

---

---

## Problem Summary

1. **Agents use Task tool** (Claude Code built-in) to spawn subagents
2. **Task tool fails on Windows** with symlink EPERM errors in `--print` mode
3. **Correct workflow:** Request spawns via NATS, let host-agent-listener spawn
4. **Confusion:** Personas tell agents "don't use NATS" for APPLICATION code, but agents interpret this as "NATS isn't available to me"

---

## Agent Categorization

### COORDINATOR AGENTS (CAN Request Spawns via NATS)

| Agent | File | Role | Notes |
|-------|------|------|-------|
| **Sam** | `sam-senior-auditor.md` | Senior Auditor | Already has NATS spawn instructions |
| **Orchestrator** | `orchestrator.md` | Work Router | Manages spawn lifecycle |

### IMPLEMENTATION AGENTS (CANNOT Request Spawns)

| Agent | File | Role | Notes |
|-------|------|------|-------|
| **Roy** | `roy-backend.md` | Backend Developer | Works on APPLICATION code |
| **Jen** | `jen-frontend.md` | Frontend Developer | Works on APPLICATION code |

### QA AGENTS (CANNOT Request Spawns)

| Agent | File | Role | Notes |
|-------|------|------|-------|
| **Billy** | `billy-qa.md` | Backend QA | Flags specialists via `needs_*` |
| **Liz** | `liz-frontend-tester.md` | Frontend QA | Flags specialists via `needs_*` |
| **Todd** | `todd-performance-tester.md` | Performance (conditional) | Triggered by Billy/Liz |
| **Vic** | `vic-security-tester.md` | Security (conditional) | Triggered by Billy/Liz |

### RESEARCH/CRITIQUE AGENTS (CANNOT Request Spawns)

| Agent | File | Role | Notes |
|-------|------|------|-------|
| **Cynthia** | `cynthia-research-new.md` | Research | First in pipeline |
| **Sylvia** | `sylvia-critique.md` | Gate/Critique | Quality gate |

### SUPPORT AGENTS (CANNOT Request Spawns)

| Agent | File | Role | Notes |
|-------|------|------|-------|
| **Priya** | `priya-statistics.md` | Statistics | Metrics |
| **Berry** | `berry-devops.md` | DevOps | Git commits, deploys |
| **Tim** | `tim-documentation.md` | Documentation | Docs |
| **Miki** | `miki-devops.md` | Infrastructure | Docker, containers |

### OTHER AGENTS (Role-Specific)

| Agent | File | Role | Spawn Permission |
|-------|------|------|------------------|
| **Strategic Rec Gen** | `strategic-recommendation-generator.md` | Recommendations | NO |
| **Sasha** | `sasha-workflow-expert.md` | Workflow rules | NO |
| **Value Chain Expert** | `value-chain-expert.md` | Chain analysis | NO |

---

## Changes Required

### 1. AGOG_AGENT_ONBOARDING.md (CRITICAL - All agents read this)

**Add new section after "Architecture Separation":**

```markdown
---

## CRITICAL: Your Runtime vs Application Code

**You exist in TWO contexts - understand the difference:**

### Context 1: YOUR RUNTIME ENVIRONMENT (Agent Infrastructure)

You are running inside the agent infrastructure where these services ARE available:

| Service | URL | Purpose |
|---------|-----|---------|
| NATS | `nats://localhost:4223` | Agent-to-agent messaging |
| Ollama | `http://localhost:11434` | Local LLM for embeddings |
| Agent DB | `localhost:5434` | Agent memory (pgvector) |
| SDLC API | `https://api.agog.fyi` | Workflow control |

**You CAN use these for agent operations** (requesting spawns, publishing deliverables).

### Context 2: APPLICATION CODE YOU WRITE

The application code you generate must work WITHOUT agent infrastructure:

| What | Rule |
|------|------|
| Backend package.json | NO `nats` dependency |
| Frontend package.json | NO `nats.ws` dependency |
| Application startup | Must work if NATS is down |
| Production deployment | No agent services available |

**The code you WRITE cannot depend on NATS. But YOU (the agent) CAN use NATS.**

---

## CRITICAL: Task Tool Prohibition

**NEVER use Claude Code's Task tool to spawn subagents.**

The Task tool fails on Windows with symlink EPERM errors. It also bypasses the NATS workflow.

**If you need another agent:**

| Your Role | What To Do |
|-----------|------------|
| **Sam** | Use NATS: `nc.publish('agog.spawn.request', ...)` |
| **All Others** | Note it in deliverable, let Sam/Orchestrator coordinate |

**NEVER use:**
- Task tool
- Subagent spawning
- Direct agent-to-agent calls
```

### 2. WORKFLOW_RULES.md (Add spawn rules)

**Add section:**

```markdown
---

## Agent Spawn Rules

### Who Can Request Agent Spawns

| Agent | Can Request Spawns? | Method |
|-------|---------------------|--------|
| Sam | YES | NATS: `agog.spawn.request` |
| Orchestrator | YES | Built-in to listener |
| All Others | NO | Note in deliverable |

### How Spawns Work

1. **Sam** publishes to `agog.spawn.request` via NATS
2. **Host-Agent-Listener** receives message
3. **Listener** spawns agent with `--dangerously-skip-permissions --print`
4. **Agent** completes work, publishes deliverable
5. **Listener** captures result

### Prohibited

- DO NOT use Claude Code's Task tool
- DO NOT spawn agents directly
- DO NOT bypass NATS workflow
```

### 3. Per-Agent Changes

#### Sam (sam-senior-auditor.md)

**Add/reinforce:**

```markdown
## CRITICAL: Agent Spawning Method

**You are the ONLY non-orchestrator agent that can request spawns.**

**ALWAYS use NATS:**
```bash
node -e "
const {connect,StringCodec}=require('nats');
(async()=>{
  const nc=await connect({servers:'nats://localhost:4223',user:'agents',pass:process.env.NATS_PASSWORD});
  nc.publish('agog.spawn.request',StringCodec().encode(JSON.stringify({
    agentId:'roy',
    reqNumber:'REQ-XXX',
    priority:'P0',
    description:'Fix issue'
  })));
  await nc.drain();
})();
"
```

**NEVER use Claude Code's Task tool** - it fails on Windows with symlink errors.
```

#### Roy (roy-backend.md)

**Clarify the NATS section:**

```markdown
## CRITICAL: Two Contexts - Understand the Difference

### Context 1: YOUR Agent Runtime
You are running in agent infrastructure where NATS IS available.
- You CAN publish deliverables to NATS
- You CANNOT spawn other agents (Sam does that)

### Context 2: APPLICATION Code You Write
The backend code you create must work WITHOUT NATS:
- NO nats in package.json
- NO NATS imports in application code
- Application must start without agent services

**Summary:**
- YOU can use NATS (for deliverables)
- YOUR CODE cannot depend on NATS

## CRITICAL: Do NOT Spawn Other Agents

You are an implementation agent. If you need another agent:
1. Note the dependency in your deliverable
2. Sam or Orchestrator will coordinate

**NEVER use:**
- Task tool to spawn subagents
- Direct NATS spawn requests
```

#### Jen (jen-frontend.md)

**Same clarification as Roy:**

```markdown
## CRITICAL: Two Contexts - Understand the Difference

### Context 1: YOUR Agent Runtime
You are running in agent infrastructure where NATS IS available.
- You CAN publish deliverables to NATS
- You CANNOT spawn other agents (Sam does that)

### Context 2: APPLICATION Code You Write
The frontend code you create must work WITHOUT NATS:
- NO nats.ws in package.json
- NO WebSocket connections to agent system
- Application must work without agent infrastructure

**Summary:**
- YOU can use NATS (for deliverables)
- YOUR CODE cannot depend on NATS

## CRITICAL: Do NOT Spawn Other Agents

You are an implementation agent. If you need another agent:
1. Note the dependency in your deliverable
2. Sam or Orchestrator will coordinate

**NEVER use:**
- Task tool to spawn subagents
- Direct NATS spawn requests
```

#### All QA Agents (Billy, Liz, Todd, Vic)

**Add to each:**

```markdown
## CRITICAL: Do NOT Spawn Other Agents

You are a QA agent. If you need a specialist:
- Set `needs_todd: true` for performance concerns
- Set `needs_vic: true` for security concerns
- The workflow will route appropriately

**NEVER use:**
- Task tool to spawn subagents
- Direct NATS spawn requests
```

#### All Research/Support Agents (Cynthia, Sylvia, Priya, Berry, Tim, Miki)

**Add to each:**

```markdown
## CRITICAL: Do NOT Spawn Other Agents

Complete your assigned task. If additional work is needed:
1. Note it in your deliverable
2. Sam or Orchestrator will coordinate

**NEVER use:**
- Task tool to spawn subagents
- Direct NATS spawn requests
```

---

## Implementation Order

1. **AGOG_AGENT_ONBOARDING.md** - All agents read this first
2. **WORKFLOW_RULES.md** - Core spawn rules
3. **sam-senior-auditor.md** - Reinforce NATS method
4. **roy-backend.md** - Clarify two contexts
5. **jen-frontend.md** - Clarify two contexts
6. **All QA agents** - Add prohibition
7. **All other agents** - Add prohibition

---

## Testing After Changes

1. Start the workflow system
2. Trigger a REQ that involves Roy/Jen
3. Monitor logs for:
   - NO Task tool usage
   - NO symlink errors
   - Deliverables published via NATS correctly
4. If Sam needs to spawn agents, verify NATS method works

---

## Files to Modify

| File | Change Type | Priority |
|------|-------------|----------|
| `AGOG_AGENT_ONBOARDING.md` | Add section | P0 |
| `WORKFLOW_RULES.md` | Add spawn rules | P0 |
| `sam-senior-auditor.md` | Reinforce NATS | P0 |
| `roy-backend.md` | Clarify contexts | P0 |
| `jen-frontend.md` | Clarify contexts | P0 |
| `billy-qa.md` | Add prohibition | P1 |
| `liz-frontend-tester.md` | Add prohibition | P1 |
| `todd-performance-tester.md` | Add prohibition | P1 |
| `vic-security-tester.md` | Add prohibition | P1 |
| `cynthia-research-new.md` | Add prohibition | P1 |
| `sylvia-critique.md` | Add prohibition | P1 |
| `priya-statistics.md` | Add prohibition | P1 |
| `berry-devops.md` | Add prohibition | P1 |
| `tim-documentation.md` | Add prohibition | P1 |
| `miki-devops.md` | Add prohibition | P1 |

---

## Summary

**Root Cause:** Agents don't know they can use NATS for agent communication, and don't know Task tool is prohibited.

**Fix:**
1. Clarify "your runtime" vs "application code" contexts
2. Explicitly prohibit Task tool
3. Explain spawn workflow (only Sam, via NATS)

**Expected Outcome:** No more symlink EPERM errors, correct NATS-based spawn workflow.
