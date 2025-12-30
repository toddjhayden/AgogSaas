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
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load .env from project root (contains GITHUB_TOKEN, etc.)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '..', '.env') });

// PostgreSQL connection for change management storage
const pgPool = new Pool({
  host: 'localhost',
  port: 5434,
  user: 'agent_user',
  password: 'agent_dev_password_2024',
  database: 'agent_memory',
});

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
  private maxConcurrent = 4; // Allow 4 agents to run simultaneously (e.g., Dashboard Research + Item Research + Dashboard Backend + Item Critique)
  private activeAgents = 0;
  private isRunning = true;

  async start() {
    console.log('[HostListener] Starting host-side NATS agent listener...');
    console.log('[HostListener] Connecting to NATS at localhost:4223');

    try {
      // Connect to NATS (exposed from Docker)
      const natsPassword = process.env.NATS_PASSWORD;
      if (!natsPassword) {
        throw new Error('NATS_PASSWORD environment variable is required');
      }
      this.nc = await connect({
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

      // Keep alive
      await this.keepAlive();

    } catch (error: any) {
      console.error('[HostListener] Failed to start:', error.message);
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

      console.log('[HostListener] ✅ Consumer created/verified');
    } catch (error: any) {
      console.log('[HostListener] Consumer already exists or error:', error.message);
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
            console.log(`[HostListener] 📨 Received stage event: ${event.reqNumber} - ${event.stage} (${event.agentId})`);

            // Spawn agent (respect concurrency limit)
            await this.waitForSlot();
            this.spawnAgent(event);
          }

          msg.ack();
        } catch (error: any) {
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
  private async subscribeToValueChainExpertRequests() {
    const subject = 'agog.agent.requests.value-chain-expert';

    const sub = this.nc.subscribe(subject);
    console.log(`[HostListener] ✅ Subscribed to ${subject}`);

    (async () => {
      for await (const msg of sub) {
        if (!this.isRunning) break;

        try {
          const request = JSON.parse(msg.string());
          console.log(`[HostListener] 📨 Received value-chain-expert request:`, request);

          // Wait for available slot
          await this.waitForSlot();

          // Spawn the strategic-recommendation-generator agent
          await this.spawnValueChainExpertAgent(request);

        } catch (error: any) {
          console.error('[HostListener] Error processing value-chain-expert request:', error.message);
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
      const agentProcess = spawn('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
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
        } else {
          console.error(`[HostListener] ❌ strategic-recommendation-generator failed with code ${code}`);

          // Store failure record
          await this.storeChangeManagement('strategic-recommendation-generator', reqNumber, stdout, null, false);
        }
      });

    } catch (error: any) {
      this.activeAgents--;
      console.error(`[HostListener] Failed to spawn strategic-recommendation-generator:`, error.message);
    }
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
        console.log(`[HostListener] 📚 Found ${result.rows.length} learnings for ${agentId}`);
      }

      return result.rows;
    } catch (error: any) {
      console.error(`[HostListener] Failed to get learnings:`, error.message);
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
        console.log(`[HostListener] 📋 Found ${result.rows.length} previous decisions for ${reqNumber}`);
      }

      return result.rows;
    } catch (error: any) {
      console.error(`[HostListener] Failed to get decisions:`, error.message);
      return [];
    }
  }

  private async spawnAgent(event: StageEvent) {
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
      const agentProcess = spawn('claude', ['--agent', agentFile, '--model', model, '--dangerously-skip-permissions', '--print'], {
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
          } else {
            console.error(`[HostListener] ⚠️  ${agentId} did not return valid completion notice`);
          }

          // Store change management record (full stdout with change details)
          await this.storeChangeManagement(agentId, reqNumber, stdout, completionNotice, true);

          // Extract and store learnings from agent output
          await this.extractLearningsFromOutput(agentId, reqNumber, stdout, completionNotice);
        } else {
          console.error(`[HostListener] ❌ ${agentId} failed with code ${code}`);
          console.error(`[HostListener] stderr:`, stderr);

          // Publish failure event
          await this.publishFailure(agentId, reqNumber, stderr || 'Agent process exited with non-zero code');

          // Store failure record
          await this.storeChangeManagement(agentId, reqNumber, stdout + '\n\nSTDERR:\n' + stderr, null, false);
        }
      });

    } catch (error: any) {
      this.activeAgents--;
      console.error(`[HostListener] Failed to spawn ${agentId}:`, error.message);
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
    };

    return agentFiles[agentId] || `.claude/agents/${agentId}.md`;
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
    } catch (error) {
      console.error('[HostListener] Failed to parse completion notice:', error);
      return null;
    }
  }

  private async publishDeliverable(agentId: string, reqNumber: string, deliverable: any) {
    const streamName = this.getDeliverableStream(agentId);
    const subject = `agog.deliverables.${agentId}.${streamName}.${reqNumber}`;

    try {
      await this.js.publish(subject, sc.encode(JSON.stringify(deliverable)));
      console.log(`[HostListener] 📤 Published deliverable to ${subject}`);
    } catch (error: any) {
      console.error(`[HostListener] Failed to publish deliverable:`, error.message);
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
      await this.js.publish(subject, sc.encode(JSON.stringify(failureEvent)));
      console.log(`[HostListener] 📤 Published failure event for ${agentId}`);
    } catch (error: any) {
      console.error(`[HostListener] Failed to publish failure:`, error.message);
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

      await pgPool.query(
        `INSERT INTO memories (agent_id, memory_type, content, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [agentId, memoryType, content, metadata]
      );

      console.log(`[HostListener] 💾 Stored change management record for ${agentId}/${reqNumber}`);

      // Log key changes for visibility
      if (changes.key_changes?.length > 0) {
        console.log(`[HostListener] 📝 Key changes: ${changes.key_changes.join(', ')}`);
      }
    } catch (error: any) {
      console.error(`[HostListener] ⚠️ Failed to store change management:`, error.message);
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

      console.log(`[HostListener] 💾 Cached deliverable: ${reqNumber} from ${agentId}`);
    } catch (error: any) {
      console.error(`[HostListener] Failed to cache deliverable:`, error.message);
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
        console.log(`[HostListener] 📚 Extracted ${learnings.length} learnings from ${agentId}/${reqNumber}`);
      }
    } catch (error: any) {
      console.error(`[HostListener] Failed to extract learnings:`, error.message);
    }
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
      console.log(`[HostListener] Stream ${streamName} already exists`);
    } catch (error) {
      console.log(`[HostListener] Creating stream: ${streamName}`);

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
      console.log(`[HostListener] ✅ Stream ${streamName} created`);
    }
  }

  private async shutdown() {
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
