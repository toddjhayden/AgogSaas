#!/usr/bin/env tsx

/**
 * Publish Sylvia Critique to NATS
 * REQ-STRATEGIC-AUTO-1767045901871 - Workflow Recovery & Self-Healing System
 *
 * Purpose: Publish Sylvia's architecture critique to NATS for Marcus (Implementation)
 * Channel: agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901871
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

async function publishSylviaCritique() {
  let nc: NatsConnection | undefined;

  try {
    // Read the critique deliverable
    const deliverablePath = path.join(
      __dirname,
      '..',
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767045901871.md'
    );

    console.log(`[Publish] Reading deliverable from: ${deliverablePath}`);
    const critiqueContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Connect to NATS
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const user = process.env.NATS_USER || 'agents';
    const pass = process.env.NATS_PASSWORD || 'WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4';

    console.log(`[Publish] Connecting to NATS at ${natsUrl}...`);
    nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'sylvia-critique-publisher-REQ-STRATEGIC-AUTO-1767045901871'
    });

    console.log('[Publish] Connected to NATS');

    // Publish to NATS
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901871';

    console.log(`[Publish] Publishing to: ${subject}`);
    console.log(`[Publish] Deliverable size: ${critiqueContent.length} bytes`);

    await nc.publish(subject, sc.encode(critiqueContent));

    console.log('[Publish] ✅ Successfully published Sylvia critique to NATS');
    console.log('[Publish] Subject: agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901871');
    console.log('[Publish] Next Agent: Marcus (Implementation)');

    // Publish completion event
    const completionEvent = {
      agent: 'sylvia',
      req_number: 'REQ-STRATEGIC-AUTO-1767045901871',
      status: 'COMPLETE',
      deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901871',
      summary: '✅ APPROVED WITH CONDITIONS. Mature Level 3 self-healing foundation with 8 recovery mechanisms. 5 conditions required: (1) Centralized Healing Orchestrator, (2) Healing Action Registry, (3) Healing Metrics Tracking, (4) Predictive Monitoring, (5) Fix SQL Injection. Ready for Marcus implementation.',
      critique_verdict: 'APPROVED_WITH_CONDITIONS',
      conditions_count: 5,
      critical_issues: 2,
      high_issues: 2,
      medium_issues: 3,
      low_issues: 2,
      next_agent: 'marcus'
    };

    await nc.publish(
      'agog.strategic.decisions.REQ-STRATEGIC-AUTO-1767045901871',
      sc.encode(JSON.stringify(completionEvent, null, 2))
    );

    console.log('[Publish] ✅ Published completion event to agog.strategic.decisions');

    await nc.flush();
    await nc.close();

    console.log('\n[Publish] 📊 Critique Summary:');
    console.log('[Publish]   Decision: APPROVED WITH CONDITIONS');
    console.log('[Publish]   Conditions: 5 (2 CRITICAL, 2 HIGH, 1 MEDIUM)');
    console.log('[Publish]   Critical Issues: SQL Injection, Scattered Recovery Logic');
    console.log('[Publish]   High Issues: No Healing Metrics, Hardcoded Handlers');
    console.log('[Publish]   Ready for: Marcus (Backend Implementation)');

  } catch (error: any) {
    console.error('[Publish] ❌ Failed to publish critique:', error.message);
    console.error('[Publish] Stack:', error.stack);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.close();
    }
  }
}

// Run the publisher
publishSylviaCritique()
  .then(() => {
    console.log('[Publish] Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Publish] Fatal error:', error);
    process.exit(1);
  });
