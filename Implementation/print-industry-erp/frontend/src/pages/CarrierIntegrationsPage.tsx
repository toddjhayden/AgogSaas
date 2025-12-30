import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Truck, CheckCircle, XCircle, Settings, AlertCircle } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/common/DataTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { GET_CARRIER_INTEGRATIONS } from '../graphql/queries/shipping';
import { UPDATE_CARRIER_INTEGRATION } from '../graphql/mutations/shipping';

interface CarrierIntegration {
  id: string;
  carrierCode: string;
  carrierName: string;
  carrierType: string;
  apiEndpoint?: string;
  apiVersion?: string;
  accountNumber?: string;
  credentialsConfigured: boolean;
  supportsTracking: boolean;
  supportsRateQuotes: boolean;
  supportsLabelGeneration: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

const carrierTypeColors: Record<string, string> = {
  PARCEL: 'bg-blue-100 text-blue-800',
  LTL: 'bg-purple-100 text-purple-800',
  FTL: 'bg-green-100 text-green-800',
  COURIER: 'bg-yellow-100 text-yellow-800',
  THREE_PL: 'bg-indigo-100 text-indigo-800',
  FREIGHT_FORWARDER: 'bg-pink-100 text-pink-800',
};

export const CarrierIntegrationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierIntegration | null>(null);

  const tenantId = '1';

  const { data, loading, error, refetch } = useQuery(GET_CARRIER_INTEGRATIONS, {
    variables: { tenantId },
  });

  const [updateCarrier, { loading: updating }] = useMutation(UPDATE_CARRIER_INTEGRATION, {
    onCompleted: () => {
      refetch();
      setSelectedCarrier(null);
    },
    onError: (error) => {
      alert(t('shipping.carriers.updateError', { error: error.message }));
    },
  });

