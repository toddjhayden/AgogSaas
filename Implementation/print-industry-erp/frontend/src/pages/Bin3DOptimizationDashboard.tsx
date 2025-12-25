import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Layers,
  TrendingDown,
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import {
  GET_ABC_ERGONOMIC_RECOMMENDATIONS,
  GET_3D_OPTIMIZATION_METRICS,
} from '../graphql/queries/binUtilization';

/**
 * 3D Proximity Optimization Dashboard
 * REQ-STRATEGIC-AUTO-1766584106655 - Bin Utilization Algorithm Optimization
 *
 * Features:
 * - Ergonomic zone analysis (LOW/GOLDEN/HIGH)
 * - ABC class-based shelf placement recommendations
 * - Vertical travel reduction metrics
 * - Ergonomic compliance tracking
 * - Safety-based weight placement rules
 */

interface ABCErgonomicRecommendation {
  abcClass: string;
  avgWeightLbs: number;
  recommendedErgonomicZone: string;
  reason: string;
  materialCount: number;
}

interface ErgonomicZonePick {
  zone: string;
  pickCount: number;
  percentage: number;
}

interface OptimizationMetrics {
  facilityId: string;
  totalPicks: number;
  ergonomicZonePicks: ErgonomicZonePick[];
  verticalTravelReduction: number;
  ergonomicCompliance: number;
  measurementPeriod: string;
}

const getErgonomicZoneColor = (zone: string) => {
  switch (zone) {
    case 'GOLDEN':
      return 'text-success-600 bg-success-100 border-success-200';
    case 'LOW':
      return 'text-info-600 bg-info-100 border-info-200';
    case 'HIGH':
      return 'text-warning-600 bg-warning-100 border-warning-200';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200';
  }
};

const getErgonomicZoneDescription = (zone: string) => {
  switch (zone) {
    case 'GOLDEN':
      return '30-60" (Waist to Shoulder)';
    case 'LOW':
      return '0-30" (Below Waist)';
    case 'HIGH':
      return '60"+ (Above Shoulder)';
    default:
      return 'Unknown';
  }
};

