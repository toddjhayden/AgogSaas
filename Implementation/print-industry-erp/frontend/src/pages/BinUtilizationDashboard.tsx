import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Warehouse,
  BarChart3,
  AlertCircle,
  Zap,
  Target,
  Activity,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import {
  ANALYZE_WAREHOUSE_UTILIZATION,
  GET_OPTIMIZATION_RECOMMENDATIONS,
} from '../graphql/queries/binUtilization';

// TypeScript interfaces for data structures
interface ZoneUtilization {
  zoneCode: string;
  totalLocations: number;
  averageUtilization: number;
  totalCubicFeet: number;
  usedCubicFeet: number;
}

interface BinCapacityInfo {
  locationId: string;
  locationCode: string;
  locationType: string;
  totalCubicFeet: number;
  usedCubicFeet: number;
  availableCubicFeet: number;
  maxWeightLbs: number;
  currentWeightLbs: number;
  availableWeightLbs: number;
  utilizationPercentage: number;
  abcClassification?: string;
  pickSequence?: number;
}

interface OptimizationRecommendation {
  type: string;
  priority: string;
  sourceBinId: string;
  sourceBinCode: string;
  targetBinId?: string;
  targetBinCode?: string;
  materialId?: string;
  materialName?: string;
  reason: string;
  expectedImpact: string;
  currentUtilization?: number;
  velocityChange?: number;
}

interface WarehouseUtilizationData {
  facilityId: string;
  totalLocations: number;
  activeLocations: number;
  averageUtilization: number;
  utilizationByZone: ZoneUtilization[];
  underutilizedLocations: BinCapacityInfo[];
  overutilizedLocations: BinCapacityInfo[];
  recommendations: OptimizationRecommendation[];
}

