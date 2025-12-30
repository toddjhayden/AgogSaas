/**
 * Optimization Recommendation Engine
 * Analyzes performance metrics and generates actionable optimization recommendations
 *
 * Features:
 * - Bottleneck detection (slow queries, high CPU, memory leaks)
 * - N+1 query detection
 * - Index recommendation based on query patterns
 * - Connection pool sizing recommendations
 * - Caching strategy suggestions
 *
 * REQ: REQ-STRATEGIC-AUTO-1767045901876
 */

import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

interface OptimizationRecommendation {
  id: string;
  category: 'QUERY' | 'INDEX' | 'CACHE' | 'POOL' | 'CODE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  impact: string;
  effort: string;
  recommendation: string;
  implementation: string;
  estimatedSavings: string;
}

@Injectable()
export class OptimizationEngineService {
  constructor(@Inject('DATABASE_POOL') private db: Pool) {}

  /**
   * Analyze performance and generate optimization recommendations
   */
  async generateRecommendations(
    tenantId: string,
    hoursBack: number = 24
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // 1. Analyze slow queries
    const slowQueryRecs = await this.analyzeSlowQueries(tenantId, hoursBack);
    recommendations.push(...slowQueryRecs);

    // 2. Analyze connection pool utilization
    const poolRecs = await this.analyzeConnectionPool(tenantId, hoursBack);
    recommendations.push(...poolRecs);

    // 3. Analyze N+1 query patterns
    const nPlusOneRecs = await this.detectNPlusOneQueries(tenantId, hoursBack);
    recommendations.push(...nPlusOneRecs);

    // 4. Analyze cache hit ratios
    const cacheRecs = await this.analyzeCachingOpportunities(tenantId, hoursBack);
    recommendations.push(...cacheRecs);

    // Sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  /**
   * Analyze slow queries and recommend indexes
   */
  private async analyzeSlowQueries(
    tenantId: string,
    hoursBack: number
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    const result = await this.db.query(`
      SELECT
        query_hash,
        query_preview,
        COUNT(*) AS occurrence_count,
        AVG(execution_time_ms) AS avg_execution_time,
        MAX(execution_time_ms) AS max_execution_time
      FROM query_performance_log
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
        AND execution_time_ms > 1000
      GROUP BY query_hash, query_preview
      HAVING COUNT(*) > 10
      ORDER BY AVG(execution_time_ms) DESC
      LIMIT 5
    `, [tenantId]);

    result.rows.forEach((row, idx) => {
      const priority = row.avg_execution_time > 5000 ? 'CRITICAL' :
                      row.avg_execution_time > 2000 ? 'HIGH' : 'MEDIUM';

      recommendations.push({
        id: `slow-query-${idx}`,
        category: 'QUERY',
        priority: priority as any,
        title: `Slow Query: ${row.avg_execution_time.toFixed(0)}ms average`,
        description: `Query executed ${row.occurrence_count} times with average ${row.avg_execution_time.toFixed(0)}ms`,
        impact: `Causes ${(row.occurrence_count * row.avg_execution_time / 1000).toFixed(0)}s total delay`,
        effort: 'Medium - Requires query optimization or index creation',
        recommendation: this.generateQueryOptimizationRecommendation(row.query_preview),
        implementation: this.generateIndexSuggestion(row.query_preview),
        estimatedSavings: `${((row.avg_execution_time - 100) * row.occurrence_count / 1000).toFixed(0)}s per ${hoursBack}h`
      });
    });

    return recommendations;
  }

  /**
   * Analyze connection pool and recommend sizing
   */
  private async analyzeConnectionPool(
    tenantId: string,
    hoursBack: number
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    const result = await this.db.query(`
      SELECT
        AVG(active_connections) AS avg_active,
        MAX(active_connections) AS max_active,
        COUNT(*) AS sample_count
      FROM system_resource_metrics
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
    `, [tenantId]);

    const row = result.rows[0];
    const poolSize = this.db.totalCount;
    const utilizationPercent = (row.max_active / poolSize) * 100;

    if (utilizationPercent > 90) {
      recommendations.push({
        id: 'pool-exhaustion',
        category: 'POOL',
        priority: 'CRITICAL',
        title: 'Connection Pool Near Capacity',
        description: `Pool utilization reaches ${utilizationPercent.toFixed(0)}% (${row.max_active}/${poolSize} connections)`,
        impact: 'Requests may be queued or rejected during peak load',
        effort: 'Low - Configuration change',
        recommendation: `Increase pool size from ${poolSize} to ${Math.ceil(poolSize * 1.5)} connections`,
        implementation: `Set DATABASE_POOL_MAX=${Math.ceil(poolSize * 1.5)} in environment configuration`,
        estimatedSavings: 'Prevents request queuing and timeouts'
      });
    } else if (utilizationPercent < 30 && poolSize > 10) {
      recommendations.push({
        id: 'pool-oversized',
        category: 'POOL',
        priority: 'LOW',
        title: 'Connection Pool Underutilized',
        description: `Pool utilization only ${utilizationPercent.toFixed(0)}% (${row.avg_active.toFixed(0)}/${poolSize} avg)`,
        impact: 'Wasting database resources',
        effort: 'Low - Configuration change',
        recommendation: `Reduce pool size from ${poolSize} to ${Math.ceil(row.max_active * 1.5)} connections`,
        implementation: `Set DATABASE_POOL_MAX=${Math.ceil(row.max_active * 1.5)} in environment configuration`,
        estimatedSavings: 'Reduces database memory overhead'
      });
    }

    return recommendations;
  }

  /**
   * Detect N+1 query patterns
   */
  private async detectNPlusOneQueries(
    tenantId: string,
    hoursBack: number
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Look for queries executed many times in short timespan (potential N+1)
    const result = await this.db.query(`
      SELECT
        query_hash,
        query_preview,
        endpoint,
        COUNT(*) AS execution_count,
        COUNT(DISTINCT DATE_TRUNC('second', timestamp)) AS unique_seconds
      FROM query_performance_log
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
      GROUP BY query_hash, query_preview, endpoint
      HAVING COUNT(*) / NULLIF(COUNT(DISTINCT DATE_TRUNC('second', timestamp)), 0) > 10
      ORDER BY COUNT(*) / NULLIF(COUNT(DISTINCT DATE_TRUNC('second', timestamp)), 0) DESC
      LIMIT 3
    `, [tenantId]);

    result.rows.forEach((row, idx) => {
      const queriesPerSecond = row.execution_count / row.unique_seconds;

      recommendations.push({
        id: `n-plus-one-${idx}`,
        category: 'CODE',
        priority: 'HIGH',
        title: `Potential N+1 Query Pattern in ${row.endpoint}`,
        description: `Query executed ${row.execution_count} times (${queriesPerSecond.toFixed(0)}/sec average)`,
        impact: 'Causes excessive database round-trips, slowing response time',
        effort: 'Medium - Requires code refactoring',
        recommendation: 'Add eager loading or batch queries with DataLoader',
        implementation: `
          // Use DataLoader for batching
          const dataLoader = new DataLoader(async (ids) => {
            return db.query('SELECT * FROM table WHERE id = ANY($1)', [ids]);
          });

          // Or use JOIN instead of multiple queries
        `,
        estimatedSavings: `Reduce ${row.execution_count} queries to 1-2 queries`
      });
    });

    return recommendations;
  }

  /**
   * Analyze caching opportunities
   */
  private async analyzeCachingOpportunities(
    tenantId: string,
    hoursBack: number
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Find frequently accessed endpoints with slow response times
    const result = await this.db.query(`
      SELECT
        endpoint,
        COUNT(*) AS request_count,
        AVG(response_time_ms) AS avg_response_time,
        MAX(response_time_ms) AS max_response_time
      FROM api_performance_log
      WHERE tenant_id = $1
        AND timestamp >= NOW() - INTERVAL '${hoursBack} hours'
        AND status_code < 300
      GROUP BY endpoint
      HAVING COUNT(*) > 100 AND AVG(response_time_ms) > 500
      ORDER BY COUNT(*) * AVG(response_time_ms) DESC
      LIMIT 5
    `, [tenantId]);

    result.rows.forEach((row, idx) => {
      const cachePotential = row.request_count * row.avg_response_time;

      recommendations.push({
        id: `cache-opportunity-${idx}`,
        category: 'CACHE',
        priority: cachePotential > 1000000 ? 'HIGH' : 'MEDIUM',
        title: `Add Caching to ${row.endpoint}`,
        description: `Endpoint called ${row.request_count} times with ${row.avg_response_time.toFixed(0)}ms avg response`,
        impact: `High traffic with slow response - excellent caching candidate`,
        effort: 'Low - Add caching decorator',
        recommendation: `Implement Redis caching with 60-300 second TTL`,
        implementation: `
          @UseInterceptors(CacheInterceptor)
          @CacheTTL(60)
          async ${row.endpoint.split('/').pop()}() {
            // Existing code
          }
        `,
        estimatedSavings: `Save ${((row.request_count * row.avg_response_time * 0.9) / 1000).toFixed(0)}s per ${hoursBack}h (90% cache hit rate)`
      });
    });

    return recommendations;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private generateQueryOptimizationRecommendation(queryPreview: string): string {
    const recommendations: string[] = [];

    // Check for missing WHERE clause
    if (queryPreview.toUpperCase().includes('SELECT') && !queryPreview.toUpperCase().includes('WHERE')) {
      recommendations.push('Add WHERE clause to filter results');
    }

    // Check for SELECT *
    if (queryPreview.includes('SELECT *')) {
      recommendations.push('Replace SELECT * with specific column names');
    }

    // Check for missing LIMIT
    if (queryPreview.toUpperCase().includes('SELECT') && !queryPreview.toUpperCase().includes('LIMIT')) {
      recommendations.push('Add LIMIT clause to prevent full table scans');
    }

    // Check for LIKE with leading wildcard
    if (queryPreview.includes("LIKE '%")) {
      recommendations.push('Avoid LIKE with leading wildcard - cannot use index');
    }

    return recommendations.length > 0
      ? recommendations.join('; ')
      : 'Optimize query structure and consider adding indexes';
  }

  private generateIndexSuggestion(queryPreview: string): string {
    // Extract table names and WHERE clause columns
    const tableMatch = queryPreview.match(/FROM\s+(\w+)/i);
    const whereMatch = queryPreview.match(/WHERE\s+(.+?)(ORDER|GROUP|LIMIT|$)/i);

    if (tableMatch && whereMatch) {
      const table = tableMatch[1];
      const whereClause = whereMatch[1];

      // Extract column names from WHERE clause
      const columnMatches = whereClause.match(/(\w+)\s*(=|>|<|LIKE|IN)/gi);
      if (columnMatches && columnMatches.length > 0) {
        const columns = columnMatches.map(m => m.split(/\s*(=|>|<|LIKE|IN)/i)[0].trim());
        return `CREATE INDEX idx_${table}_${columns.join('_')} ON ${table} (${columns.join(', ')});`;
      }
    }

    return 'Analyze query execution plan with EXPLAIN and add appropriate indexes';
  }
}
