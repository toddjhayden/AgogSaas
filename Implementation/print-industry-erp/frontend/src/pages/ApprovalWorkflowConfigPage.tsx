import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash2, Check, X, ArrowRight, Users, Clock } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../components/common/DataTable';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAuth } from '../hooks/useAuth';
import {
  GET_APPROVAL_WORKFLOWS,
  UPSERT_APPROVAL_WORKFLOW,
  DELETE_APPROVAL_WORKFLOW,
} from '../graphql/queries/approvals';

interface ApprovalWorkflowStep {
  id?: string;
  stepNumber: number;
  stepName: string;
  approverRole?: string;
  approverUserId?: string;
  approverUserGroupId?: string;
  isRequired: boolean;
  canDelegate: boolean;
  canSkip: boolean;
  minApprovalLimit?: number;
}

interface ApprovalWorkflow {
  id: string;
  tenantId: string;
  workflowName: string;
  description?: string;
  appliesToFacilityIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  approvalType: 'SEQUENTIAL' | 'PARALLEL' | 'ANY_ONE';
  isActive: boolean;
  priority: number;
  slaHoursPerStep?: number;
  escalationEnabled: boolean;
  escalationUserId?: string;
  autoApproveUnderAmount?: number;
  steps: ApprovalWorkflowStep[];
  createdAt: string;
  updatedAt?: string;
}

export const ApprovalWorkflowConfigPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenantId } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const { data, loading, error, refetch } = useQuery(GET_APPROVAL_WORKFLOWS, {
    variables: {
      tenantId,
      isActive: activeFilter,
    },
  });

  const [upsertWorkflow] = useMutation(UPSERT_APPROVAL_WORKFLOW, {
    onCompleted: () => {
      setShowModal(false);
      setEditingWorkflow(null);
      refetch();
    },
  });

  const [deleteWorkflow] = useMutation(DELETE_APPROVAL_WORKFLOW, {
    onCompleted: () => {
      refetch();
    },
  });

  const workflows: ApprovalWorkflow[] = data?.getApprovalWorkflows || [];

  const handleEdit = (workflow: ApprovalWorkflow) => {
    setEditingWorkflow(workflow);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('approvals.confirmDeleteWorkflow'))) {
      await deleteWorkflow({
        variables: {
          id,
          tenantId,
        },
      });
    }
  };

  const handleCreateNew = () => {
    setEditingWorkflow(null);
    setShowModal(true);
  };

  const columns = useMemo<ColumnDef<ApprovalWorkflow>[]>(
    () => [
      {
        accessorKey: 'workflowName',
        header: t('approvals.workflowName'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-gray-900">{row.original.workflowName}</div>
            {row.original.description && (
              <div className="text-sm text-gray-500">{row.original.description}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'approvalType',
        header: t('approvals.approvalType'),
        cell: ({ row }) => {
          const type = row.original.approvalType;
          const color =
            type === 'SEQUENTIAL' ? 'blue' : type === 'PARALLEL' ? 'purple' : 'green';
          return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 text-${color}-800`}>
              {t(`approvals.${type.toLowerCase()}`)}
            </span>
          );
        },
      },
      {
        accessorKey: 'amountRange',
        header: t('approvals.amountRange'),
        cell: ({ row }) => {
          const min = row.original.minAmount;
          const max = row.original.maxAmount;
          if (!min && !max) return <span className="text-gray-400">{t('approvals.allAmounts')}</span>;
          if (!min) return <span>≤ ${max?.toLocaleString()}</span>;
          if (!max) return <span>≥ ${min.toLocaleString()}</span>;
          return <span>${min.toLocaleString()} - ${max.toLocaleString()}</span>;
        },
      },
      {
        accessorKey: 'steps',
        header: t('approvals.steps'),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{row.original.steps.length}</span>
            <span className="text-sm text-gray-500">{t('approvals.stepCount')}</span>
          </div>
        ),
      },
      {
        accessorKey: 'slaHoursPerStep',
        header: t('approvals.sla'),
        cell: ({ row }) => {
          const hours = row.original.slaHoursPerStep;
          return hours ? (
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{hours}h</span>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              row.original.isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {row.original.isActive ? t('common.active') : t('common.inactive')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEdit(row.original)}
              className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              title={t('common.edit')}
            >
              <Edit className="h-3 w-3 mr-1" />
              {t('common.edit')}
            </button>
            <button
              onClick={() => handleDelete(row.original.id)}
              className="inline-flex items-center px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t('common.delete')}
            </button>
          </div>
        ),
      },
    ],
    [t]
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600">{t('common.error')}: {error.message}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('approvals.workflowConfig')}</h1>
        <Breadcrumb />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.totalWorkflows')}</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{workflows.length}</p>
            </div>
            <ArrowRight className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.activeWorkflows')}</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {workflows.filter((w) => w.isActive).length}
              </p>
            </div>
            <Check className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{t('approvals.totalSteps')}</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {workflows.reduce((sum, w) => sum + w.steps.length, 0)}
              </p>
            </div>
            <Users className="h-10 w-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={activeFilter === undefined ? '' : activeFilter.toString()}
            onChange={(e) =>
              setActiveFilter(e.target.value === '' ? undefined : e.target.value === 'true')
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t('approvals.allWorkflows')}</option>
            <option value="true">{t('approvals.activeOnly')}</option>
            <option value="false">{t('approvals.inactiveOnly')}</option>
          </select>
        </div>

        <button
          onClick={handleCreateNew}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('approvals.createWorkflow')}
        </button>
      </div>

      {/* Workflows Table */}
      <div className="card">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('approvals.approvalWorkflows')}</h2>
          <DataTable columns={columns} data={workflows} searchable exportable />
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <WorkflowEditorModal
          workflow={editingWorkflow}
          tenantId={tenantId}
          onSave={upsertWorkflow}
          onClose={() => {
            setShowModal(false);
            setEditingWorkflow(null);
          }}
        />
      )}
    </div>
  );
};

// Modal Component for Creating/Editing Workflows
interface WorkflowEditorModalProps {
  workflow: ApprovalWorkflow | null;
  tenantId: string;
  onSave: (variables: { variables: Record<string, unknown> }) => void;
  onClose: () => void;
}

const WorkflowEditorModal: React.FC<WorkflowEditorModalProps> = ({
  workflow,
  tenantId,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [workflowName, setWorkflowName] = useState(workflow?.workflowName || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [minAmount, setMinAmount] = useState<number | undefined>(workflow?.minAmount);
  const [maxAmount, setMaxAmount] = useState<number | undefined>(workflow?.maxAmount);
  const [approvalType, setApprovalType] = useState<'SEQUENTIAL' | 'PARALLEL' | 'ANY_ONE'>(
    workflow?.approvalType || 'SEQUENTIAL'
  );
  const [slaHoursPerStep, setSlaHoursPerStep] = useState<number | undefined>(
    workflow?.slaHoursPerStep
  );
  const [escalationEnabled, setEscalationEnabled] = useState(workflow?.escalationEnabled || false);
  const [steps, setSteps] = useState<ApprovalWorkflowStep[]>(
    workflow?.steps || [
      {
        stepNumber: 1,
        stepName: 'Manager Approval',
        approverRole: 'MANAGER',
        isRequired: true,
        canDelegate: true,
        canSkip: false,
      },
    ]
  );

  const handleAddStep = () => {
    setSteps([
      ...steps,
      {
        stepNumber: steps.length + 1,
        stepName: `Step ${steps.length + 1}`,
        approverRole: '',
        isRequired: true,
        canDelegate: false,
        canSkip: false,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: string, value: unknown) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleSubmit = () => {
    if (!workflowName.trim()) {
      alert(t('approvals.workflowNameRequired'));
      return;
    }

    if (steps.length === 0) {
      alert(t('approvals.atLeastOneStep'));
      return;
    }

    onSave({
      variables: {
        id: workflow?.id,
        tenantId,
        workflowName: workflowName.trim(),
        description: description.trim() || undefined,
        minAmount,
        maxAmount,
        approvalType,
        slaHoursPerStep,
        escalationEnabled,
        steps: steps.map((s) => ({
          stepNumber: s.stepNumber,
          stepName: s.stepName,
          approverRole: s.approverRole || undefined,
          approverUserId: s.approverUserId || undefined,
          approverUserGroupId: s.approverUserGroupId || undefined,
          isRequired: s.isRequired,
          canDelegate: s.canDelegate,
          canSkip: s.canSkip,
          minApprovalLimit: s.minApprovalLimit || undefined,
        })),
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">
              {workflow ? t('approvals.editWorkflow') : t('approvals.createWorkflow')}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.workflowName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder={t('approvals.workflowNamePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.approvalType')}
              </label>
              <select
                value={approvalType}
                onChange={(e) => setApprovalType(e.target.value as 'SEQUENTIAL' | 'PARALLEL' | 'ANY_ONE')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="SEQUENTIAL">{t('approvals.sequential')}</option>
                <option value="PARALLEL">{t('approvals.parallel')}</option>
                <option value="ANY_ONE">{t('approvals.anyOne')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('approvals.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder={t('approvals.descriptionPlaceholder')}
            />
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.minAmount')}
              </label>
              <input
                type="number"
                value={minAmount || ''}
                onChange={(e) => setMinAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.maxAmount')}
              </label>
              <input
                type="number"
                value={maxAmount || ''}
                onChange={(e) => setMaxAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="Unlimited"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('approvals.slaHours')}
              </label>
              <input
                type="number"
                value={slaHoursPerStep || ''}
                onChange={(e) =>
                  setSlaHoursPerStep(e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                placeholder="24"
              />
            </div>
          </div>

          {/* Escalation */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={escalationEnabled}
              onChange={(e) => setEscalationEnabled(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label className="text-sm font-medium text-gray-700">
              {t('approvals.enableEscalation')}
            </label>
          </div>

          {/* Approval Steps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900">{t('approvals.approvalSteps')}</h4>
              <button
                onClick={handleAddStep}
                className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('approvals.addStep')}
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="border border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900">
                      {t('approvals.step')} {index + 1}
                    </span>
                    {steps.length > 1 && (
                      <button
                        onClick={() => handleRemoveStep(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('approvals.stepName')}
                      </label>
                      <input
                        type="text"
                        value={step.stepName}
                        onChange={(e) => handleStepChange(index, 'stepName', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('approvals.approverRole')}
                      </label>
                      <input
                        type="text"
                        value={step.approverRole || ''}
                        onChange={(e) => handleStepChange(index, 'approverRole', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                        placeholder="MANAGER, DIRECTOR, etc."
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mt-3">
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={step.isRequired}
                        onChange={(e) => handleStepChange(index, 'isRequired', e.target.checked)}
                        className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-xs text-gray-700">{t('approvals.required')}</span>
                    </label>

                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={step.canDelegate}
                        onChange={(e) => handleStepChange(index, 'canDelegate', e.target.checked)}
                        className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-xs text-gray-700">{t('approvals.canDelegate')}</span>
                    </label>

                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={step.canSkip}
                        onChange={(e) => handleStepChange(index, 'canSkip', e.target.checked)}
                        className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="text-xs text-gray-700">{t('approvals.canSkip')}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-end space-x-3">
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
              {workflow ? t('common.update') : t('common.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
