#!/usr/bin/env ts-node

/**
 * NATS Publisher: Sylvia's Architectural Critique
 * REQ-STRATEGIC-AUTO-1767066329944 - GraphQL Authorization & Tenant Isolation
 *
 * Publishes architectural critique deliverable to NATS for orchestrator consumption
 */

import { connect, NatsConnection, JSONCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const REQ_NUMBER = 'REQ-STRATEGIC-AUTO-1767066329944';
const AGENT = 'sylvia';
const DELIVERABLE_TYPE = 'critique';

async function publishCritique() {
  let nc: NatsConnection | null = null;

  try {
    console.log('🔗 Connecting to NATS...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      maxReconnectAttempts: 3,
      reconnectTimeWait: 1000,
    });

    console.log('✅ Connected to NATS');

    const jc = JSONCodec();

    // Read the deliverable markdown file
    const deliverablePath = path.join(
      __dirname,
      '..',
      `SYLVIA_CRITIQUE_DELIVERABLE_${REQ_NUMBER}.md`
    );

    console.log(`📖 Reading deliverable from: ${deliverablePath}`);

    if (!fs.existsSync(deliverablePath)) {
      throw new Error(`Deliverable file not found: ${deliverablePath}`);
    }

    const deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Prepare the message payload
    const payload = {
      agent: AGENT,
      reqNumber: REQ_NUMBER,
      deliverableType: DELIVERABLE_TYPE,
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      content: deliverableContent,
      metadata: {
        riskLevel: 'CRITICAL',
        productionReady: false,
        blockingIssues: [
          'Unauthenticated GraphQL endpoints (91% coverage gap)',
          'Missing RLS on 77% of tables',
          'No role-based access control',
          'Session variable not set globally',
          'No audit logging',
        ],
        estimatedFixTime: '2-4 weeks',
        complianceImpact: {
          soc2: 'AUTOMATIC FAILURE',
          gdpr: 'VIOLATION (Articles 25, 32, 33)',
          hipaa: 'NON-COMPLIANT (if applicable)',
        },
        criticalActions: [
          'Implement global JWT authentication',
          'Set tenant context in GraphQL module',
          'Deploy RLS to core tables',
          'Implement RBAC framework',
          'Complete RLS rollout (all tables)',
        ],
        wordCount: deliverableContent.split(/\s+/).length,
        sectionsCount: (deliverableContent.match(/^## /gm) || []).length,
      },
      findings: {
        critical: [
          'V1: Unauthenticated GraphQL Access (21/23 resolvers unprotected)',
          'V2: Missing RLS on 80% of tables (62+ tables vulnerable)',
          'V3: Inconsistent tenant context setup (session variable not set)',
          'V4: No role-based access control (privilege escalation risk)',
        ],
        high: [
          'No field-level authorization',
          'GraphQL playground enabled in production',
          'No query complexity limiting',
          'No audit logging',
        ],
        medium: [
          'No rate limiting',
          'No query depth limiting',
          'Missing input validation',
        ],
      },
      recommendations: {
        immediate: [
          'BLOCK production deployment',
          'Implement Phase 1 security fixes (Week 1)',
          'Add JWT authentication to all resolvers',
          'Set tenant context globally',
          'Deploy RLS to core tables (tenants, users, facilities, billing_entities)',
        ],
        shortTerm: [
          'Implement RBAC with @Roles() decorator',
          'Complete RLS rollout (all 62+ remaining tables)',
          'Build security test suite',
          'Conduct internal penetration test',
        ],
        longTerm: [
          'Field-level authorization via GraphQL directives',
          'Query complexity and depth limiting',
          'Comprehensive audit logging',
          'External security audit',
          'SOC 2 Type II certification',
        ],
      },
    };

    // Publish to NATS subject
    const subject = `agog.deliverables.${AGENT}.${DELIVERABLE_TYPE}.${REQ_NUMBER}`;

    console.log(`📤 Publishing to subject: ${subject}`);
    nc.publish(subject, jc.encode(payload));

    // Also publish to the general deliverables stream for orchestrator
    const orchestratorSubject = 'agog.deliverables.completed';
    nc.publish(orchestratorSubject, jc.encode({
      reqNumber: REQ_NUMBER,
      agent: AGENT,
      stage: 'critique',
      status: 'COMPLETE',
      deliverableUrl: `nats://${subject}`,
      timestamp: new Date().toISOString(),
      riskLevel: 'CRITICAL',
      productionReady: false,
    }));

    console.log('✅ Deliverable published successfully!');
    console.log(`📊 Metadata:`);
    console.log(`   - Risk Level: ${payload.metadata.riskLevel}`);
    console.log(`   - Production Ready: ${payload.metadata.productionReady}`);
    console.log(`   - Blocking Issues: ${payload.metadata.blockingIssues.length}`);
    console.log(`   - Critical Findings: ${payload.findings.critical.length}`);
    console.log(`   - Word Count: ${payload.metadata.wordCount}`);
    console.log(`   - Sections: ${payload.metadata.sectionsCount}`);

    // Wait a moment to ensure message is sent
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    throw error;
  } finally {
    if (nc) {
      console.log('🔌 Closing NATS connection...');
      await nc.drain();
      console.log('✅ Connection closed');
    }
  }
}

// Execute if run directly
if (require.main === module) {
  publishCritique()
    .then(() => {
      console.log('✅ Publish script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Publish script failed:', error);
      process.exit(1);
    });
}

export { publishCritique };
