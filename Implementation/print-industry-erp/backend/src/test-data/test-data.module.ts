/**
 * Test Data Module - For development and testing only
 * REMOVE BEFORE PRODUCTION DEPLOYMENT
 */

import { Module } from '@nestjs/common';
import { TestDataLoader } from '../test-data-loader';
import { TestDataResolver } from '../graphql/resolvers/test-data.resolver';

@Module({
  providers: [TestDataLoader, TestDataResolver],
  exports: [TestDataLoader],
})
export class TestDataModule {}
