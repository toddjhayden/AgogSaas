import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Box,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import {
  GET_FACILITY_FRAGMENTATION,
  GET_CONSOLIDATION_OPPORTUNITIES,
  GET_FRAGMENTATION_HISTORY,
} from '../graphql/queries/binUtilization';

/**
 * Bin Fragmentation Monitoring Dashboard
 * REQ-STRATEGIC-AUTO-1766584106655 - Bin Utilization Algorithm Optimization
 *
 * Features:
 * - Facility-wide fragmentation metrics
 * - Fragmentation trend tracking (7-day and 30-day)
 * - Consolidation opportunity identification
 * - Space recovery estimates
 * - Labor hour planning
 */

interface FragmentationMetrics {
  facilityId: string;
  fragmentationIndex: number;
  fragmentationLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  totalBins: number;
  fragmentedBins: number;
  requiresConsolidation: boolean;
  estimatedSpaceRecovery: number;
  trend: {
    direction: 'IMPROVING' | 'STABLE' | 'WORSENING';
    sevenDayAverage: number;
    thirtyDayAverage: number;
  };
}

interface ConsolidationOpportunity {
  materialId: string;
  materialName: string;
  sourceLocationIds: string[];
  sourceLocationCodes: string[];
  targetLocationId: string;
  targetLocationCode: string;
  quantityToMove: number;
  spaceRecovered: number;
  estimatedLaborHours: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface FragmentationHistory {
  timestamp: string;
  fragmentationIndex: number;
  fragmentationLevel: string;
  totalBins: number;
  fragmentedBins: number;
}

const getFragmentationColor = (level: string) => {
  switch (level) {
    case 'LOW':
      return 'text-success-600 bg-success-100 border-success-200';
    case 'MODERATE':
      return 'text-warning-600 bg-warning-100 border-warning-200';
    case 'HIGH':
      return 'text-danger-600 bg-danger-100 border-danger-200';
    case 'SEVERE':
      return 'text-danger-700 bg-danger-200 border-danger-300';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200';
  }
};

const getTrendIcon = (direction: string) => {
  switch (direction) {
    case 'IMPROVING':
      return <TrendingDown className="h-4 w-4 text-success-600" />;
    case 'WORSENING':
      return <TrendingUp className="h-4 w-4 text-danger-600" />;
    default:
      return <Minus className="h-4 w-4 text-gray-600" />;
  }
};

export const BinFragmentationDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedFacility, _setSelectedFacility] = useState<string>('');

  const {
    data: fragmentationData,
    loading: fragmentationLoading,
    error: fragmentationError,
    refetch: refetchFragmentation,
  } = useQuery<{ getFacilityFragmentation: FragmentationMetrics }>(
    GET_FACILITY_FRAGMENTATION,
    {
      variables: { facilityId: selectedFacility },
      skip: !selectedFacility,
      pollInterval: 60000, // Refresh every minute
    }
  );

  const {
    data: consolidationData,
    loading: consolidationLoading,
  } = useQuery<{ getConsolidationOpportunities: ConsolidationOpportunity[] }>(
    GET_CONSOLIDATION_OPPORTUNITIES,
    {
      variables: { facilityId: selectedFacility },
      skip: !selectedFacility,
      pollInterval: 60000,
    }
  );

  const {
    data: historyData,
    loading: historyLoading,
  } = useQuery<{ getFragmentationHistory: FragmentationHistory[] }>(
    GET_FRAGMENTATION_HISTORY,
    {
      variables: { facilityId: selectedFacility, daysBack: 30 },
      skip: !selectedFacility,
      pollInterval: 300000, // Refresh every 5 minutes
    }
  );

  const metrics = fragmentationData?.getFacilityFragmentation;
  const opportunities = consolidationData?.getConsolidationOpportunities || [];
  const history = historyData?.getFragmentationHistory || [];

  const handleRefresh = () => {
    refetchFragmentation();
  };

  if (!selectedFacility) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bin Fragmentation Monitoring</h1>
          <Breadcrumb />
        </div>
        <div className="card">
          <div className="text-center py-12">
            <Box className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Select a Facility
            </h2>
            <p className="text-gray-600 mb-6">
              Choose a facility to view fragmentation metrics and consolidation opportunities
            </p>
            <FacilitySelector />
          </div>
        </div>
      </div>
    );
  }

  if (fragmentationLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (fragmentationError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-danger-600 mx-auto" />
          <p className="mt-4 text-gray-600">
            {t('common.error')}: {fragmentationError.message}
          </p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = history.map((h) => ({
    date: new Date(h.timestamp).toLocaleDateString(),
    'Fragmentation Index': h.fragmentationIndex,
  }));

  // Prepare consolidation opportunities table
  const consolidationColumns = [
    {
      id: 'materialName',
      header: 'Material',
      accessorKey: 'materialName',
    },
    {
      id: 'sourceLocations',
      header: 'Source Bins',
      accessorKey: 'sourceLocationCodes',
      cell: (value: string[]) => value.join(', '),
    },
    {
      id: 'targetLocation',
      header: 'Target Bin',
      accessorKey: 'targetLocationCode',
    },
    {
      id: 'spaceRecovered',
      header: 'Space Recovery (cu ft)',
      accessorKey: 'spaceRecovered',
      cell: (value: number) => value.toFixed(2),
    },
    {
      id: 'estimatedLaborHours',
      header: 'Labor Hours',
      accessorKey: 'estimatedLaborHours',
      cell: (value: number) => value.toFixed(1),
    },
    {
      id: 'priority',
      header: 'Priority',
      accessorKey: 'priority',
      cell: (value: string) => (
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            value === 'HIGH'
              ? 'bg-danger-100 text-danger-800'
              : value === 'MEDIUM'
              ? 'bg-warning-100 text-warning-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bin Fragmentation Monitoring</h1>
          <Breadcrumb />
        </div>
        <div className="flex items-center space-x-3">
          <FacilitySelector />
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {metrics && (
        <>
          {/* Fragmentation Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Fragmentation Index */}
            <div className="card border-l-4 border-primary-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fragmentation Index</p>
                  <p className="text-3xl font-bold text-primary-600 mt-2">
                    {metrics.fragmentationIndex.toFixed(2)}
                  </p>
                </div>
                <Box className="h-12 w-12 text-primary-600 opacity-20" />
              </div>
              <div className="mt-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold border ${getFragmentationColor(
                    metrics.fragmentationLevel
                  )}`}
                >
                  {metrics.fragmentationLevel}
                </span>
              </div>
            </div>

            {/* Fragmentation Trend */}
            <div className="card border-l-4 border-info-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">7-Day Trend</p>
                  <div className="flex items-center space-x-2 mt-2">
                    {getTrendIcon(metrics.trend.direction)}
                    <p className="text-xl font-bold text-gray-900">{metrics.trend.direction}</p>
                  </div>
                </div>
                <TrendingUp className="h-12 w-12 text-info-600 opacity-20" />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                7d avg: {metrics.trend.sevenDayAverage.toFixed(2)} | 30d avg:{' '}
                {metrics.trend.thirtyDayAverage.toFixed(2)}
              </div>
            </div>

            {/* Space Recovery Potential */}
            <div className="card border-l-4 border-success-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Space Recovery</p>
                  <p className="text-3xl font-bold text-success-600 mt-2">
                    {metrics.estimatedSpaceRecovery.toFixed(0)}
                    <span className="text-lg text-gray-600 ml-1">cu ft</span>
                  </p>
                </div>
                <Package className="h-12 w-12 text-success-600 opacity-20" />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                {metrics.requiresConsolidation ? (
                  <span className="flex items-center space-x-1 text-warning-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Consolidation recommended</span>
                  </span>
                ) : (
                  <span className="text-success-600">No action required</span>
                )}
              </div>
            </div>

            {/* Fragmented Bins */}
            <div className="card border-l-4 border-warning-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fragmented Bins</p>
                  <p className="text-3xl font-bold text-warning-600 mt-2">
                    {metrics.fragmentedBins}
                    <span className="text-lg text-gray-600 ml-1">/ {metrics.totalBins}</span>
                  </p>
                </div>
                <Box className="h-12 w-12 text-warning-600 opacity-20" />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                {((metrics.fragmentedBins / metrics.totalBins) * 100).toFixed(1)}% fragmented
              </div>
            </div>
          </div>

          {/* Fragmentation Trend Chart */}
          {!historyLoading && chartData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Fragmentation Trend (30 Days)
                </h2>
                <div className="text-sm text-gray-600">
                  Target: FI &lt; 1.5 (LOW fragmentation)
                </div>
              </div>
              <Chart
                type="line"
                data={chartData}
                xKey="date"
                yKeys={['Fragmentation Index']}
                colors={['#f59e0b']}
              />
              <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-success-600">LOW:</span> FI &lt; 1.5
                </div>
                <div>
                  <span className="font-semibold text-warning-600">MODERATE:</span> FI 1.5-2.0
                </div>
                <div>
                  <span className="font-semibold text-danger-600">HIGH:</span> FI 2.0-3.0
                </div>
                <div>
                  <span className="font-semibold text-danger-700">SEVERE:</span> FI &gt; 3.0
                </div>
              </div>
            </div>
          )}

          {/* Consolidation Opportunities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Consolidation Opportunities
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Materials that can be consolidated to reduce fragmentation and recover space
                </p>
              </div>
              {!consolidationLoading && (
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-gray-600">
                      Total Labor:{' '}
                      <span className="font-semibold">
                        {opportunities
                          .reduce((sum, opp) => sum + opp.estimatedLaborHours, 0)
                          .toFixed(1)}{' '}
                        hrs
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-gray-600" />
                    <span className="text-gray-600">
                      Total Recovery:{' '}
                      <span className="font-semibold">
                        {opportunities
                          .reduce((sum, opp) => sum + opp.spaceRecovered, 0)
                          .toFixed(0)}{' '}
                        cu ft
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {consolidationLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading opportunities...</p>
              </div>
            ) : opportunities.length > 0 ? (
              <DataTable columns={consolidationColumns} data={opportunities} />
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No consolidation opportunities found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Fragmentation is at acceptable levels
                </p>
              </div>
            )}
          </div>

          {/* Fragmentation Explanation */}
          <div className="card bg-info-50 border-l-4 border-info-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Understanding Fragmentation
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <strong>Fragmentation Index (FI)</strong> measures how scattered available space
                is across bins:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>
                  FI = Total Available Space / Largest Contiguous Space
                </li>
                <li>
                  <strong>FI = 1.0:</strong> Perfect - all available space is in one location
                </li>
                <li>
                  <strong>FI &lt; 1.5:</strong> LOW fragmentation - space is well organized
                </li>
                <li>
                  <strong>FI 1.5-2.0:</strong> MODERATE - some consolidation would help
                </li>
                <li>
                  <strong>FI 2.0-3.0:</strong> HIGH - consolidation recommended (2-4% space
                  recovery)
                </li>
                <li>
                  <strong>FI &gt; 3.0:</strong> SEVERE - immediate consolidation needed
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
