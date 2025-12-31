# Scripts Directory

Operational and development scripts for the AgogSaaS platform.

## Scripts Manifest

```yaml
# scripts/manifest.yaml - Machine-readable script inventory
scripts:
  # === NATS Message Broker ===
  - name: setup-nats-streams.js
    purpose: Initialize NATS JetStream streams and consumers
    runtime: node
    usage: node scripts/setup-nats-streams.js
    requires:
      - NATS server running
      - NATS_URL environment variable

  # === Agent Spawning ===
  - name: spawn-value-chain-expert.js
    purpose: Launch Value Chain Expert Claude agent with context
    runtime: node
    usage: node scripts/spawn-value-chain-expert.js
    requires:
      - Claude CLI installed
      - .claude/agents/value-chain-expert.md exists
    related:
      - spawn-value-chain-expert.bat (Windows)
      - spawn-value-chain-expert.sh (Linux/Mac)

  - name: spawn-value-chain-expert-daemon.js
    purpose: Run Value Chain Expert as background daemon
    runtime: node
    usage: node scripts/spawn-value-chain-expert-daemon.js
    related:
      - spawn-value-chain-expert-daemon.bat (Windows)

  - name: verify-agent-setup.js
    purpose: Validate agent configuration and dependencies
    runtime: node
    usage: node scripts/verify-agent-setup.js

  # === Maintenance ===
  - name: archive-complete-reqs.js
    purpose: Archive completed REQ files to .archive folder
    runtime: node
    usage: node scripts/archive-complete-reqs.js

  - name: check-secrets.sh
    purpose: Scan codebase for accidentally committed secrets
    runtime: bash
    usage: ./scripts/check-secrets.sh

  # === Disaster Recovery Drills ===
  dr/:
    - name: drill-regional-failover.sh
      purpose: Test regional failover procedures
      runtime: bash
      usage: ./scripts/dr/drill-regional-failover.sh

    - name: drill-database-pitr.sh
      purpose: Test database point-in-time recovery
      runtime: bash
      usage: ./scripts/dr/drill-database-pitr.sh

    - name: test-edge-offline.sh
      purpose: Simulate edge facility offline scenario
      runtime: bash
      usage: ./scripts/dr/test-edge-offline.sh
```

## Quick Reference

| Script | Purpose | Command |
|--------|---------|---------|
| `setup-nats-streams.js` | Init NATS streams | `node scripts/setup-nats-streams.js` |
| `spawn-value-chain-expert.js` | Launch agent | `node scripts/spawn-value-chain-expert.js` |
| `verify-agent-setup.js` | Validate agents | `node scripts/verify-agent-setup.js` |
| `archive-complete-reqs.js` | Archive REQs | `node scripts/archive-complete-reqs.js` |
| `check-secrets.sh` | Secret scan | `./scripts/check-secrets.sh` |

## Disaster Recovery Scripts

Located in `scripts/dr/`:

| Script | Purpose |
|--------|---------|
| `drill-regional-failover.sh` | Test regional failover |
| `drill-database-pitr.sh` | Test DB point-in-time recovery |
| `test-edge-offline.sh` | Simulate edge offline |

## Environment Variables

```bash
# Required for NATS scripts
NATS_URL=nats://localhost:4222

# Optional for agent scripts
CLAUDE_CLI_PATH=/path/to/claude
```

## Related Documentation

- Agent Setup: [README_AGENT_SPAWN.md](./README_AGENT_SPAWN.md)
- DR Procedures: `project-architecture/security/disaster-recovery.md`
- Infrastructure: `infrastructure/`
