/**
 * Redis Cache Module
 * REQ-1767924916114-qbjk4: Implement Redis Cache Warming Strategy
 *
 * Provides:
 * - Redis cache integration using cache-manager
 * - Cache warming on startup for reference data
 * - Cache key strategy and TTL management
 * - Cache invalidation patterns
 * - Cache health monitoring
 */

import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import type { RedisClientOptions } from 'redis';
import { CacheService } from './services/cache.service';
import { CacheWarmingService } from './services/cache-warming.service';
import { CacheKeyService } from './services/cache-key.service';
import { CacheMonitoringService } from './services/cache-monitoring.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';

/**
 * Global Cache Module
 * Provides Redis caching capabilities across all modules
 */
@Global()
@Module({
  imports: [
    // Configure NestJS Cache Manager with Redis
    NestCacheModule.registerAsync<RedisClientOptions>({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisDb = configService.get<number>('REDIS_DB', 0);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        return {
          store: await redisStore({
            socket: {
              host: redisHost,
              port: redisPort,
            },
            password: redisPassword,
            database: redisDb,
            // Connection settings for high availability
            commandsQueueMaxLength: 1000,
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
            enableOfflineQueue: false,
            connectTimeout: 10000,
            keepAlive: 30000,
            // Key prefix for multi-tenancy
            keyPrefix: 'agogsaas:',
          }),
          // Default TTL: 1 hour (can be overridden per cache entry)
          ttl: 3600 * 1000, // milliseconds
          // Max cache size: 100MB
          max: 100 * 1024 * 1024,
          // No size calculation (simple count-based eviction)
          // Redis will handle memory limits via maxmemory-policy
        };
      },
    }),
  ],
  providers: [
    CacheService,
    CacheWarmingService,
    CacheKeyService,
    CacheMonitoringService,
    CacheInvalidationService,
  ],
  exports: [
    NestCacheModule,
    CacheService,
    CacheWarmingService,
    CacheKeyService,
    CacheMonitoringService,
    CacheInvalidationService,
  ],
})
export class CacheModule {}
