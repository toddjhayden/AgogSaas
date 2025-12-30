#!/usr/bin/env ts-node

/**
 * SYLVIA CRITIQUE DELIVERABLE PUBLISHER
 * REQ-STRATEGIC-AUTO-1767116143667: HR & Payroll Integration Module
 *
 * Publishes Sylvia's critical analysis of Cynthia's research to NATS
 * for Product Owner and backend team review.
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

interface CritiqueDeliverable {
  agent: string;
  reqNumber: string;
  title: string;
  timestamp: string;
  deliverableType: string;
  status: string;
  researchReviewed: string;
  critiqueSummary: {
    researchQuality: number;
    implementationReadiness: number;
    criticalIssuesFound: number;
    architecturalRisksIdentified: number;
    mandatoryConditions: number;
    estimatedTimelineImpact: string;
  };
  conditions: Array<{
    id: number;
    severity: string;
    title: string;
    description: string;
    blocking: boolean;
  }>;
  risks: Array<{
    id: number;
    severity: string;
    title: string;
    impact: string;
  }>;
  recommendations: {
    approvalStatus: string;
    nextSteps: string[];
    redFlags: string[];
  };
  deliverableMarkdown: string;
}

async function publishCritiqueDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    console.log('📡 Connecting to NATS...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
    });

    console.log('✅ Connected to NATS');

    // Read the critique deliverable markdown
    const deliverablePath = path.join(
      __dirname,
      '..',
      'SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767116143667.md'
    );

    const markdownContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Build structured critique payload
    const critique: CritiqueDeliverable = {
      agent: 'sylvia',
      reqNumber: 'REQ-STRATEGIC-AUTO-1767116143667',
      title: 'HR & Payroll Integration Module - Critical Critique',
      timestamp: new Date().toISOString(),
      deliverableType: 'CRITIQUE',
      status: 'COMPLETE',
      researchReviewed:
        'nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767116143667',
      critiqueSummary: {
        researchQuality: 95,
        implementationReadiness: 70,
        criticalIssuesFound: 5,
        architecturalRisksIdentified: 3,
        mandatoryConditions: 5,
        estimatedTimelineImpact: '+100 hours (+24%)',
      },
      conditions: [
        {
          id: 1,
          severity: 'BLOCKING',
          title: 'Tax Engine Strategy Decision',
          description:
            'Must decide Build vs. Buy vs. Hybrid for tax calculation engine. Recommended: Hybrid (Federal in-house + State/Local via API).',
          blocking: true,
        },
        {
          id: 2,
          severity: 'BLOCKING',
          title: 'Compliance Risk Mitigation Plan',
          description:
            'Legal review required for payroll schema. Must document error recovery protocol and audit trail.',
          blocking: true,
        },
        {
          id: 3,
          severity: 'BLOCKING',
          title: 'Performance Baseline Testing',
          description:
            'Must prove < 5 minute processing time for 1000 employees. Batch processing pattern required.',
          blocking: true,
        },
        {
          id: 4,
          severity: 'IMPORTANT',
          title: 'Data Migration Dry Run',
          description:
            'YTD reconciliation and historical tax validation required before production migration.',
          blocking: false,
        },
        {
          id: 5,
          severity: 'BLOCKING',
          title: 'Module Refactoring FIRST',
          description:
            'Extract HRModule from QualityModule BEFORE starting Phase 1 payroll work.',
          blocking: true,
        },
      ],
      risks: [
        {
          id: 1,
          severity: 'HIGH',
          title: 'Multi-Tenant Tax Calculation',
          impact:
            'Missing facility_tax_jurisdictions and employee_work_locations tables. Cannot calculate state/local taxes correctly.',
        },
        {
          id: 2,
          severity: 'MEDIUM',
          title: 'Payroll Batch Processing Deadlocks',
          impact:
            'Single transaction processing will cause deadlocks. Must use batch processing with savepoints.',
        },
        {
          id: 3,
          severity: 'MEDIUM',
          title: 'Currency Precision Loss',
          impact:
            'DECIMAL(15,2) causes rounding errors. Must use DECIMAL(15,4) for all monetary values.',
        },
      ],
      recommendations: {
        approvalStatus: 'APPROVED WITH CONDITIONS',
        nextSteps: [
          'Roy: Module refactoring (2-3 hours)',
          'Product Owner: Tax engine strategy decision (1 day)',
          'Legal: Employment law review (1 week)',
          'Roy: Performance baseline tests (1 day)',
          'Roy: Begin Phase 1 with revised estimates (120-160 hours)',
        ],
        redFlags: [
          'Starting Phase 1 without tax engine decision',
          'Skipping legal review to save time',
          'Processing all employees in single transaction',
          'Using DECIMAL(15,2) for monetary values',
          'No performance testing until Phase 3',
          'Implementing payroll in current QualityModule',
        ],
      },
      deliverableMarkdown: markdownContent,
    };

    // Publish to NATS
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767116143667';
    nc.publish(subject, sc.encode(JSON.stringify(critique)));

    console.log(`✅ Published critique to: ${subject}`);
    console.log('📊 Critique Summary:');
    console.log(`   - Research Quality: ${critique.critiqueSummary.researchQuality}/100`);
    console.log(
      `   - Implementation Readiness: ${critique.critiqueSummary.implementationReadiness}/100`
    );
    console.log(
      `   - Critical Issues: ${critique.critiqueSummary.criticalIssuesFound}`
    );
    console.log(
      `   - Architectural Risks: ${critique.critiqueSummary.architecturalRisksIdentified}`
    );
    console.log(
      `   - Mandatory Conditions: ${critique.critiqueSummary.mandatoryConditions}`
    );
    console.log(
      `   - Timeline Impact: ${critique.critiqueSummary.estimatedTimelineImpact}`
    );
    console.log('');
    console.log('⚠️  APPROVAL STATUS: APPROVED WITH 5 MANDATORY CONDITIONS');
    console.log('');
    console.log('🔴 BLOCKING CONDITIONS (must be met before Phase 1):');
    critique.conditions
      .filter((c) => c.blocking)
      .forEach((c) => {
        console.log(`   ${c.id}. ${c.title}`);
      });

    // Flush and close
    await nc.flush();
    console.log('✅ Critique deliverable published successfully');
  } catch (error) {
    console.error('❌ Error publishing critique:', error);
    throw error;
  } finally {
    if (nc) {
      await nc.close();
      console.log('🔌 Disconnected from NATS');
    }
  }
}

// Run if called directly
if (require.main === module) {
  publishCritiqueDeliverable()
    .then(() => {
      console.log('✅ Critique publication complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Critique publication failed:', error);
      process.exit(1);
    });
}

export { publishCritiqueDeliverable };
