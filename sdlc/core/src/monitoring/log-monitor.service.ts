/**
 * Log Monitoring Service
 * Real-time container log analysis with auto-remediation
 * Detects error patterns and fixes common issues automatically
 *
 * NOTE: When running inside Docker without Docker socket mounted,
 * container health and log analysis features are skipped gracefully.
 */

import { connect, NatsConnection } from 'nats';
import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import { isRunningInDocker, canUseDockerCLI } from '../utils/environment';

interface ErrorPattern {
  pattern: RegExp;
  severity: 'critical' | 'error' | 'warning';
  description: string;
  autoFix?: () => Promise<boolean>;
  alertThreshold: number; // Alert after N occurrences
}

interface HealthCheckResult {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'critical';
  issues: Array<{
    type: string;
    severity: string;
    count: number;
    description: string;
    autoFixed: boolean;
  }>;
  remediation: string[];
}

export class LogMonitorService {
  private nc!: NatsConnection;
  private isRunning = false;
  private errorCounts = new Map<string, number>();

  // Define error patterns to monitor
  private errorPatterns: ErrorPattern[] = [
    {
      pattern: /SDLC API.*unreachable|SDLC_API_URL.*not configured/i,
      severity: 'critical',
      description: 'SDLC API connectivity issue',
      alertThreshold: 3,
      autoFix: async () => {
        console.log('[LogMonitor] Auto-fix: Checking SDLC API connectivity...');
        const apiUrl = process.env.SDLC_API_URL;
        if (!apiUrl) {
          console.log('[LogMonitor] SDLC_API_URL not configured in environment');
          return false;
        }
        try {
          const response = await fetch(`${apiUrl}/api/agent/health`);
          if (response.ok) {
            console.log('[LogMonitor] SDLC API is reachable');
            return true;
          }
          console.log('[LogMonitor] SDLC API returned non-OK status');
          return false;
        } catch (error) {
          console.log('[LogMonitor] SDLC API unreachable');
          return false;
        }
      }
    },
    {
      pattern: /ECONNREFUSED.*4222|NATS.*connection.*refused/i,
      severity: 'critical',
      description: 'NATS connection failure',
      alertThreshold: 3,
      autoFix: async () => {
        console.log('[LogMonitor] Auto-fix: Checking NATS connectivity...');
        try {
          // Test NATS connection
          const testNc = await connect({
            servers: process.env.NATS_URL || 'nats://nats:4222',
            user: process.env.NATS_USER,
            pass: process.env.NATS_PASSWORD,
            timeout: 5000
          });
          await testNc.close();
          console.log('[LogMonitor] NATS is accessible. Connectivity restored.');
          return true;
        } catch (error) {
          console.log('[LogMonitor] NATS still unreachable. Service may need restart.');
          return false;
        }
      }
    },
    {
      pattern: /cannot find module|module not found/i,
      severity: 'error',
      description: 'Missing Node.js module',
      alertThreshold: 5,
      autoFix: async () => {
        console.log('[LogMonitor] Auto-fix: Module missing. Check if npm install needed.');
        return false; // Cannot auto-fix, requires rebuild
      }
    },
    {
      pattern: /FATAL|PANIC|out of memory/i,
      severity: 'critical',
      description: 'Critical system error',
      alertThreshold: 1
    },
    {
      pattern: /database.*connection.*failed|ECONNREFUSED.*5432/i,
      severity: 'critical',
      description: 'Database connection failure',
      alertThreshold: 3
    },
    {
      pattern: /heap out of memory|JavaScript heap|allocation failed/i,
      severity: 'critical',
      description: 'Memory exhaustion',
      alertThreshold: 1
    },
    {
      pattern: /Error: spawn.*ENOENT/i,
      severity: 'error',
      description: 'Process spawn failure - binary not found',
      alertThreshold: 3
    },
    {
      pattern: /uncaughtException|unhandledRejection/i,
      severity: 'error',
      description: 'Unhandled exception',
      alertThreshold: 10
    }
  ];

