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

import { connect, NatsConnection, JetStreamClient, StringCodec } from 'nats';
import { spawn } from 'child_process';
import * as path from 'path';

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
      this.nc = await connect({ servers: 'nats://localhost:4223' });
      this.js = this.nc.jetstream();

      console.log('[HostListener] ✅ Connected to NATS');
      console.log('[HostListener] Subscribing to orchestration events...');

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

      console.log('[HostListener] 🤖 Listener is running');
      console.log('[HostListener] Waiting for workflow stage events...');
      console.log('[HostListener] Max concurrent agents:', this.maxConcurrent);

      // Subscribe to stage started events (this will block forever in message loop)
      await this.subscribeToStageEvents();

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

    // Consume messages
    const messages = await consumer.consume();

    for await (const msg of messages) {
      if (!this.isRunning) break;

      try {
        const event: StageEvent = JSON.parse(msg.string());

        if (event.eventType === 'stage.started') {
          console.log(`[HostListener] 📨 Received event: ${event.reqNumber} - ${event.stage} (${event.agentId})`);

          // Spawn agent (respect concurrency limit)
          await this.waitForSlot();
          this.spawnAgent(event);
        }

        msg.ack();
      } catch (error: any) {
        console.error('[HostListener] Error processing event:', error.message);
        msg.nak();
      }
    }
  }

  private async waitForSlot() {
    while (this.activeAgents >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async spawnAgent(event: StageEvent) {
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
      const agentProcess = spawn('claude', ['--agent', agentFile, '--model', 'sonnet', '--dangerously-skip-permissions', '--print'], {
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
          } else {
            console.error(`[HostListener] ⚠️  ${agentId} did not return valid completion notice`);
          }
        } else {
          console.error(`[HostListener] ❌ ${agentId} failed with code ${code}`);
          console.error(`[HostListener] stderr:`, stderr);

          // Publish failure event
          await this.publishFailure(agentId, reqNumber, stderr || 'Agent process exited with non-zero code');
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
      miki: 'devops',
    };

    return streamMap[agentId] || agentId;
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
