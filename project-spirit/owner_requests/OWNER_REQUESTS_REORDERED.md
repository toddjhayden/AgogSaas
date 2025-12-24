# OWNER REQUESTS - Feature Backlog

This file tracks feature requests from product owners (Marcus, Sarah, Alex). The strategic orchestrator monitors this file and automatically spawns specialist workflows when new requests are detected.

## Request Format

```
REQ-{DOMAIN}-{NUMBER}: {Feature Title}
Status: {NEW | IN_PROGRESS | COMPLETE | BLOCKED | PENDING}
Owner: {marcus | sarah | alex}
Priority: {P0 | P1 | P2 | P3}
Business Value: {Brief description}

Status Meanings:
- NEW: Brand new request, will be picked up by orchestrator on next scan
- IN_PROGRESS: Workflow is actively running
- COMPLETE: Workflow finished successfully
- BLOCKED: Requires manual intervention
- PENDING: Recovery state only (crash/token limit), orchestrator verifies before starting
```

---

## Active Requests
