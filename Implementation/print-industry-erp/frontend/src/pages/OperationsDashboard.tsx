import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, CheckCircle, Clock } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { Chart } from '../components/common/Chart';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';

interface ProductionRun {
  id: string;
  workOrderNumber: string;
  productName: string;
  quantity: number;
  status: 'active' | 'scheduled' | 'completed';
  startTime: string;
  endTime?: string;
  workCenter: string;
  operator: string;
  progress: number;
}

const mockProductionRuns: ProductionRun[] = [
  {
    id: '1',
    workOrderNumber: 'WO-2024-001',
    productName: 'Business Cards - Premium',
    quantity: 10000,
    status: 'active',
    startTime: '2024-12-17 08:00',
    workCenter: 'Press #1',
    operator: 'John Smith',
    progress: 65,
  },
  {
    id: '2',
    workOrderNumber: 'WO-2024-002',
    productName: 'Brochures - Glossy',
    quantity: 5000,
    status: 'active',
    startTime: '2024-12-17 09:30',
    workCenter: 'Press #2',
    operator: 'Sarah Johnson',
    progress: 42,
  },
  {
    id: '3',
    workOrderNumber: 'WO-2024-003',
    productName: 'Flyers - Standard',
    quantity: 20000,
    status: 'scheduled',
    startTime: '2024-12-17 14:00',
    workCenter: 'Press #3',
    operator: 'Mike Chen',
    progress: 0,
  },
];

const mockOEEData = [
  { press: 'Press #1', oee: 85.2, availability: 92, performance: 95, quality: 98 },
  { press: 'Press #2', oee: 78.5, availability: 88, performance: 91, quality: 98 },
  { press: 'Press #3', oee: 72.3, availability: 82, performance: 89, quality: 99 },
  { press: 'Press #4', oee: 81.7, availability: 90, performance: 93, quality: 97 },
];

export const OperationsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const columns: ColumnDef<ProductionRun>[] = [
    {
      accessorKey: 'workOrderNumber',
      header: 'Work Order',
      cell: (info) => (
        <span className="font-medium text-primary-600">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'productName',
      header: 'Product',
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      cell: (info) => (info.getValue() as number).toLocaleString(),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        return (
          <span
            className={clsx(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              status === 'active' && 'bg-success-100 text-success-700',
              status === 'scheduled' && 'bg-warning-100 text-warning-700',
              status === 'completed' && 'bg-gray-100 text-gray-700'
            )}
          >
            {status === 'active' && <Play className="h-3 w-3 mr-1" />}
            {status === 'scheduled' && <Clock className="h-3 w-3 mr-1" />}
            {status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      accessorKey: 'workCenter',
      header: 'Work Center',
    },
    {
      accessorKey: 'operator',
      header: 'Operator',
    },
    {
      accessorKey: 'progress',
      header: 'Progress',
      cell: (info) => {
        const progress = info.getValue() as number;
        return (
          <div className="flex items-center space-x-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
        );
      },
    },
  ];

  const filteredRuns =
    statusFilter === 'all'
      ? mockProductionRuns
      : mockProductionRuns.filter((run) => run.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('operations.title')}</h1>
          <Breadcrumb />
        </div>
      </div>

      {/* Production Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('operations.active')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {mockProductionRuns.filter((r) => r.status === 'active').length}
              </p>
            </div>
            <Play className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('operations.scheduled')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {mockProductionRuns.filter((r) => r.status === 'scheduled').length}
              </p>
            </div>
            <Clock className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('operations.completed')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">147</p>
              <p className="text-sm text-gray-500 mt-1">This week</p>
            </div>
            <CheckCircle className="h-10 w-10 text-gray-500" />
          </div>
        </div>
      </div>

      {/* OEE Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="bar"
          data={mockOEEData}
          xKey="press"
          yKey={['availability', 'performance', 'quality']}
          title={t('operations.oee') + ' Components'}
          colors={['#0ea5e9', '#22c55e', '#eab308']}
          height={300}
        />

        <Chart
          type="bar"
          data={mockOEEData}
          xKey="press"
          yKey="oee"
          title={t('operations.oee') + ' by Press'}
          colors={['#8b5cf6']}
          height={300}
        />
      </div>

      {/* Work Center Status */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {t('operations.workCenterStatus')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockOEEData.map((press) => (
            <div key={press.press} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{press.press}</h3>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                  Running
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">OEE</span>
                    <span className="font-medium">{press.oee}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${press.oee}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-600">Current Job:</span>
                  <span className="font-medium text-xs">WO-2024-{press.press.slice(-1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Production Runs Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('operations.productionRuns')}</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'active'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'scheduled'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Scheduled
            </button>
          </div>
        </div>
        <DataTable data={filteredRuns} columns={columns} pageSize={10} />
      </div>
    </div>
  );
};
