/**
 * Database Module - PostgreSQL Connection Pool
 * Provides global database access via dependency injection
 */

import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';

const databaseProvider = {
  provide: 'DATABASE_POOL',
  useFactory: () => {
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'print_industry_erp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      // Fallback to connectionString if provided
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('❌ Unexpected database error:', err);
    });

    pool.on('connect', () => {
      console.log('✅ Database connection established');
    });

    return pool;
  },
};

@Global()
@Module({
  providers: [databaseProvider],
  exports: ['DATABASE_POOL'],
})
export class DatabaseModule {}
