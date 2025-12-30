/**
 * NATS Publisher: Sylvia Critique Deliverable
 * REQ-STRATEGIC-AUTO-1767116143662: Advanced Email & Notification System
 *
 * Publishes Sylvia's critique to NATS for agent workflow coordination
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface SylviaCritiqueDeliverable {
  agent: 'sylvia';
  req_number: string;
  status: 'COMPLETE';
  deliverable_type: 'CRITIQUE';
  timestamp: string;
  critique: {
    research_quality_rating: string;
    approval_status: 'CONDITIONAL_APPROVAL' | 'APPROVED' | 'REJECTED';
    mandatory_conditions: number;
    critical_issues: number;
    major_issues: number;
    recommendations: number;
  };
  conditions: Array<{
    id: number;
    priority: 'CRITICAL' | 'MAJOR';
    title: string;
    responsible: string;
  }>;
  issues: Array<{
    id: number;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
    title: string;
    impact: string;
  }>;
  next_steps: Array<{
    agent: string;
    action: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  file_path: string;
  content_preview: string;
}

async function publishSylviaCritique() {
  const reqNumber = 'REQ-STRATEGIC-AUTO-1767116143662';
  const filePath = path.join(__dirname, '../docs/SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767116143662.md');

  // Read deliverable content
  const content = fs.readFileSync(filePath, 'utf-8');
  const preview = content.substring(0, 500) + '...';

  const deliverable: SylviaCritiqueDeliverable = {
    agent: 'sylvia',
    req_number: reqNumber,
    status: 'COMPLETE',
    deliverable_type: 'CRITIQUE',
    timestamp: new Date().toISOString(),
    critique: {
      research_quality_rating: '8.5/10',
      approval_status: 'CONDITIONAL_APPROVAL',
      mandatory_conditions: 8,
      critical_issues: 4,
      major_issues: 4,
      recommendations: 5,
    },
    conditions: [
      {
        id: 1,
        priority: 'CRITICAL',
        title: 'Use NATS JetStream Instead of BullMQ',
        responsible: 'Roy (Backend)',
      },
      {
        id: 2,
        priority: 'CRITICAL',
        title: 'Define Performance SLAs and Benchmark Current State',
        responsible: 'Roy (Backend) + Priya (Statistics)',
      },
      {
        id: 3,
        priority: 'CRITICAL',
        title: 'Implement Comprehensive Security Controls',
        responsible: 'Roy (Backend) + Vic (Security Tester)',
      },
      {
        id: 4,
        priority: 'CRITICAL',
        title: 'Implement Safe Migration Strategy with Rollback',
        responsible: 'Roy (Backend) + Berry (DevOps)',
      },
      {
        id: 5,
        priority: 'MAJOR',
        title: 'Start with Handlebars Only, Defer MJML',
        responsible: 'Roy (Backend)',
      },
      {
        id: 6,
        priority: 'MAJOR',
        title: 'Approve Budget for $1,000-2,000/Month Ongoing Costs',
        responsible: 'Product Owner + Finance',
      },
      {
        id: 7,
        priority: 'MAJOR',
        title: 'Implement Full Compliance Framework (CASL, GDPR, CAN-SPAM, TCPA)',
        responsible: 'Roy (Backend) + Legal Team',
      },
      {
        id: 8,
        priority: 'MAJOR',
        title: 'Implement Comprehensive Testing Strategy',
        responsible: 'Billy (QA) + Todd (Performance Tester)',
      },
    ],
    issues: [
      {
        id: 1,
        severity: 'CRITICAL',
        title: 'BullMQ vs NATS JetStream - Unnecessary Infrastructure Duplication',
        impact: 'Additional $15-50/month costs, dual messaging infrastructure complexity',
      },
      {
        id: 2,
        severity: 'CRITICAL',
        title: 'Performance Impact Not Analyzed',
        impact: 'Queue-based delivery may add 10-50ms latency vs synchronous approach',
      },
      {
        id: 3,
        severity: 'CRITICAL',
        title: 'Security Requirements Missing',
        impact: 'PII exposure risk, no encryption at rest, missing credential rotation policy',
      },
      {
        id: 4,
        severity: 'CRITICAL',
        title: 'Migration Strategy Incomplete',
        impact: 'Risk of breaking existing email integrations, no rollback procedure',
      },
      {
        id: 5,
        severity: 'MAJOR',
        title: 'Template Engine Overkill (MJML + Handlebars)',
        impact: 'Overengineered for 3 existing templates, +1.2MB bundle size',
      },
      {
        id: 6,
        severity: 'MAJOR',
        title: 'Cost Analysis Incomplete',
        impact: 'TCO underestimated by 50-70%, actual costs $1,000-2,000/month vs $20-50/month',
      },
      {
        id: 7,
        severity: 'MAJOR',
        title: 'Compliance Gaps (CASL, Data Residency)',
        impact: 'Missing Canadian Anti-Spam Legislation compliance, no data residency strategy',
      },
      {
        id: 8,
        severity: 'MAJOR',
        title: 'Testing Strategy Insufficient',
        impact: 'No chaos engineering, load testing too low (100k vs 1M+ peak)',
      },
    ],
    next_steps: [
      {
        agent: 'Roy',
        action: 'Review critique and decide on BullMQ vs NATS JetStream',
        priority: 'HIGH',
      },
      {
        agent: 'Product Owner',
        action: 'Get executive approval for budget ($1,000-2,000/month)',
        priority: 'HIGH',
      },
      {
        agent: 'Legal Team',
        action: 'Review compliance requirements (CASL, GDPR, CAN-SPAM, TCPA)',
        priority: 'HIGH',
      },
      {
        agent: 'Roy',
        action: 'Define performance SLAs and benchmark current email performance',
        priority: 'HIGH',
      },
      {
        agent: 'Priya',
        action: 'Analyze historical email volumes to determine peak load requirements',
        priority: 'MEDIUM',
      },
      {
        agent: 'Roy',
        action: 'Create migration plan with feature flags and rollback procedure',
        priority: 'HIGH',
      },
    ],
    file_path: filePath,
    content_preview: preview,
  };

  try {
    // Connect to NATS
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    console.log(`📡 Connecting to NATS at ${natsUrl}...`);
    const nc = await connect({ servers: natsUrl });
    const sc = StringCodec();

    // Publish to NATS
    const subject = `agog.deliverables.sylvia.critique.${reqNumber}`;
    console.log(`📤 Publishing Sylvia critique to: ${subject}`);
    nc.publish(subject, sc.encode(JSON.stringify(deliverable, null, 2)));

    console.log('✅ Sylvia critique published successfully!');
    console.log(`\n📊 Critique Summary:`);
    console.log(`   - Research Quality Rating: ${deliverable.critique.research_quality_rating}`);
    console.log(`   - Approval Status: ${deliverable.critique.approval_status}`);
    console.log(`   - Mandatory Conditions: ${deliverable.critique.mandatory_conditions}`);
    console.log(`   - Critical Issues: ${deliverable.critique.critical_issues}`);
    console.log(`   - Major Issues: ${deliverable.critique.major_issues}`);
    console.log(`\n🚨 Top 4 Critical Issues:`);
    deliverable.issues
      .filter(i => i.severity === 'CRITICAL')
      .forEach(issue => {
        console.log(`   ${issue.id}. ${issue.title}`);
        console.log(`      Impact: ${issue.impact}`);
      });
    console.log(`\n✅ 8 Mandatory Conditions:`);
    deliverable.conditions.forEach(condition => {
      console.log(`   ${condition.id}. [${condition.priority}] ${condition.title}`);
      console.log(`      Responsible: ${condition.responsible}`);
    });
    console.log(`\n📋 Next Steps (${deliverable.next_steps.length} actions):`);
    deliverable.next_steps.forEach(step => {
      console.log(`   - ${step.agent}: ${step.action} [${step.priority}]`);
    });

    await nc.drain();
    console.log('\n🎯 NATS connection closed.');
  } catch (error) {
    console.error('❌ Failed to publish Sylvia critique:', error);
    process.exit(1);
  }
}

// Run the publisher
publishSylviaCritique().catch(console.error);
