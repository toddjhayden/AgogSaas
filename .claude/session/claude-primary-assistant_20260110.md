# Claude Primary Assistant Session - January 10, 2026

## Session Summary
SDLC GUI improvements for AI Assist and dependency visualization. Identified multiple issues with current implementation.

## Context from Previous Session (Jan 9)
- Continued REC/REQ unification architecture planning
- Confirmed `request_blockers` table schema supports cross-type blocking
- Created REQ-SDLC-1767972294 for REC/REQ Unification with Tag-Based Board Routing
- Created REQ-AUDIT-1767982074: Enforce Runtime Dependency Health

## Work Completed Today

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

### Previous Session Work (Carried Over)
- `4549253` - RECs added to Blocker Graph with approval status
- `979ba0f` - D3 Chord Diagram for cross-BU dependencies
- `53af538` - SDLC AI API reference documentation
- `aeb6351` - Duplicate detection and new AI query functions

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
- [ ] Fix Cross-BU Dependency Matrix visualization
- [ ] Fix filter issue with RECs in Blocker Graph
- [ ] Entity Dependency Graph needs interactive analysis features
- [ ] UX: Right-click/drag REQ to insert into chat
- [ ] Add security to AI experience
