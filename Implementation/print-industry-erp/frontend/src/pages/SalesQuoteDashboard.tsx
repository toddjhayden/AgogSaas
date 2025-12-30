import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { useAppStore } from '../store/appStore';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  RefreshCw
} from 'lucide-react';
import { GET_QUOTES } from '../graphql/queries/salesQuoteAutomation';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Quote {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  expirationDate: string;
  customerId: string;
  customerName: string;
  salesRepUserId: string;
  salesRepName: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  marginAmount: number;
  marginPercentage: number;
  createdAt: string;
  updatedAt: string;
}

const SalesQuoteDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { preferences } = useAppStore();
  const selectedFacility = preferences.selectedFacility;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Query quotes
  const { data, loading, error, refetch } = useQuery(GET_QUOTES, {
    variables: {
      tenantId: 'tenant-1', // Replace with actual tenant context
      status: statusFilter || undefined,
      dateFrom: dateRange.from || undefined,
      dateTo: dateRange.to || undefined
    },
    skip: !selectedFacility
  });

  const quotes: Quote[] = data?.quotes || [];

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = quotes.length;
    const draftQuotes = quotes.filter(q => q.status === 'DRAFT').length;
    const issuedQuotes = quotes.filter(q => q.status === 'ISSUED').length;
    const acceptedQuotes = quotes.filter(q => q.status === 'ACCEPTED').length;
    const totalValue = quotes.reduce((sum, q) => sum + q.totalAmount, 0);
    const avgMargin = quotes.length > 0
      ? quotes.reduce((sum, q) => sum + q.marginPercentage, 0) / quotes.length
      : 0;
    const conversionRate = issuedQuotes > 0
      ? (acceptedQuotes / issuedQuotes) * 100
      : 0;

    return {
      total,
      draftQuotes,
      issuedQuotes,
      acceptedQuotes,
      totalValue,
      avgMargin,
      conversionRate
    };
  }, [quotes]);

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-yellow-100 text-yellow-800',
      CONVERTED_TO_ORDER: 'bg-purple-100 text-purple-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // Table columns
  const columns: ColumnDef<Quote, any>[] = [
    {
      id: 'quoteNumber',
      header: t('salesQuotes.quoteNumber'),
      accessorKey: 'quoteNumber',
      cell: (info) => (
        <button
          onClick={() => navigate(`/sales/quotes/${info.row.original.id}`)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {info.getValue() as string}
        </button>
      )
    },
    {
      id: 'customerName',
      header: t('salesQuotes.customer'),
      accessorKey: 'customerName'
    },
    {
      id: 'quoteDate',
      header: t('salesQuotes.quoteDate'),
      accessorKey: 'quoteDate',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString()
    },
    {
      id: 'expirationDate',
      header: t('salesQuotes.expirationDate'),
      accessorKey: 'expirationDate',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString()
    },
    {
      id: 'status',
      header: t('salesQuotes.status'),
      accessorKey: 'status',
      cell: (info) => getStatusBadge(info.getValue() as string)
    },
    {
      id: 'totalAmount',
      header: t('salesQuotes.totalAmount'),
      accessorKey: 'totalAmount',
      cell: (info) => `$${(info.getValue() as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      id: 'marginPercentage',
      header: t('salesQuotes.margin'),
      accessorKey: 'marginPercentage',
      cell: (info) => {
        const value = info.getValue() as number;
        return (
          <span className={value < 15 ? 'text-red-600 font-semibold' : 'text-green-600'}>
            {value.toFixed(1)}%
          </span>
        );
      }
    },
    {
      id: 'salesRepName',
      header: t('salesQuotes.salesRep'),
      accessorKey: 'salesRepName'
    }
  ];

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{t('common.error')}: {error.message}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('salesQuotes.title')}</h1>
          <p className="text-gray-600 mt-1">{t('salesQuotes.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh')}
          </button>
          <button
            onClick={() => navigate('/sales/quotes/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {t('salesQuotes.createQuote')}
          </button>
        </div>
      </div>

      {/* Facility Selector */}
      <FacilitySelector />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Quotes */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.totalQuotes')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{kpis.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.totalValue')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${kpis.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Average Margin */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.averageMargin')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-2">
                {kpis.avgMargin.toFixed(1)}%
                {kpis.avgMargin >= 25 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${kpis.avgMargin >= 25 ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <TrendingUp className={`w-6 h-6 ${kpis.avgMargin >= 25 ? 'text-green-600' : 'text-yellow-600'}`} />
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.conversionRate')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {kpis.conversionRate.toFixed(1)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('salesQuotes.draft')}</p>
              <p className="text-xl font-bold text-gray-900">{kpis.draftQuotes}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('salesQuotes.issued')}</p>
              <p className="text-xl font-bold text-gray-900">{kpis.issuedQuotes}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('salesQuotes.accepted')}</p>
              <p className="text-xl font-bold text-gray-900">{kpis.acceptedQuotes}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('salesQuotes.rejected')}</p>
              <p className="text-xl font-bold text-gray-900">
                {quotes.filter(q => q.status === 'REJECTED').length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('salesQuotes.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('common.all')}</option>
              <option value="DRAFT">{t('salesQuotes.draft')}</option>
              <option value="ISSUED">{t('salesQuotes.issued')}</option>
              <option value="ACCEPTED">{t('salesQuotes.accepted')}</option>
              <option value="REJECTED">{t('salesQuotes.rejected')}</option>
              <option value="EXPIRED">{t('salesQuotes.expired')}</option>
              <option value="CONVERTED_TO_ORDER">{t('salesQuotes.convertedToOrder')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.dateFrom')}
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.dateTo')}
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter('');
                setDateRange({ from: '', to: '' });
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('common.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          data={quotes}
          columns={columns}
        />
      </div>
    </div>
  );
};

export default SalesQuoteDashboard;
