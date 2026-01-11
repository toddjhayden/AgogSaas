/**
 * GraphQL Query Complexity Plugin
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 *
 * Prevents denial-of-service attacks through expensive GraphQL queries by:
 * 1. Analyzing query complexity before execution
 * 2. Enforcing configurable complexity limits
 * 3. Tracking and logging expensive queries
 * 4. Supporting role-based complexity limits
 *
 * Security Measures:
 * - Maximum query complexity: 1000 (default), 5000 (admin)
 * - Introspection queries blocked in production
 * - Complexity cost tracking per field type
 * - Automatic rejection of over-complex queries
 */

import { Plugin } from '@nestjs/apollo';
import type {
  ApolloServerPlugin,
  GraphQLRequestListener,
  BaseContext,
  GraphQLRequestContext
} from '@apollo/server';
import { Logger } from '@nestjs/common';
import {
  getComplexity,
  simpleEstimator,
  fieldExtensionsEstimator
} from 'graphql-query-complexity';
import { GraphQLError } from 'graphql';
import { separateOperations } from 'graphql/utilities/separateOperations';

interface ComplexityContext extends BaseContext {
  user?: {
    userId: string;
    tenantId: string;
    roles?: string[];
  };
}

interface ComplexityConfig {
  maximumComplexity: number;
  maximumComplexityAdmin: number;
  maximumComplexityPublic: number;
  scalarCost: number;
  objectCost: number;
  listMultiplier: number;
}

@Plugin()
export class QueryComplexityPlugin implements ApolloServerPlugin<ComplexityContext> {
  private readonly logger = new Logger(QueryComplexityPlugin.name);

  // Configuration
  private readonly config: ComplexityConfig = {
    maximumComplexity: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY ?? '1000', 10),
    maximumComplexityAdmin: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY_ADMIN ?? '5000', 10),
    maximumComplexityPublic: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY_PUBLIC ?? '100', 10),
    scalarCost: 1,
    objectCost: 2,
    listMultiplier: 10,
  };

  async requestDidStart(
    requestContext: GraphQLRequestContext<ComplexityContext>
  ): Promise<GraphQLRequestListener<ComplexityContext>> {
    const logger = this.logger;
    const config = this.config;

    return {
      async didResolveOperation(requestContext) {
        // Skip complexity analysis for introspection queries in development
        const { operationName } = requestContext;
        if (operationName === 'IntrospectionQuery') {
          if (process.env.NODE_ENV === 'production') {
            logger.warn('Introspection query blocked in production');
            throw new GraphQLError('Introspection is disabled in production', {
              extensions: { code: 'INTROSPECTION_DISABLED' },
            });
          }
          return; // Allow in development
        }

        const { schema, document } = requestContext;
        const user = requestContext.contextValue.user;

        // Determine complexity limit based on user role
        let maxComplexity = config.maximumComplexity;

        if (!user) {
          maxComplexity = config.maximumComplexityPublic;
        } else if (user.roles?.includes('admin') || user.roles?.includes('system_admin')) {
          maxComplexity = config.maximumComplexityAdmin;
        }

        try {
          // Calculate query complexity
          const complexity = getComplexity({
            schema,
            query: document,
            variables: requestContext.request.variables ?? {},
            estimators: [
              // Use field extensions if defined in schema
              fieldExtensionsEstimator(),
              // Fallback to simple cost estimation
              simpleEstimator({ defaultComplexity: config.objectCost }),
            ],
          });

          // Log complexity for monitoring
          const complexityLevel =
            complexity > maxComplexity * 0.8 ? 'HIGH' :
            complexity > maxComplexity * 0.5 ? 'MEDIUM' : 'LOW';

          logger.debug(
            `Query complexity: ${complexity}/${maxComplexity} ` +
            `[${complexityLevel}] ` +
            `(user: ${user?.userId ?? 'anonymous'}, ` +
            `operation: ${operationName ?? 'unnamed'})`
          );

          // Enforce complexity limit
          if (complexity > maxComplexity) {
            logger.warn(
              `Query complexity limit exceeded: ${complexity} > ${maxComplexity} ` +
              `(user: ${user?.userId ?? 'anonymous'}, ` +
              `operation: ${operationName ?? 'unnamed'})`
            );

            throw new GraphQLError(
              `Query is too complex: ${complexity}. Maximum allowed complexity: ${maxComplexity}`,
              {
                extensions: {
                  code: 'GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED',
                  complexity,
                  maxComplexity,
                  hint: 'Try simplifying your query by requesting fewer fields or reducing nesting depth',
                },
              }
            );
          }

          // Track expensive queries (above 50% of limit)
          if (complexity > maxComplexity * 0.5) {
            logger.log(
              `Expensive query detected: ${complexity}/${maxComplexity} ` +
              `(${((complexity / maxComplexity) * 100).toFixed(1)}% of limit) ` +
              `- User: ${user?.userId ?? 'anonymous'}, ` +
              `Operation: ${operationName ?? 'unnamed'}`
            );
          }
        } catch (error) {
          // Re-throw GraphQL errors (like complexity limit exceeded)
          if (error instanceof GraphQLError) {
            throw error;
          }

          // Log and wrap unexpected errors
          logger.error('Error calculating query complexity:', error);
          throw new GraphQLError('Failed to analyze query complexity', {
            extensions: {
              code: 'COMPLEXITY_ANALYSIS_FAILED',
              originalError: error instanceof Error ? error.message : String(error),
            },
          });
        }
      },
    };
  }
}
