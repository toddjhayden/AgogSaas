import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Users, TrendingUp, DollarSign } from 'lucide-react';
import { Chart } from '../components/common/Chart';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';

const mockJobData = [
  { id: '1', jobNumber: 'JOB-001', title: 'Business Cards 10K', budget: 2500, bids: 5, status: 'Active' },
  { id: '2', jobNumber: 'JOB-002', title: 'Brochures 5K', budget: 3200, bids: 8, status: 'Bidding' },
  { id: '3', jobNumber: 'JOB-003', title: 'Posters Large Format', budget: 5000, bids: 3, status: 'Awarded' },
];

const mockMarketplaceActivity = [
  { week: 'Week 1', jobsPosted: 12, bidsReceived: 45 },
  { week: 'Week 2', jobsPosted: 15, bidsReceived: 58 },
  { week: 'Week 3', jobsPosted: 18, bidsReceived: 67 },
  { week: 'Week 4', jobsPosted: 14, bidsReceived: 52 },
];

export const MarketplaceDashboard: React.FC = () => {
  const { t } = useTranslation();

  const columns: ColumnDef<typeof mockJobData[0]>[] = [
    { accessorKey: 'jobNumber', header: 'Job Number' },
    { accessorKey: 'title', header: 'Title' },
    {
      accessorKey: 'budget',
      header: 'Budget',
      cell: (info) => `$${(info.getValue() as number).toLocaleString()}`,
    },
    { accessorKey: 'bids', header: 'Bids' },
    { accessorKey: 'status', header: 'Status' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('marketplace.title')}</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium">Active Jobs</p>
              <p className="text-3xl font-bold mt-2">28</p>
            </div>
            <ShoppingCart className="h-12 w-12 text-primary-200" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Partners</p>
              <p className="text-3xl font-bold text-success-600 mt-2">156</p>
            </div>
            <Users className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fill Rate</p>
              <p className="text-3xl font-bold text-warning-600 mt-2">92%</p>
            </div>
            <TrendingUp className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue (MTD)</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">$145K</p>
            </div>
            <DollarSign className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      <Chart
        type="bar"
        data={mockMarketplaceActivity}
        xKey="week"
        yKey={['jobsPosted', 'bidsReceived']}
        title={t('marketplace.analytics')}
        colors={['#0ea5e9', '#22c55e']}
        height={300}
      />

      <DataTable data={mockJobData} columns={columns} pageSize={10} />
    </div>
  );
};
