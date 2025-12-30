#!/usr/bin/env ts-node

/**
 * Publishes Berry's DevOps deliverable for REQ-STRATEGIC-AUTO-1735400400000 (Vendor Scorecards) to NATS
 */

import { connect, StringCodec, JetStreamClient } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface BerryDeliverable {
  agent: 'berry';
  reqNumber: string;
  deliverableType: 'devops';
  timestamp: string;
  status: 'CONDITIONAL_APPROVAL' | 'APPROVED' | 'REJECTED';
  deploymentReadiness: {
    overallScore: number;
    componentScores: {
      databaseSchema: number;
      backendServices: number;
      graphqlAPI: number;
      frontend: number;
      security: number;
      performance: number;
      testing: number;
      documentation: number;
      monitoring: number;
    };
    criticalBlockers: number;
    highPriorityIssues: number;
  };
  criticalIssues: Array<{
    id: string;
    severity: 'CRITICAL' | 'HIGH';
    title: string;
    location: string;
    impact: string;
    estimatedFixTime: string;
    blocking: boolean;
  }>;
  deploymentPlan: {
    preDevelopmentDays: number;
    deploymentDay: number;
    postDeploymentDays: number;
    estimatedProductionDate: string;
  };
  recommendations: string[];
  deliverableMarkdown: string;
}

