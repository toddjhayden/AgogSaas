/**
 * SDLC Database Service
 * Manages connection to the SDLC Control database (port 5435)
 * Separate from agent_memory database for clean isolation
 */

import { Pool, PoolClient, QueryResult } from 'pg';

export class SDLCDatabaseService {
  private pool: Pool;
  private static instance: SDLCDatabaseService;

  constructor() {
    // Use SDLC-specific database connection
    // Cloud: Set SDLC_DATABASE_URL environment variable
    // Local: Falls back to localhost:5435
    const dbUrl = process.env.SDLC_DATABASE_URL ||
      'postgresql://sdlc_user:sdlc_dev_password_2024@localhost:5435/sdlc_control';

    console.log('[SDLCDatabase] Connecting to:', dbUrl.replace(/:[^:@]+@/, ':***@'));

    this.pool = new Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Log connection errors
    this.pool.on('error', (err: Error) => {
      console.error('[SDLCDatabase] Unexpected error on idle client:', err);
    });
  }

  /**
   * Singleton instance
   */
  static getInstance(): SDLCDatabaseService {
    if (!SDLCDatabaseService.instance) {
      SDLCDatabaseService.instance = new SDLCDatabaseService();
    }
    return SDLCDatabaseService.instance;
  }

  /**
   * Get pool for direct queries
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  /**
   * Execute a query returning single row
   */
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await this.pool.query(text, params);
    return result.rows[0] || null;
  }

  /**
   * Get a client for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute within a transaction
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('[SDLCDatabase] Health check failed:', error);
      return false;
    }
  }

  /**
   * Close the pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('[SDLCDatabase] Connection pool closed');
  }
}

/**
 * Get SDLC database singleton
 */
export function getSDLCDatabase(): SDLCDatabaseService {
  return SDLCDatabaseService.getInstance();
}
