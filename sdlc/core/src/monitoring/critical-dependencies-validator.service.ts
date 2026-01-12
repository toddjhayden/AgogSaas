/**
 * Critical Dependencies Validator Service
 *
 * Validates ALL critical dependencies before the Host Listener starts.
 * Uses HYBRID approach:
 * - Orchestrator: checked via SDLC heartbeat (runs in Docker, publishes its own heartbeat)
 * - Agent DB, NATS, Ollama: checked directly via localhost (Docker-exposed ports)
 *
 * Per WORKFLOW_RULES.md Rule #1: Services MUST EXIT immediately when critical dependencies fail.
 *
 * CRITICAL DEPENDENCIES:
 * 1. Agent Database (localhost:5434) - workflow persistence
 * 2. NATS Messaging (localhost:4223) - inter-agent communication
 * 3. Ollama LLM (localhost:11434) - local inference for embeddings
 * 4. Strategic Orchestrator (SDLC heartbeat) - workflow coordination, finish-first policy
 *
 * The Host Listener CANNOT function correctly if ANY of these are down.
 */

import axios from 'axios';
import { connect } from 'nats';
import { Pool } from 'pg';

interface DependencyStatus {
  name: string;
  healthy: boolean;
  error?: string;
  method: 'direct' | 'heartbeat';
}

interface OrchestratorHealth {
  component: string;
  status: string;
  is_stale: boolean;
  seconds_since_heartbeat: number | null;
}

export class CriticalDependenciesValidator {
  private readonly sdlcApiUrl: string;
  private readonly natsUrl: string;
  private readonly natsUser: string;
  private readonly natsPassword: string;
  private readonly ollamaUrl: string;
  private readonly dbHost: string;
  private readonly dbPort: number;
  private readonly dbUser: string;
  private readonly dbPassword: string;
  private readonly dbName: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly maxStaleSeconds: number;

  constructor() {
    // SDLC API for orchestrator heartbeat
    this.sdlcApiUrl = process.env.SDLC_API_URL || 'https://api.agog.fyi';

    // NATS - Host listener uses localhost:4223 (Docker-exposed port)
    this.natsUrl = process.env.HOST_NATS_URL || 'nats://localhost:4223';
    this.natsUser = process.env.NATS_USER || 'agents';
    this.natsPassword = process.env.NATS_PASSWORD || '';

    // Ollama - Host listener uses localhost:11434 (Docker-exposed port)
    this.ollamaUrl = process.env.HOST_OLLAMA_URL || 'http://localhost:11434';

    // Agent Database - Host listener uses localhost:5434 (Docker-exposed port)
    this.dbHost = 'localhost';
    this.dbPort = 5434;
    this.dbUser = 'agent_user';
    this.dbPassword = process.env.AGENT_DB_PASSWORD || 'agent_dev_password_2024';
    this.dbName = 'agent_memory';

    // Retry configuration
    this.maxRetries = parseInt(process.env.DEPENDENCY_CHECK_RETRIES || '10');
    this.retryDelayMs = parseInt(process.env.DEPENDENCY_CHECK_RETRY_DELAY_MS || '5000');
    this.maxStaleSeconds = parseInt(process.env.MAX_HEARTBEAT_STALE_SECONDS || '120');
  }

  /**
   * Validate ALL critical dependencies and exit if ANY are unavailable
   */
  async validateAndExit(): Promise<void> {
    console.log('[CriticalDependenciesValidator] ========================================');
    console.log('[CriticalDependenciesValidator] Validating ALL critical dependencies...');
    console.log('[CriticalDependenciesValidator] - Agent DB, NATS, Ollama: direct connection');
    console.log('[CriticalDependenciesValidator] - Orchestrator: SDLC heartbeat');
    console.log('[CriticalDependenciesValidator] ========================================');

    let lastResults: DependencyStatus[] = [];

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const results = await this.checkAllDependencies();
      lastResults = results;

      const allHealthy = results.every(r => r.healthy);
      const healthyCount = results.filter(r => r.healthy).length;

      console.log(`[CriticalDependenciesValidator] Attempt ${attempt}/${this.maxRetries}: ${healthyCount}/${results.length} healthy`);

      for (const result of results) {
        const icon = result.healthy ? '✅' : '❌';
        const status = result.healthy ? `HEALTHY (${result.method})` : `FAILED: ${result.error}`;
        console.log(`[CriticalDependenciesValidator]   ${icon} ${result.name}: ${status}`);
      }

      if (allHealthy) {
        console.log('[CriticalDependenciesValidator] ========================================');
        console.log('[CriticalDependenciesValidator] ✅ ALL critical dependencies healthy');
        console.log('[CriticalDependenciesValidator] ========================================');
        return;
      }

      if (attempt < this.maxRetries) {
        console.log(`[CriticalDependenciesValidator] Retrying in ${this.retryDelayMs}ms...`);
        await this.delay(this.retryDelayMs);
      }
    }

