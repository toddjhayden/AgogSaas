import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Printer,
  Download,
  Package,
  AlertCircle,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import {
  GET_PURCHASE_ORDER,
  APPROVE_PURCHASE_ORDER,
  UPDATE_PURCHASE_ORDER,
  CLOSE_PURCHASE_ORDER,
} from '../graphql/queries/purchaseOrders';

interface PurchaseOrderLine {
  id: string;
  lineNumber: number;
  materialCode: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRemaining: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineAmount: number;
  status: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
}

interface PurchaseOrder {
  id: string;
  tenantId: string;
  facilityId: string;
  poNumber: string;
  purchaseOrderDate: string;
  vendorId: string;
  poCurrencyCode: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  status: string;
  requiresApproval: boolean;
  approvedByUserId?: string;
  approvedAt?: string;
  requestedDeliveryDate?: string;
  promisedDeliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
  lines: PurchaseOrderLine[];
  createdAt: string;
  updatedAt?: string;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ISSUED: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

const lineStatusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const PurchaseOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_ORDER, {
    variables: { id },
    skip: !id,
  });

  const [approvePO] = useMutation(APPROVE_PURCHASE_ORDER, {
    onCompleted: () => {
      setShowApprovalModal(false);
      refetch();
    },
  });

  const [updatePO] = useMutation(UPDATE_PURCHASE_ORDER, {
    onCompleted: () => refetch(),
  });

  const [closePO] = useMutation(CLOSE_PURCHASE_ORDER, {
    onCompleted: () => refetch(),
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">{t('common.error')}: {error.message}</div>;
  if (!data?.purchaseOrder) return <div>{t('procurement.poNotFound')}</div>;

  const po: PurchaseOrder = data.purchaseOrder;

  const handleApprove = () => {
    // TODO: Get actual userId from auth context
    approvePO({
      variables: {
        id: po.id,
        approvedByUserId: '1',
      },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    updatePO({
      variables: {
        id: po.id,
        status: newStatus,
      },
    });
  };

  const handleClose = () => {
    closePO({
      variables: {
        id: po.id,
      },
    });
  };

  const canApprove = po.requiresApproval && !po.approvedAt && po.status === 'DRAFT';
  const canIssue = po.approvedAt && po.status === 'DRAFT';
  const canClose = po.status === 'RECEIVED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/procurement/purchase-orders')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('procurement.backToList')}</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{po.poNumber}</h1>
            <Breadcrumb />
          </div>
          <div className="flex items-center space-x-3">
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                statusColors[po.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {t(`procurement.statuses.${po.status}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        {canApprove && (
          <button
            onClick={() => setShowApprovalModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            <span>{t('procurement.approve')}</span>
          </button>
        )}
        {canIssue && (
          <button
            onClick={() => handleStatusChange('ISSUED')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Package className="h-4 w-4" />
            <span>{t('procurement.issue')}</span>
          </button>
        )}
        {canClose && (
          <button
            onClick={handleClose}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <XCircle className="h-4 w-4" />
            <span>{t('procurement.close')}</span>
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" />
          <span>{t('procurement.print')}</span>
        </button>
        <button
          onClick={() => alert('Export PDF functionality')}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          <span>{t('procurement.exportPDF')}</span>
        </button>
      </div>

      {/* Approval Status Alert */}
      {po.requiresApproval && !po.approvedAt && (
        <div className="card bg-yellow-50 border-l-4 border-yellow-400">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">{t('procurement.requiresApprovalMessage')}</p>
          </div>
        </div>
      )}

      {/* PO Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.orderDetails')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('procurement.poNumber')}</p>
              <p className="font-medium text-gray-900">{po.poNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.poDate')}</p>
              <p className="font-medium text-gray-900">
                {new Date(po.purchaseOrderDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.requestedDelivery')}</p>
              <p className="font-medium text-gray-900">
                {po.requestedDeliveryDate
                  ? new Date(po.requestedDeliveryDate).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.promisedDelivery')}</p>
              <p className="font-medium text-gray-900">
                {po.promisedDeliveryDate
                  ? new Date(po.promisedDeliveryDate).toLocaleDateString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.paymentTerms')}</p>
              <p className="font-medium text-gray-900">{po.paymentTerms || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('procurement.currency')}</p>
              <p className="font-medium text-gray-900">{po.poCurrencyCode}</p>
            </div>
          </div>
          {po.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">{t('procurement.notes')}</p>
              <p className="text-sm text-gray-900">{po.notes}</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.summary')}</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.subtotal')}</span>
              <span className="font-medium text-gray-900">
                {po.poCurrencyCode} {po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.tax')}</span>
              <span className="font-medium text-gray-900">
                {po.poCurrencyCode} {po.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.shipping')}</span>
              <span className="font-medium text-gray-900">
                {po.poCurrencyCode} {po.shippingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-gray-300">
              <span className="text-base font-semibold text-gray-900">{t('procurement.total')}</span>
              <span className="text-lg font-bold text-primary-600">
                {po.poCurrencyCode} {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {po.approvedAt && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{t('procurement.approved')}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {new Date(po.approvedAt).toLocaleDateString()} {new Date(po.approvedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.lineItems')}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.line')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.materialCode')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.description')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.qtyOrdered')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.qtyReceived')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.unitPrice')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.lineTotal')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('procurement.status')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {po.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {line.lineNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {line.materialCode}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{line.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {line.quantityOrdered} {line.unitOfMeasure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {line.quantityReceived} {line.unitOfMeasure}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {po.poCurrencyCode} {line.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    {po.poCurrencyCode} {line.lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        lineStatusColors[line.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {t(`procurement.lineStatuses.${line.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('procurement.confirmApproval')}</h3>
            <p className="text-sm text-gray-600 mb-6">{t('procurement.approvalConfirmMessage')}</p>
            <div className="flex items-center space-x-3 justify-end">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {t('procurement.approve')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
