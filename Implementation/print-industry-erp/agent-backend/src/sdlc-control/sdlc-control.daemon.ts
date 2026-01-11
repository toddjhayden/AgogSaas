/**
 * SDLC Control Daemon
 * Main service coordinating all SDLC Control functionality
 *
 * Features:
 * - Entity Dependency Graph management
 * - Kanban phase workflow
 * - Column semantic governance
 * - Cross-BU impact analysis
 * - NATS event publishing
 */

import { connect, NatsConnection, JetStreamManager, JetStreamClient, StorageType } from 'nats';
import { getSDLCDatabase, SDLCDatabaseService } from './sdlc-database.service';
import { EntityDependencyService, ExecutionPlan } from './entity-dependency.service';
import { PhaseManagerService } from './phase-manager.service';
import { ColumnSemanticService, ColumnValidationResult } from './column-semantic.service';

// ============================================================================
// Types
// ============================================================================

export interface SDLCControlConfig {
  natsUrl?: string;
  natsUser?: string;
  natsPassword?: string;
  healthCheckIntervalMs?: number;
  publishEvents?: boolean;
}

export interface SDLCHealthStatus {
  database: boolean;
  nats: boolean;
  lastCheck: Date;
  entityCount: number;
  phaseCount: number;
  columnCount: number;
}

// ============================================================================
// Daemon
// ============================================================================

export class SDLCControlDaemon {
  private db: SDLCDatabaseService;
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;

  private entityService: EntityDependencyService;
  private phaseService: PhaseManagerService;
  private columnService: ColumnSemanticService;

