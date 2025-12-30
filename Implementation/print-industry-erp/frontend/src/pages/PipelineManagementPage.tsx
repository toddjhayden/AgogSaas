import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Target,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAuthStore } from '../store/appStore';
import {
  GET_PIPELINE_STAGES,
  GET_PIPELINE_SUMMARY,
  GET_OPPORTUNITIES_BY_OWNER,
  CREATE_OPPORTUNITY,
  UPDATE_OPPORTUNITY,
  DELETE_OPPORTUNITY
} from '../graphql/queries/crm';

interface PipelineStage {
  id: string;
  stageName: string;
  sequenceNumber: number;
  probabilityPercentage: number;
  isClosedWon: boolean;
  isClosedLost: boolean;
}

interface Opportunity {
  id: string;
  opportunityNumber: string;
  opportunityName: string;
  description?: string;
  pipelineStageId: string;
  estimatedValue: number;
  currencyCode: string;
  probabilityPercentage?: number;
  weightedValue?: number;
  expectedCloseDate?: string;
  nextActionDate?: string;
  nextActionDescription?: string;
  status: string;
  ownerUserId: string;
}

interface PipelineSummary {
  stageId: string;
  stageName: string;
  sequenceNumber: number;
  opportunityCount: number;
  totalValue: number;
  totalWeightedValue: number;
  avgProbability: number;
}

