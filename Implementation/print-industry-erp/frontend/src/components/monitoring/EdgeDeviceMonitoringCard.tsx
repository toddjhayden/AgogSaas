// REQ-DEVOPS-EDGE-MONITORING-1767150339448: Edge Computer Monitoring Dashboard
import { useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  LinearProgress,
  IconButton,
} from '@mui/material';
import { useQuery } from '@apollo/client';
import { useAuthStore } from '@store/authStore';
import {
  Computer as ComputerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { GET_IOT_DEVICES } from '@graphql/queries/edgeProvisioning';

interface EdgeDeviceMonitoringCardProps {
  lastRefresh?: Date;
}

interface IotDevice {
  id: string;
  tenantId: string;
  facilityId: string;
  deviceCode: string;
  deviceName: string;
  deviceType: string;
  manufacturer?: string;
  model?: string;
  isActive: boolean;
  lastHeartbeat?: string;
  createdAt: string;
}

interface DeviceStatus {
  status: 'ONLINE' | 'DELAYED' | 'OFFLINE' | 'PENDING_SETUP';
  color: 'success' | 'warning' | 'error' | 'default';
  icon: JSX.Element;
  minutesSinceHeartbeat?: number;
}

export const EdgeDeviceMonitoringCard = ({ lastRefresh }: EdgeDeviceMonitoringCardProps) => {
  const { user } = useAuthStore();
  const tenantId = user?.tenantId;

  const { data, loading, error, refetch } = useQuery(GET_IOT_DEVICES, {
    variables: {
      tenantId,
      deviceType: 'EDGE_COMPUTER',
    },
    skip: !tenantId,
    fetchPolicy: 'network-only',
    pollInterval: 30000, // 30-second polling
  });

  // Also refresh when lastRefresh prop changes (triggers refetch)
  useEffect(() => {
    if (lastRefresh) {
      refetch();
    }
  }, [lastRefresh, refetch]);

  const getDeviceStatus = (device: IotDevice): DeviceStatus => {
    if (!device.isActive) {
      return {
        status: 'OFFLINE',
        color: 'default',
        icon: <ErrorIcon fontSize="small" />,
      };
    }

    if (!device.lastHeartbeat) {
      return {
        status: 'PENDING_SETUP',
        color: 'default',
        icon: <PendingIcon fontSize="small" />,
      };
    }

    const lastHeartbeatTime = new Date(device.lastHeartbeat).getTime();
    const now = Date.now();
    const minutesSinceHeartbeat = Math.floor((now - lastHeartbeatTime) / 60000);

    if (minutesSinceHeartbeat < 2) {
      return {
        status: 'ONLINE',
        color: 'success',
        icon: <CheckCircleIcon fontSize="small" />,
        minutesSinceHeartbeat,
      };
    } else if (minutesSinceHeartbeat < 10) {
      return {
        status: 'DELAYED',
        color: 'warning',
        icon: <WarningIcon fontSize="small" />,
        minutesSinceHeartbeat,
      };
    } else {
      return {
        status: 'OFFLINE',
        color: 'error',
        icon: <ErrorIcon fontSize="small" />,
        minutesSinceHeartbeat,
      };
    }
  };

  const formatLastSeen = (device: IotDevice): string => {
    if (!device.lastHeartbeat) {
      return 'Never';
    }
    const lastHeartbeatTime = new Date(device.lastHeartbeat);
    const now = new Date();
    const diffMs = now.getTime() - lastHeartbeatTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (!tenantId) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">Please log in to view edge device monitoring</Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography ml={2}>Loading edge devices...</Typography>
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
            Failed to load edge devices: {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const devices: IotDevice[] = data?.iotDevices || [];
  const edgeComputers = devices.filter((d) => d.deviceType === 'EDGE_COMPUTER');

  // Calculate statistics
  const totalDevices = edgeComputers.length;
  const onlineDevices = edgeComputers.filter((d) => getDeviceStatus(d).status === 'ONLINE').length;
  const delayedDevices = edgeComputers.filter((d) => getDeviceStatus(d).status === 'DELAYED').length;
  const offlineDevices = edgeComputers.filter((d) => getDeviceStatus(d).status === 'OFFLINE').length;
  const pendingDevices = edgeComputers.filter((d) => getDeviceStatus(d).status === 'PENDING_SETUP').length;

  const healthPercentage = totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <ComputerIcon color="primary" />
            <Typography variant="h6">Edge Computer Fleet Status</Typography>
          </Box>
          <Tooltip title="Refresh now">
            <IconButton size="small" onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Fleet Health Summary */}
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
              <Typography variant="h3">{totalDevices}</Typography>
              <Typography variant="body2">Total Devices</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.main', color: 'white' }}>
              <Typography variant="h3">{onlineDevices}</Typography>
              <Typography variant="body2">Online</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.main', color: 'white' }}>
              <Typography variant="h3">{delayedDevices}</Typography>
              <Typography variant="body2">Delayed</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.main', color: 'white' }}>
              <Typography variant="h3">{offlineDevices + pendingDevices}</Typography>
              <Typography variant="body2">Offline/Pending</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Fleet Health Bar */}
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" fontWeight="medium">
              Fleet Health
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {healthPercentage}% Online
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={healthPercentage}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: 'grey.300',
              '& .MuiLinearProgress-bar': {
                bgcolor:
                  healthPercentage >= 80
                    ? 'success.main'
                    : healthPercentage >= 50
                    ? 'warning.main'
                    : 'error.main',
              },
            }}
          />
        </Box>

        {/* Device List Table */}
        {totalDevices === 0 ? (
          <Alert severity="info">
            No edge computers provisioned yet. Visit the Edge Computer Provisioning page to add devices.
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Device Code</TableCell>
                  <TableCell>Device Name</TableCell>
                  <TableCell>Manufacturer</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Seen</TableCell>
                  <TableCell align="center">Health</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {edgeComputers.map((device) => {
                  const deviceStatus = getDeviceStatus(device);
                  return (
                    <TableRow
                      key={device.id}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        borderLeft: `4px solid`,
                        borderLeftColor:
                          deviceStatus.status === 'ONLINE'
                            ? 'success.main'
                            : deviceStatus.status === 'DELAYED'
                            ? 'warning.main'
                            : deviceStatus.status === 'OFFLINE'
                            ? 'error.main'
                            : 'grey.400',
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {device.deviceCode}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{device.deviceName}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {device.manufacturer || 'N/A'}
                          {device.model && ` ${device.model}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={deviceStatus.icon}
                          label={deviceStatus.status.replace('_', ' ')}
                          color={deviceStatus.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip
                          title={
                            device.lastHeartbeat
                              ? new Date(device.lastHeartbeat).toLocaleString()
                              : 'No heartbeat received'
                          }
                        >
                          <Typography variant="body2" color="text.secondary">
                            {formatLastSeen(device)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        {deviceStatus.status === 'ONLINE' ? (
                          <Tooltip title="Healthy - receiving heartbeats">
                            <SpeedIcon color="success" fontSize="small" />
                          </Tooltip>
                        ) : deviceStatus.status === 'DELAYED' ? (
                          <Tooltip title={`Delayed - ${deviceStatus.minutesSinceHeartbeat}m since last heartbeat`}>
                            <SpeedIcon color="warning" fontSize="small" />
                          </Tooltip>
                        ) : deviceStatus.status === 'OFFLINE' ? (
                          <Tooltip
                            title={
                              deviceStatus.minutesSinceHeartbeat
                                ? `Offline - ${deviceStatus.minutesSinceHeartbeat}m since last heartbeat`
                                : 'Offline - no heartbeat'
                            }
                          >
                            <SpeedIcon color="error" fontSize="small" />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Pending setup - awaiting first heartbeat">
                            <SpeedIcon color="disabled" fontSize="small" />
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Auto-refreshes every 30 seconds | Last update: {new Date().toLocaleTimeString()}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
