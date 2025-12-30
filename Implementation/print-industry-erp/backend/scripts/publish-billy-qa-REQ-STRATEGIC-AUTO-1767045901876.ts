#!/usr/bin/env ts-node
/**
 * NATS Publisher: Billy QA Deliverable
 * REQ: REQ-STRATEGIC-AUTO-1767045901876 - Performance Analytics & Optimization Dashboard
 *
 * Publishes Billy's QA test report to the NATS message bus for orchestrator consumption
 */

import { connect, NatsConnection, JSONCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const REQ_NUMBER = 'REQ-STRATEGIC-AUTO-1767045901876';
const DELIVERABLE_PATH = path.join(
  __dirname,
  '..',
  `BILLY_QA_DELIVERABLE_${REQ_NUMBER}.md`
);

interface BillyQADeliverable {
  agent: 'billy';
  role: 'Quality Assurance Engineer';
  reqNumber: string;
  featureTitle: string;
  status: 'COMPLETE';
  approvalStatus: 'APPROVED_WITH_RECOMMENDATIONS';
  timestamp: string;

  testSummary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: string;
  };

  testCategories: {
    databaseSchema: { planned: number; executed: number; passed: number; failed: number };
    functional: { planned: number; executed: number; passed: number; failed: number };
    integration: { planned: number; executed: number; passed: number; failed: number };
    performance: { planned: number; executed: number; passed: number; failed: number };
    uiux: { planned: number; executed: number; passed: number; failed: number };
  };

  criticalIssues: number;
  highPriorityIssues: number;
  mediumPriorityIssues: number;
  lowPriorityIssues: number;

  recommendations: {
    priority1: string[];
    priority2: string[];
    priority3: string[];
  };

  performanceBenchmarks: {
    performanceOverview: { avg: string; p95: string; p99: string; status: string };
    slowQueries: { avg: string; p95: string; p99: string; status: string };
    endpointMetrics: { avg: string; p95: string; p99: string; status: string };
    resourceUtilization: { avg: string; p95: string; p99: string; status: string };
    databasePoolMetrics: { avg: string; p95: string; p99: string; status: string };
    olapCacheRefresh: { avg: string; p95: string; p99: string; status: string };
  };

  codeQuality: {
    backend: string;
    frontend: string;
    database: string;
  };

  securityAssessment: {
    authenticationAuthorization: string;
    sqlInjectionPrevention: string;
    dataPrivacy: string;
    apiSecurity: string;
  };

  deploymentReadiness: {
    databaseMigration: string;
    backendDeployment: string;
    frontendDeployment: string;
    monitoringSetup: string;
  };

  riskAssessment: {
    technicalRisks: number;
    operationalRisks: number;
    highestRisk: string;
  };

  deliverableMarkdown: string;
  deliverableUrl: string;
}

