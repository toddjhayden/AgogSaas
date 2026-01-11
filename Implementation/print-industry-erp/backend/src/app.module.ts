/**
 * NestJS Root Application Module
 * AgogSaaS ERP Backend - Complete Migration
 *
 * Phase 1: Foundation (Database, Health, GraphQL)
 * Phase 2: All Business Modules
 * Phase 3: Testing and Deployment
 */

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { Context } from 'graphql-ws';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
// import { HealthModule as RuntimeHealthModule } from './common/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantContextPlugin } from './common/plugins/tenant-context.plugin';
import { QueryComplexityPlugin } from './common/plugins/query-complexity.plugin';
import { QueryDepthLimiterPlugin } from './common/plugins/query-depth-limiter.plugin';
import { SecurityValidationPlugin } from './common/plugins/security-validation.plugin';
import { GraphQLSecurityModule } from './common/graphql/graphql-security.module';
// import { WebSocketSecurityModule } from './common/websocket';
import { CacheModule } from './cache/cache.module';
import { AuditLoggingInterceptor } from './common/interceptors/audit-logging.interceptor';
// import {
//   WebSocketAuthService,
//   WebSocketRateLimiterService,
//   WebSocketMonitorService,
//   WebSocketOriginValidatorService,
//   WebSocketSubscriptionGuardService,
// } from './common/websocket';
import { ValidatedUser } from './modules/auth/strategies/jwt.strategy';
import { ForecastingModule } from './modules/forecasting/forecasting.module';

// Type definitions for GraphQL context
interface AuthenticatedRequest extends Request {
  user?: ValidatedUser;
}

interface GraphQLHttpContext {
  req: AuthenticatedRequest;
  user?: ValidatedUser;
  tenantId?: string;
  dbPool?: Pool;
}

interface WebSocketConnectionParams {
  authToken?: string;
  authorization?: string;
  [key: string]: unknown;
}

// Type for graphql-ws Context extra field
interface WebSocketExtra {
  request?: {
    headers?: Record<string, string | string[]>;
    socket?: {
      remoteAddress?: string;
    };
  };
}

interface WebSocketSubscriptionContext extends Record<string, unknown> {
  sessionId: string;
  user: ValidatedUser;
  tenantId: string;
  dbPool: Pool;
  wsAuth: WebSocketAuthService;
  wsRateLimit: WebSocketRateLimiterService;
  wsMonitor: WebSocketMonitorService;
  wsSubscriptionGuard: WebSocketSubscriptionGuardService;
}

interface GraphQLSubscriptionMessage {
  id?: string;
  payload?: {
    query?: string;
  };
}
import { WmsModule } from './modules/wms/wms.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { SalesModule } from './modules/sales/sales.module';
import { OperationsModule } from './modules/operations/operations.module';
import { FinanceModule } from './modules/finance/finance.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { QualityModule } from './modules/quality/quality.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { TestDataModule } from './test-data/test-data.module';
import { CustomerPortalModule } from './modules/customer-portal/customer-portal.module';
import { SPCModule } from './modules/spc/spc.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { EstimatingModule } from './modules/estimating/estimating.module';
import { JobCostingModule } from './modules/job-costing/job-costing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { PredictiveMaintenanceModule } from './modules/predictive-maintenance/predictive-maintenance.module';
import { CrmModule } from './modules/crm/crm.module';
import { SupplierPortalModule } from './modules/supplier-portal/supplier-portal.module';
import { DevOpsModule } from './modules/devops/devops.module';
import { SecurityModule } from './modules/security/security.module';
// import { SDLCModule } from './modules/sdlc/sdlc.module';
import { RestApiModule } from './modules/rest-api/rest-api.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CacheManagementModule } from './modules/cache-management/cache-management.module';
import { SagaModule } from './modules/saga/saga.module';

