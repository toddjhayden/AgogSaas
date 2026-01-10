# Claude Primary Assistant Session - January 10, 2026

## Session Summary
SDLC GUI improvements for AI Assist and dependency visualization. Identified multiple issues with current implementation. Fixed UI redundancy and NATS status display issues.

## Context from Previous Session (Jan 9)
- Continued REC/REQ unification architecture planning
- Confirmed `request_blockers` table schema supports cross-type blocking
- Created REQ-SDLC-1767972294 for REC/REQ Unification with Tag-Based Board Routing
- Created REQ-AUDIT-1767982074: Enforce Runtime Dependency Health

## Work Completed Today

### Commits Made Today
1. `733d7c7` - feat(sdlc): Add system revision tracking to Settings page
2. `afcb769` - fix(sdlc-gui): Improve sidebar status display and remove filter redundancy
3. `bedb8e7` - fix(sdlc-gui): Check local NATS status for agent infrastructure
4. `19cc7a9` - feat(sdlc): Add AI error logging for function call failures
5. `e55c0c3` - feat(sdlc): Agent infrastructure health publishing
6. `6b06f28` - fix(sdlc-api): Move search route before parameterized route
7. `0ac8bb2` - feat(sdlc-gui): Actionable Cross-BU Matrix with drill-down
8. `733932a` - fix(sdlc-gui): Apply type filter to Blocker Graph nodes

### SDLC API Settings & Health Banner
- Committed: `d30626f` - API URL settings and health banner
- New Settings section: SDLC API configuration
  - Quick-select presets (Production VPS, Local Development)
  - Custom URL input with save
  - Health status display (database, NATS connectivity)
- API Health Banner: Shows at top of app when API unreachable
  - Auto-retries every 30 seconds
  - Links to Settings for reconfiguration
- Created `useSDLCSettingsStore` for API URL persistence
- Updated `sdlc-client.ts` and `ai-function-executor.ts` to use dynamic URL

### Blocker Graph: Done Items Feature
- Committed: `858055b` - Done items visibility and age filter
- Done REQs/RECs show with light green fill, 60% opacity, dashed border, checkmark
- Toggle to show/hide done items
- Age filter: hide done items older than X days (1, 3, 7, 14, 30)
- Default: show done items from last 7 days

### VPS Deployment - Workflow Endpoints
- Deployed updated `sdlc-api.server.js` to VPS (74.208.64.193)
- Ran migration `V0.0.30__create_workflow_directives.sql` on VPS database
- Created tables: `workflow_directives`, `workflow_saved_state`
- Created functions: `get_active_workflow_directive()`, `is_req_in_active_scope()`, `deactivate_workflow_directive()`
- Fixed API path issues in `sdlc-client.ts` and `ai-function-executor.ts`
  - Workflow endpoints are at `/api/agent/workflow/*`, not `/api/workflow/*`
- Verified endpoint working: `https://api.agog.fyi/api/agent/workflow/status`

### System Revision Tracking
- Added version configuration files:
  - `agent-backend/src/config/version.ts` - API version (V0.1.0, commit aeb6351)
  - `sdlc-gui/src/config/version.ts` - GUI version (V0.1.0, commit d30626f)
- Added `/api/agent/version` endpoint to return API and DB versions
- Updated Settings page with "System Revisions" section at top:
  - GUI Revision: V0.1.0-d30626f (blue)
  - API Revision: V0.1.0-aeb6351 (purple)
  - DB Revision: V0.0.30 (green - matches migration version)
- Pattern follows migration versioning: V{major}.{minor}.{patch}
- Full revision string for copy/paste: `GUI:V0.1.0-d30626f | API:V0.1.0-aeb6351 | DB:V0.0.30`

### Sidebar UI Improvements (afcb769)
- Added workflow focus hint in sidebar header (amber with Zap icon when active)
- Added NATS status alongside database status in health section
- Changed health refresh interval from 30s to 2 minutes
- Removed redundant focus display from FilterBar (FilterStatus handles it)
- Made FilterActiveBadge compact (shows "Focused" not full item ID)

### NATS Status Architecture Issue (bedb8e7)
- **Problem**: GUI on VPS cannot call `localhost:8223` to check local NATS
  - Mixed content: HTTPS page can't fetch HTTP localhost
  - Even if allowed, VPS-served GUI's localhost refers to user's machine
