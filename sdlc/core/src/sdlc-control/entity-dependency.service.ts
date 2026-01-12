/**
 * Entity Dependency Service
 * Manages the Entity Dependency Graph (DAG) for execution order computation
 *
 * Key features:
 * - Register entities with owning BU
 * - Add/remove dependencies between entities
 * - Compute execution order via topological sort
 * - Detect circular dependencies
 * - Analyze cross-BU impacts
 */

import { getSDLCDatabase, SDLCDatabaseService } from './sdlc-database.service';

// ============================================================================
// Types
// ============================================================================

export interface EntityRegistryEntry {
  id: string;
  entityName: string;
  owningBu: string;
  entityType: 'master' | 'transactional' | 'lookup' | 'junction' | 'audit' | 'detail';
  isFoundation: boolean;
  description: string | null;
  createdAt: Date;
  createdByAgent: string | null;
}

export interface EntityDependency {
  id: string;
  dependentEntity: string;
  dependsOnEntity: string;
  dependencyType: 'required' | 'optional' | 'soft';
  reason: string | null;
  createdAt: Date;
}

export interface ExecutionStep {
  entity: string;
  bu: string;
  level: number;
  entityType: string;
}

export interface ExecutionPlan {
  order: ExecutionStep[];
  parallelGroups: ExecutionStep[][];
  totalEntities: number;
  maxDepth: number;
}

export interface DependencyGraphNode {
  entity: string;
  bu: string;
  dependencies: string[];
  dependents: string[];
}

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: string[][];
}

// ============================================================================
// Service
// ============================================================================

export class EntityDependencyService {
  private db: SDLCDatabaseService;

  constructor() {
    this.db = getSDLCDatabase();
  }

  // ==========================================================================
  // Entity Registry Operations
  // ==========================================================================

  /**
   * Register a new entity
   */
  async registerEntity(entity: {
    entityName: string;
    owningBu: string;
    entityType: EntityRegistryEntry['entityType'];
    isFoundation?: boolean;
    description?: string;
    createdByAgent?: string;
  }): Promise<EntityRegistryEntry> {
    const query = `
      INSERT INTO entity_registry (entity_name, owning_bu, entity_type, is_foundation, description, created_by_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (entity_name) DO UPDATE SET
        owning_bu = EXCLUDED.owning_bu,
        entity_type = EXCLUDED.entity_type,
        is_foundation = EXCLUDED.is_foundation,
        description = EXCLUDED.description
      RETURNING *
    `;

    const result = await this.db.queryOne<any>(query, [
      entity.entityName,
      entity.owningBu,
      entity.entityType,
      entity.isFoundation || false,
      entity.description || null,
      entity.createdByAgent || 'system',
    ]);

    console.log(`[EntityDependency] Registered entity: ${entity.entityName} (${entity.owningBu})`);

    return this.mapEntityRow(result);
  }

  /**
   * Get entity by name
   */
  async getEntity(entityName: string): Promise<EntityRegistryEntry | null> {
    const query = 'SELECT * FROM entity_registry WHERE entity_name = $1';
    const result = await this.db.queryOne<any>(query, [entityName]);
    return result ? this.mapEntityRow(result) : null;
  }

  /**
   * Get all entities
   */
  async getAllEntities(): Promise<EntityRegistryEntry[]> {
    const query = 'SELECT * FROM entity_registry ORDER BY owning_bu, entity_name';
    const results = await this.db.query<any>(query);
    return results.map(this.mapEntityRow);
  }

  /**
   * Get entities by business unit
   */
  async getEntitiesByBu(buCode: string): Promise<EntityRegistryEntry[]> {
    const query = 'SELECT * FROM entity_registry WHERE owning_bu = $1 ORDER BY entity_name';
    const results = await this.db.query<any>(query, [buCode]);
    return results.map(this.mapEntityRow);
  }

  /**
   * Get foundation entities (no dependencies)
   */
  async getFoundationEntities(): Promise<EntityRegistryEntry[]> {
    const query = 'SELECT * FROM entity_registry WHERE is_foundation = TRUE ORDER BY entity_name';
    const results = await this.db.query<any>(query);
    return results.map(this.mapEntityRow);
  }

  // ==========================================================================
  // Dependency Operations
  // ==========================================================================

