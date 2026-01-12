# Agent Output Directory

This directory provides a designated workspace for AGOG agents to write files during workflow execution.

## Structure

```
agent-output/
├── nats-scripts/     # NATS publishing scripts (TypeScript/Node)
├── deliverables/     # Full deliverable documents (Markdown/JSON)
└── README.md         # This file
```

## Purpose

Agents spawned during workflows (Cynthia, Sylvia, Roy, Jen, Billy, Priya) use this directory to:
- Write NATS publishing scripts for deliverable storage
- Store full deliverable documents before publishing
- Create temporary files needed during execution

## Environment Variables

Agents receive these environment variables:
- `AGENT_OUTPUT_DIR`: Path to this directory
- `NATS_URL`: NATS server connection URL

## Permissions

This directory must be writable by the process running the orchestrator service.

## Git Ignore

Contents of this directory (except README.md and .gitkeep) are ignored by git to avoid committing transient agent outputs.