    // All retries exhausted - fail hard
    this.exitWithError(lastResults);
  }

  private async checkAllDependencies(): Promise<DependencyStatus[]> {
    // Run all checks in parallel for speed
    const [agentDb, nats, ollama, orchestrator] = await Promise.all([
      this.checkAgentDatabase(),
      this.checkNats(),
      this.checkOllama(),
      this.checkOrchestrator(),
    ]);

    return [agentDb, nats, ollama, orchestrator];
  }

  /** Direct connection check to Agent Database (localhost:5434) */
  private async checkAgentDatabase(): Promise<DependencyStatus> {
    const name = 'Agent Database';
    try {
      const pool = new Pool({
        host: this.dbHost,
        port: this.dbPort,
        user: this.dbUser,
        password: this.dbPassword,
        database: this.dbName,
        connectionTimeoutMillis: 5000,
      });

      await pool.query('SELECT 1');
      await pool.end();

      return { name, healthy: true, method: 'direct' };
    } catch (error: any) {
      return { name, healthy: false, error: error.message, method: 'direct' };
    }
  }

  /** Direct connection check to NATS (localhost:4223) */
  private async checkNats(): Promise<DependencyStatus> {
    const name = 'NATS Messaging';
    try {
      if (!this.natsPassword) {
        return { name, healthy: false, error: 'NATS_PASSWORD not set', method: 'direct' };
      }

      const nc = await connect({
        servers: this.natsUrl,
        user: this.natsUser,
        pass: this.natsPassword,
        timeout: 5000,
      });

      await nc.flush();
      await nc.close();

      return { name, healthy: true, method: 'direct' };
    } catch (error: any) {
      return { name, healthy: false, error: error.message, method: 'direct' };
    }
  }

  /** Direct connection check to Ollama (localhost:11434) */
  private async checkOllama(): Promise<DependencyStatus> {
    const name = 'Ollama LLM';
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });

      if (response.status === 200) {
        return { name, healthy: true, method: 'direct' };
      }

      return { name, healthy: false, error: `Unexpected status: ${response.status}`, method: 'direct' };
    } catch (error: any) {
      return { name, healthy: false, error: error.message, method: 'direct' };
    }
  }

  /** Check Orchestrator via SDLC heartbeat (it runs in Docker, publishes its own heartbeat) */
  private async checkOrchestrator(): Promise<DependencyStatus> {
    const name = 'Strategic Orchestrator';
    try {
      const response = await axios.get<{ success: boolean; data: OrchestratorHealth[] }>(
        `${this.sdlcApiUrl}/api/agent/infrastructure/health`,
        { timeout: 10000 }
      );

      if (!response.data?.success) {
        return { name, healthy: false, error: 'SDLC API failed', method: 'heartbeat' };
      }

      const orchestrator = response.data.data.find(c => c.component === 'orchestrator');

      if (!orchestrator) {
        return { name, healthy: false, error: 'Not found in SDLC health', method: 'heartbeat' };
      }

      if (orchestrator.status !== 'healthy') {
        return { name, healthy: false, error: `Status: ${orchestrator.status}`, method: 'heartbeat' };
      }

      if (orchestrator.is_stale) {
        return { name, healthy: false, error: 'Heartbeat is stale', method: 'heartbeat' };
      }

      if (orchestrator.seconds_since_heartbeat !== null &&
          orchestrator.seconds_since_heartbeat > this.maxStaleSeconds) {
        return { name, healthy: false, error: `Heartbeat too old: ${orchestrator.seconds_since_heartbeat}s`, method: 'heartbeat' };
      }

      return { name, healthy: true, method: 'heartbeat' };
    } catch (error: any) {
      return { name, healthy: false, error: error.message, method: 'heartbeat' };
    }
  }

  private exitWithError(results: DependencyStatus[]): never {
    console.error('[CriticalDependenciesValidator] ========================================');
    console.error('[CriticalDependenciesValidator] ❌ CRITICAL DEPENDENCY VALIDATION FAILED');
    console.error('[CriticalDependenciesValidator] ========================================');

    console.error('[CriticalDependenciesValidator] Failed components:');
    for (const result of results.filter(r => !r.healthy)) {
      console.error(`[CriticalDependenciesValidator]   ❌ ${result.name}: ${result.error}`);
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