  /**
   * Add a dependency between entities
   */
  async addDependency(dependency: {
    dependentEntity: string;
    dependsOnEntity: string;
    dependencyType: EntityDependency['dependencyType'];
    reason?: string;
  }): Promise<EntityDependency> {
    // Validate entities exist
    const [dependent, dependsOn] = await Promise.all([
      this.getEntity(dependency.dependentEntity),
      this.getEntity(dependency.dependsOnEntity),
    ]);

    if (!dependent) {
      throw new Error(`Entity not found: ${dependency.dependentEntity}`);
    }
    if (!dependsOn) {
      throw new Error(`Entity not found: ${dependency.dependsOnEntity}`);
    }

    // Check for self-loop
    if (dependency.dependentEntity === dependency.dependsOnEntity) {
      throw new Error(`Self-loop not allowed: ${dependency.dependentEntity}`);
    }

    // Check if this would create a cycle
    const wouldCreateCycle = await this.wouldCreateCycle(
      dependency.dependentEntity,
      dependency.dependsOnEntity
    );
    if (wouldCreateCycle) {
      throw new Error(
        `Cycle detected: Adding ${dependency.dependentEntity} → ${dependency.dependsOnEntity} would create a circular dependency`
      );
    }

    const query = `
      INSERT INTO entity_dependencies (dependent_entity, depends_on_entity, dependency_type, reason)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (dependent_entity, depends_on_entity) DO UPDATE SET
        dependency_type = EXCLUDED.dependency_type,
        reason = EXCLUDED.reason
      RETURNING *
    `;

    const result = await this.db.queryOne<any>(query, [
      dependency.dependentEntity,
      dependency.dependsOnEntity,
      dependency.dependencyType,
      dependency.reason || null,
    ]);

    console.log(
      `[EntityDependency] Added dependency: ${dependency.dependentEntity} → ${dependency.dependsOnEntity} (${dependency.dependencyType})`
    );

    return this.mapDependencyRow(result);
  }

  /**
   * Remove a dependency
   */
  async removeDependency(dependentEntity: string, dependsOnEntity: string): Promise<boolean> {
    const query = `
      DELETE FROM entity_dependencies
      WHERE dependent_entity = $1 AND depends_on_entity = $2
      RETURNING id
    `;

    const result = await this.db.queryOne<any>(query, [dependentEntity, dependsOnEntity]);
    return result !== null;
  }

  /**
   * Get dependencies for an entity (what it depends on)
   */
  async getDependencies(entityName: string): Promise<EntityDependency[]> {
    const query = `
      SELECT * FROM entity_dependencies
      WHERE dependent_entity = $1
      ORDER BY depends_on_entity
    `;
    const results = await this.db.query<any>(query, [entityName]);
    return results.map(this.mapDependencyRow);
  }

  /**
   * Get dependents of an entity (what depends on it)
   */
  async getDependents(entityName: string): Promise<EntityDependency[]> {
    const query = `
      SELECT * FROM entity_dependencies
      WHERE depends_on_entity = $1
      ORDER BY dependent_entity
    `;
    const results = await this.db.query<any>(query, [entityName]);
    return results.map(this.mapDependencyRow);
  }

  /**
   * Get full dependency graph
   */
  async getDependencyGraph(): Promise<DependencyGraphNode[]> {
    const entities = await this.getAllEntities();
    const dependencies = await this.db.query<any>('SELECT * FROM entity_dependencies');

    const graph: Map<string, DependencyGraphNode> = new Map();

    // Initialize nodes
    for (const entity of entities) {
      graph.set(entity.entityName, {
        entity: entity.entityName,
        bu: entity.owningBu,
        dependencies: [],
        dependents: [],
      });
    }

    // Add edges
    for (const dep of dependencies) {
      const node = graph.get(dep.dependent_entity);
      if (node) {
        node.dependencies.push(dep.depends_on_entity);
      }

      const targetNode = graph.get(dep.depends_on_entity);
      if (targetNode) {
        targetNode.dependents.push(dep.dependent_entity);
      }
    }

    return Array.from(graph.values());
  }

  // ==========================================================================
  // Topological Sort & Execution Order
  // ==========================================================================

