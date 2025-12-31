import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Zap,
  AlertTriangle,
  Database,
  Cpu,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DatabaseStatsCard } from '../components/monitoring/DatabaseStatsCard';
import { useAppStore } from '../store/appStore';
import { ColumnDef } from '@tanstack/react-table';
import {
  GET_PERFORMANCE_OVERVIEW,
  GET_SLOW_QUERIES,
  GET_ENDPOINT_METRICS,
  GET_RESOURCE_UTILIZATION,
  GET_DATABASE_POOL_METRICS,
} from '../graphql/queries/performance';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface PerformanceOverview {
  timeRange: string;
  healthScore: number;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'CRITICAL';
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  requestsPerSecond: number;
  errorRate: number;
  avgQueryTimeMs: number;
  slowQueryCount: number;
  connectionPoolUtilization: number;
  avgCpuUsagePercent: number;
  avgMemoryUsageMB: number;
  maxMemoryUsageMB: number;
  performanceTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL';
  topBottlenecks: PerformanceBottleneck[];
}

interface PerformanceBottleneck {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  impact: string;
  recommendation: string;
  affectedEndpoints: string[];
}

interface SlowQuery {
  id: string;
  queryHash: string;
  queryPreview: string;
  executionTimeMs: number;
  rowsReturned: number;
  endpoint: string;
  timestamp: string;
  occurrenceCount: number;
}

interface EndpointMetric {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  maxResponseTimeMs: number;
  avgRequestSizeBytes: number;
  avgResponseSizeBytes: number;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL';
}

interface ResourceMetric {
  timestamp: string;
  cpuUsagePercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  eventLoopLagMs: number;
  activeConnections: number;
  heapUsedMB: number;
  heapTotalMB: number;
}

interface DatabasePoolMetrics {
  currentConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalQueries: number;
  avgQueryTimeMs: number;
  utilizationPercent: number;
  utilizationHistory: PoolUtilizationPoint[];
}

interface PoolUtilizationPoint {
  timestamp: string;
  utilizationPercent: number;
  activeConnections: number;
  queuedRequests: number;
}

// ============================================================================
// Main Component
// ============================================================================

