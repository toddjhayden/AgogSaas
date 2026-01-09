import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Target,
  TrendingUp,
  Edit,
  Trash2,
  Plus,
  Activity,
  CheckCircle,
  Tag,
  AlertCircle,
  ChevronRight,
  PhoneCall,
  Mail,
  Video,
  MessageSquare
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { useAuthStore } from '../store/authStore';
import {
  GET_OPPORTUNITY,
  GET_OPPORTUNITY_STAGE_HISTORY,
  GET_ACTIVITIES_BY_OPPORTUNITY,
  GET_NOTES_BY_OPPORTUNITY,
  DELETE_OPPORTUNITY,
  CREATE_ACTIVITY,
  CREATE_NOTE,
  TOGGLE_PIN_NOTE,
  DELETE_NOTE,
  GET_PIPELINE_STAGES
} from '../graphql/queries/crm';

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
  actualCloseDate?: string;
  opportunityType?: string;
  leadSource?: string;
  productCategories?: string[];
  competitors?: string[];
  ourCompetitiveAdvantage?: string;
  budgetConfirmed: boolean;
  authorityConfirmed: boolean;
  needConfirmed: boolean;
  timelineConfirmed: boolean;
  nextActionDate?: string;
  nextActionDescription?: string;
  status: string;
  lostReason?: string;
  lostReasonNotes?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
}

interface StageHistory {
  id: string;
  fromStageId?: string;
  fromStageName?: string;
  toStageId: string;
  toStageName: string;
  stageChangedAt: string;
  daysInPreviousStage?: number;
  changeReason?: string;
}

interface Activity {
  id: string;
  activityType: string;
  activitySubject: string;
  activityDescription?: string;
  activityDate: string;
  durationMinutes?: number;
  outcome?: string;
  nextSteps?: string;
  isCompleted: boolean;
  createdAt: string;
}

interface Note {
  id: string;
  noteTitle?: string;
  noteContent: string;
  noteType?: string;
  isPinned: boolean;
  isPrivate: boolean;
  createdAt: string;
}

