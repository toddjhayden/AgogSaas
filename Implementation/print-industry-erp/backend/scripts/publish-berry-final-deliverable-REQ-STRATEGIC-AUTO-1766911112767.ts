/**
 * Publish Berry's Final DevOps Deliverable to NATS
 * REQ-STRATEGIC-AUTO-1766911112767 - Sales Quote Automation
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4223';
const NATS_USER = process.env.NATS_USER || 'agents';
const NATS_PASSWORD = process.env.NATS_PASSWORD || 'WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4';

interface Deliverable {
  agent: string;
  role: string;
  reqNumber: string;
  timestamp: string;
  deliverableType: string;
  content: string;
  summary: string;
  status: string;
  metadata: {
    wordCount: number;
    lineCount: number;
    fileSize: number;
  };
}

async function publishDeliverable(): Promise<void> {
  let nc: NatsConnection | null = null;

  try {
    console.log('🔌 Connecting to NATS...');
    console.log(`   URL: ${NATS_URL}`);

    nc = await connect({
      servers: NATS_URL,
      user: NATS_USER,
      pass: NATS_PASSWORD,
      maxReconnectAttempts: 3,
      reconnectTimeWait: 1000,
      timeout: 5000
    });

    console.log('✅ Connected to NATS server');

    // Read the deliverable file
    const deliverableFile = path.join(__dirname, '..', 'BERRY_DEVOPS_FINAL_DELIVERABLE_REQ-STRATEGIC-AUTO-1766911112767.md');
    console.log(`📄 Reading deliverable: ${deliverableFile}`);

    const content = fs.readFileSync(deliverableFile, 'utf-8');
    const lines = content.split('\n');
    const wordCount = content.split(/\s+/).length;
    const fileSize = Buffer.byteLength(content, 'utf-8');

    // Create deliverable payload
    const deliverable: Deliverable = {
      agent: 'berry',
      role: 'DevOps & Deployment Specialist',
      reqNumber: 'REQ-STRATEGIC-AUTO-1766911112767',
      timestamp: new Date().toISOString(),
      deliverableType: 'DEVOPS_DEPLOYMENT_FINAL',
      content: content,
      summary: 'Sales Quote Automation - Final DevOps Deployment Analysis. CONDITIONAL APPROVAL - Phase 1 critical fixes required (3-4 weeks). Production readiness: 6.55/10. Excellent architecture with critical operational gaps (validation, testing, tenant context, monitoring).',
      status: 'CONDITIONAL_APPROVAL',
      metadata: {
        wordCount: wordCount,
        lineCount: lines.length,
        fileSize: fileSize
      }
    };

    console.log(`📊 Deliverable stats:`);
    console.log(`   Lines: ${deliverable.metadata.lineCount}`);
    console.log(`   Words: ${deliverable.metadata.wordCount}`);
    console.log(`   Size: ${(deliverable.metadata.fileSize / 1024).toFixed(2)} KB`);

    // Publish to multiple subjects for comprehensive tracking
    const sc = StringCodec();
    const payload = JSON.stringify(deliverable, null, 2);

    // 1. Agent-specific deliverable stream
    const agentSubject = 'agog.deliverables.berry.devops.REQ-STRATEGIC-AUTO-1766911112767';
    console.log(`\n📤 Publishing to: ${agentSubject}`);
    nc.publish(agentSubject, sc.encode(payload));
    console.log('✅ Published to agent deliverable stream');

    // 2. Requirement tracking stream
    const reqSubject = 'agog.requirements.REQ-STRATEGIC-AUTO-1766911112767.berry.deliverable';
    console.log(`📤 Publishing to: ${reqSubject}`);
    nc.publish(reqSubject, sc.encode(payload));
    console.log('✅ Published to requirement tracking stream');

    // 3. Workflow coordination stream (for strategic orchestrator)
    const workflowSubject = 'agog.workflow.sales-quote-automation.berry.final';
    console.log(`📤 Publishing to: ${workflowSubject}`);
    nc.publish(workflowSubject, sc.encode(payload));
    console.log('✅ Published to workflow stream');

    // 4. Deployment status stream
    const deploymentSubject = 'agog.deployment.status.REQ-STRATEGIC-AUTO-1766911112767';
    const deploymentStatus = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1766911112767',
      feature: 'Sales Quote Automation',
      status: 'CONDITIONAL_APPROVAL',
      productionReady: false,
      criticalIssuesCount: 4,
      highPriorityIssuesCount: 3,
      estimatedTimeToProduction: '3-4 weeks (Phase 1) or 5-7 weeks (Full Production)',
      overallScore: '6.55/10',
      recommendation: 'Complete Phase 1 critical fixes before deployment',
      timestamp: new Date().toISOString(),
      agent: 'berry'
    };
    console.log(`📤 Publishing to: ${deploymentSubject}`);
    nc.publish(deploymentSubject, sc.encode(JSON.stringify(deploymentStatus, null, 2)));
    console.log('✅ Published deployment status');

    // Flush to ensure all messages are sent
    await nc.flush();
    console.log('\n✅ All messages flushed to NATS');

    console.log('\n' + '='.repeat(60));
    console.log('📢 DELIVERABLE PUBLISHED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`Agent: Berry (DevOps & Deployment Specialist)`);
    console.log(`Requirement: REQ-STRATEGIC-AUTO-1766911112767`);
    console.log(`Feature: Sales Quote Automation`);
    console.log(`Status: CONDITIONAL APPROVAL`);
    console.log(`Timeline: 3-4 weeks to controlled beta`);
    console.log(`Production Ready: NO - Phase 1 fixes required`);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Error publishing deliverable:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure NATS server is running:');
      console.error('   docker-compose -f docker-compose.agents.yml up -d nats');
    }
    process.exit(1);
  } finally {
    if (nc) {
      await nc.drain();
      console.log('🔌 Disconnected from NATS');
    }
  }
}

// Run the publication
publishDeliverable().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
