import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  RefreshCw,
  Download,
  Target,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { MaterialAutocomplete } from '../components/common/MaterialAutocomplete';
import { useAppStore } from '../store/appStore';
import { ColumnDef } from '@tanstack/react-table';
import {
  GET_DEMAND_HISTORY,
  GET_MATERIAL_FORECASTS,
  CALCULATE_SAFETY_STOCK,
  GET_FORECAST_ACCURACY_SUMMARY,
  GENERATE_FORECASTS,
  GET_REPLENISHMENT_RECOMMENDATIONS,
  GENERATE_REPLENISHMENT_RECOMMENDATIONS,
} from '../graphql/queries/forecasting';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface DemandHistory {
  demandHistoryId: string;
  demandDate: string;
  year: number;
  month: number;
  weekOfYear: number;
  actualDemandQuantity: number;
  forecastedDemandQuantity: number | null;
  demandUom: string;
  salesOrderDemand: number;
  productionOrderDemand: number;
  transferOrderDemand: number;
  forecastError: number | null;
  absolutePercentageError: number | null;
  isHoliday: boolean;
  isPromotionalPeriod: boolean;
}

interface MaterialForecast {
  forecastId: string;
  forecastDate: string;
  forecastedDemandQuantity: number;
  forecastUom: string;
  lowerBound80Pct: number | null;
  upperBound80Pct: number | null;
  lowerBound95Pct: number | null;
  upperBound95Pct: number | null;
  modelConfidenceScore: number | null;
  forecastAlgorithm: string;
  isManuallyOverridden: boolean;
  manualOverrideQuantity: number | null;
}

interface SafetyStockCalculation {
  materialId: string;
  safetyStockQuantity: number;
  reorderPoint: number;
  economicOrderQuantity: number;
  calculationMethod: string;
  avgDailyDemand: number;
  demandStdDev: number;
  avgLeadTimeDays: number;
  leadTimeStdDev: number;
  serviceLevel: number;
  zScore: number;
}

interface ForecastAccuracySummary {
  materialId: string;
  last30DaysMape: number | null;
  last60DaysMape: number | null;
  last90DaysMape: number | null;
  last30DaysBias: number | null;
  last60DaysBias: number | null;
  last90DaysBias: number | null;
  totalForecastsGenerated: number;
  totalActualDemandRecorded: number;
  currentForecastAlgorithm: string | null;
  lastForecastGenerationDate: string | null;
}

