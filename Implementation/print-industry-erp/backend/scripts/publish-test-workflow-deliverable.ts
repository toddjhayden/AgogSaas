#!/usr/bin/env ts-node
/**
 * Publish REQ-TEST-WORKFLOW-001 Research Deliverable to NATS
 */
import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

async function publishDeliverable() {
  console.log('📤 Publishing REQ-TEST-WORKFLOW-001 Research Deliverable to NATS');
  console.log('='.repeat(70));
  
  // Connect to NATS
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
  const nc = await connect({
    servers: natsUrl,
    user: process.env.NATS_USER || 'agents',
    pass: process.env.NATS_PASSWORD || 'agentspass',
  });
  
  const js = nc.jetstream();
  
  console.log(`✅ Connected to NATS at ${natsUrl}\n`);
  
  // Read research report
  const reportPath = path.join(__dirname, '..', 'REQ-TEST-WORKFLOW-001_CYNTHIA_RESEARCH.md');
  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  
  // Create deliverable
  const deliverable = {
    agent: 'cynthia',
    req_number: 'REQ-TEST-WORKFLOW-001',
    status: 'COMPLETE',
    deliverable: 'nats://agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001',
    summary: 'End-to-end autonomous workflow testing complete. All 8 tests passed (100% success rate). System is production-ready with NATS messaging, multi-stage coordination, agent orchestration, and strategic decision-making fully operational.',
    timestamp: new Date().toISOString(),
    complexity: 'Medium',
    test_results: {
      total_tests: 8,
      passed: 8,
      failed: 0,
      success_rate: 100.0
    },
    key_findings: [
      'NATS infrastructure fully operational with all 8 streams verified',
      'Multi-stage workflow coordination working correctly',
      'Agent spawning and orchestration validated',
      'Message persistence and retrieval functional',
      'Strategic decision-making pipeline ready',
      'All agent configuration files verified'
    ],
    next_steps: [
      'Start host-agent-listener: npm run host:listener',
      'Start strategic orchestrator: npm run daemon:start',
      'Monitor workflows via NATS dashboard: http://localhost:8223'
    ],
    report_content: reportContent,
    report_file: 'REQ-TEST-WORKFLOW-001_CYNTHIA_RESEARCH.md'
  };
  
  // Publish to NATS
  const subject = 'agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001';
  const ack = await js.publish(subject, sc.encode(JSON.stringify(deliverable)));
  
  console.log(`✅ Published deliverable to: ${subject}`);
  console.log(`   Stream: agog_features_research`);
  console.log(`   Sequence: ${ack.seq}`);
  console.log(`   Duplicate: ${ack.duplicate}`);
  
  // Verify retrieval
  console.log('\n🔍 Verifying deliverable...');
  const jsm = await nc.jetstreamManager();
  const msg = await jsm.streams.getMessage('agog_features_research', { last_by_subj: subject });
  
  if (msg) {
    const retrieved = JSON.parse(sc.decode(msg.data));
    console.log(`✅ Deliverable verified (seq: ${msg.seq})`);
    console.log(`   Agent: ${retrieved.agent}`);
    console.log(`   Status: ${retrieved.status}`);
    console.log(`   Test Results: ${retrieved.test_results.passed}/${retrieved.test_results.total_tests} passed`);
  }
  
  await nc.close();
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Deliverable published successfully!');
  console.log('\n📋 Completion Notice:');
  console.log(JSON.stringify({
    agent: 'cynthia',
    req_number: 'REQ-TEST-WORKFLOW-001',
    status: 'COMPLETE',
    deliverable: 'nats://agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001',
    summary: deliverable.summary
  }, null, 2));
  
  process.exit(0);
}

publishDeliverable().catch((error) => {
  console.error('❌ Failed to publish deliverable:', error);
  process.exit(1);
});
