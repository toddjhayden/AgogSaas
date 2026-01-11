/**
 * SDLC Control REST API Server
 * Provides REST endpoints for agent access to SDLC Control operations
 *
 * Endpoints:
 * - POST /api/agent/entity/register - Register a new entity
 * - POST /api/agent/dependency/add - Add entity dependency
 * - POST /api/agent/column/validate - Validate column usage
 * - POST /api/agent/migration/validate - Validate SQL migration
 * - GET  /api/agent/execution-order - Get execution order for entities
 * - GET  /api/agent/impact/:entity - Get impact analysis
 * - GET  /api/agent/health - Get SDLC Control health
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { SDLCControlDaemon } from '../sdlc-control/sdlc-control.daemon';
import { DiagramGeneratorService } from '../sdlc-control/diagram-generator.service';
import { getSDLCDatabase, SDLCDatabaseService } from '../sdlc-control/sdlc-database.service';

export interface SDLCApiConfig {
  port?: number;
  host?: string;
}

export class SDLCApiServer {
  private app: Express;
  private daemon: SDLCControlDaemon;
  private config: SDLCApiConfig;
  private diagramGenerator: DiagramGeneratorService;
  private db: SDLCDatabaseService;

  constructor(daemon: SDLCControlDaemon, config: SDLCApiConfig = {}) {
    this.daemon = daemon;
    this.config = {
      port: config.port || parseInt(process.env.SDLC_API_PORT || '3010'),
      host: config.host || process.env.SDLC_API_HOST || '127.0.0.1',
    };

    this.diagramGenerator = new DiagramGeneratorService();
    this.db = getSDLCDatabase();

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    this.app.use(cors({
      origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-Id', 'X-Request-Id'],
    }));

    // JSON body parsing
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const agentId = req.headers['x-agent-id'] || 'unknown';
      console.log(`[SDLC API] ${req.method} ${req.path} (agent: ${agentId})`);
      next();
    });
  }

  private setupRoutes(): void {
    const router = express.Router();

    // =========================================================================
    // Health & Status
    // =========================================================================

    router.get('/health', async (req: Request, res: Response) => {
      try {
        const health = await this.daemon.getHealthStatus();
        res.json({
          success: true,
          data: {
            database: health.database,
            nats: health.nats,
            lastCheck: health.lastCheck.toISOString(),
            entityCount: health.entityCount,
            phaseCount: health.phaseCount,
            columnCount: health.columnCount,
          },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Version endpoint - returns API and DB revision info
    router.get('/version', async (req: Request, res: Response) => {
      try {
        // Import version config
        const { API_VERSION, API_COMMIT, API_BUILD_DATE, DB_VERSION, API_REVISION } = await import('../config/version');

        res.json({
          success: true,
          data: {
            api: {
              version: API_VERSION,
              commit: API_COMMIT,
              buildDate: API_BUILD_DATE,
              revision: API_REVISION,
            },
            database: {
              version: DB_VERSION,
            },
          },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // AI Error Log
    // =========================================================================

    // Log an AI function error
    router.post('/ai/error-log', async (req: Request, res: Response) => {
      try {
        const { functionName, errorMessage, errorCode, context, sessionId, userQuery } = req.body;

        if (!functionName || !errorMessage) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: functionName, errorMessage',
          });
        }

        const result = await this.db.query(
          `SELECT log_ai_error($1, $2, $3, $4, $5, $6) as id`,
          [functionName, errorMessage, errorCode || null, context || {}, sessionId || null, userQuery || null]
        );

        res.json({
          success: true,
          data: { id: result[0]?.id, logged: true },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get pending AI errors (not dismissed)
    router.get('/ai/error-log', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const includeAll = req.query.all === 'true';

        const query = includeAll
          ? `SELECT * FROM ai_error_log ORDER BY created_at DESC LIMIT $1`
          : `SELECT * FROM ai_errors_pending LIMIT $1`;

        const errors = await this.db.query(query, [limit]);

        res.json({
          success: true,
          data: errors,
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Dismiss an AI error
    router.post('/ai/error-log/:id/dismiss', async (req: Request, res: Response) => {
      try {
        const errorId = parseInt(req.params.id);
        const { reason } = req.body;

        const result = await this.db.query(
          `SELECT dismiss_ai_error($1, $2) as success`,
          [errorId, reason || null]
        );

        res.json({
          success: true,
          data: { dismissed: result[0]?.success },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Promote AI error to REQ
    router.post('/ai/error-log/:id/promote', async (req: Request, res: Response) => {
      try {
        const errorId = parseInt(req.params.id);
        const { reqNumber } = req.body;

        if (!reqNumber) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: reqNumber',
          });
        }

        const result = await this.db.query(
          `SELECT promote_ai_error_to_req($1, $2) as success`,
          [errorId, reqNumber]
        );

        res.json({
          success: true,
          data: { promoted: result[0]?.success, reqNumber },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Agent Infrastructure Health
    // =========================================================================

    // Get all infrastructure component health statuses
    router.get('/infrastructure/health', async (req: Request, res: Response) => {
      try {
        const health = await this.db.query(`SELECT * FROM agent_infrastructure_status`);

        res.json({
          success: true,
          data: health,
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update a component's health status (called by orchestrator/agents)
    router.post('/infrastructure/health', async (req: Request, res: Response) => {
      try {
        const { component, status, details } = req.body;

        if (!component || !status) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: component, status',
          });
        }

        const validStatuses = ['healthy', 'degraded', 'unavailable', 'unknown'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }

        await this.db.query(
          `SELECT update_agent_health($1, $2, $3)`,
          [component, status, details || null]
        );

        res.json({
          success: true,
          data: { component, status, updated: true },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Batch update multiple components (for orchestrator heartbeat)
    router.post('/infrastructure/health/batch', async (req: Request, res: Response) => {
      try {
        const { components } = req.body;

        if (!components || !Array.isArray(components)) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: components (array)',
          });
        }

        const results = [];
        for (const comp of components) {
          if (comp.component && comp.status) {
            await this.db.query(
              `SELECT update_agent_health($1, $2, $3)`,
              [comp.component, comp.status, comp.details || null]
            );
            results.push({ component: comp.component, updated: true });
          }
        }

        res.json({
          success: true,
          data: { updated: results.length, components: results },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Infrastructure Control Commands
    // =========================================================================

    // Queue a control command (GUI calls this)
    router.post('/infrastructure/control', async (req: Request, res: Response) => {
      try {
        const { component, action, params, requestedBy } = req.body;

        if (!component || !action) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: component, action',
          });
        }

        // Validate component
        const validComponents = ['host_listener', 'orchestrator', 'nats', 'ollama', 'agent_db'];
        if (!validComponents.includes(component)) {
          return res.status(400).json({
            success: false,
            error: `Invalid component. Must be one of: ${validComponents.join(', ')}`,
          });
        }

        const result = await this.db.query(
          `INSERT INTO infrastructure_control_commands (component, action, params, requested_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, component, action, status, created_at`,
          [component, action, params || {}, requestedBy || 'gui']
        );

        res.json({
          success: true,
          data: result[0],
          message: 'Command queued. Poll /infrastructure/control/:id for result.',
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get pending commands (orchestrator polls this)
    router.get('/infrastructure/control/pending', async (req: Request, res: Response) => {
      try {
        const commands = await this.db.query(`SELECT * FROM pending_control_commands LIMIT 10`);
        res.json({ success: true, data: commands });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Claim a command (orchestrator marks it as executing)
    router.post('/infrastructure/control/:id/claim', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const result = await this.db.query(`SELECT claim_control_command($1)`, [id]);
        const claimed = result[0].claim_control_command;

        if (claimed) {
          res.json({ success: true, message: 'Command claimed' });
        } else {
          res.status(409).json({ success: false, error: 'Command already claimed or not found' });
        }
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Complete a command (orchestrator reports result)
    router.post('/infrastructure/control/:id/complete', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { result, error } = req.body;

        await this.db.query(
          `SELECT complete_control_command($1, $2, $3)`,
          [id, result || {}, error || null]
        );

        res.json({ success: true, message: 'Command completed' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get command status/result (GUI polls this)
    router.get('/infrastructure/control/:id', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const result = await this.db.query(
          `SELECT * FROM infrastructure_control_commands WHERE id = $1`,
          [id]
        );

        if (result.length === 0) {
          return res.status(404).json({ success: false, error: 'Command not found' });
        }

        res.json({ success: true, data: result[0] });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get recent commands for a component
    router.get('/infrastructure/control/history/:component', async (req: Request, res: Response) => {
      try {
        const { component } = req.params;
        const limit = parseInt(req.query.limit as string) || 20;

        const result = await this.db.query(
          `SELECT * FROM infrastructure_control_commands
           WHERE component = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [component, limit]
        );

        res.json({ success: true, data: result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Entity Registry
    // =========================================================================

    router.post('/entity/register', async (req: Request, res: Response) => {
      try {
        const { entityName, owningBu, entityType, isFoundation, description } = req.body;

        if (!entityName || !owningBu || !entityType) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: entityName, owningBu, entityType',
          });
        }

        const entity = await this.daemon.registerEntity({
          entityName,
          owningBu,
          entityType,
          isFoundation: isFoundation || false,
          description,
        });

        res.json({ success: true, data: entity });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Dependencies
    // =========================================================================

    router.post('/dependency/add', async (req: Request, res: Response) => {
      try {
        const { dependentEntity, dependsOnEntity, dependencyType, reason } = req.body;

        if (!dependentEntity || !dependsOnEntity || !dependencyType) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: dependentEntity, dependsOnEntity, dependencyType',
          });
        }

        const dependency = await this.daemon.addDependency({
          dependentEntity,
          dependsOnEntity,
          dependencyType,
          reason,
        });

        res.json({ success: true, data: dependency });
      } catch (error: any) {
        // Check for cycle error
        if (error.message.includes('cycle')) {
          return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Execution Order
    // =========================================================================

    router.get('/execution-order', async (req: Request, res: Response) => {
      try {
        const entities = req.query.entities as string;

        if (!entities) {
          return res.status(400).json({
            success: false,
            error: 'Missing query parameter: entities (comma-separated list)',
          });
        }

        const entityList = entities.split(',').map(e => e.trim());
        const plan = await this.daemon.computeExecutionOrder(entityList);

        res.json({ success: true, data: plan });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    router.post('/execution-order', async (req: Request, res: Response) => {
      try {
        const { entities } = req.body;

        if (!entities || !Array.isArray(entities)) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: entities (array)',
          });
        }

        const plan = await this.daemon.computeExecutionOrder(entities);

        res.json({ success: true, data: plan });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Impact Analysis
    // =========================================================================

    router.get('/impact/:entityName', async (req: Request, res: Response) => {
      try {
        const { entityName } = req.params;
        const impact = await this.daemon.analyzeImpact(entityName);

        // Transform to GUI-expected format
        const dependents = [...impact.direct, ...impact.transitive].map(
          (e: any) => e.entityName
        );
        const crossBuImpacts = impact.crossBu.map((e: any) => e.entityName);

        res.json({
          success: true,
          data: {
            entity: entityName,
            dependents,
            crossBuImpacts,
          },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Cycle Detection
    // =========================================================================

    router.get('/cycles', async (req: Request, res: Response) => {
      try {
        const result = await this.daemon.detectCycles();
        res.json({ success: true, data: result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Column Validation
    // =========================================================================

    router.post('/column/validate', async (req: Request, res: Response) => {
      try {
        const { column, requestingBu } = req.body;

        if (!column || !requestingBu) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: column, requestingBu',
          });
        }

        if (!column.name || !column.table || !column.semanticType || !column.dataType) {
          return res.status(400).json({
            success: false,
            error: 'Column must have: name, table, semanticType, dataType',
          });
        }

        const result = await this.daemon.validateColumn(column, requestingBu);

        // Return appropriate status based on validation result
        if (!result.isValid) {
          return res.status(400).json({ success: false, data: result });
        }

        res.json({ success: true, data: result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Migration Validation
    // =========================================================================

    router.post('/migration/validate', async (req: Request, res: Response) => {
      try {
        const { sql, requestingBu } = req.body;

        if (!sql || !requestingBu) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: sql, requestingBu',
          });
        }

        const result = await this.daemon.validateMigration(sql, requestingBu);

        // Return appropriate status based on validation result
        if (!result.isValid) {
          return res.status(400).json({ success: false, data: result });
        }

        res.json({ success: true, data: result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Kanban Board
    // =========================================================================

    router.get('/kanban', async (req: Request, res: Response) => {
      try {
        const board = await this.daemon.getKanbanBoard();

        // Convert Map to array and transform to GUI-expected format
        const columns = Array.from(board.entries()).map(([phaseCode, data]) => ({
          phaseCode,
          phaseName: data.phase.name,
          wipLimit: data.phase.wipLimit,
          count: data.stats.currentCount,
          requests: data.requests.map((r: any) => ({
            id: r.id,
            reqNumber: r.req_number,
            title: r.title,
            description: r.description,
            priority: r.priority,
            status: r.status || 'active',
            primaryBu: r.primary_bu,
            currentPhase: r.current_phase,
            estimatedEffort: r.estimated_effort,
            affectedEntities: r.affected_entities || [],
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            createdBy: r.created_by,
            assignedTo: r.assigned_to,
            tags: r.tags || [],
          })),
        }));

        res.json({ success: true, data: { columns } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Phase Transitions
    // =========================================================================

    router.post('/transition/validate', async (req: Request, res: Response) => {
      try {
        const { fromPhase, toPhase, requestId } = req.body;

        if (!fromPhase || !toPhase) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: fromPhase, toPhase',
          });
        }

        const result = await this.daemon.validateTransition(fromPhase, toPhase, requestId);

        res.json({ success: true, data: result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    router.get('/phase-stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.daemon.getPhaseStats();
        // Transform to GUI-expected format: { phases: [...] }
        const phases = stats.map((s: any) => ({
          code: s.phaseCode,
          name: s.phaseName,
          count: s.currentCount,
          wipLimit: s.wipLimit,
        }));
        res.json({ success: true, data: { phases } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Column Statistics
    // =========================================================================

    router.get('/column-stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.daemon.getColumnStats();
        // Transform to GUI-expected format: { total, byType, byBu }
        res.json({ success: true, data: {
          total: stats.totalColumns,
          byType: stats.byType,
          byBu: stats.byBu,
        }});
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Cross-BU Matrix
    // =========================================================================

    router.get('/cross-bu-matrix', async (req: Request, res: Response) => {
      try {
        const matrix = await this.daemon.getCrossBuMatrix();

        // Convert nested Map to object for JSON serialization
        const matrixObj: Record<string, Record<string, number>> = {};
        for (const [fromBu, toMap] of matrix.entries()) {
          matrixObj[fromBu] = {};
          for (const [toBu, count] of toMap.entries()) {
            matrixObj[fromBu][toBu] = count;
          }
        }

        res.json({ success: true, data: matrixObj });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get detailed cross-BU dependencies with entity names
    router.get('/cross-bu-details', async (req: Request, res: Response) => {
      try {
        const { fromBu, toBu } = req.query;

        // Get all cross-BU dependencies with entity details
        const result = await this.db.query(`
          SELECT
            e1.entity_name as from_entity,
            e1.owning_bu as from_bu,
            e2.entity_name as to_entity,
            e2.owning_bu as to_bu,
            ed.dependency_type,
            ed.reason
          FROM entity_dependencies ed
          JOIN entity_registry e1 ON ed.dependent_entity = e1.entity_name
          JOIN entity_registry e2 ON ed.depends_on_entity = e2.entity_name
          WHERE e1.owning_bu != e2.owning_bu
          ${fromBu ? 'AND e1.owning_bu = $1' : ''}
          ${toBu ? (fromBu ? 'AND e2.owning_bu = $2' : 'AND e2.owning_bu = $1') : ''}
          ORDER BY e1.owning_bu, e2.owning_bu, e1.entity_name
        `, fromBu && toBu ? [fromBu, toBu] : fromBu ? [fromBu] : toBu ? [toBu] : []);

        // Group by BU pair for easier consumption
        const grouped: Record<string, any[]> = {};
        for (const row of result) {
          const key = `${row.from_bu}|${row.to_bu}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({
            fromEntity: row.from_entity,
            fromBu: row.from_bu,
            toEntity: row.to_entity,
            toBu: row.to_bu,
            dependencyType: row.dependency_type,
            reason: row.reason,
          });
        }

        res.json({
          success: true,
          data: {
            details: result.map((r: any) => ({
              fromEntity: r.from_entity,
              fromBu: r.from_bu,
              toEntity: r.to_entity,
              toBu: r.to_bu,
              dependencyType: r.dependency_type,
              reason: r.reason,
            })),
            grouped,
            total: result.length,
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Dependency Graph
    // =========================================================================

    router.get('/dependency-graph', async (req: Request, res: Response) => {
      try {
        // Get both entities and dependencies in format expected by GUI
        const entities = await this.db.query(`
          SELECT id, entity_name, owning_bu, entity_type, is_foundation, description, created_at
          FROM entity_registry
          ORDER BY owning_bu, entity_name
        `);

        const dependencies = await this.db.query(`
          SELECT id, dependent_entity, depends_on_entity, dependency_type, reason, created_at
          FROM entity_dependencies
        `);

        // Map to GUI-expected format
        const nodes = entities.map((e: any) => ({
          id: e.id,
          entityName: e.entity_name,
          owningBu: e.owning_bu,
          entityType: e.entity_type,
          isFoundation: e.is_foundation,
          description: e.description,
          createdAt: e.created_at,
        }));

        const edges = dependencies.map((d: any) => ({
          id: d.id,
          dependentEntity: d.dependent_entity,
          dependsOnEntity: d.depends_on_entity,
          dependencyType: d.dependency_type,
          reason: d.reason,
          createdAt: d.created_at,
        }));

        res.json({ success: true, data: { nodes, edges } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Diagram Generation
    // =========================================================================

    router.post('/diagrams/generate', async (req: Request, res: Response) => {
      try {
        const { type, scope } = req.body;

        if (!type) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: type (c4-context, entity-dag, erd, cross-bu-impact, phase-workflow)',
          });
        }

        if (type === 'erd' && !scope) {
          return res.status(400).json({
            success: false,
            error: 'ERD diagrams require a scope (BU code)',
          });
        }

        const diagram = await this.diagramGenerator.generate(type, scope);
        res.json({ success: true, data: diagram });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    router.post('/diagrams/generate-all', async (req: Request, res: Response) => {
      try {
        const diagrams = await this.diagramGenerator.generateAll();
        res.json({
          success: true,
          data: {
            count: diagrams.length,
            diagrams: diagrams.map(d => ({
              type: d.type,
              scope: d.scope,
              version: d.version,
              generatedAt: d.generatedAt,
            })),
          },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Recommendations
    // =========================================================================

    router.get('/recommendations', async (req: Request, res: Response) => {
      try {
        const status = req.query.status as string | undefined;
        const urgency = req.query.urgency as string | undefined;

        let whereClause = '';
        const params: string[] = [];

        if (status) {
          params.push(status);
          whereClause = `WHERE status = $${params.length}`;
        }
        if (urgency) {
          params.push(urgency);
          whereClause += (whereClause ? ' AND' : 'WHERE') + ` urgency = $${params.length}`;
        }

        const result = await this.db.query(`
          SELECT
            id, rec_number, title, description, rationale, expected_benefits,
            recommended_by_agent, recommendation_type, urgency, impact_level,
            affected_bus, status, source_req_number, reviewed_by, reviewed_at,
            created_at, updated_at
          FROM recommendations
          ${whereClause}
          ORDER BY
            CASE urgency
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            created_at DESC
        `, params);

        // Transform to GUI-expected format
        const recommendations = result.map((r: any) => ({
          id: r.id,
          recNumber: r.rec_number,
          title: r.title,
          description: r.description,
          rationale: r.rationale,
          expectedBenefits: r.expected_benefits,
          recommendedBy: r.recommended_by_agent,
          type: r.recommendation_type,
          urgency: r.urgency,
          impactLevel: r.impact_level,
          affectedBus: r.affected_bus || [],
          status: r.status,
          sourceReq: r.source_req_number,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));

        res.json({ success: true, data: { recommendations, total: recommendations.length } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Create a new recommendation
    router.post('/recommendations', async (req: Request, res: Response) => {
      try {
        const {
          recNumber, title, description, rationale, expectedBenefits,
          recommendedBy, type, urgency, impactLevel, affectedBus, sourceReq
        } = req.body;

        if (!recNumber || !title) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: recNumber, title'
          });
        }

        const result = await this.db.query(`
          INSERT INTO recommendations (
            rec_number, title, description, rationale, expected_benefits,
            recommended_by_agent, recommendation_type, urgency, impact_level,
            affected_bus, source_req_number, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
          RETURNING id, rec_number, title, status, created_at
        `, [
          recNumber,
          title,
          description || 'No description provided',
          rationale || 'Generated via API',
          expectedBenefits || 'See description',
          recommendedBy || req.headers['x-agent-id'] || 'unknown',
          type || 'enhancement',
          urgency || 'medium',
          impactLevel || 'medium',
          affectedBus || [],
          sourceReq || null
        ]);

        const r = result[0];
        console.log(`[SDLC API] Created recommendation: ${r.rec_number}`);

        res.status(201).json({
          success: true,
          data: {
            id: r.id,
            recNumber: r.rec_number,
            title: r.title,
            status: r.status,
            createdAt: r.created_at
          }
        });
      } catch (error: any) {
        if (error.code === '23505') {
          return res.status(409).json({
            success: false,
            error: `Recommendation already exists: ${req.body.recNumber}`
          });
        }
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update recommendation status (approve, reject, move between phases)
    router.put('/recommendations/:id/status', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { status, reviewedBy, notes } = req.body;

        if (!status) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: status',
          });
        }

        const validStatuses = ['pending', 'approved', 'rejected', 'deferred', 'in_progress', 'done'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }

        // Build update query
        const updates: string[] = ['status = $1', 'updated_at = NOW()'];
        const params: any[] = [status];
        let paramIndex = 2;

        if (reviewedBy) {
          updates.push(`reviewed_by = $${paramIndex++}`);
          params.push(reviewedBy);
        }

        if (notes) {
          // Store notes in rationale or a notes field
          updates.push(`rationale = COALESCE(rationale || E'\\n\\n--- Review Notes ---\\n' || $${paramIndex++}, $${paramIndex - 1})`);
          params.push(notes);
        }

        // If approving or rejecting, set reviewed_at
        if (status === 'approved' || status === 'rejected') {
          updates.push('reviewed_at = NOW()');
        }

        params.push(id);

        const result = await this.db.query(`
          UPDATE recommendations
          SET ${updates.join(', ')}
          WHERE id = $${params.length}
          RETURNING
            id, rec_number, title, description, rationale, expected_benefits,
            recommended_by_agent, recommendation_type, urgency, impact_level,
            affected_bus, status, source_req_number, reviewed_by, reviewed_at,
            created_at, updated_at
        `, params);

        if (result.length === 0) {
          return res.status(404).json({
            success: false,
            error: `Recommendation not found: ${id}`,
          });
        }

        const r = result[0];
        const recommendation = {
          id: r.id,
          recNumber: r.rec_number,
          title: r.title,
          description: r.description,
          rationale: r.rationale,
          expectedBenefits: r.expected_benefits,
          recommendedBy: r.recommended_by_agent,
          type: r.recommendation_type,
          urgency: r.urgency,
          impactLevel: r.impact_level,
          affectedBus: r.affected_bus || [],
          status: r.status,
          sourceReq: r.source_req_number,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };

        console.log(`[SDLC API] Recommendation ${r.rec_number} status updated to: ${status}`);
        res.json({ success: true, data: recommendation });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // All Requests (combined view)
    // =========================================================================

    router.get('/requests', async (req: Request, res: Response) => {
      try {
        // Get owner requests
        const ownerRequests = await this.db.query(`
          SELECT
            id, req_number, title, description, request_type, priority,
            primary_bu, current_phase, assigned_to, is_blocked, tags,
            source, created_at, updated_at
          FROM owner_requests
          ORDER BY created_at DESC
        `);

        // Get recommendations (exclude converted ones - they become owner_requests)
        const recommendations = await this.db.query(`
          SELECT
            id, rec_number, title, description, recommendation_type, urgency,
            affected_bus, status, source_req_number, recommended_by_agent,
            created_at, updated_at
          FROM recommendations
          WHERE status != 'converted'
          ORDER BY created_at DESC
        `);

        // Transform owner requests
        const requests = ownerRequests.map((r: any) => ({
          id: r.id,
          reqNumber: r.req_number,
          title: r.title,
          description: r.description,
          type: r.request_type,
          priority: r.priority,
          primaryBu: r.primary_bu,
          currentPhase: r.current_phase,
          assignedTo: r.assigned_to,
          isBlocked: r.is_blocked,
          tags: r.tags || [],
          source: r.source || 'manual',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          category: 'request',
        }));

        // Transform recommendations
        const recs = recommendations.map((r: any) => ({
          id: r.id,
          reqNumber: r.rec_number,
          title: r.title,
          description: r.description,
          type: r.recommendation_type,
          priority: r.urgency,
          primaryBu: r.affected_bus?.[0] || 'core-infra',
          currentPhase: r.status === 'pending' ? 'recommendation' : r.status,
          assignedTo: null,
          isBlocked: false,
          tags: [],
          source: r.recommended_by_agent,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          category: 'recommendation',
        }));

        // Combine and sort by created_at
        const allRequests = [...requests, ...recs].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        res.json({
          success: true,
          data: {
            requests: allRequests,
            summary: {
              totalRequests: requests.length,
              totalRecommendations: recs.length,
              total: allRequests.length,
            },
          },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Request Stats Summary
    // =========================================================================

    router.get('/request-stats', async (req: Request, res: Response) => {
      try {
        // Get owner request stats
        const reqStats = await this.db.query(`
          SELECT
            current_phase,
            COUNT(*) as count
          FROM owner_requests
          GROUP BY current_phase
        `);

        // Get recommendation stats
        const recStats = await this.db.query(`
          SELECT
            status,
            COUNT(*) as count
          FROM recommendations
          GROUP BY status
        `);

        // Priority distribution
        const priorityStats = await this.db.query(`
          SELECT priority, COUNT(*) as count
          FROM owner_requests
          GROUP BY priority
          UNION ALL
          SELECT urgency, COUNT(*) as count
          FROM recommendations
          GROUP BY urgency
        `);

        res.json({
          success: true,
          data: {
            byPhase: reqStats.reduce((acc: any, r: any) => {
              acc[r.current_phase] = parseInt(r.count);
              return acc;
            }, {}),
            byStatus: recStats.reduce((acc: any, r: any) => {
              acc[r.status] = parseInt(r.count);
              return acc;
            }, {}),
            byPriority: priorityStats.reduce((acc: any, r: any) => {
              acc[r.priority] = (acc[r.priority] || 0) + parseInt(r.count);
              return acc;
            }, {}),
          },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    router.get('/diagrams/:type', async (req: Request, res: Response) => {
      try {
        const { type } = req.params;
        const scope = req.query.scope as string | undefined;

        // Query the database for the diagram
        const diagramKey = scope ? `${type}-${scope}` : type;
        const result = await this.db.query(`
          SELECT diagram_key, name, diagram_type, scope_type, scope_value, mermaid_source, generated_at
          FROM architecture_diagrams
          WHERE diagram_key = $1 OR (diagram_type = $1 AND scope_value IS NULL)
          ORDER BY generated_at DESC
          LIMIT 1
        `, [diagramKey]);

        if (result.length === 0) {
          return res.status(404).json({
            success: false,
            error: `Diagram not found: ${type}${scope ? ` (scope: ${scope})` : ''}`,
          });
        }

        const row = result[0];
        res.json({
          success: true,
          data: {
            type: row.diagram_type,
            scope: row.scope_value,
            mermaidSource: row.mermaid_source,
            generatedAt: row.generated_at,
            name: row.name,
          },
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Owner Requests CRUD (for orchestrator polling)
    // =========================================================================

    // Create a new owner request
    router.post('/requests', async (req: Request, res: Response) => {
      try {
        const { reqNumber, title, description, requestType, priority, primaryBu, assignedTo, tags, source, sourceReference, affectedBus, affectedEntities } = req.body;
        if (!reqNumber || !title) {
          return res.status(400).json({ success: false, error: 'Missing required fields: reqNumber, title' });
        }
        const result = await this.db.query(`
          INSERT INTO owner_requests (req_number, title, description, request_type, priority, primary_bu, current_phase, assigned_to, tags, source, source_reference, affected_bus, affected_entities, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, 'backlog', $7, $8, $9, $10, $11, $12, $13) RETURNING *
        `, [reqNumber, title, description || null, requestType || 'feature', priority || 'medium', primaryBu || 'core-infra', assignedTo || null, tags || [], source || 'orchestrator', sourceReference || null, affectedBus || [], affectedEntities || [], req.headers['x-agent-id'] || 'orchestrator']);
        const r = result[0];
        console.log(`[SDLC API] Created owner_request: ${r.req_number}`);
        res.status(201).json({ success: true, data: { id: r.id, reqNumber: r.req_number, title: r.title, currentPhase: r.current_phase, priority: r.priority, createdAt: r.created_at } });
      } catch (error: any) {
        if (error.code === '23505') return res.status(409).json({ success: false, error: `Request already exists: ${req.body.reqNumber}` });
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update owner request status/phase
    router.put('/requests/:reqNumber/status', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { phase, isBlocked, blockedReason, assignedTo } = req.body;
        if (!phase && isBlocked === undefined) {
          return res.status(400).json({ success: false, error: 'Must provide at least one of: phase, isBlocked' });
        }

        // Build update clauses and parameters dynamically
        // Using explicit array to ensure parameter order matches SQL placeholders
        const updates: string[] = ['updated_at = NOW()'];
        const params: any[] = [];

        if (phase !== undefined) {
          params.push(phase);
          updates.push(`current_phase = $${params.length}`);
        }
        if (isBlocked !== undefined) {
          params.push(isBlocked);
          updates.push(`is_blocked = $${params.length}`);
        }
        if (blockedReason !== undefined) {
          params.push(blockedReason);
          updates.push(`blocked_reason = $${params.length}`);
        }
        if (assignedTo !== undefined) {
          params.push(assignedTo);
          updates.push(`assigned_to = $${params.length}`);
        }

        // Add reqNumber as the final parameter for WHERE clause
        params.push(reqNumber);
        const whereParamIndex = params.length;

        const result = await this.db.query(
          `UPDATE owner_requests SET ${updates.join(', ')} WHERE req_number = $${whereParamIndex} RETURNING *`,
          params
        );

        if (result.length === 0) return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        const r = result[0];
        console.log(`[SDLC API] Updated ${reqNumber} -> phase: ${r.current_phase}, blocked: ${r.is_blocked}`);
        res.json({ success: true, data: { id: r.id, reqNumber: r.req_number, currentPhase: r.current_phase, isBlocked: r.is_blocked, blockedReason: r.blocked_reason, assignedTo: r.assigned_to, updatedAt: r.updated_at } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get requests pending approval (MUST be before :reqNumber route)
    router.get('/requests/pending-approval', async (req: Request, res: Response) => {
      try {
        const result = await this.db.query(`
          SELECT
            id, req_number, title, description, priority, primary_bu,
            recommended_by_agent, rationale, expected_benefits, impact_level,
            approval_status, created_at,
            EXTRACT(DAY FROM (NOW() - created_at)) AS days_pending
          FROM owner_requests
          WHERE requires_approval = TRUE
            AND approval_status IN ('pending', 'under_review')
          ORDER BY
            CASE priority
              WHEN 'catastrophic' THEN 0
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            created_at
        `);

        const requests = result.map((r: any) => ({
          id: r.id,
          reqNumber: r.req_number,
          title: r.title,
          description: r.description,
          priority: r.priority,
          primaryBu: r.primary_bu,
          recommendedByAgent: r.recommended_by_agent,
          rationale: r.rationale,
          expectedBenefits: r.expected_benefits,
          impactLevel: r.impact_level,
          approvalStatus: r.approval_status,
          createdAt: r.created_at,
          daysPending: r.days_pending,
        }));

        res.json({ success: true, data: { requests, total: requests.length } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Search requests (MUST be before :reqNumber route)
    router.get('/requests/search', async (req: Request, res: Response) => {
      try {
        const query = req.query.q as string;
        const limit = parseInt(req.query.limit as string) || 20;

        if (!query) {
          return res.status(400).json({ success: false, error: 'Search query required' });
        }

        const results = await this.db.query(`
          SELECT
            req_number,
            title,
            priority,
            current_phase,
            is_blocked,
            tags,
            created_at
          FROM owner_requests
          WHERE
            LOWER(title) LIKE LOWER($1)
            OR LOWER(description) LIKE LOWER($1)
            OR req_number LIKE UPPER($1)
            OR $2 = ANY(tags)
          ORDER BY
            CASE WHEN LOWER(title) LIKE LOWER($1) THEN 0 ELSE 1 END,
            CASE priority
              WHEN 'catastrophic' THEN 1
              WHEN 'critical' THEN 2
              WHEN 'high' THEN 3
              WHEN 'medium' THEN 4
              WHEN 'low' THEN 5
            END
          LIMIT $3
        `, [`%${query}%`, query.toLowerCase(), limit]);

        res.json({
          success: true,
          data: {
            query,
            results: results.map((r: any) => ({
              reqNumber: r.req_number,
              title: r.title,
              priority: r.priority,
              phase: r.current_phase,
              isBlocked: r.is_blocked,
              tags: r.tags,
              createdAt: r.created_at
            })),
            count: results.length
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get single owner request by reqNumber
    router.get('/requests/:reqNumber', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const result = await this.db.query(`SELECT * FROM owner_requests WHERE req_number = $1`, [reqNumber]);
        if (result.length === 0) return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        const r = result[0];
        res.json({ success: true, data: { id: r.id, reqNumber: r.req_number, title: r.title, description: r.description, priority: r.priority, primaryBu: r.primary_bu, currentPhase: r.current_phase, assignedTo: r.assigned_to, isBlocked: r.is_blocked, blockedReason: r.blocked_reason, tags: r.tags || [], source: r.source, createdAt: r.created_at, updatedAt: r.updated_at } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Request Approval Workflow (Unified Model)
    // =========================================================================

    // Update approval fields for a request
    router.put('/requests/:reqNumber/approval', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { requiresApproval, approvalStatus, recommendedByAgent, rationale, expectedBenefits, impactLevel } = req.body;

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (requiresApproval !== undefined) {
          updates.push(`requires_approval = $${paramIndex++}`);
          params.push(requiresApproval);
        }
        if (approvalStatus) {
          updates.push(`approval_status = $${paramIndex++}`);
          params.push(approvalStatus);
          // Also update current_phase based on approval status
          if (approvalStatus === 'pending' || approvalStatus === 'under_review') {
            updates.push(`current_phase = 'pending_approval'`);
          }
        }
        if (recommendedByAgent) {
          updates.push(`recommended_by_agent = $${paramIndex++}`);
          params.push(recommendedByAgent);
        }
        if (rationale) {
          updates.push(`rationale = $${paramIndex++}`);
          params.push(rationale);
        }
        if (expectedBenefits) {
          updates.push(`expected_benefits = $${paramIndex++}`);
          params.push(expectedBenefits);
        }
        if (impactLevel) {
          updates.push(`impact_level = $${paramIndex++}`);
          params.push(impactLevel);
        }

        if (updates.length === 0) {
          return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        params.push(reqNumber);
        const result = await this.db.query(
          `UPDATE owner_requests SET ${updates.join(', ')}, updated_at = NOW() WHERE req_number = $${paramIndex} RETURNING *`,
          params
        );

        if (result.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        }

        console.log(`[SDLC API] Updated approval fields for ${reqNumber}`);
        res.json({ success: true, data: { reqNumber, updated: true } });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Approve a request (moves to backlog)
    router.post('/requests/:reqNumber/approve', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { approvedBy, notes } = req.body;

        if (!approvedBy) {
          return res.status(400).json({ success: false, error: 'Missing required field: approvedBy' });
        }

        // Use the database function to approve
        const result = await this.db.query(
          `SELECT approve_request($1, $2, $3) as approved`,
          [reqNumber, approvedBy, notes || null]
        );

        console.log(`[SDLC API] Approved request ${reqNumber} by ${approvedBy}`);
        res.json({ success: true, data: { reqNumber, approved: true, approvedBy } });
      } catch (error: any) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Reject a request
    router.post('/requests/:reqNumber/reject', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { rejectedBy, reason } = req.body;

        if (!rejectedBy || !reason) {
          return res.status(400).json({ success: false, error: 'Missing required fields: rejectedBy, reason' });
        }

        // Use the database function to reject
        const result = await this.db.query(
          `SELECT reject_request($1, $2, $3) as rejected`,
          [reqNumber, rejectedBy, reason]
        );

        console.log(`[SDLC API] Rejected request ${reqNumber} by ${rejectedBy}`);
        res.json({ success: true, data: { reqNumber, rejected: true, rejectedBy, reason } });
      } catch (error: any) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Defer a request
    router.post('/requests/:reqNumber/defer', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { deferredBy, until, reason } = req.body;

        if (!deferredBy || !until || !reason) {
          return res.status(400).json({ success: false, error: 'Missing required fields: deferredBy, until, reason' });
        }

        // Use the database function to defer
        const result = await this.db.query(
          `SELECT defer_request($1, $2, $3::TIMESTAMPTZ, $4) as deferred`,
          [reqNumber, deferredBy, until, reason]
        );

        console.log(`[SDLC API] Deferred request ${reqNumber} by ${deferredBy} until ${until}`);
        res.json({ success: true, data: { reqNumber, deferred: true, deferredBy, until, reason } });
      } catch (error: any) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Request Blockers (Many-to-Many Blocking Relationships)
    // =========================================================================

    // Add a blocking relationship between requests
    router.post('/blockers', async (req: Request, res: Response) => {
      try {
        const { blockedReqNumber, blockingReqNumber, reason } = req.body;
        const createdBy = req.headers['x-agent-id'] as string || 'agent';

        if (!blockedReqNumber || !blockingReqNumber) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: blockedReqNumber, blockingReqNumber'
          });
        }

        // Use the database function to add the blocker
        const result = await this.db.query(
          `SELECT add_request_blocker($1, $2, $3, $4) as blocker_id`,
          [blockedReqNumber, blockingReqNumber, reason || null, createdBy]
        );

        console.log(`[SDLC API] Added blocker: ${blockedReqNumber} blocked by ${blockingReqNumber}`);

        res.status(201).json({
          success: true,
          data: {
            blockerId: result[0]?.blocker_id,
            blockedReqNumber,
            blockingReqNumber,
            reason,
            createdBy
          }
        });
      } catch (error: any) {
        // Handle specific errors from the function
        if (error.message.includes('not found')) {
          return res.status(404).json({ success: false, error: error.message });
        }
        if (error.code === '23505') {
          return res.status(409).json({
            success: false,
            error: `Blocker relationship already exists: ${req.body.blockedReqNumber} blocked by ${req.body.blockingReqNumber}`
          });
        }
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get blockers for a specific request
    router.get('/blockers/:reqNumber', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const direction = req.query.direction as string || 'both'; // 'blocked_by', 'blocking', or 'both'

        const result = await this.db.query(`
          SELECT * FROM v_request_blockers WHERE req_number = $1
        `, [reqNumber]);

        if (result.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        }

        const r = result[0];
        res.json({
          success: true,
          data: {
            reqNumber: r.req_number,
            title: r.title,
            currentPhase: r.current_phase,
            isBlocked: r.is_blocked,
            blockerCount: r.blocker_count,
            blockedBy: r.blocked_by || [],
            blocking: r.blocking || []
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Resolve blockers when a request completes
    router.post('/blockers/resolve/:reqNumber', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;

        const result = await this.db.query(
          `SELECT resolve_request_blocker($1) as resolved_count`,
          [reqNumber]
        );

        const resolvedCount = result[0]?.resolved_count || 0;
        console.log(`[SDLC API] Resolved ${resolvedCount} blockers for ${reqNumber}`);

        res.json({
          success: true,
          data: {
            reqNumber,
            resolvedCount
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get deepest unblocked requests (for orchestrator prioritization)
    router.get('/deepest-unblocked', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await this.db.query(
          `SELECT * FROM get_deepest_unblocked_requests($1)`,
          [limit]
        );

        const requests = result.map((r: any) => ({
          reqNumber: r.req_number,
          title: r.title,
          priority: r.priority,
          currentPhase: r.current_phase,
          depth: r.depth,
          blocksCount: r.blocks_count
        }));

        res.json({
          success: true,
          data: {
            requests,
            count: requests.length
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Remove a specific blocking relationship
    router.delete('/blockers/:blockedReqNumber/:blockingReqNumber', async (req: Request, res: Response) => {
      try {
        const { blockedReqNumber, blockingReqNumber } = req.params;

        // Get request IDs
        const blocked = await this.db.query(
          `SELECT id FROM owner_requests WHERE req_number = $1`,
          [blockedReqNumber]
        );
        const blocking = await this.db.query(
          `SELECT id FROM owner_requests WHERE req_number = $1`,
          [blockingReqNumber]
        );

        if (blocked.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${blockedReqNumber}` });
        }
        if (blocking.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${blockingReqNumber}` });
        }

        // Delete the blocker relationship
        const result = await this.db.query(`
          DELETE FROM request_blockers
          WHERE blocked_request_id = $1 AND blocking_request_id = $2
          RETURNING id
        `, [blocked[0].id, blocking[0].id]);

        if (result.length === 0) {
          return res.status(404).json({
            success: false,
            error: `Blocker relationship not found: ${blockedReqNumber} blocked by ${blockingReqNumber}`
          });
        }

        // Check if blocked request has any remaining blockers
        const remainingBlockers = await this.db.query(`
          SELECT COUNT(*) as count FROM request_blockers
          WHERE blocked_request_id = $1 AND resolved_at IS NULL
        `, [blocked[0].id]);

        // If no more blockers, unblock the request
        if (parseInt(remainingBlockers[0].count) === 0) {
          await this.db.query(`
            UPDATE owner_requests
            SET is_blocked = FALSE, blocked_reason = NULL
            WHERE id = $1
          `, [blocked[0].id]);
        }

        console.log(`[SDLC API] Removed blocker: ${blockedReqNumber} no longer blocked by ${blockingReqNumber}`);

        res.json({
          success: true,
          data: {
            blockedReqNumber,
            blockingReqNumber,
            removed: true
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ========================================================================
    // AI FUNCTION CALLING ENDPOINTS
    // ========================================================================

    // Get items blocked BY a specific request (what's waiting on this)
    router.get('/requests/:reqNumber/blocked-by', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;

        // Get the blocking request ID
        const blocking = await this.db.query(
          `SELECT id FROM owner_requests WHERE req_number = $1`,
          [reqNumber]
        );

        if (blocking.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        }

        // Find all requests blocked by this one
        const blockedItems = await this.db.query(`
          SELECT
            r.req_number,
            r.title,
            r.priority,
            r.current_phase,
            rb.reason as blocker_reason,
            rb.created_at as blocked_since
          FROM request_blockers rb
          JOIN owner_requests r ON r.id = rb.blocked_request_id
          WHERE rb.blocking_request_id = $1 AND rb.resolved_at IS NULL
          ORDER BY
            CASE r.priority
              WHEN 'catastrophic' THEN 1
              WHEN 'critical' THEN 2
              WHEN 'high' THEN 3
              WHEN 'medium' THEN 4
              WHEN 'low' THEN 5
            END
        `, [blocking[0].id]);

        res.json({
          success: true,
          data: {
            blockingRequest: reqNumber,
            blockedItems: blockedItems.map((r: any) => ({
              reqNumber: r.req_number,
              title: r.title,
              priority: r.priority,
              phase: r.current_phase,
              blockerReason: r.blocker_reason,
              blockedSince: r.blocked_since
            })),
            count: blockedItems.length
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get blocker chain (recursive)
    router.get('/requests/:reqNumber/blocker-chain', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;

        // Recursive CTE to get full blocker chain
        const chain = await this.db.query(`
          WITH RECURSIVE blocker_chain AS (
            -- Base case: direct blockers
            SELECT
              r.id,
              r.req_number,
              r.title,
              r.priority,
              r.current_phase,
              r.is_blocked,
              1 as depth,
              ARRAY[r.req_number] as path
            FROM owner_requests r
            WHERE r.req_number = $1

            UNION ALL

            -- Recursive case: blockers of blockers
            SELECT
              r.id,
              r.req_number,
              r.title,
              r.priority,
              r.current_phase,
              r.is_blocked,
              bc.depth + 1,
              bc.path || r.req_number
            FROM blocker_chain bc
            JOIN request_blockers rb ON rb.blocked_request_id = bc.id
            JOIN owner_requests r ON r.id = rb.blocking_request_id
            WHERE NOT r.req_number = ANY(bc.path)  -- Prevent cycles
              AND rb.resolved_at IS NULL
              AND bc.depth < 10  -- Max depth
          )
          SELECT DISTINCT ON (req_number) * FROM blocker_chain ORDER BY req_number, depth
        `, [reqNumber]);

        res.json({
          success: true,
          data: {
            targetRequest: reqNumber,
            chain: chain.map((r: any) => ({
              reqNumber: r.req_number,
              title: r.title,
              priority: r.priority,
              phase: r.current_phase,
              isBlocked: r.is_blocked,
              depth: r.depth
            })),
            totalInChain: chain.length
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get unblocked work with sorting options
    router.get('/requests/unblocked', async (req: Request, res: Response) => {
      try {
        const maxHours = parseFloat(req.query.maxHours as string) || null;
        const sortBy = (req.query.sortBy as string) || 'priority';
        const limit = parseInt(req.query.limit as string) || 20;

        let orderClause = '';
        switch (sortBy) {
          case 'effort_asc':
            orderClause = 'ORDER BY COALESCE(estimated_hours, 999) ASC, priority_order';
            break;
          case 'effort_desc':
            orderClause = 'ORDER BY COALESCE(estimated_hours, 0) DESC, priority_order';
            break;
          case 'age':
            orderClause = 'ORDER BY created_at ASC, priority_order';
            break;
          default: // priority
            orderClause = 'ORDER BY priority_order, created_at ASC';
        }

        const hoursFilter = maxHours ? `AND (estimated_hours IS NULL OR estimated_hours <= ${maxHours})` : '';

        const requests = await this.db.query(`
          SELECT
            req_number,
            title,
            priority,
            current_phase,
            estimated_hours,
            created_at,
            source_customer,
            CASE priority
              WHEN 'catastrophic' THEN 1
              WHEN 'critical' THEN 2
              WHEN 'high' THEN 3
              WHEN 'medium' THEN 4
              WHEN 'low' THEN 5
            END as priority_order
          FROM owner_requests
          WHERE is_blocked = FALSE
            AND current_phase NOT IN ('done', 'cancelled')
            ${hoursFilter}
          ${orderClause}
          LIMIT $1
        `, [limit]);

        res.json({
          success: true,
          data: {
            requests: requests.map((r: any) => ({
              reqNumber: r.req_number,
              title: r.title,
              priority: r.priority,
              phase: r.current_phase,
              estimatedHours: r.estimated_hours,
              createdAt: r.created_at,
              customer: r.source_customer
            })),
            count: requests.length,
            sortedBy: sortBy
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get requests by customer/source
    router.get('/requests/by-customer/:customerName', async (req: Request, res: Response) => {
      try {
        const { customerName } = req.params;

        const requests = await this.db.query(`
          SELECT
            req_number,
            title,
            priority,
            current_phase,
            is_blocked,
            source_customer,
            created_at
          FROM owner_requests
          WHERE LOWER(source_customer) LIKE LOWER($1)
             OR LOWER(source) LIKE LOWER($1)
             OR LOWER(title) LIKE LOWER($1)
          ORDER BY
            CASE priority
              WHEN 'catastrophic' THEN 1
              WHEN 'critical' THEN 2
              WHEN 'high' THEN 3
              WHEN 'medium' THEN 4
              WHEN 'low' THEN 5
            END,
            created_at DESC
        `, [`%${customerName}%`]);

        res.json({
          success: true,
          data: {
            customerSearch: customerName,
            requests: requests.map((r: any) => ({
              reqNumber: r.req_number,
              title: r.title,
              priority: r.priority,
              phase: r.current_phase,
              isBlocked: r.is_blocked,
              customer: r.source_customer,
              createdAt: r.created_at
            })),
            count: requests.length
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get biggest bottleneck - request blocking the most other work
    router.get('/requests/biggest-bottleneck', async (_req: Request, res: Response) => {
      try {
        const result = await this.db.query(`
          SELECT
            r.req_number,
            r.title,
            r.priority,
            r.current_phase,
            r.is_blocked,
            COUNT(DISTINCT rb.blocked_request_id) as blocks_count,
            ARRAY_AGG(DISTINCT blocked.req_number) FILTER (WHERE blocked.req_number IS NOT NULL) as blocks_reqs
          FROM owner_requests r
          JOIN request_blockers rb ON rb.blocking_request_id = r.id
          JOIN owner_requests blocked ON blocked.id = rb.blocked_request_id
          WHERE r.current_phase NOT IN ('done', 'cancelled')
          GROUP BY r.id, r.req_number, r.title, r.priority, r.current_phase, r.is_blocked
          ORDER BY blocks_count DESC
          LIMIT 5
        `);

        if (result.length === 0) {
          res.json({
            success: true,
            data: {
              message: 'No bottlenecks found - no requests are blocking other work.',
              bottleneck: null,
              topBlockers: []
            }
          });
          return;
        }

        const biggest = result[0];
        res.json({
          success: true,
          data: {
            message: `${biggest.req_number} is blocking ${biggest.blocks_count} other items. Completing this will unblock the most work.`,
            bottleneck: {
              reqNumber: biggest.req_number,
              title: biggest.title,
              priority: biggest.priority,
              phase: biggest.current_phase,
              isBlocked: biggest.is_blocked,
              blocksCount: parseInt(biggest.blocks_count),
              blocksReqs: biggest.blocks_reqs || []
            },
            topBlockers: result.map((r: any) => ({
              reqNumber: r.req_number,
              title: r.title,
              blocksCount: parseInt(r.blocks_count)
            }))
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get highest impact recommendation
    router.get('/recommendations/highest-impact', async (req: Request, res: Response) => {
      try {
        const urgency = req.query.urgency as string;

        let whereClause = "WHERE status = 'pending'";
        const params: any[] = [];

        if (urgency) {
          params.push(urgency);
          whereClause += ` AND urgency = $${params.length}`;
        }

        const result = await this.db.query(`
          SELECT
            id,
            rec_number,
            title,
            description,
            rationale,
            expected_benefits,
            urgency,
            impact_level,
            affected_bus,
            status,
            recommended_by
          FROM recommendations
          ${whereClause}
          ORDER BY
            CASE impact_level
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
              ELSE 5
            END,
            CASE urgency
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
              ELSE 5
            END,
            ARRAY_LENGTH(affected_bus, 1) DESC NULLS LAST
          LIMIT 5
        `, params);

        if (result.length === 0) {
          res.json({
            success: true,
            data: {
              message: 'No pending recommendations found.',
              highestImpact: null,
              topRecommendations: []
            }
          });
          return;
        }

        const highest = result[0];
        res.json({
          success: true,
          data: {
            message: `${highest.rec_number}: "${highest.title}" has the highest impact (${highest.impact_level} impact, ${highest.urgency} urgency).`,
            highestImpact: {
              recNumber: highest.rec_number,
              title: highest.title,
              description: highest.description,
              rationale: highest.rationale,
              expectedBenefits: highest.expected_benefits,
              urgency: highest.urgency,
              impactLevel: highest.impact_level,
              affectedBus: highest.affected_bus,
              recommendedBy: highest.recommended_by
            },
            topRecommendations: result.map((r: any) => ({
              recNumber: r.rec_number,
              title: r.title,
              impactLevel: r.impact_level,
              urgency: r.urgency
            }))
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get recommendations for a specific feature
    router.get('/recommendations/for-feature', async (req: Request, res: Response) => {
      try {
        const feature = req.query.feature as string;
        const status = req.query.status as string || 'pending';

        if (!feature) {
          res.status(400).json({ success: false, error: 'feature query parameter required' });
          return;
        }

        let statusClause = '';
        if (status !== 'all') {
          statusClause = `AND status = '${status}'`;
        }

        const result = await this.db.query(`
          SELECT
            id,
            rec_number,
            title,
            description,
            urgency,
            impact_level,
            status,
            affected_bus
          FROM recommendations
          WHERE (
            LOWER(title) LIKE LOWER($1)
            OR LOWER(description) LIKE LOWER($1)
            OR EXISTS (SELECT 1 FROM unnest(affected_bus) AS bu WHERE LOWER(bu) LIKE LOWER($1))
          )
          ${statusClause}
          ORDER BY
            CASE impact_level
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              ELSE 4
            END,
            CASE urgency
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              ELSE 4
            END
        `, [`%${feature}%`]);

        res.json({
          success: true,
          data: {
            feature,
            status,
            message: result.length > 0
              ? `Found ${result.length} recommendation(s) related to "${feature}".`
              : `No recommendations found related to "${feature}".`,
            recommendations: result.map((r: any) => ({
              recNumber: r.rec_number,
              title: r.title,
              description: r.description,
              urgency: r.urgency,
              impactLevel: r.impact_level,
              status: r.status,
              affectedBus: r.affected_bus
            })),
            count: result.length
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Estimate completion for a request
    router.get('/requests/:reqNumber/estimate', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;

        // Get request details and blockers
        const request = await this.db.query(`
          SELECT
            r.*,
            COUNT(rb.id) as blocker_count,
            SUM(COALESCE(blocking.estimated_hours, 4)) as blocked_hours
          FROM owner_requests r
          LEFT JOIN request_blockers rb ON rb.blocked_request_id = r.id AND rb.resolved_at IS NULL
          LEFT JOIN owner_requests blocking ON blocking.id = rb.blocking_request_id
          WHERE r.req_number = $1
          GROUP BY r.id
        `, [reqNumber]);

        if (request.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        }

        const r = request[0];
        const ownHours = r.estimated_hours || 4;
        const blockedHours = parseFloat(r.blocked_hours) || 0;
        const totalHours = ownHours + blockedHours;

        // Simple estimate: 6 productive hours per day
        const daysNeeded = Math.ceil(totalHours / 6);
        const estimatedDate = new Date();
        estimatedDate.setDate(estimatedDate.getDate() + daysNeeded);

        res.json({
          success: true,
          data: {
            reqNumber,
            title: r.title,
            priority: r.priority,
            currentPhase: r.current_phase,
            isBlocked: r.is_blocked,
            blockerCount: parseInt(r.blocker_count),
            estimate: {
              ownHours,
              blockedHours,
              totalHours,
              daysNeeded,
              estimatedCompletionDate: estimatedDate.toISOString().split('T')[0],
              confidence: r.is_blocked ? 'low' : (r.estimated_hours ? 'medium' : 'low'),
              note: r.is_blocked
                ? `Blocked by ${r.blocker_count} items. Resolve blockers first.`
                : 'Estimate based on current velocity.'
            }
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Check if a request is still needed (duplicate/similarity detection)
    router.get('/requests/:reqNumber/check-needed', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;

        // Get request details
        const request = await this.db.query(`
          SELECT req_number, title, description, current_phase, tags
          FROM owner_requests
          WHERE req_number = $1
        `, [reqNumber]);

        if (request.length === 0) {
          res.status(404).json({ success: false, error: 'Request not found' });
          return;
        }

        const req_data = request[0];

        // Build search text from title + description
        const searchText = `${req_data.title} ${req_data.description || ''}`.trim();

        // Query memories for similar completed work
        // Look for memories related to completed REQs
        const similarWork = await this.db.query(`
          SELECT
            m.content,
            m.metadata,
            m.agent_id,
            m.memory_type,
            m.created_at,
            1 - (m.embedding <=> (
              SELECT embedding FROM memories
              WHERE content ILIKE '%' || $1 || '%'
              LIMIT 1
            )) as similarity
          FROM memories m
          WHERE m.memory_type IN ('decision', 'learning', 'deliverable', 'completion')
            AND m.content ILIKE '%done%' OR m.content ILIKE '%complete%' OR m.content ILIKE '%finished%'
            AND m.embedding IS NOT NULL
          ORDER BY similarity DESC NULLS LAST
          LIMIT 10
        `, [req_data.title.substring(0, 50)]);

        // Also check owner_requests for similar completed items
        const similarReqs = await this.db.query(`
          SELECT
            req_number,
            title,
            description,
            current_phase,
            updated_at
          FROM owner_requests
          WHERE current_phase = 'done'
            AND req_number != $1
            AND (
              title ILIKE '%' || $2 || '%'
              OR description ILIKE '%' || $2 || '%'
            )
          LIMIT 5
        `, [reqNumber, req_data.title.split(' ').slice(0, 3).join('%')]);

        // Determine if still needed
        const hasSimilarCompleted = similarReqs.length > 0;
        const confidence = hasSimilarCompleted
          ? (similarReqs.length >= 3 ? 'high' : 'medium')
          : 'low';

        res.json({
          success: true,
          data: {
            reqNumber,
            stillNeeded: !hasSimilarCompleted,
            confidence,
            message: hasSimilarCompleted
              ? `Found ${similarReqs.length} similar completed item(s). Review to determine if this is still needed.`
              : 'No similar completed work found. This request appears to still be needed.',
            similarWork: similarReqs.map((r: any) => ({
              reqNumber: r.req_number,
              title: r.title,
              completedAt: r.updated_at,
              phase: r.current_phase
            })),
            relatedMemories: similarWork
              .filter((m: any) => m.similarity > 0.7)
              .slice(0, 3)
              .map((m: any) => ({
                content: m.content.substring(0, 200),
                agent: m.agent_id,
                type: m.memory_type,
                similarity: m.similarity
              }))
          }
        });
      } catch (error: any) {
        // Fallback if embeddings not available
        res.json({
          success: true,
          data: {
            reqNumber: req.params.reqNumber,
            stillNeeded: true,
            confidence: 'low',
            message: 'Could not perform similarity search. Assuming request is still needed.',
            similarWork: [],
            relatedMemories: []
          }
        });
      }
    });

    // Analyze workload for time period
    router.get('/workload/analyze', async (req: Request, res: Response) => {
      try {
        const hours = parseFloat(req.query.hours as string) || 8;

        // Get unblocked work sorted by priority
        const available = await this.db.query(`
          SELECT
            req_number,
            title,
            priority,
            current_phase,
            COALESCE(estimated_hours, 4) as estimated_hours
          FROM owner_requests
          WHERE is_blocked = FALSE
            AND current_phase NOT IN ('done', 'cancelled')
          ORDER BY
            CASE priority
              WHEN 'catastrophic' THEN 1
              WHEN 'critical' THEN 2
              WHEN 'high' THEN 3
              WHEN 'medium' THEN 4
              WHEN 'low' THEN 5
            END,
            created_at ASC
        `);

        // Calculate what fits in the time
        let remainingHours = hours;
        const canComplete: any[] = [];
        const partial: any[] = [];

        for (const r of available) {
          const estHours = parseFloat(r.estimated_hours);
          if (remainingHours >= estHours) {
            canComplete.push({
              reqNumber: r.req_number,
              title: r.title,
              priority: r.priority,
              estimatedHours: estHours
            });
            remainingHours -= estHours;
          } else if (remainingHours > 0) {
            partial.push({
              reqNumber: r.req_number,
              title: r.title,
              priority: r.priority,
              estimatedHours: estHours,
              canProgressHours: remainingHours
            });
            break;
          }
        }

        res.json({
          success: true,
          data: {
            hoursAvailable: hours,
            analysis: {
              canCompleteCount: canComplete.length,
              canComplete,
              partialProgress: partial,
              unusedHours: Math.max(0, remainingHours),
              totalAvailableItems: available.length
            }
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update request priority (for AI)
    router.post('/requests/:reqNumber/priority', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { priority, reason, updatedBy } = req.body;

        const validPriorities = ['low', 'medium', 'high', 'critical', 'catastrophic'];
        if (!validPriorities.includes(priority)) {
          return res.status(400).json({ success: false, error: `Invalid priority: ${priority}` });
        }

        const result = await this.db.query(`
          UPDATE owner_requests
          SET priority = $1, updated_at = NOW()
          WHERE req_number = $2
          RETURNING req_number, title, priority
        `, [priority, reqNumber]);

        if (result.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        }

        console.log(`[SDLC API] Priority updated: ${reqNumber} -> ${priority} by ${updatedBy || 'unknown'}. Reason: ${reason || 'none'}`);

        res.json({
          success: true,
          data: {
            reqNumber: result[0].req_number,
            title: result[0].title,
            newPriority: result[0].priority,
            updatedBy: updatedBy || 'unknown',
            reason
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Set top priority (creates blocker-chain directive - REVERSIBLE)
    // This does NOT permanently change priority - use escalate-priority for that
    router.post('/requests/:reqNumber/top-priority', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { reason, createdBy = 'ai-assist', expiresAt } = req.body;

        // Verify request exists
        const reqResult = await this.db.query(
          `SELECT req_number, title, is_blocked, priority FROM owner_requests WHERE req_number = $1`,
          [reqNumber]
        );

        if (reqResult.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        }

        const request = reqResult[0];

        // Deactivate any existing directive first
        await this.db.query(`
          UPDATE workflow_directives
          SET is_active = false, deactivated_at = NOW(), deactivated_reason = 'superseded_by_top_priority'
          WHERE is_active = true
        `);

        // Get full blocker chain (same logic as blocker_chain targetType)
        const chainResult = await this.db.query(`
          WITH RECURSIVE blocker_chain AS (
            SELECT id, req_number, 1 as depth
            FROM owner_requests
            WHERE req_number = $1

            UNION ALL

            SELECT r.id, r.req_number, bc.depth + 1
            FROM blocker_chain bc
            JOIN request_blockers rb ON rb.blocked_request_id = bc.id OR rb.blocking_request_id = bc.id
            JOIN owner_requests r ON r.id = rb.blocked_request_id OR r.id = rb.blocking_request_id
            WHERE r.req_number != bc.req_number
              AND rb.resolved_at IS NULL
              AND bc.depth < 10
          )
          SELECT DISTINCT req_number FROM blocker_chain
        `, [reqNumber]);

        const targetReqNumbers = chainResult.map((r: any) => r.req_number);

        // Create blocker-chain directive
        const displayName = `Top Priority: ${reqNumber}`;
        const result = await this.db.query(`
          INSERT INTO workflow_directives (
            directive_type, display_name, target_type, target_value,
            target_req_numbers, filter_criteria, expires_at,
            auto_restore, exclusive, created_by, reason,
            total_items, completed_items
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
          RETURNING *
        `, [
          'focus',
          displayName,
          'blocker_chain',
          reqNumber,
          targetReqNumbers,
          JSON.stringify({}),
          expiresAt || null,
          true,  // autoRestore
          true,  // exclusive
          createdBy,
          reason || `Top priority set for ${reqNumber}`,
          targetReqNumbers.length
        ]);

        const directive = result[0];

        console.log(`[SDLC API] TOP PRIORITY (directive): ${reqNumber} by ${createdBy}. Chain: ${targetReqNumbers.length} items. Reason: ${reason || 'none'}`);

        res.json({
          success: true,
          data: {
            reqNumber: request.req_number,
            title: request.title,
            originalPriority: request.priority,
            isTopPriority: true,
            reversible: true,
            directive: {
              id: directive.id,
              displayName: directive.display_name,
              targetReqNumbers: directive.target_req_numbers,
              totalItems: directive.total_items,
              expiresAt: directive.expires_at
            },
            createdBy,
            reason,
            message: `${reqNumber} is now top priority via workflow directive. Original priority preserved. Use /workflow/focus/clear to return to normal.`
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Permanently escalate priority (IRREVERSIBLE - use sparingly)
    // For rare cases where actual priority change is needed (not just temporary focus)
    router.post('/requests/:reqNumber/escalate-priority', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { priority, reason, updatedBy } = req.body;

        // Only allow escalation to critical or catastrophic
        if (!priority || !['critical', 'catastrophic'].includes(priority)) {
          return res.status(400).json({
            success: false,
            error: 'Priority must be "critical" or "catastrophic" for escalation'
          });
        }

        const result = await this.db.query(`
          UPDATE owner_requests
          SET priority = $2, updated_at = NOW()
          WHERE req_number = $1
          RETURNING req_number, title, priority
        `, [reqNumber, priority]);

        if (result.length === 0) {
          return res.status(404).json({ success: false, error: `Request not found: ${reqNumber}` });
        }

        console.log(`[SDLC API] PRIORITY ESCALATED (permanent): ${reqNumber} -> ${priority} by ${updatedBy || 'api'}. Reason: ${reason || 'none'}`);

        res.json({
          success: true,
          data: {
            reqNumber: result[0].req_number,
            title: result[0].title,
            priority: result[0].priority,
            escalatedBy: updatedBy || 'api',
            reason,
            reversible: false,
            warning: 'This priority change is PERMANENT. For temporary focus, use /requests/:reqNumber/top-priority instead.',
            message: `${reqNumber} priority permanently escalated to ${priority}.`
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // ========================================================================
    // WORKFLOW DIRECTIVE ENDPOINTS
    // ========================================================================

    // Get current workflow status (active directive if any)
    router.get('/workflow/status', async (req: Request, res: Response) => {
      try {
        const result = await this.db.query(`SELECT * FROM get_active_workflow_directive()`);

        if (result.length === 0) {
          return res.json({
            success: true,
            data: {
              mode: 'normal',
              directive: null,
              message: 'Workflow operating normally'
            }
          });
        }

        const directive = result[0];

        // Get progress if we have target REQs
        let progress = null;
        if (directive.target_req_numbers?.length > 0) {
          const progressResult = await this.db.query(`
            SELECT
              COUNT(*) FILTER (WHERE current_phase = 'done') as completed,
              COUNT(*) FILTER (WHERE current_phase != 'done' AND is_blocked = false) as in_progress,
              COUNT(*) FILTER (WHERE is_blocked = true) as blocked,
              COUNT(*) as total
            FROM owner_requests
            WHERE req_number = ANY($1)
          `, [directive.target_req_numbers]);

          progress = progressResult[0];
        }

        res.json({
          success: true,
          data: {
            mode: 'focused',
            directive: {
              id: directive.id,
              type: directive.directive_type,
              displayName: directive.display_name,
              targetType: directive.target_type,
              targetValue: directive.target_value,
              targetReqNumbers: directive.target_req_numbers,
              filterCriteria: directive.filter_criteria,
              expiresAt: directive.expires_at,
              autoRestore: directive.auto_restore,
              exclusive: directive.exclusive,
              createdBy: directive.created_by,
              reason: directive.reason,
              activatedAt: directive.activated_at
            },
            progress
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Create a new workflow directive (flexible)
    router.post('/workflow/directive', async (req: Request, res: Response) => {
      try {
        const {
          directiveType,
          displayName,
          targetType,
          targetValue,
          filterCriteria,
          expiresAt,
          autoRestore = true,
          exclusive = true,
          createdBy = 'api',
          reason
        } = req.body;

        if (!directiveType || !displayName) {
          return res.status(400).json({
            success: false,
            error: 'directiveType and displayName are required'
          });
        }

        // Deactivate any existing directive first
        await this.db.query(`
          UPDATE workflow_directives
          SET is_active = false, deactivated_at = NOW(), deactivated_reason = 'superseded'
          WHERE is_active = true
        `);

        // Resolve target REQ numbers based on target type
        let targetReqNumbers: string[] = [];

        if (targetType === 'blocker_chain' && targetValue) {
          // Get full blocker chain (recursive)
          const chainResult = await this.db.query(`
            WITH RECURSIVE blocker_chain AS (
              SELECT id, req_number, 1 as depth
              FROM owner_requests
              WHERE req_number = $1

              UNION ALL

              SELECT r.id, r.req_number, bc.depth + 1
              FROM blocker_chain bc
              JOIN request_blockers rb ON rb.blocked_request_id = bc.id OR rb.blocking_request_id = bc.id
              JOIN owner_requests r ON r.id = rb.blocked_request_id OR r.id = rb.blocking_request_id
              WHERE r.req_number != bc.req_number
                AND rb.resolved_at IS NULL
                AND bc.depth < 10
            )
            SELECT DISTINCT req_number FROM blocker_chain
          `, [targetValue]);

          targetReqNumbers = chainResult.map((r: any) => r.req_number);
        } else if (targetType === 'req' && targetValue) {
          targetReqNumbers = [targetValue];
        } else if (targetType === 'customer' && targetValue) {
          const custResult = await this.db.query(`
            SELECT req_number FROM owner_requests
            WHERE LOWER(source_customer) LIKE LOWER($1)
              AND current_phase != 'done'
          `, [`%${targetValue}%`]);
          targetReqNumbers = custResult.map((r: any) => r.req_number);
        } else if (targetType === 'tag' && targetValue) {
          const tagResult = await this.db.query(`
            SELECT req_number FROM owner_requests
            WHERE $1 = ANY(tags)
              AND current_phase != 'done'
          `, [targetValue]);
          targetReqNumbers = tagResult.map((r: any) => r.req_number);
        } else if (targetType === 'bu' && targetValue) {
          const buResult = await this.db.query(`
            SELECT req_number FROM owner_requests
            WHERE primary_bu = $1
              AND current_phase != 'done'
          `, [targetValue]);
          targetReqNumbers = buResult.map((r: any) => r.req_number);
        } else if (targetType === 'list' && Array.isArray(req.body.targetReqNumbers)) {
          // Direct list of REQ numbers provided by user
          const providedList = req.body.targetReqNumbers as string[];

          if (providedList.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'targetReqNumbers array cannot be empty for targetType "list"'
            });
          }

          // Validate all REQs exist
          const validationResult = await this.db.query(`
            SELECT req_number FROM owner_requests
            WHERE req_number = ANY($1)
          `, [providedList]);

          const validReqs = new Set(validationResult.map((r: any) => r.req_number));
          const invalidReqs = providedList.filter(r => !validReqs.has(r));

          if (invalidReqs.length > 0) {
            return res.status(400).json({
              success: false,
              error: `Invalid REQ numbers: ${invalidReqs.slice(0, 10).join(', ')}${invalidReqs.length > 10 ? ` and ${invalidReqs.length - 10} more` : ''}`
            });
          }

          targetReqNumbers = providedList;
          console.log(`[SDLC API] Directive with hand-picked list: ${targetReqNumbers.length} items`);
        } else if (filterCriteria) {
          // Build dynamic query from filter criteria
          let whereConditions = ["current_phase != 'done'"];
          const params: any[] = [];
          let paramIndex = 1;

          if (filterCriteria.priority) {
            whereConditions.push(`priority = ANY($${paramIndex})`);
            params.push(filterCriteria.priority);
            paramIndex++;
          }
          if (filterCriteria.maxHours) {
            whereConditions.push(`(estimated_hours IS NULL OR estimated_hours <= $${paramIndex})`);
            params.push(filterCriteria.maxHours);
            paramIndex++;
          }
          if (filterCriteria.unblocked) {
            whereConditions.push('is_blocked = false');
          }

          const filterResult = await this.db.query(`
            SELECT req_number FROM owner_requests
            WHERE ${whereConditions.join(' AND ')}
          `, params);
          targetReqNumbers = filterResult.map((r: any) => r.req_number);
        }

        // Track original count before blocker expansion
        const originalCount = targetReqNumbers.length;
        let addedBlockers: string[] = [];

        // Expand to include blockers if requested (Part 2: expandBlockers option)
        if (req.body.expandBlockers && targetReqNumbers.length > 0) {
          // Find all blockers for blocked items in the list (recursive)
          const blockerExpansion = await this.db.query(`
            WITH RECURSIVE blocker_tree AS (
              -- Start with blocked items in our list
              SELECT DISTINCT rb.blocking_request_id as id
              FROM request_blockers rb
              JOIN owner_requests blocked ON blocked.id = rb.blocked_request_id
              WHERE blocked.req_number = ANY($1)
                AND rb.resolved_at IS NULL

              UNION

              -- Recursively find blockers of blockers
              SELECT rb.blocking_request_id
              FROM blocker_tree bt
              JOIN request_blockers rb ON rb.blocked_request_id = bt.id
              WHERE rb.resolved_at IS NULL
            )
            SELECT DISTINCT r.req_number
            FROM blocker_tree bt
            JOIN owner_requests r ON r.id = bt.id
            WHERE r.req_number != ALL($1)  -- Exclude items already in list
          `, [targetReqNumbers]);

          addedBlockers = blockerExpansion.map((r: any) => r.req_number);

          if (addedBlockers.length > 0) {
            targetReqNumbers = [...targetReqNumbers, ...addedBlockers];
            console.log(`[SDLC API] Expanded directive: +${addedBlockers.length} blockers (${originalCount} -> ${targetReqNumbers.length})`);
          }
        }

        // Check for blocked items that cannot be completed (blockers outside scope)
        let blockedItemsWarning: string[] = [];
        if (exclusive && targetReqNumbers.length > 0 && !req.body.expandBlockers) {
          const blockedOutside = await this.db.query(`
            SELECT DISTINCT blocked.req_number
            FROM request_blockers rb
            JOIN owner_requests blocked ON blocked.id = rb.blocked_request_id
            JOIN owner_requests blocker ON blocker.id = rb.blocking_request_id
            WHERE blocked.req_number = ANY($1)
              AND blocker.req_number != ALL($1)
              AND rb.resolved_at IS NULL
          `, [targetReqNumbers]);

          blockedItemsWarning = blockedOutside.map((r: any) => r.req_number);
          if (blockedItemsWarning.length > 0) {
            console.log(`[SDLC API] WARNING: ${blockedItemsWarning.length} items blocked by REQs outside directive scope`);
          }
        }

        // Create the directive
        const result = await this.db.query(`
          INSERT INTO workflow_directives (
            directive_type, display_name, target_type, target_value,
            target_req_numbers, filter_criteria, expires_at,
            auto_restore, exclusive, created_by, reason,
            total_items, completed_items
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
          RETURNING *
        `, [
          directiveType,
          displayName,
          targetType,
          targetValue,
          targetReqNumbers,
          JSON.stringify(filterCriteria || {}),
          expiresAt,
          autoRestore,
          exclusive,
          createdBy,
          reason,
          targetReqNumbers.length
        ]);

        const directive = result[0];

        console.log(`[SDLC API] Workflow directive activated: ${displayName} (${targetReqNumbers.length} REQs)`);

        // TODO: Publish NATS message for orchestrator
        // this.nats.publish('agog.workflow.directive.activated', directive);

        // Build response with expansion info
        const responseData: any = {
          directive: {
            id: directive.id,
            type: directive.directive_type,
            displayName: directive.display_name,
            targetReqNumbers: directive.target_req_numbers,
            totalItems: directive.total_items,
            expiresAt: directive.expires_at
          },
          message: `Workflow now focused: ${displayName}`
        };

        // Add expansion info if blockers were added
        if (addedBlockers.length > 0) {
          responseData.expansion = {
            originalCount,
            expandedCount: targetReqNumbers.length,
            addedBlockers,
            message: `Added ${addedBlockers.length} blocker(s) to ensure completion.`
          };
        }

        // Add warning if blocked items exist outside scope
        if (blockedItemsWarning.length > 0) {
          responseData.warning = {
            blockedItemsOutsideScope: blockedItemsWarning,
            message: `${blockedItemsWarning.length} item(s) are blocked by REQs outside this focus. Consider using expandBlockers=true or adding blockers manually.`
          };
        }

        res.json({
          success: true,
          data: responseData
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Focus on blocker chain (convenience endpoint)
    router.post('/workflow/focus/blocker-chain', async (req: Request, res: Response) => {
      try {
        const { reqNumber, createdBy = 'api', reason } = req.body;

        if (!reqNumber) {
          return res.status(400).json({ success: false, error: 'reqNumber is required' });
        }

        // Forward to generic directive endpoint
        req.body = {
          directiveType: 'focus',
          displayName: `Focus on blocker chain: ${reqNumber}`,
          targetType: 'blocker_chain',
          targetValue: reqNumber,
          exclusive: true,
          autoRestore: true,
          createdBy,
          reason
        };

        // Re-route to directive endpoint (bit of a hack, but works)
        const directiveHandler = router.stack.find((layer: any) =>
          layer.route?.path === '/workflow/directive' && layer.route?.methods?.post
        );

        if (directiveHandler?.route?.stack?.[0]?.handle) {
          return directiveHandler.route.stack[0].handle(req, res, () => {});
        }

        res.status(500).json({ success: false, error: 'Could not create directive' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Clear focus / return to normal
    router.post('/workflow/focus/clear', async (req: Request, res: Response) => {
      try {
        const { reason = 'user_cancelled' } = req.body;

        const result = await this.db.query(`
          SELECT deactivate_workflow_directive(id, $1)
          FROM workflow_directives
          WHERE is_active = true
        `, [reason]);

        console.log(`[SDLC API] Workflow directive cleared: ${reason}`);

        res.json({
          success: true,
          data: {
            cleared: result.length > 0,
            message: 'Workflow returned to normal'
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Check if REQ is in current focus scope
    router.get('/workflow/in-scope/:reqNumber', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;

        const result = await this.db.query(
          `SELECT is_req_in_active_scope($1) as in_scope`,
          [reqNumber]
        );

        res.json({
          success: true,
          data: {
            reqNumber,
            inScope: result[0]?.in_scope ?? true
          }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Board Configuration Endpoints (REQ-SDLC-1767972294)
    // =========================================================================

    // GET /api/agent/boards - List all active boards
    router.get('/boards', async (req: Request, res: Response) => {
      try {
        const boards = await this.db.query(`
          SELECT board_code, board_name, description, routing_tags, routing_mode,
                 display_order, color, icon, show_all_phases, allowed_phases,
                 visible_to_agents, managed_by_bu, status, board_version
          FROM board_configurations
          WHERE is_active = true AND status = 'published'
          ORDER BY display_order
        `);

        res.json({
          success: true,
          data: { boards }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // GET /api/agent/boards/:boardCode - Get board configuration
    router.get('/boards/:boardCode', async (req: Request, res: Response) => {
      try {
        const { boardCode } = req.params;

        const board = await this.db.queryOne(`
          SELECT * FROM board_configurations
          WHERE board_code = $1 AND is_active = true
        `, [boardCode]);

        if (!board) {
          return res.status(404).json({
            success: false,
            error: `Board not found: ${boardCode}`
          });
        }

        res.json({
          success: true,
          data: { board }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // GET /api/agent/boards/:boardCode/requests - Get requests for specific board
    router.get('/boards/:boardCode/requests', async (req: Request, res: Response) => {
      try {
        const { boardCode } = req.params;

        // Use the database function for consistent routing logic
        const requests = await this.db.query(`
          SELECT * FROM get_board_requests($1)
        `, [boardCode]);

        // Get board config for response
        const board = await this.db.queryOne(`
          SELECT * FROM board_configurations
          WHERE board_code = $1 AND is_active = true AND status = 'published'
        `, [boardCode]);

        if (!board) {
          return res.status(404).json({
            success: false,
            error: `Board not found: ${boardCode}`
          });
        }

        res.json({
          success: true,
          data: { requests, board }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /api/agent/boards - Create a new board (draft status)
    router.post('/boards', async (req: Request, res: Response) => {
      try {
        const {
          boardCode,
          boardName,
          description,
          routingTags = [],
          routingMode = 'any',
          displayOrder = 0,
          color = '#3B82F6',
          icon,
          visibleToAgents = [],
          managedByBu,
          showAllPhases = true,
          allowedPhases = [],
          autoAssignAgent,
          createdBy = 'system'
        } = req.body;

        if (!boardCode || !boardName) {
          return res.status(400).json({
            success: false,
            error: 'boardCode and boardName are required'
          });
        }

        await this.db.query(`
          INSERT INTO board_configurations (
            board_code, board_name, description, routing_tags, routing_mode,
            display_order, color, icon, visible_to_agents, managed_by_bu,
            show_all_phases, allowed_phases, auto_assign_agent, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft', $14)
        `, [
          boardCode, boardName, description, routingTags, routingMode,
          displayOrder, color, icon, visibleToAgents, managedByBu,
          showAllPhases, allowedPhases, autoAssignAgent, createdBy
        ]);

        res.json({
          success: true,
          data: { boardCode, status: 'draft' }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /api/agent/boards/:boardCode/publish - Publish a board
    router.post('/boards/:boardCode/publish', async (req: Request, res: Response) => {
      try {
        const { boardCode } = req.params;
        const { publishedBy = 'system' } = req.body;

        await this.db.query(`
          SELECT publish_board($1, $2)
        `, [boardCode, publishedBy]);

        res.json({
          success: true,
          data: { boardCode, status: 'published' }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /api/agent/boards/:boardCode/archive - Archive a board
    router.post('/boards/:boardCode/archive', async (req: Request, res: Response) => {
      try {
        const { boardCode } = req.params;
        const { archivedBy = 'system' } = req.body;

        await this.db.query(`
          SELECT archive_board($1, $2)
        `, [boardCode, archivedBy]);

        res.json({
          success: true,
          data: { boardCode, status: 'archived' }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // GET /api/agent/boards/stats - Get statistics for all boards
    router.get('/boards/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.db.query(`
          SELECT * FROM v_board_stats
        `);

        res.json({
          success: true,
          data: { stats }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // Tag Management Endpoints (REQ-SDLC-1767972294)
    // =========================================================================

    // GET /api/agent/tags - Get all active tags with usage counts
    router.get('/tags', async (req: Request, res: Response) => {
      try {
        const { category, status = 'active' } = req.query;

        let query = `
          SELECT tag_name, description, category, color, usage_count,
                 status, requires_approval, approved_by, approved_at
          FROM tag_registry
          WHERE status = $1
        `;
        const params: any[] = [status];

        if (category) {
          query += ` AND category = $${params.length + 1}`;
          params.push(category);
        }

        query += ` ORDER BY usage_count DESC, tag_name`;

        const tags = await this.db.query(query, params);

        res.json({
          success: true,
          data: { tags }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // GET /api/agent/tags/stats - Get tag usage statistics
    router.get('/tags/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.db.query(`
          SELECT * FROM v_tag_stats
        `);

        res.json({
          success: true,
          data: { stats }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /api/agent/tags - Create a new tag
    router.post('/tags', async (req: Request, res: Response) => {
      try {
        const {
          tagName,
          description,
          category = 'other',
          color = '#6B7280',
          requiresApproval = true,
          createdBy = 'system'
        } = req.body;

        if (!tagName) {
          return res.status(400).json({
            success: false,
            error: 'tagName is required'
          });
        }

        await this.db.query(`
          INSERT INTO tag_registry (tag_name, description, category, color, requires_approval, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tag_name) DO NOTHING
        `, [tagName, description, category, color, requiresApproval, createdBy]);

        res.json({
          success: true,
          data: { tagName }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // POST /api/agent/tags/:tagName/approve - Approve a tag
    router.post('/tags/:tagName/approve', async (req: Request, res: Response) => {
      try {
        const { tagName } = req.params;
        const { approvedBy = 'system' } = req.body;

        await this.db.query(`
          UPDATE tag_registry
          SET requires_approval = FALSE,
              approved_by = $1,
              approved_at = NOW()
          WHERE tag_name = $2
        `, [approvedBy, tagName]);

        res.json({
          success: true,
          data: { tagName, approved: true }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // PUT /api/agent/requests/:reqNumber/tags - Update request tags
    router.put('/requests/:reqNumber/tags', async (req: Request, res: Response) => {
      try {
        const { reqNumber } = req.params;
        const { tags } = req.body;

        if (!Array.isArray(tags)) {
          return res.status(400).json({
            success: false,
            error: 'tags must be an array'
          });
        }

        await this.db.query(`
          UPDATE owner_requests
          SET tags = $1, updated_at = NOW()
          WHERE req_number = $2
        `, [tags, reqNumber]);

        res.json({
          success: true,
          data: { reqNumber, tags }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // PUT /api/agent/recommendations/:recNumber/tags - Update recommendation tags
    router.put('/recommendations/:recNumber/tags', async (req: Request, res: Response) => {
      try {
        const { recNumber } = req.params;
        const { tags } = req.body;

        if (!Array.isArray(tags)) {
          return res.status(400).json({
            success: false,
            error: 'tags must be an array'
          });
        }

        await this.db.query(`
          UPDATE recommendations
          SET tags = $1, updated_at = NOW()
          WHERE rec_number = $2
        `, [tags, recNumber]);

        res.json({
          success: true,
          data: { recNumber, tags }
        });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Mount routes
    this.app.use('/api/agent', router);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ success: false, error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('[SDLC API] Error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    });
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      const port = this.config.port!;
      const host = this.config.host || '127.0.0.1';
      this.app.listen(port, host, () => {
        console.log(`[SDLC API] Server running at http://${this.config.host}:${this.config.port}`);
        console.log('[SDLC API] Endpoints:');
        console.log('  GET  /api/agent/health');
        console.log('  POST /api/agent/entity/register');
        console.log('  POST /api/agent/dependency/add');
        console.log('  GET  /api/agent/execution-order?entities=...');
        console.log('  POST /api/agent/execution-order');
        console.log('  GET  /api/agent/impact/:entityName');
        console.log('  GET  /api/agent/cycles');
        console.log('  POST /api/agent/column/validate');
        console.log('  POST /api/agent/migration/validate');
        console.log('  GET  /api/agent/kanban');
        console.log('  POST /api/agent/transition/validate');
        console.log('  GET  /api/agent/phase-stats');
        console.log('  GET  /api/agent/column-stats');
        console.log('  GET  /api/agent/cross-bu-matrix');
        console.log('  GET  /api/agent/dependency-graph');
        console.log('  POST /api/agent/diagrams/generate');
        console.log('  POST /api/agent/diagrams/generate-all');
        console.log('  GET  /api/agent/diagrams/:type');
        console.log('  GET  /api/agent/recommendations');
        console.log('  PUT  /api/agent/recommendations/:id/status');
        console.log('  GET  /api/agent/requests');
        console.log('  GET  /api/agent/request-stats');
        console.log('  POST /api/agent/blockers');
        console.log('  GET  /api/agent/blockers/:reqNumber');
        console.log('  POST /api/agent/blockers/resolve/:reqNumber');
        console.log('  GET  /api/agent/deepest-unblocked');
        console.log('  DELETE /api/agent/blockers/:blocked/:blocking');
        resolve();
      });
    });
  }
}
