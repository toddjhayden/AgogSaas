/**
 * GraphQL Query Depth Limiter Plugin
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 *
 * Prevents deeply nested queries that can cause performance issues or DoS attacks by:
 * 1. Analyzing query depth before execution
 * 2. Enforcing configurable depth limits
 * 3. Supporting role-based depth limits
 * 4. Blocking circular/recursive query patterns
 *
 * Security Measures:
 * - Maximum query depth: 7 (default), 15 (admin), 5 (public)
 * - Fragment spread depth tracking
 * - Inline fragment depth tracking
 * - Automatic rejection of over-nested queries
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
import {
  visit,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from 'graphql';

interface DepthContext extends BaseContext {
  user?: {
    userId: string;
    tenantId: string;
    roles?: string[];
  };
}

interface DepthConfig {
  maximumDepth: number;
  maximumDepthAdmin: number;
  maximumDepthPublic: number;
}

@Plugin()
export class QueryDepthLimiterPlugin implements ApolloServerPlugin<DepthContext> {
  private readonly logger = new Logger(QueryDepthLimiterPlugin.name);

  // Configuration
  private readonly config: DepthConfig = {
    maximumDepth: parseInt(process.env.GRAPHQL_MAX_DEPTH ?? '7', 10),
    maximumDepthAdmin: parseInt(process.env.GRAPHQL_MAX_DEPTH_ADMIN ?? '15', 10),
    maximumDepthPublic: parseInt(process.env.GRAPHQL_MAX_DEPTH_PUBLIC ?? '5', 10),
  };

  async requestDidStart(
    requestContext: GraphQLRequestContext<DepthContext>
  ): Promise<GraphQLRequestListener<DepthContext>> {
    const logger = this.logger;
    const config = this.config;
    const calculateQueryDepth = this.calculateQueryDepth.bind(this);

    return {
      async didResolveOperation(requestContext) {
        // Skip depth analysis for introspection queries
        const { operationName } = requestContext;
        if (operationName === 'IntrospectionQuery') {
          return;
        }

        const { document } = requestContext;
        const user = requestContext.contextValue.user;

        // Determine depth limit based on user role
        let maxDepth = config.maximumDepth;

        if (!user) {
          maxDepth = config.maximumDepthPublic;
        } else if (user.roles?.includes('admin') || user.roles?.includes('system_admin')) {
          maxDepth = config.maximumDepthAdmin;
        }

        try {
          // Calculate query depth
          const depth = calculateQueryDepth(document, requestContext);

          // Log depth for monitoring
          const depthLevel =
            depth > maxDepth * 0.8 ? 'HIGH' :
            depth > maxDepth * 0.5 ? 'MEDIUM' : 'LOW';

          logger.debug(
            `Query depth: ${depth}/${maxDepth} ` +
            `[${depthLevel}] ` +
            `(user: ${user?.userId ?? 'anonymous'}, ` +
            `operation: ${operationName ?? 'unnamed'})`
          );

          // Enforce depth limit
          if (depth > maxDepth) {
            logger.warn(
              `Query depth limit exceeded: ${depth} > ${maxDepth} ` +
              `(user: ${user?.userId ?? 'anonymous'}, ` +
              `operation: ${operationName ?? 'unnamed'})`
            );

            throw new GraphQLError(
              `Query is too deep: ${depth}. Maximum allowed depth: ${maxDepth}`,
              {
                extensions: {
                  code: 'GRAPHQL_DEPTH_LIMIT_EXCEEDED',
                  depth,
                  maxDepth,
                  hint: 'Try reducing the nesting level of your query',
                },
              }
            );
          }

          // Track deep queries (above 70% of limit)
          if (depth > maxDepth * 0.7) {
            logger.log(
              `Deep query detected: ${depth}/${maxDepth} ` +
              `(${((depth / maxDepth) * 100).toFixed(1)}% of limit) ` +
              `- User: ${user?.userId ?? 'anonymous'}, ` +
              `Operation: ${operationName ?? 'unnamed'}`
            );
          }
        } catch (error) {
          // Re-throw GraphQL errors (like depth limit exceeded)
          if (error instanceof GraphQLError) {
            throw error;
          }

          // Log and wrap unexpected errors
          logger.error('Error calculating query depth:', error);
          throw new GraphQLError('Failed to analyze query depth', {
            extensions: {
              code: 'DEPTH_ANALYSIS_FAILED',
              originalError: error instanceof Error ? error.message : String(error),
            },
          });
        }
      },
    };
  }

  /**
   * Calculate the maximum depth of a GraphQL query
   * Handles fragments and inline fragments correctly
   */
  private calculateQueryDepth(
    document: any,
    requestContext: GraphQLRequestContext<DepthContext>
  ): number {
    const fragments = this.extractFragments(document);
    let maxDepth = 0;

    // Visit each operation definition
    visit(document, {
      OperationDefinition: {
        enter: (node) => {
          if (node.selectionSet) {
            const depth = this.getSelectionSetDepth(
              node.selectionSet,
              fragments,
              new Set(),
              0
            );
            maxDepth = Math.max(maxDepth, depth);
          }
        },
      },
    });

    return maxDepth;
  }

  /**
   * Extract fragment definitions from document
   */
  private extractFragments(document: any): Map<string, SelectionSetNode> {
    const fragments = new Map<string, SelectionSetNode>();

    visit(document, {
      FragmentDefinition: {
        enter: (node) => {
          if (node.name.value && node.selectionSet) {
            fragments.set(node.name.value, node.selectionSet);
          }
        },
      },
    });

    return fragments;
  }

  /**
   * Recursively calculate depth of a selection set
   * Tracks visited fragments to prevent infinite recursion
   */
  private getSelectionSetDepth(
    selectionSet: SelectionSetNode,
    fragments: Map<string, SelectionSetNode>,
    visitedFragments: Set<string>,
    currentDepth: number
  ): number {
    let maxDepth = currentDepth;

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        const fieldNode = selection as FieldNode;

        if (fieldNode.selectionSet) {
          // Recurse into nested fields
          const depth = this.getSelectionSetDepth(
            fieldNode.selectionSet,
            fragments,
            visitedFragments,
            currentDepth + 1
          );
          maxDepth = Math.max(maxDepth, depth);
        } else {
          // Leaf field
          maxDepth = Math.max(maxDepth, currentDepth + 1);
        }
      } else if (selection.kind === 'FragmentSpread') {
        const fragmentSpread = selection as FragmentSpreadNode;
        const fragmentName = fragmentSpread.name.value;

        // Prevent infinite recursion from circular fragments
        if (visitedFragments.has(fragmentName)) {
          this.logger.warn(`Circular fragment reference detected: ${fragmentName}`);
          continue;
        }

        const fragmentSelectionSet = fragments.get(fragmentName);
        if (fragmentSelectionSet) {
          visitedFragments.add(fragmentName);
          const depth = this.getSelectionSetDepth(
            fragmentSelectionSet,
            fragments,
            new Set(visitedFragments),
            currentDepth
          );
          maxDepth = Math.max(maxDepth, depth);
        }
      } else if (selection.kind === 'InlineFragment') {
        const inlineFragment = selection as InlineFragmentNode;

        if (inlineFragment.selectionSet) {
          const depth = this.getSelectionSetDepth(
            inlineFragment.selectionSet,
            fragments,
            visitedFragments,
            currentDepth
          );
          maxDepth = Math.max(maxDepth, depth);
        }
      }
    }

    return maxDepth;
  }
}