- **Attempted Fix**: Added `checkLocalNatsStatus()` to call local NATS monitoring
- **Actual Solution Needed**: Agentic workflow should publish dependency health to SDLC database
  - Orchestrator writes NATS status, agent health, etc. to SDLC DB
  - GUI queries SDLC API for agent infrastructure health
  - Not just NATS - all agentic workflow dependencies (Ollama, Agent DB, etc.)

### AI Error Logging (19cc7a9)
- V0.0.31 migration: `ai_error_log` table with helper functions
- API endpoints:
  - `POST /api/agent/ai/error-log` - Log an error
  - `GET /api/agent/ai/error-log` - Get pending errors
  - `POST /api/agent/ai/error-log/:id/dismiss` - Dismiss an error
  - `POST /api/agent/ai/error-log/:id/promote` - Promote error to REQ
- Added `logApiError` AI function (no confirmation required)
- Deployed compiled JS to VPS and verified working
- Use case: AI logs errors when function calls fail, SDLC owner reviews and acts

### Agent Infrastructure Health Publishing (e55c0c3)
- V0.0.32 migration: `agent_infrastructure_health` table
  - Tracks: nats, ollama, agent_db, orchestrator, host_listener components
  - Status: healthy, degraded, unavailable, unknown
  - Includes staleness detection (2x heartbeat interval)
  - Helper functions: `update_agent_health()`, `get_agent_infrastructure_health()`
  - View: `agent_infrastructure_status`
- API endpoints added to `sdlc-api.server.ts`:
  - `GET /api/agent/infrastructure/health` - Query all component statuses
  - `POST /api/agent/infrastructure/health` - Update single component
  - `POST /api/agent/infrastructure/health/batch` - Orchestrator heartbeat
- Client function `getInfrastructureHealth()` added to `sdlc-client.ts`
- App.tsx sidebar updated to use infrastructure health for NATS status
- Deployed to VPS, DB version now V0.0.32

### Blocker Graph Type Filter Fix (733932a)
- **Problem**: When globalType filter set to 'REC', D3 graph didn't filter nodes
- **Fix**: Added type filter logic to `d3GraphData` useMemo
  - Filter nodes by `itemType` when `globalFiltersEnabled && globalType !== 'ALL'`
  - Filter links to only include connections between filtered nodes
- **Key change**: Maps FilterType ('REQ'/'REC') to itemType ('req'/'rec')

### Previous Session Work (Carried Over)
- `4549253` - RECs added to Blocker Graph with approval status
- `979ba0f` - D3 Chord Diagram for cross-BU dependencies
- `53af538` - SDLC AI API reference documentation
- `aeb6351` - Duplicate detection and new AI query functions

---

## Issues Identified

### 1. Cross-BU Dependency Matrix Chart Not Helpful
**Location**: `ImpactAnalysisPage.tsx` - D3ChordDiagram
**Problem**: Current chord diagram doesn't provide actionable insights
**Needed**: Better visualization - force-directed graph or different chart type

### 2. Filter Issue with RECs in Blocker Graph
**Location**: `BlockerGraphPage.tsx`
**Problem**: Something broken with filter after adding RECs
**Investigation Needed**: Check filter logic for REC handling

### 3. Entity Dependency Graph Not Interactive
**Location**: `DependencyGraphPage.tsx` (Entity Dependency)
**Problem**: Graph view just sits there, no analysis features
**Contrast**: List view has entity selection and order computation
**Needed**: Add interactive features to graph view

### 4. AI Cannot Report Workflow Focus
**Location**: AI Chat / Function Calling
**Problem**: Asked AI "what is the current focus of the workflow" - couldn't answer
**Needed**: Add function for AI to query workflow status

### 5. Agentic Workflow Not Following Focus
**Problem**: Set focus via AI to blocker chain 1767507808, but agents not working on it
**Investigation Needed**: Check if workflow directive is being read by orchestrator

### 6. NATS Status Display - Architecture Issue
**Problem**: VPS-hosted GUI cannot check local NATS status (mixed content, wrong localhost)
**Solution**: Agentic workflow should publish health to SDLC database
- Orchestrator publishes: NATS connected, Ollama status, Agent DB status, etc.
- New table: `agent_infrastructure_health` or similar
- GUI queries this from SDLC API instead of calling localhost

### 7. AI searchRequests Function Not Working
**Problem**: User asked "What is open for WMS?" and AI tried `searchRequests` function
**Error**: `API error (404): {"success":false,"error":"Request not found: search"}`
**Location**: Missing `/api/agent/requests/search` endpoint
**Needed**: Implement search endpoint in `sdlc-api.server.ts`

