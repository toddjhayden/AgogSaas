import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Package,
  Activity,
  Shield,
  XCircle,
  MapPin,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import {
  GET_DATA_QUALITY_METRICS,
  GET_CAPACITY_VALIDATION_FAILURES,
  GET_CROSS_DOCK_CANCELLATIONS,
  RESOLVE_CAPACITY_FAILURE,
  COMPLETE_CROSS_DOCK_RELOCATION,
} from '../graphql/queries/wmsDataQuality';

/**
 * Bin Optimization Data Quality Dashboard
 * REQ-STRATEGIC-AUTO-1766545799451
 * Author: Jen (Frontend Developer)
 *
 * Features:
 * - Data quality metrics visualization
 * - Capacity validation failure tracking and resolution
 * - Cross-dock cancellation management
 * - Dimension verification insights
 * - Auto-remediation monitoring
 */

// TypeScript interfaces
interface DataQualityMetrics {
  facilityId: string;
  facilityName: string;
  materialsVerifiedCount: number;
  materialsWithVariance: number;
  avgCubicFeetVariancePct: number;
  avgWeightVariancePct: number;
  capacityFailuresCount: number;
  unresolvedFailuresCount: number;
  crossdockCancellationsCount: number;
  pendingRelocationsCount: number;
  autoRemediationCount: number;
  failedRemediationCount: number;
}

interface CapacityValidationFailure {
  failureId: string;
  locationId: string;
  locationCode: string;
  materialId: string;
  materialCode: string;
  lotNumber?: string;
  requiredCubicFeet: number;
  availableCubicFeet: number;
  requiredWeightLbs: number;
  availableWeightLbs: number;
  failureType: 'CUBIC_FEET_EXCEEDED' | 'WEIGHT_EXCEEDED' | 'BOTH_EXCEEDED';
  cubicFeetOverflowPct: number;
  weightOverflowPct: number;
  alertSent: boolean;
  resolved: boolean;
  createdAt: string;
}

interface CrossDockCancellation {
  cancellationId: string;
  materialId: string;
  materialCode: string;
  lotNumber: string;
  cancellationReason: string;
  newRecommendedLocationId?: string;
  newRecommendedLocationCode?: string;
  relocationCompleted: boolean;
  cancelledAt: string;
  cancelledBy: string;
  notes?: string;
}

