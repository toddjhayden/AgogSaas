import { NatsConnection, JetStreamClient } from 'nats';

/**
 * Parallel Execution Engine for Agent Workflows
 * REQ-1767924916115-9l233
 *
 * Enables concurrent execution of independent workflow stages to reduce total workflow time.
 * Complies with WORKFLOW_RULES.md - fails fast on any dependency failure.
 */

export interface WorkflowStage {
  name: string;
  agent: string;
  natsSubject: string;
  timeout: number;
  retries: number;
  onSuccess: 'next' | 'complete' | 'decision';
  onFailure: 'retry' | 'block' | 'notify';
  onConditional?: 'block' | 'notify';
  conditional?: 'needs_todd' | 'needs_vic';
}

export interface StageGroup {
  id: number;
  name: string;
  stages: WorkflowStage[];
  stageIndices: number[]; // Original indices in workflow
  dependsOn: number[];    // Group IDs that must complete first
  parallel: boolean;      // If true, all stages run concurrently
  conditional: boolean;   // If true, may be skipped based on flags
}

export interface ParallelExecutionResult {
  success: boolean;
  results: Map<number, any>; // stageIndex -> deliverable
  failures: Map<number, Error>; // stageIndex -> error
  duration: number;
}

export interface DependencyGraph {
  groups: StageGroup[];
  executionOrder: number[]; // Order of group IDs to execute
}

export class ParallelExecutionEngine {
  private nc: NatsConnection;
  private js: JetStreamClient;
  private readonly MAX_PARALLEL_STAGES = 4;

  constructor(nc: NatsConnection, js: JetStreamClient) {
    this.nc = nc;
    this.js = js;
  }

  /**
   * Build dependency graph from workflow stages
   * Identifies which stages can run in parallel
   */
  buildDependencyGraph(stages: WorkflowStage[]): DependencyGraph {
    const groups: StageGroup[] = [];
    let groupId = 0;

    // Group 0: Research (sequential)
    groups.push({
      id: groupId++,
      name: 'Research',
      stages: [stages[0]], // Cynthia
      stageIndices: [0],
      dependsOn: [],
      parallel: false,
      conditional: false,
    });

    // Group 1: Critique (sequential, depends on Research)
    groups.push({
      id: groupId++,
      name: 'Critique',
      stages: [stages[1]], // Sylvia
      stageIndices: [1],
      dependsOn: [0],
      parallel: false,
      conditional: false,
    });

    // Group 2: Backend + Frontend (PARALLEL, depends on Critique)
    groups.push({
      id: groupId++,
      name: 'Implementation',
      stages: [stages[2], stages[3]], // Roy, Jen
      stageIndices: [2, 3],
      dependsOn: [1],
      parallel: true,
      conditional: false,
    });

    // Group 3: Backend QA + Frontend QA (PARALLEL, depends on Implementation)
    groups.push({
      id: groupId++,
      name: 'Quality Assurance',
      stages: [stages[4], stages[5]], // Billy, Liz
      stageIndices: [4, 5],
      dependsOn: [2],
      parallel: true,
      conditional: false,
    });

    // Group 4: Performance + Security (PARALLEL, CONDITIONAL, depends on QA)
    const conditionalStages = [];
    const conditionalIndices = [];
    if (stages[6]) { // Todd (Performance)
      conditionalStages.push(stages[6]);
      conditionalIndices.push(6);
    }
    if (stages[7]) { // Vic (Security)
      conditionalStages.push(stages[7]);
      conditionalIndices.push(7);
    }
    if (conditionalStages.length > 0) {
      groups.push({
        id: groupId++,
        name: 'Conditional Testing',
        stages: conditionalStages,
        stageIndices: conditionalIndices,
        dependsOn: [3],
        parallel: true,
        conditional: true,
      });
    }

    // Group 5: Statistics (sequential, depends on previous groups)
    const statStageIndex = conditionalStages.length > 0 ? 8 : 6;
    if (stages[statStageIndex]) {
      groups.push({
        id: groupId++,
        name: 'Statistics',
        stages: [stages[statStageIndex]], // Priya
        stageIndices: [statStageIndex],
        dependsOn: conditionalStages.length > 0 ? [4] : [3],
        parallel: false,
        conditional: false,
      });
    }

    // Group 6: DevOps (sequential, depends on Statistics)
    const devopsStageIndex = statStageIndex + 1;
    if (stages[devopsStageIndex]) {
      groups.push({
        id: groupId++,
        name: 'DevOps',
        stages: [stages[devopsStageIndex]], // Berry
        stageIndices: [devopsStageIndex],
        dependsOn: [groupId - 2], // Previous group
        parallel: false,
        conditional: false,
      });
    }

    // Group 7: Documentation (sequential, depends on DevOps)
    const docStageIndex = devopsStageIndex + 1;
    if (stages[docStageIndex]) {
      groups.push({
        id: groupId++,
        name: 'Documentation',
        stages: [stages[docStageIndex]], // Tim
        stageIndices: [docStageIndex],
        dependsOn: [groupId - 2], // Previous group
        parallel: false,
        conditional: false,
      });
    }

    // Build execution order (topological sort)
    const executionOrder = this.topologicalSort(groups);

    return { groups, executionOrder };
  }

