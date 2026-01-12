/**
 * Product Owner Daemon
 * Marcus (Warehouse), Sarah (Sales), Alex (Procurement)
 * Monitors domain metrics and auto-creates feature requests
 */

import { connect, NatsConnection } from 'nats';

export type ProductOwnerDomain = 'inventory' | 'sales' | 'procurement';

export interface DomainThresholds {
  inventory: {
    stockoutRate: number;        // %
    binUtilization: number;      // %
    cycleCountAccuracy: number;  // %
  };
  sales: {
    avgOrderEntryTime: number;   // minutes
    quoteConversion: number;     // %
    complaintRate: number;       // %
  };
  procurement: {
    vendorOnTimeDelivery: number; // %
    costVariance: number;         // %
    rfqResponseTime: number;      // hours
  };
}

const DEFAULT_THRESHOLDS: DomainThresholds = {
  inventory: {
    stockoutRate: 5.0,
    binUtilization: 90.0,
    cycleCountAccuracy: 98.0
  },
  sales: {
    avgOrderEntryTime: 10.0,
    quoteConversion: 40.0,
    complaintRate: 2.0
  },
  procurement: {
    vendorOnTimeDelivery: 90.0,
    costVariance: 5.0,
    rfqResponseTime: 48.0
  }
};

export class ProductOwnerDaemon {
  private nc!: NatsConnection;
  private domain: ProductOwnerDomain;
  private owner: 'marcus' | 'sarah' | 'alex';
  private isRunning = false;
  private thresholds: DomainThresholds;
  private requestCount = 0;

  constructor(domain: ProductOwnerDomain, thresholds?: Partial<DomainThresholds>) {
    this.domain = domain;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

    // Map domain to owner
    if (domain === 'inventory') this.owner = 'marcus';
    else if (domain === 'sales') this.owner = 'sarah';
    else this.owner = 'alex';
  }