export const PipelineManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [filters, setFilters] = useState({
    status: 'ACTIVE',
    minValue: '',
    maxValue: ''
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('');

  const [formData, setFormData] = useState({
    opportunityName: '',
    description: '',
    pipelineStageId: '',
    estimatedValue: '',
    currencyCode: 'USD',
    expectedCloseDate: ''
  });

  // Query pipeline stages
  const { data: stagesData, loading: stagesLoading } = useQuery(GET_PIPELINE_STAGES);

  // Query pipeline summary
  const { data: summaryData, loading: summaryLoading } = useQuery(GET_PIPELINE_SUMMARY, {
    variables: { ownerUserId: user?.id },
    skip: !user?.id
  });

  // Query opportunities
  const { data: opportunitiesData, loading: opportunitiesLoading, refetch } = useQuery(GET_OPPORTUNITIES_BY_OWNER, {
    variables: {
      ownerUserId: user?.id,
      status: filters.status
    },
    skip: !user?.id
  });

  const [createOpportunity] = useMutation(CREATE_OPPORTUNITY, {
    onCompleted: () => {
      refetch();
      setShowCreateModal(false);
      resetForm();
      toast.success(t('Opportunity created successfully'));
    },
    onError: (error) => {
      toast.error(t('Failed to create opportunity: ') + error.message);
    }
  });

  const [updateOpportunity] = useMutation(UPDATE_OPPORTUNITY, {
    onCompleted: () => {
      refetch();
      setSelectedOpportunity(null);
      resetForm();
      toast.success(t('Opportunity updated successfully'));
    },
    onError: (error) => {
      toast.error(t('Failed to update opportunity: ') + error.message);
    }
  });

  const [deleteOpportunity] = useMutation(DELETE_OPPORTUNITY, {
    onCompleted: () => {
      refetch();
      toast.success(t('Opportunity deleted successfully'));
    },
    onError: (error) => {
      toast.error(t('Failed to delete opportunity: ') + error.message);
    }
  });

  const pipelineStages: PipelineStage[] = stagesData?.getPipelineStages || [];
  const pipelineSummary: PipelineSummary[] = summaryData?.getPipelineSummary || [];
  const opportunities: Opportunity[] = opportunitiesData?.getOpportunitiesByOwner || [];

  const filteredOpportunities = opportunities.filter((opp) => {
    if (filters.minValue && opp.estimatedValue < parseFloat(filters.minValue)) return false;
    if (filters.maxValue && opp.estimatedValue > parseFloat(filters.maxValue)) return false;
    if (selectedStage && opp.pipelineStageId !== selectedStage) return false;
    return true;
  });

  const getOpportunitiesByStage = (stageId: string) => {
    return filteredOpportunities.filter((opp) => opp.pipelineStageId === stageId);
  };

  const resetForm = () => {
    setFormData({
      opportunityName: '',
      description: '',
      pipelineStageId: pipelineStages[0]?.id || '',
      estimatedValue: '',
      currencyCode: 'USD',
      expectedCloseDate: ''
    });
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOpportunity({
      variables: {
        input: {
          ...formData,
          estimatedValue: parseFloat(formData.estimatedValue),
          ownerUserId: user?.id
        }
      }
    });
  };

  const handleUpdateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpportunity) return;

    await updateOpportunity({
      variables: {
        input: {
          id: selectedOpportunity.id,
          opportunityName: formData.opportunityName,
          description: formData.description,
          pipelineStageId: formData.pipelineStageId,
          estimatedValue: parseFloat(formData.estimatedValue),
          expectedCloseDate: formData.expectedCloseDate || undefined
        }
      }
    });
  };

  const handleDeleteOpportunity = async (opportunityId: string) => {
    if (!confirm(t('Are you sure you want to delete this opportunity?'))) {
      return;
    }

    await deleteOpportunity({ variables: { id: opportunityId } });
  };

  const handleEditOpportunity = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setFormData({
      opportunityName: opportunity.opportunityName,
      description: opportunity.description || '',
      pipelineStageId: opportunity.pipelineStageId,
      estimatedValue: opportunity.estimatedValue.toString(),
      currencyCode: opportunity.currencyCode,
      expectedCloseDate: opportunity.expectedCloseDate?.split('T')[0] || ''
    });
    setShowCreateModal(true);
  };

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStageSummary = (stageId: string): PipelineSummary | undefined => {
    return pipelineSummary.find((s) => s.stageId === stageId);
  };

  const isCloseDateOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="flex-1 overflow-auto">
      <Breadcrumb
        items={[
          { label: t('CRM'), path: '/crm' },
          { label: t('Pipeline'), path: '/crm/pipeline' }
        ]}
      />

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('Sales Pipeline Management')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('Track and manage your sales opportunities')}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setSelectedOpportunity(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            {t('New Opportunity')}
          </button>
        </div>

        {/* Pipeline Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('Total Opportunities')}</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {pipelineSummary.reduce((sum, s) => sum + s.opportunityCount, 0)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('Pipeline Value')}</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(pipelineSummary.reduce((sum, s) => sum + s.totalValue, 0))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('Weighted Value')}</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(pipelineSummary.reduce((sum, s) => sum + s.totalWeightedValue, 0))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <BarChart3 className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('Avg Win Rate')}</div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {pipelineSummary.length > 0
                ? (pipelineSummary.reduce((sum, s) => sum + s.avgProbability, 0) / pipelineSummary.length).toFixed(1)
                : 0}%
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('Status')}
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="ACTIVE">{t('Active')}</option>
                <option value="WON">{t('Won')}</option>
                <option value="LOST">{t('Lost')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('Min Value')}
              </label>
              <input
                type="number"
                value={filters.minValue}
                onChange={(e) => setFilters({ ...filters, minValue: e.target.value })}
                placeholder="0"
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('Max Value')}
              </label>
              <input
                type="number"
                value={filters.maxValue}
                onChange={(e) => setFilters({ ...filters, maxValue: e.target.value })}
                placeholder="999999"
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Pipeline Kanban View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {stagesLoading ? (
            <div className="col-span-full text-center text-gray-500 py-8">{t('Loading pipeline...')}</div>
          ) : (
            pipelineStages
              .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
              .map((stage) => {
                const stageSummary = getStageSummary(stage.id);
                const stageOpportunities = getOpportunitiesByStage(stage.id);

                return (
                  <div key={stage.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {stage.stageName}
                        </h3>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {stage.probabilityPercentage}%
                        </span>
                      </div>
                      {stageSummary && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <div>{stageSummary.opportunityCount} {t('opportunities')}</div>
                          <div className="font-semibold">
                            {formatCurrency(stageSummary.totalValue)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {stageOpportunities.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-4">
                          {t('No opportunities')}
                        </div>
                      ) : (
                        stageOpportunities.map((opp) => (
                          <div
                            key={opp.id}
                            className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                            onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-medium text-gray-900 dark:text-white text-sm">
                                {opp.opportunityName}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditOpportunity(opp);
                                  }}
                                  className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteOpportunity(opp.id);
                                  }}
                                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                              {formatCurrency(opp.estimatedValue, opp.currencyCode)}
                            </div>
                            {opp.expectedCloseDate && (
                              <div className={`text-xs flex items-center gap-1 ${isCloseDateOverdue(opp.expectedCloseDate) ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                                <Calendar className="w-3 h-3" />
                                {formatDate(opp.expectedCloseDate)}
                              </div>
                            )}
                            {opp.nextActionDate && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t('Next')}: {formatDate(opp.nextActionDate)}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Create/Edit Opportunity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedOpportunity ? t('Edit Opportunity') : t('Create New Opportunity')}
              </h2>
            </div>

            <form onSubmit={selectedOpportunity ? handleUpdateOpportunity : handleCreateOpportunity} className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Opportunity Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.opportunityName}
                    onChange={(e) => setFormData({ ...formData, opportunityName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Description')}
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Pipeline Stage')} *
                    </label>
                    <select
                      required
                      value={formData.pipelineStageId}
                      onChange={(e) => setFormData({ ...formData, pipelineStageId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <option value="">Select stage</option>
                      {pipelineStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.stageName} ({stage.probabilityPercentage}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Expected Close Date')}
                    </label>
                    <input
                      type="date"
                      value={formData.expectedCloseDate}
                      onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Estimated Value')} *
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.estimatedValue}
                      onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Currency')}
                    </label>
                    <select
                      value={formData.currencyCode}
                      onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedOpportunity(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedOpportunity ? t('Update Opportunity') : t('Create Opportunity')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
