/**
 * Database Service - Tenant Context Management
 * REQ: REQ-1767508090235-mvcn3 - Multi-Tenant Row-Level Security Implementation
 *
 * This service provides helper methods for:
 * 1. Setting tenant context for Row-Level Security (RLS)
 * 2. Executing queries with automatic tenant isolation
 * 3. Transaction management with tenant context
 *
 * Design Decisions:
 * - Uses PostgreSQL session variables (app.current_tenant_id) for RLS
 * - Per-query tenant context (not per-connection) to avoid pool exhaustion
 * - All queries automatically set tenant context before execution
 * - Supports both single queries and transactions
 *
 * CRITICAL: This is the ONLY way to interact with tenant-scoped tables.
 * Direct pool.query() calls bypass RLS and must not be used.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Options for executing queries with tenant context
 */
export interface TenantQueryOptions {
  /** The tenant ID to set in session context */
  tenantId: string;
  /** Optional user ID for audit logging */
  userId?: string;
}

/**
 * Transaction callback function type
 */
export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject('DATABASE_POOL')
    private readonly pool: Pool,
  ) {}

  /**
   * Execute a single query with tenant context
   *
   * This method:
   * 1. Gets a connection from the pool
   * 2. Sets the tenant context via SET LOCAL
   * 3. Executes the query
   * 4. Releases the connection back to the pool
   *
   * Example:
   * ```typescript
   * const result = await dbService.query(
   *   { tenantId: user.tenantId },
   *   'SELECT * FROM invoices WHERE id = $1',
   *   [invoiceId]
   * );
   * ```
   *
   * @param options Tenant context options
   * @param text SQL query text
   * @param values Query parameters
   * @returns Query result
   */
  async query<T extends QueryResultRow = any>(
    options: TenantQueryOptions,
    text: string,
    values?: any[],
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();

    try {
      // Set tenant context
      await this.setTenantContext(client, options);

      // Execute query
      const result = await client.query<T>(text, values);

      return result;
    } catch (error) {
      this.logger.error('Query execution failed', {
        error,
        tenantId: options.tenantId,
        query: text.substring(0, 100), // Log first 100 chars
      });
      throw error;
    } finally {
      // Always release the client
      client.release();
    }
  }

  /**
   * Execute multiple queries in a transaction with tenant context
   *
   * This method:
   * 1. Gets a connection from the pool
   * 2. Starts a transaction
   * 3. Sets the tenant context via SET LOCAL (transaction-scoped)
   * 4. Executes the callback with the client
   * 5. Commits on success, rolls back on error
   * 6. Releases the connection back to the pool
   *
   * Example:
   * ```typescript
   * const result = await dbService.transaction(
   *   { tenantId: user.tenantId },
   *   async (client) => {
   *     const invoice = await client.query('INSERT INTO invoices ...');
   *     const lineItems = await client.query('INSERT INTO invoice_lines ...');
   *     return { invoice, lineItems };
   *   }
   * );
   * ```
   *
   * @param options Tenant context options
   * @param callback Transaction callback that receives the client
   * @returns Result from callback
   */
  async transaction<T>(
    options: TenantQueryOptions,
    callback: TransactionCallback<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Set tenant context (SET LOCAL is transaction-scoped)
      await this.setTenantContext(client, options);

      // Execute transaction logic
      const result = await callback(client);

      // Commit transaction
      await client.query('COMMIT');

      return result;
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');

      this.logger.error('Transaction failed', {
        error,
        tenantId: options.tenantId,
      });

      throw error;
    } finally {
      // Always release the client
      client.release();
    }
  }

  /**
   * Execute a query without tenant context (system-level queries only)
   *
   * WARNING: This bypasses RLS. Only use for:
   * - System administration tasks
   * - Cross-tenant analytics (with proper authorization)
   * - Queries on non-tenant tables (e.g., system configuration)
   *
   * @param text SQL query text
   * @param values Query parameters
   * @returns Query result
   */
  async querySystem<T extends QueryResultRow = any>(
    text: string,
    values?: any[],
  ): Promise<QueryResult<T>> {
    this.logger.debug('Executing system query (bypasses RLS)', {
      query: text.substring(0, 100),
    });

    return this.pool.query<T>(text, values);
  }

  /**
   * Set tenant context on a database client
   *
   * Uses SET LOCAL to set session variables that are used by RLS policies.
   * SET LOCAL is transaction-scoped, so it automatically resets when the
   * transaction ends or the connection is released.
   *
   * Session variables set:
   * - app.current_tenant_id: For RLS policies
   * - app.current_user_id: For audit logging (optional)
   *
   * @param client Database client
   * @param options Tenant context options
   */
  private async setTenantContext(
    client: PoolClient,
    options: TenantQueryOptions,
  ): Promise<void> {
    try {
      // Set tenant ID (required for RLS)
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [options.tenantId]
      );

      // Set user ID for audit logging (optional)
      if (options.userId) {
        await client.query(
          `SET LOCAL app.current_user_id = $1`,
          [options.userId]
        );
      }

      this.logger.debug('Tenant context set', {
        tenantId: options.tenantId,
        userId: options.userId,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to set tenant context', {
        error,
        tenantId: options.tenantId,
      });
      throw new Error(`Failed to set tenant context: ${errorMessage}`);
    }
  }

  /**
   * Get a raw database client (advanced usage only)
   *
   * WARNING: You must manually set tenant context and release the client.
   * Prefer using query() or transaction() instead.
   *
   * Example:
   * ```typescript
   * const client = await dbService.getClient();
   * try {
   *   await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
   *   const result = await client.query('SELECT ...');
   * } finally {
   *   client.release();
   * }
   * ```
   *
   * @returns Database client (must be manually released)
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Get the underlying connection pool (for advanced use cases)
   *
   * WARNING: Direct pool access bypasses tenant context.
   * Only use for system-level operations.
   *
   * @returns Connection pool
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Health check: Verify database connectivity
   *
   * @returns True if database is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 as health');
      return result.rows[0]?.health === 1;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get pool statistics for monitoring
   *
   * @returns Pool statistics
   */
  getPoolStats() {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
    };
  }
}
