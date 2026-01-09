import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@apollo/client';
import {
  Server,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Bell,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  MapPin,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { KPICard } from '../components/common/KPICard';
import { useAuthStore } from '../store/authStore';
import {
  GET_EDGE_FLEET_HEALTH,
  GET_FACILITY_EDGE_STATUSES,
  GET_EDGE_ALERTS_DASHBOARD,
  ACKNOWLEDGE_EDGE_ALERT,
  RESOLVE_EDGE_ALERT,
  TRIGGER_FACILITY_HEALTH_CHECK,
  ESCALATE_FACILITY_ALERT,
} from '../graphql/queries/edgeMonitoring';

interface EdgeFleetHealth {
  totalFacilities: number;
  onlineCount: number;
  offlineCount: number;
  escalatedCount: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgDiskUsage: number;
  avgNetworkLatency: number;
  availabilityPercentage: number;
  activeCriticalAlerts: number;
  lastUpdated: string;
}

interface FacilityEdgeStatus {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  region: string;
  mode: string;
  edgeVpnHostname: string;
  online: boolean;
  offlineSince: string;
  lastSync: string;
  status: string;
  offlineMinutes: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  servicesStatus: any;
  escalated: boolean;
  escalationTier: number;
  edgeVersion: string;
  dockerVersion: string;
  postgresVersion: string;
  activeContactsCount: number;
  alerts24h: number;
  unresolvedCriticalAlerts: number;
  lastStatusUpdate: string;
}

interface EdgeAlert {
  id: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  region: string;
  alertType: string;
  severity: string;
  message: string;
  sentAt: string;
  acknowledged: boolean;
  acknowledgedAt: string;
  acknowledgedByUsername: string;
  resolved: boolean;
  resolvedAt: string;
  resolutionNotes: string;
  escalationTier: number;
  offlineDurationMinutes: number;
  minutesSinceAlert: number;
  channelsSent: any;
  deliveryStatus: any;
}

export const EdgeMonitoringDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state: { user: any }) => state.user);

  const [activeTab, setActiveTab] = useState<'facilities' | 'alerts'>('facilities');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedFacility, setExpandedFacility] = useState<string | null>(null);

  const [facilityFilters, setFacilityFilters] = useState({
    region: '',
    status: '',
    searchTerm: '',
  });

  const [alertFilters, setAlertFilters] = useState({
    severity: '',
    acknowledged: '',
    resolved: '',
  });

  // Queries
  const {
    data: fleetData,
    loading: fleetLoading,
    refetch: refetchFleet,
  } = useQuery(GET_EDGE_FLEET_HEALTH, {
    pollInterval: 30000, // 30 seconds
  });

  const {
    data: facilitiesData,
    loading: facilitiesLoading,
    refetch: refetchFacilities,
  } = useQuery(GET_FACILITY_EDGE_STATUSES, {
    variables: {
      region: facilityFilters.region || undefined,
      status: facilityFilters.status || undefined,
      limit: 100,
      offset: 0,
    },
    pollInterval: 30000, // 30 seconds
  });

  const {
    data: alertsData,
    loading: alertsLoading,
    refetch: refetchAlerts,
  } = useQuery(GET_EDGE_ALERTS_DASHBOARD, {
    variables: {
      severity: alertFilters.severity || undefined,
      acknowledged: alertFilters.acknowledged === '' ? undefined : alertFilters.acknowledged === 'true',
      resolved: alertFilters.resolved === '' ? undefined : alertFilters.resolved === 'true',
      limit: 100,
      offset: 0,
    },
    skip: activeTab !== 'alerts',
    pollInterval: 60000, // 60 seconds
  });

  // Mutations
  const [acknowledgeAlert] = useMutation(ACKNOWLEDGE_EDGE_ALERT, {
    onCompleted: () => {
      toast.success('Alert acknowledged');
      refetchAlerts();
    },
    onError: (err) => {
      toast.error(`Failed to acknowledge alert: ${err.message}`);
    },
  });

  const [resolveAlert] = useMutation(RESOLVE_EDGE_ALERT, {
    onCompleted: () => {
      toast.success('Alert resolved');
      refetchAlerts();
    },
    onError: (err) => {
      toast.error(`Failed to resolve alert: ${err.message}`);
    },
  });

  const [triggerHealthCheck] = useMutation(TRIGGER_FACILITY_HEALTH_CHECK, {
    onCompleted: () => {
      toast.success('Health check triggered');
      refetchFacilities();
      refetchFleet();
    },
    onError: (err) => {
      toast.error(`Failed to trigger health check: ${err.message}`);
    },
  });

  const [escalateAlert] = useMutation(ESCALATE_FACILITY_ALERT, {
    onCompleted: () => {
      toast.success('Alert escalated to next tier');
      refetchFacilities();
      refetchAlerts();
    },
    onError: (err) => {
      toast.error(`Failed to escalate alert: ${err.message}`);
    },
  });

  const handleRefreshAll = () => {
    refetchFleet();
    refetchFacilities();
    if (activeTab === 'alerts') {
      refetchAlerts();
    }
    toast.success('Dashboard refreshed');
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    await acknowledgeAlert({
      variables: {
        id: alertId,
        input: {
          acknowledgedByUserId: user?.id,
        },
      },
    });
  };

  const handleResolveAlert = async (alertId: string) => {
    const notes = prompt('Enter resolution notes:');
    if (!notes) return;

    await resolveAlert({
      variables: {
        id: alertId,
        input: {
          resolutionNotes: notes,
        },
      },
    });
  };

  const handleTriggerHealthCheck = async (facilityId: string) => {
    await triggerHealthCheck({
      variables: { facilityId },
    });
  };

  const handleEscalate = async (facilityId: string) => {
    if (!confirm('Are you sure you want to escalate this alert to the next tier?')) {
      return;
    }

    await escalateAlert({
      variables: { facilityId },
    });
  };

  const getStatusBadge = (status: string) => {
    const config: { [key: string]: { color: string; icon: React.ReactNode } } = {
      ONLINE: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      DELAYED: { color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> },
      OFFLINE: { color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
      OFFLINE_ESCALATED: { color: 'bg-red-100 text-red-900 border-2 border-red-700', icon: <Bell className="w-3 h-3" /> },
      PENDING_SETUP: { color: 'bg-gray-100 text-gray-700', icon: <Server className="w-3 h-3" /> },
    };

    const cfg = config[status] || { color: 'bg-gray-100 text-gray-700', icon: null };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        {cfg.icon}
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const config: { [key: string]: { color: string } } = {
      INFO: { color: 'bg-blue-100 text-blue-700' },
      WARNING: { color: 'bg-yellow-100 text-yellow-700' },
      ERROR: { color: 'bg-orange-100 text-orange-700' },
      CRITICAL: { color: 'bg-red-100 text-red-700' },
    };

    const cfg = config[severity] || { color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        {severity}
      </span>
    );
  };

  const getUsageBadge = (value: number | undefined | null, _type: 'cpu' | 'memory' | 'disk') => {
    if (value === undefined || value === null) {
      return <span className="text-sm text-gray-400">N/A</span>;
    }

    const color = value > 80 ? 'text-red-600' : value > 60 ? 'text-yellow-600' : 'text-green-600';

    return <span className={`text-sm font-medium ${color}`}>{value.toFixed(1)}%</span>;
  };

  const fleet: EdgeFleetHealth | undefined = fleetData?.edgeFleetHealth;
  const facilities: FacilityEdgeStatus[] = facilitiesData?.facilityEdgeStatuses || [];
  const alerts: EdgeAlert[] = alertsData?.edgeAlertsDashboard || [];

  const filteredFacilities = facilities.filter((facility) => {
    if (facilityFilters.searchTerm) {
      const searchLower = facilityFilters.searchTerm.toLowerCase();
      return (
        facility.facilityCode.toLowerCase().includes(searchLower) ||
        facility.facilityName.toLowerCase().includes(searchLower) ||
        facility.region?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Facility columns
  const facilityColumns = [
    {
      header: 'Status',
      accessor: 'status',
      render: (value: string) => getStatusBadge(value),
    },
    { header: 'Facility Code', accessor: 'facilityCode', className: 'font-medium' },
    { header: 'Facility Name', accessor: 'facilityName' },
    {
      header: 'Region',
      accessor: 'region',
      render: (value: string) => (
        <span className="inline-flex items-center gap-1">
          <MapPin className="w-3 h-3 text-gray-400" />
          {value || 'N/A'}
        </span>
      ),
    },
    {
      header: 'CPU',
      accessor: 'cpuUsage',
      render: (value: number) => getUsageBadge(value, 'cpu'),
    },
    {
      header: 'Memory',
      accessor: 'memoryUsage',
      render: (value: number) => getUsageBadge(value, 'memory'),
    },
    {
      header: 'Disk',
      accessor: 'diskUsage',
      render: (value: number) => getUsageBadge(value, 'disk'),
    },
    {
      header: 'Network',
      accessor: 'networkLatency',
      render: (value: number) => (
        <span className="text-sm text-gray-600">{value ? `${value}ms` : 'N/A'}</span>
      ),
    },
    {
      header: 'Alerts (24h)',
      accessor: 'alerts24h',
      render: (value: number) => (
        <span className={`text-sm font-medium ${value > 0 ? 'text-red-600' : 'text-gray-400'}`}>
          {value}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'facilityId',
      render: (_: string, facility: FacilityEdgeStatus) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleTriggerHealthCheck(facility.facilityId)}
            className="p-1 rounded hover:bg-gray-100 text-blue-600"
            title="Trigger Health Check"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {!facility.online && !facility.escalated && (
            <button
              onClick={() => handleEscalate(facility.facilityId)}
              className="p-1 rounded hover:bg-gray-100 text-red-600"
              title="Escalate Alert"
            >
              <Bell className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() =>
              setExpandedFacility(expandedFacility === facility.facilityId ? null : facility.facilityId)
            }
            className="p-1 rounded hover:bg-gray-100 text-gray-600"
            title="View Details"
          >
            {expandedFacility === facility.facilityId ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  // Alert columns
  const alertColumns = [
    {
      header: 'Severity',
      accessor: 'severity',
      render: (value: string) => getSeverityBadge(value),
    },
    {
      header: 'Time',
      accessor: 'sentAt',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    { header: 'Facility', accessor: 'facilityName' },
    { header: 'Alert Type', accessor: 'alertType' },
    { header: 'Message', accessor: 'message', className: 'max-w-md truncate' },
    {
      header: 'Age',
      accessor: 'minutesSinceAlert',
      render: (value: number) => {
        if (value < 60) return `${Math.floor(value)}m`;
        if (value < 1440) return `${Math.floor(value / 60)}h`;
        return `${Math.floor(value / 1440)}d`;
      },
    },
    {
      header: 'Status',
      accessor: 'resolved',
      render: (resolved: boolean, alert: EdgeAlert) => {
        if (resolved) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3" />
              Resolved
            </span>
          );
        }
        if (alert.acknowledged) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              <Activity className="w-3 h-3" />
              Acknowledged
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            Active
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessor: 'id',
      render: (id: string, alert: EdgeAlert) => (
        <div className="flex gap-2">
          {!alert.acknowledged && (
            <button
              onClick={() => handleAcknowledgeAlert(id)}
              className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Acknowledge
            </button>
          )}
          {alert.acknowledged && !alert.resolved && (
            <button
              onClick={() => handleResolveAlert(id)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Resolve
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'DevOps', path: '/devops' },
          { label: 'Edge Monitoring', path: '/devops/edge-monitoring' },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-center mt-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-8 h-8" />
            {t('Edge Computer Monitoring')}
          </h1>
          <p className="text-gray-600 mt-1">Real-time monitoring of edge infrastructure across all facilities</p>
        </div>
        <button
          onClick={handleRefreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh All
        </button>
      </div>

      {/* Fleet Health KPIs */}
      {fleet && !fleetLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KPICard
            title="Total Facilities"
            value={fleet.totalFacilities.toString()}
            icon={Server}
            trend="stable"
          />
          <KPICard
            title="Online"
            value={fleet.onlineCount.toString()}
            icon={CheckCircle}
            trend="up"
          />
          <KPICard
            title="Offline"
            value={fleet.offlineCount.toString()}
            icon={XCircle}
            trend={fleet.offlineCount > 0 ? 'down' : 'stable'}
          />
          <KPICard
            title="Escalated"
            value={fleet.escalatedCount.toString()}
            icon={Bell}
            trend={fleet.escalatedCount > 0 ? 'down' : 'up'}
          />
          <KPICard
            title="Critical Alerts"
            value={fleet.activeCriticalAlerts.toString()}
            icon={AlertTriangle}
            trend={fleet.activeCriticalAlerts > 0 ? 'down' : 'up'}
          />
        </div>
      )}

      {/* Performance Averages */}
      {fleet && fleet.avgCpuUsage !== null && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600">Avg CPU Usage</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fleet.avgCpuUsage.toFixed(1)}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full ${
                  fleet.avgCpuUsage > 80 ? 'bg-red-600' : 'bg-blue-600'
                }`}
                style={{ width: `${fleet.avgCpuUsage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600">Avg Memory Usage</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fleet.avgMemoryUsage.toFixed(1)}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full ${
                  fleet.avgMemoryUsage > 80 ? 'bg-red-600' : 'bg-green-600'
                }`}
                style={{ width: `${fleet.avgMemoryUsage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-gray-600">Avg Disk Usage</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fleet.avgDiskUsage.toFixed(1)}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full ${
                  fleet.avgDiskUsage > 80 ? 'bg-red-600' : 'bg-purple-600'
                }`}
                style={{ width: `${fleet.avgDiskUsage}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-5 h-5 text-orange-600" />
              <p className="text-sm text-gray-600">Avg Network Latency</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fleet.avgNetworkLatency.toFixed(0)} ms</p>
            <p className="text-xs text-gray-500 mt-1">
              {fleet.avgNetworkLatency < 50 ? 'Excellent' : fleet.avgNetworkLatency < 100 ? 'Good' : 'Poor'}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('facilities')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'facilities'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Facilities ({filteredFacilities.length})
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'alerts'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Alerts ({alerts.length})
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {activeTab === 'facilities' && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={facilityFilters.status}
                  onChange={(e) => setFacilityFilters({ ...facilityFilters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="OFFLINE_ESCALATED">Escalated</option>
                  <option value="PENDING_SETUP">Pending Setup</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={facilityFilters.region}
                  onChange={(e) => setFacilityFilters({ ...facilityFilters, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Regions</option>
                  <option value="US_EAST">US East</option>
                  <option value="US_WEST">US West</option>
                  <option value="EU_CENTRAL">EU Central</option>
                  <option value="APAC">APAC</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={facilityFilters.searchTerm}
                    onChange={(e) =>
                      setFacilityFilters({ ...facilityFilters, searchTerm: e.target.value })
                    }
                    placeholder="Search by code, name, or region..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={alertFilters.severity}
                onChange={(e) => setAlertFilters({ ...alertFilters, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All</option>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="ERROR">Error</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acknowledged</label>
              <select
                value={alertFilters.acknowledged}
                onChange={(e) => setAlertFilters({ ...alertFilters, acknowledged: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolved</label>
              <select
                value={alertFilters.resolved}
                onChange={(e) => setAlertFilters({ ...alertFilters, resolved: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'facilities' && (
          <DataTable
            data={filteredFacilities}
            columns={facilityColumns}
            loading={facilitiesLoading}
            emptyMessage="No edge facilities found."
          />
        )}

        {activeTab === 'alerts' && (
          <DataTable
            data={alerts}
            columns={alertColumns}
            loading={alertsLoading}
            emptyMessage="No alerts found."
          />
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500 text-center">
        Auto-refreshes every 30 seconds | Last update: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};
