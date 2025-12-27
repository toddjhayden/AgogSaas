/**
 * Health Resolver
 * Provides basic GraphQL health check query
 */

import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Query(() => String, { description: 'Health check query for GraphQL API' })
  healthCheck(): string {
    return 'OK';
  }

  @Query(() => String, { description: 'API version' })
  version(): string {
    return '1.0.0-nestjs-phase1';
  }
}
