import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { useAppStore } from '../store/appStore';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';
import { GET_VARIANCE_REPORT } from '../graphql/queries/jobCosting';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Chart } from '../components/common/Chart';

interface VarianceJob {
  jobId: string;
  jobNumber: string;
  customerName: string;
  totalVariance: number;
  totalVariancePercentage: number;
  materialVariance: number;
  laborVariance: number;
  equipmentVariance: number;
  overheadVariance: number;
  isOverBudget: boolean;
}

const VarianceReportPage: React.FC = () => {
  const { t } = useTranslation();
  const { preferences } = useAppStore();
  const selectedFacility = preferences.selectedFacility;
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [varianceThreshold, setVarianceThreshold] = useState<number>(10); // 10%

  // Query variance report
  const { data, loading, error, refetch } = useQuery(GET_VARIANCE_REPORT, {
    variables: {
      filters: {
        tenantId: 'tenant-1', // Replace with actual tenant context
        fromDate: dateRange.from || undefined,
        toDate: dateRange.to || undefined,
        varianceThreshold
      }
    },
    skip: !selectedFacility
  });

  const report = data?.varianceReport;
  const jobs: VarianceJob[] = report?.jobs || [];
  const summary = report?.summary;

  // Prepare variance distribution chart
  const varianceDistributionData = useMemo(() => {
    if (!summary) return [];

    return [
      {
        category: t('jobCosting.overBudget'),
        count: summary.jobsOverBudget || 0,
        color: 'rgb(239, 68, 68)'
      },
      {
        category: t('jobCosting.onBudget'),
        count: summary.jobsOnBudget || 0,
        color: 'rgb(34, 197, 94)'
      },
      {
        category: t('jobCosting.underBudget'),
        count: summary.jobsUnderBudget || 0,
        color: 'rgb(59, 130, 246)'
      }
    ];
  }, [summary, t]);

  // Table columns
  const columns: ColumnDef<VarianceJob, any>[] = [
    {
      id: 'jobNumber',
      header: t('jobCosting.jobNumber'),
      accessorKey: 'jobNumber',
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue() as string}</span>
      )
    },
    {
      id: 'customerName',
      header: t('jobCosting.customer'),
      accessorKey: 'customerName'
    },
    {
      id: 'totalVariance',
      header: t('jobCosting.totalVariance'),
      accessorKey: 'totalVariance',
      cell: (info) => {
        const value = info.getValue() as number;
        const color = value > 0 ? 'text-red-600' : value < 0 ? 'text-blue-600' : 'text-green-600';
        return (
          <span className={`font-medium ${color}`}>
            {value > 0 ? '+' : ''}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      id: 'totalVariancePercentage',
      header: t('jobCosting.variancePercentage'),
      accessorKey: 'totalVariancePercentage',
      cell: (info) => {
        const value = info.getValue() as number;
        const color = Math.abs(value) < 5 ? 'text-green-600' : value > 0 ? 'text-red-600' : 'text-blue-600';
        return (
          <span className={`font-medium ${color}`}>
            {value > 0 ? '+' : ''}{value.toFixed(1)}%
          </span>
        );
      }
    },
    {
      id: 'materialVariance',
      header: t('jobCosting.materialVariance'),
      accessorKey: 'materialVariance',
      cell: (info) => {
        const value = info.getValue() as number;
        return `${value > 0 ? '+' : ''}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    },
    {
      id: 'laborVariance',
      header: t('jobCosting.laborVariance'),
      accessorKey: 'laborVariance',
      cell: (info) => {
        const value = info.getValue() as number;
        return `${value > 0 ? '+' : ''}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    },
    {
      id: 'equipmentVariance',
      header: t('jobCosting.equipmentVariance'),
      accessorKey: 'equipmentVariance',
      cell: (info) => {
        const value = info.getValue() as number;
        return `${value > 0 ? '+' : ''}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    },
    {
      id: 'status',
      header: t('jobCosting.status'),
      accessorKey: 'isOverBudget',
      cell: (info) => {
        const isOverBudget = info.getValue() as boolean;
        const variance = info.row.original.totalVariancePercentage;
        if (Math.abs(variance) < 5) {
          return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">On Budget</span>;
        } else if (isOverBudget) {
          return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Over Budget</span>;
        } else {
          return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Under Budget</span>;
        }
      }
    }
  ];

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4 text-red-600">Error loading variance report: {error.message}</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: t('nav.estimating'), path: '/estimating' },
              { label: t('nav.varianceReport'), path: '/estimating/variance-report' }
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{t('varianceReport.title')}</h1>
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
            onClick={() => {
              // Export to CSV logic would go here
              console.log('Export to CSV');
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('common.export')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('varianceReport.totalJobs')}</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalJobs || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('varianceReport.jobsOverBudget')}</p>
                <p className="text-2xl font-bold text-red-600">{summary.jobsOverBudget || 0}</p>
                <p className="text-xs text-gray-500">
                  {summary.totalJobs > 0 ? ((summary.jobsOverBudget / summary.totalJobs) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('varianceReport.avgMargin')}</p>
                <p className="text-2xl font-bold text-green-600">{summary.avgMargin?.toFixed(1) || 0}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{t('varianceReport.totalVariance')}</p>
                <p className={`text-2xl font-bold ${(summary.totalVariance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${Math.abs(summary.totalVariance || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>
      )}

      {/* Variance Distribution Chart */}
      {varianceDistributionData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('varianceReport.distributionByStatus')}</h2>
            <Chart
              type="pie"
              data={{
                labels: varianceDistributionData.map(d => d.category),
                datasets: [
                  {
                    data: varianceDistributionData.map(d => d.count),
                    backgroundColor: varianceDistributionData.map(d => d.color),
                    borderWidth: 1
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
              height={250}
            />
          </div>

          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('varianceReport.summaryMetrics')}</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{t('varianceReport.totalRevenue')}</span>
                <span className="text-sm font-bold text-gray-900">
                  ${(summary?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{t('varianceReport.totalCost')}</span>
                <span className="text-sm font-bold text-gray-900">
                  ${(summary?.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{t('varianceReport.totalProfit')}</span>
                <span className="text-sm font-bold text-green-600">
                  ${(summary?.totalProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{t('varianceReport.avgVariance')}</span>
                <span className={`text-sm font-bold ${(summary?.avgVariance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {(summary?.avgVariance || 0) > 0 ? '+' : ''}{(summary?.avgVariance || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">{t('common.filters')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('varianceReport.varianceThreshold')} (%)
            </label>
            <input
              type="number"
              value={varianceThreshold}
              onChange={(e) => setVarianceThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max="100"
              step="5"
            />
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <DataTable
          columns={columns}
          data={jobs}
          searchPlaceholder={t('varianceReport.searchPlaceholder')}
        />
      </div>
    </div>
  );
};

export default VarianceReportPage;
