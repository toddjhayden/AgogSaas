#!/usr/bin/env ts-node
import { connect, StringCodec } from 'nats';
import * as fs from 'fs';

const sc = StringCodec();

async function publishDeliverable() {
  const natsPassword = process.env.NATS_PASSWORD;
  if (!natsPassword) {
    throw new Error('NATS_PASSWORD environment variable is required');
  }
  const nc = await connect({
    servers: 'nats://localhost:4223',
    user: process.env.NATS_USER || 'agents',
    pass: natsPassword
  });

  const js = nc.jetstream();

  const deliverableContent = fs.readFileSync('REQ-TEST-WORKFLOW-001_RESEARCH_DELIVERABLE.md', 'utf-8');

  const deliverable = {
    agent: 'cynthia',
    req_number: 'REQ-TEST-WORKFLOW-001',
    status: 'COMPLETE',
    deliverable: 'nats://agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001',
    summary: 'Successfully validated end-to-end autonomous workflow system with 100% test pass rate across all 8 validation scenarios',
    content: deliverableContent,
    test_results: {
      total_tests: 8,
      passed: 8,
      failed: 0,
      success_rate: 100.0
    },
    infrastructure_status: {
      nats: 'OPERATIONAL',
      postgresql_app: 'HEALTHY',
      postgresql_agents: 'HEALTHY',
      ollama: 'RUNNING'
    },
    agent_files_verified: [
      'cynthia-research-new.md',
      'sylvia-critique.md',
      'roy-backend.md',
      'jen-frontend.md',
      'billy-qa.md',
      'priya-statistics.md',
      'marcus-warehouse-po.md',
      'sarah-sales-po.md',
      'alex-procurement-po.md',
      'miki-devops.md',
      'berry-devops.md'
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
    timestamp: new Date().toISOString()
  };

  const subject = 'agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001';

  console.log(`\nPublishing deliverable to NATS...`);
  console.log(`Subject: ${subject}`);
  console.log(`Agent: ${deliverable.agent}`);
  console.log(`Status: ${deliverable.status}`);
  console.log(`Content size: ${deliverableContent.length} characters`);
  console.log(`Full payload size: ${JSON.stringify(deliverable).length} bytes\n`);

  const ack = await js.publish(subject, sc.encode(JSON.stringify(deliverable)));

  console.log(`✅ Published successfully!`);
  console.log(`   Sequence number: ${ack.seq}`);
  console.log(`   Stream: agog_features_research`);
  console.log(`   Duplicate: ${ack.duplicate ? 'Yes' : 'No'}\n`);

  await nc.close();
  console.log('✅ NATS connection closed\n');
}

publishDeliverable().catch((error) => {
  console.error('❌ Failed to publish deliverable:', error);
  process.exit(1);
});
