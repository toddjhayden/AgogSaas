import { ParallelExecutionEngine, WorkflowStage, StageGroup } from '../parallel-execution.engine';
import { NatsConnection, JetStreamClient } from 'nats';

/**
 * Unit tests for Parallel Execution Engine
 * REQ-1767924916115-9l233
 */

describe('ParallelExecutionEngine', () => {
  let mockNc: jest.Mocked<NatsConnection>;
  let mockJs: jest.Mocked<JetStreamClient>;
  let engine: ParallelExecutionEngine;

  const createMockStages = (): WorkflowStage[] => [
    {
      name: 'Research',
      agent: 'cynthia',
      natsSubject: 'agog.features.research.{reqNumber}',
      timeout: 2700000,
      retries: 0,
      onSuccess: 'next',
      onFailure: 'block',
    },
    {
      name: 'Critique',
      agent: 'sylvia',
      natsSubject: 'agog.features.critique.{reqNumber}',
      timeout: 1800000,
      retries: 0,
      onSuccess: 'decision',
      onFailure: 'block',
    },
    {
      name: 'Backend Implementation',
      agent: 'roy',
      natsSubject: 'agog.features.backend.{reqNumber}',
      timeout: 3600000,
      retries: 1,
      onSuccess: 'next',
      onFailure: 'notify',
    },
    {
      name: 'Frontend Implementation',
      agent: 'jen',
      natsSubject: 'agog.features.frontend.{reqNumber}',
      timeout: 3600000,
      retries: 1,
      onSuccess: 'next',
      onFailure: 'notify',
    },
    {
      name: 'Backend QA',
      agent: 'billy',
      natsSubject: 'agog.features.qa-backend.{reqNumber}',
      timeout: 2700000,
      retries: 0,
      onSuccess: 'next',
      onFailure: 'block',
    },
    {
      name: 'Frontend QA',
      agent: 'liz',
      natsSubject: 'agog.features.qa-frontend.{reqNumber}',
      timeout: 2700000,
      retries: 0,
      onSuccess: 'next',
      onFailure: 'block',
    },
    {
      name: 'Performance Testing',
      agent: 'todd',
      natsSubject: 'agog.features.qa-performance.{reqNumber}',
      timeout: 3600000,
      retries: 0,
      onSuccess: 'next',
      onFailure: 'block',
      conditional: 'needs_todd',
    },
    {
      name: 'Security Testing',
      agent: 'vic',
      natsSubject: 'agog.features.qa-security.{reqNumber}',
      timeout: 3600000,
      retries: 0,
      onSuccess: 'next',
      onFailure: 'block',
      conditional: 'needs_vic',
    },
    {
      name: 'Statistics',
      agent: 'priya',
      natsSubject: 'agog.features.statistics.{reqNumber}',
      timeout: 5400000,
      retries: 0,
      onSuccess: 'next',
      onFailure: 'notify',
    },
    {
      name: 'DevOps Deployment',
      agent: 'berry',
      natsSubject: 'agog.features.devops.{reqNumber}',
      timeout: 900000,
      retries: 0,
      onSuccess: 'next',
      onFailure: 'block',
    },
    {
      name: 'Documentation Update',
      agent: 'tim',
      natsSubject: 'agog.features.documentation.{reqNumber}',
      timeout: 1800000,
      retries: 0,
      onSuccess: 'complete',
      onFailure: 'notify',
    },
  ];

  beforeEach(() => {
    mockNc = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    } as any;

    mockJs = {
      publish: jest.fn(),
    } as any;

    engine = new ParallelExecutionEngine(mockNc, mockJs);
  });

  describe('buildDependencyGraph', () => {
    it('should create correct number of groups', () => {
      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);

      expect(graph.groups.length).toBeGreaterThan(0);
      expect(graph.executionOrder.length).toBe(graph.groups.length);
    });

    it('should mark Implementation group as parallel', () => {
      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);

      const implGroup = graph.groups.find((g) => g.name === 'Implementation');
      expect(implGroup).toBeDefined();
      expect(implGroup!.parallel).toBe(true);
      expect(implGroup!.stages.length).toBe(2); // Roy + Jen
    });

    it('should mark QA group as parallel', () => {
      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);

      const qaGroup = graph.groups.find((g) => g.name === 'Quality Assurance');
      expect(qaGroup).toBeDefined();
      expect(qaGroup!.parallel).toBe(true);
      expect(qaGroup!.stages.length).toBe(2); // Billy + Liz
    });

    it('should mark conditional group as conditional', () => {
      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);

      const conditionalGroup = graph.groups.find((g) => g.name === 'Conditional Testing');
      expect(conditionalGroup).toBeDefined();
      expect(conditionalGroup!.conditional).toBe(true);
      expect(conditionalGroup!.parallel).toBe(true);
    });

    it('should create correct dependencies', () => {
      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);

      // Research has no dependencies
      const researchGroup = graph.groups.find((g) => g.name === 'Research');
      expect(researchGroup!.dependsOn).toEqual([]);

      // Critique depends on Research
      const critiqueGroup = graph.groups.find((g) => g.name === 'Critique');
      expect(critiqueGroup!.dependsOn).toEqual([researchGroup!.id]);

      // Implementation depends on Critique
      const implGroup = graph.groups.find((g) => g.name === 'Implementation');
      expect(implGroup!.dependsOn).toEqual([critiqueGroup!.id]);
    });

    it('should produce valid execution order', () => {
      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);

      // Execution order should respect dependencies
      const groupMap = new Map(graph.groups.map((g) => [g.id, g]));

      for (let i = 0; i < graph.executionOrder.length; i++) {
        const groupId = graph.executionOrder[i];
        const group = groupMap.get(groupId)!;

        // All dependencies should come before this group in execution order
        for (const depId of group.dependsOn) {
          const depIndex = graph.executionOrder.indexOf(depId);
          expect(depIndex).toBeLessThan(i);
        }
      }
    });
  });

  describe('shouldSkipConditionalGroup', () => {
    it('should skip conditional group if no flags set', () => {
      const group: StageGroup = {
        id: 4,
        name: 'Conditional Testing',
        stages: [
          {
            name: 'Performance Testing',
            agent: 'todd',
            natsSubject: 'agog.features.qa-performance.{reqNumber}',
            timeout: 3600000,
            retries: 0,
            onSuccess: 'next',
            onFailure: 'block',
            conditional: 'needs_todd',
          },
        ],
        stageIndices: [6],
        dependsOn: [3],
        parallel: true,
        conditional: true,
      };

      const previousResults = new Map<number, any>([
        [4, { status: 'COMPLETE', summary: 'Billy QA passed' }],
        [5, { status: 'COMPLETE', summary: 'Liz QA passed' }],
      ]);

      const shouldSkip = engine.shouldSkipConditionalGroup(group, previousResults);
      expect(shouldSkip).toBe(true);
    });

    it('should not skip conditional group if flag is set', () => {
      const group: StageGroup = {
        id: 4,
        name: 'Conditional Testing',
        stages: [
          {
            name: 'Performance Testing',
            agent: 'todd',
            natsSubject: 'agog.features.qa-performance.{reqNumber}',
            timeout: 3600000,
            retries: 0,
            onSuccess: 'next',
            onFailure: 'block',
            conditional: 'needs_todd',
          },
        ],
        stageIndices: [6],
        dependsOn: [3],
        parallel: true,
        conditional: true,
      };

      const previousResults = new Map<number, any>([
        [4, { status: 'COMPLETE', summary: 'Billy QA passed', needs_todd: true }],
        [5, { status: 'COMPLETE', summary: 'Liz QA passed' }],
      ]);

      const shouldSkip = engine.shouldSkipConditionalGroup(group, previousResults);
      expect(shouldSkip).toBe(false);
    });

    it('should not skip non-conditional groups', () => {
      const group: StageGroup = {
        id: 2,
        name: 'Implementation',
        stages: [],
        stageIndices: [2, 3],
        dependsOn: [1],
        parallel: true,
        conditional: false,
      };

      const shouldSkip = engine.shouldSkipConditionalGroup(group, new Map());
      expect(shouldSkip).toBe(false);
    });
  });

  describe('verifyParallelBuilds', () => {
    it('should verify both builds in parallel', async () => {
      const results = new Map<number, any>([
        [2, { status: 'COMPLETE', summary: 'Roy backend complete' }],
        [3, { status: 'COMPLETE', summary: 'Jen frontend complete' }],
      ]);

      const verifyBuildFn = jest.fn().mockResolvedValue({ success: true, errors: '' });

      const buildResult = await engine.verifyParallelBuilds(results, verifyBuildFn);

      expect(buildResult.success).toBe(true);
      expect(buildResult.failures).toEqual([]);
      expect(verifyBuildFn).toHaveBeenCalledTimes(2);
      expect(verifyBuildFn).toHaveBeenCalledWith('roy');
      expect(verifyBuildFn).toHaveBeenCalledWith('jen');
    });

    it('should detect build failures', async () => {
      const results = new Map<number, any>([
        [2, { status: 'COMPLETE', summary: 'Roy backend complete' }],
        [3, { status: 'COMPLETE', summary: 'Jen frontend complete' }],
      ]);

      const verifyBuildFn = jest.fn().mockImplementation((agent) => {
        if (agent === 'roy') {
          return Promise.resolve({ success: false, errors: 'TypeScript error in backend' });
        }
        return Promise.resolve({ success: true, errors: '' });
      });

      const buildResult = await engine.verifyParallelBuilds(results, verifyBuildFn);

      expect(buildResult.success).toBe(false);
      expect(buildResult.failures.length).toBe(1);
      expect(buildResult.failures[0].agent).toBe('roy');
      expect(buildResult.failures[0].errors).toContain('TypeScript error');
    });

    it('should only verify builds that completed', async () => {
      const results = new Map<number, any>([
        [2, { status: 'COMPLETE', summary: 'Roy backend complete' }],
        // Jen not in results
      ]);

      const verifyBuildFn = jest.fn().mockResolvedValue({ success: true, errors: '' });

      const buildResult = await engine.verifyParallelBuilds(results, verifyBuildFn);

      expect(buildResult.success).toBe(true);
      expect(verifyBuildFn).toHaveBeenCalledTimes(1);
      expect(verifyBuildFn).toHaveBeenCalledWith('roy');
    });
  });

  describe('calculateTimeSavings', () => {
    it('should calculate time savings for parallel execution', () => {
      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);

      // Mock results with realistic durations
      const groupResults = new Map<number, any>();

      // Group 2: Implementation (parallel) - both took 60 min, but ran in parallel
      groupResults.set(2, {
        duration: 3600000, // 60 minutes (max of Roy/Jen)
      });

      // Group 3: QA (parallel) - both took 45 min, but ran in parallel
      groupResults.set(3, {
        duration: 2700000, // 45 minutes (max of Billy/Liz)
      });

      const savings = engine.calculateTimeSavings(graph, groupResults);

      // Sequential: 60 + 60 + 45 + 45 = 210 min
      // Parallel: 60 + 45 = 105 min
      // Savings: 105 min (50%)
      expect(savings.sequentialTime).toBeGreaterThan(savings.parallelTime);
      expect(savings.timeSaved).toBeGreaterThan(0);
      expect(savings.percentageSaved).toBeGreaterThan(0);
    });
  });

  describe('Workflow Rules Compliance', () => {
    it('should fail fast if NATS is unavailable (Rule #1)', async () => {
      const mockPublishFail = jest.fn().mockRejectedValue(new Error('NATS connection failed'));
      mockJs.publish = mockPublishFail;

      const stages = createMockStages();
      const graph = engine.buildDependencyGraph(stages);
      const group = graph.groups[0]; // Research group

      const contextGetter = jest.fn().mockReturnValue({});
      const waitForDeliverable = jest.fn().mockResolvedValue({ status: 'COMPLETE' });

      await expect(
        engine.executeParallelGroup(group, 'REQ-TEST-001', contextGetter, waitForDeliverable)
      ).rejects.toThrow('NATS connection failed');
    });

    it('should never downgrade errors (Rule #2)', async () => {
      // Build failures should throw errors, not return warnings
      const verifyBuildFn = jest.fn().mockResolvedValue({
        success: false,
        errors: 'Build failed',
      });

      const results = new Map([[2, { status: 'COMPLETE' }]]);

      const buildResult = await engine.verifyParallelBuilds(results, verifyBuildFn);

      // Should return failure status, not warning
      expect(buildResult.success).toBe(false);
      expect(buildResult.failures.length).toBeGreaterThan(0);
    });
  });
});
