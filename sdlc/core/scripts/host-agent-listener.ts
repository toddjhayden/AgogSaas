#!/usr/bin/env ts-node
/**
 * Host-Side NATS Agent Listener
 *
 * This script runs on the Windows HOST machine (not in Docker) and:
 * 1. Connects to NATS at localhost:4223 (Docker-exposed port)
 * 2. Subscribes to workflow stage events from Strategic Orchestrator
 * 3. Spawns Claude agents via CLI when stages need work
 * 4. Publishes agent results back to NATS
 *
 * USAGE:
 *   npm run host:listener
 *
 * REQUIREMENTS:
 *   - Claude CLI installed and available in PATH
 *   - NATS running at localhost:4223 (via Docker)
 *   - Agent files in .claude/agents/
 */

import { connect, NatsConnection, JetStreamClient, StringCodec, StorageType, RetentionPolicy, DiscardPolicy } from 'nats';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { CriticalDependenciesValidator } from '../src/monitoring/critical-dependencies-validator.service';

// Setup file logging
const logDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, `host-listener-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Module-level log buffer for SDLC streaming (sanitized)
const recentLogsBuffer: Array<{ timestamp: string; level: string; source: string; message: string }> = [];
const MAX_LOG_BUFFER = 100;

function log(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', source: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] [${source}] ${message}`;
  console.log(logLine);
  logStream.write(logLine + '\n');

  // Add to buffer for SDLC streaming (skip DEBUG to reduce noise)
  if (level !== 'DEBUG') {
    recentLogsBuffer.push({ timestamp, level, source, message: sanitizeLogMessage(message) });
    if (recentLogsBuffer.length > MAX_LOG_BUFFER) {
      recentLogsBuffer.shift();
    }
  }
}

/** Get recent logs for SDLC (already sanitized) */
function getRecentLogs(count: number = 20): typeof recentLogsBuffer {
  return recentLogsBuffer.slice(-count);
}

function logInfo(source: string, message: string) { log('INFO', source, message); }
function logError(source: string, message: string) { log('ERROR', source, message); }
function logWarn(source: string, message: string) { log('WARN', source, message); }
function logDebug(source: string, message: string) { log('DEBUG', source, message); }

// Load .env from project root (contains GITHUB_TOKEN, etc.)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '..', '.env') });

// PostgreSQL connection for change management storage
// Password loaded from environment variable for security
const pgPool = new Pool({
  host: 'localhost',
  port: 5434,
  user: 'agent_user',
  password: process.env.AGENT_DB_PASSWORD || 'agent_dev_password_2024', // TODO: Remove fallback after .env.local updated
  database: 'agent_memory',
});

