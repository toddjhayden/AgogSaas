import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { useAppStore } from '../store/appStore';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileText
} from 'lucide-react';
import { GET_JOB_COSTS, GET_VARIANCE_REPORT } from '../graphql/queries/jobCosting';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Chart } from '../components/common/Chart';

interface JobCost {
  id: string;
  jobId: string;
  jobNumber: string;
  totalAmount: number;
  totalCost: number;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  estimatedTotalCost: number;
  grossProfit: number;
  grossProfitMargin: number;
  costVariance: number;
  costVariancePercentage: number;
  status: string;
  costingDate: string;
  job?: {
    customerName: string;
  };
}

const JobCostingDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { preferences } = useAppStore();
  const selectedFacility = preferences.selectedFacility;
  const tenantId = preferences.tenantId || 'tenant-1'; // Use tenantId from store, fallback to tenant-1
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [varianceFilter, setVarianceFilter] = useState<string>(''); // 'over' | 'under' | ''

  // Query job costs
  const { data, loading, error, refetch } = useQuery(GET_JOB_COSTS, {
    variables: {
      filters: {
        tenantId,
        status: statusFilter || undefined
      },
      limit: 100,
      offset: 0
    },
    skip: !selectedFacility
  });

  // Query variance report
  const { data: varianceData } = useQuery(GET_VARIANCE_REPORT, {
    variables: {
      filters: {
        tenantId
      }
    },
    skip: !selectedFacility
  });

  const jobCosts: JobCost[] = data?.jobCosts || [];
  const varianceSummary = varianceData?.varianceReport?.summary;

  // Filter job costs based on variance
  const filteredJobCosts = useMemo(() => {
    if (!varianceFilter) return jobCosts;
    if (varianceFilter === 'over') return jobCosts.filter(j => j.costVariance > 0);
    if (varianceFilter === 'under') return jobCosts.filter(j => j.costVariance < 0);
    return jobCosts;
  }, [jobCosts, varianceFilter]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = jobCosts.length;
    const overBudget = jobCosts.filter(j => j.costVariance > 0).length;
    const underBudget = jobCosts.filter(j => j.costVariance < 0).length;
    const onBudget = jobCosts.filter(j => Math.abs(j.costVariancePercentage) < 5).length;
    const totalRevenue = jobCosts.reduce((sum, j) => sum + j.totalAmount, 0);
    const totalCost = jobCosts.reduce((sum, j) => sum + j.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalVariance = jobCosts.reduce((sum, j) => sum + j.costVariance, 0);

    return {
      total,
      overBudget,
      underBudget,
      onBudget,
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin,
      totalVariance
    };
  }, [jobCosts]);

  // Prepare variance chart data
  const varianceChartData = useMemo(() => {
    if (!varianceSummary) return [];

    return [
      {
        category: 'Material',
        variance: varianceSummary.materialVariance || 0,
        variancePercentage: varianceSummary.materialVariancePercentage || 0
      },
      {
        category: 'Labor',
        variance: varianceSummary.laborVariance || 0,
        variancePercentage: varianceSummary.laborVariancePercentage || 0
      },
      {
        category: 'Equipment',
        variance: varianceSummary.equipmentVariance || 0,
        variancePercentage: varianceSummary.equipmentVariancePercentage || 0
      },
      {
        category: 'Overhead',
        variance: varianceSummary.overheadVariance || 0,
        variancePercentage: varianceSummary.overheadVariancePercentage || 0
      }
    ];
  }, [varianceSummary]);

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      RECONCILED: 'bg-green-100 text-green-800',
      CLOSED: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // Variance badge styling
  const getVarianceBadge = (variance: number, variancePercentage: number) => {
    const absPercentage = Math.abs(variancePercentage);
    if (absPercentage < 5) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">On Budget</span>;
    } else if (variance > 0) {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Over Budget</span>;
    } else {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Under Budget</span>;
    }
  };

  // Table columns
  const columns: ColumnDef<JobCost, any>[] = [
    {
      id: 'jobNumber',
      header: t('jobCosting.jobNumber'),
      accessorKey: 'jobNumber',
      cell: (info) => (
        <button
          onClick={() => navigate(`/estimating/job-costs/${info.row.original.id}`)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {info.getValue() as string}
        </button>
      )
    },
    {
      id: 'customerName',
      header: t('jobCosting.customer'),
      accessorFn: (row) => row.job?.customerName || '-'
    },
    {
      id: 'totalAmount',
      header: t('jobCosting.revenue'),
      accessorKey: 'totalAmount',
      cell: (info) => `$${(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      id: 'totalCost',
      header: t('jobCosting.actualCost'),
      accessorKey: 'totalCost',
      cell: (info) => `$${(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      id: 'grossProfit',
      header: t('jobCosting.grossProfit'),
      accessorKey: 'grossProfit',
      cell: (info) => {
        const value = info.getValue() as number;
        const color = value >= 0 ? 'text-green-600' : 'text-red-600';
        return <span className={color}>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    },
    {
      id: 'grossProfitMargin',
      header: t('jobCosting.margin'),
      accessorKey: 'grossProfitMargin',
      cell: (info) => {
        const value = info.getValue() as number;
        const color = value >= 20 ? 'text-green-600' : value >= 10 ? 'text-yellow-600' : 'text-red-600';
        return <span className={color}>{value.toFixed(1)}%</span>;
      }
    },
    {
      id: 'costVariance',
      header: t('jobCosting.variance'),
      accessorKey: 'costVariance',
      cell: (info) => {
        const variance = info.getValue() as number;
        const variancePercentage = info.row.original.costVariancePercentage;
        const color = variance > 0 ? 'text-red-600' : variance < 0 ? 'text-blue-600' : 'text-green-600';
        return (
          <div className="flex flex-col">
            <span className={color}>
              ${Math.abs(variance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-gray-500">
              {variancePercentage > 0 ? '+' : ''}{variancePercentage.toFixed(1)}%
            </span>
          </div>
        );
      }
    },
    {
      id: 'varianceStatus',
      header: t('jobCosting.status'),
      cell: (info) => getVarianceBadge(info.row.original.costVariance, info.row.original.costVariancePercentage)
    },
    {
      id: 'costingStatus',
      header: t('jobCosting.costingStatus'),
      accessorKey: 'status',
      cell: (info) => getStatusBadge(info.getValue() as string)
    }
  ];

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-4 text-red-600">Error loading job costs: {error.message}</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: t('nav.estimating'), path: '/estimating' },
              { label: t('nav.jobCosting'), path: '/estimating/job-costs' }
            ]}
          />
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{t('jobCosting.title')}</h1>
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
            onClick={() => navigate('/estimating/variance-report')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {t('jobCosting.viewReport')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('jobCosting.totalJobs')}</p>
              <p className="text-2xl font-bold text-gray-900">{kpis.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('jobCosting.overBudget')}</p>
              <p className="text-2xl font-bold text-red-600">{kpis.overBudget}</p>
              <p className="text-xs text-gray-500">
                {kpis.total > 0 ? ((kpis.overBudget / kpis.total) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('jobCosting.avgMargin')}</p>
              <p className="text-2xl font-bold text-green-600">{kpis.avgMargin.toFixed(1)}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('jobCosting.totalVariance')}</p>
              <p className={`text-2xl font-bold ${kpis.totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${Math.abs(kpis.totalVariance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            {kpis.totalVariance > 0 ? (
              <TrendingDown className="w-8 h-8 text-red-600" />
            ) : (
              <CheckCircle className="w-8 h-8 text-green-600" />
            )}
          </div>
        </div>
      </div>

      {/* Variance Chart */}
      {varianceChartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('jobCosting.varianceByCategory')}</h2>
          <Chart
            type="bar"
            data={{
              labels: varianceChartData.map(d => d.category),
              datasets: [
                {
                  label: t('jobCosting.variancePercentage'),
                  data: varianceChartData.map(d => d.variancePercentage),
                  backgroundColor: varianceChartData.map(d =>
                    d.variancePercentage > 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)'
                  ),
                  borderColor: varianceChartData.map(d =>
                    d.variancePercentage > 0 ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
                  ),
                  borderWidth: 1
                }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: true,
                  position: 'top'
                },
                tooltip: {
                  callbacks: {
                    label: (context: unknown) => {
                      const value = context.parsed.y;
                      return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value: unknown) => `${value}%`
                  }
                }
              }
            }}
            height={300}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('jobCosting.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('common.all')}</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RECONCILED">Reconciled</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('jobCosting.varianceFilter')}
            </label>
            <select
              value={varianceFilter}
              onChange={(e) => setVarianceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('common.all')}</option>
              <option value="over">{t('jobCosting.overBudget')}</option>
              <option value="under">{t('jobCosting.underBudget')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Job Costs Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <DataTable
          columns={columns}
          data={filteredJobCosts}
          searchPlaceholder={t('jobCosting.searchPlaceholder')}
        />
      </div>
    </div>
  );
};

export default JobCostingDashboard;
