import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import {
  Undo as RollbackIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Timeline as MetricsIcon,
} from '@mui/icons-material';
import {
  GET_ROLLBACK_ELIGIBLE_DEPLOYMENTS,
  GET_ROLLBACK_DECISION_CRITERIA,
  GET_DEPLOYMENT_ROLLBACKS,
  GET_ROLLBACK_HEALTH_METRICS,
  ROLLBACK_DEPLOYMENT,
} from '../graphql/queries/rollbackDecision';
import type {
  RollbackEligibleDeployment,
  DeploymentEnvironment,
  RollbackType,
  RollbackHealthMetrics,
  DeploymentRollback,
  GetRollbackEligibleDeploymentsResponse,
  GetRollbackDecisionCriteriaResponse,
  GetRollbackHealthMetricsResponse,
  GetDeploymentRollbacksResponse,
} from '../types/rollback';
import { useHealthScore } from '../hooks/useHealthScore';

/**
 * RollbackDecisionPage
 *
 * Dashboard for managing deployment rollback decisions.
 * Displays eligible deployments, health metrics, and rollback criteria.
 *
 * Features:
 * - List of rollback-eligible deployments with health metrics
 * - Environment-based filtering
 * - Real-time health status
 * - Manual rollback execution
 * - Rollback history tracking
 * - Auto-rollback rule configuration display
 *
 * P1 Improvements Applied (REQ-DEVOPS-ROLLBACK-1767150339448):
 * - TypeScript types for all data structures
 * - Custom hook for health score calculations
 * - Emergency rollback confirmation dialog
 * - Toast notifications instead of alert()
 */
const RollbackDecisionPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { calculateHealthScore, getHealthScoreColor, getHealthCheckColor } =
    useHealthScore();

  // Mock user context (replace with actual auth context)
  const tenantId = 'default';
  const currentUserId = 'user123';

  // State
  const [environmentFilter, setEnvironmentFilter] =
    useState<DeploymentEnvironment | ''>('');
  const [selectedDeployment, setSelectedDeployment] =
    useState<RollbackEligibleDeployment | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Dialog states
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [emergencyConfirmDialogOpen, setEmergencyConfirmDialogOpen] =
    useState(false);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Form states
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackType, setRollbackType] = useState<RollbackType>('MANUAL');
  const [emergencyConfirmText, setEmergencyConfirmText] = useState('');

  // GraphQL Queries
  const {
    data: deploymentsData,
    loading: deploymentsLoading,
    error: deploymentsError,
    refetch: refetchDeployments,
  } = useQuery<GetRollbackEligibleDeploymentsResponse>(
    GET_ROLLBACK_ELIGIBLE_DEPLOYMENTS,
    {
      variables: {
        tenantId,
        environment: environmentFilter || undefined,
        limit: 50,
        offset: 0,
      },
      pollInterval: autoRefresh ? 30000 : 0,
    }
  );

  const { data: criteriaData } =
    useQuery<GetRollbackDecisionCriteriaResponse>(
      GET_ROLLBACK_DECISION_CRITERIA,
      {
        variables: {
          tenantId,
          environment: environmentFilter || undefined,
          isActive: true,
        },
      }
    );

  const { data: metricsData, loading: metricsLoading } =
    useQuery<GetRollbackHealthMetricsResponse>(GET_ROLLBACK_HEALTH_METRICS, {
      variables: {
        deploymentId: selectedDeployment?.deploymentId,
        tenantId,
        limit: 20,
      },
      skip: !selectedDeployment || !metricsDialogOpen,
    });

  const { data: historyData, loading: historyLoading } =
    useQuery<GetDeploymentRollbacksResponse>(GET_DEPLOYMENT_ROLLBACKS, {
      variables: {
        deploymentId: selectedDeployment?.deploymentId,
        tenantId,
      },
      skip: !selectedDeployment || !historyDialogOpen,
    });

  // GraphQL Mutations
  const [rollbackDeployment] = useMutation(ROLLBACK_DEPLOYMENT);

  // Manual refresh
  const handleRefresh = () => {
    refetchDeployments();
  };

  // Handle rollback type change
  const handleRollbackTypeChange = (event: SelectChangeEvent<RollbackType>) => {
    const newType = event.target.value as RollbackType;
    setRollbackType(newType);
  };

  // Handle environment filter change
  const handleEnvironmentFilterChange = (event: SelectChangeEvent) => {
    setEnvironmentFilter(event.target.value as DeploymentEnvironment | '');
  };

  // Initiate rollback (with emergency confirmation if needed)
  const handleInitiateRollback = () => {
    if (!selectedDeployment || !rollbackReason.trim()) return;

    // P1: Emergency rollback confirmation
    if (rollbackType === 'EMERGENCY') {
      setRollbackDialogOpen(false);
      setEmergencyConfirmDialogOpen(true);
    } else {
      executeRollback();
    }
  };

  // Execute rollback after confirmations
  const executeRollback = async () => {
    if (!selectedDeployment || !rollbackReason.trim()) return;

    try {
      await rollbackDeployment({
        variables: {
          deploymentId: selectedDeployment.deploymentId,
          tenantId,
          rolledBackByUserId: currentUserId,
          rollbackReason,
          rollbackType,
        },
      });

      // Close all dialogs
      setRollbackDialogOpen(false);
      setEmergencyConfirmDialogOpen(false);
      setRollbackReason('');
      setEmergencyConfirmText('');
      setSelectedDeployment(null);

      // Refresh data
      refetchDeployments();

      // P2: Toast notification instead of alert()
      enqueueSnackbar(
        t('rollback.success.initiated', {
          deployment: selectedDeployment.deploymentNumber,
        }),
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Error rolling back deployment:', error);

      // P2: Toast notification instead of alert()
      enqueueSnackbar(
        t('rollback.error.failed', {
          deployment: selectedDeployment.deploymentNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { variant: 'error' }
      );
    }
  };

  // Handle emergency confirmation
  const handleEmergencyConfirm = () => {
    if (emergencyConfirmText === 'EMERGENCY') {
      executeRollback();
    } else {
      enqueueSnackbar(t('rollback.error.emergencyConfirmFailed'), {
        variant: 'warning',
      });
    }
  };

  const deployments = deploymentsData?.getRollbackEligibleDeployments || [];
  const criteria = criteriaData?.getRollbackDecisionCriteria || [];
  const metrics = metricsData?.getRollbackHealthMetrics || [];
  const rollbackHistory = historyData?.getDeploymentRollbacks || [];

  // Environment badge color
  const getEnvironmentColor = (
    env: DeploymentEnvironment
  ): 'error' | 'warning' | 'info' | 'default' => {
    switch (env) {
      case 'PRODUCTION':
        return 'error';
      case 'PRE_PRODUCTION':
        return 'warning';
      case 'STAGING':
        return 'info';
      default:
        return 'default';
    }
  };

  // Format time since deployment
  const formatTimeSince = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m ago`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
    return `${Math.round(minutes / 1440)}d ago`;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('rollback.decision.title')}</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ mr: 1 }}
          >
            {t('common.refresh')}
          </Button>
          <Button
            variant={autoRefresh ? 'contained' : 'outlined'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? t('rollback.autoRefreshOn') : t('rollback.autoRefreshOff')}
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('rollback.stats.eligibleDeployments')}
              </Typography>
              <Typography variant="h4">{deployments.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('rollback.stats.activeRules')}
              </Typography>
              <Typography variant="h4">{criteria.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#fff3e0' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('rollback.stats.unhealthyDeployments')}
              </Typography>
              <Typography variant="h4" color="warning.main">
                {
                  deployments.filter(
                    (d) => calculateHealthScore(d) < 70
                  ).length
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#ffebee' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('rollback.stats.autoRollbackEnabled')}
              </Typography>
              <Typography variant="h4" color="error.main">
                {deployments.filter((d) => d.autoRollbackEnabled).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Environment Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl fullWidth size="small" sx={{ maxWidth: 300 }}>
            <InputLabel>{t('rollback.filters.environment')}</InputLabel>
            <Select
              value={environmentFilter}
              onChange={handleEnvironmentFilterChange}
              label={t('rollback.filters.environment')}
            >
              <MenuItem value="">{t('common.all')}</MenuItem>
              <MenuItem value="PRODUCTION">Production</MenuItem>
              <MenuItem value="PRE_PRODUCTION">Pre-Production</MenuItem>
              <MenuItem value="STAGING">Staging</MenuItem>
              <MenuItem value="DISASTER_RECOVERY">Disaster Recovery</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {deploymentsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t('rollback.error.loadFailed')}: {deploymentsError.message}
        </Alert>
      )}

      {/* Loading */}
      {deploymentsLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      )}

      {/* No Deployments */}
      {!deploymentsLoading && deployments.length === 0 && (
        <Alert severity="info">{t('rollback.noEligibleDeployments')}</Alert>
      )}

      {/* Deployments Table */}
      {!deploymentsLoading && deployments.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('rollback.table.health')}</TableCell>
                <TableCell>{t('rollback.table.deployment')}</TableCell>
                <TableCell>{t('rollback.table.environment')}</TableCell>
                <TableCell>{t('rollback.table.version')}</TableCell>
                <TableCell>{t('rollback.table.deployedBy')}</TableCell>
                <TableCell>{t('rollback.table.timeSince')}</TableCell>
                <TableCell>{t('rollback.table.metrics')}</TableCell>
                <TableCell align="right">{t('rollback.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deployments.map((deployment: RollbackEligibleDeployment) => {
                const healthScore = calculateHealthScore(deployment);
                return (
                  <TableRow key={deployment.deploymentId}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress
                          variant="determinate"
                          value={healthScore}
                          size={40}
                          color={getHealthScoreColor(healthScore)}
                        />
                        <Typography variant="body2">{Math.round(healthScore)}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {deployment.deploymentNumber}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {deployment.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={deployment.environment}
                        color={getEnvironmentColor(deployment.environment)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{deployment.version}</Typography>
                      {deployment.previousVersion && (
                        <Typography variant="caption" color="textSecondary">
                          ← {deployment.previousVersion}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{deployment.deployedBy}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTimeSince(deployment.minutesSinceDeployment)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {deployment.currentErrorRatePercent !== null && (
                          <Chip
                            label={`Error: ${deployment.currentErrorRatePercent.toFixed(1)}%`}
                            color={deployment.currentErrorRatePercent > 5 ? 'error' : 'default'}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        )}
                        {deployment.currentSuccessRatePercent !== null && (
                          <Chip
                            label={`Success: ${deployment.currentSuccessRatePercent.toFixed(1)}%`}
                            color={deployment.currentSuccessRatePercent < 95 ? 'warning' : 'success'}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        )}
                        {deployment.postDeploymentHealthCheck && (
                          <Chip
                            label={deployment.postDeploymentHealthCheck}
                            color={getHealthCheckColor(
                              deployment.postDeploymentHealthCheck
                            )}
                            size="small"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('rollback.actions.rollback')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedDeployment(deployment);
                            setRollbackDialogOpen(true);
                          }}
                        >
                          <RollbackIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('rollback.actions.viewMetrics')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedDeployment(deployment);
                            setMetricsDialogOpen(true);
                          }}
                        >
                          <MetricsIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('rollback.actions.viewHistory')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedDeployment(deployment);
                            setHistoryDialogOpen(true);
                          }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Rollback Dialog */}
      <Dialog open={rollbackDialogOpen} onClose={() => setRollbackDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('rollback.dialogs.rollback.title')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('rollback.dialogs.rollback.warning')}
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('rollback.dialogs.rollback.message', {
              deployment: selectedDeployment?.deploymentNumber,
              version: selectedDeployment?.version,
              previousVersion: selectedDeployment?.previousVersion,
            })}
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('rollback.dialogs.rollback.type')}</InputLabel>
            <Select
              value={rollbackType}
              onChange={handleRollbackTypeChange}
              label={t('rollback.dialogs.rollback.type')}
            >
              <MenuItem value="MANUAL">Manual Rollback</MenuItem>
              <MenuItem value="EMERGENCY">Emergency Rollback</MenuItem>
            </Select>
          </FormControl>
          {rollbackType === 'EMERGENCY' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {t('rollback.dialogs.rollback.emergencyWarning')}
            </Alert>
          )}
          <TextField
            fullWidth
            required
            multiline
            rows={4}
            label={t('rollback.dialogs.rollback.reason')}
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
            placeholder={t('rollback.dialogs.rollback.reasonPlaceholder')}
            error={rollbackReason.trim() === ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRollbackDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleInitiateRollback}
            variant="contained"
            color="error"
            disabled={!rollbackReason.trim()}
          >
            {t('rollback.actions.rollback')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Emergency Rollback Confirmation Dialog - P1 Improvement */}
      <Dialog
        open={emergencyConfirmDialogOpen}
        onClose={() => setEmergencyConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main' }}>
          {t('rollback.dialogs.emergency.title')}
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('rollback.dialogs.emergency.criticalWarning')}
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('rollback.dialogs.emergency.message', {
              deployment: selectedDeployment?.deploymentNumber,
            })}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 'bold' }}>
            {t('rollback.dialogs.emergency.confirmInstruction')}
          </Typography>
          <TextField
            fullWidth
            required
            label={t('rollback.dialogs.emergency.confirmLabel')}
            value={emergencyConfirmText}
            onChange={(e) => setEmergencyConfirmText(e.target.value)}
            placeholder="EMERGENCY"
            error={
              emergencyConfirmText.length > 0 &&
              emergencyConfirmText !== 'EMERGENCY'
            }
            helperText={
              emergencyConfirmText.length > 0 &&
              emergencyConfirmText !== 'EMERGENCY'
                ? t('rollback.dialogs.emergency.confirmError')
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmergencyConfirmDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleEmergencyConfirm}
            variant="contained"
            color="error"
            disabled={emergencyConfirmText !== 'EMERGENCY'}
          >
            {t('rollback.dialogs.emergency.confirmButton')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog open={metricsDialogOpen} onClose={() => setMetricsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('rollback.dialogs.metrics.title')}</DialogTitle>
        <DialogContent>
          {metricsLoading && <CircularProgress />}
          {!metricsLoading && metrics.length === 0 && (
            <Alert severity="info">{t('rollback.dialogs.metrics.noData')}</Alert>
          )}
          {!metricsLoading && metrics.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('rollback.dialogs.metrics.time')}</TableCell>
                    <TableCell>{t('rollback.dialogs.metrics.errorRate')}</TableCell>
                    <TableCell>{t('rollback.dialogs.metrics.successRate')}</TableCell>
                    <TableCell>{t('rollback.dialogs.metrics.responseTime')}</TableCell>
                    <TableCell>{t('rollback.dialogs.metrics.triggersRollback')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.map((metric: RollbackHealthMetrics) => (
                    <TableRow key={metric.id}>
                      <TableCell>
                        {formatTimeSince(metric.minutesSinceDeployment)}
                      </TableCell>
                      <TableCell>
                        {metric.errorRatePercent !== null
                          ? `${metric.errorRatePercent.toFixed(2)}%`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {metric.successRatePercent !== null
                          ? `${metric.successRatePercent.toFixed(2)}%`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {metric.avgResponseTimeMs !== null
                          ? `${metric.avgResponseTimeMs}ms`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {metric.triggersRollbackCriteria ? (
                          <Chip label="Yes" color="error" size="small" />
                        ) : (
                          <Chip label="No" color="success" size="small" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMetricsDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Rollback History Dialog */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('rollback.dialogs.history.title')}</DialogTitle>
        <DialogContent>
          {historyLoading && <CircularProgress />}
          {!historyLoading && rollbackHistory.length === 0 && (
            <Alert severity="info">{t('rollback.dialogs.history.noData')}</Alert>
          )}
          {!historyLoading && rollbackHistory.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('rollback.dialogs.history.rollbackNumber')}</TableCell>
                    <TableCell>{t('rollback.dialogs.history.type')}</TableCell>
                    <TableCell>{t('rollback.dialogs.history.reason')}</TableCell>
                    <TableCell>{t('rollback.dialogs.history.status')}</TableCell>
                    <TableCell>{t('rollback.dialogs.history.duration')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rollbackHistory.map((rollback: DeploymentRollback) => (
                    <TableRow key={rollback.id}>
                      <TableCell>{rollback.rollbackNumber}</TableCell>
                      <TableCell>
                        <Chip label={rollback.rollbackType} size="small" />
                      </TableCell>
                      <TableCell>{rollback.rollbackReason}</TableCell>
                      <TableCell>
                        <Chip
                          label={rollback.status}
                          color={
                            rollback.status === 'COMPLETED' ? 'success' : 'default'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {rollback.rollbackDurationSeconds
                          ? `${rollback.rollbackDurationSeconds}s`
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RollbackDecisionPage;
