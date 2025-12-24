/**
 * Value Chain Expert Daemon
 * Runs strategic evaluation every 5 hours (aligned with Claude API reset)
 * Generates RICE-scored feature recommendations
 * NOTE: Orchestrator handles Claude usage limits - Value Chain Expert just generates work
 */

import { connect, NatsConnection } from 'nats';
import { execSync } from 'child_process';

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
   */
  private async spawnAgent(): Promise<StrategicRecommendation[]> {
    // TODO: Implement actual Claude CLI spawn
    // For now, generating mock recommendations

    const mockRecommendations: StrategicRecommendation[] = [
      {
        reqNumber: `REQ-STRATEGIC-AUTO-${Date.now()}`,
        title: 'Optimize Bin Utilization Algorithm',
        owner: 'marcus',
        priority: 'P2',
        businessValue: 'Improve warehouse space utilization by 15% through predictive bin assignment. Reduces need for additional warehouse space expansion ($500K savings).',
        requirements: [
          'Analyze historical bin usage patterns',
          'Implement ML-based bin assignment algorithm',
          'Add real-time utilization dashboard',
          'Create bin consolidation recommendations'
        ],
        riceScore: {
          reach: 8,      // Affects all warehouse operations
          impact: 7,     // Significant cost savings
          confidence: 9, // High confidence in approach
          effort: 5,     // Medium effort
          total: (8 * 7 * 9) / 5 // = 100.8
        },
        generatedBy: 'value-chain-expert',
        generatedAt: new Date().toISOString()
      }
    ];

    return mockRecommendations;
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
