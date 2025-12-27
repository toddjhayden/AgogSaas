/**
 * NestJS Root Application Module
 * AgogSaaS ERP Backend - Complete Migration
 *
 * Phase 1: Foundation (Database, Health, GraphQL)
 * Phase 2: All Business Modules
 * Phase 3: Testing and Deployment
 */

import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ForecastingModule } from './modules/forecasting/forecasting.module';
import { WmsModule } from './modules/wms/wms.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { SalesModule } from './modules/sales/sales.module';
import { OperationsModule } from './modules/operations/operations.module';
import { FinanceModule } from './modules/finance/finance.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { QualityModule } from './modules/quality/quality.module';

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
      typePaths: ['./**/*.graphql'], // Schema-first approach
      playground: true, // Enable playground for testing
      introspection: true,
      context: ({ req }) => ({ req }), // Pass request to resolvers
      path: '/graphql',
    }),

    // Health Check Endpoints
    HealthModule,

    // Business Modules
    ForecastingModule,       // Inventory forecasting and demand planning
    WmsModule,               // Warehouse management and bin optimization
    ProcurementModule,       // Vendor performance and procurement
    SalesModule,             // Sales, materials, quotes, and pricing
    OperationsModule,        // Production operations and manufacturing
    FinanceModule,           // Financial operations and accounting
    TenantModule,            // Multi-tenant foundation
    QualityModule,           // Quality, HR, IoT, Security, Marketplace, Imposition
  ],
})
export class AppModule {}
