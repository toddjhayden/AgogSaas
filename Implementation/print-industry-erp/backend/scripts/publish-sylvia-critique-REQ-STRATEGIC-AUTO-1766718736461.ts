#!/usr/bin/env ts-node

/**
 * NATS Publisher: Sylvia Architectural Critique
 * REQ-STRATEGIC-AUTO-1766718736461 - Inventory Forecasting
 *
 * Purpose: Publishes Sylvia's architectural critique to NATS for strategic orchestrator
 * Agent: Sylvia (Architectural Critic)
 * Date: 2025-12-27
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface SylviaCritiqueDeliverable {
  agent: string;
  reqNumber: string;
  status: string;
  deliverableType: string;
  severity: string;
  overallAssessment: string;
  productionReady: boolean;
  criticalIssuesCount: number;
  highIssuesCount: number;
  mediumIssuesCount: number;
  lowIssuesCount: number;
  criticalIssues: Array<{
    id: number;
    title: string;
    severity: string;
    impact: string;
    location: string;
    fixRequired: string;
  }>;
  performanceImpact: string;
  securityRisks: string;
  remediationTimeline: string;
  blockingIssues: string[];
  positiveObservations: string[];
  fullCritiqueMarkdown: string;
  publishedAt: string;
  publishedBy: string;
}

async function publishSylviaCritique() {
  const reqNumber = 'REQ-STRATEGIC-AUTO-1766718736461';
  const subject = `agog.deliverables.sylvia.critique.${reqNumber}`;

  // Read the critique markdown file
  const critiquePath = path.join(
    __dirname,
    '..',
    `SYLVIA_CRITIQUE_DELIVERABLE_${reqNumber}.md`
  );

  if (!fs.existsSync(critiquePath)) {
    console.error(`❌ Critique file not found: ${critiquePath}`);
    process.exit(1);
  }

  const fullCritiqueMarkdown = fs.readFileSync(critiquePath, 'utf-8');

  // Build structured deliverable
  const deliverable: SylviaCritiqueDeliverable = {
    agent: 'sylvia',
    reqNumber,
    status: 'COMPLETE',
    deliverableType: 'ARCHITECTURAL_CRITIQUE',
    severity: 'MEDIUM',
    overallAssessment: '6.5/10',
    productionReady: false,
    criticalIssuesCount: 2,
    highIssuesCount: 1,
    mediumIssuesCount: 4,
    lowIssuesCount: 1,
    criticalIssues: [
      {
        id: 1,
        title: 'Missing Dependency Injection in ForecastingModule',
        severity: 'CRITICAL',
        impact: 'HIGH - Runtime crashes in production',
        location: 'print-industry-erp/backend/src/modules/forecasting/forecasting.module.ts:28-40',
        fixRequired: 'Add DatabaseModule to imports array',
      },
      {
        id: 2,
        title: 'Placeholder Implementation in getForecastAccuracySummary',
        severity: 'CRITICAL',
        impact: 'HIGH - Core feature non-functional',
        location: 'print-industry-erp/backend/src/graphql/resolvers/forecasting.resolver.ts:107-130',
        fixRequired: 'Integrate ForecastAccuracyService.getAccuracyMetrics()',
      },
      {
        id: 3,
        title: 'N+1 Query Performance Anti-Pattern',
        severity: 'HIGH',
        impact: 'HIGH - Performance degradation at scale',
        location: 'print-industry-erp/backend/src/modules/forecasting/services/replenishment-recommendation.service.ts:88-108',
        fixRequired: 'Implement batch query optimization',
      },
      {
        id: 4,
        title: 'Hardcoded "system" User Context',
        severity: 'MEDIUM',
        impact: 'MEDIUM - Audit/compliance risk',
        location: 'print-industry-erp/backend/src/graphql/resolvers/forecasting.resolver.ts:172-174',
        fixRequired: 'Implement GraphQL context extraction',
      },
      {
        id: 5,
        title: 'Incomplete Error Handling in Database Operations',
        severity: 'MEDIUM',
        impact: 'MEDIUM - Hidden failures, degraded accuracy',
        location: 'Multiple service files',
        fixRequired: 'Implement structured logging + retry logic',
      },
      {
        id: 6,
        title: 'Missing Input Validation and Sanitization',
        severity: 'MEDIUM',
        impact: 'MEDIUM - Resource exhaustion, potential DoS',
        location: 'print-industry-erp/backend/src/graphql/resolvers/forecasting.resolver.ts',
        fixRequired: 'Add DTO validation with class-validator',
      },
      {
        id: 7,
        title: 'Code Duplication in Statistical Calculations',
        severity: 'LOW',
        impact: 'LOW - Maintainability concern',
        location: 'print-industry-erp/backend/src/modules/forecasting/services/forecasting.service.ts',
        fixRequired: 'Extract to shared utility class',
      },
    ],
    performanceImpact: 'High - N+1 queries cause 17.3x performance degradation for batch operations. 100 materials = 500+ queries (5+ seconds). Requires batch optimization.',
    securityRisks: 'Medium - Missing input validation enables resource exhaustion attacks. Forecast horizon abuse (10,000 days) can exhaust disk/memory. Rate limiting required.',
    remediationTimeline: '2-3 weeks total (Phase 1: 2-3 days critical fixes, Phase 2: 1 week performance, Phase 3: 1 week reliability)',
    blockingIssues: [
      'ForecastingModule breaks when imported (dependency injection)',
      'Forecast accuracy summary returns stub data (core feature broken)',
      'N+1 query anti-pattern (performance degrades with scale)',
      'Missing input validation (resource exhaustion risk)',
      'Hardcoded user context (compliance violation)',
    ],
    positiveObservations: [
      'Statistical algorithm selection is intelligent and industry-standard',
      'Forecast versioning enables auditability and debugging',
      'Comprehensive confidence intervals (80%, 95%) with correct z-scores',
      'Sophisticated safety stock calculations (4 methods including King\'s Formula)',
      'Well-designed database schema with proper indexing and RLS',
      'Holt-Winters implementation is mathematically correct',
    ],
    fullCritiqueMarkdown,
    publishedAt: new Date().toISOString(),
    publishedBy: 'sylvia-agent',
  };

  // Connect to NATS
  let nc: NatsConnection | null = null;

  try {
    console.log('🔌 Connecting to NATS server...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      maxReconnectAttempts: 3,
      timeout: 10000,
    });

    console.log('✅ Connected to NATS server');

    // Publish deliverable
    const sc = StringCodec();
    const payload = sc.encode(JSON.stringify(deliverable, null, 2));

    nc.publish(subject, payload);
    await nc.flush();

    console.log('📤 Published Sylvia architectural critique');
    console.log(`   Subject: ${subject}`);
    console.log(`   Severity: ${deliverable.severity}`);
    console.log(`   Production Ready: ${deliverable.productionReady ? '✅ YES' : '❌ NO'}`);
    console.log(`   Critical Issues: ${deliverable.criticalIssuesCount}`);
    console.log(`   High Issues: ${deliverable.highIssuesCount}`);
    console.log(`   Medium Issues: ${deliverable.mediumIssuesCount}`);
    console.log(`   Low Issues: ${deliverable.lowIssuesCount}`);
    console.log(`   Overall Assessment: ${deliverable.overallAssessment}`);
    console.log(`   Remediation Timeline: ${deliverable.remediationTimeline}`);
    console.log('');
    console.log('🎯 Key Recommendations:');
    console.log('   1. Fix ForecastingModule dependency injection (CRITICAL)');
    console.log('   2. Implement forecast accuracy summary properly (CRITICAL)');
    console.log('   3. Optimize N+1 queries with batch loading (HIGH)');
    console.log('   4. Add input validation for resource protection (MEDIUM)');
    console.log('   5. Extract user from GraphQL context (MEDIUM)');
    console.log('');
    console.log('✅ Deliverable published successfully!');
  } catch (error) {
    console.error('❌ Failed to publish to NATS:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('💡 NATS server is not running. Start it with:');
      console.error('   docker-compose up -d nats');
      console.error('   OR');
      console.error('   nats-server');
    }
    process.exit(1);
  } finally {
    if (nc) {
      await nc.drain();
      console.log('🔌 Disconnected from NATS server');
    }
  }
}

// Execute
publishSylviaCritique().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
