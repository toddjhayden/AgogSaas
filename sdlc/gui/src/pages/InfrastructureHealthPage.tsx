import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Server,
  Radio,
  Database,
  Cpu,
  RefreshCw,
  Terminal,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import * as api from '@/api/sdlc-client';
import type { InfrastructureComponent, ControlCommand } from '@/api/sdlc-client';

type ComponentAction = {
  action: string;
  label: string;
  icon: React.ElementType;
  description: string;
  params?: Record<string, unknown>;
};

const COMPONENT_ACTIONS: Record<string, ComponentAction[]> = {
  host_listener: [
    { action: 'status', label: 'Status', icon: Activity, description: 'Get current status' },
    { action: 'get_logs', label: 'View Logs', icon: Terminal, description: 'Get recent in-memory logs' },
    { action: 'tail_log_file', label: 'Tail Log File', icon: FileText, description: 'Get latest log file entries', params: { lines: 100 } },
    { action: 'get_log_files', label: 'List Log Files', icon: FileText, description: 'List all available log files' },
    { action: 'restart', label: 'Restart', icon: RefreshCw, description: 'Gracefully restart the listener' },
  ],
  orchestrator: [
    { action: 'status', label: 'Status', icon: Activity, description: 'Get current status' },
    { action: 'restart', label: 'Restart Container', icon: RefreshCw, description: 'Restart the Docker container' },
  ],
  nats: [
    { action: 'status', label: 'Status', icon: Activity, description: 'Get NATS server status' },
    { action: 'restart', label: 'Restart Container', icon: RefreshCw, description: 'Restart the NATS container' },
  ],
  ollama: [
    { action: 'status', label: 'Status', icon: Activity, description: 'Check Ollama availability' },
    { action: 'restart', label: 'Restart Container', icon: RefreshCw, description: 'Restart the Ollama container' },
  ],
  agent_db: [
    { action: 'status', label: 'Status', icon: Activity, description: 'Check database connection' },
  ],
};

const COMPONENT_ICONS: Record<string, React.ElementType> = {
  host_listener: Cpu,
  orchestrator: Server,
  nats: Radio,
  ollama: Activity,
  agent_db: Database,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  healthy: { bg: 'bg-green-100', text: 'text-green-700', icon: 'text-green-500' },
  degraded: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: 'text-yellow-500' },
  unavailable: { bg: 'bg-red-100', text: 'text-red-700', icon: 'text-red-500' },
  unknown: { bg: 'bg-slate-100', text: 'text-slate-600', icon: 'text-slate-400' },
};

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface LogViewerProps {
  logs: string[];
  maxHeight?: number;
}

function LogViewer({ logs, maxHeight = 400 }: LogViewerProps) {
  return (
    <div
      className="bg-slate-900 text-green-400 font-mono text-xs p-3 rounded-lg overflow-auto"
      style={{ maxHeight }}
    >
      {logs.length === 0 ? (
        <span className="text-slate-500">No logs available</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all hover:bg-slate-800 px-1">
            {line}
          </div>
        ))
      )}
    </div>
  );
}

interface CommandResultProps {
  command: ControlCommand | null;
  isLoading: boolean;
}

