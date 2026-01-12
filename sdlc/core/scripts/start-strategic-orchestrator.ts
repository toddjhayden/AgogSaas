#!/usr/bin/env ts-node
/**
 * Start Strategic Orchestrator Daemon
 *
 * This daemon:
 * - Monitors SDLC database (owner_requests table) for NEW/PENDING requests
 * - Spawns specialist workflows (Cynthia → Sylvia → Roy → Jen → Billy → Priya)
 * - Handles blocked workflows with strategic agent intervention
 * - Stores learnings in memory system
 * - Persists workflow state to agent_workflows table
 *
 * Usage:
 *   npm run daemon:start
 *   OR
 *   ts-node scripts/start-strategic-orchestrator.ts
 */

import { StrategicOrchestratorService } from '../src/orchestration/strategic-orchestrator.service';
import dotenv from 'dotenv';

dotenv.config();

async function startDaemon() {
  console.log('🚀 Starting Strategic Orchestrator Daemon');
  console.log('==========================================\n');

  const orchestrator = new StrategicOrchestratorService();

  try {
    // Initialize the orchestrator
    console.log('Initializing Strategic Orchestrator...');
    await orchestrator.initialize();
    console.log('✅ Initialized\n');

    // Start the daemon
    console.log('Starting autonomous daemon...');
    await orchestrator.startDaemon();

    console.log('\n✅ Strategic Orchestrator is running!');
    console.log('\nDaemon is now:');
    console.log('  - Monitoring SDLC database (owner_requests) every 60 seconds');
    console.log('  - Spawning specialist workflows for NEW/PENDING requests');
    console.log('  - Enforcing 6-stage workflow: Cynthia → Sylvia → Roy → Jen → Billy → Priya');
    console.log('  - Handling blocked workflows with strategic agents');
    console.log('  - Persisting workflow state to agent_workflows table');
    console.log('  - Storing learnings in memory system');
    console.log('\nPress Ctrl+C to stop the daemon\n');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down Strategic Orchestrator...');
      await orchestrator.close();
      console.log('✅ Shutdown complete');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down Strategic Orchestrator...');
      await orchestrator.close();
      console.log('✅ Shutdown complete');
      process.exit(0);
    });

  } catch (error: any) {
    console.error('💥 Failed to start Strategic Orchestrator:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Ensure NATS is running: docker-compose -f docker-compose.agents.yml up -d nats');
    console.error('  2. Check NATS_URL in .env (should be nats://localhost:4223)');
    console.error('  3. Ensure SDLC database is running: docker-compose -f docker-compose.agents.yml up -d sdlc-db');
    console.error('  4. Ensure agent_memory database is running: docker-compose -f docker-compose.agents.yml up -d agent-postgres');
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run the daemon
startDaemon().catch((error) => {
  console.error('💥 Daemon crashed:', error);
  process.exit(1);
});
