/**
 * Monitoring GraphQL Resolver (NestJS)
 * Provides real-time monitoring data from NATS
 */

import { Resolver, Query, Args } from '@nestjs/graphql';
import { AgentActivityService } from './services/agent-activity.service';
import { HealthMonitorService } from './services/health-monitor.service';

@Resolver()
export class MonitoringResolver {
  constructor(
    private agentActivityService: AgentActivityService,
    private healthMonitorService: HealthMonitorService
  ) {}

  /**
   * Get current system health
   * Returns real-time health data from HealthMonitorService
   */
  @Query()
  async systemHealth() {
    const health = await this.healthMonitorService.checkSystemHealth();
    return {
      overall: health.overall,
      backend: {
        name: health.backend.name,
        status: health.backend.status,
        lastCheck: health.backend.lastCheck.toISOString(),
        responseTime: health.backend.responseTime || null,
        error: health.backend.error || null,
        metadata: health.backend.metadata || {}
      },
      frontend: {
        name: health.frontend.name,
        status: health.frontend.status,
        lastCheck: health.frontend.lastCheck.toISOString(),
        responseTime: health.frontend.responseTime || null,
        error: health.frontend.error || null,
        metadata: health.frontend.metadata || {}
      },
      database: {
        name: health.database.name,
        status: health.database.status,
        lastCheck: health.database.lastCheck.toISOString(),
        responseTime: health.database.responseTime || null,
        error: health.database.error || null,
        metadata: health.database.metadata || {}
      },
      nats: {
        name: health.nats.name,
        status: health.nats.status,
        lastCheck: health.nats.lastCheck.toISOString(),
        responseTime: health.nats.responseTime || null,
        error: health.nats.error || null,
        metadata: health.nats.metadata || {}
      },
      timestamp: health.timestamp.toISOString()
    };
  }

  /**
   * Get health history for a specific component
   */
  @Query()
  async healthHistory(
    @Args('component', { nullable: true }) component?: string,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string
  ) {
    const history = await this.healthMonitorService.getHealthHistory(
      component,
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined
    );
    return history.map(h => ({
      name: h.name,
      status: h.status,
      lastCheck: h.lastCheck.toISOString(),
      responseTime: h.responseTime || null,
      error: h.error || null,
      metadata: h.metadata || {}
    }));
  }

  /**
   * Get system errors
   * Returns empty array (stub)
   */
  @Query()
  systemErrors() {
    return [];
  }

  /**
   * Get active agent activities
   * Returns real-time agent activity from NATS subscriptions
   */
  @Query()
  agentActivities() {
    return this.agentActivityService.getAllActivities();
  }

  /**
   * Get active fixes
   * Returns empty array (stub)
   */
  @Query()
  activeFixes() {
    return [];
  }

  /**
   * Get monitoring statistics
   * Returns statistics including real agent counts
   */
  @Query()
  monitoringStats() {
    const stats = this.agentActivityService.getStats();

    return {
      openErrors: 0,
      criticalErrors24h: 0,
      activeAgents: stats.activeAgents,
      avgWorkflowDuration: 0,
      uptimePercentage: 99.9,
      completedWorkflows: 0
    };
  }
}
