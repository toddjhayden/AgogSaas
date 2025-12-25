import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Star,
  Award,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import { GET_VENDOR_COMPARISON_REPORT } from '../graphql/queries/vendorScorecard';
import { useNavigate } from 'react-router-dom';

// TypeScript interfaces for data structures
interface VendorPerformanceSummary {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  overallRating: number;
  onTimePercentage: number;
  qualityPercentage: number;
}

interface VendorAverageMetrics {
  avgOnTimePercentage: number;
  avgQualityPercentage: number;
  avgOverallRating: number;
  totalVendorsEvaluated: number;
}

interface VendorComparisonReport {
  evaluationPeriodYear: number;
  evaluationPeriodMonth: number;
  vendorType: string | null;
  topPerformers: VendorPerformanceSummary[];
  bottomPerformers: VendorPerformanceSummary[];
  averageMetrics: VendorAverageMetrics;
}

export const VendorComparisonDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Default tenant ID - in production, this would come from user context/JWT
  const tenantId = 'tenant-default-001';

  // State for filters
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedVendorType, setSelectedVendorType] = useState<string | null>(null);
  const [topN, setTopN] = useState<number>(5);

  // Fetch vendor comparison report
  const {
    data: comparisonData,
    loading: comparisonLoading,
    error: comparisonError,
  } = useQuery<{
    vendorComparisonReport: VendorComparisonReport;
  }>(GET_VENDOR_COMPARISON_REPORT, {
    variables: {
      tenantId,
      year: selectedYear,
      month: selectedMonth,
      vendorType: selectedVendorType,
      topN,
    },
  });

  const report = comparisonData?.vendorComparisonReport;

  // Helper function to render star rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const stars = [];

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        );
      } else {
        stars.push(<Star key={i} className="w-4 h-4 text-gray-300" />);
      }
    }

    return <div className="flex items-center space-x-0.5">{stars}</div>;
  };

  // Helper function to get rating color class
  const getRatingColor = (rating: number) => {
    if (rating >= 4.0) return 'text-green-600 bg-green-100';
    if (rating >= 2.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Table column definitions for top performers
  const topPerformersColumns: ColumnDef<VendorPerformanceSummary>[] = [
    {
      accessorKey: 'vendorCode',
      header: t('vendorComparison.vendorCode'),
      cell: (info) => (
        <button
          onClick={() => navigate(`/procurement/vendor-scorecard?vendorId=${info.row.original.vendorId}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {info.getValue<string>()}
        </button>
      ),
    },
    {
      accessorKey: 'vendorName',
      header: t('vendorComparison.vendorName'),
    },
    {
      accessorKey: 'overallRating',
      header: t('vendorComparison.rating'),
      cell: (info) => {
        const rating = info.getValue<number>();
        return (
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-md font-semibold ${getRatingColor(rating)}`}>
              {rating.toFixed(1)}
            </span>
            {renderStars(rating)}
          </div>
        );
      },
    },
    {
      accessorKey: 'onTimePercentage',
      header: t('vendorComparison.otdPercentage'),
      cell: (info) => {
        const value = info.getValue<number>();
        return (
          <span className={value >= 90 ? 'text-green-600 font-semibold' : ''}>
            {value.toFixed(1)}%
          </span>
        );
      },
    },
    {
      accessorKey: 'qualityPercentage',
      header: t('vendorComparison.qualityPercentage'),
      cell: (info) => {
        const value = info.getValue<number>();
        return (
          <span className={value >= 95 ? 'text-green-600 font-semibold' : ''}>
            {value.toFixed(1)}%
          </span>
        );
      },
    },
  ];

  // Table column definitions for bottom performers
  const bottomPerformersColumns: ColumnDef<VendorPerformanceSummary>[] = [
    {
      accessorKey: 'vendorCode',
      header: t('vendorComparison.vendorCode'),
      cell: (info) => (
        <button
          onClick={() => navigate(`/procurement/vendor-scorecard?vendorId=${info.row.original.vendorId}`)}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {info.getValue<string>()}
        </button>
      ),
    },
    {
      accessorKey: 'vendorName',
      header: t('vendorComparison.vendorName'),
    },
    {
      accessorKey: 'overallRating',
      header: t('vendorComparison.rating'),
      cell: (info) => {
        const rating = info.getValue<number>();
        return (
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-md font-semibold ${getRatingColor(rating)}`}>
              {rating.toFixed(1)}
            </span>
            {renderStars(rating)}
          </div>
        );
      },
    },
    {
      accessorKey: 'onTimePercentage',
      header: t('vendorComparison.otdPercentage'),
      cell: (info) => {
        const value = info.getValue<number>();
        return (
          <span className={value < 80 ? 'text-red-600 font-semibold' : ''}>
            {value.toFixed(1)}%
          </span>
        );
      },
    },
    {
      accessorKey: 'qualityPercentage',
      header: t('vendorComparison.qualityPercentage'),
      cell: (info) => {
        const value = info.getValue<number>();
        return (
          <span className={value < 90 ? 'text-red-600 font-semibold' : ''}>
            {value.toFixed(1)}%
          </span>
        );
      },
    },
  ];

  // Prepare distribution chart data
  const distributionData = report
    ? [
        { tier: '1-2 Stars', count: 0 },
        { tier: '2-3 Stars', count: 0 },
        { tier: '3-4 Stars', count: 0 },
        { tier: '4-5 Stars', count: 0 },
      ]
    : [];

  // Calculate distribution (simplified - in real implementation would come from backend)
  if (report) {
    [...report.topPerformers, ...report.bottomPerformers].forEach((vendor) => {
      const rating = vendor.overallRating;
      if (rating >= 4) distributionData[3].count++;
      else if (rating >= 3) distributionData[2].count++;
      else if (rating >= 2) distributionData[1].count++;
      else distributionData[0].count++;
    });
  }

  // Generate year options (last 3 years)
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: t('nav.procurement'), path: '/procurement/purchase-orders' },
          { label: t('nav.vendorComparison'), path: '/procurement/vendor-comparison' },
        ]}
      />

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('vendorComparison.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('vendorComparison.subtitle')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('vendorComparison.filters')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Year Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendorComparison.year')}
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendorComparison.month')}
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendorComparison.vendorType')}
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={selectedVendorType || ''}
              onChange={(e) => setSelectedVendorType(e.target.value || null)}
            >
              <option value="">{t('vendorComparison.allTypes')}</option>
              <option value="MATERIAL_SUPPLIER">{t('vendorComparison.materialSupplier')}</option>
              <option value="TRADE_PRINTER">{t('vendorComparison.tradePrinter')}</option>
              <option value="SERVICE_PROVIDER">{t('vendorComparison.serviceProvider')}</option>
              <option value="MRO_SUPPLIER">{t('vendorComparison.mroSupplier')}</option>
              <option value="FREIGHT_CARRIER">{t('vendorComparison.freightCarrier')}</option>
              <option value="EQUIPMENT_VENDOR">{t('vendorComparison.equipmentVendor')}</option>
            </select>
          </div>

          {/* Top N Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendorComparison.topN')}
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {comparisonLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('vendorComparison.loading')}</p>
        </div>
      )}

      {/* Error State */}
      {comparisonError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {t('vendorComparison.error')}: {comparisonError.message}
        </div>
      )}

      {/* Report Content */}
      {report && !comparisonLoading && (
        <>
          {/* Average Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorComparison.vendorsEvaluated')}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {report.averageMetrics.totalVendorsEvaluated}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorComparison.avgOtd')}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {report.averageMetrics.avgOnTimePercentage.toFixed(1)}%
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Award className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorComparison.avgQuality')}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {report.averageMetrics.avgQualityPercentage.toFixed(1)}%
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">
                {t('vendorComparison.avgRating')}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {report.averageMetrics.avgOverallRating.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">
                {t('vendorComparison.topPerformers')}
              </h2>
            </div>
            {report.topPerformers && report.topPerformers.length > 0 ? (
              <DataTable
                data={report.topPerformers}
                columns={topPerformersColumns}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                {t('vendorComparison.noTopPerformers')}
              </div>
            )}
          </div>

          {/* Bottom Performers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <TrendingDown className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">
                {t('vendorComparison.bottomPerformers')}
              </h2>
            </div>
            {report.bottomPerformers && report.bottomPerformers.length > 0 ? (
              <DataTable
                data={report.bottomPerformers}
                columns={bottomPerformersColumns}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                {t('vendorComparison.noBottomPerformers')}
              </div>
            )}
          </div>

          {/* Rating Distribution Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t('vendorComparison.ratingDistribution')}
            </h2>
            {distributionData.length > 0 ? (
              <Chart
                data={distributionData}
                type="bar"
                xKey="tier"
                yKeys={['count']}
                colors={['#3b82f6']}
                height={300}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                {t('vendorComparison.noDistributionData')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
