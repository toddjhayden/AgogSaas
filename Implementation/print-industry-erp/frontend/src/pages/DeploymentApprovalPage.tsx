import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
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
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  SwapHoriz as DelegateIcon,
  Edit as ChangeRequestIcon,
  Refresh as RefreshIcon,
  HealthAndSafety as HealthCheckIcon,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import {
  GET_MY_PENDING_DEPLOYMENT_APPROVALS,
  GET_DEPLOYMENT_APPROVAL_STATS,
  APPROVE_DEPLOYMENT,
  REJECT_DEPLOYMENT,
  DELEGATE_DEPLOYMENT_APPROVAL,
  REQUEST_DEPLOYMENT_CHANGES,
  RUN_DEPLOYMENT_HEALTH_CHECK,
  EXECUTE_DEPLOYMENT,
  ROLLBACK_DEPLOYMENT,
} from '../graphql/queries/deploymentApprovals';

/**
 * DeploymentApprovalPage
 *
 * Dashboard for managing deployment approval workflows.
 * Provides approval queue, statistics, and quick actions.
 *
 * Features:
 * - Pending deployment approvals with SLA tracking
 * - Environment-based filtering (Production, Staging, etc.)
 * - Urgency-based filtering (Critical, High, Medium, Low)
 * - Quick actions: Approve, Reject, Delegate, Request Changes
 * - Health check integration
 * - Real-time statistics
 */
