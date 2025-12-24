#!/usr/bin/env ts-node
"use strict";
/**
 * Start Strategic Orchestrator Daemon
 *
 * This daemon:
 * - Monitors OWNER_REQUESTS.md for NEW requests
 * - Spawns specialist workflows (Cynthia → Sylvia → Roy → Jen → Billy → Priya)
 * - Handles blocked workflows with strategic agent intervention
 * - Stores learnings in memory system
 *
 * Usage:
 *   npm run daemon:start
 *   OR
 *   ts-node scripts/start-strategic-orchestrator.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strategic_orchestrator_service_1 = require("../src/orchestration/strategic-orchestrator.service");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function startDaemon() {
    console.log('🚀 Starting Strategic Orchestrator Daemon');
    console.log('==========================================\n');
    const orchestrator = new strategic_orchestrator_service_1.StrategicOrchestratorService();
    try {
        // Initialize the orchestrator
        console.log('Initializing Strategic Orchestrator...');
        await orchestrator.initialize();
        console.log('✅ Initialized\n');
        // Start the daemon
        console.log('Starting autonomous daemon...');
        await orchestrator.startDaemon();
        console.log('\n✅ Strategic Orchestrator is running!');
        console.log('\nDaemon is now:');
        console.log('  - Monitoring OWNER_REQUESTS.md every 60 seconds');
        console.log('  - Spawning specialist workflows for NEW requests');
        console.log('  - Enforcing 6-stage workflow: Cynthia → Sylvia → Roy → Jen → Billy → Priya');
        console.log('  - Handling blocked workflows with strategic agents');
        console.log('  - Storing learnings in memory system');
        console.log('\nPress Ctrl+C to stop the daemon\n');
        // Keep process alive
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down Strategic Orchestrator...');
            await orchestrator.close();
            console.log('✅ Shutdown complete');
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('\n\n🛑 Shutting down Strategic Orchestrator...');
            await orchestrator.close();
            console.log('✅ Shutdown complete');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('💥 Failed to start Strategic Orchestrator:', error.message);
        console.error('\nTroubleshooting:');
        console.error('  1. Ensure NATS is running: docker-compose up -d nats');
        console.error('  2. Check NATS_URL in .env (should be nats://localhost:4223)');
        console.error('  3. Verify OWNER_REQUESTS.md exists at project-spirit/owner_requests/');
        console.error('\nError details:', error);
        process.exit(1);
    }
}
// Run the daemon
startDaemon().catch((error) => {
    console.error('💥 Daemon crashed:', error);
    process.exit(1);
});
