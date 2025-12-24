#!/usr/bin/env ts-node
/**
 * Publish Cynthia's Research Deliverable for REQ-TEST-WORKFLOW-001
 *
 * This script publishes the completed research report to NATS JetStream
 * so it can be consumed by the next stage (Sylvia - Critique)
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

(async () => {
  try {
    console.log('[Cynthia] Publishing research deliverable for REQ-TEST-WORKFLOW-001');
    console.log('[Cynthia] Connecting to NATS...');

    // Connect to NATS
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const connectionOptions: any = {
      servers: natsUrl,
      name: 'cynthia-research-publisher',
      timeout: 5000,
    };

    // Check for credentials
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;
    if (user && pass) {
      connectionOptions.user = user;
      connectionOptions.pass = pass;
      console.log(`[Cynthia] Using credentials for user: ${user}`);
    }

    const nc = await connect(connectionOptions);
    const js = nc.jetstream();

    console.log('[Cynthia] ✅ Connected to NATS');

    // Read the research report
    const reportPath = path.join(__dirname, '..', 'REQ-TEST-WORKFLOW-001_CYNTHIA_RESEARCH.md');

    if (!fs.existsSync(reportPath)) {
      throw new Error(`Research report not found at: ${reportPath}`);
    }

    const researchContent = fs.readFileSync(reportPath, 'utf-8');
    console.log(`[Cynthia] ✅ Loaded research report (${researchContent.length} bytes)`);

    // Create deliverable payload
    const deliverable = {
      agent: 'cynthia',
      req_number: 'REQ-TEST-WORKFLOW-001',
      status: 'COMPLETE',
      deliverable: 'nats://agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001',
      summary: 'End-to-end autonomous workflow testing complete. All 8 tests passed (100% success rate). System is production-ready with robust NATS messaging, multi-stage orchestration, and comprehensive error handling.',
      timestamp: new Date().toISOString(),
      metadata: {
        file_path: 'print-industry-erp/backend/REQ-TEST-WORKFLOW-001_CYNTHIA_RESEARCH.md',
        test_results: {
          total_tests: 8,
          passed: 8,
          failed: 0,
          success_rate: '100.0%'
        },
        key_findings: [
          'NATS JetStream infrastructure fully operational with 8 streams',
          'Multi-stage workflow orchestration validated (6 stages)',
          'Agent spawning and communication working end-to-end',
          'Smart resume capability verified for workflow recovery',
          'Quality gates enforced (Billy QA mandatory testing)',
          'Strategic escalation to PO agents functional',
          'Message persistence and retrieval validated'
        ],
        recommendations: [
          'System is production-ready - no blockers identified',
          'Monitor first production workflow for performance metrics',
          'Consider adding real-time monitoring dashboard',
          'Implement alerting for ESCALATE_HUMAN events'
        ],
        streams_verified: [
          'agog_orchestration_events',
          'agog_features_research',
          'agog_features_critique',
          'agog_features_backend',
          'agog_features_frontend',
          'agog_features_qa',
          'agog_strategic_decisions',
          'agog_strategic_escalations'
        ],
        agents_verified: ['cynthia', 'sylvia', 'roy', 'jen', 'billy']
      },
      content: researchContent
    };

    // Publish to NATS
    const subject = 'agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001';
    console.log(`[Cynthia] Publishing to subject: ${subject}`);

    const ack = await js.publish(subject, sc.encode(JSON.stringify(deliverable)));

    console.log('[Cynthia] ✅ Research deliverable published successfully!');
    console.log(`[Cynthia] Sequence number: ${ack.seq}`);
    console.log(`[Cynthia] Stream: agog_features_research`);
    console.log('[Cynthia] Next stage: Sylvia (Critique)');

    await nc.close();
    console.log('[Cynthia] Connection closed');
    process.exit(0);

  } catch (error: any) {
    console.error('[Cynthia] ❌ Failed to publish deliverable:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
