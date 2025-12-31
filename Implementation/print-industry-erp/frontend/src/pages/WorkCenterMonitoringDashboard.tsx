import React, { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { KPICard } from '../components/common/KPICard';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_WORK_CENTERS, GET_PRODUCTION_RUNS } from '../graphql/queries/productionPlanning';
import { useAppStore } from '../store/appStore';

interface WorkCenter {
  id: string;
  workCenterCode: string;
  workCenterName: string;
  workCenterType: string;
  manufacturer?: string;
  model?: string;
  status: string;
  productionRatePerHour?: number;
  productionUnit?: string;
  hourlyRate?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  isActive: boolean;
}

interface ProductionRun {
  id: string;
  productionRunNumber: string;
  workCenterId: string;
  operatorName?: string;
  startTimestamp?: string;
  endTimestamp?: string;
  targetQuantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  unitOfMeasure: string;
  status: string;
  productionOrder: {
    productionOrderNumber: string;
    productCode: string;
    productDescription: string;
  };
  operation: {
    operationCode: string;
    operationName: string;
  };
}

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800 border-green-200',
  IN_USE: 'bg-blue-100 text-blue-800 border-blue-200',
  DOWN: 'bg-red-100 text-red-800 border-red-200',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  OFFLINE: 'bg-gray-100 text-gray-800 border-gray-200',
  CHANGEOVER: 'bg-orange-100 text-orange-800 border-orange-200',
};

const statusIcons: Record<string, React.ReactNode> = {
  AVAILABLE: <CheckCircle className="h-6 w-6 text-green-600" />,
  IN_USE: <Activity className="h-6 w-6 text-blue-600" />,
  DOWN: <AlertCircle className="h-6 w-6 text-red-600" />,
  MAINTENANCE: <Wrench className="h-6 w-6 text-yellow-600" />,
  OFFLINE: <Settings className="h-6 w-6 text-gray-600" />,
  CHANGEOVER: <Clock className="h-6 w-6 text-orange-600" />,
};

