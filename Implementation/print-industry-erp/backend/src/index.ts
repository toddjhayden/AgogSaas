/**
 * AgogSaaS Backend Server - ERP Application
 * Portable deployment - Edge/Cloud/Global
 * NO AGENT DEPENDENCIES
 */

import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server';
import { Pool } from 'pg';

dotenv.config();

// Application Monitoring Services
import { monitoringTypeDefs, monitoringResolvers } from './modules/monitoring/graphql';
import { HealthMonitorService } from './modules/monitoring/services/health-monitor.service';
import { ErrorTrackingService } from './modules/monitoring/services/error-tracking.service';

// WMS Optimization Services (REQ-STRATEGIC-AUTO-1766476803478)
import { readFileSync } from 'fs';
import { join } from 'path';
import { wmsOptimizationResolvers } from './graphql/resolvers/wms-optimization.resolver';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://agogsaas_user:changeme@localhost:5432/agogsaas',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize application monitoring services
const healthMonitor = new HealthMonitorService();
const errorTracking = new ErrorTrackingService(pool);

// Stub agent services (agent-only features, return empty data in production)
const agentActivity = {
  getAllActivities: async () => [],
  getActivityByAgentId: async () => null,
  getStats: async () => ({ activeAgents: 0 }),
};

const activeFixes = {
  getActiveFixes: async () => [],
  getFixByReqNumber: async () => null,
};

const orchestrator = {
  workflows: new Map(),
  getWorkflowStatus: async () => null,
  getStats: async () => ({ avgDuration: 0, completedWorkflows: 0 }),
};

// Load GraphQL Schemas
const wmsOptimizationTypeDefs = readFileSync(
  join(__dirname, 'graphql/schema/wms-optimization.graphql'),
  'utf-8'
);

// GraphQL Schema
const typeDefs = [monitoringTypeDefs, wmsOptimizationTypeDefs];

// GraphQL Resolvers
const resolvers = {
  Query: {
    ...monitoringResolvers.Query,
    ...wmsOptimizationResolvers.Query,
  },
  Mutation: {
    ...monitoringResolvers.Mutation,
    ...wmsOptimizationResolvers.Mutation,
  },
};

// Apollo Server Context
const context = async () => {
  return {
    pool,
    healthMonitor,
    errorTracking,
    agentActivity,
    activeFixes,
    orchestrator,
  };
};

// Initialize Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context,
  introspection: true,
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connected');

    // Start application health monitoring
    healthMonitor.startMonitoring(5000);
    console.log('✅ Health monitoring started (5s interval)');

    // Start Apollo Server
    const { url } = await server.listen(PORT);
    console.log('');
    console.log(`🚀 AgogSaaS ERP Application Server Ready`);
    console.log(`   GraphQL API: ${url}`);
    console.log(`   Frontend: http://localhost:3000`);
    console.log(`   Monitoring: http://localhost:3000/monitoring`);
    console.log('');
    console.log('✅ Application Services:');
    console.log('  - Database: Connected');
    console.log('  - Health Monitoring: Active');
    console.log('  - GraphQL API: Ready');
    console.log('  - WMS Optimization: Enabled (REQ-STRATEGIC-AUTO-1766476803478)');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  healthMonitor.stopMonitoring();
  await pool.end();
  console.log('✅ Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  healthMonitor.stopMonitoring();
  await pool.end();
  console.log('✅ Shutdown complete');
  process.exit(0);
});

startServer();
