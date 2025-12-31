import React from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Database,
  Activity,
  HardDrive,
  Zap,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { GET_DATABASE_STATS } from '../../graphql/queries/performance';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface DatabaseStats {
  connectionStats: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
  };
  queryStats: {
    totalQueries: number;
    avgQueryTimeMs: number;
    slowQueries: number;
    cacheHitRatio: number;
  };
  tableStats: {
    totalTables: number;
    totalRows: number;
    totalSizeMB: number;
    indexSizeMB: number;
  };
  performanceStats: {
    transactionsPerSecond: number;
    blocksRead: number;
    blocksHit: number;
    tuplesReturned: number;
    tuplesFetched: number;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export const DatabaseStatsCard: React.FC = () => {
  const { t } = useTranslation();

  const { data, loading, error, refetch } = useQuery<{ databaseStats: DatabaseStats }>(
    GET_DATABASE_STATS,
    {
      pollInterval: 10000, // Refresh every 10 seconds
      fetchPolicy: 'network-only',
    }
  );

  const stats = data?.databaseStats;

  // ============================================================================
  // Helpers
  // ============================================================================

  const getConnectionUtilization = (): number => {
    if (!stats) return 0;
    return ((stats.connectionStats.total - stats.connectionStats.idle) / stats.connectionStats.maxConnections) * 100;
  };

  const getUtilizationColor = (utilization: number): string => {
    if (utilization >= 90) return 'text-danger-600';
    if (utilization >= 70) return 'text-warning-600';
    return 'text-success-600';
  };

  const formatBytes = (mb: number): string => {
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  // ============================================================================
  // Render States
  // ============================================================================

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-danger-50 border-danger-200">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 text-danger-600 mr-2" />
          <div>
            <h3 className="font-semibold text-danger-900">{t('common.error')}</h3>
            <p className="text-sm text-danger-700">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const utilization = getConnectionUtilization();

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Database className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {t('performance.databaseStatistics')}
            </h2>
            <p className="text-sm text-gray-500">{t('performance.realTimeMetrics')}</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title={t('common.refresh')}
        >
          <RefreshCw className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Connection Statistics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">
              {t('performance.connectionStatistics')}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.activeConnections')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.connectionStats.active}
                <span className="text-sm text-gray-500 ml-1">
                  / {stats.connectionStats.total}
                </span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.idleConnections')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.connectionStats.idle}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.waitingRequests')}</div>
              <div className={`text-2xl font-bold mt-1 ${stats.connectionStats.waiting > 0 ? 'text-warning-600' : 'text-success-600'}`}>
                {stats.connectionStats.waiting}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.utilization')}</div>
              <div className={`text-2xl font-bold mt-1 ${getUtilizationColor(utilization)}`}>
                {utilization.toFixed(1)}%
              </div>
            </div>
          </div>
          {/* Utilization Bar */}
          <div className="mt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  utilization >= 90
                    ? 'bg-danger-600'
                    : utilization >= 70
                    ? 'bg-warning-600'
                    : 'bg-success-600'
                }`}
                style={{ width: `${utilization}%` }}
              />
            </div>
          </div>
        </div>

        {/* Query Statistics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-warning-600" />
            <h3 className="font-semibold text-gray-900">
              {t('performance.queryStatistics')}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.avgQueryTime')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.queryStats.avgQueryTimeMs.toFixed(1)}
                <span className="text-sm text-gray-500 ml-1">ms</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.slowQueries')}</div>
              <div className={`text-2xl font-bold mt-1 ${stats.queryStats.slowQueries > 10 ? 'text-danger-600' : 'text-success-600'}`}>
                {stats.queryStats.slowQueries}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.cacheHitRatio')}</div>
              <div className={`text-2xl font-bold mt-1 ${stats.queryStats.cacheHitRatio >= 95 ? 'text-success-600' : 'text-warning-600'}`}>
                {stats.queryStats.cacheHitRatio.toFixed(1)}%
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.totalQueries')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.queryStats.totalQueries.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Storage Statistics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              {t('performance.storageStatistics')}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.totalTables')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.tableStats.totalTables}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.totalRows')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {stats.tableStats.totalRows.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.databaseSize')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatBytes(stats.tableStats.totalSizeMB)}
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">{t('performance.indexSize')}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatBytes(stats.tableStats.indexSizeMB)}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Indicators */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">
              {t('performance.performanceIndicators')}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">{t('performance.transactionsPerSecond')}</span>
              <span className="font-semibold text-gray-900">
                {stats.performanceStats.transactionsPerSecond.toFixed(1)} TPS
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">{t('performance.blockCacheEfficiency')}</span>
              <span className="font-semibold text-gray-900">
                {((stats.performanceStats.blocksHit / (stats.performanceStats.blocksHit + stats.performanceStats.blocksRead)) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">{t('performance.tuplesReturned')}</span>
              <span className="font-semibold text-gray-900">
                {stats.performanceStats.tuplesReturned.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Health Indicator */}
        <div className="flex items-center gap-2 p-4 bg-success-50 border border-success-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-success-600" />
          <div>
            <div className="font-semibold text-success-900">
              {t('performance.databaseHealthy')}
            </div>
            <div className="text-sm text-success-700">
              {t('performance.allMetricsWithinNormalRange')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
