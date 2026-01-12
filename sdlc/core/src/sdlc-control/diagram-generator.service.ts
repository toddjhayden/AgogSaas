/**
 * Diagram Generator Service
 * Auto-generates architecture diagrams from SDLC Control data
 *
 * Supported diagram types:
 * - C4 System Context: High-level system overview from BU definitions
 * - Entity Dependency Graph: DAG visualization of entity relationships
 * - ERD: Entity-Relationship diagrams per BU
 * - Cross-BU Impact: Visualization of cross-BU dependencies
 */

import { getSDLCDatabase, SDLCDatabaseService } from './sdlc-database.service';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type DiagramType =
  | 'c4-context'
  | 'entity-dag'
  | 'erd'
  | 'cross-bu-impact'
  | 'phase-workflow';

export interface GeneratedDiagram {
  type: DiagramType;
  scope?: string;
  mermaidSource: string;
  version: number;
  generatedAt: Date;
  sourceHash: string;
}

// ============================================================================
// Service
// ============================================================================

export class DiagramGeneratorService {
  private db: SDLCDatabaseService;

  constructor() {
    this.db = getSDLCDatabase();
  }

  // ==========================================================================
  // Main Generation
  // ==========================================================================

  /**
   * Generate all diagrams
   */
  async generateAll(): Promise<GeneratedDiagram[]> {
    const diagrams: GeneratedDiagram[] = [];

    // C4 System Context (one for the whole system)
    diagrams.push(await this.generateC4Context());

    // Entity DAG (one for the whole system)
    diagrams.push(await this.generateEntityDAG());

    // Cross-BU Impact matrix
    diagrams.push(await this.generateCrossBuImpact());

    // Phase workflow
    diagrams.push(await this.generatePhaseWorkflow());

    // ERD per BU
    const bus = await this.db.query(`SELECT code FROM business_units WHERE is_active = TRUE`);
    for (const bu of bus) {
      diagrams.push(await this.generateERD(bu.code));
    }

    // Save all diagrams to database
    for (const diagram of diagrams) {
      await this.saveDiagram(diagram);
    }

    return diagrams;
  }

  /**
   * Generate a specific diagram type
   */
  async generate(type: DiagramType, scope?: string): Promise<GeneratedDiagram> {
    let diagram: GeneratedDiagram;

    switch (type) {
      case 'c4-context':
        diagram = await this.generateC4Context();
        break;
      case 'entity-dag':
        diagram = await this.generateEntityDAG(scope);
        break;
      case 'erd':
        if (!scope) throw new Error('ERD diagrams require a scope (BU code)');
        diagram = await this.generateERD(scope);
        break;
      case 'cross-bu-impact':
        diagram = await this.generateCrossBuImpact();
        break;
      case 'phase-workflow':
        diagram = await this.generatePhaseWorkflow();
        break;
      default:
        throw new Error(`Unknown diagram type: ${type}`);
    }

    await this.saveDiagram(diagram);
    return diagram;
  }

  // ==========================================================================
  // C4 System Context
  // ==========================================================================

