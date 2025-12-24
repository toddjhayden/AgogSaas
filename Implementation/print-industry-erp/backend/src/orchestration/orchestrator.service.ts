import { connect, NatsConnection, JetStreamClient, StorageType, RetentionPolicy, StreamConfig, DiscardPolicy } from 'nats';
import { AgentSpawnerService } from './agent-spawner.service';
import { Pool } from 'pg';

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
  stageDeliverables: Map<number, any>; // Store deliverable from each stage
}

const STANDARD_FEATURE_WORKFLOW: WorkflowStage[] = [
  {
    name: 'Research',
    agent: 'cynthia',
    natsSubject: 'agog.features.research.{reqNumber}',
    timeout: 7200000, // 2 hours
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Critique',
    agent: 'sylvia',
    natsSubject: 'agog.features.critique.{reqNumber}',
    timeout: 3600000, // 1 hour
    retries: 0,
    onSuccess: 'decision',
    onFailure: 'block',
    onConditional: 'block',
  },
  {
    name: 'Backend Implementation',
    agent: 'roy',
    natsSubject: 'agog.features.backend.{reqNumber}',
    timeout: 14400000, // 4 hours
    retries: 1,
    onSuccess: 'next',
    onFailure: 'notify',
  },
  {
    name: 'Frontend Implementation',
    agent: 'jen',
    natsSubject: 'agog.features.frontend.{reqNumber}',
    timeout: 14400000, // 4 hours
    retries: 1,
    onSuccess: 'next',
    onFailure: 'notify',
  },
  {
    name: 'QA Testing',
    agent: 'billy',
    natsSubject: 'agog.features.qa.{reqNumber}',
    timeout: 7200000, // 2 hours
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Statistics',
    agent: 'priya',
    natsSubject: 'agog.features.statistics.{reqNumber}',
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
  private pool!: Pool;

  async initialize(): Promise<void> {
    // Use docker-compose port mapping (4223) by default
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';

    const connectionOptions: any = {
      servers: natsUrl,
      name: 'agogsaas-orchestrator-main',
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1000,
    };

    // If credentials are not in URL, check for separate env vars
    if (!natsUrl.includes('@')) {
      const user = process.env.NATS_USER;
      const pass = process.env.NATS_PASSWORD;
      if (user && pass) {
        connectionOptions.user = user;
        connectionOptions.pass = pass;
        console.log(`[Orchestrator] Using credentials for user: ${user}`);
      }
    }

    this.nc = await connect(connectionOptions);
    this.js = this.nc.jetstream();

    // Initialize database connection for workflow persistence
    const dbUrl = process.env.DATABASE_URL || 'postgresql://agogsaas_user:changeme@localhost:5433/agogsaas';
    this.pool = new Pool({ connectionString: dbUrl });

    // Initialize orchestration events stream
    await this.initializeOrchestrationStream();

    // Initialize agent spawner
    this.agentSpawner = new AgentSpawnerService();
    await this.agentSpawner.initialize();

    // Restore in-flight workflows from database
    await this.restoreWorkflowsFromDatabase();

    console.log('Orchestrator initialized and connected to NATS Jetstream');
  }

  /**
   * Initialize orchestration events stream
   */
  private async initializeOrchestrationStream(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    const streamName = 'agog_orchestration_events';

    try {
      // Try to get existing stream
      await jsm.streams.info(streamName);
      console.log(`[Orchestrator] Stream ${streamName} already exists`);
    } catch (error) {
      // Stream doesn't exist, create it
      console.log(`[Orchestrator] Creating stream: ${streamName}`);

      const streamConfig: Partial<StreamConfig> = {
        name: streamName,
        subjects: ['agog.orchestration.events.>'],
        storage: StorageType.File,
        retention: RetentionPolicy.Limits,
        max_msgs: 10000,
        max_bytes: 100 * 1024 * 1024, // 100MB
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days (nanoseconds)
        discard: DiscardPolicy.Old,
      };

      await jsm.streams.add(streamConfig);
      console.log(`[Orchestrator] ✅ Stream ${streamName} created`);
    }
  }

  /**
   * Restore in-flight workflows from database on server restart
   * CRITICAL: Prevents workflow data loss and duplicate spawns
   */
  private async restoreWorkflowsFromDatabase(): Promise<void> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM workflow_state WHERE status IN ('running', 'blocked') ORDER BY started_at`
      );

      for (const row of result.rows) {
        const workflow: FeatureWorkflow = {
          reqNumber: row.req_number,
          title: row.title,
          assignedTo: row.assigned_to,
          stages: STANDARD_FEATURE_WORKFLOW,
          currentStage: row.current_stage,
          status: row.status,
          startedAt: new Date(row.started_at),
          completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
          stageDeliverables: new Map(JSON.parse(row.stage_deliverables || '[]'))
        };
        this.workflows.set(row.req_number, workflow);
      }

      console.log(`[Orchestrator] ✅ Restored ${result.rows.length} in-flight workflows from database`);
    } catch (error: any) {
      console.error('[Orchestrator] ⚠️  Failed to restore workflows from database:', error.message);
      // Continue initialization - don't fail completely
    }
  }

  /**
   * Persist workflow state to database
   * Called on every state change to ensure durability
   */
  private async saveWorkflowToDatabase(workflow: FeatureWorkflow): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO workflow_state (req_number, title, assigned_to, current_stage, status, started_at, completed_at, stage_deliverables)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (req_number) DO UPDATE SET
           current_stage = $4,
           status = $5,
           completed_at = $7,
           stage_deliverables = $8,
           updated_at = NOW()`,
        [
          workflow.reqNumber,
          workflow.title,
          workflow.assignedTo,
          workflow.currentStage,
          workflow.status,
          workflow.startedAt,
          workflow.completedAt || null,
          JSON.stringify(Array.from(workflow.stageDeliverables.entries()))
        ]
      );
    } catch (error: any) {
      console.error(`[${workflow.reqNumber}] ⚠️  Failed to save workflow to database:`, error.message);
      // Don't throw - continue workflow execution
    }
  }

  async startWorkflow(reqNumber: string, title: string, assignedTo: string): Promise<void> {
    // Simple in-memory duplicate check
    if (this.workflows.has(reqNumber)) {
      console.log(`[${reqNumber}] ✋ Workflow already exists - skipping duplicate`);
      return;
    }

    const workflow: FeatureWorkflow = {
      reqNumber,
      title,
      assignedTo: assignedTo as 'marcus' | 'sarah' | 'alex',
      stages: STANDARD_FEATURE_WORKFLOW,
      currentStage: 0,
      status: 'running',
      startedAt: new Date(),
      stageDeliverables: new Map(),
    };

    this.workflows.set(reqNumber, workflow);

    // CRITICAL: Persist to database immediately
    await this.saveWorkflowToDatabase(workflow);

    console.log(`[${reqNumber}] Starting workflow: ${title}`);
    await this.publishEvent('workflow.started', { reqNumber, title });

    await this.executeStage(reqNumber, 0);
  }

  async resumeWorkflowFromStage(reqNumber: string, title: string, assignedTo: string, startStage: number): Promise<void> {
    // Simple in-memory duplicate check
    if (this.workflows.has(reqNumber)) {
      console.log(`[${reqNumber}] ✋ Workflow already exists - skipping duplicate`);
      return;
    }

    const workflow: FeatureWorkflow = {
      reqNumber,
      title,
      assignedTo: assignedTo as 'marcus' | 'sarah' | 'alex',
      stages: STANDARD_FEATURE_WORKFLOW,
      currentStage: startStage,
      status: 'running',
      startedAt: new Date(),
      stageDeliverables: new Map(),
    };

    this.workflows.set(reqNumber, workflow);

    // CRITICAL: Persist to database immediately
    await this.saveWorkflowToDatabase(workflow);

    console.log(`[${reqNumber}] Resuming workflow from stage ${startStage + 1}: ${title}`);
    await this.publishEvent('workflow.resumed', { reqNumber, title, startStage });

    await this.executeStage(reqNumber, startStage);
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

    // Publish stage.started event with full context for host listener
    const contextData = this.getContextForAgent(reqNumber, stageIndex);
    await this.publishEvent('stage.started', {
      eventType: 'stage.started',
      reqNumber,
      stage: stage.name,
      agentId: stage.agent,
      contextData: {
        featureTitle: workflow.title,
        ...contextData,
      },
      timeout: stage.timeout,
    });

    console.log(`[${reqNumber}] Published stage.started event for ${stage.agent}`);
    console.log(`[${reqNumber}] Host listener will spawn ${stage.agent} and publish deliverable to NATS`);

    // Wait for deliverable from host listener
    try {
      const deliverableSubject = `agog.deliverables.${stage.agent}.${this.getStreamName(stage.agent)}.${reqNumber}`;
      console.log(`[${reqNumber}] Waiting for deliverable on ${deliverableSubject}...`);

      const deliverable = await this.waitForDeliverable(deliverableSubject, stage.timeout || 3600000);

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
   * Wait for deliverable to be published to NATS by host listener
   * CRITICAL FIX: Properly cleanup subscriptions on timeout/error to prevent memory leaks
   */
  private async waitForDeliverable(subject: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      let sub: any = null;
      let cleanedUp = false;

      const cleanup = async () => {
        if (cleanedUp) return;
        cleanedUp = true;

        if (sub) {
          try {
            await sub.drain(); // Gracefully close subscription
          } catch (error: any) {
            console.warn(`Failed to drain subscription for ${subject}:`, error.message);
          }
        }
      };

      const timeout = setTimeout(async () => {
        await cleanup();
        reject(new Error(`Timeout waiting for deliverable on ${subject} after ${timeoutMs}ms`));
      }, timeoutMs);

      // Subscribe to the deliverable subject
      sub = this.nc.subscribe(subject, { max: 1 });

      (async () => {
        try {
          for await (const msg of sub) {
            clearTimeout(timeout);
            await cleanup();

            try {
              const deliverable = JSON.parse(msg.string());
              resolve(deliverable);
            } catch (error) {
              reject(new Error(`Failed to parse deliverable from ${subject}: ${error}`));
            }
            return; // Exit iteration
          }

          // Subscription closed without message
          clearTimeout(timeout);
          await cleanup();
          reject(new Error(`Subscription closed for ${subject} without receiving deliverable`));

        } catch (error: any) {
          // Handle NATS connection errors during iteration
          clearTimeout(timeout);
          await cleanup();
          reject(new Error(`NATS error while waiting for ${subject}: ${error.message}`));
        }
      })();
    });
  }

  /**
   * Get context for agent based on previous stages
   * TOKEN BURN PREVENTION: Only pass NATS URLs, NOT full content
   */
  private getContextForAgent(reqNumber: string, stageIndex: number): any {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return {};

    // Gather deliverable URLs from previous stages (NATS URLs only - no full content!)
    const previousStages = workflow.stages.slice(0, stageIndex).map((s, idx) => ({
      stage: s.name,
      agent: s.agent,
      deliverableUrl: `nats://agog.deliverables.${s.agent}.${this.getStreamName(s.agent)}.${reqNumber}`,
    }));

    // Return ONLY NATS URLs - agents will fetch full content themselves
    // This prevents token burn (95% savings on agent spawning)
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

    // TOKEN BURN PREVENTION: Don't store full deliverable content
    // Deliverables are in NATS - agents fetch them directly when needed
    // Only store minimal metadata for tracking
    if (deliverable) {
      workflow.stageDeliverables.set(stageIndex, {
        status: deliverable.status,
        summary: deliverable.summary,
        timestamp: deliverable.timestamp || new Date().toISOString(),
      });
    }

    // CRITICAL: Persist after each stage completion
    await this.saveWorkflowToDatabase(workflow);

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
      const verdict = deliverable?.critique_verdict || deliverable?.decision;
      if (verdict === 'APPROVED' || verdict === 'APPROVED_WITH_CONDITIONS') {
        const nextStage = stageIndex + 1;
        if (nextStage < workflow.stages.length) {
          await this.executeStage(reqNumber, nextStage);
        }
      } else {
        // REJECTED - block workflow
        await this.handleStageBlocked(reqNumber, stageIndex, deliverable);
      }
    }
  }

  private async handleStageBlocked(reqNumber: string, stageIndex: number, deliverable?: any): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return;

    const stage = workflow.stages[stageIndex];
    workflow.status = 'blocked';

    // CRITICAL: Persist blocked status
    await this.saveWorkflowToDatabase(workflow);

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

    // CRITICAL: Persist final status
    await this.saveWorkflowToDatabase(workflow);

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
        `agog.orchestration.events.${eventType}`,
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

  /**
   * Resume a blocked workflow with strategic decision
   */
  async resumeWorkflow(reqNumber: string, decision: any): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) {
      throw new Error(`Workflow ${reqNumber} not found`);
    }

    if (workflow.status !== 'blocked') {
      throw new Error(`Workflow ${reqNumber} is not blocked (status: ${workflow.status})`);
    }

    console.log(`[${reqNumber}] Resuming workflow with strategic decision`);
    console.log(`[${reqNumber}] Decision: ${decision.decision}`);

    // Update workflow status
    workflow.status = 'running';

    // Add strategic decision to context for subsequent stages
    const currentStageIndex = workflow.currentStage;
    workflow.stageDeliverables.set(currentStageIndex, {
      ...workflow.stageDeliverables.get(currentStageIndex),
      strategic_decision: decision,
    });

    // Resume from next stage
    const nextStage = currentStageIndex + 1;
    if (nextStage < workflow.stages.length) {
      console.log(`[${reqNumber}] Continuing to stage ${nextStage + 1}: ${workflow.stages[nextStage].name}`);
      await this.executeStage(reqNumber, nextStage);
    } else {
      console.log(`[${reqNumber}] No more stages, completing workflow`);
      await this.completeWorkflow(reqNumber);
    }
  }

  /**
   * Restart workflow from a specific stage
   */
  async restartFromStage(reqNumber: string, stageIndex: number, reason?: string): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) {
      throw new Error(`Workflow ${reqNumber} not found`);
    }

    if (stageIndex < 0 || stageIndex >= workflow.stages.length) {
      throw new Error(`Invalid stage index ${stageIndex} for workflow ${reqNumber}`);
    }

    console.log(`[${reqNumber}] Restarting workflow from stage ${stageIndex + 1}: ${workflow.stages[stageIndex].name}`);
    if (reason) {
      console.log(`[${reqNumber}] Reason: ${reason}`);
    }

    // Clear deliverables from this stage onward
    const currentDeliverables = Array.from(workflow.stageDeliverables.keys());
    for (const key of currentDeliverables) {
      if (key >= stageIndex) {
        workflow.stageDeliverables.delete(key);
      }
    }

    // Reset workflow status
    workflow.status = 'running';
    workflow.currentStage = stageIndex;

    // Publish restart event
    await this.publishEvent('workflow.restarted', {
      reqNumber,
      restartStage: workflow.stages[stageIndex].name,
      reason: reason || 'Strategic decision requested restart',
    });

    // Execute from the specified stage
    await this.executeStage(reqNumber, stageIndex);
  }

  async close(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
    }
  }
}
