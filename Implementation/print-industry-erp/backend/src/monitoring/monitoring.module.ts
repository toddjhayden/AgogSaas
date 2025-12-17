import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { HealthController } from './health.controller';

/**
 * Monitoring Module
 *
 * Provides:
 * - Prometheus metrics collection
 * - Health check endpoints
 * - Application instrumentation
 */
@Module({
  providers: [MetricsService],
  controllers: [HealthController],
  exports: [MetricsService],
})
export class MonitoringModule {}