  private async generateC4Context(): Promise<GeneratedDiagram> {
    const bus = await this.db.query(`
      SELECT code, name, description, color
      FROM business_units
      WHERE is_active = TRUE
      ORDER BY code
    `);

    // Build Mermaid flowchart (C4-style but standard syntax)
    let mermaid = `%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#326CE5'}}}%%
flowchart TB
    %% AgogSaaS ERP System Context Diagram

    %% External Users
    user["👤 ERP User<br/><i>Interacts with system</i>"]
    admin["👤 Admin<br/><i>System administration</i>"]

    %% External Systems
    nats[("📨 NATS<br/><i>Message Broker</i>")]
    postgres[("🗄️ PostgreSQL<br/><i>Database</i>")]

    subgraph erp["🏢 AgogSaaS ERP"]
`;

    for (const bu of bus) {
      const sanitizedCode = bu.code.replace(/-/g, '_');
      const shortDesc = (bu.description || '').substring(0, 50);
      mermaid += `        ${sanitizedCode}["${bu.name}<br/><i>${shortDesc}</i>"]\n`;
    }

    mermaid += `    end

    %% User relationships
    user --> erp
    admin --> erp
    erp --> nats
    erp --> postgres

`;

    // Add inter-BU relationships based on entity dependencies
    const crossBu = await this.db.query(`
      SELECT DISTINCT
        e1.owning_bu as from_bu,
        e2.owning_bu as to_bu
      FROM entity_dependencies d
      JOIN entity_registry e1 ON d.dependent_entity = e1.entity_name
      JOIN entity_registry e2 ON d.depends_on_entity = e2.entity_name
      WHERE e1.owning_bu != e2.owning_bu
    `);

    mermaid += `    %% Cross-BU Dependencies\n`;
    for (const rel of crossBu) {
      const from = rel.from_bu.replace(/-/g, '_');
      const to = rel.to_bu.replace(/-/g, '_');
      mermaid += `    ${from} -.->|depends on| ${to}\n`;
    }

    // Add styling
    mermaid += `
    %% Styling
    style user fill:#e1f5fe,stroke:#01579b
    style admin fill:#e1f5fe,stroke:#01579b
    style nats fill:#fff3e0,stroke:#e65100
    style postgres fill:#e8f5e9,stroke:#1b5e20
    style erp fill:#f5f5f5,stroke:#424242
`;

    return {
      type: 'c4-context',
      mermaidSource: mermaid,
      version: await this.getNextVersion('c4-context'),
      generatedAt: new Date(),
      sourceHash: this.hash(mermaid),
    };
  }

  // ==========================================================================
  // Entity Dependency Graph (DAG)
  // ==========================================================================

  private async generateEntityDAG(scopeBu?: string): Promise<GeneratedDiagram> {
    // Get entities and dependencies
    const entityQuery = scopeBu
      ? `SELECT entity_name, owning_bu, entity_type, is_foundation
         FROM entity_registry WHERE owning_bu = $1 ORDER BY entity_name`
      : `SELECT entity_name, owning_bu, entity_type, is_foundation
         FROM entity_registry ORDER BY owning_bu, entity_name`;

    const entities = await this.db.query(entityQuery, scopeBu ? [scopeBu] : []);

    const depQuery = scopeBu
      ? `SELECT d.dependent_entity, d.depends_on_entity, d.dependency_type
         FROM entity_dependencies d
         JOIN entity_registry e1 ON d.dependent_entity = e1.entity_name
         JOIN entity_registry e2 ON d.depends_on_entity = e2.entity_name
         WHERE e1.owning_bu = $1 OR e2.owning_bu = $1`
      : `SELECT dependent_entity, depends_on_entity, dependency_type
         FROM entity_dependencies`;

    const deps = await this.db.query(depQuery, scopeBu ? [scopeBu] : []);

    // Build Mermaid flowchart
    let mermaid = `%%{init: {'theme': 'base'}}%%
flowchart TB
    %% Entity Dependency Graph${scopeBu ? ` - ${scopeBu}` : ''}
`;

    // Group entities by BU
    const byBu: Record<string, any[]> = {};
    for (const e of entities) {
      if (!byBu[e.owning_bu]) byBu[e.owning_bu] = [];
      byBu[e.owning_bu].push(e);
    }

    // Create subgraphs for each BU
    for (const [bu, entList] of Object.entries(byBu)) {
      const sanitizedBu = bu.replace(/-/g, '_');
      mermaid += `\n    subgraph ${sanitizedBu}["${bu}"]\n`;

      for (const e of entList) {
        const nodeId = e.entity_name.replace(/[^a-zA-Z0-9]/g, '_');
        const shape = e.is_foundation ? `([${e.entity_name}])` : `[${e.entity_name}]`;
        mermaid += `        ${nodeId}${shape}\n`;
      }

      mermaid += `    end\n`;
    }

    // Add dependency edges
    mermaid += '\n    %% Dependencies\n';
    for (const d of deps) {
      const from = d.dependent_entity.replace(/[^a-zA-Z0-9]/g, '_');
      const to = d.depends_on_entity.replace(/[^a-zA-Z0-9]/g, '_');
      const style = d.dependency_type === 'optional' ? '-.->' : '-->';
      mermaid += `    ${from} ${style} ${to}\n`;
    }

    return {
      type: 'entity-dag',
      scope: scopeBu,
      mermaidSource: mermaid,
      version: await this.getNextVersion('entity-dag', scopeBu),
      generatedAt: new Date(),
      sourceHash: this.hash(mermaid),
    };
  }

