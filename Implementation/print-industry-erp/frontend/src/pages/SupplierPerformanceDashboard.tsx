/**
 * Supplier Performance Dashboard
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 */

import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus, Award, AlertCircle } from 'lucide-react';
import {
  GET_SUPPLIER_PERFORMANCE,
  GET_SUPPLIER_PERFORMANCE_TRENDS,
} from '../graphql/queries/supplierPortal';
import Chart from '../components/common/Chart';

const SupplierPerformanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const { data: performanceData, loading: loadingPerformance } = useQuery(
    GET_SUPPLIER_PERFORMANCE,
    {
      variables: { year: selectedYear, month: selectedMonth },
    }
  );

  const { data: trendsData, loading: loadingTrends } = useQuery(
    GET_SUPPLIER_PERFORMANCE_TRENDS,
    {
      variables: { months: 12 },
    }
  );

  const performance = performanceData?.supplierPerformance;
  const trends = trendsData?.supplierPerformanceTrends || [];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'STRATEGIC':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'PREFERRED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'TRANSACTIONAL':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'DECLINING':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loadingPerformance) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('supplierPortal.performance.title')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('supplierPortal.performance.subtitle')}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {new Date(2025, month - 1).toLocaleString('default', {
                  month: 'long',
                })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {t('supplierPortal.performance.overallRating')}
            </span>
            {getTrendIcon(performance?.qualityTrend)}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {performance?.overallRating?.toFixed(1) || 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {t('supplierPortal.performance.outOf')} 5.0
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {t('supplierPortal.performance.onTimeDelivery')}
            </span>
            {getTrendIcon(performance?.onTimeDeliveryTrend)}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {performance?.onTimeDeliveryPercentage?.toFixed(1) || 'N/A'}%
          </p>
          {performance?.previousMonthComparison && (
            <p
              className={`text-xs mt-1 ${
                performance.previousMonthComparison.onTimeDeliveryChange >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {performance.previousMonthComparison.onTimeDeliveryChange > 0 ? '+' : ''}
              {performance.previousMonthComparison.onTimeDeliveryChange.toFixed(1)}%{' '}
              {t('supplierPortal.performance.fromLastMonth')}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {t('supplierPortal.performance.qualityAcceptance')}
            </span>
            {getTrendIcon(performance?.qualityTrend)}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {performance?.qualityAcceptancePercentage?.toFixed(1) || 'N/A'}%
          </p>
          {performance?.previousMonthComparison && (
            <p
              className={`text-xs mt-1 ${
                performance.previousMonthComparison.qualityChange >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {performance.previousMonthComparison.qualityChange > 0 ? '+' : ''}
              {performance.previousMonthComparison.qualityChange.toFixed(1)}%{' '}
              {t('supplierPortal.performance.fromLastMonth')}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-2">
            <Award className="h-5 w-5 text-purple-500 mr-2" />
            <span className="text-sm font-medium text-gray-600">
              {t('supplierPortal.performance.vendorTier')}
            </span>
          </div>
          <div
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getTierColor(
              performance?.vendorTier
            )}`}
          >
            {performance?.vendorTier || 'N/A'}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {performance?.totalPOsIssued || 0}{' '}
            {t('supplierPortal.performance.posThisMonth')}
          </p>
        </div>
      </div>

      {/* Trends Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('supplierPortal.performance.onTimeDeliveryTrend')}
          </h3>
          <Chart
            type="line"
            data={{
              labels: trends.map(
                (t: any) => `${t.year}-${String(t.month).padStart(2, '0')}`
              ),
              datasets: [
                {
                  label: t('supplierPortal.performance.onTimeDelivery'),
                  data: trends.map((t: any) => t.onTimeDeliveryPercentage),
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  tension: 0.4,
                },
              ],
            }}
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                },
              },
            }}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('supplierPortal.performance.qualityTrend')}
          </h3>
          <Chart
            type="line"
            data={{
              labels: trends.map(
                (t: any) => `${t.year}-${String(t.month).padStart(2, '0')}`
              ),
              datasets: [
                {
                  label: t('supplierPortal.performance.qualityAcceptance'),
                  data: trends.map((t: any) => t.qualityAcceptancePercentage),
                  borderColor: 'rgb(34, 197, 94)',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  tension: 0.4,
                },
              ],
            }}
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                },
              },
            }}
          />
        </div>
      </div>

      {/* Monthly Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            {t('supplierPortal.performance.monthlyDetails')}
          </h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-600">
                {t('supplierPortal.performance.totalPOs')}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {performance?.totalPOsIssued || 0}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">
                {t('supplierPortal.performance.totalValue')}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(performance?.totalPOsValue || 0)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">
                {t('supplierPortal.performance.avgLeadTime')}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {performance?.averageLeadTimeDays || 'N/A'}{' '}
                {performance?.averageLeadTimeDays ? t('common.days') : ''}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default SupplierPerformanceDashboard;
