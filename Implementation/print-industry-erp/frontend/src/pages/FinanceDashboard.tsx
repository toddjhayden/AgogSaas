import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet,
  FileText,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useFacilityStore } from '../store/appStore';
import {
  GET_PL_SUMMARY,
  GET_AR_AGING,
  GET_AP_AGING,
  GET_CASH_FLOW_FORECAST
} from '../graphql/queries/finance';

export const FinanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const selectedFacility = useFacilityStore((state) => state.selectedFacility);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const { data: plData, loading: plLoading, error: plError } = useQuery(GET_PL_SUMMARY, {
    variables: {
      facilityId: selectedFacility?.id,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      currency: 'USD'
    },
    skip: !selectedFacility
  });

  const { data: arData, loading: arLoading } = useQuery(GET_AR_AGING, {
    variables: {
      facilityId: selectedFacility?.id,
      asOfDate: dateRange.endDate
    },
    skip: !selectedFacility
  });

  const { data: apData, loading: apLoading } = useQuery(GET_AP_AGING, {
    variables: {
      facilityId: selectedFacility?.id,
      asOfDate: dateRange.endDate
    },
    skip: !selectedFacility
  });

  const { data: cashFlowData, loading: cashFlowLoading } = useQuery(GET_CASH_FLOW_FORECAST, {
    variables: {
      facilityId: selectedFacility?.id,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    },
    skip: !selectedFacility
  });

  // Calculate totals from AR aging
  const arTotal = React.useMemo(() => {
    if (!arData?.accountsReceivableAging) return 0;
    return arData.accountsReceivableAging.reduce((sum: number, item: any) => sum + item.total, 0);
  }, [arData]);

  // Calculate totals from AP aging
  const apTotal = React.useMemo(() => {
    if (!apData?.accountsPayableAging) return 0;
    return apData.accountsPayableAging.reduce((sum: number, item: any) => sum + item.total, 0);
  }, [apData]);

  // Format AR aging data for pie chart
  const arAgingChartData = React.useMemo(() => {
    if (!arData?.accountsReceivableAging || arData.accountsReceivableAging.length === 0) {
      return [
        { category: 'Current', amount: 0 },
        { category: '30 Days', amount: 0 },
        { category: '60 Days', amount: 0 },
        { category: '90+ Days', amount: 0 }
      ];
    }

    const totals = arData.accountsReceivableAging.reduce((acc: any, item: any) => ({
      current: acc.current + item.current,
      days30: acc.days30 + item.days30,
      days60: acc.days60 + item.days60,
      days90Plus: acc.days90Plus + (item.over90 || item.days90Plus || 0)
    }), { current: 0, days30: 0, days60: 0, days90Plus: 0 });

    return [
      { category: 'Current', amount: totals.current },
      { category: '30 Days', amount: totals.days30 },
      { category: '60 Days', amount: totals.days60 },
      { category: '90+ Days', amount: totals.days90Plus }
    ];
  }, [arData]);

  // Cash flow trend data
  const cashFlowChartData = React.useMemo(() => {
    if (!cashFlowData?.cashFlowForecast) return [];
    return cashFlowData.cashFlowForecast.map((item: any) => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: item.endingBalance,
      inflows: item.cashInflows.reduce((sum: number, inflow: any) => sum + inflow.amount, 0),
      outflows: item.cashOutflows.reduce((sum: number, outflow: any) => sum + outflow.amount, 0)
    }));
  }, [cashFlowData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (plError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('finance.title')}</h1>
          <Breadcrumb />
        </div>
        <div className="card border-l-4 border-danger-500">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-danger-500" />
            <div>
              <h3 className="font-semibold text-danger-900">Error Loading Financial Data</h3>
              <p className="text-sm text-danger-700">{plError.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('finance.title')}</h1>
          <Breadcrumb />
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="input-field text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenue */}
        <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium">Revenue</p>
              {plLoading ? (
                <div className="animate-pulse h-8 bg-success-400 rounded mt-2 w-24"></div>
              ) : (
                <>
                  <p className="text-3xl font-bold mt-2">
                    {formatCurrency(plData?.profitAndLoss?.revenue || 0)}
                  </p>
                  {plData?.profitAndLoss?.netMargin && (
                    <p className="text-success-100 text-sm mt-1">
                      Net Margin: {formatPercent(plData.profitAndLoss.netMargin)}
                    </p>
                  )}
                </>
              )}
            </div>
            <DollarSign className="h-12 w-12 text-success-200" />
          </div>
        </div>

        {/* Gross Profit Margin */}
        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gross Profit Margin</p>
              {plLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded mt-2 w-20"></div>
              ) : (
                <p className="text-3xl font-bold text-primary-600 mt-2">
                  {formatPercent(plData?.profitAndLoss?.grossProfitMargin || 0)}
                </p>
              )}
            </div>
            <TrendingUp className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        {/* A/R Outstanding */}
        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">A/R Outstanding</p>
              {arLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded mt-2 w-24"></div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-warning-600 mt-2">
                    {formatCurrency(arTotal)}
                  </p>
                  {arData?.accountsReceivableAging?.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {arData.accountsReceivableAging.length} customers
                    </p>
                  )}
                </>
              )}
            </div>
            <CreditCard className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        {/* A/P Outstanding */}
        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">A/P Outstanding</p>
              {apLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded mt-2 w-24"></div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {formatCurrency(apTotal)}
                  </p>
                  {apData?.accountsPayableAging?.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {apData.accountsPayableAging.length} vendors
                    </p>
                  )}
                </>
              )}
            </div>
            <Wallet className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Summary */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold">{t('finance.plSummary')}</h2>
          </div>
          {plLoading ? (
            <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
          ) : plData?.profitAndLoss ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm font-medium text-gray-700">Revenue</span>
                <span className="text-sm font-bold text-success-600">
                  {formatCurrency(plData.profitAndLoss.revenue)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm font-medium text-gray-700">Cost of Goods Sold</span>
                <span className="text-sm font-bold text-danger-600">
                  ({formatCurrency(plData.profitAndLoss.costOfGoodsSold)})
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b bg-gray-50 px-2">
                <span className="text-sm font-semibold text-gray-900">Gross Profit</span>
                <span className="text-sm font-bold text-primary-600">
                  {formatCurrency(plData.profitAndLoss.grossProfit)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm font-medium text-gray-700">Operating Expenses</span>
                <span className="text-sm font-bold text-danger-600">
                  ({formatCurrency(plData.profitAndLoss.operatingExpenses)})
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b bg-gray-50 px-2">
                <span className="text-sm font-semibold text-gray-900">Operating Income</span>
                <span className="text-sm font-bold text-primary-600">
                  {formatCurrency(plData.profitAndLoss.operatingIncome)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 bg-primary-50 px-2 rounded">
                <span className="text-base font-bold text-gray-900">Net Income</span>
                <span className="text-lg font-bold text-primary-700">
                  {formatCurrency(plData.profitAndLoss.netIncome)}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No P&L data available
            </div>
          )}
        </div>

        {/* AR Aging */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">{t('finance.arAging')}</h2>
          {arLoading ? (
            <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
          ) : (
            <Chart
              type="pie"
              data={arAgingChartData}
              xKey="category"
              yKey="amount"
              height={300}
              colors={['#22c55e', '#eab308', '#f97316', '#ef4444']}
            />
          )}
        </div>
      </div>

      {/* Cash Flow Forecast */}
      {!cashFlowLoading && cashFlowChartData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Cash Flow Forecast</h2>
          <Chart
            type="line"
            data={cashFlowChartData}
            xKey="date"
            yKey={['balance', 'inflows', 'outflows']}
            colors={['#0ea5e9', '#22c55e', '#ef4444']}
            height={300}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/finance/invoices"
          className="card hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-primary-500"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Manage Invoices</h3>
              <p className="text-sm text-gray-500">Create and track AR/AP invoices</p>
            </div>
          </div>
        </a>

        <a
          href="/finance/payments"
          className="card hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-success-500"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success-100 rounded-lg">
              <Wallet className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Manage Payments</h3>
              <p className="text-sm text-gray-500">Record and apply payments</p>
            </div>
          </div>
        </a>

        <a
          href="/finance/reports"
          className="card hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-purple-500"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Financial Reports</h3>
              <p className="text-sm text-gray-500">View trial balance, P&L, balance sheet</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
};