  const columns = useMemo<ColumnDef<CarrierIntegration>[]>(
    () => [
      {
        accessorKey: 'carrierName',
        header: t('shipping.carriers.carrierName'),
        cell: ({ row }) => (
          <div className="flex items-center">
            <Truck className="h-5 w-5 text-primary-600 mr-3" />
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{row.original.carrierName}</span>
              <span className="text-xs text-gray-500">{row.original.carrierCode}</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'carrierType',
        header: t('shipping.carriers.carrierType'),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              carrierTypeColors[row.original.carrierType] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {t(`shipping.carriers.types.${row.original.carrierType}`)}
          </span>
        ),
      },
      {
        accessorKey: 'accountNumber',
        header: t('shipping.carriers.accountNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.accountNumber || '-'}</span>
        ),
      },
      {
        accessorKey: 'credentials',
        header: t('shipping.carriers.credentials'),
        cell: ({ row }) => (
          <div className="flex items-center">
            {row.original.credentialsConfigured ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-600">{t('shipping.carriers.configured')}</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600 mr-2" />
                <span className="text-sm text-red-600">
                  {t('shipping.carriers.notConfigured')}
                </span>
              </>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'features',
        header: t('shipping.carriers.features'),
        cell: ({ row }) => (
          <div className="flex flex-col space-y-1">
            {row.original.supportsTracking && (
              <span className="text-xs text-gray-600">
                ✓ {t('shipping.carriers.tracking')}
              </span>
            )}
            {row.original.supportsRateQuotes && (
              <span className="text-xs text-gray-600">
                ✓ {t('shipping.carriers.rateQuotes')}
              </span>
            )}
            {row.original.supportsLabelGeneration && (
              <span className="text-xs text-gray-600">
                ✓ {t('shipping.carriers.labelGeneration')}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('shipping.carriers.status'),
        cell: ({ row }) => (
          <div className="flex items-center">
            {row.original.isActive ? (
              <>
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-900">{t('shipping.carriers.active')}</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 bg-gray-400 rounded-full mr-2"></div>
                <span className="text-sm text-gray-500">{t('shipping.carriers.inactive')}</span>
              </>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <button
            onClick={() => setSelectedCarrier(row.original)}
            className="text-primary-600 hover:text-primary-800"
          >
            <Settings className="h-4 w-4" />
          </button>
        ),
      },
    ],
    [t]
  );

  const handleToggleActive = (carrier: CarrierIntegration) => {
    updateCarrier({
      variables: {
        id: carrier.id,
        input: {
          isActive: !carrier.isActive,
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
          <div>
            <h3 className="text-red-800 font-medium">{t('common.error')}</h3>
            <p className="text-red-600 text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const carriers = data?.carrierIntegrations || [];

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: t('nav.wms'), path: '/wms' },
          { label: t('nav.carrierIntegrations'), path: '/wms/carrier-integrations' },
        ]}
      />

      <div className="mt-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('shipping.carriers.carrierIntegrations')}
            </h1>
            <p className="text-gray-600 mt-1">{t('shipping.carriers.description')}</p>
          </div>
        </div>

        {/* Carrier Integrations Table */}
        <div className="bg-white rounded-lg shadow">
          <DataTable columns={columns} data={carriers} />
        </div>

        {carriers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow mt-6">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('shipping.carriers.noCarriers')}
            </h3>
            <p className="text-gray-600">{t('shipping.carriers.noCarriersDescription')}</p>
          </div>
        )}
      </div>

      {/* Carrier Detail Modal */}
      {selectedCarrier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedCarrier.carrierName}</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedCarrier.carrierCode}</p>
              </div>
              <button
                onClick={() => setSelectedCarrier(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Carrier Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('shipping.carriers.carrierType')}
                </label>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    carrierTypeColors[selectedCarrier.carrierType] || 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {t(`shipping.carriers.types.${selectedCarrier.carrierType}`)}
                </span>
              </div>

              {/* API Configuration */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  {t('shipping.carriers.apiConfiguration')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t('shipping.carriers.apiEndpoint')}
                    </label>
                    <p className="text-sm text-gray-900 font-mono">
                      {selectedCarrier.apiEndpoint || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t('shipping.carriers.apiVersion')}
                    </label>
                    <p className="text-sm text-gray-900">{selectedCarrier.apiVersion || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t('shipping.carriers.accountNumber')}
                    </label>
                    <p className="text-sm text-gray-900 font-mono">
                      {selectedCarrier.accountNumber || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      {t('shipping.carriers.credentials')}
                    </label>
                    <div className="flex items-center">
                      {selectedCarrier.credentialsConfigured ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                          <span className="text-sm text-green-600">
                            {t('shipping.carriers.configured')}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-600 mr-2" />
                          <span className="text-sm text-red-600">
                            {t('shipping.carriers.notConfigured')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  {t('shipping.carriers.supportedFeatures')}
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center">
                    {selectedCarrier.supportsTracking ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <span
                      className={
                        selectedCarrier.supportsTracking ? 'text-gray-900' : 'text-gray-400'
                      }
                    >
                      {t('shipping.carriers.tracking')}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {selectedCarrier.supportsRateQuotes ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <span
                      className={
                        selectedCarrier.supportsRateQuotes ? 'text-gray-900' : 'text-gray-400'
                      }
                    >
                      {t('shipping.carriers.rateQuotes')}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {selectedCarrier.supportsLabelGeneration ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <span
                      className={
                        selectedCarrier.supportsLabelGeneration ? 'text-gray-900' : 'text-gray-400'
                      }
                    >
                      {t('shipping.carriers.labelGeneration')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {t('shipping.carriers.carrierStatus')}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedCarrier.isActive
                        ? t('shipping.carriers.activeDescription')
                        : t('shipping.carriers.inactiveDescription')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleActive(selectedCarrier)}
                    disabled={updating}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      selectedCarrier.isActive
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:bg-gray-400`}
                  >
                    {updating
                      ? t('common.updating')
                      : selectedCarrier.isActive
                      ? t('shipping.carriers.deactivate')
                      : t('shipping.carriers.activate')}
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="border-t pt-4 text-xs text-gray-500">
                <p>
                  {t('common.createdAt')}: {new Date(selectedCarrier.createdAt).toLocaleString()}
                </p>
                {selectedCarrier.updatedAt && (
                  <p className="mt-1">
                    {t('common.updatedAt')}:{' '}
                    {new Date(selectedCarrier.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
