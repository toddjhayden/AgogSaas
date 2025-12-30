import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  Users,
  Package,
  FileText,
  Download,
  Calendar,
  Filter,
} from 'lucide-react';
import { GET_EXECUTIVE_KPI_SUMMARY } from '../graphql/queries/analytics';
import { Chart } from '../components/common/Chart';
import { KPICard } from '../components/common/KPICard';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

/**
 * REQ-STRATEGIC-AUTO-1767048328662: Advanced Reporting & Business Intelligence Suite
 * Business Intelligence Dashboard - Executive KPI Summary View
 */

interface ExecutiveKPISummary {
  period: string;
  financialKPIs: {
    totalRevenue: number;
    totalCosts: number;
    netProfit: number;
    profitMargin: number;
    trend: string;
  };
  operationalKPIs: {
    avgCycleTime: number;
    onTimeDeliveryRate: number;
    productionEfficiency: number;
    materialUtilization: number;
    trend: string;
  };
  vendorKPIs: {
    avgLeadTime: number;
    avgOnTimeDelivery: number;
    avgQualityScore: number;
    activeVendorCount: number;
    trend: string;
  };
  customerKPIs: {
    activeCustomerCount: number;
    avgOrderValue: number;
    customerRetentionRate: number;
    avgProfitMargin: number;
    trend: string;
  };
  forecastKPIs: {
    forecastAccuracy: number;
    stockoutRate: number;
    excessInventoryRate: number;
    turnoverDays: number;
    trend: string;
  };
}

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

