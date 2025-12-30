import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Alert,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { GET_WORKFLOW_ANALYTICS } from '../graphql/queries/workflow';

interface WorkflowAnalytics {
  workflowDefinitionId: string;
  workflowName: string;
  workflowVersion: number;
  category?: string;
  tenantId: string;
  totalInstances: number;
  completedInstances: number;
  failedInstances: number;
  runningInstances: number;
  escalatedInstances: number;
  avgCompletionHours?: number;
  onTimeCompletions: number;
  lateCompletions: number;
  slaCompliancePercentage?: number;
}

const COLORS = {
  completed: '#4caf50',
  running: '#2196f3',
  failed: '#f44336',
  escalated: '#ff9800',
  onTime: '#4caf50',
  late: '#f44336',
};

const WorkflowAnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // GraphQL Query
  const { data, loading, error } = useQuery(GET_WORKFLOW_ANALYTICS, {
    variables: {
      category: categoryFilter || undefined,
    },
  });

  const analytics: WorkflowAnalytics[] = data?.workflowAnalytics || [];

  // Aggregate totals across all workflows
  const totalInstances = analytics.reduce((sum, a) => sum + a.totalInstances, 0);
  const totalCompleted = analytics.reduce((sum, a) => sum + a.completedInstances, 0);
  const totalFailed = analytics.reduce((sum, a) => sum + a.failedInstances, 0);
  const totalRunning = analytics.reduce((sum, a) => sum + a.runningInstances, 0);
  const totalEscalated = analytics.reduce((sum, a) => sum + a.escalatedInstances, 0);
  const totalOnTime = analytics.reduce((sum, a) => sum + a.onTimeCompletions, 0);
  const totalLate = analytics.reduce((sum, a) => sum + a.lateCompletions, 0);

  const avgCompletionTime =
    analytics.filter((a) => a.avgCompletionHours).length > 0
      ? analytics.reduce((sum, a) => sum + (a.avgCompletionHours || 0), 0) / analytics.length
      : 0;

  const overallSlaCompliance =
    totalOnTime + totalLate > 0 ? (totalOnTime / (totalOnTime + totalLate)) * 100 : 0;

  // Prepare chart data
  const statusData = [
    { name: t('workflow.analytics.completed'), value: totalCompleted, color: COLORS.completed },
    { name: t('workflow.analytics.running'), value: totalRunning, color: COLORS.running },
    { name: t('workflow.analytics.failed'), value: totalFailed, color: COLORS.failed },
    { name: t('workflow.analytics.escalated'), value: totalEscalated, color: COLORS.escalated },
  ];

  const slaComplianceData = [
    { name: t('workflow.analytics.onTime'), value: totalOnTime, color: COLORS.onTime },
    { name: t('workflow.analytics.late'), value: totalLate, color: COLORS.late },
  ];

  const workflowCompletionData = analytics
    .filter((a) => a.avgCompletionHours)
    .sort((a, b) => (b.avgCompletionHours || 0) - (a.avgCompletionHours || 0))
    .slice(0, 10)
    .map((a) => ({
      name: a.workflowName.substring(0, 20),
      hours: a.avgCompletionHours,
    }));

  // Get unique categories
  const categories = Array.from(new Set(analytics.map((a) => a.category).filter(Boolean)));

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('workflow.analytics.errorLoading')}: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          {t('workflow.analytics.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('workflow.analytics.description')}
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('workflow.analytics.filterByCategory')}</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  label={t('workflow.analytics.filterByCategory')}
                >
                  <MenuItem value="">{t('workflow.analytics.allCategories')}</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4">{totalInstances}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.analytics.totalInstances')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="success.main">
                {totalCompleted}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.analytics.completed')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4">{avgCompletionTime.toFixed(1)}h</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.analytics.avgCompletionTime')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography
                variant="h4"
                color={overallSlaCompliance >= 80 ? 'success.main' : 'error'}
              >
                {overallSlaCompliance.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.analytics.slaCompliance')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Instances by Status Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('workflow.analytics.instancesByStatus')}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* SLA Compliance Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('workflow.analytics.slaCompliance')}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={slaComplianceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {slaComplianceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Average Completion Time by Workflow */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('workflow.analytics.avgCompletionByWorkflow')}
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={workflowCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hours" fill={COLORS.completed} name={t('workflow.analytics.hours')} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Workflow Analytics Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('workflow.analytics.detailedMetrics')}
              </Typography>
              {analytics.length === 0 ? (
                <Alert severity="info">{t('workflow.analytics.noData')}</Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('workflow.analytics.workflow')}</TableCell>
                        <TableCell>{t('workflow.analytics.category')}</TableCell>
                        <TableCell align="right">{t('workflow.analytics.totalInstances')}</TableCell>
                        <TableCell align="right">{t('workflow.analytics.completed')}</TableCell>
                        <TableCell align="right">{t('workflow.analytics.failed')}</TableCell>
                        <TableCell align="right">{t('workflow.analytics.running')}</TableCell>
                        <TableCell align="right">{t('workflow.analytics.escalated')}</TableCell>
                        <TableCell align="right">{t('workflow.analytics.avgCompletionTime')}</TableCell>
                        <TableCell align="right">{t('workflow.analytics.slaCompliance')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analytics.map((workflow) => (
                        <TableRow key={workflow.workflowDefinitionId}>
                          <TableCell>
                            {workflow.workflowName}
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              v{workflow.workflowVersion}
                            </Typography>
                          </TableCell>
                          <TableCell>{workflow.category || '-'}</TableCell>
                          <TableCell align="right">{workflow.totalInstances}</TableCell>
                          <TableCell align="right">
                            <Typography color="success.main">{workflow.completedInstances}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="error">{workflow.failedInstances}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="info.main">{workflow.runningInstances}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="warning.main">{workflow.escalatedInstances}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            {workflow.avgCompletionHours
                              ? `${workflow.avgCompletionHours.toFixed(1)}h`
                              : '-'}
                          </TableCell>
                          <TableCell align="right">
                            {workflow.slaCompliancePercentage !== null &&
                            workflow.slaCompliancePercentage !== undefined ? (
                              <Typography
                                color={workflow.slaCompliancePercentage >= 80 ? 'success.main' : 'error'}
                              >
                                {workflow.slaCompliancePercentage.toFixed(1)}%
                              </Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default WorkflowAnalyticsDashboard;
