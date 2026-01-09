# Agentic Workflow Rules

These rules are MANDATORY. Violations are audit blockers.

---

## Rule 1: No Graceful Error Handling

**ALL workflow systems require ALL dependencies to be working.**

Dependencies:
- NATS (agent communication)
- SDLC Database (state tracking)
- Embeddings (semantic search, duplicate detection)

**If any dependency goes down:**
- Services MUST EXIT immediately (`process.exit(1)`)
- NO degraded mode, NO "keep running with warnings"
- Process supervisor restarts service
- Startup checks block until dependencies available

**Rationale:** Workflows that continue without all systems can produce inconsistent state, lost work, or duplicate work. This fails audits.

---

## Rule 2: Never Downgrade Errors to Warnings

**Errors cause system breaks BY DESIGN.**

- Never change `error` to `warn` in linters, compilers, or validators
- Never disable rules to bypass errors
- Never use `// @ts-ignore`, `eslint-disable`, or similar to hide errors
- Fix the actual error, not the symptom

**Rationale:** Errors exist to prevent bad code from shipping. Circumventing them allows defects into production.

---

## Rule 3: Catastrophic Priority Takes Precedence

**When catastrophic (P0) items exist, ALL other work stops.**

- Catastrophic items and their blockers get exclusive priority
- Lower priority work is paused until catastrophic is resolved
- This applies whether catastrophic is blocked, in_progress, or any other state

**Rationale:** P0 means the system is broken. Nothing else matters until it's fixed.

---

## Rule 4: Workflow Must Be Recoverable

**When workflow infrastructure fails, Sasha fixes it.**

- Sasha is the workflow expert agent
- Any agent detecting infrastructure issues triggers Sasha via host listener
- Host listener waits for Sasha to resolve before continuing
- Sasha can: restart containers, restart NATS, extend timeouts, fix configurations

**Rationale:** Workflow must self-heal. Human intervention should not be required for infrastructure issues.

---

## Rule 5: All Work Must Be Tracked

**Every piece of work must have an SDLC record.**

- No "shadow work" outside the system
- Phase transitions must be recorded
- Blocking relationships must be tracked
- Completion/failure must be logged

**Rationale:** Auditors need complete traceability of all work performed.

---

## Enforcement

These rules are enforced by:
1. **Startup checks** - Services fail to start if dependencies unavailable
2. **Runtime health checks** - Services exit if dependencies become unavailable
3. **Sasha agent** - Fixes infrastructure issues automatically
4. **CI/CD gates** - Builds fail on errors, not warnings

---

## Violations

If you find code that violates these rules:
1. Create a CATASTROPHIC priority REQ
2. Tag with `audit`, `compliance`
3. Fix immediately - these are blocking issues

---

*Last updated: 2026-01-09*
