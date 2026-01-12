# AI Agents

This directory contains the 6 specialized AI agents that power Layer 3 (Orchestration).

## Agent Workflow

```
REQ → Cynthia → Sylvia → Roy & Jen → Billy → Priya → DONE
      Research  Critique  Backend  QA      Stats
                Gate      Frontend
```

## Agents

1. **cynthia-research.md** - Research specialist
   - Analyzes requirements
   - Researches codebase
   - Identifies files to modify
   - Publishes research deliverable

2. **sylvia-critique.md** - Quality gate
   - Reviews research
   - Returns APPROVED/CONDITIONAL/REJECTED
   - Blocks workflow if not ready

3. **roy-backend.md** - Backend developer
   - Implements GraphQL schema
   - Creates services
   - Writes migrations
   - Publishes backend deliverable

4. **jen-frontend.md** - Frontend developer
   - Creates React components
   - Implements queries
   - Adds routes
   - Publishes frontend deliverable

5. **billy-qa.md** - QA engineer
   - Runs E2E tests
   - Tests edge cases
   - Validates implementation
   - Publishes test results

6. **priya-statistics.md** - Statistics analyst
   - Calculates token usage
   - Measures complexity
   - Generates metrics
   - Publishes statistics

## Usage

Agents are spawned automatically by the orchestrator.  
See `backend/src/orchestration/` for implementation.
