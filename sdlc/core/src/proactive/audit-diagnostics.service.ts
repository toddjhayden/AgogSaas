/**
 * Audit Diagnostics Service
 *
 * Phase C of blocked-catastrophic-escalation.md
 *
 * When audit retries fail, this service automatically gathers diagnostic data:
 * - NATS connectivity and message queue depth
 * - Database query performance
 * - Host Listener spawn success/failure rate
 * - System resource usage (CPU, memory, disk)
 *
 * Generates recommendations based on findings and attaches to P0 REQ.
 */

import { NatsConnection, JetStreamClient, StringCodec } from 'nats';
import { Pool } from 'pg';
import * as os from 'os';

const sc = StringCodec();

export interface DiagnosticReport {
  timestamp: string;
  auditReqNumber: string;
  duration: number;

  // Health checks
  natsHealth: NatsHealthCheck;
  databaseHealth: DatabaseHealthCheck;
  hostListenerHealth: HostListenerHealthCheck;
  systemResources: SystemResourceCheck;

  // Analysis
  recommendations: string[];
  probableCause: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface NatsHealthCheck {
  connected: boolean;
  serverInfo: string | null;
  pendingMessages: number;
  streamHealth: StreamHealthInfo[];
  latencyMs: number | null;
  error: string | null;
}

interface StreamHealthInfo {
  name: string;
  messages: number;
  pending: number;
  consumerCount: number;
}

export interface DatabaseHealthCheck {
  connected: boolean;
  latencyMs: number | null;
  activeConnections: number;
  maxConnections: number;
  slowQueries: SlowQueryInfo[];
  error: string | null;
}

interface SlowQueryInfo {
  query: string;
  durationMs: number;
  state: string;
}

export interface HostListenerHealthCheck {
  recentSpawns: SpawnInfo[];
  successRate: number;
  failedSpawns: number;
  averageSpawnTimeMs: number;
  error: string | null;
}

interface SpawnInfo {
  reqNumber: string;
  agent: string;
  success: boolean;
  durationMs: number;
  exitCode: number | null;
  timestamp: string;
}

export interface SystemResourceCheck {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  memoryFreeMb: number;
  diskUsagePercent: number | null;
  loadAverage: number[];
  uptime: number;
}

// Phase E: Common root cause patterns with auto-fix recommendations
const ROOT_CAUSE_PATTERNS: {
  pattern: RegExp;
  rootCause: string;
  fixTitle: string;
  fixDescription: string;
  assignedAgent: string;
  priority: string;
}[] = [
  {
    pattern: /no consumers/i,
    rootCause: 'Host Listener not running',
    fixTitle: 'Host Listener consumer missing - restart required',
    fixDescription: 'The Host Listener service is not consuming audit messages. This prevents agents from being spawned.\n\n**Fix:** Restart Host Listener service or investigate why it crashed.',
    assignedAgent: 'marcus',
    priority: 'critical',
  },
  {
    pattern: /database.*latency.*high|slow.*queries/i,
    rootCause: 'Database performance degradation',
    fixTitle: 'Database performance issue - slow queries detected',
    fixDescription: 'Database queries are taking too long. This may be due to missing indexes, lock contention, or resource exhaustion.\n\n**Fix:** Review slow query log, add indexes, or scale database resources.',
    assignedAgent: 'roy',
    priority: 'high',
  },
  {
    pattern: /memory.*exhaustion|memory usage.*9\d%/i,
    rootCause: 'Memory exhaustion',
    fixTitle: 'Memory exhaustion detected - system scaling required',
    fixDescription: 'System memory is critically low. Processes may be killed by OOM killer.\n\n**Fix:** Add memory to the system, identify memory leaks, or implement pagination for large operations.',
    assignedAgent: 'marcus',
    priority: 'critical',
  },
  {
    pattern: /cpu.*overload|cpu usage.*9\d%/i,
    rootCause: 'CPU overload',
    fixTitle: 'CPU overload detected - performance optimization required',
    fixDescription: 'System CPU is maxed out. This causes all operations to slow down.\n\n**Fix:** Scale compute resources, optimize CPU-intensive operations, or schedule heavy tasks off-peak.',
    assignedAgent: 'marcus',
    priority: 'critical',
  },
  {
    pattern: /spawn.*failure|failed spawns/i,
    rootCause: 'Agent spawn failures',
    fixTitle: 'Agent spawn failures - Host Listener investigation required',
    fixDescription: 'Multiple agent spawns have failed. This may indicate configuration issues, resource limits, or Claude CLI problems.\n\n**Fix:** Check Host Listener logs, verify Claude CLI installation, and check resource limits.',
    assignedAgent: 'marcus',
    priority: 'high',
  },
  {
    pattern: /nats.*connection.*failed|nats.*latency.*high/i,
    rootCause: 'NATS messaging issues',
    fixTitle: 'NATS messaging issues - message broker investigation required',
    fixDescription: 'NATS message broker is having connectivity or performance issues. This affects all inter-service communication.\n\n**Fix:** Check NATS server health, verify network connectivity, and review NATS logs.',
    assignedAgent: 'marcus',
    priority: 'critical',
  },
];

export class AuditDiagnosticsService {
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private db: Pool | null = null;

