#!/usr/bin/env ts-node
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nats_1 = require("nats");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
// Load .env from project root (contains GITHUB_TOKEN, etc.)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '..', '.env') });
// PostgreSQL connection for change management storage
const pgPool = new pg_1.Pool({
    host: 'localhost',
    port: 5434,
    user: 'agent_user',
    password: 'agent_dev_password_2024',
    database: 'agent_memory',
});
// Ollama URL for embeddings (host machine port mapping)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
/**
 * Generate embedding for semantic search using Ollama
 * Uses nomic-embed-text model (768 dimensions)
 */
async function generateEmbedding(text) {
    try {
        // nomic-embed-text has 2048 token limit (~1500 chars safely)
        const truncatedText = text.substring(0, 1500);
        const response = await axios_1.default.post(`${OLLAMA_URL}/api/embeddings`, {
            model: 'nomic-embed-text',
            prompt: truncatedText,
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        return response.data.embedding;
    }
    catch (error) {
        console.warn(`[HostListener] Failed to generate embedding: ${error.message}`);
        // Return zero vector as fallback (will still be searchable via metadata)
        return Array(768).fill(0);
    }
}
const sc = (0, nats_1.StringCodec)();
class HostAgentListener {
    constructor() {
        this.maxConcurrent = 6; // Allow 6 agents to run simultaneously (increased from 4 for better throughput)
        this.activeAgents = 0;
        this.isRunning = true;
    }
    async start() {
        console.log('[HostListener] Starting host-side NATS agent listener...');
        console.log('[HostListener] Connecting to NATS at localhost:4223');
        try {
            // Connect to NATS (exposed from Docker)
            const natsPassword = process.env.NATS_PASSWORD;
            if (!natsPassword) {
                throw new Error('NATS_PASSWORD environment variable is required');
            }
            this.nc = await (0, nats_1.connect)({
                servers: process.env.NATS_URL || 'nats://localhost:4223',
                user: process.env.NATS_USER || 'agents',
                pass: natsPassword
            });
            this.js = this.nc.jetstream();
            console.log('[HostListener] ✅ Connected to NATS');
            // Ensure deliverables stream exists (belt and suspenders - orchestrator also creates it)
            await this.ensureDeliverablesStream();
            console.log('[HostListener] Subscribing to orchestration events...');
            // Graceful shutdown
            process.on('SIGINT', () => this.shutdown());
            process.on('SIGTERM', () => this.shutdown());
            console.log('[HostListener] 🤖 Listener is running');
            console.log('[HostListener] Waiting for workflow stage events...');
            console.log('[HostListener] Max concurrent agents:', this.maxConcurrent);
            // Subscribe to stage started events
            this.subscribeToStageEvents();
            // Subscribe to value-chain-expert requests (from Docker daemon)
            this.subscribeToValueChainExpertRequests();
            // Subscribe to Sam audit requests (from Docker daemon)
            this.subscribeToSamAuditRequests();
            // Keep alive
            await this.keepAlive();
        }
        catch (error) {
            console.error('[HostListener] Failed to start:', error.message);
            process.exit(1);
        }
    }
    async subscribeToStageEvents() {
        const jsm = await this.nc.jetstreamManager();
        // Ensure consumer exists
        try {
            const consumer = await jsm.consumers.add('agog_orchestration_events', {
                durable_name: 'host_agent_listener_v4',
                ack_policy: 'explicit',
                filter_subject: 'agog.orchestration.events.stage.started',
                deliver_policy: 'all', // Deliver all messages from the stream
            });
            console.log('[HostListener] ✅ Consumer created/verified');
        }
        catch (error) {
            console.log('[HostListener] Consumer already exists or error:', error.message);
        }
        // Get consumer
        const consumer = await this.js.consumers.get('agog_orchestration_events', 'host_agent_listener_v4');
        // Consume messages (async - runs in background)
        (async () => {
            const messages = await consumer.consume();
            for await (const msg of messages) {
                if (!this.isRunning)
                    break;
                try {
                    const event = JSON.parse(msg.string());
                    if (event.eventType === 'stage.started') {
                        console.log(`[HostListener] 📨 Received stage event: ${event.reqNumber} - ${event.stage} (${event.agentId})`);
                        // Spawn agent (respect concurrency limit)
                        await this.waitForSlot();
                        this.spawnAgent(event);
                    }
                    msg.ack();
                }
                catch (error) {
                    console.error('[HostListener] Error processing stage event:', error.message);
                    msg.nak();
                }
            }
        })();
        console.log('[HostListener] ✅ Subscribed to orchestration stage events');
    }
    /**
     * Subscribe to value-chain-expert requests from Docker daemon
     * These are requests to spawn the strategic recommendation generator
     */
    async subscribeToValueChainExpertRequests() {
        const subject = 'agog.agent.requests.value-chain-expert';
        const sub = this.nc.subscribe(subject);
        console.log(`[HostListener] ✅ Subscribed to ${subject}`);
        (async () => {
            for await (const msg of sub) {
                if (!this.isRunning)
                    break;
                try {
                    const request = JSON.parse(msg.string());
                    console.log(`[HostListener] 📨 Received value-chain-expert request:`, request);
                    // Wait for available slot
                    await this.waitForSlot();
                    // Spawn the strategic-recommendation-generator agent
                    await this.spawnValueChainExpertAgent(request);
                }
                catch (error) {
                    console.error('[HostListener] Error processing value-chain-expert request:', error.message);
                }
            }
        })();
    }
    /**
     * Spawn the strategic-recommendation-generator agent
     */
    async spawnValueChainExpertAgent(request) {
        this.activeAgents++;
        const agentFile = '.claude/agents/strategic-recommendation-generator.md';
        const reqNumber = `REQ-STRATEGIC-AUTO-${Date.now()}`;
        console.log(`[HostListener] 🚀 Spawning strategic-recommendation-generator (${this.activeAgents}/${this.maxConcurrent} active)`);
        try {
            const contextInput = `TASK: Strategic Value Chain Evaluation

You are the Value Chain Expert daemon. Analyze the current state of the AGOGSAAS system and generate strategic feature recommendations.

REQUEST INFO:
- Requested At: ${request.requestedAt}
- Requested By: ${request.requestedBy}

INSTRUCTIONS:
1. Review OWNER_REQUESTS.md to understand current priorities
2. Analyze the codebase for improvement opportunities
3. Generate RICE-scored recommendations
4. Add new recommendations to OWNER_REQUESTS.md with status PENDING
5. Commit your changes

When complete, output:
\`\`\`json
{
  "agent": "strategic-recommendation-generator",
  "req_number": "${reqNumber}",
  "status": "COMPLETE",
  "summary": "Generated N strategic recommendations",
  "changes": {
    "files_created": [],
    "files_modified": ["project-spirit/owner_requests/OWNER_REQUESTS.md"],
    "files_deleted": [],
    "tables_created": [],
    "tables_modified": [],
    "migrations_added": [],
    "key_changes": [
      "Added N new strategic recommendations to OWNER_REQUESTS.md"
    ]
  }
}
\`\`\`

IMPORTANT: The "changes" object is REQUIRED - explicitly list what you created or modified.`;
            // Spawn Claude agent - cwd must be project root (4 levels up from scripts/)
            // scripts/ -> agent-backend/ -> print-industry-erp/ -> Implementation/ -> agogsaas/
            const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
            const model = this.getModelForAgent('strategic-recommendation-generator');
            console.log(`[HostListener] Using model: ${model} for strategic-recommendation-generator`);
            const agentProcess = (0, child_process_1.spawn)('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
                cwd: projectRoot,
                shell: true,
            });
            let stdout = '';
            // Pass context via stdin
            agentProcess.stdin.write(contextInput);
            agentProcess.stdin.end();
            // Capture output
            agentProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                console.log(`[value-chain-expert] ${chunk.trim()}`);
            });
            agentProcess.stderr.on('data', (data) => {
                console.error(`[value-chain-expert ERROR] ${data.toString().trim()}`);
            });
            // Handle completion
            agentProcess.on('close', async (code) => {
                this.activeAgents--;
                if (code === 0) {
                    console.log(`[HostListener] ✅ strategic-recommendation-generator completed`);
                    // Parse completion notice
                    const completionNotice = this.parseCompletionNotice(stdout);
                    if (completionNotice) {
                        // Publish completion to NATS so Docker daemon knows it completed
                        await this.nc.publish('agog.agent.responses.value-chain-expert', sc.encode(JSON.stringify(completionNotice)));
                        console.log(`[HostListener] 📤 Published completion to agog.agent.responses.value-chain-expert`);
                    }
                    // Store change management record
                    await this.storeChangeManagement('strategic-recommendation-generator', reqNumber, stdout, completionNotice, true);
                }
                else {
                    console.error(`[HostListener] ❌ strategic-recommendation-generator failed with code ${code}`);
                    // Store failure record
                    await this.storeChangeManagement('strategic-recommendation-generator', reqNumber, stdout, null, false);
                }
            });
        }
        catch (error) {
            this.activeAgents--;
            console.error(`[HostListener] Failed to spawn strategic-recommendation-generator:`, error.message);
        }
    }
    /**
     * Subscribe to Sam audit requests from Docker daemon
     * These are requests to run comprehensive system audits
     */
    async subscribeToSamAuditRequests() {
        const subject = 'agog.agent.requests.sam-audit';
        const sub = this.nc.subscribe(subject);
        console.log(`[HostListener] ✅ Subscribed to ${subject}`);
        (async () => {
            for await (const msg of sub) {
                if (!this.isRunning)
                    break;
                try {
                    const request = JSON.parse(msg.string());
                    console.log(`[HostListener] 📨 Received sam-audit request:`, request);
                    // Wait for available slot
                    await this.waitForSlot();
                    // Spawn Sam audit agent
                    await this.spawnSamAuditAgent(request);
                }
                catch (error) {
                    console.error('[HostListener] Error processing sam-audit request:', error.message);
                }
            }
        })();
    }
    /**
     * Spawn Sam (Senior Auditor) agent for comprehensive system audits
     */
    async spawnSamAuditAgent(request) {
        this.activeAgents++;
        const agentFile = '.claude/agents/sam-senior-auditor.md';
        const reqNumber = request.reqNumber || `REQ-AUDIT-${Date.now()}`;
        const auditType = request.auditType || 'manual';
        console.log(`[HostListener] 🚀 Spawning sam-senior-auditor (${auditType}) (${this.activeAgents}/${this.maxConcurrent} active)`);
        try {
            const contextInput = `TASK: ${auditType.toUpperCase()} System Audit

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
            const model = 'sonnet'; // Sam needs complex reasoning for audits
            console.log(`[HostListener] Using model: ${model} for sam`);
            const agentProcess = (0, child_process_1.spawn)('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
                cwd: projectRoot,
                shell: true,
            });
            let stdout = '';
            // Pass context via stdin
            agentProcess.stdin.write(contextInput);
            agentProcess.stdin.end();
            // Capture output
            agentProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                console.log(`[sam] ${chunk.trim()}`);
            });
            agentProcess.stderr.on('data', (data) => {
                console.error(`[sam ERROR] ${data.toString().trim()}`);
            });
            // Handle completion
            agentProcess.on('close', async (code) => {
                this.activeAgents--;
                if (code === 0) {
                    console.log(`[HostListener] ✅ sam-senior-auditor completed (${auditType})`);
                    // Parse completion notice
                    const completionNotice = this.parseCompletionNotice(stdout);
                    if (completionNotice) {
                        // Publish completion to NATS so Docker daemon knows it completed
                        await this.nc.publish('agog.agent.responses.sam-audit', sc.encode(JSON.stringify(completionNotice)));
                        console.log(`[HostListener] 📤 Published completion to agog.agent.responses.sam-audit`);
                    }
                    // Store change management record
                    await this.storeChangeManagement('sam', reqNumber, stdout, completionNotice, true);
                }
                else {
                    console.error(`[HostListener] ❌ sam-senior-auditor failed with code ${code}`);
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
        }
        catch (error) {
            this.activeAgents--;
            console.error(`[HostListener] Failed to spawn sam-senior-auditor:`, error.message);
        }
    }
    /**
     * Keep the process alive
     */
    async keepAlive() {
        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    async waitForSlot() {
        while (this.activeAgents >= this.maxConcurrent) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    /**
     * Get relevant learnings for an agent before they start work
     */
    async getLearningsForAgent(agentId) {
        try {
            const result = await pgPool.query(`SELECT learning_type, title, description, confidence_score
         FROM agent_learnings
         WHERE agent_id = $1 AND confidence_score >= 0.5
         ORDER BY confidence_score DESC, times_applied DESC
         LIMIT 5`, [agentId]);
            if (result.rows.length > 0) {
                console.log(`[HostListener] 📚 Found ${result.rows.length} learnings for ${agentId}`);
            }
            return result.rows;
        }
        catch (error) {
            console.error(`[HostListener] Failed to get learnings:`, error.message);
            return [];
        }
    }
    /**
     * Get previous decisions for a request (useful for retries)
     */
    async getPreviousDecisions(reqNumber) {
        try {
            const result = await pgPool.query(`SELECT agent, decision, reasoning, created_at
         FROM strategic_decisions
         WHERE req_number = $1
         ORDER BY created_at DESC
         LIMIT 3`, [reqNumber]);
            if (result.rows.length > 0) {
                console.log(`[HostListener] 📋 Found ${result.rows.length} previous decisions for ${reqNumber}`);
            }
            return result.rows;
        }
        catch (error) {
            console.error(`[HostListener] Failed to get decisions:`, error.message);
            return [];
        }
    }
    async spawnAgent(event) {
        this.activeAgents++;
        const { reqNumber, agentId, contextData } = event;
        const agentFile = this.getAgentFilePath(agentId);
        console.log(`[HostListener] 🚀 Spawning ${agentId} for ${reqNumber} (${this.activeAgents}/${this.maxConcurrent} active)`);
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
            console.log(`[HostListener] Using model: ${model} for ${agentId}`);
            const agentProcess = (0, child_process_1.spawn)('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
                cwd: projectRoot,
                shell: true,
            });
            let stdout = '';
            let stderr = '';
            // Pass context via stdin
            agentProcess.stdin.write(contextInput);
            agentProcess.stdin.end();
            // Capture output
            agentProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                console.log(`[${agentId}] ${chunk.trim()}`);
            });
            agentProcess.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                console.error(`[${agentId} ERROR] ${chunk.trim()}`);
            });
            // Handle completion
            agentProcess.on('close', async (code) => {
                this.activeAgents--;
                if (code === 0) {
                    console.log(`[HostListener] ✅ ${agentId} completed for ${reqNumber}`);
                    // Parse agent output for completion notice
                    const completionNotice = this.parseCompletionNotice(stdout);
                    if (completionNotice) {
                        // Publish to NATS deliverable stream
                        await this.publishDeliverable(agentId, reqNumber, completionNotice);
                        // Cache deliverable in PostgreSQL for quick lookup
                        await this.cacheDeliverable(agentId, reqNumber, completionNotice);
                    }
                    else {
                        console.error(`[HostListener] ⚠️  ${agentId} did not return valid completion notice`);
                    }
                    // Store change management record (full stdout with change details)
                    await this.storeChangeManagement(agentId, reqNumber, stdout, completionNotice, true);
                    // Extract and store learnings from agent output
                    await this.extractLearningsFromOutput(agentId, reqNumber, stdout, completionNotice);
                }
                else {
                    console.error(`[HostListener] ❌ ${agentId} failed with code ${code}`);
                    console.error(`[HostListener] stderr:`, stderr);
                    // Publish failure event
                    await this.publishFailure(agentId, reqNumber, stderr || 'Agent process exited with non-zero code');
                    // Store failure record
                    await this.storeChangeManagement(agentId, reqNumber, stdout + '\n\nSTDERR:\n' + stderr, null, false);
                }
            });
        }
        catch (error) {
            this.activeAgents--;
            console.error(`[HostListener] Failed to spawn ${agentId}:`, error.message);
            await this.publishFailure(agentId, reqNumber, error.message);
        }
    }
    getAgentFilePath(agentId) {
        // Map agent IDs to file names
        const agentFiles = {
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
        };
        return agentFiles[agentId] || `.claude/agents/${agentId}.md`;
    }
    parseCompletionNotice(stdout) {
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
        }
        catch (error) {
            console.error('[HostListener] Failed to parse completion notice:', error);
            return null;
        }
    }
    async publishDeliverable(agentId, reqNumber, deliverable) {
        const streamName = this.getDeliverableStream(agentId);
        const subject = `agog.deliverables.${agentId}.${streamName}.${reqNumber}`;
        try {
            await this.js.publish(subject, sc.encode(JSON.stringify(deliverable)));
            console.log(`[HostListener] 📤 Published deliverable to ${subject}`);
        }
        catch (error) {
            console.error(`[HostListener] Failed to publish deliverable:`, error.message);
        }
    }
    async publishFailure(agentId, reqNumber, errorMessage) {
        const subject = `agog.orchestration.events.stage.failed`;
        const failureEvent = {
            eventType: 'stage.failed',
            reqNumber,
            agentId,
            error: errorMessage,
            timestamp: new Date().toISOString(),
        };
        try {
            await this.js.publish(subject, sc.encode(JSON.stringify(failureEvent)));
            console.log(`[HostListener] 📤 Published failure event for ${agentId}`);
        }
        catch (error) {
            console.error(`[HostListener] Failed to publish failure:`, error.message);
        }
    }
    getDeliverableStream(agentId) {
        const streamMap = {
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
    getModelForAgent(agentId) {
        const haikuAgents = new Set([
            'tim', // Documentation - straightforward doc updates
            'priya', // Statistics - data aggregation and reporting
            'berry', // DevOps - scripted deployment tasks
            'miki', // DevOps - scripted deployment tasks
            'strategic-recommendation-generator', // Proactive daemon - templated recommendations
        ]);
        return haikuAgents.has(agentId) ? 'haiku' : 'sonnet';
    }
    /**
     * Store change management record to persistent memory database
     * Uses agent-provided changes (agents know what they changed)
     */
    async storeChangeManagement(agentId, reqNumber, stdout, completionNotice, success) {
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
            await pgPool.query(`INSERT INTO memories (agent_id, memory_type, content, embedding, metadata)
         VALUES ($1, $2, $3, $4::vector, $5::jsonb)`, [agentId, memoryType, content, JSON.stringify(embedding), metadata]);
            console.log(`[HostListener] 💾 Stored change management record for ${agentId}/${reqNumber} (with embedding)`);
            // Log key changes for visibility
            if (changes.key_changes?.length > 0) {
                console.log(`[HostListener] 📝 Key changes: ${changes.key_changes.join(', ')}`);
            }
        }
        catch (error) {
            console.error(`[HostListener] ⚠️ Failed to store change management:`, error.message);
            // Don't fail the workflow if storage fails - log and continue
        }
    }
    /**
     * Cache deliverable in PostgreSQL for quick lookup
     */
    async cacheDeliverable(agentId, reqNumber, deliverable) {
        try {
            const stageMap = {
                cynthia: 0, sylvia: 1, roy: 2, jen: 3, billy: 4, liz: 5, todd: 6, vic: 7, priya: 8, berry: 9, miki: 9, tim: 10
            };
            const stage = stageMap[agentId] ?? 0;
            await pgPool.query(`INSERT INTO nats_deliverable_cache (req_number, agent, stage, deliverable)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (req_number, agent, stage)
         DO UPDATE SET deliverable = $4, created_at = NOW()`, [reqNumber, agentId, stage, JSON.stringify(deliverable)]);
            console.log(`[HostListener] 💾 Cached deliverable: ${reqNumber} from ${agentId}`);
        }
        catch (error) {
            console.error(`[HostListener] Failed to cache deliverable:`, error.message);
        }
    }
    /**
     * Extract learnings from agent output (patterns, gotchas, best practices)
     */
    async extractLearningsFromOutput(agentId, reqNumber, stdout, completionNotice) {
        try {
            const learnings = [];
            // Extract patterns from key_changes
            if (completionNotice?.changes?.key_changes) {
                for (const change of completionNotice.changes.key_changes.slice(0, 3)) {
                    if (change.toLowerCase().includes('fix') || change.toLowerCase().includes('bug')) {
                        learnings.push({
                            type: 'gotcha',
                            title: `Bug Fix Pattern: ${change.substring(0, 50)}`,
                            description: change
                        });
                    }
                    else if (change.toLowerCase().includes('optimize') || change.toLowerCase().includes('performance')) {
                        learnings.push({
                            type: 'optimization',
                            title: `Optimization: ${change.substring(0, 50)}`,
                            description: change
                        });
                    }
                    else if (change.toLowerCase().includes('add') || change.toLowerCase().includes('implement')) {
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
                { regex: /LESSON[:\s]+([^\n]+)/gi, type: 'best_practice' },
                { regex: /WARNING[:\s]+([^\n]+)/gi, type: 'gotcha' },
                { regex: /TIP[:\s]+([^\n]+)/gi, type: 'best_practice' },
                { regex: /NOTE[:\s]+([^\n]+)/gi, type: 'pattern' },
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
                await pgPool.query(`INSERT INTO agent_learnings
            (agent_id, learning_type, title, description, example_context, confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6)`, [agentId, learning.type, learning.title, learning.description, `From ${reqNumber}`, 0.6]);
            }
            if (learnings.length > 0) {
                console.log(`[HostListener] 📚 Extracted ${learnings.length} learnings from ${agentId}/${reqNumber}`);
            }
        }
        catch (error) {
            console.error(`[HostListener] Failed to extract learnings:`, error.message);
        }
    }
    /**
     * Format agent-provided changes for human-readable output
     */
    formatAgentChanges(changes) {
        if (!changes || Object.keys(changes).length === 0) {
            return 'No changes reported by agent';
        }
        const sections = [];
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
    async ensureDeliverablesStream() {
        const jsm = await this.nc.jetstreamManager();
        // Create stream for DevOps agents (berry and miki) - other agents already have streams
        const streamName = 'agog_features_devops';
        try {
            await jsm.streams.info(streamName);
            console.log(`[HostListener] Stream ${streamName} already exists`);
        }
        catch (error) {
            console.log(`[HostListener] Creating stream: ${streamName}`);
            const streamConfig = {
                name: streamName,
                subjects: ['agog.deliverables.berry.>', 'agog.deliverables.miki.>'],
                storage: nats_1.StorageType.File,
                retention: nats_1.RetentionPolicy.Limits,
                max_msgs: 10000,
                max_bytes: 1024 * 1024 * 1024, // 1GB
                max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days (nanoseconds)
                discard: nats_1.DiscardPolicy.Old,
            };
            await jsm.streams.add(streamConfig);
            console.log(`[HostListener] ✅ Stream ${streamName} created`);
        }
    }
    async shutdown() {
        console.log('\n[HostListener] Shutting down gracefully...');
        this.isRunning = false;
        // Wait for active agents to finish (with timeout)
        const timeout = 30000; // 30 seconds
        const start = Date.now();
        while (this.activeAgents > 0 && (Date.now() - start) < timeout) {
            console.log(`[HostListener] Waiting for ${this.activeAgents} active agents to finish...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (this.activeAgents > 0) {
            console.log(`[HostListener] ⚠️  Forcing shutdown with ${this.activeAgents} agents still active`);
        }
        // Close PostgreSQL pool
        await pgPool.end();
        console.log('[HostListener] ✅ PostgreSQL pool closed');
        await this.nc.drain();
        console.log('[HostListener] ✅ Shutdown complete');
        process.exit(0);
    }
}
// Start the listener
const listener = new HostAgentListener();
listener.start().catch((error) => {
    console.error('[HostListener] Fatal error:', error);
    process.exit(1);
});
