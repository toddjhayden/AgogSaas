import { connect, NatsConnection, JetStreamClient } from 'nats';
import { AgentSpawnerService } from './agent-spawner.service';

interface WorkflowStage {
  name: string;
  agent: string;
  natsSubject: string;
  timeout: number;
  retries: number;
  onSuccess: 'next' | 'complete' | 'decision';
  onFailure: 'retry' | 'block' | 'notify';
  onConditional?: 'block' | 'notify';
}

interface FeatureWorkflow {
  reqNumber: string;
  title: string;
  assignedTo: 'marcus' | 'sarah' | 'alex';
  stages: WorkflowStage[];
  currentStage: number;
  status: 'pending' | 'running' | 'blocked' | 'complete' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

const STANDARD_FEATURE_WORKFLOW: WorkflowStage[] = [
  {
    name: 'Research',
    agent: 'cynthia',
    natsSubject: 'wms.features.research.{reqNumber}',
    timeout: 7200000, // 2 hours
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Critique',
    agent: 'sylvia',
    natsSubject: 'wms.features.critique.{reqNumber}',
    timeout: 3600000, // 1 hour
    retries: 0,
    onSuccess: 'decision',
    onFailure: 'block',
    onConditional: 'block',
  },
  {
    name: 'Backend Implementation',
    agent: 'roy',
    natsSubject: 'wms.features.backend.{reqNumber}',
    timeout: 14400000, // 4 hours
    retries: 1,
    onSuccess: 'next',
    onFailure: 'notify',
  },
  {
    name: 'Frontend Implementation',
    agent: 'jen',
    natsSubject: 'wms.features.frontend.{reqNumber}',
    timeout: 14400000, // 4 hours
    retries: 1,
    onSuccess: 'next',
    onFailure: 'notify',
  },
  {
    name: 'QA Testing',
    agent: 'billy',
    natsSubject: 'wms.features.qa.{reqNumber}',
    timeout: 7200000, // 2 hours
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Statistics',
    agent: 'priya',
    natsSubject: 'wms.features.statistics.{reqNumber}',
    timeout: 1800000, // 30 min
    retries: 0,
    onSuccess: 'complete',
    onFailure: 'notify',
  },
];

export class OrchestratorService {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private workflows: Map<string, FeatureWorkflow> = new Map();
  private agentSpawner!: AgentSpawnerService;

  async initialize(): Promise<void> {
    this.nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
    });
    this.js = this.nc.jetstream();

    // Initialize agent spawner
    this.agentSpawner = new AgentSpawnerService();
    await this.agentSpawner.initialize();

