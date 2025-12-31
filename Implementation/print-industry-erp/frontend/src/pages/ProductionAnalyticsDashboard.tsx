import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Play,
  Pause,
} from 'lucide-react';
import { KPICard } from '../components/common/KPICard';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAppStore } from '../store/appStore';
import { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import {
  GET_PRODUCTION_SUMMARY,
  GET_WORK_CENTER_SUMMARIES,
  GET_PRODUCTION_RUN_SUMMARIES,
  GET_OEE_TRENDS,
  GET_WORK_CENTER_UTILIZATION,
  GET_PRODUCTION_ALERTS,
} from '../graphql/queries/productionAnalytics';

interface ProductionRunSummary {
  id: string;
  productionRunNumber: string;
  productionOrderNumber: string;
  workCenterId: string;
  workCenterName: string;
  operatorName: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  quantityPlanned: number;
  quantityGood: number;
  quantityScrap: number;
  quantityRework: number;
  setupTimeMinutes?: number;
  runTimeMinutes?: number;
  downtimeMinutes?: number;
  progressPercentage: number;
  currentOEE?: number;
}

interface WorkCenterUtilization {
  workCenterId: string;
  workCenterName: string;
  status: string;
  currentProductionRunNumber?: string;
  currentOEE?: number;
  todayRuntime: number;
  todayDowntime: number;
  todaySetupTime: number;
  utilizationPercentage: number;
  activeRunProgress?: number;
}

interface ProductionAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  type: string;
  workCenterId?: string;
  workCenterName?: string;
  productionRunId?: string;
  message: string;
  timestamp: string;
}