  constructor(nc: NatsConnection | null, db: Pool | null) {
    this.nc = nc;
    if (nc) {
      this.js = nc.jetstream();
    }
    this.db = db;
  }

  /**
   * Phase E: Detect root cause patterns and return auto-fix REQs to create
   */
  detectRootCausePatterns(report: DiagnosticReport): {
    rootCause: string;
    fixTitle: string;
    fixDescription: string;
    assignedAgent: string;
    priority: string;
  }[] {
    const detectedFixes: typeof ROOT_CAUSE_PATTERNS = [];

    // Check each recommendation against known patterns
    const allText = [
      report.probableCause || '',
      ...report.recommendations,
    ].join('\n');

    for (const pattern of ROOT_CAUSE_PATTERNS) {
      if (pattern.pattern.test(allText)) {
        // Avoid duplicates
        if (!detectedFixes.some(f => f.rootCause === pattern.rootCause)) {
          detectedFixes.push(pattern);
          console.log(`[Diagnostics] Detected root cause pattern: ${pattern.rootCause}`);
        }
      }
    }

    return detectedFixes;
  }

  /**
   * Run full diagnostics for a failed audit
   */
  async runDiagnostics(auditReqNumber: string, durationMinutes: number): Promise<DiagnosticReport> {
    console.log(`[Diagnostics] Running diagnostics for failed audit: ${auditReqNumber}`);

    const startTime = Date.now();

    // Run all checks in parallel for speed
    const [natsHealth, databaseHealth, hostListenerHealth, systemResources] = await Promise.all([
      this.checkNatsHealth(),
      this.checkDatabaseHealth(),
      this.checkHostListenerHealth(auditReqNumber),
      this.checkSystemResources(),
    ]);

    // Analyze results and generate recommendations
    const { recommendations, probableCause, severity } = this.analyzeResults(
      natsHealth,
      databaseHealth,
      hostListenerHealth,
      systemResources,
      durationMinutes
    );

    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      auditReqNumber,
      duration: Date.now() - startTime,
      natsHealth,
      databaseHealth,
      hostListenerHealth,
      systemResources,
      recommendations,
      probableCause,
      severity,
    };

    console.log(`[Diagnostics] Completed in ${report.duration}ms. Probable cause: ${probableCause || 'Unknown'}`);

    return report;
  }

