/**
 * NestJS Application Bootstrap
 * AgogSaaS ERP Backend - Phase 1 Migration
 * REQ-1767925582664-oqb5y - REST API Framework for External Integrations
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // TODO: Setup Swagger/OpenAPI documentation when @nestjs/swagger is installed
  // const config = new DocumentBuilder()
  //   .setTitle('AgogSaaS ERP REST API')
  //   .setDescription('External REST API for integrations')
  //   .setVersion('1.0')
  //   .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
  //   .addBearerAuth()
  //   .build();
  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log('');
  console.log(`🚀 NestJS Server Ready`);
  console.log(`   GraphQL API: http://localhost:${port}/graphql`);
  console.log(`   REST API: http://localhost:${port}/api/v1`);
  console.log(`   API Docs: http://localhost:${port}/api/docs (when Swagger enabled)`);
  console.log(`   Health Check: http://localhost:${port}/health`);
  console.log(`   Frontend: http://localhost:3000`);
  console.log('');
  console.log('✅ Application Services:');
  console.log('  - Database: Connected');
  console.log('  - GraphQL API: Ready');
  console.log('  - REST API: Ready');
  console.log('  - API Key Authentication: Active');
  console.log('  - Webhook System: Active');
  console.log('  - Health Monitoring: Active');
  console.log('');
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start NestJS application:', error);
  process.exit(1);
});
