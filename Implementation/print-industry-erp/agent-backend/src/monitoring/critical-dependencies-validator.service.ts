/**
 * Critical Dependencies Validator Service
 *
 * Validates ALL critical dependencies before the Host Listener starts.
 * Uses the SDLC infrastructure health endpoint which aggregates heartbeats from all components.
 *
 * Per WORKFLOW_RULES.md Rule #1: Services MUST EXIT immediately when critical dependencies fail.
 *
 * CRITICAL DEPENDENCIES (must all show healthy heartbeat):
 * 1. Agent Database - workflow persistence
 * 2. NATS Messaging - inter-agent communication
 * 3. Ollama LLM - local inference for embeddings
 * 4. Strategic Orchestrator - workflow coordination, finish-first policy
 *
 * The Host Listener CANNOT function correctly if ANY of these are down.
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

// Components that MUST be healthy for Host Listener to operate
const REQUIRED_COMPONENTS = [
  'agent_db',      // Agent Database
  'nats',          // NATS Messaging
  'ollama',        // Ollama LLM
  'orchestrator',  // Strategic Orchestrator
];

export class CriticalDependenciesValidator {
  private readonly sdlcApiUrl: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly maxStaleSeconds: number;

  constructor() {
    this.sdlcApiUrl = process.env.SDLC_API_URL || 'https://api.agog.fyi';
    this.maxRetries = parseInt(process.env.DEPENDENCY_CHECK_RETRIES || '10');
    this.retryDelayMs = parseInt(process.env.DEPENDENCY_CHECK_RETRY_DELAY_MS || '5000');
    this.maxStaleSeconds = parseInt(process.env.MAX_HEARTBEAT_STALE_SECONDS || '120');
  }

  /**
   * Validate ALL critical dependencies via SDLC infrastructure health endpoint.
   * Exit if ANY required component is unhealthy or has stale heartbeat.
   */
  async validateAndExit(): Promise<void> {
    console.log('[CriticalDependenciesValidator] ========================================');
    console.log('[CriticalDependenciesValidator] Validating critical dependencies via SDLC...');
    console.log('[CriticalDependenciesValidator] Required: ' + REQUIRED_COMPONENTS.join(', '));
    console.log('[CriticalDependenciesValidator] ========================================');

    let lastHealthData: InfrastructureHealth[] = [];
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get<{ success: boolean; data: InfrastructureHealth[] }>(
          `${this.sdlcApiUrl}/api/agent/infrastructure/health`,
          { timeout: 10000 }
        );

        if (!response.data?.success) {
          throw new Error('SDLC infrastructure health endpoint returned unsuccessful response');
        }

        lastHealthData = response.data.data;
        const { allHealthy, results } = this.checkRequiredComponents(lastHealthData);

        console.log(`[CriticalDependenciesValidator] Attempt ${attempt}/${this.maxRetries}:`);
        for (const [component, status] of Object.entries(results)) {
          const icon = status.healthy ? '✅' : '❌';
          const msg = status.healthy
            ? `HEALTHY (${status.secondsAgo}s ago)`
            : status.error;
          console.log(`[CriticalDependenciesValidator]   ${icon} ${component}: ${msg}`);
        }

        if (allHealthy) {
          console.log('[CriticalDependenciesValidator] ========================================');
          console.log('[CriticalDependenciesValidator] ✅ ALL critical dependencies healthy');
          console.log('[CriticalDependenciesValidator] ========================================');
          return;
        }

        lastError = 'One or more required components unhealthy';
      } catch (error: any) {
        lastError = error.message;
        console.warn(`[CriticalDependenciesValidator] Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);
      }

      if (attempt < this.maxRetries) {
        console.log(`[CriticalDependenciesValidator] Retrying in ${this.retryDelayMs}ms...`);
        await this.delay(this.retryDelayMs);
      }
    }

    // All retries exhausted - fail hard
    this.exitWithError(lastHealthData, lastError);
  }

  private checkRequiredComponents(healthData: InfrastructureHealth[]): {
    allHealthy: boolean;
    results: Record<string, { healthy: boolean; error?: string; secondsAgo?: number }>;
  } {
    const results: Record<string, { healthy: boolean; error?: string; secondsAgo?: number }> = {};
    let allHealthy = true;

    for (const componentId of REQUIRED_COMPONENTS) {
      const component = healthData.find(c => c.component === componentId);

      if (!component) {
        results[componentId] = { healthy: false, error: 'Not found in health data' };
        allHealthy = false;
        continue;
      }

      if (component.status !== 'healthy') {
        results[componentId] = { healthy: false, error: `Status: ${component.status}` };
        allHealthy = false;
        continue;
      }

      if (component.is_stale) {
        results[componentId] = { healthy: false, error: 'Heartbeat is stale' };
        allHealthy = false;
        continue;
      }

      if (component.seconds_since_heartbeat !== null &&
          component.seconds_since_heartbeat > this.maxStaleSeconds) {
        results[componentId] = {
          healthy: false,
          error: `Heartbeat too old: ${component.seconds_since_heartbeat}s (max: ${this.maxStaleSeconds}s)`
        };
        allHealthy = false;
        continue;
      }

      results[componentId] = {
        healthy: true,
        secondsAgo: component.seconds_since_heartbeat ?? 0
      };
    }

    return { allHealthy, results };
  }

  private exitWithError(healthData: InfrastructureHealth[], lastError: string | null): never {
    console.error('[CriticalDependenciesValidator] ========================================');
    console.error('[CriticalDependenciesValidator] ❌ CRITICAL DEPENDENCY VALIDATION FAILED');
    console.error('[CriticalDependenciesValidator] ========================================');

    if (lastError) {
      console.error(`[CriticalDependenciesValidator] Last error: ${lastError}`);
    }

    if (healthData.length > 0) {
      const { results } = this.checkRequiredComponents(healthData);
      console.error('[CriticalDependenciesValidator] Failed components:');
      for (const [component, status] of Object.entries(results)) {
        if (!status.healthy) {
          console.error(`[CriticalDependenciesValidator]   ❌ ${component}: ${status.error}`);
        }
      }
    }

    console.error('[CriticalDependenciesValidator] ');
    console.error('[CriticalDependenciesValidator] Per WORKFLOW_RULES.md Rule #1:');
    console.error('[CriticalDependenciesValidator] Services MUST EXIT immediately when critical dependencies fail.');
    console.error('[CriticalDependenciesValidator] NO graceful degradation. Fix the dependencies and restart.');
    console.error('[CriticalDependenciesValidator] ========================================');

    process.exit(1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
