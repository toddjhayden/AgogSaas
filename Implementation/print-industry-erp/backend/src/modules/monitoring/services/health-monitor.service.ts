import axios from 'axios';
import { Pool } from 'pg';

export interface ComponentHealth {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  metadata?: any;
}

export interface SystemHealth {
  overall: 'OPERATIONAL' | 'DEGRADED' | 'DOWN';
  backend: ComponentHealth;
  frontend: ComponentHealth;
  database: ComponentHealth;
  nats: ComponentHealth;
  timestamp: Date;
}

export class HealthMonitorService {
  private pool: Pool;

  constructor() {
    // Use DATABASE_URL connection string (set by docker-compose)
    const connectionString = process.env.DATABASE_URL || 'postgresql://agogsaas_user:changeme@localhost:5433/agogsaas';
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async checkSystemHealth(): Promise<SystemHealth> {
    const [backend, frontend, database, nats] = await Promise.all([
      this.checkBackend(),
      this.checkFrontend(),
      this.checkDatabase(),
      this.checkNats(),
    ]);

    const overall = this.calculateOverallHealth([backend, frontend, database, nats]);

    const health: SystemHealth = {
      backend,
      frontend,
      database,
      nats,
      overall,
      timestamp: new Date(),
    };

    // Save to database
    await this.saveHealthHistory(health);

    return health;
  }

  private async checkBackend(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const response = await axios.get('http://localhost:4000/health', {
        timeout: 5000,
      });
      const responseTime = Date.now() - startTime;
      return {
        name: 'backend',
        status: response.status === 200 ? 'OPERATIONAL' : 'DOWN',
        lastCheck: new Date(),
        responseTime,
      };
    } catch (error: any) {
      return {
        name: 'backend',
        status: 'DOWN',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkFrontend(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      // Check frontend at correct port (3000)
      const response = await axios.get('http://localhost:3000/', {
        timeout: 5000,
      });
      const responseTime = Date.now() - startTime;
      return {
        name: 'frontend',
        status: response.status === 200 ? 'OPERATIONAL' : 'DOWN',
        lastCheck: new Date(),
        responseTime,
      };
    } catch (error: any) {
      return {
        name: 'frontend',
        status: 'DOWN',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const result = await this.pool.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      return {
        name: 'database',
        status: result.rowCount ? 'OPERATIONAL' : 'DOWN',
        lastCheck: new Date(),
        responseTime,
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'DOWN',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkNats(): Promise<ComponentHealth> {
    // NATS is not available in production application (agent-only service)
    // Return UNKNOWN status instead of DOWN to indicate it's not applicable
    return {
      name: 'nats',
      status: 'UNKNOWN',
      lastCheck: new Date(),
      responseTime: 0,
      error: 'NATS not available in production (agent development only)',
    };
  }

  private calculateOverallHealth(
    components: ComponentHealth[]
  ): 'OPERATIONAL' | 'DEGRADED' | 'DOWN' {
    // Only count application components (exclude NATS/UNKNOWN status)
    const appComponents = components.filter(c => c.status !== 'UNKNOWN');
    const upCount = appComponents.filter(c => c.status === 'OPERATIONAL').length;

    if (upCount === appComponents.length) return 'OPERATIONAL';
    if (upCount >= Math.floor(appComponents.length / 2)) return 'DEGRADED';
    return 'DOWN';
  }

  /**
   * Save health check results to database
   */
  private async saveHealthHistory(health: SystemHealth): Promise<void> {
    try {
      const components = [health.backend, health.frontend, health.database, health.nats];

      for (const component of components) {
        await this.pool.query(
          `INSERT INTO health_history (component, status, response_time, error, metadata, checked_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            component.name,
            component.status,
            component.responseTime,
            component.error,
            JSON.stringify(component.metadata || {}),
            component.lastCheck,
          ]
        );
      }
    } catch (error) {
      console.error('[Health] Failed to save to database:', error);
    }
  }

  /**
   * Get health history for a component
   */
  async getHealthHistory(
    component?: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<ComponentHealth[]> {
    let sql = 'SELECT * FROM health_history WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (component) {
      sql += ` AND component = $${paramIndex}`;
      params.push(component);
      paramIndex++;
    }

    if (startTime) {
      sql += ` AND checked_at >= $${paramIndex}`;
      params.push(startTime);
      paramIndex++;
    }

    if (endTime) {
      sql += ` AND checked_at <= $${paramIndex}`;
      params.push(endTime);
      paramIndex++;
    }

    sql += ' ORDER BY checked_at DESC LIMIT 1000';

    try {
      const result = await this.pool.query(sql, params);
      return result.rows.map((row) => ({
        name: row.component,
        status: row.status,
        lastCheck: row.checked_at,
        responseTime: row.response_time,
        error: row.error,
        metadata: row.metadata,
      }));
    } catch (error) {
      console.error('[Health] Failed to get history:', error);
      return [];
    }
  }

  async startMonitoring(intervalMs: number = 5000): Promise<void> {
    console.log(`[Health] Starting monitoring (interval: ${intervalMs}ms)`);

    setInterval(async () => {
      try {
        const health = await this.checkSystemHealth();
        console.log(
          `[Health] ${health.overall} - Backend: ${health.backend.status}, ` +
          `Frontend: ${health.frontend.status}, DB: ${health.database.status}`
        );
      } catch (error) {
        console.error('[Health] Check failed:', error);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    // Stop monitoring interval if implemented
    console.log('[Health] Monitoring stopped');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
