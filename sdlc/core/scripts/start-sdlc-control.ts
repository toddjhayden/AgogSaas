/**
 * SDLC Control Startup Script
 * Starts the SDLC Control daemon, REST API server, and Git sync service
 *
 * Usage:
 *   npm run sdlc:start
 *   ts-node scripts/start-sdlc-control.ts
 *
 * Environment Variables:
 *   SDLC_DATABASE_URL - PostgreSQL connection string (default: localhost:5435)
 *   SDLC_API_PORT - REST API port (default: 3010)
 *   NATS_URL - NATS server URL (default: nats://localhost:4222)
 *   SDLC_EXPORT_PATH - Git export directory (default: .claude/exports)
 */

import dotenv from 'dotenv';
import path from 'path';
import { SDLCControlDaemon } from '../src/sdlc-control/sdlc-control.daemon';
import { SDLCApiServer } from '../src/api/sdlc-api.server';
import { GitSyncService } from '../src/sdlc-control/git-sync.service';

dotenv.config();

async function main() {
  console.log('='.repeat(70));
  console.log('  SDLC Control System');
  console.log('  Entity Dependency Graph | Kanban Workflow | Column Governance');
  console.log('='.repeat(70));
  console.log('');

  // Determine export path (relative to repo root)
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const exportPath = process.env.SDLC_EXPORT_PATH || path.join(repoRoot, '.claude/exports');

  // Create daemon
  const daemon = new SDLCControlDaemon({
    natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
    publishEvents: true,
    healthCheckIntervalMs: 60000,
  });

  // Create Git sync service
  const gitSync = new GitSyncService({
    exportPath,
    syncIntervalMs: 300000, // 5 minutes
    enableNotify: true,
  });

  try {
    // Initialize daemon
    console.log('[SDLC] Initializing daemon...');
    await daemon.initialize();
    console.log('[SDLC] Daemon initialized');

    // Start daemon
    console.log('[SDLC] Starting daemon...');
    await daemon.start();
    console.log('[SDLC] Daemon running');

    // Create and start API server
    console.log('[SDLC] Starting REST API server...');
    const apiServer = new SDLCApiServer(daemon, {
      port: parseInt(process.env.SDLC_API_PORT || '3010'),
      host: process.env.SDLC_API_HOST || '127.0.0.1',
    });
    await apiServer.start();
    console.log('[SDLC] REST API server running');

    // Initialize and start Git sync
    console.log('[SDLC] Starting Git sync service...');
    await gitSync.initialize();
    await gitSync.start();
    console.log('[SDLC] Git sync running');

    const apiHost = process.env.SDLC_API_HOST || '127.0.0.1';
    const apiPort = process.env.SDLC_API_PORT || '3010';
    const dbUrl = process.env.SDLC_DATABASE_URL || 'postgresql://localhost:5435/sdlc_control';

    console.log('');
    console.log('Services:');
    console.log(`  - REST API:    http://${apiHost}:${apiPort}/api/agent`);
    console.log(`  - Database:    ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
    console.log(`  - NATS:        ${process.env.NATS_URL || 'nats://localhost:4222'}`);
    console.log(`  - Git Export:  ${exportPath}`);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n[SDLC] Shutting down...');
      await gitSync.stop();
      await daemon.stop();
      console.log('[SDLC] Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error: any) {
    console.error('[SDLC] Failed to start:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Ensure Docker containers are running:');
    console.error('     docker-compose -f docker-compose.agents.yml up -d');
    console.error('  2. If fresh install, wait 10+ seconds for database initialization');
    console.error('  3. Check database status:');
    console.error('     docker logs agogsaas-sdlc-postgres');
    console.error('  4. If migrations failed, reset volumes and restart:');
    console.error('     docker-compose -f docker-compose.agents.yml down -v');
    console.error('     docker-compose -f docker-compose.agents.yml up -d');
    console.error('');
    process.exit(1);
  }
}

main();
