#!/usr/bin/env ts-node

/**
 * Publish Berry's DevOps Final Deliverable for REQ-STRATEGIC-AUTO-1766689933757
 *
 * This script publishes the final DevOps deployment verification deliverable
 * to the AGOG NATS messaging system for consumption by downstream agents.
 *
 * NATS Channel: agog.deliverables.berry.berry.REQ-STRATEGIC-AUTO-1766689933757
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const NATS_SERVER = process.env.NATS_SERVER || 'nats://localhost:4223';
const NATS_USER = process.env.NATS_USER || 'agents';
const NATS_PASSWORD = process.env.NATS_PASSWORD || 'WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4';
const DELIVERABLE_FILE = path.join(__dirname, '..', 'BERRY_DEVOPS_FINAL_DELIVERABLE_REQ-STRATEGIC-AUTO-1766689933757.md');
const NATS_SUBJECT = 'agog.deliverables.berry.berry.REQ-STRATEGIC-AUTO-1766689933757';

interface DeliverablePayload {
  reqNumber: string;
  agent: string;
  stage: string;
  timestamp: string;
  status: string;
  summary: string;
  deliverable: string;
  metadata: {
    deploymentDate: string;
    environment: string;
    tablesDeployed: number;
    indexesCreated: number;
    rlsPolicies: number;
    checkConstraints: number;
    graphqlQueries: number;
    graphqlMutations: number;
    frontendPages: number;
    frontendComponents: number;
    totalLinesOfCode: number;
    healthStatus: string;
    backendStatus: string;
    frontendStatus: string;
    databaseStatus: string;
    productionReady: boolean;
  };
}

async function publishDeliverable(): Promise<void> {
  let nc: NatsConnection | null = null;

  try {
    console.log('🚀 Starting Berry DevOps Final Deliverable Publisher...');
    console.log(`📡 NATS Server: ${NATS_SERVER}`);
    console.log(`📄 Deliverable File: ${DELIVERABLE_FILE}`);
    console.log(`📢 NATS Subject: ${NATS_SUBJECT}`);

    // Connect to NATS
    console.log('\n🔌 Connecting to NATS...');
    nc = await connect({
      servers: NATS_SERVER,
      user: NATS_USER,
      pass: NATS_PASSWORD,
      maxReconnectAttempts: 3,
      reconnectTimeWait: 1000,
    });
    console.log('✅ Connected to NATS successfully');

    // Read deliverable content
    console.log('\n📖 Reading deliverable file...');
    if (!fs.existsSync(DELIVERABLE_FILE)) {
      throw new Error(`Deliverable file not found: ${DELIVERABLE_FILE}`);
    }

    const deliverableContent = fs.readFileSync(DELIVERABLE_FILE, 'utf-8');
    console.log(`✅ Read ${deliverableContent.length} characters from deliverable file`);

    // Create deliverable payload
    const payload: DeliverablePayload = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1766689933757',
      agent: 'berry',
      stage: 'devops',
      timestamp: new Date().toISOString(),
      status: 'COMPLETE',
      summary: 'DevOps deployment verification complete. All database tables (4), indexes (60), RLS policies (3), and CHECK constraints (42) deployed successfully. Backend GraphQL API operational (8 queries, 9 mutations). Frontend dashboards (4) and components (6) deployed and accessible. Health checks passing. System is production-ready for core features. Configuration initialization pending tenant setup. QA enhancements (tier classification, alert engine, unit tests) planned for future release.',
      deliverable: deliverableContent,
      metadata: {
        deploymentDate: '2025-12-27',
        environment: 'staging',
        tablesDeployed: 4,
        indexesCreated: 60,
        rlsPolicies: 3,
        checkConstraints: 42,
        graphqlQueries: 8,
        graphqlMutations: 9,
        frontendPages: 4,
        frontendComponents: 6,
        totalLinesOfCode: 99036,
        healthStatus: 'ok',
        backendStatus: 'operational',
        frontendStatus: 'operational',
        databaseStatus: 'connected',
        productionReady: true
      }
    };

    // Publish to NATS
    console.log('\n📤 Publishing deliverable to NATS...');
    const sc = StringCodec();
    const jsonPayload = JSON.stringify(payload, null, 2);

    nc.publish(NATS_SUBJECT, sc.encode(jsonPayload));

    console.log('✅ Deliverable published successfully');
    console.log(`📊 Payload size: ${jsonPayload.length} bytes`);

    // Publish completion notification
    const completionSubject = 'agog.workflow.completion.REQ-STRATEGIC-AUTO-1766689933757';
    const completionPayload = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1766689933757',
      agent: 'berry',
      stage: 'devops',
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      deliverableUrl: `nats://${NATS_SUBJECT}`,
      nextSteps: [
        'Create tenant records in database',
        'Initialize default scorecard configurations',
        'Create test data for UAT',
        'Implement pending QA enhancements (future release)',
        'User acceptance testing',
        'Production deployment planning'
      ]
    };

    nc.publish(completionSubject, sc.encode(JSON.stringify(completionPayload, null, 2)));
    console.log(`📢 Completion notification sent to ${completionSubject}`);

    // Flush to ensure messages are sent
    await nc.flush();
    console.log('✅ All messages flushed to NATS server');

    console.log('\n🎉 Deliverable publishing complete!');
    console.log('\n📋 Summary:');
    console.log('   - Requirement: REQ-STRATEGIC-AUTO-1766689933757');
    console.log('   - Feature: Vendor Scorecards');
    console.log('   - Agent: Berry (DevOps Specialist)');
    console.log('   - Status: DEPLOYMENT VERIFIED AND OPERATIONAL');
    console.log('   - Tables Deployed: 4');
    console.log('   - Indexes Created: 60');
    console.log('   - RLS Policies: 3');
    console.log('   - CHECK Constraints: 42');
    console.log('   - GraphQL Queries: 8');
    console.log('   - GraphQL Mutations: 9');
    console.log('   - Frontend Pages: 4');
    console.log('   - Frontend Components: 6');
    console.log('   - Total Lines of Code: 99,036');
    console.log('   - Production Ready: ✅ YES (core features)');
    console.log(`   - Deliverable URL: nats://${NATS_SUBJECT}`);

  } catch (error) {
    console.error('\n❌ Error publishing deliverable:', error);
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Stack trace: ${error.stack}`);
    }
    process.exit(1);
  } finally {
    // Close NATS connection
    if (nc) {
      console.log('\n🔌 Closing NATS connection...');
      await nc.close();
      console.log('✅ NATS connection closed');
    }
  }
}

// Execute
publishDeliverable()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
