/**
 * NATS Publisher: Cynthia Research Deliverable
 * REQ-STRATEGIC-AUTO-1767048328658
 * Production Planning & Scheduling Module
 */

import * as nats from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface DeliverablePayload {
  agent: string;
  reqNumber: string;
  status: string;
  deliverable: string;
  summary: string;
  timestamp: string;
  metadata: {
    featureTitle: string;
    assignedTo: string;
    researchFindings: {
      databaseTables: number;
      graphqlQueries: number;
      graphqlMutations: number;
      servicesToImplement: number;
      frontendPages: number;
      estimatedWeeks: number;
      estimatedROI: string;
    };
    recommendations: string[];
  };
}

async function publishDeliverable() {
  let nc: nats.NatsConnection | null = null;

  try {
    console.log('📡 Connecting to NATS server...');

    // Connect to NATS server
    nc = await nats.connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      timeout: 5000,
    });

    console.log('✅ Connected to NATS server');

    // Read the research deliverable
    const deliverablePath = path.join(
      __dirname,
      '..',
      'CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328658.md'
    );

    const deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Construct payload
    const payload: DeliverablePayload = {
      agent: 'cynthia',
      reqNumber: 'REQ-STRATEGIC-AUTO-1767048328658',
      status: 'COMPLETE',
      deliverable: 'nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767048328658',
      summary: 'Production Planning & Scheduling Module - Complete research deliverable with 12 database tables, 21 GraphQL operations, 7 service implementations, and 7 frontend components. Estimated 14-week implementation with 145% Year 1 ROI.',
      timestamp: new Date().toISOString(),
      metadata: {
        featureTitle: 'Production Planning & Scheduling Module',
        assignedTo: 'marcus',
        researchFindings: {
          databaseTables: 12,
          graphqlQueries: 11,
          graphqlMutations: 10,
          servicesToImplement: 7,
          frontendPages: 7,
          estimatedWeeks: 14,
          estimatedROI: '145% Year 1, 8.2 months payback',
        },
        recommendations: [
          'Start with Phase 1-2: Service layer implementation and routing tables',
          'Choose hybrid scheduling algorithm (priority dispatch + genetic optimization)',
          'Prioritize MVP: Production order tracking, basic scheduling, routing expansion',
          'Allocate Roy (backend), Jen (frontend), Billy (QA) for 14-week timeline',
          'Involve production schedulers in design validation',
          'Implement in stages: Planning → Scheduling → OEE → Optimization',
        ],
      },
    };

    // Publish to NATS subjects
    const subjects = [
      'agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767048328658',
      'agog.deliverables.research',
      'agog.requirements.REQ-STRATEGIC-AUTO-1767048328658.cynthia',
    ];

    for (const subject of subjects) {
      console.log(`📤 Publishing to ${subject}...`);
      nc.publish(subject, JSON.stringify(payload, null, 2));
    }

    // Store full deliverable content in object store
    const contentSubject = 'agog.deliverables.content.REQ-STRATEGIC-AUTO-1767048328658.cynthia';
    console.log(`📤 Publishing full content to ${contentSubject}...`);
    nc.publish(contentSubject, deliverableContent);

    console.log('✅ Deliverable published successfully');
    console.log('\n📋 Summary:');
    console.log(`   Agent: ${payload.agent}`);
    console.log(`   Req Number: ${payload.reqNumber}`);
    console.log(`   Status: ${payload.status}`);
    console.log(`   Summary: ${payload.summary}`);
    console.log(`   Database Tables: ${payload.metadata.researchFindings.databaseTables}`);
    console.log(`   GraphQL Operations: ${payload.metadata.researchFindings.graphqlQueries + payload.metadata.researchFindings.graphqlMutations}`);
    console.log(`   Estimated Timeline: ${payload.metadata.researchFindings.estimatedWeeks} weeks`);
    console.log(`   Estimated ROI: ${payload.metadata.researchFindings.estimatedROI}`);

  } catch (error) {
    console.error('❌ Error publishing deliverable:', error);
    throw error;
  } finally {
    if (nc) {
      await nc.drain();
      console.log('🔌 Disconnected from NATS server');
    }
  }
}

// Execute
publishDeliverable()
  .then(() => {
    console.log('\n✅ Publication complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Publication failed:', error);
    process.exit(1);
  });
