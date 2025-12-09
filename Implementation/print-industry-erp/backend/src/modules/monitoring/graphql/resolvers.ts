/**
 * Monitoring GraphQL Resolvers
 * Handles system health, error tracking, and agent activity monitoring
 */

import { Pool } from 'pg';
import { HealthMonitorService } from '../services/health-monitor.service';
import { ErrorTrackingService } from '../services/error-tracking.service';
import { AgentActivityService } from '../services/agent-activity.service';
import { ActiveFixesService } from '../services/active-fixes.service';
import { OrchestratorService } from '../../../orchestration/orchestrator.service';
import { AuthContext } from '../../auth/middleware/jwt.middleware';

export interface MonitoringGraphQLContext {
  pool: Pool;
  auth: AuthContext;
  healthMonitor: HealthMonitorService;
  errorTracking: ErrorTrackingService;
  agentActivity: AgentActivityService;
  activeFixes: ActiveFixesService;
  orchestrator: OrchestratorService;
}

export const monitoringResolvers = {
  Query: {
    /**
     * Get current system health
     */
    systemHealth: async (_: any, __: any, context: MonitoringGraphQLContext) => {
      const health = await context.healthMonitor.checkSystemHealth();
      return health;
    },

    /**
     * Get component health history
     */
    healthHistory: async (
      _: any,
      { component, startTime, endTime }: any,
      context: MonitoringGraphQLContext
    ) => {
      return await context.healthMonitor.getHealthHistory(
        component,
        new Date(startTime),
        new Date(endTime)
      );
    },

    /**
     * Get system errors
     */
    systemErrors: async (
      _: any,
      { severity, status, component, limit = 50, offset = 0 }: any,
      context: MonitoringGraphQLContext
    ) => {
      return await context.errorTracking.getErrors({
        severity,
        status,
        component,
        limit,
        offset,
      });
    },

    /**
     * Get error by ID
     */
    systemError: async (_: any, { id }: any, context: MonitoringGraphQLContext) => {
      return await context.errorTracking.getErrorById(id);
    },

    /**
     * Get active agent activities
     */
    agentActivities: async (_: any, __: any, context: MonitoringGraphQLContext) => {
      return await context.agentActivity.getAllActivities();
    },

    /**
     * Get agent activity by agent ID
     */
    agentActivity: async (_: any, { agentId }: any, context: MonitoringGraphQLContext) => {
      return await context.agentActivity.getActivityByAgentId(agentId);
    },

    /**
     * Get active fixes from OWNER_REQUESTS.md
     */
    activeFixes: async (
      _: any,
      { owner, status, priority }: any,
      context: MonitoringGraphQLContext
    ) => {
      return await context.activeFixes.getActiveFixes({
        owner,
        status,
        priority,
      });
    },

    /**
     * Get fix by request number
     */
    activeFix: async (_: any, { reqNumber }: any, context: MonitoringGraphQLContext) => {
      return await context.activeFixes.getFixByReqNumber(reqNumber);
    },

    /**
     * Get feature workflows
     */
    featureWorkflows: async (
      _: any,
      { status, assignedTo }: any,
      context: MonitoringGraphQLContext
    ) => {
      const workflows = Array.from(context.orchestrator['workflows'].values());

      return workflows.filter((workflow) => {
        if (status && workflow.status !== status.toLowerCase()) return false;
        if (assignedTo && workflow.assignedTo !== assignedTo.toLowerCase()) return false;
        return true;
      });
    },

    /**
     * Get workflow by request number
     */
    featureWorkflow: async (
      _: any,
      { reqNumber }: any,
      context: MonitoringGraphQLContext
    ) => {
      return await context.orchestrator.getWorkflowStatus(reqNumber);
    },

    /**
     * Get monitoring statistics
     */
    monitoringStats: async (_: any, __: any, context: MonitoringGraphQLContext) => {
      const [errors, agentActivities, workflows] = await Promise.all([
        context.errorTracking.getStats(),
        context.agentActivity.getStats(),
        context.orchestrator.getStats(),
      ]);

      return {
        openErrors: errors.openErrors,
        criticalErrors24h: errors.criticalErrors24h,
        activeAgents: agentActivities.activeAgents,
        avgWorkflowDuration: workflows.avgDuration,
        uptimePercentage: 99.5, // TODO: Calculate from health history
        completedWorkflows: workflows.completedWorkflows,
      };
    },
  },

  Mutation: {
    /**
     * Update error status
     */
    updateErrorStatus: async (
      _: any,
      { id, status, assignedTo, resolutionNotes }: any,
      context: MonitoringGraphQLContext
    ) => {
      return await context.errorTracking.updateErrorStatus(
        id,
        status,
        assignedTo,
        resolutionNotes
      );
    },

    /**
     * Mark error as resolved
     */
    resolveError: async (
      _: any,
      { id, resolvedBy, resolutionNotes }: any,
      context: MonitoringGraphQLContext
    ) => {
      return await context.errorTracking.resolveError(id, resolvedBy, resolutionNotes);
    },

    /**
     * Create manual error entry
     */
    createError: async (
      _: any,
      { severity, message, component, stackTrace, userId, tenantId, metadata }: any,
      context: MonitoringGraphQLContext
    ) => {
      return await context.errorTracking.createError({
        severity,
        message,
        component,
        stackTrace,
        userId,
        tenantId,
        metadata,
      });
    },
  },

  Subscription: {
    /**
     * Subscribe to system health updates
     */
    systemHealthUpdated: {
      subscribe: async (
        _: any,
        __: any,
        context: MonitoringGraphQLContext & { pubsub: any }
      ) => {
        return context.pubsub.asyncIterator(['SYSTEM_HEALTH_UPDATED']);
      },
    },

    /**
     * Subscribe to new errors
     */
    errorCreated: {
      subscribe: async (
        _: any,
        { severity }: any,
        context: MonitoringGraphQLContext & { pubsub: any }
      ) => {
        if (severity) {
          return context.pubsub.asyncIterator([`ERROR_CREATED_${severity}`]);
        }
        return context.pubsub.asyncIterator(['ERROR_CREATED']);
      },
    },

    /**
     * Subscribe to error status changes
     */
    errorUpdated: {
      subscribe: async (
        _: any,
        { id }: any,
        context: MonitoringGraphQLContext & { pubsub: any }
      ) => {
        if (id) {
          return context.pubsub.asyncIterator([`ERROR_UPDATED_${id}`]);
        }
        return context.pubsub.asyncIterator(['ERROR_UPDATED']);
      },
    },

    /**
     * Subscribe to agent activity updates
     */
    agentActivityUpdated: {
      subscribe: async (
        _: any,
        { agentId }: any,
        context: MonitoringGraphQLContext & { pubsub: any }
      ) => {
        if (agentId) {
          return context.pubsub.asyncIterator([`AGENT_ACTIVITY_${agentId}`]);
        }
        return context.pubsub.asyncIterator(['AGENT_ACTIVITY_UPDATED']);
      },
    },

    /**
     * Subscribe to workflow updates
     */
    workflowUpdated: {
      subscribe: async (
        _: any,
        { reqNumber }: any,
        context: MonitoringGraphQLContext & { pubsub: any }
      ) => {
        if (reqNumber) {
          return context.pubsub.asyncIterator([`WORKFLOW_${reqNumber}`]);
        }
        return context.pubsub.asyncIterator(['WORKFLOW_UPDATED']);
      },
    },
  },
};