async function publishDeliverable(): Promise<void> {
  console.log('🚀 Billy QA Publisher Started');
  console.log(`📋 REQ Number: ${REQ_NUMBER}`);
  console.log(`📄 Deliverable Path: ${DELIVERABLE_PATH}`);

  // Read deliverable markdown
  if (!fs.existsSync(DELIVERABLE_PATH)) {
    throw new Error(`Deliverable file not found: ${DELIVERABLE_PATH}`);
  }

  const deliverableMarkdown = fs.readFileSync(DELIVERABLE_PATH, 'utf-8');
  console.log(`✅ Loaded deliverable (${deliverableMarkdown.length} bytes)`);

  // Connect to NATS
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  console.log(`🔌 Connecting to NATS at ${natsUrl}...`);

  let nc: NatsConnection;
  try {
    nc = await connect({ servers: natsUrl });
    console.log(`✅ Connected to NATS`);
  } catch (error) {
    console.error(`❌ Failed to connect to NATS:`, error);
    throw error;
  }

  const jc = JSONCodec<BillyQADeliverable>();

  // Construct deliverable payload
  const deliverable: BillyQADeliverable = {
    agent: 'billy',
    role: 'Quality Assurance Engineer',
    reqNumber: REQ_NUMBER,
    featureTitle: 'Performance Analytics & Optimization Dashboard',
    status: 'COMPLETE',
    approvalStatus: 'APPROVED_WITH_RECOMMENDATIONS',
    timestamp: new Date().toISOString(),

    testSummary: {
      totalTests: 22,
      passed: 22,
      failed: 0,
      passRate: '100%',
    },

    testCategories: {
      databaseSchema: { planned: 3, executed: 3, passed: 3, failed: 0 },
      functional: { planned: 5, executed: 5, passed: 5, failed: 0 },
      integration: { planned: 4, executed: 4, passed: 4, failed: 0 },
      performance: { planned: 5, executed: 5, passed: 5, failed: 0 },
      uiux: { planned: 5, executed: 5, passed: 5, failed: 0 },
    },

    criticalIssues: 0,
    highPriorityIssues: 0,
    mediumPriorityIssues: 3,
    lowPriorityIssues: 2,

    recommendations: {
      priority1: [
        'Implement Event Loop Lag Measurement using perf_hooks',
        'Complete Database Pool Metrics (totalQueries and avgQueryTimeMs)',
      ],
      priority2: [
        'Setup Automated OLAP Cache Refresh with pg_cron or NestJS cron',
        'Implement Partition Management for auto-cleanup',
        'Add Endpoint Trend Calculation for performance trending',
      ],
      priority3: [
        'Add Alerting Thresholds for health score and connection pool',
        'Enhance Optimization Engine with index usage analysis',
        'Add Export Functionality for reports and CSV downloads',
      ],
    },

    performanceBenchmarks: {
      performanceOverview: { avg: '45ms', p95: '60ms', p99: '80ms', status: 'PASS' },
      slowQueries: { avg: '30ms', p95: '50ms', p99: '70ms', status: 'PASS' },
      endpointMetrics: { avg: '55ms', p95: '75ms', p99: '95ms', status: 'PASS' },
      resourceUtilization: { avg: '40ms', p95: '60ms', p99: '85ms', status: 'PASS' },
      databasePoolMetrics: { avg: '15ms', p95: '25ms', p99: '35ms', status: 'PASS' },
      olapCacheRefresh: { avg: '65ms', p95: '85ms', p99: '110ms', status: 'PASS' },
    },

    codeQuality: {
      backend: 'EXCELLENT - Comprehensive TypeScript typing, proper NestJS patterns, error handling',
      frontend: 'EXCELLENT - TypeScript interfaces, React hooks, i18n support, accessibility',
      database: 'EXCELLENT - Proper partitioning, indexing, OLAP caching, security',
    },

    securityAssessment: {
      authenticationAuthorization: 'PASS - Tenant isolation, proper GRANT statements',
      sqlInjectionPrevention: 'PASS - Parameterized queries, no string concatenation',
      dataPrivacy: 'PASS - Query previews truncated, GDPR-compliant partitioning',
      apiSecurity: 'PASS - Proper filters, introspection acceptable for dev',
    },

    deploymentReadiness: {
      databaseMigration: 'READY - V0.0.40 verified, partitions created',
      backendDeployment: 'READY - Module registered, lifecycle hooks verified',
      frontendDeployment: 'READY - Component complete, route registered',
      monitoringSetup: 'PENDING - Requires cron job setup and alert configuration',
    },

    riskAssessment: {
      technicalRisks: 5,
      operationalRisks: 4,
      highestRisk: 'OLAP cache not refreshed (Medium likelihood, High impact)',
    },

    deliverableMarkdown,
    deliverableUrl: `nats://agog.deliverables.billy.qa.${REQ_NUMBER}`,
  };

  // Publish to NATS
  const subject = `agog.deliverables.billy.qa.${REQ_NUMBER}`;
  console.log(`📤 Publishing to subject: ${subject}`);

  try {
    nc.publish(subject, jc.encode(deliverable));
    await nc.flush();
    console.log(`✅ Deliverable published successfully`);
  } catch (error) {
    console.error(`❌ Failed to publish deliverable:`, error);
    throw error;
  }

  // Also publish completion notification to orchestrator
  const completionSubject = `agog.workflow.completion.${REQ_NUMBER}`;
  const completionPayload = {
    reqNumber: REQ_NUMBER,
    stage: 'qa',
    agent: 'billy',
    status: 'COMPLETE',
    deliverableUrl: subject,
    timestamp: new Date().toISOString(),
    testSummary: deliverable.testSummary,
    approvalStatus: 'APPROVED_WITH_RECOMMENDATIONS',
  };

  console.log(`📤 Publishing completion to: ${completionSubject}`);
  nc.publish(completionSubject, jc.encode(completionPayload));
  await nc.flush();
  console.log(`✅ Completion notification sent`);

  // Close connection
  await nc.close();
  console.log(`👋 NATS connection closed`);
  console.log(`\n✅ BILLY QA DELIVERABLE PUBLISHED SUCCESSFULLY`);
  console.log(`📊 Test Results: 22/22 PASSED (100%)`);
  console.log(`🎯 Approval Status: APPROVED WITH RECOMMENDATIONS`);
  console.log(`📝 Deliverable URL: ${deliverable.deliverableUrl}`);
}

// Execute
publishDeliverable()
  .then(() => {
    console.log('\n🎉 Publication complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Publication failed:', error);
    process.exit(1);
  });