// Patterns to sanitize from logs before sending to SDLC
const SANITIZE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys and tokens
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi, replacement: 'Bearer [REDACTED]' },
  { pattern: /token[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, replacement: 'token=[REDACTED]' },
  // Passwords
  { pattern: /password[=:]\s*["']?[^"'\s,}]+["']?/gi, replacement: 'password=[REDACTED]' },
  { pattern: /NATS_PASSWORD[=:]\s*["']?[^"'\s,}]+["']?/gi, replacement: 'NATS_PASSWORD=[REDACTED]' },
  // Connection strings with passwords
  { pattern: /postgresql:\/\/[^:]+:[^@]+@/gi, replacement: 'postgresql://[USER]:[REDACTED]@' },
  // File paths (reduce to relative)
  { pattern: /[A-Z]:\\Users\\[^\\]+\\/gi, replacement: '[USER_HOME]\\' },
  { pattern: /\/home\/[^/]+\//gi, replacement: '/home/[USER]/' },
  // IP addresses (internal)
  { pattern: /\b(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)\b/g, replacement: '[INTERNAL_IP]' },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
];

/** Sanitize log message for audit compliance */
function sanitizeLogMessage(message: string): string {
  let sanitized = message;
  for (const { pattern, replacement } of SANITIZE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

// Ollama URL for embeddings (host machine port mapping)
// HOST listener uses localhost:11434 (Docker-exposed port), NOT the Docker-internal OLLAMA_URL
// OLLAMA_URL in .env is for containers (ollama:11434), we need host port (localhost:11434)
const OLLAMA_URL = process.env.HOST_OLLAMA_URL || 'http://localhost:11434';

/**
 * Generate embedding for semantic search using Ollama
 * Uses nomic-embed-text model (768 dimensions)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // nomic-embed-text has 2048 token limit (~1500 chars safely)
    const truncatedText = text.substring(0, 1500);
    const response = await axios.post(
      `${OLLAMA_URL}/api/embeddings`,
      {
        model: 'nomic-embed-text',
        prompt: truncatedText,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    return response.data.embedding;
  } catch (error: any) {
    logWarn('embedding', `Failed to generate embedding: ${error.message}`);
    // Return zero vector as fallback (will still be searchable via metadata)
    return Array(768).fill(0);
  }
}

const sc = StringCodec();

interface StageEvent {
  eventType: string;
  reqNumber: string;
  stage: string;
  agentId: string;
  contextData?: any;
}

class HostAgentListener {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private maxConcurrent = 6; // Allow 6 agents to run simultaneously (increased from 4 for better throughput)
  private activeAgents = 0;
  private isRunning = true;
  private workflowRules: string = ''; // Loaded from .claude/WORKFLOW_RULES.md

  async start() {
    logInfo('HostListener', 'Starting host-side NATS agent listener...');
    logInfo('HostListener', `Log file: ${logFile}`);

    // CRITICAL: Validate ALL dependencies BEFORE accepting any work
    // Per WORKFLOW_RULES.md Rule #1: Services MUST EXIT if critical dependencies fail
    // Required: Agent Database, NATS, Ollama, Strategic Orchestrator
    const dependencyValidator = new CriticalDependenciesValidator();
    await dependencyValidator.validateAndExit();

    // Load workflow rules that ALL agents must follow
    const rulesPath = path.resolve(__dirname, '..', '..', '..', '..', '.claude', 'WORKFLOW_RULES.md');
    try {
      this.workflowRules = fs.readFileSync(rulesPath, 'utf-8');
      logInfo('HostListener', '✅ Loaded WORKFLOW_RULES.md');
    } catch (error: any) {
      logError('HostListener', 'Failed to load WORKFLOW_RULES.md: ' + error.message);
      this.workflowRules = 'WORKFLOW RULES FILE NOT FOUND - Contact Sasha for guidance.';
    }

    try {
      // Connect to NATS (exposed from Docker)
      const natsPassword = process.env.NATS_PASSWORD;
      if (!natsPassword) {
        logError('HostListener', 'NATS_PASSWORD environment variable is required');
        throw new Error('NATS_PASSWORD environment variable is required');
      }

      // HOST listener uses localhost:4223 (Docker-exposed port), NOT the Docker-internal NATS_URL
      // NATS_URL in .env is for containers (nats:4222), we need host port (localhost:4223)
      const hostNatsUrl = process.env.HOST_NATS_URL || 'nats://localhost:4223';
      logInfo('HostListener', `Connecting to NATS at ${hostNatsUrl}`);

      this.nc = await connect({
        servers: hostNatsUrl,
        user: process.env.NATS_USER || 'agents',
        pass: natsPassword
      });
      this.js = this.nc.jetstream();

      logInfo('HostListener', '✅ Connected to NATS');

      // Ensure deliverables stream exists (belt and suspenders - orchestrator also creates it)
      await this.ensureDeliverablesStream();

      logInfo('HostListener', 'Subscribing to orchestration events...');

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

      logInfo('HostListener', '🤖 Listener is running');
      logInfo('HostListener', 'Waiting for workflow stage events...');
      logInfo('HostListener', `Max concurrent agents: ${this.maxConcurrent}`);

      // Subscribe to stage started events
      this.subscribeToStageEvents();

      // Subscribe to value-chain-expert requests (from Docker daemon)
      this.subscribeToValueChainExpertRequests();

      // Subscribe to Sam audit requests (from Docker daemon)
      this.subscribeToSamAuditRequests();

      // Subscribe to generic agent spawn requests (from Sam or other daemons)
      this.subscribeToAgentSpawnRequests();

      // Subscribe to Sasha rule question requests
      this.subscribeToSashaRuleQuestions();

      // Subscribe to control commands from SDLC (restart, status, get_logs)
      this.subscribeToControlCommands();

      // NOTE: Auto-spawn P0 discovery removed - Sam daemon triggers ALL audits via NATS
      // This eliminates duplicate audit mechanisms and prevents race conditions
      // Sam daemon runs startup audit immediately after connecting to NATS

      // Start health heartbeat publishing to SDLC (every 60 seconds)
      this.startHealthHeartbeat();

      // Keep alive
      await this.keepAlive();

    } catch (error: any) {
      logError('HostListener', `Failed to start: ${error.message}`);
      process.exit(1);
    }
  }

  private async subscribeToStageEvents() {
    const jsm = await this.nc.jetstreamManager();

    // Ensure consumer exists
    try {
      const consumer = await jsm.consumers.add('agog_orchestration_events', {
        durable_name: 'host_agent_listener_v4',
        ack_policy: 'explicit' as any,
        filter_subject: 'agog.orchestration.events.stage.started',
        deliver_policy: 'all' as any, // Deliver all messages from the stream
      });

      logInfo('HostListener', '✅ Consumer created/verified');
    } catch (error: any) {
      logDebug('HostListener', `Consumer already exists or error: ${error.message}`);
    }

    // Get consumer
    const consumer = await this.js.consumers.get('agog_orchestration_events', 'host_agent_listener_v4');

    // Consume messages (async - runs in background)
    (async () => {
      const messages = await consumer.consume();

      for await (const msg of messages) {
        if (!this.isRunning) break;

        try {
          const event: StageEvent = JSON.parse(msg.string());

          if (event.eventType === 'stage.started') {
            logInfo('HostListener', `📨 Received stage event: ${event.reqNumber} - ${event.stage} (${event.agentId})`);

            // Spawn agent (respect concurrency limit)
            await this.waitForSlot();
            this.spawnAgent(event);
          }

          msg.ack();
        } catch (error: any) {
          logError('HostListener', `Error processing stage event: ${error.message}`);
          msg.nak();
        }
      }
    })();

    logInfo('HostListener', '✅ Subscribed to orchestration stage events');
  }

  /**
   * Subscribe to value-chain-expert requests from Docker daemon
   * These are requests to spawn the strategic recommendation generator
   */
  private async subscribeToValueChainExpertRequests() {
    const subject = 'agog.agent.requests.value-chain-expert';

    const sub = this.nc.subscribe(subject);
    logInfo('HostListener', `✅ Subscribed to ${subject}`);

    (async () => {
      for await (const msg of sub) {
        if (!this.isRunning) break;

        try {
          const request = JSON.parse(msg.string());
          logInfo('HostListener', `📨 Received value-chain-expert request: ${JSON.stringify(request)}`);

          // Wait for available slot
          await this.waitForSlot();

          // Spawn the strategic-recommendation-generator agent
          await this.spawnValueChainExpertAgent(request);

        } catch (error: any) {
          logError('HostListener', `Error processing value-chain-expert request: ${error.message}`);
        }
      }
    })();
  }

  /**
   * Spawn the strategic-recommendation-generator agent
   */
  private async spawnValueChainExpertAgent(request: any) {
    this.activeAgents++;

    const agentFile = '.claude/agents/strategic-recommendation-generator.md';
    const reqNumber = `REQ-STRATEGIC-AUTO-${Date.now()}`;

    logInfo('HostListener', `🚀 Spawning strategic-recommendation-generator (${this.activeAgents}/${this.maxConcurrent} active)`);

    try {
      const contextInput = `TASK: Strategic Value Chain Evaluation

You are the Value Chain Expert daemon. Analyze the current state of the AGOGSAAS system and generate strategic feature recommendations.

REQUEST INFO:
- Requested At: ${request.requestedAt}
- Requested By: ${request.requestedBy}

INSTRUCTIONS:
1. Review the codebase for improvement opportunities
2. Generate RICE-scored recommendations
3. Output recommendations in the JSON format below (DO NOT write to any markdown files!)

CRITICAL: DO NOT modify any markdown files like OWNER_REQUESTS.md or PENDING_RECOMMENDATIONS.md!
Recommendations are now stored in the SDLC database - just output them in JSON format.

When complete, output:
\`\`\`json
{
  "agent": "strategic-recommendation-generator",
  "req_number": "${reqNumber}",
  "status": "COMPLETE",
  "summary": "Generated N strategic recommendations",
  "recommendations": [
    {
      "title": "Short descriptive title",
      "owner": "marcus|sarah|alex",
      "priority": "P0|P1|P2|P3",
      "businessValue": "Why this matters to the business",
      "requirements": ["Specific requirement 1", "Specific requirement 2"],
      "riceScore": {
        "reach": 1-10,
        "impact": 1-10,
        "confidence": 0.0-1.0,
        "effort": 1-10,
        "total": calculated
      }
    }
  ],
  "changes": {
    "files_created": [],
    "files_modified": [],
    "files_deleted": [],
    "tables_created": [],
    "tables_modified": ["recommendations (via NATS)"],
    "migrations_added": [],
    "key_changes": [
      "Generated N strategic recommendations for SDLC review queue"
    ]
  }
}
\`\`\`

IMPORTANT: Output recommendations in the JSON array - they will be published to the SDLC database automatically.`;

      // Spawn Claude agent - cwd must be project root (4 levels up from scripts/)
      // scripts/ -> agent-backend/ -> print-industry-erp/ -> Implementation/ -> agogsaas/
      const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
      const model = this.getModelForAgent('strategic-recommendation-generator');
      logInfo('value-chain-spawn', `Using model: ${model} for strategic-recommendation-generator`);
      logInfo('value-chain-spawn', `Spawning claude with args: --agent ${agentFile} --model ${model}`);
      logInfo('value-chain-spawn', `CWD: ${projectRoot}`);

      const agentProcess = spawn('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
        cwd: projectRoot,
        shell: true,
      });

      logInfo('value-chain-spawn', `Claude process spawned, PID: ${agentProcess.pid}`);

      let stdout = '';

      // Handle spawn errors
      agentProcess.on('error', (err) => {
        logError('value-chain-spawn', `Failed to spawn claude process: ${err.message}`);
        this.activeAgents--;
      });

      // Pass context via stdin
      agentProcess.stdin.write(contextInput);
      agentProcess.stdin.end();
      logInfo('value-chain-spawn', `Context written to stdin (${contextInput.length} chars)`);

      // Capture output
      agentProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        logInfo('value-chain-expert', chunk.trim());
      });

      agentProcess.stderr.on('data', (data) => {
        logError('value-chain-expert', data.toString().trim());
      });

      // Handle completion
      agentProcess.on('close', async (code) => {
        this.activeAgents--;

        if (code === 0) {
          logInfo('value-chain-spawn', '✅ strategic-recommendation-generator completed');

          // Parse completion notice
          const completionNotice = this.parseCompletionNotice(stdout);
          if (completionNotice) {
            // Publish completion to NATS so Docker daemon knows it completed
            await this.nc.publish('agog.agent.responses.value-chain-expert', sc.encode(JSON.stringify(completionNotice)));
            logInfo('value-chain-spawn', '📤 Published completion to agog.agent.responses.value-chain-expert');

            // Publish recommendations to SDLC database via NATS
            if (completionNotice.recommendations && Array.isArray(completionNotice.recommendations)) {
              for (const rec of completionNotice.recommendations) {
                const recommendation = {
                  reqNumber: `REQ-STRATEGIC-AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  title: rec.title,
                  owner: rec.owner || 'marcus',
                  priority: rec.priority || 'P2',
                  businessValue: rec.businessValue,
                  requirements: rec.requirements || [],
                  generatedBy: 'strategic-recommendation-generator',
                  generatedAt: new Date().toISOString(),
                  riceScore: rec.riceScore,
                };
                await this.nc.publish('agog.recommendations.strategic', sc.encode(JSON.stringify(recommendation)));
                logInfo('value-chain-spawn', `📤 Published recommendation: ${recommendation.title}`);
              }
              logInfo('value-chain-spawn', `📊 Published ${completionNotice.recommendations.length} recommendations to SDLC database`);
            }
          }

          // Store change management record
          await this.storeChangeManagement('strategic-recommendation-generator', reqNumber, stdout, completionNotice, true);
        } else {
          logError('value-chain-spawn', `strategic-recommendation-generator failed with code ${code}`);

          // Store failure record
          await this.storeChangeManagement('strategic-recommendation-generator', reqNumber, stdout, null, false);
        }
      });

    } catch (error: any) {
      this.activeAgents--;
      logError('value-chain-spawn', `Failed to spawn strategic-recommendation-generator: ${error.message}`);
    }
  }

  /**
   * Subscribe to Sam audit requests using JetStream durable consumer
   * Fixes race condition: messages persist in stream until consumed
   * Per WORKFLOW_RULES.md Rule #1: Fail fast if dependency unavailable
   */
  private async subscribeToSamAuditRequests() {
    const subject = 'agog.agent.requests.sam-audit';
    const streamName = 'agog_audit_requests';
    const consumerName = 'host-listener-audit-consumer';

    try {
      const jsm = await this.nc.jetstreamManager();

      // Create durable pull consumer
      try {
        await jsm.consumers.add(streamName, {
          durable_name: consumerName,
          ack_policy: 'explicit' as any,
          deliver_policy: 'all' as any, // Deliver all messages from stream
          filter_subject: subject,
          max_deliver: 3, // Retry up to 3 times
          ack_wait: 5 * 60 * 1_000_000_000, // 5 minute ack timeout
        });
        logInfo('HostListener', `✅ Created durable consumer: ${consumerName}`);
      } catch (error: any) {
        // Consumer might already exist
        logDebug('HostListener', `Consumer already exists or error: ${error.message}`);
      }

      // Get consumer
      const consumer = await this.js.consumers.get(streamName, consumerName);
      logInfo('HostListener', `✅ Connected to JetStream consumer for ${subject}`);

      // Process messages (pull-based - prevents race condition)
      (async () => {
        while (this.isRunning) {
          try {
            // Fetch one message at a time
            const messages = await consumer.fetch({ max_messages: 1, expires: 1000 });

            for await (const msg of messages) {
              const request = JSON.parse(msg.string());
              logInfo('HostListener', `📨 Received sam-audit request from JetStream: ${request.reqNumber}`);

              try {
                await this.waitForSlot();
                await this.spawnSamAuditAgent(request);

                // ACK message after successful spawn
                msg.ack();
                logInfo('HostListener', `✅ ACKed audit request ${request.reqNumber}`);

              } catch (error: any) {
                logError('HostListener', `Failed to spawn audit: ${error.message}`);
                // NACK message to retry
                msg.nak(30000); // Retry in 30 seconds
              }
            }
          } catch (error: any) {
            if (error.code !== '408') { // Ignore timeout (no messages)
              logError('HostListener', `Audit consumer error: ${error.message}`);
            }
            await this.sleep(1000); // Brief pause before next fetch
          }
        }
      })();

    } catch (error: any) {
      logError('HostListener', `Failed to create audit consumer: ${error.message}`);
      // Rule #1: Fail fast if critical dependency unavailable
      process.exit(1);
    }
  }

  /**
   * Spawn Sam (Senior Auditor) agent for comprehensive system audits
   */
  private async spawnSamAuditAgent(request: any) {
    this.activeAgents++;

    const agentFile = '.claude/agents/sam-senior-auditor.md';
    const reqNumber = request.reqNumber || `REQ-AUDIT-${Date.now()}`;
    const auditType = request.auditType || 'manual';

    logInfo('HostListener', `🚀 Spawning sam-senior-auditor (${auditType}) (${this.activeAgents}/${this.maxConcurrent} active)`);

    try {
      // Check if this is a P0 discovery audit
      const isP0Audit = auditType === 'p0-discovery';

      const contextInput = isP0Audit ? `TASK: P0 ISSUE DISCOVERY AND REMEDIATION

You are Sam, the Senior Auditor. This is a CRITICAL P0 audit.

YOUR MISSION:
1. RUN BUILDS to discover compile-time errors
2. TEST RUNNING APP to discover runtime errors
3. CREATE P0 REQs for EVERY error found
4. SPAWN AGENTS to fix those errors immediately

Request Number: ${reqNumber}
Timestamp: ${request.timestamp || new Date().toISOString()}

═══════════════════════════════════════════════════════════════
STEP 1: BUILD CHECKS (Compile-time errors)
═══════════════════════════════════════════════════════════════

WARNING: Host builds may pass while Docker containers are broken!
The host machine and Docker containers have DIFFERENT node_modules.
Always check Docker logs (Step 2f) even if host builds pass.

1a. Backend Build (HOST - may differ from Docker):
\`\`\`bash
cd Implementation/print-industry-erp/backend
npm run build 2>&1
\`\`\`

1b. Frontend Build (HOST - may differ from Docker):
\`\`\`bash
cd Implementation/print-industry-erp/frontend
npm run build 2>&1
\`\`\`

═══════════════════════════════════════════════════════════════
STEP 2: RUNTIME CHECKS (The app must WORK, not just compile!)
═══════════════════════════════════════════════════════════════

2a. Check if Frontend Dev Server responds:
\`\`\`bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "FRONTEND DOWN"
\`\`\`

2b. Check if Backend GraphQL responds:
\`\`\`bash
curl -s http://localhost:4001/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{__typename}"}' || echo "BACKEND DOWN"
\`\`\`

2c. Test critical GraphQL queries (check for runtime errors):
\`\`\`bash
# Test a real query - if this fails, the app is broken
curl -s http://localhost:4001/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ customers(first: 1) { edges { node { id } } } }"}' 2>&1
\`\`\`

2d. Check frontend console for JavaScript errors:
- Open http://localhost:3000 in browser context
- Look for red errors in console
- Check network tab for failed requests

2e. Check Docker container health:
\`\`\`bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(agogsaas|unhealthy|Exited)"
\`\`\`

2f. CHECK DOCKER LOGS FOR ERRORS (CRITICAL - containers can be "Up" but broken inside):
\`\`\`bash
# Backend container logs - look for TypeScript errors, missing modules, crashes
docker logs agogsaas-app-backend --tail 50 2>&1 | grep -E "(error|Error|ERROR|Cannot find|failed|Failed|FATAL)"

# Frontend container logs - look for build/runtime errors
docker logs agogsaas-app-frontend --tail 50 2>&1 | grep -E "(error|Error|ERROR|Cannot find|failed|Failed|FATAL)"
\`\`\`

IMPORTANT: A container showing "Up" does NOT mean the app is working!
Check logs for compilation errors, missing dependencies, or startup failures.

═══════════════════════════════════════════════════════════════
STEP 3: For EACH error found (build OR runtime):
═══════════════════════════════════════════════════════════════
a) Create a P0 REQ in the database or NATS
b) Spawn the appropriate agent (Roy for backend, Jen for frontend)

Use NATS publishing:
- P0 REQ topic: agog.requirements.p0.new
- Agent spawn topic: agog.spawn.request

CRITICAL: A build that passes but an app that doesn't work is STILL A P0 ISSUE!

${request.context?.instructions || ''}

When complete, output:` : `TASK: ${auditType.toUpperCase()} System Audit

You are Sam, the Senior Auditor. Run a comprehensive ${auditType} audit.

Audit Type: ${auditType}
Request Number: ${reqNumber}
Timestamp: ${request.timestamp || new Date().toISOString()}

Execute ALL checks from your audit checklist:
1. Security Audit (secrets scan, npm audit, semgrep, RLS)
2. i18n Completeness Audit
3. E2E Smoke Test (all routes, all languages)
4. Database Stress Test (use k6)
5. Human Documentation Audit
6. Database Health Check

Be thorough. Take your time.

When complete, output:
\`\`\`json
{
  "agent": "sam",
  "req_number": "${reqNumber}",
  "audit_type": "${auditType}",
  "status": "COMPLETE",
  "timestamp": "${new Date().toISOString()}",
  "duration_minutes": 0,
  "overall_status": "PASS|WARNING|FAIL",
  "deployment_blocked": false,
  "block_reasons": [],
  "recommendations": [],
  "changes": {
    "files_created": [],
    "files_modified": [],
    "files_deleted": [],
    "tables_created": [],
    "tables_modified": [],
    "migrations_added": [],
    "key_changes": ["Completed ${auditType} audit"]
  }
}
\`\`\`

IMPORTANT: The "changes" object is REQUIRED - explicitly list what you created or modified.`;

      // Spawn Claude agent - cwd must be project root (4 levels up from scripts/)
      const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
      const model = 'opus'; // Sam needs OPUS for complex auditing, P0 triage, and agent coordination
      console.log(`[HostListener] Using model: ${model} for sam`);
      logInfo('sam-spawn', `Spawning claude with args: --agent ${agentFile} --model ${model}`);
      logInfo('sam-spawn', `CWD: ${projectRoot}`);

      const agentProcess = spawn('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
        cwd: projectRoot,
        shell: true,
      });

      logInfo('sam-spawn', `Claude process spawned, PID: ${agentProcess.pid}`);

      let stdout = '';

      // Handle spawn errors
      agentProcess.on('error', (err) => {
        logError('sam-spawn', `Failed to spawn claude process: ${err.message}`);
        this.activeAgents--;
      });

      // Pass context via stdin
      agentProcess.stdin.write(contextInput);
      agentProcess.stdin.end();
      logInfo('sam-spawn', `Context written to stdin (${contextInput.length} chars)`);

      // Capture output
      agentProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        logInfo('sam', chunk.trim());
      });

      agentProcess.stderr.on('data', (data) => {
        logError('sam', data.toString().trim());
      });

      // Handle completion
      agentProcess.on('close', async (code) => {
        this.activeAgents--;
        logInfo('sam-spawn', `Process exited with code: ${code}`);

        if (code === 0) {
          logInfo('sam-spawn', `✅ sam-senior-auditor completed (${auditType})`);

          // Parse completion notice
          const completionNotice = this.parseCompletionNotice(stdout);
          if (completionNotice) {
            // Publish completion to NATS so Docker daemon knows it completed
            await this.nc.publish('agog.agent.responses.sam-audit', sc.encode(JSON.stringify(completionNotice)));
            logInfo('sam-spawn', '📤 Published completion to agog.agent.responses.sam-audit');
          }

          // Store change management record
          await this.storeChangeManagement('sam', reqNumber, stdout, completionNotice, true);
        } else {
          logError('sam-spawn', `sam-senior-auditor failed with code ${code}`);

          // Publish failure
          const failureNotice = {
            agent: 'sam',
            req_number: reqNumber,
            audit_type: auditType,
            status: 'FAILED',
            overall_status: 'WARNING',
            deployment_blocked: false,
            block_reasons: [],
            recommendations: ['Audit failed - manual review required'],
          };
          await this.nc.publish('agog.agent.responses.sam-audit', sc.encode(JSON.stringify(failureNotice)));

          // Store failure record
          await this.storeChangeManagement('sam', reqNumber, stdout, null, false);
        }
      });

    } catch (error: any) {
      this.activeAgents--;
      logError('sam-spawn', `Failed to spawn sam-senior-auditor: ${error.message}`);
    }
  }

  /**
   * Subscribe to generic agent spawn requests from Sam or other daemons
   * This allows Sam to spawn Roy, Jen, or other agents to fix P0 issues
   */
  private async subscribeToAgentSpawnRequests() {
    const subject = 'agog.spawn.request';

    const sub = this.nc.subscribe(subject);
    logInfo('HostListener', `✅ Subscribed to ${subject}`);

    (async () => {
      for await (const msg of sub) {
        if (!this.isRunning) break;

        try {
          const request = JSON.parse(msg.string());
          logInfo('HostListener', `📨 Received spawn request: ${JSON.stringify(request)}`);

          const { agentId, reqNumber, priority, description, contextData } = request;

          if (!agentId || !reqNumber) {
            logError('HostListener', 'Invalid spawn request - missing agentId or reqNumber');
            continue;
          }

          // Wait for available slot
          await this.waitForSlot();

          // Spawn the requested agent
          logInfo('HostListener', `🚀 Spawning ${agentId} for P0 REQ ${reqNumber} (priority: ${priority || 'P0'})`);

          // Build a stage event for the existing spawnAgent method
          const stageEvent: StageEvent = {
            eventType: 'stage.started',
            reqNumber: reqNumber,
            stage: `P0 Fix: ${description?.substring(0, 50) || 'Critical Issue'}`,
            agentId: agentId,
            contextData: {
              featureTitle: description || 'P0 Critical Fix',
              priority: priority || 'P0',
              source: 'sam-audit',
              ...contextData,
            },
          };

          this.spawnAgent(stageEvent);

        } catch (error: any) {
          logError('HostListener', `Error processing spawn request: ${error.message}`);
        }
      }
    })();
  }

  /**
   * Keep the process alive
   */
  private async keepAlive() {
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  private async waitForSlot() {
    while (this.activeAgents >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get relevant learnings for an agent before they start work
   */
  private async getLearningsForAgent(agentId: string): Promise<any[]> {
    try {
      const result = await pgPool.query(
        `SELECT learning_type, title, description, confidence_score
         FROM agent_learnings
         WHERE agent_id = $1 AND confidence_score >= 0.5
         ORDER BY confidence_score DESC, times_applied DESC
         LIMIT 5`,
        [agentId]
      );

      if (result.rows.length > 0) {
        logDebug('HostListener', `📚 Found ${result.rows.length} learnings for ${agentId}`);
      }

      return result.rows;
    } catch (error: any) {
      logError('HostListener', `Failed to get learnings: ${error.message}`);
      return [];
    }
  }

  /**
   * Get previous decisions for a request (useful for retries)
   */
  private async getPreviousDecisions(reqNumber: string): Promise<any[]> {
    try {
      const result = await pgPool.query(
        `SELECT agent, decision, reasoning, created_at
         FROM strategic_decisions
         WHERE req_number = $1
         ORDER BY created_at DESC
         LIMIT 3`,
        [reqNumber]
      );

      if (result.rows.length > 0) {
        logDebug('HostListener', `📋 Found ${result.rows.length} previous decisions for ${reqNumber}`);
      }

      return result.rows;
    } catch (error: any) {
      logError('HostListener', `Failed to get decisions: ${error.message}`);
      return [];
    }
  }

  private async spawnAgent(event: StageEvent) {
    this.activeAgents++;

    const { reqNumber, agentId, contextData } = event;
    const agentFile = this.getAgentFilePath(agentId);

    logInfo('HostListener', `🚀 Spawning ${agentId} for ${reqNumber} (${this.activeAgents}/${this.maxConcurrent} active)`);

    // Query relevant learnings for this agent BEFORE starting
    const learnings = await this.getLearningsForAgent(agentId);
    const previousDecisions = await this.getPreviousDecisions(reqNumber);

    try {
      // Build prompt with NATS publishing instructions
      const stream = this.getDeliverableStream(agentId);

      // Format learnings for the agent
      const learningsSection = learnings.length > 0
        ? `\n\nLEARNINGS FROM PAST WORK (apply these lessons):\n${learnings.map((l, i) => `${i + 1}. [${l.learning_type}] ${l.title}: ${l.description}`).join('\n')}\n`
        : '';

      // Format previous decisions if this is a retry
      const decisionsSection = previousDecisions.length > 0
        ? `\n\nPREVIOUS DECISIONS ON THIS REQUEST:\n${previousDecisions.map(d => `- ${d.agent} decided ${d.decision}: ${d.reasoning?.substring(0, 200) || 'No reason given'}`).join('\n')}\n`
        : '';

      const contextInput = `TASK: ${reqNumber} - ${contextData.featureTitle || 'Feature Request'}

══════════════════════════════════════════════════════════════════════════════
MANDATORY WORKFLOW RULES (violations are audit blockers)
══════════════════════════════════════════════════════════════════════════════
${this.workflowRules}
══════════════════════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════════════════════
SASHA - YOUR WORKFLOW TECHNICAL SUPPORT
══════════════════════════════════════════════════════════════════════════════
If you have ANY question about workflow rules, or encounter ANY infrastructure issue:
- Ask Sasha via NATS topic: agog.agent.requests.sasha-rules
- Include: { requestingAgent: "${agentId}", question: "your question", context: "relevant context" }
- Sasha will respond via: agog.agent.responses.sasha-rules

Examples of when to ask Sasha:
- "Can I downgrade this error to a warning?" → Sasha will say NO
- "NATS connection failed, what should I do?" → Sasha will fix it
- "Can I continue with partial dependencies?" → Sasha will say NO
══════════════════════════════════════════════════════════════════════════════
${learningsSection}${decisionsSection}
DELIVERABLE INSTRUCTIONS:
1. Complete your work according to your agent definition
2. When COMPLETE, output a JSON completion notice in this EXACT format:

\`\`\`json
{
  "agent": "${agentId}",
  "req_number": "${reqNumber}",
  "status": "COMPLETE",
  "deliverable": "nats://agog.deliverables.${agentId}.${stream}.${reqNumber}",
  "summary": "Brief summary of what you completed",
  "changes": {
    "files_created": ["path/to/new/file.ts"],
    "files_modified": ["path/to/existing/file.ts"],
    "files_deleted": [],
    "tables_created": ["table_name"],
    "tables_modified": [],
    "migrations_added": ["V1.2.3__description.sql"],
    "key_changes": [
      "Added X feature to Y component",
      "Fixed Z bug in W service"
    ]
  }
}
\`\`\`

IMPORTANT:
- The JSON must be wrapped in a markdown code block with \`\`\`json tags
- The "changes" object is REQUIRED - explicitly list what you created, modified, or deleted
- If no changes in a category, use empty array []

CONTEXT:
${JSON.stringify(contextData, null, 2)}`;

      // Spawn Claude agent - cwd must be project root (4 levels up from scripts/)
      // scripts/ -> agent-backend/ -> print-industry-erp/ -> Implementation/ -> agogsaas/
      const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
      const model = this.getModelForAgent(agentId);
      logInfo(`${agentId}-spawn`, `Using model: ${model} for ${agentId}`);
      logInfo(`${agentId}-spawn`, `Spawning claude with args: --agent ${agentFile} --model ${model}`);
      logInfo(`${agentId}-spawn`, `CWD: ${projectRoot}`);

      const agentProcess = spawn('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
        cwd: projectRoot,
        shell: true,
      });

      logInfo(`${agentId}-spawn`, `Claude process spawned, PID: ${agentProcess.pid}`);

      let stdout = '';
      let stderr = '';

      // Handle spawn errors
      agentProcess.on('error', (err) => {
        logError(`${agentId}-spawn`, `Failed to spawn claude process: ${err.message}`);
        this.activeAgents--;
      });

      // Pass context via stdin
      agentProcess.stdin.write(contextInput);
      agentProcess.stdin.end();
      logInfo(`${agentId}-spawn`, `Context written to stdin (${contextInput.length} chars)`);

      // Capture output
      agentProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        logInfo(agentId, chunk.trim());
      });

      agentProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        logError(agentId, chunk.trim());
      });

      // Handle completion
      agentProcess.on('close', async (code) => {
        this.activeAgents--;

        if (code === 0) {
          logInfo(`${agentId}-spawn`, `✅ ${agentId} completed for ${reqNumber}`);

          // Parse agent output for completion notice
          const completionNotice = this.parseCompletionNotice(stdout);

          if (completionNotice) {
            // Publish to NATS deliverable stream
            await this.publishDeliverable(agentId, reqNumber, completionNotice);

            // Cache deliverable in PostgreSQL for quick lookup
            await this.cacheDeliverable(agentId, reqNumber, completionNotice);
          } else {
            logWarn(`${agentId}-spawn`, `${agentId} did not return valid completion notice`);
          }

          // Store change management record (full stdout with change details)
          await this.storeChangeManagement(agentId, reqNumber, stdout, completionNotice, true);

          // Extract and store learnings from agent output
          await this.extractLearningsFromOutput(agentId, reqNumber, stdout, completionNotice);
        } else {
          logError(`${agentId}-spawn`, `${agentId} failed with code ${code}`);
          logError(`${agentId}-spawn`, `stderr: ${stderr}`);

          // Publish failure event
          await this.publishFailure(agentId, reqNumber, stderr || 'Agent process exited with non-zero code');

          // Store failure record
          await this.storeChangeManagement(agentId, reqNumber, stdout + '\n\nSTDERR:\n' + stderr, null, false);
        }
      });

    } catch (error: any) {
      this.activeAgents--;
      logError(`${agentId}-spawn`, `Failed to spawn ${agentId}: ${error.message}`);
      await this.publishFailure(agentId, reqNumber, error.message);
    }
  }

  private getAgentFilePath(agentId: string): string {
    // Map agent IDs to file names
    const agentFiles: Record<string, string> = {
      cynthia: '.claude/agents/cynthia-research-new.md',
      sylvia: '.claude/agents/sylvia-critique.md',
      roy: '.claude/agents/roy-backend.md',
      jen: '.claude/agents/jen-frontend.md',
      billy: '.claude/agents/billy-qa.md',
      priya: '.claude/agents/priya-statistics.md',
      miki: '.claude/agents/miki-devops.md',
      berry: '.claude/agents/berry-devops.md',
      tim: '.claude/agents/tim-documentation.md',
      liz: '.claude/agents/liz-frontend-tester.md',
      todd: '.claude/agents/todd-performance-tester.md',
      vic: '.claude/agents/vic-security-tester.md',
      sam: '.claude/agents/sam-senior-auditor.md',
      sasha: '.claude/agents/sasha-workflow-expert.md',
    };

    return agentFiles[agentId] || `.claude/agents/${agentId}.md`;
  }

  /** Check workflow infrastructure health */
  private async checkWorkflowHealth(): Promise<{ nats: boolean; database: boolean; embeddings: boolean }> {
    const health = { nats: false, database: false, embeddings: false };
    try { health.nats = !this.nc.isClosed(); } catch { health.nats = false; }
    try {
      const r = await axios.get('https://api.agog.fyi/api/agent/health', { timeout: 5000 });
      health.database = r.data?.database === true;
    } catch { health.database = false; }
    try {
      const r = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
      health.embeddings = r.status === 200;
    } catch { health.embeddings = false; }
    return health;
  }

  /** Publish heartbeat to SDLC infrastructure health table */
  private startHealthHeartbeat() {
    // Publish immediately on startup
    this.publishHealthHeartbeat();

    // Then every 60 seconds
    setInterval(() => {
      this.publishHealthHeartbeat();
    }, 60000);

    logInfo('HostListener', '💓 Health heartbeat publishing started (every 60s)');
  }

  private async publishHealthHeartbeat() {
    try {
      const health = await this.checkWorkflowHealth();
      const status = health.nats ? 'healthy' : 'degraded';

      await axios.post('https://api.agog.fyi/api/agent/infrastructure/health', {
        component: 'host_listener',
        status,
        details: {
          description: 'Spawns Claude CLI agents on Windows host',
          activeAgents: this.activeAgents,
          maxConcurrent: this.maxConcurrent,
          natsConnected: health.nats,
          sdlcConnected: health.database,
          ollamaConnected: health.embeddings,
          uptime: Math.floor(process.uptime()),
          pid: process.pid,
          // Include recent sanitized logs for SDLC visibility
          recentLogs: getRecentLogs(30),
        }
      }, { timeout: 5000 });

      logInfo('HostListener', `💓 Health heartbeat published (${this.activeAgents}/${this.maxConcurrent} agents, status: ${status})`);
    } catch (e: any) {
      logError('HostListener', `Failed to publish health heartbeat: ${e.message}`);
    }
  }

  /** Subscribe to control commands from SDLC */
  private async subscribeToControlCommands() {
    const sub = this.nc.subscribe('agog.control.host_listener');
    logInfo('HostListener', '🎮 Subscribed to control commands on agog.control.host_listener');

    (async () => {
      for await (const msg of sub) {
        if (!this.isRunning) break;
        try {
          const cmd = JSON.parse(sc.decode(msg.data));
          logInfo('HostListener', `🎮 Received control command: ${cmd.action}`);

          switch (cmd.action) {
            case 'status':
              // Return current status
              const health = await this.checkWorkflowHealth();
              msg.respond(sc.encode(JSON.stringify({
                success: true,
                status: health.nats ? 'healthy' : 'degraded',
                activeAgents: this.activeAgents,
                maxConcurrent: this.maxConcurrent,
                uptime: Math.floor(process.uptime()),
                recentLogs: getRecentLogs(10),
              })));
              break;

            case 'restart':
              // Graceful restart - exit with code 0, let start-listener.bat restart us
              logInfo('HostListener', '🔄 Restart requested via SDLC - initiating graceful shutdown...');
              msg.respond(sc.encode(JSON.stringify({ success: true, message: 'Restarting...' })));
              // Give time for response to send
              setTimeout(() => process.exit(0), 1000);
              break;

            case 'get_logs':
              // Return recent in-memory logs
              const count = cmd.count || 50;
              msg.respond(sc.encode(JSON.stringify({
                success: true,
                logs: getRecentLogs(count),
              })));
              break;

            case 'get_log_files':
              // List available log files
              try {
                const logsDir = path.join(__dirname, '..', 'logs');
                const files = fs.readdirSync(logsDir)
                  .filter(f => f.endsWith('.log'))
                  .map(f => ({
                    name: f,
                    path: path.join(logsDir, f),
                    size: fs.statSync(path.join(logsDir, f)).size,
                    modified: fs.statSync(path.join(logsDir, f)).mtime.toISOString(),
                  }))
                  .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
                msg.respond(sc.encode(JSON.stringify({ success: true, files })));
              } catch (e: any) {
                msg.respond(sc.encode(JSON.stringify({ success: false, error: e.message })));
              }
              break;

            case 'read_log_file':
              // Read a specific log file (sanitized, with pagination)
              try {
                const { filename, lines = 200, offset = 0 } = cmd;
                if (!filename) throw new Error('filename required');

                const logsDir = path.join(__dirname, '..', 'logs');
                const filePath = path.join(logsDir, path.basename(filename)); // Prevent path traversal

                if (!fs.existsSync(filePath)) {
                  throw new Error('Log file not found');
                }

                const content = fs.readFileSync(filePath, 'utf8');
                const allLines = content.split('\n');
                const totalLines = allLines.length;

                // Get requested slice
                const start = Math.max(0, totalLines - lines - offset);
                const end = totalLines - offset;
                const selectedLines = allLines.slice(start, end);

                // Sanitize each line
                const sanitizedLines = selectedLines.map(line => sanitizeLogMessage(line));

                msg.respond(sc.encode(JSON.stringify({
                  success: true,
                  filename,
                  totalLines,
                  offset,
                  lines: sanitizedLines,
                })));
              } catch (e: any) {
                msg.respond(sc.encode(JSON.stringify({ success: false, error: e.message })));
              }
              break;

            case 'tail_log_file':
              // Get last N lines of current log file (most common use case)
              try {
                const tailLines = cmd.lines || 100;
                const currentLogFile = path.join(__dirname, '..', 'logs',
                  `host-listener-${new Date().toISOString().split('T')[0]}.log`);

                if (!fs.existsSync(currentLogFile)) {
                  throw new Error('Current log file not found');
                }

                const content = fs.readFileSync(currentLogFile, 'utf8');
                const allLines = content.split('\n');
                const lastLines = allLines.slice(-tailLines);
                const sanitizedLines = lastLines.map(line => sanitizeLogMessage(line));

                msg.respond(sc.encode(JSON.stringify({
                  success: true,
                  filename: path.basename(currentLogFile),
                  lines: sanitizedLines,
                })));
              } catch (e: any) {
                msg.respond(sc.encode(JSON.stringify({ success: false, error: e.message })));
              }
              break;

            default:
              msg.respond(sc.encode(JSON.stringify({
                success: false,
                error: `Unknown action: ${cmd.action}`,
              })));
          }
        } catch (e: any) {
          logError('HostListener', `Control command error: ${e.message}`);
        }
      }
    })();
  }

  /** Subscribe to Sasha rule questions from agents via NATS */
  private async subscribeToSashaRuleQuestions() {
    const sub = this.nc.subscribe('agog.agent.requests.sasha-rules');
    logInfo('HostListener', '✅ Subscribed to agog.agent.requests.sasha-rules');
    (async () => {
      for await (const msg of sub) {
        if (!this.isRunning) break;
        try {
          const request = JSON.parse(sc.decode(msg.data));
          logInfo('HostListener', `📨 Sasha rule question from ${request.requestingAgent}`);
          await this.waitForSlot();
          await this.spawnSashaForRuleQuestion(request);
        } catch (e: any) {
          logError('HostListener', `Sasha rule error: ${e.message}`);
        }
      }
    })();
  }

  /** Spawn Sasha for rule question (haiku for speed) */
  private async spawnSashaForRuleQuestion(request: any) {
    this.activeAgents++;
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    try {
      const ctx = `TASK: Answer rule question
FROM: ${request.requestingAgent}
QUESTION: ${request.question}
CONTEXT: ${request.context || 'None'}

Read .claude/WORKFLOW_RULES.md and answer YES or NO with brief explanation.
If the action would violate a rule, explain which rule and why.`;

      const proc = spawn('claude', [
        '--agent', '.claude/agents/sasha-workflow-expert.md',
        '--model', 'haiku',
        '--dangerously-skip-permissions', '--print'
      ], { cwd: projectRoot, shell: true });

      let out = '';
      proc.stdin.write(ctx);
      proc.stdin.end();
      proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.on('close', async (code) => {
        this.activeAgents--;
        if (code === 0) {
          const ans = this.parseCompletionNotice(out);
          if (ans) {
            this.nc.publish('agog.agent.responses.sasha-rules', sc.encode(JSON.stringify(ans)));
            logInfo('sasha-rules', `📤 Answer: ${ans.answer || ans.summary || 'Response sent'}`);
          }
        }
      });
    } catch (e: any) {
      this.activeAgents--;
      logError('sasha-rules', `Spawn failed: ${e.message}`);
    }
  }

  /** Spawn Sasha for infrastructure recovery (sonnet for complex debugging) */
  private async spawnSashaForInfraRecovery(health: { nats: boolean; database: boolean; embeddings: boolean }): Promise<boolean> {
    this.activeAgents++;
    logInfo('HostListener', `🚨 Spawning Sasha for recovery: NATS=${health.nats}, DB=${health.database}, Embed=${health.embeddings}`);

    return new Promise((resolve) => {
      try {
        const issues = [];
        if (!health.nats) issues.push('NATS');
        if (!health.database) issues.push('SDLC DB');
        if (!health.embeddings) issues.push('Embeddings');

        const ctx = `TASK: Fix workflow infrastructure
ISSUES DOWN: ${issues.join(', ')}
Workflow is HALTED until you fix these. Use recovery procedures from your agent definition.
Report ready_to_resume: true when fixed.`;

        const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
        const proc = spawn('claude', [
          '--agent', '.claude/agents/sasha-workflow-expert.md',
          '--model', 'sonnet',
          '--dangerously-skip-permissions', '--print'
        ], { cwd: projectRoot, shell: true });

        let out = '';
        proc.stdin.write(ctx);
        proc.stdin.end();
        proc.stdout.on('data', (d) => {
          out += d.toString();
          logInfo('sasha-recovery', d.toString().trim());
        });
        proc.on('close', async (code) => {
          this.activeAgents--;
          const r = this.parseCompletionNotice(out);
          resolve(code === 0 && r?.ready_to_resume === true);
        });
      } catch (e: any) {
        this.activeAgents--;
        logError('sasha-recovery', `Spawn failed: ${e.message}`);
        resolve(false);
      }
    });
  }

  private parseCompletionNotice(stdout: string): any {
    // Look for JSON completion notice in stdout
    // Agents should output: {"agent": "...", "req_number": "...", ...}

    try {
      // Try to find JSON object in output
      const jsonMatch = stdout.match(/\{[^{}]*"agent"[^{}]*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Alternative: look for code blocks with JSON
      const codeBlockMatch = stdout.match(/```json\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }

      return null;
    } catch (error: any) {
      logError('HostListener', `Failed to parse completion notice: ${error.message}`);
      return null;
    }
  }

  private async publishDeliverable(agentId: string, reqNumber: string, deliverable: any) {
    const streamName = this.getDeliverableStream(agentId);
    const subject = `agog.deliverables.${agentId}.${streamName}.${reqNumber}`;

    try {
      // Increased timeout from default 5s to 30s for large deliverables
      await this.js.publish(subject, sc.encode(JSON.stringify(deliverable)), { timeout: 30000 });
      logInfo('HostListener', `📤 Published deliverable to ${subject}`);
    } catch (error: any) {
      logError('HostListener', `Failed to publish deliverable: ${error.message}`);
      // Retry once with longer timeout if initial publish fails
      try {
        logInfo('HostListener', `🔄 Retrying publish with extended timeout...`);
        await this.js.publish(subject, sc.encode(JSON.stringify(deliverable)), { timeout: 60000 });
        logInfo('HostListener', `📤 Retry successful for ${subject}`);
      } catch (retryError: any) {
        logError('HostListener', `Retry also failed: ${retryError.message}`);
      }
    }
  }

  private async publishFailure(agentId: string, reqNumber: string, errorMessage: string) {
    const subject = `agog.orchestration.events.stage.failed`;

    const failureEvent = {
      eventType: 'stage.failed',
      reqNumber,
      agentId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.js.publish(subject, sc.encode(JSON.stringify(failureEvent)), { timeout: 30000 });
      logInfo('HostListener', `📤 Published failure event for ${agentId}`);
    } catch (error: any) {
      logError('HostListener', `Failed to publish failure: ${error.message}`);
    }
  }

  private getDeliverableStream(agentId: string): string {
    const streamMap: Record<string, string> = {
      cynthia: 'research',
      sylvia: 'critique',
      roy: 'backend',
      jen: 'frontend',
      billy: 'qa',
      priya: 'statistics',
      berry: 'devops',
      miki: 'devops',
      sam: 'audit',
    };

    return streamMap[agentId] || agentId;
  }

  /**
   * Get the Claude model to use for an agent
   * Haiku: cheaper/faster for simpler tasks (daemons, docs, stats, devops)
   * Sonnet: more capable for complex reasoning (backend, frontend, research, critique, QA)
   */
  private getModelForAgent(agentId: string): string {
    const haikuAgents = new Set([
      'tim',           // Documentation - straightforward doc updates
      'priya',         // Statistics - data aggregation and reporting
      'berry',         // DevOps - scripted deployment tasks
      'miki',          // DevOps - scripted deployment tasks
      'strategic-recommendation-generator',  // Proactive daemon - templated recommendations
    ]);

    return haikuAgents.has(agentId) ? 'haiku' : 'sonnet';
  }

  /**
   * Store change management record to persistent memory database
   * Uses agent-provided changes (agents know what they changed)
   */
  private async storeChangeManagement(
    agentId: string,
    reqNumber: string,
    stdout: string,
    completionNotice: any,
    success: boolean
  ): Promise<void> {
    try {
      const memoryType = success ? 'agent_change' : 'agent_failure';
      const changes = completionNotice?.changes || {};

      // Format agent-provided changes for human readability
      const changeDetails = this.formatAgentChanges(changes);

      const content = `AGENT CHANGE RECORD: ${agentId} - ${reqNumber}

STATUS: ${success ? 'SUCCESS' : 'FAILURE'}
TIMESTAMP: ${new Date().toISOString()}

SUMMARY:
${completionNotice?.summary || 'No summary provided'}

CHANGES (agent-identified):
${changeDetails}

FULL OUTPUT (truncated to 50KB):
${stdout.substring(0, 50000)}`;

      const metadata = JSON.stringify({
        agent: agentId,
        req_number: reqNumber,
        status: success ? 'completed' : 'failed',
        timestamp: new Date().toISOString(),
        summary: completionNotice?.summary || null,
        deliverable: completionNotice?.deliverable || null,
        // Use agent-provided changes directly
        files_created: changes.files_created || [],
        files_modified: changes.files_modified || [],
        files_deleted: changes.files_deleted || [],
        tables_created: changes.tables_created || [],
        tables_modified: changes.tables_modified || [],
        migrations_added: changes.migrations_added || [],
        key_changes: changes.key_changes || [],
      });

      // Generate embedding for semantic search
      const embedding = await generateEmbedding(content);

      await pgPool.query(
        `INSERT INTO memories (agent_id, memory_type, content, embedding, metadata)
         VALUES ($1, $2, $3, $4::vector, $5::jsonb)`,
        [agentId, memoryType, content, JSON.stringify(embedding), metadata]
      );

      logInfo('HostListener', `💾 Stored change management record for ${agentId}/${reqNumber} (with embedding)`);

      // Update Code Registry with file changes for lineage tracking
      if (changes.files_created?.length || changes.files_modified?.length || changes.files_deleted?.length) {
        await this.updateCodeRegistry(agentId, reqNumber, changes);
      }

      // Log key changes for visibility
      if (changes.key_changes?.length > 0) {
        logInfo('HostListener', `📝 Key changes: ${changes.key_changes.join(', ')}`);
      }
    } catch (error: any) {
      logWarn('HostListener', `Failed to store change management: ${error.message}`);
      // Don't fail the workflow if storage fails - log and continue
    }
  }

  /**
   * Cache deliverable in PostgreSQL for quick lookup
   */
  private async cacheDeliverable(agentId: string, reqNumber: string, deliverable: any): Promise<void> {
    try {
      const stageMap: Record<string, number> = {
        cynthia: 0, sylvia: 1, roy: 2, jen: 3, billy: 4, liz: 5, todd: 6, vic: 7, priya: 8, berry: 9, miki: 9, tim: 10
      };
      const stage = stageMap[agentId] ?? 0;

      await pgPool.query(
        `INSERT INTO nats_deliverable_cache (req_number, agent, stage, deliverable)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (req_number, agent, stage)
         DO UPDATE SET deliverable = $4, created_at = NOW()`,
        [reqNumber, agentId, stage, JSON.stringify(deliverable)]
      );

      logDebug('HostListener', `💾 Cached deliverable: ${reqNumber} from ${agentId}`);
    } catch (error: any) {
      logError('HostListener', `Failed to cache deliverable: ${error.message}`);
    }
  }

  /**
   * Extract learnings from agent output (patterns, gotchas, best practices)
   */
  private async extractLearningsFromOutput(
    agentId: string,
    reqNumber: string,
    stdout: string,
    completionNotice: any
  ): Promise<void> {
    try {
      const learnings: Array<{
        type: 'pattern' | 'anti_pattern' | 'best_practice' | 'gotcha' | 'optimization';
        title: string;
        description: string;
      }> = [];

      // Extract patterns from key_changes
      if (completionNotice?.changes?.key_changes) {
        for (const change of completionNotice.changes.key_changes.slice(0, 3)) {
          if (change.toLowerCase().includes('fix') || change.toLowerCase().includes('bug')) {
            learnings.push({
              type: 'gotcha',
              title: `Bug Fix Pattern: ${change.substring(0, 50)}`,
              description: change
            });
          } else if (change.toLowerCase().includes('optimize') || change.toLowerCase().includes('performance')) {
            learnings.push({
              type: 'optimization',
              title: `Optimization: ${change.substring(0, 50)}`,
              description: change
            });
          } else if (change.toLowerCase().includes('add') || change.toLowerCase().includes('implement')) {
            learnings.push({
              type: 'pattern',
              title: `Implementation: ${change.substring(0, 50)}`,
              description: change
            });
          }
        }
      }

      // Extract learnings from stdout patterns
      const lessonPatterns = [
        { regex: /LESSON[:\s]+([^\n]+)/gi, type: 'best_practice' as const },
        { regex: /WARNING[:\s]+([^\n]+)/gi, type: 'gotcha' as const },
        { regex: /TIP[:\s]+([^\n]+)/gi, type: 'best_practice' as const },
        { regex: /NOTE[:\s]+([^\n]+)/gi, type: 'pattern' as const },
      ];

      for (const { regex, type } of lessonPatterns) {
        let match;
        while ((match = regex.exec(stdout)) !== null && learnings.length < 5) {
          learnings.push({
            type,
            title: `${type}: ${match[1].substring(0, 50)}`,
            description: match[1]
          });
        }
      }

      // Store learnings in database
      for (const learning of learnings) {
        await pgPool.query(
          `INSERT INTO agent_learnings
            (agent_id, learning_type, title, description, example_context, confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [agentId, learning.type, learning.title, learning.description, `From ${reqNumber}`, 0.6]
        );
      }

      if (learnings.length > 0) {
        logDebug('HostListener', `📚 Extracted ${learnings.length} learnings from ${agentId}/${reqNumber}`);
      }
    } catch (error: any) {
      logError('HostListener', `Failed to extract learnings: ${error.message}`);
    }
  }

  /**
   * Update Code Registry with file changes from agent completion
   * This creates lineage tracking for all files touched by agents
   */
  private async updateCodeRegistry(
    agentId: string,
    reqNumber: string,
    changes: any
  ): Promise<void> {
    try {
      const registryPath = path.resolve(__dirname, '..', '..', '..', '..', '.claude', 'registry');
      const registryFile = path.join(registryPath, 'CODE_REGISTRY.json');
      const changesDir = path.join(registryPath, 'changes');

      // Check if registry exists
      if (!fs.existsSync(registryFile)) {
        logWarn('HostListener', 'Code Registry not found, skipping registry update');
        return;
      }

      const registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
      const now = new Date().toISOString();
      let hasChanges = false;

      // Process created files
      if (changes.files_created?.length > 0) {
        for (const filePath of changes.files_created) {
          const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

          // Register new file if not already in registry
          if (!registry.files[normalized]) {
            const module = this.inferModuleFromPath(normalized);
            const type = this.inferTypeFromPath(normalized);
            const id = this.generateRegistryId(registry, module, type);

            registry.files[normalized] = {
              id,
              type,
              module,
              purpose: `Created by ${agentId} for ${reqNumber}`,
              createdByReq: reqNumber,
              createdByAgent: agentId,
              createdAt: now,
              lastModifiedAt: now,
              lastModifiedByReq: reqNumber,
              lastModifiedByAgent: agentId,
              isActive: true,
              changes: [{
                req: reqNumber,
                agent: agentId,
                type: 'created',
                summary: `Created by ${agentId}`,
                date: now
              }]
            };
            hasChanges = true;
            logInfo('HostListener', `📝 Registered new file: ${normalized}`);
          }
        }
      }

      // Process modified files
      if (changes.files_modified?.length > 0) {
        for (const filePath of changes.files_modified) {
          const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

          if (registry.files[normalized]) {
            // Update existing file
            const entry = registry.files[normalized];
            entry.lastModifiedAt = now;
            entry.lastModifiedByReq = reqNumber;
            entry.lastModifiedByAgent = agentId;
            entry.changes.push({
              req: reqNumber,
              agent: agentId,
              type: 'modified',
              summary: `Modified by ${agentId}`,
              date: now
            });
            hasChanges = true;
          } else {
            // File exists but not registered - register as LEGACY then modify
            const module = this.inferModuleFromPath(normalized);
            const type = this.inferTypeFromPath(normalized);
            const id = this.generateRegistryId(registry, module, type);

            registry.files[normalized] = {
              id,
              type,
              module,
              purpose: `Legacy file modified by ${agentId}`,
              createdByReq: 'LEGACY',
              createdByAgent: 'unknown',
              createdAt: now,
              lastModifiedAt: now,
              lastModifiedByReq: reqNumber,
              lastModifiedByAgent: agentId,
              isActive: true,
              changes: [
                { req: 'LEGACY', agent: 'unknown', type: 'created', summary: 'Legacy file - registered on first modification', date: now },
                { req: reqNumber, agent: agentId, type: 'modified', summary: `Modified by ${agentId}`, date: now }
              ]
            };
            hasChanges = true;
            logInfo('HostListener', `📝 Registered legacy file: ${normalized}`);
          }
        }
      }

      // Process deleted files
      if (changes.files_deleted?.length > 0) {
        for (const filePath of changes.files_deleted) {
          const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');

          if (registry.files[normalized]) {
            const entry = registry.files[normalized];
            entry.isActive = false;
            entry.lastModifiedAt = now;
            entry.lastModifiedByReq = reqNumber;
            entry.lastModifiedByAgent = agentId;
            entry.changes.push({
              req: reqNumber,
              agent: agentId,
              type: 'deactivated',
              summary: `Deleted by ${agentId}`,
              date: now
            });
            hasChanges = true;
          }
        }
      }

      // Save registry if changed
      if (hasChanges) {
        registry.lastUpdated = now;
        registry.totalFiles = Object.keys(registry.files).length;
        fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));

        // Also add to daily change log
        const today = now.split('T')[0];
        const dailyLogPath = path.join(changesDir, `${today}.json`);

        let dailyLog: { date: string; changes: any[] } = { date: today, changes: [] };
        if (fs.existsSync(dailyLogPath)) {
          dailyLog = JSON.parse(fs.readFileSync(dailyLogPath, 'utf-8'));
        }

        // Add all changes to daily log
        const allFiles = [
          ...(changes.files_created || []).map((f: string) => ({ file: f, type: 'created' })),
          ...(changes.files_modified || []).map((f: string) => ({ file: f, type: 'modified' })),
          ...(changes.files_deleted || []).map((f: string) => ({ file: f, type: 'deleted' }))
        ];

        for (const { file, type } of allFiles) {
          dailyLog.changes.push({
            file: file.replace(/\\/g, '/').replace(/^\.\//, ''),
            req: reqNumber,
            agent: agentId,
            type,
            summary: `${type} by ${agentId}`,
            timestamp: now
          });
        }

        fs.writeFileSync(dailyLogPath, JSON.stringify(dailyLog, null, 2));
        logInfo('HostListener', `📋 Updated Code Registry with ${allFiles.length} file changes`);
      }
    } catch (error: any) {
      logWarn('HostListener', `Failed to update Code Registry: ${error.message}`);
      // Don't fail the workflow - registry update is secondary
    }
  }

  private inferModuleFromPath(filePath: string): string {
    if (filePath.includes('backend/src') || filePath.includes('backend/migrations')) return 'backend';
    if (filePath.includes('frontend/src')) return 'frontend';
    if (filePath.includes('agent-backend/')) return 'agent-backend';
    return 'docs';
  }

  private inferTypeFromPath(filePath: string): string {
    const basename = path.basename(filePath);
    if (basename.includes('.service.')) return 'service';
    if (basename.includes('.controller.')) return 'controller';
    if (basename.includes('.resolver.')) return 'resolver';
    if (basename.includes('.module.')) return 'module';
    if (basename.includes('.dto.')) return 'dto';
    if (basename.includes('.entity.')) return 'entity';
    if (filePath.includes('/pages/')) return 'page';
    if (filePath.includes('/components/')) return 'component';
    if (filePath.includes('/migrations/')) return 'migration';
    if (filePath.endsWith('.md')) return 'doc';
    if (filePath.endsWith('.graphql')) return 'schema';
    return 'source';
  }

  private generateRegistryId(registry: any, module: string, type: string): string {
    const prefix = module.toUpperCase().slice(0, 2);
    const typePrefix = type.toUpperCase().slice(0, 3);
    let counter = 1;

    Object.values(registry.files).forEach((file: any) => {
      if (file.id?.startsWith(`${prefix}-${typePrefix}`)) {
        const num = parseInt(file.id.split('-').pop() || '0');
        if (num >= counter) counter = num + 1;
      }
    });

    return `${prefix}-${typePrefix}-${String(counter).padStart(4, '0')}`;
  }

  /**
   * Format agent-provided changes for human-readable output
   */
  private formatAgentChanges(changes: any): string {
    if (!changes || Object.keys(changes).length === 0) {
      return 'No changes reported by agent';
    }

    const sections: string[] = [];

    if (changes.files_created?.length > 0) {
      sections.push(`Files Created:\n  - ${changes.files_created.join('\n  - ')}`);
    }
    if (changes.files_modified?.length > 0) {
      sections.push(`Files Modified:\n  - ${changes.files_modified.join('\n  - ')}`);
    }
    if (changes.files_deleted?.length > 0) {
      sections.push(`Files Deleted:\n  - ${changes.files_deleted.join('\n  - ')}`);
    }
    if (changes.tables_created?.length > 0) {
      sections.push(`Tables Created:\n  - ${changes.tables_created.join('\n  - ')}`);
    }
    if (changes.tables_modified?.length > 0) {
      sections.push(`Tables Modified:\n  - ${changes.tables_modified.join('\n  - ')}`);
    }
    if (changes.migrations_added?.length > 0) {
      sections.push(`Migrations Added:\n  - ${changes.migrations_added.join('\n  - ')}`);
    }
    if (changes.key_changes?.length > 0) {
      sections.push(`Key Changes:\n  - ${changes.key_changes.join('\n  - ')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'No specific changes listed';
  }

  private async ensureDeliverablesStream(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();

    // Create stream for DevOps agents (berry and miki) - other agents already have streams
    const streamName = 'agog_features_devops';

    try {
      await jsm.streams.info(streamName);
      logDebug('HostListener', `Stream ${streamName} already exists`);
    } catch (error) {
      logInfo('HostListener', `Creating stream: ${streamName}`);

      const streamConfig: any = {
        name: streamName,
        subjects: ['agog.deliverables.berry.>', 'agog.deliverables.miki.>'],
        storage: StorageType.File,
        retention: RetentionPolicy.Limits,
        max_msgs: 10000,
        max_bytes: 1024 * 1024 * 1024, // 1GB
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days (nanoseconds)
        discard: DiscardPolicy.Old,
      };

      await jsm.streams.add(streamConfig);
      logInfo('HostListener', `✅ Stream ${streamName} created`);
    }
  }

  private async shutdown() {
    logInfo('HostListener', 'Shutting down gracefully...');
    this.isRunning = false;

    // Wait for active agents to finish (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.activeAgents > 0 && (Date.now() - start) < timeout) {
      logInfo('HostListener', `Waiting for ${this.activeAgents} active agents to finish...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeAgents > 0) {
      logWarn('HostListener', `Forcing shutdown with ${this.activeAgents} agents still active`);
    }

    // Close PostgreSQL pool
    await pgPool.end();
    logInfo('HostListener', '✅ PostgreSQL pool closed');

    await this.nc.drain();
    logInfo('HostListener', '✅ Shutdown complete');

    // Close log stream before exit
    logStream.end();
    process.exit(0);
  }
}

// Start the listener
const listener = new HostAgentListener();
listener.start().catch((error) => {
  logError('HostListener', `Fatal error: ${error.message}`);
  logStream.end();
  process.exit(1);
});
