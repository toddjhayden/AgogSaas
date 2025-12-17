import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, TrendingUp, Truck, CheckCircle } from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';

const mockInventoryData = [
  { location: 'Zone A', items: 1250, utilization: 78 },
  { location: 'Zone B', items: 980, utilization: 65 },
  { location: 'Zone C', items: 1450, utilization: 92 },
  { location: 'Zone D', items: 750, utilization: 45 },
];

const mockWaveData = [
  { id: '1', waveNumber: 'WAVE-001', status: 'Picking', orders: 45, picked: 32, accuracy: 99.2 },
  { id: '2', waveNumber: 'WAVE-002', status: 'Packing', orders: 38, picked: 38, accuracy: 98.7 },
  { id: '3', waveNumber: 'WAVE-003', status: 'Staged', orders: 52, picked: 52, accuracy: 99.5 },
];

export const WMSDashboard: React.FC = () => {
  const { t } = useTranslation();

  const columns: ColumnDef<typeof mockWaveData[0]>[] = [
    { accessorKey: 'waveNumber', header: 'Wave Number' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'orders', header: 'Total Orders' },
    { accessorKey: 'picked', header: 'Picked' },
    {
      accessorKey: 'accuracy',
      header: 'Accuracy',
      cell: (info) => `${info.getValue()}%`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('wms.title')}</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total SKUs</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">4,430</p>
            </div>
            <Package className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('wms.pickAccuracy')}</p>
              <p className="text-3xl font-bold text-success-600 mt-2">99.2%</p>
            </div>
            <CheckCircle className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Waves</p>
              <p className="text-3xl font-bold text-warning-600 mt-2">8</p>
            </div>
            <TrendingUp className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Shipments Today</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">127</p>
            </div>
            <Truck className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="bar"
          data={mockInventoryData}
          xKey="location"
          yKey="items"
          title={t('wms.inventoryLevels')}
          height={300}
        />

        <Chart
          type="bar"
          data={mockInventoryData}
          xKey="location"
          yKey="utilization"
          title="Warehouse Utilization %"
          colors={['#22c55e']}
          height={300}
        />
      </div>

      <DataTable data={mockWaveData} columns={columns} pageSize={10} />
    </div>
  );
};