  async initialize(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: `product-owner-${this.domain}`
    });

    console.log(`[ProductOwner/${this.owner}] Daemon initialized for ${this.domain}`);
  }

  /**
   * Start daemon (monitors every 5 hours - aligned with Recovery & Value Chain cycle)
   */
  async startDaemon(): Promise<void> {
    if (this.isRunning) {
      console.log(`[ProductOwner/${this.owner}] Already running`);
      return;
    }

    this.isRunning = true;
    console.log(`[ProductOwner/${this.owner}] Starting daemon (5-hour interval - aligned with system cycle)...`);

    // Subscribe to metric updates
    await this.subscribeToMetrics();

    // Subscribe to triggers
    await this.subscribeToTriggers();

    // Periodic check every 5 hours (aligned with Recovery & Value Chain Expert)
    setInterval(async () => {
      if (this.isRunning) {
        await this.checkMetrics();
      }
    }, 5 * 60 * 60 * 1000); // 5 hours - ALIGNED WITH SYSTEM CYCLE

    console.log(`[ProductOwner/${this.owner}] ✅ Monitoring ${this.domain} domain`);
  }

  /**
   * Subscribe to metrics updates
   */
  private async subscribeToMetrics(): Promise<void> {
    const subject = `agog.metrics.${this.domain}`;
    const sub = this.nc.subscribe(subject);

    (async () => {
      for await (const msg of sub) {
        try {
          const metrics = JSON.parse(msg.string());
          await this.analyzeMetrics(metrics);
        } catch (error: any) {
          console.error(`[ProductOwner/${this.owner}] Error processing metrics:`, error.message);
        }
      }
    })();
  }

  /**
   * Subscribe to threshold triggers
   */
  private async subscribeToTriggers(): Promise<void> {
    const triggers = this.getRelevantTriggers();

    for (const trigger of triggers) {
      const sub = this.nc.subscribe(trigger);

      (async () => {
        for await (const msg of sub) {
          try {
            const data = JSON.parse(msg.string());
            console.log(`[ProductOwner/${this.owner}] 🚨 Trigger received: ${trigger}`);
            await this.handleTrigger(trigger, data);
          } catch (error: any) {
            console.error(`[ProductOwner/${this.owner}] Error handling trigger:`, error.message);
          }
        }
      })();
    }
  }

  /**
   * Get relevant triggers for domain
   */
  private getRelevantTriggers(): string[] {
    if (this.domain === 'inventory') {
      return ['agog.triggers.stockout', 'agog.triggers.bin_full'];
    } else if (this.domain === 'sales') {
      return ['agog.triggers.slow_orders', 'agog.triggers.low_conversion'];
    } else {
      return ['agog.triggers.vendor_late', 'agog.triggers.cost_overrun'];
    }
  }

  /**
   * Analyze metrics and generate recommendations
   */
  private async analyzeMetrics(metrics: any): Promise<void> {
    const violations = this.checkThresholds(metrics);

    if (violations.length > 0) {
      console.log(`[ProductOwner/${this.owner}] Found ${violations.length} threshold violations`);

      for (const violation of violations) {
        await this.createRecommendation(violation);
      }
    }
  }

  /**
   * Check if metrics violate thresholds
   */
  private checkThresholds(metrics: any): any[] {
    const violations: any[] = [];

    if (this.domain === 'inventory') {
      if (metrics.stockoutRate > this.thresholds.inventory.stockoutRate) {
        violations.push({
          metric: 'stockoutRate',
          current: metrics.stockoutRate,
          threshold: this.thresholds.inventory.stockoutRate,
          severity: 'high'
        });
      }
    } else if (this.domain === 'sales') {
      if (metrics.avgOrderEntryTime > this.thresholds.sales.avgOrderEntryTime) {
        violations.push({
          metric: 'avgOrderEntryTime',
          current: metrics.avgOrderEntryTime,
          threshold: this.thresholds.sales.avgOrderEntryTime,
          severity: 'medium'
        });
      }
    } else if (this.domain === 'procurement') {
      if (metrics.vendorOnTimeDelivery < this.thresholds.procurement.vendorOnTimeDelivery) {
        violations.push({
          metric: 'vendorOnTimeDelivery',
          current: metrics.vendorOnTimeDelivery,
          threshold: this.thresholds.procurement.vendorOnTimeDelivery,
          severity: 'high'
        });
      }
    }

    return violations;
  }

  /**
   * Create recommendation for threshold violation
   */
  private async createRecommendation(violation: any): Promise<void> {
    const reqNumber = `REQ-${this.domain.toUpperCase()}-AUTO-${Date.now()}`;

    const recommendation = {
      reqNumber,
      title: this.generateTitle(violation),
      owner: this.owner,
      priority: violation.severity === 'high' ? 'P1' : 'P2',
      businessValue: this.generateBusinessValue(violation),
      requirements: this.generateRequirements(violation),
      generatedBy: `product-owner-${this.owner}`,
      generatedAt: new Date().toISOString()
    };

    await this.nc.publish(`agog.recommendations.${this.domain}`, JSON.stringify(recommendation));

    this.requestCount++;
    console.log(`[ProductOwner/${this.owner}] 📨 Generated recommendation: ${reqNumber}`);
  }

  /**
   * Generate title for violation
   */
  private generateTitle(violation: any): string {
    const titles: Record<string, string> = {
      stockoutRate: 'Address High Stockout Rate',
      avgOrderEntryTime: 'Optimize Order Entry Process',
      vendorOnTimeDelivery: 'Improve Vendor Delivery Performance'
    };

    return titles[violation.metric] || 'Address Metric Violation';
  }

  /**
   * Generate business value
   */
  private generateBusinessValue(violation: any): string {
    return `Metric ${violation.metric} at ${violation.current} exceeds threshold of ${violation.threshold}. Addressing this will improve operational efficiency and reduce business risk.`;
  }

  /**
   * Generate requirements
   */
  private generateRequirements(violation: any): string[] {
    return [
      `Investigate root cause of ${violation.metric} violation`,
      'Implement corrective measures',
      'Add monitoring and alerting',
      'Validate improvement over 30-day period'
    ];
  }

  /**
   * Handle trigger event
   */
  private async handleTrigger(trigger: string, data: any): Promise<void> {
    console.log(`[ProductOwner/${this.owner}] Handling trigger: ${trigger}`, data);
    // Trigger already indicates threshold violation
    // Create recommendation immediately
    await this.createRecommendation({
      metric: trigger.split('.').pop(),
      current: data.rate || data.avgTime,
      threshold: data.threshold,
      severity: 'high'
    });
  }

  /**
   * Manual metrics check
   */
  private async checkMetrics(): Promise<void> {
    console.log(`[ProductOwner/${this.owner}] Running periodic metrics check...`);
    // Metrics will arrive via NATS subscription
    // This is just a heartbeat log
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log(`[ProductOwner/${this.owner}] Daemon stopped`);
  }

  async close(): Promise<void> {
    await this.stop();
    await this.nc.close();
  }

  getStats(): {
    domain: string;
    owner: string;
    isRunning: boolean;
    requestCount: number;
  } {
    return {
      domain: this.domain,
      owner: this.owner,
      isRunning: this.isRunning,
      requestCount: this.requestCount
    };
  }
}
