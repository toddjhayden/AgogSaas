/**
 * Test Data Resolver - For loading P2 forecasting test data
 * DEVELOPMENT ONLY - Remove before production deployment
 */

import { Resolver, Mutation } from '@nestjs/graphql';
import { TestDataLoader } from '../../test-data-loader';

@Resolver()
export class TestDataResolver {
  constructor(private readonly testDataLoader: TestDataLoader) {}

  @Mutation(() => String)
  async loadP2TestData(): Promise<string> {
    const result = await this.testDataLoader.loadP2TestData();
    return JSON.stringify(result, null, 2);
  }
}
