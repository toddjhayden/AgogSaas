/**
 * Senior Auditor Daemon (Sam)
 *
 * Runs comprehensive system-wide audits:
 * - At startup (when this daemon starts)
 * - Daily at 2:00 AM
 * - On-demand via NATS trigger
 *
 * NOT part of the normal REQ workflow.
 * Publishes audit requests to NATS for Host Listener to spawn Claude.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connect, NatsConnection, StringCodec, Subscription } from 'nats';
import { Pool } from 'pg';
import { SDLCApiClient, SDLCApiClientConfig, CreateRequestInput } from '../api/sdlc-api.client';

const sc = StringCodec();

// Configuration
const CONFIG = {
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  natsUser: process.env.NATS_USER,
  natsPassword: process.env.NATS_PASSWORD,
  auditTimeout: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  dailyRunHour: 2, // 2:00 AM
  triggerSubject: 'agog.audit.sam.run',
  requestSubject: 'agog.agent.requests.sam-audit', // Request to Host Listener
  responseSubject: 'agog.agent.responses.sam-audit', // Response from Host Listener
  resultSubject: 'agog.audit.sam.result',
  // Sasha - Workflow Infrastructure Support
  // For workflow rule questions or infrastructure issues, contact Sasha via NATS
  sashaRulesTopic: 'agog.agent.requests.sasha-rules',
};

interface AuditResult {
  agent: string;
  audit_type: 'startup' | 'daily' | 'manual';
  timestamp: string;
  duration_minutes: number;
  overall_status: 'PASS' | 'WARNING' | 'FAIL';
  deployment_blocked: boolean;
  block_reasons: string[];
  recommendations: string[];
}

class SeniorAuditorDaemon {
  private nc: NatsConnection | null = null;
  private db: Pool | null = null;
  private sdlcClient: SDLCApiClient | null = null;
  private isRunning = false;
  private dailyTimer: NodeJS.Timeout | null = null;
  private responseSubscription: Subscription | null = null;
  private pendingAudits: Map<string, { auditType: string; startTime: number; resolve: (result: AuditResult) => void }> = new Map();

  /**
   * Request Sasha for workflow rule guidance
   * Use this when encountering situations that may violate WORKFLOW_RULES.md
   */
  private async askSashaForGuidance(question: string, context: string): Promise<void> {
    if (!this.nc) return;
    try {
      const request = {
        requestingAgent: 'sam-auditor',
        question,
        context,
        timestamp: new Date().toISOString()
      };
      this.nc.publish(CONFIG.sashaRulesTopic, sc.encode(JSON.stringify(request)));
      console.log(`[Sam] 📨 Asked Sasha: ${question}`);
    } catch (error: any) {
      console.error(`[Sam] Failed to ask Sasha: ${error.message}`);
    }
  }

  async start(): Promise<void> {
    console.log('[Sam] Senior Auditor Daemon starting...');

    // Connect to SDLC API (REQUIRED - Sam creates REQs in SDLC)
    const sdlcApiUrl = process.env.SDLC_API_URL;
    if (sdlcApiUrl) {
      this.sdlcClient = new SDLCApiClient({
        baseUrl: sdlcApiUrl,
        agentId: process.env.SDLC_AGENT_ID || 'sam-auditor',
      });
      const healthy = await this.sdlcClient.healthCheck();
      if (healthy) {
        console.log(`[Sam] Connected to SDLC API at ${sdlcApiUrl}`);
      } else {
        console.warn('[Sam] SDLC API health check failed - REQs may not sync properly');
      }
    } else {
      console.warn('[Sam] No SDLC_API_URL configured - REQs will only be created locally');
    }

    // Connect to agent_memory database (REQUIRED - Sam stores audit results here)
    this.db = new Pool({
      host: process.env.AGENT_DB_HOST || 'localhost',
      port: parseInt(process.env.AGENT_DB_PORT || '5434'),
      database: process.env.AGENT_DB_NAME || 'agent_memory',
      user: process.env.AGENT_DB_USER || 'postgres',
      password: process.env.AGENT_DB_PASSWORD || 'postgres',
    });
    await this.db.query('SELECT 1'); // Test connection
    console.log('[Sam] Connected to agent_memory database');

    // Ensure audit table exists
    await this.ensureAuditTable();

    // Connect to NATS (REQUIRED - Sam publishes to NATS for Host Listener)
    this.nc = await connect({
      servers: CONFIG.natsUrl,
      user: CONFIG.natsUser,
      pass: CONFIG.natsPassword,
    });
    console.log(`[Sam] Connected to NATS at ${CONFIG.natsUrl}`);

    // Subscribe to manual trigger
    if (this.nc) {
      const sub = this.nc.subscribe(CONFIG.triggerSubject);
      (async () => {
        for await (const msg of sub) {
          const payload = sc.decode(msg.data);
          console.log(`[Sam] Manual audit triggered: ${payload}`);
          await this.runAudit('manual');
        }
      })();
      console.log(`[Sam] Listening for manual triggers on ${CONFIG.triggerSubject}`);

      // Subscribe to audit responses from Host Listener
      this.responseSubscription = this.nc.subscribe(CONFIG.responseSubject);
      (async () => {
        for await (const msg of this.responseSubscription!) {
          await this.handleAuditResponse(msg);
        }
      })();
      console.log(`[Sam] Listening for audit responses on ${CONFIG.responseSubject}`);
    }

    // Schedule daily run
    this.scheduleDailyRun();

    // Run startup audit
    console.log('[Sam] Running startup audit...');
    await this.runAudit('startup');
  }

  private scheduleDailyRun(): void {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(CONFIG.dailyRunHour, 0, 0, 0);

    // If we've passed today's run time, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();
    console.log(`[Sam] Next daily audit scheduled for ${nextRun.toISOString()}`);

    this.dailyTimer = setTimeout(async () => {
      console.log('[Sam] Running daily audit...');
      await this.runAudit('daily');
      // Reschedule for next day
      this.scheduleDailyRun();
    }, msUntilNextRun);
  }

  async runAudit(auditType: 'startup' | 'daily' | 'manual'): Promise<void> {
    if (this.isRunning) {
      console.log('[Sam] Audit already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const reqNumber = `REQ-AUDIT-${Date.now()}`;

    console.log(`[Sam] Starting ${auditType} audit at ${new Date().toISOString()}`);

    try {
      // Publish audit request to NATS for Host Listener to spawn Claude
      const auditRequest = {
        reqNumber,
        auditType,
        timestamp: new Date().toISOString(),
        requestedBy: 'sam-daemon',
      };

      console.log(`[Sam] Publishing audit request to ${CONFIG.requestSubject}`);
      this.nc!.publish(CONFIG.requestSubject, sc.encode(JSON.stringify(auditRequest)));

      // Wait for response with timeout
      const result = await this.waitForAuditResponse(reqNumber, auditType, startTime);

      // Calculate duration
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);
      result.duration_minutes = durationMinutes;

      console.log(`[Sam] ${auditType} audit completed in ${durationMinutes} minutes`);

      // Save audit summary to database
      await this.saveAuditToDatabase(result);

      // Create REQs for any issues found
      if (result.recommendations && result.recommendations.length > 0) {
        await this.createRequirementsForIssues(result);
      }

      // Trigger UI testing REQ generation for Liz
      await this.triggerUITesting(result);

      // Publish final result to NATS
      if (this.nc) {
        this.nc.publish(CONFIG.resultSubject, sc.encode(JSON.stringify(result)));
        console.log(`[Sam] Result published to ${CONFIG.resultSubject}`);
      }

      // Log summary
      console.log(`[Sam] Overall Status: ${result.overall_status}`);
      if (result.deployment_blocked) {
        console.error('[Sam] DEPLOYMENT BLOCKED');
        result.block_reasons.forEach((r) => console.error(`  - ${r}`));
      }
    } catch (error) {
      console.error(`[Sam] Audit failed:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  private waitForAuditResponse(
    reqNumber: string,
    auditType: string,
    startTime: number
  ): Promise<AuditResult> {
    return new Promise((resolve) => {
      // Store pending audit info
      this.pendingAudits.set(reqNumber, { auditType, startTime, resolve });

      // Set timeout for audit completion
      setTimeout(async () => {
        if (this.pendingAudits.has(reqNumber)) {
          const durationMinutes = Math.round((Date.now() - startTime) / 1000 / 60);
          console.warn(`[Sam] 🚨 AUDIT TIMEOUT: ${reqNumber} timed out after ${durationMinutes} minutes (limit: ${CONFIG.auditTimeout / 1000 / 60}min)`);
          this.pendingAudits.delete(reqNumber);

          // Create P0 manual review REQ for timeout investigation
          await this.createManualReviewREQ(reqNumber, auditType, durationMinutes);

          // Return a default timeout result
          resolve({
            agent: 'sam',
            audit_type: auditType as 'startup' | 'daily' | 'manual',
            timestamp: new Date().toISOString(),
            duration_minutes: durationMinutes,
            overall_status: 'WARNING',
            deployment_blocked: false,
            block_reasons: [],
            recommendations: [
              `CRITICAL: Audit timed out after ${durationMinutes} minutes - manual review required`,
              'System audit may have encountered long-running queries or infrastructure issues',
              'Check agent-backend/logs for audit process errors',
              'Review database query performance and connection health'
            ],
          });
        }
      }, CONFIG.auditTimeout);
    });
  }

  /**
   * Create a P0 manual review REQ when an audit times out
   * This ensures timeout scenarios are investigated and resolved
   */
  private async createManualReviewREQ(
    auditReqNumber: string,
    auditType: string,
    durationMinutes: number
  ): Promise<void> {
    if (!this.nc) {
      console.error('[Sam] No NATS connection, cannot create manual review REQ');
      return;
    }

    const reqNumber = `REQ-P0-AUDIT-TIMEOUT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const title = `Audit timed out - manual review required (${auditReqNumber})`;
    const description = `
## P0 Audit Timeout - Manual Review Required

**Severity:** catastrophic - IMMEDIATE INVESTIGATION REQUIRED
**Original Audit:** ${auditReqNumber}
**Audit Type:** ${auditType}
**Timeout After:** ${durationMinutes} minutes (limit: ${CONFIG.auditTimeout / 1000 / 60}min)
**Created:** ${new Date().toISOString()}

### Problem
The system-wide audit initiated by Sam (Senior Auditor) timed out after ${durationMinutes} minutes.
This indicates either:
1. Long-running database queries in security audit service
2. Infrastructure performance issues
3. Agent process hung or crashed
4. Network connectivity problems to database or NATS

### Impact
- System health status unknown
- Potential security vulnerabilities undetected
- Deployment confidence reduced
- Automated quality gates bypassed

### Investigation Steps
1. Check agent-backend logs for errors during audit window
2. Review database query logs for slow queries (>10s)
3. Verify NATS message broker connectivity and health
4. Check system resource usage (CPU, memory, disk) during audit
5. Manually re-run audit to determine if issue persists

### Acceptance Criteria
- [ ] Root cause of timeout identified and documented
- [ ] Infrastructure issue resolved (if applicable)
- [ ] Audit timeout threshold adjusted if needed (${CONFIG.auditTimeout}ms)
- [ ] Manual audit completed successfully
- [ ] Preventive measures implemented

### Files to Review
- \`agent-backend/src/proactive/senior-auditor.daemon.ts\` (timeout config: line 26)
- \`backend/src/modules/security/services/security-audit.service.ts\` (query timeouts)
- \`agent-backend/logs/host-listener-*.log\` (audit spawn logs)
- \`backend/audit-reports/\` (previous audit results)

### Recommended Actions
1. Increase audit timeout if audits consistently need >2 hours
2. Optimize slow database queries in security audit service
3. Add query timeout monitoring and alerting
4. Implement audit checkpointing for long-running audits
5. Add audit progress reporting to prevent silent timeouts
    `.trim();

    // STEP 1: Create REQ in SDLC first (source of truth)
    if (this.sdlcClient) {
      const sdlcInput: CreateRequestInput = {
        reqNumber,
        title,
        description,
        requestType: 'bug',
        priority: 'catastrophic',
        primaryBu: 'core-infra',
        assignedTo: 'marcus',
        source: 'sam-audit-timeout',
        tags: ['p0', 'audit', 'timeout', auditType],
      };

      const created = await this.sdlcClient.createRequest(sdlcInput);
      if (created) {
        console.log(`[Sam] ✅ Created timeout REQ in SDLC: ${reqNumber}`);
      } else {
        console.error(`[Sam] ❌ Failed to create timeout REQ in SDLC: ${reqNumber}`);
        // Continue anyway - still publish to NATS for visibility
      }
    }

    // STEP 2: Publish P0 manual review REQ to NATS
    const reqPayload = {
      req_number: reqNumber,
      title,
      priority: 'catastrophic',
      source: 'sam-audit-timeout',
      audit_type: auditType,
      assigned_to: 'marcus',
      status: 'NEW',
      created_at: new Date().toISOString(),
      description,
    };

    this.nc!.publish('agog.requirements.p0.new', sc.encode(JSON.stringify(reqPayload)));
    console.log(`[Sam] 🚨 Created P0 manual review REQ: ${reqNumber} for audit timeout`);

    // Also publish to orchestrator timeout stream for visibility
    this.nc!.publish('agog.orchestrator.timeout', JSON.stringify({
      eventType: 'audit.timeout',
      auditReqNumber,
      manualReviewReqNumber: reqNumber,
      auditType,
      durationMinutes,
      timestamp: new Date().toISOString(),
      severity: 'P0',
    }));
  }

  private async handleAuditResponse(msg: any): Promise<void> {
    try {
      const response = JSON.parse(sc.decode(msg.data));
      console.log(`[Sam] Received audit response for ${response.req_number}`);

      const pending = this.pendingAudits.get(response.req_number);
      if (pending) {
        this.pendingAudits.delete(response.req_number);

        // Convert response to AuditResult format
        const result: AuditResult = {
          agent: 'sam',
          audit_type: pending.auditType as 'startup' | 'daily' | 'manual',
          timestamp: response.timestamp || new Date().toISOString(),
          duration_minutes: Math.round((Date.now() - pending.startTime) / 1000 / 60),
          overall_status: response.overall_status || 'WARNING',
          deployment_blocked: response.deployment_blocked || false,
          block_reasons: response.block_reasons || [],
          recommendations: response.recommendations || [],
        };

        pending.resolve(result);
      } else {
        console.warn(`[Sam] Received response for unknown audit: ${response.req_number}`);
      }
    } catch (error) {
      console.error('[Sam] Failed to parse audit response:', error);
    }
  }

  private async ensureAuditTable(): Promise<void> {
    if (!this.db) return;

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS system_health_audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_type VARCHAR(20) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        duration_minutes INTEGER,
        overall_status VARCHAR(20) NOT NULL,
        issues_found INTEGER DEFAULT 0,
        reqs_created INTEGER DEFAULT 0,
        deployment_blocked BOOLEAN DEFAULT false,
        block_reasons JSONB DEFAULT '[]'
      )
    `);
    console.log('[Sam] Audit table ready');
  }

  private async saveAuditToDatabase(result: AuditResult): Promise<void> {
    if (!this.db) {
      console.warn('[Sam] No database connection, skipping save');
      return;
    }

    try {
      await this.db.query(
        `INSERT INTO system_health_audits
         (audit_type, duration_minutes, overall_status, issues_found, reqs_created, deployment_blocked, block_reasons)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          result.audit_type,
          result.duration_minutes,
          result.overall_status,
          result.recommendations?.length || 0,
          result.recommendations?.length || 0, // Creating 1 REQ per issue
          result.deployment_blocked,
          JSON.stringify(result.block_reasons || []),
        ]
      );
      console.log('[Sam] Audit summary saved to database');
    } catch (error) {
      console.error('[Sam] Failed to save audit to database:', error);
    }
  }

  private async createRequirementsForIssues(result: AuditResult): Promise<void> {
    if (!this.nc) {
      console.error('[Sam] No NATS connection, cannot create requirements');
      return;
    }

    // Map audit priority labels to SDLC priority values
    const priorityMap: Record<string, string> = {
      CRITICAL: 'catastrophic',  // CRITICAL = catastrophic (highest priority)
      HIGH: 'critical',
      MEDIUM: 'high',
      LOW: 'medium',
    };

    let createdCount = 0;

    for (const recommendation of result.recommendations || []) {
      // Parse priority from recommendation (e.g., "CRITICAL: Fix...")
      const priorityMatch = recommendation.match(/^(CRITICAL|HIGH|MEDIUM|LOW):/i);
      const priority = priorityMatch ? priorityMap[priorityMatch[1].toUpperCase()] : 'high';
      const title = priorityMatch ? recommendation.replace(/^(CRITICAL|HIGH|MEDIUM|LOW):\s*/i, '') : recommendation;

      // Determine agent assignment based on issue type
      const assignedAgent = this.getAgentForIssue(title);

      const reqNumber = `REQ-P0-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const description = `
## P0 Issue Found by Sam (Senior Auditor)

**Severity:** ${priority} - HIGHEST PRIORITY
**Audit Type:** ${result.audit_type}
**Audit Date:** ${result.timestamp}
**Assigned To:** ${assignedAgent}

### Problem
${recommendation}

### Source
This P0 requirement was automatically created by Sam during a system-wide audit.
P0 issues BLOCK ALL OTHER WORK until resolved.

### Acceptance Criteria
- [ ] Issue is resolved
- [ ] Build passes: npm run build exits with code 0
- [ ] Verified by re-running Sam audit
      `.trim();

      // STEP 1: Create REQ in SDLC first (source of truth)
      if (this.sdlcClient) {
        const sdlcInput: CreateRequestInput = {
          reqNumber,
          title: title.slice(0, 200),
          description,
          requestType: 'bug',
          priority,
          primaryBu: 'core-infra',
          assignedTo: assignedAgent,
          source: 'sam-audit',
          tags: ['p0', 'audit', result.audit_type],
        };

        const created = await this.sdlcClient.createRequest(sdlcInput);
        if (created) {
          console.log(`[Sam] ✅ Created REQ in SDLC: ${reqNumber}`);
        } else {
          console.error(`[Sam] ❌ Failed to create REQ in SDLC: ${reqNumber} - skipping`);
          continue; // Don't publish to NATS if SDLC creation failed
        }
      } else {
        console.warn(`[Sam] No SDLC client - REQ ${reqNumber} will only exist locally`);
      }

      // STEP 2: Publish to NATS for orchestrator
      const reqPayload = {
        req_number: reqNumber,
        title: title.slice(0, 200),
        priority,
        source: 'sam-audit',
        audit_type: result.audit_type,
        assigned_to: assignedAgent,
        status: 'NEW',
        created_at: new Date().toISOString(),
        description,
      };

      if (priority === 'catastrophic') {
        this.nc!.publish('agog.requirements.p0.new', sc.encode(JSON.stringify(reqPayload)));
        console.log(`[Sam] 🚨 Published P0 REQ: ${reqNumber} - ${title.slice(0, 50)}...`);

        // IMMEDIATELY spawn agent to fix P0 issue
        await this.spawnAgentForP0(assignedAgent, reqNumber, description);
      } else {
        this.nc!.publish('agog.requirements.new', sc.encode(JSON.stringify(reqPayload)));
        console.log(`[Sam] Published REQ: ${reqNumber} - ${title.slice(0, 50)}...`);
      }

      createdCount++;

      // Small delay between creating REQs to avoid flooding
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[Sam] Created ${createdCount} requirements for issues (P0s spawn agents immediately)`);
  }

  /**
   * Determine which agent should fix the issue based on the issue type
   */
  private getAgentForIssue(title: string): string {
    const lowered = title.toLowerCase();

    // Backend issues
    if (lowered.includes('backend') || lowered.includes('typescript') && lowered.includes('backend') ||
        lowered.includes('api') || lowered.includes('graphql resolver') ||
        lowered.includes('database') || lowered.includes('migration') ||
        lowered.includes('npm audit') && lowered.includes('backend') ||
        lowered.includes('.service.ts') || lowered.includes('.resolver.ts')) {
      return 'roy';
    }

    // Frontend issues
    if (lowered.includes('frontend') || lowered.includes('react') ||
        lowered.includes('component') || lowered.includes('page') ||
        lowered.includes('route') || lowered.includes('ui') ||
        lowered.includes('.tsx') || lowered.includes('vite')) {
      return 'jen';
    }

    // Security issues
    if (lowered.includes('security') || lowered.includes('vulnerability') ||
        lowered.includes('xss') || lowered.includes('sql injection') ||
        lowered.includes('secrets') || lowered.includes('rls')) {
      return 'vic';
    }

    // Test issues
    if (lowered.includes('test') || lowered.includes('e2e') ||
        lowered.includes('playwright') || lowered.includes('jest')) {
      return 'billy';
    }

    // i18n issues
    if (lowered.includes('i18n') || lowered.includes('translation') ||
        lowered.includes('locale')) {
      return 'jen';  // Frontend handles i18n
    }

    // Documentation issues
    if (lowered.includes('documentation') || lowered.includes('readme') ||
        lowered.includes('guide')) {
      return 'tim';
    }

    // Default to Roy for backend (most issues are backend-related)
    return 'roy';
  }

  /**
   * Immediately spawn an agent to fix a P0 issue
   * P0 issues don't wait in queue - they get worked on NOW
   */
  private async spawnAgentForP0(agent: string, reqNumber: string, context: string): Promise<void> {
    if (!this.nc) {
      console.error('[Sam] No NATS connection, cannot spawn agent');
      return;
    }

    const spawnRequest = {
      agent,
      req_number: reqNumber,
      priority: 'P0',
      model: 'opus',  // Use Opus for complex P0 fixes
      context: {
        issue: context,
        source: 'sam-audit',
        urgency: 'IMMEDIATE - P0 issue blocks all other work',
      },
      spawned_by: 'sam-senior-auditor',
      timestamp: new Date().toISOString(),
    };

    // Publish spawn request to host listener
    this.nc!.publish('agog.spawn.request', sc.encode(JSON.stringify(spawnRequest)));
    console.log(`[Sam] 🚀 Spawned ${agent} to fix P0: ${reqNumber}`);
  }

  /**
   * Trigger UI testing REQ generation for Liz after each audit
   */
  private async triggerUITesting(result: AuditResult): Promise<void> {
    if (!this.nc) {
      console.warn('[Sam] No NATS connection, cannot trigger UI testing');
      return;
    }

    try {
      const payload = {
        auditType: result.audit_type,
        timestamp: result.timestamp,
        overallStatus: result.overall_status,
        recommendations: result.recommendations || [],
        triggeredBy: 'sam-senior-auditor'
      };

      this.nc.publish('agog.testing.ui.generate', sc.encode(JSON.stringify(payload)));
      console.log('[Sam] ✅ Triggered UI testing REQ generation for Liz');
    } catch (error) {
      console.error('[Sam] Failed to trigger UI testing:', error);
    }
  }

  async stop(): Promise<void> {
    console.log('[Sam] Stopping Senior Auditor Daemon...');

    if (this.dailyTimer) {
      clearTimeout(this.dailyTimer);
    }

    if (this.responseSubscription) {
      this.responseSubscription.unsubscribe();
    }

    if (this.db) {
      await this.db.end();
    }

    if (this.nc) {
      await this.nc.close();
    }
  }
}

// Export for use in start-proactive-daemons.ts
export { SeniorAuditorDaemon };

// Allow running standalone for testing
if (require.main === module) {
  const daemon = new SeniorAuditorDaemon();

  process.on('SIGINT', async () => {
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await daemon.stop();
    process.exit(0);
  });

  daemon.start().catch((error) => {
    console.error('[Sam] Failed to start daemon:', error);
    process.exit(1);
  });
}
