/**
 * Application-Level Health Monitor
 * CONTAINER-SAFE: No Docker CLI, No PowerShell, No external commands
 * Uses only: File checks, NATS, Memory stats, Process info
 */

import { connect, NatsConnection } from 'nats';
import * as fs from 'fs';
import * as os from 'os';

interface HealthCheckResult {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'critical';
  checks: {
    filesAccessible: boolean;
    natsConnected: boolean;
    memoryOk: boolean;
    diskOk: boolean;
  };
  issues: string[];
  metrics: {
    memoryUsageMB: number;
    memoryTotalMB: number;
    memoryPercentage: number;
    uptime: number;
  };
}

export class HealthMonitorService {
  private nc!: NatsConnection;
  private isRunning = false;
  private checkCount = 0;

  // Critical files that must be accessible
  // Updated for SDLC separation - agents now at /app/agents/personas
  private criticalFiles = [
    '/app/agents/personas/roy-backend.md',
    '/app/agents/personas/jen-frontend.md',
    '/app/src/orchestration/strategic-orchestrator.service.ts'
  ];

  async initialize(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://nats:4222';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'health-monitor-service'
    });

    console.log('[HealthMonitor] Initialized and connected to NATS');
  }

  /**
   * Start monitoring (every 2 minutes)
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('[HealthMonitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[HealthMonitor] Starting health monitoring (every 2 minutes)');

    // Run immediately
    await this.runHealthCheck();

    // Then every 2 minutes
    setInterval(async () => {
      if (this.isRunning) {
        await this.runHealthCheck();
      }
    }, 2 * 60 * 1000);
  }

  /**
   * Run health check
   */
  private async runHealthCheck(): Promise<HealthCheckResult> {
    this.checkCount++;

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        filesAccessible: true,
        natsConnected: true,
        memoryOk: true,
        diskOk: true
      },
      issues: [],
      metrics: {
        memoryUsageMB: 0,
        memoryTotalMB: 0,
        memoryPercentage: 0,
        uptime: process.uptime()
      }
    };

    try {
      // 1. Check critical file accessibility
      this.checkFileAccessibility(result);

      // 2. Check NATS connectivity
      await this.checkNatsConnectivity(result);

      // 3. Check memory usage
      this.checkMemoryUsage(result);

      // 4. Determine overall health
      this.determineOverallHealth(result);

      // 5. Publish to NATS
      await this.publishHealthReport(result);

      // 6. Log summary (only every 5th check to reduce noise)
      if (this.checkCount % 5 === 0) {
        this.logHealthSummary(result);
      }

    } catch (error: any) {
      console.error('[HealthMonitor] Health check failed:', error.message);
      result.status = 'critical';
      result.issues.push(`Health check error: ${error.message}`);
    }

    return result;
  }

  /**
   * Check file accessibility
   */
  private checkFileAccessibility(result: HealthCheckResult): void {
    let missingFiles = 0;

    for (const filePath of this.criticalFiles) {
      if (!fs.existsSync(filePath)) {
        result.checks.filesAccessible = false;
        result.issues.push(`Critical file missing: ${filePath}`);
        missingFiles++;
      }
    }

    if (missingFiles > 0) {
      console.log(`[HealthMonitor] ⚠️  ${missingFiles} critical files missing`);
    }
  }

  /**
   * Check NATS connectivity
   */
  private async checkNatsConnectivity(result: HealthCheckResult): Promise<void> {
    try {
      await this.nc.flush();
      result.checks.natsConnected = true;
    } catch (error: any) {
      result.checks.natsConnected = false;
      result.issues.push('NATS connection failed');
      console.error('[HealthMonitor] ❌ NATS connectivity check failed');
    }
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(result: HealthCheckResult): void {
    const used = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    result.metrics.memoryUsageMB = Math.round(used.heapUsed / 1024 / 1024);
    result.metrics.memoryTotalMB = Math.round(totalMem / 1024 / 1024);
    result.metrics.memoryPercentage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // Alert if memory usage > 90%
    if (result.metrics.memoryPercentage > 90) {
      result.checks.memoryOk = false;
      result.issues.push(`High memory usage: ${result.metrics.memoryPercentage}%`);
      console.warn(`[HealthMonitor] ⚠️  High memory: ${result.metrics.memoryPercentage}%`);
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallHealth(result: HealthCheckResult): void {
    const checks = result.checks;

    // Critical if NATS down or files missing
    if (!checks.natsConnected || !checks.filesAccessible) {
      result.status = 'critical';
    }
    // Degraded if memory issues
    else if (!checks.memoryOk) {
      result.status = 'degraded';
    }
    // Otherwise healthy
    else {
      result.status = 'healthy';
    }
  }

  /**
   * Publish health report to NATS
   */
  private async publishHealthReport(result: HealthCheckResult): Promise<void> {
    try {
      // Publish detailed health report
      await this.nc.publish('agog.monitoring.health', JSON.stringify(result, null, 2));

      // Also publish simple metrics
      await this.nc.publish('agog.metrics.system', JSON.stringify({
        timestamp: result.timestamp,
        healthStatus: result.status,
        memoryUsageMB: result.metrics.memoryUsageMB,
        memoryPercentage: result.metrics.memoryPercentage,
        uptime: result.metrics.uptime,
        checksPass: Object.values(result.checks).filter(v => v === true).length,
        checksTotal: Object.keys(result.checks).length
      }));
    } catch (error: any) {
      console.error('[HealthMonitor] Failed to publish health report:', error.message);
    }
  }

  /**
   * Log health summary
   */
  private logHealthSummary(result: HealthCheckResult): void {
    const icon = result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';

    console.log(`[HealthMonitor] ${icon} Health: ${result.status.toUpperCase()} | Memory: ${result.metrics.memoryUsageMB}MB (${result.metrics.memoryPercentage}%) | Uptime: ${Math.floor(result.metrics.uptime / 60)}m`);

    if (result.issues.length > 0) {
      console.log(`[HealthMonitor] Issues: ${result.issues.join(', ')}`);
    }
  }

  async close(): Promise<void> {
    this.isRunning = false;
    await this.nc.close();
    console.log('[HealthMonitor] Stopped');
  }
}
