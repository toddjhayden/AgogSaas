/**
 * Predictive Maintenance Dashboard
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DataTable } from '../components/common/DataTable';
import { Chart } from '../components/common/Chart';
import { FacilitySelector } from '../components/common/FacilitySelector';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Settings,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  GET_PREDICTIVE_MAINTENANCE_DASHBOARD,
  GET_EQUIPMENT_HEALTH_SCORES,
  GET_PREDICTIVE_MAINTENANCE_ALERTS,
  GET_MAINTENANCE_RECOMMENDATIONS,
  ACKNOWLEDGE_PREDICTIVE_MAINTENANCE_ALERT,
  APPROVE_MAINTENANCE_RECOMMENDATION,
} from '../graphql/queries/predictiveMaintenance';
import { toast } from 'react-hot-toast';

export const PredictiveMaintenanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [timeRange] = useState<string>('LAST_30_DAYS');

  // Queries
  const {
    data: dashboardData,
  } = useQuery(GET_PREDICTIVE_MAINTENANCE_DASHBOARD, {
    variables: { facilityId: selectedFacility || undefined, timeRange },
    pollInterval: 30000, // Refresh every 30 seconds
  });

  const { data: healthScoresData, loading: healthScoresLoading } = useQuery(
    GET_EQUIPMENT_HEALTH_SCORES,
    {
      variables: {
        facilityId: selectedFacility || undefined,
        limit: 50,
      },
    }
  );

  const { data: alertsData, loading: alertsLoading, refetch: refetchAlerts } = useQuery(
    GET_PREDICTIVE_MAINTENANCE_ALERTS,
    {
      variables: {
        facilityId: selectedFacility || undefined,
        status: 'OPEN',
        limit: 50,
      },
    }
  );

  const {
    data: recommendationsData,
    loading: recommendationsLoading,
    refetch: refetchRecommendations,
  } = useQuery(GET_MAINTENANCE_RECOMMENDATIONS, {
    variables: {
      facilityId: selectedFacility || undefined,
      approvalStatus: 'PENDING',
      limit: 20,
    },
  });

  // Mutations
  const [acknowledgeAlert] = useMutation(ACKNOWLEDGE_PREDICTIVE_MAINTENANCE_ALERT);
  const [approveRecommendation] = useMutation(APPROVE_MAINTENANCE_RECOMMENDATION);

  const dashboard = dashboardData?.predictiveMaintenanceDashboard;
  const healthScores = healthScoresData?.equipmentHealthScores || [];
  const alerts = alertsData?.predictiveMaintenanceAlerts || [];
  const recommendations = recommendationsData?.maintenanceRecommendations || [];

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgeAlert({
        variables: { alertId, notes: 'Acknowledged from dashboard' },
      });
      toast.success('Alert acknowledged successfully');
      refetchAlerts();
    } catch (error) {
      toast.error('Failed to acknowledge alert');
      console.error(error);
    }
  };

  // Handle recommendation approval
  const handleApproveRecommendation = async (id: string) => {
    try {
      await approveRecommendation({
        variables: { id, notes: 'Approved from dashboard' },
      });
      toast.success('Recommendation approved successfully');
      refetchRecommendations();
    } catch (error) {
      toast.error('Failed to approve recommendation');
      console.error(error);
    }
  };

  // Severity badge color
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'destructive',
      HIGH: 'destructive',
      MEDIUM: 'default',
      LOW: 'secondary',
    };
    return colors[severity] || 'default';
  };

  // Health status badge color
  const getHealthStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      EXCELLENT: 'default',
      GOOD: 'default',
      FAIR: 'default',
      POOR: 'destructive',
      CRITICAL: 'destructive',
    };
    return colors[status] || 'default';
  };

  // Urgency badge color
  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      IMMEDIATE: 'destructive',
      URGENT: 'destructive',
      SOON: 'default',
      ROUTINE: 'secondary',
    };
    return colors[urgency] || 'default';
  };

  // Alert columns
  const alertColumns = [
    {
      header: 'Alert Type',
      accessorKey: 'alertType',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{row.alertType?.replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    {
      header: 'Equipment',
      accessorKey: 'workCenterId',
      cell: (row: any) => <span className="text-sm">{row.workCenterId}</span>,
    },
    {
      header: 'Failure Mode',
      accessorKey: 'predictedFailureMode',
    },
    {
      header: 'Probability',
      accessorKey: 'failureProbability',
      cell: (row: any) =>
        row.failureProbability ? (
          <Badge variant="outline">{(row.failureProbability * 100).toFixed(1)}%</Badge>
        ) : (
          '-'
        ),
    },
    {
      header: 'Time to Failure',
      accessorKey: 'timeToFailureHours',
      cell: (row: any) =>
        row.timeToFailureHours ? (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{Math.round(row.timeToFailureHours)}h</span>
          </div>
        ) : (
          '-'
        ),
    },
    {
      header: 'Severity',
      accessorKey: 'severity',
      cell: (row: any) => (
        <Badge variant={getSeverityColor(row.severity) as any}>{row.severity}</Badge>
      ),
    },
    {
      header: 'Urgency',
      accessorKey: 'urgency',
      cell: (row: any) => (
        <Badge variant={getUrgencyColor(row.urgency) as any}>{row.urgency}</Badge>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      cell: (row: any) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAcknowledgeAlert(row.id)}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Acknowledge
        </Button>
      ),
    },
  ];

  // Health scores columns
  const healthScoreColumns = [
    {
      header: 'Equipment',
      accessorKey: 'workCenterId',
      cell: (row: any) => <span className="font-medium">{row.workCenterId}</span>,
    },
    {
      header: 'Overall Health',
      accessorKey: 'overallHealthScore',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                row.overallHealthScore >= 80
                  ? 'bg-green-500'
                  : row.overallHealthScore >= 60
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${row.overallHealthScore}%` }}
            />
          </div>
          <span className="font-medium w-12 text-right">
            {row.overallHealthScore.toFixed(0)}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'healthStatus',
      cell: (row: any) => (
        <Badge variant={getHealthStatusColor(row.healthStatus) as any}>
          {row.healthStatus}
        </Badge>
      ),
    },
    {
      header: 'Trend',
      accessorKey: 'trendDirection',
      cell: (row: any) =>
        row.trendDirection === 'IMPROVING' ? (
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Improving</span>
          </div>
        ) : row.trendDirection === 'DEGRADING' ||
          row.trendDirection === 'RAPIDLY_DEGRADING' ? (
          <div className="flex items-center gap-1 text-red-600">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs">Degrading</span>
          </div>
        ) : (
          <span className="text-xs text-gray-500">Stable</span>
        ),
    },
    {
      header: 'Sensor Health',
      accessorKey: 'sensorHealthScore',
      cell: (row: any) => (
        <span className="text-sm">{row.sensorHealthScore?.toFixed(0) || '-'}</span>
      ),
    },
    {
      header: 'OEE Health',
      accessorKey: 'oeeHealthScore',
      cell: (row: any) => (
        <span className="text-sm">{row.oeeHealthScore?.toFixed(0) || '-'}</span>
      ),
    },
    {
      header: 'Anomaly',
      accessorKey: 'anomalyDetected',
      cell: (row: any) =>
        row.anomalyDetected ? (
          <Badge variant="destructive">
            <Bell className="h-3 w-3 mr-1" />
            Yes
          </Badge>
        ) : (
          <span className="text-xs text-gray-500">No</span>
        ),
    },
  ];

  // Recommendations columns
  const recommendationColumns = [
    {
      header: 'Type',
      accessorKey: 'recommendationType',
      cell: (row: any) => (
        <Badge variant="outline">{row.recommendationType?.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      header: 'Equipment',
      accessorKey: 'workCenterId',
    },
    {
      header: 'Current Strategy',
      accessorKey: 'currentMaintenanceStrategy',
    },
    {
      header: 'Recommended Strategy',
      accessorKey: 'recommendedMaintenanceStrategy',
    },
    {
      header: 'Cost Savings',
      accessorKey: 'projectedCostSavings',
      cell: (row: any) =>
        row.projectedCostSavings ? (
          <span className="font-medium text-green-600">
            ${row.projectedCostSavings.toLocaleString()}
          </span>
        ) : (
          '-'
        ),
    },
    {
      header: 'ROI',
      accessorKey: 'roiPercentage',
      cell: (row: any) =>
        row.roiPercentage ? (
          <Badge variant="default">{row.roiPercentage.toFixed(1)}%</Badge>
        ) : (
          '-'
        ),
    },
    {
      header: 'Priority',
      accessorKey: 'implementationPriority',
      cell: (row: any) => (
        <Badge
          variant={
            row.implementationPriority === 'URGENT' ? 'destructive' : 'default'
          }
        >
          {row.implementationPriority}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      cell: (row: any) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleApproveRecommendation(row.id)}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('predictiveMaintenance.title')}</h1>
          <p className="text-gray-500">{t('predictiveMaintenance.subtitle')}</p>
        </div>
        <FacilitySelector
          value={selectedFacility}
          onChange={setSelectedFacility}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Equipment</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.totalEquipment || 0}</div>
            <p className="text-xs text-gray-500">
              Avg Health: {dashboard?.averageHealthScore?.toFixed(1) || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {dashboard?.totalActiveAlerts || 0}
            </div>
            <p className="text-xs text-gray-500">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Predicted Failures (30d)
            </CardTitle>
            <Zap className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dashboard?.predictedFailuresNext30Days || 0}
            </div>
            <p className="text-xs text-gray-500">
              Next 7d: {dashboard?.predictedFailuresNext7Days || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Potential Savings
            </CardTitle>
            <Wrench className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${(dashboard?.potentialAnnualSavings || 0).toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">
              {dashboard?.activeRecommendations || 0} recommendations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Equipment Health Status Distribution */}
      {dashboard?.equipmentByHealthStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Equipment Health Distribution</CardTitle>
            <CardDescription>
              Current health status across all equipment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Chart
              type="pie"
              data={{
                labels: dashboard.equipmentByHealthStatus.map(
                  (item: any) => item.status
                ),
                datasets: [
                  {
                    label: 'Equipment Count',
                    data: dashboard.equipmentByHealthStatus.map(
                      (item: any) => item.count
                    ),
                    backgroundColor: [
                      '#10b981', // EXCELLENT - green
                      '#3b82f6', // GOOD - blue
                      '#f59e0b', // FAIR - yellow
                      '#ef4444', // POOR - red
                      '#dc2626', // CRITICAL - dark red
                    ],
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'right',
                  },
                },
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Active Alerts ({alerts.length})
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            Equipment Health ({healthScores.length})
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <Wrench className="h-4 w-4 mr-2" />
            Recommendations ({recommendations.length})
          </TabsTrigger>
          <TabsTrigger value="models">
            <Settings className="h-4 w-4 mr-2" />
            ML Models
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Predictive Maintenance Alerts</CardTitle>
              <CardDescription>
                AI-generated alerts requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading alerts...</div>
              ) : alerts.length > 0 ? (
                <DataTable columns={alertColumns} data={alerts} />
              ) : (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    No active alerts. All equipment is operating within normal
                    parameters.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Health Scores</CardTitle>
              <CardDescription>
                Real-time health assessment for all equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthScoresLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading health scores...
                </div>
              ) : healthScores.length > 0 ? (
                <DataTable columns={healthScoreColumns} data={healthScores} />
              ) : (
                <Alert>
                  <AlertDescription>
                    No health score data available. Run health score calculations
                    to begin monitoring.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Optimization Recommendations</CardTitle>
              <CardDescription>
                Data-driven recommendations to optimize maintenance intervals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading recommendations...
                </div>
              ) : recommendations.length > 0 ? (
                <DataTable columns={recommendationColumns} data={recommendations} />
              ) : (
                <Alert>
                  <AlertDescription>
                    No pending recommendations. The system is monitoring for
                    optimization opportunities.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ML Models</CardTitle>
              <CardDescription>
                Deployed machine learning models for predictive maintenance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Model management interface - Coming soon
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PredictiveMaintenanceDashboard;
