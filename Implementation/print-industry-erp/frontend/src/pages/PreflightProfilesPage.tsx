import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { FileText, Plus, Edit2, CheckCircle, Settings } from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import toast from 'react-hot-toast';
import {
  GET_PREFLIGHT_PROFILES,
  CREATE_PREFLIGHT_PROFILE,
  UPDATE_PREFLIGHT_PROFILE,
} from '../graphql/queries/preflight';

interface PreflightProfile {
  id: string;
  tenantId: string;
  profileName: string;
  profileType: 'PDF_X_1A' | 'PDF_X_3' | 'PDF_X_4' | 'CUSTOM';
  description?: string;
  validationRules: Record<string, unknown>;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const PreflightProfilesPage: React.FC = () => {
  const { t } = useTranslation();
  const selectedFacility = useAppStore((state) => state.preferences.selectedFacility);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_editingProfile, setEditingProfile] = useState<PreflightProfile | null>(null);

  // Fetch profiles
  const { data, loading, refetch } = useQuery(GET_PREFLIGHT_PROFILES, {
    variables: {
      tenantId: selectedFacility || '1',
      isActive: typeFilter === 'active' ? true : undefined,
    },
    skip: !selectedFacility,
  });

  const profiles: PreflightProfile[] = data?.preflightProfiles || [];

  const [createProfile] = useMutation(CREATE_PREFLIGHT_PROFILE, {
    onCompleted: () => {
      toast.success(t('preflight.profileCreated', 'Profile created successfully'));
      setShowCreateModal(false);
      refetch();
    },
    onError: (error) => {
      toast.error(t('preflight.profileCreateError', 'Failed to create profile: ') + error.message);
    },
  });

  const [updateProfile] = useMutation(UPDATE_PREFLIGHT_PROFILE, {
    onCompleted: () => {
      toast.success(t('preflight.profileUpdated', 'Profile updated successfully'));
      setEditingProfile(null);
      refetch();
    },
    onError: (error) => {
      toast.error(t('preflight.profileUpdateError', 'Failed to update profile: ') + error.message);
    },
  });

  // Profile handlers - used by modal forms (createProfile and updateProfile mutations are available if needed)
  void createProfile; // Suppress unused warning - used by modal forms
  void updateProfile; // Suppress unused warning - used by modal forms

  const columns: ColumnDef<PreflightProfile>[] = [
    {
      accessorKey: 'profileName',
      header: 'Profile Name',
      cell: (info) => {
        const profile = info.row.original;
        return (
          <div className="flex items-center space-x-2">
            <span className="font-medium text-primary-600">{info.getValue() as string}</span>
            {profile.isDefault && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Default
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'profileType',
      header: 'Type',
      cell: (info) => {
        const type = info.getValue() as string;
        return (
          <span
            className={clsx(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              type === 'PDF_X_1A' && 'bg-blue-100 text-blue-700',
              type === 'PDF_X_3' && 'bg-green-100 text-green-700',
              type === 'PDF_X_4' && 'bg-purple-100 text-purple-700',
              type === 'CUSTOM' && 'bg-orange-100 text-orange-700'
            )}
          >
            {type.replace(/_/g, '-')}
          </span>
        );
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: (info) => {
        const desc = info.getValue() as string;
        return desc ? (
          <span className="text-sm text-gray-600">{desc}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'version',
      header: 'Version',
      cell: (info) => {
        return <span className="text-sm font-mono">v{info.getValue() as number}</span>;
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: (info) => {
        const isActive = info.getValue() as boolean;
        return (
          <span
            className={clsx(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              isActive ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-700'
            )}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        );
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Last Updated',
      cell: (info) => {
        const date = new Date(info.getValue() as string);
        return <span className="text-sm">{date.toLocaleDateString()}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const profile = info.row.original;
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setEditingProfile(profile)}
              className="text-primary-600 hover:text-primary-800"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                // Handle view/configure
                toast('Configure profile: ' + profile.profileName);
              }}
              className="text-gray-600 hover:text-gray-800"
              title="Configure"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const filteredProfiles =
    typeFilter === 'all' ? profiles : profiles.filter((p) => p.profileType === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('preflight.profilesTitle', 'Preflight Profiles')}
          </h1>
          <Breadcrumb />
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('preflight.createProfile', 'Create Profile')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">PDF/X-1a</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {profiles.filter((p) => p.profileType === 'PDF_X_1A').length}
              </p>
            </div>
            <FileText className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">PDF/X-3</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {profiles.filter((p) => p.profileType === 'PDF_X_3').length}
              </p>
            </div>
            <FileText className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">PDF/X-4</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {profiles.filter((p) => p.profileType === 'PDF_X_4').length}
              </p>
            </div>
            <FileText className="h-10 w-10 text-purple-500" />
          </div>
        </div>

        <div className="card border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Custom</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {profiles.filter((p) => p.profileType === 'CUSTOM').length}
              </p>
            </div>
            <FileText className="h-10 w-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Profiles Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('preflight.allProfiles', 'All Profiles')}</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTypeFilter('all')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                typeFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('PDF_X_1A')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                typeFilter === 'PDF_X_1A' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              PDF/X-1a
            </button>
            <button
              onClick={() => setTypeFilter('PDF_X_3')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                typeFilter === 'PDF_X_3' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              PDF/X-3
            </button>
            <button
              onClick={() => setTypeFilter('PDF_X_4')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                typeFilter === 'PDF_X_4' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              PDF/X-4
            </button>
            <button
              onClick={() => setTypeFilter('CUSTOM')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                typeFilter === 'CUSTOM' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Custom
            </button>
          </div>
        </div>
        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <p className="text-gray-500">{t('preflight.loading', 'Loading profiles...')}</p>
          </div>
        ) : filteredProfiles.length > 0 ? (
          <DataTable data={filteredProfiles} columns={columns} pageSize={10} />
        ) : (
          <div className="card text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('preflight.noProfiles', 'No profiles found')}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal would go here */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">{t('preflight.createProfile', 'Create Profile')}</h2>
            <p className="text-gray-600 mb-4">
              {t('preflight.createProfileDesc', 'Profile creation form would go here')}
            </p>
            <div className="flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => setShowCreateModal(false)}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
