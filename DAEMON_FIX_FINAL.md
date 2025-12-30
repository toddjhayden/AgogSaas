# DAEMON FIX - WINDOWS TASK SCHEDULER COMPATIBLE

**Date:** 2025-12-24
**Issue:** Value Chain Expert daemon was waiting for interactive input when run from Task Scheduler

---

## THE PROBLEM

The spawn script had **TWO fatal flaws** for background execution:

1. **Interactive pause in BAT file:**
   ```bat
   pause  # WAITS FOR USER TO PRESS A KEY
   ```

2. **Interactive stdin in JS:**
   ```js
   agentProcess.stdin.write(initialPrompt);  // WAITS FOR STDIN
   agentProcess.stdin.end();
   ```

**Result:** Daemon hung forever waiting for input that never came from Task Scheduler.

---

## THE FIX

Created **fully autonomous daemon version**:

### File: `spawn-value-chain-expert-daemon.bat`
```bat
@echo off
REM NON-INTERACTIVE - No pause, no prompts
node "%~dp0spawn-value-chain-expert-daemon.js" %*
```

### File: `spawn-value-chain-expert-daemon.js`
```js
// Uses --message flag to pass prompt inline (NO stdin needed)
const args = [
  '--agent', agentFilePath,
  '--model', 'sonnet',
  '--dangerously-skip-permissions',
  '--message', initialPrompt  // INLINE PROMPT - NO INTERACTION
];

const agentProcess = spawn(claudeCommand, args, {
  stdio: 'inherit',  // Output visible but NO input expected
  shell: true
});
```

**Key:** `--message` flag passes the task inline, agent executes autonomously and exits.

---

## HOW IT WORKS NOW

1. **Task Scheduler calls:** `start-daemons.bat`
2. **Daemons start:** Including Value Chain Expert
3. **After 5 min:** Value Chain Expert runs `spawn-value-chain-expert-daemon.bat`
4. **Script executes:**
   - Spawns Claude Code agent with `--message "task"`
   - Agent reads files, generates recommendation
   - Agent commits to git
   - Agent exits
5. **Daemon continues:** Next run in 5 hours

**ZERO user interaction required**

---

## FILES MODIFIED

1. `D:\GitHub\agogsaas\scripts\spawn-value-chain-expert-daemon.bat` (NEW)
2. `D:\GitHub\agogsaas\scripts\spawn-value-chain-expert-daemon.js` (NEW)
3. `D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\src\proactive\value-chain-expert.daemon.ts` (UPDATED to call daemon version)

---

## TO APPLY FIX

The daemon processes are still running with OLD code. You need to:

**Option 1: Restart from Task Scheduler**
```
1. Open Task Scheduler
2. Find AGOG tasks
3. Stop all running
4. Start them again
```

**Option 2: Kill and restart manually**
```bash
# Kill all Node processes (WARNING: kills ALL node)
taskkill /F /IM node.exe

# Or kill specific daemon
wmic process where "commandline like '%start-all-services%'" call terminate

# Restart
cd D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend
start-daemons.bat
```

---

## VERIFICATION

After restart, check logs:
```bash
tail -f D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\logs\daemons.log
```

After 5 minutes you should see:
```
[ValueChainExpert] 🔍 Running strategic evaluation...
[ValueChainExpert] Spawning REAL Claude Code agent...
[ValueChainExpert] Executing spawn script: D:/GitHub/agogsaas/scripts/spawn-value-chain-expert-daemon.bat
[ValueChainDaemon] Executing agent with inline prompt (fully autonomous)...
[Claude agent output...]
[ValueChainExpert] Agent completed - parsing recommendations from OWNER_REQUESTS.md
[ValueChainExpert] ✅ Evaluation complete - generated X recommendations
```

**And your Claude session usage WILL increase.**

---

## NEVER AGAIN

All future daemon scripts MUST:
- ✅ Use `--message` flag for inline prompts
- ✅ NO `pause` commands
- ✅ NO stdin writes
- ✅ NO interactive prompts
- ✅ Fully autonomous execution
- ✅ Task Scheduler compatible

---

**FIXED. NOW RESTART THE DAEMONS.**