---

## Investigation Findings

### 1. AI Workflow Status Function
- `getWorkflowStatus` function **exists** in `ai-functions.ts` (line 270)
- Executor maps it to `/workflow/status` endpoint (line 192-193)
- Backend endpoint exists at `sdlc-api.server.ts:2230`
- **Issue**: AI may not be recognizing the natural language "what is the current focus" as needing this function
- **Possible fix**: Add example prompts or improve function description

### 2. Orchestrator Directive Reading
- Strategic orchestrator **does** check for active directives (line 1010-1033)
- It filters work based on `directive.targetReqNumbers` when exclusive
- **CRITICAL**: SDLC API (port 5100) is NOT RUNNING
- This explains why AI can't get workflow status and orchestrator can't work

### 3. REC Filter Issue
- `filteredDeepestUnblocked` returns empty when `globalType === 'REC'` (line 186)
- This is intentional for Priority Work Queue (REQs only)
- D3 graph data (`d3GraphData`) doesn't filter by globalType directly
- **Possible issue**: REC nodes might have incorrect data (status, phase, etc.)

### 4. Cross-BU Chord Diagram
- Current implementation is a D3 chord diagram
- Shows BU-to-BU dependency counts
- **User feedback**: Not actionable, not helping analysis
- **Needs**: Force-directed graph or different visualization

### 5. Local NATS Status
- NATS runs in Docker container `agogsaas-agents-nats` on port 4223 (mapped from 4222)
- Monitoring available at `http://localhost:8223` (mapped from 8222)
- VPS-hosted GUI cannot access this due to mixed content restrictions
- **Architecture Change Needed**: Agent infrastructure health should be published to SDLC DB

---

## Investigation Queue

1. ~Check `BlockerGraphPage.tsx` filter logic for REC handling~ (Checked - see findings)
2. ~Check if `getWorkflowStatus` function exists in AI function calling~ (Exists)
3. ~Check strategic orchestrator for directive reading~ (Implemented)
4. Design better Cross-BU visualization
5. Test workflow directive actually being applied by orchestrator
6. Test AI workflow status response

---

## TODO List
- [x] Deploy workflow endpoints to VPS (completed)
- [x] Fix API path issues for workflow endpoints (completed)
- [x] Add revision tracking to Settings page (completed)
- [x] Fix redundant Focus display on Kanban Board (completed - afcb769)
- [x] Add workflow focus hint in sidebar header (completed - afcb769)
- [x] Implement agent infrastructure health publishing to SDLC DB (completed - e55c0c3)
- [x] Fix `/api/agent/requests/search` endpoint route order (completed - 6b06f28)
- [x] Fix Cross-BU Dependency Matrix visualization (completed - 0ac8bb2)
- [x] Fix filter issue with RECs in Blocker Graph (completed - 733932a)
- [ ] Entity Dependency Graph needs interactive analysis features
- [ ] UX: Right-click/drag REQ to insert into chat
- [ ] Add security to AI experience

---

## Architecture Notes

### Agent Infrastructure Health (New Design Needed)
The agentic workflow needs to publish its dependency health to SDLC database so the GUI can display it:

**Dependencies to track:**
- NATS: Connected/Disconnected, connection count
- Ollama: Available/Unavailable, loaded models
- Agent PostgreSQL: Connected/Disconnected
- Orchestrator: Running/Stopped, active workflows count
- Host Listener: Running/Stopped

**Proposed table:** `agent_infrastructure_health`
```sql
CREATE TABLE agent_infrastructure_health (
  id SERIAL PRIMARY KEY,
  component VARCHAR(50) NOT NULL,  -- 'nats', 'ollama', 'agent_db', 'orchestrator', 'host_listener'
  status VARCHAR(20) NOT NULL,     -- 'healthy', 'degraded', 'unavailable'
  details JSONB,                   -- component-specific details
  last_heartbeat TIMESTAMP DEFAULT NOW(),
  UNIQUE(component)
);
```

**Publishing mechanism:**
- Orchestrator publishes heartbeats every 30-60 seconds
- On startup, publishes all component states
- On component failure, immediately updates status

**GUI consumption:**
- New endpoint: `GET /api/agent/infrastructure/health`
- Returns all component statuses
- GUI polls every 2 minutes (same as current health check)
