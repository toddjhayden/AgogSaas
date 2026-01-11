import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { GET_WORKFLOW_INSTANCES } from '../graphql/queries/workflow';
import { CANCEL_WORKFLOW } from '../graphql/mutations/workflow';
import { useAppStore } from '../store/appStore';

interface WorkflowInstance {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  workflowName: string;
  workflowVersion: number;
  contextEntityType: string;
  contextEntityId: string;
  contextData: Record<string, unknown>;
  status: string;
  currentNodeId: string;
  startedAt: string;
  completedAt?: string;
  slaDeadline?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  nodes: Array<{
    id: string;
    nodeName: string;
    status: string;
  }>;
}

const WorkflowInstancesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useAppStore(); // For facility context

  // State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);

  // GraphQL Queries and Mutations
  const { data, loading, error, refetch } = useQuery(GET_WORKFLOW_INSTANCES, {
    variables: {
      status: statusFilter || undefined,
      entityType: entityTypeFilter || undefined,
      limit: 100,
    },
    pollInterval: 30000, // Poll every 30 seconds
  });

  const [cancelWorkflow, { loading: cancelling }] = useMutation(CANCEL_WORKFLOW, {
    onCompleted: () => {
      setCancelDialogOpen(false);
      setSelectedInstance(null);
      refetch();
    },
  });

  const instances: WorkflowInstance[] = data?.workflowInstances || [];

  // Handlers
  const handleOpenCancelDialog = (instance: WorkflowInstance) => {
    setSelectedInstance(instance);
    setCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    setCancelDialogOpen(false);
    setSelectedInstance(null);
  };

  const handleCancelWorkflow = async () => {
    if (!selectedInstance) return;

    try {
      await cancelWorkflow({
        variables: {
          instanceId: selectedInstance.id,
        },
      });
    } catch (err) {
      console.error('Error cancelling workflow:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'info';
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'error';
      case 'BLOCKED':
        return 'warning';
      case 'ESCALATED':
        return 'warning';
      case 'CANCELLED':
        return 'default';
      default:
        return 'default';
    }
  };

  const calculateDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getCurrentNodeName = (instance: WorkflowInstance) => {
    const currentNode = instance.nodes.find((n) => n.id === instance.currentNodeId);
    return currentNode?.nodeName || '-';
  };

  const getCompletedStepsCount = (instance: WorkflowInstance) => {
    const completed = instance.nodes.filter((n) => n.status === 'COMPLETED').length;
    const total = instance.nodes.length;
    return `${completed}/${total}`;
  };

  // Summary statistics
  const runningCount = instances.filter((i) => i.status === 'RUNNING').length;
  const completedCount = instances.filter((i) => i.status === 'COMPLETED').length;
  const failedCount = instances.filter((i) => i.status === 'FAILED').length;
  const escalatedCount = instances.filter((i) => i.status === 'ESCALATED').length;

  // Get unique entity types for filter
  const entityTypes = Array.from(new Set(instances.map((i) => i.contextEntityType))).filter(Boolean);

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
          {t('workflow.instances.errorLoading')}: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('workflow.instances.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workflow.instances.description')}
          </Typography>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                {runningCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.instances.running')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {completedCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.instances.completed')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error">
                {failedCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.instances.failed')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                {escalatedCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.instances.escalated')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('workflow.instances.filterByStatus')}</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label={t('workflow.instances.filterByStatus')}
                >
                  <MenuItem value="">{t('workflow.instances.allStatuses')}</MenuItem>
                  <MenuItem value="RUNNING">{t('workflow.instances.running')}</MenuItem>
                  <MenuItem value="COMPLETED">{t('workflow.instances.completed')}</MenuItem>
                  <MenuItem value="FAILED">{t('workflow.instances.failed')}</MenuItem>
                  <MenuItem value="BLOCKED">{t('workflow.instances.blocked')}</MenuItem>
                  <MenuItem value="ESCALATED">{t('workflow.instances.escalated')}</MenuItem>
                  <MenuItem value="CANCELLED">{t('workflow.instances.cancelled')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('workflow.instances.filterByEntityType')}</InputLabel>
                <Select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  label={t('workflow.instances.filterByEntityType')}
                >
                  <MenuItem value="">{t('workflow.instances.allEntityTypes')}</MenuItem>
                  {entityTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Instances Table */}
      <Card>
        <CardContent>
          {instances.length === 0 ? (
            <Alert severity="info">{t('workflow.instances.noInstances')}</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('workflow.instances.workflow')}</TableCell>
                    <TableCell>{t('workflow.instances.entity')}</TableCell>
                    <TableCell>{t('workflow.instances.status')}</TableCell>
                    <TableCell>{t('workflow.instances.progress')}</TableCell>
                    <TableCell>{t('workflow.instances.currentStep')}</TableCell>
                    <TableCell>{t('workflow.instances.startedAt')}</TableCell>
                    <TableCell>{t('workflow.instances.duration')}</TableCell>
                    <TableCell>{t('workflow.instances.slaDeadline')}</TableCell>
                    <TableCell align="right">{t('workflow.instances.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {instances.map((instance) => (
                    <TableRow key={instance.id} hover>
                      <TableCell>
                        {instance.workflowName}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          v{instance.workflowVersion}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {instance.contextEntityType}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {instance.contextEntityId.substring(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={t(`workflow.instances.${instance.status.toLowerCase()}`)}
                          color={getStatusColor(instance.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{getCompletedStepsCount(instance)}</TableCell>
                      <TableCell>
                        {instance.status === 'RUNNING' ? getCurrentNodeName(instance) : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(instance.startedAt), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell>{calculateDuration(instance.startedAt, instance.completedAt)}</TableCell>
                      <TableCell>
                        {instance.slaDeadline ? (
                          <>
                            {format(new Date(instance.slaDeadline), 'MMM dd, HH:mm')}
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              {formatDistanceToNow(new Date(instance.slaDeadline), {
                                addSuffix: true,
                              })}
                            </Typography>
                          </>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" justifyContent="flex-end" gap={1}>
                          <Tooltip title={t('workflow.instances.viewDetails')}>
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/workflows/instances/${instance.id}`)}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {instance.status === 'RUNNING' && (
                            <Tooltip title={t('workflow.instances.cancel')}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleOpenCancelDialog(instance)}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={handleCloseCancelDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('workflow.instances.cancelWorkflow')}</DialogTitle>
        <DialogContent>
          {selectedInstance && (
            <Box mt={2}>
              <Typography variant="body1" gutterBottom>
                {t('workflow.instances.cancelConfirm')}
              </Typography>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                {t('workflow.instances.workflow')}: {selectedInstance.workflowName} (v
                {selectedInstance.workflowVersion})
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                {t('workflow.instances.entity')}: {selectedInstance.contextEntityType} -{' '}
                {selectedInstance.contextEntityId.substring(0, 8)}...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleCancelWorkflow} variant="contained" color="error" disabled={cancelling}>
            {cancelling ? <CircularProgress size={20} /> : t('workflow.instances.confirmCancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WorkflowInstancesPage;