export const OpportunityDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state: { user: any }) => state.user);

  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes' | 'history'>('overview');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [activityFormData, setActivityFormData] = useState({
    activityType: 'CALL',
    activitySubject: '',
    activityDescription: '',
    activityDate: new Date().toISOString().split('T')[0],
    durationMinutes: ''
  });

  const [noteFormData, setNoteFormData] = useState({
    noteTitle: '',
    noteContent: '',
    noteType: 'GENERAL',
    isPinned: false
  });

  // Query opportunity details
  const { data: opportunityData, loading: opportunityLoading, refetch: _refetchOpportunity } = useQuery(GET_OPPORTUNITY, {
    variables: { id },
    skip: !id
  });

  // Query pipeline stages
  const { data: stagesData } = useQuery(GET_PIPELINE_STAGES);

  // Query stage history
  const { data: historyData } = useQuery(GET_OPPORTUNITY_STAGE_HISTORY, {
    variables: { opportunityId: id },
    skip: !id
  });

  // Query activities
  const { data: activitiesData, refetch: refetchActivities } = useQuery(GET_ACTIVITIES_BY_OPPORTUNITY, {
    variables: { opportunityId: id },
    skip: !id
  });

  // Query notes
  const { data: notesData, refetch: refetchNotes } = useQuery(GET_NOTES_BY_OPPORTUNITY, {
    variables: { opportunityId: id },
    skip: !id
  });

  const [deleteOpportunity] = useMutation(DELETE_OPPORTUNITY, {
    onCompleted: () => {
      navigate('/crm/opportunities');
    },
    onError: (error) => {
      toast.error(t('Failed to delete opportunity: ') + error.message);
    }
  });

  const [createActivity] = useMutation(CREATE_ACTIVITY, {
    onCompleted: () => {
      refetchActivities();
      setShowActivityModal(false);
      resetActivityForm();
    },
    onError: (error) => {
      toast.error(t('Failed to create activity: ') + error.message);
    }
  });

  const [createNote] = useMutation(CREATE_NOTE, {
    onCompleted: () => {
      refetchNotes();
      setShowNoteModal(false);
      resetNoteForm();
    },
    onError: (error) => {
      toast.error(t('Failed to create note: ') + error.message);
    }
  });

  const [togglePinNote] = useMutation(TOGGLE_PIN_NOTE, {
    onCompleted: () => {
      refetchNotes();
    }
  });

  const [_deleteNote] = useMutation(DELETE_NOTE, {
    onCompleted: () => {
      refetchNotes();
    }
  });

  const opportunity: Opportunity | null = opportunityData?.getOpportunity || null;
  const stageHistory: StageHistory[] = historyData?.getOpportunityStageHistory || [];
  const activities: Activity[] = activitiesData?.getActivitiesByOpportunity || [];
  const notes: Note[] = notesData?.getNotesByOpportunity || [];
  const pipelineStages = stagesData?.getPipelineStages || [];

  const currentStage = pipelineStages.find((s: unknown) => s.id === opportunity?.pipelineStageId);

  const resetActivityForm = () => {
    setActivityFormData({
      activityType: 'CALL',
      activitySubject: '',
      activityDescription: '',
      activityDate: new Date().toISOString().split('T')[0],
      durationMinutes: ''
    });
  };

  const resetNoteForm = () => {
    setNoteFormData({
      noteTitle: '',
      noteContent: '',
      noteType: 'GENERAL',
      isPinned: false
    });
  };

  const handleDeleteOpportunity = async () => {
    if (!confirm(t('Are you sure you want to delete this opportunity?'))) {
      return;
    }
    await deleteOpportunity({ variables: { id } });
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    await createActivity({
      variables: {
        input: {
          ...activityFormData,
          opportunityId: id,
          durationMinutes: activityFormData.durationMinutes ? parseInt(activityFormData.durationMinutes) : undefined,
          ownerUserId: user?.id
        }
      }
    });
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNote({
      variables: {
        input: {
          ...noteFormData,
          opportunityId: id
        }
      }
    });
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

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType.toLowerCase()) {
      case 'call':
        return <PhoneCall className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'meeting':
        return <Video className="w-4 h-4" />;
      case 'note':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-blue-100 text-blue-700';
      case 'won':
        return 'bg-green-100 text-green-700';
      case 'lost':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (opportunityLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-8 text-center text-gray-500">{t('Loading opportunity...')}</div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-8 text-center text-red-600">{t('Opportunity not found')}</div>
      </div>
    );
  }

  const bant = {
    budget: opportunity.budgetConfirmed,
    authority: opportunity.authorityConfirmed,
    need: opportunity.needConfirmed,
    timeline: opportunity.timelineConfirmed
  };
  const bantScore = Object.values(bant).filter(Boolean).length;

  return (
    <div className="flex-1 overflow-auto">
      <Breadcrumb
        items={[
          { label: t('CRM'), path: '/crm' },
          { label: t('Opportunities'), path: '/crm/opportunities' },
          { label: opportunity.opportunityName, path: `/crm/opportunities/${id}` }
        ]}
      />

      <div className="p-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Target className="w-8 h-8 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {opportunity.opportunityName}
                  </h1>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(opportunity.status)}`}>
                    {opportunity.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {opportunity.opportunityNumber}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('Estimated Value')}</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(opportunity.estimatedValue, opportunity.currencyCode)}
                    </div>
                    {opportunity.weightedValue !== undefined && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('Weighted')}: {formatCurrency(opportunity.weightedValue, opportunity.currencyCode)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('Current Stage')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {currentStage?.stageName || 'N/A'}
                    </div>
                    {opportunity.probabilityPercentage !== undefined && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {opportunity.probabilityPercentage}% {t('win probability')}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('Expected Close Date')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatDate(opportunity.expectedCloseDate)}
                    </div>
                    {opportunity.nextActionDate && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {t('Next Action')}: {formatDate(opportunity.nextActionDate)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => navigate(`/crm/opportunities/${id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Edit className="w-4 h-4" />
                {t('Edit')}
              </button>
              <button
                onClick={handleDeleteOpportunity}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900"
              >
                <Trash2 className="w-4 h-4" />
                {t('Delete')}
              </button>
            </div>
          </div>
        </div>

        {/* BANT Qualification */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('BANT Qualification')} ({bantScore}/4)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border-2 ${bant.budget ? 'border-green-500 bg-green-50 dark:bg-green-900' : 'border-gray-300 dark:border-gray-600'}`}>
              <div className="flex items-center gap-2">
                {bant.budget ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                <span className="font-medium text-gray-900 dark:text-white">{t('Budget')}</span>
              </div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${bant.authority ? 'border-green-500 bg-green-50 dark:bg-green-900' : 'border-gray-300 dark:border-gray-600'}`}>
              <div className="flex items-center gap-2">
                {bant.authority ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                <span className="font-medium text-gray-900 dark:text-white">{t('Authority')}</span>
              </div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${bant.need ? 'border-green-500 bg-green-50 dark:bg-green-900' : 'border-gray-300 dark:border-gray-600'}`}>
              <div className="flex items-center gap-2">
                {bant.need ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                <span className="font-medium text-gray-900 dark:text-white">{t('Need')}</span>
              </div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${bant.timeline ? 'border-green-500 bg-green-50 dark:bg-green-900' : 'border-gray-300 dark:border-gray-600'}`}>
              <div className="flex items-center gap-2">
                {bant.timeline ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                <span className="font-medium text-gray-900 dark:text-white">{t('Timeline')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 border-b-2 font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('Overview')}
              </button>
              <button
                onClick={() => setActiveTab('activities')}
                className={`py-4 border-b-2 font-medium transition-colors ${
                  activeTab === 'activities'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('Activities')} ({activities.length})
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-4 border-b-2 font-medium transition-colors ${
                  activeTab === 'notes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('Notes')} ({notes.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 border-b-2 font-medium transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('Stage History')} ({stageHistory.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('Opportunity Details')}
                  </h3>
                  <div className="space-y-3">
                    {opportunity.description && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Description')}:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{opportunity.description}</p>
                      </div>
                    )}
                    {opportunity.opportunityType && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Type')}:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{opportunity.opportunityType}</span>
                      </div>
                    )}
                    {opportunity.leadSource && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Lead Source')}:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{opportunity.leadSource}</span>
                      </div>
                    )}
                    {opportunity.nextActionDescription && (
                      <div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('Next Action')}:</span>
                        <p className="text-gray-900 dark:text-white mt-1">{opportunity.nextActionDescription}</p>
                      </div>
                    )}
                  </div>

                  {opportunity.productCategories && opportunity.productCategories.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Product Categories')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {opportunity.productCategories.map((category, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Tag className="w-3 h-3" />
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {opportunity.tags && opportunity.tags.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Tags')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {opportunity.tags.map((tag, idx) => (
                          <span key={idx} className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('Competitive Analysis')}
                  </h3>
                  {opportunity.competitors && opportunity.competitors.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Competitors')}</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {opportunity.competitors.map((competitor, idx) => (
                          <li key={idx} className="text-gray-600 dark:text-gray-400">{competitor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {opportunity.ourCompetitiveAdvantage && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Our Competitive Advantage')}</h4>
                      <p className="text-gray-600 dark:text-gray-400">{opportunity.ourCompetitiveAdvantage}</p>
                    </div>
                  )}

                  {opportunity.status === 'LOST' && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">{t('Lost Reason')}</h4>
                      <p className="text-sm text-red-700 dark:text-red-200">
                        {opportunity.lostReason}
                      </p>
                      {opportunity.lostReasonNotes && (
                        <p className="text-sm text-red-600 dark:text-red-300 mt-2">
                          {opportunity.lostReasonNotes}
                        </p>
                      )}
                    </div>
                  )}

                  {opportunity.notes && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('Notes')}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{opportunity.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Activities Tab */}
            {activeTab === 'activities' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('Activity Timeline')}
                  </h3>
                  <button
                    onClick={() => setShowActivityModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Log Activity')}
                  </button>
                </div>

                <div className="space-y-4">
                  {activities.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">{t('No activities recorded')}</div>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="border-l-4 border-blue-600 bg-gray-50 dark:bg-gray-700 rounded-r-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${activity.isCompleted ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
                            {getActivityIcon(activity.activityType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {activity.activitySubject}
                              </span>
                              {activity.isCompleted && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {activity.activityType} • {formatDateTime(activity.activityDate)}
                              {activity.durationMinutes && ` • ${activity.durationMinutes} min`}
                            </div>
                            {activity.activityDescription && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                {activity.activityDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('Notes')}
                  </h3>
                  <button
                    onClick={() => setShowNoteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Add Note')}
                  </button>
                </div>

                <div className="space-y-4">
                  {notes.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">{t('No notes added')}</div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {note.noteTitle && (
                              <h4 className="font-medium text-gray-900 dark:text-white">{note.noteTitle}</h4>
                            )}
                            {note.isPinned && (
                              <CheckCircle className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                          <button
                            onClick={() => togglePinNote({ variables: { id: note.id } })}
                            className="p-1 text-gray-600 hover:text-yellow-600"
                          >
                            <CheckCircle className={`w-4 h-4 ${note.isPinned ? 'text-yellow-500' : ''}`} />
                          </button>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{note.noteContent}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          {formatDateTime(note.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Stage History Tab */}
            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('Pipeline Stage History')}
                </h3>
                <div className="space-y-4">
                  {stageHistory.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">{t('No stage history available')}</div>
                  ) : (
                    stageHistory.map((history, idx) => (
                      <div key={history.id} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                          </div>
                          {idx < stageHistory.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-300 dark:bg-gray-600 mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex items-center gap-2 mb-1">
                            {history.fromStageName && (
                              <>
                                <span className="text-gray-600 dark:text-gray-400">{history.fromStageName}</span>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </>
                            )}
                            <span className="font-semibold text-gray-900 dark:text-white">{history.toStageName}</span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDateTime(history.stageChangedAt)}
                            {history.daysInPreviousStage !== undefined && (
                              <span className="ml-2">
                                • {history.daysInPreviousStage} {t('days in previous stage')}
                              </span>
                            )}
                          </div>
                          {history.changeReason && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                              {history.changeReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Modal - Same as ContactDetailPage */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('Log Activity')}
              </h2>
            </div>

            <form onSubmit={handleCreateActivity} className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Activity Type')} *
                  </label>
                  <select
                    required
                    value={activityFormData.activityType}
                    onChange={(e) => setActivityFormData({ ...activityFormData, activityType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="NOTE">Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Subject')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={activityFormData.activitySubject}
                    onChange={(e) => setActivityFormData({ ...activityFormData, activitySubject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Description')}
                  </label>
                  <textarea
                    rows={3}
                    value={activityFormData.activityDescription}
                    onChange={(e) => setActivityFormData({ ...activityFormData, activityDescription: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Date')} *
                    </label>
                    <input
                      type="date"
                      required
                      value={activityFormData.activityDate}
                      onChange={(e) => setActivityFormData({ ...activityFormData, activityDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Duration (minutes)')}
                    </label>
                    <input
                      type="number"
                      value={activityFormData.durationMinutes}
                      onChange={(e) => setActivityFormData({ ...activityFormData, durationMinutes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowActivityModal(false);
                    resetActivityForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('Log Activity')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note Modal - Same as ContactDetailPage */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('Add Note')}
              </h2>
            </div>

            <form onSubmit={handleCreateNote} className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Title')}
                  </label>
                  <input
                    type="text"
                    value={noteFormData.noteTitle}
                    onChange={(e) => setNoteFormData({ ...noteFormData, noteTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('Note')} *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={noteFormData.noteContent}
                    onChange={(e) => setNoteFormData({ ...noteFormData, noteContent: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('Type')}
                    </label>
                    <select
                      value={noteFormData.noteType}
                      onChange={(e) => setNoteFormData({ ...noteFormData, noteType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <option value="GENERAL">General</option>
                      <option value="MEETING">Meeting</option>
                      <option value="FOLLOW_UP">Follow-up</option>
                      <option value="INTERNAL">Internal</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={noteFormData.isPinned}
                        onChange={(e) => setNoteFormData({ ...noteFormData, isPinned: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('Pin this note')}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteModal(false);
                    resetNoteForm();
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {t('Add Note')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
