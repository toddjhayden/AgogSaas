#!/usr/bin/env ts-node

/**
 * Publish Sylvia's Critique Deliverable to NATS
 * REQ-STRATEGIC-AUTO-1767048328659: Customer Portal & Self-Service Ordering
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

async function publishSylviaCritique() {
  console.log('📤 Publishing Sylvia Critique Deliverable to NATS...\n');

  const deliverablePath = path.join(
    __dirname,
    '..',
    'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328659.md'
  );

  const deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');

  const payload = {
    agent: 'sylvia',
    reqNumber: 'REQ-STRATEGIC-AUTO-1767048328659',
    status: 'COMPLETE',
    deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767048328659',
    summary: 'Architecture Critique: Customer Portal & Self-Service Ordering - APPROVE with modifications (399% ROI, enhanced security, phased rollout)',
    content: deliverableContent,
    metadata: {
      researchReviewed: 'CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328659.md',
      overallGrade: '5/5',
      recommendation: 'APPROVE_WITH_MODIFICATIONS',
      criticalIssues: [
        'GraphQL playground enabled in production (CRITICAL)',
        'Customer session timeout too long (24h → 4h recommended)',
        'Missing infrastructure components (email, file storage, payment)',
        'Timeline underestimated by ~60%'
      ],
      revisedTimeline: '14-16 weeks (vs 10-12 weeks original)',
      revisedBudget: '$47,100 development + $870/year infrastructure',
      roi: '399% first-year ROI',
      paybackPeriod: '3.0 months',
      securityEnhancements: [
        'Disable GraphQL playground in production',
        'Implement query complexity limiting (max 1000)',
        'Add helmet security headers with CSP',
        'Shorten customer session timeout to 4 hours',
        'Reduce refresh token TTL to 14 days',
        'Implement rate limiting per customer',
        'Require penetration testing before launch'
      ],
      architecturalRecommendations: [
        'Proceed with dual authentication realms (approved)',
        'Implement shared authentication utilities to reduce duplication',
        'Add email service architecture (SendGrid recommended)',
        'Add file upload architecture (S3 presigned URLs + ClamAV virus scanning)',
        'Add payment gateway integration (Stripe tokenization)',
        'Implement phased rollout with 10 pilot customers',
        'Add GraphQL query complexity analysis',
        'Implement GDPR compliance features (data export, account deletion)'
      ],
      alternativesConsidered: [
        'Third-party SaaS portal (rejected - vendor lock-in, poor fit)',
        'Simplified MVP approach (recommended as risk mitigation)',
        'Hybrid chat-based ordering (interesting but insufficient)'
      ],
      keySuccessFactors: [
        'Executive sponsorship and adequate budget',
        'Cross-functional team (Roy, Jen, Billy, Marcus)',
        'Phased rollout with pilot customers',
        'Security-first approach from day one',
        'Rigorous KPI monitoring post-launch'
      ],
      createdAt: new Date().toISOString(),
      createdBy: 'sylvia'
    }
  };

  try {
    // Connect to NATS
    const nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222'
    });

    console.log('✅ Connected to NATS');

    const sc = StringCodec();

    // Publish to strategic workflow stream
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767048328659';
    await nc.publish(subject, sc.encode(JSON.stringify(payload)));

    console.log(`✅ Published to: ${subject}`);
    console.log(`📊 Deliverable Summary:`);
    console.log(`   - Agent: ${payload.agent}`);
    console.log(`   - Requirement: ${payload.reqNumber}`);
    console.log(`   - Status: ${payload.status}`);
    console.log(`   - Overall Grade: ${payload.metadata.overallGrade}`);
    console.log(`   - Recommendation: ${payload.metadata.recommendation}`);
    console.log(`   - ROI: ${payload.metadata.roi}`);
    console.log(`   - Payback Period: ${payload.metadata.paybackPeriod}`);
    console.log(`   - Critical Issues: ${payload.metadata.criticalIssues.length}`);
    console.log(`   - Security Enhancements: ${payload.metadata.securityEnhancements.length}`);
    console.log(`   - Architectural Recommendations: ${payload.metadata.architecturalRecommendations.length}`);
    console.log(`\n✨ Deliverable published successfully!`);

    await nc.drain();
    await nc.close();

  } catch (error) {
    console.error('❌ Error publishing deliverable:', error);
    process.exit(1);
  }
}

publishSylviaCritique().catch(console.error);
