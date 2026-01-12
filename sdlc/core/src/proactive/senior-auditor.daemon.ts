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

import { connect, NatsConnection, StringCodec, Subscription, JetStreamClient, JetStreamManager, StorageType, RetentionPolicy, DiscardPolicy } from 'nats';
import { Pool } from 'pg';
import { SDLCApiClient, SDLCApiClientConfig, CreateRequestInput } from '../api/sdlc-api.client';
import { AuditDiagnosticsService, DiagnosticReport } from './audit-diagnostics.service';

const sc = StringCodec();

// Configuration
const CONFIG = {
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  natsUser: process.env.NATS_USER,
  natsPassword: process.env.NATS_PASSWORD,
  auditTimeout: 2 * 60 * 60 * 1000, // 2 hours in milliseconds (default, may be overridden by adaptive timeout)
  dailyRunHour: 2, // 2:00 AM
  triggerSubject: 'agog.audit.sam.run',
  requestSubject: 'agog.agent.requests.sam-audit', // Request to Host Listener
  responseSubject: 'agog.agent.responses.sam-audit', // Response from Host Listener
  resultSubject: 'agog.audit.sam.result',
  // Sasha - Workflow Infrastructure Support
  // For workflow rule questions or infrastructure issues, contact Sasha via NATS
  sashaRulesTopic: 'agog.agent.requests.sasha-rules',
  // Phase B: Auto-retry configuration for transient failure recovery
  maxAuditRetries: 3,           // Retry up to 3 times before creating P0
  retryDelayMs: 30 * 1000,      // 30 second delay between retries
  // Phase D: Adaptive timeout configuration
  minAuditTimeout: 30 * 60 * 1000,     // 30 min floor
  maxAuditTimeout: 4 * 60 * 60 * 1000, // 4 hour ceiling
  adaptiveTimeoutBuffer: 1.5,           // 50% buffer on historical average
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
  private js: JetStreamClient | null = null;
  private db: Pool | null = null;
  private sdlcClient: SDLCApiClient | null = null;
  private isRunning = false;
  private dailyTimer: NodeJS.Timeout | null = null;
  private responseSubscription: Subscription | null = null;
  private pendingAudits: Map<string, { auditType: string; startTime: number; resolve: (result: AuditResult) => void; timeoutId?: NodeJS.Timeout }> = new Map();

  // Phase B: Auto-retry tracking for transient failure recovery
  private auditRetryCount: Map<string, number> = new Map();

  // Phase C: Diagnostics service for failure analysis
  private diagnosticsService: AuditDiagnosticsService | null = null;

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

  /**
   * Ensure JetStream stream exists for audit requests
   * Fixes race condition where Sam publishes before Host Listener subscribes
   * Per WORKFLOW_RULES.md Rule #1: Fail fast if dependency unavailable
   */
  private async ensureAuditRequestStream(): Promise<void> {
    if (!this.nc) {
      console.error('[Sam] No NATS connection, cannot create audit stream');
      process.exit(1); // Rule #1: Fail fast
    }

    const jsm = await this.nc.jetstreamManager();
    const streamName = 'agog_audit_requests';

    try {
      await jsm.streams.info(streamName);
      console.log(`[Sam] Stream ${streamName} already exists`);
    } catch (error) {
      console.log(`[Sam] Creating stream: ${streamName}`);

      const streamConfig = {
        name: streamName,
        subjects: [CONFIG.requestSubject],
        storage: StorageType.File,
        retention: RetentionPolicy.Workqueue, // One consumer processes each message
        max_msgs: 100,
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days
        discard: DiscardPolicy.Old,
      };

      await jsm.streams.add(streamConfig);
      console.log(`[Sam] ✅ Stream ${streamName} created`);
    }
  }

  /**
   * Wait for Host Listener consumer to be ready before publishing audit requests
   * Prevents race condition where Sam publishes before consumer exists
   *
   * Fix for: REQ-P0-AUDIT-TIMEOUT-1767935800708-eko0j
   * Root Cause: Sam published audit request before Host Listener consumer was ready
   */
  private async waitForConsumerReady(maxWaitSeconds: number = 30): Promise<boolean> {
    if (!this.nc) {
      console.error('[Sam] No NATS connection, cannot check consumer');
      return false;
    }

    const jsm = await this.nc.jetstreamManager();
    const streamName = 'agog_audit_requests';
    const consumerName = 'host-listener-audit-consumer';
    const startTime = Date.now();

    console.log(`[Sam] Waiting for consumer ${consumerName} to be ready (max ${maxWaitSeconds}s)...`);

    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      try {
        const consumerInfo = await jsm.consumers.info(streamName, consumerName);
        if (consumerInfo) {
          console.log(`[Sam] ✅ Consumer ${consumerName} is ready (${consumerInfo.num_pending} pending messages)`);
          return true;
        }
      } catch (error: any) {
        // Consumer doesn't exist yet - wait and retry
        if (error.message?.includes('consumer not found') || error.code === '404') {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
          continue;
        }
        // Other errors should fail fast
        console.error(`[Sam] Error checking consumer: ${error.message}`);
        return false;
      }
    }

    console.warn(`[Sam] ⚠️ Consumer ${consumerName} not ready after ${maxWaitSeconds}s`);
    console.warn(`[Sam] ⚠️ Host Listener may not be running - audit requests will be queued in stream`);
    // Return true anyway - JetStream will queue the message until consumer is ready
    return true;
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

    // Connect to agent_memory database (OPTIONAL - Sam stores audit history here)
    // If DATABASE_URL is set, use it for audit persistence
    // Otherwise, audits are ephemeral (lost on restart)
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        this.db = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 10000,
          max: 3
        });
        await this.db.query('SELECT 1'); // Test connection
        console.log('[Sam] Connected to database for audit persistence');

        // Ensure audit table exists
        await this.ensureAuditTable();
      } catch (error: any) {
        console.warn(`[Sam] Database connection failed: ${error.message}`);
        console.warn('[Sam] Running without audit persistence (history lost on restart)');
        this.db = null;
      }
    } else {
      console.warn('[Sam] DATABASE_URL not configured - running without audit persistence');
      this.db = null;
    }

    // Connect to NATS (REQUIRED - Sam publishes to NATS for Host Listener)
    this.nc = await connect({
      servers: CONFIG.natsUrl,
      user: CONFIG.natsUser,
      pass: CONFIG.natsPassword,
    });
    console.log(`[Sam] Connected to NATS at ${CONFIG.natsUrl}`);

    // Initialize JetStream for reliable audit request delivery
    this.js = this.nc.jetstream();
    await this.ensureAuditRequestStream();
    console.log('[Sam] JetStream audit request stream ready');

    // Phase C: Initialize diagnostics service for failure analysis
    this.diagnosticsService = new AuditDiagnosticsService(this.nc, this.db);
    console.log('[Sam] Diagnostics service initialized');

    // Wait for Host Listener consumer to be ready (fixes race condition)
    // Per REQ-P0-AUDIT-TIMEOUT-1767935800708-eko0j analysis
    await this.waitForConsumerReady(30);
    console.log('[Sam] ✅ Host Listener consumer coordination complete');

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
      // Publish audit request to JetStream for reliable delivery
      // Fixes race condition: message persists even if Host Listener not yet subscribed
      const auditRequest = {
        reqNumber,
        auditType,
        timestamp: new Date().toISOString(),
        requestedBy: 'sam-daemon',
      };

      console.log(`[Sam] Publishing audit request to JetStream: ${CONFIG.requestSubject}`);

      if (!this.js) {
        throw new Error('JetStream not initialized - cannot publish audit request');
      }

      await this.js.publish(
        CONFIG.requestSubject,
        sc.encode(JSON.stringify(auditRequest)),
        { msgID: reqNumber } // Deduplication based on REQ number
      );

      console.log(`[Sam] ✅ Audit request published to JetStream: ${reqNumber}`);

      // Phase D: Calculate adaptive timeout based on historical data
      const adaptiveTimeout = await this.getAdaptiveTimeout(auditType);

      // Wait for response with adaptive timeout
      const result = await this.waitForAuditResponse(reqNumber, auditType, startTime, adaptiveTimeout);

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
    startTime: number,
    timeout: number = CONFIG.auditTimeout // Phase D: Accept adaptive timeout parameter
  ): Promise<AuditResult> {
    const timeoutMinutes = Math.round(timeout / 1000 / 60);

    return new Promise((resolve) => {
      // Early warning: 5-minute check for potential crashes
      const earlyWarningId = setTimeout(async () => {
        if (this.pendingAudits.has(reqNumber)) {
          const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
          console.warn(`[Sam] ⚠️ No response after ${elapsed} minutes - audit may have crashed or is still processing`);
          console.warn(`[Sam] ⏰ Will timeout in ${timeoutMinutes - elapsed} minutes if no response received`);

          // Ask Sasha for guidance - might be workflow infrastructure issue
          await this.askSashaForGuidance(
            'Audit not responding after 5 minutes - is this a workflow infrastructure issue or normal processing time?',
            `Audit ${reqNumber} (${auditType}) spawned but no response received after 5 minutes. Expected completion: 30-40 minutes for full audit.`
          );
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Final timeout - Phase B: Try retry before creating P0, Phase D: Use adaptive timeout
      const timeoutId = setTimeout(async () => {
        if (this.pendingAudits.has(reqNumber)) {
          const durationMinutes = Math.round((Date.now() - startTime) / 1000 / 60);

          // Phase B: Check retry count before creating P0
          const currentRetries = this.auditRetryCount.get(reqNumber) || 0;

          if (currentRetries < CONFIG.maxAuditRetries) {
            // Still have retries remaining - attempt retry
            const nextRetry = currentRetries + 1;
            this.auditRetryCount.set(reqNumber, nextRetry);

            console.warn(`[Sam] ⚠️ AUDIT TIMEOUT: ${reqNumber} timed out after ${durationMinutes} minutes`);
            console.log(`[Sam] 🔄 Retry ${nextRetry}/${CONFIG.maxAuditRetries} - transient failure recovery`);

            // Clean up pending audit state
            this.pendingAudits.delete(reqNumber);

            // Wait before retry (exponential backoff: 30s, 60s, 120s)
            const backoffDelay = CONFIG.retryDelayMs * Math.pow(2, currentRetries);
            console.log(`[Sam] ⏳ Waiting ${backoffDelay / 1000}s before retry...`);

            await new Promise(r => setTimeout(r, backoffDelay));

            // Retry the audit
            try {
              const retryResult = await this.retryAudit(reqNumber, auditType as 'startup' | 'daily' | 'manual');
              resolve(retryResult);
            } catch (error: any) {
              console.error(`[Sam] Retry ${nextRetry} failed: ${error.message}`);
              // Will trigger another timeout cycle if retries remain
            }
            return;
          }

          // All retries exhausted - this is now a catastrophic failure
          console.error(`[Sam] 🚨 AUDIT TIMEOUT: ${reqNumber} timed out after ${durationMinutes} minutes (limit: ${timeoutMinutes}min)`);
          console.error(`[Sam] ❌ All ${CONFIG.maxAuditRetries} retries exhausted - audit infrastructure is broken`);
          console.error(`[Sam] ❌ Per WORKFLOW_RULES.md Rule #1: Services MUST EXIT immediately when critical dependencies fail`);
          console.error(`[Sam] ❌ Exiting process - supervisor will restart service`);
          this.pendingAudits.delete(reqNumber);
          this.auditRetryCount.delete(reqNumber); // Clean up retry tracking

          // Create P0 manual review REQ for timeout investigation before exit
          await this.createManualReviewREQ(reqNumber, auditType, durationMinutes);

          // Rule #1: NO graceful error handling - EXIT IMMEDIATELY
          // Audit infrastructure is a critical dependency. If it's broken, the service must exit.
          // The process supervisor (Docker, systemd, etc.) will restart the service.
          // This prevents the system from continuing without audit verification.
          process.exit(1);
        }
      }, timeout); // Phase D: Use adaptive timeout

      // Store pending audit info with timeout ID for potential cancellation
      this.pendingAudits.set(reqNumber, { auditType, startTime, resolve, timeoutId });
    });
  }

  /**
   * Phase B: Retry a timed-out audit
   * Re-publishes the audit request to JetStream for another attempt
   */
  private async retryAudit(
    originalReqNumber: string,
    auditType: 'startup' | 'daily' | 'manual'
  ): Promise<AuditResult> {
    const retryCount = this.auditRetryCount.get(originalReqNumber) || 0;
    const newReqNumber = `${originalReqNumber}-retry${retryCount}`;
    const startTime = Date.now();

    console.log(`[Sam] 🔄 Retrying audit: ${newReqNumber} (original: ${originalReqNumber})`);

    // Publish retry audit request to JetStream
    const auditRequest = {
      reqNumber: newReqNumber,
      originalReqNumber,
      auditType,
      timestamp: new Date().toISOString(),
      requestedBy: 'sam-daemon',
      isRetry: true,
      retryCount,
    };

    if (!this.js) {
      throw new Error('JetStream not initialized - cannot publish retry audit request');
    }

    await this.js.publish(
      CONFIG.requestSubject,
      sc.encode(JSON.stringify(auditRequest)),
      { msgID: newReqNumber }
    );

    console.log(`[Sam] ✅ Retry audit request published: ${newReqNumber}`);

    // Wait for response with the same timeout logic (recursive retry handled by waitForAuditResponse)
    // Copy retry count to new request number for tracking
    this.auditRetryCount.set(newReqNumber, retryCount);

    return this.waitForAuditResponse(newReqNumber, auditType, startTime);
  }

  /**
   * Phase D: Get average audit duration from historical data
   * Returns average duration in milliseconds, or null if no historical data
   */
  private async getAverageAuditDuration(auditType: string): Promise<number | null> {
    if (!this.db) {
      return null;
    }

    try {
      // Get average duration of successful audits of the same type from last 30 days
      const result = await this.db.query(`
        SELECT AVG(duration_minutes) as avg_duration,
               COUNT(*) as sample_size,
               MAX(duration_minutes) as max_duration
        FROM system_health_audits
        WHERE audit_type = $1
          AND overall_status != 'FAIL'
          AND timestamp > NOW() - INTERVAL '30 days'
      `, [auditType]);

      if (result.rows[0]?.avg_duration) {
        const avgMinutes = parseFloat(result.rows[0].avg_duration);
        const sampleSize = parseInt(result.rows[0].sample_size);
        const maxMinutes = parseFloat(result.rows[0].max_duration);

        console.log(`[Sam] Historical ${auditType} audit stats: avg=${avgMinutes.toFixed(1)}min, max=${maxMinutes}min, samples=${sampleSize}`);

        // Return average in milliseconds
        return avgMinutes * 60 * 1000;
      }

      return null;
    } catch (error: any) {
      console.warn(`[Sam] Failed to get historical audit duration: ${error.message}`);
      return null;
    }
  }

  /**
   * Phase D: Calculate adaptive timeout based on historical audit duration
   * Returns timeout in milliseconds, bounded by min/max config values
   */
  private async getAdaptiveTimeout(auditType: string): Promise<number> {
    const historicalAvg = await this.getAverageAuditDuration(auditType);

    if (historicalAvg === null) {
      // No historical data - use default timeout
      console.log(`[Sam] No historical data for ${auditType} audits, using default timeout: ${CONFIG.auditTimeout / 1000 / 60}min`);
      return CONFIG.auditTimeout;
    }

    // Apply buffer to historical average
    const adaptiveTimeout = historicalAvg * CONFIG.adaptiveTimeoutBuffer;

    // Bound by min/max
    const boundedTimeout = Math.max(
      CONFIG.minAuditTimeout,
      Math.min(adaptiveTimeout, CONFIG.maxAuditTimeout)
    );

    console.log(`[Sam] Adaptive timeout for ${auditType}: ${Math.round(boundedTimeout / 1000 / 60)}min (based on ${Math.round(historicalAvg / 1000 / 60)}min avg × ${CONFIG.adaptiveTimeoutBuffer} buffer)`);

    return boundedTimeout;
  }

  /**
   * Create a P0 manual review REQ when an audit times out
   * Phase C: Now includes automated diagnostic report
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

    // Phase C: Run diagnostics before creating P0
    let diagnosticReport: DiagnosticReport | null = null;
    let diagnosticMarkdown = '';

    if (this.diagnosticsService) {
      try {
        console.log('[Sam] 🔍 Running diagnostics for failed audit...');
        diagnosticReport = await this.diagnosticsService.runDiagnostics(auditReqNumber, durationMinutes);
        diagnosticMarkdown = this.diagnosticsService.formatReportAsMarkdown(diagnosticReport);
        console.log(`[Sam] ✅ Diagnostics complete. Probable cause: ${diagnosticReport.probableCause || 'Unknown'}`);
      } catch (error: any) {
        console.error(`[Sam] Diagnostics failed: ${error.message}`);
        diagnosticMarkdown = `\n\n## Diagnostic Report\n\n**Error:** Failed to generate diagnostic report: ${error.message}\n`;
      }
    }

    const reqNumber = `REQ-P0-AUDIT-TIMEOUT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const probableCause = diagnosticReport?.probableCause || 'Unknown - diagnostics unavailable';
    const severity = diagnosticReport?.severity || 'high';
    const title = `Audit timed out - ${probableCause} (${auditReqNumber})`;

    const description = `
## P0 Audit Timeout - Manual Review Required

**Severity:** ${severity.toUpperCase()} - ${severity === 'critical' ? 'IMMEDIATE INVESTIGATION REQUIRED' : 'Investigation needed'}
**Original Audit:** ${auditReqNumber}
**Audit Type:** ${auditType}
**Timeout After:** ${durationMinutes} minutes (limit: ${CONFIG.auditTimeout / 1000 / 60}min)
**Retries Exhausted:** ${CONFIG.maxAuditRetries}
**Probable Cause:** ${probableCause}
**Created:** ${new Date().toISOString()}

### Problem
The system-wide audit initiated by Sam (Senior Auditor) timed out after ${durationMinutes} minutes.
All ${CONFIG.maxAuditRetries} retry attempts have been exhausted.

${diagnosticMarkdown}

### Acceptance Criteria
- [ ] Root cause of timeout identified and documented
- [ ] Infrastructure issue resolved (if applicable)
- [ ] Audit timeout threshold adjusted if needed (${CONFIG.auditTimeout}ms)
- [ ] Manual audit completed successfully
- [ ] Preventive measures implemented

### Files to Review
- \`agent-backend/src/proactive/senior-auditor.daemon.ts\` (timeout config: line 26)
- \`agent-backend/src/proactive/audit-diagnostics.service.ts\` (diagnostic checks)
- \`backend/src/modules/security/services/security-audit.service.ts\` (query timeouts)
- \`agent-backend/logs/host-listener-*.log\` (audit spawn logs)
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

    // Phase E: Detect root cause patterns and create auto-fix REQs
    if (diagnosticReport && this.diagnosticsService) {
      const rootCauseFixes = this.diagnosticsService.detectRootCausePatterns(diagnosticReport);

      for (const fix of rootCauseFixes) {
        const fixReqNumber = `REQ-FIX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        console.log(`[Sam] 🔧 Creating auto-fix REQ for: ${fix.rootCause}`);

        // Create fix REQ in SDLC
        if (this.sdlcClient) {
          const fixInput: CreateRequestInput = {
            reqNumber: fixReqNumber,
            title: fix.fixTitle,
            description: `## Auto-Generated Fix REQ

**Root Cause:** ${fix.rootCause}
**Triggered By:** ${reqNumber}
**Diagnostic Report:** ${auditReqNumber}

${fix.fixDescription}

### Acceptance Criteria
- [ ] Root cause addressed
- [ ] Verified by re-running audit
- [ ] No recurrence in subsequent audits
`,
            requestType: 'bug',
            priority: fix.priority,
            primaryBu: 'core-infra',
            assignedTo: fix.assignedAgent,
            source: 'sam-auto-fix',
            tags: ['auto-fix', 'root-cause', fix.rootCause.toLowerCase().replace(/\s+/g, '-')],
          };

          const created = await this.sdlcClient.createRequest(fixInput);
          if (created) {
            console.log(`[Sam] ✅ Created auto-fix REQ: ${fixReqNumber} for ${fix.rootCause}`);
          }
        }
      }

      if (rootCauseFixes.length > 0) {
        console.log(`[Sam] Created ${rootCauseFixes.length} auto-fix REQs for detected root causes`);
      }
    }
  }

  private async handleAuditResponse(msg: any): Promise<void> {
    try {
      const response = JSON.parse(sc.decode(msg.data));
      console.log(`[Sam] 📨 Received audit response for ${response.req_number}`);
      console.log(`[Sam] 🔍 Pending audits: [${Array.from(this.pendingAudits.keys()).join(', ')}]`);

      const pending = this.pendingAudits.get(response.req_number);
      if (pending) {
        console.log(`[Sam] ✅ Correlation SUCCESS - matched pending audit ${response.req_number}`);
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
        console.warn(`[Sam] ❌ Correlation FAILED - unknown audit: ${response.req_number}`);
        console.warn(`[Sam] Expected one of: [${Array.from(this.pendingAudits.keys()).join(', ')}]`);
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
      console.log('[Sam] No database connection - audit result not persisted');
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
