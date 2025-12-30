/**
 * Deployment Executor
 * Executes actual deployment actions triggered by Berry
 * Runs on HOST (not in agent container) to restart containers
 */

import { connect, NatsConnection, JSONCodec } from 'nats';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DeploymentExecutor {
  private nc!: NatsConnection;
  private jc = JSONCodec();

  async initialize() {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const user = process.env.NATS_USER || 'agents';
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'deployment-executor'
    });

    console.log('[DeploymentExecutor] Connected - ready to execute deployments');
  }

  async startMonitoring() {
    // Subscribe to deployment instructions
    const backendSub = this.nc.subscribe('agog.deployment.backend.restart');
    const databaseSub = this.nc.subscribe('agog.deployment.database.refresh');

    console.log('[DeploymentExecutor] Monitoring deployment channels...');

    // Handle backend restarts
    (async () => {
      for await (const msg of backendSub) {
        try {
          const instruction = this.jc.decode(msg.data) as any;
          console.log(`[DeploymentExecutor] Executing backend restart for ${instruction.reqId}`);
          await this.restartBackend();
          console.log(`[DeploymentExecutor] Backend restarted for ${instruction.reqId}`);
        } catch (error: any) {
          console.error('[DeploymentExecutor] Backend restart failed:', error.message);
        }
      }
    })();

    // Handle database refreshes
    (async () => {
      for await (const msg of databaseSub) {
        try {
          const instruction = this.jc.decode(msg.data) as any;
          console.log(`[DeploymentExecutor] Refreshing materialized views for ${instruction.reqId}`);
          await this.refreshMaterializedViews();
          console.log(`[DeploymentExecutor] Materialized views refreshed for ${instruction.reqId}`);
        } catch (error: any) {
          console.error('[DeploymentExecutor] Database refresh failed:', error.message);
        }
      }
    })();
  }

  private async restartBackend() {
    try {
      const { stdout, stderr } = await execAsync('docker restart agogsaas-app-backend');
      if (stderr) console.error('[DeploymentExecutor] stderr:', stderr);
      
      // Wait for backend to come up
      await this.sleep(15000);
      
      // Verify health
      const health = await execAsync('curl -s http://localhost:4001/health');
      console.log('[DeploymentExecutor] Backend health:', health.stdout);
    } catch (error: any) {
      console.error('[DeploymentExecutor] Failed to restart backend:', error.message);
      throw error;
    }
  }

  private async refreshMaterializedViews() {
    try {
      const sql = `REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;`;
      await execAsync(`docker exec agogsaas-app-postgres psql -U agogsaas_user -d agogsaas -c "${sql}"`);
    } catch (error: any) {
      console.error('[DeploymentExecutor] Failed to refresh views:', error.message);
      // Don't throw - view might not exist yet
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    await this.nc.close();
    console.log('[DeploymentExecutor] Stopped');
  }
}
