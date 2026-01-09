import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import {
  Server,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Power,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  HardDrive,
  Cpu,
  Eye,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import {
  GET_IOT_DEVICES,
  GET_IOT_DEVICE_STATS,
  GET_EQUIPMENT_EVENTS,
  GET_SENSOR_READINGS,
  CREATE_IOT_DEVICE,
  UPDATE_IOT_DEVICE,
  DELETE_IOT_DEVICE,
  REBOOT_IOT_DEVICE,
  SYNC_DEVICE_CONFIG,
  BULK_UPDATE_IOT_DEVICES,
  ACKNOWLEDGE_EQUIPMENT_EVENT,
} from '../graphql/queries/edgeProvisioning';

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
  firmwareVersion?: string;
  ipAddress?: string;
  macAddress?: string;
  connectionType?: string;
  connectionConfig?: any;
  hardwareProfile?: string;
  isActive: boolean;
  isOnline?: boolean;
  lastHeartbeat?: string;
  lastSyncTime?: string;
  healthStatus?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkLatency?: number;
  tags?: string[];
  metadata?: any;
  createdAt: string;
  updatedAt?: string;
  createdByUserId?: string;
  updatedByUserId?: string;
}

interface DeviceStats {
  totalDevices: number;
  activeDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  healthyDevices: number;
  warningDevices: number;
  criticalDevices: number;
  devicesByType: Array<{ deviceType: string; count: number }>;
  devicesByFacility: Array<{ facilityId: string; facilityName: string; count: number }>;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgDiskUsage: number;
  avgNetworkLatency: number;
}

interface EquipmentEvent {
  id: string;
  tenantId: string;
  workCenterId?: string;
  iotDeviceId?: string;
  eventTimestamp: string;
  eventType: string;
  eventCode: string;
  eventDescription: string;
  severity: string;
  productionRunId?: string;
  metadata?: any;
  acknowledged: boolean;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

interface SensorReading {
  id: string;
  tenantId: string;
  iotDeviceId: string;
  readingTimestamp: string;
  sensorType: string;
  readingValue: number;
  unitOfMeasure: string;
  productionRunId?: string;
  metadata?: any;
  createdAt: string;
}

const DEVICE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'EDGE_COMPUTER', label: 'Edge Computer' },
  { value: 'SENSOR', label: 'Sensor' },
  { value: 'PRESS_COUNTER', label: 'Press Counter' },
  { value: 'TEMPERATURE_MONITOR', label: 'Temperature Monitor' },
  { value: 'SCALE', label: 'Scale' },
  { value: 'BARCODE_SCANNER', label: 'Barcode Scanner' },
  { value: 'CAMERA', label: 'Camera' },
  { value: 'PLC', label: 'PLC' },
  { value: 'OTHER', label: 'Other' },
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

