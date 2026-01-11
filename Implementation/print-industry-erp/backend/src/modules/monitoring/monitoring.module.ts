/**
 * Monitoring Module
 * Provides system health monitoring, error tracking, and agent activity
 *
 * Features:
 * - Real-time agent activity tracking via NATS subscriptions
 * - System health status reporting
 * - Performance analytics and metrics collection
 * - Database performance monitoring dashboard
 * - GraphQL API for monitoring dashboard
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MonitoringResolver } from './monitoring.resolver';
import { AgentActivityService } from './services/agent-activity.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';
import { HealthMonitorService } from './services/health-monitor.service';
import { DatabasePerformanceService } from './services/database-performance.service';
import { ReplicationMonitoringService } from './services/replication-monitoring.service';
import { PrometheusService } from './services/prometheus.service';
import { EdgeHealthMonitorService } from './services/edge-health-monitor.service';
import { PerformanceResolver } from '../../graphql/resolvers/performance.resolver';
import { DatabasePerformanceResolver } from '../../graphql/resolvers/database-performance.resolver';
import { ReplicationMonitoringResolver } from '../../graphql/resolvers/replication-monitoring.resolver';
import { EdgeMonitoringResolver } from '../../graphql/resolvers/edge-monitoring.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [
    MonitoringResolver,
    PerformanceResolver,
    DatabasePerformanceResolver,
    ReplicationMonitoringResolver,
    EdgeMonitoringResolver,
    AgentActivityService,
    PerformanceMetricsService,
    HealthMonitorService,
    DatabasePerformanceService,
    ReplicationMonitoringService,
    PrometheusService,
    EdgeHealthMonitorService,
  ],
  exports: [
    MonitoringResolver,
    PerformanceResolver,
    DatabasePerformanceResolver,
    ReplicationMonitoringResolver,
    EdgeMonitoringResolver,
    AgentActivityService,
    PerformanceMetricsService,
    HealthMonitorService,
    DatabasePerformanceService,
    ReplicationMonitoringService,
    PrometheusService,
    EdgeHealthMonitorService,
  ],
})
export class MonitoringModule {}
