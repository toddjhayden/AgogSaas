import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Shield, Plus, Trash2, DollarSign, Calendar, User } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/common/DataTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAuth } from '../hooks/useAuth';
import {
  GET_USER_APPROVAL_AUTHORITY,
  GRANT_APPROVAL_AUTHORITY,
  REVOKE_APPROVAL_AUTHORITY,
} from '../graphql/queries/approvals';

interface UserApprovalAuthority {
  id: string;
  tenantId: string;
  userId: string;
  approvalLimit: number;
  currencyCode: string;
  roleName?: string;
  effectiveFromDate: string;
  effectiveToDate?: string;
  canDelegate: boolean;
  grantedByUserId?: string;
  grantedAt: string;
  createdAt: string;
  updatedAt?: string;
}

export const ApprovalAuthorityManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenantId, userId } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_USER_APPROVAL_AUTHORITY, {
    variables: {
      tenantId,
      userId,
    },
  });

  const [grantAuthority] = useMutation(GRANT_APPROVAL_AUTHORITY, {
    onCompleted: () => {
      setShowModal(false);
      refetch();
    },
  });

  const [revokeAuthority] = useMutation(REVOKE_APPROVAL_AUTHORITY, {
    onCompleted: () => {
      refetch();
    },
  });

  const authorities: UserApprovalAuthority[] = data?.getUserApprovalAuthority || [];

  const handleRevoke = async (id: string) => {
    if (window.confirm(t('approvals.confirmRevokeAuthority'))) {
      await revokeAuthority({
        variables: {
          id,
          tenantId,
        },
      });
    }
  };

  const handleGrantNew = () => {
    setShowModal(true);
  };

  const columns = useMemo<ColumnDef<UserApprovalAuthority>[]>(
    () => [
      {
        accessorKey: 'roleName',
        header: t('approvals.role'),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-primary-600" />
            <span className="font-medium">{row.original.roleName || t('approvals.noRole')}</span>
          </div>
        ),
      },
      {
        accessorKey: 'approvalLimit',
        header: t('approvals.approvalLimit'),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-bold text-lg">
              {row.original.currencyCode} {row.original.approvalLimit.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'effectiveDates',
        header: t('approvals.effectiveDates'),
        cell: ({ row }) => {
          const from = new Date(row.original.effectiveFromDate).toLocaleDateString();
          const to = row.original.effectiveToDate
            ? new Date(row.original.effectiveToDate).toLocaleDateString()
            : t('approvals.ongoing');
          return (
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm">
                {from} - {to}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'canDelegate',
        header: t('approvals.canDelegate'),
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              row.original.canDelegate
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {row.original.canDelegate ? t('common.yes') : t('common.no')}
          </span>
        ),
      },
      {
        accessorKey: 'grantedAt',
        header: t('approvals.grantedAt'),
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {new Date(row.original.grantedAt).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <button
            onClick={() => handleRevoke(row.original.id)}
            className="inline-flex items-center px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            title={t('approvals.revoke')}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {t('approvals.revoke')}
          </button>
        ),
      },
    ],
    [t]
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">{t('common.error')}: {error.message}</div>;

  const activeAuthorities = authorities.filter((auth) => {
    const now = new Date();
    const from = new Date(auth.effectiveFromDate);
    const to = auth.effectiveToDate ? new Date(auth.effectiveToDate) : null;
    return from <= now && (!to || to >= now);
  });

  const maxLimit = activeAuthorities.length > 0
    ? Math.max(...activeAuthorities.map((a) => a.approvalLimit))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('approvals.authorityManagement')}</h1>
        <Breadcrumb />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.totalAuthorities')}</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{authorities.length}</p>
            </div>
            <Shield className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.activeAuthorities')}</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{activeAuthorities.length}</p>
            </div>
            <User className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.maxApprovalLimit')}</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                ${maxLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleGrantNew}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('approvals.grantAuthority')}
        </button>
      </div>

      {/* Authorities Table */}
      <div className="card">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('approvals.approvalAuthorities')}</h2>
          <DataTable columns={columns} data={authorities} searchable exportable />
        </div>
      </div>

      {/* Grant Authority Modal */}
      {showModal && (
        <GrantAuthorityModal
          tenantId={tenantId}
          grantedByUserId={userId}
          onSave={grantAuthority}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// Modal Component for Granting Authority
interface GrantAuthorityModalProps {
  tenantId: string;
  grantedByUserId: string;
  onSave: (variables: { variables: Record<string, unknown> }) => void;
  onClose: () => void;
}

const GrantAuthorityModal: React.FC<GrantAuthorityModalProps> = ({
  tenantId,
  grantedByUserId,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [targetUserId, setTargetUserId] = useState('');
  const [approvalLimit, setApprovalLimit] = useState<number>(10000);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [roleName, setRoleName] = useState('');
  const [effectiveFromDate, setEffectiveFromDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [effectiveToDate, setEffectiveToDate] = useState('');
  const [canDelegate, setCanDelegate] = useState(true);

  const handleSubmit = () => {
    if (!targetUserId.trim()) {
      alert(t('approvals.userIdRequired'));
      return;
    }

    if (approvalLimit <= 0) {
      alert(t('approvals.approvalLimitPositive'));
      return;
    }

    onSave({
      variables: {
        tenantId,
        userId: targetUserId.trim(),
        approvalLimit,
        currencyCode,
        roleName: roleName.trim() || undefined,
        effectiveFromDate,
        effectiveToDate: effectiveToDate || undefined,
        canDelegate,
        grantedByUserId,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">{t('approvals.grantAuthority')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Shield className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('approvals.userId')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder={t('approvals.userIdPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('approvals.roleName')}
            </label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder="Manager, Director, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.approvalLimit')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={approvalLimit}
                onChange={(e) => setApprovalLimit(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                min="0.01"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.currency')}
              </label>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.effectiveFrom')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={effectiveFromDate}
                onChange={(e) => setEffectiveFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.effectiveTo')}
              </label>
              <input
                type="date"
                value={effectiveToDate}
                onChange={(e) => setEffectiveToDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={canDelegate}
              onChange={(e) => setCanDelegate(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label className="text-sm font-medium text-gray-700">
              {t('approvals.allowDelegation')}
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('approvals.grant')}
          </button>
        </div>
      </div>
    </div>
  );
};
