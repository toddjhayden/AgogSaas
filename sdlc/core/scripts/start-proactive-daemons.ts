/**
 * Start Proactive Daemons
 * Launches all autonomous work generation services
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { MetricsProviderService } from '../src/proactive/metrics-provider.service';
import { RecommendationPublisherService } from '../src/proactive/recommendation-publisher.service';
import { RecoveryHealthCheckDaemon } from '../src/proactive/recovery-health-check.daemon';
import { ValueChainExpertDaemon } from '../src/proactive/value-chain-expert.daemon';
import { ProductOwnerDaemon } from '../src/proactive/product-owner.daemon';
import { SeniorAuditorDaemon } from '../src/proactive/senior-auditor.daemon';
import { UITestingGeneratorDaemon } from '../src/proactive/ui-testing-generator.daemon';

// File-based logging setup
const logDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'daemons.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(level: 'INFO' | 'ERROR' | 'WARN', source: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] [${source}] ${message}`;
  console.log(logLine);
  logStream.write(logLine + '\n');
}

async function main() {
  log('INFO', 'Daemons', 'Starting Proactive Daemons...');

  try {
    // 1. Start Metrics Provider
    log('INFO', 'Daemons', '[1/9] Starting Metrics Provider...');
    const metricsProvider = new MetricsProviderService();
    await metricsProvider.initialize();
    await metricsProvider.startDaemon(5 * 60 * 1000);
    log('INFO', 'MetricsProvider', 'Running');

    // 2. Start Recommendation Publisher
    log('INFO', 'Daemons', '[2/9] Starting Recommendation Publisher...');
    const recommendationPublisher = new RecommendationPublisherService();
    await recommendationPublisher.initialize();
    await recommendationPublisher.startDaemon();
    log('INFO', 'RecommendationPublisher', 'Running');

    // 3. Start Recovery & Health Check
    log('INFO', 'Daemons', '[3/9] Starting Recovery & Health Check...');
    const recoveryHealthCheck = new RecoveryHealthCheckDaemon();
    await recoveryHealthCheck.initialize();
    await recoveryHealthCheck.startDaemon();
    log('INFO', 'RecoveryHealthCheck', 'Running');

    // 4. Start Value Chain Expert
    log('INFO', 'Daemons', '[4/9] Starting Value Chain Expert...');
    const valueChainExpert = new ValueChainExpertDaemon();
    await valueChainExpert.initialize();
    await valueChainExpert.startDaemon();
    log('INFO', 'ValueChainExpert', 'Running');

    // 5. Start Product Owner: Marcus
    log('INFO', 'Daemons', '[5/9] Starting Product Owner: Marcus (Inventory)...');
    const marcus = new ProductOwnerDaemon('inventory');
    await marcus.initialize();
    await marcus.startDaemon();
    log('INFO', 'Marcus', 'Monitoring inventory domain');

    // 6. Start Product Owner: Sarah
    log('INFO', 'Daemons', '[6/9] Starting Product Owner: Sarah (Sales)...');
    const sarah = new ProductOwnerDaemon('sales');
    await sarah.initialize();
    await sarah.startDaemon();
    log('INFO', 'Sarah', 'Monitoring sales domain');

    // 7. Start Product Owner: Alex
    log('INFO', 'Daemons', '[7/9] Starting Product Owner: Alex (Procurement)...');
    const alex = new ProductOwnerDaemon('procurement');
    await alex.initialize();
    await alex.startDaemon();
    log('INFO', 'Alex', 'Monitoring procurement domain');

    // 8. Start Senior Auditor: Sam
    log('INFO', 'Daemons', '[8/9] Starting Senior Auditor: Sam...');
    const sam = new SeniorAuditorDaemon();
    await sam.start();
    log('INFO', 'Sam', 'Running (startup audit NOW, then daily at 2 AM)');

    // 9. Start UI Testing Generator (triggered by Sam, generates REQs for Liz)
    log('INFO', 'Daemons', '[9/9] Starting UI Testing REQ Generator...');
    const uiTestingGenerator = new UITestingGeneratorDaemon();
    await uiTestingGenerator.start();
    log('INFO', 'UITestingGenerator', 'Running (listens for Sam triggers)');

    log('INFO', 'Daemons', '✅ All Proactive Daemons Running!');
    log('INFO', 'Daemons', 'Services: MetricsProvider, RecommendationPublisher, RecoveryHealthCheck, ValueChainExpert, Marcus, Sarah, Alex, Sam, UITestingGenerator');
    log('INFO', 'Daemons', 'NATS: agog.metrics.*, agog.recommendations.*, agog.testing.ui.*');
    log('INFO', 'Daemons', 'Press Ctrl+C to stop all daemons');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      log('INFO', 'Daemons', 'Shutting down daemons...');
      await metricsProvider.close();
      await recommendationPublisher.close();
      await recoveryHealthCheck.close();
      await valueChainExpert.close();
      await marcus.close();
      await sarah.close();
      await alex.close();
      await sam.stop();
      await uiTestingGenerator.stop();
      log('INFO', 'Daemons', 'All daemons stopped');
      logStream.end();
      process.exit(0);
    });

  } catch (error: any) {
    log('ERROR', 'Daemons', `Failed to start: ${error.message}`);
    log('ERROR', 'Daemons', error.stack || '');
    logStream.end();
    process.exit(1);
  }
}

main();
