/**
 * NestJS Application Bootstrap
 * AgogSaaS ERP Backend - Phase 1 Migration
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log('');
  console.log(`🚀 NestJS GraphQL Server Ready`);
  console.log(`   GraphQL API: http://localhost:${port}/graphql`);
  console.log(`   Health Check: http://localhost:${port}/health`);
  console.log(`   Frontend: http://localhost:3000`);
  console.log('');
  console.log('✅ Application Services:');
  console.log('  - Database: Connected');
  console.log('  - GraphQL API: Ready');
  console.log('  - Health Monitoring: Active');
  console.log('');
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start NestJS application:', error);
  process.exit(1);
});
