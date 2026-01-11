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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  PersonAdd as DelegateIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { GET_MY_PENDING_TASKS } from '../graphql/queries/workflow';
import {
  APPROVE_TASK,
  REJECT_TASK,
  DELEGATE_TASK,
  COMPLETE_USER_TASK,
} from '../graphql/mutations/workflow';
import { useAppStore } from '../store/appStore';

interface UserTask {
  taskId: string;
  instanceId: string;
  workflowName: string;
  taskName: string;
  nodeType: string;
  assignedUserId: string;
  slaDeadline: string;
  urgencyLevel: 'URGENT' | 'WARNING' | 'NORMAL';
  hoursRemaining: number;
  isOverdue: boolean;
  contextEntityType: string;
  contextEntityId: string;
  contextData: Record<string, unknown>;
  taskCreatedAt: string;
  tenantId: string;
}

const MyTasksPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useAppStore(); // Facility context

  // State
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<UserTask | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delegate' | 'complete' | null>(null);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const [delegateUserId, setDelegateUserId] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // GraphQL Queries and Mutations
  const { data, loading, error, refetch } = useQuery(GET_MY_PENDING_TASKS, {
    variables: {
      urgencyLevel: urgencyFilter || undefined,
      limit: 50,
    },
    pollInterval: 30000, // Poll every 30 seconds
  });

  const [approveTask, { loading: approving }] = useMutation(APPROVE_TASK, {
    onCompleted: () => {
      handleCloseDialog();
      refetch();
    },
  });

  const [rejectTask, { loading: rejecting }] = useMutation(REJECT_TASK, {
    onCompleted: () => {
      handleCloseDialog();
      refetch();
    },
  });

  const [delegateTask, { loading: delegating }] = useMutation(DELEGATE_TASK, {
    onCompleted: () => {
      handleCloseDialog();
      refetch();
    },
  });

  const [completeUserTask, { loading: completing }] = useMutation(COMPLETE_USER_TASK, {
    onCompleted: () => {
      handleCloseDialog();
      refetch();
    },
  });

  const tasks: UserTask[] = data?.myPendingTasks || [];

  // Handlers
  const handleOpenActionDialog = (
    task: UserTask,
    type: 'approve' | 'reject' | 'delegate' | 'complete'
  ) => {
    setSelectedTask(task);
    setActionType(type);
    setActionDialogOpen(true);
    setComments('');
    setReason('');
    setDelegateUserId('');
    setFormData({});
  };

  const handleCloseDialog = () => {
    setActionDialogOpen(false);
    setSelectedTask(null);
    setActionType(null);
    setComments('');
    setReason('');
    setDelegateUserId('');
    setFormData({});
  };

  const handleSubmitAction = async () => {
    if (!selectedTask) return;

    try {
      switch (actionType) {
        case 'approve':
          await approveTask({
            variables: {
              taskId: selectedTask.taskId,
              comments: comments || undefined,
            },
          });
          break;
        case 'reject':
          await rejectTask({
            variables: {
              taskId: selectedTask.taskId,
              reason,
            },
          });
          break;
        case 'delegate':
          await delegateTask({
            variables: {
              taskId: selectedTask.taskId,
              delegateToUserId: delegateUserId,
            },
          });
          break;
        case 'complete':
          await completeUserTask({
            variables: {
              taskId: selectedTask.taskId,
              formData,
            },
          });
          break;
      }
    } catch (err) {
      console.error('Error performing task action:', err);
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'URGENT':
        return 'error';
      case 'WARNING':
        return 'warning';
      default:
        return 'success';
    }
  };

  const getUrgencyIcon = (level: string): React.ReactElement | undefined => {
    switch (level) {
      case 'URGENT':
        return <ErrorIcon fontSize="small" />;
      case 'WARNING':
        return <WarningIcon fontSize="small" />;
      default:
        return undefined;
    }
  };

  const formatContextData = (data: Record<string, unknown>) => {
    return Object.entries(data)
      .slice(0, 3) // Show first 3 fields
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  // Summary statistics
  const urgentCount = tasks.filter((t) => t.urgencyLevel === 'URGENT').length;
  const warningCount = tasks.filter((t) => t.urgencyLevel === 'WARNING').length;
  const normalCount = tasks.filter((t) => t.urgencyLevel === 'NORMAL').length;

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
          {t('workflow.myTasks.errorLoading')}: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          {t('workflow.myTasks.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('workflow.myTasks.description')}
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error">
                {urgentCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.myTasks.urgent')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                {warningCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.myTasks.warning')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {normalCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.myTasks.normal')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                {tasks.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workflow.myTasks.total')}
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
                <InputLabel>{t('workflow.myTasks.filterByUrgency')}</InputLabel>
                <Select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  label={t('workflow.myTasks.filterByUrgency')}
                >
                  <MenuItem value="">{t('workflow.myTasks.allUrgencies')}</MenuItem>
                  <MenuItem value="URGENT">{t('workflow.myTasks.urgent')}</MenuItem>
                  <MenuItem value="WARNING">{t('workflow.myTasks.warning')}</MenuItem>
                  <MenuItem value="NORMAL">{t('workflow.myTasks.normal')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent>
          {tasks.length === 0 ? (
            <Alert severity="info">{t('workflow.myTasks.noTasks')}</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('workflow.myTasks.urgency')}</TableCell>
                    <TableCell>{t('workflow.myTasks.workflow')}</TableCell>
                    <TableCell>{t('workflow.myTasks.task')}</TableCell>
                    <TableCell>{t('workflow.myTasks.entity')}</TableCell>
                    <TableCell>{t('workflow.myTasks.context')}</TableCell>
                    <TableCell>{t('workflow.myTasks.deadline')}</TableCell>
                    <TableCell>{t('workflow.myTasks.remaining')}</TableCell>
                    <TableCell align="right">{t('workflow.myTasks.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow
                      key={task.taskId}
                      sx={{
                        backgroundColor:
                          task.urgencyLevel === 'URGENT'
                            ? 'rgba(211, 47, 47, 0.05)'
                            : task.urgencyLevel === 'WARNING'
                            ? 'rgba(237, 108, 2, 0.05)'
                            : 'transparent',
                      }}
                    >
                      <TableCell>
                        <Chip
                          label={t(`workflow.myTasks.${task.urgencyLevel.toLowerCase()}`)}
                          color={getUrgencyColor(task.urgencyLevel) as 'error' | 'warning' | 'success'}
                          size="small"
                          icon={getUrgencyIcon(task.urgencyLevel)}
                        />
                      </TableCell>
                      <TableCell>{task.workflowName}</TableCell>
                      <TableCell>{task.taskName}</TableCell>
                      <TableCell>
                        {task.contextEntityType}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {task.contextEntityId.substring(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {formatContextData(task.contextData)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {task.slaDeadline ? (
                          <>
                            {format(new Date(task.slaDeadline), 'MMM dd, HH:mm')}
                            <br />
                            <Typography
                              variant="caption"
                              color={task.isOverdue ? 'error' : 'text.secondary'}
                            >
                              {task.isOverdue
                                ? t('workflow.myTasks.overdue')
                                : formatDistanceToNow(new Date(task.slaDeadline), {
                                    addSuffix: true,
                                  })}
                            </Typography>
                          </>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {task.hoursRemaining !== null ? (
                          <Typography
                            variant="body2"
                            color={
                              task.hoursRemaining < 0
                                ? 'error'
                                : task.hoursRemaining < 4
                                ? 'warning.main'
                                : 'text.primary'
                            }
                          >
                            {task.hoursRemaining.toFixed(1)}h
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" justifyContent="flex-end" gap={1}>
                          <Tooltip title={t('workflow.myTasks.viewDetails')}>
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/workflows/instances/${task.instanceId}`)}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {task.nodeType === 'APPROVAL' && (
                            <>
                              <Tooltip title={t('workflow.myTasks.approve')}>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleOpenActionDialog(task, 'approve')}
                                >
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('workflow.myTasks.reject')}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleOpenActionDialog(task, 'reject')}
                                >
                                  <RejectIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {task.nodeType === 'USER_TASK' && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleOpenActionDialog(task, 'complete')}
                            >
                              {t('workflow.myTasks.complete')}
                            </Button>
                          )}
                          <Tooltip title={t('workflow.myTasks.delegate')}>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenActionDialog(task, 'delegate')}
                            >
                              <DelegateIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionType === 'approve' && t('workflow.myTasks.approveTask')}
          {actionType === 'reject' && t('workflow.myTasks.rejectTask')}
          {actionType === 'delegate' && t('workflow.myTasks.delegateTask')}
          {actionType === 'complete' && t('workflow.myTasks.completeTask')}
        </DialogTitle>
        <DialogContent>
          {selectedTask && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                {t('workflow.myTasks.workflow')}: {selectedTask.workflowName}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                {t('workflow.myTasks.task')}: {selectedTask.taskName}
              </Typography>

              {actionType === 'approve' && (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label={t('workflow.myTasks.comments')}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  margin="normal"
                />
              )}

              {actionType === 'reject' && (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label={t('workflow.myTasks.reason')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  margin="normal"
                  required
                />
              )}

              {actionType === 'delegate' && (
                <TextField
                  fullWidth
                  label={t('workflow.myTasks.delegateToUserId')}
                  value={delegateUserId}
                  onChange={(e) => setDelegateUserId(e.target.value)}
                  margin="normal"
                  required
                  helperText={t('workflow.myTasks.delegateHelp')}
                />
              )}

              {actionType === 'complete' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {t('workflow.myTasks.completeTaskHelp')}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSubmitAction}
            variant="contained"
            disabled={
              approving ||
              rejecting ||
              delegating ||
              completing ||
              (actionType === 'reject' && !reason) ||
              (actionType === 'delegate' && !delegateUserId)
            }
          >
            {approving || rejecting || delegating || completing ? (
              <CircularProgress size={20} />
            ) : (
              t('common.submit')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MyTasksPage;
