/**
 * NestJS Root Application Module
 * AgogSaaS ERP Backend - Phase 1 Migration
 */

import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Global Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database Connection Pool
    DatabaseModule,

    // GraphQL with Apollo Server
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true, // Code-first approach
      sortSchema: true,
      playground: false, // Disable until resolvers are migrated
      introspection: true,
      context: ({ req }) => ({ req }), // Pass request to resolvers
      path: '/graphql',
    }),

    // Health Check Endpoints
    HealthModule,
  ],
})
export class AppModule {}
