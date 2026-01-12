/**
 * Metrics Provider for Business Intelligence
 * Aggregates metrics from PostgreSQL and publishes to NATS
 * Enables proactive agents to monitor business health
 */

import { Pool } from 'pg';
import { connect, NatsConnection } from 'nats';

export interface BusinessMetrics {
  inventory: {
    stockoutRate: number;       // % of SKUs out of stock
    binUtilization: number;     // % of bin capacity used
    cycleCountAccuracy: number; // % of cycle counts accurate
  };
  sales: {
    avgOrderEntryTime: number;  // Minutes to enter order
    quoteConversion: number;    // % quotes converted to orders
    complaintRate: number;      // % of orders with complaints
  };
  procurement: {
    vendorOnTimeDelivery: number; // % of POs delivered on time
    costVariance: number;         // % cost variance from quotes
    rfqResponseTime: number;      // Hours to respond to RFQs
  };
  system: {
    errorRate: number;          // Errors per hour
    apiUsage: number;           // % of Claude API used
    workflowFailureRate: number; // % of workflows that failed
  };
}

export class MetricsProviderService {
  private nc!: NatsConnection;
  private appPool: Pool;
  private agentPool: Pool;
  private isRunning = false;

  constructor() {
    // Application database (OLTP)
    const appDbUrl = process.env.APP_DATABASE_URL || 'postgresql://user:password@postgres:5432/agogsaas';
    this.appPool = new Pool({ connectionString: appDbUrl });

    // Agent database
    const agentDbUrl = process.env.DATABASE_URL || 'postgresql://agent_user:agent_dev_password_2024@agent-postgres:5432/agent_memory';
    this.agentPool = new Pool({ connectionString: agentDbUrl });
  }

  async initialize(): Promise<void> {
    // Connect to NATS
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'metrics-provider'
    });

    console.log('[MetricsProvider] Connected to NATS');
  }

  /**
   * Start metrics collection daemon
   */
  async startDaemon(intervalMs: number = 5 * 60 * 1000): Promise<void> {
    if (this.isRunning) {
      console.log('[MetricsProvider] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[MetricsProvider] Starting daemon (interval: ${intervalMs / 1000}s)`);

    // Initial collection
    await this.collectAndPublish();

    // Periodic collection
    setInterval(async () => {
      if (this.isRunning) {
        await this.collectAndPublish();
      }
    }, intervalMs);
  }

  /**
   * Collect metrics and publish to NATS
   */
  private async collectAndPublish(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();

      // Publish to NATS
      await this.publishMetrics(metrics);

      // Check thresholds and publish triggers
      await this.checkThresholds(metrics);

      console.log('[MetricsProvider] ✅ Metrics collected and published');
    } catch (error: any) {
      console.error('[MetricsProvider] Error collecting metrics:', error.message);
    }
  }

  /**
   * Collect metrics from databases
   */
  private async collectMetrics(): Promise<BusinessMetrics> {
    // TODO: Implement actual queries against OLTP database
    // For now, using mock data

    const metrics: BusinessMetrics = {
      inventory: {
        stockoutRate: 3.2,          // Mock: 3.2% stockout rate
        binUtilization: 78.5,       // Mock: 78.5% bin utilization
        cycleCountAccuracy: 99.1    // Mock: 99.1% accuracy
      },
      sales: {
        avgOrderEntryTime: 8.5,     // Mock: 8.5 minutes avg
        quoteConversion: 42.3,      // Mock: 42.3% conversion
        complaintRate: 1.8          // Mock: 1.8% complaint rate
      },
      procurement: {
        vendorOnTimeDelivery: 92.1, // Mock: 92.1% on time
        costVariance: 3.4,          // Mock: 3.4% variance
        rfqResponseTime: 36         // Mock: 36 hours avg
      },
      system: {
        errorRate: 2.1,             // Mock: 2.1 errors/hour
        apiUsage: 11.0,             // Mock: 11% API usage
        workflowFailureRate: 5.2    // Mock: 5.2% failure rate
      }
    };

    return metrics;
  }

  /**
   * Publish metrics to NATS
   */
  private async publishMetrics(metrics: BusinessMetrics): Promise<void> {
    // Publish domain-specific metrics
    await this.nc.publish('agog.metrics.inventory', JSON.stringify(metrics.inventory));
    await this.nc.publish('agog.metrics.sales', JSON.stringify(metrics.sales));
    await this.nc.publish('agog.metrics.procurement', JSON.stringify(metrics.procurement));
    await this.nc.publish('agog.metrics.system', JSON.stringify(metrics.system));

    // Publish aggregate metrics
    await this.nc.publish('agog.metrics.all', JSON.stringify(metrics));
  }

  /**
   * Check thresholds and publish triggers
   */
  private async checkThresholds(metrics: BusinessMetrics): Promise<void> {
    // Inventory triggers
    if (metrics.inventory.stockoutRate > 5) {
      await this.nc.publish('agog.triggers.stockout', JSON.stringify({
        rate: metrics.inventory.stockoutRate,
        threshold: 5,
        timestamp: new Date().toISOString()
      }));
      console.log(`[MetricsProvider] 🚨 Triggered: stockout rate ${metrics.inventory.stockoutRate}%`);
    }

    // Sales triggers
    if (metrics.sales.avgOrderEntryTime > 10) {
      await this.nc.publish('agog.triggers.slow_orders', JSON.stringify({
        avgTime: metrics.sales.avgOrderEntryTime,
        threshold: 10,
        timestamp: new Date().toISOString()
      }));
      console.log(`[MetricsProvider] 🚨 Triggered: slow order entry ${metrics.sales.avgOrderEntryTime} min`);
    }

    // Procurement triggers
    if (metrics.procurement.vendorOnTimeDelivery < 90) {
      await this.nc.publish('agog.triggers.vendor_late', JSON.stringify({
        rate: metrics.procurement.vendorOnTimeDelivery,
        threshold: 90,
        timestamp: new Date().toISOString()
      }));
      console.log(`[MetricsProvider] 🚨 Triggered: vendor late ${metrics.procurement.vendorOnTimeDelivery}%`);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  async close(): Promise<void> {
    await this.stop();
    await this.appPool.end();
    await this.agentPool.end();
    await this.nc.close();
  }
}