export const ProductionAnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { preferences } = useAppStore();
  const selectedFacility = preferences.selectedFacility;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workCenterFilter, setWorkCenterFilter] = useState<string>('all');

  // GraphQL Queries with polling for real-time updates
  const { data: summaryData, loading: summaryLoading } = useQuery(GET_PRODUCTION_SUMMARY, {
    variables: { facilityId: selectedFacility },
    pollInterval: 30000, // Poll every 30 seconds
    skip: !selectedFacility,
  });

  const { data: workCenterData, loading: workCenterLoading } = useQuery(
    GET_WORK_CENTER_SUMMARIES,
    {
      variables: { facilityId: selectedFacility },
      pollInterval: 30000,
      skip: !selectedFacility,
    }
  );

  const { data: runSummariesData, loading: runSummariesLoading } = useQuery(
    GET_PRODUCTION_RUN_SUMMARIES,
    {
      variables: {
        facilityId: selectedFacility,
        workCenterId: workCenterFilter !== 'all' ? workCenterFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      },
      pollInterval: 5000, // Poll every 5 seconds for active runs
      skip: !selectedFacility,
    }
  );

  const { data: oeeTrendsData } = useQuery(GET_OEE_TRENDS, {
    variables: {
      facilityId: selectedFacility,
      workCenterId: workCenterFilter !== 'all' ? workCenterFilter : undefined,
    },
    pollInterval: 60000, // Poll every 60 seconds
    skip: !selectedFacility,
  });

  const { data: utilizationData } = useQuery(GET_WORK_CENTER_UTILIZATION, {
    variables: { facilityId: selectedFacility },
    pollInterval: 10000, // Poll every 10 seconds
    skip: !selectedFacility,
  });

  const { data: alertsData } = useQuery(GET_PRODUCTION_ALERTS, {
    variables: { facilityId: selectedFacility },
    pollInterval: 5000, // Poll every 5 seconds
    skip: !selectedFacility,
  });

  // Production run table columns
  const columns: ColumnDef<ProductionRunSummary>[] = useMemo(
    () => [
      {
        accessorKey: 'productionRunNumber',
        header: t('production.runNumber'),
        cell: (info) => (
          <span className="font-medium text-primary-600">{info.getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'productionOrderNumber',
        header: t('production.orderNumber'),
      },
      {
        accessorKey: 'workCenterName',
        header: t('production.workCenter'),
      },
      {
        accessorKey: 'operatorName',
        header: t('production.operator'),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              className={clsx(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                status === 'IN_PROGRESS' && 'bg-success-100 text-success-700',
                status === 'SCHEDULED' && 'bg-warning-100 text-warning-700',
                status === 'PAUSED' && 'bg-orange-100 text-orange-700',
                status === 'COMPLETED' && 'bg-gray-100 text-gray-700'
              )}
            >
              {status === 'IN_PROGRESS' && <Play className="h-3 w-3 mr-1" />}
              {status === 'SCHEDULED' && <Clock className="h-3 w-3 mr-1" />}
              {status === 'PAUSED' && <Pause className="h-3 w-3 mr-1" />}
              {status === 'COMPLETED' && <CheckCircle className="h-3 w-3 mr-1" />}
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: 'quantityPlanned',
        header: t('production.quantityPlanned'),
        cell: (info) => (info.getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'quantityGood',
        header: t('production.quantityGood'),
        cell: (info) => (info.getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'currentOEE',
        header: t('production.oee'),
        cell: (info) => {
          const oee = info.getValue() as number | undefined;
          if (!oee) return '-';
          return (
            <span
              className={clsx(
                'font-medium',
                oee >= 85 && 'text-success-600',
                oee >= 70 && oee < 85 && 'text-warning-600',
                oee < 70 && 'text-danger-600'
              )}
            >
              {oee.toFixed(1)}%
            </span>
          );
        },
      },
      {
        accessorKey: 'progressPercentage',
        header: t('production.progress'),
        cell: (info) => {
          const progress = info.getValue() as number;
          return (
            <div className="flex items-center space-x-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    progress >= 90 && 'bg-success-500',
                    progress >= 50 && progress < 90 && 'bg-primary-500',
                    progress < 50 && 'bg-warning-500'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12">{progress.toFixed(0)}%</span>
            </div>
          );
        },
      },
    ],
    [t]
  );

  // Format OEE trends data for chart
  const oeeTrendsChartData = useMemo(() => {
    if (!oeeTrendsData?.oEETrends) return [];
    return oeeTrendsData.oEETrends.map((trend: any) => ({
      date: new Date(trend.calculationDate).toLocaleDateString(),
      OEE: trend.oeePercentage,
      Availability: trend.availabilityPercentage,
      Performance: trend.performancePercentage,
      Quality: trend.qualityPercentage,
      Target: trend.targetOEEPercentage,
    }));
  }, [oeeTrendsData]);

  // Work center utilization chart data
  const utilizationChartData = useMemo(() => {
    if (!utilizationData?.workCenterUtilization) return [];
    return utilizationData.workCenterUtilization.map((wc: WorkCenterUtilization) => ({
      workCenter: wc.workCenterName,
      utilization: wc.utilizationPercentage,
      oee: wc.currentOEE || 0,
    }));
  }, [utilizationData]);

  // Loading state
  if (summaryLoading || workCenterLoading || runSummariesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const summary = summaryData?.productionSummary;
  const productionRuns = runSummariesData?.productionRunSummaries || [];
  const alerts = alertsData?.productionAlerts || [];

  // Calculate average yield
  const avgYield = summary?.averageYield || 0;
  const totalQuantity =
    (summary?.totalGoodQuantity || 0) +
    (summary?.totalScrapQuantity || 0) +
    (summary?.totalReworkQuantity || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('production.analyticsTitle')}
          </h1>
          <Breadcrumb />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title={t('production.activeRuns')}
          value={summary?.activeRuns?.toString() || '0'}
          trend={undefined}
          icon={Activity}
          color="blue"
        />
        <KPICard
          title={t('production.scheduledRuns')}
          value={summary?.scheduledRuns?.toString() || '0'}
          trend={undefined}
          icon={Clock}
          color="yellow"
        />
        <KPICard
          title={t('production.completedToday')}
          value={summary?.completedRunsToday?.toString() || '0'}
          trend={undefined}
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          title={t('production.averageOEE')}
          value={summary?.currentOEE?.toFixed(1) || '0'}
          suffix="%"
          trend={undefined}
          icon={TrendingUp}
          color={
            (summary?.currentOEE || 0) >= 85
              ? 'green'
              : (summary?.currentOEE || 0) >= 70
              ? 'yellow'
              : 'red'
          }
        />
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-warning-600" />
            {t('production.alerts')}
          </h2>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert: ProductionAlert) => (
              <div
                key={alert.id}
                className={clsx(
                  'p-4 rounded-lg border-l-4',
                  alert.severity === 'CRITICAL' && 'bg-danger-50 border-danger-500',
                  alert.severity === 'WARNING' && 'bg-warning-50 border-warning-500',
                  alert.severity === 'INFO' && 'bg-blue-50 border-blue-500'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'text-xs font-medium px-2 py-1 rounded',
                          alert.severity === 'CRITICAL' && 'bg-danger-100 text-danger-700',
                          alert.severity === 'WARNING' && 'bg-warning-100 text-warning-700',
                          alert.severity === 'INFO' && 'bg-blue-100 text-blue-700'
                        )}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500">
                        {alert.workCenterName || t('production.facility')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-900">{alert.message}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OEE Trends Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{t('production.oeeTrends')}</h2>
          {oeeTrendsChartData.length > 0 ? (
            <Chart
              type="line"
              data={oeeTrendsChartData}
              xKey="date"
              yKey={['OEE', 'Availability', 'Performance', 'Quality', 'Target']}
              colors={['#0ea5e9', '#22c55e', '#8b5cf6', '#eab308', '#ef4444']}
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              {t('common.noData')}
            </div>
          )}
        </div>

        {/* Work Center Utilization Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {t('production.workCenterUtilization')}
          </h2>
          {utilizationChartData.length > 0 ? (
            <Chart
              type="bar"
              data={utilizationChartData}
              xKey="workCenter"
              yKey={['utilization', 'oee']}
              colors={['#0ea5e9', '#22c55e']}
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              {t('common.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Work Center Status Grid */}
      {utilizationData?.workCenterUtilization &&
        utilizationData.workCenterUtilization.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t('production.workCenterStatus')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {utilizationData.workCenterUtilization.map((wc: WorkCenterUtilization) => (
                <div
                  key={wc.workCenterId}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{wc.workCenterName}</h3>
                    <span
                      className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        wc.status === 'PRODUCTIVE' && 'bg-success-100 text-success-700',
                        wc.status === 'NON_PRODUCTIVE' && 'bg-danger-100 text-danger-700',
                        wc.status === 'IDLE' && 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {wc.status}
                    </span>
                  </div>
                  {wc.currentProductionRunNumber && (
                    <p className="text-sm text-gray-600 mb-2">
                      {t('production.currentRun')}: {wc.currentProductionRunNumber}
                    </p>
                  )}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('production.oee')}:</span>
                      <span className="font-medium">
                        {wc.currentOEE?.toFixed(1) || '-'}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('production.utilization')}:</span>
                      <span className="font-medium">{wc.utilizationPercentage.toFixed(1)}%</span>
                    </div>
                    {wc.activeRunProgress !== undefined && wc.activeRunProgress !== null && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{t('production.progress')}</span>
                          <span>{wc.activeRunProgress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${wc.activeRunProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Production Runs Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{t('production.productionRuns')}</h2>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">{t('common.allStatuses')}</option>
              <option value="IN_PROGRESS">{t('production.inProgress')}</option>
              <option value="SCHEDULED">{t('production.scheduled')}</option>
              <option value="PAUSED">{t('production.paused')}</option>
              <option value="COMPLETED">{t('production.completed')}</option>
            </select>
            {workCenterData?.workCenterSummaries && (
              <select
                value={workCenterFilter}
                onChange={(e) => setWorkCenterFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">{t('common.allWorkCenters')}</option>
                {workCenterData.workCenterSummaries.map((wc: any) => (
                  <option key={wc.workCenterId} value={wc.workCenterId}>
                    {wc.workCenterName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <DataTable columns={columns} data={productionRuns} />
      </div>

      {/* Production Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            {t('production.totalProduced')}
          </h3>
          <p className="text-3xl font-bold text-gray-900">
            {totalQuantity.toLocaleString()}
          </p>
          <div className="mt-2 text-sm text-gray-600">
            {t('production.good')}: {(summary?.totalGoodQuantity || 0).toLocaleString()} |{' '}
            {t('production.scrap')}: {(summary?.totalScrapQuantity || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            {t('production.averageYield')}
          </h3>
          <p className="text-3xl font-bold text-gray-900">{avgYield.toFixed(1)}%</p>
          <div className="mt-2 text-sm text-gray-600">
            {t('production.target')}: 95%
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            {t('production.scrapRate')}
          </h3>
          <p
            className={clsx(
              'text-3xl font-bold',
              totalQuantity > 0 &&
                ((summary?.totalScrapQuantity || 0) / totalQuantity) * 100 < 2
                ? 'text-success-600'
                : 'text-danger-600'
            )}
          >
            {totalQuantity > 0
              ? (((summary?.totalScrapQuantity || 0) / totalQuantity) * 100).toFixed(2)
              : '0.00'}
            %
          </p>
          <div className="mt-2 text-sm text-gray-600">
            {t('production.target')}: {'<'}2%
          </div>
        </div>
      </div>
    </div>
  );
};