@Module({
  imports: [
    // Global Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database Connection Pool
    DatabaseModule,

    // Runtime Dependency Health Validation (REQ-AUDIT-1767982074)
    // RuntimeHealthModule,

    // Redis Caching Layer (REQ-1767541724200-xzjz9)
    CacheModule,

    // WebSocket Security Framework
    // REQ-1767183219586: WebSocket Security Hardening + Authentication Framework
    // WebSocketSecurityModule,

    // GraphQL Security Module
    // REQ-1767925582666-3sc6l: GraphQL Query Complexity Control & Security Hardening
    GraphQLSecurityModule,

    // GraphQL with Apollo Server + Tenant Isolation + WebSocket Support
    // REQ-STRATEGIC-AUTO-1767108044308: Real-Time Collaboration
    // REQ-1767183219586: Enhanced WebSocket Security
    // REQ-1767925582666-3sc6l: Query Complexity Control
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [DatabaseModule],
      inject: [
        'DATABASE_POOL',
        // WebSocketAuthService,
        // WebSocketRateLimiterService,
        // WebSocketMonitorService,
        // WebSocketOriginValidatorService,
        // WebSocketSubscriptionGuardService,
      ],
      useFactory: (
        dbPool: Pool,
        // wsAuth: WebSocketAuthService,
        // wsRateLimit: WebSocketRateLimiterService,
        // wsMonitor: WebSocketMonitorService,
        // wsOriginValidator: WebSocketOriginValidatorService,
        // wsSubscriptionGuard: WebSocketSubscriptionGuardService,
      ) => ({
        typePaths: ['./**/*.graphql'],
        playground: process.env.NODE_ENV !== 'production', // Disable in production
        introspection: process.env.NODE_ENV !== 'production', // Disable in production

        // HTTP Context (Queries/Mutations)
        context: ({ req }: { req: Request }): GraphQLHttpContext => {
          const authenticatedReq = req as AuthenticatedRequest;

          // Extract tenant ID from authenticated user
          const tenantId = authenticatedReq.user?.tenantId;

          // If user is authenticated and has tenant, set up database context
          if (tenantId && authenticatedReq.user) {
            try {
              // NOTE: Use connection pool, not dedicated connection per Sylvia's critique
              // Dedicated connections cause pool exhaustion with WebSockets

              // Set session variable for Row-Level Security (RLS)
              // This is done per-query in services, not per-connection

              // Return context with user and tenant info
              return {
                req: authenticatedReq,
                user: authenticatedReq.user,
                tenantId,
                dbPool // Pass pool, not client
              };
            } catch (error) {
              console.error('Failed to set tenant context:', error);
              // Fall through to return basic context
            }
          }

          // Return basic context (for unauthenticated requests or errors)
          return { req: authenticatedReq };
        },

        // CRITICAL SECURITY: WebSocket Authentication
        // REQ-1767183219586: WebSocket Security Hardening + Authentication Framework
        subscriptions: {
          'graphql-ws': ({
            onConnect: async (context: Context): Promise<WebSocketSubscriptionContext> => {
              const startTime = Date.now();
              const sessionId = `ws-${randomUUID()}`;

              try {
                // Extract origin and IP
                const origin = wsOriginValidator.extractOriginFromContext(context);
                const ip = wsOriginValidator.extractIPFromContext(context);

                // Validate origin (CORS protection)
                const originResult = await wsOriginValidator.validateOrigin(origin);
                if (!originResult.allowed) {
                  wsMonitor.recordEvent({
                    sessionId,
                    eventType: 'AUTH_FAILURE',
                    errorMessage: `Origin validation failed: ${originResult.reason ?? 'Unknown reason'}`,
                    ip,
                  });
                  throw new Error(`Origin not allowed: ${originResult.reason ?? 'Unknown reason'}`);
                }

                // Extract authentication token
                const connectionParams = (context.connectionParams ?? {}) as WebSocketConnectionParams;
                const authToken = connectionParams.authToken ?? connectionParams.authorization;

                if (!authToken) {
                  wsMonitor.recordEvent({
                    sessionId,
                    eventType: 'AUTH_FAILURE',
                    errorMessage: 'Missing authentication token',
                    ip,
                  });
                  throw new Error('Missing authentication token for WebSocket connection');
                }

                // Validate JWT token (replaces TODO with actual implementation)
                const user = await wsAuth.validateWebSocketToken(authToken);

                // Check rate limits
                const rateLimitResult = wsRateLimit.canConnect(user.userId, ip ?? 'unknown');
                if (!rateLimitResult.allowed) {
                  if (rateLimitResult.violation) {
                    await wsRateLimit.logViolation(rateLimitResult.violation, sessionId);
                  }
                  wsMonitor.recordEvent({
                    sessionId,
                    userId: user.userId,
                    tenantId: user.tenantId,
                    eventType: 'RATE_LIMIT_VIOLATION',
                    errorMessage: rateLimitResult.violation?.limitType ?? 'Unknown limit type',
                    ip,
                  });
                  throw new Error('Rate limit exceeded');
                }

                // Register connection
                wsRateLimit.registerConnection(sessionId, user.userId, ip ?? 'unknown');

                // Create session
                await wsAuth.createSession(sessionId, user, {
                  origin,
                  ip,
                  connectedAt: new Date(),
                });

                // Record successful connection
                wsMonitor.recordEvent({
                  sessionId,
                  userId: user.userId,
                  tenantId: user.tenantId,
                  eventType: 'CONNECTED',
                  ip,
                  metadata: {
                    origin,
                    authDuration: Date.now() - startTime,
                  },
                });

                // Return user context for ALL subscription operations
                return {
                  sessionId,
                  user,
                  tenantId: user.tenantId,
                  dbPool, // Pass pool for query execution
                  wsAuth,
                  wsRateLimit,
                  wsMonitor,
                  wsSubscriptionGuard,
                };
              } catch (error) {
                console.error('WebSocket authentication failed:', error);
                wsMonitor.recordEvent({
                  sessionId,
                  eventType: 'AUTH_FAILURE',
                  errorMessage: (error as Error).message,
                });
                throw error;
              }
            },

            onDisconnect: async (context: WebSocketSubscriptionContext) => {
              try {
                const { sessionId, user } = context;
                if (sessionId && user) {
                  const ip = wsOriginValidator.extractIPFromContext(context);

                  // Terminate session
                  await wsAuth.terminateSession(sessionId, 'CLIENT_DISCONNECT');

                  // Unregister connection
                  wsRateLimit.unregisterConnection(sessionId, user.userId, ip ?? 'unknown');

                  // Record disconnection
                  wsMonitor.recordEvent({
                    sessionId,
                    userId: user.userId,
                    tenantId: user.tenantId,
                    eventType: 'DISCONNECTED',
                    ip,
                  });
                }
              } catch (error) {
                console.error('WebSocket disconnect cleanup error:', error);
              }
            },

            // Subscription-level authorization
            onSubscribe: async (context: WebSocketSubscriptionContext, message: GraphQLSubscriptionMessage) => {
              try {
                const { user, sessionId, wsSubscriptionGuard, wsRateLimit, wsMonitor } = context;
                const subscriptionMatch = message.payload?.query?.match(
                  /subscription\s+(\w+)/,
                );
                const subscriptionName = subscriptionMatch?.[1];

                if (!subscriptionName) {
                  throw new Error('Invalid subscription format');
                }

                // Check subscription rate limits
                const rateLimitResult = wsRateLimit.canSubscribe(sessionId);
                if (!rateLimitResult.allowed) {
                  if (rateLimitResult.violation) {
                    await wsRateLimit.logViolation(rateLimitResult.violation, sessionId);
                  }
                  wsMonitor.recordEvent({
                    sessionId,
                    userId: user.userId,
                    tenantId: user.tenantId,
                    eventType: 'RATE_LIMIT_VIOLATION',
                    subscriptionName,
                    errorMessage: rateLimitResult.violation?.limitType ?? 'Unknown limit type',
                  });
                  throw new Error('Subscription rate limit exceeded');
                }

                // Check subscription authorization
                const authResult = await wsSubscriptionGuard.canSubscribe(
                  subscriptionName,
                  user,
                );
                if (!authResult.allowed) {
                  await wsSubscriptionGuard.logAuthorizationAttempt(
                    subscriptionName,
                    user,
                    false,
                    authResult.reason,
                  );
                  wsMonitor.recordEvent({
                    sessionId,
                    userId: user.userId,
                    tenantId: user.tenantId,
                    eventType: 'ERROR',
                    subscriptionName,
                    errorMessage: `Authorization denied: ${authResult.reason ?? 'Unknown reason'}`,
                  });
                  throw new Error(authResult.reason ?? 'Subscription not authorized');
                }

                // Register subscription
                wsRateLimit.registerSubscription(sessionId);
                wsAuth.addSubscription(sessionId, subscriptionName);

                // Record subscription
                wsMonitor.recordEvent({
                  sessionId,
                  userId: user.userId,
                  tenantId: user.tenantId,
                  eventType: 'SUBSCRIBED',
                  subscriptionName,
                });
              } catch (error) {
                console.error('Subscription authorization failed:', error);
                throw error;
              }
            },

            // Cleanup when subscription ends
            onComplete: (context: WebSocketSubscriptionContext, message: GraphQLSubscriptionMessage) => {
              try {
                const { sessionId, wsRateLimit, wsAuth } = context;
                const subscriptionId = message.id;

                if (sessionId && subscriptionId) {
                  wsRateLimit.unregisterSubscription(sessionId);
                  wsAuth.removeSubscription(sessionId, subscriptionId);
                }
              } catch (error) {
                console.error('Subscription cleanup error:', error);
              }
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any),
        },

        path: '/graphql',
        plugins: [
          new TenantContextPlugin(),
          new QueryComplexityPlugin(),
          new QueryDepthLimiterPlugin(),
          new SecurityValidationPlugin(),
        ],
      }),
    }),

    // Health Check Endpoints
    HealthModule,

    // Authentication & Authorization
    AuthModule,

    // Business Modules
    ForecastingModule,       // Inventory forecasting and demand planning
    WmsModule,               // Warehouse management and bin optimization
    ProcurementModule,       // Vendor performance and procurement
    SalesModule,             // Sales, materials, quotes, and pricing
    OperationsModule,        // Production operations and manufacturing
    FinanceModule,           // Financial operations and accounting
    TenantModule,            // Multi-tenant foundation
    QualityModule,           // Quality, HR, IoT, Security, Marketplace, Imposition
    MonitoringModule,        // System health monitoring and agent activity
    CustomerPortalModule,    // Customer portal & self-service ordering
    SPCModule,               // Statistical Process Control (SPC) and quality analytics
    AnalyticsModule,         // Advanced Reporting & Business Intelligence Suite
    EstimatingModule,        // Estimating and cost calculation
    JobCostingModule,        // Job costing and profitability tracking
    PaymentsModule,          // Payment Gateway Integration (Stripe, ACH)
    WorkflowModule,          // Workflow Automation Engine (REQ-STRATEGIC-AUTO-1767108044309)
    PredictiveMaintenanceModule, // Predictive Maintenance AI (REQ-STRATEGIC-AUTO-1767108044310)
    CrmModule,               // Integrated CRM & Sales Pipeline Management (REQ-STRATEGIC-AUTO-1767116143665)
    SupplierPortalModule,    // Supply Chain Visibility & Supplier Portal (REQ-STRATEGIC-AUTO-1767116143666)
    DevOpsModule,            // DevOps Automation & Deployment Approvals (REQ-DEVOPS-DEPLOY-APPROVAL-1767150339448)
    SecurityModule,          // Security Audit Dashboard & Threat Detection (REQ-DEVOPS-SECURITY-1767150339448)
    // SDLCModule,              // SDLC Control - Entity DAG, Kanban, Column Governance
    RestApiModule,           // REST API Framework for External Integrations (REQ-1767925582664-oqb5y)
    NotificationsModule,     // Centralized Notification System (REQ-1767925582665-67qxb)
    WebhooksModule,          // Webhook Event System & Event Subscriptions (REQ-1767925582664-n6du5)
    CacheManagementModule,   // Cache Management & Monitoring (REQ-1767541724200-xzjz9)
    SagaModule,              // Saga Pattern for Distributed Transactions (REQ-1767541724201-s8kck)

    // DEVELOPMENT ONLY - Test Data Loading
    TestDataModule,
  ],
  providers: [
    // Global Audit Logging Interceptor
    // REQ-1767924916114-xhhll - Comprehensive Audit Logging
    // Automatically logs all GraphQL mutations to security_audit_events table
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggingInterceptor,
    },
  ],
})
export class AppModule {}
