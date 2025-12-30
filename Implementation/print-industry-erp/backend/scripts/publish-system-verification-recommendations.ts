#!/usr/bin/env ts-node
/**
 * Publish System Verification as Recommendations to NATS
 * Uses the correct agog.recommendations.* subjects that the daemon listens to
 */

import { connect, NatsConnection } from 'nats';

async function publishToNats() {
  const natsUrl = 'localhost:4223';
  const user = process.env.NATS_USER || 'agents';
  const pass = process.env.NATS_PASSWORD || 'WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4';

  console.log(`Connecting to NATS at ${natsUrl}...`);
  const nc: NatsConnection = await connect({
    servers: natsUrl,
    user,
    pass,
    name: 'verification-recommendations-publisher'
  });

  console.log('✅ Connected to NATS\n');

  const timestamp = Date.now();

  // Publish as strategic recommendation (will trigger OWNER_REQUESTS.md entry)
  const verification = {
    reqId: `REQ-SYSTEM-VERIFICATION-${timestamp}`,
    timestamp,
    title: 'Complete System Verification After Database Fix',
    priority: 'P0',
    status: 'PENDING',
    owner: 'system',
    businessValue: 'Critical infrastructure verification after database startup fix and port migration. Ensures all containers, services, and documentation are correct.',
    generatedBy: 'system-health-monitor',
    generatedAt: new Date(timestamp).toISOString(),
    requirements: [
      '**ROY (Backend)**: Verify backend container on port 4001, test GraphQL endpoints, verify all 14 NestJS modules loaded, test health endpoint, verify database connection to postgres:5433',
      '**JEN (Frontend)**: Verify frontend on port 3000, confirm .env points to backend:4001, test 5+ pages, verify Apollo Client connection, check for port 4000 hardcodes',
      '**BERRY (DevOps)**: Verify ALL containers (app + agent stacks), document architecture, create health check scripts, commit fixes to git, update OWNER_REQUESTS.md',
      'All agents: Update NATS database with verification results'
    ],
    context: {
      changes: [
        'Database container fixed (was failing with exit code 127)',
        'Backend port changed 4000 → 4001 (port conflict)',
        'Node.js 18 → 20',
        'Package.json dependencies fixed',
        'docker-compose node_modules volumes removed'
      ],
      appStack: 'frontend:3000, backend:4001, postgres:5433',
      agentStack: 'nats:4223, agent-postgres:5434, ollama:11434, agent-backend:4002'
    }
  };

  // Publish to strategic recommendations (monitored by recommendation publisher)
  nc.publish('agog.recommendations.strategic', JSON.stringify(verification, null, 2));
  console.log('✅ Published to agog.recommendations.strategic');
  console.log(`   Title: ${verification.title}`);
  console.log(`   Priority: ${verification.priority}`);
  console.log(`   Requirements: ${verification.requirements.length} items`);

  await nc.flush();
  await nc.close();
  console.log('\n✅ NATS connection closed');
}

if (require.main === module) {
  publishToNats()
    .then(() => {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('✅ SYSTEM VERIFICATION PUBLISHED AS STRATEGIC RECOMMENDATION');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      console.log('The recommendation publisher daemon will:');
      console.log('  1. Pick up this recommendation from NATS');
      console.log('  2. Add it to OWNER_REQUESTS.md');
      console.log('  3. Trigger the workflow: Cynthia → Sylvia → Roy → Jen → Billy → Priya → Berry');
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Publication failed:', error);
      process.exit(1);
    });
}

export { publishToNats };
