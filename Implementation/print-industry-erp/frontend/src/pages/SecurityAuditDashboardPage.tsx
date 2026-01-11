/**
 * Security Audit Dashboard Page
 * REQ-AUDIT-1767123891954-0jlp4
 *
 * Comprehensive security monitoring and audit dashboard:
 * - Security overview with key metrics and trends
 * - Real-time security event monitoring
 * - Security incident management
 * - Threat pattern configuration
 * - Compliance audit trail
 * - Geographic access visualization
 *
 * CONTEXT: This dashboard addresses the audit parsing failure investigation
 * by providing visibility into security audits, including any parsing failures
 * that are flagged as WARNING-level incidents for manual review.
 */

import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Button,

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
  TablePagination,
  Paper,
  Tooltip,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Public as PublicIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  VpnLock as VpnLockIcon,
  EventNote as EventNoteIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';
import {
  GET_SECURITY_OVERVIEW,
  GET_SECURITY_AUDIT_EVENTS,
  GET_SUSPICIOUS_IPS,
  GET_SECURITY_INCIDENTS,
  GET_THREAT_PATTERNS,
  
  GET_GEOGRAPHIC_ACCESS_MAP,
} from '../graphql/queries/securityAudit';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface SecurityAuditEventEdge {
  node: {
    id: string;
    eventTimestamp: string;
    eventType: string;
    username: string | null;
    ipAddress: string;
    riskLevel: string;
    success: boolean;
    countryCode: string | null;
    city: string | null;
  };
}

interface SecurityIncidentEdge {
  node: {
    id: string;
    incidentNumber: string;
    title: string;
    severity: string;
    status: string;
    detectedAt: string;
    assignedTo?: {
      username: string;
    };
  };
}

interface ThreatPattern {
  id: string;
  patternName: string;
  patternDescription?: string;
  severity: string;
  matchCount: number;
  autoBlock: boolean;
  enabled: boolean;
}

interface SuspiciousIP {
  ipAddress: string;
  eventCount: number;
  failedLoginCount: number;
  riskScore: number;
  blocked: boolean;
}

interface SuspiciousUser {
  userId: string;
  username: string;
  suspiciousEventCount: number;
  riskScore: number;
  lastSuspiciousActivity: string;
}