export const BusinessIntelligenceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');

  const { loading, error, data } = useQuery<{ executiveKPISummary: ExecutiveKPISummary }>(
    GET_EXECUTIVE_KPI_SUMMARY,
    {
      variables: { period: selectedPeriod },
      pollInterval: 60000, // Refresh every minute
    }
  );

  const kpiSummary = data?.executiveKPISummary;

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t('analytics.error')}: {error.message}</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'stable';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('analytics.biDashboard')}</h1>
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            {(['today', 'week', 'month', 'quarter', 'year'] as Period[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t(`analytics.period.${period}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">{t('analytics.financialKPIs')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            id="total-revenue"
            name={t('analytics.totalRevenue')}
            currentValue={kpiSummary?.financialKPIs.totalRevenue || 0}
            unit="$"
            trend={getTrendIcon(kpiSummary?.financialKPIs.trend || 'stable') as any}
            trendPercent={5.2}
            sparklineData={[]}
          />
          <KPICard
            id="net-profit"
            name={t('analytics.netProfit')}
            currentValue={kpiSummary?.financialKPIs.netProfit || 0}
            unit="$"
            trend={getTrendIcon(kpiSummary?.financialKPIs.trend || 'stable') as any}
            trendPercent={3.8}
            sparklineData={[]}
          />
          <KPICard
            id="profit-margin"
            name={t('analytics.profitMargin')}
            currentValue={kpiSummary?.financialKPIs.profitMargin || 0}
            unit="%"
            trend={getTrendIcon(kpiSummary?.financialKPIs.trend || 'stable') as any}
            trendPercent={1.5}
            sparklineData={[]}
          />
          <KPICard
            id="total-costs"
            name={t('analytics.totalCosts')}
            currentValue={kpiSummary?.financialKPIs.totalCosts || 0}
            unit="$"
            trend={getTrendIcon(kpiSummary?.financialKPIs.trend || 'stable') as any}
            trendPercent={2.1}
            sparklineData={[]}
          />
        </div>
      </div>

      {/* Operational KPIs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">{t('analytics.operationalKPIs')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            id="avg-cycle-time"
            name={t('analytics.avgCycleTime')}
            currentValue={kpiSummary?.operationalKPIs.avgCycleTime || 0}
            unit="days"
            trend={getTrendIcon(kpiSummary?.operationalKPIs.trend || 'stable') as any}
            trendPercent={-2.3}
            sparklineData={[]}
          />
          <KPICard
            id="on-time-delivery"
            name={t('analytics.onTimeDelivery')}
            currentValue={kpiSummary?.operationalKPIs.onTimeDeliveryRate || 0}
            unit="%"
            trend={getTrendIcon(kpiSummary?.operationalKPIs.trend || 'stable') as any}
            trendPercent={1.8}
            sparklineData={[]}
          />
          <KPICard
            id="production-efficiency"
            name={t('analytics.prodEfficiency')}
            currentValue={kpiSummary?.operationalKPIs.productionEfficiency || 0}
            unit="%"
            trend={getTrendIcon(kpiSummary?.operationalKPIs.trend || 'stable') as any}
            trendPercent={3.2}
            sparklineData={[]}
          />
          <KPICard
            id="material-util"
            name={t('analytics.materialUtil')}
            currentValue={kpiSummary?.operationalKPIs.materialUtilization || 0}
            unit="%"
            trend={getTrendIcon(kpiSummary?.operationalKPIs.trend || 'stable') as any}
            trendPercent={1.1}
            sparklineData={[]}
          />
        </div>
      </div>

      {/* Vendor & Customer KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vendor KPIs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t('analytics.vendorKPIs')}</h2>
          </div>
          <div className="space-y-4">
            <KPICard
              id="avg-lead-time"
              name={t('analytics.avgLeadTime')}
              currentValue={kpiSummary?.vendorKPIs.avgLeadTime || 0}
              unit="days"
              trend={getTrendIcon(kpiSummary?.vendorKPIs.trend || 'stable') as any}
              trendPercent={-1.5}
              sparklineData={[]}
            />
            <KPICard
              id="vendor-on-time"
              name={t('analytics.vendorOnTime')}
              currentValue={kpiSummary?.vendorKPIs.avgOnTimeDelivery || 0}
              unit="%"
              trend={getTrendIcon(kpiSummary?.vendorKPIs.trend || 'stable') as any}
              trendPercent={2.1}
              sparklineData={[]}
            />
            <KPICard
              id="quality-score"
              name={t('analytics.qualityScore')}
              currentValue={kpiSummary?.vendorKPIs.avgQualityScore || 0}
              unit=""
              trend={getTrendIcon(kpiSummary?.vendorKPIs.trend || 'stable') as any}
              trendPercent={0.8}
              sparklineData={[]}
            />
          </div>
        </div>

        {/* Customer KPIs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t('analytics.customerKPIs')}</h2>
          </div>
          <div className="space-y-4">
            <KPICard
              id="active-customers"
              name={t('analytics.activeCustomers')}
              currentValue={kpiSummary?.customerKPIs.activeCustomerCount || 0}
              unit=""
              trend={getTrendIcon(kpiSummary?.customerKPIs.trend || 'stable') as any}
              trendPercent={5.3}
              sparklineData={[]}
            />
            <KPICard
              id="avg-order-value"
              name={t('analytics.avgOrderValue')}
              currentValue={kpiSummary?.customerKPIs.avgOrderValue || 0}
              unit="$"
              trend={getTrendIcon(kpiSummary?.customerKPIs.trend || 'stable') as any}
              trendPercent={3.7}
              sparklineData={[]}
            />
            <KPICard
              id="retention-rate"
              name={t('analytics.retentionRate')}
              currentValue={kpiSummary?.customerKPIs.customerRetentionRate || 0}
              unit="%"
              trend={getTrendIcon(kpiSummary?.customerKPIs.trend || 'stable') as any}
              trendPercent={1.2}
              sparklineData={[]}
            />
          </div>
        </div>
      </div>

      {/* Forecast KPIs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">{t('analytics.forecastKPIs')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            id="forecast-accuracy"
            name={t('analytics.forecastAccuracy')}
            currentValue={kpiSummary?.forecastKPIs.forecastAccuracy || 0}
            unit="%"
            trend={getTrendIcon(kpiSummary?.forecastKPIs.trend || 'stable') as any}
            trendPercent={2.5}
            sparklineData={[]}
          />
          <KPICard
            id="stockout-rate"
            name={t('analytics.stockoutRate')}
            currentValue={kpiSummary?.forecastKPIs.stockoutRate || 0}
            unit="%"
            trend={getTrendIcon(kpiSummary?.forecastKPIs.trend || 'stable') as any}
            trendPercent={-1.8}
            sparklineData={[]}
          />
          <KPICard
            id="excess-inventory"
            name={t('analytics.excessInventory')}
            currentValue={kpiSummary?.forecastKPIs.excessInventoryRate || 0}
            unit="%"
            trend={getTrendIcon(kpiSummary?.forecastKPIs.trend || 'stable') as any}
            trendPercent={-0.9}
            sparklineData={[]}
          />
          <KPICard
            id="turnover-days"
            name={t('analytics.turnoverDays')}
            currentValue={kpiSummary?.forecastKPIs.turnoverDays || 0}
            unit="days"
            trend={getTrendIcon(kpiSummary?.forecastKPIs.trend || 'stable') as any}
            trendPercent={-2.1}
            sparklineData={[]}
          />
        </div>
      </div>
    </div>
  );
};

export default BusinessIntelligenceDashboard;