interface ReplenishmentRecommendation {
  suggestionId: string;
  materialId: string;
  suggestionGenerationTimestamp: string;
  suggestionStatus: string;
  currentOnHandQuantity: number;
  currentAllocatedQuantity: number;
  currentAvailableQuantity: number;
  currentOnOrderQuantity: number;
  safetyStockQuantity: number;
  reorderPointQuantity: number;
  economicOrderQuantity: number;
  forecastedDemand30Days: number;
  forecastedDemand60Days: number | null;
  forecastedDemand90Days: number | null;
  projectedStockoutDate: string | null;
  recommendedOrderQuantity: number;
  recommendedOrderUom: string;
  recommendedOrderDate: string;
  recommendedDeliveryDate: string | null;
  estimatedUnitCost: number | null;
  estimatedTotalCost: number | null;
  vendorLeadTimeDays: number | null;
  suggestionReason: string;
  calculationMethod: string;
  urgencyLevel: string | null;
  daysUntilStockout: number | null;
  createdAt: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const InventoryForecastingDashboard: React.FC = () => {
  // Get facility and tenant from global app store
  const { preferences } = useAppStore();
  const facilityId = preferences.selectedFacility || 'fac-1'; // Default to first facility if none selected

  // FIX: Get tenant ID from app store (with fallback for development)
  // TODO: In production, enforce that tenantId must be set via authentication
  const tenantId = (preferences as unknown).tenantId || 'tenant-default-001';

  // State management
  const [materialId, setMaterialId] = useState<string>(''); // Empty initially - user must select
  const [showConfidenceBands, setShowConfidenceBands] = useState<boolean>(true);
  const [forecastHorizonDays, setForecastHorizonDays] = useState<number>(90);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState<boolean>(false);

  // Calculate date ranges
  const today = new Date();
  const historicalStartDate = new Date(today);
  historicalStartDate.setDate(today.getDate() - 180); // 6 months history

  const forecastEndDate = new Date(today);
  forecastEndDate.setDate(today.getDate() + forecastHorizonDays);

  // Format dates for GraphQL
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // ============================================================================
  // GraphQL Queries
  // ============================================================================

  const {
    data: demandData,
    loading: demandLoading,
    error: demandError,
  } = useQuery<{ getDemandHistory: DemandHistory[] }>(GET_DEMAND_HISTORY, {
    variables: {
      tenantId,
      facilityId,
      materialId,
      startDate: formatDate(historicalStartDate),
      endDate: formatDate(today),
    },
    skip: !materialId || !facilityId, // Skip query if no material or facility selected
  });

  const {
    data: forecastData,
    loading: forecastLoading,
    refetch: refetchForecasts,
  } = useQuery<{ getMaterialForecasts: MaterialForecast[] }>(GET_MATERIAL_FORECASTS, {
    variables: {
      tenantId,
      facilityId,
      materialId,
      startDate: formatDate(today),
      endDate: formatDate(forecastEndDate),
      forecastStatus: 'ACTIVE',
    },
    skip: !materialId || !facilityId,
  });

  const { data: safetyStockData, loading: safetyStockLoading } = useQuery<{
    calculateSafetyStock: SafetyStockCalculation;
  }>(CALCULATE_SAFETY_STOCK, {
    variables: {
      input: {
        tenantId,
        facilityId,
        materialId,
        serviceLevel: 0.95,
      },
    },
    skip: !materialId || !facilityId,
  });

  const { data: accuracyData } = useQuery<{
    getForecastAccuracySummary: ForecastAccuracySummary[];
  }>(GET_FORECAST_ACCURACY_SUMMARY, {
    variables: {
      tenantId,
      facilityId,
      materialIds: [materialId],
    },
    skip: !materialId || !facilityId,
  });

  const { data: recommendationsData, refetch: refetchRecommendations } = useQuery<{
    getReplenishmentRecommendations: ReplenishmentRecommendation[];
  }>(GET_REPLENISHMENT_RECOMMENDATIONS, {
    variables: {
      tenantId,
      facilityId,
      materialId,
      status: 'PENDING',
    },
    skip: !materialId || !facilityId,
  });

  // ============================================================================
  // Mutations
  // ============================================================================

  const [generateForecasts, { loading: generatingForecasts }] = useMutation(
    GENERATE_FORECASTS,
    {
      onCompleted: () => {
        refetchForecasts();
      },
    }
  );

  const [generateRecommendations, { loading: generatingRecommendations }] = useMutation(
    GENERATE_REPLENISHMENT_RECOMMENDATIONS,
    {
      onCompleted: () => {
        refetchRecommendations();
      },
    }
  );

  const handleGenerateForecasts = async () => {
    try {
      await generateForecasts({
        variables: {
          input: {
            tenantId,
            facilityId,
            materialIds: [materialId],
            forecastHorizonDays,
            forecastAlgorithm: 'AUTO',
          },
        },
      });
    } catch (error) {
      console.error('Error generating forecasts:', error);
    }
  };

  const handleGenerateRecommendations = async () => {
    try {
      await generateRecommendations({
        variables: {
          input: {
            tenantId,
            facilityId,
            materialIds: [materialId],
          },
        },
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  };

  // ============================================================================
  // Data Processing
  // ============================================================================

  const demandHistory = demandData?.getDemandHistory || [];
  const forecasts = forecastData?.getMaterialForecasts || [];
  const safetyStock = safetyStockData?.calculateSafetyStock;
  const accuracy = accuracyData?.getForecastAccuracySummary?.[0];
  const recommendations = recommendationsData?.getReplenishmentRecommendations || [];

  // Prepare chart data combining historical and forecast data
  // Optimization: Parse dates once and memoize to avoid repeated Date object creation
  const chartData = useMemo(() => {
    // Map historical data with parsed timestamps
    const historicalData = demandHistory.map((d) => {
      const timestamp = new Date(d.demandDate).getTime();
      return {
        date: d.demandDate,
        timestamp,
        actual: d.actualDemandQuantity,
        forecast: d.forecastedDemandQuantity || null,
        type: 'historical' as const,
      };
    });

    // Map forecast data with parsed timestamps
    const forecastData = forecasts.map((f) => {
      const timestamp = new Date(f.forecastDate).getTime();
      return {
        date: f.forecastDate,
        timestamp,
        actual: null,
        forecast: f.isManuallyOverridden
          ? f.manualOverrideQuantity
          : f.forecastedDemandQuantity,
        lowerBound80: f.lowerBound80Pct,
        upperBound80: f.upperBound80Pct,
        lowerBound95: f.lowerBound95Pct,
        upperBound95: f.upperBound95Pct,
        confidence: f.modelConfidenceScore,
        type: 'forecast' as const,
      };
    });

    // Combine and sort using pre-computed timestamps (faster than creating Date objects during sort)
    return [...historicalData, ...forecastData].sort((a, b) => a.timestamp - b.timestamp);
  }, [demandHistory, forecasts]);

  // Calculate forecast accuracy metrics
  const forecastAccuracy = useMemo(() => {
    const historicalWithForecasts = demandHistory.filter(
      (d) => d.forecastedDemandQuantity !== null && d.absolutePercentageError !== null
    );

    if (historicalWithForecasts.length === 0) {
      return { mape: null, bias: null, count: 0 };
    }

    const mape =
      historicalWithForecasts.reduce((sum, d) => sum + (d.absolutePercentageError || 0), 0) /
      historicalWithForecasts.length;

    const bias =
      historicalWithForecasts.reduce((sum, d) => sum + (d.forecastError || 0), 0) /
      historicalWithForecasts.length;

    return {
      mape,
      bias,
      count: historicalWithForecasts.length,
    };
  }, [demandHistory]);

  // ============================================================================
  // Export Functions
  // ============================================================================

  const exportToCSV = (data: any[], filename: string, columns: string[]) => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV header
    const header = columns.join(',');

    // Create CSV rows
    const rows = data.map((row) => {
      return columns
        .map((col) => {
          let value = row[col];

          // Handle null/undefined
          if (value === null || value === undefined) {
            return '';
          }

          // Handle dates
          if (col.includes('Date') || col.includes('Timestamp')) {
            value = new Date(value).toLocaleDateString();
          }

          // Handle numbers
          if (typeof value === 'number') {
            value = value.toString();
          }

          // Escape quotes and wrap in quotes if contains comma
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            value = `"${value.replace(/"/g, '""')}"`;
          }

          return value;
        })
        .join(',');
    });

    // Combine header and rows
    const csv = [header, ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    // Export demand history
    if (demandHistory.length > 0) {
      exportToCSV(
        demandHistory,
        `demand_history_${materialId}`,
        [
          'demandDate',
          'actualDemandQuantity',
          'forecastedDemandQuantity',
          'demandUom',
          'salesOrderDemand',
          'productionOrderDemand',
          'transferOrderDemand',
          'forecastError',
          'absolutePercentageError',
        ]
      );
    }

    // Export forecasts
    if (forecasts.length > 0) {
      setTimeout(() => {
        exportToCSV(
          forecasts,
          `forecasts_${materialId}`,
          [
            'forecastDate',
            'forecastedDemandQuantity',
            'forecastUom',
            'lowerBound80Pct',
            'upperBound80Pct',
            'lowerBound95Pct',
            'upperBound95Pct',
            'modelConfidenceScore',
            'forecastAlgorithm',
            'isManuallyOverridden',
          ]
        );
      }, 500);
    }

    // Export recommendations
    if (recommendations.length > 0) {
      setTimeout(() => {
        exportToCSV(
          recommendations,
          `replenishment_recommendations_${materialId}`,
          [
            'urgencyLevel',
            'recommendedOrderDate',
            'recommendedOrderQuantity',
            'recommendedOrderUom',
            'daysUntilStockout',
            'currentAvailableQuantity',
            'safetyStockQuantity',
            'reorderPointQuantity',
            'estimatedTotalCost',
            'suggestionReason',
          ]
        );
      }, 1000);
    }
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getMapeColor = (mape: number | null) => {
    if (mape === null) return 'text-gray-600 bg-gray-100';
    if (mape <= 10) return 'text-green-600 bg-green-100';
    if (mape <= 20) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getBiasIndicator = (bias: number | null) => {
    if (bias === null) return { icon: <Activity className="w-5 h-5" />, color: 'text-gray-600' };
    if (Math.abs(bias) <= 5)
      return { icon: <Activity className="w-5 h-5" />, color: 'text-green-600' };
    if (bias > 5)
      return { icon: <TrendingUp className="w-5 h-5" />, color: 'text-orange-600' };
    return { icon: <TrendingDown className="w-5 h-5" />, color: 'text-blue-600' };
  };

  const getUrgencyColor = (urgency: string | null) => {
    if (!urgency) return 'text-gray-600 bg-gray-100';
    switch (urgency) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-100';
      case 'HIGH':
        return 'text-orange-600 bg-orange-100';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-100';
      case 'LOW':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const demandHistoryColumns: ColumnDef<DemandHistory>[] = [
    {
      accessorKey: 'demandDate',
      header: 'Date',
      cell: (info) => new Date(info.getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: 'actualDemandQuantity',
      header: 'Actual Demand',
      cell: (info) => info.getValue<number>().toFixed(2),
    },
    {
      accessorKey: 'forecastedDemandQuantity',
      header: 'Forecasted',
      cell: (info) => {
        const value = info.getValue<number | null>();
        return value !== null ? value.toFixed(2) : 'N/A';
      },
    },
    {
      accessorKey: 'absolutePercentageError',
      header: 'Error %',
      cell: (info) => {
        const value = info.getValue<number | null>();
        return value !== null ? `${value.toFixed(1)}%` : 'N/A';
      },
    },
    {
      accessorKey: 'salesOrderDemand',
      header: 'Sales Orders',
      cell: (info) => info.getValue<number>().toFixed(2),
    },
    {
      accessorKey: 'productionOrderDemand',
      header: 'Production',
      cell: (info) => info.getValue<number>().toFixed(2),
    },
  ];

  const forecastColumns: ColumnDef<MaterialForecast>[] = [
    {
      accessorKey: 'forecastDate',
      header: 'Date',
      cell: (info) => new Date(info.getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: 'forecastedDemandQuantity',
      header: 'Forecast',
      cell: (info) => {
        const row = info.row.original;
        const value = row.isManuallyOverridden
          ? row.manualOverrideQuantity
          : info.getValue<number>();
        return (
          <div className="flex items-center gap-2">
            {value?.toFixed(2)}
            {row.isManuallyOverridden && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                Manual
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'lowerBound80Pct',
      header: '80% Lower',
      cell: (info) => {
        const value = info.getValue<number | null>();
        return value !== null ? value.toFixed(2) : 'N/A';
      },
    },
    {
      accessorKey: 'upperBound80Pct',
      header: '80% Upper',
      cell: (info) => {
        const value = info.getValue<number | null>();
        return value !== null ? value.toFixed(2) : 'N/A';
      },
    },
    {
      accessorKey: 'modelConfidenceScore',
      header: 'Confidence',
      cell: (info) => {
        const value = info.getValue<number | null>();
        if (value === null) return 'N/A';
        const percentage = (value * 100).toFixed(1);
        return (
          <span
            className={`px-2 py-1 rounded-md font-semibold ${
              value >= 0.8
                ? 'text-green-600 bg-green-100'
                : value >= 0.6
                ? 'text-yellow-600 bg-yellow-100'
                : 'text-red-600 bg-red-100'
            }`}
          >
            {percentage}%
          </span>
        );
      },
    },
    {
      accessorKey: 'forecastAlgorithm',
      header: 'Algorithm',
    },
  ];

  const recommendationColumns: ColumnDef<ReplenishmentRecommendation>[] = [
    {
      accessorKey: 'urgencyLevel',
      header: 'Urgency',
      cell: (info) => {
        const value = info.getValue<string | null>();
        return (
          <span className={`px-2 py-1 rounded-md font-semibold ${getUrgencyColor(value)}`}>
            {value || 'N/A'}
          </span>
        );
      },
    },
    {
      accessorKey: 'recommendedOrderDate',
      header: 'Order Date',
      cell: (info) => new Date(info.getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: 'recommendedOrderQuantity',
      header: 'Qty',
      cell: (info) => {
        const row = info.row.original;
        return `${info.getValue<number>().toFixed(0)} ${row.recommendedOrderUom}`;
      },
    },
    {
      accessorKey: 'daysUntilStockout',
      header: 'Days to Stockout',
      cell: (info) => {
        const value = info.getValue<number | null>();
        if (value === null) return 'N/A';
        return (
          <span className={value <= 7 ? 'text-red-600 font-bold' : value <= 14 ? 'text-orange-600' : ''}>
            {value}
          </span>
        );
      },
    },
    {
      accessorKey: 'currentAvailableQuantity',
      header: 'Available',
      cell: (info) => info.getValue<number>().toFixed(0),
    },
    {
      accessorKey: 'estimatedTotalCost',
      header: 'Est. Cost',
      cell: (info) => {
        const value = info.getValue<number | null>();
        return value !== null ? `$${value.toFixed(2)}` : 'N/A';
      },
    },
    {
      accessorKey: 'suggestionReason',
      header: 'Reason',
      cell: (info) => (
        <div className="max-w-xs truncate" title={info.getValue<string>()}>
          {info.getValue<string>()}
        </div>
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Inventory Forecasting</h1>
            <FacilitySelector />
          </div>
          <p className="text-gray-600">
            Demand forecasting, safety stock calculation, and replenishment planning
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerateForecasts}
            disabled={generatingForecasts}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingForecasts ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Generate Forecasts
              </>
            )}
          </button>
          <button
            onClick={handleExportAll}
            disabled={!materialId || (demandHistory.length === 0 && forecasts.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Material Selector & Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Material
            </label>
            <MaterialAutocomplete
              tenantId={tenantId}
              value={materialId}
              onChange={(id) => setMaterialId(id)}
              placeholder="Search and select a material..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Horizon (Days)
            </label>
            <select
              value={forecastHorizonDays}
              onChange={(e) => setForecastHorizonDays(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={30}>30 Days (Short Term)</option>
              <option value={90}>90 Days (Medium Term)</option>
              <option value={180}>180 Days (Long Term)</option>
              <option value={365}>365 Days (Annual)</option>
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showConfidenceBands}
                onChange={(e) => setShowConfidenceBands(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Show Confidence Bands</span>
            </label>
          </div>
        </div>
      </div>

      {/* Empty State - No Material Selected */}
      {!materialId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <Package className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Material to Begin</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Enter a material ID above to view demand forecasting, safety stock calculations, and replenishment recommendations.
          </p>
        </div>
      )}

      {/* Loading State - Enhanced with skeleton cards */}
      {materialId && (demandLoading || forecastLoading) && (
        <div className="space-y-6 animate-pulse">
          {/* Skeleton KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6">
                <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>

          {/* Skeleton Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-96 bg-gray-100 rounded"></div>
          </div>

          {/* Skeleton Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error State - Enhanced with retry button */}
      {materialId && demandError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Failed to Load Forecasting Data
              </h3>
              <p className="text-red-700 text-sm mb-4">
                {demandError.message}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Summary Cards */}
      {materialId && !demandLoading && !forecastLoading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Forecast Accuracy (MAPE) */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">Forecast Accuracy (MAPE)</div>
              <div className={`text-2xl font-bold px-2 py-1 rounded-md inline-block ${getMapeColor(accuracy?.last90DaysMape || null)}`}>
                {accuracy?.last90DaysMape !== null && accuracy?.last90DaysMape !== undefined
                  ? `${accuracy.last90DaysMape.toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Last 90 days (Lower is better)
              </div>
            </div>

            {/* Forecast Bias */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  {getBiasIndicator(forecastAccuracy.bias).icon}
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">Forecast Bias</div>
              <div className={`text-2xl font-bold ${getBiasIndicator(forecastAccuracy.bias).color}`}>
                {forecastAccuracy.bias !== null
                  ? `${forecastAccuracy.bias > 0 ? '+' : ''}${forecastAccuracy.bias.toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {forecastAccuracy.bias !== null
                  ? forecastAccuracy.bias > 0
                    ? 'Over-forecasting'
                    : forecastAccuracy.bias < 0
                    ? 'Under-forecasting'
                    : 'Balanced'
                  : 'Insufficient data'}
              </div>
            </div>

            {/* Safety Stock */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">Safety Stock</div>
              <div className="text-2xl font-bold text-gray-900">
                {!safetyStockLoading && safetyStock
                  ? safetyStock.safetyStockQuantity.toFixed(0)
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                95% Service Level
              </div>
            </div>

            {/* Reorder Point */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">Reorder Point</div>
              <div className="text-2xl font-bold text-gray-900">
                {!safetyStockLoading && safetyStock
                  ? safetyStock.reorderPoint.toFixed(0)
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Order when stock reaches this level
              </div>
            </div>
          </div>

          {/* Demand & Forecast Trend Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Demand History & Forecast
              </h2>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>Actual Demand</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Forecast</span>
                </div>
                {showConfidenceBands && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 rounded"></div>
                    <span>80% Confidence</span>
                  </div>
                )}
              </div>
            </div>
            {chartData.length > 0 ? (
              <Chart
                data={chartData}
                type="line"
                xKey="date"
                yKey={['actual', 'forecast']}
                colors={['#3b82f6', '#10b981']}
                height={400}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                No data available for the selected material
              </div>
            )}
          </div>

          {/* Advanced Metrics Toggle */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <button
              onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
              className="flex items-center justify-between w-full text-left"
            >
              <h2 className="text-xl font-bold text-gray-900">Advanced Metrics</h2>
              {showAdvancedMetrics ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {showAdvancedMetrics && safetyStock && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    Demand Characteristics
                  </h3>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between py-1">
                      <span>Avg Daily Demand:</span>
                      <span className="font-semibold">
                        {safetyStock.avgDailyDemand.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Demand Std Dev:</span>
                      <span className="font-semibold">
                        {safetyStock.demandStdDev.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Z-Score (95%):</span>
                      <span className="font-semibold">
                        {safetyStock.zScore.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">Lead Time</h3>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between py-1">
                      <span>Avg Lead Time:</span>
                      <span className="font-semibold">
                        {safetyStock.avgLeadTimeDays.toFixed(1)} days
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Lead Time Std Dev:</span>
                      <span className="font-semibold">
                        {safetyStock.leadTimeStdDev.toFixed(1)} days
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    Replenishment
                  </h3>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between py-1">
                      <span>Economic Order Qty:</span>
                      <span className="font-semibold">
                        {safetyStock.economicOrderQuantity.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Method:</span>
                      <span className="font-semibold">
                        {safetyStock.calculationMethod}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Demand History Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Recent Demand History
            </h2>
            {demandHistory.length > 0 ? (
              <DataTable
                data={demandHistory.slice(0, 20)}
                columns={demandHistoryColumns}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                No demand history available
              </div>
            )}
          </div>

          {/* Forecast Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Upcoming Forecasts
            </h2>
            {forecasts.length > 0 ? (
              <DataTable data={forecasts.slice(0, 20)} columns={forecastColumns} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                No forecasts available. Click "Generate Forecasts" to create new forecasts.
              </div>
            )}
          </div>

          {/* Replenishment Recommendations */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Replenishment Recommendations
              </h2>
              <button
                onClick={handleGenerateRecommendations}
                disabled={generatingRecommendations}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingRecommendations ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Generate Recommendations
                  </>
                )}
              </button>
            </div>
            {recommendations.length > 0 ? (
              <DataTable data={recommendations} columns={recommendationColumns} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                No pending recommendations. Click "Generate Recommendations" to create new recommendations based on current forecasts and inventory levels.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
