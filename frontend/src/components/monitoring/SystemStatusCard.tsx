import { useQuery } from '@apollo/client';
import { Card, CardContent, Typography, Alert, Grid, Box, Chip, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { GET_SYSTEM_HEALTH } from '@graphql/queries';
import { useEffect } from 'react';

interface SystemStatusCardProps {
  lastRefresh: Date;
}

export const SystemStatusCard = ({ lastRefresh }: SystemStatusCardProps) => {
  const { data, loading, error, refetch } = useQuery(GET_SYSTEM_HEALTH, {
    pollInterval: 10000,
  });

  useEffect(() => {
    refetch();
  }, [lastRefresh, refetch]);

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'OPERATIONAL': return <CheckCircleIcon />;
      case 'DOWN': return <ErrorIcon />;
      case 'DEGRADED':
      case 'UNKNOWN': return <WarningIcon />;
      default: return <WarningIcon />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'OPERATIONAL': return 'success';
      case 'DOWN': return 'error';
      case 'DEGRADED':
      case 'UNKNOWN': return 'warning';
      default: return 'default';
    }
  };

  if (loading) return <Card><CardContent><CircularProgress /></CardContent></Card>;
  if (error) return <Card><CardContent><Alert severity="error">Failed to load: {error.message}</Alert></CardContent></Card>;

  const { systemHealth } = data;
  const components = [systemHealth.backend, systemHealth.frontend, systemHealth.database, systemHealth.nats];

  return (
    <Card>
      <CardContent>
        <Alert severity={getHealthColor(systemHealth.overall) as any} sx={{ mb: 3 }}>
          <Typography variant="h6">System Health: {systemHealth.overall}</Typography>
          <Typography variant="caption">All systems operational</Typography>
        </Alert>

        <Grid container spacing={2}>
          {components.map((component: any) => (
            <Grid item xs={12} sm={6} md={3} key={component.name}>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, textAlign: 'center' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {component.name}
                </Typography>
                <Chip 
                  icon={getHealthIcon(component.status)} 
                  label={component.status} 
                  color={getHealthColor(component.status) as any} 
                  size="small" 
                  sx={{ mb: 1 }} 
                />
                {component.responseTime && (
                  <Typography variant="caption" display="block">{component.responseTime}ms</Typography>
                )}
                {component.error && (
                  <Typography variant="caption" display="block" color="error">{component.error}</Typography>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};
