import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import {
  Activity,
  AlertCircle,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  LineChart,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { ColumnDef } from '@tanstack/react-table';
import {
  GET_UTILIZATION_PREDICTIONS,
  GET_UTILIZATION_PREDICTION_TRENDS,
  GET_SEASONAL_ADJUSTMENTS,
} from '../graphql/queries/binUtilization';
import { useTranslation } from 'react-i18next';

/**
 * Bin Utilization Prediction Dashboard
 * REQ-STRATEGIC-AUTO-1766600259419 - OPP-1
 *
 * Features:
 * - Real-time utilization forecasting (7, 14, 30 day horizons)
 * - Time-series trend analysis with ARIMA/Prophet models
 * - Seasonal pattern detection and ABC adjustment recommendations
 * - Proactive capacity planning alerts
 * - Prediction accuracy tracking
 */

// TypeScript interfaces
interface PredictionTrend {
  date: string;
  actual7DayUtilization?: number;
  predicted7DayUtilization: number;
  actual14DayUtilization?: number;
  predicted14DayUtilization: number;
  actual30DayUtilization?: number;
  predicted30DayUtilization: number;
  predictionAccuracy?: number;
}

interface SeasonalAdjustment {
  materialId: string;
  materialName: string;
  currentABCClass: string;
  seasonalPattern: string;
  peakMonths: string[];
  recommendedABCAdjustment: string;
  expectedUtilizationImpact: number;
  suggestedReslotDate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

const BinUtilizationPredictionDashboard: React.FC = () => {
  useTranslation(); // i18n hook for future use
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<number>(30);

  // Calculate date range for trends (last 90 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  // Query: Utilization Predictions
  const {
    data: predictionsData,
    loading: predictionsLoading,
    error: predictionsError,
  } = useQuery(GET_UTILIZATION_PREDICTIONS, {
    variables: {
      facilityId: selectedFacility || undefined,
      horizonDays: selectedHorizon,
    },
    skip: !selectedFacility,
    pollInterval: 300000, // 5 minutes
  });

  // Query: Prediction Trends
  const {
    data: trendsData,
    loading: trendsLoading,
    error: trendsError,
  } = useQuery(GET_UTILIZATION_PREDICTION_TRENDS, {
    variables: {
      facilityId: selectedFacility || undefined,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    skip: !selectedFacility,
    pollInterval: 300000, // 5 minutes
  });

  // Query: Seasonal Adjustments
  const {
    data: seasonalData,
    loading: seasonalLoading,
    error: seasonalError,
  } = useQuery(GET_SEASONAL_ADJUSTMENTS, {
    variables: {
      facilityId: selectedFacility || undefined,
    },
    skip: !selectedFacility,
    pollInterval: 3600000, // 1 hour
  });

  const predictions = predictionsData?.getUtilizationPredictions || [];
  const trends = trendsData?.getUtilizationPredictionTrends || [];
  const seasonalAdjustments = seasonalData?.getSeasonalAdjustments || [];

  // Calculate summary metrics
  const latestPrediction = predictions[0];
  const avgPredictionAccuracy = trends.length > 0
    ? trends
        .filter((t: PredictionTrend) => t.predictionAccuracy !== undefined)
        .reduce((sum: number, t: PredictionTrend) => sum + (t.predictionAccuracy || 0), 0) /
      trends.filter((t: PredictionTrend) => t.predictionAccuracy !== undefined).length
    : 0;

  const highPriorityAdjustments = seasonalAdjustments.filter(
    (adj: SeasonalAdjustment) => adj.priority === 'HIGH'
  ).length;

  // Prepare chart data for prediction trends
  const trendChartData = trends.map((trend: PredictionTrend) => ({
    date: new Date(trend.date).toLocaleDateString(),
    'Actual': trend.actual30DayUtilization || null,
    'Predicted (30d)': trend.predicted30DayUtilization,
    'Predicted (14d)': trend.predicted14DayUtilization,
    'Predicted (7d)': trend.predicted7DayUtilization,
  }));

  // Prepare chart data for prediction accuracy
  const accuracyChartData = trends
    .filter((t: PredictionTrend) => t.predictionAccuracy !== undefined)
    .map((trend: PredictionTrend) => ({
      date: new Date(trend.date).toLocaleDateString(),
      'Prediction Accuracy (%)': (trend.predictionAccuracy || 0) * 100,
    }));

  // Table columns for seasonal adjustments
  const seasonalColumns: ColumnDef<SeasonalAdjustment>[] = [
    {
      accessorKey: 'materialName',
      header: 'Material',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.materialName}</div>
          <div className="text-sm text-gray-500">{row.original.materialId}</div>
        </div>
      ),
    },
    {
      accessorKey: 'currentABCClass',
      header: 'Current ABC',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        const colors: Record<string, string> = {
          A: 'bg-green-100 text-green-800',
          B: 'bg-yellow-100 text-yellow-800',
          C: 'bg-gray-100 text-gray-800',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[value] || ''}`}>
            {value}
          </span>
        );
      },
    },
    {
      accessorKey: 'recommendedABCAdjustment',
      header: 'Recommended',
      cell: ({ getValue, row }) => {
        const value = getValue() as string;
        const colors: Record<string, string> = {
          A: 'bg-green-100 text-green-800',
          B: 'bg-yellow-100 text-yellow-800',
          C: 'bg-gray-100 text-gray-800',
        };
        const isUpgrade = value > row.original.currentABCClass;
        const isDowngrade = value < row.original.currentABCClass;
        return (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[value] || ''}`}>
              {value}
            </span>
            {isUpgrade && <TrendingUp className="h-4 w-4 text-green-600" />}
            {isDowngrade && <TrendingDown className="h-4 w-4 text-red-600" />}
          </div>
        );
      },
    },
    {
      accessorKey: 'seasonalPattern',
      header: 'Pattern',
      cell: ({ getValue }) => (
        <span className="text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'peakMonths',
      header: 'Peak Months',
      cell: ({ getValue }) => {
        const months = getValue() as string[];
        return (
          <div className="flex flex-wrap gap-1">
            {months.map((month) => (
              <span key={month} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {month}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: 'expectedUtilizationImpact',
      header: 'Impact',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        const isPositive = value > 0;
        return (
          <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="font-medium">{Math.abs(value).toFixed(1)}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'suggestedReslotDate',
      header: 'Reslot Date',
      cell: ({ getValue }) => (
        <span className="text-sm">{new Date(getValue() as string).toLocaleDateString()}</span>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        const colors: Record<string, string> = {
          HIGH: 'bg-red-100 text-red-800',
          MEDIUM: 'bg-yellow-100 text-yellow-800',
          LOW: 'bg-blue-100 text-blue-800',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[value] || ''}`}>
            {value}
          </span>
        );
      },
    },
  ];

  const isLoading = predictionsLoading || trendsLoading || seasonalLoading;
  const hasError = predictionsError || trendsError || seasonalError;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'WMS', path: '/wms' },
          { label: 'Bin Utilization Prediction', path: '/wms/bin-prediction' },
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bin Utilization Prediction Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time utilization forecasting with seasonal pattern detection (OPP-1)
          </p>
        </div>
        <FacilitySelector
          selectedFacility={selectedFacility}
          onFacilityChange={setSelectedFacility}
        />
      </div>

      {!selectedFacility && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Select a Facility</h3>
            <p className="text-sm text-blue-700 mt-1">
              Please select a facility to view utilization predictions and seasonal adjustments.
            </p>
          </div>
        </div>
      )}

      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900">Error Loading Data</h3>
            <p className="text-sm text-red-700 mt-1">
              {predictionsError?.message || trendsError?.message || seasonalError?.message}
            </p>
          </div>
        </div>
      )}

      {selectedFacility && (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Predicted Utilization</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {latestPrediction?.predictedAvgUtilization?.toFixed(1) || '—'}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedHorizon}-day forecast
                  </p>
                </div>
                <Target className="h-12 w-12 text-blue-600" />
              </div>
              {latestPrediction && (
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${latestPrediction.predictedAvgUtilization}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Prediction Accuracy</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {avgPredictionAccuracy > 0 ? (avgPredictionAccuracy * 100).toFixed(1) : '—'}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    90-day average
                  </p>
                </div>
                <Brain className="h-12 w-12 text-purple-600" />
              </div>
              {avgPredictionAccuracy >= 0.9 && (
                <div className="mt-4 flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">High Confidence</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Optimal Locations</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {latestPrediction?.predictedLocationsOptimal || '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Predicted for {selectedHorizon}d
                  </p>
                </div>
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">High Priority Adjustments</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {highPriorityAdjustments}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Seasonal re-slotting needed
                  </p>
                </div>
                <Zap className="h-12 w-12 text-orange-600" />
              </div>
              {highPriorityAdjustments > 0 && (
                <div className="mt-4 flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Action Required</span>
                </div>
              )}
            </div>
          </div>

          {/* Forecast Horizon Selector */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Forecast Horizon
              </h2>
              <div className="flex gap-2">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => setSelectedHorizon(days)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedHorizon === days
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Utilization Prediction Trends Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Utilization Prediction Trends (90 Days)
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Activity className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : trendChartData.length > 0 ? (
              <Chart
                type="line"
                data={trendChartData}
                height={300}
                xAxisKey="date"
                yAxisLabel="Utilization (%)"
                series={[
                  { dataKey: 'Actual', color: '#10b981', name: 'Actual' },
                  { dataKey: 'Predicted (30d)', color: '#3b82f6', name: 'Predicted (30d)' },
                  { dataKey: 'Predicted (14d)', color: '#8b5cf6', name: 'Predicted (14d)' },
                  { dataKey: 'Predicted (7d)', color: '#f59e0b', name: 'Predicted (7d)' },
                ]}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No trend data available
              </div>
            )}
          </div>

          {/* Prediction Accuracy Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Prediction Accuracy Over Time
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Activity className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : accuracyChartData.length > 0 ? (
              <Chart
                type="line"
                data={accuracyChartData}
                height={250}
                xAxisKey="date"
                yAxisLabel="Accuracy (%)"
                series={[
                  { dataKey: 'Prediction Accuracy (%)', color: '#8b5cf6', name: 'Accuracy' },
                ]}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No accuracy data available yet
              </div>
            )}
          </div>

          {/* Seasonal Adjustment Recommendations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Seasonal ABC Adjustment Recommendations
            </h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Activity className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : seasonalAdjustments.length > 0 ? (
              <DataTable
                columns={seasonalColumns}
                data={seasonalAdjustments}
                enableSorting
                enableFiltering
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No seasonal adjustments recommended at this time
              </div>
            )}
          </div>

          {/* Model Information */}
          {latestPrediction && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900">Model Information</h3>
                  <div className="text-sm text-blue-700 mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Model Version:</span> {latestPrediction.modelVersion}
                    </div>
                    <div>
                      <span className="font-medium">Confidence Level:</span>{' '}
                      {(latestPrediction.confidenceLevel * 100).toFixed(1)}%
                    </div>
                    <div>
                      <span className="font-medium">Last Updated:</span>{' '}
                      {new Date(latestPrediction.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Expected Impact:</span> 5-10% reduction in emergency
                      re-slotting
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BinUtilizationPredictionDashboard;
