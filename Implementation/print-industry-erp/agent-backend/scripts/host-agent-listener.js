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
Object.defineProperty(exports, "__esModule", { value: true });
const nats_1 = require("nats");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const sc = (0, nats_1.StringCodec)();
class HostAgentListener {
    constructor() {
        this.maxConcurrent = 4; // Allow 4 agents to run simultaneously (e.g., Dashboard Research + Item Research + Dashboard Backend + Item Critique)
        this.activeAgents = 0;
        this.isRunning = true;
    }
    async start() {
        console.log('[HostListener] Starting host-side NATS agent listener...');
        console.log('[HostListener] Connecting to NATS at localhost:4223');
        try {
            // Connect to NATS (exposed from Docker)
            this.nc = await (0, nats_1.connect)({
                servers: 'nats://localhost:4223',
                user: 'agents',
                pass: 'WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4'
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
  "summary": "Generated N strategic recommendations"
}
\`\`\``;
            // Spawn Claude agent
            const agentProcess = (0, child_process_1.spawn)('claude', ['--agent', agentFile, '--model', 'sonnet', '--dangerously-skip-permissions', '--print'], {
                cwd: path.resolve(__dirname, '..', '..', '..'),
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
                }
                else {
                    console.error(`[HostListener] ❌ strategic-recommendation-generator failed with code ${code}`);
                }
            });
        }
        catch (error) {
            this.activeAgents--;
            console.error(`[HostListener] Failed to spawn strategic-recommendation-generator:`, error.message);
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
    async spawnAgent(event) {
        this.activeAgents++;
        const { reqNumber, agentId, contextData } = event;
        const agentFile = this.getAgentFilePath(agentId);
        console.log(`[HostListener] 🚀 Spawning ${agentId} for ${reqNumber} (${this.activeAgents}/${this.maxConcurrent} active)`);
        try {
            // Build prompt with NATS publishing instructions
            const stream = this.getDeliverableStream(agentId);
            const contextInput = `TASK: ${reqNumber} - ${contextData.featureTitle || 'Feature Request'}

DELIVERABLE INSTRUCTIONS:
1. Complete your work according to your agent definition
2. When COMPLETE, output a JSON completion notice in this EXACT format:

\`\`\`json
{
  "agent": "${agentId}",
  "req_number": "${reqNumber}",
  "status": "COMPLETE",
  "deliverable": "nats://agog.deliverables.${agentId}.${stream}.${reqNumber}",
  "summary": "Brief summary of what you completed"
}
\`\`\`

IMPORTANT: The JSON must be wrapped in a markdown code block with \`\`\`json tags so the listener can parse it.

CONTEXT:
${JSON.stringify(contextData, null, 2)}`;
            // Spawn Claude agent
            const agentProcess = (0, child_process_1.spawn)('claude', ['--agent', agentFile, '--model', 'sonnet', '--dangerously-skip-permissions', '--print'], {
                cwd: path.resolve(__dirname, '..', '..', '..'),
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
                    }
                    else {
                        console.error(`[HostListener] ⚠️  ${agentId} did not return valid completion notice`);
                    }
                }
                else {
                    console.error(`[HostListener] ❌ ${agentId} failed with code ${code}`);
                    console.error(`[HostListener] stderr:`, stderr);
                    // Publish failure event
                    await this.publishFailure(agentId, reqNumber, stderr || 'Agent process exited with non-zero code');
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
        };
        return streamMap[agentId] || agentId;
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