  /**
   * Topological sort of groups based on dependencies
   * Ensures groups are executed in correct order
   */
  private topologicalSort(groups: StageGroup[]): number[] {
    const order: number[] = [];
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const visit = (groupId: number) => {
      if (visited.has(groupId)) return;
      if (visiting.has(groupId)) {
        throw new Error(`Circular dependency detected at group ${groupId}`);
      }

      visiting.add(groupId);

      const group = groups.find((g) => g.id === groupId);
      if (!group) {
        throw new Error(`Group ${groupId} not found`);
      }

      // Visit dependencies first
      for (const depId of group.dependsOn) {
        visit(depId);
      }

      visiting.delete(groupId);
      visited.add(groupId);
      order.push(groupId);
    };

    // Visit all groups
    for (const group of groups) {
      visit(group.id);
    }

    return order;
  }

  /**
   * Execute a group of stages in parallel
   * WORKFLOW RULE #1: Fails fast if any dependency (NATS, SDLC) is unavailable
   */
  async executeParallelGroup(
    group: StageGroup,
    reqNumber: string,
    contextGetter: (stageIndex: number) => any,
    waitForDeliverable: (subject: string, timeout: number) => Promise<any>
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const results = new Map<number, any>();
    const failures = new Map<number, Error>();

    console.log(`[${reqNumber}] Executing ${group.name} (${group.stages.length} stages in ${group.parallel ? 'PARALLEL' : 'SEQUENCE'})`);

    if (!group.parallel) {
      // Sequential execution (backward compatibility)
      for (let i = 0; i < group.stages.length; i++) {
        const stage = group.stages[i];
        const stageIndex = group.stageIndices[i];

        try {
          const result = await this.executeStage(
            reqNumber,
            stage,
            stageIndex,
            contextGetter(stageIndex),
            waitForDeliverable
          );
          results.set(stageIndex, result);
        } catch (error: any) {
          failures.set(stageIndex, error);
          // Sequential failure blocks immediately
          break;
        }
      }
    } else {
      // PARALLEL EXECUTION - core feature
      const stagePromises = group.stages.map(async (stage, i) => {
        const stageIndex = group.stageIndices[i];

        try {
          console.log(`[${reqNumber}] Starting ${stage.name} (${stage.agent}) in parallel group`);

          const result = await this.executeStage(
            reqNumber,
            stage,
            stageIndex,
            contextGetter(stageIndex),
            waitForDeliverable
          );

          results.set(stageIndex, result);
          console.log(`[${reqNumber}] ✅ ${stage.name} completed in parallel group`);

          return { stageIndex, result, error: null };
        } catch (error: any) {
          failures.set(stageIndex, error);
          console.error(`[${reqNumber}] ❌ ${stage.name} failed in parallel group:`, error.message);

          return { stageIndex, result: null, error };
        }
      });

      // Wait for all parallel stages to complete
      await Promise.all(stagePromises);
    }

    const duration = Date.now() - startTime;
    const success = failures.size === 0;

    console.log(
      `[${reqNumber}] ${group.name} completed in ${Math.round(duration / 1000)}s - ` +
      `${results.size} succeeded, ${failures.size} failed`
    );

    return {
      success,
      results,
      failures,
      duration,
    };
  }

