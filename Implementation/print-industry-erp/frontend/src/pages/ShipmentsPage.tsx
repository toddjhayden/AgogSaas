import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Package, Filter, Truck, AlertCircle } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/common/DataTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_SHIPMENTS } from '../graphql/queries/shipping';

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  carrierName?: string;
  serviceLevel?: string;
  trackingNumber?: string;
  shipToName: string;
  shipToCity: string;
  shipToState?: string;
  shipToCountry: string;
  shipmentDate: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  numberOfPackages: number;
  totalWeight?: number;
  totalCost?: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-800',
  PACKED: 'bg-blue-100 text-blue-800',
  MANIFESTED: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-blue-100 text-blue-800',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
  OUT_FOR_DELIVERY: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-green-100 text-green-800',
  EXCEPTION: 'bg-red-100 text-red-800',
  RETURNED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export const ShipmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({});

  const tenantId = '1';
  const facilityId = null;

  const { data, loading, error } = useQuery(GET_SHIPMENTS, {
    variables: {
      tenantId,
      facilityId,
      status: statusFilter || undefined,
      startDate: dateFilter.start || undefined,
      endDate: dateFilter.end || undefined,
    },
  });

  const columns = useMemo<ColumnDef<Shipment>[]>(
    () => [
      {
        accessorKey: 'shipmentNumber',
        header: t('shipping.shipmentNumber'),
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/wms/shipments/${row.original.id}`)}
            className="text-primary-600 hover:text-primary-800 font-medium flex items-center"
          >
            <Package className="h-4 w-4 mr-2" />
            {row.original.shipmentNumber}
          </button>
        ),
      },
      {
        accessorKey: 'status',
        header: t('shipping.status'),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              statusColors[row.original.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {t(`shipping.statuses.${row.original.status}`)}
          </span>
        ),
      },
      {
        accessorKey: 'trackingNumber',
        header: t('shipping.trackingNumber'),
        cell: ({ row }) =>
          row.original.trackingNumber ? (
            <div className="flex items-center">
              <Truck className="h-4 w-4 mr-2 text-primary-600" />
              <span className="font-mono text-sm">{row.original.trackingNumber}</span>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          ),
      },
      {
        accessorKey: 'carrier',
        header: t('shipping.carrier'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.carrierName || '-'}</span>
            {row.original.serviceLevel && (
              <span className="text-xs text-gray-500">{row.original.serviceLevel}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'shipTo',
        header: t('shipping.shipTo'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.shipToName}</span>
            <span className="text-xs text-gray-500">
              {row.original.shipToCity}
              {row.original.shipToState ? `, ${row.original.shipToState}` : ''},{' '}
              {row.original.shipToCountry}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'shipmentDate',
        header: t('shipping.shipmentDate'),
        cell: ({ row }) => new Date(row.original.shipmentDate).toLocaleDateString(),
      },
      {
        accessorKey: 'estimatedDeliveryDate',
        header: t('shipping.deliveryDate'),
        cell: ({ row }) => {
          if (row.original.actualDeliveryDate) {
            return (
              <div className="flex flex-col">
                <span className="text-green-600 font-medium">
                  {new Date(row.original.actualDeliveryDate).toLocaleDateString()}
                </span>
                <span className="text-xs text-gray-500">{t('shipping.delivered')}</span>
              </div>
            );
          } else if (row.original.estimatedDeliveryDate) {
            return (
              <div className="flex flex-col">
                <span>{new Date(row.original.estimatedDeliveryDate).toLocaleDateString()}</span>
                <span className="text-xs text-gray-500">{t('shipping.estimated')}</span>
              </div>
            );
          }
          return <span className="text-gray-400">-</span>;
        },
      },
      {
        accessorKey: 'numberOfPackages',
        header: t('shipping.packages'),
        cell: ({ row }) => (
          <span className="text-center">
            {row.original.numberOfPackages} {t('shipping.pkg')}
          </span>
        ),
      },
      {
        accessorKey: 'totalCost',
        header: t('shipping.cost'),
        cell: ({ row }) =>
          row.original.totalCost ? (
            `$${row.original.totalCost.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          ) : (
            <span className="text-gray-400">-</span>
          ),
      },
    ],
    [t, navigate]
  );

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
          <div>
            <h3 className="text-red-800 font-medium">{t('common.error')}</h3>
            <p className="text-red-600 text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const shipments = data?.shipments || [];

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: t('nav.wms'), path: '/wms' },
          { label: t('nav.shipments'), path: '/wms/shipments' },
        ]}
      />

      <div className="mt-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('shipping.shipments')}</h1>
            <p className="text-gray-600 mt-1">{t('shipping.shipmentsDescription')}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            <h3 className="font-medium text-gray-900">{t('common.filters')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('shipping.status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('common.all')}</option>
                <option value="PLANNED">{t('shipping.statuses.PLANNED')}</option>
                <option value="PACKED">{t('shipping.statuses.PACKED')}</option>
                <option value="MANIFESTED">{t('shipping.statuses.MANIFESTED')}</option>
                <option value="SHIPPED">{t('shipping.statuses.SHIPPED')}</option>
                <option value="IN_TRANSIT">{t('shipping.statuses.IN_TRANSIT')}</option>
                <option value="OUT_FOR_DELIVERY">{t('shipping.statuses.OUT_FOR_DELIVERY')}</option>
                <option value="DELIVERED">{t('shipping.statuses.DELIVERED')}</option>
                <option value="EXCEPTION">{t('shipping.statuses.EXCEPTION')}</option>
                <option value="RETURNED">{t('shipping.statuses.RETURNED')}</option>
                <option value="CANCELLED">{t('shipping.statuses.CANCELLED')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('shipping.startDate')}
              </label>
              <input
                type="date"
                value={dateFilter.start || ''}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('shipping.endDate')}
              </label>
              <input
                type="date"
                value={dateFilter.end || ''}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Shipments Table */}
        <div className="bg-white rounded-lg shadow">
          <DataTable columns={columns} data={shipments} />
        </div>

        {shipments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow mt-6">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('shipping.noShipments')}
            </h3>
            <p className="text-gray-600">{t('shipping.noShipmentsDescription')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
