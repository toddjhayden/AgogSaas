# SDLC AI API Reference

This document describes the API endpoints used by the AI Assist feature in sdlc.agog.fyi.

## Base URL

```
VITE_SDLC_API_URL=http://localhost:5100/api
```

---

## Query Endpoints (Read-Only)

### Get Request Details
```
GET /requests/:reqNumber
```
Returns full details of a specific request.

**Example:** `GET /requests/REQ-P0-BUILD-1767507808-DB`

**Response:**
```json
{
  "success": true,
  "data": {
    "reqNumber": "REQ-P0-BUILD-1767507808-DB",
    "title": "Database Migration for V0.0.28",
    "priority": "critical",
    "currentPhase": "in_progress",
    "isBlocked": false,
    "estimatedHours": 4,
    "assignedTo": "roy"
  }
}
```

---

### Get Items Blocked By Request
```
GET /requests/:reqNumber/blocked-by
```
Returns all requests that are blocked BY this request (waiting on it).

**Example:** `GET /requests/REQ-P0-BUILD-1767507808-DB/blocked-by`

---

### Get Blockers For Request
```
GET /blockers/:reqNumber
```
Returns all requests that are blocking this request.

---

### Get Full Blocker Chain
```
GET /requests/:reqNumber/blocker-chain
```
Returns recursive tree of all blockers and blocked items.

**Response includes:**
- `chain[]` - All REQs in the dependency tree
- `totalInChain` - Count of items

---

### Get Unblocked Work
```
GET /requests/unblocked?maxHours=4&sortBy=effort_asc&limit=10
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `maxHours` | number | Max estimated hours filter |
| `sortBy` | string | `priority` (default), `effort_asc`, `effort_desc`, `age` |
| `limit` | number | Max results (default: 20) |

---

### Get Requests By Customer
```
GET /requests/by-customer/:customerName
```
Returns requests created from or related to a customer.

---

### Get Requests By Priority
```
GET /requests/by-priority/:priority?includeBlocked=true
```

**Priority values:** `low`, `medium`, `high`, `critical`, `catastrophic`

---

### Get Requests By Phase
```
GET /requests/by-phase/:phase
```

**Phase values:** `backlog`, `research`, `review`, `approved`, `in_progress`, `qa`, `staging`, `done`, `cancelled`

---

### Search Requests
```
GET /requests/search?q=database&limit=20
```
Full-text search across title, description, and tags.

---

### Estimate Completion
```
GET /requests/:reqNumber/estimate
```
Returns estimated completion time based on priority, blockers, and velocity.

---

### Analyze Workload
```
GET /workload/analyze?hours=8
```
Returns what can be completed in the given hours.

**Response:**
```json
{
  "success": true,
  "data": {
    "hoursAvailable": 8,
    "analysis": {
      "canCompleteCount": 3,
      "canComplete": [...],
      "partialProgress": [...],
      "unusedHours": 1.5
    }
  }
}
```

---

### Check If Needed (Duplicate Detection)
```
GET /requests/:reqNumber/check-needed
```
Searches for similar completed work to determine if request is still needed.

**Response:**
```json
{
  "success": true,
  "data": {
    "reqNumber": "REQ-1234",
    "stillNeeded": true,
    "confidence": "low|medium|high",
    "message": "No similar completed work found.",
    "similarWork": [...],
    "relatedMemories": [...]
  }
}
```

---

### Get Biggest Bottleneck
```
GET /requests/biggest-bottleneck
```
Returns the request blocking the most other work.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "REQ-1234 is blocking 5 other items.",
    "bottleneck": {
      "reqNumber": "REQ-1234",
      "title": "...",
      "blocksCount": 5,
      "blocksReqs": ["REQ-2", "REQ-3", ...]
    },
    "topBlockers": [...]
  }
}
```

---

### Get Highest Impact Recommendation
```
GET /recommendations/highest-impact?urgency=critical
```
Returns the recommendation with highest impact score.

---

### Get Recommendations for Feature
```
GET /recommendations/for-feature?feature=WMS&status=pending
```
Searches recommendations related to a feature area.

**Parameters:**
| Param | Values | Description |
|-------|--------|-------------|
| `feature` | string | Feature area (e.g., WMS, inventory) |
| `status` | `pending`, `approved`, `rejected`, `all` | Filter by status |

---

## Mutation Endpoints (Require Confirmation)

### Update Request Priority
```
POST /requests/:reqNumber/priority
```
**Body:**
```json
{
  "priority": "critical",
  "reason": "Customer escalation",
  "updatedBy": "ai-assist"
}
```

---

### Set Top Priority (Reversible)
```
POST /requests/:reqNumber/top-priority
```
Creates a blocker-chain directive for the request. **Does NOT permanently change priority.**

**Body:**
```json
{
  "reason": "Customer escalation",
  "createdBy": "ai-assist",
  "expiresAt": "2026-01-12T18:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reqNumber": "REQ-1234",
    "originalPriority": "medium",
    "isTopPriority": true,
    "reversible": true,
    "directive": {
      "id": "uuid",
      "displayName": "Top Priority: REQ-1234",
      "targetReqNumbers": ["REQ-1234", "REQ-blocker-1"],
      "totalItems": 2
    },
    "message": "Use /workflow/focus/clear to return to normal."
  }
}
```

---

