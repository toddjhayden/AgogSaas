/**
 * SDLC Control Module
 *
 * Unified control system for PMLC/SDLC with:
 * - Entity Dependency Graph (DAG-based ordering)
 * - Kanban workflow management
 * - Column semantic governance
 * - Cross-BU impact analysis
 * - Git sync for version control
 */

// Database
export { SDLCDatabaseService, getSDLCDatabase } from './sdlc-database.service';

// Entity Dependency Graph
export {
  EntityDependencyService,
  EntityRegistryEntry,
  EntityDependency,
  ExecutionStep,
  ExecutionPlan,
  DependencyGraphNode,
  CycleDetectionResult,
} from './entity-dependency.service';

// Phase Management
export {
  PhaseManagerService,
  SDLCPhase,
  PhaseTransition,
  TransitionValidation,
  PhaseStats,
} from './phase-manager.service';

// Column Semantic Governance
export {
  ColumnSemanticService,
  ColumnSemanticEntry,
  ColumnValidationResult,
  ColumnDefinition,
} from './column-semantic.service';

// Git Sync
export {
  GitSyncService,
  GitSyncConfig,
  SyncStats,
} from './git-sync.service';

// Diagram Generation
export {
  DiagramGeneratorService,
  DiagramType,
  GeneratedDiagram,
} from './diagram-generator.service';

// Main Daemon
export {
  SDLCControlDaemon,
  SDLCControlConfig,
  SDLCHealthStatus,
} from './sdlc-control.daemon';
