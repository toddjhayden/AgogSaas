#!/usr/bin/env ts-node

/**
 * Publish Sylvia's Critique Deliverable for REQ-STRATEGIC-AUTO-1767108044311
 * Customer Sentiment Analysis & NPS Automation
 *
 * This script publishes Sylvia's critique to the NATS agog_deliverables stream
 * for consumption by the Strategic Orchestrator and Marcus (implementation).
 */

import { connect, StringCodec, JSONCodec } from 'nats';
import { readFileSync } from 'fs';
import { join } from 'path';

interface CritiqueDeliverable {
  agent: string;
  reqNumber: string;
  status: string;
  deliverable: string;
  summary: string;
  critiqueSummary: string;
  mandatoryConditions: number;
  approvalStatus: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED';
  blockers: string[];
  estimatedEffort: string;
  timestamp: string;
  metadata: {
    researchAuthor: string;
    reviewedBy: string;
    priority: string;
    riskLevel: string;
  };
}

async function publishCritiqueDeliverable() {
  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
  });

  const sc = StringCodec();
  const jc = JSONCodec();
  const js = nc.jetstream();

  console.log('📡 Connected to NATS');

  // Read the critique markdown file
  const critiquePath = join(__dirname, '..', 'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767108044311.md');
  const critiqueContent = readFileSync(critiquePath, 'utf-8');

  // Create deliverable payload
  const deliverable: CritiqueDeliverable = {
    agent: 'sylvia',
    reqNumber: 'REQ-STRATEGIC-AUTO-1767108044311',
    status: 'COMPLETE',
    deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767108044311',
    summary: 'Comprehensive critique of Customer Sentiment Analysis & NPS Automation research',
    critiqueSummary: 'APPROVED WITH 9 MANDATORY CONDITIONS: Google NLP integration, rate limiting, GDPR compliance, migration strategy, testing, error handling, monitoring, GraphQL validation, and rollback plan. Estimated effort revised from 5 to 7-8 weeks.',
    mandatoryConditions: 9,
    approvalStatus: 'APPROVED_WITH_CONDITIONS',
    blockers: [
      'Google Cloud NLP API credentials not configured',
      'Rate limiting strategy undefined',
      'GDPR compliance implementation missing',
      'Migration file not created',
      'Testing strategy not documented',
      'Error handling insufficient',
      'Monitoring/alerting not configured',
      'GraphQL schema validation weak',
      'Rollback plan not provided',
    ],
    estimatedEffort: '7-8 weeks (revised from 5 weeks due to mandatory conditions)',
    timestamp: new Date().toISOString(),
    metadata: {
      researchAuthor: 'cynthia',
      reviewedBy: 'sylvia',
      priority: 'HIGH',
      riskLevel: 'MEDIUM-HIGH',
    },
  };

  // Publish to agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767108044311
  const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767108044311';

  await js.publish(
    subject,
    jc.encode({
      ...deliverable,
      critiqueContent,
      publishedAt: new Date().toISOString(),
    }),
  );

  console.log('✅ Published critique deliverable to:', subject);

  // Also publish a summary to the general critiques channel
  await js.publish(
    'agog.deliverables.sylvia.critique',
    jc.encode({
      reqNumber: 'REQ-STRATEGIC-AUTO-1767108044311',
      approvalStatus: 'APPROVED_WITH_CONDITIONS',
      mandatoryConditions: 9,
      estimatedEffort: '7-8 weeks',
      timestamp: new Date().toISOString(),
    }),
  );

  console.log('✅ Published summary to: agog.deliverables.sylvia.critique');

  // Publish notification for Marcus
  await js.publish(
    'agog.notifications.marcus',
    jc.encode({
      type: 'CRITIQUE_COMPLETE',
      reqNumber: 'REQ-STRATEGIC-AUTO-1767108044311',
      title: 'Customer Sentiment Analysis & NPS Automation',
      message: 'Sylvia has completed critique review. APPROVED with 9 mandatory conditions. See deliverable for details.',
      severity: 'HIGH',
      actionRequired: true,
      deliverableUrl: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767108044311',
      timestamp: new Date().toISOString(),
    }),
  );

  console.log('✅ Sent notification to Marcus');

  await nc.close();
  console.log('🎉 Critique deliverable published successfully!');
}

// Run the script
publishCritiqueDeliverable()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error publishing critique deliverable:', error);
    process.exit(1);
  });
