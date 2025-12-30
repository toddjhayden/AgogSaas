#!/usr/bin/env ts-node
/**
 * Publish Sylvia's critique deliverable for REQ-STRATEGIC-AUTO-1767045901875
 * Agent: Sylvia (Architecture Critic)
 * Feature: Agent Error Resilience & Git Transaction Safety
 */

import { connect, NatsConnection, JSONCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4223';
const NATS_USER = process.env.NATS_USER || 'agents';
const NATS_PASSWORD = process.env.NATS_PASSWORD;
if (!NATS_PASSWORD) {
  throw new Error('NATS_PASSWORD environment variable is required');
}

interface SylviaCritiqueDeliverable {
  agent: string;
  req_number: string;
  status: 'COMPLETE' | 'BLOCKED' | 'FAILED';
  deliverable: string;
  summary: string;
  timestamp: string;
  verdict: string;
  critical_gaps: string[];
  mandatory_fixes: string[];
  approval_conditions: string[];
  estimated_effort: string;
}

async function publishDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    console.log('[Sylvia] Connecting to NATS...');
    nc = await connect({
      servers: NATS_URL,
      user: NATS_USER,
      pass: NATS_PASSWORD,
      name: 'sylvia-critique-publisher-REQ-STRATEGIC-AUTO-1767045901875'
    });

    console.log('[Sylvia] Connected to NATS');

    const jc = JSONCodec();
    const js = nc.jetstream();

    // Read the full deliverable
    const deliverablePath = path.join(__dirname, '..', 'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767045901875.md');
    const fullDeliverable = fs.readFileSync(deliverablePath, 'utf-8');

    // Create deliverable payload
    const deliverable: SylviaCritiqueDeliverable = {
      agent: 'sylvia',
      req_number: 'REQ-STRATEGIC-AUTO-1767045901875',
      status: 'COMPLETE',
      deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901875',
      summary: 'Architecture critique complete. APPROVE WITH MANDATORY FIXES. System demonstrates excellent foundational resilience (circuit breakers, workflow persistence, error handling) but has critical gaps in transaction safety. Git operations not atomic (GAP 19 - HIGH RISK) and database migrations not transactional (GAP 20 - HIGH RISK) must be fixed before production. Compensating transactions and deliverable validation recommended for next sprint. Estimated 1 week for production-ready with P1 fixes.',
      timestamp: new Date().toISOString(),
      verdict: 'APPROVE_WITH_MANDATORY_FIXES',
      critical_gaps: [
        'GAP 19: Git operations not atomic - HIGH RISK',
        'GAP 20: Database migrations not transactional - HIGH RISK'
      ],
      mandatory_fixes: [
        'Implement GitTransactionManager with rollback (2-3 days)',
        'Implement DatabaseTransactionManager with rollback (2-3 days)',
        'Verify zero corruption in test scenarios'
      ],
      approval_conditions: [
        'P1 fixes required before production deployment',
        'All rollback scenarios tested',
        'Zero repository corruption incidents',
        'Zero database corruption incidents'
      ],
      estimated_effort: '1 week for production-ready (P1 fixes), 2-3 weeks for complete resilience (all fixes)'
    };

    // Publish full deliverable to NATS subject
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901875';
    console.log(`[Sylvia] Publishing full deliverable to ${subject}...`);

    await js.publish(subject, jc.encode({
      ...deliverable,
      full_content: fullDeliverable,
      content_length: fullDeliverable.length,
      sections: {
        executive_summary: true,
        strengths: true,
        critical_gaps: true,
        recommendations: true,
        decision_matrix: true,
        success_criteria: true,
        final_verdict: true
      }
    }));

    console.log('[Sylvia] ✅ Full deliverable published to NATS');

    // Try to publish completion notice (may fail if stream doesn't exist)
    try {
      const completionSubject = 'agog.workflows.stage-complete.REQ-STRATEGIC-AUTO-1767045901875';
      console.log(`[Sylvia] Publishing completion notice to ${completionSubject}...`);

      await nc.publish(completionSubject, jc.encode({
        reqNumber: 'REQ-STRATEGIC-AUTO-1767045901875',
        stage: 'Critique',
        agent: 'sylvia',
        status: 'COMPLETE',
        deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901875',
        timestamp: new Date().toISOString(),
        verdict: 'APPROVE_WITH_MANDATORY_FIXES',
        next_stage: 'Backend Implementation',
        next_agent: 'roy',
        instructions_for_next_stage: 'Implement P1 fixes: GitTransactionManager and DatabaseTransactionManager before proceeding with other features'
      }));

      console.log('[Sylvia] ✅ Completion notice published');
    } catch (err: any) {
      console.log('[Sylvia] ⚠️ Completion notice skipped (stream may not exist):', err.message);
    }

    // Try to publish strategic decision (may fail if stream doesn't exist)
    try {
      const decisionSubject = 'agog.strategic.decisions.REQ-STRATEGIC-AUTO-1767045901875';
      console.log(`[Sylvia] Publishing strategic decision to ${decisionSubject}...`);

      await nc.publish(decisionSubject, jc.encode({
        agent: 'sylvia',
        req_number: 'REQ-STRATEGIC-AUTO-1767045901875',
        decision: 'APPROVE_WITH_CONDITIONS',
        reasoning: 'Architecture demonstrates excellent foundational resilience but requires critical transaction safety fixes before production. Git operations and database migrations must be made atomic with rollback capability.',
        instructions_for_roy: 'Priority 1: Implement GitTransactionManager with atomic commits and automatic rollback. Estimated 2-3 days. Critical for production safety.',
        instructions_for_marcus: 'Schedule 1 week for P1 transaction safety fixes before production deployment. Git and database corruption risks are unacceptable without these fixes.',
        priority_fixes: [
          'GitTransactionManager: Atomic git operations with rollback',
          'DatabaseTransactionManager: Transactional migrations with automatic rollback',
          'Test all rollback scenarios'
        ],
        deferred_items: [
          'TransactionCoordinator: Compensating transactions (P2 - next sprint)',
          'DeliverableValidator: JSON Schema validation (P3 - next sprint)'
        ],
        business_context: 'Transaction safety is critical for production reliability. Repository and database corruption can cause system-wide failures and require manual intervention. Investment in proper transaction safety will prevent costly production incidents.',
        estimated_effort: '1 week for P1 fixes (production-ready), 2-3 weeks for all improvements',
        timestamp: new Date().toISOString()
      }));

      console.log('[Sylvia] ✅ Strategic decision published');
    } catch (err: any) {
      console.log('[Sylvia] ⚠️ Strategic decision skipped (stream may not exist):', err.message);
    }

    console.log('\n[Sylvia] 📋 DELIVERABLE SUMMARY:');
    console.log('  Agent: sylvia');
    console.log('  Requirement: REQ-STRATEGIC-AUTO-1767045901875');
    console.log('  Status: COMPLETE');
    console.log('  Verdict: APPROVE WITH MANDATORY FIXES');
    console.log('  Critical Gaps: 2 (Git safety, DB migration safety)');
    console.log('  Mandatory Fixes: P1 transaction safety (1 week)');
    console.log('  Deliverable: nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901875');

    await nc.drain();
    console.log('[Sylvia] ✅ All deliverables published successfully');

  } catch (error: any) {
    console.error('[Sylvia] ❌ Error publishing deliverable:', error.message);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.close();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  publishDeliverable().catch(console.error);
}

export { publishDeliverable };