  /**
   * Execute a single stage
   * Publishes stage.started event and waits for deliverable
   */
  private async executeStage(
    reqNumber: string,
    stage: WorkflowStage,
    stageIndex: number,
    context: any,
    waitForDeliverable: (subject: string, timeout: number) => Promise<any>
  ): Promise<any> {
    // Publish stage.started event
    await this.js.publish(
      `agog.orchestration.events.stage.started`,
      Buffer.from(JSON.stringify({
        eventType: 'stage.started',
        reqNumber,
        stage: stage.name,
        agentId: stage.agent,
        contextData: context,
        timeout: stage.timeout,
        timestamp: new Date().toISOString(),
      }))
    );

    // Wait for deliverable
    const deliverableSubject = this.getDeliverableSubject(stage.agent, reqNumber);
    const deliverable = await waitForDeliverable(deliverableSubject, stage.timeout);

    // Validate deliverable status
    if (deliverable.status !== 'COMPLETE') {
      throw new Error(
        `Stage ${stage.name} returned status ${deliverable.status}: ${deliverable.summary || 'Unknown error'}`
      );
    }

    return deliverable;
  }

  /**
   * Get NATS deliverable subject for agent
   */
  private getDeliverableSubject(agent: string, reqNumber: string): string {
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

    const stream = streamMap[agent] || agent;
    return `agog.deliverables.${agent}.${stream}.${reqNumber}`;
  }

  /**
   * Check if conditional stage group should be skipped
   * Based on flags set by previous stages (Billy/Liz)
   */
  shouldSkipConditionalGroup(
    group: StageGroup,
    previousResults: Map<number, any>
  ): boolean {
    if (!group.conditional) return false;

    // Check if any stage in this group has its conditional flag set
    for (const stage of group.stages) {
      if (!stage.conditional) continue;

      // Check all previous results for the flag
      const resultEntries = Array.from(previousResults.entries());
      for (const [, deliverable] of resultEntries) {
        if (deliverable[stage.conditional] === true) {
          return false; // Flag is set, DON'T skip
        }
      }
    }

    // No flags set, skip this group
    console.log(`Skipping conditional group: ${group.name} - no flags set`);
    return true;
  }

  /**
   * Verify builds pass for parallel implementation group (Roy + Jen)
   * WORKFLOW RULE #2: Never downgrade errors - build failures are blocking
   */
  async verifyParallelBuilds(
    results: Map<number, any>,
    verifyBuildFn: (agent: 'roy' | 'jen') => Promise<{ success: boolean; errors: string }>
  ): Promise<{ success: boolean; failures: Array<{ agent: string; errors: string }> }> {
    const buildPromises: Array<Promise<{ success: boolean; errors: string }>> = [];
    const failures: Array<{ agent: string; errors: string }> = [];

    // Check if Roy's stage completed
    const royStageIndex = 2; // Backend stage
    if (results.has(royStageIndex)) {
      buildPromises.push(
        verifyBuildFn('roy').then((result) => {
          if (!result.success) {
            failures.push({ agent: 'roy', errors: result.errors });
          }
          return result;
        })
      );
    }

    // Check if Jen's stage completed
    const jenStageIndex = 3; // Frontend stage
    if (results.has(jenStageIndex)) {
      buildPromises.push(
        verifyBuildFn('jen').then((result) => {
          if (!result.success) {
            failures.push({ agent: 'jen', errors: result.errors });
          }
          return result;
        })
      );
    }

    // Run both builds in parallel
    await Promise.all(buildPromises);

    return {
      success: failures.length === 0,
      failures,
    };
  }

  /**
   * Get time savings from parallelization
   * Used for metrics and reporting
   */
  calculateTimeSavings(graph: DependencyGraph, results: Map<number, ParallelExecutionResult>): {
    sequentialTime: number;
    parallelTime: number;
    timeSaved: number;
    percentageSaved: number;
  } {
    let sequentialTime = 0;
    let parallelTime = 0;

    for (const groupId of graph.executionOrder) {
      const group = graph.groups.find((g) => g.id === groupId);
      if (!group) continue;

      const groupResult = results.get(groupId);
      if (!groupResult) continue;

      if (group.parallel) {
        // Parallel execution: max duration of any stage in group
        parallelTime += groupResult.duration;

        // Sequential would be sum of all durations
        // Estimate each stage duration as groupResult.duration / stages.length
        sequentialTime += (groupResult.duration / group.stages.length) * group.stages.length;
      } else {
        // Sequential execution
        const duration = groupResult.duration;
        parallelTime += duration;
        sequentialTime += duration;
      }
    }

    const timeSaved = sequentialTime - parallelTime;
    const percentageSaved = sequentialTime > 0 ? (timeSaved / sequentialTime) * 100 : 0;

    return {
      sequentialTime,
      parallelTime,
      timeSaved,
      percentageSaved,
    };
  }
}
