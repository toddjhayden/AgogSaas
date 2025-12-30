#!/usr/bin/env ts-node

/**
 * Publish Sylvia's Architectural Critique for REQ-PO-COLUMN-1766892755201
 * Fix Purchase Order Column Name Mismatch
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface DeliverablePayload {
  reqNumber: string;
  stage: 'CRITIQUE';
  agent: 'sylvia';
  status: 'COMPLETE';
  title: string;
  deliverableUrl: string;
  timestamp: string;
  summary: string;
  critiqueSummary: {
    verdict: string;
    priority: string;
    architecturalImpact: string;
    businessRisk: string;
    technicalDebt: string;
    recommendations: string[];
    approvalStatus: string;
  };
  nextStage: {
    stage: 'IMPLEMENTATION';
    assignedTo: 'alex';
    estimatedEffort: string;
  };
}

async function main() {
  console.log('📢 Publishing Sylvia Critique for REQ-PO-COLUMN-1766892755201...');

  // Read the deliverable file
  const deliverablePath = path.join(
    __dirname,
    '..',
    'SYLVIA_CRITIQUE_DELIVERABLE_REQ-PO-COLUMN-1766892755201.md'
  );

  if (!fs.existsSync(deliverablePath)) {
    throw new Error(`Deliverable file not found: ${deliverablePath}`);
  }

  const deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');
  console.log(`✅ Read deliverable: ${deliverablePath}`);

  // Create payload
  const payload: DeliverablePayload = {
    reqNumber: 'REQ-PO-COLUMN-1766892755201',
    stage: 'CRITIQUE',
    agent: 'sylvia',
    status: 'COMPLETE',
    title: 'Fix Purchase Order Column Name Mismatch',
    deliverableUrl: 'nats://agog.deliverables.sylvia.critique.REQ-PO-COLUMN-1766892755201',
    timestamp: new Date().toISOString(),
    summary: 'Architectural critique complete. This is a low-priority documentation maintenance issue with no runtime impact. The database migration V0.0.8 correctly renamed po_date to purchase_order_date, but the reference schema file was not updated. Approved for implementation with recommendations to expand scope to all 8 tables affected by V0.0.8.',
    critiqueSummary: {
      verdict: 'LOW-PRIORITY DOCUMENTATION MAINTENANCE - NO ARCHITECTURAL CONCERNS',
      priority: 'Medium-High (due to NestJS migration context)',
      architecturalImpact: 'MINIMAL (Documentation only)',
      businessRisk: 'NONE (No user-facing impact)',
      technicalDebt: 'LOW (Isolated to reference schema files)',
      recommendations: [
        'Update reference schema file for purchase_orders table (15 min)',
        'Expand scope to include all 8 tables affected by V0.0.8 migration',
        'Add schema file headers explaining purpose and migration versioning',
        'Create follow-up REQ-SCHEMA-GOVERNANCE-001 for comprehensive audit',
        'Complete before NestJS Phase 2 (ORM integration) to prevent entity generation errors',
        'Implement automated schema extraction for core tables (long-term)'
      ],
      approvalStatus: 'APPROVED FOR IMPLEMENTATION'
    },
    nextStage: {
      stage: 'IMPLEMENTATION',
      assignedTo: 'alex',
      estimatedEffort: '15 minutes (immediate fix) + 4-6 hours (comprehensive audit)'
    }
  };

  // Connect to NATS
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  console.log(`🔌 Connecting to NATS at ${natsUrl}...`);

  const nc = await connect({ servers: natsUrl });
  console.log('✅ Connected to NATS');

  const sc = StringCodec();

  // Publish to deliverables stream
  const subject = 'agog.deliverables.sylvia.critique.REQ-PO-COLUMN-1766892755201';
  await nc.publish(subject, sc.encode(JSON.stringify(payload, null, 2)));
  console.log(`✅ Published to: ${subject}`);

  // Publish to workflow progression stream
  const workflowSubject = 'agog.workflow.progression';
  const workflowPayload = {
    reqNumber: 'REQ-PO-COLUMN-1766892755201',
    from: 'CRITIQUE',
    to: 'IMPLEMENTATION',
    agent: 'sylvia',
    assignedTo: 'alex',
    timestamp: new Date().toISOString(),
    status: 'READY_FOR_IMPLEMENTATION'
  };
  await nc.publish(workflowSubject, sc.encode(JSON.stringify(workflowPayload, null, 2)));
  console.log(`✅ Published workflow progression to: ${workflowSubject}`);

  // Also publish the full deliverable content
  const contentSubject = 'agog.deliverables.content.REQ-PO-COLUMN-1766892755201.sylvia';
  await nc.publish(contentSubject, sc.encode(deliverableContent));
  console.log(`✅ Published full deliverable content to: ${contentSubject}`);

  await nc.drain();
  console.log('✅ Disconnected from NATS');
  console.log('');
  console.log('🎉 Sylvia critique published successfully!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   Requirement: ${payload.reqNumber}`);
  console.log(`   Verdict: ${payload.critiqueSummary.verdict}`);
  console.log(`   Priority: ${payload.critiqueSummary.priority}`);
  console.log(`   Approval: ${payload.critiqueSummary.approvalStatus}`);
  console.log(`   Next: ${payload.nextStage.stage} (assigned to ${payload.nextStage.assignedTo})`);
  console.log(`   Effort: ${payload.nextStage.estimatedEffort}`);
}

main().catch((err) => {
  console.error('❌ Error publishing deliverable:', err);
  process.exit(1);
});