function CommandResult({ command, isLoading }: CommandResultProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-2">
        <Loader2 className="animate-spin" size={16} />
        <span>Executing command...</span>
      </div>
    );
  }

  if (!command) return null;

  const isSuccess = command.status === 'completed';
  const isFailed = command.status === 'failed';

  return (
    <div className={`mt-3 p-3 rounded-lg ${isSuccess ? 'bg-green-50' : isFailed ? 'bg-red-50' : 'bg-slate-50'}`}>
      <div className="flex items-center gap-2 mb-2">
        {isSuccess ? (
          <CheckCircle className="text-green-500" size={16} />
        ) : isFailed ? (
          <XCircle className="text-red-500" size={16} />
        ) : (
          <Loader2 className="animate-spin text-slate-400" size={16} />
        )}
        <span className={`font-medium ${isSuccess ? 'text-green-700' : isFailed ? 'text-red-700' : 'text-slate-600'}`}>
          {command.action} - {command.status}
        </span>
        <span className="text-xs text-slate-400 ml-auto">
          {formatTimeAgo(command.completed_at || command.created_at)}
        </span>
      </div>

      {command.error_message && (
        <div className="text-red-600 text-sm mb-2">{command.error_message}</div>
      )}

      {command.result && (
        <div className="text-xs">
          {/* Handle logs array specially */}
          {Array.isArray((command.result as any).logs) ? (
            <LogViewer logs={(command.result as any).logs} maxHeight={300} />
          ) : Array.isArray((command.result as any).files) ? (
            <div className="bg-slate-100 rounded p-2">
              <div className="font-medium mb-1">Log Files:</div>
              {((command.result as any).files as Array<{ name: string; size: number; modified: string }>).map((f) => (
                <div key={f.name} className="flex justify-between py-0.5">
                  <span className="font-mono">{f.name}</span>
                  <span className="text-slate-500">{(f.size / 1024).toFixed(1)}KB</span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="bg-slate-100 rounded p-2 overflow-auto max-h-64">
              {JSON.stringify(command.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

interface ComponentCardProps {
  component: InfrastructureComponent;
  onRefresh: () => void;
}

function ComponentCard({ component, onRefresh }: ComponentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [lastCommand, setLastCommand] = useState<ControlCommand | null>(null);

  const Icon = COMPONENT_ICONS[component.component] || Server;
  const statusStyle = STATUS_COLORS[component.status] || STATUS_COLORS.unknown;
  const actions = COMPONENT_ACTIONS[component.component] || [];

  const handleAction = async (action: ComponentAction) => {
    setIsActionLoading(true);
    setLastCommand(null);

    try {
      // Send the command
      const sendResult = await api.sendControlCommand(
        component.component,
        action.action,
        action.params
      );

      if (!sendResult.success || !sendResult.data) {
        setLastCommand({
          id: '',
          component: component.component,
          action: action.action,
          status: 'failed',
          error_message: sendResult.error || 'Failed to send command',
          created_at: new Date().toISOString(),
        });
        setIsActionLoading(false);
        return;
      }

      // Poll for result
      const result = await api.waitForControlCommand(sendResult.data.id);
      setLastCommand(result.data || null);

      // Refresh component status after action
      if (result.data?.status === 'completed') {
        setTimeout(onRefresh, 1000);
      }
    } catch (error) {
      setLastCommand({
        id: '',
        component: component.component,
        action: action.action,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        created_at: new Date().toISOString(),
      });
    }

    setIsActionLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusStyle.bg}`}>
              <Icon className={statusStyle.icon} size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {component.display_name || component.component}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                  {component.status}
                </span>
                {component.is_stale && (
                  <span className="flex items-center gap-1 text-amber-600 text-xs">
                    <AlertTriangle size={12} />
                    Stale
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <Clock size={12} />
                {formatTimeAgo(component.last_heartbeat)}
              </div>
            </div>
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-4">
          {/* Details */}
          {component.details && Object.keys(component.details).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-600 mb-2">Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {Object.entries(component.details)
                  .filter(([key]) => !['recentLogs'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="bg-slate-50 rounded px-2 py-1">
                      <span className="text-slate-500">{key}: </span>
                      <span className="font-medium">
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recent Logs from Heartbeat */}
          {(component.details as any)?.recentLogs?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-600 mb-2">Recent Logs (from heartbeat)</h4>
              <LogViewer logs={(component.details as any).recentLogs.slice(0, 20)} maxHeight={200} />
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2">Actions</h4>
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button
                    key={action.action}
                    onClick={() => handleAction(action)}
                    disabled={isActionLoading}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                      transition-colors
                      ${action.action === 'restart'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    title={action.description}
                  >
                    <action.icon size={14} />
                    {action.label}
                  </button>
                ))}
              </div>

              <CommandResult command={lastCommand} isLoading={isActionLoading} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InfrastructureHealthPage() {
  const [components, setComponents] = useState<InfrastructureComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = useCallback(async () => {
    try {
      const result = await api.getInfrastructureHealth();
      if (result.success && result.data) {
        setComponents(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch infrastructure health');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setIsLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchHealth();
  };

  // Count healthy vs unhealthy
  const healthyCount = components.filter((c) => c.status === 'healthy').length;
  const degradedCount = components.filter((c) => c.status === 'degraded').length;
  const unavailableCount = components.filter((c) => c.status === 'unavailable').length;
  const staleCount = components.filter((c) => c.is_stale).length;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Infrastructure Health</h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor and control agentic workflow components
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Updated {formatTimeAgo(lastRefresh.toISOString())}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <CheckCircle className="mx-auto text-green-600 mb-1" size={20} />
          <p className="text-2xl font-bold text-green-700">{healthyCount}</p>
          <p className="text-xs text-green-600">Healthy</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
          <AlertTriangle className="mx-auto text-yellow-600 mb-1" size={20} />
          <p className="text-2xl font-bold text-yellow-700">{degradedCount}</p>
          <p className="text-xs text-yellow-600">Degraded</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <XCircle className="mx-auto text-red-600 mb-1" size={20} />
          <p className="text-2xl font-bold text-red-700">{unavailableCount}</p>
          <p className="text-xs text-red-600">Unavailable</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <Clock className="mx-auto text-slate-600 mb-1" size={20} />
          <p className="text-2xl font-bold text-slate-700">{staleCount}</p>
          <p className="text-xs text-slate-600">Stale</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={20} />
            <span className="font-medium">Error loading infrastructure health</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Component Cards */}
      {isLoading && components.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : components.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-8 text-center">
          <Server className="mx-auto text-slate-400 mb-3" size={48} />
          <h3 className="text-lg font-medium text-slate-600">No Components Found</h3>
          <p className="text-slate-500 text-sm mt-1">
            Components will appear here once they start sending heartbeats.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {components.map((component) => (
            <ComponentCard
              key={component.component}
              component={component}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">About Infrastructure Control</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p>
            <strong>Heartbeats:</strong> Components publish health status every 60 seconds.
            Status becomes "stale" if no heartbeat received for 2+ minutes.
          </p>
          <p>
            <strong>Control Commands:</strong> Commands are queued in the SDLC database,
            picked up by the orchestrator, and forwarded via NATS to the target component.
          </p>
          <p>
            <strong>Logs:</strong> All logs are sanitized before being sent to SDLC
            (API keys, passwords, connection strings, and PII are redacted).
          </p>
        </div>
      </div>
    </div>
  );
}
