#!/usr/bin/env ts-node

/**
 * NATS Publisher Script for Cynthia Research Deliverable
 * REQ: REQ-STRATEGIC-AUTO-1735409486000
 *
 * This script publishes the research deliverable to the NATS message bus
 * for consumption by other agents and the orchestration system.
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface ResearchDeliverable {
  agent: 'cynthia';
  reqNumber: string;
  status: 'COMPLETE';
  deliverableType: 'research';
  timestamp: string;
  summary: string;
  findings: {
    implementationStatus: string;
    productionReady: boolean;
    duplicateRequirement: boolean;
    previousRequirements: string[];
    completedFeatures: number;
    partialFeatures: number;
    missingFeatures: number;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  risks: {
    implementation: number;
    security: number;
    compliance: number;
    operational: number;
  };
  deliverableUrl: string;
  fileLocation: string;
  fileSizeBytes: number;
}

async function publishDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    // Connect to NATS server
    console.log('Connecting to NATS server...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'cynthia-research-publisher-REQ-STRATEGIC-AUTO-1735409486000',
    });
    console.log('✅ Connected to NATS server');

    // Read the deliverable markdown file
    const deliverableFilePath = path.join(
      __dirname,
      '..',
      'CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1735409486000.md'
    );

    console.log(`Reading deliverable file: ${deliverableFilePath}`);
    const deliverableContent = fs.readFileSync(deliverableFilePath, 'utf-8');
    const fileSizeBytes = Buffer.from(deliverableContent, 'utf-8').length;
    console.log(`✅ Read deliverable file (${fileSizeBytes} bytes)`);

    // Create deliverable payload
    const deliverable: ResearchDeliverable = {
      agent: 'cynthia',
      reqNumber: 'REQ-STRATEGIC-AUTO-1735409486000',
      status: 'COMPLETE',
      deliverableType: 'research',
      timestamp: new Date().toISOString(),
      summary: 'Comprehensive research analysis of PO Approval Workflow feature reveals production-ready implementation already exists from REQ-STRATEGIC-AUTO-1766929114445. Complete database schema with 4 tables, full NestJS service (698 lines), GraphQL API (6 queries, 8 mutations), and React frontend with approval dashboard. Identified gaps: delegation/request changes (UI only), notification system (not implemented), escalation automation (not implemented). Recommendation: Deploy existing implementation, prioritize notification system, complete partial features.',
      findings: {
        implementationStatus: 'PRODUCTION-READY',
        productionReady: true,
        duplicateRequirement: true,
        previousRequirements: ['REQ-STRATEGIC-AUTO-1766929114445', 'REQ-STRATEGIC-AUTO-1766676891764'],
        completedFeatures: 14,
        partialFeatures: 5,
        missingFeatures: 5,
      },
      recommendations: {
        immediate: [
          'Complete delegation implementation (2-3 days)',
          'Complete request changes implementation (2-3 days)',
          'Implement notification system (1-2 weeks)',
        ],
        shortTerm: [
          'Implement escalation automation (3-5 days)',
          'Add parallel approval support (5-7 days)',
          'Implement user group resolution (3-5 days)',
        ],
        longTerm: [
          'Build approval analytics dashboard (2-3 weeks)',
          'Add conditional routing (1-2 weeks)',
          'Build mobile approval app (4-6 weeks)',
          'Implement bulk approval (1 week)',
        ],
      },
      risks: {
        implementation: 2, // MEDIUM - Duplicate requirement, incomplete features
        security: 1, // LOW - Hard-coded userId/tenantId already fixed
        compliance: 1, // LOW - Audit trail complete, SLA tracking in place
        operational: 3, // HIGH - No notification system (approvers unaware)
      },
      deliverableUrl: 'nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1735409486000',
      fileLocation: deliverableFilePath,
      fileSizeBytes,
    };

    // Publish to multiple NATS subjects for different consumption patterns
    const sc = StringCodec();

    // 1. Specific deliverable subject (for direct retrieval)
    const specificSubject = 'agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1735409486000';
    console.log(`Publishing to subject: ${specificSubject}`);
    nc.publish(specificSubject, sc.encode(JSON.stringify(deliverable, null, 2)));
    console.log('✅ Published to specific deliverable subject');

    // 2. Agent-specific subject (for agent's deliverable stream)
    const agentSubject = 'agog.deliverables.cynthia.research';
    console.log(`Publishing to subject: ${agentSubject}`);
    nc.publish(agentSubject, sc.encode(JSON.stringify(deliverable, null, 2)));
    console.log('✅ Published to agent-specific subject');

    // 3. Requirement-specific subject (for requirement tracking)
    const reqSubject = 'agog.requirements.REQ-STRATEGIC-AUTO-1735409486000.deliverables';
    console.log(`Publishing to subject: ${reqSubject}`);
    nc.publish(reqSubject, sc.encode(JSON.stringify(deliverable, null, 2)));
    console.log('✅ Published to requirement-specific subject');

    // 4. Orchestrator subject (for workflow orchestration)
    const orchestratorSubject = 'agog.orchestrator.deliverables.cynthia';
    console.log(`Publishing to subject: ${orchestratorSubject}`);
    nc.publish(orchestratorSubject, sc.encode(JSON.stringify(deliverable, null, 2)));
    console.log('✅ Published to orchestrator subject');

    // 5. Completion notification subject (for monitoring)
    const completionSubject = 'agog.requirements.REQ-STRATEGIC-AUTO-1735409486000.status';
    const completionPayload = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1735409486000',
      agent: 'cynthia',
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      deliverableUrl: deliverable.deliverableUrl,
    };
    console.log(`Publishing to subject: ${completionSubject}`);
    nc.publish(completionSubject, sc.encode(JSON.stringify(completionPayload, null, 2)));
    console.log('✅ Published completion notification');

    // Flush to ensure all messages are sent
    await nc.flush();
    console.log('✅ All messages flushed');

    console.log('\n========================================');
    console.log('📊 PUBLICATION SUMMARY');
    console.log('========================================');
    console.log(`Agent:           cynthia`);
    console.log(`Requirement:     REQ-STRATEGIC-AUTO-1735409486000`);
    console.log(`Status:          COMPLETE`);
    console.log(`Type:            research`);
    console.log(`File Size:       ${fileSizeBytes} bytes (${(fileSizeBytes / 1024).toFixed(2)} KB)`);
    console.log(`Deliverable URL: ${deliverable.deliverableUrl}`);
    console.log(`Subjects:        5 NATS subjects`);
    console.log('========================================');
    console.log('Key Findings:');
    console.log(`  - Implementation Status: ${deliverable.findings.implementationStatus}`);
    console.log(`  - Production Ready: ${deliverable.findings.productionReady ? 'YES' : 'NO'}`);
    console.log(`  - Duplicate Requirement: ${deliverable.findings.duplicateRequirement ? 'YES' : 'NO'}`);
    console.log(`  - Completed Features: ${deliverable.findings.completedFeatures}`);
    console.log(`  - Partial Features: ${deliverable.findings.partialFeatures}`);
    console.log(`  - Missing Features: ${deliverable.findings.missingFeatures}`);
    console.log('========================================');
    console.log('Immediate Recommendations:');
    deliverable.recommendations.immediate.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. ${rec}`);
    });
    console.log('========================================');
    console.log('✅ PUBLICATION COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error publishing deliverable:', error);
    process.exit(1);
  } finally {
    // Close NATS connection
    if (nc) {
      await nc.close();
      console.log('✅ NATS connection closed');
    }
  }
}

// Run the publisher
publishDeliverable()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