### Escalate Priority (Permanent)
```
POST /requests/:reqNumber/escalate-priority
```
**Permanently** changes priority. Use sparingly - for temporary focus, use `top-priority` instead.

**Body:**
```json
{
  "priority": "catastrophic",
  "reason": "Production outage",
  "updatedBy": "ai-assist"
}
```

**Response includes:**
- `reversible: false` - Warning that change is permanent
- `warning` - Suggests using `top-priority` for temporary focus

---

### Update Request Phase
```
POST /requests/:reqNumber/phase
```
**Body:**
```json
{
  "phase": "in_progress",
  "reason": "Starting work",
  "updatedBy": "ai-assist"
}
```

---

### Add Blocker
```
POST /blockers
```
**Body:**
```json
{
  "blockedReq": "REQ-1234",
  "blockingReq": "REQ-5678",
  "reason": "Needs database changes first",
  "createdBy": "ai-assist"
}
```

---

### Remove Blocker
```
DELETE /blockers/:blockedReq/:blockingReq
```

---

### Create Recommendation
```
POST /recommendations
```
**Body:**
```json
{
  "title": "Add caching layer",
  "description": "Reduce database load",
  "urgency": "high",
  "affectedBus": ["core-infra"],
  "createdBy": "ai-assist"
}
```

---

## Workflow Directive Endpoints

### Get Workflow Status
```
GET /workflow/status
```
Returns current active directive (if any).

**Response:**
```json
{
  "hasActiveDirective": true,
  "directive": {
    "id": "uuid",
    "directiveType": "focus",
    "displayName": "Blocker chain focus: REQ-1234",
    "targetType": "blocker_chain",
    "targetReqNumbers": ["REQ-1234", "REQ-5678"],
    "exclusive": true,
    "autoRestore": true,
    "totalItems": 3,
    "completedItems": 1
  }
}
```

---

### Create Workflow Directive
```
POST /workflow/directive
```
**Body:**
```json
{
  "directiveType": "focus",
  "displayName": "Weekend easy push",
  "targetType": "list",
  "targetReqNumbers": ["REQ-001", "REQ-002", "REQ-003"],
  "expandBlockers": true,
  "expiresAt": "2026-01-12T18:00:00Z",
  "exclusive": true,
  "autoRestore": true,
  "createdBy": "ai-assist"
}
```

**Target Types:**
| Type | Description |
|------|-------------|
| `blocker_chain` | Recursive chain from single REQ (includes all blockers) |
| `list` | Hand-picked list of REQ numbers |
| `customer` | All REQs for a customer |
| `tag` | All REQs with a tag |
| `bu` | All REQs for a business unit |
| `filter` | Dynamic filter criteria (maxHours, priority, unblocked) |

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `expandBlockers` | boolean | Auto-include blockers of any blocked items in the list |
| `exclusive` | boolean | Only work on items in scope (default: true) |
| `autoRestore` | boolean | Return to normal when all items complete |
| `expiresAt` | ISO timestamp | Auto-clear directive at this time |

**Response includes:**
- `expansion.addedBlockers` - List of blockers auto-added (if expandBlockers=true)
- `warning.blockedItemsOutsideScope` - Items blocked by REQs not in scope (if expandBlockers=false)

---

### Focus on Blocker Chain
```
POST /workflow/focus/blocker-chain
```
**Body:**
```json
{
  "reqNumber": "REQ-1234",
  "reason": "Urgent customer need",
  "createdBy": "ai-assist"
}
```

Creates directive targeting all items in the blocker chain.

---

### Clear Workflow Focus
```
POST /workflow/focus/clear
```
**Body:**
```json
{
  "reason": "Work complete"
}
```

Clears active directive and returns to normal workflow.

---

### Check If REQ In Scope
```
GET /workflow/in-scope/:reqNumber
```
Returns whether a request is in scope of the active directive.

---

## Example AI Chat Prompts

These prompts trigger the corresponding API calls:

| Prompt | Function | Endpoint |
|--------|----------|----------|
| "What's blocking REQ-1234?" | `getBlockersForRequest` | GET /blockers/:reqNumber |
| "Show unblocked work for 4 hours" | `getUnblockedWork` | GET /requests/unblocked?maxHours=4 |
| "What is my biggest bottleneck?" | `getBiggestBottleneck` | GET /requests/biggest-bottleneck |
| "What recommendation has biggest impact?" | `getHighestImpactRecommendation` | GET /recommendations/highest-impact |
| "What WMS RECs need approval?" | `getRecsForFeature` | GET /recommendations/for-feature?feature=WMS |
| "Is REQ-1234 still needed?" | `checkIfNeeded` | GET /requests/:reqNumber/check-needed |
| "Focus on blocker chain REQ-1234" | `focusOnBlockerChain` | POST /workflow/focus/blocker-chain |
| "Focus on these 5 items for the weekend" | `createDirective` | POST /workflow/directive (targetType: list) |
| "Make REQ-1234 top priority" | `setTopPriority` | POST /requests/:reqNumber/top-priority |
| "Permanently escalate REQ-1234 to catastrophic" | `escalatePriority` | POST /requests/:reqNumber/escalate-priority |
| "Return to normal workflow" | `clearWorkflowFocus` | POST /workflow/focus/clear |
| "Change REQ-1234 to critical" | `updateRequestPriority` | POST /requests/:reqNumber/priority |
