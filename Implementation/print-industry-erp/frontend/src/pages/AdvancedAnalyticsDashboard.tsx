import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  Users,
  Package,
  Activity,
} from 'lucide-react';
import {
  GET_VENDOR_PRODUCTION_IMPACT,
  GET_CUSTOMER_PROFITABILITY,
  GET_ORDER_CYCLE_ANALYSIS,
  GET_MATERIAL_FLOW_ANALYSIS,
} from '../graphql/queries/analytics';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

/**
 * REQ-STRATEGIC-AUTO-1767048328662: Advanced Reporting & Business Intelligence Suite
 * Advanced Analytics Dashboard - Cross-Domain Analytics
 */

type AnalysisView = 'vendor-production' | 'customer-profitability' | 'order-cycle' | 'material-flow';

// Interfaces for GraphQL data types
interface VendorProductionImpact {
  vendorName: string;
  materialCategory: string;
  avgLeadTimeDays: number;
  onTimeDeliveryRate: number;
  qualityRejectRate: number;
  avgProductionDowntimeHours: number;
  productionEfficiencyImpact: number;
  correlation: number;
}

interface CustomerProfitability {
  customerName: string;
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  profitMargin: number;
  orderCount: number;
  avgOrderValue: number;
}

interface OrderCycle {
  orderId: string;
  customerName: string;
  quotingTime: number;
  procurementTime: number;
  productionTime: number;
  qcTime: number;
  shippingTime: number;
  totalCycleTime: number;
  bottleneckStage: string;
}

interface MaterialFlow {
  materialName: string;
  category: string;
  vendorName: string;
  avgLeadTimeDays: number;
  currentStockLevel: number;
  warehouseTurnoverDays: number;
  productionConsumptionRate: number;
  stockoutRisk: string;
}

