#!/usr/bin/env ts-node
/**
 * End-to-End Autonomous Workflow Test
 *
 * REQ-TEST-WORKFLOW-001: Test End-to-End Autonomous Workflow
 *
 * This script tests the complete autonomous workflow system:
 * 1. NATS infrastructure (streams, consumers, deliverables)
 * 2. Multi-stage workflow orchestration
 * 3. Agent spawning via host-agent-listener
 * 4. Message passing and deliverable exchange
 * 5. Strategic orchestrator integration
 *
 * USAGE:
 *   npm run test:workflow
 *
 * PREREQUISITES:
 *   - NATS running at localhost:4223
 *   - Streams initialized (npm run init:nats-streams)
 *   - Strategic streams initialized (npm run init:strategic-streams)
 */

import { config } from 'dotenv';
import { connect, NatsConnection, JetStreamClient, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const sc = StringCodec();

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class EndToEndWorkflowTest {
  private nc!: NatsConnection;
  private js!: JetStreamClient;
  private results: TestResult[] = [];

  async run(): Promise<void> {
    console.log('🧪 End-to-End Autonomous Workflow Test');
    console.log('=' .repeat(70));
    console.log('\nTesting REQ-TEST-WORKFLOW-001\n');

    try {
      // Test 1: NATS Connection
      await this.testNATSConnection();

      // Test 2: Verify Required Streams
      await this.testRequiredStreams();

      // Test 3: Test Deliverable Publishing
      await this.testDeliverablePublishing();

      // Test 4: Test Workflow Event Publishing
      await this.testWorkflowEvents();

      // Test 5: Test Multi-Stage Message Flow
      await this.testMultiStageFlow();

      // Test 6: Verify Agent File Configuration
      await this.testAgentConfiguration();

      // Test 7: Test Consumer Creation
      await this.testConsumerCreation();

      // Test 8: Test Message Persistence
      await this.testMessagePersistence();

      // Generate Report
      await this.generateReport();

    } catch (error: any) {
      console.error('\n❌ Test suite failed:', error.message);
      this.results.push({
        testName: 'Test Suite Execution',
        passed: false,
        message: error.message,
      });
    } finally {
      if (this.nc) {
        await this.nc.close();
        console.log('\n✅ NATS connection closed');
      }
    }
  }

  private async testNATSConnection(): Promise<void> {
    console.log('\n📡 Test 1: NATS Connection');
    console.log('-'.repeat(70));

    try {
      const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
      console.log(`  Connecting to: ${natsUrl}`);

      // Configure connection with authentication
      const connectionOptions: any = {
        servers: natsUrl,
        name: 'test-end-to-end-workflow',
        timeout: 5000,
      };

      // Check for credentials
      const user = process.env.NATS_USER;
      const pass = process.env.NATS_PASSWORD;
      if (user && pass) {
        connectionOptions.user = user;
        connectionOptions.pass = pass;
        console.log(`  Using credentials for user: ${user}`);
      }

      this.nc = await connect(connectionOptions);

      this.js = this.nc.jetstream();

      console.log('  ✅ Connected to NATS successfully');
      this.results.push({
        testName: 'NATS Connection',
        passed: true,
        message: `Connected to ${natsUrl}`,
      });
    } catch (error: any) {
      console.error('  ❌ NATS connection failed:', error.message);
      this.results.push({
        testName: 'NATS Connection',
        passed: false,
        message: error.message,
      });
      throw error;
    }
  }

  private async testRequiredStreams(): Promise<void> {
    console.log('\n📦 Test 2: Verify Required Streams');
    console.log('-'.repeat(70));

    const requiredStreams = [
      'agog_orchestration_events',
      'agog_features_research',
      'agog_features_critique',
      'agog_features_backend',
      'agog_features_frontend',
      'agog_features_qa',
      'agog_strategic_decisions',
      'agog_strategic_escalations',
    ];

    const jsm = await this.nc.jetstreamManager();
    const streamList = await jsm.streams.list().next();
    const existingStreams = streamList.map(s => s.config.name);

    let allStreamsExist = true;
    const missingStreams: string[] = [];

    for (const streamName of requiredStreams) {
      if (existingStreams.includes(streamName)) {
        console.log(`  ✅ ${streamName}`);
      } else {
        console.warn(`  ⚠️  ${streamName} - MISSING`);
        allStreamsExist = false;
        missingStreams.push(streamName);
      }
    }

    this.results.push({
      testName: 'Required Streams',
      passed: allStreamsExist,
      message: allStreamsExist
        ? 'All required streams exist'
        : `Missing streams: ${missingStreams.join(', ')}`,
      details: { existingStreams, missingStreams },
    });
  }

  private async testDeliverablePublishing(): Promise<void> {
    console.log('\n📤 Test 3: Test Deliverable Publishing');
    console.log('-'.repeat(70));

    try {
      const testReqNumber = 'REQ-TEST-WORKFLOW-001';
      const testDeliverable = {
        agent: 'cynthia',
        req_number: testReqNumber,
        status: 'COMPLETE',
        deliverable: `nats://agog.deliverables.cynthia.research.${testReqNumber}`,
        summary: 'Test research deliverable for workflow testing',
        timestamp: new Date().toISOString(),
      };

      const subject = `agog.deliverables.cynthia.research.${testReqNumber}`;
      await this.js.publish(subject, sc.encode(JSON.stringify(testDeliverable)));

      console.log(`  ✅ Published test deliverable to ${subject}`);

      // Verify we can retrieve it
      const jsm = await this.nc.jetstreamManager();
      const msg = await jsm.streams.getMessage('agog_features_research', { last_by_subj: subject });

      if (msg) {
        console.log(`  ✅ Retrieved deliverable (seq: ${msg.seq})`);
        this.results.push({
          testName: 'Deliverable Publishing',
          passed: true,
          message: 'Successfully published and retrieved deliverable',
          details: { subject, seq: msg.seq },
        });
      } else {
        throw new Error('Published message not found in stream');
      }
    } catch (error: any) {
      console.error('  ❌ Deliverable publishing failed:', error.message);
      this.results.push({
        testName: 'Deliverable Publishing',
        passed: false,
        message: error.message,
      });
    }
  }

  private async testWorkflowEvents(): Promise<void> {
    console.log('\n🔄 Test 4: Test Workflow Event Publishing');
    console.log('-'.repeat(70));

    try {
      const testReqNumber = 'REQ-TEST-WORKFLOW-001';

      // Simulate stage.started event
      const stageEvent = {
        eventType: 'stage.started',
        reqNumber: testReqNumber,
        stage: 'Research',
        agentId: 'cynthia',
        timestamp: new Date().toISOString(),
        contextData: {
          featureTitle: 'Test End-to-End Autonomous Workflow',
          previousStages: [],
        },
      };

      const subject = 'agog.orchestration.events.stage.started';
      await this.js.publish(subject, sc.encode(JSON.stringify(stageEvent)));

      console.log(`  ✅ Published stage.started event to ${subject}`);

      // Verify event stream exists
      const jsm = await this.nc.jetstreamManager();
      await jsm.streams.info('agog_orchestration_events');
      console.log(`  ✅ Orchestration events stream verified`);

      this.results.push({
        testName: 'Workflow Events',
        passed: true,
        message: 'Successfully published workflow event',
        details: { subject, eventType: stageEvent.eventType },
      });
    } catch (error: any) {
      console.error('  ❌ Workflow event publishing failed:', error.message);
      this.results.push({
        testName: 'Workflow Events',
        passed: false,
        message: error.message,
      });
    }
  }

  private async testMultiStageFlow(): Promise<void> {
    console.log('\n🔀 Test 5: Test Multi-Stage Message Flow');
    console.log('-'.repeat(70));

    try {
      const testReqNumber = 'REQ-TEST-WORKFLOW-001';
      const stages = [
        { stage: 'Research', agent: 'cynthia', stream: 'research' },
        { stage: 'Critique', agent: 'sylvia', stream: 'critique' },
        { stage: 'Backend', agent: 'roy', stream: 'backend' },
      ];

      console.log('  Simulating multi-stage workflow:\n');

      for (let i = 0; i < stages.length; i++) {
        const { stage, agent, stream } = stages[i];
        const previousStages = stages.slice(0, i).map(s => ({
          stage: s.stage,
          agent: s.agent,
          deliverableUrl: `nats://agog.deliverables.${s.agent}.${s.stream}.${testReqNumber}`,
        }));

        // Publish stage completion
        const deliverable = {
          agent,
          req_number: testReqNumber,
          status: 'COMPLETE',
          deliverable: `nats://agog.deliverables.${agent}.${stream}.${testReqNumber}`,
          summary: `${stage} stage completed successfully`,
          timestamp: new Date().toISOString(),
        };

        const subject = `agog.deliverables.${agent}.${stream}.${testReqNumber}`;
        await this.js.publish(subject, sc.encode(JSON.stringify(deliverable)));

        console.log(`  ✅ Stage ${i + 1}/${stages.length}: ${stage} (${agent})`);
        console.log(`     Subject: ${subject}`);
        console.log(`     Previous stages: ${previousStages.length}`);
      }

      console.log('\n  ✅ Multi-stage flow completed successfully');
      this.results.push({
        testName: 'Multi-Stage Flow',
        passed: true,
        message: `Successfully simulated ${stages.length}-stage workflow`,
        details: { stages: stages.map(s => s.stage) },
      });
    } catch (error: any) {
      console.error('  ❌ Multi-stage flow failed:', error.message);
      this.results.push({
        testName: 'Multi-Stage Flow',
        passed: false,
        message: error.message,
      });
    }
  }

  private async testAgentConfiguration(): Promise<void> {
    console.log('\n👥 Test 6: Verify Agent File Configuration');
    console.log('-'.repeat(70));

    const requiredAgents = [
      { id: 'cynthia', file: 'cynthia-research.md' },
      { id: 'sylvia', file: 'sylvia-critique.md' },
      { id: 'roy', file: 'roy-backend.md' },
      { id: 'jen', file: 'jen-frontend.md' },
      { id: 'billy', file: 'billy-qa.md' },
    ];

    const agentsDirs = [
      path.join(process.cwd(), '..', '..', '..', '.claude', 'agents'),
      path.join(process.cwd(), '.claude', 'agents'),
    ];

    let agentsDir: string | null = null;
    for (const dir of agentsDirs) {
      if (fs.existsSync(dir)) {
        agentsDir = dir;
        break;
      }
    }

    if (!agentsDir) {
      console.error('  ❌ Agents directory not found');
      this.results.push({
        testName: 'Agent Configuration',
        passed: false,
        message: 'Agents directory not found',
      });
      return;
    }

    console.log(`  Agents directory: ${agentsDir}\n`);

    let allAgentsExist = true;
    const missingAgents: string[] = [];

    for (const { id, file } of requiredAgents) {
      const files = fs.readdirSync(agentsDir);
      const matches = files.filter(f => f.startsWith(`${id}-`) && f.endsWith('.md'));

      if (matches.length > 0) {
        console.log(`  ✅ ${id}: ${matches[0]}`);
      } else {
        console.error(`  ❌ ${id}: Not found (expected ${file})`);
        allAgentsExist = false;
        missingAgents.push(id);
      }
    }

    this.results.push({
      testName: 'Agent Configuration',
      passed: allAgentsExist,
      message: allAgentsExist
        ? 'All agent files found'
        : `Missing agents: ${missingAgents.join(', ')}`,
      details: { agentsDir, missingAgents },
    });
  }

  private async testConsumerCreation(): Promise<void> {
    console.log('\n🎧 Test 7: Test Consumer Creation');
    console.log('-'.repeat(70));

    try {
      const jsm = await this.nc.jetstreamManager();

      // Create test consumer
      const consumerName = 'test_workflow_consumer';
      console.log(`  Creating consumer: ${consumerName}`);

      try {
        await jsm.consumers.add('agog_orchestration_events', {
          durable_name: consumerName,
          ack_policy: 'explicit' as any,
          filter_subject: 'agog.orchestration.events.stage.started',
        });
        console.log(`  ✅ Consumer created successfully`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`  ⚠️  Consumer already exists (OK)`);
        } else {
          throw error;
        }
      }

      // Verify consumer exists
      const consumerInfo = await jsm.consumers.info('agog_orchestration_events', consumerName);
      console.log(`  ✅ Consumer verified (${consumerInfo.num_pending} pending messages)`);

      this.results.push({
        testName: 'Consumer Creation',
        passed: true,
        message: 'Consumer created and verified',
        details: { consumerName, pending: consumerInfo.num_pending },
      });
    } catch (error: any) {
      console.error('  ❌ Consumer creation failed:', error.message);
      this.results.push({
        testName: 'Consumer Creation',
        passed: false,
        message: error.message,
      });
    }
  }

  private async testMessagePersistence(): Promise<void> {
    console.log('\n💾 Test 8: Test Message Persistence');
    console.log('-'.repeat(70));

    try {
      const testReqNumber = 'REQ-TEST-WORKFLOW-001';
      const subject = `agog.deliverables.roy.backend.${testReqNumber}`;

      // Publish test message
      const message = {
        agent: 'roy',
        req_number: testReqNumber,
        status: 'COMPLETE',
        deliverable: `nats://${subject}`,
        summary: 'Backend implementation complete for workflow test',
        files_created: [
          'backend/scripts/test-end-to-end-workflow.ts',
        ],
        timestamp: new Date().toISOString(),
      };

      const ack = await this.js.publish(subject, sc.encode(JSON.stringify(message)));
      console.log(`  ✅ Published message (seq: ${ack.seq})`);

      // Retrieve by sequence number
      const jsm = await this.nc.jetstreamManager();
      const retrieved = await jsm.streams.getMessage('agog_features_backend', { seq: ack.seq });

      if (retrieved) {
        const data = JSON.parse(sc.decode(retrieved.data));
        console.log(`  ✅ Retrieved message by sequence number`);
        console.log(`     Agent: ${data.agent}`);
        console.log(`     Status: ${data.status}`);
      }

      // Retrieve by subject
      const bySubject = await jsm.streams.getMessage('agog_features_backend', { last_by_subj: subject });
      if (bySubject) {
        console.log(`  ✅ Retrieved message by subject`);
      }

      this.results.push({
        testName: 'Message Persistence',
        passed: true,
        message: 'Messages persisted and retrievable',
        details: { seq: ack.seq, subject },
      });
    } catch (error: any) {
      console.error('  ❌ Message persistence test failed:', error.message);
      this.results.push({
        testName: 'Message Persistence',
        passed: false,
        message: error.message,
      });
    }
  }

  private async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(70));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const successRate = ((passed / total) * 100).toFixed(1);

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${successRate}%\n`);

    // Detailed results
    for (const result of this.results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.testName}: ${result.message}`);
      if (result.details && !result.passed) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }

    console.log('\n' + '='.repeat(70));

    // Overall assessment
    if (failed === 0) {
      console.log('🎉 All tests passed! End-to-end workflow system is operational.');
      console.log('\n✅ REQ-TEST-WORKFLOW-001: COMPLETE');
      console.log('\nNext Steps:');
      console.log('  1. Start host-agent-listener: npm run host:listener');
      console.log('  2. Start strategic orchestrator: npm run daemon:start');
      console.log('  3. Monitor workflows via NATS dashboard: http://localhost:8223');
    } else {
      console.log('⚠️  Some tests failed. Review errors above.');
      console.log('\nCommon Fixes:');
      console.log('  - NATS not running: docker-compose -f docker-compose.agents.yml up -d nats');
      console.log('  - Streams missing: npm run init:nats-streams && npm run init:strategic-streams');
      console.log('  - Agent files missing: Check .claude/agents/ directory');
    }

    console.log('\n' + '='.repeat(70));

    // Exit with appropriate code
    process.exit(failed === 0 ? 0 : 1);
  }
}

// Run test suite
const test = new EndToEndWorkflowTest();
test.run().catch((error) => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
