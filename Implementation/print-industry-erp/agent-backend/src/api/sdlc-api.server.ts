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

        // Get recommendations
        const recommendations = await this.db.query(`
          SELECT
            id, rec_number, title, description, recommendation_type, urgency,
            affected_bus, status, source_req_number, recommended_by_agent,
            created_at, updated_at
          FROM recommendations
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
        resolve();
      });
    });
  }
}