export const EdgeProvisioningPage: React.FC = () => {
  const { t } = useTranslation();
  useAppStore();
  const user = useAuthStore((state: { user: any }) => state.user);
  const tenantId = user?.tenantId || '';

  const [activeTab, setActiveTab] = useState<'devices' | 'events' | 'sensors'>('devices');
  const [showFilters, setShowFilters] = useState(false);
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('Recommended');

  const [filters, setFilters] = useState({
    deviceType: '',
    isActive: '',
    searchTerm: '',
    severity: '',
    acknowledged: '',
    sensorType: '',
  });

  const [formData, setFormData] = useState({
    deviceCode: '',
    deviceName: '',
    deviceType: 'EDGE_COMPUTER',
    facilityId: '',
    manufacturer: 'Dell',
    model: '',
    serialNumber: '',
  });

  // GraphQL Queries
  const {
    data: devicesData,
    loading: devicesLoading,
    refetch: refetchDevices,
  } = useQuery(GET_IOT_DEVICES, {
    variables: {
      tenantId,
      deviceType: filters.deviceType || undefined,
      isActive: filters.isActive === '' ? undefined : filters.isActive === 'true',
    },
    skip: !tenantId,
    pollInterval: 30000, // Poll every 30 seconds
  });

  const {
    data: eventsData,
    loading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery(GET_EQUIPMENT_EVENTS, {
    variables: {
      tenantId,
      severity: filters.severity || undefined,
      acknowledged: filters.acknowledged === '' ? undefined : filters.acknowledged === 'true',
      limit: 100,
      offset: 0,
    },
    skip: !tenantId || activeTab !== 'events',
  });

  const {
    data: sensorsData,
    loading: sensorsLoading,
    refetch: refetchSensors,
  } = useQuery(GET_SENSOR_READINGS, {
    variables: {
      tenantId,
      sensorType: filters.sensorType || undefined,
      limit: 100,
      offset: 0,
    },
    skip: !tenantId || activeTab !== 'sensors',
  });

  const {
    data: statsData,
    loading: statsLoading,
  } = useQuery(GET_IOT_DEVICE_STATS, {
    variables: { tenantId },
    skip: !tenantId,
    pollInterval: 60000, // Poll every minute for stats
  });

  // GraphQL Mutations
  const [createDevice, { loading: creating }] = useMutation(CREATE_IOT_DEVICE, {
    onCompleted: () => {
      toast.success('Edge computer provisioned successfully!');
      setShowProvisionDialog(false);
      resetForm();
      refetchDevices();
    },
    onError: (err) => {
      toast.error(`Failed to provision device: ${err.message}`);
    },
  });

  const [updateDevice] = useMutation(UPDATE_IOT_DEVICE, {
    onCompleted: () => {
      toast.success('Device updated successfully!');
      refetchDevices();
    },
    onError: (err) => {
      toast.error(`Failed to update device: ${err.message}`);
    },
  });

  // Future implementation: Device deletion functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_deleteDevice] = useMutation(DELETE_IOT_DEVICE, {
    onCompleted: () => {
      toast.success('Device deleted successfully!');
      refetchDevices();
    },
    onError: (err) => {
      toast.error(`Failed to delete device: ${err.message}`);
    },
  });

  // Future implementation: Device reboot functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_rebootDevice] = useMutation(REBOOT_IOT_DEVICE, {
    onCompleted: () => {
      toast.success('Device reboot initiated!');
      refetchDevices();
    },
    onError: (err) => {
      toast.error(`Failed to reboot device: ${err.message}`);
    },
  });

  // Future implementation: Device config sync functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_syncConfig] = useMutation(SYNC_DEVICE_CONFIG, {
    onCompleted: () => {
      toast.success('Configuration synced successfully!');
      refetchDevices();
    },
    onError: (err) => {
      toast.error(`Failed to sync configuration: ${err.message}`);
    },
  });

  // Future implementation: Bulk device update functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_bulkUpdate] = useMutation(BULK_UPDATE_IOT_DEVICES, {
    onCompleted: () => {
      toast.success('Bulk update completed!');
      refetchDevices();
    },
    onError: (err) => {
      toast.error(`Failed to bulk update: ${err.message}`);
    },
  });

  const [acknowledgeEvent] = useMutation(ACKNOWLEDGE_EQUIPMENT_EVENT, {
    onCompleted: () => {
      toast.success('Event acknowledged');
      refetchEvents();
    },
    onError: (err) => {
      toast.error(`Failed to acknowledge event: ${err.message}`);
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
        facilityId: formData.facilityId || tenantId,
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

  const handleAcknowledgeEvent = async (eventId: string) => {
    await acknowledgeEvent({
      variables: {
        id: eventId,
        acknowledgedByUserId: user?.id,
      },
    });
  };

  const getDeviceStatus = (device: IotDevice) => {
    if (!device.isActive) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-700', icon: <Power className="w-3 h-3" /> };
    }
    if (!device.lastHeartbeat) {
      return { label: 'Pending Setup', color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> };
    }

    const lastSeen = new Date(device.lastHeartbeat);
    const now = new Date();
    const minutesSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000 / 60;

    if (minutesSinceLastSeen < 2) {
      return { label: 'Online', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> };
    } else if (minutesSinceLastSeen < 10) {
      return { label: 'Delayed', color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> };
    } else {
      return { label: 'Offline', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> };
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config: { [key: string]: { color: string; icon: React.ReactNode } } = {
      INFO: { color: 'bg-blue-100 text-blue-700', icon: <Activity className="w-3 h-3" /> },
      WARNING: { color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> },
      ERROR: { color: 'bg-orange-100 text-orange-700', icon: <XCircle className="w-3 h-3" /> },
      CRITICAL: { color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
    };

    const cfg = config[severity] || { color: 'bg-gray-100 text-gray-700', icon: null };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        {cfg.icon}
        {severity}
      </span>
    );
  };

  const devices: IotDevice[] = devicesData?.iotDevices || [];
  const events: EquipmentEvent[] = eventsData?.equipmentEvents || [];
  const sensorReadings: SensorReading[] = sensorsData?.sensorReadings || [];

  const filteredDevices = devices.filter((device) => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      return (
        device.deviceCode.toLowerCase().includes(searchLower) ||
        device.deviceName.toLowerCase().includes(searchLower) ||
        device.manufacturer?.toLowerCase().includes(searchLower) ||
        device.model?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const edgeComputers = filteredDevices.filter((d) => d.deviceType === 'EDGE_COMPUTER');

  // Use API stats when available, fallback to local calculation
  const stats: DeviceStats | undefined = statsData?.iotDeviceStats;
  const onlineCount = stats?.onlineDevices ?? edgeComputers.filter((d) => d.isActive && d.lastHeartbeat).length;
  const pendingCount = edgeComputers.filter((d) => d.isActive && !d.lastHeartbeat).length;
  const inactiveCount = stats?.totalDevices ? (stats.totalDevices - stats.activeDevices) : edgeComputers.filter((d) => !d.isActive).length;
  // Future implementation: Health status monitoring dashboard
  // const healthyCount = stats?.healthyDevices ?? 0;
  // const criticalCount = stats?.criticalDevices ?? 0;

  // Device Table Columns
  const deviceColumns = [
    {
      header: 'Status',
      accessor: 'status',
      render: (_: any, device: IotDevice) => {
        const status = getDeviceStatus(device);
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
            {status.icon}
            {status.label}
          </span>
        );
      },
    },
    { header: 'Device Code', accessor: 'deviceCode', className: 'font-medium' },
    { header: 'Device Name', accessor: 'deviceName' },
    {
      header: 'Type',
      accessor: 'deviceType',
      render: (value: string) => value.replace(/_/g, ' '),
    },
    { header: 'Manufacturer', accessor: 'manufacturer', render: (value: string) => value || 'N/A' },
    { header: 'Model', accessor: 'model', render: (value: string) => value || 'N/A' },
    { header: 'Serial Number', accessor: 'serialNumber', render: (value: string) => value || 'N/A' },
    {
      header: 'Last Heartbeat',
      accessor: 'lastHeartbeat',
      render: (value: string) => (value ? new Date(value).toLocaleString() : 'Never'),
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (_: string, device: IotDevice) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleToggleDevice(device)}
            className={`p-1 rounded hover:bg-gray-100 ${
              device.isActive ? 'text-red-600' : 'text-green-600'
            }`}
            title={device.isActive ? 'Deactivate' : 'Activate'}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-100 text-blue-600"
            title="Configure"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-100 text-gray-600"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // Events Table Columns
  const eventColumns = [
    {
      header: 'Severity',
      accessor: 'severity',
      render: (value: string) => getSeverityBadge(value),
    },
    {
      header: 'Event Time',
      accessor: 'eventTimestamp',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    { header: 'Event Type', accessor: 'eventType' },
    { header: 'Event Code', accessor: 'eventCode', className: 'font-mono text-sm' },
    { header: 'Description', accessor: 'eventDescription' },
    {
      header: 'Status',
      accessor: 'acknowledged',
      render: (value: boolean) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {value ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {value ? 'Acknowledged' : 'Pending'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (id: string, event: EquipmentEvent) =>
        !event.acknowledged ? (
          <button
            onClick={() => handleAcknowledgeEvent(id)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Acknowledge
          </button>
        ) : (
          <span className="text-sm text-gray-500">—</span>
        ),
    },
  ];

  // Sensor Readings Table Columns
  const sensorColumns = [
    {
      header: 'Timestamp',
      accessor: 'readingTimestamp',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    { header: 'Sensor Type', accessor: 'sensorType' },
    {
      header: 'Value',
      accessor: 'readingValue',
      render: (value: number, reading: SensorReading) => (
        <span className="font-mono">
          {value.toFixed(2)} {reading.unitOfMeasure}
        </span>
      ),
    },
    { header: 'Device ID', accessor: 'iotDeviceId', className: 'font-mono text-xs' },
  ];

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'DevOps', path: '/devops' },
          { label: 'Edge Provisioning', path: '/devops/edge-provisioning' },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-center mt-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-8 h-8" />
            {t('Edge Computer Provisioning')}
          </h1>
          <p className="text-gray-600 mt-1">
            Provision and manage edge computing infrastructure for facilities
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              refetchDevices();
              if (activeTab === 'events') refetchEvents();
              if (activeTab === 'sensors') refetchSensors();
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowProvisionDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Provision New Edge Computer
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">{edgeComputers.length}</p>
            </div>
            <HardDrive className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online</p>
              <p className="text-2xl font-bold text-green-600">{onlineCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Setup</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-gray-600">{inactiveCount}</p>
            </div>
            <XCircle className="w-8 h-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Hardware Profiles */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          Hardware Profiles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {HARDWARE_PROFILES.map((profile) => (
            <div
              key={profile.name}
              className={`bg-white p-4 rounded-lg shadow border-2 ${
                selectedProfile === profile.name ? 'border-blue-600' : 'border-gray-200'
              }`}
            >
              <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{profile.specs}</p>
              <p className="text-lg font-bold text-blue-600 mt-2">{profile.cost}</p>
              <p className="text-sm text-gray-700 mt-2">{profile.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Monitoring */}
      {stats && !statsLoading && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Performance Monitoring
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-gray-600">Avg CPU Usage</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                <div
                  className={`h-2.5 rounded-full ${
                    (stats.avgCpuUsage || 0) > 80 ? 'bg-red-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${stats.avgCpuUsage || 0}%` }}
                ></div>
              </div>
              <p className="text-lg font-bold text-gray-900">{(stats.avgCpuUsage || 0).toFixed(1)}%</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-green-600" />
                <p className="text-sm text-gray-600">Avg Memory Usage</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                <div
                  className={`h-2.5 rounded-full ${
                    (stats.avgMemoryUsage || 0) > 80 ? 'bg-red-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${stats.avgMemoryUsage || 0}%` }}
                ></div>
              </div>
              <p className="text-lg font-bold text-gray-900">{(stats.avgMemoryUsage || 0).toFixed(1)}%</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-5 h-5 text-purple-600" />
                <p className="text-sm text-gray-600">Avg Disk Usage</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                <div
                  className={`h-2.5 rounded-full ${
                    (stats.avgDiskUsage || 0) > 80 ? 'bg-red-600' : 'bg-purple-600'
                  }`}
                  style={{ width: `${stats.avgDiskUsage || 0}%` }}
                ></div>
              </div>
              <p className="text-lg font-bold text-gray-900">{(stats.avgDiskUsage || 0).toFixed(1)}%</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-orange-600" />
                <p className="text-sm text-gray-600">Avg Network Latency</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{(stats.avgNetworkLatency || 0).toFixed(0)} ms</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.avgNetworkLatency < 50 ? 'Excellent' : stats.avgNetworkLatency < 100 ? 'Good' : 'Poor'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'devices'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Devices ({edgeComputers.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'events'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Equipment Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('sensors')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'sensors'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sensor Readings ({sensorReadings.length})
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {activeTab === 'devices' && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Type
                </label>
                <select
                  value={filters.deviceType}
                  onChange={(e) => setFilters({ ...filters, deviceType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {DEVICE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.isActive}
                  onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                    placeholder="Search by code, name, manufacturer, model..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'devices' && (
          <DataTable
            data={filteredDevices}
            columns={deviceColumns}
            loading={devicesLoading}
            emptyMessage="No edge devices found. Click 'Provision New Edge Computer' to get started."
          />
        )}

        {activeTab === 'events' && (
          <DataTable
            data={events}
            columns={eventColumns}
            loading={eventsLoading}
            emptyMessage="No equipment events recorded."
          />
        )}

        {activeTab === 'sensors' && (
          <DataTable
            data={sensorReadings}
            columns={sensorColumns}
            loading={sensorsLoading}
            emptyMessage="No sensor readings available."
          />
        )}
      </div>

      {/* Provision Dialog */}
      {showProvisionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Server className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Provision New Edge Computer</h2>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Edge computers enable offline data capture, real-time monitoring, and local AI/ML
                  processing at facility locations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.deviceCode}
                    onChange={(e) => setFormData({ ...formData, deviceCode: e.target.value })}
                    placeholder="EDGE-FAC-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Unique identifier for this edge computer</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.deviceName}
                    onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                    placeholder="Facility Production Floor Edge"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Descriptive name for this device</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
                  <select
                    value={formData.deviceType}
                    onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {DEVICE_TYPES.filter((t) => t.value).map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hardware Profile
                  </label>
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {HARDWARE_PROFILES.map((profile) => (
                      <option key={profile.name} value={profile.name}>
                        {profile.name} - {profile.cost}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="OptiPlex 7090"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facility ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.facilityId}
                    onChange={(e) => setFormData({ ...formData, facilityId: e.target.value })}
                    placeholder="Leave blank to use tenant default"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                <p className="text-sm font-semibold text-green-800">
                  Estimated Delivery: 5-7 Business Days
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Your edge computer will be pre-configured with Docker, PostgreSQL, NATS, and
                  monitoring agents before shipment.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowProvisionDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProvisionDevice}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Provision Device
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
