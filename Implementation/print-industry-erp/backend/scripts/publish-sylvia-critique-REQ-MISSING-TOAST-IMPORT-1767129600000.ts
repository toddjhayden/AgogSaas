#!/usr/bin/env ts-node
/**
 * Publish Sylvia's Critique for REQ-MISSING-TOAST-IMPORT-1767129600000
 *
 * This script publishes the architecture critique deliverable to NATS
 * for the missing react-hot-toast dependency requirement.
 */

import { connect, JSONCodec } from 'nats';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CritiqueDeliverable {
  reqNumber: string;
  agent: string;
  stage: string;
  status: string;
  decision: string;
  priority: string;
  estimatedEffort: string;
  complexity: string;
  riskLevel: string;
  blockers: string[];
  dependencies: string[];
  nextStage: string;
  recommendedAssignee: string;
  architecturalConcerns: string[];
  securityConcerns: string[];
  performanceConcerns: string[];
  critiqueContent: string;
  timestamp: string;
}

async function publishCritique() {
  const reqNumber = 'REQ-MISSING-TOAST-IMPORT-1767129600000';
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';

  console.log('🚀 Publishing Sylvia Critique Deliverable');
  console.log(`📋 Requirement: ${reqNumber}`);
  console.log(`🔗 NATS URL: ${natsUrl}`);

  try {
    // Read the critique deliverable
    const deliverablePath = path.join(
      __dirname,
      '..',
      `SYLVIA_CRITIQUE_DELIVERABLE_${reqNumber}.md`
    );

    console.log(`📄 Reading deliverable from: ${deliverablePath}`);
    const critiqueContent = await fs.readFile(deliverablePath, 'utf-8');

    // Connect to NATS
    console.log('🔌 Connecting to NATS...');
    const nc = await connect({
      servers: natsUrl,
      timeout: 5000,
    });
    console.log('✅ Connected to NATS');

    const jc = JSONCodec<CritiqueDeliverable>();

    // Prepare deliverable payload
    const deliverable: CritiqueDeliverable = {
      reqNumber,
      agent: 'sylvia',
      stage: 'critique',
      status: 'COMPLETE',
      decision: 'APPROVED',
      priority: 'CRITICAL',
      estimatedEffort: '10-15 minutes',
      complexity: 'P4',
      riskLevel: 'LOW',
      blockers: [],
      dependencies: [
        `CYNTHIA_RESEARCH_DELIVERABLE_${reqNumber}`
      ],
      nextStage: 'implementation',
      recommendedAssignee: 'roy|alex',
      architecturalConcerns: [],
      securityConcerns: [],
      performanceConcerns: [],
      critiqueContent,
      timestamp: new Date().toISOString(),
    };

    // Publish to NATS subject
    const subject = `agog.deliverables.sylvia.critique.${reqNumber}`;
    console.log(`📤 Publishing to subject: ${subject}`);

    nc.publish(subject, jc.encode(deliverable));

    console.log('✅ Critique deliverable published successfully');
    console.log('\n📊 Deliverable Summary:');
    console.log(`   Decision: ${deliverable.decision}`);
    console.log(`   Priority: ${deliverable.priority}`);
    console.log(`   Risk Level: ${deliverable.riskLevel}`);
    console.log(`   Estimated Effort: ${deliverable.estimatedEffort}`);
    console.log(`   Recommended Assignee: ${deliverable.recommendedAssignee}`);
    console.log(`   Next Stage: ${deliverable.nextStage}`);

    // Also publish to the general requirement updates stream
    const updateSubject = `agog.requirements.updates.${reqNumber}`;
    const updatePayload = {
      reqNumber,
      stage: 'critique',
      agent: 'sylvia',
      status: 'COMPLETE',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      message: 'Architecture critique complete - APPROVED for implementation',
    };

    nc.publish(updateSubject, jc.encode(updatePayload));
    console.log(`📤 Status update published to: ${updateSubject}`);

    // Drain and close connection
    await nc.drain();
    console.log('👋 Disconnected from NATS');

    console.log('\n✨ Critique deliverable publication complete!');
    console.log(`\n📍 Next Steps:`);
    console.log(`   1. Roy or Alex should implement the fix`);
    console.log(`   2. Add react-hot-toast@2.6.0 to package.json`);
    console.log(`   3. Install dependency via npm install`);
    console.log(`   4. Add <Toaster /> component to App.tsx`);
    console.log(`   5. Run verification tests`);

  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  publishCritique().catch(console.error);
}

export { publishCritique };