    console.log('Orchestrator initialized and connected to NATS Jetstream');
  }

  async startWorkflow(reqNumber: string, title: string, assignedTo: string): Promise<void> {
    const workflow: FeatureWorkflow = {
      reqNumber,
      title,
      assignedTo: assignedTo as 'marcus' | 'sarah' | 'alex',
      stages: STANDARD_FEATURE_WORKFLOW,
      currentStage: 0,
      status: 'running',
      startedAt: new Date(),
    };

    this.workflows.set(reqNumber, workflow);

    console.log(`[${reqNumber}] Starting workflow: ${title}`);
    await this.publishEvent('workflow.started', { reqNumber, title });

    await this.executeStage(reqNumber, 0);
  }

  private async executeStage(reqNumber: string, stageIndex: number): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) {
      console.error(`Workflow ${reqNumber} not found`);
      return;
    }

    const stage = workflow.stages[stageIndex];
    workflow.currentStage = stageIndex;

    console.log(`[${reqNumber}] Stage ${stageIndex + 1}/${workflow.stages.length}: ${stage.name}`);

    await this.publishEvent('stage.started', {
      reqNumber,
      stage: stage.name,
      agent: stage.agent,
    });

    try {
      console.log(`[${reqNumber}] Spawning ${stage.agent}...`);

      // Spawn the agent and wait for completion
      const deliverable = await this.agentSpawner.spawnAgent({
        agentId: stage.agent,
        reqNumber,
        featureTitle: workflow.title,
        contextData: this.getContextForAgent(reqNumber, stageIndex),
        timeoutMs: stage.timeout,
      });

      // Check deliverable status
      if (deliverable.status === 'COMPLETE') {
        await this.handleStageSuccess(reqNumber, stageIndex, deliverable);
      } else if (deliverable.status === 'BLOCKED') {
        await this.handleStageBlocked(reqNumber, stageIndex, deliverable);
      } else {
        await this.handleStageFailure(reqNumber, stageIndex, new Error(deliverable.summary || 'Agent failed'));
      }
    } catch (error: any) {
      console.error(`[${reqNumber}] Stage ${stage.name} failed:`, error);
      await this.handleStageFailure(reqNumber, stageIndex, error);
    }
  }

  /**
   * Get context for agent based on previous stages
   */
  private getContextForAgent(reqNumber: string, stageIndex: number): any {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return {};

    // Gather deliverable URLs from previous stages
    const previousStages = workflow.stages.slice(0, stageIndex).map((s) => ({
      stage: s.name,
      agent: s.agent,
      deliverableUrl: `nats://wms.features.${this.getStreamName(s.agent)}.${reqNumber}`,
    }));

    return {
      reqNumber,
      title: workflow.title,
      assignedTo: workflow.assignedTo,
      previousStages,
    };
  }

  /**
   * Get NATS stream name from agent name
   */
  private getStreamName(agent: string): string {
    const streamMap: Record<string, string> = {
      'cynthia': 'research',
      'sylvia': 'critique',
      'roy': 'backend',
      'jen': 'frontend',
      'billy': 'qa',
      'priya': 'statistics',
    };
    return streamMap[agent] || agent;
  }

  private async handleStageSuccess(reqNumber: string, stageIndex: number, deliverable?: any): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return;

    const stage = workflow.stages[stageIndex];

    console.log(`[${reqNumber}] Stage ${stage.name} completed successfully`);

    await this.publishEvent('stage.completed', {
      reqNumber,
      stage: stage.name,
      deliverable: deliverable?.summary || 'Completed',
    });

    if (stage.onSuccess === 'next') {
      const nextStage = stageIndex + 1;
      if (nextStage < workflow.stages.length) {
        await this.executeStage(reqNumber, nextStage);
      } else {
        await this.completeWorkflow(reqNumber);
      }
    } else if (stage.onSuccess === 'complete') {
      await this.completeWorkflow(reqNumber);
    } else if (stage.onSuccess === 'decision') {
      // For Sylvia's critique - check if APPROVED or needs changes
      if (deliverable?.decision === 'APPROVED') {
        const nextStage = stageIndex + 1;
        if (nextStage < workflow.stages.length) {
          await this.executeStage(reqNumber, nextStage);
        }
      } else {
        // CONDITIONAL or REJECTED - block workflow
        await this.handleStageBlocked(reqNumber, stageIndex, deliverable);
      }
    }
  }

  private async handleStageBlocked(reqNumber: string, stageIndex: number, deliverable?: any): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return;

    const stage = workflow.stages[stageIndex];
    workflow.status = 'blocked';

    console.log(`[${reqNumber}] Stage ${stage.name} BLOCKED: ${deliverable?.summary || 'Unknown reason'}`);

    await this.publishEvent('stage.blocked', {
      reqNumber,
      stage: stage.name,
      reason: deliverable?.summary || 'Agent returned BLOCKED status',
      blockers: deliverable?.blockers || [],
    });
  }

  private async handleStageFailure(reqNumber: string, stageIndex: number, error: Error): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return;

    const stage = workflow.stages[stageIndex];

    console.error(`[${reqNumber}] Stage ${stage.name} FAILED: ${error.message}`);

    // Check if should retry
    if (stage.retries > 0) {
      console.log(`[${reqNumber}] Retrying stage ${stage.name}...`);
      await this.executeStage(reqNumber, stageIndex);
      return;
    }

    // Check failure strategy
    if (stage.onFailure === 'block') {
      workflow.status = 'blocked';
      await this.publishEvent('stage.failed', {
        reqNumber,
        stage: stage.name,
        error: error.message,
        action: 'BLOCKED',
      });
    } else if (stage.onFailure === 'notify') {
      workflow.status = 'failed';
      await this.publishEvent('stage.failed', {
        reqNumber,
        stage: stage.name,
        error: error.message,
        action: 'NOTIFY_OWNER',
      });
    }
  }

  private async completeWorkflow(reqNumber: string): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return;

    workflow.status = 'complete';
    workflow.completedAt = new Date();

    const duration = workflow.completedAt.getTime() - workflow.startedAt.getTime();
    const durationHours = (duration / 1000 / 60 / 60).toFixed(2);

    console.log(`[${reqNumber}] ✅ Workflow complete! Duration: ${durationHours} hours`);

    await this.publishEvent('workflow.completed', {
      reqNumber,
      duration: durationHours,
    });
  }

  private async publishEvent(eventType: string, data: any): Promise<void> {
    try {
      await this.js.publish(
        `wms.orchestration.events.${eventType}`,
        JSON.stringify({ ...data, timestamp: new Date() })
      );
    } catch (error) {
      console.error(`Failed to publish event ${eventType}:`, error);
    }
  }

  async getWorkflowStatus(reqNumber: string): Promise<FeatureWorkflow | undefined> {
    return this.workflows.get(reqNumber);
  }

  async getStats() {
    const workflows = Array.from(this.workflows.values());
    const completed = workflows.filter((w) => w.status === 'complete');

    let totalDuration = 0;
    for (const workflow of completed) {
      if (workflow.completedAt && workflow.startedAt) {
        totalDuration += workflow.completedAt.getTime() - workflow.startedAt.getTime();
      }
    }

    const avgDuration = completed.length > 0
      ? totalDuration / completed.length / 1000 / 60 / 60
      : 0;

    return {
      completedWorkflows: completed.length,
      activeWorkflows: workflows.filter((w) => w.status === 'running').length,
      blockedWorkflows: workflows.filter((w) => w.status === 'blocked').length,
      avgDuration: parseFloat(avgDuration.toFixed(2)),
    };
  }

  async close(): Promise<void> {
    await this.nc.close();
  }
}
