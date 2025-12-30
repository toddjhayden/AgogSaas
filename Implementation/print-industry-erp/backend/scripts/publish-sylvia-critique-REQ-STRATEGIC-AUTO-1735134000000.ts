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
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1735134000000.md'
    );
    const critiqueContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Prepare the message
    const message = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1735134000000',
      agent: 'sylvia',
      stage: 'critique',
      featureTitle: 'PO Approval Workflow',
      deliverableContent: critiqueContent,
      summary: 'Strategic critique identifying 22 issues (5 Critical, 7 High, 6 Medium, 4 Low). Current implementation NOT production-ready due to critical security vulnerabilities. Cynthia\'s research graded A+. Recommended 8-week remediation roadmap provided.',
      issueCount: {
        critical: 5,
        high: 7,
        medium: 6,
        low: 4,
        total: 22
      },
      productionReadiness: 'NOT_READY',
      researchGrade: 'A+',
      implementationGrade: 'D+',
      estimatedRemediationWeeks: 8,
      publishedAt: new Date().toISOString(),
      publishedBy: 'sylvia'
    };

    // Publish to NATS
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1735134000000';
    nc.publish(subject, sc.encode(JSON.stringify(message)));

    console.log(`✅ Published to subject: ${subject}`);
    console.log('📊 Message Summary:');
    console.log(`   - Total Issues: 22`);
    console.log(`   - Critical: 5`);
    console.log(`   - High: 7`);
    console.log(`   - Medium: 6`);
    console.log(`   - Low: 4`);
    console.log(`   - Production Ready: NOT READY`);
    console.log(`   - Cynthia's Research Grade: A+`);
    console.log(`   - Implementation Grade: D+`);
    console.log(`   - Remediation Timeline: 8 weeks`);

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
