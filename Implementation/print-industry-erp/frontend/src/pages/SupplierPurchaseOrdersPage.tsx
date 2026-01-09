/**
 * Supplier Purchase Orders Page
 * REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal
 *
 * List view of purchase orders for authenticated supplier with:
 * - Filtering by status and date range
 * - Search by PO number
 * - Pagination
 * - Quick actions (acknowledge, create ASN)
 */

import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  FileText,
  AlertCircle,
  CheckCircle,
  Package,
  Download,
} from 'lucide-react';
import { GET_SUPPLIER_PURCHASE_ORDERS } from '../graphql/queries/supplierPortal';
import { DataTable } from '../components/common/DataTable';

const SupplierPurchaseOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const { data, loading, error } = useQuery(GET_SUPPLIER_PURCHASE_ORDERS, {
    variables: {
      status: statusFilter.length > 0 ? statusFilter : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: rowsPerPage,
      offset: page * rowsPerPage,
    },
    pollInterval: 60000, // Refresh every minute
  });

  const purchaseOrders = data?.supplierPurchaseOrders?.nodes || [];
  const totalCount = data?.supplierPurchaseOrders?.totalCount || 0;

  // Format currency
  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT_TO_VENDOR':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACKNOWLEDGED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_TRANSIT':
        return 'bg-indigo-100 text-indigo-800';
      case 'PARTIALLY_RECEIVED':
        return 'bg-purple-100 text-purple-800';
      case 'RECEIVED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter purchase orders by search term
  const filteredPOs = searchTerm
    ? purchaseOrders.filter((po: unknown) =>
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : purchaseOrders;

  // Handle status filter toggle
  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    setPage(0); // Reset to first page
  };

  // Table columns
  const columns = [
    {
      id: 'poNumber',
      label: t('supplierPortal.purchaseOrders.poNumber'),
      render: (row: unknown) => (
        <button
          onClick={() => navigate(`/supplier/purchase-orders/${row.poNumber}`)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {row.poNumber}
        </button>
      ),
    },
    {
      id: 'poDate',
      label: t('supplierPortal.purchaseOrders.date'),
      render: (row: unknown) => new Date(row.poDate).toLocaleDateString(),
    },
    {
      id: 'requestedDeliveryDate',
      label: t('supplierPortal.purchaseOrders.deliveryDate'),
      render: (row: unknown) =>
        row.requestedDeliveryDate
          ? new Date(row.requestedDeliveryDate).toLocaleDateString()
          : 'N/A',
    },
    {
      id: 'lineCount',
      label: t('supplierPortal.purchaseOrders.lineCount'),
      render: (row: unknown) => (
        <span className="text-gray-900">{row.lineCount} lines</span>
      ),
    },
    {
      id: 'totalAmount',
      label: t('supplierPortal.purchaseOrders.amount'),
      render: (row: unknown) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(row.totalAmount, row.currency)}
        </span>
      ),
    },
    {
      id: 'status',
      label: t('common.status'),
      render: (row: unknown) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
            row.status
          )}`}
        >
          {row.status.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      id: 'acknowledged',
      label: t('supplierPortal.purchaseOrders.acknowledged'),
      render: (row: unknown) =>
        row.isAcknowledged ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-yellow-500" />
        ),
    },
    {
      id: 'asn',
      label: t('supplierPortal.asn.title'),
      render: (row: unknown) =>
        row.hasASN ? (
          <Package className="h-5 w-5 text-blue-500" />
        ) : (
          <span className="text-gray-400 text-xs">None</span>
        ),
    },
    {
      id: 'actions',
      label: t('common.actions'),
      render: (row: unknown) => (
        <div className="flex items-center space-x-2">
          {!row.isAcknowledged && (
            <button
              onClick={() =>
                navigate(`/supplier/purchase-orders/${row.poNumber}/acknowledge`)
              }
              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
            >
              {t('supplierPortal.purchaseOrders.acknowledge')}
            </button>
          )}
          {row.isAcknowledged && !row.hasASN && (
            <button
              onClick={() => navigate(`/supplier/asn/create?po=${row.poNumber}`)}
              className="text-green-600 hover:text-green-900 text-sm font-medium"
            >
              {t('supplierPortal.asn.create')}
            </button>
          )}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <p className="text-sm text-red-700">
              {t('error.loadingPurchaseOrders')}
            </p>
            <p className="text-xs text-red-600 mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('supplierPortal.purchaseOrders.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('supplierPortal.purchaseOrders.subtitle')}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('common.export')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={t('supplierPortal.purchaseOrders.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* From Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.fromDate')}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.toDate')}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter([]);
                setFromDate('');
                setToDate('');
                setPage(0);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {t('common.clearFilters')}
            </button>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            'SENT_TO_VENDOR',
            'ACKNOWLEDGED',
            'IN_TRANSIT',
            'PARTIALLY_RECEIVED',
            'RECEIVED',
            'CLOSED',
          ].map((status) => (
            <button
              key={status}
              onClick={() => toggleStatusFilter(status)}
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                statusFilter.includes(status)
                  ? getStatusColor(status)
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.purchaseOrders.total')}
              </p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.purchaseOrders.pendingAcknowledgment')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {
                  purchaseOrders.filter((po: unknown) => !po.isAcknowledged).length
                }
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.purchaseOrders.acknowledged')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {purchaseOrders.filter((po: unknown) => po.isAcknowledged).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-indigo-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                {t('supplierPortal.asn.withASN')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {purchaseOrders.filter((po: unknown) => po.hasASN).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={filteredPOs}
          loading={loading}
          page={page}
          rowsPerPage={rowsPerPage}
          totalCount={totalCount}
          onPageChange={setPage}
          onRowsPerPageChange={(newRowsPerPage: number) => {
            setRowsPerPage(newRowsPerPage);
            setPage(0);
          }}
        />
      </div>
    </div>
  );
};

export default SupplierPurchaseOrdersPage;
