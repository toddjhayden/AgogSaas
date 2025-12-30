/**
 * Publish Sylvia's Architecture Critique to NATS
 * REQ-STRATEGIC-AUTO-1766821112012: PO Approval Workflow
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

interface CritiqueDeliverable {
  reqNumber: string;
  featureTitle: string;
  agent: string;
  stage: string;
  timestamp: string;
  deliverableUrl: string;
  summary: string;
  criticalIssues: Array<{
    issueNumber: number;
    title: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
  }>;
  recommendations: {
    mustFix: string[];
    shouldFix: string[];
    niceToHave: string[];
  };
  verdict: string;
  riskLevel: string;
  estimatedEffort: string;
  content: string;
}

async function publishCritique() {
  let nc: NatsConnection | null = null;

  try {
    // Connect to NATS
    console.log('Connecting to NATS server...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
    });
    console.log('✓ Connected to NATS');

    // Read the critique deliverable
    const deliverablePath = path.join(
      __dirname,
      '..',
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1766821112012.md'
    );

    console.log(`Reading deliverable from: ${deliverablePath}`);
    const content = fs.readFileSync(deliverablePath, 'utf-8');

    // Create deliverable payload
    const deliverable: CritiqueDeliverable = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1766821112012',
      featureTitle: 'PO Approval Workflow',
      agent: 'sylvia',
      stage: 'critique',
      timestamp: new Date().toISOString(),
      deliverableUrl: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1766821112012',
      summary: 'Comprehensive architectural critique of PO Approval Workflow with 21 critical issues identified and detailed recommendations for MVP vs. enterprise implementation',
      criticalIssues: [
        {
          issueNumber: 1,
          title: 'Missing Composite Indexes for Critical Queries',
          severity: 'HIGH',
          category: 'Performance',
        },
        {
          issueNumber: 2,
          title: 'No Database-Level Constraints for State Integrity',
          severity: 'CRITICAL',
          category: 'Data Integrity',
        },
        {
          issueNumber: 3,
          title: 'Audit Trail Immutability Not Enforced',
          severity: 'CRITICAL',
          category: 'Security & Compliance',
        },
        {
          issueNumber: 4,
          title: 'Missing Transaction Management Strategy',
          severity: 'CRITICAL',
          category: 'Concurrency & Correctness',
        },
        {
          issueNumber: 5,
          title: 'No Event-Driven Architecture Integration',
          severity: 'CRITICAL',
          category: 'Integration',
        },
        {
          issueNumber: 6,
          title: 'Rule Engine Complexity Without Formalization',
          severity: 'HIGH',
          category: 'Maintainability',
        },
        {
          issueNumber: 7,
          title: 'Missing Error Union Types in GraphQL',
          severity: 'MEDIUM',
          category: 'API Design',
        },
        {
          issueNumber: 8,
          title: 'No Subscription Support for Real-Time Updates',
          severity: 'HIGH',
          category: 'User Experience',
        },
        {
          issueNumber: 9,
          title: 'Pagination Strategy Missing (Offset-based)',
          severity: 'MEDIUM',
          category: 'Performance',
        },
        {
          issueNumber: 10,
          title: 'No Formal State Machine Definition',
          severity: 'HIGH',
          category: 'Workflow Design',
        },
        {
          issueNumber: 11,
          title: 'N+1 Query Problem in Approval Chain Retrieval',
          severity: 'HIGH',
          category: 'Performance',
        },
        {
          issueNumber: 12,
          title: 'Missing Caching Strategy',
          severity: 'MEDIUM',
          category: 'Performance',
        },
        {
          issueNumber: 13,
          title: 'Approval Dashboard Query Optimization Missing',
          severity: 'HIGH',
          category: 'Performance',
        },
        {
          issueNumber: 14,
          title: 'Role-Based Access Control (RBAC) Implementation Incomplete',
          severity: 'CRITICAL',
          category: 'Security',
        },
        {
          issueNumber: 15,
          title: 'Audit Trail Tampering Risk',
          severity: 'CRITICAL',
          category: 'Security & Compliance',
        },
        {
          issueNumber: 16,
          title: 'Agent/Daemon Orchestration Integration Missing',
          severity: 'CRITICAL',
          category: 'Integration',
        },
        {
          issueNumber: 17,
          title: 'No Integration with Vendor Performance System',
          severity: 'MEDIUM',
          category: 'Integration',
        },
        {
          issueNumber: 18,
          title: 'No State Management Strategy (Frontend)',
          severity: 'MEDIUM',
          category: 'Frontend Architecture',
        },
        {
          issueNumber: 19,
          title: 'No Real-Time Updates Strategy (Frontend)',
          severity: 'HIGH',
          category: 'User Experience',
        },
        {
          issueNumber: 20,
          title: 'No Rollback Strategy',
          severity: 'HIGH',
          category: 'DevOps',
        },
        {
          issueNumber: 21,
          title: 'No Monitoring & Alerting Strategy',
          severity: 'MEDIUM',
          category: 'Operations',
        },
      ],
      recommendations: {
        mustFix: [
          'Add database constraints for state integrity (ISSUE #2)',
          'Implement proper transaction isolation and optimistic locking (ISSUE #4)',
          'Integrate with NATS event bus for agent coordination (ISSUE #5)',
          'Add JSON schema validation for approval rules (ISSUE #6)',
          'Implement decorator-based RBAC guards (ISSUE #14)',
          'Add composite indexes for approval dashboard queries (ISSUE #1)',
        ],
        shouldFix: [
          'Implement formal state machine for approval workflow (ISSUE #10)',
          'Add caching layer for approval rules (ISSUE #12)',
          'Implement materialized view for approval dashboard (ISSUE #13)',
          'Add audit log integrity verification (hash chain) (ISSUE #15)',
          'Integrate with vendor performance system (ISSUE #17)',
          'Add GraphQL subscriptions for real-time updates (ISSUE #8)',
        ],
        niceToHave: [
          'Implement error union types in GraphQL (ISSUE #7)',
          'Add cursor-based pagination (ISSUE #9)',
          'Implement React Query for state management (ISSUE #18)',
          'Add Prometheus metrics for monitoring (ISSUE #21)',
        ],
      },
      verdict: 'APPROVE WITH MAJOR REVISIONS - Research is exceptionally thorough but has critical integration gaps with existing NATS event bus and agent orchestration. Recommend MVP approach with simplified two-tier approval first.',
      riskLevel: 'MEDIUM',
      estimatedEffort: '4-6 weeks for MVP, 8-10 weeks for full enterprise solution',
      content,
    };

    // Publish to NATS subject
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1766821112012';
    console.log(`Publishing to subject: ${subject}`);

    nc.publish(subject, sc.encode(JSON.stringify(deliverable, null, 2)));
    console.log('✓ Deliverable published to NATS');

    // Also publish to general critique stream
    nc.publish('agog.deliverables.critique', sc.encode(JSON.stringify({
      reqNumber: deliverable.reqNumber,
      featureTitle: deliverable.featureTitle,
      agent: 'sylvia',
      timestamp: deliverable.timestamp,
      deliverableUrl: deliverable.deliverableUrl,
      verdict: deliverable.verdict,
      criticalIssuesCount: deliverable.criticalIssues.filter(i => i.severity === 'CRITICAL').length,
      highIssuesCount: deliverable.criticalIssues.filter(i => i.severity === 'HIGH').length,
    })));
    console.log('✓ Summary published to agog.deliverables.critique');

    // Publish event for strategic orchestrator
    nc.publish('agog.events.workflow.critique-completed', sc.encode(JSON.stringify({
      eventType: 'CRITIQUE_COMPLETED',
      reqNumber: deliverable.reqNumber,
      agent: 'sylvia',
      timestamp: deliverable.timestamp,
      verdict: deliverable.verdict,
      riskLevel: deliverable.riskLevel,
      criticalIssuesCount: deliverable.criticalIssues.filter(i => i.severity === 'CRITICAL').length,
      nextStage: 'backend-implementation',
      assignedTo: 'marcus',
    })));
    console.log('✓ Workflow event published');

    // Flush and close
    await nc.flush();
    console.log('\n✅ All publications complete');
    console.log(`\nDeliverable URL: ${deliverable.deliverableUrl}`);
    console.log('Next Stage: Backend Implementation (Marcus)');

  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.close();
      console.log('Connection closed');
    }
  }
}

// Execute
publishCritique().catch(console.error);