  /**
   * Check NATS connectivity and stream health
   */
  private async checkNatsHealth(): Promise<NatsHealthCheck> {
    if (!this.nc) {
      return {
        connected: false,
        serverInfo: null,
        pendingMessages: 0,
        streamHealth: [],
        latencyMs: null,
        error: 'No NATS connection',
      };
    }

    try {
      const startTime = Date.now();

      // Check connection
      const serverInfo = this.nc.info?.server_name || 'unknown';

      // Measure latency with a ping
      await this.nc.flush();
      const latencyMs = Date.now() - startTime;

      // Check relevant streams
      const jsm = await this.nc.jetstreamManager();
      const streamHealth: StreamHealthInfo[] = [];

      const streamsToCheck = ['agog_audit_requests', 'agog_orchestrator', 'agog_agent_requests'];

      for (const streamName of streamsToCheck) {
        try {
          const streamInfo = await jsm.streams.info(streamName);
          const consumers = await jsm.consumers.list(streamName).next();

          streamHealth.push({
            name: streamName,
            messages: streamInfo.state.messages,
            pending: streamInfo.state.messages - (streamInfo.state.consumer_count > 0 ? 0 : streamInfo.state.messages),
            consumerCount: streamInfo.state.consumer_count,
          });
        } catch {
          // Stream doesn't exist - not necessarily an error
        }
      }

      // Calculate total pending messages
      const pendingMessages = streamHealth.reduce((sum, s) => sum + s.pending, 0);

      return {
        connected: true,
        serverInfo,
        pendingMessages,
        streamHealth,
        latencyMs,
        error: null,
      };
    } catch (error: any) {
      return {
        connected: false,
        serverInfo: null,
        pendingMessages: 0,
        streamHealth: [],
        latencyMs: null,
        error: error.message,
      };
    }
  }

  /**
   * Check database connectivity and query performance
   */
  private async checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
    if (!this.db) {
      return {
        connected: false,
        latencyMs: null,
        activeConnections: 0,
        maxConnections: 0,
        slowQueries: [],
        error: 'No database connection',
      };
    }

