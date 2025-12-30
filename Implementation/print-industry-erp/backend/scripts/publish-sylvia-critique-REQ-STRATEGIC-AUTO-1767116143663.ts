#!/usr/bin/env ts-node
/**
 * Publish Sylvia's Critique Deliverable to NATS
 * REQ-STRATEGIC-AUTO-1767116143663 - Document Management & Digital Asset Library
 *
 * This script publishes the architecture critique deliverable to the NATS message queue
 * for the orchestrator to consume and route to the appropriate next agent.
 */

import { connect, StringCodec, NatsConnection } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface CritiqueDeliverable {
  agent: string;
  reqNumber: string;
  status: 'COMPLETE';
  deliverable: string;
  summary: string;
  changes: {
    files_created: string[];
    files_modified: string[];
    files_deleted: string[];
    tables_created: string[];
    tables_modified: string[];
    migrations_added: string[];
    key_changes: string[];
  };
  timestamp: string;
  nextAgent: string;
  critiquePath: string;
  critiqueContent: string;
}

async function publishCritiqueDeliverable(): Promise<void> {
  let nc: NatsConnection | undefined;

  try {
    console.log('📡 Connecting to NATS server...');

    // Connect to NATS
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'sylvia-critique-publisher-REQ-STRATEGIC-AUTO-1767116143663',
    });

    console.log('✅ Connected to NATS server');

    // Read the critique deliverable
    const critiquePath = path.join(
      __dirname,
      '..',
      'docs',
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767116143663.md'
    );

    if (!fs.existsSync(critiquePath)) {
      throw new Error(`Critique deliverable not found at: ${critiquePath}`);
    }

    const critiqueContent = fs.readFileSync(critiquePath, 'utf-8');
    console.log(`📄 Read critique deliverable (${critiqueContent.length} characters)`);

    // Create the deliverable payload
    const deliverable: CritiqueDeliverable = {
      agent: 'sylvia',
      reqNumber: 'REQ-STRATEGIC-AUTO-1767116143663',
      status: 'COMPLETE',
      deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767116143663',
      summary: 'Architecture critique of Document Management & Digital Asset Library requirement. APPROVED WITH MANDATORY CONDITIONS: Complete Phase 0 prerequisites (S3 integration, virus scanning, encryption key management, cost controls) before Phase 1. Implement storage abstraction layer, GDPR compliance module, and defer Elasticsearch/AI-ML to later phases. Revised budget: $346K over 13 months (vs. original $290K/12mo). Key risks: storage cost explosion, incomplete security model, performance overhead from Elasticsearch+AI/ML. Recommendation: Proceed with phased approach focusing on foundational integrations first.',
      changes: {
        files_created: [
          'print-industry-erp/backend/docs/SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767116143663.md',
          'print-industry-erp/backend/scripts/publish-sylvia-critique-REQ-STRATEGIC-AUTO-1767116143663.ts',
        ],
        files_modified: [],
        files_deleted: [],
        tables_created: [],
        tables_modified: [],
        migrations_added: [],
        key_changes: [
          'APPROVED WITH MANDATORY CONDITIONS - Cannot proceed without Phase 0 completion',
          'BLOCKER: Complete AWS S3 integration (currently placeholder at customer-portal.resolver.ts:1267)',
          'BLOCKER: Implement virus scanning with ClamAV (currently TODO at customer-portal.resolver.ts:1303)',
          'MANDATORY: Add storage abstraction layer (IStorageService interface) for multi-cloud support',
          'MANDATORY: Implement encryption key management (AWS KMS or HashiCorp Vault)',
          'MANDATORY: Add customer storage quotas to prevent cost explosion',
          'MANDATORY: Build GDPR right-to-erasure module with certificate of destruction',
          'RECOMMENDATION: Defer Elasticsearch to Phase 2; use PostgreSQL full-text search in Phase 1',
          'RECOMMENDATION: Defer custom ML to Phase 4; use AWS Rekognition API in Phase 3',
          'REVISED BUDGET: $346K over 13 months (includes Phase 0 prerequisites, compliance, security hardening)',
          'REVISED TIMELINE: Phase 0 (3.5 weeks) → Phase 1 (10 weeks) → Phase 2 (16 weeks) → Phase 3 (12 weeks) → Phase 4 (12 weeks)',
          'ROI VALIDATED: 2.75-3.8 year payback period; $90K-105K/year savings from reprint reduction + time savings',
          'RISK MITIGATION: 5 mandatory conditions before Phase 1; performance monitoring; backup/disaster recovery',
          'COST CONTROL: Hard file size limits, per-customer quotas, automated cleanup, cost monitoring alerts',
          'SECURITY ENHANCEMENTS: Encryption at rest/transit, key rotation, secure storage URL handling, audit logging',
        ],
      },
      timestamp: new Date().toISOString(),
      nextAgent: 'marcus', // Assigned to Marcus for implementation
      critiquePath,
      critiqueContent,
    };

    // Publish to NATS
    const sc = StringCodec();
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767116143663';

    console.log(`📤 Publishing to subject: ${subject}`);
    nc.publish(subject, sc.encode(JSON.stringify(deliverable, null, 2)));

    // Also publish to general sylvia critique stream
    nc.publish('agog.deliverables.sylvia.critique', sc.encode(JSON.stringify(deliverable, null, 2)));

    console.log('✅ Critique deliverable published successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Agent: ${deliverable.agent}`);
    console.log(`   Requirement: ${deliverable.reqNumber}`);
    console.log(`   Status: ${deliverable.status}`);
    console.log(`   Next Agent: ${deliverable.nextAgent}`);
    console.log(`   Decision: APPROVED WITH MANDATORY CONDITIONS`);
    console.log(`   Phase 0 Prerequisites: 3.5 weeks, $21K`);
    console.log(`   Total Budget: $346K over 13 months`);
    console.log(`   Key Blockers: 2 (S3 integration, virus scanning)`);
    console.log(`   Mandatory Conditions: 7`);
    console.log(`\n📋 Key Recommendations:`);
    console.log(`   1. Complete Phase 0 before Phase 1 (BLOCKER)`);
    console.log(`   2. Add storage abstraction layer for multi-cloud`);
    console.log(`   3. Implement GDPR compliance module`);
    console.log(`   4. Defer Elasticsearch to Phase 2`);
    console.log(`   5. Use AWS Rekognition instead of custom ML`);
    console.log(`   6. Add customer storage quotas`);
    console.log(`   7. Build encryption key management`);

    // Wait a bit for the message to be sent
    await new Promise((resolve) => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('❌ Error publishing critique deliverable:', error);
    throw error;
  } finally {
    if (nc) {
      console.log('🔌 Closing NATS connection...');
      await nc.drain();
      console.log('✅ NATS connection closed');
    }
  }
}

// Run the publisher
publishCritiqueDeliverable()
  .then(() => {
    console.log('\n✨ Critique publication complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
