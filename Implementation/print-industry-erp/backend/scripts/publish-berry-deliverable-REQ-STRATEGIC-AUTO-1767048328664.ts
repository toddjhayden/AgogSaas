#!/usr/bin/env ts-node

/**
 * NATS Publishing Script - Berry DevOps Deliverable
 * REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
 *
 * Purpose: Publish Berry's DevOps assessment to NATS for workflow coordination
 * Status: DEPLOYMENT BLOCKED - CRITICAL ISSUES FOUND
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

interface BerryDeliverable {
  agent: 'berry';
  reqNumber: string;
  timestamp: string;
  status: 'DEPLOYMENT_BLOCKED';
  deploymentDecision: 'DO_NOT_DEPLOY';
  criticalBlockers: string[];
  estimatedFixTime: string;
  filesReviewed: string[];
  deploymentReadiness: {
    database: { status: 'READY'; details: string };
    backend: { status: 'BLOCKED'; blockers: string[] };
    frontend: { status: 'BLOCKED'; blockers: string[] };
    devops: { status: 'READY'; details: string };
  };
  nextActions: Array<{
    agent: string;
    action: string;
    estimatedHours: string;
  }>;
  deliverableMarkdown: string;
  summary: string;
}

async function publishBerryDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    console.log('🚀 Connecting to NATS...');

    // Connect to NATS server
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      maxReconnectAttempts: 3,
      reconnectTimeWait: 1000,
    });

    console.log('✅ Connected to NATS');

    // Read the deliverable markdown
    const deliverablePath = path.join(
      __dirname,
      '..',
      'BERRY_DEVOPS_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328664.md'
    );

    if (!fs.existsSync(deliverablePath)) {
      throw new Error(`Deliverable file not found: ${deliverablePath}`);
    }

    const deliverableMarkdown = fs.readFileSync(deliverablePath, 'utf-8');

    // Build the deliverable payload
    const deliverable: BerryDeliverable = {
      agent: 'berry',
      reqNumber: 'REQ-STRATEGIC-AUTO-1767048328664',
      timestamp: new Date().toISOString(),
      status: 'DEPLOYMENT_BLOCKED',
      deploymentDecision: 'DO_NOT_DEPLOY',

      criticalBlockers: [
        'Missing 4 backend service files (spc-data-collection, spc-control-chart, spc-capability-analysis, spc-alerting)',
        'Missing 100% of i18n translations (~50 SPC keys in en-US and zh-CN)',
        'Missing 7 GraphQL resolvers (including critical spcDashboardSummary)',
        'Missing tenant context injection (RLS will fail)',
      ],

      estimatedFixTime: '3-4 business days (18-26 development hours)',

      filesReviewed: [
        'V0.0.44__create_spc_tables.sql (521 lines)',
        'deploy-spc.sh (159 lines)',
        'health-check-spc.sh (192 lines)',
        'BILLY_QA_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328664.md',
        'ROY_BACKEND_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328664.md',
        'CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328664.md',
      ],

      deploymentReadiness: {
        database: {
          status: 'READY',
          details: '5 tables with partitioning, RLS policies, 23 indexes - production-ready schema',
        },
        backend: {
          status: 'BLOCKED',
          blockers: [
            '4 missing service files (80% of service layer)',
            '7 missing GraphQL resolvers (41% of API)',
            'No tenant context injection',
          ],
        },
        frontend: {
          status: 'BLOCKED',
          blockers: [
            '100% of i18n translations missing',
            'UI will display raw translation keys',
          ],
        },
        devops: {
          status: 'READY',
          details: 'Deployment scripts complete, health checks ready, rollback plan documented',
        },
      },

      nextActions: [
        {
          agent: 'Roy',
          action: 'Implement 4 missing backend services',
          estimatedHours: '8-12 hours',
        },
        {
          agent: 'Roy',
          action: 'Complete 7 missing GraphQL resolvers',
          estimatedHours: '6-8 hours',
        },
        {
          agent: 'Roy',
          action: 'Add tenant context middleware',
          estimatedHours: '2-3 hours',
        },
        {
          agent: 'Jen',
          action: 'Add all SPC i18n translations',
          estimatedHours: '2-3 hours',
        },
        {
          agent: 'Billy',
          action: 'Re-test after fixes completed',
          estimatedHours: '4-6 hours',
        },
        {
          agent: 'Berry',
          action: 'Deploy to staging (after fixes approved)',
          estimatedHours: '2-3 hours',
        },
      ],

      deliverableMarkdown,

      summary: `
🔴 DEPLOYMENT BLOCKED - CRITICAL ISSUES FOUND

Berry has completed the DevOps assessment for the SPC feature and determined that deployment is NOT POSSIBLE in the current state.

Critical Findings:
- ✅ Database schema is EXCELLENT and ready (V0.0.44 with partitioning, RLS, 23 indexes)
- ✅ Deployment scripts are COMPLETE and tested
- ❌ Backend has 4 MISSING service files - application will NOT START
- ❌ Frontend has 100% MISSING translations - UI will be BROKEN
- ❌ GraphQL API has 7 MISSING resolvers - Dashboard will NOT LOAD
- ❌ Tenant context injection MISSING - RLS will FAIL

Recommendation: DO NOT DEPLOY until Roy implements missing services and Jen adds i18n translations.

Foundation Quality: ⭐⭐⭐⭐⭐ (Excellent architectural design)
Implementation Completeness: ⭐⭐ (40% complete)
Deployment Readiness: ⭐ (20% ready)

Estimated time to deployment-ready: 3-4 business days.

The foundation is excellent - we just need to finish building the house.
      `.trim(),
    };

    // Publish to multiple NATS subjects for workflow coordination
    const subjects = [
      'agog.deliverables.berry.devops.REQ-STRATEGIC-AUTO-1767048328664',
      'agog.deployment.blocked.REQ-STRATEGIC-AUTO-1767048328664',
      'agog.workflow.blocker.REQ-STRATEGIC-AUTO-1767048328664',
    ];

    console.log('\n📤 Publishing Berry DevOps deliverable...\n');

    for (const subject of subjects) {
      nc.publish(subject, sc.encode(JSON.stringify(deliverable, null, 2)));
      console.log(`  ✅ Published to: ${subject}`);
    }

    // Wait for messages to flush
    await nc.flush();

    console.log('\n✅ Berry DevOps deliverable published successfully!\n');
    console.log('📋 Deliverable Summary:');
    console.log(`   Agent: Berry (DevOps)`);
    console.log(`   Requirement: REQ-STRATEGIC-AUTO-1767048328664`);
    console.log(`   Status: 🔴 DEPLOYMENT BLOCKED`);
    console.log(`   Decision: DO NOT DEPLOY`);
    console.log(`   Critical Blockers: ${deliverable.criticalBlockers.length}`);
    console.log(`   Estimated Fix Time: ${deliverable.estimatedFixTime}`);
    console.log(`   Files Reviewed: ${deliverable.filesReviewed.length}`);
    console.log('\n📍 Deployment Readiness:');
    console.log(`   Database: ✅ ${deliverable.deploymentReadiness.database.status}`);
    console.log(`   Backend: ❌ ${deliverable.deploymentReadiness.backend.status}`);
    console.log(`   Frontend: ❌ ${deliverable.deploymentReadiness.frontend.status}`);
    console.log(`   DevOps: ✅ ${deliverable.deploymentReadiness.devops.status}`);
    console.log('\n🔄 Next Actions:');
    deliverable.nextActions.forEach((action, idx) => {
      console.log(`   ${idx + 1}. ${action.agent}: ${action.action} (${action.estimatedHours})`);
    });
    console.log('\n📄 Full deliverable: BERRY_DEVOPS_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328664.md\n');

  } catch (error) {
    console.error('❌ Error publishing Berry deliverable:', error);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.close();
      console.log('🔌 NATS connection closed');
    }
  }
}

// Execute if run directly
if (require.main === module) {
  publishBerryDeliverable()
    .then(() => {
      console.log('\n✅ Publication complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Publication failed:', error);
      process.exit(1);
    });
}

export { publishBerryDeliverable, BerryDeliverable };
