import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Button,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  CheckCircle as CompletedIcon,
  Error as FailedIcon,
  HourglassEmpty as PendingIcon,
  PlayArrow as InProgressIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { GET_WORKFLOW_INSTANCE, GET_WORKFLOW_INSTANCE_HISTORY } from '../graphql/queries/workflow';

interface WorkflowInstanceNode {
  id: string;
  tenantId: string;
  instanceId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: string;
  assignedUserId?: string;
  startedAt?: string;
  completedAt?: string;
  slaDeadline?: string;
  action?: string;
  actionByUserId?: string;
  actionDate?: string;
  comments?: string;
  outputData?: Record<string, unknown>;
  createdAt: string;
}

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
  currentNodeId?: string;
  startedAt: string;
  completedAt?: string;
  slaDeadline?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowInstanceNode[];
}

interface HistoryEntry {
  id: string;
  tenantId: string;
  instanceId: string;
  eventType: string;
  eventDate: string;
  eventByUserId?: string;
  eventData?: Record<string, unknown>;
  instanceSnapshot?: Record<string, unknown>;
  createdAt: string;
}

const WorkflowInstanceDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { instanceId } = useParams<{ instanceId: string }>();
  const [showHistory, setShowHistory] = useState(false);

  // GraphQL Queries
  const { data, loading, error } = useQuery(GET_WORKFLOW_INSTANCE, {
    variables: { id: instanceId },
    skip: !instanceId,
  });

  const { data: historyData, loading: historyLoading } = useQuery(GET_WORKFLOW_INSTANCE_HISTORY, {
    variables: { instanceId },
    skip: !instanceId || !showHistory,
  });

  const instance: WorkflowInstance | undefined = data?.workflowInstance;
  const history: HistoryEntry[] = historyData?.workflowInstanceHistory || [];

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

  const getNodeStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CompletedIcon color="success" />;
      case 'FAILED':
        return <FailedIcon color="error" />;
      case 'IN_PROGRESS':
        return <InProgressIcon color="info" />;
      case 'PENDING':
        return <PendingIcon color="disabled" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getNodeStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'error';
      case 'IN_PROGRESS':
        return 'primary';
      case 'PENDING':
        return 'grey';
      default:
        return 'grey';
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

  const getCompletedStepsCount = (nodes: WorkflowInstanceNode[]) => {
    const completed = nodes.filter((n) => n.status === 'COMPLETED').length;
    const total = nodes.length;
    return { completed, total };
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !instance) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {t('workflow.detail.errorLoading')}: {error?.message || 'Instance not found'}
        </Alert>
      </Container>
    );
  }

  const { completed, total } = getCompletedStepsCount(instance.nodes);
  const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/workflows/instances')} sx={{ mb: 2 }}>
          {t('workflow.detail.backToList')}
        </Button>
        <Typography variant="h4" gutterBottom>
          {instance.workflowName} (v{instance.workflowVersion})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('workflow.detail.instance')}: {instance.id}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Summary Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('workflow.detail.status')}
                  </Typography>
                  <Chip
                    label={t(`workflow.instances.${instance.status.toLowerCase()}`)}
                    color={getStatusColor(instance.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                    sx={{ mt: 1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('workflow.detail.entity')}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    {instance.contextEntityType}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {instance.contextEntityId}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('workflow.detail.progress')}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {completed} / {total} ({progressPercentage}%)
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('workflow.detail.duration')}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    {calculateDuration(instance.startedAt, instance.completedAt)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Timeline Card */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('workflow.detail.executionTimeline')}
              </Typography>
              <Timeline>
                {instance.nodes.map((node, index) => (
                  <TimelineItem key={node.id}>
                    <TimelineOppositeContent sx={{ maxWidth: '30%', color: 'text.secondary' }}>
                      {node.startedAt && format(new Date(node.startedAt), 'MMM dd, HH:mm')}
                      {node.completedAt && (
                        <>
                          <br />
                          <Typography variant="caption">
                            {t('workflow.detail.completed')}:{' '}
                            {format(new Date(node.completedAt), 'HH:mm')}
                          </Typography>
                        </>
                      )}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color={getNodeStatusColor(node.status) as 'grey' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}>
                        {getNodeStatusIcon(node.status)}
                      </TimelineDot>
                      {index < instance.nodes.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Paper elevation={2} sx={{ p: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {node.nodeName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t(`workflow.detail.nodeType.${node.nodeType.toLowerCase()}`)}
                        </Typography>
                        {node.status === 'COMPLETED' && node.action && (
                          <Chip
                            label={t(`workflow.detail.action.${node.action.toLowerCase()}`)}
                            size="small"
                            color={node.action === 'APPROVED' ? 'success' : 'error'}
                            sx={{ mt: 1 }}
                          />
                        )}
                        {node.assignedUserId && (
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            {t('workflow.detail.assignedTo')}: {node.assignedUserId}
                          </Typography>
                        )}
                        {node.comments && (
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                            {t('workflow.detail.comments')}: {node.comments}
                          </Typography>
                        )}
                        {node.outputData && Object.keys(node.outputData).length > 0 && (
                          <Accordion sx={{ mt: 1 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="caption">{t('workflow.detail.outputData')}</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                                {JSON.stringify(node.outputData, null, 2)}
                              </pre>
                            </AccordionDetails>
                          </Accordion>
                        )}
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </CardContent>
          </Card>
        </Grid>

        {/* Context Data Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('workflow.detail.contextData')}
              </Typography>
              <Box sx={{ mt: 2 }}>
                {Object.entries(instance.contextData).map(([key, value]) => (
                  <Box key={key} mb={2}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                      {key}
                    </Typography>
                    <Typography variant="body2">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* SLA Information Card */}
          {instance.slaDeadline && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('workflow.detail.slaInformation')}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('workflow.detail.deadline')}
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(instance.slaDeadline), 'MMM dd, yyyy HH:mm')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(instance.slaDeadline), { addSuffix: true })}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Audit History */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">{t('workflow.detail.auditHistory')}</Typography>
                <Button
                  variant="outlined"
                  onClick={() => setShowHistory(!showHistory)}
                  disabled={historyLoading}
                >
                  {showHistory ? t('workflow.detail.hideHistory') : t('workflow.detail.showHistory')}
                </Button>
              </Box>

              {showHistory && (
                <>
                  {historyLoading ? (
                    <Box display="flex" justifyContent="center" p={3}>
                      <CircularProgress />
                    </Box>
                  ) : history.length === 0 ? (
                    <Alert severity="info">{t('workflow.detail.noHistory')}</Alert>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>{t('workflow.detail.eventType')}</TableCell>
                            <TableCell>{t('workflow.detail.eventDate')}</TableCell>
                            <TableCell>{t('workflow.detail.eventBy')}</TableCell>
                            <TableCell>{t('workflow.detail.eventData')}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {history.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <Chip
                                  label={t(`workflow.detail.eventType.${entry.eventType.toLowerCase()}`)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                {format(new Date(entry.eventDate), 'MMM dd, yyyy HH:mm:ss')}
                              </TableCell>
                              <TableCell>{entry.eventByUserId || '-'}</TableCell>
                              <TableCell>
                                {entry.eventData ? (
                                  <Accordion>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                      <Typography variant="caption">
                                        {t('workflow.detail.viewData')}
                                      </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                      <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                                        {JSON.stringify(entry.eventData, null, 2)}
                                      </pre>
                                    </AccordionDetails>
                                  </Accordion>
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
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default WorkflowInstanceDetailPage;
