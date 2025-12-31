/**
 * GraphQL Queries - Central Export
 *
 * This file re-exports all GraphQL queries from various modules
 * to provide a single import point for components.
 */

// ============================================
// MONITORING QUERIES
// ============================================
export {
  // Queries
  GET_SYSTEM_HEALTH,
  GET_SYSTEM_ERRORS,
  GET_ACTIVE_FIXES,
  GET_AGENT_ACTIVITIES,
  GET_AGENT_ACTIVITY,
  GET_FEATURE_WORKFLOWS,
  GET_MONITORING_STATS,

  // Subscriptions
  SUBSCRIBE_SYSTEM_HEALTH,
  SUBSCRIBE_ERROR_CREATED,
  SUBSCRIBE_AGENT_ACTIVITY,

  // Orchestrator Monitoring (REQ-PROACTIVE-001)
  GET_ACTIVE_WORKFLOWS,
  GET_STRATEGIC_DECISIONS,
  GET_ESCALATION_QUEUE,
  GET_SYSTEM_HEALTH_ORCHESTRATOR,

  // Orchestrator Control Mutations (REQ-PROACTIVE-001)
  RESET_CIRCUIT_BREAKER,
  PAUSE_DAEMON,
  RESUME_DAEMON,
  ROLLBACK_WORKFLOW,
} from '../monitoringQueries';

// ============================================
// MODULE QUERIES
// ============================================
export * from './kpis';
export * from './operations';
export * from './wms';
export * from './finance';
export * from './quality';
export * from './marketplace';
export * from './codeQuality';
export * from './supplierPortal';
export * from './quoteCollaboration';
export * from './salesQuoteAutomation';
