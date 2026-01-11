# Plan: Workflow Directive Enhancements

**Created:** 2026-01-11
**Completed:** 2026-01-11
**Status:** IMPLEMENTED
**Priority:** P2 (high - enables scrum master workflow control)

## Problem Statement

The current workflow directive system supports blocker chains and filter criteria, but lacks:

1. **Hand-picked list support** - Scrum master cannot select arbitrary unrelated items
2. **Blocker auto-expansion** - Blocked items in a focus set can't complete if blockers are outside scope
3. **Reversible priority elevation** - `top-priority` endpoint permanently mutates priority

### Use Case: Weekend Sprint

```
Scrum Master scenario:
1. Selects 50 unrelated "quick win" items
2. Some are blocked, some are not
3. Sets 24-hour timer
4. Monday: clears focus, returns to normal

Current system cannot handle this correctly.
```

---

## Solution: Three Enhancements

### Part 1: Add `targetType: 'list'` Support
### Part 2: Add `expandBlockers` Option
### Part 3: Fix `top-priority` Endpoint

---

## Part 1: Add `targetType: 'list'` Support

**Goal:** Allow hand-picked list of REQ numbers as directive target

### API Change

```typescript
POST /workflow/directive
{
  "directiveType": "focus",
  "displayName": "Weekend sprint - 50 quick wins",
  "targetType": "list",                              // NEW
  "targetReqNumbers": ["REQ-001", "REQ-002", ...],   // Direct list
  "expiresAt": "2026-01-12T18:00:00Z",
  "exclusive": true,
  "autoRestore": true
}
```

### Implementation

File: `agent-backend/src/api/sdlc-api.server.ts`

Add to directive endpoint (around line 2758):

```typescript
} else if (targetType === 'list' && Array.isArray(req.body.targetReqNumbers)) {
  // Direct list of REQ numbers provided
  targetReqNumbers = req.body.targetReqNumbers;

  // Validate all REQs exist
  const validationResult = await this.db.query(`
    SELECT req_number FROM owner_requests
    WHERE req_number = ANY($1)
  `, [targetReqNumbers]);

  const validReqs = new Set(validationResult.map((r: any) => r.req_number));
  const invalidReqs = targetReqNumbers.filter(r => !validReqs.has(r));

  if (invalidReqs.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Invalid REQ numbers: ${invalidReqs.join(', ')}`
    });
  }
}
```

### Success Criteria
- [ ] `targetType: 'list'` accepted by directive endpoint
- [ ] `targetReqNumbers` array stored in directive
- [ ] Invalid REQ numbers rejected with error
- [ ] Orchestrator correctly filters to list items

---

## Part 2: Add `expandBlockers` Option

**Goal:** Automatically include blockers of any blocked items in the list

### The Problem

```
Focus Set                     Outside Focus
┌─────────────────────┐       ┌─────────────────┐
│ REQ-A (blocked) ────┼──────→│ REQ-X (blocker) │
│ REQ-B (unblocked)   │       │                 │
└─────────────────────┘       └─────────────────┘

