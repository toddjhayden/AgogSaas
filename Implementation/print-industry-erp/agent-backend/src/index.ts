/**
 * AgogSaaS Agent Backend - Orchestration System
 *
 * This is a DEVELOPMENT-ONLY service that:
 * - Monitors OWNER_REQUESTS.md for new feature requests
 * - Spawns specialist agents (Cynthia, Sylvia, Roy, Jen, Billy, Priya)
 * - Coordinates workflow execution
 * - Writes code to application backend/frontend
 *
 * NEVER deployed to production - local/CI only
 */

import { StrategicOrchestratorService } from './orchestration/strategic-orchestrator.service';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('='.repeat(70));
  console.log('  AgogSaaS Agent Orchestration System');
  console.log('  DEVELOPMENT ONLY - Not for production deployment');
  console.log('='.repeat(70));
  console.log('');

  const orchestrator = new StrategicOrchestratorService();

  try {
    console.log('Initializing Strategic Orchestrator...');
    await orchestrator.initialize();
    console.log('✅ Initialized\n');

    console.log('Starting autonomous daemon...');
    await orchestrator.startDaemon();
    console.log('✅ Daemon running\n');

    console.log('Monitoring:');
    console.log('  - OWNER_REQUESTS.md for new feature requests');
    console.log('  - Workflow execution and agent coordination');
    console.log('  - Code generation for application backend/frontend');
    console.log('');
    console.log('Press Ctrl+C to stop\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await orchestrator.close();
      console.log('✅ Shutdown complete');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\nShutting down...');
      await orchestrator.close();
      console.log('✅ Shutdown complete');
      process.exit(0);
    });

  } catch (error: any) {
    console.error('Failed to start agent orchestration system:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Ensure NATS is running: docker-compose -f docker-compose.agents.yml up -d nats');
    console.error('  2. Check NATS_URL environment variable');
    console.error('  3. Verify OWNER_REQUESTS.md exists');
    process.exit(1);
  }
}

main();
