import { Pool } from 'pg';
import { connect, NatsConnection, JetStreamClient } from 'nats';

export interface AgentActivity {
  agentId: string;
  agentName: string;
  status: 'IDLE' | 'RUNNING' | 'BLOCKED' | 'COMPLETED' | 'FAILED';
  reqNumber?: string;
  featureTitle?: string;
  currentTask?: string;
  progress: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
  deliverablePath?: string;
  error?: string;
  metadata?: any;
}

export class AgentActivityService {
  private pool: Pool;
  private nc?: NatsConnection;
  private js?: JetStreamClient;
  private activities: Map<string, AgentActivity> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
    this.initializeNATS();
    this.initializeAgents();
  }

  private async initializeNATS() {
    try {
      this.nc = await connect({
        servers: process.env.NATS_URL || 'nats://localhost:4222',
      });
      this.js = this.nc.jetstream();
      console.log('[AgentActivity] Connected to NATS');

      // Subscribe to agent activity updates
      this.subscribeToAgentUpdates();
    } catch (error) {
      console.error('[AgentActivity] Failed to connect to NATS:', error);
    }
  }

  private initializeAgents() {
    // Initialize all known agents with IDLE status
    const agents = [
      { id: 'cynthia', name: 'Cynthia (Research)' },
      { id: 'sylvia', name: 'Sylvia (Critique)' },
      { id: 'roy', name: 'Roy (Backend)' },
      { id: 'jen', name: 'Jen (Frontend)' },
      { id: 'billy', name: 'Billy (QA)' },
      { id: 'priya', name: 'Priya (Statistics)' },
    ];

    agents.forEach((agent) => {
      this.activities.set(agent.id, {
        agentId: agent.id,
        agentName: agent.name,
        status: 'IDLE',
        progress: 0,
      });
    });
  }

  private async subscribeToAgentUpdates() {
    if (!this.nc) return;

    // Subscribe to all agent activity subjects
    const sub = this.nc.subscribe('wms.agents.activity.*');

    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(msg.string());
          this.updateActivity(data);
        } catch (error) {
          console.error('[AgentActivity] Failed to parse message:', error);
        }
      }
    })();
  }

  /**
   * Update agent activity
   */
  private updateActivity(data: Partial<AgentActivity>) {
    if (!data.agentId) return;

    const current = this.activities.get(data.agentId) || {
      agentId: data.agentId,
      agentName: data.agentName || data.agentId,
      status: 'IDLE' as const,
      progress: 0,
    };

    const updated: AgentActivity = {
      ...current,
      ...data,
    };

    this.activities.set(data.agentId, updated);
    console.log(`[AgentActivity] Updated ${data.agentId}: ${updated.status}`);

    // Publish to subscribers
    if (this.nc) {
      this.nc.publish(
        'wms.monitoring.agent.updated',
        JSON.stringify(updated)
      );
      this.nc.publish(
        `wms.monitoring.agent.updated.${data.agentId}`,
        JSON.stringify(updated)
      );
    }
  }

  /**
   * Get all agent activities
   */
  async getAllActivities(): Promise<AgentActivity[]> {
    return Array.from(this.activities.values());
  }

  /**
   * Get activity by agent ID
   */
  async getActivityByAgentId(agentId: string): Promise<AgentActivity | null> {
    return this.activities.get(agentId) || null;
  }

  /**
   * Manually set agent activity (for testing or manual control)
   */
  async setActivity(activity: Partial<AgentActivity>): Promise<void> {
    if (!activity.agentId) {
      throw new Error('agentId is required');
    }

    this.updateActivity(activity);

    // Publish to NATS
    if (this.nc) {
      await this.nc.publish(
        `wms.agents.activity.${activity.agentId}`,
        JSON.stringify(activity)
      );
    }
  }

  /**
   * Mark agent as started on a task
   */
  async startTask(
    agentId: string,
    reqNumber: string,
    featureTitle: string,
    task: string
  ): Promise<void> {
    await this.setActivity({
      agentId,
      status: 'RUNNING',
      reqNumber,
      featureTitle,
      currentTask: task,
      progress: 0,
      startedAt: new Date(),
    });
  }

  /**
   * Update agent progress
   */
  async updateProgress(
    agentId: string,
    progress: number,
    currentTask?: string
  ): Promise<void> {
    await this.setActivity({
      agentId,
      progress,
      currentTask,
    });
  }

  /**
   * Mark agent as completed
   */
  async completeTask(
    agentId: string,
    deliverablePath?: string
  ): Promise<void> {
    await this.setActivity({
      agentId,
      status: 'COMPLETED',
      progress: 100,
      deliverablePath,
    });
  }

  /**
   * Mark agent as failed
   */
  async failTask(agentId: string, error: string): Promise<void> {
    await this.setActivity({
      agentId,
      status: 'FAILED',
      error,
    });
  }

  /**
   * Mark agent as blocked
   */
  async blockTask(agentId: string, reason: string): Promise<void> {
    await this.setActivity({
      agentId,
      status: 'BLOCKED',
      error: reason,
    });
  }

  /**
   * Reset agent to idle
   */
  async resetAgent(agentId: string): Promise<void> {
    await this.setActivity({
      agentId,
      status: 'IDLE',
      progress: 0,
      reqNumber: undefined,
      featureTitle: undefined,
      currentTask: undefined,
      deliverablePath: undefined,
      error: undefined,
    });
  }

  /**
   * Get agent activity statistics
   */
  async getStats() {
    const activities = Array.from(this.activities.values());

    return {
      activeAgents: activities.filter((a) => a.status === 'RUNNING').length,
      idleAgents: activities.filter((a) => a.status === 'IDLE').length,
      blockedAgents: activities.filter((a) => a.status === 'BLOCKED').length,
      completedToday: 0, // TODO: Track completions
    };
  }

  async close() {
    if (this.nc) {
      await this.nc.close();
    }
  }
}
