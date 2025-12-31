import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client';
import { useAuthStore } from '@store/authStore';
import { toast } from 'react-hot-toast';
import {
  Add as AddIcon,
  Computer as ComputerIcon,
  PowerSettingsNew as PowerIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  GET_IOT_DEVICES,
  CREATE_IOT_DEVICE,
  UPDATE_IOT_DEVICE,
} from '@graphql/queries/edgeProvisioning';

interface IotDevice {
  id: string;
  tenantId: string;
  facilityId: string;
  deviceCode: string;
  deviceName: string;
  deviceType: string;
  workCenterId?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  connectionType?: string;
  connectionConfig?: any;
  isActive: boolean;
  lastHeartbeat?: string;
  createdAt: string;
  updatedAt?: string;
}

const DEVICE_TYPES = [
  'EDGE_COMPUTER',
  'SENSOR',
  'PRESS_COUNTER',
  'TEMPERATURE_MONITOR',
  'SCALE',
  'BARCODE_SCANNER',
  'CAMERA',
  'PLC',
  'OTHER',
];

const HARDWARE_PROFILES = [
  {
    name: 'Minimum',
    specs: 'Intel i3/i5, 8GB RAM, 256GB SSD',
    cost: '$600-$1000',
    description: 'Basic data capture & reporting',
  },
  {
    name: 'Recommended',
    specs: 'Intel i5/i7, 16GB RAM, 512GB SSD',
    cost: '$1500-$2000',
    description: 'Full features + local AI/ML',
  },
  {
    name: 'Enterprise',
    specs: 'Intel i7/i9, 32GB RAM, 1TB SSD',
    cost: '$2500-$3000',
    description: 'High-performance + advanced analytics',
  },
];

