import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

async function publishCritique() {
  console.log('📤 Publishing Sylvia Critique to NATS...');

  try {
    // Connect to NATS
    const nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222'
    });
    console.log('✅ Connected to NATS');

    const sc = StringCodec();

    // Read the critique deliverable
    const deliverablePath = path.join(
      __dirname,
      '..',
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1735400400000.md'
    );
    const critiqueContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Prepare the message
    const message = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1735400400000',
      agent: 'sylvia',
      stage: 'critique',
      featureTitle: 'Vendor Scorecards',
      deliverableContent: critiqueContent,
      summary: 'Critical code review identifying 12 issues (4 Critical, 5 High, 3 Medium). Production readiness: NOT READY. Critical issues include SQL injection vulnerability, missing transaction rollback, hardcoded default scores, and unreliable quality metric calculation. Cynthia\'s research graded 85% accurate. Estimated 3-5 days remediation work required before production launch.',
      issueCount: {
        critical: 4,
        high: 5,
        medium: 3,
        low: 0,
        total: 12
      },
      productionReadiness: 'NOT_READY',
      researchGrade: '85%',
      implementationGrade: '6.5/10',
      estimatedRemediationDays: '3-5',
      blockingIssuesCount: 9,
      publishedAt: new Date().toISOString(),
      publishedBy: 'sylvia'
    };

    // Publish to NATS
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1735400400000';
    nc.publish(subject, sc.encode(JSON.stringify(message)));

    console.log(`✅ Published to subject: ${subject}`);
    console.log('📊 Message Summary:');
    console.log(`   - Total Issues: 12`);
    console.log(`   - Critical: 4`);
    console.log(`   - High: 5`);
    console.log(`   - Medium: 3`);
    console.log(`   - Production Ready: NOT READY`);
    console.log(`   - Cynthia's Research Accuracy: 85%`);
    console.log(`   - Implementation Grade: 6.5/10`);
    console.log(`   - Blocking Issues: 9`);
    console.log(`   - Remediation Timeline: 3-5 days`);

    // Close connection
    await nc.drain();
    console.log('✅ NATS connection closed');
    console.log('🎉 Sylvia Critique published successfully!');

  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    process.exit(1);
  }
}

publishCritique();
