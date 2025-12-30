#!/usr/bin/env ts-node
/**
 * NATS Publisher - Sylvia Critique Deliverable
 *
 * Feature: Vendor Scorecards
 * REQ: REQ-STRATEGIC-AUTO-1735249636000
 * Agent: Sylvia (Architecture Critique & Gate)
 * Channel: agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1735249636000
 *
 * This script publishes Sylvia's architecture critique report to NATS
 * for consumption by the orchestrator and other agents.
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs/promises';
import * as path from 'path';

const NATS_SERVER = process.env.NATS_SERVER || 'nats://localhost:4222';
const CHANNEL = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1735249636000';
const DELIVERABLE_FILE = path.join(
  __dirname,
  '../SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1735249636000.md'
);

interface SylviaCritiqueDeliverable {
  agent: 'sylvia';
  reqNumber: string;
  status: 'COMPLETE';
  deliverable: string;
  summary: string;
  critiqueVerdict: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED';
  issuesFound: number;
  requiredFixes?: string[];
  blockers?: string[];
  nextAgent: string | null;
  timestamp: string;
  fullReport: string;
  metadata: {
    feature: string;
    complianceScore: number;
    databaseStandardsScore: number;
    securityScore: number;
    architectureScore: number;
    featureCompletenessScore: number;
  };
}

async function publishSylviaCritique(): Promise<void> {
  let nc: NatsConnection | null = null;

  try {
    console.log('📡 Connecting to NATS server:', NATS_SERVER);
    nc = await connect({ servers: NATS_SERVER });
    console.log('✅ Connected to NATS');

    console.log('📖 Reading critique deliverable from:', DELIVERABLE_FILE);
    const fullReport = await fs.readFile(DELIVERABLE_FILE, 'utf-8');
    console.log(`✅ Read ${fullReport.length} characters`);

    const deliverable: SylviaCritiqueDeliverable = {
      agent: 'sylvia',
      reqNumber: 'REQ-STRATEGIC-AUTO-1735249636000',
      status: 'COMPLETE',
      deliverable: `nats://${CHANNEL}`,
      summary:
        '✅ APPROVED WITH CONDITIONS. Vendor Scorecard implementation demonstrates excellent AGOG standards compliance (93/100). All tables use uuid_generate_v7(), proper tenant_id isolation, and RLS policies. 3 minor issues require fixes before production: (1) Missing authentication on dismissAlert mutation (HIGH), (2) Permission validation not implemented (MEDIUM), (3) Migration conflict on alerts table (LOW). Core architecture is production-ready.',
      critiqueVerdict: 'APPROVED_WITH_CONDITIONS',
      issuesFound: 3,
      requiredFixes: [
        'Add authentication to dismissAlert mutation (vendor-performance.resolver.ts:569-590)',
        'Implement permission validation system (vendor-performance.resolver.ts:53-61)',
        'Resolve migration conflict for vendor_performance_alerts table (V0.0.26 vs V0.0.31)',
      ],
      nextAgent: 'roy',
      timestamp: new Date().toISOString(),
      fullReport,
      metadata: {
        feature: 'Vendor Scorecards',
        complianceScore: 93,
        databaseStandardsScore: 100,
        securityScore: 95,
        architectureScore: 98,
        featureCompletenessScore: 100,
      },
    };

    const sc = StringCodec();
    const payload = sc.encode(JSON.stringify(deliverable, null, 2));

    console.log('📤 Publishing to channel:', CHANNEL);
    console.log('📊 Critique verdict:', deliverable.critiqueVerdict);
    console.log('🔍 Issues found:', deliverable.issuesFound);
    console.log('📈 Compliance score:', deliverable.metadata.complianceScore);

    nc.publish(CHANNEL, payload);
    await nc.flush();

    console.log('✅ Successfully published Sylvia critique deliverable');
    console.log('');
    console.log('Summary:', deliverable.summary);
    console.log('');
    console.log('Required Fixes:');
    deliverable.requiredFixes?.forEach((fix, i) => {
      console.log(`  ${i + 1}. ${fix}`);
    });
    console.log('');
    console.log('Next agent:', deliverable.nextAgent);
  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    throw error;
  } finally {
    if (nc) {
      console.log('🔌 Closing NATS connection');
      await nc.close();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  publishSylviaCritique()
    .then(() => {
      console.log('✨ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { publishSylviaCritique };
