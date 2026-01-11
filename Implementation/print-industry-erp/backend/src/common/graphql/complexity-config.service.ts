/**
 * GraphQL Complexity Configuration Service
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 *
 * Centralized configuration and management for GraphQL security settings:
 * 1. Field-level complexity costs
 * 2. Type-specific complexity multipliers
 * 3. Dynamic complexity limits based on system load
 * 4. Complexity tracking and analytics
 *
 * Features:
 * - Configurable per-field complexity costs
 * - Automatic complexity adjustments based on system metrics
 * - Complexity tracking for optimization
 * - Support for custom complexity estimators
 */

import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface FieldComplexityConfig {
  fieldName: string;
  typeName: string;
  complexity: number;
  multiplier?: number;
  description?: string;
}

export interface ComplexityLimits {
  public: number;
  authenticated: number;
  admin: number;
  systemAdmin: number;
}

export interface DepthLimits {
  public: number;
  authenticated: number;
  admin: number;
  systemAdmin: number;
}

export interface ComplexityStats {
  operationName: string;
  complexity: number;
  depth: number;
  executionTimeMs: number;
  userId?: string;
  tenantId?: string;
  timestamp: Date;
}

@Injectable()
export class ComplexityConfigService {
  private readonly logger = new Logger(ComplexityConfigService.name);

  // Default complexity costs for common field types
  private readonly defaultFieldComplexities: Map<string, number> = new Map([
    // Scalars - low cost
    ['String', 1],
    ['Int', 1],
    ['Float', 1],
    ['Boolean', 1],
    ['ID', 1],
    ['Date', 1],
    ['DateTime', 1],

    // Simple objects - medium cost
    ['Object', 2],

    // Lists - high cost (will be multiplied by list size)
    ['List', 10],

    // Connection types - high cost (pagination)
    ['Connection', 15],
    ['Edge', 5],

    // Aggregations - very high cost
    ['Aggregation', 25],
    ['Analytics', 30],

    // Complex computations - highest cost
    ['Computation', 50],
  ]);

  // Specific field complexity overrides
  private readonly fieldComplexityOverrides: Map<string, number> = new Map([
    // Example expensive fields
    ['Query.searchAll', 100],
    ['Query.analytics', 80],
    ['Query.reports', 60],
    ['Mutation.bulkCreate', 50],
    ['Mutation.bulkUpdate', 50],
    ['Mutation.bulkDelete', 50],
  ]);

