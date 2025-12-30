import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { useFacilityStore, useAuthStore } from '../store/appStore';
import { GET_PAYMENTS } from '../graphql/queries/finance';

interface Payment {
  id: string;
  paymentNumber: string;
  paymentType: string;
  customerId?: string;
  vendorId?: string;
  paidByName?: string;
  paymentDate: string;
  currencyCode: string;
  paymentAmount: number;
  paymentMethod: string;
  referenceNumber?: string;
  checkNumber?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export const PaymentProcessingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectedFacility = useFacilityStore((state) => state.selectedFacility);
  const user = useAuthStore((state) => state.user);

  const [filters, setFilters] = useState({
    paymentType: '',
    paymentMethod: '',
    searchTerm: '',
    startDate: '',
    endDate: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_PAYMENTS, {
    variables: {
      tenantId: user?.tenantId,
      paymentType: filters.paymentType || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined
    },
    skip: !user?.tenantId
  });

  const payments: Payment[] = data?.payments || [];

  const filteredPayments = payments.filter((payment) => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        payment.paymentNumber.toLowerCase().includes(searchLower) ||
        payment.paidByName?.toLowerCase().includes(searchLower) ||
        payment.referenceNumber?.toLowerCase().includes(searchLower) ||
        payment.checkNumber?.toLowerCase().includes(searchLower)
      );
    }
    if (filters.paymentMethod && payment.paymentMethod !== filters.paymentMethod) {
      return false;
    }
    return true;
  });

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        return <CreditCard className="w-4 h-4" />;
      case 'CHECK':
        return <CheckCircle className="w-4 h-4" />;
      case 'ACH':
      case 'WIRE_TRANSFER':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { icon: React.ReactNode; color: string } } = {
      UNPAID: { icon: <Clock className="w-3 h-3" />, color: 'bg-gray-100 text-gray-700' },
      PARTIALLY_PAID: { icon: <Clock className="w-3 h-3" />, color: 'bg-yellow-100 text-yellow-700' },
      PAID: { icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-700' },
      OVERPAID: { icon: <CheckCircle className="w-3 h-3" />, color: 'bg-purple-100 text-purple-700' },
      REFUNDED: { icon: <DollarSign className="w-3 h-3" />, color: 'bg-red-100 text-red-700' }
    };

    const config = statusConfig[status] || { icon: null, color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const columns = [
    {
      header: t('Payment #'),
      accessor: 'paymentNumber',
      className: 'font-medium'
    },
    {
      header: t('Type'),
      accessor: 'paymentType',
      render: (value: string) => (
        <span className="text-xs">
          {value === 'CUSTOMER_PAYMENT' ? 'Customer' : value === 'VENDOR_PAYMENT' ? 'Vendor' : value.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: t('Paid By/To'),
      accessor: 'paidByName',
      render: (value: string | undefined) => value || '-'
    },
    {
      header: t('Payment Date'),
      accessor: 'paymentDate',
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    {
      header: t('Method'),
      accessor: 'paymentMethod',
      render: (value: string) => (
        <div className="flex items-center gap-2">
          {getPaymentMethodIcon(value)}
          <span className="text-xs">{value.replace(/_/g, ' ')}</span>
        </div>
      )
    },
    {
      header: t('Reference'),
      accessor: 'referenceNumber',
      render: (value: string | undefined, row: Payment) => value || row.checkNumber || '-'
    },
    {
      header: t('Amount'),
      accessor: 'paymentAmount',
      className: 'text-right',
      render: (value: number, row: Payment) => (
        <span className="font-medium">
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
      header: t('Actions'),
      accessor: 'id',
      className: 'text-right',
      render: (id: string) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => navigate(`/finance/payments/${id}`)}
            className="text-blue-600 hover:text-blue-800 p-1"
            title={t('View Details')}
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const stats = [
    {
      label: t('Total Payments'),
      value: filteredPayments.length,
      icon: <CreditCard className="w-5 h-5" />,
      color: 'text-blue-600'
    },
    {
      label: t('Total Amount'),
      value: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(filteredPayments.reduce((sum, payment) => sum + payment.paymentAmount, 0)),
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-green-600'
    },
    {
      label: t('This Month'),
      value: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(
        filteredPayments
          .filter((payment) => new Date(payment.paymentDate).getMonth() === new Date().getMonth())
          .reduce((sum, payment) => sum + payment.paymentAmount, 0)
      ),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-emerald-600'
    },
    {
      label: t('Completed'),
      value: filteredPayments.filter((payment) => payment.status === 'PAID').length,
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'text-teal-600'
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <Breadcrumb
        items={[
          { label: t('Finance'), href: '/finance' },
          { label: t('Payment Processing'), href: '/finance/payments' }
        ]}
      />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Payment Processing')}</h1>
          <p className="text-gray-600 mt-1">{t('Manage customer payments and vendor payments')}</p>
        </div>
        <button
          onClick={() => navigate('/finance/payments/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('Record Payment')}
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
                placeholder={t('Search payments...')}
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
                {t('Payment Type')}
              </label>
              <select
                value={filters.paymentType}
                onChange={(e) => setFilters({ ...filters, paymentType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('All Types')}</option>
                <option value="CUSTOMER_PAYMENT">{t('Customer Payment')}</option>
                <option value="VENDOR_PAYMENT">{t('Vendor Payment')}</option>
                <option value="REFUND">{t('Refund')}</option>
                <option value="PREPAYMENT">{t('Prepayment')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('Payment Method')}
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('All Methods')}</option>
                <option value="CASH">{t('Cash')}</option>
                <option value="CHECK">{t('Check')}</option>
                <option value="CREDIT_CARD">{t('Credit Card')}</option>
                <option value="DEBIT_CARD">{t('Debit Card')}</option>
                <option value="ACH">{t('ACH')}</option>
                <option value="WIRE_TRANSFER">{t('Wire Transfer')}</option>
                <option value="PAYPAL">{t('PayPal')}</option>
                <option value="OTHER">{t('Other')}</option>
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
            <p className="text-red-600">{t('Error loading payments')}: {error.message}</p>
          </div>
        )}

        {!loading && !error && (
          <DataTable
            data={filteredPayments}
            columns={columns}
            emptyMessage={t('No payments found')}
          />
        )}
      </div>
    </div>
  );
};
