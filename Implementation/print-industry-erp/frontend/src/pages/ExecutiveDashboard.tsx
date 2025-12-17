import React from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Users, ShoppingBag, Factory } from 'lucide-react';
import { KPICard, KPIData } from '../components/common/KPICard';
import { Chart } from '../components/common/Chart';
import { AlertPanel, Alert } from '../components/common/AlertPanel';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_TOP_KPIS } from '../graphql/queries/kpis';
import { GET_MARKETPLACE_ANALYTICS } from '../graphql/queries/marketplace';
import { useAppStore } from '../store/appStore';

// Mock data for development
const mockRevenueData = [
  { date: 'Dec 1', revenue: 45000 },
  { date: 'Dec 7', revenue: 52000 },
  { date: 'Dec 14', revenue: 49000 },
  { date: 'Dec 21', revenue: 61000 },
  { date: 'Dec 28', revenue: 58000 },
];

const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'Production Line Down',
    message: 'Press #3 has been offline for 2 hours. Maintenance team notified.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '2',
    type: 'warning',
    title: 'Low Material Stock',
    message: 'Paper stock for product SKU-1234 below minimum threshold.',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: '3',
    type: 'info',
    title: 'New Order Received',
    message: 'Large order from ABC Corp received. Est. value $125,000.',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
  },
];

const mockTopKPIs: KPIData[] = [
  {
    id: '1',
    name: 'Material Utilization %',
    currentValue: 87.5,
    targetValue: 85,
    unit: '%',
    trend: 'up',
    trendPercent: 2.3,
    sparklineData: [82, 84, 85, 86, 87.5],
    formula: '(Material Used / Material Issued) * 100',
  },
  {
    id: '2',
    name: 'Overall Equipment Effectiveness (OEE)',
    currentValue: 78.2,
    targetValue: 85,
    unit: '%',
    trend: 'up',
    trendPercent: 1.8,
    sparklineData: [74, 75, 76, 77, 78.2],
    formula: 'Availability × Performance × Quality',
  },
  {
    id: '3',
    name: 'On-Time Delivery Rate',
    currentValue: 94.5,
    targetValue: 95,
    unit: '%',
    trend: 'down',
    trendPercent: 0.8,
    sparklineData: [95, 95.5, 95, 94.8, 94.5],
  },
  {
    id: '4',
    name: 'First Pass Yield',
    currentValue: 96.3,
    targetValue: 98,
    unit: '%',
    trend: 'up',
    trendPercent: 0.5,
    sparklineData: [95.5, 95.8, 96, 96.1, 96.3],
  },
];

export const ExecutiveDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { preferences } = useAppStore();

  // In production, use real queries
  // const { loading, error, data } = useQuery(GET_TOP_KPIS, {
  //   variables: { facilityId: preferences.selectedFacility },
  // });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.title')}</h1>
          <Breadcrumb />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium">Total Revenue (30d)</p>
              <p className="text-3xl font-bold mt-2">$2.5M</p>
              <p className="text-primary-100 text-sm mt-1">+12.5% from last month</p>
            </div>
            <TrendingUp className="h-12 w-12 text-primary-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium">Active Orders</p>
              <p className="text-3xl font-bold mt-2">342</p>
              <p className="text-success-100 text-sm mt-1">87% on schedule</p>
            </div>
            <ShoppingBag className="h-12 w-12 text-success-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-warning-500 to-warning-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-sm font-medium">Active Facilities</p>
              <p className="text-3xl font-bold mt-2">3</p>
              <p className="text-warning-100 text-sm mt-1">All operational</p>
            </div>
            <Factory className="h-12 w-12 text-warning-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Marketplace Jobs</p>
              <p className="text-3xl font-bold mt-2">28</p>
              <p className="text-purple-100 text-sm mt-1">15 active bids</p>
            </div>
            <Users className="h-12 w-12 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="line"
          data={mockRevenueData}
          xKey="date"
          yKey="revenue"
          title={t('dashboard.revenue') + ' (Last 30 Days)'}
          height={300}
        />

        <AlertPanel alerts={mockAlerts} />
      </div>

      {/* Top KPIs */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('dashboard.topKPIs')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mockTopKPIs.map((kpi) => (
            <KPICard key={kpi.id} kpi={kpi} size="md" />
          ))}
        </div>
      </div>

      {/* Multi-Facility Overview */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {t('dashboard.facilityOverview')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Shanghai Plant</h3>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                Operational
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">OEE:</span>
                <span className="font-medium">82.5%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Orders:</span>
                <span className="font-medium">145</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Utilization:</span>
                <span className="font-medium">91%</span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Shenzhen Plant</h3>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                Operational
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">OEE:</span>
                <span className="font-medium">79.3%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Orders:</span>
                <span className="font-medium">128</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Utilization:</span>
                <span className="font-medium">87%</span>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Beijing Plant</h3>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
                Maintenance
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">OEE:</span>
                <span className="font-medium">65.1%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Orders:</span>
                <span className="font-medium">69</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Utilization:</span>
                <span className="font-medium">72%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
