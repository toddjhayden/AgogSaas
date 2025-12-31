import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  CheckCircle,
  Award,
  Calendar,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import { GET_VENDOR_SCORECARD } from '../graphql/queries/vendorScorecard';
import { GET_VENDORS as GET_VENDORS_FROM_PO } from '../graphql/queries/purchaseOrders';

// TypeScript interfaces for data structures
interface VendorPerformanceMetrics {
  id: string;
  evaluationPeriodYear: number;
  evaluationPeriodMonth: number;
  totalPosIssued: number;
  totalPosValue: number;
  onTimeDeliveries: number;
  totalDeliveries: number;
  onTimePercentage: number | null;
  qualityAcceptances: number;
  qualityRejections: number;
  qualityPercentage: number | null;
  priceCompetitivenessScore: number | null;
  responsivenessScore: number | null;
  overallRating: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VendorScorecard {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  currentRating: number;
  rollingOnTimePercentage: number;
  rollingQualityPercentage: number;
  rollingAvgRating: number;
  trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING';
  monthsTracked: number;
  lastMonthRating: number;
  last3MonthsAvgRating: number;
  last6MonthsAvgRating: number;
  monthlyPerformance: VendorPerformanceMetrics[];
}

interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  vendorType: string;
  isActive: boolean;
}

