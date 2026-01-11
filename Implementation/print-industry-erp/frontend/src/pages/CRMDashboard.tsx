import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Target,
  Activity,
  TrendingUp,
  DollarSign,
  Calendar,
  PhoneCall,
  Mail,
  CheckCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  ArrowRight
} from 'lucide-react';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { Chart } from '../components/common/Chart';
import { useAuthStore } from '../store/authStore';
import {
  GET_PIPELINE_SUMMARY,
  GET_OPPORTUNITIES_REQUIRING_ACTION,
  GET_CONTACTS_REQUIRING_FOLLOW_UP,
  GET_RECENT_ACTIVITIES,
  GET_ACTIVITY_SUMMARY
} from '../graphql/queries/crm';

interface PipelineSummary {
  stageId: string;
  stageName: string;
  sequenceNumber: number;
  opportunityCount: number;
  totalValue: number;
  totalWeightedValue: number;
  avgProbability: number;
}

interface Opportunity {
  id: string;
  opportunityNumber: string;
  opportunityName: string;
  estimatedValue: number;
  currencyCode: string;
  nextActionDate: string;
  nextActionDescription: string;
  ownerUserId: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  emailPrimary: string;
  phoneMobile: string;
  nextFollowUpDate: string;
  lastContactDate: string;
}

interface Activity {
  id: string;
  activityType: string;
  activitySubject: string;
  activityDate: string;
  isCompleted: boolean;
  opportunityId?: string;
  contactId?: string;
}

interface ActivitySummary {
  activityType: string;
  activityCount: number;
  totalMinutes: number;
  completedCount: number;
}