export const AdvancedAnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedView, setSelectedView] = useState<AnalysisView>('vendor-production');
  const [dateRange, _setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  });

  // Vendor Production Impact Query
  const {
    loading: vendorLoading,
    error: vendorError,
    data: vendorData,
  } = useQuery(GET_VENDOR_PRODUCTION_IMPACT, {
    variables: dateRange,
    skip: selectedView !== 'vendor-production',
  });

  // Customer Profitability Query
  const {
    loading: customerLoading,
    error: customerError,
    data: customerData,
  } = useQuery(GET_CUSTOMER_PROFITABILITY, {
    variables: {
      ...dateRange,
      includeWarehouseCosts: true,
      includeQualityCosts: true,
    },
    skip: selectedView !== 'customer-profitability',
  });

  // Order Cycle Analysis Query
  const {
    loading: orderLoading,
    error: orderError,
    data: orderData,
  } = useQuery(GET_ORDER_CYCLE_ANALYSIS, {
    variables: dateRange,
    skip: selectedView !== 'order-cycle',
  });

  // Material Flow Analysis Query
  const {
    loading: materialLoading,
    error: materialError,
    data: materialData,
  } = useQuery(GET_MATERIAL_FLOW_ANALYSIS, {
    variables: {
      ...dateRange,
      materialId: null, // null = all materials
    },
    skip: selectedView !== 'material-flow',
  });

  const isLoading = vendorLoading || customerLoading || orderLoading || materialLoading;
  const error = vendorError || customerError || orderError || materialError;

  if (isLoading) {
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

  const renderVendorProductionImpact = () => {
    const impacts = vendorData?.vendorProductionImpact || [];

    const columns = [
      { key: 'vendorName', label: t('analytics.vendor'), sortable: true },
      { key: 'materialCategory', label: t('analytics.category'), sortable: true },
      { key: 'avgLeadTimeDays', label: t('analytics.leadTime'), sortable: true, format: (val: number) => `${val.toFixed(1)} days` },
      { key: 'onTimeDeliveryRate', label: t('analytics.onTimeRate'), sortable: true, format: (val: number) => `${val.toFixed(1)}%` },
      { key: 'qualityRejectRate', label: t('analytics.rejectRate'), sortable: true, format: (val: number) => `${val.toFixed(2)}%` },
      { key: 'avgProductionDowntimeHours', label: t('analytics.downtime'), sortable: true, format: (val: number) => `${val.toFixed(1)} hrs` },
      { key: 'productionEfficiencyImpact', label: t('analytics.efficiency'), sortable: true, format: (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%` },
      { key: 'correlation', label: t('analytics.correlation'), sortable: true, format: (val: number) => val.toFixed(3) },
    ];

    const chartData = impacts.map((item: VendorProductionImpact) => ({
      name: item.vendorName,
      efficiency: item.productionEfficiencyImpact,
      onTime: item.onTimeDeliveryRate,
      quality: 100 - item.qualityRejectRate,
    }));

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.impactChart')}</h3>
          <Chart
            type="bar"
            data={chartData}
            xKey="name"
            yKey={['efficiency', 'onTime', 'quality']}
            height={300}
          />
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.detailedData')}</h3>
          <DataTable columns={columns} data={impacts} />
        </div>
      </div>
    );
  };

  const renderCustomerProfitability = () => {
    const profitability = customerData?.customerProfitability || [];

    const columns = [
      { key: 'customerName', label: t('analytics.customer'), sortable: true },
      { key: 'totalRevenue', label: t('analytics.revenue'), sortable: true, format: (val: number) => `$${val.toLocaleString()}` },
      { key: 'totalCosts', label: t('analytics.costs'), sortable: true, format: (val: number) => `$${val.toLocaleString()}` },
      { key: 'grossProfit', label: t('analytics.profit'), sortable: true, format: (val: number) => `$${val.toLocaleString()}` },
      { key: 'profitMargin', label: t('analytics.margin'), sortable: true, format: (val: number) => `${val.toFixed(1)}%` },
      { key: 'orderCount', label: t('analytics.orders'), sortable: true },
      { key: 'avgOrderValue', label: t('analytics.avgOrderVal'), sortable: true, format: (val: number) => `$${val.toLocaleString()}` },
    ];

    const chartData = profitability.map((item: CustomerProfitability) => ({
      name: item.customerName,
      revenue: item.totalRevenue,
      profit: item.grossProfit,
      margin: item.profitMargin,
    }));

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.profitChart')}</h3>
          <Chart
            type="bar"
            data={chartData}
            xKey="name"
            yKey={['revenue', 'profit']}
            height={300}
          />
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.detailedData')}</h3>
          <DataTable columns={columns} data={profitability} />
        </div>
      </div>
    );
  };

  const renderOrderCycleAnalysis = () => {
    const cycles = orderData?.orderCycleAnalysis || [];

    const columns = [
      { key: 'orderId', label: t('analytics.orderId'), sortable: true },
      { key: 'customerName', label: t('analytics.customer'), sortable: true },
      { key: 'quotingTime', label: t('analytics.quoting'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'procurementTime', label: t('analytics.procurement'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'productionTime', label: t('analytics.production'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'qcTime', label: t('analytics.qc'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'shippingTime', label: t('analytics.shipping'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'totalCycleTime', label: t('analytics.total'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'bottleneckStage', label: t('analytics.bottleneck'), sortable: true },
    ];

    const avgCycleTime = cycles.reduce((sum: number, c: OrderCycle) => sum + c.totalCycleTime, 0) / cycles.length || 0;
    const bottleneckCounts = cycles.reduce((acc: Record<string, number>, c: OrderCycle) => {
      acc[c.bottleneckStage] = (acc[c.bottleneckStage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bottleneckData = Object.entries(bottleneckCounts).map(([name, value]) => ({
      name,
      value: value as number,
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.avgCycleTime')}</h3>
            <div className="text-4xl font-bold text-primary-600">{avgCycleTime.toFixed(1)} days</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.bottleneckDist')}</h3>
            <Chart type="pie" data={bottleneckData} height={200} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.detailedData')}</h3>
          <DataTable columns={columns} data={cycles} />
        </div>
      </div>
    );
  };

  const renderMaterialFlowAnalysis = () => {
    const flows = materialData?.materialFlowAnalysis || [];

    const columns = [
      { key: 'materialName', label: t('analytics.material'), sortable: true },
      { key: 'category', label: t('analytics.category'), sortable: true },
      { key: 'vendorName', label: t('analytics.vendor'), sortable: true },
      { key: 'avgLeadTimeDays', label: t('analytics.leadTime'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'currentStockLevel', label: t('analytics.stock'), sortable: true },
      { key: 'warehouseTurnoverDays', label: t('analytics.turnover'), sortable: true, format: (val: number) => `${val.toFixed(1)}d` },
      { key: 'productionConsumptionRate', label: t('analytics.consumption'), sortable: true, format: (val: number) => `${val.toFixed(1)}/d` },
      { key: 'stockoutRisk', label: t('analytics.risk'), sortable: true },
    ];

    const riskCounts = flows.reduce((acc: Record<string, number>, f: MaterialFlow) => {
      acc[f.stockoutRisk] = (acc[f.stockoutRisk] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const riskData = Object.entries(riskCounts).map(([name, value]) => ({
      name,
      value: value as number,
    }));

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.stockoutRisk')}</h3>
          <Chart type="pie" data={riskData} height={250} />
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('analytics.detailedData')}</h3>
          <DataTable columns={columns} data={flows} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('analytics.advancedAnalytics')}</h1>
          <Breadcrumb />
        </div>
      </div>

      {/* View Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">{t('analytics.analysisType')}:</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedView('vendor-production')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedView === 'vendor-production'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Package className="h-4 w-4" />
              {t('analytics.vendorProduction')}
            </button>
            <button
              onClick={() => setSelectedView('customer-profitability')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedView === 'customer-profitability'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="h-4 w-4" />
              {t('analytics.customerProfit')}
            </button>
            <button
              onClick={() => setSelectedView('order-cycle')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedView === 'order-cycle'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Activity className="h-4 w-4" />
              {t('analytics.orderCycle')}
            </button>
            <button
              onClick={() => setSelectedView('material-flow')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedView === 'material-flow'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              {t('analytics.materialFlow')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedView === 'vendor-production' && renderVendorProductionImpact()}
      {selectedView === 'customer-profitability' && renderCustomerProfitability()}
      {selectedView === 'order-cycle' && renderOrderCycleAnalysis()}
      {selectedView === 'material-flow' && renderMaterialFlowAnalysis()}
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
