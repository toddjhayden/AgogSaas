import { connect, NatsConnection, JetStreamClient, StorageType, RetentionPolicy, StreamConfig, DiscardPolicy } from 'nats';
import { AgentSpawnerService } from './agent-spawner.service';
import { ParallelExecutionEngine, ParallelExecutionResult } from './parallel-execution.engine';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

interface WorkflowStage {
  name: string;
  agent: string;
  natsSubject: string;
  timeout: number;
  retries: number;
  onSuccess: 'next' | 'complete' | 'decision';
  onFailure: 'retry' | 'block' | 'notify';
  onConditional?: 'block' | 'notify';
  conditional?: 'needs_todd' | 'needs_vic'; // Only run if previous stage set this flag
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
  strategicContext?: {
    similarWorkflows: { content: string; relevance: number; agent: string; metadata?: any }[];
    technicalPatterns: { content: string; relevance: number }[];
    patterns: string[];
  }; // Embedding-based context from past learnings
}

const STANDARD_FEATURE_WORKFLOW: WorkflowStage[] = [
  {
    name: 'Research',
    agent: 'cynthia',
    natsSubject: 'agog.features.research.{reqNumber}',
    timeout: 2700000, // 45 minutes (agents work faster than humans)
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Critique',
    agent: 'sylvia',
    natsSubject: 'agog.features.critique.{reqNumber}',
    timeout: 1800000, // 30 minutes
    retries: 0,
    onSuccess: 'decision',
    onFailure: 'block',
    onConditional: 'block',
  },
  {
    name: 'Backend Implementation',
    agent: 'roy',
    natsSubject: 'agog.features.backend.{reqNumber}',
    timeout: 3600000, // 1 hour (reduced from 4 hours)
    retries: 1,
    onSuccess: 'next',
    onFailure: 'notify',
  },
  {
    name: 'Frontend Implementation',
    agent: 'jen',
    natsSubject: 'agog.features.frontend.{reqNumber}',
    timeout: 3600000, // 1 hour (reduced from 4 hours)
    retries: 1,
    onSuccess: 'next',
    onFailure: 'notify',
  },
  {
    name: 'Backend QA',
    agent: 'billy',
    natsSubject: 'agog.features.qa-backend.{reqNumber}',
    timeout: 2700000, // 45 minutes
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Frontend QA',
    agent: 'liz',
    natsSubject: 'agog.features.qa-frontend.{reqNumber}',
    timeout: 2700000, // 45 minutes
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Performance Testing',
    agent: 'todd',
    natsSubject: 'agog.features.qa-performance.{reqNumber}',
    timeout: 3600000, // 1 hour (load tests take time)
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
    conditional: 'needs_todd', // Only run if Billy or Liz flagged
  },
  {
    name: 'Security Testing',
    agent: 'vic',
    natsSubject: 'agog.features.qa-security.{reqNumber}',
    timeout: 3600000, // 1 hour (security scans take time)
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
    conditional: 'needs_vic', // Only run if Billy or Liz flagged
  },
  {
    name: 'Statistics',
    agent: 'priya',
    natsSubject: 'agog.features.statistics.{reqNumber}',
    timeout: 5400000, // 90 minutes (1.5 hours)
    retries: 0,
    onSuccess: 'next',
    onFailure: 'notify',
  },
  {
    name: 'DevOps Deployment',
    agent: 'berry',
    natsSubject: 'agog.features.devops.{reqNumber}',
    timeout: 900000, // 15 minutes (reduced from 1 hour)
    retries: 0,
    onSuccess: 'next',
    onFailure: 'block',
  },
  {
    name: 'Documentation Update',
    agent: 'tim',
    natsSubject: 'agog.features.documentation.{reqNumber}',
    timeout: 1800000, // 30 minutes
    retries: 0,
    onSuccess: 'complete',
    onFailure: 'notify', // Don't block on documentation failures
  },
];

export class OrchestratorService {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private workflows: Map<string, FeatureWorkflow> = new Map();
  private agentSpawner!: AgentSpawnerService;
  private parallelEngine!: ParallelExecutionEngine;

  // Feature flag for parallel execution (default: enabled)
  private readonly ENABLE_PARALLELIZATION = process.env.ENABLE_PARALLEL_EXECUTION !== 'false';

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

