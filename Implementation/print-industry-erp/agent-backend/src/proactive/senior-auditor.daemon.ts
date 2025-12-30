/**
 * Senior Auditor Daemon (Sam)
 *
 * Runs comprehensive system-wide audits:
 * - At startup (when this daemon starts)
 * - Daily at 2:00 AM
 * - On-demand via NATS trigger
 *
 * NOT part of the normal REQ workflow.
 * Very long timeout (2 hours) for thorough audits.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connect, NatsConnection, StringCodec } from 'nats';
import { spawn } from 'child_process';
import * as path from 'path';
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
  resultSubject: 'agog.audit.sam.result',
  agentFile: '.claude/agents/sam-senior-auditor.md',
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

    // Connect to NATS (REQUIRED - Sam creates REQs via NATS)
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

    console.log(`[Sam] Starting ${auditType} audit at ${new Date().toISOString()}`);

    try {
      // Get project root (4 levels up from this file's location)
      const projectRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
      const agentPath = path.join(projectRoot, CONFIG.agentFile);

      // Note: Agent file existence is checked by Claude Code itself

      // Build the prompt for Sam
      const prompt = `
You are Sam, the Senior Auditor. Run a comprehensive ${auditType} audit.

Audit Type: ${auditType}
Timestamp: ${new Date().toISOString()}
Project Root: ${projectRoot}

Execute ALL checks from your audit checklist:
1. Security Audit (secrets scan, npm audit, semgrep, RLS)
2. i18n Completeness Audit
3. E2E Smoke Test (all routes, all languages)
4. Database Stress Test (use k6)
5. Human Documentation Audit
6. Database Health Check

Be thorough. Take your time. This is a ${CONFIG.auditTimeout / 1000 / 60} minute timeout.

Output your findings as the JSON health report format specified in your prompt.
`;

      // Spawn Claude Code to run Sam
      const result = await this.spawnAuditAgent(prompt, projectRoot);

      // Parse and publish result
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);

      console.log(`[Sam] ${auditType} audit completed in ${durationMinutes} minutes`);

      // Try to parse JSON result from output
      const auditResult = this.parseAuditResult(result, auditType, durationMinutes);

      // Save audit summary to database (NOT a file)
      await this.saveAuditToDatabase(auditResult);

      // Create REQs for any issues found
      if (auditResult.recommendations && auditResult.recommendations.length > 0) {
        await this.createRequirementsForIssues(auditResult);
      }

      // Publish to NATS
      if (this.nc) {
        this.nc.publish(CONFIG.resultSubject, sc.encode(JSON.stringify(auditResult)));
        console.log(`[Sam] Result published to ${CONFIG.resultSubject}`);
      }

      // Log summary
      console.log(`[Sam] Overall Status: ${auditResult.overall_status}`);
      if (auditResult.deployment_blocked) {
        console.error('[Sam] ⚠️ DEPLOYMENT BLOCKED');
        auditResult.block_reasons.forEach((r) => console.error(`  - ${r}`));
      }
    } catch (error) {
      console.error(`[Sam] Audit failed:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  private async spawnAuditAgent(prompt: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '--print',
        '--dangerously-skip-permissions',
        prompt,
      ];

      console.log(`[Sam] Spawning Claude Code in ${cwd}`);

      const proc = spawn('claude', args, {
        cwd,
        shell: true,
        timeout: CONFIG.auditTimeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          console.error(`[Sam] Agent exited with code ${code}`);
          console.error(`[Sam] stderr: ${stderr}`);
          resolve(stdout || stderr); // Return what we have
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseAuditResult(
    output: string,
    auditType: 'startup' | 'daily' | 'manual',
    durationMinutes: number
  ): AuditResult {
    // Try to find JSON in the output
    const jsonMatch = output.match(/\{[\s\S]*"agent":\s*"sam"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.warn('[Sam] Failed to parse JSON from output');
      }
    }

    // Return a default result if parsing failed
    return {
      agent: 'sam',
      audit_type: auditType,
      timestamp: new Date().toISOString(),
      duration_minutes: durationMinutes,
      overall_status: 'WARNING',
      deployment_blocked: false,
      block_reasons: [],
      recommendations: ['Audit output could not be parsed - manual review required'],
    };
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
    if (!this.db) {
      console.error('[Sam] No database connection, cannot create requirements');
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