  async initialize(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://nats:4222';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'log-monitor-service'
    });

    console.log('[LogMonitor] Initialized and connected to NATS');
  }

  /**
   * Start continuous monitoring (every 5 minutes)
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('[LogMonitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[LogMonitor] 🔍 Starting continuous log monitoring (every 5 minutes)');

    // Run immediately
    await this.runHealthCheck();

    // Then every 5 minutes
    setInterval(async () => {
      if (this.isRunning) {
        await this.runHealthCheck();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Run comprehensive health check
   */
  private async runHealthCheck(): Promise<HealthCheckResult> {
    console.log('\n[LogMonitor] ═══════════════════════════════════════');
    console.log('[LogMonitor] Running Health Check...');
    console.log('[LogMonitor] ═══════════════════════════════════════');

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      issues: [],
      remediation: []
    };

    try {
      // 1. Check container status
      await this.checkContainerHealth(result);

      // 2. Analyze logs for error patterns
      await this.analyzeLogs(result);

      // 3. Check file accessibility
      await this.checkFileAccessibility(result);

      // 4. Check service connectivity
      await this.checkServiceConnectivity(result);

      // 5. Determine overall status
      const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
      const errorCount = result.issues.filter(i => i.severity === 'error').length;

      if (criticalCount > 0) {
        result.status = 'critical';
      } else if (errorCount > 0) {
        result.status = 'degraded';
      }

      // 6. Publish to NATS
      await this.publishHealthReport(result);

      // 7. Log summary
      this.logHealthSummary(result);

    } catch (error: any) {
      console.error('[LogMonitor] Health check failed:', error.message);
      result.status = 'critical';
      result.issues.push({
        type: 'monitoring_failure',
        severity: 'critical',
        count: 1,
        description: `Health check failed: ${error.message}`,
        autoFixed: false
      });
    }

    return result;
  }

  /**
   * Check container health
   * Requires Docker CLI access (either running on host or Docker socket mounted)
   */
  private async checkContainerHealth(result: HealthCheckResult): Promise<void> {
    // Skip if Docker CLI not available (common when running inside container without socket)
    if (!canUseDockerCLI()) {
      console.log('[LogMonitor] Container health check skipped - Docker CLI not available');
      console.log('[LogMonitor] (Running inside Docker without socket mount is expected)');
      return;
    }

    try {
      const containers = ['sdlc-core', 'sdlc-nats', 'sdlc-ollama'];

      for (const container of containers) {
        const status = execSync(`docker inspect -f '{{.State.Status}}' ${container} 2>&1 || echo "not_found"`, {
          encoding: 'utf-8'
        }).trim();

        if (status !== 'running') {
          result.issues.push({
            type: 'container_not_running',
            severity: 'critical',
            count: 1,
            description: `Container ${container} status: ${status}`,
            autoFixed: false
          });
          result.remediation.push(`Restart container: docker restart ${container}`);
        }
      }
    } catch (error: any) {
      console.log('[LogMonitor] Container health check failed:', error.message);
    }
  }

  /**
   * Analyze container logs for error patterns
   * Requires Docker CLI access (either running on host or Docker socket mounted)
   */
  private async analyzeLogs(result: HealthCheckResult): Promise<void> {
    // Skip if Docker CLI not available
    if (!canUseDockerCLI()) {
      console.log('[LogMonitor] Log analysis skipped - Docker CLI not available');
      return;
    }

    try {
      // Get last 200 lines of logs
      const logs = execSync('docker logs sdlc-core --tail 200 2>&1', {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      for (const errorPattern of this.errorPatterns) {
        const matches = logs.match(new RegExp(errorPattern.pattern, 'gi'));
        const count = matches ? matches.length : 0;

        if (count >= errorPattern.alertThreshold) {
          const key = errorPattern.description;

          // Increment error count
          this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + count);

          // Attempt auto-fix if available
          let autoFixed = false;
          if (errorPattern.autoFix) {
            console.log(`[LogMonitor] Attempting auto-fix for: ${errorPattern.description}`);
            autoFixed = await errorPattern.autoFix();
          }

          result.issues.push({
            type: key.replace(/\s+/g, '_').toLowerCase(),
            severity: errorPattern.severity,
            count,
            description: `${errorPattern.description} (${count} occurrences in last 200 lines)`,
            autoFixed
          });

          if (!autoFixed) {
            result.remediation.push(`Investigate: ${errorPattern.description}`);
          }
        }
      }
    } catch (error: any) {
      console.log('[LogMonitor] Log analysis skipped:', error.message);
    }
  }

  /**
   * Check critical file accessibility
   */
  private async checkFileAccessibility(result: HealthCheckResult): Promise<void> {
    // Updated for SDLC separation - agents now at /app/agents/personas
    const criticalFiles = [
      '/app/agents/personas/roy-backend.md',
      '/app/agents/personas/jen-frontend.md'
    ];

    for (const filePath of criticalFiles) {
      if (!fs.existsSync(filePath)) {
        result.issues.push({
          type: 'file_not_accessible',
          severity: 'critical',
          count: 1,
          description: `Critical file not accessible: ${filePath}`,
          autoFixed: false
        });
        result.remediation.push(`Check volume mount for: ${filePath}`);
      }
    }
  }

  /**
   * Check service connectivity
   */
  private async checkServiceConnectivity(result: HealthCheckResult): Promise<void> {
    // Check NATS connectivity
    try {
      await this.nc.flush();
      console.log('[LogMonitor] ✅ NATS connectivity OK');
    } catch (error: any) {
      result.issues.push({
        type: 'nats_connectivity_failure',
        severity: 'critical',
        count: 1,
        description: 'NATS connectivity check failed',
        autoFixed: false
      });
      result.remediation.push('Check NATS service: docker logs sdlc-nats');
    }
  }

  /**
   * Publish health report to NATS
   */
  private async publishHealthReport(result: HealthCheckResult): Promise<void> {
    try {
      await this.nc.publish('agog.monitoring.health', JSON.stringify(result, null, 2));

      // Also publish to metrics for dashboard
      await this.nc.publish('agog.metrics.system', JSON.stringify({
        timestamp: result.timestamp,
        healthStatus: result.status,
        criticalIssues: result.issues.filter(i => i.severity === 'critical').length,
        errorIssues: result.issues.filter(i => i.severity === 'error').length,
        warningIssues: result.issues.filter(i => i.severity === 'warning').length
      }));
    } catch (error: any) {
      console.error('[LogMonitor] Failed to publish health report:', error.message);
    }
  }

  /**
   * Log health summary
   */
  private logHealthSummary(result: HealthCheckResult): void {
    console.log('\n[LogMonitor] ═══════════════════════════════════════');
    console.log(`[LogMonitor] Health Status: ${result.status.toUpperCase()}`);
    console.log('[LogMonitor] ═══════════════════════════════════════');

    if (result.issues.length === 0) {
      console.log('[LogMonitor] ✅ No issues detected');
    } else {
      console.log(`[LogMonitor] Issues found: ${result.issues.length}`);
      for (const issue of result.issues) {
        const icon = issue.autoFixed ? '🔧' : issue.severity === 'critical' ? '🔴' : issue.severity === 'error' ? '🟡' : '⚪';
        console.log(`[LogMonitor]   ${icon} [${issue.severity.toUpperCase()}] ${issue.description}${issue.autoFixed ? ' (AUTO-FIXED)' : ''}`);
      }
    }

    if (result.remediation.length > 0) {
      console.log('\n[LogMonitor] Recommended Actions:');
      for (const action of result.remediation) {
        console.log(`[LogMonitor]   • ${action}`);
      }
    }

    console.log('[LogMonitor] ═══════════════════════════════════════\n');
  }

  async close(): Promise<void> {
    this.isRunning = false;
    await this.nc.close();
    console.log('[LogMonitor] Monitoring stopped');
  }
}
