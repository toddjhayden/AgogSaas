/**
 * Monitoring GraphQL Resolver (NestJS)
 * Provides real-time monitoring data from NATS
 */

import { Resolver, Query } from '@nestjs/graphql';
import { AgentActivityService } from './services/agent-activity.service';

@Resolver()
export class MonitoringResolver {
  constructor(private agentActivityService: AgentActivityService) {}

  /**
   * Get current system health
   * Returns stub data indicating system is operational
   */
  @Query()
  systemHealth() {
    return {
      overall: 'OPERATIONAL',
      backend: {
        name: 'backend',
        status: 'OPERATIONAL',
        lastCheck: new Date().toISOString(),
        responseTime: 50,
        error: null,
        metadata: {}
      },
      frontend: {
        name: 'frontend',
        status: 'OPERATIONAL',
        lastCheck: new Date().toISOString(),
        responseTime: 30,
        error: null,
        metadata: {}
      },
      database: {
        name: 'database',
        status: 'OPERATIONAL',
        lastCheck: new Date().toISOString(),
        responseTime: 10,
        error: null,
        metadata: {}
      },
      nats: {
        name: 'nats',
        status: 'OPERATIONAL',
        lastCheck: new Date().toISOString(),
        responseTime: 5,
        error: null,
        metadata: {}
      },
      timestamp: new Date().toISOString()
    };
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