export const CRMDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state: { user: { id?: string } | null }) => state.user);

  const [dateRange, _setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Pipeline Summary Query
  const { data: pipelineData, loading: pipelineLoading } = useQuery(GET_PIPELINE_SUMMARY, {
    variables: { ownerUserId: user?.id },
    skip: !user?.id
  });

  // Opportunities Requiring Action Query
  const { data: actionData, loading: actionLoading } = useQuery(GET_OPPORTUNITIES_REQUIRING_ACTION, {
    variables: { ownerUserId: user?.id },
    skip: !user?.id
  });

  // Contacts Requiring Follow-up Query
  const { data: followUpData, loading: followUpLoading } = useQuery(GET_CONTACTS_REQUIRING_FOLLOW_UP, {
    variables: { ownerUserId: user?.id },
    skip: !user?.id
  });

  // Recent Activities Query
  const { data: activityData, loading: activityDataLoading } = useQuery(GET_RECENT_ACTIVITIES, {
    variables: { ownerUserId: user?.id, limit: 10 },
    skip: !user?.id
  });

  // Activity Summary Query
  const { data: activitySummaryData, loading: activitySummaryLoading } = useQuery(GET_ACTIVITY_SUMMARY, {
    variables: {
      ownerUserId: user?.id,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    },
    skip: !user?.id
  });

  const pipelineSummary: PipelineSummary[] = pipelineData?.getPipelineSummary || [];
  const opportunitiesRequiringAction: Opportunity[] = actionData?.getOpportunitiesRequiringAction || [];
  const contactsRequiringFollowUp: Contact[] = followUpData?.getContactsRequiringFollowUp || [];
  const recentActivities: Activity[] = activityData?.getRecentActivities || [];
  const activitySummary: ActivitySummary[] = activitySummaryData?.getActivitySummary || [];

  // Calculate KPIs
  const totalOpportunities = pipelineSummary.reduce((sum, stage) => sum + stage.opportunityCount, 0);
  const totalPipelineValue = pipelineSummary.reduce((sum, stage) => sum + stage.totalValue, 0);
  const totalWeightedValue = pipelineSummary.reduce((sum, stage) => sum + stage.totalWeightedValue, 0);
  const totalActivities = activitySummary.reduce((sum, item) => sum + item.activityCount, 0);
  const completedActivities = activitySummary.reduce((sum, item) => sum + item.completedCount, 0);
  const activityCompletionRate = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;

  // Prepare Pipeline Chart Data
  const pipelineChartData = {
    labels: pipelineSummary.map(stage => stage.stageName),
    datasets: [
      {
        label: t('Opportunity Count'),
        data: pipelineSummary.map(stage => stage.opportunityCount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
      },
      {
        label: t('Total Value ($)'),
        data: pipelineSummary.map(stage => stage.totalValue / 1000),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        yAxisID: 'y1'
      }
    ]
  };

  const pipelineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: t('Sales Pipeline Overview')
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: t('Count')
        }
      },
      y1: {
        beginAtZero: true,
        position: 'right' as const,
        title: {
          display: true,
          text: t('Value ($K)')
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  // Prepare Activity Type Chart Data
  const activityTypeChartData = {
    labels: activitySummary.map(item => item.activityType),
    datasets: [
      {
        label: t('Activity Count'),
        data: activitySummary.map(item => item.activityCount),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ]
      }
    ]
  };

  const activityTypeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const
      },
      title: {
        display: true,
        text: t('Activities by Type')
      }
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType.toLowerCase()) {
      case 'call':
        return <PhoneCall className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'meeting':
        return <Users className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="flex-1 overflow-auto">
      <Breadcrumb
        items={[
          { label: t('CRM'), path: '/crm' }
        ]}
      />

      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('CRM Dashboard')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('Track your sales pipeline, contacts, and activities')}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Target className="w-6 h-6 text-blue-600 dark:text-blue-300" />
              </div>
              <button
                onClick={() => navigate('/crm/opportunities')}
                className="text-blue-600 hover:text-blue-700"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {totalOpportunities}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('Active Opportunities')}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-300" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(totalPipelineValue)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('Pipeline Value')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t('Weighted')}: {formatCurrency(totalWeightedValue)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-300" />
              </div>
              <button
                onClick={() => navigate('/crm/contacts')}
                className="text-purple-600 hover:text-purple-700"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {contactsRequiringFollowUp.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('Follow-ups Due')}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <Activity className="w-6 h-6 text-yellow-600 dark:text-yellow-300" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {activityCompletionRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('Activity Completion')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {completedActivities} / {totalActivities} {t('completed')}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {t('Sales Pipeline')}
              </h2>
            </div>
            <div style={{ height: '300px' }}>
              {pipelineLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">{t('Loading...')}</div>
                </div>
              ) : (
                <Chart type="bar" data={pipelineChartData} options={pipelineChartOptions} />
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                {t('Activity Breakdown')}
              </h2>
            </div>
            <div style={{ height: '300px' }}>
              {activitySummaryLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">{t('Loading...')}</div>
                </div>
              ) : (
                <Chart type="pie" data={activityTypeChartData} options={activityTypeChartOptions} />
              )}
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Opportunities Requiring Action */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                {t('Opportunities Requiring Action')}
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {actionLoading ? (
                <div className="p-6 text-center text-gray-500">{t('Loading...')}</div>
              ) : opportunitiesRequiringAction.length === 0 ? (
                <div className="p-6 text-center text-gray-500">{t('No action items')}</div>
              ) : (
                opportunitiesRequiringAction.slice(0, 5).map((opp) => (
                  <div
                    key={opp.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {opp.opportunityName}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {opp.nextActionDescription}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(opp.estimatedValue, opp.currencyCode)}
                        </div>
                        <div className={`text-sm mt-1 ${isOverdue(opp.nextActionDate) ? 'text-red-600' : 'text-gray-600'}`}>
                          {formatDate(opp.nextActionDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Contacts Requiring Follow-up */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                {t('Follow-ups Due')}
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {followUpLoading ? (
                <div className="p-6 text-center text-gray-500">{t('Loading...')}</div>
              ) : contactsRequiringFollowUp.length === 0 ? (
                <div className="p-6 text-center text-gray-500">{t('No follow-ups due')}</div>
              ) : (
                contactsRequiringFollowUp.slice(0, 5).map((contact) => (
                  <div
                    key={contact.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {contact.emailPrimary}
                        </div>
                        {contact.phoneMobile && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {contact.phoneMobile}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className={`text-sm ${isOverdue(contact.nextFollowUpDate) ? 'text-red-600' : 'text-gray-600'}`}>
                          {formatDate(contact.nextFollowUpDate)}
                        </div>
                        {contact.lastContactDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            {t('Last contact')}: {formatDate(contact.lastContactDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              {t('Recent Activities')}
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {activityDataLoading ? (
              <div className="p-6 text-center text-gray-500">{t('Loading...')}</div>
            ) : recentActivities.length === 0 ? (
              <div className="p-6 text-center text-gray-500">{t('No recent activities')}</div>
            ) : (
              recentActivities.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${activity.isCompleted ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
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
                        {activity.activityType} • {formatDate(activity.activityDate)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