  private config: SDLCControlConfig;
  private isRunning = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: SDLCControlConfig = {}) {
    this.config = {
      natsUrl: config.natsUrl || process.env.NATS_URL || 'nats://localhost:4222',
      natsUser: config.natsUser || process.env.NATS_USER,
      natsPassword: config.natsPassword || process.env.NATS_PASSWORD,
      healthCheckIntervalMs: config.healthCheckIntervalMs || 60000,
      publishEvents: config.publishEvents ?? true,
    };

    this.db = getSDLCDatabase();
    this.entityService = new EntityDependencyService();
    this.phaseService = new PhaseManagerService();
    this.columnService = new ColumnSemanticService();
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Initialize the daemon
   */
  async initialize(): Promise<void> {
    console.log('[SDLCControl] Initializing...');

    // Verify database connection
    const dbHealthy = await this.db.healthCheck();
    if (!dbHealthy) {
      throw new Error('SDLC database is not accessible');
    }
    console.log('[SDLCControl] Database connection verified');

    // Connect to NATS if events enabled
    if (this.config.publishEvents) {
      try {
        this.nc = await connect({
          servers: this.config.natsUrl,
          user: this.config.natsUser,
          pass: this.config.natsPassword,
          reconnect: true,
          maxReconnectAttempts: -1,
        });

        this.jsm = await this.nc.jetstreamManager();
        this.js = this.nc.jetstream();

        await this.initializeStreams();
        console.log('[SDLCControl] NATS connection established');
      } catch (error: any) {
        console.warn(`[SDLCControl] NATS connection failed: ${error.message}`);
        console.warn('[SDLCControl] Continuing without event publishing');
      }
    }

    console.log('[SDLCControl] Initialized successfully');
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    this.isRunning = true;
    console.log('[SDLCControl] Starting daemon...');

    // Start health check loop
    this.healthCheckInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runHealthCheck();
      }
    }, this.config.healthCheckIntervalMs);

    // Subscribe to NATS events if connected
    if (this.nc) {
      await this.subscribeToEvents();
    }

    // Publish startup event
    await this.publishEvent('agog.sdlc.control.started', {
      timestamp: new Date().toISOString(),
    });

    console.log('[SDLCControl] Daemon running');
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    console.log('[SDLCControl] Stopping daemon...');
    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.publishEvent('agog.sdlc.control.stopped', {
      timestamp: new Date().toISOString(),
    });

    if (this.nc) {
      await this.nc.close();
    }

    await this.db.close();
    console.log('[SDLCControl] Daemon stopped');
  }

  // ==========================================================================
  // Public API - Entity Operations
  // ==========================================================================

  /**
   * Register an entity
   */
  async registerEntity(entity: Parameters<EntityDependencyService['registerEntity']>[0]) {
    const result = await this.entityService.registerEntity(entity);

    await this.publishEvent('agog.sdlc.entities.registered', {
      entity: result.entityName,
      bu: result.owningBu,
      type: result.entityType,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Add entity dependency
   */
  async addDependency(dependency: Parameters<EntityDependencyService['addDependency']>[0]) {
    const result = await this.entityService.addDependency(dependency);

    await this.publishEvent('agog.sdlc.entities.dependency.added', {
      dependent: result.dependentEntity,
      dependsOn: result.dependsOnEntity,
      type: result.dependencyType,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Compute execution order for entities
   */
  async computeExecutionOrder(entityNames: string[]): Promise<ExecutionPlan> {
    const plan = await this.entityService.computeExecutionOrder(entityNames);

    await this.publishEvent('agog.sdlc.execution.plan.computed', {
      entities: entityNames,
      totalEntities: plan.totalEntities,
      maxDepth: plan.maxDepth,
      timestamp: new Date().toISOString(),
    });

    return plan;
  }

  /**
   * Get impact analysis for an entity change
   */
  async analyzeImpact(entityName: string) {
    const impact = await this.entityService.getImpactedEntities(entityName);

    await this.publishEvent('agog.sdlc.impact.analyzed', {
      entity: entityName,
      directImpacts: impact.direct.length,
      transitiveImpacts: impact.transitive.length,
      crossBuImpacts: impact.crossBu.length,
      timestamp: new Date().toISOString(),
    });

    return impact;
  }

  /**
   * Detect cycles in dependency graph
   */
  async detectCycles() {
    const result = await this.entityService.detectCycles();

    if (result.hasCycles) {
      await this.publishEvent('agog.sdlc.cycles.detected', {
        cycleCount: result.cycles.length,
        cycles: result.cycles,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  // ==========================================================================
  // Public API - Phase Operations
  // ==========================================================================

  /**
   * Get Kanban board data
   */
  async getKanbanBoard() {
    return this.phaseService.getKanbanBoard();
  }

  /**
   * Validate phase transition
   */
  async validateTransition(fromPhase: string, toPhase: string, requestId?: string) {
    const result = await this.phaseService.validateTransition(fromPhase, toPhase, requestId);

    if (!result.isValid) {
      await this.publishEvent('agog.sdlc.transition.blocked', {
        fromPhase,
        toPhase,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Get phase statistics
   */
  async getPhaseStats() {
    return this.phaseService.getPhaseStats();
  }

  // ==========================================================================
  // Public API - Column Governance
  // ==========================================================================

  /**
   * Validate column usage
   */
  async validateColumn(
    column: Parameters<ColumnSemanticService['validateColumn']>[0],
    requestingBu: string
  ): Promise<ColumnValidationResult> {
    const result = await this.columnService.validateColumn(column, requestingBu);

    if (!result.isValid) {
      await this.publishEvent('agog.sdlc.column.blocked', {
        column: column.name,
        table: column.table,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Validate SQL migration
   */
  async validateMigration(sql: string, requestingBu: string) {
    const result = await this.columnService.validateMigration(sql, requestingBu);

    await this.publishEvent('agog.sdlc.migration.validated', {
      isValid: result.isValid,
      errorsCount: result.errors.length,
      warningsCount: result.warnings.length,
      columnsChecked: result.columnsChecked,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Get column semantic statistics
   */
  async getColumnStats() {
    return this.columnService.getSemanticStats();
  }

  // ==========================================================================
  // Public API - Cross-BU Analysis
  // ==========================================================================

  /**
   * Get cross-BU dependency matrix
   */
  async getCrossBuMatrix() {
    return this.entityService.getCrossBuMatrix();
  }

  /**
   * Get full dependency graph
   */
  async getDependencyGraph() {
    return this.entityService.getDependencyGraph();
  }

  // ==========================================================================
  // Health & Status
  // ==========================================================================

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<SDLCHealthStatus> {
    const [dbHealthy, entities, phases, columns] = await Promise.all([
      this.db.healthCheck(),
      this.entityService.getAllEntities(),
      this.phaseService.getAllPhases(),
      this.columnService.getAllColumns(),
    ]);

    return {
      database: dbHealthy,
      nats: this.nc !== null && !this.nc.isClosed(),
      lastCheck: new Date(),
      entityCount: entities.length,
      phaseCount: phases.length,
      columnCount: columns.length,
    };
  }

  private async runHealthCheck(): Promise<void> {
    try {
      const status = await this.getHealthStatus();

      if (!status.database) {
        console.error('[SDLCControl] Database health check failed!');
        await this.publishEvent('agog.sdlc.health.database.failed', {
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error('[SDLCControl] Health check error:', error.message);
    }
  }

  // ==========================================================================
  // NATS Integration
  // ==========================================================================

  private async initializeStreams(): Promise<void> {
    if (!this.jsm) return;

    const streams = [
      {
        name: 'agog_sdlc_events',
        subjects: ['agog.sdlc.>'],
        storage: StorageType.File,
        max_msgs: 10000,
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
      },
    ];

    for (const streamConfig of streams) {
      try {
        await this.jsm.streams.info(streamConfig.name);
      } catch {
        await this.jsm.streams.add(streamConfig);
        console.log(`[SDLCControl] Created stream: ${streamConfig.name}`);
      }
    }
  }

  private async subscribeToEvents(): Promise<void> {
    if (!this.nc) return;

    // Subscribe to entity registration requests
    const entitySub = this.nc.subscribe('agog.sdlc.request.entity.register');
    (async () => {
      for await (const msg of entitySub) {
        if (!this.isRunning) break;
        try {
          const data = JSON.parse(msg.data.toString());
          await this.registerEntity(data);
        } catch (error: any) {
          console.error('[SDLCControl] Error processing entity registration:', error.message);
        }
      }
    })();

    // Subscribe to dependency addition requests
    const depSub = this.nc.subscribe('agog.sdlc.request.dependency.add');
    (async () => {
      for await (const msg of depSub) {
        if (!this.isRunning) break;
        try {
          const data = JSON.parse(msg.data.toString());
          await this.addDependency(data);
        } catch (error: any) {
          console.error('[SDLCControl] Error processing dependency:', error.message);
        }
      }
    })();

    // Subscribe to column validation requests
    const colSub = this.nc.subscribe('agog.sdlc.request.column.validate');
    (async () => {
      for await (const msg of colSub) {
        if (!this.isRunning) break;
        try {
          const { column, bu } = JSON.parse(msg.data.toString());
          const result = await this.validateColumn(column, bu);
          if (msg.reply) {
            this.nc!.publish(msg.reply, Buffer.from(JSON.stringify(result)));
          }
        } catch (error: any) {
          console.error('[SDLCControl] Error validating column:', error.message);
        }
      }
    })();

    console.log('[SDLCControl] Subscribed to NATS events');
  }

  private async publishEvent(subject: string, data: any): Promise<void> {
    if (!this.js) return;

    try {
      await this.js.publish(subject, Buffer.from(JSON.stringify(data)));
    } catch (error: any) {
      console.warn(`[SDLCControl] Failed to publish event ${subject}:`, error.message);
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const daemon = new SDLCControlDaemon();

  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await daemon.stop();
    process.exit(0);
  });

  daemon
    .initialize()
    .then(() => daemon.start())
    .catch((error) => {
      console.error('Failed to start SDLC Control daemon:', error);
      process.exit(1);
    });
}
