#!/usr/bin/env ts-node

/**
 * NATS PUBLICATION SCRIPT
 *
 * Purpose: Publish Sylvia's architectural critique to NATS messaging system
 * Deliverable: SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1766689933757.md
 * Subject: agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1766689933757
 *
 * Usage: ts-node scripts/publish-sylvia-critique-REQ-STRATEGIC-AUTO-1766689933757.ts
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface SylviaCritiqueDeliverable {
  agent: 'sylvia';
  reqNumber: string;
  status: 'COMPLETE';
  deliverable: string;
  summary: string;
  timestamp: string;
  metadata: {
    overallScore: string;
    productionReady: boolean;
    criticalIssues: number;
    moderateIssues: number;
    recommendations: number;
    filesAnalyzed: number;
    linesOfCode: number;
  };
  content: string;
}

async function publishSylviaCritique() {
  const REQ_NUMBER = 'REQ-STRATEGIC-AUTO-1766689933757';
  const DELIVERABLE_FILE = path.join(
    __dirname,
    '..',
    `SYLVIA_CRITIQUE_DELIVERABLE_${REQ_NUMBER}.md`
  );
  const NATS_SUBJECT = `agog.deliverables.sylvia.critique.${REQ_NUMBER}`;

  console.log('📋 Sylvia Critique Publication');
  console.log('=' .repeat(60));
  console.log(`Request: ${REQ_NUMBER}`);
  console.log(`Feature: Vendor Scorecards`);
  console.log(`Subject: ${NATS_SUBJECT}`);
  console.log('');

  // Read deliverable file
  if (!fs.existsSync(DELIVERABLE_FILE)) {
    console.error(`❌ Error: Deliverable file not found at ${DELIVERABLE_FILE}`);
    process.exit(1);
  }

  const critiqueContent = fs.readFileSync(DELIVERABLE_FILE, 'utf-8');
  console.log(`✅ Loaded critique deliverable (${critiqueContent.length} bytes)`);

  // Create deliverable payload
  const deliverable: SylviaCritiqueDeliverable = {
    agent: 'sylvia',
    reqNumber: REQ_NUMBER,
    status: 'COMPLETE',
    deliverable: `nats://${NATS_SUBJECT}`,
    summary: 'Architectural critique complete: 8.5/10 - Production-ready with RBAC fixes. Identified 12 issues (0 critical, 5 moderate, 7 low) and 12 enhancement recommendations. Exceptional database design with 42 CHECK constraints, comprehensive multi-tenant security, and sophisticated tier classification. Critical path: Implement RBAC (2-3 days), add auth checks (1 day), integration tests (3-5 days). Deployment: APPROVE WITH CONDITIONS.',
    timestamp: new Date().toISOString(),
    metadata: {
      overallScore: '8.5/10',
      productionReady: true,
      criticalIssues: 0,
      moderateIssues: 5,
      recommendations: 12,
      filesAnalyzed: 20,
      linesOfCode: 4000
    },
    content: critiqueContent
  };

  try {
    // Connect to NATS with authentication
    console.log('🔌 Connecting to NATS server...');
    const nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4223',
      user: process.env.NATS_USER || 'agents',
      pass: process.env.NATS_PASSWORD
    });

    console.log('✅ Connected to NATS server');

    const sc = StringCodec();

    // Publish deliverable
    console.log(`📤 Publishing critique to ${NATS_SUBJECT}...`);
    nc.publish(NATS_SUBJECT, sc.encode(JSON.stringify(deliverable, null, 2)));

    // Also publish to general deliverables channel
    const GENERAL_SUBJECT = `agog.deliverables.${REQ_NUMBER}`;
    console.log(`📤 Publishing to general channel ${GENERAL_SUBJECT}...`);
    nc.publish(GENERAL_SUBJECT, sc.encode(JSON.stringify({
      agent: 'sylvia',
      reqNumber: REQ_NUMBER,
      deliverableType: 'CRITIQUE',
      subject: NATS_SUBJECT,
      timestamp: deliverable.timestamp,
      summary: deliverable.summary,
      metadata: deliverable.metadata
    }, null, 2)));

    // Flush to ensure messages are sent
    await nc.flush();

    console.log('✅ Critique published successfully');
    console.log('');
    console.log('📊 Deliverable Summary:');
    console.log(`   Overall Score: ${deliverable.metadata.overallScore}`);
    console.log(`   Production Ready: ${deliverable.metadata.productionReady ? 'YES (with RBAC fixes)' : 'NO'}`);
    console.log(`   Critical Issues: ${deliverable.metadata.criticalIssues}`);
    console.log(`   Moderate Issues: ${deliverable.metadata.moderateIssues}`);
    console.log(`   Recommendations: ${deliverable.metadata.recommendations}`);
    console.log(`   Files Analyzed: ${deliverable.metadata.filesAnalyzed}`);
    console.log(`   Lines of Code: ${deliverable.metadata.linesOfCode}+`);
    console.log('');
    console.log('🎯 Key Findings:');
    console.log('   ✅ Exceptional database design (42 CHECK constraints)');
    console.log('   ✅ Comprehensive multi-tenant security (RLS on all tables)');
    console.log('   ✅ Sophisticated tier classification with hysteresis');
    console.log('   ⚠️  Incomplete RBAC implementation (MUST FIX)');
    console.log('   ⚠️  Missing mutation auth checks (MUST FIX)');
    console.log('   📈 Integration tests needed for QA');
    console.log('');
    console.log('⏱️  Critical Path to Production: 1-2 weeks');
    console.log('   1. Implement RBAC (2-3 days)');
    console.log('   2. Add auth checks (1 day)');
    console.log('   3. Add tier index (1 hour)');
    console.log('   4. Integration tests (3-5 days)');

    // Close connection
    await nc.drain();
    console.log('');
    console.log('✅ NATS connection closed');
    console.log('🎉 Sylvia critique publication complete!');

  } catch (error) {
    console.error('❌ Error publishing to NATS:', error);
    process.exit(1);
  }
}

// Execute
publishSylviaCritique().catch(console.error);
