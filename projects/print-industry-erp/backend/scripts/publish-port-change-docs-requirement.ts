#!/usr/bin/env ts-node
/**
 * Publish Documentation Update Requirement to NATS
 * REQ-DOCS-PORT-CHANGE-001
 *
 * Urgent P0 task to update all documentation referencing backend port 4000 to new port 4001
 */

import { connect, NatsConnection } from 'nats';

interface Requirement {
  reqId: string;
  timestamp: number;
  title: string;
  priority: string;
  status: string;
  category: string;
  owner: string;
  assignedTo: string;
  businessValue: string;
  generatedBy: string;
  generatedAt: string;
  requirements: string[];
  context: {
    reason: string;
    impact: string;
    affectedFiles: string[];
    newPort: number;
    oldPort: number;
  };
}

async function publishToNats() {
  // Connect to NATS on localhost (running in Docker on port 4223)
  const natsUrl = 'localhost:4223';
  const user = process.env.NATS_USER || 'agents';
  const pass = process.env.NATS_PASSWORD;
  if (!pass) {
    throw new Error('NATS_PASSWORD environment variable is required');
  }

  console.log(`Connecting to NATS at ${natsUrl}...`);
  const nc: NatsConnection = await connect({
    servers: natsUrl,
    user,
    pass,
    name: 'docs-port-change-publisher'
  });

  console.log('✅ Connected to NATS\n');

  const timestamp = Date.now();
  const requirement: Requirement = {
    reqId: 'REQ-DOCS-PORT-CHANGE-001',
    timestamp,
    title: 'Update Documentation for Backend Port Change (4000 → 4001)',
    priority: 'P0',
    status: 'PENDING',
    category: 'DOCUMENTATION',
    owner: 'system',
    assignedTo: 'DOCUMENTATION_AGENT',
    businessValue: 'Critical: Prevent developer confusion and connection errors. All documentation currently references incorrect backend port 4000, which will cause failed connections and wasted debugging time.',
    generatedBy: 'system-health-monitor',
    generatedAt: new Date(timestamp).toISOString(),
    requirements: [
      'Update README.md to reflect backend port change from 4000 to 4001',
      'Update all docker-compose.yml documentation and comments referencing port 4000',
      'Update any API documentation showing backend URL endpoints',
      'Update frontend .env.example files showing VITE_GRAPHQL_URL',
      'Update any setup guides or quick-start documentation',
      'Search for any hardcoded references to port 4000 in markdown files',
      'Update DEPLOYMENT_QUICK_START.md if it exists',
      'Add entry to CHANGELOG.md documenting this infrastructure change',
      'Create a migration note explaining why port changed (conflict on 4000)',
      'Verify all documentation links and examples use correct port'
    ],
    context: {
      reason: 'Backend container was failing to start due to port 4000 conflict with existing Node.js process (PID 32996). Port changed to 4001 to resolve conflict.',
      impact: 'All documentation, examples, and setup instructions referencing http://localhost:4000 are now incorrect and will cause connection failures.',
      affectedFiles: [
        'README.md',
        'docker-compose.app.yml',
        'frontend/.env',
        'frontend/.env.example',
        'DEPLOYMENT_QUICK_START.md',
        'docs/**/*.md (all markdown docs)',
        'Any API integration examples'
      ],
      newPort: 4001,
      oldPort: 4000
    }
  };

  // Publish to NATS requirements stream
  const subject = 'agog.requirements.documentation';
  nc.publish(subject, JSON.stringify(requirement, null, 2));

  console.log('✅ Published P0 documentation requirement to NATS');
  console.log(`   Subject: ${subject}`);
  console.log(`   REQ ID: ${requirement.reqId}`);
  console.log(`   Title: ${requirement.title}`);
  console.log(`   Priority: ${requirement.priority} (URGENT)`);
  console.log(`   Status: ${requirement.status}`);
  console.log(`   Assigned To: ${requirement.assignedTo}`);
  console.log(`   Requirements Count: ${requirement.requirements.length}`);
  console.log(`   Port Change: ${requirement.context.oldPort} → ${requirement.context.newPort}`);
  console.log('\n📋 Requirements:');
  requirement.requirements.forEach((req, idx) => {
    console.log(`   ${idx + 1}. ${req}`);
  });

  await nc.flush();
  await nc.close();
  console.log('\n✅ NATS connection closed');
}

if (require.main === module) {
  publishToNats()
    .then(() => {
      console.log('\n✅ P0 Documentation requirement published successfully');
      console.log('   Documentation Agent will be notified to update all references to backend port');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Publication failed:', error);
      process.exit(1);
    });
}

export { publishToNats };
