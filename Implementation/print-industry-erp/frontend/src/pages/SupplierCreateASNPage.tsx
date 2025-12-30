/**
 * Supplier Create Advanced Ship Notice (ASN) Page
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import {
  GET_SUPPLIER_PURCHASE_ORDER,
  CREATE_ADVANCED_SHIP_NOTICE,
} from '../graphql/queries/supplierPortal';

const SupplierCreateASNPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poNumber = searchParams.get('po');

  const [carrierCode, setCarrierCode] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [actualShipDate, setActualShipDate] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [packageCount, setPackageCount] = useState(1);
  const [totalWeight, setTotalWeight] = useState('');
  const [lines, setLines] = useState<any[]>([]);

  const { data: poData } = useQuery(GET_SUPPLIER_PURCHASE_ORDER, {
    variables: { poNumber },
    skip: !poNumber,
    onCompleted: (data) => {
      // Initialize lines from PO
      if (data?.supplierPurchaseOrder?.lines) {
        setLines(
          data.supplierPurchaseOrder.lines.map((line: any) => ({
            poLineId: line.id,
            quantityShipped: line.quantityRemaining || 0,
            lotNumber: '',
            serialNumbers: [],
          }))
        );
      }
    },
  });

  const [createASN, { loading: creating }] = useMutation(CREATE_ADVANCED_SHIP_NOTICE, {
    onCompleted: () => {
      navigate('/supplier/purchase-orders');
    },
  });

  const po = poData?.supplierPurchaseOrder;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createASN({
        variables: {
          input: {
            poNumber,
            carrierCode,
            trackingNumber,
            actualShipDate,
            expectedDeliveryDate,
            packageCount,
            totalWeight: parseFloat(totalWeight),
            weightUnit: 'LBS',
            lines: lines.map((line) => ({
              poLineId: line.poLineId,
              quantityShipped: parseFloat(line.quantityShipped),
              lotNumber: line.lotNumber || null,
            })),
          },
        },
      });
    } catch (error) {
      console.error('Error creating ASN:', error);
    }
  };

  if (!poNumber) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <p className="ml-3 text-sm text-yellow-700">{t('supplierPortal.asn.selectPO')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('supplierPortal.asn.create')}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('supplierPortal.asn.for')} PO: {poNumber}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">{t('supplierPortal.asn.shipmentDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplierPortal.asn.carrier')} *
              </label>
              <select
                required
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">{t('common.select')}</option>
                <option value="FEDEX">FedEx</option>
                <option value="UPS">UPS</option>
                <option value="USPS">USPS</option>
                <option value="DHL">DHL</option>
                <option value="OTHER">{t('common.other')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplierPortal.asn.trackingNumber')}
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplierPortal.asn.actualShipDate')} *
              </label>
              <input
                type="date"
                required
                value={actualShipDate}
                onChange={(e) => setActualShipDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplierPortal.asn.expectedDeliveryDate')} *
              </label>
              <input
                type="date"
                required
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplierPortal.asn.packageCount')} *
              </label>
              <input
                type="number"
                required
                min="1"
                value={packageCount}
                onChange={(e) => setPackageCount(parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('supplierPortal.asn.totalWeight')} (lbs)
              </label>
              <input
                type="number"
                step="0.01"
                value={totalWeight}
                onChange={(e) => setTotalWeight(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">{t('supplierPortal.asn.lineItems')}</h2>
          </div>
          <div className="p-6">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">{t('common.description')}</th>
                  <th className="text-right py-2">{t('common.ordered')}</th>
                  <th className="text-right py-2">{t('common.shipping')}</th>
                  <th className="text-left py-2">{t('supplierPortal.asn.lotNumber')}</th>
                </tr>
              </thead>
              <tbody>
                {po?.lines?.map((poLine: any, idx: number) => (
                  <tr key={poLine.id} className="border-b">
                    <td className="py-3">{poLine.description}</td>
                    <td className="text-right py-3">{poLine.quantityRemaining}</td>
                    <td className="py-3">
                      <input
                        type="number"
                        step="0.01"
                        value={lines[idx]?.quantityShipped || 0}
                        onChange={(e) => {
                          const newLines = [...lines];
                          newLines[idx].quantityShipped = e.target.value;
                          setLines(newLines);
                        }}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="text"
                        value={lines[idx]?.lotNumber || ''}
                        onChange={(e) => {
                          const newLines = [...lines];
                          newLines[idx].lotNumber = e.target.value;
                          setLines(newLines);
                        }}
                        className="w-32 px-2 py-1 border border-gray-300 rounded"
                        placeholder={t('common.optional')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? t('common.creating') : t('supplierPortal.asn.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SupplierCreateASNPage;