async function publishBerryDeliverable() {
  const reqNumber = 'REQ-STRATEGIC-AUTO-1735400400000';

  console.log(`\n📦 Publishing Berry DevOps Deliverable: ${reqNumber}`);
  console.log('='.repeat(80));

  // Read the deliverable markdown
  const deliverablePath = path.join(__dirname, '..', `BERRY_DEVOPS_DELIVERABLE_${reqNumber}.md`);
  const deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');

  const deliverable: BerryDeliverable = {
    agent: 'berry',
    reqNumber,
    deliverableType: 'devops',
    timestamp: new Date().toISOString(),
    status: 'CONDITIONAL_APPROVAL',
    deploymentReadiness: {
      overallScore: 7.2,
      componentScores: {
        databaseSchema: 100,
        backendServices: 65,
        graphqlAPI: 70,
        frontend: 85,
        security: 60,
        performance: 70,
        testing: 20,
        documentation: 50,
        monitoring: 0
      },
      criticalBlockers: 4,
      highPriorityIssues: 5
    },
    criticalIssues: [
      {
        id: 'CRITICAL-001',
        severity: 'CRITICAL',
        title: 'SQL Injection Vulnerability',
        location: 'vendor-performance.resolver.ts:218-258',
        impact: 'Data exfiltration, privilege escalation',
        estimatedFixTime: '2 hours',
        blocking: true
      },
      {
        id: 'CRITICAL-002',
        severity: 'CRITICAL',
        title: 'Transaction Rollback Missing',
        location: 'vendor-performance.service.ts:206-400',
        impact: 'Data corruption, connection pool exhaustion',
        estimatedFixTime: '1 hour',
        blocking: true
      },
      {
        id: 'CRITICAL-003',
        severity: 'CRITICAL',
        title: 'Hardcoded Default Scores',
        location: 'vendor-performance.service.ts:318-324',
        impact: 'Misleading vendor ratings, undermines scorecard effectiveness',
        estimatedFixTime: '4 hours',
        blocking: true
      },
      {
        id: 'CRITICAL-004',
        severity: 'CRITICAL',
        title: 'Quality Metric Based on Unreliable Heuristic',
        location: 'vendor-performance.service.ts:293-316',
        impact: 'Completely untrustworthy quality data',
        estimatedFixTime: '8 hours',
        blocking: true
      },
      {
        id: 'HIGH-001',
        severity: 'HIGH',
        title: 'Missing Weight Validation',
        location: 'vendor-performance.resolver.ts:487-550',
        impact: 'Poor UX, cryptic database errors',
        estimatedFixTime: '1 hour',
        blocking: false
      },
      {
        id: 'HIGH-002',
        severity: 'HIGH',
        title: 'N+1 Query Performance Issue',
        location: 'vendor-performance.service.ts (getVendorScorecardEnhanced)',
        impact: 'Dashboard slowness, 400-600ms latency',
        estimatedFixTime: '4 hours',
        blocking: false
      },
      {
        id: 'HIGH-003',
        severity: 'HIGH',
        title: 'Tier Classification Ambiguity',
        location: 'vendor-tier-classification.service.ts:77-100',
        impact: 'Potential vendor misclassification',
        estimatedFixTime: '1 hour (documentation)',
        blocking: false
      },
      {
        id: 'HIGH-004',
        severity: 'HIGH',
        title: 'ESG Data Validation Missing',
        location: 'Inferred from research',
        impact: 'Misleading ESG risk assessments',
        estimatedFixTime: '2 hours',
        blocking: false
      },
      {
        id: 'HIGH-005',
        severity: 'HIGH',
        title: 'Alert Deduplication Missing',
        location: 'vendor-alert-engine.service.ts:83-180',
        impact: 'Alert fatigue, system unusable',
        estimatedFixTime: '3 hours',
        blocking: false
      }
    ],
    deploymentPlan: {
      preDevelopmentDays: 3,
      deploymentDay: 1,
      postDeploymentDays: 5,
      estimatedProductionDate: '2026-01-02 to 2026-01-06'
    },
    recommendations: [
      'Block production deployment until 4 CRITICAL issues are resolved',
      'Fix all 5 HIGH priority issues before staging deployment',
      'Implement unit tests (80% coverage target)',
      'Set up comprehensive monitoring and alerting',
      'Create operational runbook for support team',
      'Conduct load testing with 100+ vendors',
      'Schedule team training before production launch',
      'Plan iterative enhancements for Month 1-3 post-launch'
    ],
    deliverableMarkdown: deliverableContent
  };

  // Connect to NATS
  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    maxReconnectAttempts: 3,
    reconnectTimeWait: 1000
  });

  console.log(`✅ Connected to NATS at ${nc.getServer()}`);

  const js = nc.jetstream();
  const sc = StringCodec();

  // Publish to main deliverable stream
  const subject = `agog.deliverables.berry.devops.${reqNumber}`;

  try {
    await js.publish(subject, sc.encode(JSON.stringify(deliverable, null, 2)));
    console.log(`✅ Published to: ${subject}`);
    console.log(`\n📊 Deployment Readiness Summary:`);
    console.log(`   Overall Score: ${deliverable.deploymentReadiness.overallScore}/10`);
    console.log(`   Status: ${deliverable.status}`);
    console.log(`   Critical Blockers: ${deliverable.deploymentReadiness.criticalBlockers}`);
    console.log(`   High Priority Issues: ${deliverable.deploymentReadiness.highPriorityIssues}`);
    console.log(`   Estimated Fix Time: 3-5 days`);
  } catch (error) {
    console.error('❌ Failed to publish to JetStream:', error);
    throw error;
  }

  // Also publish summary to recommendations stream
  const recommendationSubject = `agog.recommendations.deployment.${reqNumber}`;
  const recommendation = {
    reqNumber,
    agent: 'berry',
    timestamp: new Date().toISOString(),
    recommendation: 'CONDITIONAL_APPROVAL',
    reason: '4 CRITICAL and 5 HIGH severity issues must be resolved before production deployment',
    estimatedTimeToReady: '3-5 days',
    criticalBlockers: deliverable.criticalIssues.filter(i => i.blocking),
    nextSteps: [
      'Day 1-2: Fix 4 CRITICAL issues (SQL injection, transaction handling, hardcoded scores, quality metric)',
      'Day 3: Fix 5 HIGH issues (validation, N+1 queries, deduplication)',
      'Day 4: Deploy to staging and run integration tests',
      'Day 5: Production deployment with monitoring'
    ]
  };

  try {
    await js.publish(recommendationSubject, sc.encode(JSON.stringify(recommendation, null, 2)));
    console.log(`✅ Published recommendation to: ${recommendationSubject}`);
  } catch (error) {
    console.error('⚠️  Failed to publish recommendation (non-critical):', error);
  }

  // Publish component-specific health metrics
  const healthSubject = `agog.health.deployment.${reqNumber}`;
  const healthMetrics = {
    reqNumber,
    timestamp: new Date().toISOString(),
    componentHealth: deliverable.deploymentReadiness.componentScores,
    overallHealth: deliverable.deploymentReadiness.overallScore,
    status: deliverable.status,
    issues: {
      critical: deliverable.deploymentReadiness.criticalBlockers,
      high: deliverable.deploymentReadiness.highPriorityIssues
    }
  };

  try {
    await js.publish(healthSubject, sc.encode(JSON.stringify(healthMetrics, null, 2)));
    console.log(`✅ Published health metrics to: ${healthSubject}`);
  } catch (error) {
    console.error('⚠️  Failed to publish health metrics (non-critical):', error);
  }

  await nc.drain();
  console.log('\n✅ Berry DevOps deliverable published successfully!');
  console.log('='.repeat(80));
}

// Run the publisher
publishBerryDeliverable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
