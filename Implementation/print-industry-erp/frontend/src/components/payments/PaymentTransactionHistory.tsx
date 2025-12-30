/**
 * Payment Transaction History Component
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Displays list of payment gateway transactions
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle, Clock, AlertCircle, CreditCard, Building2 } from 'lucide-react';
import { DataTable } from '../common/DataTable';

interface PaymentTransaction {
  id: string;
  gatewayProvider: string;
  gatewayTransactionId: string;
  transactionType: string;
  amount: number;
  currencyCode: string;
  status: string;
  customerEmail?: string;
  gatewayResponseMessage?: string;
  gatewayFeeAmount?: number;
  netAmount?: number;
  initiatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  errorCode?: string;
}

interface PaymentTransactionHistoryProps {
  transactions: PaymentTransaction[];
  loading?: boolean;
}

const statusIcons: Record<string, React.ReactNode> = {
  SUCCEEDED: <CheckCircle className="h-5 w-5 text-green-500" />,
  FAILED: <XCircle className="h-5 w-5 text-red-500" />,
  PENDING: <Clock className="h-5 w-5 text-yellow-500" />,
  PROCESSING: <Clock className="h-5 w-5 text-blue-500" />,
  CANCELED: <XCircle className="h-5 w-5 text-gray-500" />,
  REFUNDED: <AlertCircle className="h-5 w-5 text-orange-500" />,
};

const statusColors: Record<string, string> = {
  SUCCEEDED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  CANCELED: 'bg-gray-100 text-gray-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
  DISPUTED: 'bg-purple-100 text-purple-800',
};

export const PaymentTransactionHistory: React.FC<PaymentTransactionHistoryProps> = ({
  transactions,
  loading = false,
}) => {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<PaymentTransaction>[]>(
    () => [
      {
        accessorKey: 'initiatedAt',
        header: t('payments.date'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-gray-900">
              {new Date(row.original.initiatedAt).toLocaleDateString()}
            </div>
            <div className="text-sm text-gray-500">
              {new Date(row.original.initiatedAt).toLocaleTimeString()}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'gatewayTransactionId',
        header: t('payments.transactionId'),
        cell: ({ row }) => (
          <div>
            <div className="font-mono text-sm text-gray-900">
              {row.original.gatewayTransactionId}
            </div>
            <div className="text-xs text-gray-500 flex items-center mt-1">
              {row.original.gatewayProvider === 'STRIPE' ? (
                <>
                  <CreditCard className="h-3 w-3 mr-1" />
                  Stripe
                </>
              ) : (
                <>
                  <Building2 className="h-3 w-3 mr-1" />
                  {row.original.gatewayProvider}
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'transactionType',
        header: t('payments.type'),
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {t(`payments.types.${row.original.transactionType}`)}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('payments.amount'),
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-gray-900">
              {row.original.currencyCode} {row.original.amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            {row.original.gatewayFeeAmount !== undefined && row.original.gatewayFeeAmount > 0 && (
              <div className="text-xs text-gray-500">
                {t('payments.fee')}: {row.original.currencyCode} {row.original.gatewayFeeAmount.toFixed(2)}
              </div>
            )}
            {row.original.netAmount !== undefined && (
              <div className="text-xs text-gray-600 font-medium">
                {t('payments.net')}: {row.original.currencyCode} {row.original.netAmount.toFixed(2)}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('payments.status'),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            {statusIcons[row.original.status] || <AlertCircle className="h-5 w-5 text-gray-400" />}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                statusColors[row.original.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {t(`payments.statuses.${row.original.status}`)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'customerEmail',
        header: t('payments.customer'),
        cell: ({ row }) => (
          <div className="text-sm text-gray-900">
            {row.original.customerEmail || '-'}
          </div>
        ),
      },
      {
        id: 'details',
        header: t('payments.details'),
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.status === 'SUCCEEDED' && row.original.gatewayResponseMessage && (
              <div className="text-green-600">{row.original.gatewayResponseMessage}</div>
            )}
            {row.original.status === 'FAILED' && row.original.errorMessage && (
              <div className="text-red-600">{row.original.errorMessage}</div>
            )}
            {row.original.completedAt && (
              <div className="text-xs text-gray-500 mt-1">
                {t('payments.completed')}: {new Date(row.original.completedAt).toLocaleString()}
              </div>
            )}
          </div>
        ),
      },
    ],
    [t]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('payments.transactionHistory')}
        </h3>
        <div className="text-sm text-gray-500">
          {transactions.length} {t('payments.transactions')}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={transactions}
        loading={loading}
        emptyMessage={t('payments.noTransactions')}
      />
    </div>
  );
};
