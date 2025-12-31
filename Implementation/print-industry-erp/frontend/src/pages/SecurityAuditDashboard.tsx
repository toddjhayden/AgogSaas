/**
 * Security Audit Dashboard
 * REQ-DEVOPS-SECURITY-1767150339448
 *
 * Comprehensive security monitoring dashboard with:
 * - Real-time security overview and metrics
 * - Threat detection and incident tracking
 * - Security event log and analysis
 * - Compliance audit trail
 * - Geographic access visualization
 */

import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import {
  GET_SECURITY_OVERVIEW,
  GET_SECURITY_AUDIT_EVENTS,
  GET_SUSPICIOUS_IPS,
  GET_SECURITY_INCIDENTS,
  GET_THREAT_PATTERNS,
  GET_SECURITY_METRICS_TIME_SERIES,
  GET_GEOGRAPHIC_ACCESS_MAP,
} from '../graphql/queries/securityAudit';

interface SecurityOverviewData {
  securityOverview: {
    timeRange: string;
    securityScore: number;
    trend: string;
    totalEvents: number;
    criticalEvents: number;
    highRiskEvents: number;
    suspiciousEvents: number;
    blockedEvents: number;
    loginAttempts: number;
    failedLogins: number;
    successRate: number;
    bruteForceAttempts: number;
    permissionDenials: number;
    zoneAccessEvents: number;
    unauthorizedAccessAttempts: number;
    dataExports: number;
    dataModifications: number;
    configChanges: number;
    activeIncidents: number;
    openInvestigations: number;
    topThreats: Array<{
      patternName: string;
      severity: string;
      occurrences: number;
      lastOccurrence: string;
    }>;
    uniqueCountries: number;
    uniqueIPAddresses: number;
    topCountries: Array<{
      countryCode: string;
      countryName: string;
      accessCount: number;
      percentage: number;
    }>;
    activeUsers: number;
    suspiciousUsers: Array<{
      userId: string;
      username: string;
      suspiciousEventCount: number;
      riskScore: number;
      lastSuspiciousActivity: string;
      flaggedReasons: string[];
    }>;
    complianceScore: number;
    nonCompliantControls: number;
  };
}

const SecurityAuditDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState('LAST_24_HOURS');
  const [activeTab, setActiveTab] = useState(0);

  // Fetch security overview
  const { data, loading, error, refetch } = useQuery<SecurityOverviewData>(
    GET_SECURITY_OVERVIEW,
    {
      variables: { timeRange },
      pollInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Fetch suspicious IPs
  const { data: suspiciousIPsData } = useQuery(GET_SUSPICIOUS_IPS, {
    variables: { hours: 24, limit: 10 },
    pollInterval: 60000,
  });

  // Fetch active incidents
  const { data: incidentsData } = useQuery(GET_SECURITY_INCIDENTS, {
    variables: {
      status: ['OPEN', 'INVESTIGATING'],
      pagination: { first: 10 },
    },
    pollInterval: 60000,
  });

  // Fetch threat patterns
  const { data: threatPatternsData } = useQuery(GET_THREAT_PATTERNS, {
    variables: { enabled: true },
  });

  const overview = data?.securityOverview;

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'info';
    if (score >= 50) return 'warning';
    return 'error';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return <TrendingUpIcon color="success" />;
      case 'DEGRADING':
        return <TrendingDownIcon color="error" />;
      case 'CRITICAL':
        return <ErrorIcon color="error" />;
      default:
        return <RemoveIcon color="action" />;
    }
  };

  const getRiskColor = (level: string): 'error' | 'warning' | 'info' | 'default' => {
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

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {t('security.error.loadFailed')}: {error.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          <ShieldIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('security.title')}
        </Typography>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>{t('security.timeRange')}</InputLabel>
          <Select
            value={timeRange}
            label={t('security.timeRange')}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <MenuItem value="LAST_HOUR">{t('security.timeRange.lastHour')}</MenuItem>
            <MenuItem value="LAST_6_HOURS">{t('security.timeRange.last6Hours')}</MenuItem>
            <MenuItem value="LAST_24_HOURS">{t('security.timeRange.last24Hours')}</MenuItem>
            <MenuItem value="LAST_7_DAYS">{t('security.timeRange.last7Days')}</MenuItem>
            <MenuItem value="LAST_30_DAYS">{t('security.timeRange.last30Days')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Security Score Card */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('security.overview.securityScore')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h3" component="div">
                  {overview?.securityScore.toFixed(0)}
                </Typography>
                <Box sx={{ ml: 1 }}>{getTrendIcon(overview?.trend || 'STABLE')}</Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={overview?.securityScore || 0}
                color={getScoreColor(overview?.securityScore || 0) as any}
                sx={{ mb: 1 }}
              />
              <Chip
                label={overview?.trend}
                size="small"
                color={getScoreColor(overview?.securityScore || 0) as any}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('security.overview.criticalEvents')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ErrorIcon color="error" sx={{ mr: 1, fontSize: 40 }} />
                <Typography variant="h3" color="error">
                  {overview?.criticalEvents || 0}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {overview?.highRiskEvents || 0} {t('security.overview.highRisk')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('security.overview.suspiciousActivity')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon color="warning" sx={{ mr: 1, fontSize: 40 }} />
                <Typography variant="h3" color="warning.main">
                  {overview?.suspiciousEvents || 0}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {overview?.blockedEvents || 0} {t('security.overview.blocked')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('security.overview.activeIncidents')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SecurityIcon color="primary" sx={{ mr: 1, fontSize: 40 }} />
                <Typography variant="h3">
                  {overview?.activeIncidents || 0}
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {overview?.openInvestigations || 0} {t('security.overview.investigating')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Authentication Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('security.authentication.title')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('security.authentication.loginAttempts')}
                </Typography>
                <Typography variant="h5">{overview?.loginAttempts || 0}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('security.authentication.failedLogins')}
                </Typography>
                <Typography variant="h5" color="error">
                  {overview?.failedLogins || 0}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  {t('security.authentication.successRate')}
                </Typography>
                <Typography variant="h5" color="success.main">
                  {overview?.successRate?.toFixed(1) || 0}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('security.access.title')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('security.access.permissionDenials')}
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {overview?.permissionDenials || 0}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('security.access.zoneAccess')}
                </Typography>
                <Typography variant="h5">{overview?.zoneAccessEvents || 0}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  {t('security.access.unauthorized')}
                </Typography>
                <Typography variant="h5" color="error">
                  {overview?.unauthorizedAccessAttempts || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('security.data.title')}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('security.data.exports')}
                </Typography>
                <Typography variant="h5">{overview?.dataExports || 0}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('security.data.modifications')}
                </Typography>
                <Typography variant="h5">{overview?.dataModifications || 0}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  {t('security.data.configChanges')}
                </Typography>
                <Typography variant="h5">{overview?.configChanges || 0}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for detailed views */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={t('security.tabs.topThreats')} />
          <Tab label={t('security.tabs.suspiciousIPs')} />
          <Tab label={t('security.tabs.incidents')} />
          <Tab label={t('security.tabs.geographic')} />
        </Tabs>

        {/* Top Threats Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('security.threats.title')}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('security.threats.pattern')}</TableCell>
                    <TableCell>{t('security.threats.severity')}</TableCell>
                    <TableCell align="right">{t('security.threats.occurrences')}</TableCell>
                    <TableCell>{t('security.threats.lastOccurrence')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview?.topThreats?.map((threat, index) => (
                    <TableRow key={index}>
                      <TableCell>{threat.patternName}</TableCell>
                      <TableCell>
                        <Chip
                          label={threat.severity}
                          size="small"
                          color={getRiskColor(threat.severity)}
                        />
                      </TableCell>
                      <TableCell align="right">{threat.occurrences}</TableCell>
                      <TableCell>{formatTimestamp(threat.lastOccurrence)}</TableCell>
                    </TableRow>
                  ))}
                  {(!overview?.topThreats || overview.topThreats.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="textSecondary">
                          {t('security.threats.noThreats')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Suspicious IPs Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('security.suspiciousIPs.title')}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('security.suspiciousIPs.ipAddress')}</TableCell>
                    <TableCell align="right">{t('security.suspiciousIPs.eventCount')}</TableCell>
                    <TableCell align="right">{t('security.suspiciousIPs.failedLogins')}</TableCell>
                    <TableCell align="right">{t('security.suspiciousIPs.riskScore')}</TableCell>
                    <TableCell>{t('security.suspiciousIPs.countries')}</TableCell>
                    <TableCell>{t('security.suspiciousIPs.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {suspiciousIPsData?.suspiciousIPs?.map((ip: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {ip.ipAddress}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{ip.eventCount}</TableCell>
                      <TableCell align="right">
                        <Typography color="error">{ip.failedLoginCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography color={ip.riskScore > 50 ? 'error' : 'warning.main'}>
                          {ip.riskScore?.toFixed(0)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {ip.countries?.join(', ') || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {ip.blocked ? (
                          <Chip
                            label={t('security.suspiciousIPs.blocked')}
                            size="small"
                            color="error"
                            icon={<BlockIcon />}
                          />
                        ) : (
                          <Chip
                            label={t('security.suspiciousIPs.monitoring')}
                            size="small"
                            color="warning"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!suspiciousIPsData?.suspiciousIPs || suspiciousIPsData.suspiciousIPs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="textSecondary">
                          {t('security.suspiciousIPs.noSuspiciousIPs')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Incidents Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('security.incidents.title')}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('security.incidents.number')}</TableCell>
                    <TableCell>{t('security.incidents.title')}</TableCell>
                    <TableCell>{t('security.incidents.severity')}</TableCell>
                    <TableCell>{t('security.incidents.status')}</TableCell>
                    <TableCell>{t('security.incidents.detected')}</TableCell>
                    <TableCell>{t('security.incidents.assignedTo')}</TableCell>
                    <TableCell align="center">{t('security.incidents.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {incidentsData?.securityIncidents?.edges?.map((edge: any) => {
                    const incident = edge.node;
                    return (
                      <TableRow key={incident.id}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {incident.incidentNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>{incident.title}</TableCell>
                        <TableCell>
                          <Chip
                            label={incident.severity}
                            size="small"
                            color={getRiskColor(incident.severity)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={incident.status} size="small" />
                        </TableCell>
                        <TableCell>{formatTimestamp(incident.detectedAt)}</TableCell>
                        <TableCell>{incident.assignedTo?.username || 'Unassigned'}</TableCell>
                        <TableCell align="center">
                          <Tooltip title={t('security.incidents.view')}>
                            <IconButton size="small">
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!incidentsData?.securityIncidents?.edges || incidentsData.securityIncidents.edges.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Box sx={{ py: 3 }}>
                          <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                          <Typography color="textSecondary">
                            {t('security.incidents.noActiveIncidents')}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Geographic Access Tab */}
        {activeTab === 3 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('security.geographic.title')}
            </Typography>
            <Grid container spacing={2}>
              {overview?.topCountries?.map((country, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PublicIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">
                          {country.countryName || country.countryCode}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {t('security.geographic.accessCount')}: {country.accessCount}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={country.percentage}
                        sx={{ mt: 1 }}
                      />
                      <Typography variant="caption" color="textSecondary">
                        {country.percentage?.toFixed(1)}% {t('security.geographic.ofTotal')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {(!overview?.topCountries || overview.topCountries.length === 0) && (
                <Grid item xs={12}>
                  <Typography color="textSecondary" align="center">
                    {t('security.geographic.noData')}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Compliance Score */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('security.compliance.title')}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {t('security.compliance.score')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" sx={{ mr: 2 }}>
                  {overview?.complianceScore?.toFixed(0)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={overview?.complianceScore || 0}
                  sx={{ flexGrow: 1 }}
                  color={getScoreColor(overview?.complianceScore || 0) as any}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {t('security.compliance.nonCompliant')}
              </Typography>
              <Typography variant="h4" color={overview?.nonCompliantControls ? 'error' : 'success.main'}>
                {overview?.nonCompliantControls || 0}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SecurityAuditDashboard;
