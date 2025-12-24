# Quick Start: Value Chain Expert Agent

## The Easiest Way (Right Now!)

From your current cmd window:

### Step 1: Exit current session
Press `Ctrl+C`

### Step 2: Run this command
```cmd
node "C:\Users\toddj\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js" --agent ".claude\agents\value-chain-expert.md" --model sonnet --dangerously-skip-permissions
```

### Step 3: When agent loads, paste this as first message
```
Read your agent definition at .claude/agents/value-chain-expert.md. Review Standards/README.md and familiarize yourself with all files in project-spirit/ directory. Then introduce yourself and await instructions.
```

---

## That's It!

The agent will:
1. Read its definition
2. Review standards
3. Check project-spirit files
4. Introduce itself
5. Wait for your instructions

---

## Why the Script Didn't Work

The Node.js script has stdio piping issues on Windows. I've fixed it, but the direct `claude` command is simpler and more reliable.

---

## Alternative: Updated Script

The updated script now works correctly:

```cmd
cd D:\GitHub\agogsaas
scripts\spawn-value-chain-expert.bat
```

It will show instructions on what to paste as your first message.
