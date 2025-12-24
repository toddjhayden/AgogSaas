import { connect, NatsConnection, JetStreamClient, StorageType, RetentionPolicy, StreamConfig, DiscardPolicy } from 'nats';
import { AgentSpawnerService } from './agent-spawner.service';
import { OrchestratorService } from './orchestrator.service';
import { MCPMemoryClient } from '../mcp/mcp-client.service';
import { Pool } from 'pg';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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

  // Path to OWNER_REQUESTS.md file
  // In Docker: /workspace/project-spirit/owner_requests/OWNER_REQUESTS.md
  // Local dev: relative to backend directory
  private ownerRequestsPath = process.env.OWNER_REQUESTS_PATH ||
    path.join(__dirname, '..', '..', '..', '..', 'project-spirit', 'owner_requests', 'OWNER_REQUESTS.md');

  // Track which requests have been processed
  private processedRequests: Set<string> = new Set();

  // Track running workflow monitoring
  private isRunning = false;

  async initialize(): Promise<void> {
    // CRITICAL: Validate environment first to fail fast on misconfiguration
    await this.validateEnvironment();

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

    console.log('[StrategicOrchestrator] ✅ Initialized successfully (with memory integration)');
  }

  /**
   * Validate environment configuration on startup
   * CRITICAL FIX: Fail fast with clear errors on misconfiguration
   */
  private async validateEnvironment(): Promise<void> {
    console.log('[StrategicOrchestrator] Validating environment configuration...');

    const errors: string[] = [];

    // 1. Validate OWNER_REQUESTS.md exists
    if (!fs.existsSync(this.ownerRequestsPath)) {
      errors.push(`OWNER_REQUESTS.md not found at: ${this.ownerRequestsPath}`);
      errors.push(`  Set OWNER_REQUESTS_PATH environment variable to correct path`);
    } else {
      console.log(`  ✅ OWNER_REQUESTS.md found at: ${this.ownerRequestsPath}`);
    }

    // 2. Validate NATS connection
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    try {
      const testNc = await connect({ servers: natsUrl, timeout: 5000 });
      await testNc.close();
      console.log(`  ✅ NATS reachable at: ${natsUrl}`);
    } catch (error: any) {
      errors.push(`NATS connection failed: ${natsUrl}`);
      errors.push(`  Error: ${error.message}`);
      errors.push(`  Set NATS_URL environment variable or ensure NATS is running`);
    }

    // 3. Validate Database connection
    const dbUrl = process.env.DATABASE_URL || 'postgresql://agogsaas_user:changeme@localhost:5433/agogsaas';
    try {
      const testPool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });
      const result = await testPool.query('SELECT 1');
      await testPool.end();
      console.log(`  ✅ Database reachable`);
    } catch (error: any) {
      errors.push(`Database connection failed`);
      errors.push(`  Error: ${error.message}`);
      errors.push(`  Check DATABASE_URL environment variable`);
    }

    // 4. Validate Ollama (optional but warn if unavailable)
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    try {
      await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
      console.log(`  ✅ Ollama reachable at: ${ollamaUrl}`);
    } catch (error: any) {
      console.warn(`  ⚠️  Ollama not reachable at: ${ollamaUrl}`);
      console.warn(`     Memory system will work but without semantic search`);
      console.warn(`     Start Ollama or set OLLAMA_URL environment variable`);
    }

    // 5. Validate agent files exist
    const requiredAgents = ['cynthia', 'sylvia', 'roy', 'jen', 'billy', 'priya'];
    const possibleAgentsDirs = [
      process.env.AGENTS_DIR,
      path.join(process.cwd(), '..', '..', '..', '.claude', 'agents'),
      path.join(process.cwd(), '.claude', 'agents'),
    ].filter(Boolean) as string[];

    let agentsDirFound = false;
    for (const agentsDir of possibleAgentsDirs) {
      if (fs.existsSync(agentsDir)) {
        let missingAgents = 0;
        for (const agentId of requiredAgents) {
          const files = fs.readdirSync(agentsDir);
          const matches = files.filter(f => f.startsWith(`${agentId}-`) && f.endsWith('.md'));
          if (matches.length === 0) {
            errors.push(`  Missing agent file: ${agentId}-*.md in ${agentsDir}`);
            missingAgents++;
          }
        }

        if (missingAgents === 0) {
          console.log(`  ✅ All ${requiredAgents.length} agent files found in ${agentsDir}`);
          agentsDirFound = true;
          break;
        }
      }
    }

    if (!agentsDirFound) {
      errors.push(`Agents directory not found. Searched: ${possibleAgentsDirs.join(', ')}`);
      errors.push(`  Set AGENTS_DIR environment variable or ensure .claude/agents/ exists`);
    }

    // FAIL FAST if critical errors
    if (errors.length > 0) {
      console.error('\n❌ ENVIRONMENT VALIDATION FAILED:\n');
      for (const error of errors) {
        console.error(`   ${error}`);
      }
      console.error('\n💡 Fix the above errors before starting the orchestrator\n');
      throw new Error('Environment validation failed - check logs above');
    }

    console.log('[StrategicOrchestrator] ✅ Environment validation passed\n');
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

    // 2. Subscribe to blocked workflow events
    this.subscribeToBlockedWorkflows().catch((error) => {
      console.error('[StrategicOrchestrator] Error in blocked workflow subscription:', error);
    });

    // 3. Subscribe to workflow completion events for memory storage
    this.subscribeToWorkflowCompletions().catch((error) => {
      console.error('[StrategicOrchestrator] Error in workflow completion subscription:', error);
    });

    console.log('[StrategicOrchestrator] ✅ Daemon running');
    console.log('[StrategicOrchestrator] - Monitoring OWNER_REQUESTS.md every 60 seconds');
    console.log('[StrategicOrchestrator] - Subscribed to blocked workflow events');
    console.log('[StrategicOrchestrator] - Subscribed to workflow completion events (memory integration)');

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
    console.log(`[StrategicOrchestrator] 🔍 Scanning OWNER_REQUESTS.md...`);

    if (!fs.existsSync(this.ownerRequestsPath)) {
      console.log(`[StrategicOrchestrator] ❌ OWNER_REQUESTS.md not found at ${this.ownerRequestsPath}`);
      return;
    }

    console.log(`[StrategicOrchestrator] ✅ File found at ${this.ownerRequestsPath}`);

    let content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');

    // Parse requests with their status
    const requestPattern = /###\s+(REQ-[A-Z-]+-\d+):[^\n]*\n\*\*Status\*\*:\s*(\w+)/g;
    let match;
    const requests: Array<{ reqNumber: string; status: string }> = [];

    while ((match = requestPattern.exec(content)) !== null) {
      requests.push({
        reqNumber: match[1],
        status: match[2].toUpperCase(),
      });
    }

    for (const { reqNumber, status } of requests) {
      // Only process NEW, PENDING, or REJECTED requests
      if (status !== 'NEW' && status !== 'PENDING' && status !== 'REJECTED') {
        continue;
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

      // CRITICAL FIX: Mark as processed IMMEDIATELY to prevent race conditions
      // This prevents duplicate workflow spawns if scanOwnerRequests() runs again before workflow starts
      this.processedRequests.add(reqNumber);
      console.log(`[StrategicOrchestrator] 🆕 ${status} request detected: ${reqNumber} (marked as processed)`);

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
        } else {
          // Resume from specific stage
          await this.orchestrator.resumeWorkflowFromStage(reqNumber, title, assignedTo, startStage);
        }
        console.log(`[StrategicOrchestrator] ✅ Workflow started for ${reqNumber} from stage ${startStage + 1}`);
      } catch (error: any) {
        console.error(`[StrategicOrchestrator] Failed to start workflow for ${reqNumber}:`, error.message);

        // CRITICAL: Remove from processed set to allow retry
        this.processedRequests.delete(reqNumber);

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
  private async updateRequestStatus(reqNumber: string, newStatus: string): Promise<boolean> {
    try {
      let content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');

      // Find and replace status line for this request
      const statusPattern = new RegExp(
        `(###\\s+${reqNumber}:[^\\n]*\\n\\*\\*Status\\*\\*:\\s*)\\w+`,
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
        console.log(`[StrategicOrchestrator] ✅ Updated ${reqNumber} status to ${newStatus}`);
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
   * Handle a blocked critique from Sylvia
   */
  private async handleBlockedCritique(event: any): Promise<void> {
    const { reqNumber, reason, blockers } = event;

    console.log(`[StrategicOrchestrator] Handling blocked critique for ${reqNumber}`);
    console.log(`[StrategicOrchestrator] Reason: ${reason}`);

    // Determine which strategic agent owns this feature
    const strategicAgent = this.routeToStrategicAgent(reqNumber);
    console.log(`[StrategicOrchestrator] Routing to strategic agent: ${strategicAgent}`);

    try {
      // Get strategic context from past memories
      const featureTitle = event.title || reqNumber;
      const memoryContext = await this.getStrategicContext(reqNumber, featureTitle);

      // Fetch Sylvia's critique deliverable from NATS (if available)
      // For now, we'll use the event data directly
      const critiqueContext = {
        reqNumber,
        blockedReason: reason,
        blockers: blockers || [],
        eventData: event,
        memoryContext, // Include past learnings
      };

      // Spawn strategic agent to make a decision
      const decision = await this.agentSpawner.spawnAgent({
        agentId: strategicAgent,
        reqNumber,
        featureTitle: `Review Blocked Critique: ${reqNumber}`,
        contextData: critiqueContext,
        timeoutMs: 600000, // 10 minutes for strategic decision
      });

      // Publish decision to NATS
      await this.js.publish(
        `agog.strategic.decisions.${reqNumber}`,
        JSON.stringify(decision)
      );

      console.log(`[StrategicOrchestrator] Strategic decision: ${(decision as any).decision || 'APPROVE'}`);

      // Apply the decision (cast to StrategicDecision)
      await this.applyStrategicDecision(decision as unknown as StrategicDecision);

    } catch (error: any) {
      console.error(`[StrategicOrchestrator] Failed to handle blocked critique for ${reqNumber}:`, error.message);

      // Escalate to human on error
      await this.publishEscalation({
        req_number: reqNumber,
        priority: 'NEEDS_HUMAN_DECISION',
        reason: `Strategic agent failed: ${error.message}`,
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
      const stages = ['research', 'critique', 'backend', 'frontend', 'qa', 'statistics'];

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

    if (this.agentSpawner) {
      await this.agentSpawner.close();
    }

    if (this.orchestrator) {
      await this.orchestrator.close();
    }

    if (this.nc) {
      await this.nc.close();
    }

    console.log('[StrategicOrchestrator] ✅ Closed (including memory client)');
  }
}