export const WorkCenterMonitoringDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectedFacility = useAppStore((state) => state.preferences.selectedFacility);

  const facilityId = selectedFacility || '1'; // TODO: Get from context/auth

  const { data: workCentersData, loading: workCentersLoading, error: workCentersError } = useQuery(
    GET_WORK_CENTERS,
    {
      variables: {
        facilityId,
      },
      pollInterval: 10000, // Refresh every 10 seconds for real-time monitoring
    }
  );

  const { data: productionRunsData, loading: runsLoading } = useQuery(GET_PRODUCTION_RUNS, {
    variables: {
      facilityId,
      status: 'RUNNING',
      limit: 100,
    },
    pollInterval: 10000,
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!workCentersData?.workCenters) {
      return {
        total: 0,
        available: 0,
        inUse: 0,
        down: 0,
        utilizationRate: 0,
      };
    }

    const workCenters = workCentersData.workCenters;
    const total = workCenters.length;
    const available = workCenters.filter((wc: WorkCenter) => wc.status === 'AVAILABLE').length;
    const inUse = workCenters.filter((wc: WorkCenter) => wc.status === 'IN_USE').length;
    const down = workCenters.filter((wc: WorkCenter) => wc.status === 'DOWN').length;
    const utilizationRate = total > 0 ? (inUse / total) * 100 : 0;

    return {
      total,
      available,
      inUse,
      down,
      utilizationRate,
    };
  }, [workCentersData]);

  // Map production runs to work centers
  const workCenterRuns = useMemo(() => {
    if (!productionRunsData?.productionRuns) return {};

    const runsMap: Record<string, ProductionRun> = {};
    productionRunsData.productionRuns.forEach((run: ProductionRun) => {
      runsMap[run.workCenterId] = run;
    });

    return runsMap;
  }, [productionRunsData]);

  if (workCentersLoading || runsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (workCentersError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('common.error')}</h3>
          <p className="text-gray-600">{workCentersError.message}</p>
        </div>
      </div>
    );
  }

  const workCenters = workCentersData?.workCenters || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: t('nav.operations'), path: '/operations' },
              { label: t('nav.workCenterMonitoring'), path: '/operations/work-center-monitoring' },
            ]}
          />
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {t('production.workCenterMonitoring')}
          </h1>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <KPICard
          title={t('production.totalWorkCenters')}
          value={kpis.total.toString()}
          trend={undefined}
          icon={Settings}
          color="blue"
        />
        <KPICard
          title={t('production.available')}
          value={kpis.available.toString()}
          trend={undefined}
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          title={t('production.inUse')}
          value={kpis.inUse.toString()}
          trend={undefined}
          icon={Activity}
          color="blue"
        />
        <KPICard
          title={t('production.down')}
          value={kpis.down.toString()}
          trend={undefined}
          icon={AlertCircle}
          color={kpis.down > 0 ? 'red' : 'gray'}
        />
        <KPICard
          title={t('production.utilization')}
          value={`${kpis.utilizationRate.toFixed(1)}%`}
          trend={undefined}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Work Center Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workCenters.map((workCenter: WorkCenter) => {
          const currentRun = workCenterRuns[workCenter.id];
          const isMaintenanceDue =
            workCenter.nextMaintenanceDate &&
            new Date(workCenter.nextMaintenanceDate) <= new Date();

          return (
            <div
              key={workCenter.id}
              className={`bg-white rounded-lg shadow-sm border-2 ${
                statusColors[workCenter.status] || 'border-gray-200'
              } overflow-hidden hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => navigate(`/operations/work-centers/${workCenter.id}`)}
            >
              {/* Header */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcons[workCenter.status] || statusIcons.OFFLINE}
                    <div>
                      <h3 className="font-semibold text-gray-900">{workCenter.workCenterName}</h3>
                      <p className="text-sm text-gray-600">{workCenter.workCenterCode}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      statusColors[workCenter.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {t(`production.workCenterStatuses.${workCenter.status}`)}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-3">
                {/* Work Center Info */}
                <div className="text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">{t('production.type')}:</span>{' '}
                    {t(`production.workCenterTypes.${workCenter.workCenterType}`)}
                  </p>
                  {workCenter.manufacturer && (
                    <p className="text-gray-600">
                      <span className="font-medium">{t('production.equipment')}:</span>{' '}
                      {workCenter.manufacturer} {workCenter.model}
                    </p>
                  )}
                  {workCenter.productionRatePerHour && (
                    <p className="text-gray-600">
                      <span className="font-medium">{t('production.capacity')}:</span>{' '}
                      {workCenter.productionRatePerHour.toLocaleString()}{' '}
                      {workCenter.productionUnit || 'units'}/hr
                    </p>
                  )}
                </div>

                {/* Current Production Run */}
                {currentRun && (
                  <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      {t('production.currentJob')}
                    </p>
                    <div className="text-sm space-y-1">
                      <p className="text-blue-800">
                        <span className="font-medium">{t('production.orderNumber')}:</span>{' '}
                        {currentRun.productionOrder.productionOrderNumber}
                      </p>
                      <p className="text-blue-800">
                        <span className="font-medium">{t('production.product')}:</span>{' '}
                        {currentRun.productionOrder.productCode}
                      </p>
                      <p className="text-blue-800">
                        <span className="font-medium">{t('production.operation')}:</span>{' '}
                        {currentRun.operation.operationName}
                      </p>
                      {currentRun.operatorName && (
                        <p className="text-blue-800">
                          <span className="font-medium">{t('production.operator')}:</span>{' '}
                          {currentRun.operatorName}
                        </p>
                      )}
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <div className="flex justify-between text-blue-800">
                          <span>{t('production.progress')}:</span>
                          <span className="font-medium">
                            {currentRun.goodQuantity.toLocaleString()} /{' '}
                            {currentRun.targetQuantity.toLocaleString()} {currentRun.unitOfMeasure}
                          </span>
                        </div>
                        <div className="mt-1 w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(
                                (currentRun.goodQuantity / currentRun.targetQuantity) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Maintenance Alert */}
                {isMaintenanceDue && (
                  <div className="bg-yellow-50 rounded-md p-3 border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm font-semibold text-yellow-900">
                        {t('production.maintenanceDue')}
                      </p>
                    </div>
                    <p className="text-xs text-yellow-800 mt-1">
                      {t('production.dueDate')}:{' '}
                      {new Date(workCenter.nextMaintenanceDate!).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Idle Status */}
                {workCenter.status === 'AVAILABLE' && !currentRun && (
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                    <p className="text-sm text-gray-600 text-center">
                      {t('production.availableForWork')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {workCenters.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('production.noWorkCenters')}
          </h3>
          <p className="text-gray-600">{t('production.noWorkCentersDescription')}</p>
        </div>
      )}
    </div>
  );
};