    try {
      const startTime = Date.now();

      // Test connection
      await this.db.query('SELECT 1');
      const latencyMs = Date.now() - startTime;

      // Check connection pool status
      const poolStats = await this.db.query(`
        SELECT count(*) as active,
               (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn
        FROM pg_stat_activity
        WHERE state = 'active'
      `);

      const activeConnections = parseInt(poolStats.rows[0]?.active || '0');
      const maxConnections = parseInt(poolStats.rows[0]?.max_conn || '100');

      // Check for slow queries (queries running > 10 seconds)
      const slowQueryResult = await this.db.query(`
        SELECT query,
               EXTRACT(EPOCH FROM (now() - query_start)) * 1000 as duration_ms,
               state
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query NOT LIKE '%pg_stat_activity%'
          AND query_start < now() - interval '10 seconds'
        ORDER BY query_start
        LIMIT 5
      `);

      const slowQueries: SlowQueryInfo[] = slowQueryResult.rows.map((row: any) => ({
        query: row.query.substring(0, 200) + (row.query.length > 200 ? '...' : ''),
        durationMs: Math.round(row.duration_ms),
        state: row.state,
      }));

      return {
        connected: true,
        latencyMs,
        activeConnections,
        maxConnections,
        slowQueries,
        error: null,
      };
    } catch (error: any) {
      return {
        connected: false,
        latencyMs: null,
        activeConnections: 0,
        maxConnections: 0,
        slowQueries: [],
        error: error.message,
      };
    }
  }

  /**
   * Check Host Listener spawn history
   */
  private async checkHostListenerHealth(auditReqNumber: string): Promise<HostListenerHealthCheck> {
    if (!this.db) {
      return {
        recentSpawns: [],
        successRate: 0,
        failedSpawns: 0,
        averageSpawnTimeMs: 0,
        error: 'No database connection',
      };
    }

    try {
      // Check agent_spawn_history table if it exists
      const tableExists = await this.db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'agent_spawn_history'
        )
      `);

      if (!tableExists.rows[0]?.exists) {
        // Table doesn't exist - return empty results
        return {
          recentSpawns: [],
          successRate: 0,
          failedSpawns: 0,
          averageSpawnTimeMs: 0,
          error: 'agent_spawn_history table does not exist',
        };
      }

      // Get recent spawn history
      const recentSpawnsResult = await this.db.query(`
        SELECT req_number, agent, success, duration_ms, exit_code, created_at
        FROM agent_spawn_history
        WHERE created_at > NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 20
      `);

      const recentSpawns: SpawnInfo[] = recentSpawnsResult.rows.map((row: any) => ({
        reqNumber: row.req_number,
        agent: row.agent,
        success: row.success,
        durationMs: row.duration_ms,
        exitCode: row.exit_code,
        timestamp: row.created_at,
      }));

      // Calculate stats
      const successCount = recentSpawns.filter(s => s.success).length;
      const failedSpawns = recentSpawns.filter(s => !s.success).length;
      const successRate = recentSpawns.length > 0 ? (successCount / recentSpawns.length) * 100 : 0;
      const averageSpawnTimeMs = recentSpawns.length > 0
        ? recentSpawns.reduce((sum, s) => sum + (s.durationMs || 0), 0) / recentSpawns.length
        : 0;

      return {
        recentSpawns,
        successRate,
        failedSpawns,
        averageSpawnTimeMs,
        error: null,
      };
    } catch (error: any) {
      return {
        recentSpawns: [],
        successRate: 0,
        failedSpawns: 0,
        averageSpawnTimeMs: 0,
        error: error.message,
      };
    }
  }

  /**
   * Check system resource usage
   */
  private checkSystemResources(): SystemResourceCheck {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calculate CPU usage (average across cores)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const cpuUsagePercent = Math.round(((totalTick - totalIdle) / totalTick) * 100);
    const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);
    const memoryFreeMb = Math.round(freeMem / 1024 / 1024);
    const loadAverage = os.loadavg();
    const uptime = os.uptime();

    return {
      cpuUsagePercent,
      memoryUsagePercent,
      memoryFreeMb,
      diskUsagePercent: null, // Would need fs module for disk check
      loadAverage,
      uptime,
    };
  }

  /**
   * Analyze diagnostic results and generate recommendations
   */
  private analyzeResults(
    nats: NatsHealthCheck,
    db: DatabaseHealthCheck,
    hostListener: HostListenerHealthCheck,
    system: SystemResourceCheck,
    durationMinutes: number
  ): { recommendations: string[]; probableCause: string | null; severity: 'low' | 'medium' | 'high' | 'critical' } {
    const recommendations: string[] = [];
    let probableCause: string | null = null;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    // Check NATS issues
    if (!nats.connected) {
      recommendations.push('CRITICAL: NATS connection failed. Check NATS server status and network connectivity.');
      probableCause = 'NATS connectivity failure';
      severity = 'critical';
    } else if (nats.latencyMs && nats.latencyMs > 500) {
      recommendations.push(`HIGH: NATS latency is high (${nats.latencyMs}ms). Check network or NATS server load.`);
      if (!probableCause) probableCause = 'High NATS latency';
      severity = 'high';
    } else if (nats.pendingMessages > 100) {
      recommendations.push(`MEDIUM: ${nats.pendingMessages} messages pending in streams. Consumers may be slow or offline.`);
      if (!probableCause) probableCause = 'Message queue backlog';
    }

    // Check stream consumer health
    for (const stream of nats.streamHealth) {
      if (stream.consumerCount === 0 && stream.messages > 0) {
        recommendations.push(`HIGH: Stream ${stream.name} has ${stream.messages} messages but no consumers. Host Listener may not be running.`);
        if (!probableCause) probableCause = 'No consumers for audit stream';
        severity = 'high';
      }
    }

    // Check database issues
    if (!db.connected) {
      recommendations.push('CRITICAL: Database connection failed. Check PostgreSQL status and connection settings.');
      probableCause = 'Database connectivity failure';
      severity = 'critical';
    } else if (db.latencyMs && db.latencyMs > 1000) {
      recommendations.push(`HIGH: Database latency is high (${db.latencyMs}ms). Check database server load.`);
      if (!probableCause) probableCause = 'High database latency';
      severity = 'high';
    }

    if (db.slowQueries.length > 0) {
      recommendations.push(`HIGH: ${db.slowQueries.length} slow queries detected (>10s). Optimize these queries or add indexes.`);
      if (!probableCause) probableCause = 'Slow database queries';
      severity = 'high';
    }

    if (db.activeConnections > db.maxConnections * 0.8) {
      recommendations.push(`MEDIUM: Database connection pool is ${Math.round((db.activeConnections / db.maxConnections) * 100)}% utilized. Consider increasing max_connections.`);
    }

    // Check Host Listener issues
    if (hostListener.error && hostListener.error.includes('does not exist')) {
      recommendations.push('LOW: agent_spawn_history table missing. Create table to enable spawn tracking diagnostics.');
    } else if (hostListener.successRate < 50) {
      recommendations.push(`CRITICAL: Host Listener spawn success rate is only ${Math.round(hostListener.successRate)}%. Check agent configuration and system resources.`);
      if (!probableCause) probableCause = 'High agent spawn failure rate';
      severity = 'critical';
    } else if (hostListener.failedSpawns > 3) {
      recommendations.push(`HIGH: ${hostListener.failedSpawns} failed spawns in the last hour. Review Host Listener logs for errors.`);
      if (!probableCause) probableCause = 'Agent spawn failures';
      severity = 'high';
    }

    // Check system resource issues
    if (system.cpuUsagePercent > 90) {
      recommendations.push(`CRITICAL: CPU usage is ${system.cpuUsagePercent}%. System may be overloaded.`);
      if (!probableCause) probableCause = 'CPU overload';
      severity = 'critical';
    } else if (system.cpuUsagePercent > 70) {
      recommendations.push(`MEDIUM: CPU usage is ${system.cpuUsagePercent}%. Consider scaling resources.`);
    }

    if (system.memoryUsagePercent > 90) {
      recommendations.push(`CRITICAL: Memory usage is ${system.memoryUsagePercent}%. System may be swapping. Free memory: ${system.memoryFreeMb}MB`);
      if (!probableCause) probableCause = 'Memory exhaustion';
      severity = 'critical';
    } else if (system.memoryUsagePercent > 80) {
      recommendations.push(`HIGH: Memory usage is ${system.memoryUsagePercent}%. Free memory: ${system.memoryFreeMb}MB`);
      if (!probableCause) probableCause = 'High memory usage';
      severity = 'high';
    }

    // Check load average (1 min average > CPU count suggests overload)
    const cpuCount = os.cpus().length;
    if (system.loadAverage[0] > cpuCount * 2) {
      recommendations.push(`HIGH: System load average (${system.loadAverage[0].toFixed(2)}) is very high for ${cpuCount} CPUs.`);
      if (!probableCause) probableCause = 'System overload';
      severity = 'high';
    }

    // Duration-based recommendations
    if (durationMinutes > 120) {
      recommendations.push(`HIGH: Audit ran for ${durationMinutes} minutes before timeout. Consider increasing timeout or optimizing audit queries.`);
    }

    // If no issues found
    if (recommendations.length === 0) {
      recommendations.push('No obvious issues detected. The timeout may be due to transient network issues or an agent crash that left no trace.');
      probableCause = 'Unknown - possibly transient failure or agent crash';
      severity = 'medium';
    }

    return { recommendations, probableCause, severity };
  }

  /**
   * Format diagnostic report as markdown for P0 REQ description
   */
  formatReportAsMarkdown(report: DiagnosticReport): string {
    const sections: string[] = [];

    sections.push(`## Diagnostic Report`);
    sections.push(`**Generated:** ${report.timestamp}`);
    sections.push(`**Audit:** ${report.auditReqNumber}`);
    sections.push(`**Diagnostic Duration:** ${report.duration}ms`);
    sections.push(`**Severity:** ${report.severity.toUpperCase()}`);
    sections.push(`**Probable Cause:** ${report.probableCause || 'Unknown'}`);
    sections.push('');

    // Recommendations
    sections.push(`### Recommendations`);
    for (const rec of report.recommendations) {
      sections.push(`- ${rec}`);
    }
    sections.push('');

    // NATS Health
    sections.push(`### NATS Health`);
    sections.push(`| Metric | Value |`);
    sections.push(`|--------|-------|`);
    sections.push(`| Connected | ${report.natsHealth.connected ? 'Yes' : 'No'} |`);
    sections.push(`| Server | ${report.natsHealth.serverInfo || 'N/A'} |`);
    sections.push(`| Latency | ${report.natsHealth.latencyMs ? `${report.natsHealth.latencyMs}ms` : 'N/A'} |`);
    sections.push(`| Pending Messages | ${report.natsHealth.pendingMessages} |`);
    if (report.natsHealth.error) {
      sections.push(`| Error | ${report.natsHealth.error} |`);
    }
    sections.push('');

    // Stream Health
    if (report.natsHealth.streamHealth.length > 0) {
      sections.push(`### Stream Health`);
      sections.push(`| Stream | Messages | Pending | Consumers |`);
      sections.push(`|--------|----------|---------|-----------|`);
      for (const stream of report.natsHealth.streamHealth) {
        sections.push(`| ${stream.name} | ${stream.messages} | ${stream.pending} | ${stream.consumerCount} |`);
      }
      sections.push('');
    }

    // Database Health
    sections.push(`### Database Health`);
    sections.push(`| Metric | Value |`);
    sections.push(`|--------|-------|`);
    sections.push(`| Connected | ${report.databaseHealth.connected ? 'Yes' : 'No'} |`);
    sections.push(`| Latency | ${report.databaseHealth.latencyMs ? `${report.databaseHealth.latencyMs}ms` : 'N/A'} |`);
    sections.push(`| Active Connections | ${report.databaseHealth.activeConnections}/${report.databaseHealth.maxConnections} |`);
    if (report.databaseHealth.error) {
      sections.push(`| Error | ${report.databaseHealth.error} |`);
    }
    sections.push('');

    // Slow Queries
    if (report.databaseHealth.slowQueries.length > 0) {
      sections.push(`### Slow Queries (>10s)`);
      for (const query of report.databaseHealth.slowQueries) {
        sections.push(`- **${query.durationMs}ms** (${query.state}): \`${query.query}\``);
      }
      sections.push('');
    }

    // System Resources
    sections.push(`### System Resources`);
    sections.push(`| Metric | Value |`);
    sections.push(`|--------|-------|`);
    sections.push(`| CPU Usage | ${report.systemResources.cpuUsagePercent}% |`);
    sections.push(`| Memory Usage | ${report.systemResources.memoryUsagePercent}% |`);
    sections.push(`| Free Memory | ${report.systemResources.memoryFreeMb}MB |`);
    sections.push(`| Load Average | ${report.systemResources.loadAverage.map(l => l.toFixed(2)).join(', ')} |`);
    sections.push(`| Uptime | ${Math.round(report.systemResources.uptime / 3600)}h |`);
    sections.push('');

    // Host Listener Health
    if (report.hostListenerHealth.recentSpawns.length > 0) {
      sections.push(`### Host Listener Health`);
      sections.push(`| Metric | Value |`);
      sections.push(`|--------|-------|`);
      sections.push(`| Success Rate | ${Math.round(report.hostListenerHealth.successRate)}% |`);
      sections.push(`| Failed Spawns (1h) | ${report.hostListenerHealth.failedSpawns} |`);
      sections.push(`| Avg Spawn Time | ${Math.round(report.hostListenerHealth.averageSpawnTimeMs)}ms |`);
      sections.push('');
    }

    return sections.join('\n');
  }
}
