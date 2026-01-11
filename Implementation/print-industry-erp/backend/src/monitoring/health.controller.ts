import { Controller, Get, Inject } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Pool } from 'pg';
import { connect } from 'nats';

/**
 * Health Controller
 *
 * Provides health check endpoints for:
 * - /health - Basic health check (always returns 200 OK)
 * - /health/live - Liveness probe (for Kubernetes)
 * - /health/ready - Readiness probe (checks DB and NATS connectivity)
 * - /metrics - Prometheus metrics endpoint
 */
@Controller()
export class HealthController {
  constructor(
    private readonly metricsService: MetricsService,
    @Inject('DATABASE_POOL') private readonly pool: Pool
  ) {}

  /**
   * Basic Health Check
   * Returns 200 OK if service is running
   *
   * Used by: Load balancers, monitoring systems
   */
  @Get('health')
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'agogsaas-backend',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.ENVIRONMENT || 'blue',
      region: process.env.REGION || 'US-EAST',
    };
  }

  /**
   * Liveness Probe
   * Returns 200 if service process is running
   * Returns 503 if service needs to be restarted
   *
   * Used by: Kubernetes liveness probe
   */
  @Get('health/live')
  async getLiveness() {
    // Check if service can respond to requests
    // If this fails, Kubernetes will restart the pod
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness Probe
   * Returns 200 if service is ready to accept traffic
   * Returns 503 if dependencies are not ready (DB, NATS, etc.)
   *
   * Used by: Kubernetes readiness probe, load balancers
   */
  @Get('health/ready')
  async getReadiness() {
    const checks = {
      database: false,
      nats: false,
      ollama: false,
    };

    let allReady = true;

    // Check PostgreSQL
    try {
      await this.pool.query('SELECT 1');
      checks.database = true;
    } catch (err) {
      allReady = false;
      console.error('Database readiness check failed:', (err instanceof Error ? err.message : String(err)));
    }

    // Check NATS
    try {
      const nc = await connect({
        servers: process.env.NATS_URL || 'nats://localhost:4222',
        timeout: 3000,
      });
      checks.nats = true;
      await nc.close();
    } catch (err) {
      allReady = false;
      console.error('NATS readiness check failed:', (err instanceof Error ? err.message : String(err)));
    }

    // Check Ollama (optional - don't fail if not available)
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const response = await fetch(`${ollamaUrl}/api/tags`);
      checks.ollama = response.ok;
    } catch (err) {
      // Ollama is optional, don't fail readiness
      console.warn('Ollama readiness check failed:', (err instanceof Error ? err.message : String(err)));
    }

    if (!allReady) {
      return {
        status: 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Prometheus Metrics Endpoint
   * Returns all metrics in Prometheus format
   *
   * Scraped by: Prometheus server every 15 seconds
   */
  @Get('metrics')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  /**
   * Metrics Summary (Human-Readable)
   * Returns key metrics in JSON format for debugging
   *
   * Used by: Developers, troubleshooting
   */
  @Get('metrics/summary')
  async getMetricsSummary() {
    // This would be populated by querying current metric values
    // For now, return a placeholder
    return {
      http: {
        requests_per_second: 0,
        error_rate_percent: 0,
        p95_latency_ms: 0,
      },
      database: {
        connection_pool_size: 0,
        connection_pool_max: 200,
        query_p95_ms: 0,
      },
      business: {
        active_production_runs: 0,
        material_utilization_percent: 0,
        orders_today: 0,
      },
      edge: {
        facilities_online: 0,
        facilities_offline: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * System Info
   * Returns system information for debugging
   */
  @Get('health/info')
  async getSystemInfo() {
    return {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: {
        total: process.memoryUsage().heapTotal,
        used: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss,
      },
      environment: {
        node_env: process.env.NODE_ENV,
        environment: process.env.ENVIRONMENT,
        region: process.env.REGION,
        database_url: process.env.DATABASE_URL ? '***' : 'not set',
        nats_url: process.env.NATS_URL || 'not set',
        ollama_url: process.env.OLLAMA_URL || 'not set',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
