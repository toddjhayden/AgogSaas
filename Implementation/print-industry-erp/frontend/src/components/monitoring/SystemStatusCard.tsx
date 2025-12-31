import { useQuery } from '@apollo/client';
import {
  Card,
  CardContent,
  Typography,
  Alert,
  Grid,
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  LinearProgress,
  AlertTitle
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { GET_SYSTEM_HEALTH } from '@graphql/queries';
import { useEffect } from 'react';

interface SystemStatusCardProps {
  lastRefresh: Date;
}

interface ComponentHealth {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheck: string;
  responseTime?: number;
  error?: string;
  metadata?: any;
}

export const SystemStatusCard = ({ lastRefresh }: SystemStatusCardProps) => {
  const { data, loading, error, refetch } = useQuery(GET_SYSTEM_HEALTH, {
    pollInterval: 10000,
    fetchPolicy: 'network-only', // Always fetch fresh data
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

  const getHealthColor = (status: string): 'success' | 'error' | 'warning' | 'info' => {
    switch (status) {
      case 'OPERATIONAL': return 'success';
      case 'DOWN': return 'error';
      case 'DEGRADED':
      case 'UNKNOWN': return 'warning';
      default: return 'info';
    }
  };

  const getResponseTimeColor = (responseTime?: number): string => {
    if (!responseTime) return '#999';
    if (responseTime < 100) return '#4caf50'; // Green
    if (responseTime < 500) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getOverallMessage = (overall: string, components: ComponentHealth[]) => {
    const downComponents = components.filter(c => c.status === 'DOWN');
    const degradedComponents = components.filter(c => c.status === 'DEGRADED');

    if (overall === 'OPERATIONAL') {
      return 'All systems operational';
    } else if (overall === 'DEGRADED') {
      const degradedNames = degradedComponents.map(c => c.name).join(', ');
      return `Degraded services: ${degradedNames}`;
    } else if (overall === 'DOWN') {
      const downNames = downComponents.map(c => c.name).join(', ');
      return `Services down: ${downNames}`;
    }
    return 'System status unknown';
  };

  if (loading && !data) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <CircularProgress size={24} />
            <Typography>Loading system health...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            <AlertTitle>Failed to Load System Health</AlertTitle>
            {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { systemHealth } = data;
  const components: ComponentHealth[] = [
    systemHealth.backend,
    systemHealth.frontend,
    systemHealth.database,
    systemHealth.nats
  ];

  return (
    <Card>
      <CardContent>
        <Alert
          severity={getHealthColor(systemHealth.overall)}
          sx={{ mb: 3 }}
          icon={getHealthIcon(systemHealth.overall)}
        >
          <AlertTitle>System Health: {systemHealth.overall}</AlertTitle>
          <Typography variant="caption" display="block">
            {getOverallMessage(systemHealth.overall, components)}
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.8 }}>
            <AccessTimeIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
            Last updated: {formatTimestamp(systemHealth.timestamp)}
          </Typography>
        </Alert>

        <Grid container spacing={2}>
          {components.map((component: ComponentHealth) => (
            <Grid item xs={12} sm={6} md={3} key={component.name}>
              <Tooltip
                title={component.error || `Last check: ${formatTimestamp(component.lastCheck)}`}
                placement="top"
              >
                <Box
                  sx={{
                    p: 2,
                    border: 2,
                    borderColor: component.status === 'DOWN' ? 'error.main' :
                                 component.status === 'DEGRADED' ? 'warning.main' :
                                 component.status === 'OPERATIONAL' ? 'success.main' : 'grey.400',
                    borderRadius: 2,
                    textAlign: 'center',
                    backgroundColor: component.status === 'DOWN' ? 'error.light' :
                                    component.status === 'DEGRADED' ? 'warning.light' :
                                    'background.paper',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 2
                    }
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    sx={{
                      textTransform: 'capitalize',
                      fontWeight: 600,
                      mb: 1.5
                    }}
                  >
                    {component.name}
                  </Typography>

                  <Chip
                    icon={getHealthIcon(component.status)}
                    label={component.status}
                    color={getHealthColor(component.status)}
                    size="small"
                    sx={{ mb: 1.5, fontWeight: 500 }}
                  />

                  {component.responseTime !== null && component.responseTime !== undefined && (
                    <Box sx={{ mt: 1 }}>
                      <Typography
                        variant="caption"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                          color: getResponseTimeColor(component.responseTime),
                          fontWeight: 500
                        }}
                      >
                        <SpeedIcon sx={{ fontSize: 14, mr: 0.5 }} />
                        {component.responseTime}ms
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, (component.responseTime / 1000) * 100)}
                        sx={{
                          mt: 0.5,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getResponseTimeColor(component.responseTime)
                          }
                        }}
                      />
                    </Box>
                  )}

                  {component.error && (
                    <Alert severity="error" sx={{ mt: 1, textAlign: 'left' }}>
                      <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                        {component.error.length > 50
                          ? `${component.error.substring(0, 50)}...`
                          : component.error}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              </Tooltip>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};
