import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import {
  Palette,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  ThumbsUp,
  ThumbsDown,
  Plus,
} from 'lucide-react';
import { DataTable } from '../components/common/DataTable';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { ColumnDef } from '@tanstack/react-table';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  GET_COLOR_PROOFS,
  APPROVE_COLOR_PROOF,
  REJECT_COLOR_PROOF,
  GENERATE_COLOR_PROOF,
} from '../graphql/queries/preflight';

interface ColorProof {
  id: string;
  reportId?: string;
  jobId?: string;
  proofType: 'SOFT_PROOF' | 'DIGITAL_PROOF' | 'CONTRACT_PROOF';
  iccProfileName?: string;
  renderingIntent?: 'PERCEPTUAL' | 'RELATIVE_COLORIMETRIC' | 'SATURATION' | 'ABSOLUTE_COLORIMETRIC';
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  deltaE?: number;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const ColorProofManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedJobId, _setSelectedJobId] = useState<string>('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [selectedProof, setSelectedProof] = useState<ColorProof | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Fetch color proofs - for demo, we'll use a mock job ID
  const { data, loading, refetch } = useQuery(GET_COLOR_PROOFS, {
    variables: {
      jobId: selectedJobId || 'demo-job-001',
    },
    skip: !selectedJobId && !true, // Always fetch for demo
  });

  const colorProofs: ColorProof[] = data?.colorProofs || [];

  const [approveProof] = useMutation(APPROVE_COLOR_PROOF, {
    onCompleted: () => {
      toast.success(t('colorProof.approved', 'Color proof approved successfully'));
      setShowApprovalModal(false);
      setSelectedProof(null);
      refetch();
    },
    onError: (error) => {
      toast.error(t('colorProof.approvalError', 'Failed to approve proof: ') + error.message);
    },
  });

  const [rejectProof] = useMutation(REJECT_COLOR_PROOF, {
    onCompleted: () => {
      toast.success(t('colorProof.rejected', 'Color proof rejected successfully'));
      setShowRejectionModal(false);
      setSelectedProof(null);
      setRejectionNotes('');
      refetch();
    },
    onError: (error) => {
      toast.error(t('colorProof.rejectionError', 'Failed to reject proof: ') + error.message);
    },
  });

  const [_generateProof] = useMutation(GENERATE_COLOR_PROOF, {
    onCompleted: () => {
      toast.success(t('colorProof.generated', 'Color proof generation started'));
      setShowGenerateModal(false);
      refetch();
    },
    onError: (error) => {
      toast.error(t('colorProof.generateError', 'Failed to generate proof: ') + error.message);
    },
  });

  const handleApprove = async () => {
    if (!selectedProof) return;
    await approveProof({
      variables: {
        id: selectedProof.id,
      },
    });
  };

  const handleReject = async () => {
    if (!selectedProof) return;
    await rejectProof({
      variables: {
        id: selectedProof.id,
        notes: rejectionNotes,
      },
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success-100 text-success-700';
      case 'rejected':
        return 'bg-danger-100 text-danger-700';
      case 'pending':
        return 'bg-warning-100 text-warning-700';
      case 'revision_requested':
        return 'bg-info-100 text-info-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getProofTypeColor = (type: string) => {
    switch (type) {
      case 'CONTRACT_PROOF':
        return 'bg-purple-100 text-purple-700';
      case 'DIGITAL_PROOF':
        return 'bg-blue-100 text-blue-700';
      case 'SOFT_PROOF':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const columns: ColumnDef<ColorProof>[] = [
    {
      accessorKey: 'id',
      header: 'Proof ID',
      cell: (info) => {
        return <span className="font-medium text-primary-600">{(info.getValue() as string).substring(0, 8)}</span>;
      },
    },
    {
      accessorKey: 'jobId',
      header: 'Job ID',
      cell: (info) => {
        const jobId = info.getValue() as string;
        return jobId ? <span className="text-sm">{jobId}</span> : <span className="text-gray-400">-</span>;
      },
    },
    {
      accessorKey: 'proofType',
      header: 'Proof Type',
      cell: (info) => {
        const type = info.getValue() as string;
        return (
          <span className={clsx('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', getProofTypeColor(type))}>
            {type.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      accessorKey: 'iccProfileName',
      header: 'ICC Profile',
      cell: (info) => {
        const profile = info.getValue() as string;
        return profile ? <span className="text-sm">{profile}</span> : <span className="text-gray-400">-</span>;
      },
    },
    {
      accessorKey: 'renderingIntent',
      header: 'Rendering Intent',
      cell: (info) => {
        const intent = info.getValue() as string;
        return intent ? (
          <span className="text-sm">{intent.replace(/_/g, ' ')}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'deltaE',
      header: 'Delta E',
      cell: (info) => {
        const deltaE = info.getValue() as number;
        if (!deltaE) return <span className="text-gray-400">-</span>;
        const color = deltaE < 1 ? 'text-success-600' : deltaE < 3 ? 'text-warning-600' : 'text-danger-600';
        return <span className={clsx('font-semibold', color)}>{deltaE.toFixed(2)}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        return (
          <span className={clsx('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', getStatusColor(status))}>
            {getStatusIcon(status)}
            <span className="ml-1">{status.replace(/_/g, ' ').toUpperCase()}</span>
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: (info) => {
        const date = new Date(info.getValue() as string);
        return <span className="text-sm">{date.toLocaleDateString()}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const proof = info.row.original;
        return (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => toast('View proof: ' + proof.id)}
              className="text-primary-600 hover:text-primary-800"
              title="View"
            >
              <Eye className="h-4 w-4" />
            </button>
            {proof.status === 'pending' && (
              <>
                <button
                  onClick={() => {
                    setSelectedProof(proof);
                    setShowApprovalModal(true);
                  }}
                  className="text-success-600 hover:text-success-800"
                  title="Approve"
                >
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedProof(proof);
                    setShowRejectionModal(true);
                  }}
                  className="text-danger-600 hover:text-danger-800"
                  title="Reject"
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={() => toast('Download proof: ' + proof.id)}
              className="text-gray-600 hover:text-gray-800"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const filteredProofs =
    statusFilter === 'all' ? colorProofs : colorProofs.filter((proof) => proof.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('colorProof.title', 'Color Proof Management')}
          </h1>
          <Breadcrumb />
        </div>
        <button className="btn-primary" onClick={() => setShowGenerateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('colorProof.generateProof', 'Generate Proof')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-l-4 border-warning-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('colorProof.pending', 'Pending')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {colorProofs.filter((p) => p.status === 'pending').length}
              </p>
            </div>
            <Clock className="h-10 w-10 text-warning-500" />
          </div>
        </div>

        <div className="card border-l-4 border-success-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('colorProof.approved', 'Approved')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {colorProofs.filter((p) => p.status === 'approved').length}
              </p>
            </div>
            <CheckCircle className="h-10 w-10 text-success-500" />
          </div>
        </div>

        <div className="card border-l-4 border-danger-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('colorProof.rejected', 'Rejected')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {colorProofs.filter((p) => p.status === 'rejected').length}
              </p>
            </div>
            <XCircle className="h-10 w-10 text-danger-500" />
          </div>
        </div>

        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('colorProof.total', 'Total Proofs')}</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{colorProofs.length}</p>
            </div>
            <Palette className="h-10 w-10 text-primary-500" />
          </div>
        </div>
      </div>

      {/* Info Card about Delta E */}
      <div className="card bg-blue-50 border-l-4 border-blue-500">
        <div className="flex items-start space-x-3">
          <Palette className="h-6 w-6 text-blue-600 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">{t('colorProof.deltaEInfo', 'Understanding Delta E')}</h3>
            <p className="text-sm text-blue-800">
              {t('colorProof.deltaEDescription', 'Delta E (ΔE) measures color difference. Lower values indicate better color accuracy:')}
            </p>
            <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4">
              <li>• <strong>ΔE &lt; 1.0:</strong> {t('colorProof.deltaEExcellent', 'Excellent - Not perceptible to human eye')}</li>
              <li>• <strong>ΔE 1.0-3.0:</strong> {t('colorProof.deltaEGood', 'Good - Perceptible only by trained observers')}</li>
              <li>• <strong>ΔE &gt; 3.0:</strong> {t('colorProof.deltaEPoor', 'Poor - Clearly visible color difference')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Proofs Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('colorProof.allProofs', 'All Color Proofs')}</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('colorProof.all', 'All')}
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'pending' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('colorProof.pending', 'Pending')}
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'approved' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('colorProof.approved', 'Approved')}
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === 'rejected' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {t('colorProof.rejected', 'Rejected')}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <div className="text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">{t('colorProof.loading', 'Loading color proofs...')}</p>
            </div>
          </div>
        ) : filteredProofs.length > 0 ? (
          <DataTable data={filteredProofs} columns={columns} pageSize={10} />
        ) : (
          <div className="card text-center py-12">
            <Palette className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('colorProof.noProofs', 'No color proofs found')}</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">{t('colorProof.approveProof', 'Approve Color Proof')}</h2>
            <p className="text-gray-600 mb-4">
              {t('colorProof.approveConfirm', 'Are you sure you want to approve this color proof?')}
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600">Proof ID: {selectedProof.id.substring(0, 8)}</p>
              <p className="text-sm text-gray-600">Type: {selectedProof.proofType}</p>
              {selectedProof.deltaE && (
                <p className="text-sm text-gray-600">Delta E: {selectedProof.deltaE.toFixed(2)}</p>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setShowApprovalModal(false)}>
                Cancel
              </button>
              <button className="btn-success" onClick={handleApprove}>
                <ThumbsUp className="h-4 w-4 mr-2" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">{t('colorProof.rejectProof', 'Reject Color Proof')}</h2>
            <p className="text-gray-600 mb-4">
              {t('colorProof.rejectConfirm', 'Please provide notes for rejecting this color proof:')}
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 mb-4"
              rows={3}
              placeholder={t('colorProof.rejectionNotes', 'Rejection notes (required)...')}
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              required
            />
            <div className="flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setShowRejectionModal(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleReject}>
                <ThumbsDown className="h-4 w-4 mr-2" />
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">{t('colorProof.generateProof', 'Generate Color Proof')}</h2>
            <p className="text-gray-600 mb-4">
              {t('colorProof.generateDesc', 'Color proof generation form would go here')}
            </p>
            <div className="flex justify-end space-x-3">
              <button className="btn-secondary" onClick={() => setShowGenerateModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => setShowGenerateModal(false)}>
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
