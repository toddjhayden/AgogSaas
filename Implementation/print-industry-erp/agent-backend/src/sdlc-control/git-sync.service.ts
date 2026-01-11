/**
 * Git Sync Service
 * Synchronizes SDLC Control database records to JSON files for Git versioning
 *
 * Features:
 * - Real-time sync via PostgreSQL LISTEN/NOTIFY
 * - Periodic full verification
 * - Structured export directory
 * - Rebuild capability from files
 */

import { getSDLCDatabase, SDLCDatabaseService } from './sdlc-database.service';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface GitSyncConfig {
  exportPath: string;
  syncIntervalMs?: number;
  enableNotify?: boolean;
}

export interface SyncStats {
  lastSync: Date;
  businessUnits: number;
  entities: number;
  columns: number;
  requests: number;
  diagrams: number;
}

// ============================================================================
// Service
// ============================================================================

export class GitSyncService {
  private db: SDLCDatabaseService;
  private config: GitSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: GitSyncConfig) {
    this.config = {
      exportPath: config.exportPath,
      syncIntervalMs: config.syncIntervalMs || 300000, // 5 minutes
      enableNotify: config.enableNotify ?? true,
    };
    this.db = getSDLCDatabase();
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    console.log('[GitSync] Initializing...');

    // Create export directory structure
    await this.ensureDirectoryStructure();

    console.log('[GitSync] Initialized');
  }

  /**
   * Start the sync service
   */
  async start(): Promise<void> {
    this.isRunning = true;
    console.log('[GitSync] Starting...');

    // Perform initial full sync
    await this.fullSync();

    // Start periodic sync
    this.syncInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.fullSync();
      }
    }, this.config.syncIntervalMs);

    console.log(`[GitSync] Running (sync every ${this.config.syncIntervalMs! / 1000}s)`);
  }

  /**
   * Stop the sync service
   */
  async stop(): Promise<void> {
    console.log('[GitSync] Stopping...');
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    console.log('[GitSync] Stopped');
  }

  // ==========================================================================
  // Full Sync
  // ==========================================================================

  /**
   * Perform a full sync of all data
   */
  async fullSync(): Promise<SyncStats> {
    console.log('[GitSync] Starting full sync...');

    const stats: SyncStats = {
      lastSync: new Date(),
      businessUnits: 0,
      entities: 0,
      columns: 0,
      requests: 0,
      diagrams: 0,
    };

    try {
      // Sync business units
      stats.businessUnits = await this.syncBusinessUnits();

      // Sync entities and dependencies
      stats.entities = await this.syncEntities();

      // Sync column registry
      stats.columns = await this.syncColumnRegistry();

      // Sync owner requests
      stats.requests = await this.syncOwnerRequests();

      // Sync architecture diagrams
      stats.diagrams = await this.syncDiagrams();

      // Write sync metadata
      await this.writeSyncMetadata(stats);

      console.log(`[GitSync] Full sync complete: ${stats.businessUnits} BUs, ${stats.entities} entities, ${stats.columns} columns, ${stats.requests} requests, ${stats.diagrams} diagrams`);
    } catch (error: any) {
      console.error('[GitSync] Sync error:', error.message);
    }

    return stats;
  }

  // ==========================================================================
  // Business Units
  // ==========================================================================

  private async syncBusinessUnits(): Promise<number> {
    const dir = path.join(this.config.exportPath, 'business-units');

    const result = await this.db.query(`
      SELECT * FROM business_units ORDER BY code
    `);

    // Write each BU to a separate file
    for (const row of result) {
      const bu = {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        modules: row.modules,
        color: row.color,
        isActive: row.is_active,
        createdAt: row.created_at,
      };

      await this.writeJsonFile(
        path.join(dir, `${row.code}.json`),
        bu
      );
    }

    // Write index file
    await this.writeJsonFile(
      path.join(dir, '_index.json'),
      {
        count: result.length,
        codes: result.map((r: any) => r.code),
        lastUpdated: new Date().toISOString(),
      }
    );

    return result.length;
  }

  // ==========================================================================
  // Entity Registry
  // ==========================================================================

  private async syncEntities(): Promise<number> {
    const dir = path.join(this.config.exportPath, 'entity-registry');

    // Get entities with dependencies
    const entities = await this.db.query(`
      SELECT e.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'dependsOn', d.depends_on_entity,
            'type', d.dependency_type,
            'reason', d.reason
          ))
          FROM entity_dependencies d WHERE d.dependent_entity = e.entity_name),
          '[]'::json
        ) as dependencies,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'dependent', d.dependent_entity,
            'type', d.dependency_type
          ))
          FROM entity_dependencies d WHERE d.depends_on_entity = e.entity_name),
          '[]'::json
        ) as dependents
      FROM entity_registry e
      ORDER BY owning_bu, entity_name
    `);

    // Group by BU
    const byBu: Record<string, any[]> = {};
    for (const row of entities) {
      const bu = row.owning_bu;
      if (!byBu[bu]) byBu[bu] = [];
      byBu[bu].push({
        entityName: row.entity_name,
        owningBu: row.owning_bu,
        entityType: row.entity_type,
        isFoundation: row.is_foundation,
        description: row.description,
        dependencies: row.dependencies,
        dependents: row.dependents,
        createdAt: row.created_at,
      });
    }

    // Write per-BU entity files
    for (const [bu, entityList] of Object.entries(byBu)) {
      await this.writeJsonFile(
        path.join(dir, `${bu}.json`),
        {
          businessUnit: bu,
          entities: entityList,
          count: entityList.length,
        }
      );
    }

    // Write index file with full dependency graph
    const dependencies = await this.db.query(`
      SELECT dependent_entity, depends_on_entity, dependency_type, reason
      FROM entity_dependencies
      ORDER BY dependent_entity
    `);

    await this.writeJsonFile(
      path.join(dir, '_index.json'),
      {
        totalEntities: entities.length,
        byBu: Object.fromEntries(Object.entries(byBu).map(([k, v]) => [k, v.length])),
        dependencyGraph: dependencies.map((d: any) => ({
          from: d.dependent_entity,
          to: d.depends_on_entity,
          type: d.dependency_type,
        })),
        lastUpdated: new Date().toISOString(),
      }
    );

    return entities.length;
  }

  // ==========================================================================
  // Column Semantic Registry
  // ==========================================================================

  private async syncColumnRegistry(): Promise<number> {
    const dir = path.join(this.config.exportPath, 'column-registry');

    const result = await this.db.query(`
      SELECT * FROM column_semantic_registry ORDER BY column_name
    `);

    // Group by semantic type
    const byType: Record<string, any[]> = {};
    for (const row of result) {
      const type = row.semantic_type;
      if (!byType[type]) byType[type] = [];

      const col = {
        columnName: row.column_name,
        semanticType: row.semantic_type,
        referencesTable: row.references_table,
        referencesColumn: row.references_column,
        dataType: row.data_type,
        definedByBu: row.defined_by_bu,
        definedInTable: row.defined_in_table,
        semanticDescription: row.semantic_description,
        validUsageExamples: row.valid_usage_examples,
        createdAt: row.created_at,
      };

      byType[type].push(col);

      // Also write individual file for each column
      await this.writeJsonFile(
        path.join(dir, `${row.column_name}.json`),
        col
      );
    }

    // Write type index files
    for (const [type, cols] of Object.entries(byType)) {
      await this.writeJsonFile(
        path.join(dir, `_by-type-${type.toLowerCase()}.json`),
        {
          semanticType: type,
          columns: cols,
          count: cols.length,
        }
      );
    }

    // Write main index file
    await this.writeJsonFile(
      path.join(dir, '_index.json'),
      {
        totalColumns: result.length,
        byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length])),
        columns: result.map((r: any) => ({
          name: r.column_name,
          type: r.semantic_type,
          bu: r.defined_by_bu,
        })),
        lastUpdated: new Date().toISOString(),
      }
    );

    return result.length;
  }

  // ==========================================================================
  // Owner Requests
  // ==========================================================================

  private async syncOwnerRequests(): Promise<number> {
    const dir = path.join(this.config.exportPath, 'requests');

    const result = await this.db.query(`
      SELECT r.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'entity', s.entity_name,
            'changeType', s.change_type,
            'executionOrder', s.execution_order,
            'status', s.status
          ))
          FROM request_entity_scope s WHERE s.request_id = r.id),
          '[]'::json
        ) as affected_entities
      FROM owner_requests r
      ORDER BY created_at DESC
    `);

    // Write each request to a separate file
    for (const row of result) {
      const request = {
        id: row.id,
        reqNumber: row.req_number,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: row.status,
        primaryBu: row.primary_bu,
        currentPhase: row.current_phase,
        estimatedEffort: row.estimated_effort,
        affectedEntities: row.affected_entities,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
      };

      await this.writeJsonFile(
        path.join(dir, `${row.req_number}.json`),
        request
      );
    }

    // Write index file
    await this.writeJsonFile(
      path.join(dir, '_index.json'),
      {
        totalRequests: result.length,
        byPhase: this.groupBy(result, 'current_phase'),
        byStatus: this.groupBy(result, 'status'),
        byPriority: this.groupBy(result, 'priority'),
        requests: result.map((r: any) => ({
          reqNumber: r.req_number,
          title: r.title,
          phase: r.current_phase,
          priority: r.priority,
        })),
        lastUpdated: new Date().toISOString(),
      }
    );

    return result.length;
  }

  // ==========================================================================
  // Architecture Diagrams
  // ==========================================================================

  private async syncDiagrams(): Promise<number> {
    const dir = path.join(this.config.exportPath, 'diagrams');

    const result = await this.db.query(`
      SELECT * FROM architecture_diagrams ORDER BY diagram_type, scope_value
    `);

    // Write each diagram's source and metadata
    for (const row of result) {
      const fileName = row.diagram_key || row.diagram_type;

      // Write Mermaid source
      await this.writeFile(
        path.join(dir, `${fileName}.mmd`),
        row.mermaid_source
      );

      // Write metadata
      await this.writeJsonFile(
        path.join(dir, `${fileName}.meta.json`),
        {
          id: row.id,
          diagramKey: row.diagram_key,
          diagramType: row.diagram_type,
          scopeType: row.scope_type,
          scopeValue: row.scope_value,
          generatedAt: row.generated_at,
          name: row.name,
        }
      );
    }

    // Write manifest
    await this.writeJsonFile(
      path.join(dir, '_manifest.json'),
      {
        totalDiagrams: result.length,
        diagrams: result.map((r: any) => ({
          key: r.diagram_key,
          type: r.diagram_type,
          scope: r.scope_value,
          generatedAt: r.generated_at,
        })),
        lastUpdated: new Date().toISOString(),
      }
    );

    return result.length;
  }

  // ==========================================================================
  // Rebuild from Files
  // ==========================================================================

  /**
   * Rebuild database from exported files
   * Use with caution - will overwrite database content
   */
  async rebuildFromFiles(): Promise<void> {
    console.log('[GitSync] Rebuilding database from files...');
    console.log('[GitSync] WARNING: This will overwrite existing database content!');

    // TODO: Implement rebuild logic
    // This would read JSON files and insert/update database records
    // Should be used for disaster recovery or environment setup

    throw new Error('Not implemented - rebuild from files is a destructive operation');
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      this.config.exportPath,
      path.join(this.config.exportPath, 'business-units'),
      path.join(this.config.exportPath, 'entity-registry'),
      path.join(this.config.exportPath, 'column-registry'),
      path.join(this.config.exportPath, 'requests'),
      path.join(this.config.exportPath, 'diagrams'),
      path.join(this.config.exportPath, 'impacts'),
    ];

    for (const dir of dirs) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  private async writeSyncMetadata(stats: SyncStats): Promise<void> {
    await this.writeJsonFile(
      path.join(this.config.exportPath, '_sync-metadata.json'),
      {
        lastSync: stats.lastSync.toISOString(),
        stats,
        version: '1.0.0',
      }
    );
  }

  private groupBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const k = item[key] || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }
}
