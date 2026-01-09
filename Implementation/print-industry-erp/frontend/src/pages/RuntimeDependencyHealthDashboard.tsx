/**
 * Runtime Dependency Health Dashboard
 * REQ: REQ-AUDIT-1767982074
 * Author: Jen (Frontend Developer)
 * Date: 2026-01-09
 *
 * Dashboard for monitoring runtime dependency health
 * Displays health status of critical dependencies (Database, Redis, File System, etc.)
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { DependencyStatusCard } from '@components/monitoring/DependencyStatusCard';
import { GET_RUNTIME_DEPENDENCY_HEALTH } from '@graphql/queries/runtimeDependencyHealth';

interface DependencyHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
  critical: boolean;
  details?: Record<string, unknown>;
}

interface RuntimeHealthReport {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'critical';
  healthyCount: number;
  unhealthyCount: number;
  criticalFailures: number;
  exitRequired: boolean;
  dependencies: DependencyHealth[];
}

export const RuntimeDependencyHealthDashboard: React.FC = () => {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, loading, error, refetch } = useQuery<{
    runtimeDependencyHealth: RuntimeHealthReport;
  }>(GET_RUNTIME_DEPENDENCY_HEALTH, {
    pollInterval: autoRefresh ? 30000 : 0, // Auto-refresh every 30 seconds if enabled
  });

  useEffect(() => {
    if (data) {
      setLastRefresh(new Date());
    }
  }, [data]);

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon color="success" fontSize="large" />;
      case 'degraded':
        return <WarningIcon color="warning" fontSize="large" />;
      case 'critical':
        return <ErrorIcon color="error" fontSize="large" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'error';
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Failed to load runtime dependency health
          </Typography>
          <Typography variant="body2">{error.message}</Typography>
          <Button variant="outlined" onClick={handleRefresh} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Alert>
      </Container>
    );
  }

  const healthReport = data?.runtimeDependencyHealth;

  if (!healthReport) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="info">No health data available</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Runtime Dependency Health Monitor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()} | Auto-refresh:{' '}
            {autoRefresh ? 'ON (30s)' : 'OFF'}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="small"
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh Now
          </Button>
        </Box>
      </Box>

      {/* Overall Health Summary */}
      <Card
        sx={{
          mb: 4,
          border: 3,
          borderColor: `${getStatusColor(healthReport.status)}.main`,
        }}
      >
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            {getStatusIcon(healthReport.status)}
            <Typography variant="h5" component="h2">
              System Status: {healthReport.status.toUpperCase()}
            </Typography>
            <Chip
              label={healthReport.status.toUpperCase()}
              color={getStatusColor(healthReport.status)}
              size="medium"
            />
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Healthy Dependencies
                </Typography>
                <Typography variant="h4" color="success.main">
                  {healthReport.healthyCount}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Unhealthy Dependencies
                </Typography>
                <Typography variant="h4" color="error.main">
                  {healthReport.unhealthyCount}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Critical Failures
                </Typography>
                <Typography variant="h4" color="error.main">
                  {healthReport.criticalFailures}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Dependencies
                </Typography>
                <Typography variant="h4">
                  {healthReport.dependencies.length}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {healthReport.exitRequired && (
            <Alert severity="error" sx={{ mt: 3 }}>
              <Typography variant="body1" component="strong">
                🛑 CRITICAL: Application Startup Would Fail
              </Typography>
              <Typography variant="body2">
                One or more critical dependencies have failed. The application would exit
                immediately on startup with code 1. Resolve critical failures to enable startup.
              </Typography>
            </Alert>
          )}

          {healthReport.status === 'degraded' && !healthReport.exitRequired && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              <Typography variant="body1" component="strong">
                ⚠️ DEGRADED: Non-Critical Dependencies Unhealthy
              </Typography>
              <Typography variant="body2">
                Some non-critical dependencies are unhealthy. The system can continue operating,
                but functionality may be limited. Review and resolve issues when possible.
              </Typography>
            </Alert>
          )}

          {healthReport.status === 'healthy' && (
            <Alert severity="success" sx={{ mt: 3 }}>
              <Typography variant="body1" component="strong">
                ✅ ALL SYSTEMS OPERATIONAL
              </Typography>
              <Typography variant="body2">
                All critical runtime dependencies are healthy. The application is ready to accept traffic.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Individual Dependency Status */}
      <Typography variant="h5" component="h2" gutterBottom>
        Dependency Details
      </Typography>

      <Box>
        {healthReport.dependencies.map((dependency) => (
          <DependencyStatusCard key={dependency.name} dependency={dependency} />
        ))}
      </Box>

      {/* Info Footer */}
      <Box mt={4}>
        <Alert severity="info">
          <Typography variant="body2" component="strong" gutterBottom>
            ℹ️ About Runtime Dependency Health
          </Typography>
          <Typography variant="body2">
            This dashboard monitors the health of critical runtime dependencies that are validated
            at application startup. If any CRITICAL dependency fails, the application will exit
            with code 1 to prevent degraded startups. This ensures fail-fast behavior and makes
            troubleshooting easier.
          </Typography>
        </Alert>
      </Box>
    </Container>
  );
};
