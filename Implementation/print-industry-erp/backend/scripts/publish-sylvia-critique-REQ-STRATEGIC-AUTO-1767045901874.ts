#!/usr/bin/env ts-node
/**
 * NATS Publication Script for Sylvia Critique Deliverable
 * REQ-STRATEGIC-AUTO-1767045901874: Deployment Health Verification & Smoke Tests
 *
 * Publishes Sylvia's architectural critique to NATS for agent workflow consumption
 *
 * Author: Sylvia (Architecture Critic)
 * Date: 2025-12-29
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

interface DeliverablePayload {
  reqNumber: string;
  agent: string;
  deliverableType: string;
  timestamp: string;
  status: string;
  content: string;
  metadata: {
    wordCount: number;
    sections: number;
    criticalIssues: number;
    recommendations: number;
    priority1Count: number;
    priority2Count: number;
    priority3Count: number;
  };
}

async function publishDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   NATS Publication: Sylvia Critique Deliverable              ║');
    console.log('║   REQ-STRATEGIC-AUTO-1767045901874                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // Connect to NATS
    const natsPassword = process.env.NATS_PASSWORD;
    if (!natsPassword) {
      throw new Error('NATS_PASSWORD environment variable is required');
    }
    console.log('📡 Connecting to NATS...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      user: process.env.NATS_USER || 'agents',
      pass: natsPassword,
    });
    console.log('✅ Connected to NATS\n');

    // Read deliverable content
    const deliverablePath = path.join(__dirname, '..', 'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767045901874.md');
    console.log(`📄 Reading deliverable: ${path.basename(deliverablePath)}`);

    if (!fs.existsSync(deliverablePath)) {
      throw new Error(`Deliverable file not found: ${deliverablePath}`);
    }

    const content = fs.readFileSync(deliverablePath, 'utf-8');
    console.log(`✅ Deliverable loaded (${content.length} characters)\n`);

    // Calculate metadata
    const wordCount = content.split(/\s+/).length;
    const sections = (content.match(/^##\s/gm) || []).length;
    const criticalIssues = (content.match(/CRITICAL/gi) || []).length;
    const recommendations = (content.match(/Recommended Architecture/gi) || []).length;

    // Count priority recommendations
    const priority1Count = 3; // Centralized Health, Smoke Tests, Readiness/Liveness
    const priority2Count = 2; // CI/CD, Unified Verification
    const priority3Count = 2; // Pre-Deployment Validation, Integration Tests

    // Create payload
    const payload: DeliverablePayload = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1767045901874',
      agent: 'sylvia',
      deliverableType: 'critique',
      timestamp: new Date().toISOString(),
      status: 'COMPLETE',
      content,
      metadata: {
        wordCount,
        sections,
        criticalIssues,
        recommendations,
        priority1Count,
        priority2Count,
        priority3Count,
      },
    };

    // Publish to multiple NATS subjects
    const subjects = [
      'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901874',
      'agog.deliverables.sylvia.critique',
      'agog.deliverables.all',
      'agog.requirements.REQ-STRATEGIC-AUTO-1767045901874.critique',
    ];

    console.log('📤 Publishing to NATS subjects:');
    for (const subject of subjects) {
      nc.publish(subject, sc.encode(JSON.stringify(payload)));
      console.log(`   ✓ ${subject}`);
    }

    console.log('\n📊 Deliverable Metadata:');
    console.log(`   Word Count: ${wordCount.toLocaleString()}`);
    console.log(`   Sections: ${sections}`);
    console.log(`   Critical Issues: ${criticalIssues}`);
    console.log(`   Recommendations: ${recommendations}`);
    console.log(`   Priority 1 (CRITICAL): ${priority1Count}`);
    console.log(`   Priority 2 (HIGH): ${priority2Count}`);
    console.log(`   Priority 3 (MEDIUM): ${priority3Count}`);

    // Flush to ensure messages are sent
    await nc.flush();
    console.log('\n✅ All messages published successfully');

    // Close connection
    await nc.close();
    console.log('✅ NATS connection closed\n');

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ PUBLICATION COMPLETE                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('🔗 Deliverable URL:');
    console.log('   nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767045901874\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Publication failed:', error);

    if (nc) {
      await nc.close();
    }

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  publishDeliverable();
}

export default publishDeliverable;
