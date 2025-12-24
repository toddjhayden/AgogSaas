# Agent Spawning Scripts

## Value Chain Expert Agent

### Quick Start

**Windows:**
```bash
cd D:\GitHub\agogsaas
scripts\spawn-value-chain-expert.bat
```

**Linux/Mac:**
```bash
cd /path/to/agogsaas
./scripts/spawn-value-chain-expert.sh
```

**Node.js (cross-platform):**
```bash
cd D:\GitHub\agogsaas
node scripts/spawn-value-chain-expert.js
```

---

## What It Does

The script automatically:

1. ✅ Uses `--model sonnet` (Claude Sonnet 4.5)
2. ✅ Uses `--dangerously-skip-permissions` (for automated workflows)
3. ✅ Loads agent definition from `.claude/agents/value-chain-expert.md`
4. ✅ Provides context about `Standards/README.md`
5. ✅ Provides context about all files in `project-spirit/` directory
6. ✅ Starts interactive session ready for your instructions

---

## Initial Context Provided

The agent receives this context on startup:

```
YOUR AGENT DEFINITION:
- .claude/agents/value-chain-expert.md

CODING STANDARDS:
- Standards/README.md

PROJECT SPIRIT FILES:
- project-spirit/README.md
- project-spirit/architectural-decisions/*.md
- project-spirit/owner_requests/*.md
- ... (all files in project-spirit/)
```

---

## Environment Variables

You can customize the behavior:

```bash
# Use different Claude CLI path
CLAUDE_CLI_PATH=~/bin/claude node scripts/spawn-value-chain-expert.js

# All environment variables are passed to the agent
CUSTOM_VAR=value node scripts/spawn-value-chain-expert.js
```

---

## How It Works

1. **Validates Files**: Checks that agent definition, standards, and project-spirit exist
2. **Builds Context**: Scans project-spirit directory and builds file list
3. **Spawns Agent**: Launches Claude Code with specified arguments
4. **Provides Context**: Sends initial prompt with file references
5. **Interactive Session**: Stdin is piped, so you can chat with the agent

---

## Customizing for Other Agents

To create a similar script for another agent:

1. Copy `spawn-value-chain-expert.js` to a new file
2. Update these variables:
   ```javascript
   const agentFilePath = path.join(__dirname, '..', '.claude', 'agents', 'YOUR-AGENT.md');
   ```
3. Update the initial prompt
4. Create corresponding .bat and .sh files

---

## Troubleshooting

**Error: "Agent file not found"**
- Check that `.claude/agents/value-chain-expert.md` exists
- Verify you're running from the agogsaas directory

**Error: "claude command not found"**
- Install Claude Code CLI: https://github.com/anthropics/claude-code
- Or set CLAUDE_CLI_PATH environment variable

**Agent doesn't see context files**
- The agent is told about the files but must read them manually
- Tell the agent: "Read your agent definition first"

---

## Integration with Orchestrator

This script is designed for **manual/interactive use**. For orchestrator integration, use:
- `AgentSpawnerService` (backend/src/orchestration/agent-spawner.service.ts)
- Host agent listener (backend/scripts/host-agent-listener.ts)

Those handle NATS integration and workflow coordination.

---

## Examples

### Example 1: Start agent and ask it to review code
```bash
node scripts/spawn-value-chain-expert.js

# Then interact:
# > Read your agent definition and review the inventory module architecture
```

### Example 2: Start agent with custom task
```bash
node scripts/spawn-value-chain-expert.js

# Then interact:
# > Review Standards/README.md and verify if our codebase follows all naming conventions
```

### Example 3: Batch mode (non-interactive)
```bash
echo "Read your agent definition and summarize your role" | node scripts/spawn-value-chain-expert.js
```

---

## Related Files

- Agent Definition: `.claude/agents/value-chain-expert.md`
- Standards: `Standards/README.md`
- Project Spirit: `project-spirit/` (all files)
- Orchestrator Integration: `Implementation/print-industry-erp/backend/src/orchestration/`
