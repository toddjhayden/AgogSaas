#!/usr/bin/env node

// Layer 3: Setup NATS Jetstream streams for agent orchestration

const { connect } = require('nats');

const STREAMS = [
  { name: 'agog_features_requests', subjects: ['agog.features.requests.*'] },
  { name: 'agog_features_research', subjects: ['agog.features.research.*'] },
  { name: 'agog_features_critique', subjects: ['agog.features.critique.*'] },
  { name: 'agog_features_backend', subjects: ['agog.features.backend.*'] },
  { name: 'agog_features_frontend', subjects: ['agog.features.frontend.*'] },
  { name: 'agog_features_qa', subjects: ['agog.features.qa.*'] },
  { name: 'agog_features_statistics', subjects: ['agog.features.statistics.*'] },
];

async function setupStreams() {
  try {
    const nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    const jsm = await nc.jetstreamManager();

    console.log('🚀 Setting up NATS Jetstream streams...\n');

    for (const stream of STREAMS) {
      try {
        await jsm.streams.add({
          name: stream.name,
          subjects: stream.subjects,
          retention: 'limits',
          max_age: 30 * 24 * 60 * 60 * 1000000000, // 30 days in nanoseconds
          storage: 'file',
        });
        console.log(`✅ Created stream: ${stream.name}`);
      } catch (err) {
        if (err.message.includes('already in use')) {
          console.log(`⚠️  Stream exists: ${stream.name}`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ NATS Jetstream setup complete!');
    await nc.close();
  } catch (error) {
    console.error('❌ Failed to setup NATS streams:', error);
    process.exit(1);
  }
}

setupStreams();
