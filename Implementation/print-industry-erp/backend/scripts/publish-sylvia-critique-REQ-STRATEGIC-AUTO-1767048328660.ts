/**
 * Publish Sylvia's Critique for REQ-STRATEGIC-AUTO-1767048328660
 * Real-Time Production Analytics Dashboard
 */

import { connect, JSONCodec } from 'nats';

async function publishCritique() {
  let nc;

  try {
    // Connect to NATS
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    console.log(`Connecting to NATS at ${natsUrl}...`);

    nc = await connect({
      servers: natsUrl,
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASSWORD,
    });

    console.log('Connected to NATS successfully');

    const jc = JSONCodec();

    // Prepare critique payload
    const payload = {
      agent: 'sylvia',
      reqNumber: 'REQ-STRATEGIC-AUTO-1767048328660',
      status: 'COMPLETE',
      deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767048328660',
      title: 'Real-Time Production Analytics Dashboard - Architecture Critique',
      summary: 'Comprehensive critique identifying 18 high-risk areas. Original 8-week estimate revised to 12-16 weeks. Requires proof-of-concept phase before full commitment. APPROVE WITH CONDITIONS.',
      criticalConcerns: [
        'Missing WebSocket infrastructure - No GraphQL subscription support exists',
        'NATS production reliability unproven - Agent monitoring != production system',
        'Database performance limitations - Materialized view approach has serious flaws',
        'Security & authorization gaps - RLS patterns inadequately specified',
        'Mobile/tablet UI completely missing - Shop floor operators use tablets',
      ],
      recommendations: [
        'Require 2-week proof-of-concept before full commitment',
        'Extend timeline to 12-16 weeks (not 8 weeks)',
        'Add 1.25 FTE to team (Senior Backend, UX Designer, Performance Engineer)',
        'Consider hybrid polling + subscription approach for phased rollout',
        'Implement phased rollout strategy with beta user group',
      ],
      risksIdentified: 18,
      timelineRevision: {
        original: '8 weeks',
        revised: '12-16 weeks',
        phase0: '2 weeks - Proof-of-Concept (REQUIRED)',
        phase1: '3-4 weeks - Foundation',
        phase2: '3-4 weeks - Core Dashboard',
        phase3: '3-4 weeks - Advanced Features',
        phase4: '2-3 weeks - Optimization & Hardening',
      },
      verdict: 'APPROVE WITH CONDITIONS',
      goNoGoDecisionRequired: true,
      estimatedInfrastructureCost: '$1000-2300/month',
      timestamp: new Date().toISOString(),
      deliverableLocation: 'print-industry-erp/backend/SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328660.md',
    };

    // Publish to NATS
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767048328660';
    console.log(`Publishing critique to subject: ${subject}`);

    nc.publish(subject, jc.encode(payload));
    await nc.flush();

    console.log('✅ Critique published successfully');
    console.log(`Subject: ${subject}`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));

    // Also publish to workflow tracking
    const workflowSubject = 'agog.workflows.stage-completed';
    const workflowPayload = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1767048328660',
      stage: 'critique',
      agent: 'sylvia',
      status: 'COMPLETE',
      deliverableUrl: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767048328660',
      nextStage: 'product-owner-review',
      timestamp: new Date().toISOString(),
    };

    nc.publish(workflowSubject, jc.encode(workflowPayload));
    await nc.flush();

    console.log('✅ Workflow update published');
    console.log(`Subject: ${workflowSubject}`);

  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.drain();
      console.log('NATS connection closed');
    }
  }
}

publishCritique();
