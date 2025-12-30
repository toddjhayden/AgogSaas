/**
 * Monitoring Module
 * Provides system health monitoring, error tracking, and agent activity
 *
 * Features:
 * - Real-time agent activity tracking via NATS subscriptions
 * - System health status reporting
 * - Performance analytics and metrics collection
 * - GraphQL API for monitoring dashboard
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MonitoringResolver } from './monitoring.resolver';
import { AgentActivityService } from './services/agent-activity.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';
import { PerformanceResolver } from '../../graphql/resolvers/performance.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [
    MonitoringResolver,
    PerformanceResolver,
    AgentActivityService,
    PerformanceMetricsService,
  ],
  exports: [MonitoringResolver, PerformanceResolver, AgentActivityService, PerformanceMetricsService],
})
export class MonitoringModule {}
