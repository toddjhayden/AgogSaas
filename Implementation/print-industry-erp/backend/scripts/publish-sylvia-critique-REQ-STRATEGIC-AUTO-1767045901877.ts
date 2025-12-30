/**
 * Publication script for Sylvia's critique deliverable
 * REQ-STRATEGIC-AUTO-1767045901877: Multi-Language Support Completion
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const NATS_SERVER = process.env.NATS_SERVER || 'nats://localhost:4222';
const DELIVERABLE_FILE = path.join(
  __dirname,
  '../SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767045901877.md'
);

async function publishSylviaCritique() {
  console.log('📤 Publishing Sylvia Critique to NATS...');
  console.log(`📄 File: ${DELIVERABLE_FILE}`);

  // Read the deliverable file
  const deliverableContent = fs.readFileSync(DELIVERABLE_FILE, 'utf-8');

  // Connect to NATS
  const nc = await connect({ servers: NATS_SERVER });
  const sc = StringCodec();

  console.log(`✅ Connected to NATS server: ${NATS_SERVER}`);

  // Create the payload
  const payload = {
    agent: 'sylvia',
    reqNumber: 'REQ-STRATEGIC-AUTO-1767045901877',
    featureTitle: 'Multi-Language Support Completion',
    status: 'COMPLETE',
    deliverableType: 'CRITIQUE',
    timestamp: new Date().toISOString(),
    content: deliverableContent,
    metadata: {
      assignedTo: 'marcus',
      previousStages: [
        {
          stage: 'Research',
          agent: 'cynthia',
          deliverableUrl:
            'nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767045901877',
        },
      ],
      assessment: {
        overallScore: 65,
        productionReady: false,
        criticalGaps: [
          '60% missing Chinese translations (346 keys)',
          'No backend localization',
          'Language preference not synced to backend',
          'No translation validation in CI/CD',
        ],
        strengths: [
          'Excellent frontend i18n architecture',
          'Complete component integration',
          'Functional language switcher',
          'Database schema ready',
        ],
        recommendation: 'NOT PRODUCTION-READY - Complete Phase 1 translations before deployment',
        estimatedTimeToReady: '4-5 weeks',
        estimatedCost: '$1,000 + 90 hours development',
      },
      wordCount: deliverableContent.split(/\s+/).length,
      keyFindings: {
        translationCoverage: {
          english: 558,
          chinese: 212,
          missing: 346,
          coveragePercent: 40,
        },
        componentIntegration: {
          status: 'EXCELLENT',
          score: 95,
          componentsUsing118n: 34,
        },
        backendSupport: {
          status: 'INCOMPLETE',
          score: 40,
          schemaReady: true,
          localizationImplemented: false,
        },
        criticalBugs: [
          {
            severity: 'HIGH',
            title: 'Language Preference Not Synced to Backend',
            impact: 'Users lose preference across devices',
          },
          {
            severity: 'MEDIUM',
            title: 'Missing Translation Keys Cause Silent Failures',
            impact: 'Users see developer key names',
          },
          {
            severity: 'LOW',
            title: 'Hardcoded English in Mock Data',
            impact: 'Mixed language in some dashboards',
          },
        ],
      },
    },
  };

  // Publish to multiple subjects
  const subjects = [
    'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901877',
    'agog.deliverables.sylvia.all',
    'agog.deliverables.all',
    'agog.workflow.critique.complete',
  ];

  for (const subject of subjects) {
    nc.publish(subject, sc.encode(JSON.stringify(payload)));
    console.log(`✅ Published to: ${subject}`);
  }

  // Drain and close
  await nc.drain();
  console.log('✅ Publication complete!');
  console.log('\n📊 Summary:');
  console.log(`   Overall Score: 65/100`);
  console.log(`   Production Ready: ❌ NO`);
  console.log(`   Missing Translations: 346 keys (60%)`);
  console.log(`   Critical Bugs: 3`);
  console.log(`   Time to Ready: 4-5 weeks`);
  console.log(`   Estimated Cost: $1,000 + 90 hours`);
  console.log('\n🎯 Next Steps:');
  console.log('   1. Complete 346 missing Chinese translations');
  console.log('   2. Fix language preference backend sync bug');
  console.log('   3. Add translation validation to CI/CD');
  console.log('   4. Implement backend error localization');
}

// Execute
publishSylviaCritique()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error publishing critique:', error);
    process.exit(1);
  });
