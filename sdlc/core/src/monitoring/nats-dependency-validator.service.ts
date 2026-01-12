/**
 * NATS Dependency Validator Service
 *
 * Validates that NATS is available before starting services.
 * REQ: REQ-AUDIT-1767982074
 */

import { connect, NatsConnection } from 'nats';

export class NatsDependencyValidator {
  private readonly natsUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor() {
    this.natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    this.maxRetries = parseInt(process.env.NATS_CONNECT_RETRIES || '10');
    this.retryDelayMs = parseInt(process.env.NATS_CONNECT_RETRY_DELAY_MS || '3000');
  }

  /**
   * Validate NATS connection and exit if unavailable
   */
  async validateAndExit(): Promise<void> {
    console.log(`[NatsDependencyValidator] Validating NATS connection at ${this.natsUrl}...`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const nc = await this.tryConnect();
        console.log(`[NatsDependencyValidator] ✅ NATS connection validated successfully`);
        await nc.close();
        return;
      } catch (error: any) {
        lastError = error;
        console.warn(`[NatsDependencyValidator] Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          console.log(`[NatsDependencyValidator] Retrying in ${this.retryDelayMs}ms...`);
          await this.delay(this.retryDelayMs);
        }
      }
    }

    console.error(`[NatsDependencyValidator] ❌ NATS connection failed after ${this.maxRetries} attempts`);
    console.error(`[NatsDependencyValidator] Last error: ${lastError?.message}`);
    console.error(`[NatsDependencyValidator] Per WORKFLOW_RULES.md Rule #1: Services MUST EXIT immediately when critical dependencies fail`);
    process.exit(1);
  }

  private async tryConnect(): Promise<NatsConnection> {
    const nc = await connect({
      servers: this.natsUrl,
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASSWORD,
      timeout: 5000,
    });

    // Verify we can actually use the connection
    await nc.flush();

    return nc;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
