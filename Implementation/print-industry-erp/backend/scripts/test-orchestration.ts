/**
 * Orchestration System Test Script
 *
 * Purpose: Verify the orchestration infrastructure is operational
 * Tests:
 * 1. NATS connection
 * 2. Agent definition files exist
 * 3. Orchestrator initialization
 * 4. Basic workflow simulation (without actually spawning agents)
 *
 * Usage: npm run test:orchestration
 */

import { OrchestratorService } from '../src/orchestration/orchestrator.service';
import { AgentSpawnerService } from '../src/orchestration/agent-spawner.service';
import { connect } from 'nats';
import * as path from 'path';
import * as fs from 'fs';

async function testOrchestration() {
  console.log('🧪 Testing Orchestration System\n');

  let testsPassedCount = 0;
  let testsFailedCount = 0;

  // Test 1: NATS Connection
  console.log('Test 1: NATS Connection');
  try {
    // Try docker-compose port mapping first (4223), then default (4222)
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    console.log(`  Connecting to: ${natsUrl}`);
    const nc = await connect({ servers: natsUrl });
    console.log('  ✅ NATS connected successfully');
    await nc.close();
    testsPassedCount++;
  } catch (error: any) {
    console.error('  ❌ NATS connection failed:', error.message);
    console.error('     Make sure NATS is running: docker-compose up -d nats');
    console.error('     Or set NATS_URL environment variable to correct host:port');
    testsFailedCount++;
    return; // Can't continue without NATS
  }

  // Test 2: Agent Definition Files
  console.log('\nTest 2: Agent Definition Files');
  const requiredAgents = ['cynthia', 'sylvia', 'roy', 'jen', 'billy', 'priya'];
  // Agents are at repository root, not backend directory
  const agentsDir = path.join(process.cwd(), '..', '..', '..', '.claude', 'agents');

  let allAgentsExist = true;
  for (const agentId of requiredAgents) {
    const agentFile = path.join(agentsDir, `${agentId}-*.md`);
    const matches = fs.readdirSync(agentsDir).filter(f =>
      f.startsWith(`${agentId}-`) && f.endsWith('.md')
    );

    if (matches.length > 0) {
      console.log(`  ✅ ${agentId}: ${matches[0]} exists`);
    } else {
      console.error(`  ❌ ${agentId}: Agent file not found (expected ${agentId}-*.md)`);
      allAgentsExist = false;
    }
  }

  if (allAgentsExist) {
    testsPassedCount++;
  } else {
    testsFailedCount++;
  }

  // Test 3: Orchestrator Initialization
  console.log('\nTest 3: Orchestrator Initialization');
  let orchestrator: OrchestratorService | null = null;
  try {
    orchestrator = new OrchestratorService();
    await orchestrator.initialize();
    console.log('  ✅ Orchestrator initialized successfully');
    testsPassedCount++;
  } catch (error: any) {
    console.error('  ❌ Orchestrator initialization failed:', error.message);
    testsFailedCount++;
  }

  // Test 4: Agent Spawner Initialization
  console.log('\nTest 4: Agent Spawner Initialization');
  let agentSpawner: AgentSpawnerService | null = null;
  try {
    agentSpawner = new AgentSpawnerService();
    await agentSpawner.initialize();
    console.log('  ✅ Agent Spawner initialized successfully');
    testsPassedCount++;
  } catch (error: any) {
    console.error('  ❌ Agent Spawner initialization failed:', error.message);
    testsFailedCount++;
  }

  // Test 5: Workflow Data Structures
  console.log('\nTest 5: Workflow Data Structures');
  try {
    if (orchestrator) {
      const stats = await orchestrator.getStats();
      console.log('  ✅ Workflow stats retrieved:', JSON.stringify(stats, null, 2));
      testsPassedCount++;
    } else {
      throw new Error('Orchestrator not initialized');
    }
  } catch (error: any) {
    console.error('  ❌ Workflow stats failed:', error.message);
    testsFailedCount++;
  }

  // Test 6: NATS Streams Verification
  console.log('\nTest 6: NATS Streams Verification');
  try {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const nc = await connect({ servers: natsUrl });
    const jsm = await nc.jetstreamManager();

    // Check for required streams
    const requiredStreams = [
      'agog_features_research',
      'agog_features_critique',
      'agog_features_backend',
      'agog_features_frontend',
      'agog_features_qa',
      'agog_features_statistics',
    ];

    const streams = await jsm.streams.list().next();
    const existingStreams = streams.map(s => s.config.name);

    let allStreamsExist = true;
    for (const streamName of requiredStreams) {
      if (existingStreams.includes(streamName)) {
        console.log(`  ✅ Stream exists: ${streamName}`);
      } else {
        console.warn(`  ⚠️  Stream missing: ${streamName} (will be auto-created on first use)`);
        // Not a failure - streams are created on demand
      }
    }

    await nc.close();
    testsPassedCount++;
  } catch (error: any) {
    console.error('  ❌ NATS streams check failed:', error.message);
    testsFailedCount++;
  }

  // Cleanup
  if (orchestrator) {
    await orchestrator.close();
  }
  if (agentSpawner) {
    await agentSpawner.close();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${testsPassedCount}`);
  console.log(`❌ Tests Failed: ${testsFailedCount}`);
  console.log(`📈 Success Rate: ${((testsPassedCount / (testsPassedCount + testsFailedCount)) * 100).toFixed(1)}%`);

  if (testsFailedCount === 0) {
    console.log('\n🎉 All tests passed! Orchestration system is ready to use.');
    console.log('\nNext steps:');
    console.log('  1. Start a test workflow: npm run orchestrator:start-test');
    console.log('  2. Use orchestrator in code: await orchestrator.startWorkflow(...)');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above before using orchestration.');
    console.log('\nCommon fixes:');
    console.log('  - NATS not running: docker-compose up -d nats');
    console.log('  - Agent files missing: Check .claude/agents/ directory');
    console.log('  - NATS_URL wrong: Set environment variable or use default localhost:4222');
    process.exit(1);
  }
}

// Run tests
testOrchestration().catch((error) => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
