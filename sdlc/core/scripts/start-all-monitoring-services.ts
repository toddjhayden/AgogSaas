#!/usr/bin/env ts-node
/**
 * Start All Monitoring and Orchestration Services
 *
 * This is the main entry point for the FULL AGENTIC SYSTEM, starting:
 * 1. Strategic Orchestrator (workflow management)
 * 2. Health Monitor (system health checks)
 * 3. Berry Auto-Deploy (deployment automation)
 * 4. Deployment Executor (executes deployments)
 * 5. PROACTIVE DAEMONS (work generators - the agentic part!)
 *    - Metrics Provider
 *    - Recommendation Publisher
 *    - Recovery & Health Check Daemon
 *    - Value Chain Expert Daemon
 *    - Product Owner Daemons (Marcus, Sarah, Alex)
 *    - Senior Auditor: Sam (startup + daily at 2 AM)
 *
 * All services run concurrently with proper error handling
 */

import { StrategicOrchestratorService } from '../src/orchestration/strategic-orchestrator.service';
import { HealthMonitorService } from '../src/monitoring/health-monitor.service';
import { BerryAutoDeployService } from '../src/agents/berry-auto-deploy.service';
import { DeploymentExecutor } from '../src/agents/deployment-executor.service';
// Proactive Daemons - Work Generators (the agentic part!)
import { MetricsProviderService } from '../src/proactive/metrics-provider.service';
import { RecommendationPublisherService } from '../src/proactive/recommendation-publisher.service';
import { RecoveryHealthCheckDaemon } from '../src/proactive/recovery-health-check.daemon';
import { ValueChainExpertDaemon } from '../src/proactive/value-chain-expert.daemon';
import { ProductOwnerDaemon } from '../src/proactive/product-owner.daemon';
import { SeniorAuditorDaemon } from '../src/proactive/senior-auditor.daemon';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { NatsDependencyValidator } from '../src/monitoring/nats-dependency-validator.service';

dotenv.config();

// =============================================================================
// RUNTIME DEPENDENCY VALIDATION - Exit on failure
// REQ: REQ-AUDIT-1767982074
// =============================================================================
async function validateRuntimeDependencies(): Promise<void> {
  const validator = new NatsDependencyValidator();
  await validator.validateAndExit();
}

// =============================================================================
// FILE-BASED LOGGING - Persists to /app/logs (mounted to host)
// =============================================================================
const logDir = path.resolve(__dirname, '..', 'logs');
const today = new Date().toISOString().split('T')[0];
const logFile = path.join(logDir, `orchestrator-${today}.log`);

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create write stream for file logging
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

/**
 * Log to both console and file for persistence
 */
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', source: string, message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] [${source}] ${message}`;

  // Console output (for docker logs)
  console.log(logLine);

  // File output (persisted to host via volume mount)
  logStream.write(logLine + '\n');
}

// Override console.log to also write to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  originalConsoleLog(logLine);
  logStream.write(logLine + '\n');
};

console.error = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [ERROR] ${message}`;
  originalConsoleError(logLine);
  logStream.write(logLine + '\n');
};

console.warn = (...args: any[]) => {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [WARN] ${message}`;
  originalConsoleWarn(logLine);
  logStream.write(logLine + '\n');
};

log('INFO', 'Startup', `Logging initialized - writing to ${logFile}`);

