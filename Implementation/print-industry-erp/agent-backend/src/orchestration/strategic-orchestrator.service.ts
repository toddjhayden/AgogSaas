import * as fs from 'fs';
import * as path from 'path';
import { connect, NatsConnection, JetStreamClient, StorageType, RetentionPolicy, StreamConfig, DiscardPolicy } from 'nats';
import { AgentSpawnerService } from './agent-spawner.service';
import { OrchestratorService } from './orchestrator.service';
import { MCPMemoryClient } from '../mcp/mcp-client.service';
import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { WorkflowPersistenceService } from './workflow-persistence.service';
import { AgentKnowledgeService } from '../knowledge/agent-knowledge.service';
import { SDLCDatabaseService, getSDLCDatabase } from '../sdlc-control/sdlc-database.service';
import { SDLCApiClient, createSDLCApiClient } from '../api/sdlc-api.client';

// Status mapping: SDLC database phases to legacy status codes
const PHASE_TO_STATUS: Record<string, string> = {
  'backlog': 'NEW',
  'research': 'NEW',
  'review': 'PENDING',
  'approved': 'PENDING',
  'in_progress': 'IN_PROGRESS',
  'blocked': 'BLOCKED',
  'qa': 'IN_PROGRESS',
  'staging': 'IN_PROGRESS',
  'done': 'COMPLETE',
  'cancelled': 'CANCELLED',
  // Unified model phases (approval workflow)
  'pending_approval': 'PENDING_APPROVAL',  // Not actionable - requires human approval
  'rejected': 'CANCELLED',
  'deferred': 'BLOCKED',
};

const STATUS_TO_PHASE: Record<string, string> = {
  'NEW': 'backlog',
  'PENDING': 'review',
  'IN_PROGRESS': 'in_progress',
  'BLOCKED': 'blocked',
  'COMPLETE': 'done',
  'CANCELLED': 'cancelled',
  'PENDING_APPROVAL': 'pending_approval',
};

interface StrategicDecision {
  agent: string;
  req_number: string;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'ESCALATE_HUMAN';
  reasoning: string;
  instructions_for_roy?: string;
  instructions_for_jen?: string;
  priority_fixes?: string[];
  deferred_items?: string[];
  business_context?: string;
}

export class StrategicOrchestratorService {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private agentSpawner!: AgentSpawnerService;
  private orchestrator!: OrchestratorService;
  private mcpClient!: MCPMemoryClient;
  private knowledge!: AgentKnowledgeService;

  // SDLC Database for owner_requests (replaces OWNER_REQUESTS.md)
  private sdlcDb!: SDLCDatabaseService;

  // SDLC API Client for cloud mode (when SDLC_API_URL is set)
  private apiClient: SDLCApiClient | null = null;
  private useCloudApi = false;

  // Track which requests have been processed
  private processedRequests: Set<string> = new Set();

  // Track running workflow monitoring
  private isRunning = false;
  // Circuit breaker for preventing runaway workflows
  private circuitBreaker = new CircuitBreaker();
  private persistence!: WorkflowPersistenceService;

  // Gap Fix #12: Concurrency limit
  private readonly MAX_CONCURRENT_WORKFLOWS = 5;

  // Active workflow directive (if any) - checked each scan cycle
  private activeDirective: {
    id: string;
    displayName: string;
    targetReqNumbers: string[];
    exclusive: boolean;
  } | null = null;

  // Sasha - Workflow Infrastructure Support
  // For workflow rule questions or infrastructure issues, contact Sasha via NATS:
  // Topic: agog.agent.requests.sasha-rules
  // Format: { requestingAgent: "orchestrator", question: "...", context: "..." }
  // Response: agog.agent.responses.sasha-rules
  private readonly SASHA_RULES_TOPIC = 'agog.agent.requests.sasha-rules';

