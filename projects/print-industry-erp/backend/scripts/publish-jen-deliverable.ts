#!/usr/bin/env ts-node
/**
 * Publish Jen's Frontend Deliverable to NATS
 * REQ-1767925582663-ieqg0: FedEx Carrier Integration & Multi-Carrier Network
 */

import { NATSDeliverableService } from '../src/nats/nats-deliverable.service';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function publishJenDeliverable() {
  console.log('📦 Publishing Jen Frontend Deliverable to NATS');
  console.log('================================================\n');

  const natsService = new NATSDeliverableService();

  try {
    // Connect to NATS
    console.log('📡 Connecting to NATS...');
    await natsService.initialize();
    console.log('✅ Connected\n');

    // Read deliverable markdown
    const deliverablePath = path.join(
      __dirname,
      '../../.deliverables/REQ-1767925582663-ieqg0-jen-frontend-deliverable.md'
    );

    console.log(`📄 Reading deliverable from: ${deliverablePath}`);
    const deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');
    console.log(`✅ Read ${deliverableContent.length} characters\n`);

    // Publish to NATS
    const reqNumber = 'REQ-1767925582663-ieqg0';

    console.log('Publishing to NATS...');
    await natsService.publishReport({
      agent: 'jen',
      taskType: 'frontend',
      featureName: reqNumber,
      reportContent: deliverableContent,
      metadata: {
        req_number: reqNumber,
        files_created: 14,
        files_modified: 3,
        components_created: 10,
        pages_created: 4,
        graphql_queries: 9,
        graphql_mutations: 10,
        translation_keys: 252,
        implementation_complete: true,
      },
    });

    console.log('✅ Published to NATS\n');

    // Create completion notice
    const completionNotice = natsService.createCompletionNotice(
      'jen',
      reqNumber,
      natsService.buildChannelName('jen', 'frontend', reqNumber),
      'Completed FedEx Carrier Integration & Multi-Carrier Network frontend implementation',
      {
        complexity: 'Complex',
        files_modified: 17,
        ready_for_next_stage: true,
        status: 'complete',
      }
    );

    console.log('📋 Completion Notice:');
    console.log(JSON.stringify(completionNotice, null, 2));
    console.log('');

    // Close connection
    await natsService.close();
    console.log('✅ Deliverable published successfully!\n');
    console.log(`📍 NATS Topic: agog.deliverables.jen.frontend.${reqNumber}`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to publish deliverable:', error.message);
    console.error(error);
    await natsService.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  publishJenDeliverable();
}

export { publishJenDeliverable };
