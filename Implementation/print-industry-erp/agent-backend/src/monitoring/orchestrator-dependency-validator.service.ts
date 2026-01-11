/**
 * Orchestrator Dependency Validator Service
 *
 * Validates that the Strategic Orchestrator is running before starting the Host Listener.
 * Per WORKFLOW_RULES.md Rule #1: Services MUST EXIT immediately when critical dependencies fail.
 *
 * The Host Listener MUST NOT accept work if the orchestrator is down because:
 * - No finish-first policy enforcement
 * - No automatic work prioritization
 * - QA/blocked items won't be processed correctly
 * - System will accumulate orphaned work
 */

import axios from 'axios';

interface InfrastructureHealth {
  component: string;
  display_name: string;
  status: string;
  last_heartbeat: string | null;
  is_stale: boolean;
  seconds_since_heartbeat: number | null;
}

export class OrchestratorDependencyValidator {
  private readonly sdlcApiUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly maxStaleSeconds: number;

  constructor() {
    this.sdlcApiUrl = process.env.SDLC_API_URL || 'https://api.agog.fyi';
    this.maxRetries = parseInt(process.env.ORCHESTRATOR_CONNECT_RETRIES || '10');
    this.retryDelayMs = parseInt(process.env.ORCHESTRATOR_CONNECT_RETRY_DELAY_MS || '5000');
    this.maxStaleSeconds = parseInt(process.env.ORCHESTRATOR_MAX_STALE_SECONDS || '120'); // 2 minutes
  }

  /**
   * Validate orchestrator is running and exit if unavailable
   */
  async validateAndExit(): Promise<void> {
    console.log(`[OrchestratorDependencyValidator] Validating orchestrator health via ${this.sdlcApiUrl}...`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const isHealthy = await this.checkOrchestratorHealth();
        if (isHealthy) {
          console.log(`[OrchestratorDependencyValidator] ✅ Orchestrator is healthy`);
          return;
        } else {
          throw new Error('Orchestrator is not healthy or heartbeat is stale');
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`[OrchestratorDependencyValidator] Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          console.log(`[OrchestratorDependencyValidator] Retrying in ${this.retryDelayMs}ms...`);
          await this.delay(this.retryDelayMs);
        }
      }
    }

    console.error(`[OrchestratorDependencyValidator] ❌ Orchestrator validation failed after ${this.maxRetries} attempts`);
    console.error(`[OrchestratorDependencyValidator] Last error: ${lastError?.message}`);
    console.error(`[OrchestratorDependencyValidator] Per WORKFLOW_RULES.md Rule #1: Services MUST EXIT immediately when critical dependencies fail`);
    console.error(`[OrchestratorDependencyValidator] The Host Listener CANNOT function correctly without the Orchestrator.`);
    console.error(`[OrchestratorDependencyValidator] Without orchestrator: no finish-first policy, no work prioritization, orphaned work accumulates.`);
    process.exit(1);
  }

  private async checkOrchestratorHealth(): Promise<boolean> {
    const response = await axios.get<{ success: boolean; data: InfrastructureHealth[] }>(
      `${this.sdlcApiUrl}/api/agent/infrastructure/health`,
      { timeout: 10000 }
    );

    if (!response.data.success) {
      throw new Error('SDLC API returned unsuccessful response');
    }

    const orchestrator = response.data.data.find(c => c.component === 'orchestrator');

    if (!orchestrator) {
      throw new Error('Orchestrator component not found in infrastructure health');
    }

    // Check if orchestrator status is healthy
    if (orchestrator.status !== 'healthy') {
      console.warn(`[OrchestratorDependencyValidator] Orchestrator status: ${orchestrator.status}`);
      return false;
    }

    // Check if heartbeat is stale
    if (orchestrator.is_stale) {
      console.warn(`[OrchestratorDependencyValidator] Orchestrator heartbeat is stale`);
      return false;
    }

    // Check heartbeat age
    if (orchestrator.seconds_since_heartbeat !== null &&
        orchestrator.seconds_since_heartbeat > this.maxStaleSeconds) {
      console.warn(`[OrchestratorDependencyValidator] Orchestrator heartbeat too old: ${orchestrator.seconds_since_heartbeat}s (max: ${this.maxStaleSeconds}s)`);
      return false;
    }

    console.log(`[OrchestratorDependencyValidator] Orchestrator status: ${orchestrator.status}, last heartbeat: ${orchestrator.seconds_since_heartbeat}s ago`);
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
