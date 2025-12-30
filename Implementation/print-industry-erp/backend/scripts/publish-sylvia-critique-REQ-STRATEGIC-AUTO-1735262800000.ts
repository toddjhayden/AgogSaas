#!/usr/bin/env ts-node
/**
 * NATS Publisher Script - Sylvia's Architectural Critique
 * Requirement: REQ-STRATEGIC-AUTO-1735262800000 - Vendor Scorecards
 * Agent: Sylvia (Technical Architect)
 * Date: 2025-12-27
 *
 * Purpose: Publish architectural critique deliverable to NATS for strategic orchestrator
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

async function publishSylviaCritique() {
  let nc: NatsConnection | null = null;

  try {
    console.log('📡 Connecting to NATS server...');

    // Connect to NATS
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4223',
      timeout: 10000,
      user: process.env.NATS_USER || 'agog_agent',
      pass: process.env.NATS_PASSWORD || 'agog_agent_secret_2024',
    });

    console.log('✅ Connected to NATS server');

    // Read critique deliverable
    const deliverablePath = path.join(
      __dirname,
      '..',
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1735262800000.md'
    );

    console.log(`📄 Reading critique from: ${deliverablePath}`);

    if (!fs.existsSync(deliverablePath)) {
      throw new Error(`Critique file not found: ${deliverablePath}`);
    }

    const critiqueContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Prepare deliverable payload
    const deliverable = {
      agent: 'sylvia',
      agentRole: 'technical_architect',
      reqNumber: 'REQ-STRATEGIC-AUTO-1735262800000',
      featureTitle: 'Vendor Scorecards',
      deliverableType: 'CRITIQUE',
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      summary: 'Architectural critique completed. Overall assessment: B+ (85/100). Identified 10 issues (3 CRITICAL, 3 HIGH, 4 MEDIUM). Implementation is functionally complete but requires architectural refinement before production. Critical blockers: missing authentication on 12 GraphQL endpoints, hardcoded placeholder metrics, no automated alert generation. Estimated 3-5 weeks to production-ready state.',
      content: critiqueContent,
      metadata: {
        overallScore: 85,
        grade: 'B+',
        productionReady: false,
        criticalIssues: 3,
        highSeverityIssues: 3,
        mediumSeverityIssues: 4,
        estimatedEffortWeeks: '3-5 weeks',
        keyStrengths: [
          'Solid database schema design with comprehensive constraints',
          'Clean separation of concerns (DB → Service → GraphQL → Frontend)',
          'Multi-tenant security properly implemented at database level',
          'Good performance optimization with strategic indexes',
          'Comprehensive type system and documentation'
        ],
        criticalBlockers: [
          'Missing authentication on 12 GraphQL resolvers',
          'Hardcoded placeholder values (priceCompetitivenessScore, responsivenessScore)',
          'No automated alert generation logic implemented'
        ],
        recommendedActions: [
          'Add authentication to all GraphQL resolvers (2-3 hours)',
          'Implement alert generation trigger (4-6 hours)',
          'Add missing foreign key constraints (1 hour)',
          'Replace placeholder metrics with actual calculations (2-3 weeks)',
          'Fix hardcoded tenant ID in frontend (4-8 hours)'
        ]
      }
    };

    // Publish to multiple subjects for different consumption patterns
    const subjects = [
      'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1735262800000',
      'agog.deliverables.sylvia.critique',
      'agog.deliverables.critique.REQ-STRATEGIC-AUTO-1735262800000',
      'agog.workflow.critique-completed'
    ];

    console.log('📤 Publishing critique to NATS subjects...');

    for (const subject of subjects) {
      nc.publish(subject, sc.encode(JSON.stringify(deliverable)));
      console.log(`  ✅ Published to: ${subject}`);
    }

    // Wait for messages to flush
    await nc.flush();

    console.log('\n✨ Sylvia\'s critique successfully published!');
    console.log('\n📊 Deliverable Summary:');
    console.log(`   Requirement: ${deliverable.reqNumber}`);
    console.log(`   Feature: ${deliverable.featureTitle}`);
    console.log(`   Overall Score: ${deliverable.metadata.overallScore}/100 (${deliverable.metadata.grade})`);
    console.log(`   Production Ready: ${deliverable.metadata.productionReady ? 'YES' : 'NO'}`);
    console.log(`   Critical Issues: ${deliverable.metadata.criticalIssues}`);
    console.log(`   High Severity Issues: ${deliverable.metadata.highSeverityIssues}`);
    console.log(`   Medium Severity Issues: ${deliverable.metadata.mediumSeverityIssues}`);
    console.log(`   Estimated Effort: ${deliverable.metadata.estimatedEffortWeeks}`);
    console.log('\n🎯 Key Findings:');
    console.log('   CRITICAL: Missing authentication on GraphQL resolvers');
    console.log('   CRITICAL: Hardcoded placeholder metrics undermining real data');
    console.log('   CRITICAL: No automated alert generation');
    console.log('\n📋 Next Steps:');
    console.log('   1. Marcus to review critique and prioritize fixes');
    console.log('   2. Implement critical security fixes (authentication)');
    console.log('   3. Complete metric calculation implementations');
    console.log('   4. Add alert generation trigger');
    console.log('   5. Re-test after fixes applied');

  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    process.exit(1);
  } finally {
    // Close connection
    if (nc) {
      await nc.drain();
      console.log('\n🔌 Disconnected from NATS');
    }
  }
}

// Execute
publishSylviaCritique()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
