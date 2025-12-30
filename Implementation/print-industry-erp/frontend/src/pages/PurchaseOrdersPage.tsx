import React, { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Filter } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/common/DataTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_PURCHASE_ORDERS } from '../graphql/queries/purchaseOrders';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  purchaseOrderDate: string;
  vendorId: string;
  facilityId: string;
  status: string;
  totalAmount: number;
  poCurrencyCode: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
  approvedAt?: string;
  requiresApproval: boolean;
  currentApprovalWorkflowId?: string;
  currentApprovalStepNumber?: number;
  pendingApproverUserId?: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  ISSUED: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const PurchaseOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');

  // TODO: Get tenantId and facilityId from context/auth
  const tenantId = '1';
  const facilityId = null;

  const { data, loading, error } = useQuery(GET_PURCHASE_ORDERS, {
    variables: {
      tenantId,
      facilityId,
      status: statusFilter || undefined,
      limit: 100,
      offset: 0,
    },
  });

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        accessorKey: 'poNumber',
        header: t('procurement.poNumber'),
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/procurement/purchase-orders/${row.original.id}`)}
            className="text-primary-600 hover:text-primary-800 font-medium"
          >
            {row.original.poNumber}
          </button>
        ),
      },
      {
        accessorKey: 'purchaseOrderDate',
        header: t('procurement.poDate'),
        cell: ({ row }) => new Date(row.original.purchaseOrderDate).toLocaleDateString(),
      },
      {
        accessorKey: 'status',
        header: t('procurement.status'),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              statusColors[row.original.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {t(`procurement.statuses.${row.original.status}`)}
          </span>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: t('procurement.totalAmount'),
        cell: ({ row }) =>
          `${row.original.poCurrencyCode} ${row.original.totalAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
      },
      {
        accessorKey: 'requestedDeliveryDate',
        header: t('procurement.deliveryDate'),
        cell: ({ row }) =>
          row.original.requestedDeliveryDate
            ? new Date(row.original.requestedDeliveryDate).toLocaleDateString()
            : '-',
      },
      {
        accessorKey: 'approvalStatus',
        header: t('procurement.approvalStatus'),
        cell: ({ row }) => {
          const po = row.original;

          if (po.status === 'PENDING_APPROVAL') {
            return (
              <div className="flex flex-col">
                <span className="text-yellow-600 font-medium">{t('procurement.pendingApproval')}</span>
                {po.currentApprovalStepNumber && (
                  <span className="text-xs text-gray-500">
                    Step {po.currentApprovalStepNumber}
                  </span>
                )}
              </div>
            );
          } else if (po.status === 'APPROVED' || po.approvedAt) {
            return <span className="text-green-600 font-medium">{t('procurement.approved')}</span>;
          } else if (po.status === 'REJECTED') {
            return <span className="text-red-600 font-medium">{t('procurement.rejected')}</span>;
          } else if (po.requiresApproval && po.status === 'DRAFT') {
            return <span className="text-gray-600">{t('procurement.notSubmitted')}</span>;
          } else {
            return <span className="text-gray-400">-</span>;
          }
        },
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/procurement/purchase-orders/${row.original.id}`)}
            className="text-primary-600 hover:text-primary-800"
          >
            <FileText className="h-4 w-4" />
          </button>
        ),
      },
    ],
    [t, navigate]
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">{t('common.error')}: {error.message}</div>;

  const purchaseOrders = data?.purchaseOrders || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('procurement.title')}</h1>
        <Breadcrumb />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('procurement.totalOrders')}</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{purchaseOrders.length}</p>
            </div>
            <FileText className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('procurement.pendingApproval')}</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {purchaseOrders.filter((po: PurchaseOrder) => po.status === 'PENDING_APPROVAL').length}
              </p>
            </div>
            <Filter className="h-10 w-10 text-yellow-500" />
          </div>
        </div>

        <div className="card border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('procurement.received')}</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {purchaseOrders.filter((po: PurchaseOrder) => po.status === 'RECEIVED').length}
              </p>
            </div>
            <FileText className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('procurement.totalValue')}</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                ${purchaseOrders.reduce((sum: number, po: PurchaseOrder) => sum + po.totalAmount, 0).toLocaleString()}
              </p>
            </div>
            <FileText className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t('procurement.allStatuses')}</option>
            <option value="DRAFT">{t('procurement.statuses.DRAFT')}</option>
            <option value="PENDING_APPROVAL">{t('procurement.statuses.PENDING_APPROVAL')}</option>
            <option value="APPROVED">{t('procurement.statuses.APPROVED')}</option>
            <option value="REJECTED">{t('procurement.statuses.REJECTED')}</option>
            <option value="ISSUED">{t('procurement.statuses.ISSUED')}</option>
            <option value="ACKNOWLEDGED">{t('procurement.statuses.ACKNOWLEDGED')}</option>
            <option value="PARTIALLY_RECEIVED">{t('procurement.statuses.PARTIALLY_RECEIVED')}</option>
            <option value="RECEIVED">{t('procurement.statuses.RECEIVED')}</option>
            <option value="CLOSED">{t('procurement.statuses.CLOSED')}</option>
            <option value="CANCELLED">{t('procurement.statuses.CANCELLED')}</option>
          </select>
        </div>

        <button
          onClick={() => navigate('/procurement/purchase-orders/new')}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>{t('procurement.createPO')}</span>
        </button>
      </div>

      {/* Data Table */}
      <DataTable columns={columns} data={purchaseOrders} searchable exportable />
    </div>
  );
};
