#!/usr/bin/env tsx

/**
 * Publish Sylvia's Architecture Critique to NATS
 * REQ-DATABASE-WMS-1766892755200 - Fix Missing WMS Database Tables
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4223';
const NATS_USER = process.env.NATS_USER || 'agents';
const NATS_PASSWORD = process.env.NATS_PASSWORD || 'WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4';

interface SylviaCritique {
  agent: 'sylvia';
  reqNumber: string;
  status: 'COMPLETE';
  deliverable: string;
  timestamp: string;
  summary: string;
  critiqueDocument: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedApproach: string;
  estimatedEffort: string;
  criticalFindings: string[];
  architecturalRecommendations: string[];
  implementationPlan: {
    phase: number;
    name: string;
    tasks: string[];
    estimatedTime: string;
  }[];
}

async function publishCritique() {
  let nc: NatsConnection | null = null;

  try {
    console.log('📡 Connecting to NATS...');
    console.log(`   URL: ${NATS_URL}`);

    nc = await connect({
      servers: NATS_URL,
      user: NATS_USER,
      pass: NATS_PASSWORD,
      timeout: 10000,
    });

    console.log('✅ Connected to NATS');

    // Read the critique deliverable
    const deliverableFile = path.join(
      __dirname,
      '..',
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-DATABASE-WMS-1766892755200.md'
    );

    console.log(`📖 Reading critique from: ${deliverableFile}`);

    if (!fs.existsSync(deliverableFile)) {
      throw new Error(`Deliverable file not found: ${deliverableFile}`);
    }

    const critiqueDocument = fs.readFileSync(deliverableFile, 'utf-8');

    const critique: SylviaCritique = {
      agent: 'sylvia',
      reqNumber: 'REQ-DATABASE-WMS-1766892755200',
      status: 'COMPLETE',
      deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-DATABASE-WMS-1766892755200',
      timestamp: new Date().toISOString(),
      summary: 'Critical architecture critique of WMS database migration failure. Cynthia\'s analysis was accurate but recommendations dangerous. DO NOT reset database (94 production tables). Provided safe migration script with backup/validation. Identified root cause: lack of migration orchestration, not Docker volumes.',
      critiqueDocument,
      severity: 'HIGH',
      recommendedApproach: 'Phase 1: Safe migration execution with backup (2 hours). Phase 2: Implement Flyway/Liquibase for proper migration tracking (2-3 days). Phase 3: Process improvements and monitoring (1 week).',
      estimatedEffort: 'Phase 1: 2 hours, Phase 2: 2-3 days, Phase 3: 1 week',
      criticalFindings: [
        'Cynthia recommended database reset - DANGEROUS for system with 94 production tables',
        'Database name mismatch: migrations target "agog_erp", actual database is "agogsaas"',
        'No migration tracking system (Flyway/Liquibase) - migrations are hope-and-pray',
        'Migrations not idempotent - partial failures cause cascading errors',
        'No transaction boundaries - database can end up in unknown state',
        'Unsafe materialized view creation - no data quality validation before refresh',
        'Only 1 of 21 enhancement tables created (ml_model_weights) - partial migration failure',
        'No backup strategy before migrations - data loss risk'
      ],
      architecturalRecommendations: [
        'Implement Flyway or Liquibase for proper migration versioning and tracking',
        'Add pre-flight dependency checks to every migration',
        'Add post-migration validation to verify success',
        'Separate migration types: baseline, versioned, repeatable, data',
        'Implement automated backup strategy before all migrations',
        'Add database schema tests to CI/CD pipeline',
        'Create migration execution wrapper script with rollback capability',
        'Establish database change management policy (no manual schema changes)',
        'Add monitoring for migration failures and schema drift',
        'Make all migrations fully idempotent with IF NOT EXISTS checks'
      ],
      implementationPlan: [
        {
          phase: 1,
          name: 'Immediate Fix (Today)',
          tasks: [
            'Create full database backup with pg_dump',
            'Create schema_migrations table for tracking',
            'Record baseline migrations V0.0.0 through V0.0.14 as executed',
            'Execute missing migrations V0.0.15 through V0.0.35 using safe migration script',
            'Validate all 21 tables/views created successfully',
            'Test materialized view refresh (bin_utilization_cache)',
            'Verify all 6 WMS GraphQL endpoints functional',
            'Test all WMS frontend pages load without errors'
          ],
          estimatedTime: '1.5 - 2 hours'
        },
        {
          phase: 2,
          name: 'Architectural Improvements (This Week)',
          tasks: [
            'Install and configure Flyway or Liquibase',
            'Test migration framework on backup database',
            'Add database schema validation tests',
            'Add foreign key integrity tests',
            'Add materialized view refresh tests',
            'Integrate schema tests into CI/CD pipeline',
            'Implement automated daily backup strategy',
            'Test and document restore procedure',
            'Refactor existing migrations with pre-flight checks',
            'Separate repeatable migrations (views, functions)',
            'Create comprehensive migration execution guide'
          ],
          estimatedTime: '18 hours (2-3 days)'
        },
        {
          phase: 3,
          name: 'Process Improvements (Next Sprint)',
          tasks: [
            'Establish database change management policy',
            'Require migration scripts for all schema changes',
            'Require code review for all migrations',
            'Test migrations in dev/staging before production',
            'Implement schema drift monitoring and alerting',
            'Track migration execution time and failures',
            'Document migration development standards',
            'Document rollback procedures',
            'Document database restore procedures',
            'Train team on new migration process'
          ],
          estimatedTime: '1 week'
        }
      ]
    };

    // Publish to NATS
    const sc = StringCodec();
    const subject = 'agog.deliverables.sylvia.critique.REQ-DATABASE-WMS-1766892755200';

    console.log(`📤 Publishing critique to: ${subject}`);
    console.log(`   Severity: ${critique.severity}`);
    console.log(`   Critical Findings: ${critique.criticalFindings.length}`);
    console.log(`   Recommendations: ${critique.architecturalRecommendations.length}`);

    nc.publish(subject, sc.encode(JSON.stringify(critique, null, 2)));

    // Also publish to general critique subject for tracking
    nc.publish('agog.deliverables.sylvia.critique', sc.encode(JSON.stringify(critique, null, 2)));

    await nc.flush();
    console.log('✅ Critique published successfully');

    // Print summary
    console.log('\n📋 CRITIQUE SUMMARY');
    console.log('===================');
    console.log(`Requirement: ${critique.reqNumber}`);
    console.log(`Status: ${critique.status}`);
    console.log(`Severity: ${critique.severity}`);
    console.log(`\nSummary:`);
    console.log(critique.summary);
    console.log(`\nRecommended Approach:`);
    console.log(critique.recommendedApproach);
    console.log(`\nEstimated Effort: ${critique.estimatedEffort}`);
    console.log(`\nCritical Findings (${critique.criticalFindings.length}):`);
    critique.criticalFindings.forEach((finding, idx) => {
      console.log(`  ${idx + 1}. ${finding}`);
    });
    console.log(`\nNext Steps:`);
    console.log(`  1. Marcus (DevOps) reviews critique`);
    console.log(`  2. Create database backup`);
    console.log(`  3. Execute Phase 1 migration script (2 hours)`);
    console.log(`  4. Validate all WMS pages functional`);
    console.log(`  5. Plan Phase 2 (Flyway/Liquibase implementation)`);

  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    throw error;
  } finally {
    if (nc) {
      await nc.drain();
      console.log('👋 Disconnected from NATS');
    }
  }
}

// Execute
publishCritique()
  .then(() => {
    console.log('\n✅ Publication complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Publication failed:', error);
    process.exit(1);
  });
