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

async function main() {
  console.log('🤖 Starting Proactive Daemons...\n');

  try {
    // 1. Start Metrics Provider
    console.log('[1/6] Starting Metrics Provider...');
    const metricsProvider = new MetricsProviderService();
    await metricsProvider.initialize();
    await metricsProvider.startDaemon(5 * 60 * 1000); // Every 5 minutes
    console.log('✅ Metrics Provider running\n');

    // 2. Start Recommendation Publisher
    console.log('[2/6] Starting Recommendation Publisher...');
    const recommendationPublisher = new RecommendationPublisherService();
    await recommendationPublisher.initialize();
    await recommendationPublisher.startDaemon();
    console.log('✅ Recommendation Publisher running\n');

    // 3. Start Recovery & Health Check (runs NOW, then every 5 hours)
    console.log('[3/6] Starting Recovery & Health Check...');
    const recoveryHealthCheck = new RecoveryHealthCheckDaemon();
    await recoveryHealthCheck.initialize();
    await recoveryHealthCheck.startDaemon();
    console.log('✅ Recovery & Health Check running (runs NOW, then every 5 hours)\n');

    // 4. Start Value Chain Expert (runs 5 min after Recovery, then every 5 hours)
    console.log('[4/6] Starting Value Chain Expert...');
    const valueChainExpert = new ValueChainExpertDaemon();
    await valueChainExpert.initialize();
    await valueChainExpert.startDaemon();
    console.log('✅ Value Chain Expert running (in 5 minutes, then every 5 hours)\n');

    // 5. Start Product Owner: Marcus (Inventory/Warehouse)
    console.log('[5/6] Starting Product Owner: Marcus (Inventory)...');
    const marcus = new ProductOwnerDaemon('inventory');
    await marcus.initialize();
    await marcus.startDaemon();
    console.log('✅ Marcus monitoring inventory domain\n');

    // 6. Start Product Owner: Sarah (Sales)
    console.log('[6/6] Starting Product Owner: Sarah (Sales)...');
    const sarah = new ProductOwnerDaemon('sales');
    await sarah.initialize();
    await sarah.startDaemon();
    console.log('✅ Sarah monitoring sales domain\n');

    // 7. Start Product Owner: Alex (Procurement)
    console.log('[7/8] Starting Product Owner: Alex (Procurement)...');
    const alex = new ProductOwnerDaemon('procurement');
    await alex.initialize();
    await alex.startDaemon();
    console.log('✅ Alex monitoring procurement domain\n');

    // 8. Start Senior Auditor: Sam (System Health)
    console.log('[8/8] Starting Senior Auditor: Sam...');
    const sam = new SeniorAuditorDaemon();
    await sam.start(); // Sam runs startup audit immediately, then daily at 2 AM
    console.log('✅ Sam running (startup audit NOW, then daily at 2 AM)\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All Proactive Daemons Running!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Services:');
    console.log('  • Metrics Provider: Publishing every 5 minutes');
    console.log('  • Recommendation Publisher: Listening for recommendations');
    console.log('  • Recovery & Health Check: Runs NOW, then every 5 hours');
    console.log('  • Value Chain Expert: Runs in 5 minutes, then every 5 hours');
    console.log('  • Marcus (PO): Monitoring inventory metrics every 5 hours');
    console.log('  • Sarah (PO): Monitoring sales metrics every 5 hours');
    console.log('  • Alex (PO): Monitoring procurement metrics every 5 hours');
    console.log('  • Sam (Auditor): Runs NOW, then daily at 2 AM (2hr timeout, creates REQs for issues)\n');

    console.log('NATS Subjects:');
    console.log('  • agog.metrics.* - Business metrics published here');
    console.log('  • agog.recommendations.* - Feature recommendations published here');
    console.log('  • agog.triggers.* - Threshold violations published here\n');

    console.log('Press Ctrl+C to stop all daemons\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down daemons...');

      await metricsProvider.close();
      await recommendationPublisher.close();
      await recoveryHealthCheck.close();
      await valueChainExpert.close();
      await marcus.close();
      await sarah.close();
      await alex.close();
      await sam.stop();

      console.log('✅ All daemons stopped');
      process.exit(0);
    });

  } catch (error: any) {
    console.error('❌ Failed to start proactive daemons:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
