/**
 * Cache Management Module
 * REQ-1767541724200-xzjz9: Redis Caching Layer
 *
 * Exposes cache management operations via GraphQL:
 * - Cache monitoring and statistics
 * - Cache warming operations
 * - Cache invalidation operations
 */

import { Module } from '@nestjs/common';
import { CacheResolver } from '../../graphql/resolvers/cache.resolver';

@Module({
  providers: [CacheResolver],
  exports: [],
})
export class CacheManagementModule {}
