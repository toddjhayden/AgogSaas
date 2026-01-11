/**
 * Berry Auto-Deploy Service
 * Automatically deploys completed work when QA passes
 *
 * Listens for Billy (QA) completions and triggers Berry deployment
 * No more manual intervention needed
 *
 * CRITICAL: Now includes health verification after deployment
 */

import { connect, NatsConnection, JSONCodec } from 'nats';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface QueuedDeployment {
  reqId: string;
  qaResult: any;
  queuedAt: Date;
}

export class BerryAutoDeployService {
  private nc!: NatsConnection;
  private jc = JSONCodec();
  private deploymentQueue: QueuedDeployment[] = [];
  private isProcessingDeployment = false;
  private lastDeploymentTime: Date | null = null;
  private readonly COOLDOWN_MS = 30000; // 30 seconds between deployments

  async initialize() {
    const natsUrl = process.env.NATS_URL || 'nats://nats:4222';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'berry-auto-deploy'
    });

    console.log('[BerryAutoDeploy] Connected to NATS - will auto-deploy after QA');
  }

  async startMonitoring() {
    console.log('[BerryAutoDeploy] Monitoring for completed QA stages...');
    console.log('[BerryAutoDeploy] Deployment queue enabled with 30s cooldown between deployments');

    // Start deployment queue processor
    this.processDeploymentQueue();

    // Subscribe to Billy (QA) completions
    const billyDeliverables = this.nc.subscribe('agog.deliverables.billy.>');

    for await (const msg of billyDeliverables) {
      try {
        const deliverable = this.jc.decode(msg.data) as any;
        const reqId = this.extractReqId(msg.subject);

        console.log(`[BerryAutoDeploy] Billy completed QA for ${reqId} - adding to deployment queue`);

        // Add to queue instead of deploying immediately
        this.queueDeployment(reqId, deliverable);

      } catch (error: any) {
        console.error('[BerryAutoDeploy] Failed to process QA completion:', error.message);
      }
    }
  }

  /**
   * Add deployment to queue
   * CRITICAL: Prevents concurrent deployments
   */
  private queueDeployment(reqId: string, qaResult: any) {
    this.deploymentQueue.push({
      reqId,
      qaResult,
      queuedAt: new Date()
    });

    console.log(`[BerryAutoDeploy] Queued deployment for ${reqId} (Queue size: ${this.deploymentQueue.length})`);
  }

  /**
   * Process deployment queue with cooldown
   * CRITICAL: Serial execution prevents race conditions
   */
  private async processDeploymentQueue() {
    while (true) {
      try {
        // Wait for next deployment or sleep
        if (this.deploymentQueue.length === 0) {
          await this.sleep(5000); // Check queue every 5 seconds
          continue;
        }

        // Check if we're already processing
        if (this.isProcessingDeployment) {
          await this.sleep(1000);
          continue;
        }

        // Check cooldown period
        if (this.lastDeploymentTime) {
          const timeSinceLastDeploy = Date.now() - this.lastDeploymentTime.getTime();
          if (timeSinceLastDeploy < this.COOLDOWN_MS) {
            const remainingCooldown = this.COOLDOWN_MS - timeSinceLastDeploy;
            console.log(`[BerryAutoDeploy] Cooldown active - waiting ${Math.ceil(remainingCooldown / 1000)}s before next deployment`);
            await this.sleep(remainingCooldown);
          }
        }

        // Get next deployment from queue
        const deployment = this.deploymentQueue.shift();
        if (!deployment) continue;

        // Process deployment
        this.isProcessingDeployment = true;
        console.log(`[BerryAutoDeploy] Processing deployment for ${deployment.reqId} (Queued: ${Math.round((Date.now() - deployment.queuedAt.getTime()) / 1000)}s ago)`);

        await this.deployChanges(deployment.reqId, deployment.qaResult);

        this.lastDeploymentTime = new Date();
        this.isProcessingDeployment = false;

      } catch (error: any) {
        console.error('[BerryAutoDeploy] Deployment queue processor error:', error.message);
        this.isProcessingDeployment = false;
        await this.sleep(5000); // Wait before retry
      }
    }
  }

  private extractReqId(subject: string): string {
    const parts = subject.split('.');
    return parts[parts.length - 1];
  }

  private async deployChanges(reqId: string, qaResult: any) {
    console.log(`[BerryAutoDeploy] Deploying ${reqId}`);

    let deploymentType = 'unknown';

    // Determine deployment action based on requirement type
    if (reqId.includes('DATABASE') || reqId.includes('WMS')) {
      await this.deployDatabaseChanges(reqId);
      deploymentType = 'database';
    } else if (reqId.includes('BACKEND') || reqId.includes('PO-')) {
      await this.deployBackendChanges(reqId);
      deploymentType = 'backend';
    } else if (reqId.includes('FRONTEND') || reqId.includes('I18N')) {
      await this.deployFrontendChanges(reqId);
      deploymentType = 'frontend';
    }

    // CRITICAL: Verify health before declaring success
    const healthResult = await this.verifyDeploymentHealth(deploymentType);

    // Publish Berry completion deliverable with actual health status
    await this.publishDeploymentComplete(reqId, healthResult);
  }

  private async deployDatabaseChanges(reqId: string) {
    console.log(`[BerryAutoDeploy] Refreshing database materialized views for ${reqId}`);
    
    // Publish instruction to refresh materialized views
    await this.nc.publish('agog.deployment.database.refresh', JSON.stringify({
      reqId,
      action: 'REFRESH_MATERIALIZED_VIEWS',
      timestamp: new Date().toISOString()
    }));

    console.log(`[BerryAutoDeploy] Database deployment triggered for ${reqId}`);
  }

  private async deployBackendChanges(reqId: string) {
    console.log(`[BerryAutoDeploy] Triggering backend restart for ${reqId}`);
    
    // Publish instruction to restart backend
    await this.nc.publish('agog.deployment.backend.restart', JSON.stringify({
      reqId,
      action: 'RESTART_BACKEND',
      timestamp: new Date().toISOString()
    }));

    console.log(`[BerryAutoDeploy] Backend deployment triggered for ${reqId}`);
  }

  private async deployFrontendChanges(reqId: string) {
    console.log(`[BerryAutoDeploy] Frontend changes auto-loaded (hot reload) for ${reqId}`);
    // Frontend uses hot reload - no action needed
    console.log(`[BerryAutoDeploy] Frontend deployment complete (hot reload) for ${reqId}`);
  }

  /**
   * Verify deployment health with retries
   * CRITICAL: This prevents false-positive deployment confirmations
   */
  private async verifyDeploymentHealth(deploymentType: string): Promise<{
    healthy: boolean;
    checks: Record<string, boolean>;
    errors: string[];
  }> {
    console.log(`[BerryAutoDeploy] Verifying deployment health (type: ${deploymentType})`);

    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    let healthy = true;

    // Wait for backend to stabilize after restart
    if (deploymentType === 'backend') {
      console.log(`[BerryAutoDeploy] Waiting 20 seconds for backend to stabilize...`);
      await this.sleep(20000);
    }

    // Check 1: Backend Health Endpoint
    try {
      const { stdout } = await execAsync('curl -s -f http://localhost:4001/health');
      checks.backendHealth = true;
      console.log(`[BerryAutoDeploy] ✅ Backend health check passed`);
    } catch (error: any) {
      checks.backendHealth = false;
      healthy = false;
      errors.push(`Backend health check failed: ${error.message}`);
      console.error(`[BerryAutoDeploy] ❌ Backend health check failed`);
    }

    // Check 2: GraphQL Endpoint
    try {
      const query = '{ __schema { types { name } } }';
      const { stdout } = await execAsync(`curl -s -f -X POST http://localhost:4001/graphql -H "Content-Type: application/json" -d "{\\"query\\":\\"${query}\\"}"`);
      const response = JSON.parse(stdout);
      checks.graphqlEndpoint = !!response.data;
      console.log(`[BerryAutoDeploy] ✅ GraphQL endpoint check passed`);
    } catch (error: any) {
      checks.graphqlEndpoint = false;
      healthy = false;
      errors.push(`GraphQL endpoint check failed: ${error.message}`);
      console.error(`[BerryAutoDeploy] ❌ GraphQL endpoint check failed`);
    }

    // Check 3: Database Connection
    if (deploymentType === 'database' || deploymentType === 'backend') {
      try {
        await execAsync('docker exec agogsaas-app-postgres psql -U agogsaas_user -d agogsaas -c "SELECT 1"');
        checks.databaseConnection = true;
        console.log(`[BerryAutoDeploy] ✅ Database connection check passed`);
      } catch (error: any) {
        checks.databaseConnection = false;
        healthy = false;
        errors.push(`Database connection check failed: ${error.message}`);
        console.error(`[BerryAutoDeploy] ❌ Database connection check failed`);
      }
    }

    if (healthy) {
      console.log(`[BerryAutoDeploy] 🎉 All health checks passed - deployment verified`);
    } else {
      console.error(`[BerryAutoDeploy] ⚠️ Health checks failed - deployment may have issues`);
      console.error(`[BerryAutoDeploy] Errors: ${errors.join(', ')}`);
    }

    return { healthy, checks, errors };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async publishDeploymentComplete(
    reqId: string,
    healthResult: { healthy: boolean; checks: Record<string, boolean>; errors: string[] }
  ) {
    const deliverable = {
      reqId,
      stage: 'DevOps',
      agent: 'berry',
      status: healthResult.healthy ? 'COMPLETED' : 'FAILED',
      timestamp: new Date().toISOString(),
      deployment: {
        deployed: true,
        method: 'auto-deploy',
        verifiedHealthy: healthResult.healthy,
        healthChecks: healthResult.checks,
        errors: healthResult.errors
      },
      message: healthResult.healthy
        ? 'Auto-deployment completed and verified healthy'
        : `Auto-deployment completed but health checks failed: ${healthResult.errors.join(', ')}`
    };

    await this.nc.publish(`agog.deliverables.berry.devops.${reqId}`, JSON.stringify(deliverable));
    console.log(`[BerryAutoDeploy] Published Berry ${deliverable.status} for ${reqId}`);
  }

  async close() {
    await this.nc.close();
    console.log('[BerryAutoDeploy] Stopped');
  }
}
