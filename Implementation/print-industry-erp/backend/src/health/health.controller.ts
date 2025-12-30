/**
 * Health Check Controller
 * Provides comprehensive health monitoring endpoints
 * REQ: REQ-STRATEGIC-AUTO-1767045901874 - Deployment Health Verification & Smoke Tests
 */

import { Controller, Get, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { Pool } from 'pg';

interface HealthCheckResult {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  message: string;
  duration: number;
  metadata?: any;
}

interface ComponentHealth {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  checks: HealthCheckResult[];
  lastChecked: Date;
}

interface HealthStatus {
  overall: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: Date;
  components: ComponentHealth[];
  metrics: {
    uptime: number;
    memoryUsedMB: number;
    memoryTotalMB: number;
    databaseLatency?: number;
    poolUtilization?: number;
  };
}

@Controller('health')
export class HealthController {
  private startupComplete = false;

  constructor(@Inject('DATABASE_POOL') private pool: Pool) {
    // Mark startup complete after a brief initialization period
    setTimeout(() => {
      this.startupComplete = true;
    }, 3000);
  }

  /**
   * Kubernetes Liveness Probe
   * Returns 200 if application is alive (not crashed)
   * Returns 503 if application should be restarted
   */
  @Get('live')
  async liveness() {
    try {
      return {
        status: 'alive',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException('Application is not alive', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Kubernetes Readiness Probe
   * Returns 200 if application is ready to accept traffic
   * Returns 503 if application is alive but not ready
   */
  @Get('ready')
  async readiness() {
    const checks = await this.checkReadiness();
    const isReady = checks.every(c => c.ready);

    if (!isReady) {
      throw new HttpException(
        {
          status: 'not ready',
          timestamp: new Date().toISOString(),
          checks,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Kubernetes Startup Probe
   * Returns 200 when application has finished starting up
   * Returns 503 during startup
   */
  @Get('startup')
  async startup() {
    if (!this.startupComplete) {
      throw new HttpException(
        {
          status: 'starting',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'started',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Comprehensive Health Check
   * Returns detailed health status of all components
   */
  @Get()
  async check(): Promise<HealthStatus> {
    const components: ComponentHealth[] = [
      await this.checkDatabaseHealth(),
    ];

    const overall = this.aggregateStatus(components);

    const metrics = {
      uptime: process.uptime(),
      memoryUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      databaseLatency: components[0]?.checks.find(c => c.name === 'latency')?.duration,
      poolUtilization: components[0]?.checks.find(c => c.name === 'pool_utilization')?.metadata?.utilization,
    };

    return {
      overall,
      timestamp: new Date(),
      components,
      metrics,
    };
  }

  /**
   * Check if system is ready to accept traffic
   */
  private async checkReadiness(): Promise<Array<{ component: string; ready: boolean; message: string }>> {
    const checks: Array<{ component: string; ready: boolean; message: string }> = [];

    // Check database connection
    const start = Date.now();
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      const duration = Date.now() - start;

      checks.push({
        component: 'database',
        ready: duration < 1000, // Not ready if query takes >1s
        message: `Database query: ${duration}ms`,
      });
    } catch (error) {
      checks.push({
        component: 'database',
        ready: false,
        message: `Database error: ${error.message}`,
      });
    }

    return checks;
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const checks: HealthCheckResult[] = [];

    // Check 1: Connection
    checks.push(await this.checkDatabaseConnection());

    // Check 2: Latency
    checks.push(await this.checkDatabaseLatency());

    // Check 3: Pool utilization
    checks.push(await this.checkPoolUtilization());

    const status = this.aggregateChecks(checks);

    return {
      name: 'database',
      status,
      checks,
      lastChecked: new Date(),
    };
  }

  private async checkDatabaseConnection(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      return {
        name: 'connection',
        status: 'HEALTHY',
        message: 'Database connection successful',
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'connection',
        status: 'UNHEALTHY',
        message: `Database connection failed: ${error.message}`,
        duration: Date.now() - start,
      };
    }
  }

  private async checkDatabaseLatency(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      const duration = Date.now() - start;

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      if (duration > 1000) status = 'UNHEALTHY';
      else if (duration > 500) status = 'DEGRADED';

      return {
        name: 'latency',
        status,
        message: `Query latency: ${duration}ms`,
        duration,
        metadata: {
          latency: duration,
          threshold_degraded: 500,
          threshold_unhealthy: 1000,
        },
      };
    } catch (error) {
      return {
        name: 'latency',
        status: 'UNHEALTHY',
        message: `Latency check failed: ${error.message}`,
        duration: Date.now() - start,
      };
    }
  }

  private async checkPoolUtilization(): Promise<HealthCheckResult> {
    try {
      const totalConnections = this.pool.totalCount;
      const idleConnections = this.pool.idleCount;
      const utilization = totalConnections > 0
        ? ((totalConnections - idleConnections) / totalConnections) * 100
        : 0;

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      if (utilization > 90) status = 'UNHEALTHY';
      else if (utilization > 75) status = 'DEGRADED';

      return {
        name: 'pool_utilization',
        status,
        message: `Pool utilization: ${utilization.toFixed(1)}%`,
        duration: 0,
        metadata: {
          utilization,
          totalConnections,
          idleConnections,
        },
      };
    } catch (error) {
      return {
        name: 'pool_utilization',
        status: 'UNHEALTHY',
        message: `Pool check failed: ${error.message}`,
        duration: 0,
      };
    }
  }

  private aggregateChecks(checks: HealthCheckResult[]): 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' {
    if (checks.some(c => c.status === 'UNHEALTHY')) return 'UNHEALTHY';
    if (checks.some(c => c.status === 'DEGRADED')) return 'DEGRADED';
    return 'HEALTHY';
  }

  private aggregateStatus(components: ComponentHealth[]): 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' {
    if (components.some(c => c.status === 'UNHEALTHY')) return 'UNHEALTHY';
    if (components.some(c => c.status === 'DEGRADED')) return 'DEGRADED';
    return 'HEALTHY';
  }
}