With exclusive=true and no expansion:
- REQ-X won't be worked (outside scope)
- REQ-A can NEVER complete
```

### API Change

```typescript
POST /workflow/directive
{
  "directiveType": "focus",
  "targetType": "list",
  "targetReqNumbers": ["REQ-A", "REQ-B"],
  "expandBlockers": true,    // NEW: auto-include REQ-X
  "exclusive": true
}
```

### Implementation

File: `agent-backend/src/api/sdlc-api.server.ts`

After resolving targetReqNumbers, add blocker expansion:

```typescript
// Expand to include blockers if requested
if (req.body.expandBlockers && targetReqNumbers.length > 0) {
  const originalCount = targetReqNumbers.length;

  // Find all blockers for blocked items in the list
  const blockerExpansion = await this.db.query(`
    WITH RECURSIVE blocker_tree AS (
      -- Start with blocked items in our list
      SELECT DISTINCT rb.blocking_request_id as id
      FROM request_blockers rb
      JOIN owner_requests blocked ON blocked.id = rb.blocked_request_id
      WHERE blocked.req_number = ANY($1)
        AND rb.resolved_at IS NULL

      UNION

      -- Recursively find blockers of blockers
      SELECT rb.blocking_request_id
      FROM blocker_tree bt
      JOIN request_blockers rb ON rb.blocked_request_id = bt.id
      WHERE rb.resolved_at IS NULL
    )
    SELECT DISTINCT r.req_number
    FROM blocker_tree bt
    JOIN owner_requests r ON r.id = bt.id
    WHERE r.req_number != ALL($1)  -- Exclude items already in list
  `, [targetReqNumbers]);

  const additionalBlockers = blockerExpansion.map((r: any) => r.req_number);
  targetReqNumbers = [...targetReqNumbers, ...additionalBlockers];

  if (additionalBlockers.length > 0) {
    console.log(`[SDLC API] Expanded directive: +${additionalBlockers.length} blockers`);
  }
}
```

### Response Enhancement

Return info about blocked items and expansion:

```json
{
  "success": true,
  "data": {
    "directiveId": "uuid",
    "displayName": "Weekend sprint",
    "targetReqNumbers": ["REQ-A", "REQ-B", "REQ-X"],
    "originalCount": 2,
    "expandedCount": 3,
    "addedBlockers": ["REQ-X"],
    "blockedItemsInScope": 1,
    "message": "Directive created. Added 1 blocker to ensure completion."
  }
}
```

### Success Criteria
- [ ] `expandBlockers: true` triggers blocker expansion
- [ ] Recursive blocker tree traversal works
- [ ] Response shows original vs expanded counts
- [ ] Orchestrator works on blockers first (existing sorting)

---

## Part 3: Fix `top-priority` Endpoint

**Goal:** Make `top-priority` reversible by using directive instead of priority mutation

### Current Behavior (Wrong)

```typescript
// Permanently mutates priority - NOT reversible
SET priority = 'catastrophic'
```

### New Behavior

```typescript
// Creates blocker-chain directive - reversible
POST /workflow/focus/blocker-chain
```

### Implementation

File: `agent-backend/src/api/sdlc-api.server.ts`

Replace lines 2580-2613:

```typescript
// Set top priority (creates blocker-chain directive, does NOT mutate priority)
router.post('/requests/:reqNumber/top-priority', async (req: Request, res: Response) => {
  try {
    const { reqNumber } = req.params;
    const { reason, createdBy = 'ai-assist', expiresAt } = req.body;

    // Verify request exists
    const reqResult = await this.db.query(
      `SELECT req_number, title, is_blocked FROM owner_requests WHERE req_number = $1`,
      [reqNumber]
    );

    if (reqResult.length === 0) {
      return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
    }

    const request = reqResult[0];

    // Create blocker-chain directive (reversible, includes blockers)
    // Forward to blocker-chain endpoint
    req.body = {
      reqNumber,
      reason: reason || `Top priority set for ${reqNumber}`,
      createdBy,
      expiresAt
    };

    // Use the blocker-chain handler
    const blockerChainHandler = router.stack.find((layer: any) =>
      layer.route?.path === '/workflow/focus/blocker-chain' && layer.route?.methods?.post
    );

    if (blockerChainHandler?.route?.stack?.[0]?.handle) {
      return blockerChainHandler.route.stack[0].handle(req, res, () => {});
    }

    res.status(500).json({ success: false, error: 'Could not create directive' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Add Separate Escalate Endpoint (for permanent changes)

For rare cases where permanent priority change IS needed:

```typescript
// Permanently escalate priority (irreversible - use sparingly)
router.post('/requests/:reqNumber/escalate-priority', async (req: Request, res: Response) => {
  try {
    const { reqNumber } = req.params;
    const { priority, reason, updatedBy } = req.body;

    if (!['critical', 'catastrophic'].includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Escalation only supports critical or catastrophic'
      });
    }

    const result = await this.db.query(`
      UPDATE owner_requests
      SET priority = $2, updated_at = NOW()
      WHERE req_number = $1
      RETURNING req_number, title, priority
    `, [reqNumber, priority]);

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
    }

    console.log(`[SDLC API] PRIORITY ESCALATED: ${reqNumber} -> ${priority} by ${updatedBy || 'api'}. Reason: ${reason || 'none'}`);

    res.json({
      success: true,
      data: {
        reqNumber: result[0].req_number,
        title: result[0].title,
        priority: result[0].priority,
        escalatedBy: updatedBy || 'api',
        reason,
        warning: 'This change is permanent. Use workflow directives for temporary focus.',
        message: `${reqNumber} priority permanently escalated to ${priority}.`
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Success Criteria
- [ ] `top-priority` creates directive (not priority mutation)
- [ ] `top-priority` is reversible when focus clears
- [ ] New `escalate-priority` endpoint for permanent changes
- [ ] Warning returned when using permanent escalation

---

## Part 4: Update Documentation

**Goal:** Update API reference to reflect changes

### File: `.claude/docs/SDLC-AI-API-REFERENCE.md`

Add/update sections:

```markdown
### Create Workflow Directive (Enhanced)
\`\`\`
POST /workflow/directive
\`\`\`
**Body:**
\`\`\`json
{
  "directiveType": "focus",
  "displayName": "Weekend sprint",
  "targetType": "list",
  "targetReqNumbers": ["REQ-001", "REQ-002"],
  "expandBlockers": true,
  "expiresAt": "2026-01-12T18:00:00Z",
  "exclusive": true,
  "autoRestore": true,
  "createdBy": "ai-assist"
}
\`\`\`

**Target Types:**
| Type | Description |
|------|-------------|
| `blocker_chain` | Recursive chain from single REQ |
| `list` | Hand-picked list of REQs (NEW) |
| `customer` | All REQs for customer |
| `tag` | All REQs with tag |
| `bu` | All REQs for business unit |
| `filter` | Dynamic filter criteria |

**Options:**
| Option | Description |
|--------|-------------|
| `expandBlockers` | Auto-include blockers of blocked items (NEW) |
| `exclusive` | Only work on items in scope |
| `autoRestore` | Return to normal when complete |
| `expiresAt` | Auto-clear at timestamp |

---

### Set Top Priority (Revised)
\`\`\`
POST /requests/:reqNumber/top-priority
\`\`\`
Creates a blocker-chain directive (reversible). Does NOT permanently change priority.

---

### Escalate Priority (NEW)
\`\`\`
POST /requests/:reqNumber/escalate-priority
\`\`\`
Permanently changes priority (irreversible). Use sparingly.

**Body:**
\`\`\`json
{
  "priority": "catastrophic",
  "reason": "Customer escalation",
  "updatedBy": "ai-assist"
}
\`\`\`
```

### Success Criteria
- [ ] API reference updated with new endpoints
- [ ] Target types documented
- [ ] `expandBlockers` option documented
- [ ] `top-priority` behavior change documented
- [ ] `escalate-priority` endpoint documented

---

## Implementation Order

```
1. Part 1: Add targetType 'list' support
2. Part 2: Add expandBlockers option
3. Part 3: Fix top-priority, add escalate-priority
4. Part 4: Update documentation
5. Testing with scrum master scenarios
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `agent-backend/src/api/sdlc-api.server.ts` | Add list support, expandBlockers, fix top-priority |
| `.claude/docs/SDLC-AI-API-REFERENCE.md` | Document new endpoints and options |

---

## Testing Scenarios

### Scenario 1: Weekend Sprint
```
1. Create directive with 50 hand-picked items
2. Some blocked by items outside list
3. expandBlockers=true adds missing blockers
4. Set 24-hour expiry
5. Verify blockers worked first
6. Verify focus clears after 24 hours
7. Verify original priorities unchanged
```

### Scenario 2: Top Priority (Reversible)
```
1. Use top-priority on blocked REQ
2. Verify blocker-chain directive created
3. Verify blockers included
4. Clear focus
5. Verify REQ returns to original priority
```

### Scenario 3: Permanent Escalation
```
1. Use escalate-priority on REQ
2. Verify priority changed in database
3. Verify warning returned
4. Verify priority persists after any directive clears
```

---

## Related Plans

| Plan | Relationship |
|------|--------------|
| `wip-limit-enforcement.md` | Directives work within WIP limits |
| `blocked-catastrophic-escalation.md` | Escalation may trigger directive focus |
