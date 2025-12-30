/**
 * Value Chain Expert Daemon
 * Runs strategic evaluation every 5 hours (aligned with Claude API reset)
 * Generates RICE-scored feature recommendations
 * NOTE: Orchestrator handles Claude usage limits - Value Chain Expert just generates work
 *
 * DOCKER MODE: When running in Docker, cannot spawn Claude CLI agents.
 * Uses NATS-based strategic-recommendation-generator agent file instead.
 */

import { connect, NatsConnection } from 'nats';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { isRunningInDocker, canSpawnClaudeAgents } from '../utils/environment';

export interface StrategicRecommendation {
  reqNumber: string;
  title: string;
  owner: 'marcus' | 'sarah' | 'alex';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  businessValue: string;
  requirements: string[];
  riceScore: {
    reach: number;      // 1-10
    impact: number;     // 1-10
    confidence: number; // 1-10
    effort: number;     // 1-10
    total: number;      // (R * I * C) / E
  };
  generatedBy: string;
  generatedAt: string;
}

export class ValueChainExpertDaemon {
  private nc!: NatsConnection;
  private isRunning = false;
  private evaluationCount = 0;

  async initialize(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'value-chain-expert-daemon'
    });

    console.log('[ValueChainExpert] Daemon initialized');
  }

  /**
   * Start daemon (evaluation 5 minutes after startup, then every 5 hours)
   */
  async startDaemon(): Promise<void> {
    if (this.isRunning) {
      console.log('[ValueChainExpert] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[ValueChainExpert] Starting daemon (runs 5 minutes after Recovery, then every 5 hours)...');

    // Wait 5 minutes after Recovery finishes
    const delayMs = 5 * 60 * 1000; // 5 minutes
    console.log('[ValueChainExpert] First evaluation in 5 minutes (after Recovery completes)...');

    setTimeout(async () => {
      if (this.isRunning) {
        await this.runEvaluation();

        // After first run, schedule every 5 hours
        setInterval(async () => {
          if (this.isRunning) {
            await this.runEvaluation();
          }
        }, 5 * 60 * 60 * 1000); // 5 hours

        console.log('[ValueChainExpert] ✅ Now running every 5 hours');
      }
    }, delayMs);
  }

  /**
   * Run strategic evaluation
   * NOTE: Strategic Orchestrator handles Claude usage limits
   * Value Chain Expert just generates recommendations for Product Owners to review
   */
  private async runEvaluation(): Promise<void> {
    console.log('[ValueChainExpert] 🔍 Running strategic evaluation...');

    try {
      // Spawn value-chain-expert agent via Claude CLI
      const recommendations = await this.spawnAgent();

      // Publish recommendations to NATS
      for (const rec of recommendations) {
        await this.publishRecommendation(rec);
      }

      this.evaluationCount++;
      console.log(`[ValueChainExpert] ✅ Evaluation complete - generated ${recommendations.length} recommendations`);

    } catch (error: any) {
      console.error('[ValueChainExpert] Evaluation failed:', error.message);
    }
  }

  /**
   * Spawn value-chain-expert agent
   * ACTUALLY SPAWNS THE CLAUDE CODE AGENT (when not in Docker)
   *
   * DOCKER MODE: Cannot spawn Claude CLI from inside container.
   * Instead, publishes a request to NATS for host-based agent to process.
   */
  private async spawnAgent(): Promise<StrategicRecommendation[]> {
    const inDocker = isRunningInDocker();

    if (inDocker) {
      console.log('[ValueChainExpert] Running in Docker - using NATS-based work generation');
      return await this.generateRecommendationsInDocker();
    }

    // HOST MODE: Spawn actual Claude Code agent
    console.log('[ValueChainExpert] Running on host - spawning REAL Claude Code agent...');

    if (!canSpawnClaudeAgents()) {
      console.warn('[ValueChainExpert] Claude CLI not available - falling back to NATS mode');
      return await this.generateRecommendationsInDocker();
    }

    try {
      // Path to spawn script (DAEMON VERSION - no interactive prompts)
      const spawnScriptPath = 'D:/GitHub/agogsaas/scripts/spawn-value-chain-expert-daemon.bat';

      // Execute the spawn script synchronously (waits for agent to complete)
      console.log('[ValueChainExpert] Executing spawn script:', spawnScriptPath);
      execSync(spawnScriptPath, {
        stdio: 'inherit', // Show output directly (prevents hanging with stdin writes)
        cwd: 'D:/GitHub/agogsaas',
        env: {
          ...process.env,
          SKIP_PERMISSIONS: 'true'
        }
      });

      // After agent completes, recommendations are in OWNER_REQUESTS.md
      // Parse the newly added recommendations (marked with generatedBy: value-chain-expert)
      console.log('[ValueChainExpert] Agent completed - parsing recommendations from OWNER_REQUESTS.md');

      const recommendations = this.parseGeneratedRecommendations();
      console.log(`[ValueChainExpert] Parsed ${recommendations.length} recommendations from agent output`);

      return recommendations;

    } catch (error: any) {
      console.error('[ValueChainExpert] Failed to spawn agent:', error.message);
      console.error('[ValueChainExpert] Falling back to NATS-based generation');
      return await this.generateRecommendationsInDocker();
    }
  }

  /**
   * Generate recommendations when running in Docker (no Claude CLI available)
   * Publishes a trigger to NATS for host-side agent listener to pick up
   */
  private async generateRecommendationsInDocker(): Promise<StrategicRecommendation[]> {
    console.log('[ValueChainExpert] Docker mode - publishing strategic evaluation request to NATS');

    try {
      // Publish a request to NATS for host agent to process
      // The host-agent-listener (running on Windows) will pick this up
      const evalRequest = {
        type: 'strategic-evaluation',
        requestedAt: new Date().toISOString(),
        requestedBy: 'value-chain-expert-daemon'
      };

      await this.nc.publish('agog.agent.requests.value-chain-expert', JSON.stringify(evalRequest));
      console.log('[ValueChainExpert] Published evaluation request to agog.agent.requests.value-chain-expert');

      // In Docker mode, we don't wait for immediate results
      // The host agent will process and publish recommendations to agog.recommendations.strategic
      // The RecommendationPublisher will pick those up and add to OWNER_REQUESTS.md
      console.log('[ValueChainExpert] Request queued - host agent will process when available');

      return [];

    } catch (error: any) {
      console.error('[ValueChainExpert] Failed to publish NATS request:', error.message);
      return [];
    }
  }

  /**
   * Parse recommendations that were added to OWNER_REQUESTS.md by the agent
   */
  private parseGeneratedRecommendations(): StrategicRecommendation[] {
    const ownerRequestsPath = process.env.OWNER_REQUESTS_PATH || '/app/project-spirit/owner_requests/OWNER_REQUESTS.md';

    // Read OWNER_REQUESTS.md
    const fs = require('fs');
    const content = fs.readFileSync(ownerRequestsPath, 'utf-8');

    // Find requests generated by value-chain-expert in the last 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recommendations: StrategicRecommendation[] = [];

    // Parse markdown sections starting with ### REQ-STRATEGIC-AUTO-
    const reqPattern = /### (REQ-STRATEGIC-AUTO-\d+):/g;
    const matches = [...content.matchAll(reqPattern)];

    for (const match of matches) {
      const reqNumber = match[1];
      const timestamp = parseInt(reqNumber.split('-').pop() || '0');

      if (timestamp >= tenMinutesAgo) {
        // Extract the full request section
        const startIdx = match.index || 0;
        const endIdx = content.indexOf('\n###', startIdx + 1);
        const section = content.substring(startIdx, endIdx > 0 ? endIdx : undefined);

        // Parse basic fields
        const titleMatch = section.match(/### REQ-STRATEGIC-AUTO-\d+:\s*(.+)/);
        const ownerMatch = section.match(/\*\*Owner\*\*:\s*(\w+)/i);
        const priorityMatch = section.match(/\*\*Priority\*\*:\s*(P\d)/i);
        const businessValueMatch = section.match(/\*\*Business Value\*\*:\s*(.+)/i);

        if (titleMatch && ownerMatch && priorityMatch) {
          recommendations.push({
            reqNumber,
            title: titleMatch[1].trim(),
            owner: ownerMatch[1].toLowerCase() as any,
            priority: priorityMatch[1] as any,
            businessValue: businessValueMatch ? businessValueMatch[1].trim() : '',
            requirements: this.parseRequirements(section),
            riceScore: this.parseRICEScore(section),
            generatedBy: 'value-chain-expert',
            generatedAt: new Date(timestamp).toISOString()
          });
        }
      }
    }

    return recommendations;
  }

  private parseRequirements(section: string): string[] {
    const reqsMatch = section.match(/\*\*Requirements\*\*:\s*\n((?:[-*]\s*.+\n?)+)/);
    if (!reqsMatch) return [];

    return reqsMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  private parseRICEScore(section: string): any {
    // Try to parse RICE score if present, otherwise return default
    const riceMatch = section.match(/RICE:\s*(\d+\.?\d*)/i);
    const score = riceMatch ? parseFloat(riceMatch[1]) : 50;

    return {
      reach: 5,
      impact: 5,
      confidence: 5,
      effort: 5,
      total: score
    };
  }

  /**
   * Publish recommendation to NATS
   */
  private async publishRecommendation(rec: StrategicRecommendation): Promise<void> {
    await this.nc.publish('agog.recommendations.strategic', JSON.stringify(rec));
    console.log(`[ValueChainExpert] 📨 Published recommendation: ${rec.reqNumber} (RICE: ${rec.riceScore.total.toFixed(1)})`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('[ValueChainExpert] Daemon stopped');
  }

  async close(): Promise<void> {
    await this.stop();
    await this.nc.close();
  }

  /**
   * Get daemon statistics
   */
  getStats(): {
    isRunning: boolean;
    evaluationCount: number;
  } {
    return {
      isRunning: this.isRunning,
      evaluationCount: this.evaluationCount
    };
  }
}
