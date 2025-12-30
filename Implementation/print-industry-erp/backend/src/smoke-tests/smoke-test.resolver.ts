/**
 * Smoke Test Resolver
 * GraphQL resolver for running smoke tests
 * REQ: REQ-STRATEGIC-AUTO-1767045901874 - Deployment Health Verification & Smoke Tests
 */

import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { SmokeTestService, SmokeTestReport } from './smoke-test.service';

@Resolver()
export class SmokeTestResolver {
  constructor(private readonly smokeTestService: SmokeTestService) {}

  @Mutation(() => String, { description: 'Run all smoke tests and return JSON report' })
  async runSmokeTests(
    @Args('category', { type: () => String, nullable: true }) category?: string,
  ): Promise<string> {
    const report = await this.smokeTestService.runAllTests();
    return JSON.stringify(report, null, 2);
  }

  @Mutation(() => String, { description: 'Run critical smoke tests only' })
  async runCriticalSmokeTests(): Promise<string> {
    const report = await this.smokeTestService.runCriticalTests();
    return JSON.stringify(report, null, 2);
  }

  @Query(() => String, { description: 'Get smoke test documentation' })
  smokeTestInfo(): string {
    return JSON.stringify({
      description: 'Smoke Test Framework for AgogSaaS ERP',
      availableMutations: [
        {
          name: 'runSmokeTests',
          description: 'Run all smoke tests',
          usage: 'mutation { runSmokeTests }',
        },
        {
          name: 'runCriticalSmokeTests',
          description: 'Run critical smoke tests only',
          usage: 'mutation { runCriticalSmokeTests }',
        },
      ],
      testCategories: [
        'Database - Critical table and extension checks',
        'WMS - Bin utilization and optimization',
        'Forecasting - Inventory forecasting and replenishment',
        'Sales - Quote automation',
        'Procurement - Vendor scorecards and purchase orders',
        'Integration - Data integrity and tenant isolation',
      ],
    }, null, 2);
  }
}