  /**
   * Request Sasha for workflow rule guidance
   * Use this when encountering situations that may violate WORKFLOW_RULES.md
   */
  private async askSashaForGuidance(question: string, context: string): Promise<void> {
    try {
      const request = {
        requestingAgent: 'strategic-orchestrator',
        question,
        context,
        timestamp: new Date().toISOString()
      };
      await this.nc.publish(this.SASHA_RULES_TOPIC, Buffer.from(JSON.stringify(request)));
      console.log(`[StrategicOrchestrator] 📨 Asked Sasha: ${question}`);
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to ask Sasha: ${error.message}`);
    }
  }

  async initialize(): Promise<void> {
    // Connect to NATS with authentication
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';

    const connectionOptions: any = {
      servers: natsUrl,
      name: 'agogsaas-strategic-orchestrator',
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
        console.log(`[StrategicOrchestrator] Using credentials for user: ${user}`);
      }
    }

    this.nc = await connect(connectionOptions);
    this.js = this.nc.jetstream();

    console.log('[StrategicOrchestrator] Connected to NATS');

    // Initialize strategic streams
    await this.initializeStrategicStreams();

    // Initialize agent spawner
    this.agentSpawner = new AgentSpawnerService();
    await this.agentSpawner.initialize();

    // Initialize specialist orchestrator
    this.orchestrator = new OrchestratorService();
    await this.orchestrator.initialize();

    // Initialize MCP Memory Client
    this.mcpClient = new MCPMemoryClient();

    // Initialize Agent Knowledge Service (learnings, decisions, cache)
    this.knowledge = new AgentKnowledgeService();
    console.log('[StrategicOrchestrator] ✅ Agent Knowledge Service initialized');

    // Initialize SDLC connection - prefer cloud API if configured, else direct DB
    this.apiClient = createSDLCApiClient();

    if (this.apiClient) {
      // Cloud mode - use HTTP API
      const apiHealthy = await this.apiClient.healthCheck();
      if (apiHealthy) {
        this.useCloudApi = true;
        console.log(`[StrategicOrchestrator] ✅ SDLC Cloud API connected (${process.env.SDLC_API_URL})`);
      } else {
        console.error('[StrategicOrchestrator] ❌ SDLC Cloud API health check failed - falling back to direct DB');
        this.apiClient = null;
      }
    }

    if (!this.useCloudApi) {
      // Local mode - use direct database connection
      this.sdlcDb = getSDLCDatabase();
      const dbHealthy = await this.sdlcDb.healthCheck();
      if (dbHealthy) {
        console.log('[StrategicOrchestrator] ✅ SDLC Database connected (direct)');
      } else {
        console.error('[StrategicOrchestrator] ❌ SDLC Database health check failed - falling back to limited mode');
      }
    }

    // Initialize workflow persistence
    this.persistence = new WorkflowPersistenceService();
    await this.recoverWorkflows();

    console.log('[StrategicOrchestrator] ✅ Initialized successfully (with memory + knowledge + SDLC DB integration)');
  }

  /**
   * Initialize NATS streams for strategic agent communication
   */
  private async initializeStrategicStreams(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();

    // Stream 1: Strategic Decisions
    try {
      await jsm.streams.info('agog_strategic_decisions');
      console.log('[StrategicOrchestrator] Stream agog_strategic_decisions already exists');
    } catch (error) {
      console.log('[StrategicOrchestrator] Creating stream: agog_strategic_decisions');

      const decisionsConfig: Partial<StreamConfig> = {
        name: 'agog_strategic_decisions',
        subjects: ['agog.strategic.decisions.>'],
        storage: StorageType.File,
        retention: RetentionPolicy.Limits,
        max_msgs: 10000,
        max_bytes: 100 * 1024 * 1024, // 100MB
        max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days (nanoseconds)
        discard: DiscardPolicy.Old,
      };

      await jsm.streams.add(decisionsConfig);
      console.log('[StrategicOrchestrator] ✅ Stream agog_strategic_decisions created');
    }

    // Stream 2: Strategic Escalations (for human review)
    try {
      await jsm.streams.info('agog_strategic_escalations');
      console.log('[StrategicOrchestrator] Stream agog_strategic_escalations already exists');
    } catch (error) {
      console.log('[StrategicOrchestrator] Creating stream: agog_strategic_escalations');

      const escalationsConfig: Partial<StreamConfig> = {
        name: 'agog_strategic_escalations',
        subjects: ['agog.strategic.escalations.>'],
        storage: StorageType.File,
        retention: RetentionPolicy.Limits,
        max_msgs: 5000,
        max_bytes: 50 * 1024 * 1024, // 50MB
        max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days (nanoseconds)
        discard: DiscardPolicy.Old,
      };

      await jsm.streams.add(escalationsConfig);
      console.log('[StrategicOrchestrator] ✅ Stream agog_strategic_escalations created');
    }
  }


  /**
   * Recover workflows from PostgreSQL on startup
   * Gap Fix #2, #4, #8: Comprehensive workflow recovery on startup
   * REFACTORED: Now uses SDLC database instead of OWNER_REQUESTS.md
   */
  private async recoverWorkflows(): Promise<void> {
    console.log('[StrategicOrchestrator] Starting workflow recovery...');

    try {
      // 1. Recover from PostgreSQL persistence
      const persistedWorkflows = await this.persistence.recoverWorkflows();
      for (const workflow of persistedWorkflows) {
        console.log(`[StrategicOrchestrator] Recovered persisted workflow ${workflow.reqNumber} at stage ${workflow.currentStage}`);
        this.processedRequests.add(workflow.reqNumber);
      }

      // 2. Query SDLC database for IN_PROGRESS and BLOCKED requests
      const inProgressReqs = await this.sdlcDb.query<{ req_number: string; title: string }>(
        `SELECT req_number, title FROM owner_requests
         WHERE current_phase = 'in_progress'
         ORDER BY updated_at DESC`
      );

      const blockedReqs = await this.sdlcDb.query<{ req_number: string; title: string; blocked_reason: string }>(
        `SELECT req_number, title, blocked_reason FROM owner_requests
         WHERE current_phase = 'blocked' OR is_blocked = true
         ORDER BY updated_at DESC`
      );

      // 3. Recover IN_PROGRESS workflows
      console.log(`[StrategicOrchestrator] Found ${inProgressReqs.length} IN_PROGRESS workflows`);
      for (const req of inProgressReqs) {
        try {
          // Query NATS to see if workflow state exists
          const stateMsg = await this.nc.request(`agog.workflows.state.${req.req_number}`, '', { timeout: 1000 });
          const state = JSON.parse(stateMsg.string());
          console.log(`[StrategicOrchestrator] ✅ Workflow ${req.req_number} found in NATS, state: ${state.state}`);
          this.processedRequests.add(req.req_number);
        } catch (error) {
          // No state in NATS - restart workflow from beginning RIGHT NOW
          console.log(`[StrategicOrchestrator] ⚠️ Workflow ${req.req_number} not in NATS, restarting immediately...`);

          // Update status back to backlog so it gets picked up
          await this.updateRequestStatus(req.req_number, 'NEW', 'Recovery restart - no NATS state found');

          console.log(`[StrategicOrchestrator] ✅ Reset ${req.req_number} to NEW for restart`);
          // Don't add to processedRequests - let next scan pick it up as NEW
        }
      }

      // 4. Recover BLOCKED workflows and rebuild sub-requirement subscriptions
      console.log(`[StrategicOrchestrator] Found ${blockedReqs.length} BLOCKED workflows`);
      for (const req of blockedReqs) {
        try {
          // Query NATS for sub-requirement metadata
          const metadataMsg = await this.nc.request(`agog.workflows.sub-requirements.${req.req_number}`, '', { timeout: 1000 });
          const metadata = JSON.parse(metadataMsg.string());

          console.log(`[StrategicOrchestrator] Recovered ${metadata.totalCount} sub-requirements for ${req.req_number}`);
          console.log(`[StrategicOrchestrator] Progress: ${metadata.completedCount}/${metadata.totalCount} complete`);

          // Check if all sub-requirements already complete
          if (metadata.completedCount === metadata.totalCount) {
            console.log(`[StrategicOrchestrator] All sub-requirements complete, resuming ${req.req_number}`);
            await this.updateRequestStatus(req.req_number, 'IN_PROGRESS', 'Sub-requirements complete');
            // Don't add to processedRequests - let scanOwnerRequests handle resume
          } else {
            // Rebuild subscription to monitor remaining sub-requirements
            const subRequirements = metadata.subRequirements.map((subReqId: string) => ({ reqId: subReqId }));
            await this.subscribeToSubRequirementCompletions(req.req_number, subRequirements);
            this.processedRequests.add(req.req_number);
          }
        } catch (error) {
          console.error(`[StrategicOrchestrator] Failed to recover BLOCKED workflow ${req.req_number}:`, error);
          // Don't add to processedRequests - escalate on next scan if still blocked
        }
      }

      console.log(`[StrategicOrchestrator] ✅ Workflow recovery complete`);

    } catch (error: any) {
      console.error('[StrategicOrchestrator] Failed to recover workflows:', error.message);
    }
  }

  /**
   * Set up NATS responder for workflow state queries
   * This allows state queries to work even after restart by reading from database
   */
  private async setupWorkflowStateResponder(): Promise<void> {
    console.log('[StrategicOrchestrator] Setting up workflow state responder...');

    // Subscribe to wildcard for all workflow state requests
    const sub = this.nc.subscribe('agog.workflows.state.*');

    (async () => {
      for await (const msg of sub) {
        try {
          // Extract reqNumber from subject (agog.workflows.state.{reqNumber})
          const parts = msg.subject.split('.');
          const reqNumber = parts[parts.length - 1];

          // Query database for workflow state
          const workflow = await this.persistence.getWorkflow(reqNumber);

          if (workflow) {
            // Map database status to NATS state format
            const stateMap: Record<string, string> = {
              'pending': 'PENDING',
              'running': 'IN_PROGRESS',
              'blocked': 'BLOCKED',
              'complete': 'COMPLETE',
              'failed': 'FAILED',
            };

            const response = {
              reqNumber: workflow.reqNumber,
              state: stateMap[workflow.status] || 'UNKNOWN',
              currentStage: workflow.currentStage,
              assignedTo: workflow.assignedTo,
              startedAt: workflow.startedAt,
              updatedAt: workflow.updatedAt,
            };

            msg.respond(Buffer.from(JSON.stringify(response)));
          } else {
            // No workflow found - respond with empty/null
            msg.respond(Buffer.from(JSON.stringify({ reqNumber, state: null })));
          }
        } catch (error: any) {
          console.error('[StrategicOrchestrator] Error responding to state query:', error.message);
          msg.respond(Buffer.from(JSON.stringify({ error: error.message })));
        }
      }
    })().catch((error) => {
      console.error('[StrategicOrchestrator] Error in workflow state responder:', error.message);
    });

    console.log('[StrategicOrchestrator] ✅ Workflow state responder ready (queries database)');
  }

  /**
   * Start the autonomous daemon
   */
  async startDaemon(): Promise<void> {
    if (this.isRunning) {
      console.log('[StrategicOrchestrator] Daemon already running');
      return;
    }

    this.isRunning = true;
    console.log('[StrategicOrchestrator] 🤖 Starting autonomous daemon...');

    // 0. Set up workflow state responder (so state queries work after restart)
    await this.setupWorkflowStateResponder();

    // 0. Monitor approved recommendations every 30 seconds
    const recommendationsInterval = setInterval(() => {
      if (this.isRunning) {
        this.scanApprovedRecommendations().catch((error) => {
          console.error('[StrategicOrchestrator] Error scanning recommendations:', error);
        });
      }
    }, 30000); // Every 30 seconds

    // 1. Monitor SDLC database (owner_requests table) every 60 seconds
    const ownerRequestsInterval = setInterval(() => {
      if (this.isRunning) {
        this.scanOwnerRequests().catch((error) => {
          console.error('[StrategicOrchestrator] Error scanning owner_requests:', error);
        });
      }
    }, 60000); // Every 60 seconds

    // 2. Monitor IN_PROGRESS workflows and spawn next agents
    const workflowProgressInterval = setInterval(() => {
      if (this.isRunning) {
        this.progressInProgressWorkflows().catch((error) => {
          console.error('[StrategicOrchestrator] Error progressing workflows:', error);
        });
      }
    }, 30000); // Every 30 seconds - check for stage completions

    // Gap Fix #5: Heartbeat monitoring daemon (every 2 minutes)
    const heartbeatInterval = setInterval(() => {
      if (this.isRunning) {
        this.checkWorkflowHeartbeats().catch((error) => {
          console.error('[StrategicOrchestrator] Error checking heartbeats:', error);
        });
      }
    }, 120000); // Every 2 minutes

    // Gap Fix #13: State reconciliation daemon (every 5 minutes)
    const reconciliationInterval = setInterval(() => {
      if (this.isRunning) {
        this.reconcileWorkflowStates().catch((error) => {
          console.error('[StrategicOrchestrator] Error reconciling states:', error);
        });
      }
    }, 300000); // Every 5 minutes

    // 3. Subscribe to blocked workflow events
    this.subscribeToBlockedWorkflows().catch((error) => {
      console.error('[StrategicOrchestrator] Error in blocked workflow subscription:', error);
    });

    // 3b. Subscribe to stage completion events for stage tracking
    this.subscribeToStageCompletions().catch((error) => {
      console.error('[StrategicOrchestrator] Error in stage completion subscription:', error);
    });

    // 4. Subscribe to workflow completion events for memory storage
    this.subscribeToWorkflowCompletions().catch((error) => {
      console.error('[StrategicOrchestrator] Error in workflow completion subscription:', error);
    });

    // 5. Subscribe to new requirements from NATS (from Sam audits, sub-requirement decomposition, etc.)
    this.subscribeToNewRequirements().catch((error) => {
      console.error('[StrategicOrchestrator] Error in requirements subscription:', error);
    });

    // Gap Fix #9: Subscribe to agent error events
    this.subscribeToAgentErrors().catch((error) => {
      console.error('[StrategicOrchestrator] Error in agent error subscription:', error);
    });

    // Subscribe to deliverables for caching
    this.subscribeToDeliverablesForCaching().catch((error) => {
      console.error('[StrategicOrchestrator] Error in deliverables caching subscription:', error);
    });

    console.log('[StrategicOrchestrator] ✅ Daemon running');
    console.log('[StrategicOrchestrator] - Monitoring APPROVED recommendations every 30 seconds');
    console.log('[StrategicOrchestrator] - Monitoring SDLC database (owner_requests) every 60 seconds');
    console.log('[StrategicOrchestrator] - Monitoring IN_PROGRESS workflows every 30 seconds');
    console.log('[StrategicOrchestrator] - Checking workflow heartbeats every 2 minutes (Gap #5)');
    console.log('[StrategicOrchestrator] - Reconciling workflow states every 5 minutes (Gap #13)');
    console.log('[StrategicOrchestrator] - Subscribed to blocked workflow events');
    console.log('[StrategicOrchestrator] - Subscribed to workflow completion events (memory integration)');
    console.log('[StrategicOrchestrator] - Subscribed to new requirements (agog.requirements.new, agog.requirements.sub.new)');

    // Subscribe to manual trigger for one-off dependency analysis
    const depAnalysisSub = this.nc.subscribe('agog.orchestrator.analyze-dependencies');
    (async () => {
      for await (const msg of depAnalysisSub) {
        console.log('[StrategicOrchestrator] 📩 Received manual trigger for dependency analysis');
        try {
          const stats = await this.analyzeAllExistingDependencies();
          msg.respond(JSON.stringify({ success: true, stats }));
        } catch (error: any) {
          msg.respond(JSON.stringify({ success: false, error: error.message }));
        }
      }
    })().catch(console.error);
    console.log('[StrategicOrchestrator] - Listening for dependency analysis triggers on agog.orchestrator.analyze-dependencies');

    // Initial scan
    console.log('[StrategicOrchestrator] 🔄 Running initial scan...');
    try {
      await this.scanApprovedRecommendations();
      await this.scanOwnerRequests();
      console.log('[StrategicOrchestrator] ✅ Initial scan complete');
    } catch (error: any) {
      console.error('[StrategicOrchestrator] ❌ Initial scan failed:', error.message);
      console.error('[StrategicOrchestrator] Stack:', error.stack);
    }
  }

  /**
   * ONE-OFF: Analyze all existing requests for dependencies
   * Call this to retroactively create blocking relationships for existing REQs
   * Returns stats about what was found and created
   */
  async analyzeAllExistingDependencies(): Promise<{
    analyzed: number;
    dependenciesFound: number;
    relationshipsCreated: number;
    errors: string[];
  }> {
    console.log('[StrategicOrchestrator] 🔍 Starting one-off dependency analysis for all existing requests...');

    const stats = {
      analyzed: 0,
      dependenciesFound: 0,
      relationshipsCreated: 0,
      errors: [] as string[],
    };

    if (!this.useCloudApi || !this.apiClient) {
      stats.errors.push('Cloud API not available - cannot analyze');
      return stats;
    }

    try {
      // Get all requests from SDLC
      const response = await this.apiClient.getRequests();

      if (!response || response.length === 0) {
        console.log('[StrategicOrchestrator] No requests found to analyze');
        return stats;
      }

      console.log(`[StrategicOrchestrator] Analyzing ${response.length} requests...`);

      for (const req of response) {
        stats.analyzed++;

        try {
          // Get full request with description
          const fullReq = await this.apiClient.getRequest(req.reqNumber);
          if (!fullReq) continue;

          const fullText = `${fullReq.title} ${fullReq.description || ''}`;
          const dependencies = this.detectDependenciesFromText(fullText);

          if (dependencies.length > 0) {
            console.log(`[StrategicOrchestrator] ${req.reqNumber}: Found ${dependencies.length} dependencies: ${dependencies.join(', ')}`);
            stats.dependenciesFound += dependencies.length;

            for (const blockingReq of dependencies) {
              if (blockingReq === req.reqNumber) continue;

              // Check if blocking request exists
              const blockerExists = await this.apiClient.getRequest(blockingReq);
              if (blockerExists) {
                try {
                  await this.createBlockingRelationship(
                    req.reqNumber,
                    blockingReq,
                    `One-off analysis: detected from "${fullText.substring(0, 80)}..."`
                  );
                  stats.relationshipsCreated++;
                } catch (err: any) {
                  // May fail if relationship already exists
                  if (!err.message?.includes('already exists')) {
                    stats.errors.push(`${req.reqNumber} → ${blockingReq}: ${err.message}`);
                  }
                }
              } else {
                console.log(`[StrategicOrchestrator] ⚠️ Blocking request ${blockingReq} not found - skipping`);
              }
            }
          }
        } catch (err: any) {
          stats.errors.push(`${req.reqNumber}: ${err.message}`);
        }
      }

      console.log(`[StrategicOrchestrator] Explicit analysis complete: ${stats.dependenciesFound} explicit dependencies found`);

      // Phase 2: Semantic inference using embeddings
      console.log(`[StrategicOrchestrator] 🧠 Starting semantic dependency inference...`);

      // Build request list with descriptions for semantic analysis
      const requestsForSemantic: Array<{
        reqNumber: string;
        title: string;
        description?: string;
        currentPhase: string;
      }> = [];

      for (const req of response) {
        const fullReq = await this.apiClient!.getRequest(req.reqNumber);
        if (fullReq) {
          requestsForSemantic.push({
            reqNumber: fullReq.reqNumber,
            title: fullReq.title,
            description: fullReq.description,
            currentPhase: fullReq.currentPhase,
          });
        }
      }

      // Run semantic inference
      const semanticDeps = await this.inferSemanticDependencies(requestsForSemantic);

      // Create relationships for high-confidence semantic dependencies
      const MIN_CONFIDENCE = 0.6; // Only create relationships with >60% confidence
      let semanticCreated = 0;

      for (const dep of semanticDeps) {
        if (dep.confidence >= MIN_CONFIDENCE) {
          try {
            await this.createBlockingRelationship(dep.blockedReq, dep.blockingReq, dep.reason);
            semanticCreated++;
            stats.relationshipsCreated++;
          } catch (err: any) {
            if (!err.message?.includes('already exists')) {
              stats.errors.push(`Semantic ${dep.blockedReq} → ${dep.blockingReq}: ${err.message}`);
            }
          }
        }
      }

      stats.dependenciesFound += semanticDeps.filter(d => d.confidence >= MIN_CONFIDENCE).length;

      console.log(`[StrategicOrchestrator] ✅ One-off analysis complete:`);
      console.log(`   - Analyzed: ${stats.analyzed} requests`);
      console.log(`   - Explicit dependencies found: ${stats.dependenciesFound - semanticDeps.filter(d => d.confidence >= MIN_CONFIDENCE).length}`);
      console.log(`   - Semantic dependencies inferred: ${semanticDeps.length} (${semanticDeps.filter(d => d.confidence >= MIN_CONFIDENCE).length} high-confidence)`);
      console.log(`   - Relationships created: ${stats.relationshipsCreated}`);
      if (stats.errors.length > 0) {
        console.log(`   - Errors: ${stats.errors.length}`);
      }

      return stats;
    } catch (error: any) {
      stats.errors.push(`Fatal error: ${error.message}`);
      console.error('[StrategicOrchestrator] One-off analysis failed:', error.message);
      return stats;
    }
  }

  /**
   * Scan recommendations table for approved items that need conversion to owner_requests
   * This is the MISSING LOGIC that converts approved recommendations into workflows
   */
  private async scanApprovedRecommendations(): Promise<void> {
    interface ApprovedRec {
      id: string;
      rec_number: string;
      title: string;
      description: string;
      recommendation_type: string;
      urgency: string;
      affected_bus: string[] | null;
      affected_entities: string[] | null;
      estimated_effort: string | null;
      recommended_by_agent: string;
    }

    let approvedRecs: ApprovedRec[];

    if (this.useCloudApi && this.apiClient) {
      // Cloud mode - use HTTP API
      const recs = await this.apiClient.getRecommendations({
        status: 'approved',
        convertedToRequestId: false,
      });

      // Map API response to ApprovedRec interface
      approvedRecs = recs.map((r: any) => ({
        id: r.id,
        rec_number: r.recNumber,
        title: r.title,
        description: r.description || '',
        recommendation_type: r.recommendationType || 'enhancement',
        urgency: r.urgency || 'medium',
        affected_bus: r.affectedBus || null,
        affected_entities: r.affectedEntities || null,
        estimated_effort: r.estimatedEffort || null,
        recommended_by_agent: r.recommendedByAgent || 'unknown',
      }));

      // Sort by urgency (cloud API may not return sorted)
      const urgencyOrder: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };
      approvedRecs.sort((a, b) => (urgencyOrder[a.urgency] || 5) - (urgencyOrder[b.urgency] || 5));
    } else if (this.sdlcDb) {
      // Local mode - use direct database query
      approvedRecs = await this.sdlcDb.query<ApprovedRec>(
        `SELECT id, rec_number, title, description, recommendation_type, urgency,
                affected_bus, affected_entities, estimated_effort, recommended_by_agent
         FROM recommendations
         WHERE status = 'approved'
           AND converted_to_request_id IS NULL
         ORDER BY
           CASE urgency
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
             ELSE 5
           END,
           created_at ASC`
      );
    } else {
      // No SDLC connection - skip recommendation scanning
      console.log('[StrategicOrchestrator] Skipping recommendation scan - no SDLC connection');
      return;
    }

    if (approvedRecs.length === 0) {
      return;
    }

    console.log(`[StrategicOrchestrator] 💡 Found ${approvedRecs.length} approved recommendations to convert`);

    for (const rec of approvedRecs) {
      try {
        // Convert recommendation to owner_request
        const ownerRequestId = await this.convertRecommendationToRequest(rec);

        if (ownerRequestId) {
          console.log(`[StrategicOrchestrator] ✅ Converted ${rec.rec_number} -> owner_request ${ownerRequestId}`);
        }
      } catch (error: any) {
        console.error(`[StrategicOrchestrator] Failed to convert ${rec.rec_number}:`, error.message);
      }
    }
  }

  /**
   * Convert an approved recommendation to an owner_request and start workflow
   */
  private async convertRecommendationToRequest(rec: {
    id: string;
    rec_number: string;
    title: string;
    description: string;
    recommendation_type: string;
    urgency: string;
    affected_bus: string[] | null;
    affected_entities: string[] | null;
    estimated_effort: string | null;
    recommended_by_agent: string;
  }): Promise<string | null> {
    // Map urgency to priority
    const priorityMap: Record<string, string> = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
    };
    const priority = priorityMap[rec.urgency] || 'medium';

    // Determine assigned_to based on affected_bus or recommendation type
    const assignedTo = this.determineAssignedTo(rec);

    // Generate new REQ number based on rec_number
    const reqNumber = rec.rec_number.replace('REC-', 'REQ-');

    try {
      if (this.useCloudApi && this.apiClient) {
        // Cloud mode - use HTTP API
        // Use first affected_bu as primaryBu (main business unit)
        const primaryBu = rec.affected_bus && rec.affected_bus.length > 0 ? rec.affected_bus[0] : undefined;

        const newRequest = await this.apiClient.createRequest({
          reqNumber,
          title: rec.title,
          description: rec.description,
          priority,
          primaryBu,
          assignedTo,
          source: 'recommendation',
          sourceReference: rec.rec_number,
          affectedBus: rec.affected_bus || [],
          affectedEntities: rec.affected_entities || [],
        });

        if (!newRequest) {
          console.error(`[StrategicOrchestrator] Failed to create request via cloud API for ${rec.rec_number}`);
          return null;
        }

        // Update recommendation with conversion info - mark as 'converted' so it doesn't show in UI
        await this.apiClient.updateRecommendationStatus(
          rec.id,
          'converted',
          undefined,
          newRequest.id
        );

        console.log(`[StrategicOrchestrator] 📋 Created owner_request via cloud API: ${newRequest.reqNumber} from ${rec.rec_number}`);
        return newRequest.id;
      }

      if (!this.sdlcDb) {
        console.log(`[StrategicOrchestrator] Skipping recommendation conversion - no SDLC connection`);
        return null;
      }

      // Local mode - use transaction to ensure atomicity
      const result = await this.sdlcDb.transaction(async (client) => {
        // 1. Create owner_request
        const insertResult = await client.query(
          `INSERT INTO owner_requests (
            req_number, title, description, priority, current_phase,
            assigned_to, created_by, source, source_reference, affected_bus, affected_entities, source_recommendation_id
          ) VALUES ($1, $2, $3, $4, 'backlog', $5, $6, 'recommendation', $7, $8, $9, $10)
          RETURNING id, req_number`,
          [
            reqNumber,
            rec.title,
            rec.description,
            priority,
            assignedTo,
            rec.recommended_by_agent,
            rec.rec_number,  // source_reference
            rec.affected_bus || [],
            rec.affected_entities || [],
            rec.id,
          ]
        );

        const newRequest = insertResult.rows[0];

        // 2. Update recommendation with conversion info - mark as 'converted' so it doesn't show in UI
        await client.query(
          `UPDATE recommendations
           SET converted_to_request_id = $1,
               converted_at = NOW(),
               status = 'converted'
           WHERE id = $2`,
          [newRequest.id, rec.id]
        );

        return newRequest;
      });

      console.log(`[StrategicOrchestrator] 📋 Created owner_request: ${result.req_number} from ${rec.rec_number}`);

      // The owner_request will be picked up by scanOwnerRequests on next cycle
      // since it's in 'backlog' phase which maps to 'NEW' status

      return result.id;

    } catch (error: any) {
      // Handle duplicate key error (request already exists)
      if (error.code === '23505') {
        console.log(`[StrategicOrchestrator] Request ${reqNumber} already exists - marking recommendation as converted`);

        // Find the existing request and update the recommendation
        const existingReq = await this.sdlcDb.queryOne<{ id: string }>(
          `SELECT id FROM owner_requests WHERE req_number = $1`,
          [reqNumber]
        );

        if (existingReq) {
          await this.sdlcDb.query(
            `UPDATE recommendations
             SET converted_to_request_id = $1,
                 converted_at = NOW(),
                 status = 'in_progress'
             WHERE id = $2`,
            [existingReq.id, rec.id]
          );
          return existingReq.id;
        }
      }

      throw error;
    }
  }

  /**
   * Determine who should be assigned to work on a recommendation
   */
  private determineAssignedTo(rec: {
    affected_bus: string[] | null;
    recommendation_type: string;
  }): string {
    // Check affected business units
    if (rec.affected_bus && rec.affected_bus.length > 0) {
      const bus = rec.affected_bus.map(b => b.toLowerCase());

      if (bus.some(b => b.includes('warehouse') || b.includes('inventory'))) {
        return 'marcus';
      }
      if (bus.some(b => b.includes('sales') || b.includes('crm'))) {
        return 'sarah';
      }
      if (bus.some(b => b.includes('procurement') || b.includes('vendor'))) {
        return 'alex';
      }
    }

    // Check recommendation type
    const type = rec.recommendation_type.toLowerCase();
    if (type.includes('integration')) {
      return 'sarah'; // Sarah handles CRM/Sales integrations
    }
    if (type.includes('api') || type.includes('backend')) {
      return 'marcus';
    }

    // Default
    return 'marcus';
  }

  /**
   * Get blocker requests that should be worked first
   * These are requests that block other requests - completing them unblocks others
   * Prioritized by: blocks_count DESC (unblocks the most), depth DESC (deepest first)
   */
  private async getBlockersToWorkFirst(): Promise<Array<{
    reqNumber: string;
    title: string;
    priority: string;
    currentPhase: string;
    blocksCount: number;
  }>> {
    try {
      if (this.useCloudApi && this.apiClient) {
        // Cloud mode - use the deepest-unblocked API
        const blockers = await this.apiClient.getDeepestUnblocked(5);
        if (blockers.length > 0) {
          console.log(`[StrategicOrchestrator] 🔓 Found ${blockers.length} blocker(s) to prioritize`);
          for (const b of blockers) {
            console.log(`[StrategicOrchestrator]   → ${b.reqNumber}: blocks ${b.blocksCount} request(s)`);
          }
        }
        return blockers;
      } else if (this.sdlcDb) {
        // Local mode - direct database query using the function
        const result = await this.sdlcDb.query<{
          req_number: string;
          title: string;
          priority: string;
          current_phase: string;
          blocks_count: number;
        }>(`SELECT * FROM get_deepest_unblocked_requests(5)`);

        if (result.length > 0) {
          console.log(`[StrategicOrchestrator] 🔓 Found ${result.length} blocker(s) to prioritize`);
          for (const b of result) {
            console.log(`[StrategicOrchestrator]   → ${b.req_number}: blocks ${b.blocks_count} request(s)`);
          }
        }

        return result.map(r => ({
          reqNumber: r.req_number,
          title: r.title,
          priority: r.priority,
          currentPhase: r.current_phase,
          blocksCount: r.blocks_count,
        }));
      }
    } catch (error: any) {
      // If the function doesn't exist yet (migration not applied), log and continue
      console.warn(`[StrategicOrchestrator] Blocker query failed (migration may not be applied): ${error.message}`);
    }

    return [];
  }

  /**
   * Scan SDLC database for new/pending requests
   * REFACTORED: Now uses SDLC database instead of OWNER_REQUESTS.md
   * ENHANCED: Now prioritizes blocker requests that unblock other work
   *
   * Priority Order:
   * 1. Deepest blockers (requests that unblock the most others)
   * 2. Then normal priority-based selection
   *
   * Phase Mapping:
   * - backlog/research: NEW requests, start from Stage 0 (Cynthia)
   * - review/approved: PENDING requests, check NATS for completed stages and resume from gap
   * - in_progress: Already running, skip
   * - done/blocked/cancelled: Skip
   */
  private async scanOwnerRequests(): Promise<void> {
    // Check circuit breaker before scanning
    const allowed = await this.circuitBreaker.allowRequest();
    if (!allowed) {
      const state = this.circuitBreaker.getState();
      console.log(`[StrategicOrchestrator] Circuit breaker ${state.state} - skipping scan (failure rate: ${(state.failureRate * 100).toFixed(1)}%)`);
      if (state.nextTestAt) {
        const minutesUntilTest = Math.ceil((state.nextTestAt - Date.now()) / 60000);
        console.log(`[StrategicOrchestrator] Next test in ${minutesUntilTest} minutes`);
      }
      return;
    }

    // CHECK FOR ACTIVE WORKFLOW DIRECTIVE
    // If an exclusive directive is active, only work on items in its scope
    if (this.useCloudApi && this.apiClient) {
      try {
        const workflowStatus = await this.apiClient.getWorkflowStatus();
        if (workflowStatus.hasActiveDirective && workflowStatus.directive) {
          const directive = workflowStatus.directive;
          this.activeDirective = {
            id: directive.id,
            displayName: directive.displayName,
            targetReqNumbers: directive.targetReqNumbers || [],
            exclusive: directive.exclusive,
          };
          console.log(`[StrategicOrchestrator] 🎯 ACTIVE DIRECTIVE: ${directive.displayName}`);
          if (directive.exclusive && directive.targetReqNumbers?.length) {
            console.log(`[StrategicOrchestrator] 🎯 Exclusive focus on: ${directive.targetReqNumbers.join(', ')}`);
          }
        } else {
          if (this.activeDirective) {
            console.log('[StrategicOrchestrator] ✅ Workflow directive cleared - returning to normal');
          }
          this.activeDirective = null;
        }
      } catch (error: any) {
        console.warn(`[StrategicOrchestrator] Failed to check workflow directive: ${error.message}`);
        // Continue without directive filtering on error
      }
    }

    // PRIORITY 1: Check for blocker requests that should be worked first
    // These are requests that block other requests - completing them unblocks more work
    const blockers = await this.getBlockersToWorkFirst();
    const blockerReqNumbers = new Set(blockers.map(b => b.reqNumber));

    // Query for actionable requests - use API client if in cloud mode
    let mappedRequests: Array<{ reqNumber: string; title: string; status: string; assignedTo: string | null; priority: string }>;

    if (this.useCloudApi && this.apiClient) {
      // Cloud mode - use HTTP API
      const actionable = await this.apiClient.getActionableRequests();
      mappedRequests = actionable.map(r => ({ ...r, priority: r.priority || 'medium' }));
      console.log(`[StrategicOrchestrator] Total requests found (cloud): ${mappedRequests.length}`);
    } else {
      // Local mode - direct database query
      interface RequestRow {
        req_number: string;
        title: string;
        current_phase: string;
        assigned_to: string | null;
        is_blocked: boolean;
        priority: string;
      }

      const requests = await this.sdlcDb.query<RequestRow>(
        `SELECT req_number, title, current_phase, assigned_to, is_blocked, priority
         FROM owner_requests
         WHERE current_phase IN ('backlog', 'research', 'review', 'approved', 'in_progress')
           AND is_blocked = false
         ORDER BY
           CASE priority
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
             ELSE 5
           END,
           created_at ASC`
      );

      console.log(`[StrategicOrchestrator] Total requests found (local): ${requests.length}`);

      // Map database phases to legacy status codes for compatibility
      mappedRequests = requests.map(r => ({
        reqNumber: r.req_number,
        title: r.title,
        status: PHASE_TO_STATUS[r.current_phase] || 'NEW',
        assignedTo: r.assigned_to,
        priority: r.priority || 'medium',
      }));
    }

    // WORKFLOW DIRECTIVE FILTER
    // If an exclusive directive is active, filter to only items in scope
    // NOTE: Catastrophic items still take priority WITHIN the filtered set
    if (this.activeDirective?.exclusive && this.activeDirective.targetReqNumbers.length > 0) {
      const scopeSet = new Set(this.activeDirective.targetReqNumbers);
      const beforeCount = mappedRequests.length;
      mappedRequests = mappedRequests.filter(r => scopeSet.has(r.reqNumber));
      const afterCount = mappedRequests.length;
      console.log(`[StrategicOrchestrator] 🎯 Directive filter: ${afterCount}/${beforeCount} requests in scope`);

      if (afterCount === 0) {
        console.log('[StrategicOrchestrator] 🎯 All directive items complete or out of actionable phases - directive may auto-clear');
      }
    }

    // Gap Fix #12: Check concurrent workflow limit before processing new workflows
    const activeWorkflows = mappedRequests.filter(r => r.status === 'IN_PROGRESS').length;
    if (activeWorkflows >= this.MAX_CONCURRENT_WORKFLOWS) {
      console.log(`[StrategicOrchestrator] Concurrency limit reached: ${activeWorkflows}/${this.MAX_CONCURRENT_WORKFLOWS} workflows active - skipping new starts`);
    }

    // PRIORITY ORDER: catastrophic > critical > high > medium > low
    const priorityOrder: Record<string, number> = {
      catastrophic: 0,  // Building on fire - everything stops
      critical: 1,
      high: 2,
      medium: 3,
      low: 4
    };

    // Check for catastrophic REQs - they get absolute priority
    // CRITICAL: Include ALL catastrophic REQs, even BLOCKED ones
    // When catastrophic is blocked, we must prioritize its blockers to unblock it
    const catastrophicReqs = mappedRequests.filter(r =>
      r.priority === 'catastrophic'
    );
    const hasCatastrophic = catastrophicReqs.length > 0;
    const blockedCatastrophicReqs = catastrophicReqs.filter(r => r.status === 'BLOCKED');

    if (hasCatastrophic) {
      console.log(`[StrategicOrchestrator] 🚨 CATASTROPHIC priority detected: ${catastrophicReqs.map(r => r.reqNumber).join(', ')}`);
      if (blockedCatastrophicReqs.length > 0) {
        console.log(`[StrategicOrchestrator] 🚨 BLOCKED CATASTROPHIC REQs: ${blockedCatastrophicReqs.map(r => r.reqNumber).join(', ')} - MUST unblock these first!`);
      }
    }

    // PRIORITY SORTING:
    // 1. Catastrophic REQs first (absolute priority)
    // 2. REQs that block catastrophic REQs (must unblock the catastrophic)
    // 3. Other blockers (unblock more work)
    // 4. By priority level
    const sortedRequests = [...mappedRequests].sort((a, b) => {
      const aIsCatastrophic = a.priority === 'catastrophic';
      const bIsCatastrophic = b.priority === 'catastrophic';

      // Catastrophic always first
      if (aIsCatastrophic && !bIsCatastrophic) return -1;
      if (!aIsCatastrophic && bIsCatastrophic) return 1;

      const aIsBlocker = blockerReqNumbers.has(a.reqNumber);
      const bIsBlocker = blockerReqNumbers.has(b.reqNumber);

      // Check if blocking a catastrophic REQ (highest priority after catastrophic itself)
      const aBlocksCatastrophic = blockers.find(bl => bl.reqNumber === a.reqNumber)?.blocksCount || 0;
      const bBlocksCatastrophic = blockers.find(bl => bl.reqNumber === b.reqNumber)?.blocksCount || 0;

      // Blockers come next (especially those blocking catastrophic)
      if (aIsBlocker && !bIsBlocker) return -1;
      if (!aIsBlocker && bIsBlocker) return 1;

      // If both are blockers, sort by how many they block
      if (aIsBlocker && bIsBlocker) {
        return bBlocksCatastrophic - aBlocksCatastrophic;
      }

      // Otherwise, maintain priority order
      return (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5);
    });

    // Check if any catastrophic REQ is currently in progress
    const catastrophicInProgress = mappedRequests.some(r =>
      r.priority === 'catastrophic' && r.status === 'IN_PROGRESS'
    );

    // Build set of requests that SPECIFICALLY block catastrophic REQs
    // Only these should be allowed through when catastrophic is pending/in-progress
    const blockersOfCatastrophic = new Set<string>();
    if (hasCatastrophic && this.useCloudApi && this.apiClient) {
      for (const catReq of catastrophicReqs) {
        try {
          const blockerInfo = await this.apiClient.getBlockers(catReq.reqNumber);
          if (blockerInfo?.blockedBy && blockerInfo.blockedBy.length > 0) {
            // blockedBy is string[] - each string is a REQ number that blocks this catastrophic REQ
            for (const blockingReqNumber of blockerInfo.blockedBy) {
              blockersOfCatastrophic.add(blockingReqNumber);
            }
          }
        } catch (error: any) {
          console.warn(`[StrategicOrchestrator] Failed to get blockers for ${catReq.reqNumber}: ${error.message}`);
        }
      }
      if (blockersOfCatastrophic.size > 0) {
        console.log(`[StrategicOrchestrator] 🚨 Requests blocking catastrophic: ${[...blockersOfCatastrophic].join(', ')}`);
      }
    }

    for (const { reqNumber, title, status, assignedTo, priority } of sortedRequests) {
      // Skip requests pending human approval (unified model)
      if (status === 'PENDING_APPROVAL') {
        console.log(`[StrategicOrchestrator] ⏳ Skipping ${reqNumber} - pending human approval`);
        continue;
      }

      // Only process NEW, PENDING, or REJECTED requests
      if (status !== 'NEW' && status !== 'PENDING' && status !== 'REJECTED') {
        continue;
      }

      // Check if this is a blocker request (for logging)
      const isBlocker = blockerReqNumbers.has(reqNumber);
      const blockerInfo = isBlocker ? blockers.find(b => b.reqNumber === reqNumber) : null;
      const isCatastrophic = priority === 'catastrophic';
      const thisBlocksCatastrophic = blockersOfCatastrophic.has(reqNumber);

      // CATASTROPHIC PRIORITY RULE: When catastrophic exists (pending OR in progress), ONLY work on:
      // 1. Catastrophic REQs themselves
      // 2. REQs that SPECIFICALLY block catastrophic REQs (to unblock them)
      // NOTE: Generic blockers that don't block catastrophic work are NOT allowed through
      if (hasCatastrophic && !isCatastrophic) {
        if (!thisBlocksCatastrophic) {
          console.log(`[StrategicOrchestrator] ⏸️ Skipping ${reqNumber} - catastrophic priority pending, focus on catastrophic work only`);
          continue;
        }
        console.log(`[StrategicOrchestrator] 🔓 ${reqNumber} blocks a catastrophic REQ - allowing through`);
      }

      // Gap Fix #12: Enforce concurrency limit - don't start new workflows if at max
      // BUT: Catastrophic and blockers OF catastrophic bypass concurrency limit
      if (status === 'NEW' && !thisBlocksCatastrophic && !isCatastrophic) {
        const currentActive = sortedRequests.filter(r => r.status === 'IN_PROGRESS').length;
        if (currentActive >= this.MAX_CONCURRENT_WORKFLOWS) {
          console.log(`[StrategicOrchestrator] Skipping ${reqNumber} - at concurrency limit (${currentActive}/${this.MAX_CONCURRENT_WORKFLOWS})`);
          continue;
        }
      }

      // DUPLICATE PREVENTION: Check if workflow already exists
      // This prevents duplicate spawns on server restart
      try {
        const existingWorkflow = await this.orchestrator.getWorkflowStatus(reqNumber);
        if (existingWorkflow && existingWorkflow.status === 'running') {
          console.log(`[StrategicOrchestrator] ${reqNumber} (${status}) - workflow already running - skipping duplicate`);
          // Mark as processed to prevent repeated checks
          this.processedRequests.add(reqNumber);
          continue;
        }
      } catch (error) {
        // Workflow doesn't exist - OK to start
      }

      // Check if we just started this in current session (race condition protection)
      if (this.processedRequests.has(reqNumber)) {
        console.log(`[StrategicOrchestrator] ${reqNumber} already processed in this session - skipping`);
        continue;
      }

      // Enhanced logging for blocker requests
      if (isBlocker && blockerInfo) {
        console.log(`[StrategicOrchestrator] 🔓 BLOCKER ${status} request detected: ${reqNumber} (unblocks ${blockerInfo.blocksCount} request(s))`);
      } else {
        console.log(`[StrategicOrchestrator] 🆕 ${status} request detected: ${reqNumber}`);
      }

      // Use title from database, determine assignedTo based on reqNumber prefix
      const agent = assignedTo || this.routeToStrategicAgent(reqNumber);

      // Determine starting stage based on status
      let startStage = 0; // Default: Start from beginning (Cynthia)

      if (status === 'PENDING' || status === 'REJECTED') {
        // Smart resume: Check NATS for completed stages
        console.log(`[StrategicOrchestrator] ${status} status - checking NATS for completed stages...`);
        startStage = await this.findFirstMissingStage(reqNumber);
        console.log(`[StrategicOrchestrator] Resuming ${reqNumber} from stage ${startStage + 1}`);
      }

      // Update status to IN_PROGRESS before starting workflow
      // This prevents duplicate spawns even if server restarts
      const statusUpdated = await this.updateRequestStatus(reqNumber, 'IN_PROGRESS');

      if (!statusUpdated) {
        console.error(`[StrategicOrchestrator] Failed to update status for ${reqNumber} - skipping to prevent duplicates`);
        continue;
      }

      // Route to appropriate strategic agent
      const strategicAgent = this.routeToStrategicAgent(reqNumber);
      console.log(`[StrategicOrchestrator] Routing ${reqNumber} to ${strategicAgent}`);

      // EMBEDDING QUERY: Get strategic context from past learnings BEFORE starting workflow
      // This provides agents with relevant past experiences, similar workflows, and patterns
      const strategicContext = await this.getStrategicContext(reqNumber, title);

      // DEPENDENCY DETECTION: Analyze request for blocking dependencies
      // This creates blocking relationships if the request mentions other REQs
      if (this.useCloudApi && this.apiClient) {
        const fullRequest = await this.apiClient.getRequest(reqNumber);
        if (fullRequest) {
          await this.analyzeAndCreateDependencies(reqNumber, title, fullRequest.description);
        }
      }

      // Start specialist workflow via orchestrator
      try {
        if (startStage === 0) {
          // Start from beginning with strategic context
          await this.orchestrator.startWorkflow(reqNumber, title, agent, strategicContext);
          await this.persistence.createWorkflow({ reqNumber, title, assignedTo: agent, currentStage: 0 });
        } else {
          // Resume from specific stage with strategic context
          await this.orchestrator.resumeWorkflowFromStage(reqNumber, title, agent, startStage, strategicContext);
          await this.persistence.createWorkflow({ reqNumber, title, assignedTo: agent, currentStage: startStage });
        }
        this.processedRequests.add(reqNumber);
        console.log(`[StrategicOrchestrator] ✅ Workflow started for ${reqNumber} from stage ${startStage + 1}`);
      } catch (error: any) {
        console.error(`[StrategicOrchestrator] Failed to start workflow for ${reqNumber}:`, error.message);
        // Revert status back to original status on failure
        await this.updateRequestStatus(reqNumber, status);
      }
    }
  }

  /**
   * Find the first missing stage by checking NATS deliverables
   * Returns the stage index to resume from (0-based)
   */
  private async findFirstMissingStage(reqNumber: string): Promise<number> {
    const stages = [
      { agent: 'cynthia', stream: 'research' },
      { agent: 'sylvia', stream: 'critique' },
      { agent: 'roy', stream: 'backend' },
      { agent: 'jen', stream: 'frontend' },
      { agent: 'billy', stream: 'qa' },
      { agent: 'priya', stream: 'statistics' },
      { agent: 'berry', stream: 'devops' },
    ];

    for (let i = 0; i < stages.length; i++) {
      const { agent, stream } = stages[i];
      const subject = `agog.deliverables.${agent}.${stream}.${reqNumber}`;

      try {
        // Check if deliverable exists in NATS
        const jsm = await this.nc.jetstreamManager();
        const streamName = `agog_features_${stream}`;

        // Try to get the message
        await jsm.streams.getMessage(streamName, { last_by_subj: subject });

        console.log(`[StrategicOrchestrator]   ✓ Stage ${i + 1} (${agent}) - deliverable found`);
      } catch (error) {
        // Deliverable not found - this is where we resume
        console.log(`[StrategicOrchestrator]   ✗ Stage ${i + 1} (${agent}) - deliverable missing`);
        console.log(`[StrategicOrchestrator]   → Resuming from stage ${i + 1}`);
        return i;
      }
    }

    // All stages complete? Start from beginning (safety fallback)
    console.log(`[StrategicOrchestrator]   All stages have deliverables - starting from beginning`);
    return 0;
  }

  /**
   * Update request status in SDLC database or via cloud API
   * REFACTORED: Supports both local database and cloud API modes
   * Returns true if successful, false if failed
   */
  private async updateRequestStatus(reqNumber: string, newStatus: string, reason?: string): Promise<boolean> {
    try {
      // Map legacy status to SDLC phase
      const newPhase = STATUS_TO_PHASE[newStatus] || 'backlog';
      const isBlocked = newStatus === 'BLOCKED';

      if (this.useCloudApi && this.apiClient) {
        // Cloud mode - use HTTP API
        const success = await this.apiClient.updateRequestPhase(reqNumber, newStatus, reason);
        if (success) {
          const logMessage = reason
            ? `✅ Updated ${reqNumber} phase to ${newPhase} (${reason}) [cloud]`
            : `✅ Updated ${reqNumber} phase to ${newPhase} [cloud]`;
          console.log(`[StrategicOrchestrator] ${logMessage}`);
        }
        return success;
      } else {
        // Local mode - direct database update
        // Note: Explicit cast $2::boolean required for PostgreSQL CASE type inference
        const result = await this.sdlcDb.query(
          `UPDATE owner_requests
           SET current_phase = $1,
               is_blocked = $2::boolean,
               blocked_reason = CASE WHEN $2::boolean THEN $3 ELSE NULL END,
               updated_at = NOW()
           WHERE req_number = $4
           RETURNING req_number`,
          [newPhase, isBlocked, reason || null, reqNumber]
        );

        if (result.length === 0) {
          console.error(`[StrategicOrchestrator] Request ${reqNumber} not found in SDLC database`);
          return false;
        }

        const logMessage = reason
          ? `✅ Updated ${reqNumber} phase to ${newPhase} (${reason})`
          : `✅ Updated ${reqNumber} phase to ${newPhase}`;
        console.log(`[StrategicOrchestrator] ${logMessage}`);
        return true;
      }
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to update status for ${reqNumber}:`, error.message);
      return false;
    }
  }

  /**
   * Extract request details from SDLC database or cloud API
   * REFACTORED: Supports both local database and cloud API modes
   */
  private async extractRequestDetails(reqNumber: string): Promise<{ title: string; assignedTo: string }> {
    try {
      if (this.useCloudApi && this.apiClient) {
        // Cloud mode - use HTTP API
        const request = await this.apiClient.getRequest(reqNumber);
        if (request) {
          return {
            title: request.title || 'Untitled Feature',
            assignedTo: request.assignedTo || this.routeToStrategicAgent(reqNumber),
          };
        }
      } else {
        // Local mode - direct database query
        const result = await this.sdlcDb.query<{ title: string; assigned_to: string | null }>(
          `SELECT title, assigned_to FROM owner_requests WHERE req_number = $1`,
          [reqNumber]
        );

        if (result.length > 0) {
          return {
            title: result[0].title || 'Untitled Feature',
            assignedTo: result[0].assigned_to || this.routeToStrategicAgent(reqNumber),
          };
        }
      }
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to extract details for ${reqNumber}:`, error.message);
    }

    // Fallback: derive from reqNumber
    return {
      title: 'Untitled Feature',
      assignedTo: this.routeToStrategicAgent(reqNumber),
    };
  }

  /**
   * Route request to appropriate strategic agent based on domain
   */
  private routeToStrategicAgent(reqNumber: string): 'marcus' | 'sarah' | 'alex' {
    const upperReq = reqNumber.toUpperCase();

    // Marcus: Warehouse/Inventory
    if (upperReq.includes('ITEM') || upperReq.includes('STOCK') || upperReq.includes('WAREHOUSE') ||
        upperReq.includes('INVENTORY') || upperReq.includes('BIN')) {
      return 'marcus';
    }

    // Sarah: Sales/CRM
    if (upperReq.includes('SALES') || upperReq.includes('CUSTOMER') || upperReq.includes('CRM') ||
        upperReq.includes('ORDER') || upperReq.includes('INVOICE') || upperReq.includes('PRICING')) {
      return 'sarah';
    }

    // Alex: Procurement/Vendors
    if (upperReq.includes('VENDOR') || upperReq.includes('PROCUREMENT') || upperReq.includes('PURCHASE') ||
        upperReq.includes('SUPPLIER') || upperReq.includes('PO')) {
      return 'alex';
    }

    // Default to marcus for warehouse domain
    return 'marcus';
  }

  /**
   * Subscribe to blocked workflow events
   * ENHANCED: Now supports blockedBy field to create blocking relationships
   *
   * Event format:
   * {
   *   reqNumber: string,      // The request that is blocked
   *   stage: string,          // Current stage when blocked
   *   reason?: string,        // Why it's blocked
   *   blockedBy?: string,     // REQ number of the blocking request (creates relationship)
   * }
   */
  private async subscribeToBlockedWorkflows(): Promise<void> {
    console.log('[StrategicOrchestrator] Subscribing to blocked workflow events...');

    // Subscribe to orchestration events
    const consumer = await this.js.consumers.get(
      'agog_orchestration_events',
      'strategic_blocked_handler'
    ).catch(async () => {
      // Consumer doesn't exist, create it
      console.log('[StrategicOrchestrator] Creating consumer: strategic_blocked_handler');
      const jsm = await this.nc.jetstreamManager();
      await jsm.consumers.add('agog_orchestration_events', {
        durable_name: 'strategic_blocked_handler',
        ack_policy: 'explicit' as any,
        filter_subject: 'agog.orchestration.events.stage.blocked',
      });
      return this.js.consumers.get('agog_orchestration_events', 'strategic_blocked_handler');
    });

    // Process blocked events
    (async () => {
      const messages = await consumer.consume();
      for await (const msg of messages) {
        try {
          const event = JSON.parse(msg.string());
          console.log(`[StrategicOrchestrator] 🚨 Blocked workflow event: ${event.reqNumber} at stage ${event.stage}`);

          // Persist blocked status to database for ALL blocked events
          const reason = event.reason || `Blocked at stage: ${event.stage}`;
          await this.persistence.blockWorkflow(event.reqNumber, reason);
          console.log(`[StrategicOrchestrator] 📝 Persisted BLOCKED status for ${event.reqNumber}`);

          // Also update SDLC database
          await this.updateRequestStatus(event.reqNumber, 'BLOCKED', reason);

          // Create blocking relationships for any blockers specified
          // Supports both: blockedBy (single string) and blockers (array of REQ numbers)
          const blockerList: string[] = [];
          if (event.blockedBy) {
            blockerList.push(event.blockedBy);
          }
          if (event.blockers && Array.isArray(event.blockers)) {
            blockerList.push(...event.blockers.filter((b: unknown) => typeof b === 'string' && b.startsWith('REQ-')));
          }

          for (const blockingReq of blockerList) {
            await this.createBlockingRelationship(event.reqNumber, blockingReq, reason);
          }

          // Handle Critique stage blocks specially (spawn strategic agent)
          if (event.stage === 'Critique') {
            await this.handleBlockedCritique(event);
          }

          msg.ack();
        } catch (error: any) {
          console.error('[StrategicOrchestrator] Error processing blocked event:', error.message);
          msg.nak();
        }
      }
    })().catch((error) => {
      console.error('[StrategicOrchestrator] Error in blocked workflow subscription:', error.message);
    });

    console.log('[StrategicOrchestrator] ✅ Subscribed to blocked workflow events');
  }

  /**
   * Create a blocking relationship between requests
   * Called when an agent reports that a request is blocked by another
   */
  private async createBlockingRelationship(
    blockedReqNumber: string,
    blockingReqNumber: string,
    reason?: string
  ): Promise<void> {
    try {
      if (this.useCloudApi && this.apiClient) {
        // Cloud mode - use HTTP API
        const result = await this.apiClient.addBlocker(blockedReqNumber, blockingReqNumber, reason);
        if (result) {
          console.log(`[StrategicOrchestrator] 🔗 Created blocking relationship: ${blockedReqNumber} ← blocked by ← ${blockingReqNumber}`);
        }
      } else if (this.sdlcDb) {
        // Local mode - use database function
        await this.sdlcDb.query(
          `SELECT add_request_blocker($1, $2, $3, $4)`,
          [blockedReqNumber, blockingReqNumber, reason, 'orchestrator']
        );
        console.log(`[StrategicOrchestrator] 🔗 Created blocking relationship: ${blockedReqNumber} ← blocked by ← ${blockingReqNumber}`);
      }
    } catch (error: any) {
      // Don't fail the blocked event processing if relationship creation fails
      console.error(`[StrategicOrchestrator] Failed to create blocking relationship: ${error.message}`);
    }
  }

  /**
   * Detect dependencies from REQ description/title text
   * Looks for patterns like:
   * - "depends on REQ-123"
   * - "requires REQ-456"
   * - "blocked by REQ-789"
   * - "after REQ-012 is complete"
   * - "prerequisite: REQ-345"
   */
  private detectDependenciesFromText(text: string): string[] {
    if (!text) return [];

    const dependencies: Set<string> = new Set();

    // Patterns that indicate a dependency relationship
    const patterns = [
      /depends\s+on\s+(REQ-[\w-]+)/gi,
      /requires?\s+(REQ-[\w-]+)/gi,
      /blocked\s+by\s+(REQ-[\w-]+)/gi,
      /after\s+(REQ-[\w-]+)/gi,
      /prerequisite[:\s]+(REQ-[\w-]+)/gi,
      /waiting\s+(?:on|for)\s+(REQ-[\w-]+)/gi,
      /needs?\s+(REQ-[\w-]+)\s+(?:first|complete|done)/gi,
      /\b(REQ-[\w-]+)\s+must\s+(?:be\s+)?(?:complete|done|finished)\s+first/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        dependencies.add(match[1].toUpperCase());
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Analyze a new REQ for dependencies and create blocking relationships
   * Called when a new request is detected during scanOwnerRequests
   */
  private async analyzeAndCreateDependencies(
    reqNumber: string,
    title: string,
    description?: string
  ): Promise<void> {
    try {
      // Combine title and description for analysis
      const fullText = `${title} ${description || ''}`;

      // Detect explicit dependencies from text
      const explicitDeps = this.detectDependenciesFromText(fullText);

      if (explicitDeps.length > 0) {
        console.log(`[StrategicOrchestrator] 🔍 Found ${explicitDeps.length} explicit dependencies for ${reqNumber}: ${explicitDeps.join(', ')}`);

        for (const blockingReq of explicitDeps) {
          // Don't create self-references
          if (blockingReq === reqNumber) continue;

          // Verify the blocking request exists before creating relationship
          if (this.useCloudApi && this.apiClient) {
            const exists = await this.apiClient.getRequest(blockingReq);
            if (exists) {
              await this.createBlockingRelationship(reqNumber, blockingReq, `Detected from description: "${fullText.substring(0, 100)}..."`);
            } else {
              console.log(`[StrategicOrchestrator] ⚠️ Blocking request ${blockingReq} not found - skipping`);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Error analyzing dependencies for ${reqNumber}: ${error.message}`);
    }
  }

  /**
   * Keywords that indicate foundational/prerequisite work
   * REQs with these keywords likely BLOCK other REQs
   */
  private readonly BLOCKER_KEYWORDS = [
    'design', 'architect', 'architecture', 'plan', 'planning',
    'foundation', 'foundational', 'core', 'base', 'baseline',
    'schema', 'database', 'model', 'data model',
    'infrastructure', 'setup', 'configure', 'configuration',
    'authentication', 'authorization', 'security', 'rbac', 'rls',
    'api', 'endpoint', 'interface', 'contract',
    'framework', 'library', 'utility', 'helper',
  ];

  /**
   * Keywords that indicate dependent/downstream work
   * REQs with these keywords are likely BLOCKED BY other REQs
   */
  private readonly DEPENDENT_KEYWORDS = [
    'implement', 'implementation', 'build', 'create', 'develop',
    'feature', 'functionality', 'module',
    'integrate', 'integration', 'connect',
    'ui', 'frontend', 'dashboard', 'report', 'view',
    'test', 'testing', 'e2e', 'unit test',
    'deploy', 'deployment', 'release',
    'optimize', 'optimization', 'performance',
    'enhance', 'enhancement', 'improve',
  ];

  /**
   * Calculate blocking score - positive means req1 likely blocks req2
   * Considers keywords, phases, and semantic relationships
   */
  private calculateBlockingScore(
    req1Title: string,
    req1Phase: string,
    req2Title: string,
    req2Phase: string
  ): number {
    let score = 0;
    const title1Lower = req1Title.toLowerCase();
    const title2Lower = req2Title.toLowerCase();

    // Check if req1 has blocker keywords and req2 has dependent keywords
    const req1BlockerCount = this.BLOCKER_KEYWORDS.filter(kw => title1Lower.includes(kw)).length;
    const req1DependentCount = this.DEPENDENT_KEYWORDS.filter(kw => title1Lower.includes(kw)).length;
    const req2BlockerCount = this.BLOCKER_KEYWORDS.filter(kw => title2Lower.includes(kw)).length;
    const req2DependentCount = this.DEPENDENT_KEYWORDS.filter(kw => title2Lower.includes(kw)).length;

    // Score based on keyword balance
    score += (req1BlockerCount - req1DependentCount) * 2;
    score -= (req2BlockerCount - req2DependentCount) * 2;

    // Phase-based scoring (earlier phases block later phases)
    const phaseOrder: Record<string, number> = {
      'backlog': 0, 'research': 1, 'review': 2, 'approved': 3,
      'in_progress': 4, 'qa': 5, 'staging': 6, 'done': 7,
    };
    const phase1Order = phaseOrder[req1Phase] ?? 4;
    const phase2Order = phaseOrder[req2Phase] ?? 4;

    // If req1 is in earlier phase and req2 is in later phase, req1 may block req2
    if (phase1Order < phase2Order) {
      score += 1;
    }

    // Specific pattern matching
    // "Design X" blocks "Implement X"
    if (title1Lower.includes('design') && title2Lower.includes('implement')) {
      score += 3;
    }
    // "Schema" blocks "CRUD" / "API"
    if (title1Lower.includes('schema') && (title2Lower.includes('crud') || title2Lower.includes('api'))) {
      score += 3;
    }
    // "Authentication" blocks most other things
    if (title1Lower.includes('authentication') && !title2Lower.includes('authentication')) {
      score += 2;
    }
    // "Database" / "Model" blocks "Service" / "Repository"
    if ((title1Lower.includes('database') || title1Lower.includes('model')) &&
        (title2Lower.includes('service') || title2Lower.includes('repository'))) {
      score += 2;
    }

    return score;
  }

  /**
   * Infer semantic dependencies using embeddings and heuristics
   * Returns array of {blockedReq, blockingReq, confidence, reason}
   */
  async inferSemanticDependencies(
    requests: Array<{ reqNumber: string; title: string; description?: string; currentPhase: string }>
  ): Promise<Array<{
    blockedReq: string;
    blockingReq: string;
    confidence: number;
    reason: string;
  }>> {
    const inferred: Array<{
      blockedReq: string;
      blockingReq: string;
      confidence: number;
      reason: string;
    }> = [];

    if (requests.length < 2) return inferred;

    console.log(`[StrategicOrchestrator] 🧠 Running semantic dependency inference on ${requests.length} requests...`);

    // Generate embeddings for all requests
    const embeddings: Map<string, number[]> = new Map();
    for (const req of requests) {
      try {
        const text = `${req.title} ${req.description || ''}`.substring(0, 500);
        const embedding = await this.mcpClient.generateEmbedding(text);
        if (embedding && embedding.length > 0) {
          embeddings.set(req.reqNumber, embedding);
        }
      } catch (error) {
        // Skip requests we can't embed
      }
    }

    console.log(`[StrategicOrchestrator] Generated ${embeddings.size} embeddings`);

    // Compare each pair of requests
    const reqList = requests.filter(r => embeddings.has(r.reqNumber));

    for (let i = 0; i < reqList.length; i++) {
      const req1 = reqList[i];
      const emb1 = embeddings.get(req1.reqNumber)!;

      for (let j = i + 1; j < reqList.length; j++) {
        const req2 = reqList[j];
        const emb2 = embeddings.get(req2.reqNumber)!;

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(emb1, emb2);

        // Only consider similar requests (threshold: 0.7)
        if (similarity < 0.7) continue;

        // Calculate blocking score to determine direction
        const score = this.calculateBlockingScore(
          req1.title, req1.currentPhase,
          req2.title, req2.currentPhase
        );

        // If significant score, infer dependency
        if (Math.abs(score) >= 3) {
          const confidence = Math.min(0.95, similarity * (Math.abs(score) / 10 + 0.5));

          if (score > 0) {
            // req1 blocks req2
            inferred.push({
              blockedReq: req2.reqNumber,
              blockingReq: req1.reqNumber,
              confidence,
              reason: `Semantic: "${req1.title.substring(0, 40)}..." likely prerequisite for "${req2.title.substring(0, 40)}..." (similarity: ${(similarity * 100).toFixed(0)}%, score: ${score})`,
            });
          } else {
            // req2 blocks req1
            inferred.push({
              blockedReq: req1.reqNumber,
              blockingReq: req2.reqNumber,
              confidence,
              reason: `Semantic: "${req2.title.substring(0, 40)}..." likely prerequisite for "${req1.title.substring(0, 40)}..." (similarity: ${(similarity * 100).toFixed(0)}%, score: ${-score})`,
            });
          }
        }
      }
    }

    console.log(`[StrategicOrchestrator] Inferred ${inferred.length} semantic dependencies`);
    return inferred;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Subscribe to stage completion events for stage progression tracking
   */
  private async subscribeToStageCompletions(): Promise<void> {
    console.log('[StrategicOrchestrator] Subscribing to stage completion events...');

    const consumer = await this.js.consumers.get(
      'agog_orchestration_events',
      'strategic_stage_handler'
    ).catch(async () => {
      console.log('[StrategicOrchestrator] Creating consumer: strategic_stage_handler');
      const jsm = await this.nc.jetstreamManager();
      await jsm.consumers.add('agog_orchestration_events', {
        durable_name: 'strategic_stage_handler',
        ack_policy: 'explicit' as any,
        filter_subject: 'agog.orchestration.events.stage.completed',
      });
      return this.js.consumers.get('agog_orchestration_events', 'strategic_stage_handler');
    });

    // Process stage completion events
    (async () => {
      const messages = await consumer.consume();
      for await (const msg of messages) {
        try {
          const event = JSON.parse(msg.string());
          console.log(`[StrategicOrchestrator] 📊 Stage completed: ${event.reqNumber} - ${event.stage}`);

          // Persist stage progression to database
          // Map stage name to stage number (1-indexed for display)
          const stageNames = ['Cynthia', 'Sylvia', 'Roy', 'Jen', 'Billy', 'Priya'];
          const stageIndex = stageNames.indexOf(event.stage);
          if (stageIndex >= 0) {
            await this.persistence.updateStage(event.reqNumber, stageIndex + 1);
            console.log(`[StrategicOrchestrator] 📝 Persisted stage ${stageIndex + 1} for ${event.reqNumber}`);
          }

          msg.ack();
        } catch (error: any) {
          console.error('[StrategicOrchestrator] Error processing stage completion:', error.message);
          msg.nak();
        }
      }
    })().catch((error) => {
      console.error('[StrategicOrchestrator] Error in stage completion subscription:', error.message);
    });

    console.log('[StrategicOrchestrator] ✅ Subscribed to stage completion events');
  }

  /**
   * Subscribe to workflow completion events for memory storage
   */
  private async subscribeToWorkflowCompletions(): Promise<void> {
    console.log('[StrategicOrchestrator] Subscribing to workflow completion events...');

    // Subscribe to workflow completion events
    const consumer = await this.js.consumers.get(
      'agog_orchestration_events',
      'strategic_completion_handler'
    ).catch(async () => {
      // Consumer doesn't exist, create it
      console.log('[StrategicOrchestrator] Creating consumer: strategic_completion_handler');
      const jsm = await this.nc.jetstreamManager();
      await jsm.consumers.add('agog_orchestration_events', {
        durable_name: 'strategic_completion_handler',
        ack_policy: 'explicit' as any,
        filter_subject: 'agog.orchestration.events.workflow.completed',
      });
      return this.js.consumers.get('agog_orchestration_events', 'strategic_completion_handler');
    });

    // Process completion events
    (async () => {
      const messages = await consumer.consume();
      for await (const msg of messages) {
        try {
          const event = JSON.parse(msg.string());
          console.log(`[StrategicOrchestrator] ✅ Workflow completed: ${event.reqNumber}`);

          // Store workflow learnings in memory
          await this.storeWorkflowLearnings(event.reqNumber);

          // **FIX: Update status to COMPLETE in OWNER_REQUESTS.md**
          console.log(`[StrategicOrchestrator] Updating ${event.reqNumber} status to COMPLETE`);
          await this.updateRequestStatus(event.reqNumber, 'COMPLETE');
          await this.persistence.completeWorkflow(event.reqNumber);

          // DEPENDENCY RESOLUTION: Resolve any blockers this request was blocking
          // The database trigger handles this for local mode, but for cloud mode we call the API
          if (this.useCloudApi && this.apiClient) {
            const resolved = await this.apiClient.resolveBlockers(event.reqNumber);
            if (resolved > 0) {
              console.log(`[StrategicOrchestrator] 🔓 Resolved ${resolved} blocker(s) - unblocked dependent request(s)`);
            }
          }

          msg.ack();
        } catch (error: any) {
          console.error('[StrategicOrchestrator] Error processing completion event:', error.message);
          msg.nak();
        }
      }
    })().catch((error) => {
      console.error('[StrategicOrchestrator] Error in workflow completion subscription:', error.message);
    });

    console.log('[StrategicOrchestrator] ✅ Subscribed to workflow completion events');
  }

  /**
   * Subscribe to new requirements from NATS (from Sam audits, sub-requirement decomposition, etc.)
   */
  private async subscribeToNewRequirements(): Promise<void> {
    console.log('[StrategicOrchestrator] Subscribing to new requirements from NATS...');

    // Subscribe to both subjects for compatibility
    const sub1 = this.nc.subscribe('agog.requirements.new');
    const sub2 = this.nc.subscribe('agog.requirements.sub.new');

    const processMessage = async (msg: any) => {
      try {
        const req = JSON.parse(msg.string());
        // Support both req_number (from Sam) and reqId (from sub-requirements)
        const reqNumber = req.req_number || req.reqId;
        const title = req.title;
        const source = req.source || (req.parent ? 'sub-requirement' : 'unknown');

        console.log(`[StrategicOrchestrator] 📨 Received new requirement: ${reqNumber} (Source: ${source})`);

        // Check if we already processed this requirement
        if (this.processedRequests.has(reqNumber)) {
          console.log(`[StrategicOrchestrator] ${reqNumber} already processed - skipping`);
          return;
        }

        // Mark as processed
        this.processedRequests.add(reqNumber);

        // DEPENDENCY DETECTION: Analyze request for blocking dependencies
        await this.analyzeAndCreateDependencies(reqNumber, title, req.description);

        // Start workflow
        console.log(`[StrategicOrchestrator] 🆕 Starting workflow for: ${reqNumber}`);
        if (req.parent) {
          console.log(`[StrategicOrchestrator] Parent: ${req.parent}, Priority: ${req.priority}, Type: ${req.type}`);
        } else if (req.priority) {
          console.log(`[StrategicOrchestrator] Priority: ${req.priority}`);
        }

        await this.orchestrator.startWorkflow(reqNumber, title, 'marcus');
        await this.persistence.createWorkflow({
          reqNumber,
          title,
          assignedTo: 'marcus',
          currentStage: 0,
          metadata: {
            source,
            priority: req.priority,
            parent: req.parent,
            audit_type: req.audit_type,
            description: req.description,
          }
        });

        console.log(`[StrategicOrchestrator] ✅ Workflow started for ${reqNumber}`);

      } catch (error: any) {
        console.error('[StrategicOrchestrator] Error processing requirement:', error.message);
      }
    };

    // Process messages from both subscriptions
    (async () => {
      for await (const msg of sub1) {
        await processMessage(msg);
      }
    })().catch(error => {
      console.error('[StrategicOrchestrator] Requirements subscription error (new):', error.message);
    });

    (async () => {
      for await (const msg of sub2) {
        await processMessage(msg);
      }
    })().catch(error => {
      console.error('[StrategicOrchestrator] Requirements subscription error (sub.new):', error.message);
    });

    console.log('[StrategicOrchestrator] ✅ Subscribed to new requirements (agog.requirements.new, agog.requirements.sub.new)');
  }

  /**
   * Handle a blocked critique from Sylvia
   */
  private async handleBlockedCritique(event: any): Promise<void> {
    const { reqNumber, reason, blockers } = event;

    console.log(`[StrategicOrchestrator] Handling blocked critique for ${reqNumber}`);
    console.log(`[StrategicOrchestrator] Reason: ${reason}`);
    console.log(`[StrategicOrchestrator] Blockers:`, blockers);

    try {
      // Gap Fix #21: Check recursion depth to prevent infinite sub-requirements
      const depth = (reqNumber.match(/SUB/g) || []).length;
      const MAX_RECURSION_DEPTH = 3;

      if (depth >= MAX_RECURSION_DEPTH) {
        console.error(`[StrategicOrchestrator] ❌ Maximum recursion depth (${MAX_RECURSION_DEPTH}) exceeded for ${reqNumber}`);
        await this.escalateWorkflow(reqNumber, 'MAX_DEPTH_EXCEEDED', {
          depth,
          maxDepth: MAX_RECURSION_DEPTH,
          reason: 'Requirement too complex, needs human decomposition',
          blockers
        });
        return;
      }

      console.log(`[StrategicOrchestrator] Recursion depth: ${depth}/${MAX_RECURSION_DEPTH}`);

      // Fetch Sylvia's full critique from NATS to get detailed issues
      const critiqueSubject = `agog.deliverables.sylvia.critique.${reqNumber}`;
      const critiqueDeliverable = await this.fetchDeliverableFromNATS(critiqueSubject);

      // Parse issues from critique
      const issues = this.parseIssuesFromCritique(critiqueDeliverable, blockers);

      console.log(`[StrategicOrchestrator] Parsed ${issues.length} issues from critique`);

      if (issues.length === 0) {
        console.log(`[StrategicOrchestrator] No actionable issues found - resuming workflow`);
        await this.orchestrator.resumeWorkflow(reqNumber, { decision: 'APPROVE' } as any);
        return;
      }

      // Create sub-requirements for each issue
      const subRequirements = await this.createSubRequirements(reqNumber, issues);

      console.log(`[StrategicOrchestrator] Created ${subRequirements.length} sub-requirements`);

      // Publish sub-requirements to NATS work queue (NOT to OWNER_REQUESTS.md)
      await this.publishSubRequirementsToNATS(reqNumber, subRequirements);

      // Update original requirement status to BLOCKED
      await this.updateRequestStatus(reqNumber, 'BLOCKED', `Waiting for ${subRequirements.length} sub-requirements to complete`);

      // Subscribe to sub-requirement completions in NATS
      await this.subscribeToSubRequirementCompletions(reqNumber, subRequirements);

    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to handle blocked critique for ${reqNumber}:`, error.message);

      // Escalate to human on error
      await this.publishEscalation({
        req_number: reqNumber,
        priority: 'NEEDS_HUMAN_DECISION',
        reason: `Failed to create sub-requirements: ${error.message}`,
        original_event: event,
      });
    }
  }

  /**
   * Apply a strategic decision to the workflow
   */
  private async applyStrategicDecision(decision: StrategicDecision): Promise<void> {
    const { req_number, decision: decisionType, reasoning } = decision;

    console.log(`[StrategicOrchestrator] Applying decision for ${req_number}: ${decisionType}`);
    console.log(`[StrategicOrchestrator] Reasoning: ${reasoning}`);

    // Store decision in knowledge database for future reference
    try {
      await this.knowledge.storeDecision({
        req_number,
        agent: decision.agent,
        decision: decisionType,
        reasoning,
        instructions_for_roy: decision.instructions_for_roy,
        instructions_for_jen: decision.instructions_for_jen,
        priority_fixes: decision.priority_fixes,
        deferred_items: decision.deferred_items,
        business_context: decision.business_context
      });
      console.log(`[StrategicOrchestrator] 💾 Stored decision in knowledge database`);
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to store decision:`, error.message);
    }

    if (decisionType === 'APPROVE') {
      // Resume workflow
      console.log(`[StrategicOrchestrator] ✅ APPROVED: ${req_number}`);
      console.log(`[StrategicOrchestrator] Instructions for Roy: ${decision.instructions_for_roy || 'None'}`);
      console.log(`[StrategicOrchestrator] Instructions for Jen: ${decision.instructions_for_jen || 'None'}`);

      try {
        await this.orchestrator.resumeWorkflow(req_number, decision);
        console.log(`[StrategicOrchestrator] ✅ Workflow ${req_number} resumed successfully`);
      } catch (error: any) {
        console.error(`[StrategicOrchestrator] Failed to resume workflow: ${error.message}`);
        await this.publishEscalation({
          req_number,
          priority: 'NEEDS_MANUAL_INTERVENTION',
          reason: `Failed to resume workflow after APPROVE decision: ${error.message}`,
        });
      }

    } else if (decisionType === 'REQUEST_CHANGES') {
      // Restart workflow from Cynthia
      console.log(`[StrategicOrchestrator] 🔄 REQUEST_CHANGES: Restarting ${req_number} from Research stage`);

      try {
        await this.orchestrator.restartFromStage(
          req_number,
          0,
          `Strategic decision: ${reasoning}`
        );
        console.log(`[StrategicOrchestrator] ✅ Workflow ${req_number} restarted from Research`);
      } catch (error: any) {
        console.error(`[StrategicOrchestrator] Failed to restart workflow: ${error.message}`);
        await this.publishEscalation({
          req_number,
          priority: 'NEEDS_MANUAL_INTERVENTION',
          reason: `Failed to restart workflow after REQUEST_CHANGES decision: ${error.message}`,
        });
      }

    } else if (decisionType === 'ESCALATE_HUMAN') {
      // Publish to escalation stream for human review
      console.log(`[StrategicOrchestrator] 🆙 ESCALATE_HUMAN: ${req_number}`);
      await this.publishEscalation({
        req_number,
        priority: 'NEEDS_HUMAN_DECISION',
        reason: reasoning,
        strategic_agent: decision.agent,
        business_context: decision.business_context,
      });
    }
  }

  /**
   * Publish an escalation to the monitoring stream
   */
  private async publishEscalation(data: any): Promise<void> {
    try {
      await this.js.publish(
        'agog.strategic.escalations.human',
        JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`[StrategicOrchestrator] 📨 Escalation published for ${data.req_number}`);
    } catch (error: any) {
      console.error('[StrategicOrchestrator] Failed to publish escalation:', error.message);
    }
  }

  /**
   * Gap Fix #6: Proper escalation mechanism with status updates and file logging
   */
  private async escalateWorkflow(reqId: string, reason: string, context: any): Promise<void> {
    console.log(`[StrategicOrchestrator] 🚨 ESCALATING: ${reqId} - ${reason}`);

    try {
      // 1. Update OWNER_REQUESTS.md status to ESCALATED
      await this.updateRequestStatus(reqId, 'ESCALATED', reason);

      // 2. Update NATS workflow state
      await this.js.publish(
        `agog.workflows.state.${reqId}`,
        JSON.stringify({
          reqId,
          state: 'ESCALATED',
          reason,
          timestamp: new Date().toISOString()
        })
      );

      // 3. Publish escalation event
      await this.js.publish(
        `agog.escalations.${reqId}`,
        JSON.stringify({
          reqId,
          reason,
          context,
          priority: context.critical ? 'CRITICAL' : 'HIGH',
          timestamp: new Date().toISOString()
        })
      );

      // 4. Write escalation file for human review
      const escalationDir = path.join(__dirname, '..', '..', '..', '.claude', 'escalations');
      if (!fs.existsSync(escalationDir)) {
        fs.mkdirSync(escalationDir, { recursive: true });
      }

      const escalationFile = path.join(escalationDir, `${reqId}.json`);
      fs.writeFileSync(escalationFile, JSON.stringify({
        reqId,
        reason,
        context,
        escalatedAt: new Date().toISOString()
      }, null, 2));

      console.log(`[StrategicOrchestrator] ✅ Escalation complete - file written to ${escalationFile}`);

    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to escalate ${reqId}:`, error.message);
      // Don't throw - escalation failures shouldn't crash the system
    }
  }

  /**
   * Store workflow learnings in memory after completion
   */
  private async storeWorkflowLearnings(reqNumber: string): Promise<void> {
    try {
      const workflow = await this.orchestrator.getWorkflowStatus(reqNumber);

      if (!workflow || workflow.status !== 'complete') {
        return;
      }

      // Extract deliverables from NATS
      const deliverables: any[] = [];
      const stages = ['research', 'critique', 'backend', 'frontend', 'qa', 'statistics', 'devops'];

      for (const stage of stages) {
        try {
          const jsm = await this.nc.jetstreamManager();
          const msg = await jsm.streams.getMessage('agog_orchestration_events', {
            last_by_subj: `agog.features.${stage}.${reqNumber}`
          });
          if (msg) {
            deliverables.push(JSON.parse(msg.data.toString()));
          }
        } catch (error) {
          // Stage deliverable not found, skip
        }
      }

      // Generate summary with key lessons
      const lessons = this.extractLessons(deliverables);
      const duration = workflow.completedAt ?
        new Date(workflow.completedAt).getTime() - new Date(workflow.startedAt).getTime() : 0;

      // Store in memory with semantic search
      await this.mcpClient.storeMemory({
        agent_id: workflow.assignedTo || 'strategic', // marcus/sarah/alex
        memory_type: 'workflow_completion',
        content: `Completed ${reqNumber}: ${workflow.title}. ${lessons}`,
        metadata: {
          reqNumber,
          title: workflow.title,
          duration_ms: duration,
          duration_hours: Math.round(duration / 3600000),
          stages_completed: deliverables.length,
          agents: deliverables.map(d => d.agent),
          status: workflow.status,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`[StrategicOrchestrator] 💾 Stored workflow learnings for ${reqNumber}`);
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to store learnings for ${reqNumber}:`, error.message);
    }
  }

  /**
   * Get strategic context from past memories before making decision
   */
  private async getStrategicContext(reqNumber: string, featureTitle: string): Promise<any> {
    try {
      const strategicAgent = this.routeToStrategicAgent(reqNumber);

      // Search for similar past workflows
      const similarWorkflows = await this.mcpClient.searchMemories({
        query: `Similar workflows to ${featureTitle}. Past decisions and lessons learned.`,
        agent_id: strategicAgent,
        memory_types: ['workflow_completion', 'strategic_decision', 'blocked_resolution'],
        limit: 5,
        min_relevance: 0.7
      });

      // Search for related technical patterns
      const technicalPatterns = await this.mcpClient.searchMemories({
        query: `Technical implementation patterns for ${featureTitle}`,
        memory_types: ['implementation', 'research'],
        limit: 3,
        min_relevance: 0.75
      });

      const context = {
        similarWorkflows: similarWorkflows.map(m => ({
          content: m.content,
          relevance: m.relevance_score,
          agent: m.agent_id,
          metadata: m.metadata
        })),
        technicalPatterns: technicalPatterns.map(m => ({
          content: m.content,
          relevance: m.relevance_score
        })),
        patterns: this.identifyPatterns(similarWorkflows)
      };

      console.log(`[StrategicOrchestrator] 🔍 Retrieved ${similarWorkflows.length} similar memories for ${reqNumber}`);
      return context;
    } catch (error: any) {
      console.error('[StrategicOrchestrator] Failed to retrieve strategic context:', error.message);
      return { similarWorkflows: [], technicalPatterns: [], patterns: [] };
    }
  }

  /**
   * Extract key lessons from workflow deliverables
   */
  private extractLessons(deliverables: any[]): string {
    const lessons: string[] = [];

    for (const deliverable of deliverables) {
      if (deliverable.summary) {
        lessons.push(`${deliverable.agent}: ${deliverable.summary.substring(0, 150)}`);
      }

      // Extract specific insights
      if (deliverable.blockers && deliverable.blockers.length > 0) {
        lessons.push(`Blockers encountered: ${deliverable.blockers.join(', ')}`);
      }

      if (deliverable.key_findings) {
        lessons.push(`Key findings: ${JSON.stringify(deliverable.key_findings)}`);
      }
    }

    return lessons.join('. ');
  }

  /**
   * Identify patterns from past workflow memories
   */
  private identifyPatterns(memories: any[]): string[] {
    const patterns: string[] = [];

    // Look for recurring themes
    const keywords = new Map<string, number>();
    for (const memory of memories) {
      const words = memory.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 5) {
          keywords.set(word, (keywords.get(word) || 0) + 1);
        }
      }
    }

    // Find top recurring keywords (patterns)
    const sorted = Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [keyword, count] of sorted) {
      if (count >= 2) {
        patterns.push(`Recurring theme: ${keyword} (${count} occurrences)`);
      }
    }

    return patterns;
  }

  /**
   * Monitor IN_PROGRESS workflows and spawn next agents when stages complete
   * REFACTORED: Supports both local database and cloud API modes
   * This is the MISSING LOGIC that makes workflows actually progress
   */
  private async progressInProgressWorkflows(): Promise<void> {
    // Query for IN_PROGRESS requests
    let inProgressReqs: Array<{ req_number: string; title: string; assigned_to: string | null }>;

    if (this.useCloudApi && this.apiClient) {
      // Cloud mode - use HTTP API
      const requests = await this.apiClient.getActionableRequests();
      inProgressReqs = requests
        .filter(r => r.status === 'IN_PROGRESS')
        .map(r => ({
          req_number: r.reqNumber,
          title: r.title,
          assigned_to: r.assignedTo,
        }));
    } else {
      // Local mode - direct database query
      inProgressReqs = await this.sdlcDb.query<{ req_number: string; title: string; assigned_to: string | null }>(
        `SELECT req_number, title, assigned_to
         FROM owner_requests
         WHERE current_phase = 'in_progress'
           AND is_blocked = false
         ORDER BY updated_at DESC`
      );
    }

    for (const req of inProgressReqs) {
      const reqNumber = req.req_number;

      try {
        // Check which stage this workflow is at
        const currentStage = await this.detectCurrentStage(reqNumber);

        if (currentStage === null) {
          // No deliverables yet - workflow just started, skip
          continue;
        }

        if (currentStage === 6) {
          // All 6 stages complete - this will be handled by workflow completion event
          continue;
        }

        // Check if we already spawned the next agent
        const nextStage = currentStage + 1;
        const workflow = await this.orchestrator.getWorkflowStatus(reqNumber);

        if (!workflow) {
          console.log(`[StrategicOrchestrator] ${reqNumber} at stage ${currentStage}, spawning next stage ${nextStage}`);

          // Use title and assignedTo from database
          const title = req.title || 'Untitled Feature';
          const assignedTo = req.assigned_to || this.routeToStrategicAgent(reqNumber);

          // Resume from next stage
          await this.orchestrator.resumeWorkflowFromStage(reqNumber, title, assignedTo, nextStage);
          console.log(`[StrategicOrchestrator] ✅ Progressed ${reqNumber} to stage ${nextStage + 1}`);
        }

      } catch (error: any) {
        console.error(`[StrategicOrchestrator] Error progressing ${reqNumber}:`, error.message);
      }
    }
  }

  /**
   * Detect which stage a workflow has completed
   * Returns 0-7 (0=no deliverables, 7=all complete including Berry)
   */
  private async detectCurrentStage(reqNumber: string): Promise<number | null> {
    const stages = [
      { agent: 'cynthia', stream: 'research' },
      { agent: 'sylvia', stream: 'critique' },
      { agent: 'roy', stream: 'backend' },
      { agent: 'jen', stream: 'frontend' },
      { agent: 'billy', stream: 'qa' },
      { agent: 'priya', stream: 'statistics' },
      { agent: 'berry', stream: 'devops' },
    ];

    let lastCompletedStage = -1;

    for (let i = 0; i < stages.length; i++) {
      const { agent, stream } = stages[i];
      const subject = `agog.deliverables.${agent}.${stream}.${reqNumber}`;

      try {
        const jsm = await this.nc.jetstreamManager();
        const streamName = `agog_features_${stream}`;
        await jsm.streams.getMessage(streamName, { last_by_subj: subject });
        lastCompletedStage = i;
      } catch (error) {
        // Deliverable not found - stop here
        break;
      }
    }

    return lastCompletedStage === -1 ? null : lastCompletedStage + 1;
  }


  /**
   * Monitor IN_PROGRESS workflows and spawn next agents when stages complete
   * This is the MISSING LOGIC that makes workflows actually progress
   */

  /**
   * Fetch deliverable from NATS
   */
  private async fetchDeliverableFromNATS(subject: string): Promise<any> {
    try {
      const jsm = await this.nc.jetstreamManager();
      const streamName = 'agog_features_critique'; // Sylvia's deliverables stream

      const msg = await jsm.streams.getMessage(streamName, { last_by_subj: subject });
      return JSON.parse(msg.data.toString());
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to fetch deliverable from ${subject}:`, error.message);
      return null;
    }
  }

  /**
   * Parse issues from Sylvia's critique
   */
  private parseIssuesFromCritique(critiqueDeliverable: any, blockers: any[]): Array<{ title: string; description: string; priority: string; type: string }> {
    const issues: Array<{ title: string; description: string; priority: string; type: string }> = [];

    // If blockers array provided, use it
    if (blockers && blockers.length > 0) {
      for (const blocker of blockers) {
        issues.push({
          title: blocker.title || blocker.issue || blocker,
          description: blocker.description || blocker.details || String(blocker),
          priority: blocker.priority || 'P1',
          type: blocker.type || 'backend'
        });
      }
    }

    // Otherwise parse from critique deliverable content
    if (critiqueDeliverable && critiqueDeliverable.summary) {
      const criticalIssuesMatch = critiqueDeliverable.summary.match(/(\d+) CRITICAL/);
      if (criticalIssuesMatch) {
        const count = parseInt(criticalIssuesMatch[1]);
        console.log(`[StrategicOrchestrator] Found ${count} critical issues mentioned`);
      }

      // Extract BLOCKER items from summary
      const blockerRegex = /❌\s*\*\*(.+?)\*\*\s*-\s*(.+?)(?=\n|$)/g;
      let match;
      while ((match = blockerRegex.exec(critiqueDeliverable.summary)) !== null) {
        issues.push({
          title: match[1].trim(),
          description: match[2].trim(),
          priority: 'P0',
          type: 'backend'
        });
      }
    }

    return issues;
  }

  /**
   * Create sub-requirements from issues
   */
  private async createSubRequirements(parentReqId: string, issues: any[]): Promise<Array<{ reqId: string; title: string; description: string; priority: string }>> {
    const subRequirements = [];
    const timestamp = Date.now();

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const subReqId = `${parentReqId}-SUB${i + 1}-${timestamp}`;

      subRequirements.push({
        reqId: subReqId,
        title: issue.title,
        description: issue.description,
        priority: issue.priority || 'P1',
        parent: parentReqId,
        type: issue.type || 'backend'
      });
    }

    return subRequirements;
  }

  /**
   * Publish sub-requirements to NATS work queue
   */
  private async publishSubRequirementsToNATS(parentReqId: string, subRequirements: any[]): Promise<void> {
    console.log(`[StrategicOrchestrator] Publishing ${subRequirements.length} sub-requirements to NATS`);

    for (const subReq of subRequirements) {
      // Publish to requirements stream
      await this.nc.publish('agog.requirements.sub.new', JSON.stringify({
        reqId: subReq.reqId,
        title: subReq.title,
        description: subReq.description,
        priority: subReq.priority,
        parent: parentReqId,
        type: subReq.type,
        status: 'NEW',
        createdAt: new Date().toISOString()
      }));

      console.log(`[StrategicOrchestrator] ✅ Published ${subReq.reqId} to NATS (Priority: ${subReq.priority})`);
    }

    // Store sub-requirement list in parent workflow metadata
    await this.nc.publish(`agog.workflows.sub-requirements.${parentReqId}`, JSON.stringify({
      parentReqId,
      subRequirements: subRequirements.map(sr => sr.reqId),
      totalCount: subRequirements.length,
      createdAt: new Date().toISOString()
    }));

    console.log(`[StrategicOrchestrator] ✅ Published ${subRequirements.length} sub-requirements to NATS work queue`);
  }

  /**
   * Subscribe to sub-requirement completions in NATS and resume parent when all done
   */
  private async subscribeToSubRequirementCompletions(parentReqId: string, subRequirements: any[]): Promise<void> {
    console.log(`[StrategicOrchestrator] 👀 Subscribing to ${subRequirements.length} sub-requirement completions for ${parentReqId}`);

    const completedSubReqs = new Set<string>();
    const totalCount = subRequirements.length;

    // Subscribe to Berry completions for all sub-requirements
    const subject = 'agog.deliverables.berry.devops.>';
    const sub = this.nc.subscribe(subject);

    (async () => {
      for await (const msg of sub) {
        try {
          const deliverable = JSON.parse(msg.string());
          const subReqId = deliverable.reqId;

          // Check if this is one of our sub-requirements
          const isOurSubReq = subRequirements.some(sr => sr.reqId === subReqId);
          if (!isOurSubReq) continue;

          // Mark as completed
          completedSubReqs.add(subReqId);
          console.log(`[StrategicOrchestrator] ✅ Sub-requirement ${subReqId} completed (${completedSubReqs.size}/${totalCount})`);

          // Check if all sub-requirements are done
          if (completedSubReqs.size === totalCount) {
            console.log(`[StrategicOrchestrator] ✅ All ${totalCount} sub-requirements complete for ${parentReqId} - resuming workflow`);

            // Unsubscribe
            sub.unsubscribe();

            // Update parent status to IN_PROGRESS
            await this.updateRequestStatus(parentReqId, 'IN_PROGRESS', 'Sub-requirements complete');

            // Get parent requirement details from SDLC database
            const { title, assignedTo } = await this.extractRequestDetails(parentReqId);

            // Resume workflow from backend stage (Roy implements the fixes)
            try {
              await this.orchestrator.resumeWorkflowFromStage(parentReqId, title, assignedTo, 2); // Stage 2 = Roy
              console.log(`[StrategicOrchestrator] ✅ Resumed ${parentReqId} from backend stage`);
            } catch (error: any) {
              console.error(`[StrategicOrchestrator] Failed to resume ${parentReqId}:`, error.message);
            }
          }
        } catch (error: any) {
          console.error('[StrategicOrchestrator] Error processing sub-requirement completion:', error.message);
        }
      }
    })().catch(error => {
      console.error(`[StrategicOrchestrator] Subscription error for ${parentReqId}:`, error.message);
    });
  }

  /**
   * Gap Fix #5: Check workflow heartbeats and detect stuck workflows
   * Gap Fix #3: Enforce maximum workflow duration (8 hours)
   * REFACTORED: Supports both local database and cloud API modes
   */
  private async checkWorkflowHeartbeats(): Promise<void> {
    const now = Date.now();
    const MAX_WORKFLOW_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
    const HEARTBEAT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    // Query for IN_PROGRESS requests
    let inProgressReqs: Array<{ req_number: string }>;

    if (this.useCloudApi && this.apiClient) {
      // Cloud mode - use HTTP API
      const requests = await this.apiClient.getActionableRequests();
      inProgressReqs = requests
        .filter(r => r.status === 'IN_PROGRESS')
        .map(r => ({ req_number: r.reqNumber }));
    } else {
      // Local mode - direct database query
      inProgressReqs = await this.sdlcDb.query<{ req_number: string }>(
        `SELECT req_number
         FROM owner_requests
         WHERE current_phase = 'in_progress'
           AND is_blocked = false`
      );
    }

    for (const req of inProgressReqs) {
      const reqNumber = req.req_number;

      try {
        // Check NATS for workflow state
        const stateMsg = await this.nc.request(`agog.workflows.state.${reqNumber}`, '', { timeout: 1000 });
        const state = JSON.parse(stateMsg.string());

        const startTime = new Date(state.startedAt || state.timestamp).getTime();
        const duration = now - startTime;

        // Gap Fix #3: Check maximum duration
        if (duration > MAX_WORKFLOW_DURATION_MS) {
          console.error(`[StrategicOrchestrator] ❌ Workflow ${reqNumber} exceeded max duration (${Math.floor(duration / 3600000)}h > 8h)`);
          await this.escalateWorkflow(reqNumber, 'MAX_DURATION_EXCEEDED', {
            duration_ms: duration,
            duration_hours: Math.floor(duration / 3600000),
            max_hours: 8,
            reason: 'Workflow taking too long, needs human intervention'
          });
          continue;
        }

        // Gap Fix #5: Check heartbeat
        if (state.lastHeartbeat) {
          const lastHeartbeat = new Date(state.lastHeartbeat).getTime();
          const timeSinceHeartbeat = now - lastHeartbeat;

          if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT_MS) {
            console.error(`[StrategicOrchestrator] ❌ Workflow ${reqNumber} heartbeat timeout (${Math.floor(timeSinceHeartbeat / 60000)} min)`);
            await this.escalateWorkflow(reqNumber, 'HEARTBEAT_TIMEOUT', {
              last_heartbeat: state.lastHeartbeat,
              timeout_minutes: Math.floor(timeSinceHeartbeat / 60000),
              current_stage: state.currentStage,
              reason: 'Workflow appears stuck, no heartbeat detected'
            });
          }
        }

      } catch (error) {
        // No state in NATS - workflow might be orphaned
        console.warn(`[StrategicOrchestrator] ⚠️ No NATS state found for IN_PROGRESS workflow ${reqNumber}`);
      }
    }
  }

  /**
   * Gap Fix #13: Reconcile workflow states between SDLC database and NATS
   * REFACTORED: Supports both local database and cloud API modes
   */
  private async reconcileWorkflowStates(): Promise<void> {
    // Query all active requests
    let requests: Array<{ req_number: string; current_phase: string }>;

    if (this.useCloudApi && this.apiClient) {
      // Cloud mode - use HTTP API
      const apiRequests = await this.apiClient.getActionableRequests();
      requests = apiRequests.map(r => ({
        req_number: r.reqNumber,
        current_phase: STATUS_TO_PHASE[r.status] || 'backlog',
      }));
    } else {
      // Local mode - direct database query
      requests = await this.sdlcDb.query<{ req_number: string; current_phase: string }>(
        `SELECT req_number, current_phase
         FROM owner_requests
         WHERE current_phase NOT IN ('done', 'cancelled')`
      );
    }

    const reconciliations = [];

    for (const req of requests) {
      const reqNumber = req.req_number;
      const dbPhase = req.current_phase;
      const dbStatus = PHASE_TO_STATUS[dbPhase] || 'NEW';

      try {
        // Query NATS for workflow state
        const stateMsg = await this.nc.request(`agog.workflows.state.${reqNumber}`, '', { timeout: 1000 });
        const natsState = JSON.parse(stateMsg.string());

        // Compare states
        if (dbStatus !== natsState.state) {
          console.warn(`[StrategicOrchestrator] ⚠️ State mismatch for ${reqNumber}: DB=${dbStatus}, NATS=${natsState.state}`);

          // NATS is source of truth - update database to match
          if (natsState.state === 'COMPLETE' && dbStatus !== 'COMPLETE') {
            console.log(`[StrategicOrchestrator] Reconciling ${reqNumber}: NATS shows COMPLETE, updating database`);
            await this.updateRequestStatus(reqNumber, 'COMPLETE', 'Reconciled from NATS');
            reconciliations.push({ reqNumber, from: dbStatus, to: 'COMPLETE' });
          } else if (natsState.state === 'IN_PROGRESS' && dbStatus === 'NEW') {
            console.log(`[StrategicOrchestrator] Reconciling ${reqNumber}: NATS shows IN_PROGRESS, updating database`);
            await this.updateRequestStatus(reqNumber, 'IN_PROGRESS', 'Reconciled from NATS');
            reconciliations.push({ reqNumber, from: dbStatus, to: 'IN_PROGRESS' });
          } else if (natsState.state === 'BLOCKED' && dbStatus === 'IN_PROGRESS') {
            console.log(`[StrategicOrchestrator] Reconciling ${reqNumber}: NATS shows BLOCKED, updating database`);
            await this.updateRequestStatus(reqNumber, 'BLOCKED', 'Reconciled from NATS');
            reconciliations.push({ reqNumber, from: dbStatus, to: 'BLOCKED' });
          }
        }

      } catch (error) {
        // No NATS state - database might be authoritative
        if (dbStatus === 'IN_PROGRESS') {
          console.warn(`[StrategicOrchestrator] ⚠️ Database shows IN_PROGRESS for ${reqNumber} but no NATS state exists`);
          // This was already handled by recoverWorkflows(), so just log it
        }
      }
    }

    if (reconciliations.length > 0) {
      console.log(`[StrategicOrchestrator] ✅ Reconciled ${reconciliations.length} workflow states`);
    }
  }

  /**
   * Subscribe to all agent deliverables and cache them for quick lookup
   */
  private async subscribeToDeliverablesForCaching(): Promise<void> {
    console.log('[StrategicOrchestrator] Subscribing to deliverables for caching...');

    const agentStreams = [
      { agent: 'cynthia', stream: 'research', stage: 0 },
      { agent: 'sylvia', stream: 'critique', stage: 1 },
      { agent: 'roy', stream: 'backend', stage: 2 },
      { agent: 'jen', stream: 'frontend', stage: 3 },
      { agent: 'billy', stream: 'qa', stage: 4 },
      { agent: 'priya', stream: 'statistics', stage: 5 },
      { agent: 'berry', stream: 'devops', stage: 6 },
    ];

    for (const { agent, stream, stage } of agentStreams) {
      const subject = `agog.deliverables.${agent}.${stream}.>`;

      const sub = this.nc.subscribe(subject);

      (async () => {
        for await (const msg of sub) {
          try {
            const deliverable = JSON.parse(msg.string());
            const reqNumber = deliverable.req_number || msg.subject.split('.').pop();

            // Cache the deliverable
            await this.knowledge.cacheDeliverable({
              req_number: reqNumber,
              agent: agent,
              stage: stage,
              deliverable: deliverable
            });

            console.log(`[StrategicOrchestrator] 💾 Cached deliverable: ${reqNumber} from ${agent}`);

            // If this is a critique with APPROVE decision, extract and store learnings
            if (agent === 'sylvia' && deliverable.decision === 'APPROVE') {
              await this.extractAndStoreLearnings(reqNumber, deliverable);
            }

          } catch (error: any) {
            // Not all messages are JSON deliverables, skip quietly
          }
        }
      })().catch(error => {
        console.error(`[StrategicOrchestrator] Error in ${agent} deliverable subscription:`, error.message);
      });
    }

    console.log('[StrategicOrchestrator] ✅ Subscribed to deliverables for caching');
  }

  /**
   * Extract learnings from successful workflows
   */
  private async extractAndStoreLearnings(reqNumber: string, critiqueDeliverable: any): Promise<void> {
    try {
      // Extract positive patterns from approved work
      if (critiqueDeliverable.positive_findings && critiqueDeliverable.positive_findings.length > 0) {
        for (const finding of critiqueDeliverable.positive_findings.slice(0, 3)) {
          await this.knowledge.storeLearning({
            agent_id: 'sylvia',
            learning_type: 'best_practice',
            title: finding.title || 'Approved Pattern',
            description: finding.description || finding,
            example_context: `From ${reqNumber}`,
            confidence_score: 0.7,
            times_applied: 1,
            times_failed: 0
          });
        }
      }

      // Extract anti-patterns from critique (even if approved with notes)
      if (critiqueDeliverable.concerns && critiqueDeliverable.concerns.length > 0) {
        for (const concern of critiqueDeliverable.concerns.slice(0, 2)) {
          await this.knowledge.storeLearning({
            agent_id: 'sylvia',
            learning_type: 'gotcha',
            title: concern.title || 'Common Issue',
            description: concern.description || concern,
            example_context: `From ${reqNumber}`,
            confidence_score: 0.6,
            times_applied: 0,
            times_failed: 0
          });
        }
      }

      console.log(`[StrategicOrchestrator] 📚 Extracted learnings from ${reqNumber}`);
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to extract learnings:`, error.message);
    }
  }

  /**
   * Gap Fix #9: Subscribe to agent error events
   */
  private async subscribeToAgentErrors(): Promise<void> {
    console.log('[StrategicOrchestrator] Subscribing to agent error events...');

    const sub = this.nc.subscribe('agog.errors.agent.>');

    (async () => {
      for await (const msg of sub) {
        try {
          const error = JSON.parse(msg.string());
          console.error(`[StrategicOrchestrator] 🚨 Agent error: ${error.agentId} - ${error.error} (${error.reqId})`);

          // Handle different error types
          if (error.error === 'CLI_NOT_FOUND') {
            // Claude CLI not available - escalate immediately
            await this.escalateWorkflow(error.reqId, 'CLI_NOT_FOUND', {
              agentId: error.agentId,
              reason: 'Claude CLI not available on Windows host',
              critical: true
            });
          } else if (error.error === 'NATS_UNAVAILABLE') {
            // NATS connection issue - don't retry, wait for recovery
            console.warn(`[StrategicOrchestrator] NATS unavailable for ${error.reqId}, waiting for recovery`);
          } else if (error.error === 'TIMEOUT' || error.error === 'CRASH') {
            // Agent crashed or timed out - orchestrator will handle retry
            console.warn(`[StrategicOrchestrator] Agent ${error.agentId} ${error.error} for ${error.reqId}`);
          }

        } catch (err: any) {
          console.error('[StrategicOrchestrator] Error processing agent error event:', err.message);
        }
      }
    })().catch(error => {
      console.error('[StrategicOrchestrator] Agent error subscription error:', error.message);
    });

    console.log('[StrategicOrchestrator] ✅ Subscribed to agent error events');
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('[StrategicOrchestrator] 🛑 Daemon stopped');
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.stop();

    if (this.mcpClient) {
      await this.mcpClient.close();
    }

    if (this.knowledge) {
      await this.knowledge.close();
    }

    if (this.agentSpawner) {
      await this.agentSpawner.close();
    }

    if (this.orchestrator) {
      await this.orchestrator.close();
    }

    if (this.nc) {
      await this.nc.close();
    }

    console.log('[StrategicOrchestrator] ✅ Closed (including memory + knowledge services)');
  }
}
