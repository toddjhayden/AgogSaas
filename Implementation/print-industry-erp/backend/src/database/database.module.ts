/**
 * Database Module - PostgreSQL Connection Pool
 * Provides global database access via dependency injection
 *
 * Consolidated module - single source of truth for database access
 * Exports: DATABASE_POOL (Pool), DatabaseService
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';

const databasePoolProvider = {
  provide: 'DATABASE_POOL',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    // Prefer DATABASE_URL if set (contains full connection string)
    const databaseUrl = configService.get('DATABASE_URL');

    const poolConfig: any = {
      max: configService.get('DB_POOL_SIZE', 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    if (databaseUrl) {
      // Use connection string when DATABASE_URL is set
      poolConfig.connectionString = databaseUrl;
      console.log('✅ Using DATABASE_URL for database connection');
    } else {
      // Fallback to individual settings
      poolConfig.host = configService.get('DB_HOST', 'localhost');
      poolConfig.port = configService.get('DB_PORT', 5432);
      poolConfig.database = configService.get('DB_NAME', 'print_industry_erp');
      poolConfig.user = configService.get('DB_USER', 'postgres');
      poolConfig.password = configService.get('DB_PASSWORD', 'postgres');
      console.log('✅ Using individual DB settings for database connection');
    }

    const pool = new Pool(poolConfig);

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
  imports: [ConfigModule],
  providers: [databasePoolProvider, DatabaseService],
  exports: ['DATABASE_POOL', DatabaseService],
})
export class DatabaseModule {}
