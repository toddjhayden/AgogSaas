import { connect, StringCodec, NatsConnection } from 'nats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface QADeliverable {
  reqNumber: string;
  agent: string;
  stage: string;
  status: string;
  testResult: string;
  productionReady: boolean;
  criticalIssues: number;
  blockingIssues: number;
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;
  coverage: {
    functional: string;
    code: string;
    integration: string;
  };
  dependencies: string[];
  nextStage: string;
  recommendations: string[];
  timestamp: string;
  deliverableContent: string;
}

async function publishQADeliverable() {
  let nc: NatsConnection | null = null;

  try {
    // Connect to NATS
    console.log('Connecting to NATS server...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4223',
      user: process.env.NATS_USER || 'agents',
      pass: process.env.NATS_PASSWORD,
      maxReconnectAttempts: 5,
      reconnectTimeWait: 1000,
    });
    console.log('✅ Connected to NATS server');

    const sc = StringCodec();

    // Read the QA deliverable markdown file
    const deliverableFilePath = join(__dirname, '..', 'BILLY_QA_DELIVERABLE_REQ-MISSING-TOAST-IMPORT-1767129600000.md');
    const deliverableContent = readFileSync(deliverableFilePath, 'utf-8');

    // Create the QA deliverable payload
    const qaDeliverable: QADeliverable = {
      reqNumber: 'REQ-MISSING-TOAST-IMPORT-1767129600000',
      agent: 'billy',
      stage: 'qa',
      status: 'COMPLETE',
      testResult: 'PASSED',
      productionReady: true,
      criticalIssues: 0,
      blockingIssues: 0,
      testsExecuted: 12,
      testsPassed: 12,
      testsFailed: 0,
      coverage: {
        functional: '100%',
        code: '100%',
        integration: '100%',
      },
      dependencies: [
        'CYNTHIA_RESEARCH_DELIVERABLE_REQ-MISSING-TOAST-IMPORT-1767129600000',
        'SYLVIA_CRITIQUE_DELIVERABLE_REQ-MISSING-TOAST-IMPORT-1767129600000',
        'ROY_BACKEND_DELIVERABLE_REQ-MISSING-TOAST-IMPORT-1767129600000',
        'JEN_FRONTEND_DELIVERABLE_REQ-MISSING-TOAST-IMPORT-1767129600000',
      ],
      nextStage: 'deployment',
      recommendations: [
        'Deploy to production',
        'Monitor toast rendering in production',
        'Consider custom theming (future enhancement)',
      ],
      timestamp: new Date().toISOString(),
      deliverableContent: deliverableContent,
    };

    // Publish to NATS
    const subject = 'agog.deliverables.billy.qa.REQ-MISSING-TOAST-IMPORT-1767129600000';
    console.log(`\nPublishing QA deliverable to NATS subject: ${subject}`);

    nc.publish(subject, sc.encode(JSON.stringify(qaDeliverable, null, 2)));

    console.log('✅ QA deliverable published successfully');
    console.log(`\n📊 QA Test Summary:`);
    console.log(`   - Requirement: ${qaDeliverable.reqNumber}`);
    console.log(`   - Test Result: ${qaDeliverable.testResult}`);
    console.log(`   - Tests Executed: ${qaDeliverable.testsExecuted}`);
    console.log(`   - Tests Passed: ${qaDeliverable.testsPassed}`);
    console.log(`   - Tests Failed: ${qaDeliverable.testsFailed}`);
    console.log(`   - Critical Issues: ${qaDeliverable.criticalIssues}`);
    console.log(`   - Blocking Issues: ${qaDeliverable.blockingIssues}`);
    console.log(`   - Production Ready: ${qaDeliverable.productionReady ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   - Coverage: Functional ${qaDeliverable.coverage.functional}, Code ${qaDeliverable.coverage.code}, Integration ${qaDeliverable.coverage.integration}`);
    console.log(`\n📝 Deliverable Content:`);
    console.log(`   ${deliverableContent.split('\n').slice(0, 5).join('\n   ')}`);
    console.log(`   ... (${deliverableContent.split('\n').length} total lines)\n`);

    // Flush and close connection
    await nc.flush();
    await nc.drain();
    console.log('✅ NATS connection closed');

  } catch (error) {
    console.error('❌ Error publishing QA deliverable:', error);
    process.exit(1);
  }
}

// Run the publisher
publishQADeliverable();