  // ==========================================================================
  // ERD per BU
  // ==========================================================================

  private async generateERD(buCode: string): Promise<GeneratedDiagram> {
    // Get entities and columns for this BU
    const entities = await this.db.query(`
      SELECT entity_name, entity_type, description
      FROM entity_registry
      WHERE owning_bu = $1
      ORDER BY entity_name
    `, [buCode]);

    const columns = await this.db.query(`
      SELECT column_name, semantic_type, references_table, data_type, defined_in_table
      FROM column_semantic_registry
      WHERE defined_by_bu = $1
      ORDER BY defined_in_table, column_name
    `, [buCode]);

    // Build Mermaid ER diagram
    let mermaid = `erDiagram
    %% ERD for ${buCode}
`;

    // Define entities
    for (const e of entities) {
      mermaid += `\n    ${e.entity_name} {\n`;

      // Find columns for this entity
      const entityCols = columns.filter((c: any) => c.defined_in_table === e.entity_name);
      for (const col of entityCols) {
        const type = col.data_type.toUpperCase().replace(/\s+/g, '_');
        const pk = col.semantic_type === 'pk' ? 'PK' : '';
        const fk = col.semantic_type === 'fk' ? 'FK' : '';
        const marker = pk || fk || '';
        mermaid += `        ${type} ${col.column_name} ${marker}\n`;
      }

      mermaid += `    }\n`;
    }

    // Add relationships based on FK columns
    const fkColumns = columns.filter((c: any) => c.semantic_type === 'fk' && c.references_table);
    for (const fk of fkColumns) {
      // Check if both tables exist in this BU
      const fromExists = entities.some((e: any) => e.entity_name === fk.defined_in_table);
      const toExists = entities.some((e: any) => e.entity_name === fk.references_table);

      if (fromExists && toExists) {
        mermaid += `\n    ${fk.references_table} ||--o{ ${fk.defined_in_table} : "${fk.column_name}"`;
      }
    }

    return {
      type: 'erd',
      scope: buCode,
      mermaidSource: mermaid,
      version: await this.getNextVersion('erd', buCode),
      generatedAt: new Date(),
      sourceHash: this.hash(mermaid),
    };
  }

  // ==========================================================================
  // Cross-BU Impact
  // ==========================================================================

