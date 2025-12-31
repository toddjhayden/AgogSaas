import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { GET_INVOICES, VOID_INVOICE } from '../graphql/queries/finance';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  customerId?: string;
  vendorId?: string;
  billToName: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  paymentStatus: string;
  paymentTerms?: string;
  purchaseOrderNumber?: string;
  notes?: string;
  createdAt: string;
}

export const InvoiceManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useAppStore(); // Facility context
  const user = useAuthStore((state: { user: any }) => state.user);

  const [filters, setFilters] = useState({
    invoiceType: '',
    status: '',
    searchTerm: '',
    startDate: '',
    endDate: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_INVOICES, {
    variables: {
      tenantId: user?.tenantId,
      invoiceType: filters.invoiceType || undefined,
      status: filters.status || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      limit: 100,
      offset: 0
    },
    skip: !user?.tenantId
  });

  const [voidInvoice] = useMutation(VOID_INVOICE, {
    onCompleted: () => {
      refetch();
      alert(t('Invoice voided successfully'));
    },
    onError: (error) => {
      alert(t('Failed to void invoice: ') + error.message);
    }
  });

  const invoices: Invoice[] = data?.invoices || [];

  const filteredInvoices = invoices.filter((invoice) => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
        invoice.billToName.toLowerCase().includes(searchLower) ||
        invoice.purchaseOrderNumber?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { icon: React.ReactNode; color: string } } = {
      DRAFT: { icon: <Edit className="w-3 h-3" />, color: 'bg-gray-100 text-gray-700' },
      ISSUED: { icon: <FileText className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700' },
      SENT: { icon: <CheckCircle className="w-3 h-3" />, color: 'bg-cyan-100 text-cyan-700' },
      PARTIALLY_PAID: { icon: <Clock className="w-3 h-3" />, color: 'bg-yellow-100 text-yellow-700' },
      PAID: { icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-700' },
      OVERDUE: { icon: <XCircle className="w-3 h-3" />, color: 'bg-red-100 text-red-700' },
      CANCELLED: { icon: <Ban className="w-3 h-3" />, color: 'bg-gray-100 text-gray-500' },
      VOID: { icon: <Ban className="w-3 h-3" />, color: 'bg-gray-100 text-gray-500' }
    };

    const config = statusConfig[status] || { icon: null, color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const statusConfig: { [key: string]: { color: string } } = {
      UNPAID: { color: 'bg-gray-100 text-gray-700' },
      PARTIALLY_PAID: { color: 'bg-yellow-100 text-yellow-700' },
      PAID: { color: 'bg-green-100 text-green-700' },
      OVERPAID: { color: 'bg-purple-100 text-purple-700' },
      REFUNDED: { color: 'bg-red-100 text-red-700' }
    };

    const config = statusConfig[paymentStatus] || { color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {paymentStatus.replace(/_/g, ' ')}
      </span>
    );
  };

  const handleVoidInvoice = async (invoiceId: string) => {
    if (!confirm(t('Are you sure you want to void this invoice? This action will reverse the GL posting.'))) {
      return;
    }

    try {
      await voidInvoice({ variables: { id: invoiceId } });
    } catch (err) {
      console.error('Error voiding invoice:', err);
    }
  };

  const columns = [
    {
      header: t('Invoice #'),
      accessor: 'invoiceNumber',
      className: 'font-medium'
    },
    {
      header: t('Type'),
      accessor: 'invoiceType',
      render: (value: string) => (
        <span className="text-xs">
          {value === 'CUSTOMER_INVOICE' ? 'Customer' : value === 'VENDOR_INVOICE' ? 'Vendor' : value.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: t('Customer/Vendor'),
      accessor: 'billToName'
    },
    {
      header: t('Invoice Date'),
      accessor: 'invoiceDate',
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    {
      header: t('Due Date'),
      accessor: 'dueDate',
      render: (value: string) => {
        const dueDate = new Date(value);
        const today = new Date();
        const isOverdue = dueDate < today;
        return (
          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
            {dueDate.toLocaleDateString()}
          </span>
        );
      }
    },
    {
      header: t('Total Amount'),
      accessor: 'totalAmount',
      className: 'text-right',
      render: (value: number, row: Invoice) => (
        <span className="font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: row.currencyCode || 'USD'
          }).format(value)}
        </span>
      )
    },
    {
      header: t('Balance Due'),
      accessor: 'balanceDue',
      className: 'text-right',
      render: (value: number, row: Invoice) => (
        <span className={value > 0 ? 'font-medium text-red-600' : 'text-gray-500'}>
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: row.currencyCode || 'USD'
          }).format(value)}
        </span>
      )
    },
    {
      header: t('Status'),
      accessor: 'status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      header: t('Payment'),
      accessor: 'paymentStatus',
      render: (value: string) => getPaymentStatusBadge(value)
    },
    {
      header: t('Actions'),
      accessor: 'id',
      className: 'text-right',
      render: (id: string, row: Invoice) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => navigate(`/finance/invoices/${id}`)}
            className="text-blue-600 hover:text-blue-800 p-1"
            title={t('View Details')}
          >
            <Eye className="w-4 h-4" />
          </button>
          {row.status === 'DRAFT' && (
            <button
              onClick={() => navigate(`/finance/invoices/${id}/edit`)}
              className="text-indigo-600 hover:text-indigo-800 p-1"
              title={t('Edit')}
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {row.status !== 'VOID' && row.status !== 'CANCELLED' && row.paidAmount === 0 && (
            <button
              onClick={() => handleVoidInvoice(id)}
              className="text-red-600 hover:text-red-800 p-1"
              title={t('Void Invoice')}
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  const stats = [
    {
      label: t('Total Invoices'),
      value: filteredInvoices.length,
      icon: <FileText className="w-5 h-5" />,
      color: 'text-blue-600'
    },
    {
      label: t('Total Outstanding'),
      value: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(filteredInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0)),
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-green-600'
    },
    {
      label: t('Overdue'),
      value: filteredInvoices.filter(
        (inv) => new Date(inv.dueDate) < new Date() && inv.balanceDue > 0
      ).length,
      icon: <XCircle className="w-5 h-5" />,
      color: 'text-red-600'
    },
    {
      label: t('Paid This Month'),
      value: filteredInvoices.filter(
        (inv) => inv.paymentStatus === 'PAID' && new Date(inv.createdAt).getMonth() === new Date().getMonth()
      ).length,
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'text-emerald-600'
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <Breadcrumb
        items={[
          { label: t('Finance'), path: '/finance' },
          { label: t('Invoice Management'), path: '/finance/invoices' }
        ]}
      />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Invoice Management')}</h1>
          <p className="text-gray-600 mt-1">{t('Manage customer invoices and vendor bills')}</p>
        </div>
        <button
          onClick={() => navigate('/finance/invoices/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('Create Invoice')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={stat.color}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('Search invoices...')}
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-5 h-5" />
            {t('Filters')}
          </button>
          <button
            onClick={() => alert('Export functionality coming soon')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-5 h-5" />
            {t('Export')}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('Invoice Type')}
              </label>
              <select
                value={filters.invoiceType}
                onChange={(e) => setFilters({ ...filters, invoiceType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('All Types')}</option>
                <option value="CUSTOMER_INVOICE">{t('Customer Invoice')}</option>
                <option value="VENDOR_INVOICE">{t('Vendor Bill')}</option>
                <option value="CREDIT_MEMO">{t('Credit Memo')}</option>
                <option value="DEBIT_MEMO">{t('Debit Memo')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('Status')}
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('All Statuses')}</option>
                <option value="DRAFT">{t('Draft')}</option>
                <option value="ISSUED">{t('Issued')}</option>
                <option value="SENT">{t('Sent')}</option>
                <option value="PARTIALLY_PAID">{t('Partially Paid')}</option>
                <option value="PAID">{t('Paid')}</option>
                <option value="OVERDUE">{t('Overdue')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('Start Date')}
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('End Date')}
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {loading && (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="p-12 text-center">
            <p className="text-red-600">{t('Error loading invoices')}: {error.message}</p>
          </div>
        )}

        {!loading && !error && (
          <DataTable
            data={filteredInvoices}
            columns={columns}
            emptyMessage={t('No invoices found')}
          />
        )}
      </div>
    </div>
  );
};
