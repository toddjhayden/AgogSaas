#!/usr/bin/env ts-node
/**
 * Publish Sylvia's Architecture Critique to NATS
 * REQ-STRATEGIC-AUTO-1766805136685: Sales Quote Automation
 *
 * This script publishes the architecture critique deliverable to the NATS message bus
 * for consumption by downstream systems and agents.
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

interface CritiqueDeliverable {
  reqNumber: string;
  agent: string;
  deliverableType: string;
  timestamp: string;
  featureTitle: string;
  critiqueSummary: {
    overallRating: string;
    productionReadiness: string;
    criticalIssues: number;
    highPriorityIssues: number;
    mediumPriorityIssues: number;
    lowPriorityIssues: number;
    estimatedEffortWeeks: number;
  };
  keyFindings: {
    strengths: string[];
    criticalIssues: string[];
    recommendations: string[];
  };
  assessmentScores: {
    architecture: number;
    codeQuality: number;
    security: number;
    performance: number;
    testing: number;
    operations: number;
  };
  deliverableFilePath: string;
  deliverableContent: string;
}

async function publishCritique() {
  console.log('🚀 Publishing Sylvia Architecture Critique to NATS...\n');

  // Read the critique deliverable
  const deliverablePath = path.join(
    __dirname,
    '..',
    'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1766805136685.md'
  );

  if (!fs.existsSync(deliverablePath)) {
    console.error('❌ Error: Critique deliverable not found at:', deliverablePath);
    process.exit(1);
  }

  const deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');

  // Prepare deliverable payload
  const deliverable: CritiqueDeliverable = {
    reqNumber: 'REQ-STRATEGIC-AUTO-1766805136685',
    agent: 'sylvia',
    deliverableType: 'critique',
    timestamp: new Date().toISOString(),
    featureTitle: 'Sales Quote Automation',
    critiqueSummary: {
      overallRating: '4/5 Stars',
      productionReadiness: 'READY (with critical fixes)',
      criticalIssues: 2,
      highPriorityIssues: 2,
      mediumPriorityIssues: 6,
      lowPriorityIssues: 2,
      estimatedEffortWeeks: 5
    },
    keyFindings: {
      strengths: [
        'Clean layered architecture with clear separation of concerns',
        'Sophisticated JSONB-based pricing rule engine',
        'Transaction-safe operations with PostgreSQL ACID guarantees',
        'Well-designed database schema with proper indexing',
        'Comprehensive GraphQL API with preview capabilities',
        'Multi-level BOM explosion for accurate costing',
        'Proper use of TypeScript for type safety',
        'Comprehensive research documentation'
      ],
      criticalIssues: [
        'CRITICAL: Missing tenant isolation validation - Cross-tenant data access vulnerability',
        'CRITICAL: Improper service instantiation pattern - Manual instantiation instead of DI',
        'HIGH: Insufficient test coverage - Only ~5% of code covered',
        'HIGH: Insufficient structured logging - No operational visibility'
      ],
      recommendations: [
        'Fix tenant isolation validation in all service methods (CRITICAL)',
        'Refactor to use proper NestJS dependency injection (CRITICAL)',
        'Implement comprehensive test suite (80% coverage target)',
        'Add structured logging throughout all services',
        'Move hardcoded business rules to database configuration',
        'Add GraphQL pagination and query complexity analysis',
        'Optimize N+1 query problems with batch queries',
        'Implement rate limiting and API protection',
        'Add check constraints for data validation',
        'Implement observability with metrics and tracing'
      ]
    },
    assessmentScores: {
      architecture: 4,
      codeQuality: 4,
      security: 3,
      performance: 4,
      testing: 2,
      operations: 3
    },
    deliverableFilePath: deliverablePath,
    deliverableContent: deliverableContent
  };

  try {
    // Connect to NATS
    const nc: NatsConnection = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      timeout: 5000
    });

    console.log('✅ Connected to NATS server');

    // Publish to main deliverable subject
    const mainSubject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1766805136685';
    nc.publish(mainSubject, sc.encode(JSON.stringify(deliverable, null, 2)));
    console.log(`✅ Published to: ${mainSubject}`);

    // Publish to general critique notifications
    const notificationSubject = 'agog.notifications.critique.completed';
    nc.publish(notificationSubject, sc.encode(JSON.stringify({
      reqNumber: deliverable.reqNumber,
      agent: 'sylvia',
      featureTitle: deliverable.featureTitle,
      overallRating: deliverable.critiqueSummary.overallRating,
      productionReadiness: deliverable.critiqueSummary.productionReadiness,
      criticalIssues: deliverable.critiqueSummary.criticalIssues,
      timestamp: deliverable.timestamp,
      deliverableUrl: `nats://${mainSubject}`
    })));
    console.log(`✅ Published notification to: ${notificationSubject}`);

    // Publish summary for orchestrator
    const summarySubject = 'agog.workflow.REQ-STRATEGIC-AUTO-1766805136685.critique.complete';
    nc.publish(summarySubject, sc.encode(JSON.stringify({
      reqNumber: deliverable.reqNumber,
      stage: 'critique',
      status: 'COMPLETE',
      agent: 'sylvia',
      productionReadiness: deliverable.critiqueSummary.productionReadiness,
      nextSteps: [
        'Address critical security issues (tenant isolation)',
        'Fix architectural patterns (dependency injection)',
        'Implement comprehensive test suite',
        'Add structured logging and observability'
      ],
      deliverableUrl: `nats://${mainSubject}`,
      timestamp: deliverable.timestamp
    })));
    console.log(`✅ Published summary to: ${summarySubject}`);

    // Flush and close
    await nc.flush();
    await nc.close();

    console.log('\n✅ All messages published successfully!');
    console.log('\n📊 Critique Summary:');
    console.log(`   Overall Rating: ${deliverable.critiqueSummary.overallRating}`);
    console.log(`   Production Readiness: ${deliverable.critiqueSummary.productionReadiness}`);
    console.log(`   Critical Issues: ${deliverable.critiqueSummary.criticalIssues}`);
    console.log(`   High Priority Issues: ${deliverable.critiqueSummary.highPriorityIssues}`);
    console.log(`   Medium Priority Issues: ${deliverable.critiqueSummary.mediumPriorityIssues}`);
    console.log(`   Low Priority Issues: ${deliverable.critiqueSummary.lowPriorityIssues}`);
    console.log(`   Estimated Effort: ${deliverable.critiqueSummary.estimatedEffortWeeks} weeks`);
    console.log('\n📝 Key Recommendations:');
    deliverable.keyFindings.recommendations.slice(0, 5).forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });

  } catch (error) {
    console.error('❌ Error publishing to NATS:', error);
    process.exit(1);
  }
}

// Run the publisher
publishCritique().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