export const VendorScorecardDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // Default tenant ID - in production, this would come from user context/JWT
  const tenantId = 'tenant-default-001';

  // Fetch vendors for selector
  const { data: vendorsData, loading: vendorsLoading } = useQuery<{
    vendors: Vendor[];
  }>(GET_VENDORS_FROM_PO, {
    variables: { tenantId, isActive: true, isApproved: true, limit: 100 },
  });

  // Fetch vendor scorecard data
  const {
    data: scorecardData,
    loading: scorecardLoading,
    error: scorecardError,
  } = useQuery<{
    vendorScorecard: VendorScorecard;
  }>(GET_VENDOR_SCORECARD, {
    variables: { tenantId, vendorId: selectedVendorId },
    skip: !selectedVendorId,
  });

  const vendors = vendorsData?.vendors || [];
  const scorecard = scorecardData?.vendorScorecard;

  // Helper function to render star rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" style={{ clipPath: 'inset(0 50% 0 0)' }} />
        );
      } else {
        stars.push(<Star key={i} className="w-5 h-5 text-gray-300" />);
      }
    }

    return <div className="flex items-center space-x-1">{stars}</div>;
  };

  // Helper function to get trend icon and color
  const getTrendIndicator = (direction: 'IMPROVING' | 'STABLE' | 'DECLINING') => {
    switch (direction) {
      case 'IMPROVING':
        return {
          icon: <TrendingUp className="w-5 h-5" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: t('vendorScorecard.improving'),
        };
      case 'DECLINING':
        return {
          icon: <TrendingDown className="w-5 h-5" />,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          label: t('vendorScorecard.declining'),
        };
      case 'STABLE':
      default:
        return {
          icon: <Minus className="w-5 h-5" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          label: t('vendorScorecard.stable'),
        };
    }
  };

  // Helper function to get rating color class
  const getRatingColor = (rating: number) => {
    if (rating >= 4.0) return 'text-green-600 bg-green-100';
    if (rating >= 2.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Prepare chart data for performance trend
  const chartData = scorecard?.monthlyPerformance
    ?.slice()
    .reverse()
    .map((m) => ({
      month: `${m.evaluationPeriodYear}-${String(m.evaluationPeriodMonth).padStart(2, '0')}`,
      'On-Time Delivery %': m.onTimePercentage || 0,
      'Quality %': m.qualityPercentage || 0,
      'Overall Rating': (m.overallRating || 0) * 20, // Scale to 0-100 for comparison
    })) || [];

  // Table column definitions for monthly performance
  const monthlyPerformanceColumns: ColumnDef<VendorPerformanceMetrics>[] = [
    {
      accessorKey: 'evaluationPeriodYear',
      header: t('vendorScorecard.period'),
      cell: (info) => {
        const row = info.row.original;
        return `${row.evaluationPeriodYear}-${String(row.evaluationPeriodMonth).padStart(2, '0')}`;
      },
    },
    {
      accessorKey: 'totalPosIssued',
      header: t('vendorScorecard.posIssued'),
      cell: (info) => info.getValue<number>(),
    },
    {
      accessorKey: 'totalPosValue',
      header: t('vendorScorecard.posValue'),
      cell: (info) => `$${info.getValue<number>().toLocaleString()}`,
    },
    {
      accessorKey: 'onTimePercentage',
      header: t('vendorScorecard.otdPercentage'),
      cell: (info) => {
        const value = info.getValue<number | null>();
        return value !== null ? `${value.toFixed(1)}%` : 'N/A';
      },
    },
    {
      accessorKey: 'qualityPercentage',
      header: t('vendorScorecard.qualityPercentage'),
      cell: (info) => {
        const value = info.getValue<number | null>();
        return value !== null ? `${value.toFixed(1)}%` : 'N/A';
      },
    },
    {
      accessorKey: 'overallRating',
      header: t('vendorScorecard.rating'),
      cell: (info) => {
        const rating = info.getValue<number>();
        return (
          <span className={`px-2 py-1 rounded-md font-semibold ${getRatingColor(rating)}`}>
            {rating.toFixed(1)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: t('nav.procurement'), path: '/procurement/purchase-orders' },
          { label: t('nav.vendorScorecard'), path: '/procurement/vendor-scorecard' },
        ]}
      />

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('vendorScorecard.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('vendorScorecard.subtitle')}
          </p>
        </div>

        {/* Vendor Selector */}
        <div className="w-96">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('vendorScorecard.selectVendor')}
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            disabled={vendorsLoading}
          >
            <option value="">{t('vendorScorecard.selectVendorPlaceholder')}</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.vendorCode} - {vendor.vendorName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {scorecardLoading && selectedVendorId && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('vendorScorecard.loading')}</p>
        </div>
      )}

      {/* Error State */}
      {scorecardError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {t('vendorScorecard.error')}: {scorecardError.message}
        </div>
      )}

      {/* Empty State */}
      {!selectedVendorId && !scorecardLoading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('vendorScorecard.noVendorSelected')}
          </h3>
          <p className="text-gray-600">
            {t('vendorScorecard.selectVendorToViewScorecard')}
          </p>
        </div>
      )}

      {/* Scorecard Content */}
      {scorecard && !scorecardLoading && (
        <>
          {/* Vendor Header */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {scorecard.vendorName}
                </h2>
                <p className="text-gray-600 mt-1">
                  {t('vendorScorecard.vendorCode')}: {scorecard.vendorCode}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-2">
                  {t('vendorScorecard.currentRating')}
                </div>
                {renderStars(scorecard.currentRating)}
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {scorecard.currentRating.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* On-Time Delivery */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorScorecard.onTimeDelivery')}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {scorecard.rollingOnTimePercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('vendorScorecard.rollingAverage', { months: 12 })}
              </div>
            </div>

            {/* Quality */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorScorecard.qualityAcceptance')}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {scorecard.rollingQualityPercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('vendorScorecard.rollingAverage', { months: 12 })}
              </div>
            </div>

            {/* Overall Rating */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorScorecard.avgRating')}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {scorecard.rollingAvgRating.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('vendorScorecard.rollingAverage', { months: 12 })}
              </div>
            </div>

            {/* Trend */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${getTrendIndicator(scorecard.trendDirection).bgColor}`}>
                  {getTrendIndicator(scorecard.trendDirection).icon}
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorScorecard.trend')}
              </div>
              <div className={`text-2xl font-bold ${getTrendIndicator(scorecard.trendDirection).color}`}>
                {getTrendIndicator(scorecard.trendDirection).label}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('vendorScorecard.monthsTracked', { months: scorecard.monthsTracked })}
              </div>
            </div>
          </div>

          {/* Performance Trend Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('vendorScorecard.performanceTrend')}
            </h2>
            {chartData.length > 0 ? (
              <Chart
                data={chartData}
                type="line"
                xKey="month"
                yKeys={['On-Time Delivery %', 'Quality %', 'Overall Rating']}
                colors={['#3b82f6', '#10b981', '#f59e0b']}
                height={400}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                {t('vendorScorecard.noChartData')}
              </div>
            )}
          </div>

          {/* Recent Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-3 mb-3">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-700">
                  {t('vendorScorecard.lastMonth')}
                </h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {scorecard.lastMonthRating.toFixed(1)}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-3 mb-3">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-700">
                  {t('vendorScorecard.last3Months')}
                </h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {scorecard.last3MonthsAvgRating.toFixed(1)}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-3 mb-3">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-700">
                  {t('vendorScorecard.last6Months')}
                </h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {scorecard.last6MonthsAvgRating.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Monthly Performance Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('vendorScorecard.monthlyPerformance')}
            </h2>
            {scorecard.monthlyPerformance && scorecard.monthlyPerformance.length > 0 ? (
              <DataTable
                data={scorecard.monthlyPerformance.slice().reverse()}
                columns={monthlyPerformanceColumns}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                {t('vendorScorecard.noPerformanceData')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
