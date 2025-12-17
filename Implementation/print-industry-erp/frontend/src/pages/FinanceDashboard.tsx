import React from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, TrendingUp, CreditCard, Wallet } from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { Breadcrumb } from '../components/layout/Breadcrumb';

const mockPLData = [
  { month: 'Jan', revenue: 450000, expenses: 320000, profit: 130000 },
  { month: 'Feb', revenue: 480000, expenses: 340000, profit: 140000 },
  { month: 'Mar', revenue: 520000, expenses: 360000, profit: 160000 },
  { month: 'Apr', revenue: 510000, expenses: 355000, profit: 155000 },
  { month: 'May', revenue: 580000, expenses: 390000, profit: 190000 },
];

const mockARAgingData = [
  { category: 'Current', amount: 450000 },
  { category: '30 Days', amount: 120000 },
  { category: '60 Days', amount: 45000 },
  { category: '90+ Days', amount: 15000 },
];

export const FinanceDashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('finance.title')}</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium">Monthly Revenue</p>
              <p className="text-3xl font-bold mt-2">$580K</p>
              <p className="text-success-100 text-sm mt-1">+13.7% MoM</p>
            </div>
            <DollarSign className="h-12 w-12 text-success-200" />
          </div>
        </div>

        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gross Profit Margin</p>
              <p className="text-3xl font-bold text-primary-600 mt-2">32.8%</p>
            </div>
            <TrendingUp className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">A/R Outstanding</p>
              <p className="text-3xl font-bold text-warning-600 mt-2">$630K</p>
            </div>
            <CreditCard className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cash on Hand</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">$1.2M</p>
            </div>
            <Wallet className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="line"
          data={mockPLData}
          xKey="month"
          yKey={['revenue', 'expenses', 'profit']}
          title={t('finance.plSummary')}
          colors={['#22c55e', '#ef4444', '#0ea5e9']}
          height={300}
        />

        <Chart
          type="pie"
          data={mockARAgingData}
          xKey="category"
          yKey="amount"
          title={t('finance.arAging')}
          height={300}
        />
      </div>
    </div>
  );
};