  /**
   * Compute execution order for a set of entities using topological sort
   * Returns entities grouped by level (entities at same level can run in parallel)
   */
  async computeExecutionOrder(entityNames: string[]): Promise<ExecutionPlan> {
    // Get all entities and their dependencies
    const allEntities = await this.getAllEntities();
    const allDependencies = await this.db.query<any>('SELECT * FROM entity_dependencies');

    // Build entity map for quick lookup
    const entityMap = new Map(allEntities.map((e) => [e.entityName, e]));

    // Build adjacency list (entity → dependencies)
    const dependsOn = new Map<string, Set<string>>();
    for (const entity of allEntities) {
      dependsOn.set(entity.entityName, new Set());
    }
    for (const dep of allDependencies) {
      const deps = dependsOn.get(dep.dependent_entity);
      if (deps) {
        deps.add(dep.depends_on_entity);
      }
    }

    // Find all transitive dependencies for requested entities
    const requiredEntities = new Set<string>();
    const stack = [...entityNames];

    while (stack.length > 0) {
      const entity = stack.pop()!;
      if (requiredEntities.has(entity)) continue;
      if (!entityMap.has(entity)) continue;

      requiredEntities.add(entity);
      const deps = dependsOn.get(entity) || new Set();
      for (const dep of deps) {
        stack.push(dep);
      }
    }

    // Kahn's algorithm for topological sort with levels
    const inDegree = new Map<string, number>();
    const subgraphDeps = new Map<string, Set<string>>();

    for (const entity of requiredEntities) {
      const deps = dependsOn.get(entity) || new Set();
      const filteredDeps = new Set([...deps].filter((d) => requiredEntities.has(d)));
      subgraphDeps.set(entity, filteredDeps);
      inDegree.set(entity, filteredDeps.size);
    }

    // Group by levels
    const levels: ExecutionStep[][] = [];
    let remaining = new Set(requiredEntities);

    while (remaining.size > 0) {
      // Find all entities with in-degree 0
      const currentLevel: ExecutionStep[] = [];

      for (const entity of remaining) {
        if ((inDegree.get(entity) || 0) === 0) {
          const entityData = entityMap.get(entity)!;
          currentLevel.push({
            entity,
            bu: entityData.owningBu,
            level: levels.length,
            entityType: entityData.entityType,
          });
        }
      }

      if (currentLevel.length === 0 && remaining.size > 0) {
        // Cycle detected - should not happen if we validated correctly
        throw new Error('Cycle detected in dependency graph');
      }

      // Remove processed entities and update in-degrees
      for (const step of currentLevel) {
        remaining.delete(step.entity);

        // Decrease in-degree of dependents
        for (const entity of remaining) {
          const deps = subgraphDeps.get(entity);
          if (deps && deps.has(step.entity)) {
            inDegree.set(entity, (inDegree.get(entity) || 1) - 1);
          }
        }
      }

      levels.push(currentLevel);
    }

    // Flatten to ordered list
    const order = levels.flat();

    return {
      order,
      parallelGroups: levels,
      totalEntities: order.length,
      maxDepth: levels.length,
    };
  }

  /**
   * Get execution order for all entities
   */
  async computeFullExecutionOrder(): Promise<ExecutionPlan> {
    const entities = await this.getAllEntities();
    return this.computeExecutionOrder(entities.map((e) => e.entityName));
  }

  // ==========================================================================
  // Cycle Detection
  // ==========================================================================

  /**
   * Check if adding a dependency would create a cycle
   */
  async wouldCreateCycle(dependent: string, dependsOn: string): Promise<boolean> {
    // If we add dependent → dependsOn, check if dependsOn can reach dependent
    const visited = new Set<string>();
    const stack = [dependsOn];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === dependent) {
        return true; // Found a path back to dependent
      }

      if (visited.has(current)) continue;
      visited.add(current);

