/**
 * Health Module
 * Provides health check endpoints for monitoring
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthResolver } from './health.resolver';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [HealthController],
  providers: [HealthResolver],
})
export class HealthModule {}
