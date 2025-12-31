// REQ-DEVOPS-EDGE-MONITORING-1767150339448: Edge Computer Monitoring Dashboard
import { useState, useEffect } from 'react';
import { Container, Typography, Box, Button, Grid } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { SystemStatusCard } from '@components/monitoring/SystemStatusCard';
import { ErrorListCard } from '@components/monitoring/ErrorListCard';
import { ActiveFixesCard } from '@components/monitoring/ActiveFixesCard';
import { AgentActivityCard } from '@components/monitoring/AgentActivityCard';
import { EdgeDeviceMonitoringCard } from '@components/monitoring/EdgeDeviceMonitoringCard';

export const MonitoringDashboard = () => {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => setLastRefresh(new Date()), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            System Monitoring Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()} | Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Typography>
        </Box>
        <Box>
          <Button variant="outlined" onClick={() => setAutoRefresh(!autoRefresh)} sx={{ mr: 2 }}>
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={() => setLastRefresh(new Date())}>
            Refresh Now
          </Button>
        </Box>
      </Box>

      <Box mb={4}>
        <Typography variant="h5" gutterBottom>System Health</Typography>
        <SystemStatusCard lastRefresh={lastRefresh} />
      </Box>

      <Box mb={4}>
        <Typography variant="h5" gutterBottom>Edge Computer Fleet</Typography>
        <EdgeDeviceMonitoringCard lastRefresh={lastRefresh} />
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6}>
          <Typography variant="h5" gutterBottom>Current Errors</Typography>
          <ErrorListCard lastRefresh={lastRefresh} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="h5" gutterBottom>Active Fixes</Typography>
          <ActiveFixesCard lastRefresh={lastRefresh} />
        </Grid>
      </Grid>

      <Box>
        <Typography variant="h5" gutterBottom>Agent Activity</Typography>
        <AgentActivityCard lastRefresh={lastRefresh} />
      </Box>
    </Container>
  );
};
