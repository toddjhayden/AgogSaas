/**
 * Initialize NATS Streams for Strategic Orchestration
 *
 * This script creates the necessary NATS JetStream streams for:
 * 1. Strategic decisions (Marcus, Sarah, Alex decisions)
 * 2. Strategic escalations (human review queue)
 *
 * Run this before starting the strategic orchestrator daemon.
 */

import { connect, NatsConnection, StorageType, RetentionPolicy, StreamConfig, DiscardPolicy } from 'nats';

async function initializeStrategicStreams() {
  console.log('🚀 Initializing Strategic NATS Streams\n');

  let nc: NatsConnection | null = null;

  try {
    // Connect to NATS
    console.log('Connecting to NATS...');
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';

    const connectionOptions: any = {
      servers: natsUrl,
      name: 'init-strategic-streams',
    };

    // Add credentials if not in URL
    if (!natsUrl.includes('@')) {
      const user = process.env.NATS_USER;
      const pass = process.env.NATS_PASSWORD;
      if (user && pass) {
        connectionOptions.user = user;
        connectionOptions.pass = pass;
        console.log(`Using credentials for user: ${user}`);
      }
    }

    nc = await connect(connectionOptions);
    console.log('✅ Connected to NATS\n');

    const jsm = await nc.jetstreamManager();

    // Stream 1: Strategic Decisions
    console.log('Creating stream: agog_strategic_decisions');
    try {
      await jsm.streams.info('agog_strategic_decisions');
      console.log('⚠️  Stream agog_strategic_decisions already exists');
    } catch (error) {
      const decisionsConfig: Partial<StreamConfig> = {
        name: 'agog_strategic_decisions',
        subjects: ['agog.strategic.decisions.>'],
        storage: StorageType.File,
        retention: RetentionPolicy.Limits,
        max_msgs: 10000,
        max_bytes: 100 * 1024 * 1024, // 100MB
        max_age: 30 * 24 * 60 * 60 * 1_000_000_000, // 30 days (nanoseconds)
        discard: DiscardPolicy.Old,
      };

      await jsm.streams.add(decisionsConfig);
      console.log('✅ Stream agog_strategic_decisions created');
    }

    // Stream 2: Strategic Escalations
    console.log('\nCreating stream: agog_strategic_escalations');
    try {
      await jsm.streams.info('agog_strategic_escalations');
      console.log('⚠️  Stream agog_strategic_escalations already exists');
    } catch (error) {
      const escalationsConfig: Partial<StreamConfig> = {
        name: 'agog_strategic_escalations',
        subjects: ['agog.strategic.escalations.>'],
        storage: StorageType.File,
        retention: RetentionPolicy.Limits,
        max_msgs: 5000,
        max_bytes: 50 * 1024 * 1024, // 50MB
        max_age: 90 * 24 * 60 * 60 * 1_000_000_000, // 90 days (nanoseconds)
        discard: DiscardPolicy.Old,
      };

      await jsm.streams.add(escalationsConfig);
      console.log('✅ Stream agog_strategic_escalations created');
    }

    // Create consumer for blocked workflow handling
    console.log('\nCreating consumer: strategic_blocked_handler');
    try {
      await jsm.consumers.info('agog_orchestration_events', 'strategic_blocked_handler');
      console.log('⚠️  Consumer strategic_blocked_handler already exists');
    } catch (error) {
      await jsm.consumers.add('agog_orchestration_events', {
        durable_name: 'strategic_blocked_handler',
        ack_policy: 'explicit' as any,
        filter_subject: 'agog.orchestration.events.stage.blocked',
      });
      console.log('✅ Consumer strategic_blocked_handler created');
    }

    console.log('\n✅ All strategic streams and consumers initialized successfully!');
    console.log('\nYou can now start the strategic orchestrator daemon.\n');

    // Show summary
    console.log('Summary:');
    console.log('  - agog_strategic_decisions: Stores strategic agent decisions (30 day retention)');
    console.log('  - agog_strategic_escalations: Human escalation queue (90 day retention)');
    console.log('  - strategic_blocked_handler: Consumer for blocked workflow events');

  } catch (error: any) {
    console.error('❌ Failed to initialize strategic streams:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.close();
      console.log('\n✅ Connection closed');
    }
  }
}

// Run initialization
initializeStrategicStreams().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