  private async generateCrossBuImpact(): Promise<GeneratedDiagram> {
    // Get cross-BU dependencies with counts
    const crossBu = await this.db.query(`
      SELECT
        e1.owning_bu as from_bu,
        e2.owning_bu as to_bu,
        COUNT(*) as dep_count
      FROM entity_dependencies d
      JOIN entity_registry e1 ON d.dependent_entity = e1.entity_name
      JOIN entity_registry e2 ON d.depends_on_entity = e2.entity_name
      WHERE e1.owning_bu != e2.owning_bu
      GROUP BY e1.owning_bu, e2.owning_bu
      ORDER BY dep_count DESC
    `);

    // Build Mermaid sankey-like diagram using flowchart
    let mermaid = `%%{init: {'theme': 'base'}}%%
flowchart LR
    %% Cross-BU Dependency Impact
`;

    // Get all BUs
    const bus = await this.db.query(`SELECT code FROM business_units WHERE is_active = TRUE`);

    // Define BU nodes
    for (const bu of bus) {
      const nodeId = bu.code.replace(/-/g, '_');
      mermaid += `    ${nodeId}["${bu.code}"]\n`;
    }

    mermaid += '\n    %% Cross-BU Dependencies (count as label)\n';

    // Add weighted edges
    for (const rel of crossBu) {
      const from = rel.from_bu.replace(/-/g, '_');
      const to = rel.to_bu.replace(/-/g, '_');
      const weight = rel.dep_count;
      mermaid += `    ${from} -->|${weight}| ${to}\n`;
    }

    return {
      type: 'cross-bu-impact',
      mermaidSource: mermaid,
      version: await this.getNextVersion('cross-bu-impact'),
      generatedAt: new Date(),
      sourceHash: this.hash(mermaid),
    };
  }

  // ==========================================================================
  // Phase Workflow
  // ==========================================================================

  private async generatePhaseWorkflow(): Promise<GeneratedDiagram> {
    // Get phases
    const phases = await this.db.query(`
      SELECT code, name, phase_type, is_terminal, wip_limit
      FROM sdlc_phases
      WHERE is_active = TRUE
      ORDER BY display_order
    `);

    // Get transitions
    const transitions = await this.db.query(`
      SELECT from_phase, to_phase, requires_approval
      FROM phase_transitions
    `);

    // Build Mermaid state diagram
    let mermaid = `stateDiagram-v2
    %% SDLC Phase Workflow

    [*] --> backlog
`;

    // Add states
    for (const p of phases) {
      const desc = p.wip_limit ? ` (WIP: ${p.wip_limit})` : '';
      mermaid += `    ${p.code}: ${p.name}${desc}\n`;
    }

    mermaid += '\n';

    // Add transitions
    for (const t of transitions) {
      const arrow = t.requires_approval ? '-->' : '-->';
      const note = t.requires_approval ? ' : [approval]' : '';
      mermaid += `    ${t.from_phase} ${arrow} ${t.to_phase}${note}\n`;
    }

    // Terminal states
    const terminals = phases.filter((p: any) => p.is_terminal);
    for (const t of terminals) {
      mermaid += `    ${t.code} --> [*]\n`;
    }

    return {
      type: 'phase-workflow',
      mermaidSource: mermaid,
      version: await this.getNextVersion('phase-workflow'),
      generatedAt: new Date(),
      sourceHash: this.hash(mermaid),
    };
  }

  // ==========================================================================
  // Database Operations
  // ==========================================================================

  private async saveDiagram(diagram: GeneratedDiagram): Promise<void> {
    const diagramKey = diagram.scope
      ? `${diagram.type}-${diagram.scope}`
      : diagram.type;

    await this.db.query(`
      INSERT INTO architecture_diagrams
        (diagram_key, name, diagram_type, scope_type, scope_value, mermaid_source, generated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (diagram_key)
      DO UPDATE SET
        mermaid_source = EXCLUDED.mermaid_source,
        generated_at = EXCLUDED.generated_at,
        last_regenerated_at = NOW()
    `, [
      diagramKey,
      diagramKey,  // Use diagram key as name
      diagram.type,
      diagram.scope ? 'bu' : 'system',
      diagram.scope || null,
      diagram.mermaidSource,
      diagram.generatedAt,
    ]);
  }

  private async getNextVersion(type: DiagramType, scope?: string): Promise<number> {
    const diagramKey = scope ? `${type}-${scope}` : type;
    const result = await this.db.query(`
      SELECT COUNT(*) + 1 as next_version
      FROM diagram_versions dv
      JOIN architecture_diagrams ad ON dv.diagram_id = ad.id
      WHERE ad.diagram_key = $1
    `, [diagramKey]);

    return result[0]?.next_version || 1;
  }

  private hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
}
