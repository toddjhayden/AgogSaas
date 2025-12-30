import { connect, NatsConnection, JetStreamClient, StorageType, RetentionPolicy, StreamConfig, DiscardPolicy } from 'nats';
import { AgentSpawnerService } from './agent-spawner.service';
import { OrchestratorService } from './orchestrator.service';
import { MCPMemoryClient } from '../mcp/mcp-client.service';
import * as fs from 'fs';
import * as path from 'path';
import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { WorkflowPersistenceService } from './workflow-persistence.service';
import { AgentKnowledgeService } from '../knowledge/agent-knowledge.service';

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

  // Path to OWNER_REQUESTS.md file (mounted in Docker at /app/project-spirit)
  private ownerRequestsPath = process.env.OWNER_REQUESTS_PATH || '/app/project-spirit/owner_requests/OWNER_REQUESTS.md';

  // Track which requests have been processed
  private processedRequests: Set<string> = new Set();

  // Track running workflow monitoring
  private isRunning = false;
  // Circuit breaker for preventing runaway workflows
  private circuitBreaker = new CircuitBreaker();
  private persistence!: WorkflowPersistenceService;

  // Gap Fix #12: Concurrency limit
  private readonly MAX_CONCURRENT_WORKFLOWS = 5;

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

    // Initialize workflow persistence
    this.persistence = new WorkflowPersistenceService();
    await this.recoverWorkflows();

    console.log('[StrategicOrchestrator] ✅ Initialized successfully (with memory + knowledge integration)');
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
   */
  /**
   * Gap Fix #2, #4, #8: Comprehensive workflow recovery on startup
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

      // 2. Scan OWNER_REQUESTS.md for IN_PROGRESS workflows
      if (!fs.existsSync(this.ownerRequestsPath)) {
        console.log('[StrategicOrchestrator] OWNER_REQUESTS.md not found, skipping recovery');
        return;
      }

      const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
      const reqPattern = /### (REQ-[A-Z0-9-]+):/g;
      const statusPattern = /\*\*Status\*\*:\s*(\w+)/;

      let match;
      const inProgressReqs: string[] = [];
      const blockedReqs: string[] = [];

      while ((match = reqPattern.exec(content)) !== null) {
        const reqNumber = match[1];
        const startPos = match.index;
        const nextMatch = reqPattern.exec(content);
        const endPos = nextMatch ? nextMatch.index : content.length;
        reqPattern.lastIndex = nextMatch ? nextMatch.index : content.length;

        const reqSection = content.substring(startPos, endPos);
        const statusMatch = reqSection.match(statusPattern);

        if (statusMatch) {
          const status = statusMatch[1];
          if (status === 'IN_PROGRESS') {
            inProgressReqs.push(reqNumber);
          } else if (status === 'BLOCKED') {
            blockedReqs.push(reqNumber);
          }
        }
      }

      // 3. Recover IN_PROGRESS workflows
      console.log(`[StrategicOrchestrator] Found ${inProgressReqs.length} IN_PROGRESS workflows`);
      for (const reqId of inProgressReqs) {
        try {
          // Query NATS to see if workflow state exists
          const stateMsg = await this.nc.request(`agog.workflows.state.${reqId}`, '', { timeout: 1000 });
          const state = JSON.parse(stateMsg.string());
          console.log(`[StrategicOrchestrator] ✅ Workflow ${reqId} found in NATS, state: ${state.state}`);
          this.processedRequests.add(reqId);
        } catch (error) {
          // No state in NATS - restart workflow from beginning RIGHT NOW
          console.log(`[StrategicOrchestrator] ⚠️ Workflow ${reqId} not in NATS, restarting immediately...`);

          const { title, assignedTo } = this.extractRequestDetails(content, reqId);

          // Update status back to NEW so it gets picked up
          await this.updateRequestStatus(reqId, 'NEW', 'Recovery restart - no NATS state found');

          console.log(`[StrategicOrchestrator] ✅ Reset ${reqId} to NEW for restart`);
          // Don't add to processedRequests - let next scan pick it up as NEW
        }
      }

      // 4. Recover BLOCKED workflows and rebuild sub-requirement subscriptions
      console.log(`[StrategicOrchestrator] Found ${blockedReqs.length} BLOCKED workflows`);
      for (const reqId of blockedReqs) {
        try {
          // Query NATS for sub-requirement metadata
          const metadataMsg = await this.nc.request(`agog.workflows.sub-requirements.${reqId}`, '', { timeout: 1000 });
          const metadata = JSON.parse(metadataMsg.string());

          console.log(`[StrategicOrchestrator] Recovered ${metadata.totalCount} sub-requirements for ${reqId}`);
          console.log(`[StrategicOrchestrator] Progress: ${metadata.completedCount}/${metadata.totalCount} complete`);

          // Check if all sub-requirements already complete
          if (metadata.completedCount === metadata.totalCount) {
            console.log(`[StrategicOrchestrator] All sub-requirements complete, resuming ${reqId}`);
            await this.updateRequestStatus(reqId, 'IN_PROGRESS', 'Sub-requirements complete');
            // Don't add to processedRequests - let scanOwnerRequests handle resume
          } else {
            // Rebuild subscription to monitor remaining sub-requirements
            const subRequirements = metadata.subRequirements.map((subReqId: string) => ({ reqId: subReqId }));
            await this.subscribeToSubRequirementCompletions(reqId, subRequirements);
            this.processedRequests.add(reqId);
          }
        } catch (error) {
          console.error(`[StrategicOrchestrator] Failed to recover BLOCKED workflow ${reqId}:`, error);
          // Don't add to processedRequests - escalate on next scan if still blocked
        }
      }

      console.log(`[StrategicOrchestrator] ✅ Workflow recovery complete`);

    } catch (error: any) {
      console.error('[StrategicOrchestrator] Failed to recover workflows:', error.message);
    }
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

    // 1. Monitor OWNER_REQUESTS.md every 60 seconds
    const ownerRequestsInterval = setInterval(() => {
      if (this.isRunning) {
        this.scanOwnerRequests().catch((error) => {
          console.error('[StrategicOrchestrator] Error scanning OWNER_REQUESTS:', error);
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
    console.log('[StrategicOrchestrator] - Monitoring OWNER_REQUESTS.md every 60 seconds');
    console.log('[StrategicOrchestrator] - Monitoring IN_PROGRESS workflows every 30 seconds');
    console.log('[StrategicOrchestrator] - Checking workflow heartbeats every 2 minutes (Gap #5)');
    console.log('[StrategicOrchestrator] - Reconciling workflow states every 5 minutes (Gap #13)');
    console.log('[StrategicOrchestrator] - Subscribed to blocked workflow events');
    console.log('[StrategicOrchestrator] - Subscribed to workflow completion events (memory integration)');
    console.log('[StrategicOrchestrator] - Subscribed to new requirements (agog.requirements.new, agog.requirements.sub.new)');

    // Initial scan
    console.log('[StrategicOrchestrator] 🔄 Running initial scan...');
    try {
      await this.scanOwnerRequests();
      console.log('[StrategicOrchestrator] ✅ Initial scan complete');
    } catch (error: any) {
      console.error('[StrategicOrchestrator] ❌ Initial scan failed:', error.message);
      console.error('[StrategicOrchestrator] Stack:', error.stack);
    }
  }

  /**
   * Scan OWNER_REQUESTS.md for new features
   *
   * Status Management:
   * - NEW: Brand new requests, start from Stage 0 (Cynthia)
   * - PENDING: Recovery scenarios, check NATS for completed stages and resume from gap
   * - REJECTED: Testing failed, resume from testing stage (Billy) or first missing stage
   * - IN_PROGRESS: Already running, skip
   * - COMPLETE/BLOCKED: Skip
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

    if (!fs.existsSync(this.ownerRequestsPath)) {
      console.log(`[StrategicOrchestrator] OWNER_REQUESTS.md not found at ${this.ownerRequestsPath}`);
      return;
    }

    let content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');

    // Parse requests with their status (allow blank line between title and status)
    const requestPattern = /###\s+(REQ-[A-Z-]+-\d+):[^\n]*\n+\*\*Status\*\*:\s*(\w+)/g;
    let match;
    const requests: Array<{ reqNumber: string; status: string }> = [];

    while ((match = requestPattern.exec(content)) !== null) {
      console.log(`[StrategicOrchestrator] Found request: ${match[1]} - Status: ${match[2]}`);
      requests.push({
        reqNumber: match[1],
        status: match[2].toUpperCase(),
      });
    }

    console.log(`[StrategicOrchestrator] Total requests found: ${requests.length}`);

    // Gap Fix #12: Check concurrent workflow limit before processing new workflows
    const activeWorkflows = requests.filter(r => r.status === 'IN_PROGRESS').length;
    if (activeWorkflows >= this.MAX_CONCURRENT_WORKFLOWS) {
      console.log(`[StrategicOrchestrator] Concurrency limit reached: ${activeWorkflows}/${this.MAX_CONCURRENT_WORKFLOWS} workflows active - skipping new starts`);
    }

    for (const { reqNumber, status } of requests) {
      // Only process NEW, PENDING, or REJECTED requests
      if (status !== 'NEW' && status !== 'PENDING' && status !== 'REJECTED') {
        continue;
      }

      // Gap Fix #12: Enforce concurrency limit - don't start new workflows if at max
      if (status === 'NEW') {
        const currentActive = requests.filter(r => r.status === 'IN_PROGRESS').length;
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

      console.log(`[StrategicOrchestrator] 🆕 ${status} request detected: ${reqNumber}`);

      // Extract feature title
      const { title, assignedTo } = this.extractRequestDetails(content, reqNumber);

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

      // Start specialist workflow via orchestrator
      try {
        if (startStage === 0) {
          // Start from beginning
          await this.orchestrator.startWorkflow(reqNumber, title, assignedTo);
          await this.persistence.createWorkflow({ reqNumber, title, assignedTo, currentStage: 0 });
        } else {
          // Resume from specific stage
          await this.orchestrator.resumeWorkflowFromStage(reqNumber, title, assignedTo, startStage);
          await this.persistence.createWorkflow({ reqNumber, title, assignedTo, currentStage: startStage });
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
   * Update request status in OWNER_REQUESTS.md
   * Returns true if successful, false if failed
   */
  private async updateRequestStatus(reqNumber: string, newStatus: string, reason?: string): Promise<boolean> {
    try {
      let content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');

      // Find and replace status line for this request (allow blank lines)
      const statusPattern = new RegExp(
        `(###\\s+${reqNumber}:[^\\n]*\\n+\\*\\*Status\\*\\*:\\s*)\\w+`,
        'g'
      );

      const newContent = content.replace(statusPattern, `$1${newStatus}`);

      // Verify the replacement actually happened
      if (newContent === content) {
        console.error(`[StrategicOrchestrator] Status pattern not found for ${reqNumber}`);
        return false;
      }

      fs.writeFileSync(this.ownerRequestsPath, newContent, 'utf-8');

      // Verify write was successful by reading back
      const verifyContent = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
      const verified = verifyContent.includes(`${reqNumber}`) && verifyContent.includes(`**Status**: ${newStatus}`);

      if (verified) {
        const logMessage = reason
          ? `✅ Updated ${reqNumber} status to ${newStatus} (${reason})`
          : `✅ Updated ${reqNumber} status to ${newStatus}`;
        console.log(`[StrategicOrchestrator] ${logMessage}`);
        return true;
      } else {
        console.error(`[StrategicOrchestrator] ❌ Failed to verify status update for ${reqNumber}`);
        return false;
      }
    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to update status for ${reqNumber}:`, error.message);
      return false;
    }
  }

  /**
   * Extract request details from OWNER_REQUESTS.md
   */
  private extractRequestDetails(content: string, reqNumber: string): { title: string; assignedTo: string } {
    // Find the section for this request
    const reqPattern = new RegExp(`${reqNumber}[:\\s]*([^\\n]+)`, 'i');
    const match = content.match(reqPattern);

    const title = match ? match[1].trim() : 'Untitled Feature';

    // Determine assignedTo based on reqNumber prefix
    const assignedTo = this.routeToStrategicAgent(reqNumber);

    return { title, assignedTo };
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

          // Only handle Critique stage blocks
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
   * This is the MISSING LOGIC that makes workflows actually progress
   */
  private async progressInProgressWorkflows(): Promise<void> {
    if (!fs.existsSync(this.ownerRequestsPath)) {
      return;
    }

    const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
    const requestPattern = /###\s+(REQ-[A-Z-]+-\d+):[^\n]*\n+\*\*Status\*\*:\s*IN_PROGRESS/g;
    let match;

    while ((match = requestPattern.exec(content)) !== null) {
      const reqNumber = match[1];

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

          // Extract title
          const { title, assignedTo } = this.extractRequestDetails(content, reqNumber);

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

            // Get parent requirement details from OWNER_REQUESTS.md
            const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
            const { title, assignedTo } = this.extractRequestDetails(content, parentReqId);

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
   */
  private async checkWorkflowHeartbeats(): Promise<void> {
    if (!fs.existsSync(this.ownerRequestsPath)) {
      return;
    }

    const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
    const reqPattern = /### (REQ-[A-Z0-9-]+):/g;
    const statusPattern = /\*\*Status\*\*:\s*(\w+)/;

    let match;
    const now = Date.now();
    const MAX_WORKFLOW_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
    const HEARTBEAT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    while ((match = reqPattern.exec(content)) !== null) {
      const reqNumber = match[1];
      const startPos = match.index;
      const nextMatch = reqPattern.exec(content);
      const endPos = nextMatch ? nextMatch.index : content.length;
      reqPattern.lastIndex = nextMatch ? nextMatch.index : content.length;

      const reqSection = content.substring(startPos, endPos);
      const statusMatch = reqSection.match(statusPattern);

      if (!statusMatch || statusMatch[1] !== 'IN_PROGRESS') {
        continue;
      }

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
   * Gap Fix #13: Reconcile workflow states between OWNER_REQUESTS.md and NATS
   */
  private async reconcileWorkflowStates(): Promise<void> {
    if (!fs.existsSync(this.ownerRequestsPath)) {
      return;
    }

    const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
    const reqPattern = /### (REQ-[A-Z0-9-]+):/g;
    const statusPattern = /\*\*Status\*\*:\s*(\w+)/;

    let match;
    const reconciliations = [];

    while ((match = reqPattern.exec(content)) !== null) {
      const reqNumber = match[1];
      const startPos = match.index;
      const nextMatch = reqPattern.exec(content);
      const endPos = nextMatch ? nextMatch.index : content.length;
      reqPattern.lastIndex = nextMatch ? nextMatch.index : content.length;

      const reqSection = content.substring(startPos, endPos);
      const statusMatch = reqSection.match(statusPattern);

      if (!statusMatch) {
        continue;
      }

      const fileStatus = statusMatch[1];

      try {
        // Query NATS for workflow state
        const stateMsg = await this.nc.request(`agog.workflows.state.${reqNumber}`, '', { timeout: 1000 });
        const natsState = JSON.parse(stateMsg.string());

        // Compare states
        if (fileStatus !== natsState.state) {
          console.warn(`[StrategicOrchestrator] ⚠️ State mismatch for ${reqNumber}: File=${fileStatus}, NATS=${natsState.state}`);

          // NATS is source of truth - update file to match
          if (natsState.state === 'COMPLETE' && fileStatus !== 'COMPLETE') {
            console.log(`[StrategicOrchestrator] Reconciling ${reqNumber}: NATS shows COMPLETE, updating file`);
            await this.updateRequestStatus(reqNumber, 'COMPLETE', 'Reconciled from NATS');
            reconciliations.push({ reqNumber, from: fileStatus, to: 'COMPLETE' });
          } else if (natsState.state === 'IN_PROGRESS' && fileStatus === 'NEW') {
            console.log(`[StrategicOrchestrator] Reconciling ${reqNumber}: NATS shows IN_PROGRESS, updating file`);
            await this.updateRequestStatus(reqNumber, 'IN_PROGRESS', 'Reconciled from NATS');
            reconciliations.push({ reqNumber, from: fileStatus, to: 'IN_PROGRESS' });
          } else if (natsState.state === 'BLOCKED' && fileStatus === 'IN_PROGRESS') {
            console.log(`[StrategicOrchestrator] Reconciling ${reqNumber}: NATS shows BLOCKED, updating file`);
            await this.updateRequestStatus(reqNumber, 'BLOCKED', 'Reconciled from NATS');
            reconciliations.push({ reqNumber, from: fileStatus, to: 'BLOCKED' });
          }
        }

      } catch (error) {
        // No NATS state - file might be authoritative
        if (fileStatus === 'IN_PROGRESS') {
          console.warn(`[StrategicOrchestrator] ⚠️ File shows IN_PROGRESS for ${reqNumber} but no NATS state exists`);
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