export const BinUtilizationDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedZone, setSelectedZone] = useState<string | undefined>(undefined);

  // Default facility ID - in production, this would come from user context
  const facilityId = 'facility-main-warehouse';

  // Fetch warehouse utilization data
  const { data: warehouseData, loading: warehouseLoading, error: warehouseError } = useQuery<{
    analyzeWarehouseUtilization: WarehouseUtilizationData;
  }>(ANALYZE_WAREHOUSE_UTILIZATION, {
    variables: { facilityId, zoneCode: selectedZone },
    pollInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch optimization recommendations
  const { data: recommendationsData, loading: recommendationsLoading } = useQuery<{
    getOptimizationRecommendations: OptimizationRecommendation[];
  }>(GET_OPTIMIZATION_RECOMMENDATIONS, {
    variables: { facilityId, threshold: 0.3 },
    pollInterval: 60000, // Refresh every minute
  });

  const warehouseUtilization = warehouseData?.analyzeWarehouseUtilization;
  const recommendations = recommendationsData?.getOptimizationRecommendations || [];

  // High-priority recommendations for dashboard cards
  const highPriorityRecommendations = recommendations.filter(r => r.priority === 'HIGH');
  const consolidationOpportunities = recommendations.filter(r => r.type === 'CONSOLIDATE').length;
  const rebalanceNeeded = recommendations.filter(r => r.type === 'REBALANCE').length;

  // Phase 1 optimization metrics - ABC Reclassification (RESLOT)
  const reslotRecommendations = recommendations.filter(r => r.type === 'RESLOT');
  const highPriorityReslots = reslotRecommendations.filter(r => r.priority === 'HIGH').length;

  // Table column definitions for underutilized bins
  const underutilizedColumns: ColumnDef<BinCapacityInfo>[] = [
    { accessorKey: 'locationCode', header: t('binUtilization.locationCode') },
    { accessorKey: 'locationType', header: t('binUtilization.locationType') },
    {
      accessorKey: 'utilizationPercentage',
      header: t('binUtilization.utilization'),
      cell: (info) => (
        <span className="text-warning-600 font-semibold">
          {info.getValue<number>().toFixed(1)}%
        </span>
      ),
    },
    {
      accessorKey: 'availableCubicFeet',
      header: t('binUtilization.availableCapacity'),
      cell: (info) => `${info.getValue<number>().toFixed(1)} ft³`,
    },
    { accessorKey: 'abcClassification', header: t('binUtilization.abcClass') },
  ];

  // Table column definitions for overutilized bins
  const overutilizedColumns: ColumnDef<BinCapacityInfo>[] = [
    { accessorKey: 'locationCode', header: t('binUtilization.locationCode') },
    { accessorKey: 'locationType', header: t('binUtilization.locationType') },
    {
      accessorKey: 'utilizationPercentage',
      header: t('binUtilization.utilization'),
      cell: (info) => (
        <span className="text-danger-600 font-semibold">
          {info.getValue<number>().toFixed(1)}%
        </span>
      ),
    },
    {
      accessorKey: 'availableCubicFeet',
      header: t('binUtilization.availableCapacity'),
      cell: (info) => `${info.getValue<number>().toFixed(1)} ft³`,
    },
    { accessorKey: 'abcClassification', header: t('binUtilization.abcClass') },
  ];

  // Table column definitions for recommendations
  const recommendationColumns: ColumnDef<OptimizationRecommendation>[] = [
    {
      accessorKey: 'priority',
      header: t('binUtilization.priority'),
      cell: (info) => {
        const priority = info.getValue<string>();
        const colorClass =
          priority === 'HIGH'
            ? 'bg-danger-100 text-danger-800'
            : priority === 'MEDIUM'
            ? 'bg-warning-100 text-warning-800'
            : 'bg-gray-100 text-gray-800';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
            {priority}
          </span>
        );
      },
    },
    {
      accessorKey: 'type',
      header: t('binUtilization.recommendationType'),
      cell: (info) => {
        const type = info.getValue<string>();
        const isReslot = type === 'RESLOT';
        return (
          <div className="flex items-center space-x-2">
            <span className={`font-medium ${isReslot ? 'text-primary-600' : ''}`}>{type}</span>
            {isReslot && (
              <Zap className="h-4 w-4 text-primary-600" title="ABC Reclassification (Phase 1 Optimization)" />
            )}
          </div>
        );
      },
    },
    { accessorKey: 'sourceBinCode', header: t('binUtilization.sourceBin') },
    { accessorKey: 'targetBinCode', header: t('binUtilization.targetBin') },
    {
      accessorKey: 'materialName',
      header: t('binUtilization.material'),
      cell: (info) => {
        const materialName = info.getValue<string>();
        return materialName ? <span className="text-sm">{materialName}</span> : <span className="text-gray-400">-</span>;
      },
    },
    { accessorKey: 'reason', header: t('binUtilization.reason') },
    {
      accessorKey: 'expectedImpact',
      header: t('binUtilization.expectedImpact'),
      cell: (info) => {
        const impact = info.getValue<string>();
        return <span className="text-sm font-medium text-success-600">{impact}</span>;
      },
    },
  ];

  if (warehouseLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (warehouseError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-danger-600 mx-auto" />
          <p className="mt-4 text-gray-600">{t('common.error')}: {warehouseError.message}</p>
        </div>
      </div>
    );
  }

  const avgUtilization = warehouseUtilization?.averageUtilization || 0;
  const utilizationStatus =
    avgUtilization >= 60 && avgUtilization <= 85
      ? 'optimal'
      : avgUtilization < 60
      ? 'underutilized'
      : 'overutilized';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">{t('binUtilization.title')}</h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 border border-primary-200">
              <Activity className="h-3 w-3 mr-1" />
              Algorithm V2
            </span>
          </div>
          <Breadcrumb />
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Phase 1 Optimizations Active</p>
          <p className="text-xs font-medium text-primary-600">Enhanced Pick Sequence + ABC Reclassification</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Average Utilization */}
        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('binUtilization.avgUtilization')}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {avgUtilization.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Target: 80% | Status:{' '}
                <span
                  className={
                    utilizationStatus === 'optimal'
                      ? 'text-success-600 font-semibold'
                      : utilizationStatus === 'underutilized'
                      ? 'text-warning-600 font-semibold'
                      : 'text-danger-600 font-semibold'
                  }
                >
                  {utilizationStatus.toUpperCase()}
                </span>
              </p>
            </div>
            <BarChart3 className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        {/* Active Locations */}
        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('binUtilization.activeLocations')}
              </p>
              <p className="text-3xl font-bold text-success-600 mt-2">
                {warehouseUtilization?.activeLocations || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                of {warehouseUtilization?.totalLocations || 0} total
              </p>
            </div>
            <Warehouse className="h-10 w-10 text-success-500" />
          </div>
        </div>

        {/* Consolidation Opportunities */}
        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                {t('binUtilization.consolidationOpportunities')}
              </p>
              <p className="text-3xl font-bold text-warning-600 mt-2">
                {consolidationOpportunities}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {warehouseUtilization?.underutilizedLocations.length || 0} underutilized bins
              </p>
            </div>
            <Package className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        {/* ABC Reclassification Opportunities (Phase 1) */}
        <div className="card border-l-4 border-primary-500 bg-primary-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-1">
                <p className="text-sm font-medium text-gray-600">ABC Reclassification</p>
                <Zap className="h-4 w-4 text-primary-600" />
              </div>
              <p className="text-3xl font-bold text-primary-600 mt-2">{reslotRecommendations.length}</p>
              <p className="text-xs text-gray-600 mt-1">
                {highPriorityReslots} high priority • Phase 1 optimization
              </p>
            </div>
            <Target className="h-10 w-10 text-primary-500" />
          </div>
        </div>
      </div>

      {/* Zone Utilization Chart */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t('binUtilization.utilizationByZone')}
        </h2>
        <Chart
          type="bar"
          data={warehouseUtilization?.utilizationByZone || []}
          xKey="zoneCode"
          yKey="averageUtilization"
          title={t('binUtilization.zoneUtilizationChart')}
          height={300}
        />
      </div>

      {/* High Priority Recommendations */}
      {highPriorityRecommendations.length > 0 && (
        <div className="card bg-danger-50 border-l-4 border-danger-500">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-danger-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-danger-900">
                {t('binUtilization.highPriorityAlerts')}
              </h3>
              <ul className="mt-2 space-y-2">
                {highPriorityRecommendations.slice(0, 5).map((rec, idx) => (
                  <li key={idx} className="text-sm text-danger-800">
                    <span className="font-semibold">{rec.type}:</span> {rec.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ABC Reclassification Recommendations (Phase 1 Highlight) */}
      {reslotRecommendations.length > 0 && (
        <div className="card bg-primary-50 border-l-4 border-primary-500">
          <div className="flex items-start space-x-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100">
              <Zap className="h-6 w-6 text-primary-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-primary-900">
                  ABC Reclassification Opportunities
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-200 text-primary-800">
                  Phase 1 Optimization
                </span>
              </div>
              <p className="mt-1 text-sm text-primary-800">
                Automated velocity analysis identified {reslotRecommendations.length} materials with ABC classification mismatches.
                Re-slotting these items can improve pick efficiency by 10-15%.
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {reslotRecommendations.slice(0, 6).map((rec, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-primary-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-primary-600">
                        {rec.materialName || 'Material'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        rec.priority === 'HIGH' ? 'bg-danger-100 text-danger-800' : 'bg-warning-100 text-warning-800'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{rec.sourceBinCode}</p>
                    <p className="text-xs text-gray-800">{rec.reason}</p>
                    <p className="text-xs font-medium text-success-600 mt-1">{rec.expectedImpact}</p>
                  </div>
                ))}
              </div>
              {reslotRecommendations.length > 6 && (
                <p className="mt-2 text-xs text-primary-700">
                  + {reslotRecommendations.length - 6} more recommendations in table below
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Optimization Recommendations Table */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t('binUtilization.optimizationRecommendations')}
        </h2>
        {recommendationsLoading ? (
          <p className="text-gray-500">{t('common.loading')}</p>
        ) : (
          <DataTable columns={recommendationColumns} data={recommendations} />
        )}
      </div>

      {/* Underutilized and Overutilized Bins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Underutilized Bins */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingDown className="h-6 w-6 text-warning-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('binUtilization.underutilizedBins')}
            </h2>
          </div>
          <DataTable
            columns={underutilizedColumns}
            data={warehouseUtilization?.underutilizedLocations.slice(0, 10) || []}
          />
        </div>

        {/* Overutilized Bins */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-6 w-6 text-danger-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {t('binUtilization.overutilizedBins')}
            </h2>
          </div>
          <DataTable
            columns={overutilizedColumns}
            data={warehouseUtilization?.overutilizedLocations.slice(0, 10) || []}
          />
        </div>
      </div>

      {/* Zone Capacity Details */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t('binUtilization.zoneCapacityDetails')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {warehouseUtilization?.utilizationByZone.map((zone) => (
            <div
              key={zone.zoneCode}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('binUtilization.zone')} {zone.zoneCode}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('binUtilization.locations')}:</span>
                  <span className="font-medium">{zone.totalLocations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('binUtilization.avgUtilization')}:</span>
                  <span className="font-medium">{zone.averageUtilization.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('binUtilization.totalCapacity')}:</span>
                  <span className="font-medium">{zone.totalCubicFeet.toFixed(0)} ft³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('binUtilization.usedCapacity')}:</span>
                  <span className="font-medium">{zone.usedCubicFeet.toFixed(0)} ft³</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      zone.averageUtilization >= 60 && zone.averageUtilization <= 85
                        ? 'bg-success-500'
                        : zone.averageUtilization < 60
                        ? 'bg-warning-500'
                        : 'bg-danger-500'
                    }`}
                    style={{ width: `${Math.min(zone.averageUtilization, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
