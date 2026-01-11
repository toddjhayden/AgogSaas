/**
 * Agent Activity Service
 * Tracks agent activities by subscribing to NATS messages
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, JSONCodec } from 'nats';

export interface AgentActivity {
  agentId: string;
  agentName: string;
  status: 'IDLE' | 'RUNNING' | 'BLOCKED' | 'COMPLETED' | 'FAILED';
  reqNumber?: string;
  featureTitle?: string;
  currentTask?: string;
  progress: number;
  startedAt?: string;
  estimatedCompletion?: string;
  deliverablePath?: string;
  error?: string;
  metadata?: any;
}

@Injectable()
export class AgentActivityService implements OnModuleInit, OnModuleDestroy {
  private nc?: NatsConnection;
  private activities: Map<string, AgentActivity> = new Map();
  private jc = JSONCodec();

  async onModuleInit() {
    try {
      const natsUrl = process.env.NATS_URL || 'nats://nats:4222';
      const user = process.env.NATS_USER;
      const pass = process.env.NATS_PASSWORD;

      this.nc = await connect({
        servers: natsUrl,
        user,
        pass,
        name: 'monitoring-agent-activity-service'
      });

      console.log('[AgentActivityService] Connected to NATS');

      // Subscribe to agent deliverables
      this.subscribeToDeliverables();

      // Subscribe to workflow updates
      this.subscribeToWorkflows();

    } catch (error: any) {
      console.error('[AgentActivityService] Failed to connect to NATS:', error.message);
      // Continue without NATS - will return empty data
    }
  }

  /**
   * Subscribe to agent deliverables (agog.deliverables.*)
   */
  private async subscribeToDeliverables() {
    if (!this.nc) return;

    const sub = this.nc.subscribe('agog.deliverables.>');

    (async () => {
      for await (const msg of sub) {
        try {
          const data = this.jc.decode(msg.data) as any;
          const agentName = this.extractAgentName(msg.subject);

          if (agentName) {
            this.updateActivity(agentName, {
              agentId: `${agentName}-${Date.now()}`,
              agentName,
              status: 'COMPLETED',
              reqNumber: data.reqNumber || data.reqId,
              featureTitle: data.title || data.feature,
              progress: 100,
              deliverablePath: data.deliverablePath,
              metadata: data
            });
          }
        } catch (error) {
          console.error('[AgentActivityService] Error processing deliverable:', error);
        }
      }
    })();
  }

  /**
   * Subscribe to workflow updates (agog.workflows.*)
   */
  private async subscribeToWorkflows() {
    if (!this.nc) return;

    const sub = this.nc.subscribe('agog.workflows.>');

    (async () => {
      for await (const msg of sub) {
        try {
          // Skip empty or non-JSON messages gracefully
          if (!msg.data || msg.data.length === 0) {
            continue;
          }

          let data: any;
          try {
            data = this.jc.decode(msg.data);
          } catch (parseError) {
            // Silently skip non-JSON messages (e.g., heartbeats, empty pings)
            continue;
          }

          if (data && data.currentAgent) {
            this.updateActivity(data.currentAgent, {
              agentId: `${data.currentAgent}-${data.reqNumber}`,
              agentName: data.currentAgent,
              status: this.mapWorkflowStatus(data.status),
              reqNumber: data.reqNumber,
              featureTitle: data.title,
              currentTask: data.currentStage,
              progress: this.calculateProgress(data),
              startedAt: data.startedAt,
              metadata: data
            });
          }
        } catch (error) {
          console.error('[AgentActivityService] Error processing workflow:', error);
        }
      }
    })();
  }

  /**
   * Extract agent name from NATS subject
   */
  private extractAgentName(subject: string): string | null {
    const match = subject.match(/agog\.deliverables\.([^.]+)/);
    return match ? match[1] : null;
  }

  /**
   * Map workflow status to agent status
   */
  private mapWorkflowStatus(status: string): AgentActivity['status'] {
    const statusMap: Record<string, AgentActivity['status']> = {
      'PENDING': 'IDLE',
      'RUNNING': 'RUNNING',
      'BLOCKED': 'BLOCKED',
      'COMPLETE': 'COMPLETED',
      'FAILED': 'FAILED'
    };
    return statusMap[status?.toUpperCase()] || 'IDLE';
  }

  /**
   * Calculate progress percentage from workflow data
   */
  private calculateProgress(workflow: any): number {
    if (!workflow.stages || workflow.stages.length === 0) return 0;

    const completedStages = workflow.stages.filter((s: any) =>
      s.status === 'COMPLETED' || s.status === 'COMPLETE'
    ).length;

    return Math.round((completedStages / workflow.stages.length) * 100);
  }

  /**
   * Update or create agent activity
   */
  private updateActivity(agentName: string, activity: Partial<AgentActivity>) {
    const existing = this.activities.get(agentName);

    this.activities.set(agentName, {
      agentId: activity.agentId || `${agentName}-${Date.now()}`,
      agentName,
      status: activity.status || 'IDLE',
      reqNumber: activity.reqNumber,
      featureTitle: activity.featureTitle,
      currentTask: activity.currentTask,
      progress: activity.progress || 0,
      startedAt: activity.startedAt || existing?.startedAt || new Date().toISOString(),
      estimatedCompletion: activity.estimatedCompletion,
      deliverablePath: activity.deliverablePath,
      error: activity.error,
      metadata: activity.metadata
    });

    // Clean up old completed activities (keep last 10 minutes)
    this.cleanupOldActivities();
  }

  /**
   * Remove old completed activities
   */
  private cleanupOldActivities() {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);

    for (const [agentName, activity] of this.activities.entries()) {
      if (activity.status === 'COMPLETED' && activity.startedAt) {
        const startTime = new Date(activity.startedAt).getTime();
        if (startTime < tenMinutesAgo) {
          this.activities.delete(agentName);
        }
      }
    }
  }

  /**
   * Get all current agent activities
   */
  getAllActivities(): AgentActivity[] {
    return Array.from(this.activities.values());
  }

  /**
   * Get activity for specific agent
   */
  getActivityByAgentId(agentId: string): AgentActivity | null {
    for (const activity of this.activities.values()) {
      if (activity.agentId === agentId) {
        return activity;
      }
    }
    return null;
  }

  /**
   * Get statistics
   */
  getStats() {
    const activities = this.getAllActivities();
    return {
      activeAgents: activities.filter(a => a.status === 'RUNNING').length,
      totalAgents: activities.length,
      blockedAgents: activities.filter(a => a.status === 'BLOCKED').length,
    };
  }

  async onModuleDestroy() {
    if (this.nc) {
      await this.nc.close();
      console.log('[AgentActivityService] Disconnected from NATS');
    }
  }
}
