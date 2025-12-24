import React from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Database,
  RefreshCw,
  TrendingUp,
  Zap,
  Clock,
  Target,
  Server,
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_BIN_OPTIMIZATION_HEALTH } from '../graphql/queries/binUtilizationHealth';

// TypeScript interfaces
interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  message: string;
  lastRefresh?: string;
  accuracy?: number;
  sampleSize?: number;
  aisleCount?: number;
  queryTimeMs?: number;
  processingTimeMs?: number;
  note?: string;
}

interface HealthChecks {
  materializedViewFreshness: HealthCheckResult;
  mlModelAccuracy: HealthCheckResult;
  congestionCacheHealth: HealthCheckResult;
  databasePerformance: HealthCheckResult;
  algorithmPerformance: HealthCheckResult;
}

interface BinOptimizationHealthCheck {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  checks: HealthChecks;
  timestamp: string;
}

const HealthStatusIcon: React.FC<{ status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' }> = ({ status }) => {
  switch (status) {
    case 'HEALTHY':
      return <CheckCircle className="h-6 w-6 text-success-600" />;
    case 'DEGRADED':
      return <AlertTriangle className="h-6 w-6 text-warning-600" />;
    case 'UNHEALTHY':
      return <AlertCircle className="h-6 w-6 text-danger-600" />;
  }
};

const HealthStatusBadge: React.FC<{ status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' }> = ({ status }) => {
  const colorClass =
    status === 'HEALTHY'
      ? 'bg-success-100 text-success-800 border-success-200'
      : status === 'DEGRADED'
      ? 'bg-warning-100 text-warning-800 border-warning-200'
      : 'bg-danger-100 text-danger-800 border-danger-200';

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${colorClass}`}>
      {status}
    </span>
  );
};

const HealthCheckCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  check: HealthCheckResult;
  details?: React.ReactNode;
}> = ({ title, icon, check, details }) => {
  const borderColorClass =
    check.status === 'HEALTHY'
      ? 'border-success-500'
      : check.status === 'DEGRADED'
      ? 'border-warning-500'
      : 'border-danger-500';

  return (
    <div className={`card border-l-4 ${borderColorClass}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {icon}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <HealthStatusIcon status={check.status} />
      </div>

      <p className="text-sm text-gray-700 mb-3">{check.message}</p>

      {details && <div className="mt-3 pt-3 border-t border-gray-200">{details}</div>}
    </div>
  );
};

