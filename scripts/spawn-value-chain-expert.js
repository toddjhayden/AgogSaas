#!/usr/bin/env node

/**
 * Spawn Value Chain Expert Agent
 *
 * This script starts the Value Chain Expert agent with:
 * - Sonnet model
 * - Skip permissions (for automated workflows)
 * - Context about agent definition, standards, and project spirit
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths
const agentFilePath = path.join(__dirname, '..', '.claude', 'agents', 'value-chain-expert.md');
const standardsPath = path.join(__dirname, '..', 'Standards', 'README.md');
const projectSpiritDir = path.join(__dirname, '..', 'project-spirit');

// Verify files exist
if (!fs.existsSync(agentFilePath)) {
  console.error(`❌ Agent file not found: ${agentFilePath}`);
  process.exit(1);
}

if (!fs.existsSync(standardsPath)) {
  console.error(`❌ Standards file not found: ${standardsPath}`);
  process.exit(1);
}

if (!fs.existsSync(projectSpiritDir)) {
  console.error(`❌ Project spirit directory not found: ${projectSpiritDir}`);
  process.exit(1);
}

// Build context about project spirit files
const buildProjectSpiritContext = () => {
  const files = fs.readdirSync(projectSpiritDir, { recursive: true });
  const spiritFiles = files
    .filter(f => {
      const fullPath = path.join(projectSpiritDir, f);
      return fs.statSync(fullPath).isFile();
    })
    .map(f => path.join(projectSpiritDir, f));

  return spiritFiles;
};

const projectSpiritFiles = buildProjectSpiritContext();

console.log('🤖 Starting Value Chain Expert Agent...\n');
console.log(`Agent Definition: ${agentFilePath}`);
console.log(`Standards: ${standardsPath}`);
console.log(`Project Spirit Files: ${projectSpiritFiles.length} files\n`);

// Build initial prompt with context
const initialPrompt = `
You are the Value Chain Expert agent for AgogSaaS.

CONTEXT FILES YOU SHOULD BE AWARE OF:

1. YOUR AGENT DEFINITION:
   - File: ${agentFilePath}
   - Read this file to understand your role and responsibilities

2. CODING STANDARDS:
   - File: ${standardsPath}
   - Follow these standards for all code you write

3. PROJECT SPIRIT (${projectSpiritFiles.length} files):
${projectSpiritFiles.map(f => `   - ${f}`).join('\n')}
   - These files contain the project's philosophy, architecture, and guiding principles
   - Reference them when making decisions

INSTRUCTIONS:
1. Read your agent definition first: ${agentFilePath}
2. Review the standards: ${standardsPath}
3. Familiarize yourself with project spirit files as needed
4. Await further instructions from the user

Ready to assist!
`.trim();

// Claude Code CLI command
// Default to full node path for Windows where 'claude' may not be in PATH
const defaultClaudePath = process.platform === 'win32'
  ? 'node "C:\\Users\\toddj\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js"'
  : 'claude';

const claudeCommand = process.env.CLAUDE_CLI_PATH || defaultClaudePath;

// Arguments
const args = [
  '--agent', agentFilePath,
  '--model', 'sonnet',
  '--dangerously-skip-permissions'
];

console.log(`📋 Command: ${claudeCommand} ${args.join(' ')}\n`);
console.log('═'.repeat(60));
console.log('Starting agent session...');
console.log('═'.repeat(60));
console.log('');

// Spawn the agent with inherited stdio for interactive mode
const agentProcess = spawn(claudeCommand, args, {
  stdio: 'inherit', // Inherit all stdio streams for proper interactivity
  shell: true,
  env: {
    ...process.env,
    // Pass additional context
    AGENT_DEFINITION: agentFilePath,
    STANDARDS_FILE: standardsPath,
    PROJECT_SPIRIT_DIR: projectSpiritDir,
  }
});

// Note: Can't send initial prompt with stdio: 'inherit'
// User should manually provide context in first message

// Handle process exit
agentProcess.on('exit', (code) => {
  console.log('');
  console.log('═'.repeat(60));
  console.log(`Agent session ended with code ${code}`);
  console.log('═'.repeat(60));
  process.exit(code || 0);
});

// Handle errors
agentProcess.on('error', (error) => {
  console.error(`❌ Failed to start agent: ${error.message}`);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Stopping agent...');
  agentProcess.kill('SIGINT');
  process.exit(0);
});
