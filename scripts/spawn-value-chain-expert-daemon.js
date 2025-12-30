#!/usr/bin/env node

/**
 * Spawn Value Chain Expert Agent (DAEMON VERSION - Non-Interactive)
 *
 * This script starts the Value Chain Expert agent with:
 * - Sonnet model
 * - Skip permissions (for automated workflows)
 * - Pre-written initial prompt (no manual input needed)
 * - Captured output (non-interactive)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths
const agentFilePath = path.join(__dirname, '..', '.claude', 'agents', 'strategic-recommendation-generator.md');
const standardsPath = path.join(__dirname, '..', 'Standards', 'README.md');
const projectSpiritDir = path.join(__dirname, '..', 'project-spirit');
const ownerRequestsPath = path.join(__dirname, '..', 'project-spirit', 'owner_requests', 'OWNER_REQUESTS.md');

// Verify files exist
if (!fs.existsSync(agentFilePath)) {
  console.error(`❌ Agent file not found: ${agentFilePath}`);
  process.exit(1);
}

console.log('[ValueChainDaemon] Starting Value Chain Expert Agent (non-interactive mode)...\n');
console.log(`[ValueChainDaemon] Agent Definition: ${agentFilePath}`);
console.log(`[ValueChainDaemon] Standards: ${standardsPath}`);
console.log(`[ValueChainDaemon] Owner Requests: ${ownerRequestsPath}\n`);

// Build prompt - Direct command with explicit tool usage
const initialPrompt = `Add a new strategic recommendation to ${ownerRequestsPath}:

1. Use Read tool to read the file and see existing entries
2. Use Edit tool to add a new REQ-STRATEGIC-AUTO-[timestamp] entry (use Date.now() for timestamp)
3. Pick a feature from: Vendor scorecards, PO approval workflow, Inventory forecasting, Sales quote automation
4. Use Bash tool to commit: git add project-spirit/owner_requests/OWNER_REQUESTS.md && git commit -m "feat: Auto-generated recommendation from strategic-recommendation-generator"

Execute these steps now.`;

// Claude Code CLI command
const defaultClaudePath = process.platform === 'win32'
  ? 'node "C:\\Users\\toddj\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js"'
  : 'claude';

const claudeCommand = process.env.CLAUDE_CLI_PATH || defaultClaudePath;

// Arguments - NO positional prompt, will use stdin
const args = [
  '--agent', agentFilePath,
  '--model', 'sonnet',
  '--dangerously-skip-permissions',
  '--print'  // NON-INTERACTIVE OUTPUT
];

console.log(`[ValueChainDaemon] Command: ${claudeCommand} ${args.join(' ')}\n`);
console.log('[ValueChainDaemon] Executing agent with inline prompt (fully autonomous)...\n');

// Spawn the agent - FULLY NON-INTERACTIVE with --print flag
const agentProcess = spawn(claudeCommand, args, {
  stdio: ['pipe', 'inherit', 'inherit'], // stdin=pipe (we'll write), stdout/stderr=inherit
  shell: true,
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    AGENT_DEFINITION: agentFilePath,
    STANDARDS_FILE: standardsPath,
    PROJECT_SPIRIT_DIR: projectSpiritDir,
  }
});

// Write prompt to stdin and close
agentProcess.stdin.write(initialPrompt);
agentProcess.stdin.end();

// Handle process exit
agentProcess.on('exit', (code) => {
  console.log('');
  console.log('[ValueChainDaemon] ═'.repeat(30));
  console.log(`[ValueChainDaemon] Agent session ended with code ${code}`);
  console.log('[ValueChainDaemon] ═'.repeat(30));

  if (code === 0) {
    console.log('[ValueChainDaemon] ✅ Value Chain Expert completed successfully');
    console.log('[ValueChainDaemon] Check OWNER_REQUESTS.md for new recommendation');
  } else {
    console.error('[ValueChainDaemon] ❌ Agent failed with exit code:', code);
  }

  process.exit(code || 0);
});

// Handle errors
agentProcess.on('error', (error) => {
  console.error(`[ValueChainDaemon] ❌ Failed to start agent: ${error.message}`);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n[ValueChainDaemon] ⏹️  Stopping agent...');
  agentProcess.kill('SIGINT');
  process.exit(0);
});
