/**
 * Test Recovery & Health Check + Value Chain Expert
 * Runs Recovery NOW, waits 5 minutes, then runs Value Chain Expert
 */

import { RecoveryHealthCheckDaemon } from '../src/proactive/recovery-health-check.daemon';
import { ValueChainExpertDaemon } from '../src/proactive/value-chain-expert.daemon';

// Set NATS credentials for local testing
// Load from .env file or use defaults
// IMPORTANT: Set NATS_PASSWORD environment variable before running
if (!process.env.NATS_URL) process.env.NATS_URL = 'nats://localhost:4223';
if (!process.env.NATS_USER) process.env.NATS_USER = 'agents';
if (!process.env.OWNER_REQUESTS_PATH) {
  process.env.OWNER_REQUESTS_PATH = 'D:/GitHub/agogsaas/project-spirit/owner_requests/OWNER_REQUESTS.md';
}

async function main() {
  console.log('🧪 Testing Recovery & Health Check + Value Chain Expert\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Run Recovery & Health Check NOW
    console.log('[Step 1/2] Running Recovery & Health Check...\n');
    const recovery = new RecoveryHealthCheckDaemon();
    await recovery.initialize();

    // Access private method via reflection for testing
    const result = await (recovery as any).runHealthCheck();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Recovery Complete!');
    console.log(`  Status: ${result.healthStatus.toUpperCase()}`);
    console.log(`  Stuck Workflows: ${result.stuckWorkflows.length}`);
    console.log(`  Recovered: ${result.recoveredWorkflows.length}`);
    console.log(`  Blocked: ${result.blockedWorkflows.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await recovery.close();

    // Step 2: Wait 5 minutes, then run Value Chain Expert
    console.log('[Step 2/2] Waiting 5 minutes before running Value Chain Expert...');
    console.log('(Simulating the 5-minute delay between Recovery and Value Chain Expert)\n');

    const waitTime = 5 * 60 * 1000; // 5 minutes
    const startWait = Date.now();

    // Show countdown
    const interval = setInterval(() => {
      const elapsed = Date.now() - startWait;
      const remaining = Math.max(0, waitTime - elapsed);
      const minutesLeft = Math.floor(remaining / 60000);
      const secondsLeft = Math.floor((remaining % 60000) / 1000);
      process.stdout.write(`\r⏳ Time remaining: ${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}   `);
    }, 1000);

    await new Promise(resolve => setTimeout(resolve, waitTime));
    clearInterval(interval);
    process.stdout.write('\r✅ 5 minutes elapsed!                    \n\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Running Value Chain Expert...\n');

    const valueChain = new ValueChainExpertDaemon();
    await valueChain.initialize();

    // Access private method via reflection for testing
    await (valueChain as any).runEvaluation();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await valueChain.close();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
