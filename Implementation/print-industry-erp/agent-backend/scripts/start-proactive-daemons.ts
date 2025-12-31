/**
 * Start Proactive Daemons
 * Launches all autonomous work generation services
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { MetricsProviderService } from '../src/proactive/metrics-provider.service';
import { RecommendationPublisherService } from '../src/proactive/recommendation-publisher.service';
import { RecoveryHealthCheckDaemon } from '../src/proactive/recovery-health-check.daemon';
import { ValueChainExpertDaemon } from '../src/proactive/value-chain-expert.daemon';
import { ProductOwnerDaemon } from '../src/proactive/product-owner.daemon';
import { SeniorAuditorDaemon } from '../src/proactive/senior-auditor.daemon';
import { UITestingGeneratorDaemon } from '../src/proactive/ui-testing-generator.daemon';

async function main() {
  console.log('Starting Proactive Daemons...\n');

  try {
    // 1. Start Metrics Provider
    console.log('[1/9] Starting Metrics Provider...');
    const metricsProvider = new MetricsProviderService();
    await metricsProvider.initialize();
    await metricsProvider.startDaemon(5 * 60 * 1000);
    console.log('Metrics Provider running\n');

    // 2. Start Recommendation Publisher
    console.log('[2/9] Starting Recommendation Publisher...');
    const recommendationPublisher = new RecommendationPublisherService();
    await recommendationPublisher.initialize();
    await recommendationPublisher.startDaemon();
    console.log('Recommendation Publisher running\n');

    // 3. Start Recovery & Health Check
    console.log('[3/9] Starting Recovery & Health Check...');
    const recoveryHealthCheck = new RecoveryHealthCheckDaemon();
    await recoveryHealthCheck.initialize();
    await recoveryHealthCheck.startDaemon();
    console.log('Recovery & Health Check running\n');

    // 4. Start Value Chain Expert
    console.log('[4/9] Starting Value Chain Expert...');
    const valueChainExpert = new ValueChainExpertDaemon();
    await valueChainExpert.initialize();
    await valueChainExpert.startDaemon();
    console.log('Value Chain Expert running\n');

    // 5. Start Product Owner: Marcus
    console.log('[5/9] Starting Product Owner: Marcus (Inventory)...');
    const marcus = new ProductOwnerDaemon('inventory');
    await marcus.initialize();
    await marcus.startDaemon();
    console.log('Marcus monitoring inventory domain\n');

    // 6. Start Product Owner: Sarah
    console.log('[6/9] Starting Product Owner: Sarah (Sales)...');
    const sarah = new ProductOwnerDaemon('sales');
    await sarah.initialize();
    await sarah.startDaemon();
    console.log('Sarah monitoring sales domain\n');

    // 7. Start Product Owner: Alex
    console.log('[7/9] Starting Product Owner: Alex (Procurement)...');
    const alex = new ProductOwnerDaemon('procurement');
    await alex.initialize();
    await alex.startDaemon();
    console.log('Alex monitoring procurement domain\n');

    // 8. Start Senior Auditor: Sam
    console.log('[8/9] Starting Senior Auditor: Sam...');
    const sam = new SeniorAuditorDaemon();
    await sam.start();
    console.log('Sam running (startup audit NOW, then daily at 2 AM)\n');

    // 9. Start UI Testing Generator (triggered by Sam, generates REQs for Liz)
    console.log('[9/9] Starting UI Testing REQ Generator...');
    const uiTestingGenerator = new UITestingGeneratorDaemon();
    await uiTestingGenerator.start();
    console.log('UI Testing Generator running (listens for Sam triggers)\n');

    console.log('All Proactive Daemons Running!\n');

    console.log('Services:');
    console.log('  - Metrics Provider: Publishing every 5 minutes');
    console.log('  - Recommendation Publisher: Listening for recommendations');
    console.log('  - Recovery & Health Check: Runs NOW, then every 5 hours');
    console.log('  - Value Chain Expert: Runs in 5 minutes, then every 5 hours');
    console.log('  - Marcus (PO): Monitoring inventory metrics');
    console.log('  - Sarah (PO): Monitoring sales metrics');
    console.log('  - Alex (PO): Monitoring procurement metrics');
    console.log('  - Sam (Auditor): Daily at 2 AM, triggers Liz testing');
    console.log('  - UI Testing Generator: Creates P0 REQs for Liz after Sam audits\n');

    console.log('NATS Subjects:');
    console.log('  - agog.metrics.* - Business metrics');
    console.log('  - agog.recommendations.* - Feature recommendations');
    console.log('  - agog.testing.ui.* - UI testing triggers\n');

    console.log('Press Ctrl+C to stop all daemons\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down daemons...');
      await metricsProvider.close();
      await recommendationPublisher.close();
      await recoveryHealthCheck.close();
      await valueChainExpert.close();
      await marcus.close();
      await sarah.close();
      await alex.close();
      await sam.stop();
      await uiTestingGenerator.stop();
      console.log('All daemons stopped');
      process.exit(0);
    });

  } catch (error: any) {
    console.error('Failed to start proactive daemons:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