async function startAllServices() {
  // =============================================================================
  // STEP 1: VALIDATE RUNTIME DEPENDENCIES - Exit on failure
  // =============================================================================
  await validateRuntimeDependencies();

  console.log('🚀 Starting Agent System with ACTUAL Workflow Recovery');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const services: Array<{ name: string; instance: any; close: () => Promise<void> }> = [];

  try {
    // Initialize all services first
    console.log('[1/10] Initializing Strategic Orchestrator...');
    const orchestrator = new StrategicOrchestratorService();
    await orchestrator.initialize();
    services.push({
      name: 'Strategic Orchestrator',
      instance: orchestrator,
      close: () => orchestrator.close()
    });
    console.log('✅ Strategic Orchestrator initialized\n');

    console.log('[2/10] Initializing Health Monitor...');
    const healthMonitor = new HealthMonitorService();
    await healthMonitor.initialize();
    services.push({
      name: 'Health Monitor',
      instance: healthMonitor,
      close: () => healthMonitor.close()
    });
    console.log('✅ Health Monitor initialized\n');

    console.log('[3/10] Initializing Berry Auto-Deploy...');
    const berryAutoDeploy = new BerryAutoDeployService();
    await berryAutoDeploy.initialize();
    services.push({
      name: 'Berry Auto-Deploy',
      instance: berryAutoDeploy,
      close: () => berryAutoDeploy.close()
    });
    console.log('✅ Berry Auto-Deploy initialized\n');

    console.log('[4/10] Initializing Deployment Executor...');
    const deploymentExecutor = new DeploymentExecutor();
    await deploymentExecutor.initialize();
    services.push({
      name: 'Deployment Executor',
      instance: deploymentExecutor,
      close: () => deploymentExecutor.close()
    });
    console.log('✅ Deployment Executor initialized\n');

    // ═══════════════════════════════════════════════════════════════
    // PROACTIVE DAEMONS - Work Generators (the agentic part!)
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🤖 Initializing PROACTIVE DAEMONS (Work Generators)...');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('[5/10] Initializing Metrics Provider...');
    const metricsProvider = new MetricsProviderService();
    await metricsProvider.initialize();
    services.push({
      name: 'Metrics Provider',
      instance: metricsProvider,
      close: () => metricsProvider.close()
    });
    console.log('✅ Metrics Provider initialized\n');

    console.log('[6/10] Initializing Recommendation Publisher...');
    const recommendationPublisher = new RecommendationPublisherService();
    await recommendationPublisher.initialize();
    services.push({
      name: 'Recommendation Publisher',
      instance: recommendationPublisher,
      close: () => recommendationPublisher.close()
    });
    console.log('✅ Recommendation Publisher initialized\n');

    console.log('[7/10] Initializing Recovery & Health Check Daemon...');
    const recoveryHealthCheck = new RecoveryHealthCheckDaemon();
    await recoveryHealthCheck.initialize();
    services.push({
      name: 'Recovery Health Check',
      instance: recoveryHealthCheck,
      close: () => recoveryHealthCheck.close()
    });
    console.log('✅ Recovery & Health Check Daemon initialized\n');

    console.log('[8/10] Initializing Value Chain Expert Daemon...');
    const valueChainExpert = new ValueChainExpertDaemon();
    await valueChainExpert.initialize();
    services.push({
      name: 'Value Chain Expert',
      instance: valueChainExpert,
      close: () => valueChainExpert.close()
    });
    console.log('✅ Value Chain Expert Daemon initialized\n');

    console.log('[9/12] Initializing Product Owner: Marcus (Inventory)...');
    const marcus = new ProductOwnerDaemon('inventory');
    await marcus.initialize();
    services.push({
      name: 'PO Marcus (Inventory)',
      instance: marcus,
      close: () => marcus.close()
    });
    console.log('✅ Marcus (Inventory PO) initialized\n');

    console.log('[10/12] Initializing Product Owner: Sarah (Sales)...');
    const sarah = new ProductOwnerDaemon('sales');
    await sarah.initialize();
    services.push({
      name: 'PO Sarah (Sales)',
      instance: sarah,
      close: () => sarah.close()
    });
    console.log('✅ Sarah (Sales PO) initialized\n');

    console.log('[11/12] Initializing Product Owner: Alex (Procurement)...');
    const alex = new ProductOwnerDaemon('procurement');
    await alex.initialize();
    services.push({
      name: 'PO Alex (Procurement)',
      instance: alex,
      close: () => alex.close()
    });
    console.log('✅ Alex (Procurement PO) initialized\n');

    console.log('[12/12] Initializing Senior Auditor: Sam...');
    const sam = new SeniorAuditorDaemon();
    services.push({
      name: 'Senior Auditor Sam',
      instance: sam,
      close: () => sam.stop()
    });
    console.log('✅ Sam (Senior Auditor) initialized - runs at startup + daily at 2 AM\n');

    // Start all daemons concurrently (don't await - they run indefinitely)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 Starting ALL services (monitoring + work generators)...');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Core monitoring services
    orchestrator.startDaemon(); // Don't await - runs forever
    healthMonitor.startMonitoring(); // Don't await - runs forever
    berryAutoDeploy.startMonitoring(); // Don't await - runs forever
    deploymentExecutor.startMonitoring(); // Don't await - runs forever

    // Proactive work generators (the agentic part!)
    await metricsProvider.startDaemon(5 * 60 * 1000); // Every 5 minutes
    await recommendationPublisher.startDaemon();
    await recoveryHealthCheck.startDaemon();
    await valueChainExpert.startDaemon();
    await marcus.startDaemon();
    await sarah.startDaemon();
    await alex.startDaemon();
    await sam.start(); // Runs startup audit NOW, then daily at 2 AM

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ FULL AGENTIC SYSTEM Running Successfully!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('CORE SERVICES (Monitoring & Execution):');
    console.log('  1. Strategic Orchestrator');
    console.log('     • Monitors OWNER_REQUESTS.md every 60 seconds');
    console.log('     • Manages 7-stage workflow: Cynthia → Sylvia → Roy → Jen → Billy → Priya → Berry');
    console.log('');
    console.log('  2. Health Monitor - System health checks every 2 minutes');
    console.log('  3. Berry Auto-Deploy - Triggers deployments when QA passes');
    console.log('  4. Deployment Executor - Executes actual deployments');
    console.log('');
    console.log('🤖 PROACTIVE DAEMONS (Work Generators - THE AGENTIC PART):');
    console.log('  5. Metrics Provider - Publishes business metrics every 5 min');
    console.log('  6. Recommendation Publisher - Listens for & publishes recommendations');
    console.log('  7. Recovery & Health Check - Recovers stuck workflows (runs NOW, then every 5h)');
    console.log('  8. Value Chain Expert - Strategic analysis (runs in 5 min, then every 5h)');
    console.log('  9. Marcus (Inventory PO) - Monitors inventory, generates features every 5h');
    console.log(' 10. Sarah (Sales PO) - Monitors sales, generates features every 5h');
    console.log(' 11. Alex (Procurement PO) - Monitors procurement, generates features every 5h');
    console.log(' 12. Sam (Senior Auditor) - System health audits (startup + daily at 2 AM)');
    console.log('     → Creates agog.requirements.new for system issues');
    console.log('');
    console.log('NATS Subjects:');
    console.log('  • agog.metrics.* - Business metrics');
    console.log('  • agog.recommendations.* - Feature recommendations');
    console.log('  • agog.triggers.* - Threshold violations');
    console.log('  • agog.deliverables.* - Agent deliverables');
    console.log('  • agog.workflows.* - Workflow events');
    console.log('');
    console.log('🚀 System is now AUTONOMOUS - generating and processing work!');
    console.log('');
    console.log('Press Ctrl+C to stop all services');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n\n🛑 Shutting down all services...');

      for (const service of services) {
        try {
          console.log(`  Stopping ${service.name}...`);
          await service.close();
          console.log(`  ✅ ${service.name} stopped`);
        } catch (error: any) {
          console.error(`  ❌ Error stopping ${service.name}:`, error.message);
        }
      }

      console.log('\n✅ All services stopped');

      // Close log stream
      log('INFO', 'Shutdown', 'Closing log stream');
      logStream.end();

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep process alive
    await new Promise(() => {});

  } catch (error: any) {
    console.error('\n💥 Failed to start services:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Ensure NATS is running: docker ps | grep sdlc-nats');
    console.error('  2. Check NATS_URL in .env (should be nats://nats:4222)');
    console.error('  3. Verify SDLC_API_URL is set and VPS is reachable');
    console.error('  4. Check logs: docker logs sdlc-core');
    console.error('\nError details:', error);

    // Cleanup any started services
    for (const service of services) {
      try {
        await service.close();
      } catch {}
    }

    process.exit(1);
  }
}

// Run all services
startAllServices().catch((error) => {
  console.error('💥 System crashed:', error);
  process.exit(1);
});
