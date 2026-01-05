/**
 * SDLC Control Types
 */

// Business Unit
export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  description: string;
  modules: string[];
  color: string;
  isActive: boolean;
}

// Entity Registry
export interface EntityRegistryEntry {
  id: string;
  entityName: string;
  owningBu: string;
  entityType: 'master' | 'transactional' | 'lookup' | 'audit';
  isFoundation: boolean;
  description?: string;
  createdAt: string;
}

export interface EntityDependency {
  id: string;
  dependentEntity: string;
  dependsOnEntity: string;
  dependencyType: 'required' | 'optional' | 'soft';
  reason?: string;
}

// Execution Plan
export interface ExecutionStep {
  entity: string;
  bu: string;
  level: number;
  status?: string;
}

export interface ExecutionPlan {
  order: ExecutionStep[];
  parallelGroups: ExecutionStep[][];
}

// SDLC Phases
export interface SDLCPhase {
  code: string;
  name: string;
  phaseType: 'initial' | 'development' | 'review' | 'terminal';
  isTerminal: boolean;
  wipLimit?: number;
  displayOrder: number;
  color: string;
}

// Owner Requests
export interface OwnerRequest {
  id: string;
  reqNumber: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  primaryBu: string;
  currentPhase: string;
  estimatedEffort?: string;
  affectedEntities: RequestEntityScope[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface RequestEntityScope {
  entityName: string;
  changeType: 'create' | 'modify' | 'delete' | 'read';
  executionOrder?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

// Column Semantic Registry
export interface ColumnSemanticEntry {
  id: string;
  columnName: string;
  semanticType: 'pk' | 'fk' | 'attribute' | 'audit' | 'status';
  referencesTable?: string;
  referencesColumn?: string;
  dataType: string;
  definedByBu: string;
  definedInTable: string;
  semanticDescription: string;
  validUsageExamples?: string[];
  createdAt: string;
}

// Diagrams
export type DiagramType = 'c4-context' | 'entity-dag' | 'erd' | 'cross-bu-impact' | 'phase-workflow';

export interface GeneratedDiagram {
  type: DiagramType;
  scope?: string;
  mermaidSource: string;
  version: number;
  generatedAt: string;
  sourceHash: string;
}

// Health Status
export interface SDLCHealthStatus {
  database: boolean;
  nats: boolean;
  lastCheck: string;
  entityCount: number;
  phaseCount: number;
  columnCount: number;
}

// Impact Analysis
export interface ImpactAnalysis {
  entity: string;
  impactedEntities: string[];
  crossBuImpacts: { bu: string; entities: string[] }[];
}

// Kanban Board
export interface KanbanColumn {
  phaseCode: string;
  phaseName: string;
  wipLimit?: number;
  requests: OwnerRequest[];
  count: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
