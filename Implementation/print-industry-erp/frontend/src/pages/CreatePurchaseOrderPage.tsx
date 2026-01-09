import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import {
  CREATE_PURCHASE_ORDER,
  GET_VENDORS,
  GET_MATERIALS,
} from '../graphql/queries/purchaseOrders';

interface LineItem {
  id: string;
  materialId: string;
  materialCode: string;
  description: string;
  quantityOrdered: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineAmount: number;
}

export const CreatePurchaseOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // TODO: Get from auth context
  const tenantId = '1';
  const facilityId = '1';

  const [formData, setFormData] = useState({
    vendorId: '',
    purchaseOrderDate: new Date().toISOString().split('T')[0],
    requestedDeliveryDate: '',
    paymentTerms: '',
    poCurrencyCode: 'USD',
    notes: '',
  });

  const [lines, setLines] = useState<LineItem[]>([
    {
      id: '1',
      materialId: '',
      materialCode: '',
      description: '',
      quantityOrdered: 0,
      unitOfMeasure: 'EA',
      unitPrice: 0,
      lineAmount: 0,
    },
  ]);

  const { data: vendorsData, loading: vendorsLoading } = useQuery(GET_VENDORS, {
    variables: {
      tenantId,
      isActive: true,
      isApproved: true,
      limit: 100,
    },
  });

  const { data: materialsData, loading: materialsLoading } = useQuery(GET_MATERIALS, {
    variables: {
      tenantId,
      isActive: true,
      limit: 100,
    },
  });

  const [createPO, { loading: creating }] = useMutation(CREATE_PURCHASE_ORDER, {
    onCompleted: (data) => {
      navigate(`/procurement/purchase-orders/${data.createPurchaseOrder.id}`);
    },
    onError: (error) => {
      alert(`Error creating PO: ${error.message}`);
    },
  });

  const vendors = vendorsData?.vendors || [];
  const materials = materialsData?.materials || [];

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Recalculate line amount if quantity or price changes
      if (field === 'quantityOrdered' || field === 'unitPrice') {
        updated[index].lineAmount =
          updated[index].quantityOrdered * updated[index].unitPrice;
      }

      // If material is selected, populate details
      if (field === 'materialId') {
        const material = materials.find((m: unknown) => m.id === value);
        if (material) {
          updated[index].materialCode = material.materialCode;
          updated[index].description = material.materialName;
          updated[index].unitOfMeasure = material.primaryUom;
          updated[index].unitPrice = material.standardCost || material.lastCost || 0;
          updated[index].lineAmount =
            updated[index].quantityOrdered * updated[index].unitPrice;
        }
      }

      return updated;
    });
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        materialId: '',
        materialCode: '',
        description: '',
        quantityOrdered: 0,
        unitOfMeasure: 'EA',
        unitPrice: 0,
        lineAmount: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + line.lineAmount, 0);
    const taxAmount = subtotal * 0.08; // 8% tax - simplified
    const shippingAmount = 0; // Can be added as a field
    const totalAmount = subtotal + taxAmount + shippingAmount;

    return { subtotal, taxAmount, shippingAmount, totalAmount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.vendorId) {
      alert(t('procurement.selectVendor'));
      return;
    }

    if (lines.some((line) => !line.materialId || line.quantityOrdered <= 0)) {
      alert(t('procurement.invalidLineItems'));
      return;
    }

    const totals = calculateTotals();

    createPO({
      variables: {
        tenantId,
        facilityId,
        vendorId: formData.vendorId,
        purchaseOrderDate: formData.purchaseOrderDate,
        poCurrencyCode: formData.poCurrencyCode,
        totalAmount: totals.totalAmount,
      },
    });
  };

  const totals = calculateTotals();

  if (vendorsLoading || materialsLoading) return <LoadingSpinner />;

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
        <h1 className="text-3xl font-bold text-gray-900">{t('procurement.createPO')}</h1>
        <Breadcrumb />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Information */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.orderInformation')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('procurement.vendor')} *
              </label>
              <select
                value={formData.vendorId}
                onChange={(e) => handleInputChange('vendorId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">{t('procurement.selectVendor')}</option>
                {vendors.map((vendor: unknown) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendorCode} - {vendor.vendorName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('procurement.poDate')} *
              </label>
              <input
                type="date"
                value={formData.purchaseOrderDate}
                onChange={(e) => handleInputChange('purchaseOrderDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('procurement.requestedDelivery')}
              </label>
              <input
                type="date"
                value={formData.requestedDeliveryDate}
                onChange={(e) => handleInputChange('requestedDeliveryDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('procurement.paymentTerms')}
              </label>
              <input
                type="text"
                value={formData.paymentTerms}
                onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                placeholder="Net 30"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('procurement.currency')} *
              </label>
              <select
                value={formData.poCurrencyCode}
                onChange={(e) => handleInputChange('poCurrencyCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('procurement.notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder={t('procurement.notesPlaceholder')}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{t('procurement.lineItems')}</h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>{t('procurement.addLine')}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.material')} *
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.description')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.quantity')} *
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.uom')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.unitPrice')} *
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {t('procurement.lineTotal')}
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <select
                        value={line.materialId}
                        onChange={(e) => handleLineChange(index, 'materialId', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
                        required
                      >
                        <option value="">{t('procurement.selectMaterial')}</option>
                        {materials.map((material: unknown) => (
                          <option key={material.id} value={material.id}>
                            {material.materialCode} - {material.materialName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={line.quantityOrdered || ''}
                        onChange={(e) =>
                          handleLineChange(index, 'quantityOrdered', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        step="0.01"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={line.unitOfMeasure}
                        onChange={(e) => handleLineChange(index, 'unitOfMeasure', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={line.unitPrice || ''}
                        onChange={(e) =>
                          handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        step="0.01"
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {formData.poCurrencyCode} {line.lineAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        disabled={lines.length === 1}
                        className="text-red-600 hover:text-red-800 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('procurement.summary')}</h2>
          <div className="space-y-3 max-w-sm ml-auto">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.subtotal')}</span>
              <span className="font-medium text-gray-900">
                {formData.poCurrencyCode} {totals.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.tax')} (8%)</span>
              <span className="font-medium text-gray-900">
                {formData.poCurrencyCode} {totals.taxAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('procurement.shipping')}</span>
              <span className="font-medium text-gray-900">
                {formData.poCurrencyCode} {totals.shippingAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-gray-300">
              <span className="text-base font-semibold text-gray-900">{t('procurement.total')}</span>
              <span className="text-lg font-bold text-primary-600">
                {formData.poCurrencyCode} {totals.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/procurement/purchase-orders')}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center space-x-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span>{creating ? t('common.saving') : t('procurement.createPO')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
