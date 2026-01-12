/**
 * Recovery & Health Check Daemon
 * INFRASTRUCTURE LAYER - Runs independently of agent system
 * Runs at 12:01 PM and every 5 hours
 * Recovers stuck workflows and restarts stopped services
 * NO CLAUDE API USAGE - Pure file I/O + NATS + process management
 */

import { connect, NatsConnection, JetStreamClient } from 'nats';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { isRunningInDocker } from '../utils/environment';

export interface HealthCheckResult {
  timestamp: string;
  stuckWorkflows: string[];
  recoveredWorkflows: string[];
  blockedWorkflows: string[];
  orphanedDeliverables: number;
  healthStatus: 'healthy' | 'degraded' | 'critical';
  details: string[];
  servicesRestarted: string[];
}

export class RecoveryHealthCheckDaemon {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private isRunning = false;
  private checkCount = 0;
  private ownerRequestsPath = process.env.OWNER_REQUESTS_PATH || '/app/project-spirit/owner_requests/OWNER_REQUESTS.md';

  // Track spawned processes (so we can monitor and restart them)
  private orchestratorProcess: ChildProcess | null = null;
  private hostListenerProcess: ChildProcess | null = null;

  async initialize(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'recovery-health-check-daemon'
    });

    this.js = this.nc.jetstream();

    console.log('[RecoveryHealthCheck] Daemon initialized');
  }

  /**
   * Start daemon (runs IMMEDIATELY, then every 5 hours)
   */
  async startDaemon(): Promise<void> {
    if (this.isRunning) {
      console.log('[RecoveryHealthCheck] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[RecoveryHealthCheck] Starting daemon (runs immediately, then every 5 hours)...');

    // Run IMMEDIATELY on startup
    console.log('[RecoveryHealthCheck] Running initial health check NOW...');
    await this.runHealthCheck();

    // Then schedule every 5 hours
    setInterval(async () => {
      if (this.isRunning) {
        await this.runHealthCheck();
      }
    }, 5 * 60 * 60 * 1000); // 5 hours

    console.log('[RecoveryHealthCheck] ✅ Now running every 5 hours');
  }

  /**
   * Run health check and recovery
   * INFRASTRUCTURE ONLY - No Claude API calls
   */
  private async runHealthCheck(): Promise<HealthCheckResult> {
    console.log('[RecoveryHealthCheck] 🔍 Running health check and recovery...');
    console.log('[RecoveryHealthCheck] (INFRASTRUCTURE MODE - No Claude API usage)');

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      stuckWorkflows: [],
      recoveredWorkflows: [],
      blockedWorkflows: [],
      orphanedDeliverables: 0,
      healthStatus: 'healthy',
      details: [],
      servicesRestarted: []
    };

    try {
      // 1. Find stuck workflows (IN_PROGRESS > 1 hour)
      const stuckWorkflows = await this.findStuckWorkflows();
      result.stuckWorkflows = stuckWorkflows.map(w => w.reqNumber);

      console.log(`[RecoveryHealthCheck] Found ${stuckWorkflows.length} stuck workflows`);

      // 2. Attempt recovery for each stuck workflow
      for (const workflow of stuckWorkflows) {
        try {
          const recovered = await this.attemptRecovery(workflow.reqNumber);
          if (recovered) {
            result.recoveredWorkflows.push(workflow.reqNumber);
            result.details.push(`✅ Recovered ${workflow.reqNumber} - resumed from last completed stage`);
          } else {
            result.blockedWorkflows.push(workflow.reqNumber);
            result.details.push(`❌ Blocked ${workflow.reqNumber} - requires manual intervention`);
          }
        } catch (error: any) {
          result.blockedWorkflows.push(workflow.reqNumber);
          result.details.push(`❌ Failed to recover ${workflow.reqNumber}: ${error.message}`);
        }
      }

      // 3. Check for orphaned deliverables (messages with no active workflow)
      result.orphanedDeliverables = await this.countOrphanedDeliverables();

      // 4. Service health check
      // When running inside Docker (via daemon:full), all services run in the same process
      // so we don't need to spawn separate processes - just verify NATS connectivity
      console.log('\n[RecoveryHealthCheck] Checking service health...');

      if (isRunningInDocker()) {
        // Inside Docker - services run in same process, just check NATS
        console.log('[RecoveryHealthCheck] Running in Docker - services are co-located');
        try {
          await this.nc.flush();
          console.log('[RecoveryHealthCheck] ✅ NATS connection healthy');
          result.details.push('✅ NATS connection healthy');
        } catch (err) {
          console.log('[RecoveryHealthCheck] ⚠️ NATS connection issue');
          result.details.push('⚠️ NATS connection issue - may need container restart');
          result.healthStatus = 'degraded';
        }
      } else {
        // Running standalone on host - may need to restart separate processes
        if (!this.isProcessRunning(this.orchestratorProcess)) {
          console.log('[RecoveryHealthCheck] Strategic Orchestrator not running - restarting...');
          await this.startStrategicOrchestrator();
          result.servicesRestarted.push('Strategic Orchestrator');
          result.details.push('✅ Restarted Strategic Orchestrator');
        } else {
          console.log('[RecoveryHealthCheck] Strategic Orchestrator is running');
        }

        if (!this.isProcessRunning(this.hostListenerProcess)) {
          console.log('[RecoveryHealthCheck] Host Agent Listener not running - restarting...');
          await this.startHostListener();
          result.servicesRestarted.push('Host Agent Listener');
          result.details.push('✅ Restarted Host Agent Listener');
        } else {
          console.log('[RecoveryHealthCheck] Host Agent Listener is running');
        }
      }

      // 5. Determine overall health status
      if (result.blockedWorkflows.length > 3) {
        result.healthStatus = 'critical';
      } else if (result.blockedWorkflows.length > 0 || result.orphanedDeliverables > 10) {
        result.healthStatus = 'degraded';
      } else {
        result.healthStatus = 'healthy';
      }

      this.checkCount++;
      console.log(`\n[RecoveryHealthCheck] ✅ Health check complete (${result.healthStatus})`);
      console.log(`[RecoveryHealthCheck] - Stuck: ${result.stuckWorkflows.length}, Recovered: ${result.recoveredWorkflows.length}, Blocked: ${result.blockedWorkflows.length}`);

      // Log details
      result.details.forEach(detail => console.log(`[RecoveryHealthCheck] ${detail}`));

      return result;

    } catch (error: any) {
      console.error('[RecoveryHealthCheck] Health check failed:', error.message);
      result.healthStatus = 'critical';
      result.details.push(`❌ Health check failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Find workflows stuck in IN_PROGRESS for > 1 hour
   */
  private async findStuckWorkflows(): Promise<Array<{ reqNumber: string; lastUpdated: Date }>> {
    if (!fs.existsSync(this.ownerRequestsPath)) {
      console.log(`[RecoveryHealthCheck] OWNER_REQUESTS.md not found at ${this.ownerRequestsPath}`);
      return [];
    }

    const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');

    // Parse IN_PROGRESS requests
    const requestPattern = /###\s+(REQ-[A-Z-]+-\d+):[^\n]*\n+\*\*Status\*\*:\s*IN_PROGRESS/g;
    const stuck: Array<{ reqNumber: string; lastUpdated: Date }> = [];
    let match;

    while ((match = requestPattern.exec(content)) !== null) {
      const reqNumber = match[1];

      // Check when this workflow was last updated by looking at NATS
      const lastDeliverable = await this.getLastDeliverableTime(reqNumber);

      if (lastDeliverable) {
        const hoursSinceUpdate = (Date.now() - lastDeliverable.getTime()) / (1000 * 60 * 60);

        if (hoursSinceUpdate > 1) {
          stuck.push({ reqNumber, lastUpdated: lastDeliverable });
          console.log(`[RecoveryHealthCheck] ${reqNumber} stuck for ${hoursSinceUpdate.toFixed(1)} hours`);
        }
      } else {
        // No deliverable found - workflow never started or failed immediately
        stuck.push({ reqNumber, lastUpdated: new Date(0) });
        console.log(`[RecoveryHealthCheck] ${reqNumber} has no deliverables - never started`);
      }
    }

    return stuck;
  }

  /**
   * Get timestamp of last deliverable for a workflow
   */
  private async getLastDeliverableTime(reqNumber: string): Promise<Date | null> {
    try {
      const streams = ['research', 'critique', 'backend', 'frontend', 'qa', 'statistics'];
      const agents = ['cynthia', 'sylvia', 'roy', 'jen', 'billy', 'priya'];

      let latestTime: Date | null = null;

      for (let i = 0; i < streams.length; i++) {
        const subject = `agog.deliverables.${agents[i]}.${streams[i]}.${reqNumber}`;

        try {
          const streamName = `agog_features_${streams[i]}`;
          const stream = await this.js.streams.get(streamName);

          // Try to get message with this subject
          const msg = await stream.getMessage({ last_by_subj: subject });

          if (msg && msg.time) {
            const msgTime = new Date(msg.time);
            if (!latestTime || msgTime > latestTime) {
              latestTime = msgTime;
            }
          }
        } catch (err) {
          // No message found for this stage - expected if workflow hasn't reached it yet
        }
      }

      return latestTime;
    } catch (error) {
      return null;
    }
  }

  /**
   * Attempt to recover a stuck workflow
   */
  private async attemptRecovery(reqNumber: string): Promise<boolean> {
    console.log(`[RecoveryHealthCheck] Attempting recovery for ${reqNumber}...`);

    try {
      // Find the last completed stage
      const lastCompletedStage = await this.findLastCompletedStage(reqNumber);

      if (lastCompletedStage === null) {
        // No stages completed - mark as PENDING to restart from beginning
        console.log(`[RecoveryHealthCheck] ${reqNumber} has no completed stages - marking PENDING to restart`);
        await this.updateRequestStatus(reqNumber, 'PENDING');
        return true;
      }

      if (lastCompletedStage >= 5) {
        // All stages completed but not marked complete - fix status
        console.log(`[RecoveryHealthCheck] ${reqNumber} has all stages complete - marking COMPLETE`);
        await this.updateRequestStatus(reqNumber, 'COMPLETE');
        return true;
      }

      // Partial completion - mark as PENDING to resume from next stage
      console.log(`[RecoveryHealthCheck] ${reqNumber} completed stage ${lastCompletedStage + 1} - marking PENDING to resume`);
      await this.updateRequestStatus(reqNumber, 'PENDING');
      return true;

    } catch (error: any) {
      console.error(`[RecoveryHealthCheck] Recovery failed for ${reqNumber}:`, error.message);

      // Mark as BLOCKED if recovery failed
      await this.updateRequestStatus(reqNumber, 'BLOCKED');
      return false;
    }
  }

  /**
   * Find the last completed stage for a workflow (0-5, or null if none)
   */
  private async findLastCompletedStage(reqNumber: string): Promise<number | null> {
    const stages = [
      { name: 'research', agent: 'cynthia' },
      { name: 'critique', agent: 'sylvia' },
      { name: 'backend', agent: 'roy' },
      { name: 'frontend', agent: 'jen' },
      { name: 'qa', agent: 'billy' },
      { name: 'statistics', agent: 'priya' }
    ];

    let lastCompleted: number | null = null;

    for (let i = 0; i < stages.length; i++) {
      const subject = `agog.deliverables.${stages[i].agent}.${stages[i].name}.${reqNumber}`;

      try {
        const streamName = `agog_features_${stages[i].name}`;
        const stream = await this.js.streams.get(streamName);
        const msg = await stream.getMessage({ last_by_subj: subject });

        if (msg) {
          lastCompleted = i;
          console.log(`[RecoveryHealthCheck]   Stage ${i + 1} (${stages[i].agent}) - ✅ Complete`);
        }
      } catch (err) {
        console.log(`[RecoveryHealthCheck]   Stage ${i + 1} (${stages[i].agent}) - ❌ Not found`);
        break; // Stages are sequential, so stop at first missing
      }
    }

    return lastCompleted;
  }

  /**
   * Update request status in OWNER_REQUESTS.md
   */
  private async updateRequestStatus(reqNumber: string, newStatus: string): Promise<boolean> {
    try {
      let content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');

      const statusPattern = new RegExp(
        `(###\\s+${reqNumber}:[^\\n]*\\n+\\*\\*Status\\*\\*:\\s*)\\w+`,
        'g'
      );

      const newContent = content.replace(statusPattern, `$1${newStatus}`);

      if (newContent === content) {
        console.error(`[RecoveryHealthCheck] Status pattern not found for ${reqNumber}`);
        return false;
      }

      fs.writeFileSync(this.ownerRequestsPath, newContent, 'utf-8');
      console.log(`[RecoveryHealthCheck] ✅ Updated ${reqNumber} status to ${newStatus}`);
      return true;

    } catch (error: any) {
      console.error(`[RecoveryHealthCheck] Failed to update status for ${reqNumber}:`, error.message);
      return false;
    }
  }

  /**
   * Count orphaned deliverables (messages with no active workflow)
   */
  private async countOrphanedDeliverables(): Promise<number> {
    // TODO: Implement orphaned deliverable detection
    // This would scan all deliverable streams and cross-reference with OWNER_REQUESTS.md
    return 0;
  }

  /**
   * Check if a process is running
   */
  private isProcessRunning(process: ChildProcess | null): boolean {
    if (!process) return false;
    if (process.killed) return false;
    if (process.exitCode !== null) return false;
    return true;
  }

  /**
   * Start Strategic Orchestrator
   * INFRASTRUCTURE ONLY - Orchestrator uses Claude, but starting it doesn't
   */
  private async startStrategicOrchestrator(): Promise<void> {
    const scriptPath = path.join(__dirname, '../../scripts/start-strategic-orchestrator.ts');

    // Ensure NATS credentials are passed to spawned process
    if (!process.env.NATS_PASSWORD) {
      throw new Error('NATS_PASSWORD environment variable is required');
    }
    const env = {
      ...process.env,
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4223',
      NATS_USER: process.env.NATS_USER || 'agents',
      NATS_PASSWORD: process.env.NATS_PASSWORD,
      OWNER_REQUESTS_PATH: process.env.OWNER_REQUESTS_PATH || '/app/project-spirit/owner_requests/OWNER_REQUESTS.md'
    };

    // Use PowerShell Start-Process with -WindowStyle Hidden (only way that works on Windows)
    const logPath = path.join(__dirname, '../../logs');
    if (!require('fs').existsSync(logPath)) {
      require('fs').mkdirSync(logPath, { recursive: true });
    }

    const logFile = path.join(logPath, 'orchestrator.log');
    const errorLogFile = path.join(logPath, 'orchestrator.error.log');

    // PowerShell command to start process hidden
    const psCommand = `Start-Process -FilePath "npx" -ArgumentList "tsx","${scriptPath}" -WindowStyle Hidden -WorkingDirectory "${path.join(__dirname, '../..')}" -RedirectStandardOutput "${logFile}" -RedirectStandardError "${errorLogFile}"`;

    this.orchestratorProcess = spawn('powershell.exe', ['-Command', psCommand], {
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: true
    });

    console.log(`[RecoveryHealthCheck] Orchestrator logs: ${logFile}`);

    this.orchestratorProcess.on('exit', (code) => {
      console.log(`[RecoveryHealthCheck] Orchestrator exited with code ${code}`);
      this.orchestratorProcess = null;
    });

    // Allow process to run independently
    this.orchestratorProcess.unref();

    // Wait a moment for process to fully spawn
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`[RecoveryHealthCheck] ✅ Strategic Orchestrator started (PID: ${this.orchestratorProcess.pid})`);
  }

  /**
   * Start Host Agent Listener
   * INFRASTRUCTURE ONLY - Listener spawns Claude agents, but starting it doesn't use Claude
   */
  private async startHostListener(): Promise<void> {
    const scriptPath = path.join(__dirname, '../../scripts/host-agent-listener.ts');

    // Ensure NATS credentials are passed to spawned process
    // NATS_PASSWORD should already be validated in startStrategicOrchestrator()
    const env = {
      ...process.env,
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4223',
      NATS_USER: process.env.NATS_USER || 'agents',
      NATS_PASSWORD: process.env.NATS_PASSWORD
    };

    // Use PowerShell Start-Process with -WindowStyle Hidden
    const logPath = path.join(__dirname, '../../logs');
    if (!require('fs').existsSync(logPath)) {
      require('fs').mkdirSync(logPath, { recursive: true });
    }

    const logFile = path.join(logPath, 'host-listener.log');
    const errorLogFile = path.join(logPath, 'host-listener.error.log');

    // PowerShell command to start process hidden
    const psCommand = `Start-Process -FilePath "npx" -ArgumentList "tsx","${scriptPath}" -WindowStyle Hidden -WorkingDirectory "${path.join(__dirname, '../..')}" -RedirectStandardOutput "${logFile}" -RedirectStandardError "${errorLogFile}"`;

    this.hostListenerProcess = spawn('powershell.exe', ['-Command', psCommand], {
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: true
    });

    console.log(`[RecoveryHealthCheck] Host Listener logs: ${logFile}`);

    this.hostListenerProcess.on('exit', (code) => {
      console.log(`[RecoveryHealthCheck] Host Listener exited with code ${code}`);
      this.hostListenerProcess = null;
    });

    // Allow process to run independently
    this.hostListenerProcess.unref();

    // Wait a moment for process to fully spawn
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`[RecoveryHealthCheck] ✅ Host Agent Listener started (PID: ${this.hostListenerProcess.pid})`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('[RecoveryHealthCheck] Daemon stopped');
  }

  async close(): Promise<void> {
    await this.stop();

    // Kill spawned processes (only if they have a valid PID)
    if (this.orchestratorProcess && this.orchestratorProcess.pid && !this.orchestratorProcess.killed) {
      try {
        console.log('[RecoveryHealthCheck] Stopping Strategic Orchestrator...');
        this.orchestratorProcess.kill();
      } catch (err) {
        // Process may have already exited
        console.log('[RecoveryHealthCheck] Orchestrator already stopped');
      }
    }

    if (this.hostListenerProcess && this.hostListenerProcess.pid && !this.hostListenerProcess.killed) {
      try {
        console.log('[RecoveryHealthCheck] Stopping Host Agent Listener...');
        this.hostListenerProcess.kill();
      } catch (err) {
        // Process may have already exited
        console.log('[RecoveryHealthCheck] Host Listener already stopped');
      }
    }

    await this.nc.close();
  }

  getStats(): {
    isRunning: boolean;
    checkCount: number;
  } {
    return {
      isRunning: this.isRunning,
      checkCount: this.checkCount
    };
  }
}