const DeploymentApprovalPage: React.FC = () => {
  const { t } = useTranslation();
  const { userId, tenantId } = useAuth();

  // State
  const [environmentFilter, setEnvironmentFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [urgencyLevelFilter, setUrgencyLevelFilter] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null);

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [delegateDialogOpen, setDelegateDialogOpen] = useState(false);
  const [changeRequestDialogOpen, setChangeRequestDialogOpen] = useState(false);

  // Form states
  const [approveComments, setApproveComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [delegateToUserId, setDelegateToUserId] = useState('');
  const [delegateComments, setDelegateComments] = useState('');
  const [changeRequest, setChangeRequest] = useState('');

  // Build filter object
  const filters = {
    environment: environmentFilter || undefined,
    urgency: urgencyFilter || undefined,
    urgencyLevel: urgencyLevelFilter || undefined,
  };

  // GraphQL Queries
  const {
    data: approvalsData,
    loading: approvalsLoading,
    error: approvalsError,
    refetch: refetchApprovals,
  } = useQuery(GET_MY_PENDING_DEPLOYMENT_APPROVALS, {
    variables: { tenantId, userId, filters },
    pollInterval: autoRefresh ? 30000 : 0, // Refresh every 30 seconds if enabled
  });

  const {
    data: statsData,
    loading: statsLoading,
    refetch: refetchStats,
  } = useQuery(GET_DEPLOYMENT_APPROVAL_STATS, {
    variables: { tenantId },
    pollInterval: autoRefresh ? 30000 : 0,
  });

  // GraphQL Mutations
  const [approveDeployment] = useMutation(APPROVE_DEPLOYMENT);
  const [rejectDeployment] = useMutation(REJECT_DEPLOYMENT);
  const [delegateApproval] = useMutation(DELEGATE_DEPLOYMENT_APPROVAL);
  const [requestChanges] = useMutation(REQUEST_DEPLOYMENT_CHANGES);
  const [runHealthCheck] = useMutation(RUN_DEPLOYMENT_HEALTH_CHECK);
  const [_executeDeployment] = useMutation(EXECUTE_DEPLOYMENT);
  const [_rollbackDeployment] = useMutation(ROLLBACK_DEPLOYMENT);

  // Manual refresh
  const handleRefresh = () => {
    refetchApprovals();
    refetchStats();
  };

  // Approve deployment
  const handleApprove = async () => {
    if (!selectedDeployment) return;

    try {
      await approveDeployment({
        variables: {
          input: {
            deploymentId: selectedDeployment.deploymentId,
            approvedByUserId: userId,
            tenantId,
            comments: approveComments,
          },
        },
      });

      setApproveDialogOpen(false);
      setApproveComments('');
      setSelectedDeployment(null);
      refetchApprovals();
      refetchStats();
    } catch (error) {
      console.error('Error approving deployment:', error);
      alert('Failed to approve deployment');
    }
  };

  // Reject deployment
  const handleReject = async () => {
    if (!selectedDeployment || !rejectReason.trim()) return;

    try {
      await rejectDeployment({
        variables: {
          input: {
            deploymentId: selectedDeployment.deploymentId,
            rejectedByUserId: userId,
            tenantId,
            rejectionReason: rejectReason,
          },
        },
      });

      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedDeployment(null);
      refetchApprovals();
      refetchStats();
    } catch (error) {
      console.error('Error rejecting deployment:', error);
      alert('Failed to reject deployment');
    }
  };

  // Delegate approval
  const handleDelegate = async () => {
    if (!selectedDeployment || !delegateToUserId.trim()) return;

    try {
      await delegateApproval({
        variables: {
          input: {
            deploymentId: selectedDeployment.deploymentId,
            delegatedByUserId: userId,
            delegatedToUserId: delegateToUserId,
            tenantId,
            comments: delegateComments,
          },
        },
      });

      setDelegateDialogOpen(false);
      setDelegateToUserId('');
      setDelegateComments('');
      setSelectedDeployment(null);
      refetchApprovals();
    } catch (error) {
      console.error('Error delegating approval:', error);
      alert('Failed to delegate approval');
    }
  };

  // Request changes
  const handleRequestChanges = async () => {
    if (!selectedDeployment || !changeRequest.trim()) return;

    try {
      await requestChanges({
        variables: {
          input: {
            deploymentId: selectedDeployment.deploymentId,
            requestedByUserId: userId,
            tenantId,
            changeRequest,
          },
        },
      });

      setChangeRequestDialogOpen(false);
      setChangeRequest('');
      setSelectedDeployment(null);
      refetchApprovals();
    } catch (error) {
      console.error('Error requesting changes:', error);
      alert('Failed to request changes');
    }
  };

  // Run health check
  const handleHealthCheck = async (deploymentId: string) => {
    try {
      await runHealthCheck({
        variables: {
          deploymentId,
          tenantId,
          checkType: 'PRE_DEPLOYMENT',
        },
      });

      refetchApprovals();
      alert('Health check completed');
    } catch (error) {
      console.error('Error running health check:', error);
      alert('Failed to run health check');
    }
  };

  // Get statistics
  const stats = statsData?.getDeploymentApprovalStats || {};
  const approvals = approvalsData?.getMyPendingDeploymentApprovals || [];

  // Urgency level badge color
  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'URGENT':
        return 'error';
      case 'WARNING':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Environment badge color
  const getEnvironmentColor = (env: string) => {
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

  // Urgency badge color
  const getUrgencyBadgeColor = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      default:
        return 'default';
    }
  };

  // Format SLA remaining
  const formatSlaRemaining = (hours: number | null, isOverdue: boolean) => {
    if (isOverdue) return t('deployment.approvals.overdue');
    if (hours === null) return t('deployment.approvals.noSla');
    if (hours < 0) return t('deployment.approvals.overdue');
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.round(hours)}h`;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('deployment.approvals.title')}</Typography>
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
            {autoRefresh ? t('deployment.approvals.autoRefreshOn') : t('deployment.approvals.autoRefreshOff')}
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {!statsLoading && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('deployment.approvals.stats.totalPending')}
                </Typography>
                <Typography variant="h4">{stats.totalPending || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#ffebee' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('deployment.approvals.stats.critical')}
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.criticalPending || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#fff3e0' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('deployment.approvals.stats.overdue')}
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.overdueCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#e8f5e9' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('deployment.approvals.stats.approvedToday')}
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.approvedLast24h || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('deployment.approvals.filters.environment')}</InputLabel>
                <Select
                  value={environmentFilter}
                  onChange={(e) => setEnvironmentFilter(e.target.value)}
                  label={t('deployment.approvals.filters.environment')}
                >
                  <MenuItem value="">{t('common.all')}</MenuItem>
                  <MenuItem value="PRODUCTION">Production</MenuItem>
                  <MenuItem value="PRE_PRODUCTION">Pre-Production</MenuItem>
                  <MenuItem value="STAGING">Staging</MenuItem>
                  <MenuItem value="DISASTER_RECOVERY">Disaster Recovery</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('deployment.approvals.filters.urgency')}</InputLabel>
                <Select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  label={t('deployment.approvals.filters.urgency')}
                >
                  <MenuItem value="">{t('common.all')}</MenuItem>
                  <MenuItem value="CRITICAL">Critical</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('deployment.approvals.filters.status')}</InputLabel>
                <Select
                  value={urgencyLevelFilter}
                  onChange={(e) => setUrgencyLevelFilter(e.target.value)}
                  label={t('deployment.approvals.filters.status')}
                >
                  <MenuItem value="">{t('common.all')}</MenuItem>
                  <MenuItem value="URGENT">Urgent (Overdue)</MenuItem>
                  <MenuItem value="WARNING">Warning (&lt; 4h)</MenuItem>
                  <MenuItem value="NORMAL">Normal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {approvalsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t('deployment.approvals.error.loadFailed')}: {approvalsError.message}
        </Alert>
      )}

      {/* Loading */}
      {approvalsLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Approvals Table */}
      {!approvalsLoading && approvals.length === 0 && (
        <Alert severity="info">{t('deployment.approvals.noPending')}</Alert>
      )}

      {!approvalsLoading && approvals.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('deployment.approvals.table.urgency')}</TableCell>
                <TableCell>{t('deployment.approvals.table.deployment')}</TableCell>
                <TableCell>{t('deployment.approvals.table.environment')}</TableCell>
                <TableCell>{t('deployment.approvals.table.version')}</TableCell>
                <TableCell>{t('deployment.approvals.table.step')}</TableCell>
                <TableCell>{t('deployment.approvals.table.deployedBy')}</TableCell>
                <TableCell>{t('deployment.approvals.table.slaRemaining')}</TableCell>
                <TableCell align="right">{t('deployment.approvals.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {approvals.map((approval: unknown) => (
                <TableRow
                  key={approval.deploymentId}
                  sx={{
                    backgroundColor:
                      approval.urgencyLevel === 'URGENT'
                        ? '#ffebee'
                        : approval.urgencyLevel === 'WARNING'
                        ? '#fff3e0'
                        : 'inherit',
                  }}
                >
                  <TableCell>
                    <Chip
                      label={approval.urgency}
                      color={getUrgencyBadgeColor(approval.urgency)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {approval.deploymentNumber}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {approval.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={approval.environment}
                      color={getEnvironmentColor(approval.environment)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{approval.version}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      Step {approval.currentStep} / {approval.totalSteps}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {approval.stepDescription}
                    </Typography>
                  </TableCell>
                  <TableCell>{approval.deployedBy}</TableCell>
                  <TableCell>
                    <Chip
                      label={formatSlaRemaining(approval.slaRemainingHours, approval.isOverdue)}
                      color={getUrgencyColor(approval.urgencyLevel)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('deployment.approvals.actions.approve')}>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => {
                          setSelectedDeployment(approval);
                          setApproveDialogOpen(true);
                        }}
                      >
                        <ApproveIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('deployment.approvals.actions.reject')}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedDeployment(approval);
                          setRejectDialogOpen(true);
                        }}
                      >
                        <RejectIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('deployment.approvals.actions.delegate')}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedDeployment(approval);
                          setDelegateDialogOpen(true);
                        }}
                      >
                        <DelegateIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('deployment.approvals.actions.requestChanges')}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedDeployment(approval);
                          setChangeRequestDialogOpen(true);
                        }}
                      >
                        <ChangeRequestIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('deployment.approvals.actions.healthCheck')}>
                      <IconButton
                        size="small"
                        onClick={() => handleHealthCheck(approval.deploymentId)}
                      >
                        <HealthCheckIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('deployment.approvals.dialogs.approve.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('deployment.approvals.dialogs.approve.message', {
              deployment: selectedDeployment?.deploymentNumber,
            })}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('deployment.approvals.dialogs.approve.comments')}
            value={approveComments}
            onChange={(e) => setApproveComments(e.target.value)}
            placeholder={t('deployment.approvals.dialogs.approve.commentsPlaceholder')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleApprove} variant="contained" color="success">
            {t('deployment.approvals.actions.approve')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('deployment.approvals.dialogs.reject.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('deployment.approvals.dialogs.reject.message', {
              deployment: selectedDeployment?.deploymentNumber,
            })}
          </Typography>
          <TextField
            fullWidth
            required
            multiline
            rows={4}
            label={t('deployment.approvals.dialogs.reject.reason')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('deployment.approvals.dialogs.reject.reasonPlaceholder')}
            error={rejectReason.trim() === ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={!rejectReason.trim()}
          >
            {t('deployment.approvals.actions.reject')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delegate Dialog */}
      <Dialog open={delegateDialogOpen} onClose={() => setDelegateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('deployment.approvals.dialogs.delegate.title')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            label={t('deployment.approvals.dialogs.delegate.userId')}
            value={delegateToUserId}
            onChange={(e) => setDelegateToUserId(e.target.value)}
            placeholder="user456"
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label={t('deployment.approvals.dialogs.delegate.comments')}
            value={delegateComments}
            onChange={(e) => setDelegateComments(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelegateDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleDelegate}
            variant="contained"
            disabled={!delegateToUserId.trim()}
          >
            {t('deployment.approvals.actions.delegate')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Changes Dialog */}
      <Dialog
        open={changeRequestDialogOpen}
        onClose={() => setChangeRequestDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('deployment.approvals.dialogs.requestChanges.title')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            multiline
            rows={4}
            label={t('deployment.approvals.dialogs.requestChanges.request')}
            value={changeRequest}
            onChange={(e) => setChangeRequest(e.target.value)}
            placeholder={t('deployment.approvals.dialogs.requestChanges.requestPlaceholder')}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeRequestDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleRequestChanges}
            variant="contained"
            disabled={!changeRequest.trim()}
          >
            {t('deployment.approvals.actions.requestChanges')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeploymentApprovalPage;