export const BinDataQualityDashboard: React.FC = () => {
  const [selectedFacility] = useState<string | undefined>(undefined);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [selectedFailureId, setSelectedFailureId] = useState<string | null>(null);

  // Fetch data quality metrics
  const {
    data: metricsData,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery<{ getDataQualityMetrics: DataQualityMetrics[] }>(
    GET_DATA_QUALITY_METRICS,
    {
      variables: { facilityId: selectedFacility },
      pollInterval: 60000, // Refresh every minute
    }
  );

  // Fetch capacity validation failures (unresolved)
  const {
    data: failuresData,
    loading: failuresLoading,
    refetch: refetchFailures,
  } = useQuery<{ getCapacityValidationFailures: CapacityValidationFailure[] }>(
    GET_CAPACITY_VALIDATION_FAILURES,
    {
      variables: {
        facilityId: selectedFacility,
        resolved: false,
        limit: 50,
      },
      pollInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Fetch cross-dock cancellations (pending relocation)
  const {
    data: cancellationsData,
    loading: cancellationsLoading,
    refetch: refetchCancellations,
  } = useQuery<{ getCrossDockCancellations: CrossDockCancellation[] }>(
    GET_CROSS_DOCK_CANCELLATIONS,
    {
      variables: {
        facilityId: selectedFacility,
        relocationCompleted: false,
        limit: 50,
      },
      pollInterval: 60000, // Refresh every minute
    }
  );

  // Mutations
  const [resolveFailure, { loading: resolvingFailure }] = useMutation(
    RESOLVE_CAPACITY_FAILURE,
    {
      onCompleted: () => {
        alert('Capacity failure resolved successfully!');
        setSelectedFailureId(null);
        setResolutionNotes('');
        refetchFailures();
        refetchMetrics();
      },
      onError: (error) => {
        alert(`Failed to resolve capacity failure: ${error.message}`);
      },
    }
  );

  const [completeRelocation, { loading: completingRelocation }] = useMutation(
    COMPLETE_CROSS_DOCK_RELOCATION,
    {
      onCompleted: () => {
        alert('Cross-dock relocation marked as completed!');
        refetchCancellations();
        refetchMetrics();
      },
      onError: (error) => {
        alert(`Failed to complete relocation: ${error.message}`);
      },
    }
  );

  // Data processing
  const metrics = metricsData?.getDataQualityMetrics || [];
  const aggregatedMetrics = metrics.reduce(
    (acc, metric) => ({
      materialsVerifiedCount: acc.materialsVerifiedCount + metric.materialsVerifiedCount,
      materialsWithVariance: acc.materialsWithVariance + metric.materialsWithVariance,
      capacityFailuresCount: acc.capacityFailuresCount + metric.capacityFailuresCount,
      unresolvedFailuresCount: acc.unresolvedFailuresCount + metric.unresolvedFailuresCount,
      crossdockCancellationsCount:
        acc.crossdockCancellationsCount + metric.crossdockCancellationsCount,
      pendingRelocationsCount: acc.pendingRelocationsCount + metric.pendingRelocationsCount,
      autoRemediationCount: acc.autoRemediationCount + metric.autoRemediationCount,
      failedRemediationCount: acc.failedRemediationCount + metric.failedRemediationCount,
      avgCubicFeetVariancePct:
        (acc.avgCubicFeetVariancePct + metric.avgCubicFeetVariancePct) / 2,
      avgWeightVariancePct: (acc.avgWeightVariancePct + metric.avgWeightVariancePct) / 2,
    }),
    {
      materialsVerifiedCount: 0,
      materialsWithVariance: 0,
      capacityFailuresCount: 0,
      unresolvedFailuresCount: 0,
      crossdockCancellationsCount: 0,
      pendingRelocationsCount: 0,
      autoRemediationCount: 0,
      failedRemediationCount: 0,
      avgCubicFeetVariancePct: 0,
      avgWeightVariancePct: 0,
    }
  );

  const failures = failuresData?.getCapacityValidationFailures || [];
  const cancellations = cancellationsData?.getCrossDockCancellations || [];

  const autoRemediationSuccessRate =
    aggregatedMetrics.autoRemediationCount > 0
      ? ((aggregatedMetrics.autoRemediationCount -
          aggregatedMetrics.failedRemediationCount) /
          aggregatedMetrics.autoRemediationCount) *
        100
      : 0;

  // Table column definitions
  const failuresColumns: ColumnDef<CapacityValidationFailure>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: (info) => new Date(info.getValue<string>()).toLocaleString(),
    },
    {
      accessorKey: 'locationCode',
      header: 'Location',
      cell: (info) => (
        <span className="font-medium text-primary-600">{info.getValue<string>()}</span>
      ),
    },
    { accessorKey: 'materialCode', header: 'Material' },
    { accessorKey: 'lotNumber', header: 'Lot' },
    {
      accessorKey: 'failureType',
      header: 'Failure Type',
      cell: (info) => {
        const type = info.getValue<string>();
        const label =
          type === 'CUBIC_FEET_EXCEEDED'
            ? 'Volume'
            : type === 'WEIGHT_EXCEEDED'
            ? 'Weight'
            : 'Both';
        const color =
          type === 'BOTH_EXCEEDED'
            ? 'bg-danger-100 text-danger-800'
            : 'bg-warning-100 text-warning-800';
        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>{label}</span>
        );
      },
    },
    {
      accessorKey: 'cubicFeetOverflowPct',
      header: 'Volume Overflow %',
      cell: (info) => {
        const value = info.getValue<number>();
        const color =
          value > 20 ? 'text-danger-600' : value > 5 ? 'text-warning-600' : 'text-gray-600';
        return <span className={`font-semibold ${color}`}>{value.toFixed(1)}%</span>;
      },
    },
    {
      accessorKey: 'weightOverflowPct',
      header: 'Weight Overflow %',
      cell: (info) => {
        const value = info.getValue<number>();
        const color =
          value > 20 ? 'text-danger-600' : value > 5 ? 'text-warning-600' : 'text-gray-600';
        return <span className={`font-semibold ${color}`}>{value.toFixed(1)}%</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const failure = info.row.original;
        return (
          <button
            onClick={() => setSelectedFailureId(failure.failureId)}
            className="btn btn-sm btn-primary"
            aria-label="Resolve failure"
          >
            Resolve
          </button>
        );
      },
    },
  ];

  const cancellationsColumns: ColumnDef<CrossDockCancellation>[] = [
    {
      accessorKey: 'cancelledAt',
      header: 'Cancelled',
      cell: (info) => new Date(info.getValue<string>()).toLocaleString(),
    },
    {
      accessorKey: 'materialCode',
      header: 'Material',
      cell: (info) => (
        <span className="font-medium text-primary-600">{info.getValue<string>()}</span>
      ),
    },
    { accessorKey: 'lotNumber', header: 'Lot' },
    {
      accessorKey: 'cancellationReason',
      header: 'Reason',
      cell: (info) => {
        const reason = info.getValue<string>().replace(/_/g, ' ');
        return <span className="text-sm">{reason}</span>;
      },
    },
    {
      accessorKey: 'newRecommendedLocationCode',
      header: 'New Location',
      cell: (info) => {
        const location = info.getValue<string>();
        return location ? (
          <span className="font-medium text-success-600">{location}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const cancellation = info.row.original;
        return (
          <button
            onClick={() =>
              cancellation.newRecommendedLocationId &&
              completeRelocation({
                variables: {
                  cancellationId: cancellation.cancellationId,
                  actualLocationId: cancellation.newRecommendedLocationId,
                },
              })
            }
            disabled={!cancellation.newRecommendedLocationId || completingRelocation}
            className="btn btn-sm btn-success"
            aria-label="Complete relocation"
          >
            Complete
          </button>
        );
      },
    },
  ];

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading data quality dashboard...</p>
        </div>
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-danger-600 mx-auto" />
          <p className="mt-4 text-gray-600">Error: {metricsError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">Data Quality Dashboard</h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-success-100 text-success-800 border border-success-200">
              <Shield className="h-3 w-3 mr-1" />
              Operational Excellence
            </span>
          </div>
          <Breadcrumb />
        </div>
        <button
          onClick={() => {
            refetchMetrics();
            refetchFailures();
            refetchCancellations();
          }}
          className="btn btn-secondary flex items-center space-x-2"
          aria-label="Refresh all data"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh All</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Materials Verified */}
        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Materials Verified</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {aggregatedMetrics.materialsVerifiedCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {aggregatedMetrics.materialsWithVariance} with variance detected
              </p>
            </div>
            <CheckCircle className="h-10 w-10 text-success-500" />
          </div>
        </div>

        {/* Unresolved Capacity Failures */}
        <div
          className={`card border-l-4 ${
            aggregatedMetrics.unresolvedFailuresCount > 10
              ? 'border-danger-500'
              : aggregatedMetrics.unresolvedFailuresCount > 0
              ? 'border-warning-500'
              : 'border-success-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unresolved Failures</p>
              <p
                className={`text-3xl font-bold mt-2 ${
                  aggregatedMetrics.unresolvedFailuresCount > 10
                    ? 'text-danger-600'
                    : aggregatedMetrics.unresolvedFailuresCount > 0
                    ? 'text-warning-600'
                    : 'text-success-600'
                }`}
              >
                {aggregatedMetrics.unresolvedFailuresCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {aggregatedMetrics.capacityFailuresCount} total failures
              </p>
            </div>
            <AlertTriangle
              className={`h-10 w-10 ${
                aggregatedMetrics.unresolvedFailuresCount > 10
                  ? 'text-danger-500'
                  : aggregatedMetrics.unresolvedFailuresCount > 0
                  ? 'text-warning-500'
                  : 'text-success-500'
              }`}
            />
          </div>
        </div>

        {/* Pending Relocations */}
        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Relocations</p>
              <p className="text-3xl font-bold text-primary-600 mt-2">
                {aggregatedMetrics.pendingRelocationsCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {aggregatedMetrics.crossdockCancellationsCount} cross-dock cancellations
              </p>
            </div>
            <MapPin className="h-10 w-10 text-primary-500" />
          </div>
        </div>

        {/* Auto-Remediation Success Rate */}
        <div className="card border-l-4 border-success-500 bg-success-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Auto-Remediation</p>
              <p className="text-3xl font-bold text-success-600 mt-2">
                {autoRemediationSuccessRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {aggregatedMetrics.autoRemediationCount} actions (
                {aggregatedMetrics.failedRemediationCount} failed)
              </p>
            </div>
            <Activity className="h-10 w-10 text-success-500" />
          </div>
        </div>
      </div>

      {/* Data Quality Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dimension Variance Insights */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Package className="h-6 w-6 text-primary-600" />
            <span>Dimension Variance</span>
          </h2>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Avg Cubic Feet Variance</span>
                <span className="text-2xl font-bold text-primary-600">
                  {Math.abs(aggregatedMetrics.avgCubicFeetVariancePct).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    Math.abs(aggregatedMetrics.avgCubicFeetVariancePct) < 5
                      ? 'bg-success-500'
                      : Math.abs(aggregatedMetrics.avgCubicFeetVariancePct) < 10
                      ? 'bg-warning-500'
                      : 'bg-danger-500'
                  }`}
                  style={{
                    width: `${Math.min(Math.abs(aggregatedMetrics.avgCubicFeetVariancePct) * 10, 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Threshold: 10% (auto-update if below)
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Avg Weight Variance</span>
                <span className="text-2xl font-bold text-primary-600">
                  {Math.abs(aggregatedMetrics.avgWeightVariancePct).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    Math.abs(aggregatedMetrics.avgWeightVariancePct) < 5
                      ? 'bg-success-500'
                      : Math.abs(aggregatedMetrics.avgWeightVariancePct) < 10
                      ? 'bg-warning-500'
                      : 'bg-danger-500'
                  }`}
                  style={{
                    width: `${Math.min(Math.abs(aggregatedMetrics.avgWeightVariancePct) * 10, 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Threshold: 10% (auto-update if below)
              </p>
            </div>
          </div>
        </div>

        {/* Facility Breakdown */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <FileText className="h-6 w-6 text-primary-600" />
            <span>Facility Breakdown</span>
          </h2>
          <div className="space-y-3">
            {metrics.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No facility data available
              </p>
            ) : (
              metrics.map((metric) => (
                <div
                  key={metric.facilityId}
                  className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{metric.facilityName}</span>
                    <span
                      className={`text-sm font-semibold ${
                        metric.unresolvedFailuresCount > 0
                          ? 'text-danger-600'
                          : 'text-success-600'
                      }`}
                    >
                      {metric.unresolvedFailuresCount} failures
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">{metric.materialsVerifiedCount}</span>{' '}
                      verified
                    </div>
                    <div>
                      <span className="font-medium">{metric.pendingRelocationsCount}</span>{' '}
                      pending
                    </div>
                    <div>
                      <span className="font-medium">{metric.autoRemediationCount}</span> auto
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Capacity Validation Failures */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6 text-danger-600" />
            <span>Unresolved Capacity Failures</span>
          </h2>
          <span className="text-sm text-gray-500">
            {failures.length} of {aggregatedMetrics.unresolvedFailuresCount} shown
          </span>
        </div>
        {failuresLoading ? (
          <p className="text-gray-500">Loading capacity failures...</p>
        ) : failures.length > 0 ? (
          <DataTable columns={failuresColumns} data={failures} />
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-success-500 mx-auto mb-2" />
            <p className="text-gray-600">No unresolved capacity failures</p>
            <p className="text-sm text-gray-500 mt-1">All capacity issues have been addressed</p>
          </div>
        )}
      </div>

      {/* Cross-Dock Cancellations */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <XCircle className="h-6 w-6 text-warning-600" />
            <span>Pending Cross-Dock Relocations</span>
          </h2>
          <span className="text-sm text-gray-500">
            {cancellations.length} of {aggregatedMetrics.pendingRelocationsCount} shown
          </span>
        </div>
        {cancellationsLoading ? (
          <p className="text-gray-500">Loading cross-dock cancellations...</p>
        ) : cancellations.length > 0 ? (
          <DataTable columns={cancellationsColumns} data={cancellations} />
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-success-500 mx-auto mb-2" />
            <p className="text-gray-600">No pending relocations</p>
            <p className="text-sm text-gray-500 mt-1">
              All cross-dock cancellations have been processed
            </p>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {selectedFailureId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Resolve Capacity Failure
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  rows={4}
                  placeholder="Enter any notes about how this failure was resolved..."
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    resolveFailure({
                      variables: {
                        failureId: selectedFailureId,
                        resolutionNotes: resolutionNotes || undefined,
                      },
                    });
                  }}
                  disabled={resolvingFailure}
                  className="btn btn-primary flex-1"
                >
                  {resolvingFailure ? 'Resolving...' : 'Confirm Resolution'}
                </button>
                <button
                  onClick={() => {
                    setSelectedFailureId(null);
                    setResolutionNotes('');
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
