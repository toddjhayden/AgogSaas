/**
 * Publish Roy's Backend Deliverable to NATS
 * REQ: REQ-STRATEGIC-AUTO-1766929114445 - PO Approval Workflow
 *
 * This script publishes the complete backend implementation deliverable
 * to the NATS messaging system for the orchestrator to consume.
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const NATS_SERVER = process.env.NATS_SERVER || 'nats://localhost:4222';
const SUBJECT = 'agog.deliverables.roy.backend.REQ-STRATEGIC-AUTO-1766929114445';

interface Deliverable {
  agent: string;
  reqNumber: string;
  status: string;
  deliverableUrl: string;
  timestamp: string;
  summary: string;
  implementation: {
    databaseSchema: string[];
    serviceLayer: string[];
    graphqlApi: string[];
    verification: string[];
  };
  deploymentStatus: string;
  testingStatus: string;
  documentation: string;
}

async function publishDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    console.log('='.repeat(80));
    console.log('PUBLISHING ROY BACKEND DELIVERABLE');
    console.log('REQ: REQ-STRATEGIC-AUTO-1766929114445');
    console.log('='.repeat(80));
    console.log('');

    // Connect to NATS
    console.log(`Connecting to NATS server: ${NATS_SERVER}...`);
    nc = await connect({ servers: NATS_SERVER });
    console.log('✓ Connected to NATS\n');

    // Read deliverable document
    const deliverableDocPath = path.join(__dirname, '..', 'ROY_BACKEND_DELIVERABLE_REQ-STRATEGIC-AUTO-1766929114445.md');
    const deliverableDoc = fs.readFileSync(deliverableDocPath, 'utf-8');

    // Create deliverable payload
    const deliverable: Deliverable = {
      agent: 'roy',
      reqNumber: 'REQ-STRATEGIC-AUTO-1766929114445',
      status: 'COMPLETE',
      deliverableUrl: 'nats://agog.deliverables.roy.backend.REQ-STRATEGIC-AUTO-1766929114445',
      timestamp: new Date().toISOString(),
      summary: 'Complete PO Approval Workflow backend implementation with multi-level approval support, compliance audit trail, and GraphQL API',
      implementation: {
        databaseSchema: [
          'migrations/V0.0.38__add_po_approval_workflow.sql (4 tables, 1 view, 2 functions)',
        ],
        serviceLayer: [
          'src/modules/procurement/services/approval-workflow.service.ts (698 lines)',
        ],
        graphqlApi: [
          'src/graphql/schema/po-approval-workflow.graphql (15 types, 6 queries, 8 mutations)',
          'src/graphql/resolvers/po-approval-workflow.resolver.ts (750 lines)',
        ],
        verification: [
          'scripts/verify-po-approval-workflow-REQ-STRATEGIC-AUTO-1766929114445.ts',
        ],
      },
      deploymentStatus: 'READY_FOR_DEPLOYMENT',
      testingStatus: 'VERIFICATION_SCRIPT_AVAILABLE',
      documentation: deliverableDoc,
    };

    // Publish to NATS
    console.log(`Publishing to subject: ${SUBJECT}...`);
    const sc = StringCodec();
    nc.publish(SUBJECT, sc.encode(JSON.stringify(deliverable, null, 2)));

    // Also publish completion notice
    const completionSubject = 'agog.requirements.completion';
    const completionNotice = {
      agent: 'roy',
      reqNumber: 'REQ-STRATEGIC-AUTO-1766929114445',
      status: 'COMPLETE',
      deliverableUrl: SUBJECT,
      timestamp: new Date().toISOString(),
      summary: 'PO Approval Workflow backend implementation complete',
    };
    nc.publish(completionSubject, sc.encode(JSON.stringify(completionNotice, null, 2)));

    await nc.flush();
    console.log('✓ Deliverable published successfully\n');

    // Print summary
    console.log('='.repeat(80));
    console.log('PUBLICATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Subject: ${SUBJECT}`);
    console.log(`Agent: ${deliverable.agent}`);
    console.log(`Requirement: ${deliverable.reqNumber}`);
    console.log(`Status: ${deliverable.status}`);
    console.log(`Timestamp: ${deliverable.timestamp}`);
    console.log('');
    console.log('Implementation Components:');
    console.log(`  Database Schema: ${deliverable.implementation.databaseSchema.length} file(s)`);
    console.log(`  Service Layer: ${deliverable.implementation.serviceLayer.length} file(s)`);
    console.log(`  GraphQL API: ${deliverable.implementation.graphqlApi.length} file(s)`);
    console.log(`  Verification: ${deliverable.implementation.verification.length} file(s)`);
    console.log('');
    console.log(`Deployment Status: ${deliverable.deploymentStatus}`);
    console.log(`Testing Status: ${deliverable.testingStatus}`);
    console.log('');
    console.log('✅ DELIVERABLE PUBLISHED SUCCESSFULLY');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Failed to publish deliverable:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    if (nc) {
      await nc.drain();
      console.log('\nNATS connection closed.');
    }
  }
}

// Run the publisher
publishDeliverable().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
