/**
 * API Health Banner
 * Shows a warning banner when the SDLC API is not reachable
 */

import { useEffect } from 'react';
import { AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import { useSDLCSettingsStore } from '../stores/useSDLCSettingsStore';
import { Link } from 'react-router-dom';

export function APIHealthBanner() {
  const { apiUrl, apiHealth, isCheckingHealth, checkApiHealth } = useSDLCSettingsStore();

  // Check health on mount and periodically
  useEffect(() => {
    checkApiHealth();

    // Recheck every 30 seconds if unhealthy
    const interval = setInterval(() => {
      if (!apiHealth.isHealthy) {
        checkApiHealth();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [checkApiHealth, apiHealth.isHealthy]);

  // Don't show if healthy
  if (apiHealth.isHealthy) {
    return null;
  }

  // Don't show if we haven't checked yet
  if (!apiHealth.lastCheck) {
    return null;
  }

  return (
    <div className="bg-red-600 text-white px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">
            SDLC API Unavailable
          </span>
          <span className="text-sm opacity-90">
            Cannot connect to <code className="bg-red-700 px-1.5 py-0.5 rounded text-xs">{apiUrl}</code>
          </span>
          {apiHealth.error && (
            <span className="text-xs opacity-75">
              ({apiHealth.error})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkApiHealth}
            disabled={isCheckingHealth}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-700 hover:bg-red-800 rounded transition-colors"
          >
            <RefreshCw size={12} className={isCheckingHealth ? 'animate-spin' : ''} />
            Retry
          </button>
          <Link
            to="/settings"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Settings size={12} />
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
