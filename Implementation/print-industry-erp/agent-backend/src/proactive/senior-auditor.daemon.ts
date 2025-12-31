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
  private isRunning = false;
  private dailyTimer: NodeJS.Timeout | null = null;
  private responseSubscription: Subscription | null = null;
  private pendingAudits: Map<string, { auditType: string; startTime: number; resolve: (result: AuditResult) => void }> = new Map();

  async start(): Promise<void> {
    console.log('[Sam] Senior Auditor Daemon starting...');

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
      setTimeout(() => {
        if (this.pendingAudits.has(reqNumber)) {
          console.warn(`[Sam] Audit ${reqNumber} timed out after ${CONFIG.auditTimeout / 1000 / 60} minutes`);
          this.pendingAudits.delete(reqNumber);

          // Return a default timeout result
          resolve({
            agent: 'sam',
            audit_type: auditType as 'startup' | 'daily' | 'manual',
            timestamp: new Date().toISOString(),
            duration_minutes: Math.round((Date.now() - startTime) / 1000 / 60),
            overall_status: 'WARNING',
            deployment_blocked: false,
            block_reasons: [],
            recommendations: ['Audit timed out - manual review required'],
          });
        }
      }, CONFIG.auditTimeout);
    });
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

    const priorityMap: Record<string, string> = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
    };

    let createdCount = 0;

    for (const recommendation of result.recommendations || []) {
      // Parse priority from recommendation (e.g., "CRITICAL: Fix...")
      const priorityMatch = recommendation.match(/^(CRITICAL|HIGH|MEDIUM|LOW):/i);
      const priority = priorityMatch ? priorityMap[priorityMatch[1].toUpperCase()] : 'medium';
      const title = priorityMatch ? recommendation.replace(/^(CRITICAL|HIGH|MEDIUM|LOW):\s*/i, '') : recommendation;

      const reqNumber = `REQ-AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const metadata = {
        priority,
        source: 'sam-audit',
        audit_type: result.audit_type,
        description: `
## Issue Found by Sam (Senior Auditor)

**Audit Type:** ${result.audit_type}
**Audit Date:** ${result.timestamp}
**Priority:** ${priority.toUpperCase()}

### Problem
${recommendation}

### Source
This requirement was automatically created by Sam during a system-wide audit.

### Acceptance Criteria
- [ ] Issue is resolved
- [ ] Verified by re-running Sam audit
        `.trim(),
      };

      // Publish to NATS for orchestrator to pick up and route
      this.nc!.publish('agog.requirements.new', sc.encode(JSON.stringify({
        req_number: reqNumber,
        title: title.slice(0, 200),
        ...metadata,
      })));
      console.log(`[Sam] Published REQ: ${reqNumber} - ${title.slice(0, 50)}...`);
      createdCount++;

      // Small delay between creating REQs to avoid flooding
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[Sam] Created ${createdCount} requirements for issues`);
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
