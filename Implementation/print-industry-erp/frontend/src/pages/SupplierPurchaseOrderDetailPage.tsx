/**
 * Supplier Purchase Order Detail Page
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 */

import React from 'react';
import { useQuery } from '@apollo/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Download,
  Package,
  MapPin,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { GET_SUPPLIER_PURCHASE_ORDER } from '../graphql/queries/supplierPortal';

const SupplierPurchaseOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { poNumber } = useParams<{ poNumber: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_SUPPLIER_PURCHASE_ORDER, {
    variables: { poNumber },
  });

  const po = data?.supplierPurchaseOrder;

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <p className="text-sm text-red-700">{t('error.loadingPO')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/supplier/purchase-orders')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('supplierPortal.purchaseOrders.detail')} - {po.poNumber}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {t('supplierPortal.purchaseOrders.issued')}:{' '}
              {new Date(po.poDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          {!po.acknowledgment && (
            <button
              onClick={() => navigate(`/supplier/purchase-orders/${poNumber}/acknowledge`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('supplierPortal.purchaseOrders.acknowledge')}
            </button>
          )}
          {po.acknowledgment && !po.asns?.length && (
            <button
              onClick={() => navigate(`/supplier/asn/create?po=${poNumber}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              {t('supplierPortal.asn.create')}
            </button>
          )}
        </div>
      </div>

      {/* PO Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">{t('supplierPortal.purchaseOrders.lineItems')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.description')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.quantity')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.unitPrice')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {po.lines?.map((line: any) => (
                    <tr key={line.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{line.lineNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{line.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {line.quantity} {line.unitOfMeasure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(line.unitPrice, po.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatCurrency(line.extendedPrice, po.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-end space-y-2">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('common.subtotal')}:</span>
                    <span className="font-medium">{formatCurrency(po.subtotal, po.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('common.tax')}:</span>
                    <span className="font-medium">{formatCurrency(po.taxAmount, po.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('common.shipping')}:</span>
                    <span className="font-medium">{formatCurrency(po.shippingAmount, po.currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t pt-2">
                    <span>{t('common.total')}:</span>
                    <span>{formatCurrency(po.totalAmount, po.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <MapPin className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-semibold">{t('common.shippingAddress')}</h3>
            </div>
            <div className="text-sm text-gray-900 space-y-1">
              <p className="font-medium">{po.shipToFacility?.facilityName}</p>
              <p>{po.shipToAddress?.address1}</p>
              {po.shipToAddress?.address2 && <p>{po.shipToAddress.address2}</p>}
              <p>
                {po.shipToAddress?.city}, {po.shipToAddress?.state} {po.shipToAddress?.postalCode}
              </p>
              <p>{po.shipToAddress?.country}</p>
            </div>
          </div>

          {/* Buyer Contact */}
          {po.buyerName && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">{t('supplierPortal.purchaseOrders.buyerContact')}</h3>
              <div className="text-sm text-gray-900 space-y-2">
                <p className="font-medium">{po.buyerName}</p>
                {po.buyerEmail && <p className="text-blue-600">{po.buyerEmail}</p>}
                {po.buyerPhone && <p>{po.buyerPhone}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierPurchaseOrderDetailPage;
