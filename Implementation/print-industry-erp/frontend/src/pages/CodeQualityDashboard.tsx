import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
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
  LinearProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import CodeIcon from '@mui/icons-material/Code';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Chart } from '../components/common/Chart';
import {
  GET_QUALITY_METRICS_TRENDS,
  GET_ACTIVE_QUALITY_GATE_CONFIG,
  GET_AGENT_QUALITY_PASS_RATES,
  GET_QUALITY_GATE_BYPASSES,
  GET_CI_PIPELINE_METRICS,
  GET_LATEST_QUALITY_METRICS,
  GET_QUALITY_GATE_VALIDATIONS,
} from '../graphql/queries/codeQuality';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`quality-tabpanel-${index}`}
      aria-labelledby={`quality-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * Code Quality & Quality Gates Dashboard
 * REQ-STRATEGIC-AUTO-1767108044307
 *
 * Displays comprehensive code quality metrics, quality gate status,
 * agent quality scores, and CI/CD pipeline performance.
 */
export const CodeQualityDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedReqNumber, setSelectedReqNumber] = useState('');
  const [timePeriod, setTimePeriod] = useState('monthly');

  // Queries
  const {
    data: trendsData,
    loading: trendsLoading,
    refetch: refetchTrends,
  } = useQuery(GET_QUALITY_METRICS_TRENDS, {
    variables: { limit: 30 },
    pollInterval: 60000, // Refresh every 60 seconds
  });

  const {
    data: configData,
    loading: configLoading,
  } = useQuery(GET_ACTIVE_QUALITY_GATE_CONFIG);

  const {
    data: agentPassRatesData,
    loading: agentPassRatesLoading,
    refetch: refetchAgentPassRates,
  } = useQuery(GET_AGENT_QUALITY_PASS_RATES, {
    pollInterval: 60000,
  });

  const {
    data: bypassesData,
    loading: bypassesLoading,
    refetch: refetchBypasses,
  } = useQuery(GET_QUALITY_GATE_BYPASSES, {
    variables: { unresolvedOnly: true, limit: 20 },
    pollInterval: 60000,
  });

  const {
    data: pipelineMetricsData,
    loading: pipelineMetricsLoading,
    refetch: refetchPipelineMetrics,
  } = useQuery(GET_CI_PIPELINE_METRICS, {
    variables: { limit: 20 },
    pollInterval: 60000,
  });

  const {
    data: latestMetricsData,
    loading: latestMetricsLoading,
    refetch: refetchLatestMetrics,
  } = useQuery(GET_LATEST_QUALITY_METRICS, {
    variables: { reqNumber: selectedReqNumber },
    skip: !selectedReqNumber,
  });

  const {
    data: validationsData,
    loading: validationsLoading,
    refetch: refetchValidations,
  } = useQuery(GET_QUALITY_GATE_VALIDATIONS, {
    variables: { limit: 50 },
    pollInterval: 60000,
  });

  const handleRefreshAll = () => {
    refetchTrends();
    refetchAgentPassRates();
    refetchBypasses();
    refetchPipelineMetrics();
    refetchValidations();
    if (selectedReqNumber) {
      refetchLatestMetrics();
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Calculate overview metrics
  const trends = trendsData?.qualityMetricsTrends || [];
  const config = configData?.activeQualityGateConfig;
  const agentPassRates = agentPassRatesData?.agentQualityPassRates || [];
  const bypasses = bypassesData?.qualityGateBypasses || [];
  const pipelineMetrics = pipelineMetricsData?.ciPipelineMetrics || [];
  const validations = validationsData?.qualityGateValidations || [];

  const recentTrends = trends.slice(0, 10);
  const passedCount = recentTrends.filter((t: any) => t.qualityGatePassed).length;
  const passRate = recentTrends.length > 0 ? (passedCount / recentTrends.length) * 100 : 0;

  const avgCoverage = recentTrends.length > 0
    ? recentTrends.reduce((sum: number, t: any) => sum + (t.lineCoverage || 0), 0) / recentTrends.length
    : 0;

  const totalSecurityIssues = recentTrends.reduce(
    (sum: number, t: any) => sum + (t.criticalSecurityIssues || 0),
    0
  );

  const avgComplexity = recentTrends.length > 0
    ? recentTrends.reduce((sum: number, t: any) => sum + (t.maxComplexity || 0), 0) / recentTrends.length
    : 0;

  const avgPipelineTime = pipelineMetrics.length > 0
    ? pipelineMetrics.reduce((sum: number, p: any) => sum + (p.totalDurationSeconds || 0), 0) /
      pipelineMetrics.length / 60 // Convert to minutes
    : 0;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'passed':
      case 'success':
        return 'success';
      case 'failed':
      case 'failure':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'info';
      default:
        return 'default';
    }
  };

  if (trendsLoading || configLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Code Quality & Quality Gates Dashboard
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            label="Req Number"
            value={selectedReqNumber}
            onChange={(e) => setSelectedReqNumber(e.target.value)}
            placeholder="REQ-STRATEGIC-AUTO-..."
            sx={{ width: 280 }}
          />
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefreshAll} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Quality Gate Pass Rate
                  </Typography>
                  <Typography variant="h4">
                    {passRate.toFixed(1)}%
                  </Typography>
                  <Box mt={1}>
                    <LinearProgress
                      variant="determinate"
                      value={passRate}
                      color={passRate >= 90 ? 'success' : passRate >= 70 ? 'warning' : 'error'}
                    />
                  </Box>
                </Box>
                <CheckCircleIcon
                  sx={{ fontSize: 48, color: passRate >= 90 ? 'success.main' : 'warning.main' }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Avg Code Coverage
                  </Typography>
                  <Typography variant="h4">
                    {avgCoverage.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Target: {config?.minLineCoverage || 70}%
                  </Typography>
                </Box>
                <CodeIcon
                  sx={{ fontSize: 48, color: avgCoverage >= 70 ? 'success.main' : 'error.main' }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Critical Security Issues
                  </Typography>
                  <Typography variant="h4">
                    {totalSecurityIssues}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Last 10 builds
                  </Typography>
                </Box>
                <SecurityIcon
                  sx={{ fontSize: 48, color: totalSecurityIssues === 0 ? 'success.main' : 'error.main' }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Avg Pipeline Time
                  </Typography>
                  <Typography variant="h4">
                    {avgPipelineTime.toFixed(1)}m
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Target: &lt;{config?.maxCiPipelineMinutes || 30}m
                  </Typography>
                </Box>
                <SpeedIcon
                  sx={{
                    fontSize: 48,
                    color: avgPipelineTime <= 30 ? 'success.main' : 'warning.main',
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active Quality Gates Alert */}
      {config && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Active Quality Gate Configuration: {config.name}</AlertTitle>
          <Typography variant="body2">
            Coverage: ≥{config.minLineCoverage}% | Complexity: ≤{config.maxCyclomaticComplexity} |
            Critical Vulnerabilities: {config.maxCriticalVulnerabilities} | CI Time: ≤
            {config.maxCiPipelineMinutes}min
          </Typography>
        </Alert>
      )}

      {/* Unresolved Bypasses Alert */}
      {bypasses.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>{bypasses.length} Unresolved Quality Gate Bypasses</AlertTitle>
          <Typography variant="body2">
            Emergency bypasses require follow-up and post-mortem completion.
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="quality tabs">
          <Tab label="Quality Trends" />
          <Tab label="Validation History" />
          <Tab label="Agent Scores" />
          <Tab label="Quality Gate Bypasses" />
          <Tab label="Pipeline Performance" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        {/* Quality Trends */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quality Gate Pass Rate Trend
                </Typography>
                <Chart
                  type="line"
                  data={trends.slice(0, 20).reverse().map((t: any) => ({
                    date: new Date(t.createdAt).toLocaleDateString(),
                    passRate: t.qualityGatePassed ? 100 : 0,
                    coverage: t.lineCoverage || 0,
                  }))}
                  xKey="date"
                  yKey="passRate"
                  title=""
                  height={300}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Code Coverage Trend
                </Typography>
                <Chart
                  type="line"
                  data={trends.slice(0, 20).reverse().map((t: any) => ({
                    date: new Date(t.createdAt).toLocaleDateString(),
                    coverage: t.lineCoverage || 0,
                  }))}
                  xKey="date"
                  yKey="coverage"
                  title=""
                  height={250}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Complexity Trend
                </Typography>
                <Chart
                  type="line"
                  data={trends.slice(0, 20).reverse().map((t: any) => ({
                    date: new Date(t.createdAt).toLocaleDateString(),
                    complexity: t.maxComplexity || 0,
                  }))}
                  xKey="date"
                  yKey="complexity"
                  title=""
                  height={250}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Quality Metrics
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Req Number</TableCell>
                        <TableCell>Commit</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="center">Coverage</TableCell>
                        <TableCell align="center">Complexity</TableCell>
                        <TableCell align="center">Lint Issues</TableCell>
                        <TableCell align="center">Security</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trends.slice(0, 15).map((trend: any) => (
                        <TableRow key={trend.commitSha}>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {trend.reqNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {trend.commitSha.substring(0, 7)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(trend.createdAt).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${trend.lineCoverage?.toFixed(1) || 0}%`}
                              size="small"
                              color={(trend.lineCoverage || 0) >= 70 ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={trend.maxComplexity || 0}
                              size="small"
                              color={(trend.maxComplexity || 0) <= 10 ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={trend.totalLintIssues || 0}
                              size="small"
                              color={(trend.totalLintIssues || 0) === 0 ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={trend.criticalSecurityIssues || 0}
                              size="small"
                              color={
                                (trend.criticalSecurityIssues || 0) === 0 ? 'success' : 'error'
                              }
                              icon={<SecurityIcon />}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={trend.qualityGatePassed ? 'PASSED' : 'FAILED'}
                              size="small"
                              color={getStatusColor(
                                trend.qualityGatePassed ? 'passed' : 'failed'
                              )}
                              icon={
                                trend.qualityGatePassed ? (
                                  <CheckCircleIcon />
                                ) : (
                                  <ErrorIcon />
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* Validation History */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Quality Gate Validations
                </Typography>
                {validationsLoading ? (
                  <CircularProgress />
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Req Number</TableCell>
                          <TableCell>Agent</TableCell>
                          <TableCell align="center">Status</TableCell>
                          <TableCell align="center">Linting</TableCell>
                          <TableCell align="center">Type Check</TableCell>
                          <TableCell align="center">Tests</TableCell>
                          <TableCell align="center">Coverage</TableCell>
                          <TableCell align="center">Security</TableCell>
                          <TableCell align="center">Duration</TableCell>
                          <TableCell align="center">Created</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {validations.map((validation: any) => (
                          <TableRow
                            key={validation.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/quality/code-quality/validations/${validation.id}`)}
                          >
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                {validation.reqNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>{validation.agentName}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={validation.status}
                                size="small"
                                color={getStatusColor(validation.overallPassed ? 'passed' : 'failed')}
                                icon={
                                  validation.overallPassed ? (
                                    <CheckCircleIcon />
                                  ) : (
                                    <ErrorIcon />
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              {validation.lintingPassed !== null ? (
                                validation.lintingPassed ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <ErrorIcon color="error" />
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {validation.typeCheckingPassed !== null ? (
                                validation.typeCheckingPassed ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <ErrorIcon color="error" />
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {validation.unitTestsPassed !== null ? (
                                validation.unitTestsPassed ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <ErrorIcon color="error" />
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {validation.coverageCheckPassed !== null ? (
                                validation.coverageCheckPassed ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <ErrorIcon color="error" />
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {validation.securityCheckPassed !== null ? (
                                validation.securityCheckPassed ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <ErrorIcon color="error" />
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {validation.validationDurationMs
                                ? `${(validation.validationDurationMs / 1000).toFixed(1)}s`
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2">
                                {new Date(validation.createdAt).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/quality/code-quality/validations/${validation.id}`);
                                }}
                              >
                                Details
                              </Button>
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
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {/* Agent Quality Scores */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Agent Quality Pass Rates
                </Typography>
                {agentPassRatesLoading ? (
                  <CircularProgress />
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Agent Name</TableCell>
                          <TableCell align="center">Total Validations</TableCell>
                          <TableCell align="center">Passed</TableCell>
                          <TableCell align="center">Failed</TableCell>
                          <TableCell align="center">Pass Rate</TableCell>
                          <TableCell align="center">Avg Validation Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {agentPassRates.map((agent: any) => (
                          <TableRow key={agent.agentName}>
                            <TableCell>
                              <Typography variant="body1" fontWeight="medium">
                                {agent.agentName}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">{agent.totalValidations}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={agent.passedValidations}
                                size="small"
                                color="success"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={agent.failedValidations} size="small" color="error" />
                            </TableCell>
                            <TableCell align="center">
                              <Box display="flex" alignItems="center" justifyContent="center">
                                <Typography variant="body1" fontWeight="medium">
                                  {agent.passRatePct?.toFixed(1)}%
                                </Typography>
                                <Box ml={1} width={100}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={agent.passRatePct || 0}
                                    color={
                                      agent.passRatePct >= 90
                                        ? 'success'
                                        : agent.passRatePct >= 70
                                        ? 'warning'
                                        : 'error'
                                    }
                                  />
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              {agent.avgValidationTimeMs
                                ? `${(agent.avgValidationTimeMs / 1000).toFixed(1)}s`
                                : 'N/A'}
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

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Agent Pass Rate Comparison
                </Typography>
                <Chart
                  type="bar"
                  data={agentPassRates.map((agent: any) => ({
                    agent: agent.agentName,
                    passRate: agent.passRatePct || 0,
                  }))}
                  xKey="agent"
                  yKey="passRate"
                  title=""
                  height={300}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {/* Quality Gate Bypasses */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Unresolved Quality Gate Bypasses
                </Typography>
                {bypassesLoading ? (
                  <CircularProgress />
                ) : bypasses.length === 0 ? (
                  <Alert severity="success">No unresolved bypasses</Alert>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Req Number</TableCell>
                          <TableCell>Bypassed At</TableCell>
                          <TableCell>Bypassed By</TableCell>
                          <TableCell>Reason</TableCell>
                          <TableCell>Violations</TableCell>
                          <TableCell>Follow-up Issue</TableCell>
                          <TableCell>Postmortem</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bypasses.map((bypass: any) => (
                          <TableRow key={bypass.id}>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                {bypass.reqNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {new Date(bypass.bypassedAt).toLocaleString()}
                            </TableCell>
                            <TableCell>{bypass.bypassedBy}</TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                                {bypass.bypassReason}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5} flexWrap="wrap">
                                {bypass.bypassedViolations?.slice(0, 2).map((v: string, i: number) => (
                                  <Chip
                                    key={i}
                                    label={v}
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                  />
                                ))}
                                {bypass.bypassedViolations?.length > 2 && (
                                  <Chip
                                    label={`+${bypass.bypassedViolations.length - 2}`}
                                    size="small"
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {bypass.followUpIssueNumber ? (
                                <Chip
                                  label={bypass.followUpIssueNumber}
                                  size="small"
                                  color={bypass.followUpCompleted ? 'success' : 'warning'}
                                />
                              ) : (
                                <Chip label="No follow-up" size="small" color="error" />
                              )}
                            </TableCell>
                            <TableCell>
                              {bypass.postmortemCompleted ? (
                                <Chip label="Complete" size="small" color="success" />
                              ) : (
                                <Chip label="Pending" size="small" color="error" />
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
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        {/* CI/CD Pipeline Performance */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent CI/CD Pipeline Runs
                </Typography>
                {pipelineMetricsLoading ? (
                  <CircularProgress />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Pipeline ID</TableCell>
                          <TableCell>Branch</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="center">Total Time</TableCell>
                          <TableCell align="center">Lint</TableCell>
                          <TableCell align="center">Test</TableCell>
                          <TableCell align="center">Build</TableCell>
                          <TableCell align="center">Security</TableCell>
                          <TableCell align="center">Cache Hit</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pipelineMetrics.map((pipeline: any) => (
                          <TableRow key={pipeline.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {pipeline.pipelineId.substring(0, 8)}
                              </Typography>
                            </TableCell>
                            <TableCell>{pipeline.branch}</TableCell>
                            <TableCell>
                              <Chip
                                label={pipeline.pipelineType}
                                size="small"
                                color={
                                  pipeline.pipelineType === 'fast_feedback' ? 'info' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${Math.round(pipeline.totalDurationSeconds / 60)}m`}
                                size="small"
                                color={
                                  pipeline.totalDurationSeconds <= 1800
                                    ? 'success'
                                    : 'warning'
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              {pipeline.lintDurationSeconds
                                ? `${Math.round(pipeline.lintDurationSeconds)}s`
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              {pipeline.testDurationSeconds
                                ? `${Math.round(pipeline.testDurationSeconds)}s`
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              {pipeline.buildDurationSeconds
                                ? `${Math.round(pipeline.buildDurationSeconds)}s`
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              {pipeline.securityScanDurationSeconds
                                ? `${Math.round(pipeline.securityScanDurationSeconds)}s`
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="center">
                              {pipeline.cacheHitRate ? (
                                <Chip
                                  label={`${(pipeline.cacheHitRate * 100).toFixed(0)}%`}
                                  size="small"
                                  color={pipeline.cacheHitRate >= 0.8 ? 'success' : 'warning'}
                                />
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={pipeline.status}
                                size="small"
                                color={getStatusColor(pipeline.status)}
                                icon={
                                  pipeline.status === 'success' ? (
                                    <CheckCircleIcon />
                                  ) : (
                                    <ErrorIcon />
                                  )
                                }
                              />
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

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pipeline Duration Trend
                </Typography>
                <Chart
                  type="line"
                  data={pipelineMetrics.slice(0, 15).reverse().map((p: any) => ({
                    id: p.pipelineId.substring(0, 8),
                    duration: Math.round(p.totalDurationSeconds / 60),
                  }))}
                  xKey="id"
                  yKey="duration"
                  title=""
                  height={250}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cache Hit Rate
                </Typography>
                <Chart
                  type="bar"
                  data={pipelineMetrics
                    .filter((p: any) => p.cacheHitRate !== null)
                    .slice(0, 15)
                    .reverse()
                    .map((p: any) => ({
                      id: p.pipelineId.substring(0, 8),
                      cacheHit: (p.cacheHitRate * 100).toFixed(0),
                    }))}
                  xKey="id"
                  yKey="cacheHit"
                  title=""
                  height={250}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Container>
  );
};