export const Bin3DOptimizationDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedFacility, setSelectedFacility] = useState<string>('');

  const {
    data: ergonomicData,
    loading: ergonomicLoading,
    error: ergonomicError,
    refetch: refetchErgonomic,
  } = useQuery<{ getABCErgonomicRecommendations: ABCErgonomicRecommendation[] }>(
    GET_ABC_ERGONOMIC_RECOMMENDATIONS,
    {
      variables: { facilityId: selectedFacility },
      skip: !selectedFacility,
      pollInterval: 300000, // Refresh every 5 minutes
    }
  );

  const {
    data: metricsData,
    loading: metricsLoading,
  } = useQuery<{ get3DOptimizationMetrics: OptimizationMetrics }>(
    GET_3D_OPTIMIZATION_METRICS,
    {
      variables: { facilityId: selectedFacility },
      skip: !selectedFacility,
      pollInterval: 300000,
    }
  );

  const recommendations = ergonomicData?.getABCErgonomicRecommendations || [];
  const metrics = metricsData?.get3DOptimizationMetrics;

  const handleRefresh = () => {
    refetchErgonomic();
  };

  if (!selectedFacility) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">3D Proximity Optimization</h1>
          <Breadcrumb />
        </div>
        <div className="card">
          <div className="text-center py-12">
            <Layers className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a Facility</h2>
            <p className="text-gray-600 mb-6">
              Choose a facility to view 3D optimization metrics and ergonomic recommendations
            </p>
            <FacilitySelector />
          </div>
        </div>
      </div>
    );
  }

  if (ergonomicLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (ergonomicError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-danger-600 mx-auto" />
          <p className="mt-4 text-gray-600">
            {t('common.error')}: {ergonomicError.message}
          </p>
        </div>
      </div>
    );
  }

  // Prepare chart data for ergonomic zone distribution
  const zoneDistributionData = metrics?.ergonomicZonePicks.map((zone) => ({
    zone: zone.zone,
    'Pick Count': zone.pickCount,
    'Percentage': zone.percentage,
  })) || [];

  // Prepare recommendations table
  const recommendationColumns = [
    {
      id: 'abcClass',
      header: 'ABC Class',
      accessorKey: 'abcClass',
      cell: (value: string) => (
        <span className="font-semibold text-primary-600">{value}</span>
      ),
    },
    {
      id: 'materialCount',
      header: 'Material Count',
      accessorKey: 'materialCount',
    },
    {
      id: 'avgWeightLbs',
      header: 'Avg Weight (lbs)',
      accessorKey: 'avgWeightLbs',
      cell: (value: number) => value.toFixed(1),
    },
    {
      id: 'recommendedErgonomicZone',
      header: 'Recommended Zone',
      accessorKey: 'recommendedErgonomicZone',
      cell: (value: string) => (
        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getErgonomicZoneColor(value)}`}>
          {value}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reasoning',
      accessorKey: 'reason',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">3D Proximity Optimization</h1>
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
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Picks */}
            <div className="card border-l-4 border-primary-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Picks</p>
                  <p className="text-3xl font-bold text-primary-600 mt-2">
                    {metrics.totalPicks.toLocaleString()}
                  </p>
                </div>
                <Activity className="h-12 w-12 text-primary-600 opacity-20" />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                Period: {metrics.measurementPeriod}
              </div>
            </div>

            {/* Vertical Travel Reduction */}
            <div className="card border-l-4 border-success-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vertical Travel Reduction</p>
                  <p className="text-3xl font-bold text-success-600 mt-2">
                    {metrics.verticalTravelReduction.toFixed(1)}%
                  </p>
                </div>
                <TrendingDown className="h-12 w-12 text-success-600 opacity-20" />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                5-8% pick travel reduction expected
              </div>
            </div>

            {/* Ergonomic Compliance */}
            <div className="card border-l-4 border-info-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ergonomic Compliance</p>
                  <p className="text-3xl font-bold text-info-600 mt-2">
                    {metrics.ergonomicCompliance.toFixed(1)}%
                  </p>
                </div>
                <CheckCircle className="h-12 w-12 text-info-600 opacity-20" />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div
                  className="h-2 rounded-full bg-info-500"
                  style={{ width: `${Math.min(metrics.ergonomicCompliance, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Golden Zone Picks */}
            <div className="card border-l-4 border-success-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Golden Zone Picks</p>
                  <p className="text-3xl font-bold text-success-600 mt-2">
                    {metrics.ergonomicZonePicks
                      .find((z) => z.zone === 'GOLDEN')
                      ?.percentage.toFixed(1) || 0}
                    %
                  </p>
                </div>
                <Layers className="h-12 w-12 text-success-600 opacity-20" />
              </div>
              <div className="mt-3 text-sm text-gray-600">
                Waist to shoulder (optimal)
              </div>
            </div>
          </div>

          {/* Ergonomic Zone Distribution */}
          {zoneDistributionData.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Pick Distribution by Ergonomic Zone
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Chart
                    type="pie"
                    data={zoneDistributionData}
                    xKey="zone"
                    yKeys={['Pick Count']}
                    colors={['#10b981', '#3b82f6', '#f59e0b']}
                  />
                </div>
                <div className="space-y-4">
                  {metrics.ergonomicZonePicks.map((zone) => (
                    <div key={zone.zone} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getErgonomicZoneColor(zone.zone)}`}>
                          {zone.zone}
                        </span>
                        <p className="text-sm text-gray-600 mt-1">
                          {getErgonomicZoneDescription(zone.zone)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{zone.pickCount.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{zone.percentage.toFixed(1)}% of picks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABC-Based Ergonomic Recommendations */}
          <div className="card">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                ABC-Based Shelf Placement Recommendations
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Optimized placement strategy based on velocity and weight considerations
              </p>
            </div>

            {recommendations.length > 0 ? (
              <DataTable columns={recommendationColumns} data={recommendations} />
            ) : (
              <div className="text-center py-8">
                <Layers className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No recommendations available</p>
              </div>
            )}
          </div>

          {/* Ergonomic Zones Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* LOW Zone */}
            <div className="card bg-info-50 border-l-4 border-info-500">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                LOW Zone (0-30")
              </h3>
              <p className="text-sm text-gray-700 mb-3">Below waist - requires bending</p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>B-Class heavy items (&gt;20 lbs)</li>
                <li>C-Class heavy items (&gt;10 lbs)</li>
                <li>Safety priority: Heavy items stored low</li>
                <li>Reduced lifting strain</li>
              </ul>
            </div>

            {/* GOLDEN Zone */}
            <div className="card bg-success-50 border-l-4 border-success-500">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                GOLDEN Zone (30-60")
              </h3>
              <p className="text-sm text-gray-700 mb-3">Waist to shoulder - OPTIMAL</p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>A-Class high velocity items</li>
                <li>B-Class lightweight items</li>
                <li>Minimal bending or reaching</li>
                <li>Maximum picker efficiency</li>
              </ul>
            </div>

            {/* HIGH Zone */}
            <div className="card bg-warning-50 border-l-4 border-warning-500">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                HIGH Zone (60"+)
              </h3>
              <p className="text-sm text-gray-700 mb-3">Above shoulder - requires reaching</p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>C-Class lightweight items (&lt;10 lbs)</li>
                <li>Low velocity materials</li>
                <li>Saves premium GOLDEN zone space</li>
                <li>Safety: Light items only</li>
              </ul>
            </div>
          </div>

          {/* Benefits Overview */}
          <div className="card bg-primary-50 border-l-4 border-primary-500">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              3D Optimization Benefits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Performance Improvements:</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>5-8% pick travel reduction from fewer vertical movements</li>
                  <li>Better space utilization in vertical racking systems</li>
                  <li>Optimized co-location considering shelf proximity</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Safety & Ergonomics:</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Reduced picker fatigue and injury risk</li>
                  <li>Heavy items stored at safe heights (below waist)</li>
                  <li>High-velocity items in ergonomic "golden zone"</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
