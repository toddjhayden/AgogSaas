#!/usr/bin/env ts-node

/**
 * Publish Sylvia Critique Deliverable to NATS
 * REQ-STRATEGIC-AUTO-1766704336590: Sales Quote Automation
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4223';
const NATS_USER = process.env.NATS_USER || 'agents';
const NATS_PASSWORD = process.env.NATS_PASSWORD || '';
const SUBJECT = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1766704336590';

async function publishCritique() {
  console.log('='.repeat(60));
  console.log('Sylvia Critique Deliverable Publisher');
  console.log('REQ-STRATEGIC-AUTO-1766704336590: Sales Quote Automation');
  console.log('='.repeat(60));

  // Read critique file
  const critiquePath = path.join(
    __dirname,
    '..',
    'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1766704336590.md'
  );

  console.log(`\n📄 Reading critique from: ${critiquePath}`);

  if (!fs.existsSync(critiquePath)) {
    console.error(`❌ Critique file not found: ${critiquePath}`);
    process.exit(1);
  }

  const critiqueContent = fs.readFileSync(critiquePath, 'utf-8');
  console.log(`✅ Critique loaded (${critiqueContent.length} characters)`);

  // Create deliverable payload
  const deliverable = {
    agent: 'sylvia',
    reqNumber: 'REQ-STRATEGIC-AUTO-1766704336590',
    featureTitle: 'Sales Quote Automation',
    deliverableType: 'CRITIQUE',
    timestamp: new Date().toISOString(),
    content: critiqueContent,
    metadata: {
      linesOfCode: {
        backend: 1886,
        graphql: 576,
        frontend: 1009,
        total: 3471
      },
      filesAnalyzed: {
        services: 4,
        interfaces: 3,
        resolvers: 1,
        schemas: 1,
        pages: 2,
        queries: 1,
        migrations: 2,
        scripts: 2,
        total: 16
      },
      assessment: {
        codeQuality: 'A',
        architecture: 'A',
        completeness: 'B',
        security: 'F',
        testing: 'F',
        documentation: 'C',
        productionReadiness: 'F'
      },
      criticalIssues: [
        'Resolver not registered in GraphQL server',
        'Frontend routes not registered in App.tsx',
        'Tenant isolation vulnerability (client-controlled tenant ID)',
        'No authorization checks',
        'Hard-coded tenant ID in frontend',
        'Minimal test coverage (<5%)'
      ],
      estimatedTimeToMVP: '2-3 days',
      estimatedTimeToProduction: '2-3 weeks'
    },
    summary: 'Comprehensive critique of Sales Quote Automation implementation. Found 90% complete with excellent architecture (1,886 lines of production-ready services), but currently non-functional due to integration gaps and insecure due to critical vulnerabilities. Requires resolver registration, route registration, and tenant isolation fixes to become functional.',
    nextSteps: [
      'Register QuoteAutomationResolver in GraphQL server (30 min)',
      'Register frontend routes in App.tsx (15 min)',
      'Fix tenant isolation security vulnerability (4 hours)',
      'Remove hard-coded tenant IDs from frontend (2 hours)',
      'Add basic authorization checks (2-3 days)',
      'Add comprehensive test coverage (1 week)'
    ]
  };

  console.log('\n📊 Deliverable Summary:');
  console.log(`   Agent: ${deliverable.agent}`);
  console.log(`   Requirement: ${deliverable.reqNumber}`);
  console.log(`   Feature: ${deliverable.featureTitle}`);
  console.log(`   Total LOC Analyzed: ${deliverable.metadata.linesOfCode.total}`);
  console.log(`   Files Analyzed: ${deliverable.metadata.filesAnalyzed.total}`);
  console.log(`   Production Readiness: ${deliverable.metadata.assessment.productionReadiness}`);
  console.log(`   Critical Issues: ${deliverable.metadata.criticalIssues.length}`);

  // Connect to NATS
  console.log(`\n🔌 Connecting to NATS: ${NATS_URL}`);
  console.log(`   User: ${NATS_USER}`);

  try {
    const nc = await connect({
      servers: NATS_URL,
      user: NATS_USER,
      pass: NATS_PASSWORD
    });
    console.log('✅ Connected to NATS');

    const sc = StringCodec();

    // Publish deliverable
    console.log(`\n📤 Publishing to subject: ${SUBJECT}`);
    nc.publish(SUBJECT, sc.encode(JSON.stringify(deliverable, null, 2)));

    console.log('✅ Critique deliverable published successfully');

    // Also publish completion notice
    const completionSubject = 'agog.requirements.status';
    const completionNotice = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1766704336590',
      stage: 'CRITIQUE',
      agent: 'sylvia',
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      deliverableUrl: `nats://${SUBJECT}`,
      summary: deliverable.summary
    };

    console.log(`\n📤 Publishing completion notice to: ${completionSubject}`);
    nc.publish(completionSubject, sc.encode(JSON.stringify(completionNotice, null, 2)));

    console.log('✅ Completion notice published');

    // Close connection
    await nc.drain();
    console.log('✅ NATS connection closed');

    console.log('\n' + '='.repeat(60));
    console.log('✅ PUBLISH COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📍 Deliverable URL:');
    console.log(`   nats://${SUBJECT}`);
    console.log('\n🎯 Next Stage:');
    console.log('   Implementation (marcus) - Fix integration gaps and security issues');
    console.log('\n⏱️  Time to MVP:');
    console.log(`   ${deliverable.metadata.estimatedTimeToMVP}`);

  } catch (error) {
    console.error('\n❌ Failed to publish to NATS:', error);
    process.exit(1);
  }
}

// Run publisher
publishCritique().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
