import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import {
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Server,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  AlertOctagon,
  Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { DataTable } from '../components/common/DataTable';
import { KPICard } from '../components/common/KPICard';
import {
  GET_REPLICATION_STATUS,
  GET_REPLICATION_SUMMARY,
  GET_REPLICATION_ANOMALIES,
  GET_REPLICATION_STATUS_HISTORY,
  GET_REPLICATION_ALERTS,
  GET_FAILOVER_HISTORY,
  GET_BACKUP_VERIFICATION_HISTORY,
  GET_REPLICATION_HEALTH_DASHBOARD,
} from '../graphql/queries/replicationMonitoring';

// Type definitions
interface ReplicationSummary {
  configured: boolean;
  isPrimary: boolean;
  totalReplicas: number;
  activeReplicas: number;
  maxLagMb: number;
  maxLagSec: number;
  healthStatus: string;
}

interface ReplicaInfo {
  applicationName: string;
  clientAddr: string;
  state: string;
  syncState: string;
  replayLag: number;
  replayLagBytes: number;
  writeLag: number;
  flushLag: number;
  replayLagMs: number | null;
}

interface ReplicationSlot {
  slotName: string;
  slotType: string;
  active: boolean;
  walStatus: string;
  safeWalSize: number;
}

interface ReplicationAnomaly {
  severity: string;
  replicaName: string;
  lagMb: number;
  lagMs: number;
  issue: string;
}

interface ReplicationAlert {
  id: string;
  alertTimestamp: string;
  alertType: string;
  severity: string;
  message: string;
  status: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  nodeName: string | null;
  replicaName: string | null;
}

interface FailoverEvent {
  id: string;
  failoverTimestamp: string;
  failoverType: string;
  oldPrimaryHost: string;
  newPrimaryHost: string;
  failoverDurationSeconds: number | null;
  dataLossBytes: number | null;
  downtimeSeconds: number | null;
  status: string;
  reason: string | null;
  triggeredBy: string | null;
}

interface BackupVerification {
  id: string;
  verificationTimestamp: string;
  backupIdentifier: string;
  verificationStatus: string;
  verificationDurationSeconds: number | null;
  integrityCheckPassed: boolean | null;
  errorMessage: string | null;
}

interface ReplicationHealthDashboard {
  currentRole: string | null;
  currentHealth: string | null;
  currentLagBytes: number | null;
  criticalAlerts24h: number | null;
  warningAlerts24h: number | null;
  lastAlertTime: string | null;
  lastVerificationStatus: string | null;
  lastVerificationTime: string | null;
  hoursSinceLastVerification: number | null;
  failoversLast30Days: number | null;
  lastFailoverTime: string | null;
  snapshotTimestamp: string;
}

export const DatabaseReplicationMonitoringPage: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'alerts' | 'failover' | 'backups'>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedReplica, setExpandedReplica] = useState<string | null>(null);

  const [alertFilters, setAlertFilters] = useState({
    severity: '',
    status: '',
  });

  // Queries
  const {
    data: summaryData,
    loading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery(GET_REPLICATION_SUMMARY, {
    pollInterval: 30000, // 30 seconds
  });

  const {
    data: statusData,
    loading: statusLoading,
    refetch: refetchStatus,
  } = useQuery(GET_REPLICATION_STATUS, {
    pollInterval: 30000, // 30 seconds
    skip: activeTab !== 'overview',
  });

  const {
    data: anomaliesData,
  } = useQuery(GET_REPLICATION_ANOMALIES, {
    pollInterval: 60000, // 60 seconds
    skip: activeTab !== 'overview',
  });

  const {
    data: dashboardData,
    refetch: refetchDashboard,
  } = useQuery(GET_REPLICATION_HEALTH_DASHBOARD, {
    pollInterval: 30000, // 30 seconds
  });

  const {
    data: historyData,
    loading: historyLoading,
  } = useQuery(GET_REPLICATION_STATUS_HISTORY, {
    variables: {
      limit: 100,
      offset: 0,
    },
    skip: activeTab !== 'history',
    pollInterval: 60000, // 60 seconds
  });

  const {
    data: alertsData,
    loading: alertsLoading,
  } = useQuery(GET_REPLICATION_ALERTS, {
    variables: {
      limit: 50,
      offset: 0,
      severity: alertFilters.severity || undefined,
      status: alertFilters.status || undefined,
    },
    skip: activeTab !== 'alerts',
    pollInterval: 60000, // 60 seconds
  });

  const {
    data: failoverData,
    loading: failoverLoading,
  } = useQuery(GET_FAILOVER_HISTORY, {
    variables: {
      limit: 30,
      offset: 0,
    },
    skip: activeTab !== 'failover',
  });

  const {
    data: backupData,
    loading: backupLoading,
  } = useQuery(GET_BACKUP_VERIFICATION_HISTORY, {
    variables: {
      limit: 30,
      offset: 0,
    },
    skip: activeTab !== 'backups',
  });

  const handleRefreshAll = () => {
    refetchSummary();
    refetchDashboard();
    if (activeTab === 'overview') {
      refetchStatus();
    }
    toast.success('Dashboard refreshed');
  };

  const getHealthStatusBadge = (status: string) => {
    const config: { [key: string]: { color: string; icon: React.ReactNode } } = {
      HEALTHY: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      DEGRADED: { color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-3 h-3" /> },
      CRITICAL: { color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
      NOT_CONFIGURED: { color: 'bg-gray-100 text-gray-700', icon: <Info className="w-3 h-3" /> },
      UNKNOWN: { color: 'bg-gray-100 text-gray-700', icon: <AlertOctagon className="w-3 h-3" /> },
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
      CRITICAL: { color: 'bg-red-100 text-red-700' },
    };

    const cfg = config[severity] || { color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        {severity}
      </span>
    );
  };

  const getAlertStatusBadge = (status: string) => {
    const config: { [key: string]: { color: string } } = {
      OPEN: { color: 'bg-red-100 text-red-700' },
      ACKNOWLEDGED: { color: 'bg-yellow-100 text-yellow-700' },
      RESOLVED: { color: 'bg-green-100 text-green-700' },
      IGNORED: { color: 'bg-gray-100 text-gray-700' },
    };

    const cfg = config[status] || { color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        {status}
      </span>
    );
  };

  const getFailoverStatusBadge = (status: string) => {
    const config: { [key: string]: { color: string } } = {
      INITIATED: { color: 'bg-blue-100 text-blue-700' },
      IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-700' },
      COMPLETED: { color: 'bg-green-100 text-green-700' },
      FAILED: { color: 'bg-red-100 text-red-700' },
      ROLLED_BACK: { color: 'bg-orange-100 text-orange-700' },
    };

    const cfg = config[status] || { color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        {status}
      </span>
    );
  };

  const getVerificationStatusBadge = (status: string) => {
    const config: { [key: string]: { color: string } } = {
      SUCCESS: { color: 'bg-green-100 text-green-700' },
      FAILED: { color: 'bg-red-100 text-red-700' },
      PARTIAL: { color: 'bg-yellow-100 text-yellow-700' },
      SKIPPED: { color: 'bg-gray-100 text-gray-700' },
    };

    const cfg = config[status] || { color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        {status}
      </span>
    );
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined) return 'N/A';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const summary: ReplicationSummary | undefined = summaryData?.replicationSummary;
  const status = statusData?.replicationStatus;
  const replicas: ReplicaInfo[] = status?.replicas || [];
  const slots: ReplicationSlot[] = status?.replicationSlots || [];
  const anomalies: ReplicationAnomaly[] = anomaliesData?.replicationAnomalies || [];
  const dashboard: ReplicationHealthDashboard | undefined = dashboardData?.replicationHealthDashboard;
  const alerts: ReplicationAlert[] = alertsData?.replicationAlerts?.nodes || [];
  const failoverEvents: FailoverEvent[] = failoverData?.failoverHistory?.nodes || [];
  const backupVerifications: BackupVerification[] = backupData?.backupVerificationHistory?.nodes || [];

  // Replica columns
  const replicaColumns = [
    {
      header: 'Replica Name',
      accessor: 'applicationName',
      className: 'font-medium',
    },
    {
      header: 'IP Address',
      accessor: 'clientAddr',
    },
    {
      header: 'State',
      accessor: 'state',
      render: (value: string) => (
        <span className={`text-sm ${value === 'streaming' ? 'text-green-600' : 'text-yellow-600'}`}>
          {value}
        </span>
      ),
    },
    {
      header: 'Sync Mode',
      accessor: 'syncState',
      render: (value: string) => (
        <span className={`text-sm ${value === 'sync' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
          {value}
        </span>
      ),
    },
    {
      header: 'Lag (MB)',
      accessor: 'replayLag',
      render: (value: number) => {
        const color = value > 100 ? 'text-red-600' : value > 10 ? 'text-yellow-600' : 'text-green-600';
        return <span className={`text-sm font-medium ${color}`}>{value.toFixed(2)}</span>;
      },
    },
    {
      header: 'Lag (ms)',
      accessor: 'replayLagMs',
      render: (value: number | null) => {
        if (value === null) return <span className="text-sm text-gray-400">N/A</span>;
        const color = value > 10000 ? 'text-red-600' : value > 5000 ? 'text-yellow-600' : 'text-green-600';
        return <span className={`text-sm ${color}`}>{value.toFixed(0)}</span>;
      },
    },
    {
      header: 'Actions',
      accessor: 'applicationName',
      render: (name: string) => (
        <button
          onClick={() => setExpandedReplica(expandedReplica === name ? null : name)}
          className="p-1 rounded hover:bg-gray-100 text-gray-600"
          title="View Details"
        >
          {expandedReplica === name ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
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
      header: 'Timestamp',
      accessor: 'alertTimestamp',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      header: 'Alert Type',
      accessor: 'alertType',
    },
    {
      header: 'Message',
      accessor: 'message',
      className: 'max-w-md truncate',
    },
    {
      header: 'Replica',
      accessor: 'replicaName',
      render: (value: string | null) => value || 'N/A',
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (value: string) => getAlertStatusBadge(value),
    },
  ];

  // Failover columns
  const failoverColumns = [
    {
      header: 'Timestamp',
      accessor: 'failoverTimestamp',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      header: 'Type',
      accessor: 'failoverType',
    },
    {
      header: 'From',
      accessor: 'oldPrimaryHost',
    },
    {
      header: 'To',
      accessor: 'newPrimaryHost',
    },
    {
      header: 'Duration',
      accessor: 'failoverDurationSeconds',
      render: (value: number | null) => formatDuration(value),
    },
    {
      header: 'Data Loss',
      accessor: 'dataLossBytes',
      render: (value: number | null) => formatBytes(value),
    },
    {
      header: 'Downtime',
      accessor: 'downtimeSeconds',
      render: (value: number | null) => formatDuration(value),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (value: string) => getFailoverStatusBadge(value),
    },
  ];

  // Backup columns
  const backupColumns = [
    {
      header: 'Verification Time',
      accessor: 'verificationTimestamp',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      header: 'Backup ID',
      accessor: 'backupIdentifier',
      className: 'font-mono text-sm',
    },
    {
      header: 'Status',
      accessor: 'verificationStatus',
      render: (value: string) => getVerificationStatusBadge(value),
    },
    {
      header: 'Duration',
      accessor: 'verificationDurationSeconds',
      render: (value: number | null) => formatDuration(value),
    },
    {
      header: 'Integrity',
      accessor: 'integrityCheckPassed',
      render: (value: boolean | null) => {
        if (value === null) return <span className="text-sm text-gray-400">N/A</span>;
        return value ? (
          <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600" />
        );
      },
    },
  ];

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Database', path: '/database' },
          { label: 'Replication Monitoring', path: '/database/replication' },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-center mt-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-8 h-8" />
            {t('Database Replication Monitoring')}
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time monitoring of PostgreSQL replication health and high availability
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh All
        </button>
      </div>

      {/* Health Summary KPIs */}
      {summary && !summaryLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Replication Status"
            value={summary.configured ? 'Configured' : 'Not Configured'}
            icon={summary.configured ? Shield : Info}
            trend={summary.configured ? 'up' : 'stable'}
          />
          <KPICard
            title="Node Role"
            value={summary.isPrimary ? 'Primary' : 'Standby'}
            icon={Server}
            trend="stable"
          />
          <KPICard
            title="Active Replicas"
            value={`${summary.activeReplicas} / ${summary.totalReplicas}`}
            icon={Activity}
            trend={summary.activeReplicas === summary.totalReplicas ? 'up' : 'down'}
          />
          <KPICard
            title="Health Status"
            value={summary.healthStatus}
            icon={
              summary.healthStatus === 'HEALTHY'
                ? CheckCircle
                : summary.healthStatus === 'DEGRADED'
                ? AlertTriangle
                : XCircle
            }
            trend={
              summary.healthStatus === 'HEALTHY' ? 'up' : summary.healthStatus === 'DEGRADED' ? 'stable' : 'down'
            }
          />
        </div>
      )}

      {/* Replication Metrics */}
      {summary && summary.configured && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600">Max Replication Lag (MB)</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.maxLagMb.toFixed(2)} MB</p>
            <div className="flex items-center gap-1 mt-2">
              {summary.maxLagMb > 10 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-red-600">Above threshold</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-600">Healthy</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600">Max Replication Lag (Seconds)</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.maxLagSec.toFixed(2)} sec</p>
            <div className="flex items-center gap-1 mt-2">
              {summary.maxLagSec > 5 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-red-600">Above threshold</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-600">Healthy</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-gray-600">Replication Health</p>
            </div>
            <div className="mt-2">{getHealthStatusBadge(summary.healthStatus)}</div>
            <p className="text-xs text-gray-500 mt-2">
              {summary.healthStatus === 'HEALTHY' && 'All replicas operating normally'}
              {summary.healthStatus === 'DEGRADED' && 'Elevated lag detected'}
              {summary.healthStatus === 'CRITICAL' && 'Immediate attention required'}
              {summary.healthStatus === 'NOT_CONFIGURED' && 'Replication not enabled'}
            </p>
          </div>
        </div>
      )}

      {/* Dashboard Alerts */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-gray-600">Critical Alerts (24h)</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{dashboard.criticalAlerts24h || 0}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-gray-600">Warning Alerts (24h)</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{dashboard.warningAlerts24h || 0}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600">Failovers (30d)</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{dashboard.failoversLast30Days || 0}</p>
          </div>
        </div>
      )}

      {/* Anomalies Alert */}
      {anomalies.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Replication Anomalies Detected</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {anomalies.map((anomaly, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{anomaly.replicaName}:</span> {anomaly.issue} (Lag:{' '}
                      {anomaly.lagMb.toFixed(2)} MB / {anomaly.lagMs.toFixed(0)} ms) - {anomaly.severity}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'history'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            History
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
          <button
            onClick={() => setActiveTab('failover')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'failover'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Failover History
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'backups'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Backup Verifications
          </button>
        </div>
      </div>

      {/* Filters */}
      {activeTab === 'alerts' && (
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={alertFilters.status}
                  onChange={(e) => setAlertFilters({ ...alertFilters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All</option>
                  <option value="OPEN">Open</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="IGNORED">Ignored</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'overview' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Active Replicas</h2>
            {replicas.length > 0 ? (
              <DataTable data={replicas} columns={replicaColumns} loading={statusLoading} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                {summary?.configured
                  ? 'No replicas connected. Check replication configuration.'
                  : 'Replication is not configured on this database. Update postgresql.conf to enable replication.'}
              </div>
            )}

            {slots.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-4">Replication Slots</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {slots.map((slot, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{slot.slotName}</span>
                        {slot.active ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">Inactive</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          Type: <span className="font-medium">{slot.slotType}</span>
                        </div>
                        <div>
                          WAL Status: <span className="font-medium">{slot.walStatus}</span>
                        </div>
                        <div>
                          Safe WAL: <span className="font-medium">{formatBytes(slot.safeWalSize)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <DataTable
            data={historyData?.replicationStatusHistory?.nodes || []}
            columns={[
              {
                header: 'Timestamp',
                accessor: 'snapshotTimestamp',
                render: (value: unknown) => new Date(value as string).toLocaleString(),
              },
              {
                header: 'Role',
                accessor: 'nodeRole',
              },
              {
                header: 'Health',
                accessor: 'healthStatus',
                render: (value: unknown) => getHealthStatusBadge(value as string),
              },
              {
                header: 'Lag (Bytes)',
                accessor: 'replicationLagBytes',
                render: (value: unknown) => formatBytes(value as number),
              },
              {
                header: 'Lag (Seconds)',
                accessor: 'replicationLagSeconds',
                render: (value: unknown) => {
                  const numValue = value as number | null;
                  return numValue !== null ? `${numValue.toFixed(2)}s` : 'N/A';
                },
              },
            ]}
            loading={historyLoading}
            emptyMessage="No historical data available."
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

        {activeTab === 'failover' && (
          <DataTable
            data={failoverEvents}
            columns={failoverColumns}
            loading={failoverLoading}
            emptyMessage="No failover events recorded."
          />
        )}

        {activeTab === 'backups' && (
          <DataTable
            data={backupVerifications}
            columns={backupColumns}
            loading={backupLoading}
            emptyMessage="No backup verifications found."
          />
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500 text-center">
        Auto-refreshes every 30 seconds | Last update: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};
