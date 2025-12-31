"use strict";
/**
 * Start Proactive Daemons
 * Launches all autonomous work generation services
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const metrics_provider_service_1 = require("../src/proactive/metrics-provider.service");
const recommendation_publisher_service_1 = require("../src/proactive/recommendation-publisher.service");
const recovery_health_check_daemon_1 = require("../src/proactive/recovery-health-check.daemon");
const value_chain_expert_daemon_1 = require("../src/proactive/value-chain-expert.daemon");
const product_owner_daemon_1 = require("../src/proactive/product-owner.daemon");
const senior_auditor_daemon_1 = require("../src/proactive/senior-auditor.daemon");
async function main() {
    console.log('🤖 Starting Proactive Daemons...\n');
    try {
        // 1. Start Metrics Provider
        console.log('[1/6] Starting Metrics Provider...');
        const metricsProvider = new metrics_provider_service_1.MetricsProviderService();
        await metricsProvider.initialize();
        await metricsProvider.startDaemon(5 * 60 * 1000); // Every 5 minutes
        console.log('✅ Metrics Provider running\n');
        // 2. Start Recommendation Publisher
        console.log('[2/6] Starting Recommendation Publisher...');
        const recommendationPublisher = new recommendation_publisher_service_1.RecommendationPublisherService();
        await recommendationPublisher.initialize();
        await recommendationPublisher.startDaemon();
        console.log('✅ Recommendation Publisher running\n');
        // 3. Start Recovery & Health Check (runs NOW, then every 5 hours)
        console.log('[3/6] Starting Recovery & Health Check...');
        const recoveryHealthCheck = new recovery_health_check_daemon_1.RecoveryHealthCheckDaemon();
        await recoveryHealthCheck.initialize();
        await recoveryHealthCheck.startDaemon();
        console.log('✅ Recovery & Health Check running (runs NOW, then every 5 hours)\n');
        // 4. Start Value Chain Expert (runs 5 min after Recovery, then every 5 hours)
        console.log('[4/6] Starting Value Chain Expert...');
        const valueChainExpert = new value_chain_expert_daemon_1.ValueChainExpertDaemon();
        await valueChainExpert.initialize();
        await valueChainExpert.startDaemon();
        console.log('✅ Value Chain Expert running (in 5 minutes, then every 5 hours)\n');
        // 5. Start Product Owner: Marcus (Inventory/Warehouse)
        console.log('[5/6] Starting Product Owner: Marcus (Inventory)...');
        const marcus = new product_owner_daemon_1.ProductOwnerDaemon('inventory');
        await marcus.initialize();
        await marcus.startDaemon();
        console.log('✅ Marcus monitoring inventory domain\n');
        // 6. Start Product Owner: Sarah (Sales)
        console.log('[6/6] Starting Product Owner: Sarah (Sales)...');
        const sarah = new product_owner_daemon_1.ProductOwnerDaemon('sales');
        await sarah.initialize();
        await sarah.startDaemon();
        console.log('✅ Sarah monitoring sales domain\n');
        // 7. Start Product Owner: Alex (Procurement)
        console.log('[7/8] Starting Product Owner: Alex (Procurement)...');
        const alex = new product_owner_daemon_1.ProductOwnerDaemon('procurement');
        await alex.initialize();
        await alex.startDaemon();
        console.log('✅ Alex monitoring procurement domain\n');
        // 8. Start Senior Auditor: Sam (System Health)
        console.log('[8/8] Starting Senior Auditor: Sam...');
        const sam = new senior_auditor_daemon_1.SeniorAuditorDaemon();
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
    }
    catch (error) {
        console.error('❌ Failed to start proactive daemons:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}
main();
