/**
 * AgogSaaS Backend Server
 * Packaging Industry ERP with 4-Layer AI System
 */

import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server';
import { Pool } from 'pg';

dotenv.config();

// Layer 2: Monitoring Services
import { monitoringTypeDefs, monitoringResolvers } from './modules/monitoring/graphql';
import { HealthMonitorService } from './modules/monitoring/services/health-monitor.service';
import { ErrorTrackingService } from './modules/monitoring/services/error-tracking.service';
import { AgentActivityService } from './modules/monitoring/services/agent-activity.service';
import { ActiveFixesService } from './modules/monitoring/services/active-fixes.service';

// Layer 3: Orchestration
import { OrchestratorService } from './orchestration/orchestrator.service';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://agogsaas_user:changeme@localhost:5432/agogsaas',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize monitoring services
const healthMonitor = new HealthMonitorService();
const errorTracking = new ErrorTrackingService(pool);
const agentActivity = new AgentActivityService(pool);
const activeFixes = new ActiveFixesService();
const orchestrator = new OrchestratorService();

// GraphQL Schema
const typeDefs = [monitoringTypeDefs];

// GraphQL Resolvers
const resolvers = {
  Query: {
    ...monitoringResolvers.Query,
  },
  Mutation: {
    ...monitoringResolvers.Mutation,
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

    // Start health monitoring (Layer 2)
    healthMonitor.startMonitoring(5000);
    console.log('✅ Health monitoring started (5s interval)');

    // Initialize orchestrator (Layer 3)
    await orchestrator.initialize();
    console.log('✅ Orchestrator initialized');

    // Start Apollo Server
    const { url } = await server.listen(PORT);
    console.log('');
    console.log(`🚀 Server ready at ${url}`);
    console.log(`📊 Monitoring Dashboard: http://localhost:3000/monitoring`);
    console.log('');
    console.log('🎯 4-Layer System Active:');
    console.log('  Layer 1: Validation (pre-commit hooks)');
    console.log('  Layer 2: Monitoring (health checks running)');
    console.log('  Layer 3: Orchestration (ready for workflows)');
    console.log('  Layer 4: Memory (semantic search enabled)');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

startServer();
