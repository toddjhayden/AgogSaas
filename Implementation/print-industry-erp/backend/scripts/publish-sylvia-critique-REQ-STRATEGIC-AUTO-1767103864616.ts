/**
 * Publish Sylvia's Critique for REQ-STRATEGIC-AUTO-1767103864616
 * Real-Time System Monitoring & Observability
 */

import { connect, JSONCodec, NatsConnection } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface SylviaCritiquePayload {
  reqNumber: string;
  agent: 'sylvia';
  title: string;
  status: 'COMPLETE';
  timestamp: string;
  deliverable: string;
  critique: {
    overallAssessment: string;
    researchQuality: string;
    recommendation: string;
    readyForImplementation: boolean;
    conditions: string[];
  };
  architectureReview: {
    strengths: string[];
    weaknesses: string[];
  };
  effortEstimate: {
    original: string;
    revised: string;
    reason: string;
  };
  mandatoryChanges: {
    phase: string;
    changes: string[];
  }[];
  risksMitigation: {
    newRisks: string[];
    criticalRisks: string[];
  };
  testingRequirements: {
    performance: boolean;
    security: boolean;
    load: boolean;
  };
  nextSteps: string[];
}

async function publishCritique() {
  let nc: NatsConnection | null = null;

  try {
    console.log('[Sylvia] Connecting to NATS...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      timeout: 5000,
    });

    console.log('[Sylvia] Connected to NATS');

    const codec = JSONCodec<SylviaCritiquePayload>();

    // Read the critique markdown file
    const critiquePath = path.join(__dirname, '..', 'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767103864616.md');
    const critiqueContent = fs.readFileSync(critiquePath, 'utf-8');

    const payload: SylviaCritiquePayload = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1767103864616',
      agent: 'sylvia',
      title: 'Real-Time System Monitoring & Observability - Code Quality Critique',
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      deliverable: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767103864616',
      critique: {
        overallAssessment: 'APPROVE WITH CRITICAL RECOMMENDATIONS',
        researchQuality: '9/10 - Comprehensive but missing performance overhead mitigation',
        recommendation: 'Proceed with 5 mandatory conditions addressed first',
        readyForImplementation: false,
        conditions: [
          'Add performance benchmarking BEFORE tracing implementation',
          'Revise data volume estimates (86 GB/day, not 5 GB/day)',
          'Secure /metrics endpoint (bearer token auth)',
          'Add trace sampling (1% → 10% gradual rollout)',
          'Increase effort estimate to 5-6 weeks (not 3-4)'
        ]
      },
      architectureReview: {
        strengths: [
          'Leverages existing infrastructure (V0.0.40 migration)',
          'Phased rollout strategy (logging → tracing → alerting)',
          'Time-series partitioning for scalability',
          'Security-first approach with RLS policies'
        ],
        weaknesses: [
          'CRITICAL: Performance overhead not adequately addressed (10-50ms per request)',
          'CRITICAL: Data volume underestimated (86 GB/day vs 5 GB/day)',
          'MAJOR: Prometheus /metrics endpoint security gap',
          'MODERATE: Alert storm mitigation incomplete',
          'MODERATE: OpenTelemetry Collector as single point of failure',
          'MINOR: WebSocket subscription implementation details missing'
        ]
      },
      effortEstimate: {
        original: '3-4 weeks',
        revised: '5-6 weeks',
        reason: 'Added performance benchmarking, sampling, security fixes, and comprehensive testing'
      },
      mandatoryChanges: [
        {
          phase: 'Phase 1 - Enhanced Logging',
          changes: [
            'Add log correlation ID (trace_id for linking)',
            'Implement log sampling (10% debug, 100% errors)',
            'Add performance test (ensure no API slowdown)'
          ]
        },
        {
          phase: 'Phase 2 - Distributed Tracing',
          changes: [
            'Benchmark current p95 latency FIRST',
            'Start with manual instrumentation (not auto)',
            'Add feature flag (enable/disable per endpoint)',
            'Set acceptance criteria (p95 increase < 5% OR revert)'
          ]
        },
        {
          phase: 'Phase 4 - Prometheus Metrics Export',
          changes: [
            'Add bearer token authentication',
            'Add IP whitelist (Prometheus server only)',
            'Add rate limiting (1 req/sec)'
          ]
        }
      ],
      risksMitigation: {
        newRisks: [
          'Database partition bloat (manual partition creation error-prone)',
          'Prometheus scrape exposes sensitive data (tenant-specific metrics)',
          'Log storage costs spiral out of control (debug logs left on)'
        ],
        criticalRisks: [
          'Performance overhead from auto-instrumentation (5-50ms)',
          'Data retention costs (10GB logs/day + 5GB traces/day)',
          'Cross-tenant data leak via RLS policy bug'
        ]
      },
      testingRequirements: {
        performance: true, // Mandatory p50/p95/p99 benchmarks
        security: true,    // Mandatory cross-tenant access tests
        load: true         // Mandatory 1000 req/sec tests
      },
      nextSteps: [
        'Marcus (Strategic Owner) reviews conditions',
        'Roy addresses mandatory changes in implementation plan',
        'Ron creates revised migration with partition auto-creation',
        'Berry prepares redundant OpenTelemetry Collector setup',
        'Billy prepares comprehensive test plan (performance + security + load)'
      ]
    };

    // Publish to NATS
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767103864616';
    nc.publish(subject, codec.encode(payload));

    console.log(`[Sylvia] ✅ Published critique to ${subject}`);
    console.log('[Sylvia] Payload:', JSON.stringify(payload, null, 2));

    // Also publish workflow update
    const workflowSubject = 'agog.workflows.strategic.REQ-STRATEGIC-AUTO-1767103864616';
    nc.publish(workflowSubject, codec.encode({
      reqNumber: 'REQ-STRATEGIC-AUTO-1767103864616',
      stage: 'critique',
      agent: 'sylvia',
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      deliverableUrl: 'nats://agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767103864616',
      nextStage: 'implementation_planning',
      nextAgent: 'marcus',
      blockers: [
        'Address 5 mandatory conditions before proceeding',
        'Revise effort estimate to 5-6 weeks',
        'Add performance benchmarking to plan'
      ]
    }));

    console.log(`[Sylvia] ✅ Published workflow update to ${workflowSubject}`);

    // Wait for messages to be sent
    await nc.flush();

    console.log('[Sylvia] All messages published successfully');
    console.log('[Sylvia] Deliverable stored at: backend/SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767103864616.md');
    console.log('[Sylvia] Full critique content:');
    console.log('─'.repeat(80));
    console.log(critiqueContent.substring(0, 1000) + '...\n(truncated, see file for full content)');
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('[Sylvia] ❌ Error publishing critique:', error);
    throw error;
  } finally {
    if (nc) {
      await nc.close();
      console.log('[Sylvia] NATS connection closed');
    }
  }
}

// Run the publisher
publishCritique()
  .then(() => {
    console.log('[Sylvia] ✅ Critique delivery complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Sylvia] ❌ Critique delivery failed:', error);
    process.exit(1);
  });