      // Get what current depends on
      const deps = await this.getDependencies(current);
      for (const dep of deps) {
        stack.push(dep.dependsOnEntity);
      }
    }

    return false;
  }

  /**
   * Detect all cycles in the graph
   */
  async detectCycles(): Promise<CycleDetectionResult> {
    const entities = await this.getAllEntities();
    const dependencies = await this.db.query<any>('SELECT * FROM entity_dependencies');

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const entity of entities) {
      graph.set(entity.entityName, []);
    }
    for (const dep of dependencies) {
      const list = graph.get(dep.dependent_entity);
      if (list) {
        list.push(dep.depends_on_entity);
      }
    }

    // DFS to find cycles
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();
    const cycles: string[][] = [];

    for (const entity of entities) {
      color.set(entity.entityName, WHITE);
      parent.set(entity.entityName, null);
    }

    const dfs = (node: string): void => {
      color.set(node, GRAY);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (color.get(neighbor) === GRAY) {
          // Back edge found - reconstruct cycle
          const cycle: string[] = [neighbor];
          let current = node;
          while (current !== neighbor) {
            cycle.push(current);
            current = parent.get(current) || neighbor;
          }
          cycle.push(neighbor);
          cycles.push(cycle.reverse());
        } else if (color.get(neighbor) === WHITE) {
          parent.set(neighbor, node);
          dfs(neighbor);
        }
      }

      color.set(node, BLACK);
    };

    for (const entity of entities) {
      if (color.get(entity.entityName) === WHITE) {
        dfs(entity.entityName);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles,
    };
  }

  // ==========================================================================
  // Cross-BU Impact Analysis
  // ==========================================================================

  /**
   * Get entities that would be impacted by changes to a given entity
   */
  async getImpactedEntities(entityName: string): Promise<{
    direct: EntityRegistryEntry[];
    transitive: EntityRegistryEntry[];
    crossBu: EntityRegistryEntry[];
  }> {
    const sourceEntity = await this.getEntity(entityName);
    if (!sourceEntity) {
      throw new Error(`Entity not found: ${entityName}`);
    }

    const visited = new Set<string>();
    const directDependents: EntityRegistryEntry[] = [];
    const transitiveDependents: EntityRegistryEntry[] = [];

    // BFS to find all dependents
    const queue: { entity: string; depth: number }[] = [{ entity: entityName, depth: 0 }];

    while (queue.length > 0) {
      const { entity, depth } = queue.shift()!;

      if (visited.has(entity)) continue;
      visited.add(entity);

      const dependents = await this.getDependents(entity);
      for (const dep of dependents) {
        const dependentEntity = await this.getEntity(dep.dependentEntity);
        if (!dependentEntity) continue;

        if (depth === 0) {
          directDependents.push(dependentEntity);
        } else {
          transitiveDependents.push(dependentEntity);
        }

        queue.push({ entity: dep.dependentEntity, depth: depth + 1 });
      }
    }

    // Filter cross-BU impacts
    const crossBu = [...directDependents, ...transitiveDependents].filter(
      (e) => e.owningBu !== sourceEntity.owningBu
    );

    return {
      direct: directDependents,
      transitive: transitiveDependents,
      crossBu,
    };
  }

  /**
   * Get cross-BU dependency matrix
   */
  async getCrossBuMatrix(): Promise<Map<string, Map<string, number>>> {
    const query = `
      SELECT
        e1.owning_bu as from_bu,
        e2.owning_bu as to_bu,
        COUNT(*) as count
      FROM entity_dependencies d
      JOIN entity_registry e1 ON e1.entity_name = d.dependent_entity
      JOIN entity_registry e2 ON e2.entity_name = d.depends_on_entity
      WHERE e1.owning_bu != e2.owning_bu
      GROUP BY e1.owning_bu, e2.owning_bu
      ORDER BY from_bu, to_bu
    `;

    const results = await this.db.query<any>(query);
    const matrix = new Map<string, Map<string, number>>();

    for (const row of results) {
      if (!matrix.has(row.from_bu)) {
        matrix.set(row.from_bu, new Map());
      }
      matrix.get(row.from_bu)!.set(row.to_bu, parseInt(row.count));
    }

    return matrix;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapEntityRow(row: any): EntityRegistryEntry {
    return {
      id: row.id,
      entityName: row.entity_name,
      owningBu: row.owning_bu,
      entityType: row.entity_type,
      isFoundation: row.is_foundation,
      description: row.description,
      createdAt: row.created_at,
      createdByAgent: row.created_by_agent,
    };
  }

  private mapDependencyRow(row: any): EntityDependency {
    return {
      id: row.id,
      dependentEntity: row.dependent_entity,
      dependsOnEntity: row.depends_on_entity,
      dependencyType: row.dependency_type,
      reason: row.reason,
      createdAt: row.created_at,
    };
  }
}