export const BinOptimizationHealthDashboard: React.FC = () => {
  const { t } = useTranslation();

  const { data, loading, error, refetch } = useQuery<{
    getBinOptimizationHealth: BinOptimizationHealthCheck;
  }>(GET_BIN_OPTIMIZATION_HEALTH, {
    pollInterval: 30000, // Refresh every 30 seconds
  });

  const healthData = data?.getBinOptimizationHealth;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-danger-600 mx-auto" />
          <p className="mt-4 text-gray-600">
            {t('common.error')}: {error.message}
          </p>
        </div>
      </div>
    );
  }

  const overallStatus = healthData?.status || 'UNHEALTHY';
  const checks = healthData?.checks;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('healthMonitoring.title')}
            </h1>
            <HealthStatusBadge status={overallStatus} />
          </div>
          <Breadcrumb />
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>{t('healthMonitoring.refresh')}</span>
        </button>
      </div>

      {/* Overall Status Card */}
      <div
        className={`card border-l-4 ${
          overallStatus === 'HEALTHY'
            ? 'border-success-500 bg-success-50'
            : overallStatus === 'DEGRADED'
            ? 'border-warning-500 bg-warning-50'
            : 'border-danger-500 bg-danger-50'
        }`}
      >
        <div className="flex items-center space-x-4">
          <HealthStatusIcon status={overallStatus} />
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              {t('healthMonitoring.overallStatus')}
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              {overallStatus === 'HEALTHY'
                ? t('healthMonitoring.allSystemsOperational')
                : overallStatus === 'DEGRADED'
                ? t('healthMonitoring.performanceIssuesDetected')
                : t('healthMonitoring.criticalIssuesDetected')}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {t('healthMonitoring.lastChecked')}:{' '}
              {healthData?.timestamp
                ? new Date(healthData.timestamp).toLocaleString()
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Health Check Grid */}
      {checks && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Materialized View Freshness */}
          <HealthCheckCard
            title={t('healthMonitoring.materializedViewFreshness')}
            icon={<Database className="h-6 w-6 text-primary-600" />}
            check={checks.materializedViewFreshness}
            details={
              checks.materializedViewFreshness.lastRefresh && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {t('healthMonitoring.lastRefresh')}:
                    </span>
                    <span className="font-medium">
                      {new Date(checks.materializedViewFreshness.lastRefresh).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{t('healthMonitoring.cacheTarget')}: &lt;10 minutes</span>
                  </div>
                </div>
              )
            }
          />

          {/* ML Model Accuracy */}
          <HealthCheckCard
            title={t('healthMonitoring.mlModelAccuracy')}
            icon={<Target className="h-6 w-6 text-primary-600" />}
            check={checks.mlModelAccuracy}
            details={
              checks.mlModelAccuracy.accuracy !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {t('healthMonitoring.currentAccuracy')}:
                    </span>
                    <span className="text-lg font-bold text-primary-600">
                      {checks.mlModelAccuracy.accuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        checks.mlModelAccuracy.accuracy >= 85
                          ? 'bg-success-500'
                          : checks.mlModelAccuracy.accuracy >= 75
                          ? 'bg-warning-500'
                          : 'bg-danger-500'
                      }`}
                      style={{ width: `${Math.min(checks.mlModelAccuracy.accuracy, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {t('healthMonitoring.sampleSize')}: {checks.mlModelAccuracy.sampleSize}
                    </span>
                    <span>{t('healthMonitoring.target')}: 95%</span>
                  </div>
                </div>
              )
            }
          />

          {/* Congestion Cache Health */}
          <HealthCheckCard
            title={t('healthMonitoring.congestionCacheHealth')}
            icon={<TrendingUp className="h-6 w-6 text-primary-600" />}
            check={checks.congestionCacheHealth}
            details={
              checks.congestionCacheHealth.aisleCount !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {t('healthMonitoring.trackedAisles')}:
                  </span>
                  <span className="font-medium text-lg text-primary-600">
                    {checks.congestionCacheHealth.aisleCount}
                  </span>
                </div>
              )
            }
          />

          {/* Database Performance */}
          <HealthCheckCard
            title={t('healthMonitoring.databasePerformance')}
            icon={<Server className="h-6 w-6 text-primary-600" />}
            check={checks.databasePerformance}
            details={
              checks.databasePerformance.queryTimeMs !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {t('healthMonitoring.queryTime')}:
                    </span>
                    <span className="text-lg font-bold text-primary-600">
                      {checks.databasePerformance.queryTimeMs}ms
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        checks.databasePerformance.queryTimeMs <= 10
                          ? 'bg-success-500'
                          : checks.databasePerformance.queryTimeMs <= 100
                          ? 'bg-warning-500'
                          : 'bg-danger-500'
                      }`}
                      style={{
                        width: `${Math.min((checks.databasePerformance.queryTimeMs / 100) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {t('healthMonitoring.target')}: &lt;10ms
                  </div>
                </div>
              )
            }
          />

          {/* Algorithm Performance */}
          <HealthCheckCard
            title={t('healthMonitoring.algorithmPerformance')}
            icon={<Zap className="h-6 w-6 text-primary-600" />}
            check={checks.algorithmPerformance}
            details={
              <div className="space-y-2">
                {checks.algorithmPerformance.processingTimeMs !== undefined && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('healthMonitoring.processingTime')}:
                      </span>
                      <span className="text-lg font-bold text-primary-600">
                        {checks.algorithmPerformance.processingTimeMs}ms
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {t('healthMonitoring.testSize')}: 10 items
                    </div>
                  </>
                )}
                {checks.algorithmPerformance.note && (
                  <div className="text-xs text-gray-500 italic">
                    {checks.algorithmPerformance.note}
                  </div>
                )}
              </div>
            }
          />
        </div>
      )}

      {/* System Information */}
      <div className="card bg-gray-50">
        <div className="flex items-start space-x-3">
          <Activity className="h-6 w-6 text-gray-600 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('healthMonitoring.systemInformation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">{t('healthMonitoring.algorithmVersion')}:</p>
                <p className="font-medium">Best Fit Decreasing Enhanced (V2.0)</p>
              </div>
              <div>
                <p className="text-gray-600">{t('healthMonitoring.optimizationFeatures')}:</p>
                <p className="font-medium">
                  ABC Reclassification, ML Confidence Adjustment, Cross-dock Detection
                </p>
              </div>
              <div>
                <p className="text-gray-600">{t('healthMonitoring.monitoringFrequency')}:</p>
                <p className="font-medium">Every 30 seconds</p>
              </div>
              <div>
                <p className="text-gray-600">{t('healthMonitoring.phase')}:</p>
                <p className="font-medium">Phase 3A - Operational Excellence</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {overallStatus !== 'HEALTHY' && (
        <div
          className={`card border-l-4 ${
            overallStatus === 'DEGRADED' ? 'border-warning-500 bg-warning-50' : 'border-danger-500 bg-danger-50'
          }`}
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle
              className={`h-6 w-6 mt-1 ${
                overallStatus === 'DEGRADED' ? 'text-warning-600' : 'text-danger-600'
              }`}
            />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('healthMonitoring.recommendations')}
              </h3>
              <ul className="space-y-2 text-sm">
                {checks?.materializedViewFreshness.status !== 'HEALTHY' && (
                  <li className="text-gray-700">
                    <strong>{t('healthMonitoring.materializedViewFreshness')}:</strong>{' '}
                    {t('healthMonitoring.refreshCacheRecommendation')}
                  </li>
                )}
                {checks?.mlModelAccuracy.status !== 'HEALTHY' && (
                  <li className="text-gray-700">
                    <strong>{t('healthMonitoring.mlModelAccuracy')}:</strong>{' '}
                    {t('healthMonitoring.reviewMLRecommendation')}
                  </li>
                )}
                {checks?.databasePerformance.status !== 'HEALTHY' && (
                  <li className="text-gray-700">
                    <strong>{t('healthMonitoring.databasePerformance')}:</strong>{' '}
                    {t('healthMonitoring.checkDatabaseRecommendation')}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