  // Default limits
  private complexityLimits: ComplexityLimits = {
    public: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY_PUBLIC ?? '100', 10),
    authenticated: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY ?? '1000', 10),
    admin: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY_ADMIN ?? '5000', 10),
    systemAdmin: parseInt(process.env.GRAPHQL_MAX_COMPLEXITY_SYSTEM ?? '10000', 10),
  };

  private depthLimits: DepthLimits = {
    public: parseInt(process.env.GRAPHQL_MAX_DEPTH_PUBLIC ?? '5', 10),
    authenticated: parseInt(process.env.GRAPHQL_MAX_DEPTH ?? '7', 10),
    admin: parseInt(process.env.GRAPHQL_MAX_DEPTH_ADMIN ?? '15', 10),
    systemAdmin: parseInt(process.env.GRAPHQL_MAX_DEPTH_SYSTEM ?? '20', 10),
  };

  constructor(
    @Inject('DATABASE_POOL') private readonly dbPool: Pool,
  ) {
    this.logger.log('GraphQL Complexity Configuration Service initialized');
    this.logCurrentConfiguration();
  }

  /**
   * Get complexity cost for a specific field
   */
  getFieldComplexity(typeName: string, fieldName: string): number {
    const fullFieldName = `${typeName}.${fieldName}`;

    // Check for specific field override
    if (this.fieldComplexityOverrides.has(fullFieldName)) {
      return this.fieldComplexityOverrides.get(fullFieldName)!;
    }

    // Check for type default
    if (this.defaultFieldComplexities.has(typeName)) {
      return this.defaultFieldComplexities.get(typeName)!;
    }

    // Default object cost
    return 2;
  }

  /**
   * Get complexity limit for user role
   */
  getComplexityLimit(roles?: string[]): number {
    if (!roles || roles.length === 0) {
      return this.complexityLimits.public;
    }

    if (roles.includes('system_admin')) {
      return this.complexityLimits.systemAdmin;
    }

    if (roles.includes('admin')) {
      return this.complexityLimits.admin;
    }

    return this.complexityLimits.authenticated;
  }

  /**
   * Get depth limit for user role
   */
  getDepthLimit(roles?: string[]): number {
    if (!roles || roles.length === 0) {
      return this.depthLimits.public;
    }

    if (roles.includes('system_admin')) {
      return this.depthLimits.systemAdmin;
    }

    if (roles.includes('admin')) {
      return this.depthLimits.admin;
    }

    return this.depthLimits.authenticated;
  }

  /**
   * Update complexity limits dynamically
   */
  updateComplexityLimits(limits: Partial<ComplexityLimits>): void {
    this.complexityLimits = {
      ...this.complexityLimits,
      ...limits,
    };

    this.logger.log('Complexity limits updated', limits);
  }

  /**
   * Update depth limits dynamically
   */
  updateDepthLimits(limits: Partial<DepthLimits>): void {
    this.depthLimits = {
      ...this.depthLimits,
      ...limits,
    };

    this.logger.log('Depth limits updated', limits);
  }

  /**
   * Track query complexity statistics
   */
  async trackComplexity(stats: ComplexityStats): Promise<void> {
    try {
      await this.dbPool.query(
        `
        INSERT INTO graphql_query_complexity_log (
          operation_name,
          complexity,
          depth,
          execution_time_ms,
          user_id,
          tenant_id,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          stats.operationName,
          stats.complexity,
          stats.depth,
          stats.executionTimeMs,
          stats.userId ?? null,
          stats.tenantId ?? null,
          stats.timestamp,
        ]
      );
    } catch (error) {
      // Log error but don't fail the query
      this.logger.error('Failed to track query complexity:', error);
    }
  }

  /**
   * Get complexity statistics for optimization
   */
  async getComplexityStats(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ComplexityStats[]> {
    try {
      const query = `
        SELECT
          operation_name,
          AVG(complexity) as avg_complexity,
          MAX(complexity) as max_complexity,
          AVG(depth) as avg_depth,
          MAX(depth) as max_depth,
          AVG(execution_time_ms) as avg_execution_time_ms,
          COUNT(*) as query_count
        FROM graphql_query_complexity_log
        WHERE
          ($1::uuid IS NULL OR tenant_id = $1)
          AND ($2::timestamp IS NULL OR created_at >= $2)
          AND ($3::timestamp IS NULL OR created_at <= $3)
        GROUP BY operation_name
        ORDER BY avg_complexity DESC
        LIMIT 100
      `;

      const result = await this.dbPool.query(query, [
        tenantId ?? null,
        startDate ?? null,
        endDate ?? null,
      ]);

      return result.rows as any;
    } catch (error) {
      this.logger.error('Failed to get complexity statistics:', error);
      return [];
    }
  }

  /**
   * Get top expensive queries
   */
  async getTopExpensiveQueries(limit: number = 10): Promise<ComplexityStats[]> {
    try {
      const result = await this.dbPool.query(
        `
        SELECT
          operation_name,
          complexity,
          depth,
          execution_time_ms,
          user_id,
          tenant_id,
          created_at as timestamp
        FROM graphql_query_complexity_log
        ORDER BY complexity DESC, execution_time_ms DESC
        LIMIT $1
        `,
        [limit]
      );

      return result.rows as any;
    } catch (error) {
      this.logger.error('Failed to get top expensive queries:', error);
      return [];
    }
  }

  /**
   * Log current configuration
   */
  private logCurrentConfiguration(): void {
    this.logger.log('=== GraphQL Security Configuration ===');
    this.logger.log('Complexity Limits:', this.complexityLimits);
    this.logger.log('Depth Limits:', this.depthLimits);
    this.logger.log('======================================');
  }

  /**
   * Get current configuration summary
   */
  getConfigSummary() {
    return {
      complexityLimits: this.complexityLimits,
      depthLimits: this.depthLimits,
      fieldComplexityCount: this.fieldComplexityOverrides.size,
      typeComplexityCount: this.defaultFieldComplexities.size,
    };
  }
}