interface GeographicAccessEntry {
  countryCode: string;
  countryName?: string;
  accessCount: number;
  failedLoginCount: number;
  suspiciousEventCount: number;
  uniqueUsers: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`security-tabpanel-${index}`}
      aria-labelledby={`security-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const SecurityAuditDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState<string>('LAST_24_HOURS');
  const [eventFilter, setEventFilter] = useState({
    eventTypes: [] as string[],
    riskLevels: [] as string[],
    flaggedSuspicious: undefined as boolean | undefined,
    success: undefined as boolean | undefined,
  });
  const [eventPage, setEventPage] = useState(0);
  const [eventRowsPerPage, setEventRowsPerPage] = useState(25);

  // Query: Security Overview
  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery(GET_SECURITY_OVERVIEW, {
    variables: { timeRange },
    pollInterval: 60000, // Refresh every 60 seconds
  });

  // Query: Security Audit Events
  const {
    data: eventsData,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useQuery(GET_SECURITY_AUDIT_EVENTS, {
    variables: {
      filter: eventFilter,
      pagination: {
        first: eventRowsPerPage,
        after: eventPage > 0 ? btoa(`cursor:${eventPage * eventRowsPerPage}`) : null,
      },
    },
  });

  // Query: Suspicious IPs
  const { data: suspiciousIPsData } = useQuery(GET_SUSPICIOUS_IPS, {
    variables: { hours: 24, limit: 10 },
  });

  // Query: Security Incidents
  const { data: incidentsData, loading: incidentsLoading } = useQuery(GET_SECURITY_INCIDENTS, {
    variables: {
      status: ['OPEN', 'INVESTIGATING'],
      severity: null,
      pagination: { first: 10 },
    },
  });

  // Query: Threat Patterns
  const { data: threatPatternsData } = useQuery(GET_THREAT_PATTERNS, {
    variables: { enabled: true },
  });

  // Query: Geographic Access Map
  const { data: geoMapData } = useQuery(GET_GEOGRAPHIC_ACCESS_MAP, {
    variables: { hours: 24 },
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleRefresh = () => {
    refetchOverview();
    refetchEvents();
  };

  const handleEventPageChange = (_event: unknown, newPage: number) => {
    setEventPage(newPage);
  };

  const handleEventRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEventRowsPerPage(parseInt(event.target.value, 10));
    setEventPage(0);
  };

  const getSecurityScoreColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return <TrendingUpIcon color="success" />;
      case 'DEGRADING':
      case 'CRITICAL':
        return <TrendingDownIcon color="error" />;
      default:
        return <RemoveIcon color="action" />;
    }
  };

  const getRiskLevelColor = (level: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (level) {
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

  const getEventTypeIcon = (eventType: string) => {
    if (eventType.includes('LOGIN')) return <PersonIcon />;
    if (eventType.includes('PERMISSION')) return <LockIcon />;
    if (eventType.includes('ZONE')) return <VpnLockIcon />;
    if (eventType.includes('DATA')) return <EventNoteIcon />;
    if (eventType.includes('SUSPICIOUS')) return <BugReportIcon />;
    return <SecurityIcon />;
  };

  if (overviewLoading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (overviewError) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('securityAudit.errors.loadOverview')}: {overviewError.message}
        </Alert>
      </Container>
    );
  }

  const overview = overviewData?.securityOverview;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('securityAudit.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('securityAudit.subtitle')}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('securityAudit.timeRange')}</InputLabel>
            <Select
              value={timeRange}
              label={t('securityAudit.timeRange')}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="LAST_HOUR">{t('securityAudit.timeRanges.lastHour')}</MenuItem>
              <MenuItem value="LAST_6_HOURS">{t('securityAudit.timeRanges.last6Hours')}</MenuItem>
              <MenuItem value="LAST_24_HOURS">{t('securityAudit.timeRanges.last24Hours')}</MenuItem>
              <MenuItem value="LAST_7_DAYS">{t('securityAudit.timeRanges.last7Days')}</MenuItem>
              <MenuItem value="LAST_30_DAYS">{t('securityAudit.timeRanges.last30Days')}</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={handleRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Security Score Overview */}
      {overview && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Security Score Card */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  {t('securityAudit.overview.securityScore')}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h3" color={getSecurityScoreColor(overview.securityScore)}>
                    {overview.securityScore.toFixed(0)}
                  </Typography>
                  {getTrendIcon(overview.trend)}
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={overview.securityScore}
                  color={getSecurityScoreColor(overview.securityScore)}
                  sx={{ mt: 2 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Total Events Card */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  {t('securityAudit.overview.totalEvents')}
                </Typography>
                <Typography variant="h3">{overview.totalEvents.toLocaleString()}</Typography>
                <Box display="flex" gap={1} mt={2}>
                  <Chip
                    label={`${overview.criticalEvents} ${t('securityAudit.riskLevels.critical')}`}
                    color="error"
                    size="small"
                  />
                  <Chip
                    label={`${overview.highRiskEvents} ${t('securityAudit.riskLevels.high')}`}
                    color="warning"
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Authentication Card */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  {t('securityAudit.overview.authentication')}
                </Typography>
                <Typography variant="h3">{overview.loginAttempts.toLocaleString()}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t('securityAudit.overview.successRate')}: {overview.successRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                  {overview.failedLogins} {t('securityAudit.overview.failedLogins')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Active Incidents Card */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  {t('securityAudit.overview.activeIncidents')}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Badge badgeContent={overview.activeIncidents} color="error">
                    <WarningIcon color="action" sx={{ fontSize: 40 }} />
                  </Badge>
                  <Box ml={2}>
                    <Typography variant="h4">{overview.activeIncidents}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {overview.openInvestigations} {t('securityAudit.overview.investigating')}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs for detailed views */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="security audit tabs">
            <Tab label={t('securityAudit.tabs.events')} />
            <Tab label={t('securityAudit.tabs.incidents')} />
            <Tab label={t('securityAudit.tabs.threats')} />
            <Tab label={t('securityAudit.tabs.suspicious')} />
            <Tab label={t('securityAudit.tabs.geographic')} />
          </Tabs>
        </Box>

        {/* Tab 0: Security Events */}
        <TabPanel value={activeTab} index={0}>
          <Box mb={2} display="flex" gap={2} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('securityAudit.filters.riskLevel')}</InputLabel>
              <Select
                multiple
                value={eventFilter.riskLevels}
                label={t('securityAudit.filters.riskLevel')}
                onChange={(e) =>
                  setEventFilter({ ...eventFilter, riskLevels: e.target.value as string[] })
                }
              >
                <MenuItem value="CRITICAL">{t('securityAudit.riskLevels.critical')}</MenuItem>
                <MenuItem value="HIGH">{t('securityAudit.riskLevels.high')}</MenuItem>
                <MenuItem value="MEDIUM">{t('securityAudit.riskLevels.medium')}</MenuItem>
                <MenuItem value="LOW">{t('securityAudit.riskLevels.low')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('securityAudit.filters.status')}</InputLabel>
              <Select
                value={eventFilter.success ?? ''}
                label={t('securityAudit.filters.status')}
                onChange={(e) =>
                  setEventFilter({
                    ...eventFilter,
                    success: e.target.value === '' ? undefined : e.target.value === 'true',
                  })
                }
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                <MenuItem value="true">{t('securityAudit.status.success')}</MenuItem>
                <MenuItem value="false">{t('securityAudit.status.failed')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('securityAudit.filters.suspicious')}</InputLabel>
              <Select
                value={eventFilter.flaggedSuspicious ?? ''}
                label={t('securityAudit.filters.suspicious')}
                onChange={(e) =>
                  setEventFilter({
                    ...eventFilter,
                    flaggedSuspicious:
                      e.target.value === '' ? undefined : e.target.value === 'true',
                  })
                }
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                <MenuItem value="true">{t('securityAudit.suspicious.flagged')}</MenuItem>
                <MenuItem value="false">{t('securityAudit.suspicious.normal')}</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() =>
                setEventFilter({
                  eventTypes: [],
                  riskLevels: [],
                  success: undefined,
                  flaggedSuspicious: undefined,
                })
              }
            >
              {t('common.clearFilters')}
            </Button>
          </Box>

          {eventsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : eventsError ? (
            <Alert severity="error">
              {t('securityAudit.errors.loadEvents')}: {eventsError.message}
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('securityAudit.table.timestamp')}</TableCell>
                    <TableCell>{t('securityAudit.table.eventType')}</TableCell>
                    <TableCell>{t('securityAudit.table.user')}</TableCell>
                    <TableCell>{t('securityAudit.table.ipAddress')}</TableCell>
                    <TableCell>{t('securityAudit.table.riskLevel')}</TableCell>
                    <TableCell>{t('securityAudit.table.status')}</TableCell>
                    <TableCell>{t('securityAudit.table.location')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {eventsData?.securityAuditEvents?.edges?.map((edge: SecurityAuditEventEdge) => {
                    const event = edge.node;
                    return (
                      <TableRow key={event.id} hover>
                        <TableCell>
                          {new Date(event.eventTimestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getEventTypeIcon(event.eventType)}
                            <Typography variant="body2">
                              {String(t(`securityAudit.eventTypes.${event.eventType}`, event.eventType))}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{event.username || '-'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {event.ipAddress}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={String(t(
                              `securityAudit.riskLevels.${event.riskLevel.toLowerCase()}`,
                              event.riskLevel
                            ))}
                            color={getRiskLevelColor(event.riskLevel)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {event.success ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="error" fontSize="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          {event.countryCode ? (
                            <Chip
                              label={`${event.countryCode}${event.city ? ` - ${event.city}` : ''}`}
                              size="small"
                              variant="outlined"
                            />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={eventsData?.securityAuditEvents?.totalCount || 0}
                page={eventPage}
                onPageChange={handleEventPageChange}
                rowsPerPage={eventRowsPerPage}
                onRowsPerPageChange={handleEventRowsPerPageChange}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </TableContainer>
          )}
        </TabPanel>

        {/* Tab 1: Security Incidents */}
        <TabPanel value={activeTab} index={1}>
          {incidentsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('securityAudit.incidents.incidentNumber')}</TableCell>
                    <TableCell>{t('securityAudit.incidents.title')}</TableCell>
                    <TableCell>{t('securityAudit.incidents.severity')}</TableCell>
                    <TableCell>{t('securityAudit.incidents.status')}</TableCell>
                    <TableCell>{t('securityAudit.incidents.assignedTo')}</TableCell>
                    <TableCell>{t('securityAudit.incidents.detectedAt')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {incidentsData?.securityIncidents?.edges?.map((edge: SecurityIncidentEdge) => {
                    const incident = edge.node;
                    return (
                      <TableRow key={incident.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {incident.incidentNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>{incident.title}</TableCell>
                        <TableCell>
                          <Chip
                            label={String(t(
                              `securityAudit.riskLevels.${incident.severity.toLowerCase()}`,
                              incident.severity
                            ))}
                            color={getRiskLevelColor(incident.severity)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={String(t(
                              `securityAudit.incidents.statuses.${incident.status.toLowerCase()}`,
                              incident.status
                            ))}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{incident.assignedTo?.username || '-'}</TableCell>
                        <TableCell>{new Date(incident.detectedAt).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {incidentsData?.securityIncidents?.edges?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          {t('securityAudit.incidents.noActiveIncidents')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Tab 2: Threat Patterns */}
        <TabPanel value={activeTab} index={2}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('securityAudit.threats.patternName')}</TableCell>
                  <TableCell>{t('securityAudit.threats.severity')}</TableCell>
                  <TableCell>{t('securityAudit.threats.matchCount')}</TableCell>
                  <TableCell>{t('securityAudit.threats.autoBlock')}</TableCell>
                  <TableCell>{t('securityAudit.threats.enabled')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {threatPatternsData?.threatPatterns?.map((pattern: ThreatPattern) => (
                  <TableRow key={pattern.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {pattern.patternName}
                      </Typography>
                      {pattern.patternDescription && (
                        <Typography variant="caption" color="text.secondary">
                          {pattern.patternDescription}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={String(t(
                          `securityAudit.riskLevels.${pattern.severity.toLowerCase()}`,
                          pattern.severity
                        ))}
                        color={getRiskLevelColor(pattern.severity)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{pattern.matchCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {pattern.autoBlock ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <RemoveIcon color="disabled" fontSize="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {pattern.enabled ? (
                        <Chip label={t('common.enabled')} color="success" size="small" />
                      ) : (
                        <Chip label={t('common.disabled')} color="default" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!threatPatternsData?.threatPatterns ||
                  threatPatternsData.threatPatterns.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {t('securityAudit.threats.noPatterns')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 3: Suspicious Activity */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                {t('securityAudit.suspicious.suspiciousIPs')}
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('securityAudit.table.ipAddress')}</TableCell>
                      <TableCell align="right">{t('securityAudit.suspicious.events')}</TableCell>
                      <TableCell align="right">
                        {t('securityAudit.suspicious.failedLogins')}
                      </TableCell>
                      <TableCell align="right">{t('securityAudit.suspicious.riskScore')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {suspiciousIPsData?.suspiciousIPs?.map((ip: SuspiciousIP) => (
                      <TableRow key={ip.ipAddress}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {ip.ipAddress}
                          </Typography>
                          {ip.blocked && (
                            <Chip
                              label={t('securityAudit.suspicious.blocked')}
                              color="error"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">{ip.eventCount}</TableCell>
                        <TableCell align="right">{ip.failedLoginCount}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={ip.riskScore.toFixed(1)}
                            color={
                              ip.riskScore >= 80
                                ? 'error'
                                : ip.riskScore >= 50
                                  ? 'warning'
                                  : 'default'
                            }
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                {t('securityAudit.suspicious.suspiciousUsers')}
              </Typography>
              {overview?.suspiciousUsers && overview.suspiciousUsers.length > 0 ? (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('securityAudit.table.user')}</TableCell>
                        <TableCell align="right">
                          {t('securityAudit.suspicious.events')}
                        </TableCell>
                        <TableCell align="right">
                          {t('securityAudit.suspicious.riskScore')}
                        </TableCell>
                        <TableCell>{t('securityAudit.suspicious.lastActivity')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {overview.suspiciousUsers.map((user: SuspiciousUser) => (
                        <TableRow key={user.userId}>
                          <TableCell>{user.username}</TableCell>
                          <TableCell align="right">{user.suspiciousEventCount}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={user.riskScore.toFixed(1)}
                              color={
                                user.riskScore >= 80
                                  ? 'error'
                                  : user.riskScore >= 50
                                    ? 'warning'
                                    : 'default'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(user.lastSuspiciousActivity).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('securityAudit.suspicious.noSuspiciousUsers')}
                  </Typography>
                </Paper>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 4: Geographic Access */}
        <TabPanel value={activeTab} index={4}>
          <Typography variant="h6" gutterBottom>
            <PublicIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {t('securityAudit.geographic.title')}
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('securityAudit.geographic.country')}</TableCell>
                  <TableCell align="right">{t('securityAudit.geographic.accessCount')}</TableCell>
                  <TableCell align="right">
                    {t('securityAudit.geographic.failedLogins')}
                  </TableCell>
                  <TableCell align="right">
                    {t('securityAudit.geographic.suspiciousEvents')}
                  </TableCell>
                  <TableCell align="right">{t('securityAudit.geographic.uniqueUsers')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {geoMapData?.geographicAccessMap?.map((country: GeographicAccessEntry) => (
                  <TableRow key={country.countryCode}>
                    <TableCell>
                      <Typography variant="body2">
                        {country.countryName || country.countryCode}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{country.accessCount.toLocaleString()}</TableCell>
                    <TableCell align="right">{country.failedLoginCount}</TableCell>
                    <TableCell align="right">
                      {country.suspiciousEventCount > 0 ? (
                        <Chip
                          label={country.suspiciousEventCount}
                          color="warning"
                          size="small"
                        />
                      ) : (
                        '0'
                      )}
                    </TableCell>
                    <TableCell align="right">{country.uniqueUsers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Card>
    </Container>
  );
};

export default SecurityAuditDashboardPage;
