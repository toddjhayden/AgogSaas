import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Filter, AlertCircle, TrendingUp } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/common/DataTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { KPICard } from '../components/common/KPICard';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_PRODUCTION_ORDERS } from '../graphql/queries/productionPlanning';
import { useAppStore } from '../store/appStore';

interface ProductionOrder {
  id: string;
  productionOrderNumber: string;
  productId: string;
  productCode: string;
  productDescription: string;
  quantityOrdered: number;
  quantityCompleted: number;
  unitOfMeasure: string;
  manufacturingStrategy: string;
  priority: number;
  dueDate: string;
  plannedStartDate?: string;
  plannedCompletionDate?: string;
  status: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-800',
  RELEASED: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
};

const priorityColors: Record<number, string> = {
  1: 'text-red-600 font-bold', // URGENT
  5: 'text-yellow-600 font-medium', // NORMAL
  10: 'text-gray-600', // LOW
};

export const ProductionPlanningDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const selectedFacility = useAppStore((state) => state.preferences.selectedFacility);

  const facilityId = selectedFacility || '1'; // TODO: Get from context/auth

  const { data, loading, error, refetch } = useQuery(GET_PRODUCTION_ORDERS, {
    variables: {
      facilityId,
      status: statusFilter || undefined,
      limit: 100,
      offset: 0,
    },
    pollInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!data?.productionOrders?.edges) {
      return {
        total: 0,
        inProgress: 0,
        lateOrders: 0,
        completionRate: 0,
      };
    }

    const orders = data.productionOrders.edges.map((edge: any) => edge.node);
    const total = orders.length;
    const inProgress = orders.filter((o: ProductionOrder) => o.status === 'IN_PROGRESS').length;
    const completed = orders.filter((o: ProductionOrder) => o.status === 'COMPLETED').length;
    const lateOrders = orders.filter(
      (o: ProductionOrder) =>
        o.status !== 'COMPLETED' &&
        o.status !== 'CANCELLED' &&
        new Date(o.dueDate) < new Date()
    ).length;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      inProgress,
      lateOrders,
      completionRate,
    };
  }, [data]);

  const columns = useMemo<ColumnDef<ProductionOrder>[]>(
    () => [
      {
        accessorKey: 'productionOrderNumber',
        header: t('production.orderNumber'),
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/operations/production-orders/${row.original.id}`)}
            className="text-primary-600 hover:text-primary-800 font-medium"
          >
            {row.original.productionOrderNumber}
          </button>
        ),
      },
      {
        accessorKey: 'productCode',
        header: t('production.productCode'),
      },
      {
        accessorKey: 'productDescription',
        header: t('production.productDescription'),
        cell: ({ row }) => (
          <div className="max-w-xs truncate" title={row.original.productDescription}>
            {row.original.productDescription}
          </div>
        ),
      },
      {
        accessorKey: 'quantityOrdered',
        header: t('production.quantity'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.quantityOrdered.toLocaleString()} {row.original.unitOfMeasure}
            </span>
            {row.original.status === 'IN_PROGRESS' && row.original.quantityCompleted > 0 && (
              <span className="text-xs text-gray-500">
                {row.original.quantityCompleted.toLocaleString()} completed (
                {Math.round((row.original.quantityCompleted / row.original.quantityOrdered) * 100)}
                %)
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'priority',
        header: t('production.priority'),
        cell: ({ row }) => {
          const priority = row.original.priority;
          let label = '';
          if (priority === 1) label = 'URGENT';
          else if (priority <= 3) label = 'HIGH';
          else if (priority <= 7) label = 'NORMAL';
          else label = 'LOW';

          return (
            <span className={priorityColors[priority] || priorityColors[5]}>
              {t(`production.priorities.${label}`)}
            </span>
          );
        },
      },
      {
        accessorKey: 'dueDate',
        header: t('production.dueDate'),
        cell: ({ row }) => {
          const dueDate = new Date(row.original.dueDate);
          const today = new Date();
          const isLate =
            row.original.status !== 'COMPLETED' &&
            row.original.status !== 'CANCELLED' &&
            dueDate < today;

          return (
            <div className="flex items-center gap-1">
              {isLate && <AlertCircle className="h-4 w-4 text-red-500" />}
              <span className={isLate ? 'text-red-600 font-medium' : ''}>
                {dueDate.toLocaleDateString()}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('production.status'),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              statusColors[row.original.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {t(`production.statuses.${row.original.status}`)}
          </span>
        ),
      },
      {
        accessorKey: 'manufacturingStrategy',
        header: t('production.strategy'),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">{row.original.manufacturingStrategy || '-'}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('production.createdAt'),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    [t, navigate]
  );

  const filteredData = useMemo(() => {
    if (!data?.productionOrders?.edges) return [];
    return data.productionOrders.edges.map((edge: any) => edge.node);
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('common.error')}</h3>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: t('nav.operations'), path: '/operations' },
              { label: t('nav.productionPlanning'), path: '/operations/production-planning' },
            ]}
          />
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{t('production.planningDashboard')}</h1>
        </div>
        <button
          onClick={() => navigate('/operations/production-orders/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          {t('production.createOrder')}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title={t('production.totalOrders')}
          value={kpis.total.toString()}
          trend={null}
          icon={Calendar}
          color="blue"
        />
        <KPICard
          title={t('production.inProgress')}
          value={kpis.inProgress.toString()}
          trend={null}
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title={t('production.lateOrders')}
          value={kpis.lateOrders.toString()}
          trend={null}
          icon={AlertCircle}
          color={kpis.lateOrders > 0 ? 'red' : 'gray'}
        />
        <KPICard
          title={t('production.completionRate')}
          value={`${kpis.completionRate.toFixed(1)}%`}
          trend={null}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('production.status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">{t('common.all')}</option>
                <option value="PLANNED">{t('production.statuses.PLANNED')}</option>
                <option value="RELEASED">{t('production.statuses.RELEASED')}</option>
                <option value="IN_PROGRESS">{t('production.statuses.IN_PROGRESS')}</option>
                <option value="COMPLETED">{t('production.statuses.COMPLETED')}</option>
                <option value="ON_HOLD">{t('production.statuses.ON_HOLD')}</option>
                <option value="CANCELLED">{t('production.statuses.CANCELLED')}</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => {
              setStatusFilter('');
              refetch();
            }}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      {/* Production Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('production.productionOrders')}
          </h2>
          <DataTable
            data={filteredData}
            columns={columns}
            searchable
            exportable
            pageSize={25}
          />
        </div>
      </div>
    </div>
  );
};
