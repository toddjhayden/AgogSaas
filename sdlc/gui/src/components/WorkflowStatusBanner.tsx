/**
 * Workflow Status Banner
 * Shows when workflow is in a non-normal pattern (e.g., focused on blocker-chain, weekend push)
 * Provides controls to view details, change focus, or return to normal
 */

import { useState, useEffect, useCallback } from 'react';
import { Zap, X, RefreshCw, Clock, Target, AlertTriangle } from 'lucide-react';
import { getWorkflowStatus, clearWorkflowFocus, type WorkflowDirective } from '@/api/sdlc-client';

interface WorkflowStatusBannerProps {
  onOpenChat?: () => void;
}

export function WorkflowStatusBanner({ onOpenChat }: WorkflowStatusBannerProps) {
  const [directive, setDirective] = useState<WorkflowDirective | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await getWorkflowStatus();
      if (response.success && response.data) {
        setDirective(response.data.hasActiveDirective ? response.data.directive || null : null);
        setError(null);
      } else {
        setError(response.error || 'Failed to fetch workflow status');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleClearFocus = async () => {
    setClearing(true);
    try {
      const response = await clearWorkflowFocus('User cleared focus from banner');
      if (response.success) {
        setDirective(null);
      } else {
        setError(response.error || 'Failed to clear focus');
      }
    } catch {
      setError('Network error');
    } finally {
      setClearing(false);
    }
  };

  // Don't show if loading, error, or no active directive
  if (loading || error || !directive) {
    return null;
  }

  const getDirectiveIcon = () => {
    switch (directive.targetType) {
      case 'blocker_chain':
        return <Target className="w-5 h-5" />;
      case 'customer':
        return <AlertTriangle className="w-5 h-5" />;
      case 'filter':
        return <Clock className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getProgressText = () => {
    if (directive.totalItems > 0) {
      const pct = Math.round((directive.completedItems / directive.totalItems) * 100);
      return `${directive.completedItems}/${directive.totalItems} (${pct}%)`;
    }
    return null;
  };

  const getTimeRemaining = () => {
    if (!directive.expiresAt) return null;
    const expires = new Date(directive.expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const progress = getProgressText();
  const timeRemaining = getTimeRemaining();

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 shadow-md">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Icon and Status */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 p-1.5 bg-white/20 rounded-lg">
            {getDirectiveIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm uppercase tracking-wide">
                FOCUSED
              </span>
              <span className="text-white/90 text-sm truncate">
                {directive.displayName}
              </span>
            </div>
            {(progress || timeRemaining || directive.reason) && (
              <div className="flex items-center gap-3 text-xs text-white/80 mt-0.5">
                {progress && (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {progress}
                  </span>
                )}
                {timeRemaining && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeRemaining}
                  </span>
                )}
                {directive.reason && !progress && !timeRemaining && (
                  <span className="truncate">{directive.reason}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Change Focus
            </button>
          )}
          <button
            onClick={handleClearFocus}
            disabled={clearing}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            title="Return to normal workflow"
          >
            {clearing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkflowStatusBanner;