    // Initialize orchestration events stream
    await this.initializeOrchestrationStream();

    // Initialize agent spawner
    this.agentSpawner = new AgentSpawnerService();
    await this.agentSpawner.initialize();

    // Initialize parallel execution engine
    this.parallelEngine = new ParallelExecutionEngine(this.nc, this.js);
    console.log(`Orchestrator initialized - Parallelization: ${this.ENABLE_PARALLELIZATION ? 'ENABLED' : 'DISABLED'}`);
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

    // Initialize missing agent deliverable streams (berry and miki for DevOps)
    const missingAgentStreams = [
      { name: 'agog_features_devops', subjects: ['agog.deliverables.berry.>', 'agog.deliverables.miki.>'] },
    ];

    for (const stream of missingAgentStreams) {
      try {
        await jsm.streams.info(stream.name);
        console.log(`[Orchestrator] Stream ${stream.name} already exists`);
      } catch (error) {
        console.log(`[Orchestrator] Creating stream: ${stream.name}`);

        const streamConfig: Partial<StreamConfig> = {
          name: stream.name,
          subjects: stream.subjects,
          storage: StorageType.File,
          retention: RetentionPolicy.Limits,
          max_msgs: 10000,
          max_bytes: 1024 * 1024 * 1024, // 1GB
          max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days (nanoseconds)
          discard: DiscardPolicy.Old,
        };

        await jsm.streams.add(streamConfig);
        console.log(`[Orchestrator] ✅ Stream ${stream.name} created`);
      }
    }
  }

  async startWorkflow(reqNumber: string, title: string, assignedTo: string, strategicContext?: any): Promise<void> {
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
      strategicContext, // Include embedding-based context from past learnings
    };

    this.workflows.set(reqNumber, workflow);

    if (strategicContext && (strategicContext.similarWorkflows?.length > 0 || strategicContext.technicalPatterns?.length > 0)) {
      console.log(`[${reqNumber}] 🧠 Starting workflow with ${strategicContext.similarWorkflows?.length || 0} similar memories and ${strategicContext.technicalPatterns?.length || 0} technical patterns`);
    }
    console.log(`[${reqNumber}] Starting workflow: ${title}`);
    await this.publishEvent('workflow.started', { reqNumber, title });

    // Use parallel execution if enabled
    if (this.ENABLE_PARALLELIZATION) {
      await this.executeWorkflowParallel(reqNumber);
    } else {
      await this.executeStage(reqNumber, 0);
    }
  }

  async resumeWorkflowFromStage(reqNumber: string, title: string, assignedTo: string, startStage: number, strategicContext?: any): Promise<void> {
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
      strategicContext, // Include embedding-based context from past learnings
    };

    this.workflows.set(reqNumber, workflow);

    if (strategicContext && (strategicContext.similarWorkflows?.length > 0 || strategicContext.technicalPatterns?.length > 0)) {
      console.log(`[${reqNumber}] 🧠 Resuming workflow with ${strategicContext.similarWorkflows?.length || 0} similar memories and ${strategicContext.technicalPatterns?.length || 0} technical patterns`);
    }
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

    // Check if this is a conditional stage that should be skipped
    if (this.shouldSkipConditionalStage(workflow, stage)) {
      await this.publishEvent('stage.skipped', {
        reqNumber,
        stage: stage.name,
        reason: `No ${stage.conditional} flag set by previous stages`,
      });

      // Move to next stage
      const nextStage = stageIndex + 1;
      if (nextStage < workflow.stages.length) {
        await this.executeStage(reqNumber, nextStage);
      } else {
        await this.completeWorkflow(reqNumber);
      }
      return;
    }

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
   * Execute workflow with intelligent parallelization
   * REQ-1767924916115-9l233: Parallel execution of independent stages
   *
   * WORKFLOW RULE #1: Fails fast if any dependency is unavailable
   * WORKFLOW RULE #2: Never downgrades errors - build failures are blocking
   */
  private async executeWorkflowParallel(reqNumber: string): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) {
      console.error(`Workflow ${reqNumber} not found`);
      return;
    }

    console.log(`[${reqNumber}] 🚀 Executing workflow with PARALLELIZATION`);

    // Build dependency graph
    const graph = this.parallelEngine.buildDependencyGraph(workflow.stages);
    console.log(`[${reqNumber}] Built dependency graph with ${graph.groups.length} groups`);

    const groupResults = new Map<number, ParallelExecutionResult>();
    const allStageResults = new Map<number, any>();

    try {
      // Execute groups in dependency order
      for (const groupId of graph.executionOrder) {
        const group = graph.groups.find((g) => g.id === groupId);
        if (!group) continue;

        // Check if conditional group should be skipped
        if (this.parallelEngine.shouldSkipConditionalGroup(group, allStageResults)) {
          console.log(`[${reqNumber}] Skipping conditional group: ${group.name}`);
          continue;
        }

        // Execute group (parallel or sequential)
        const groupResult = await this.parallelEngine.executeParallelGroup(
          group,
          reqNumber,
          (stageIndex) => this.getContextForAgent(reqNumber, stageIndex),
          (subject, timeout) => this.waitForDeliverable(subject, timeout)
        );

        groupResults.set(groupId, groupResult);

        // Merge results into allStageResults
        const resultEntries = Array.from(groupResult.results.entries());
        for (const [stageIndex, deliverable] of resultEntries) {
          allStageResults.set(stageIndex, deliverable);
          workflow.stageDeliverables.set(stageIndex, {
            status: deliverable.status,
            summary: deliverable.summary,
            timestamp: deliverable.timestamp || new Date().toISOString(),
          });
        }

        // Handle failures in this group
        if (!groupResult.success) {
          console.error(`[${reqNumber}] ❌ Group ${group.name} failed with ${groupResult.failures.size} failures`);

          // Publish all failures
          const failureEntries = Array.from(groupResult.failures.entries());
          for (const [stageIndex, error] of failureEntries) {
            await this.publishEvent('stage.failed', {
              reqNumber,
              stage: workflow.stages[stageIndex].name,
              error: error.message,
              action: 'BLOCKED',
            });
          }

          workflow.status = 'blocked';
          return;
        }

        // Special handling for Implementation group (Roy + Jen)
        if (group.name === 'Implementation') {
          console.log(`[${reqNumber}] 🔍 MANDATORY BUILD VERIFICATION after parallel implementation`);

          const buildResult = await this.parallelEngine.verifyParallelBuilds(
            groupResult.results,
            (agent) => this.verifyBuildPasses(agent)
          );

          if (!buildResult.success) {
            console.error(`[${reqNumber}] ❌ PARALLEL BUILD VERIFICATION FAILED`);

            for (const failure of buildResult.failures) {
              console.error(`[${reqNumber}] ${failure.agent} build failed:\n${failure.errors}`);

              await this.publishEvent('build.failed', {
                reqNumber,
                agent: failure.agent,
                errors: failure.errors,
                timestamp: new Date().toISOString(),
              });
            }

            workflow.status = 'blocked';
            return;
          }

          console.log(`[${reqNumber}] ✅ All parallel builds PASSED`);
        }

        // Special handling for QA group (Billy + Liz)
        if (group.name === 'Quality Assurance') {
          // Check for test failures
          const qaResultEntries = Array.from(groupResult.results.entries());
          for (const [stageIndex, deliverable] of qaResultEntries) {
            if (deliverable.testResult === 'FAIL') {
              const stage = workflow.stages[stageIndex];
              console.error(`[${reqNumber}] ${stage.name} tests FAILED - blocking workflow`);

              await this.handleStageBlocked(reqNumber, stageIndex, deliverable);
              workflow.status = 'blocked';
              return;
            }
          }
        }

        // Publish group completed event
        await this.publishEvent('group.completed', {
          reqNumber,
          group: group.name,
          duration: groupResult.duration,
          stagesCompleted: groupResult.results.size,
        });
      }

      // All groups completed successfully
      await this.completeWorkflow(reqNumber);

      // Calculate and log time savings
      const savings = this.parallelEngine.calculateTimeSavings(graph, groupResults);
      console.log(
        `[${reqNumber}] ⚡ Parallelization saved ${Math.round(savings.timeSaved / 1000 / 60)} minutes ` +
        `(${savings.percentageSaved.toFixed(1)}% faster)`
      );

      await this.publishEvent('workflow.performance', {
        reqNumber,
        sequentialTime: savings.sequentialTime,
        parallelTime: savings.parallelTime,
        timeSaved: savings.timeSaved,
        percentageSaved: savings.percentageSaved,
      });

    } catch (error: any) {
      console.error(`[${reqNumber}] ❌ Parallel workflow failed:`, error);
      workflow.status = 'failed';

      await this.publishEvent('workflow.failed', {
        reqNumber,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Wait for deliverable to be published to NATS by host listener
   * ENHANCED: Includes grace period and automatic manual review triggering on timeout
   */
  private async waitForDeliverable(subject: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const gracePeriodMs = 300000; // 5 minute grace period before hard timeout

      const timeout = setTimeout(async () => {
        const elapsed = Date.now() - startTime;
        console.warn(`[Orchestrator] ⚠️ Stage timeout on ${subject} after ${elapsed}ms (${Math.round(elapsed/1000/60)}min)`);

        // Trigger manual review notification
        await this.notifyTimeoutForManualReview(subject, elapsed);

        reject(new Error(`Timeout waiting for deliverable on ${subject} after ${elapsed}ms - manual review triggered`));
      }, timeoutMs + gracePeriodMs); // Add grace period to configured timeout

      // Subscribe to the deliverable subject
      const sub = this.nc.subscribe(subject, { max: 1 });

      (async () => {
        for await (const msg of sub) {
          clearTimeout(timeout);
          const elapsed = Date.now() - startTime;

          if (elapsed > timeoutMs) {
            console.warn(`[Orchestrator] ⚠️ Deliverable received after timeout (${Math.round(elapsed/1000/60)}min) but within grace period`);
          }

          try {
            const deliverable = JSON.parse(msg.string());

            // Gap Fix #18: Validate deliverable schema
            if (!this.validateDeliverable(deliverable)) {
              console.error(`[Orchestrator] Invalid deliverable schema from ${subject}:`, deliverable);
              reject(new Error(`Invalid deliverable schema - missing required fields`));
              return;
            }

            resolve(deliverable);
          } catch (error) {
            reject(new Error(`Failed to parse deliverable from ${subject}: ${error}`));
          }
        }
      })();
    });
  }

  /**
   * Notify system when a stage times out - triggers manual review REQ
   */
  private async notifyTimeoutForManualReview(subject: string, elapsedMs: number): Promise<void> {
    try {
      const timeoutNotification = {
        eventType: 'stage.timeout',
        subject,
        elapsedMs,
        elapsedMinutes: Math.round(elapsedMs / 1000 / 60),
        timestamp: new Date().toISOString(),
        actionRequired: 'MANUAL_REVIEW',
        severity: 'P0',
      };

      // Publish to timeout monitoring stream
      this.nc.publish('agog.orchestrator.timeout', JSON.stringify(timeoutNotification));

      console.log(`[Orchestrator] 🚨 Timeout notification published for manual review`);
    } catch (error) {
      console.error(`[Orchestrator] Failed to publish timeout notification:`, error);
    }
  }

  /**
   * Gap Fix #18: Validate deliverable has required fields
   */
  private validateDeliverable(deliverable: any): boolean {
    // Required fields for all deliverables
    if (!deliverable.agent) {
      console.error('[Orchestrator] Deliverable missing agent field');
      return false;
    }
    if (!deliverable.status) {
      console.error('[Orchestrator] Deliverable missing status field');
      return false;
    }
    if (!deliverable.summary && deliverable.status !== 'BLOCKED') {
      console.error('[Orchestrator] Deliverable missing summary field');
      return false;
    }

    // Validate status values
    const validStatuses = ['COMPLETE', 'BLOCKED', 'FAILED', 'ERROR'];
    if (!validStatuses.includes(deliverable.status)) {
      console.error(`[Orchestrator] Invalid status: ${deliverable.status}`);
      return false;
    }

    return true;
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
    const context: any = {
      reqNumber,
      title: workflow.title,
      assignedTo: workflow.assignedTo,
      previousStages,
    };

    // Include embedding-based strategic context if available
    // This provides agents with relevant past learnings and patterns
    if (workflow.strategicContext) {
      context.strategicContext = {
        similarWorkflows: workflow.strategicContext.similarWorkflows || [],
        technicalPatterns: workflow.strategicContext.technicalPatterns || [],
        patterns: workflow.strategicContext.patterns || [],
      };
    }

    return context;
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
      'billy': 'qa-backend',
      'liz': 'qa-frontend',
      'todd': 'qa-performance',
      'vic': 'qa-security',
      'priya': 'statistics',
      'berry': 'devops',
      'tim': 'documentation',
    };
    return streamMap[agent] || agent;
  }

  /**
   * Check if a conditional stage should be skipped
   */
  private shouldSkipConditionalStage(workflow: FeatureWorkflow, stage: WorkflowStage): boolean {
    if (!stage.conditional) return false; // Not conditional, don't skip

    // Check all previous deliverables for the flag
    const deliverableEntries = Array.from(workflow.stageDeliverables.entries());
    for (const [, deliverable] of deliverableEntries) {
      if (deliverable[stage.conditional] === true) {
        return false; // Flag is set, DON'T skip
      }
    }

    // Flag not found in any deliverable, skip this stage
    console.log(`[${workflow.reqNumber}] Skipping ${stage.name} - no ${stage.conditional} flag set`);
    return true;
  }

  private async handleStageSuccess(reqNumber: string, stageIndex: number, deliverable?: any): Promise<void> {
    const workflow = this.workflows.get(reqNumber);
    if (!workflow) return;

    const stage = workflow.stages[stageIndex];

    // MANDATORY BUILD VERIFICATION: After Roy (backend) or Jen (frontend) completes
    // This is NOT optional. If build breaks, route back to the agent who broke it.
    if (stage.agent === 'roy' || stage.agent === 'jen') {
      console.log(`[${reqNumber}] 🔍 MANDATORY BUILD VERIFICATION after ${stage.name}...`);

      const buildResult = await this.verifyBuildPasses(stage.agent);

      if (!buildResult.success) {
        console.error(`[${reqNumber}] ❌ BUILD FAILED after ${stage.name}`);
        console.error(`[${reqNumber}] Errors:\n${buildResult.errors}`);

        // Publish build failure event
        await this.publishEvent('build.failed', {
          reqNumber,
          stage: stage.name,
          agent: stage.agent,
          errors: buildResult.errors,
          timestamp: new Date().toISOString(),
        });

        // Block workflow and route back to agent
        await this.handleStageBlocked(reqNumber, stageIndex, {
          status: 'BLOCKED',
          summary: `BUILD FAILED after ${stage.name}. Agent ${stage.agent} must fix these errors:\n${buildResult.errors}`,
          blockers: [{ type: 'BUILD_FAILURE', details: buildResult.errors }],
        });

        return; // DO NOT proceed to next stage
      }

      console.log(`[${reqNumber}] ✅ BUILD PASSED after ${stage.name}`);
    }

    // Gap Fix #10: Check Billy test failures BEFORE marking success
    if (stage.agent === 'billy' && deliverable?.testResult === 'FAIL') {
      // Initialize billy failure count if not exists
      if (!(workflow as any).billyFailureCount) {
        (workflow as any).billyFailureCount = 0;
      }

      (workflow as any).billyFailureCount++;
      const failureCount = (workflow as any).billyFailureCount;

      console.error(`[${reqNumber}] Billy test FAILED (${failureCount}/3 failures)`);

      if (failureCount >= 3) {
        // Too many failures - escalate instead of blocking
        console.error(`[${reqNumber}] Billy exceeded max failures (3) - ESCALATING`);

        // Publish escalation event
        await this.js.publish('agog.escalations.' + reqNumber, JSON.stringify({
          reqId: reqNumber,
          reason: 'BILLY_MAX_FAILURES',
          context: {
            failureCount,
            testResult: deliverable.testResult,
            failures: deliverable.failures || [],
            reason: 'Excessive test failures (3+), manual intervention required'
          },
          priority: 'HIGH',
          timestamp: new Date().toISOString()
        }));

        // Mark workflow as failed to stop further execution
        workflow.status = 'failed';
        return;
      } else {
        // Block workflow for bug fixes (will create sub-requirements via Strategic Orchestrator)
        await this.handleStageBlocked(reqNumber, stageIndex, deliverable);
        return;
      }
    }

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

  /**
   * MANDATORY BUILD VERIFICATION
   * Runs npm build for backend or frontend and returns pass/fail with errors.
   * This is called AFTER Roy or Jen complete their work - NO EXCEPTIONS.
   * If build fails, agent must fix before workflow continues.
   */
  private async verifyBuildPasses(agent: 'roy' | 'jen'): Promise<{ success: boolean; errors: string }> {
    // Determine project directory based on agent
    const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../../..');
    const projectDir = agent === 'roy'
      ? path.join(projectRoot, 'Implementation', 'print-industry-erp', 'backend')
      : path.join(projectRoot, 'Implementation', 'print-industry-erp', 'frontend');

    const projectName = agent === 'roy' ? 'backend' : 'frontend';

    console.log(`[Build Verification] Running npm run build for ${projectName}...`);
    console.log(`[Build Verification] Directory: ${projectDir}`);

    try {
      // Run npm run build with a timeout of 5 minutes
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: projectDir,
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      });

      // Check for TypeScript errors in output (even with exit code 0, tsc might report errors)
      const output = stdout + stderr;
      if (output.includes('error TS') || output.includes('Error:') || output.includes('FAILED')) {
        console.log(`[Build Verification] ❌ ${projectName} build has errors in output`);
        return {
          success: false,
          errors: this.extractBuildErrors(output),
        };
      }

      console.log(`[Build Verification] ✅ ${projectName} build PASSED`);
      return { success: true, errors: '' };

    } catch (error: any) {
      // Build command failed (non-zero exit code)
      const errorOutput = error.stdout + '\n' + error.stderr;
      console.log(`[Build Verification] ❌ ${projectName} build FAILED`);
      console.log(`[Build Verification] Exit code: ${error.code}`);

      return {
        success: false,
        errors: this.extractBuildErrors(errorOutput),
      };
    }
  }

  /**
   * Extract meaningful build errors from npm build output
   * Filters out noise and returns actionable error messages
   */
  private extractBuildErrors(output: string): string {
    const lines = output.split('\n');
    const errorLines: string[] = [];

    for (const line of lines) {
      // TypeScript errors
      if (line.includes('error TS') || line.includes('Error:')) {
        errorLines.push(line.trim());
      }
      // File path with error location (e.g., src/file.ts(10,5))
      else if (line.match(/\.tsx?\(\d+,\d+\)/)) {
        errorLines.push(line.trim());
      }
      // npm ERR! lines
      else if (line.startsWith('npm ERR!')) {
        errorLines.push(line.trim());
      }
      // ESLint errors
      else if (line.includes('error') && line.includes('eslint')) {
        errorLines.push(line.trim());
      }
    }

    // Limit to first 50 errors to avoid overwhelming output
    const limitedErrors = errorLines.slice(0, 50);
    if (errorLines.length > 50) {
      limitedErrors.push(`... and ${errorLines.length - 50} more errors`);
    }

    return limitedErrors.join('\n') || 'Build failed with unknown error. Check full output.';
  }

  /**
   * Run backend tests (called after build verification passes)
   * Optional: Only runs if test files exist for changed areas
   */
  async verifyTestsPass(): Promise<{ success: boolean; errors: string }> {
    const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../../..');
    const backendDir = path.join(projectRoot, 'Implementation', 'print-industry-erp', 'backend');

    console.log(`[Test Verification] Running npm run test for backend...`);

    try {
      const { stdout, stderr } = await execAsync('npm run test -- --passWithNoTests', {
        cwd: backendDir,
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024,
      });

      const output = stdout + stderr;
      if (output.includes('FAIL') || output.includes('failed')) {
        return {
          success: false,
          errors: output,
        };
      }

      console.log(`[Test Verification] ✅ Backend tests PASSED`);
      return { success: true, errors: '' };

    } catch (error: any) {
      return {
        success: false,
        errors: error.stdout + '\n' + error.stderr,
      };
    }
  }
}
