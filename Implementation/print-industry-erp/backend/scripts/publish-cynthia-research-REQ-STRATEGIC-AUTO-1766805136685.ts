#!/usr/bin/env ts-node
/**
 * Publish Sales Quote Automation Research Deliverable to NATS
 * REQ-STRATEGIC-AUTO-1766805136685
 */

import { connect, NatsConnection } from 'nats';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ResearchDeliverable {
  reqNumber: string;
  agent: string;
  agentRole: string;
  title: string;
  deliverableType: string;
  content: string;
  timestamp: string;
  status: string;
  metadata: {
    featureTitle: string;
    filesAnalyzed: number;
    totalLines: number;
    techStack: string[];
    components: {
      backend: string[];
      frontend: string[];
      database: string[];
    };
    businessLogic: {
      pricingMethods: string[];
      costingMethods: string[];
      marginThresholds: {
        minimum: number;
        managerApproval: number;
        vpApproval: number;
      };
    };
    deployment: {
      migrationVersion: string;
      deploymentScript: string;
      healthCheckScript: string;
    };
  };
}

async function publishToNats() {
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
  const user = process.env.NATS_USER || 'agents';
  const pass = process.env.NATS_PASSWORD;
  if (!pass) {
    throw new Error('NATS_PASSWORD environment variable is required');
  }

  console.log('Connecting to NATS...');
  const nc: NatsConnection = await connect({
    servers: natsUrl,
    user,
    pass,
    name: 'cynthia-research-publisher'
  });

  console.log('✅ Connected to NATS\n');

  // Read research report
  const reportPath = join(__dirname, '..', 'CYNTHIA_RESEARCH_REQ-STRATEGIC-AUTO-1766805136685.md');
  const content = readFileSync(reportPath, 'utf-8');

  const deliverable: ResearchDeliverable = {
    reqNumber: 'REQ-STRATEGIC-AUTO-1766805136685',
    agent: 'cynthia',
    agentRole: 'research',
    title: 'Sales Quote Automation - Research Report',
    deliverableType: 'RESEARCH_REPORT',
    content: content,
    timestamp: new Date().toISOString(),
    status: 'COMPLETE',
    metadata: {
      featureTitle: 'Sales Quote Automation',
      filesAnalyzed: 15,
      totalLines: 5900,
      techStack: ['NestJS', 'GraphQL', 'React', 'PostgreSQL', 'TypeScript'],
      components: {
        backend: [
          'QuoteManagementService',
          'QuotePricingService',
          'PricingRuleEngineService',
          'QuoteCostingService'
        ],
        frontend: [
          'SalesQuoteDashboard',
          'SalesQuoteDetailPage'
        ],
        database: [
          'quotes',
          'quote_lines',
          'pricing_rules',
          'customer_pricing',
          'products',
          'materials',
          'bill_of_materials'
        ]
      },
      businessLogic: {
        pricingMethods: [
          'Customer-Specific Pricing',
          'Pricing Rules (Priority-Based)',
          'List Price',
          'Manual Override'
        ],
        costingMethods: [
          'Standard Cost',
          'BOM Explosion (5 levels deep)',
          'FIFO',
          'LIFO',
          'Average'
        ],
        marginThresholds: {
          minimum: 15,
          managerApproval: 20,
          vpApproval: 10
        }
      },
      deployment: {
        migrationVersion: 'V0.0.6',
        deploymentScript: 'deploy-sales-quote-automation.sh',
        healthCheckScript: 'health-check-sales-quotes.sh'
      }
    }
  };

  // Publish to NATS
  const subject = 'agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1766805136685';
  nc.publish(subject, JSON.stringify(deliverable, null, 2));

  console.log(`✅ Published research deliverable to NATS`);
  console.log(`   Subject: ${subject}`);
  console.log(`   REQ Number: ${deliverable.reqNumber}`);
  console.log(`   Title: ${deliverable.title}`);
  console.log(`   Agent: ${deliverable.agent} (${deliverable.agentRole})`);
  console.log(`   Status: ${deliverable.status}`);
  console.log(`   Files Analyzed: ${deliverable.metadata.filesAnalyzed}`);
  console.log(`   Total Lines of Code: ${deliverable.metadata.totalLines}`);
  console.log(`   Tech Stack: ${deliverable.metadata.techStack.join(', ')}`);
  console.log(`   Backend Services: ${deliverable.metadata.components.backend.length}`);
  console.log(`   Frontend Pages: ${deliverable.metadata.components.frontend.length}`);
  console.log(`   Database Tables: ${deliverable.metadata.components.database.length}`);

  await nc.flush();
  await nc.close();
  console.log('\n✅ NATS connection closed');
}

if (require.main === module) {
  publishToNats()
    .then(() => {
      console.log('\n✅ Research publication complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Publication failed:', error);
      process.exit(1);
    });
}

export { publishToNats };