export const EdgeProvisioningPage = () => {
  const user = useAuthStore((state) => state.user);
  const tenantId = user?.tenantId || '';

  const [openProvisionDialog, setOpenProvisionDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('Recommended');
  const [formData, setFormData] = useState({
    deviceCode: '',
    deviceName: '',
    deviceType: 'EDGE_COMPUTER',
    facilityId: '',
    manufacturer: 'Dell',
    model: '',
    serialNumber: '',
  });

  // GraphQL queries and mutations
  const { data, loading, error, refetch } = useQuery(GET_IOT_DEVICES, {
    variables: { tenantId, isActive: true },
    skip: !tenantId,
    pollInterval: 30000, // Poll every 30 seconds for status updates
  });

  const [createDevice, { loading: creating }] = useMutation(CREATE_IOT_DEVICE, {
    onCompleted: () => {
      toast.success('Edge computer provisioned successfully!');
      setOpenProvisionDialog(false);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to provision device: ${err.message}`);
    },
  });

  const [updateDevice] = useMutation(UPDATE_IOT_DEVICE, {
    onCompleted: () => {
      toast.success('Device updated successfully!');
      refetch();
    },
    onError: (err) => {
      toast.error(`Failed to update device: ${err.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      deviceCode: '',
      deviceName: '',
      deviceType: 'EDGE_COMPUTER',
      facilityId: '',
      manufacturer: 'Dell',
      model: '',
      serialNumber: '',
    });
    setSelectedProfile('Recommended');
  };

  const handleProvisionDevice = async () => {
    if (!formData.deviceCode || !formData.deviceName) {
      toast.error('Please fill in all required fields');
      return;
    }

    await createDevice({
      variables: {
        tenantId,
        facilityId: formData.facilityId || tenantId, // Use tenantId if no facility specified
        deviceCode: formData.deviceCode,
        deviceName: formData.deviceName,
        deviceType: formData.deviceType,
      },
    });
  };

  const handleToggleDevice = async (device: IotDevice) => {
    await updateDevice({
      variables: {
        id: device.id,
        isActive: !device.isActive,
      },
    });
  };

  const getDeviceStatus = (device: IotDevice) => {
    if (!device.isActive) {
      return { label: 'Inactive', color: 'default', icon: <PowerIcon /> };
    }
    if (!device.lastHeartbeat) {
      return { label: 'Pending Setup', color: 'warning', icon: <WarningIcon /> };
    }

    const lastSeen = new Date(device.lastHeartbeat);
    const now = new Date();
    const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000 / 60;

    if (minutesSinceLastSeen < 2) {
      return { label: 'Online', color: 'success', icon: <CheckCircleIcon /> };
    } else if (minutesSinceLastSeen < 10) {
      return { label: 'Delayed', color: 'warning', icon: <WarningIcon /> };
    } else {
      return { label: 'Offline', color: 'error', icon: <ErrorIcon /> };
    }
  };

  const devices: IotDevice[] = data?.iotDevices || [];
  const edgeComputers = devices.filter((d) => d.deviceType === 'EDGE_COMPUTER');

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Edge Computer Provisioning
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Provision and manage edge computing infrastructure for facilities
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenProvisionDialog(true)}
          >
            Provision New Edge Computer
          </Button>
        </Box>
      </Box>

      {/* Hardware Profile Cards */}
      <Box mb={4}>
        <Typography variant="h5" gutterBottom>
          Hardware Profiles
        </Typography>
        <Grid container spacing={3}>
          {HARDWARE_PROFILES.map((profile) => (
            <Grid item xs={12} md={4} key={profile.name}>
              <Card
                sx={{
                  height: '100%',
                  border: selectedProfile === profile.name ? 2 : 0,
                  borderColor: 'primary.main',
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {profile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {profile.specs}
                  </Typography>
                  <Typography variant="h6" color="primary" gutterBottom>
                    {profile.cost}
                  </Typography>
                  <Typography variant="body2">{profile.description}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Provisioned Devices Table */}
      <Box>
        <Typography variant="h5" gutterBottom>
          Provisioned Edge Computers ({edgeComputers.length})
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">Failed to load devices: {error.message}</Alert>
        ) : edgeComputers.length === 0 ? (
          <Alert severity="info">
            No edge computers provisioned yet. Click "Provision New Edge Computer" to get
            started.
          </Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Device Code</TableCell>
                  <TableCell>Device Name</TableCell>
                  <TableCell>Manufacturer</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell>Serial Number</TableCell>
                  <TableCell>Last Heartbeat</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {edgeComputers.map((device) => {
                  const status = getDeviceStatus(device);
                  return (
                    <TableRow key={device.id}>
                      <TableCell>
                        <Chip
                          label={status.label}
                          color={status.color as any}
                          size="small"
                          icon={status.icon}
                        />
                      </TableCell>
                      <TableCell>{device.deviceCode}</TableCell>
                      <TableCell>{device.deviceName}</TableCell>
                      <TableCell>{device.manufacturer || 'N/A'}</TableCell>
                      <TableCell>{device.model || 'N/A'}</TableCell>
                      <TableCell>{device.serialNumber || 'N/A'}</TableCell>
                      <TableCell>
                        {device.lastHeartbeat
                          ? new Date(device.lastHeartbeat).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={device.isActive ? 'Deactivate' : 'Activate'}>
                          <IconButton
                            size="small"
                            color={device.isActive ? 'error' : 'success'}
                            onClick={() => handleToggleDevice(device)}
                          >
                            <PowerIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Configure">
                          <IconButton size="small" color="primary">
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Provision New Device Dialog */}
      <Dialog
        open={openProvisionDialog}
        onClose={() => setOpenProvisionDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <ComputerIcon />
            Provision New Edge Computer
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="info">
                  Edge computers enable offline data capture, real-time monitoring, and local
                  AI/ML processing at facility locations.
                </Alert>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Device Code"
                  value={formData.deviceCode}
                  onChange={(e) =>
                    setFormData({ ...formData, deviceCode: e.target.value })
                  }
                  placeholder="EDGE-FAC-001"
                  helperText="Unique identifier for this edge computer"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Device Name"
                  value={formData.deviceName}
                  onChange={(e) =>
                    setFormData({ ...formData, deviceName: e.target.value })
                  }
                  placeholder="Facility Production Floor Edge"
                  helperText="Descriptive name for this device"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Device Type</InputLabel>
                  <Select
                    value={formData.deviceType}
                    onChange={(e) =>
                      setFormData({ ...formData, deviceType: e.target.value })
                    }
                    label="Device Type"
                  >
                    {DEVICE_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type.replace(/_/g, ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Hardware Profile</InputLabel>
                  <Select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    label="Hardware Profile"
                  >
                    {HARDWARE_PROFILES.map((profile) => (
                      <MenuItem key={profile.name} value={profile.name}>
                        {profile.name} - {profile.cost}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) =>
                    setFormData({ ...formData, manufacturer: e.target.value })
                  }
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="OptiPlex 7090"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Serial Number"
                  value={formData.serialNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, serialNumber: e.target.value })
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Alert severity="success">
                  <Typography variant="body2" fontWeight="bold">
                    Estimated Delivery: 5-7 Business Days
                  </Typography>
                  <Typography variant="caption">
                    Your edge computer will be pre-configured with Docker, PostgreSQL, NATS,
                    and monitoring agents before shipment.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProvisionDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleProvisionDevice}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {creating ? 'Provisioning...' : 'Provision Device'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
