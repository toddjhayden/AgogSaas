import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import {
  Plus,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Calculator,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import {
  GET_QUOTE,
  ADD_QUOTE_LINE,
  DELETE_QUOTE_LINE,
  RECALCULATE_QUOTE,
  VALIDATE_QUOTE_MARGIN,
  UPDATE_QUOTE_STATUS
} from '../graphql/queries/salesQuoteAutomation';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { DataTable } from '../components/common/DataTable';

interface QuoteLine {
  id: string;
  lineNumber: number;
  productId: string;
  productCode: string;
  description: string;
  quantityQuoted: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineAmount: number;
  discountPercentage: number;
  discountAmount: number;
  unitCost: number;
  lineCost: number;
  lineMargin: number;
  marginPercentage: number;
  manufacturingStrategy: string;
  leadTimeDays: number;
  promisedDeliveryDate: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  expirationDate: string;
  customerId: string;
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  salesRepUserId: string;
  salesRepName: string;
  facilityId: string;
  facilityName: string;
  status: string;
  quoteCurrencyCode: string;
  termsAndConditions: string;
  internalNotes: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  marginAmount: number;
  marginPercentage: number;
  convertedToSalesOrderId: string;
  convertedAt: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  lines: QuoteLine[];
}

const SalesQuoteDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [showAddLineForm, setShowAddLineForm] = useState(false);
  const [newLine, setNewLine] = useState({
    productId: '',
    productCode: '',
    quantityQuoted: 0,
    unitPrice: 0,
    manualPriceOverride: false
  });

  // Query quote details
  const { data, loading, error, refetch } = useQuery(GET_QUOTE, {
    variables: { quoteId },
    skip: !quoteId
  });

  const quote: Quote = data?.quote;

  // Mutations
  const [addQuoteLine] = useMutation(ADD_QUOTE_LINE, {
    onCompleted: () => {
      setShowAddLineForm(false);
      setNewLine({
        productId: '',
        productCode: '',
        quantityQuoted: 0,
        unitPrice: 0,
        manualPriceOverride: false
      });
      refetch();
    }
  });


  const [deleteQuoteLine] = useMutation(DELETE_QUOTE_LINE, {
    onCompleted: () => refetch()
  });

  const [recalculateQuote] = useMutation(RECALCULATE_QUOTE, {
    onCompleted: () => refetch()
  });

  const [validateQuoteMargin] = useMutation(VALIDATE_QUOTE_MARGIN);

  const [updateQuoteStatus] = useMutation(UPDATE_QUOTE_STATUS, {
    onCompleted: () => refetch()
  });

  // Handle add quote line
  const handleAddQuoteLine = async () => {
    if (!newLine.productId || newLine.quantityQuoted <= 0) {
      alert(t('salesQuotes.validation.requiredFields'));
      return;
    }

    try {
      await addQuoteLine({
        variables: {
          input: {
            quoteId: quoteId,
            productId: newLine.productId,
            quantityQuoted: newLine.quantityQuoted,
            manualPriceOverride: newLine.manualPriceOverride ? newLine.unitPrice : undefined
          }
        }
      });
    } catch (err) {
      console.error('Error adding quote line:', err);
      alert(t('common.error'));
    }
  };

  // Handle delete quote line
  const handleDeleteQuoteLine = async (lineId: string) => {
    if (!confirm(t('salesQuotes.confirmDeleteLine'))) return;

    try {
      await deleteQuoteLine({
        variables: { quoteLineId: lineId }
      });
    } catch (err) {
      console.error('Error deleting quote line:', err);
      alert(t('common.error'));
    }
  };

  // Handle recalculate quote
  const handleRecalculateQuote = async () => {
    try {
      await recalculateQuote({
        variables: {
          quoteId: quoteId,
          recalculateCosts: true,
          recalculatePricing: true
        }
      });
    } catch (err) {
      console.error('Error recalculating quote:', err);
      alert(t('common.error'));
    }
  };

  // Handle validate margin
  const handleValidateMargin = async () => {
    try {
      const { data } = await validateQuoteMargin({
        variables: { quoteId }
      });

      const validation = data.validateQuoteMargin;
      if (validation.requiresApproval) {
        alert(`${t('salesQuotes.marginValidation.requiresApproval')}: ${validation.approvalLevel}\nMinimum: ${validation.minimumMarginPercentage}%\nActual: ${validation.actualMarginPercentage}%`);
      } else {
        alert(t('salesQuotes.marginValidation.valid'));
      }
    } catch (err) {
      console.error('Error validating margin:', err);
      alert(t('common.error'));
    }
  };

  // Handle update status
  const handleUpdateStatus = async (newStatus: string) => {
    if (!confirm(t('salesQuotes.confirmStatusChange'))) return;

    try {
      await updateQuoteStatus({
        variables: {
          quoteId: quoteId,
          status: newStatus
        }
      });
    } catch (err) {
      console.error('Error updating status:', err);
      alert(t('common.error'));
    }
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-yellow-100 text-yellow-800',
      CONVERTED_TO_ORDER: 'bg-purple-100 text-purple-800'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // Table columns for quote lines
  const lineColumns: ColumnDef<QuoteLine, any>[] = [
    {
      id: 'lineNumber',
      header: t('salesQuotes.lineNumber'),
      accessorKey: 'lineNumber'
    },
    {
      id: 'productCode',
      header: t('salesQuotes.productCode'),
      accessorKey: 'productCode'
    },
    {
      id: 'description',
      header: t('salesQuotes.description'),
      accessorKey: 'description',
      enableSorting: false
    },
    {
      id: 'quantity',
      header: t('salesQuotes.quantity'),
      accessorKey: 'quantityQuoted',
      cell: (info) => `${(info.getValue() as number).toLocaleString()} ${info.row.original.unitOfMeasure}`
    },
    {
      id: 'unitPrice',
      header: t('salesQuotes.unitPrice'),
      accessorKey: 'unitPrice',
      cell: (info) => `$${(info.getValue() as number).toFixed(2)}`
    },
    {
      id: 'lineAmount',
      header: t('salesQuotes.lineAmount'),
      accessorKey: 'lineAmount',
      cell: (info) => `$${(info.getValue() as number).toFixed(2)}`
    },
    {
      id: 'unitCost',
      header: t('salesQuotes.unitCost'),
      accessorKey: 'unitCost',
      cell: (info) => `$${(info.getValue() as number).toFixed(2)}`
    },
    {
      id: 'margin',
      header: t('salesQuotes.margin'),
      accessorKey: 'marginPercentage',
      cell: (info) => {
        const value = info.getValue() as number;
        return (
          <span className={value < 15 ? 'text-red-600 font-semibold' : 'text-green-600'}>
            {value.toFixed(1)}%
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: t('common.actions'),
      accessorKey: 'id',
      enableSorting: false,
      cell: (info) => (
        <button
          onClick={() => handleDeleteQuoteLine(info.getValue() as string)}
          className="text-red-600 hover:text-red-800"
          disabled={quote?.status !== 'DRAFT'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ];

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{t('common.error')}: {error.message}</p>
      </div>
    </div>
  );
  if (!quote) return (
    <div className="p-8">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">{t('salesQuotes.notFound')}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/sales/quotes')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{quote.quoteNumber}</h1>
            {getStatusBadge(quote.status)}
          </div>
          <p className="text-gray-600 mt-2">{quote.customerName}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRecalculateQuote}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={quote.status !== 'DRAFT'}
          >
            <RefreshCw className="w-4 h-4" />
            {t('salesQuotes.recalculate')}
          </button>
          <button
            onClick={handleValidateMargin}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Calculator className="w-4 h-4" />
            {t('salesQuotes.validateMargin')}
          </button>
          {quote.status === 'DRAFT' && (
            <button
              onClick={() => handleUpdateStatus('ISSUED')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
              {t('salesQuotes.issueQuote')}
            </button>
          )}
          {quote.status === 'ISSUED' && (
            <>
              <button
                onClick={() => handleUpdateStatus('ACCEPTED')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                {t('salesQuotes.accept')}
              </button>
              <button
                onClick={() => handleUpdateStatus('REJECTED')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <XCircle className="w-4 h-4" />
                {t('salesQuotes.reject')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quote Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.totalAmount')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${quote.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.totalCost')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${quote.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.marginAmount')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${quote.marginAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('salesQuotes.marginPercentage')}</p>
              <p className={`text-2xl font-bold mt-2 ${quote.marginPercentage < 15 ? 'text-red-600' : 'text-green-600'}`}>
                {quote.marginPercentage.toFixed(1)}%
              </p>
              {quote.marginPercentage < 15 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {t('salesQuotes.lowMarginWarning')}
                </p>
              )}
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${quote.marginPercentage < 15 ? 'bg-red-100' : 'bg-green-100'}`}>
              <TrendingUp className={`w-6 h-6 ${quote.marginPercentage < 15 ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Quote Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('salesQuotes.quoteInformation')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600">{t('salesQuotes.quoteDate')}</p>
            <p className="text-gray-900 mt-1">{new Date(quote.quoteDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{t('salesQuotes.expirationDate')}</p>
            <p className="text-gray-900 mt-1">{new Date(quote.expirationDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{t('salesQuotes.salesRep')}</p>
            <p className="text-gray-900 mt-1">{quote.salesRepName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{t('salesQuotes.contactName')}</p>
            <p className="text-gray-900 mt-1">{quote.contactName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{t('salesQuotes.contactEmail')}</p>
            <p className="text-gray-900 mt-1">{quote.contactEmail}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{t('salesQuotes.contactPhone')}</p>
            <p className="text-gray-900 mt-1">{quote.contactPhone}</p>
          </div>
        </div>
      </div>

      {/* Quote Lines */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('salesQuotes.quoteLines')}</h2>
          {quote.status === 'DRAFT' && (
            <button
              onClick={() => setShowAddLineForm(!showAddLineForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              {t('salesQuotes.addLine')}
            </button>
          )}
        </div>

        {/* Add Line Form */}
        {showAddLineForm && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">{t('salesQuotes.newLine')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('salesQuotes.productCode')}
                </label>
                <input
                  type="text"
                  value={newLine.productCode}
                  onChange={(e) => setNewLine({ ...newLine, productCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('salesQuotes.enterProductCode')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('salesQuotes.quantity')}
                </label>
                <input
                  type="number"
                  value={newLine.quantityQuoted}
                  onChange={(e) => setNewLine({ ...newLine, quantityQuoted: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('salesQuotes.manualPrice')}
                </label>
                <input
                  type="number"
                  value={newLine.unitPrice}
                  onChange={(e) => setNewLine({ ...newLine, unitPrice: parseFloat(e.target.value), manualPriceOverride: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('salesQuotes.autoCalculated')}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleAddQuoteLine}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {t('common.add')}
                </button>
                <button
                  onClick={() => setShowAddLineForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lines Table */}
        <DataTable
          data={quote.lines}
          columns={lineColumns}
        />
      </div>

      {/* Notes */}
      {quote.internalNotes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('salesQuotes.internalNotes')}</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{quote.internalNotes}</p>
        </div>
      )}
    </div>
  );
};

export default SalesQuoteDetailPage;