export const PerformanceAnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { preferences } = useAppStore();
  const facilityId = preferences.selectedFacility || null;

  // State management
  const [timeRange, setTimeRange] = useState<string>('LAST_HOUR');
  const [slowQueryThreshold, setSlowQueryThreshold] = useState<number>(1000);
  const [selectedEndpoint, _setSelectedEndpoint] = useState<string | null>(null);

  // ============================================================================
  // GraphQL Queries
  // ============================================================================

  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery<{ performanceOverview: PerformanceOverview }>(GET_PERFORMANCE_OVERVIEW, {
    variables: {
      facilityId,
      timeRange,
    },
    pollInterval: 30000, // Refresh every 30 seconds
  });

  const {
    data: slowQueriesData,
    loading: _slowQueriesLoading,
  } = useQuery<{ slowQueries: SlowQuery[] }>(GET_SLOW_QUERIES, {
    variables: {
      facilityId,
      threshold: slowQueryThreshold,
      timeRange,
      limit: 50,
    },
    pollInterval: 60000, // Refresh every minute
  });

  const {
    data: endpointMetricsData,
    loading: _endpointMetricsLoading,
  } = useQuery<{ endpointMetrics: EndpointMetric[] }>(GET_ENDPOINT_METRICS, {
    variables: {
      endpoint: selectedEndpoint,
      timeRange,
    },
    pollInterval: 30000,
  });

  const {
    data: resourceUtilizationData,
    loading: _resourceUtilizationLoading,
  } = useQuery<{ resourceUtilization: ResourceMetric[] }>(GET_RESOURCE_UTILIZATION, {
    variables: {
      facilityId,
      timeRange,
      interval: '5m',
    },
    pollInterval: 30000,
  });

  const {
    data: databasePoolData,
    loading: _databasePoolLoading,
  } = useQuery<{ databasePoolMetrics: DatabasePoolMetrics }>(GET_DATABASE_POOL_METRICS, {
    variables: {
      timeRange,
    },
    pollInterval: 30000,
  });

  // ============================================================================
  // Helpers
  // ============================================================================

  const getHealthStatusColor = (status: string): string => {
    switch (status) {
      case 'HEALTHY':
        return 'text-success-600 bg-success-100';
      case 'DEGRADED':
        return 'text-warning-600 bg-warning-100';
      case 'UNHEALTHY':
        return 'text-danger-600 bg-danger-100';
      case 'CRITICAL':
        return 'text-danger-700 bg-danger-200';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return <TrendingUp className="h-5 w-5 text-success-600" />;
      case 'DEGRADING':
        return <TrendingDown className="h-5 w-5 text-danger-600" />;
      case 'CRITICAL':
        return <AlertTriangle className="h-5 w-5 text-danger-700" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-danger-100 text-danger-700';
      case 'HIGH':
        return 'bg-warning-100 text-warning-700';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

    // ============================================================================
  // Table Columns
  // ============================================================================

  const slowQueriesColumns: ColumnDef<SlowQuery>[] = [
    {
      accessorKey: 'queryPreview',
      header: t('performance.queryPreview'),
      cell: ({ row }) => (
        <div className="font-mono text-xs truncate max-w-md" title={row.original.queryPreview}>
          {row.original.queryPreview}
        </div>
      ),
    },
    {
      accessorKey: 'executionTimeMs',
      header: t('performance.executionTime'),
      cell: ({ row }) => (
        <span className={row.original.executionTimeMs > 5000 ? 'text-danger-600 font-semibold' : ''}>
          {row.original.executionTimeMs.toLocaleString()} ms
        </span>
      ),
    },
    {
      accessorKey: 'rowsReturned',
      header: t('performance.rowsReturned'),
      cell: ({ row }) => row.original.rowsReturned.toLocaleString(),
    },
    {
      accessorKey: 'endpoint',
      header: t('performance.endpoint'),
      cell: ({ row }) => <span className="text-xs">{row.original.endpoint}</span>,
    },
    {
      accessorKey: 'occurrenceCount',
      header: t('performance.occurrences'),
      cell: ({ row }) => (
        <span className={row.original.occurrenceCount > 100 ? 'text-warning-600 font-semibold' : ''}>
          {row.original.occurrenceCount}
        </span>
      ),
    },
  ];

  const endpointMetricsColumns: ColumnDef<EndpointMetric>[] = [
    {
      accessorKey: 'endpoint',
      header: t('performance.endpoint'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.endpoint}</div>
          <div className="text-xs text-gray-500">{row.original.method}</div>
        </div>
      ),
    },
    {
      accessorKey: 'totalRequests',
      header: t('performance.requests'),
      cell: ({ row }) => (
        <div>
          <div>{row.original.totalRequests.toLocaleString()}</div>
          <div className="text-xs text-gray-500">
            {((row.original.successfulRequests / row.original.totalRequests) * 100).toFixed(1)}% success
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'avgResponseTimeMs',
      header: t('performance.avgResponse'),
      cell: ({ row }) => `${row.original.avgResponseTimeMs.toFixed(1)} ms`,
    },
    {
      accessorKey: 'p95ResponseTimeMs',
      header: 'P95',
      cell: ({ row }) => `${row.original.p95ResponseTimeMs.toFixed(1)} ms`,
    },
    {
      accessorKey: 'p99ResponseTimeMs',
      header: 'P99',
      cell: ({ row }) => `${row.original.p99ResponseTimeMs.toFixed(1)} ms`,
    },
    {
      accessorKey: 'trend',
      header: t('performance.trend'),
      cell: ({ row }) => getTrendIcon(row.original.trend),
    },
  ];

  // ============================================================================
  // Loading and Error States
  // ============================================================================

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2">{t('common.loading')}</span>
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="card bg-danger-50 border-danger-200">
        <div className="flex items-center">
          <AlertCircle className="h-6 w-6 text-danger-600 mr-2" />
          <div>
            <h3 className="font-semibold text-danger-900">{t('common.error')}</h3>
            <p className="text-sm text-danger-700">{overviewError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const overview = overviewData?.performanceOverview;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('performance.title')}</h1>
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="input"
          >
            <option value="LAST_HOUR">{t('performance.lastHour')}</option>
            <option value="LAST_6_HOURS">{t('performance.last6Hours')}</option>
            <option value="LAST_24_HOURS">{t('performance.last24Hours')}</option>
            <option value="LAST_7_DAYS">{t('performance.last7Days')}</option>
            <option value="LAST_30_DAYS">{t('performance.last30Days')}</option>
          </select>
          <button
            onClick={() => refetchOverview()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Health Status Overview */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Health Score */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('performance.healthScore')}</p>
                <p className="text-3xl font-bold mt-1">{overview.healthScore.toFixed(1)}</p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getHealthStatusColor(overview.status)}`}>
                  {overview.status}
                </span>
              </div>
              <Activity className="h-12 w-12 text-primary-500" />
            </div>
          </div>

          {/* Response Time */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('performance.avgResponseTime')}</p>
                <p className="text-3xl font-bold mt-1">{overview.avgResponseTimeMs.toFixed(0)}<span className="text-lg text-gray-500">ms</span></p>
                <p className="text-xs text-gray-500 mt-2">
                  P95: {overview.p95ResponseTimeMs.toFixed(0)}ms / P99: {overview.p99ResponseTimeMs.toFixed(0)}ms
                </p>
              </div>
              <Clock className="h-12 w-12 text-primary-500" />
            </div>
          </div>

          {/* Request Rate */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('performance.requestsPerSecond')}</p>
                <p className="text-3xl font-bold mt-1">{overview.requestsPerSecond.toFixed(1)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {t('performance.errorRate')}: {(overview.errorRate * 100).toFixed(2)}%
                </p>
              </div>
              <Zap className="h-12 w-12 text-warning-500" />
            </div>
          </div>

          {/* System Resources */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('performance.systemResources')}</p>
                <p className="text-lg font-bold mt-1">
                  CPU: {overview.avgCpuUsagePercent.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  RAM: {overview.avgMemoryUsageMB.toFixed(0)} / {overview.maxMemoryUsageMB.toFixed(0)} MB
                </p>
              </div>
              <Cpu className="h-12 w-12 text-success-500" />
            </div>
          </div>
        </div>
      )}

      {/* Performance Trend & Database Stats */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Trend */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('performance.performanceTrend')}</h2>
              {getTrendIcon(overview.performanceTrend)}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('performance.avgQueryTime')}</span>
                <span className="font-semibold">{overview.avgQueryTimeMs.toFixed(1)} ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('performance.slowQueries')}</span>
                <span className={`font-semibold ${overview.slowQueryCount > 10 ? 'text-danger-600' : ''}`}>
                  {overview.slowQueryCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('performance.connectionPoolUtilization')}</span>
                <span className={`font-semibold ${overview.connectionPoolUtilization > 80 ? 'text-warning-600' : ''}`}>
                  {overview.connectionPoolUtilization.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Database Pool Health */}
          {databasePoolData?.databasePoolMetrics && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{t('performance.databasePool')}</h2>
                <Database className="h-6 w-6 text-primary-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('performance.activeConnections')}</span>
                  <span className="font-semibold">
                    {databasePoolData.databasePoolMetrics.currentConnections - databasePoolData.databasePoolMetrics.idleConnections} / {databasePoolData.databasePoolMetrics.currentConnections}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('performance.idleConnections')}</span>
                  <span className="font-semibold">{databasePoolData.databasePoolMetrics.idleConnections}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('performance.waitingRequests')}</span>
                  <span className={`font-semibold ${databasePoolData.databasePoolMetrics.waitingRequests > 0 ? 'text-warning-600' : ''}`}>
                    {databasePoolData.databasePoolMetrics.waitingRequests}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('performance.utilization')}</span>
                  <span className={`font-semibold ${databasePoolData.databasePoolMetrics.utilizationPercent > 80 ? 'text-danger-600' : ''}`}>
                    {databasePoolData.databasePoolMetrics.utilizationPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resource Utilization Charts */}
      {resourceUtilizationData?.resourceUtilization && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Chart
            type="line"
            data={resourceUtilizationData.resourceUtilization.map(m => ({
              time: new Date(m.timestamp).toLocaleTimeString(),
              cpu: m.cpuUsagePercent,
            }))}
            xKey="time"
            yKey="cpu"
            title={t('performance.cpuUtilization')}
            height={250}
          />
          <Chart
            type="line"
            data={resourceUtilizationData.resourceUtilization.map(m => ({
              time: new Date(m.timestamp).toLocaleTimeString(),
              memory: m.memoryUsedMB,
            }))}
            xKey="time"
            yKey="memory"
            title={t('performance.memoryUtilization')}
            height={250}
          />
        </div>
      )}

      {/* Database Statistics Card */}
      <DatabaseStatsCard />

      {/* Performance Bottlenecks */}
      {overview && overview.topBottlenecks.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('performance.bottlenecks')}</h2>
          <div className="space-y-3">
            {overview.topBottlenecks.map((bottleneck, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(bottleneck.severity)}`}>
                        {bottleneck.severity}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{bottleneck.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm text-gray-900 mb-1">{bottleneck.description}</p>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">{t('performance.impact')}:</span> {bottleneck.impact}
                    </p>
                    <p className="text-sm text-primary-700">
                      <span className="font-medium">{t('performance.recommendation')}:</span> {bottleneck.recommendation}
                    </p>
                    {bottleneck.affectedEndpoints.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">{t('performance.affectedEndpoints')}:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bottleneck.affectedEndpoints.map((endpoint, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              {endpoint}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slow Queries Table */}
      {slowQueriesData?.slowQueries && slowQueriesData.slowQueries.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t('performance.slowQueries')}</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">{t('performance.threshold')}:</label>
              <input
                type="number"
                value={slowQueryThreshold}
                onChange={(e) => setSlowQueryThreshold(parseInt(e.target.value))}
                className="input w-24"
                min="100"
                step="100"
              />
              <span className="text-sm text-gray-600">ms</span>
            </div>
          </div>
          <DataTable
            columns={slowQueriesColumns}
            data={slowQueriesData.slowQueries}
          />
        </div>
      )}

      {/* Endpoint Performance Table */}
      {endpointMetricsData?.endpointMetrics && endpointMetricsData.endpointMetrics.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('performance.endpointPerformance')}</h2>
          <DataTable
            columns={endpointMetricsColumns}
            data={endpointMetricsData.endpointMetrics}
          />
        </div>
      )}
    </div>
  );
};
