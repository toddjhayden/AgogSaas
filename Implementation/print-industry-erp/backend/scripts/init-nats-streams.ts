#!/usr/bin/env ts-node
/**
 * Initialize NATS Jetstream Streams
 * Script to setup all agent deliverable streams
 *
 * Usage:
 *   npm run init:nats-streams
 *   OR
 *   ts-node scripts/init-nats-streams.ts
 */

import { NATSClient } from '../src/nats/nats-client.service';
import dotenv from 'dotenv';

dotenv.config();

async function initializeNATSStreams() {
  console.log('🚀 NATS Jetstream Stream Initialization');
  console.log('========================================\n');

  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  console.log(`📡 Connecting to NATS: ${natsUrl}\n`);

  const client = new NATSClient(natsUrl);

  try {
    // Connect to NATS (this also initializes streams)
    await client.connect();

    console.log('\n✅ All streams initialized successfully!\n');

    // Display stream status
    console.log('📊 Stream Status:');
    console.log('================\n');

    const streams = await client.getAllStreamsStatus();

    for (const stream of streams) {
      console.log(`Stream: ${stream.name}`);
      console.log(`  Messages: ${stream.messages}`);
      console.log(`  Bytes: ${(stream.bytes / 1024).toFixed(2)} KB`);
      console.log(`  Consumers: ${stream.consumer_count}`);
      console.log('');
    }

    console.log('🎯 Agent Deliverable Channels:');
    console.log('==============================\n');
    console.log('  agog.deliverables.cynthia.[type].[feature]  → Research');
    console.log('  agog.deliverables.sylvia.[type].[feature]   → Critique');
    console.log('  agog.deliverables.roy.[type].[feature]      → Backend');
    console.log('  agog.deliverables.jen.[type].[feature]      → Frontend');
    console.log('  agog.deliverables.billy.[type].[feature]    → QA');
    console.log('  agog.deliverables.priya.[type].[feature]    → Statistics');
    console.log('');

    console.log('💡 Example Usage:');
    console.log('=================\n');
    console.log('  Publish:');
    console.log('    await natsClient.publishDeliverable({');
    console.log("      agent: 'cynthia',");
    console.log("      taskType: 'research',");
    console.log("      feature: 'customer-search',");
    console.log("      content: 'Full research report...',");
    console.log('    });\n');
    console.log('  Fetch:');
    console.log("    const report = await natsClient.fetchDeliverable('cynthia', 'research', 'customer-search');\n");

    await client.close();

    console.log('✅ Initialization complete!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Initialization failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeNATSStreams();
}

export { initializeNATSStreams };
