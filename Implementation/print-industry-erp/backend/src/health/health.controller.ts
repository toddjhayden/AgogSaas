/**
 * Health Check Controller
 * Provides basic health monitoring endpoint
 */

import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Controller('health')
export class HealthController {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  @Get()
  async check() {
    // Test database connection
    let dbStatus = 'disconnected';
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      dbStatus = 'connected';
    } catch (error) {
      console.error('Health check database error:', error);
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };
  }
}
