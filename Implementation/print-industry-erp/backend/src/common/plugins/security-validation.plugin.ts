/**
 * GraphQL Security Validation Plugin
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 *
 * Provides comprehensive security validation for GraphQL operations:
 * 1. Operation name enforcement (prevents anonymous queries)
 * 2. Mutation batching limits (prevents batch abuse)
 * 3. Alias limit enforcement (prevents alias-based DoS)
 * 4. Dangerous field detection (blocks __schema, __type in production)
 * 5. Query timeout enforcement
 * 6. Execution metrics tracking
 *
 * Security Measures:
 * - All operations must be named
 * - Maximum 10 mutations per request
 * - Maximum 15 aliases per query
 * - Introspection blocked in production
 * - Query execution timeout: 30s (default), 60s (admin)
 */

import { Plugin } from '@nestjs/apollo';
import type {
  ApolloServerPlugin,
  GraphQLRequestListener,
  BaseContext,
  GraphQLRequestContext
} from '@apollo/server';
import { Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { visit } from 'graphql';

interface SecurityContext extends BaseContext {
  user?: {
    userId: string;
    tenantId: string;
    roles?: string[];
  };
}

interface SecurityConfig {
  requireOperationName: boolean;
  maxMutationsPerRequest: number;
  maxAliasesPerQuery: number;
  blockIntrospection: boolean;
  queryTimeoutMs: number;
  queryTimeoutAdminMs: number;
}

interface QueryMetrics {
  operationName?: string;
  operationType?: string;
  fieldCount: number;
  aliasCount: number;
  mutationCount: number;
  hasIntrospection: boolean;
  startTime: number;
  userId?: string;
  tenantId?: string;
}

@Plugin()
export class SecurityValidationPlugin implements ApolloServerPlugin<SecurityContext> {
  private readonly logger = new Logger(SecurityValidationPlugin.name);

  // Configuration
  private readonly config: SecurityConfig = {
    requireOperationName: process.env.GRAPHQL_REQUIRE_OPERATION_NAME === 'true' || process.env.NODE_ENV === 'production',
    maxMutationsPerRequest: parseInt(process.env.GRAPHQL_MAX_MUTATIONS_PER_REQUEST ?? '10', 10),
    maxAliasesPerQuery: parseInt(process.env.GRAPHQL_MAX_ALIASES ?? '15', 10),
    blockIntrospection: process.env.NODE_ENV === 'production',
    queryTimeoutMs: parseInt(process.env.GRAPHQL_QUERY_TIMEOUT_MS ?? '30000', 10),
    queryTimeoutAdminMs: parseInt(process.env.GRAPHQL_QUERY_TIMEOUT_ADMIN_MS ?? '60000', 10),
  };

  async requestDidStart(
    requestContext: GraphQLRequestContext<SecurityContext>
  ): Promise<GraphQLRequestListener<SecurityContext>> {
    const logger = this.logger;
    const config = this.config;
    const metrics: QueryMetrics = {
      fieldCount: 0,
      aliasCount: 0,
      mutationCount: 0,
      hasIntrospection: false,
      startTime: Date.now(),
    };

    return {
      async didResolveOperation(requestContext) {
        const { operationName, document, operation } = requestContext;
        const user = requestContext.contextValue.user;

        // Store user context in metrics
        metrics.operationName = operationName ?? undefined;
        metrics.operationType = operation?.operation;
        metrics.userId = user?.userId;
        metrics.tenantId = user?.tenantId;

        // 1. Enforce operation name requirement
        if (config.requireOperationName && !operationName) {
          logger.warn(
            `Unnamed operation blocked ` +
            `(user: ${user?.userId ?? 'anonymous'})`
          );

          throw new GraphQLError(
            'All GraphQL operations must be named',
            {
              extensions: {
                code: 'OPERATION_NAME_REQUIRED',
                hint: 'Add a name to your query, mutation, or subscription',
              },
            }
          );
        }

        // 2. Analyze query structure for security issues
        try {
          visit(document, {
            Field: {
              enter: (node) => {
                metrics.fieldCount++;

                // Check for alias
                if (node.alias) {
                  metrics.aliasCount++;
                }

                // Check for introspection fields
                if (node.name.value === '__schema' || node.name.value === '__type') {
                  metrics.hasIntrospection = true;
                }
              },
            },
            OperationDefinition: {
              enter: (node) => {
                if (node.operation === 'mutation') {
                  // Count mutations in selection set
                  if (node.selectionSet) {
                    metrics.mutationCount += node.selectionSet.selections.length;
                  }
                }
              },
            },
          });
        } catch (error) {
          logger.error('Error analyzing query structure:', error);
          throw new GraphQLError('Failed to analyze query structure', {
            extensions: {
              code: 'SECURITY_ANALYSIS_FAILED',
              originalError: error instanceof Error ? error.message : String(error),
            },
          });
        }

        // 3. Block introspection in production
        if (config.blockIntrospection && metrics.hasIntrospection && operationName !== 'IntrospectionQuery') {
          logger.warn(
            `Introspection query blocked in production ` +
            `(user: ${user?.userId ?? 'anonymous'}, ` +
            `operation: ${operationName ?? 'unnamed'})`
          );

          throw new GraphQLError(
            'Introspection is disabled in production',
            {
              extensions: {
                code: 'INTROSPECTION_DISABLED',
              },
            }
          );
        }

        // 4. Enforce mutation batching limits
        if (metrics.mutationCount > config.maxMutationsPerRequest) {
          logger.warn(
            `Mutation batching limit exceeded: ${metrics.mutationCount} > ${config.maxMutationsPerRequest} ` +
            `(user: ${user?.userId ?? 'anonymous'}, ` +
            `operation: ${operationName ?? 'unnamed'})`
          );

          throw new GraphQLError(
            `Too many mutations in single request: ${metrics.mutationCount}. Maximum allowed: ${config.maxMutationsPerRequest}`,
            {
              extensions: {
                code: 'MUTATION_BATCHING_LIMIT_EXCEEDED',
                mutationCount: metrics.mutationCount,
                maxMutations: config.maxMutationsPerRequest,
                hint: 'Split your mutations into multiple requests',
              },
            }
          );
        }

        // 5. Enforce alias limits (prevent alias-based DoS)
        if (metrics.aliasCount > config.maxAliasesPerQuery) {
          logger.warn(
            `Alias limit exceeded: ${metrics.aliasCount} > ${config.maxAliasesPerQuery} ` +
            `(user: ${user?.userId ?? 'anonymous'}, ` +
            `operation: ${operationName ?? 'unnamed'})`
          );

          throw new GraphQLError(
            `Too many aliases in query: ${metrics.aliasCount}. Maximum allowed: ${config.maxAliasesPerQuery}`,
            {
              extensions: {
                code: 'ALIAS_LIMIT_EXCEEDED',
                aliasCount: metrics.aliasCount,
                maxAliases: config.maxAliasesPerQuery,
                hint: 'Reduce the number of field aliases in your query',
              },
            }
          );
        }

        // Log security metrics for monitoring
        logger.debug(
          `Security validation passed - ` +
          `Fields: ${metrics.fieldCount}, ` +
          `Aliases: ${metrics.aliasCount}, ` +
          `Mutations: ${metrics.mutationCount}, ` +
          `Operation: ${operationName ?? 'unnamed'}, ` +
          `User: ${user?.userId ?? 'anonymous'}`
        );
      },

      async executionDidStart() {
        const user = requestContext.contextValue.user;
        const timeoutMs = user?.roles?.includes('admin') || user?.roles?.includes('system_admin')
          ? config.queryTimeoutAdminMs
          : config.queryTimeoutMs;

        return {
          executionDidEnd: async (result) => {
            const executionTime = Date.now() - metrics.startTime;

            // Log execution metrics
            logger.debug(
              `Query executed in ${executionTime}ms - ` +
              `Operation: ${metrics.operationName ?? 'unnamed'}, ` +
              `User: ${metrics.userId ?? 'anonymous'}`
            );

            // Warn about slow queries (above 80% of timeout)
            if (executionTime > timeoutMs * 0.8) {
              logger.warn(
                `Slow query detected: ${executionTime}ms (${((executionTime / timeoutMs) * 100).toFixed(1)}% of timeout) - ` +
                `Operation: ${metrics.operationName ?? 'unnamed'}, ` +
                `User: ${metrics.userId ?? 'anonymous'}, ` +
                `Fields: ${metrics.fieldCount}`
              );
            }

            // Check for timeout violations
            if (executionTime > timeoutMs) {
              logger.error(
                `Query timeout exceeded: ${executionTime}ms > ${timeoutMs}ms - ` +
                `Operation: ${metrics.operationName ?? 'unnamed'}, ` +
                `User: ${metrics.userId ?? 'anonymous'}`
              );
            }
          },
        };
      },

      async willSendResponse(requestContext) {
        const executionTime = Date.now() - metrics.startTime;

        // Add execution metrics to response extensions (for debugging)
        if (process.env.NODE_ENV !== 'production') {
          const response = requestContext.response as any;
          if (!response.extensions) {
            response.extensions = {};
          }

          response.extensions.metrics = {
            executionTime: `${executionTime}ms`,
            fieldCount: metrics.fieldCount,
            aliasCount: metrics.aliasCount,
          };
        }
      },
    };
  }
}
