import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { useAppStore } from '../store/appStore';
import {
  FileText,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { GET_ESTIMATES } from '../graphql/queries/estimating';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Estimate {
  id: string;
  estimateNumber: string;
  estimateDate: string;
  customerName: string;
  jobDescription: string;
  quantityEstimated: number;
  totalCost: number;
  suggestedPrice: number;
  targetMarginPercentage: number;
  status: string;
  isTemplate: boolean;
  convertedToQuoteId?: string;
  createdAt: string;
}

const EstimatesDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { preferences } = useAppStore();
  const selectedFacility = preferences.selectedFacility;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Query estimates
  const { data, loading, error, refetch } = useQuery(GET_ESTIMATES, {
    variables: {
      filters: {
        tenantId: 'tenant-1', // Replace with actual tenant context
        status: statusFilter || undefined,
        fromDate: dateRange.from || undefined,
        toDate: dateRange.to || undefined,
        isTemplate: false
      },
      limit: 100,
      offset: 0
    },
    skip: !selectedFacility
  });

  const estimates: Estimate[] = data?.estimates || [];

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = estimates.length;
    const draft = estimates.filter(e => e.status === 'DRAFT').length;
    const pendingReview = estimates.filter(e => e.status === 'PENDING_REVIEW').length;
    const approved = estimates.filter(e => e.status === 'APPROVED').length;
    const converted = estimates.filter(e => e.convertedToQuoteId).length;
    const totalValue = estimates.reduce((sum, e) => sum + e.suggestedPrice, 0);
    const avgMargin = estimates.length > 0
      ? estimates.reduce((sum, e) => sum + e.targetMarginPercentage, 0) / estimates.length
      : 0;
    const conversionRate = approved > 0 ? (converted / approved) * 100 : 0;

    return {
      total,
      draft,
      pendingReview,
      approved,
      converted,
      totalValue,
      avgMargin,
      conversionRate
    };
  }, [estimates]);

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CONVERTED_TO_QUOTE: 'bg-blue-100 text-blue-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // Table columns
  const columns: ColumnDef<Estimate, any>[] = [
    {
      id: 'estimateNumber',
      header: t('estimates.estimateNumber'),
      accessorKey: 'estimateNumber',
      cell: (info) => (
        <button
          onClick={() => navigate(`/estimating/estimates/${info.row.original.id}`)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {info.getValue() as string}
        </button>
      )
    },
    {
      id: 'estimateDate',
      header: t('estimates.estimateDate'),
      accessorKey: 'estimateDate',
      cell: (info) => new Date(info.getValue() as string).toLocaleDateString()
    },
    {
      id: 'customerName',
      header: t('estimates.customer'),
      accessorKey: 'customerName'
    },
    {
      id: 'jobDescription',
      header: t('estimates.jobDescription'),
      accessorKey: 'jobDescription',
      cell: (info) => (
        <div className="max-w-xs truncate" title={info.getValue() as string}>
          {info.getValue() as string}
        </div>
      )
    },
    {
      id: 'quantityEstimated',
      header: t('estimates.quantity'),
      accessorKey: 'quantityEstimated',
      cell: (info) => (info.getValue() as number).toLocaleString()
    },
    {
      id: 'totalCost',
      header: t('estimates.totalCost'),
      accessorKey: 'totalCost',
      cell: (info) => `$${(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      id: 'suggestedPrice',
      header: t('estimates.suggestedPrice'),
      accessorKey: 'suggestedPrice',
      cell: (info) => `$${(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      id: 'targetMarginPercentage',
      header: t('estimates.margin'),
      accessorKey: 'targetMarginPercentage',
      cell: (info) => `${(info.getValue() as number).toFixed(1)}%`
    },
    {
      id: 'status',
      header: t('estimates.status'),
      accessorKey: 'status',
      cell: (info) => getStatusBadge(info.getValue() as string)
    }
  ];

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4 text-red-600">Error loading estimates: {error.message}</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: t('nav.estimating'), path: '/estimating' },
              { label: t('nav.estimates'), path: '/estimating/estimates' }
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{t('estimates.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <FacilitySelector />
          <button
            onClick={() => refetch()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh')}
          </button>
          <button
            onClick={() => navigate('/estimating/estimates/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('estimates.createNew')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('estimates.totalEstimates')}</p>
              <p className="text-2xl font-bold text-gray-900">{kpis.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('estimates.pendingReview')}</p>
              <p className="text-2xl font-bold text-yellow-600">{kpis.pendingReview}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('estimates.totalValue')}</p>
              <p className="text-2xl font-bold text-green-600">
                ${kpis.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('estimates.conversionRate')}</p>
              <p className="text-2xl font-bold text-purple-600">{kpis.conversionRate.toFixed(1)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('estimates.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('common.all')}</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CONVERTED_TO_QUOTE">Converted to Quote</option>
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
        </div>
      </div>

      {/* Estimates Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <DataTable
          columns={columns}
          data={estimates}
          searchPlaceholder={t('estimates.searchPlaceholder')}
        />
      </div>
    </div>
  );
};

export default EstimatesDashboard;
