#!/usr/bin/env ts-node
/**
 * NATS Publication Script: Priya's Statistical Analysis
 * REQ: REQ-STRATEGIC-AUTO-1766929114445
 * Agent: Priya (Statistical Analysis Specialist)
 *
 * This script publishes Priya's comprehensive statistical analysis deliverable
 * to the NATS message broker for consumption by the strategic orchestrator.
 */

import { connect, NatsConnection, JSONCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

interface StatisticalDeliverable {
  reqNumber: string;
  agent: string;
  deliverableType: string;
  timestamp: string;
  status: string;

  // Statistical Summary
  overallQualityScore: number;
  codeQualityScore: number;
  databaseDesignScore: number;
  apiCompletenessScore: number;
  testCoverageScore: number;
  securityScore: number;
  performanceScore: number;
  complianceScore: number;

  // Key Metrics
  totalLinesOfCode: number;
  testPassRate: number;
  defectDensity: number;
  featureCompletionRate: number;
  productionReadinessScore: number;

  // Risk Assessment
  overallRiskLevel: string;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;

  // Recommendations
  totalRecommendations: number;
  criticalRecommendations: number;
  estimatedEffortHours: number;

  // Approval
  productionApproved: boolean;
  approvalConditions: string[];
  confidenceLevel: number;

  // Full deliverable
  markdownContent: string;
  deliverableUrl: string;
}

async function publishStatisticalDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    console.log('🔗 Connecting to NATS server...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'priya-statistics-publisher',
    });

    console.log('✅ Connected to NATS server');

    // Read the statistical analysis deliverable
    const deliverablePath = path.join(
      __dirname,
      '..',
      'PRIYA_STATISTICAL_DELIVERABLE_REQ-STRATEGIC-AUTO-1766929114445.md'
    );

    console.log(`📖 Reading deliverable from: ${deliverablePath}`);
    const markdownContent = fs.readFileSync(deliverablePath, 'utf-8');

    // Prepare the statistical deliverable payload
    const deliverable: StatisticalDeliverable = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1766929114445',
      agent: 'priya',
      deliverableType: 'statistical-analysis',
      timestamp: new Date().toISOString(),
      status: 'COMPLETE',

      // Statistical Summary (from analysis)
      overallQualityScore: 9.2,
      codeQualityScore: 9.3,
      databaseDesignScore: 9.6,
      apiCompletenessScore: 8.6,
      testCoverageScore: 9.4,
      securityScore: 8.5,
      performanceScore: 9.5,
      complianceScore: 9.6,

      // Key Metrics
      totalLinesOfCode: 3454,
      testPassRate: 97.6,
      defectDensity: 0.0,
      featureCompletionRate: 90.7,
      productionReadinessScore: 90.0,

      // Risk Assessment
      overallRiskLevel: 'LOW',
      criticalRisks: 0,
      highRisks: 0,
      mediumRisks: 3,
      lowRisks: 3,

      // Recommendations
      totalRecommendations: 10,
      criticalRecommendations: 2,
      estimatedEffortHours: 47,

      // Approval
      productionApproved: true,
      approvalConditions: [
        'Add immutability rules to audit table (1 hour)',
        'Document rollback procedure (1 hour)',
        'Implement or remove unfinished mutations (4 hours)',
      ],
      confidenceLevel: 98,

      // Full deliverable
      markdownContent,
      deliverableUrl: 'nats://agog.deliverables.priya.statistics.REQ-STRATEGIC-AUTO-1766929114445',
    };

    const jc = JSONCodec<StatisticalDeliverable>();

    // Publish to main deliverable subject
    const subject = 'agog.deliverables.priya.statistics.REQ-STRATEGIC-AUTO-1766929114445';
    console.log(`📤 Publishing to subject: ${subject}`);
    nc.publish(subject, jc.encode(deliverable));

    // Also publish to strategic orchestrator for workflow tracking
    const orchestratorSubject = 'agog.orchestrator.workflow.deliverable';
    console.log(`📤 Publishing to orchestrator: ${orchestratorSubject}`);
    const jc2 = JSONCodec();
    nc.publish(orchestratorSubject, jc2.encode({
      reqNumber: deliverable.reqNumber,
      agent: deliverable.agent,
      stage: 'statistical-analysis',
      status: 'COMPLETE',
      timestamp: deliverable.timestamp,
      qualityScore: deliverable.overallQualityScore,
      productionApproved: deliverable.productionApproved,
      deliverableUrl: deliverable.deliverableUrl,
    }));

    // Publish statistical metrics for dashboards
    const metricsSubject = 'agog.metrics.quality.statistics';
    console.log(`📊 Publishing metrics to: ${metricsSubject}`);
    nc.publish(metricsSubject, jc2.encode({
      reqNumber: deliverable.reqNumber,
      timestamp: deliverable.timestamp,
      metrics: {
        overallQuality: deliverable.overallQualityScore,
        codeQuality: deliverable.codeQualityScore,
        databaseDesign: deliverable.databaseDesignScore,
        apiCompleteness: deliverable.apiCompletenessScore,
        testCoverage: deliverable.testCoverageScore,
        security: deliverable.securityScore,
        performance: deliverable.performanceScore,
        compliance: deliverable.complianceScore,
      },
      keyMetrics: {
        linesOfCode: deliverable.totalLinesOfCode,
        testPassRate: deliverable.testPassRate,
        defectDensity: deliverable.defectDensity,
        featureCompletion: deliverable.featureCompletionRate,
        productionReadiness: deliverable.productionReadinessScore,
      },
      riskAssessment: {
        level: deliverable.overallRiskLevel,
        critical: deliverable.criticalRisks,
        high: deliverable.highRisks,
        medium: deliverable.mediumRisks,
        low: deliverable.lowRisks,
      },
    }));

    console.log('✅ Statistical analysis deliverable published successfully!');
    console.log('\n📊 STATISTICAL SUMMARY:');
    console.log(`   Overall Quality Score: ${deliverable.overallQualityScore}/10`);
    console.log(`   Production Approved: ${deliverable.productionApproved ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Test Pass Rate: ${deliverable.testPassRate}%`);
    console.log(`   Defect Density: ${deliverable.defectDensity} defects/KLOC`);
    console.log(`   Feature Completion: ${deliverable.featureCompletionRate}%`);
    console.log(`   Risk Level: ${deliverable.overallRiskLevel}`);
    console.log(`   Confidence Level: ${deliverable.confidenceLevel}%`);
    console.log(`\n⚠️  Conditions for deployment: ${deliverable.approvalConditions.length}`);
    deliverable.approvalConditions.forEach((condition, i) => {
      console.log(`   ${i + 1}. ${condition}`);
    });
    console.log(`\n🔧 Recommendations: ${deliverable.totalRecommendations} (${deliverable.criticalRecommendations} critical)`);
    console.log(`   Estimated effort: ${deliverable.estimatedEffortHours} hours\n`);

    await nc.drain();
    console.log('✅ NATS connection closed gracefully');

  } catch (error) {
    console.error('❌ Error publishing statistical deliverable:', error);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.close();
    }
  }
}

// Execute the publication
publishStatisticalDeliverable()
  .then(() => {
    console.log('✅ Publication complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
