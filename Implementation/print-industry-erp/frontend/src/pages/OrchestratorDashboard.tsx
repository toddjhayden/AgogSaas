import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UndoIcon from '@mui/icons-material/Undo';
import {
  GET_ACTIVE_WORKFLOWS,
  GET_STRATEGIC_DECISIONS,
  GET_ESCALATION_QUEUE,
  GET_SYSTEM_HEALTH_ORCHESTRATOR,
  RESET_CIRCUIT_BREAKER,
  PAUSE_DAEMON,
  RESUME_DAEMON,
  ROLLBACK_WORKFLOW,
} from '@graphql/queries';

export const OrchestratorDashboard = () => {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [rollbackDialog, setRollbackDialog] = useState<{ open: boolean; reqNumber?: string }>({
    open: false,
  });
  const [rollbackReason, setRollbackReason] = useState('');

  // Queries
  const { data: workflowsData, loading: workflowsLoading, refetch: refetchWorkflows } = useQuery(
    GET_ACTIVE_WORKFLOWS,
    { pollInterval: autoRefresh ? 5000 : 0 }
  );

  const { data: decisionsData, loading: decisionsLoading, refetch: refetchDecisions } = useQuery(
    GET_STRATEGIC_DECISIONS,
    { variables: { last: 10 }, pollInterval: autoRefresh ? 10000 : 0 }
  );

  const { data: escalationsData, refetch: refetchEscalations } =
    useQuery(GET_ESCALATION_QUEUE, { pollInterval: autoRefresh ? 30000 : 0 });

  const { data: healthData, loading: healthLoading, refetch: refetchHealth } = useQuery(
    GET_SYSTEM_HEALTH_ORCHESTRATOR,
    { pollInterval: autoRefresh ? 10000 : 0 }
  );

  // Mutations
  const [resetCircuitBreaker] = useMutation(RESET_CIRCUIT_BREAKER);
  const [pauseDaemon] = useMutation(PAUSE_DAEMON);
  const [resumeDaemon] = useMutation(RESUME_DAEMON);
  const [rollbackWorkflow] = useMutation(ROLLBACK_WORKFLOW);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => setLastRefresh(new Date()), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefreshAll = () => {
    setLastRefresh(new Date());
    refetchWorkflows();
    refetchDecisions();
    refetchEscalations();
    refetchHealth();
  };

  const handleResetCircuitBreaker = async () => {
    try {
      await resetCircuitBreaker();
      handleRefreshAll();
    } catch (error) {
      console.error('Failed to reset circuit breaker:', error);
    }
  };

  const handlePauseDaemon = async () => {
    try {
      await pauseDaemon();
      handleRefreshAll();
    } catch (error) {
      console.error('Failed to pause daemon:', error);
    }
  };

  const handleResumeDaemon = async () => {
    try {
      await resumeDaemon();
      handleRefreshAll();
    } catch (error) {
      console.error('Failed to resume daemon:', error);
    }
  };

  const handleRollbackWorkflow = async () => {
    if (!rollbackDialog.reqNumber || !rollbackReason) return;

    try {
      await rollbackWorkflow({
        variables: {
          reqNumber: rollbackDialog.reqNumber,
          reason: rollbackReason,
        },
      });
      setRollbackDialog({ open: false });
      setRollbackReason('');
      handleRefreshAll();
    } catch (error) {
      console.error('Failed to rollback workflow:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return 'primary';
      case 'complete':
        return 'success';
      case 'blocked':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence?.toLowerCase()) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      case 'low':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL_SYSTEM_FAILURE':
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
      case 'MERGE_CONFLICT':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Autonomous Orchestrator - Live Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()} | Auto-refresh:{' '}
            {autoRefresh ? 'ON' : 'OFF'}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button variant="outlined" onClick={() => setAutoRefresh(!autoRefresh)}>
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={handleRefreshAll}>
            Refresh Now
          </Button>
        </Box>
      </Box>

      {/* System Health Card */}
      <Box mb={4}>
        <Typography variant="h5" gutterBottom>
          System Health
        </Typography>
        <Card>
          <CardContent>
            {healthLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      NATS
                    </Typography>
                    <Chip
                      label={
                        healthData?.systemHealthOrchestrator?.nats?.connected
                          ? 'Connected'
                          : 'Disconnected'
                      }
                      color={
                        healthData?.systemHealthOrchestrator?.nats?.connected
                          ? 'success'
                          : 'error'
                      }
                      size="small"
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {healthData?.systemHealthOrchestrator?.nats?.responseTime}ms
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      PostgreSQL
                    </Typography>
                    <Chip
                      label={
                        healthData?.systemHealthOrchestrator?.postgres?.connected
                          ? 'Connected'
                          : 'Disconnected'
                      }
                      color={
                        healthData?.systemHealthOrchestrator?.postgres?.connected
                          ? 'success'
                          : 'error'
                      }
                      size="small"
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {healthData?.systemHealthOrchestrator?.postgres?.responseTime}ms
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Circuit Breaker
                    </Typography>
                    <Chip
                      label={healthData?.systemHealthOrchestrator?.circuitBreaker?.status || 'OK'}
                      color={
                        healthData?.systemHealthOrchestrator?.circuitBreaker?.status === 'TRIPPED'
                          ? 'error'
                          : 'success'
                      }
                      size="small"
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {healthData?.systemHealthOrchestrator?.circuitBreaker?.failures || 0}/
                      {healthData?.systemHealthOrchestrator?.circuitBreaker?.maxFailures || 5}{' '}
                      failures
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Active Agents
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 1 }}>
                      {healthData?.systemHealthOrchestrator?.activeAgents || 0}/
                      {healthData?.systemHealthOrchestrator?.maxAgents || 20}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {Math.round(
                        ((healthData?.systemHealthOrchestrator?.activeAgents || 0) /
                          (healthData?.systemHealthOrchestrator?.maxAgents || 20)) *
                          100
                      )}
                      % capacity
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>

        {/* Emergency Controls */}
        <Box display="flex" gap={2} mt={2}>
          <Tooltip title="Reset circuit breaker after fixing issues">
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RestartAltIcon />}
              onClick={handleResetCircuitBreaker}
              disabled={
                healthData?.systemHealthOrchestrator?.circuitBreaker?.status !== 'TRIPPED'
              }
            >
              Reset Circuit Breaker
            </Button>
          </Tooltip>
          <Tooltip title="Pause daemon - no new workflows will start">
            <Button
              variant="outlined"
              color="error"
              startIcon={<PauseIcon />}
              onClick={handlePauseDaemon}
            >
              Pause Daemon
            </Button>
          </Tooltip>
          <Tooltip title="Resume daemon - start scanning for new workflows">
            <Button
              variant="outlined"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={handleResumeDaemon}
            >
              Resume Daemon
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Escalation Queue */}
      {escalationsData?.escalationQueue && escalationsData.escalationQueue.length > 0 && (
        <Box mb={4}>
          <Typography variant="h5" gutterBottom>
            Escalation Queue
          </Typography>
          <Card>
            <CardContent>
              {escalationsData.escalationQueue.map((escalation: any, index: number) => (
                <Alert severity={getPriorityColor(escalation.priority)} key={index} sx={{ mb: 2 }}>
                  <AlertTitle>
                    {escalation.req_number} - {escalation.priority}
                  </AlertTitle>
                  <Typography variant="body2">{escalation.reason}</Typography>
                  {escalation.action_required && (
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Action Required: {escalation.action_required}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(escalation.timestamp).toLocaleString()}
                  </Typography>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Active Workflows */}
      <Box mb={4}>
        <Typography variant="h5" gutterBottom>
          Active Workflows
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Req Number</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Elapsed</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workflowsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : workflowsData?.activeWorkflows?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No active workflows
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                workflowsData?.activeWorkflows?.map((workflow: unknown) => (
                  <TableRow key={workflow.reqNumber}>
                    <TableCell>{workflow.reqNumber}</TableCell>
                    <TableCell>{workflow.title}</TableCell>
                    <TableCell>{workflow.currentStage}</TableCell>
                    <TableCell>{workflow.currentAgent}</TableCell>
                    <TableCell>
                      <Chip
                        label={workflow.status}
                        color={getStatusColor(workflow.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{workflow.elapsedMinutes} min</TableCell>
                    <TableCell>{workflow.assignedTo}</TableCell>
                    <TableCell>
                      <Tooltip title="Rollback workflow">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            setRollbackDialog({ open: true, reqNumber: workflow.reqNumber })
                          }
                        >
                          <UndoIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Strategic Decisions */}
      <Box mb={4}>
        <Typography variant="h5" gutterBottom>
          Recent Strategic Decisions
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Req Number</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Decision</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Reasoning</TableCell>
                <TableCell>Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {decisionsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : decisionsData?.strategicDecisions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No strategic decisions yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                decisionsData?.strategicDecisions?.map((decision: unknown) => (
                  <TableRow key={decision.decision_id}>
                    <TableCell>{decision.req_number}</TableCell>
                    <TableCell>{decision.strategic_agent}</TableCell>
                    <TableCell>
                      <Chip
                        label={decision.decision}
                        color={
                          decision.decision === 'APPROVE'
                            ? 'success'
                            : decision.decision === 'ESCALATE_HUMAN'
                            ? 'error'
                            : 'warning'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={decision.decision_confidence}
                        color={getConfidenceColor(decision.decision_confidence)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={decision.reasoning}>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {decision.reasoning}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(decision.timestamp).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Rollback Dialog */}
      <Dialog
        open={rollbackDialog.open}
        onClose={() => {
          setRollbackDialog({ open: false });
          setRollbackReason('');
        }}
      >
        <DialogTitle>Rollback Workflow</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to rollback workflow {rollbackDialog.reqNumber}. This will revert all
            changes made by this workflow. Please provide a reason for the rollback.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Rollback Reason"
            type="text"
            fullWidth
            variant="outlined"
            value={rollbackReason}
            onChange={(e) => setRollbackReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRollbackDialog({ open: false });
              setRollbackReason('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRollbackWorkflow}
            color="error"
            variant="contained"
            disabled={!rollbackReason}
          >
            Rollback
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
