import { useEffect, useState, useMemo } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle, ArrowRight, X,
  ThumbsUp, ThumbsDown, AlertCircle as AlertIcon, ChevronDown,
  ChevronUp, Target, Zap, Info
} from 'lucide-react';
import * as api from '@/api/sdlc-client';
import type { RequestItem, DeepestUnblockedRequest } from '@/api/sdlc-client';
import { useFilterStore } from '@/stores/useFilterStore';
import { FilterActiveBadge } from '@/components/GlobalFilterBar';

interface RequestWithBlockers extends RequestItem {
  blockedBy: string[];
  blocking: string[];
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  confirmVariant: 'success' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  showNotes?: boolean;
  notes?: string;
  onNotesChange?: (notes: string) => void;
}

function ConfirmDialog({
  isOpen, title, message, confirmLabel, confirmVariant, onConfirm, onCancel,
  isLoading, showNotes, notes, onNotesChange
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <div className="text-slate-600 mb-4">{message}</div>

        {showNotes && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange?.(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add any notes about this decision..."
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${
              confirmVariant === 'success'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading && <RefreshCw size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BlockerActionState {
  type: 'approve' | 'decline' | null;
  blockedReq: string;
  blockingReq: string;
  blockerTitle?: string;
  blockedTitle?: string;
  cascadeAffected: string[];
}

export default function BlockerGraphPage() {
  const [requests, setRequests] = useState<RequestWithBlockers[]>([]);
  const [deepestUnblocked, setDeepestUnblocked] = useState<DeepestUnblockedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [expandedPriority, setExpandedPriority] = useState<string | null>(null);
  const [actionState, setActionState] = useState<BlockerActionState>({
    type: null,
    blockedReq: '',
    blockingReq: '',
    cascadeAffected: [],
  });
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Global filters
  const {
    isEnabled: globalFiltersEnabled,
    type: globalType,
    priority: globalPriority,
    searchTerm: globalSearchTerm,
    focusedItem,
  } = useFilterStore();

  // Filter deepest unblocked based on global filters
  const filteredDeepestUnblocked = useMemo(() => {
    if (!globalFiltersEnabled) return deepestUnblocked;

    // If type is set to REC only, return empty (this page is for requests)
    if (globalType === 'REC') return [];

    let filtered = [...deepestUnblocked];

    // Priority filter
    if (globalPriority !== 'all') {
      filtered = filtered.filter((req) => req.priority.toLowerCase() === globalPriority);
    }

    // Search filter
    if (globalSearchTerm) {
      const term = globalSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.title.toLowerCase().includes(term) ||
          req.reqNumber.toLowerCase().includes(term)
      );
    }

    // Focus filter
    if (focusedItem) {
      filtered = filtered.filter((req) => req.reqNumber === focusedItem);
    }

    return filtered;
  }, [deepestUnblocked, globalFiltersEnabled, globalType, globalPriority, globalSearchTerm, focusedItem]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, deepestRes] = await Promise.all([
        api.getAllRequests(),
        api.getDeepestUnblocked(20),
      ]);

      if (requestsRes.success && requestsRes.data) {
        const allRequests = requestsRes.data.requests;
        const blockedRequests = allRequests.filter(r => r.isBlocked);
        const enriched: RequestWithBlockers[] = [];

        for (const req of blockedRequests) {
          const blockerInfo = await api.getBlockers(req.reqNumber);
          if (blockerInfo.success && blockerInfo.data) {
            enriched.push({
              ...req,
              blockedBy: blockerInfo.data.blockedBy || [],
              blocking: blockerInfo.data.blocking || [],
            });
          }
        }

        if (deepestRes.success && deepestRes.data) {
          for (const blocker of deepestRes.data.requests) {
            const existing = enriched.find(r => r.reqNumber === blocker.reqNumber);
            if (!existing) {
              const fullReq = allRequests.find(r => r.reqNumber === blocker.reqNumber);
              if (fullReq) {
                const blockerInfo = await api.getBlockers(blocker.reqNumber);
                enriched.push({
                  ...fullReq,
                  blockedBy: blockerInfo.data?.blockedBy || [],
                  blocking: blockerInfo.data?.blocking || [],
                });
              }
            }
          }
        }

        setRequests(enriched);
      }

      if (deepestRes.success && deepestRes.data) {
        setDeepestUnblocked(deepestRes.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch blocker data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate cascade affected items
  const getCascadeAffected = (blockingReq: string): string[] => {
    const affected: string[] = [];
    const blocker = requests.find(r => r.reqNumber === blockingReq);
    if (blocker) {
      blocker.blocking.forEach(blockedReq => {
        const blocked = requests.find(r => r.reqNumber === blockedReq);
        if (blocked && blocked.blockedBy.length === 1) {
          // This will become unblocked if we remove this blocker
          affected.push(blockedReq);
          // Recursively check what this will unblock
          const furtherAffected = getCascadeAffected(blockedReq);
          affected.push(...furtherAffected);
        }
      });
    }
    return [...new Set(affected)];
  };

  const handleApproveClick = (blockedReq: string, blockingReq: string) => {
    const blocker = requests.find(r => r.reqNumber === blockingReq);
    const blocked = requests.find(r => r.reqNumber === blockedReq);
    const cascadeAffected = getCascadeAffected(blockingReq);

    setActionState({
      type: 'approve',
      blockedReq,
      blockingReq,
      blockerTitle: blocker?.title,
      blockedTitle: blocked?.title,
      cascadeAffected,
    });
    setActionNotes('');
  };

  const handleDeclineClick = (blockedReq: string, blockingReq: string) => {
    const blocker = requests.find(r => r.reqNumber === blockingReq);
    const blocked = requests.find(r => r.reqNumber === blockedReq);

    setActionState({
      type: 'decline',
      blockedReq,
      blockingReq,
      blockerTitle: blocker?.title,
      blockedTitle: blocked?.title,
      cascadeAffected: [],
    });
    setActionNotes('');
  };

  const handleConfirmAction = async () => {
    if (!actionState.type) return;

    setActionLoading(true);
    try {
      if (actionState.type === 'decline') {
        // Remove the blocker relationship
        await api.removeBlocker(actionState.blockedReq, actionState.blockingReq);
      } else {
        // For approve, we acknowledge the blocker is valid
        // This could be logged or tracked - for now just close the dialog
        console.log('Blocker approved:', actionState.blockingReq, 'blocking', actionState.blockedReq);
      }

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Failed to process blocker action:', error);
    }
    setActionLoading(false);
    setActionState({ type: null, blockedReq: '', blockingReq: '', cascadeAffected: [] });
  };

  // Build graph edges
  const edges: { from: string; to: string }[] = [];
  const nodeSet = new Set<string>();

  requests.forEach((req) => {
    if (req.blockedBy.length > 0 || req.blocking.length > 0) {
      nodeSet.add(req.reqNumber);
      req.blockedBy.forEach((blocker) => {
        nodeSet.add(blocker);
        edges.push({ from: blocker, to: req.reqNumber });
      });
    }
  });

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'done': return 'bg-green-100 text-green-800 border-green-300';
      case 'qa': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'blocked': return 'bg-red-100 text-red-800 border-red-300';
      case 'backlog': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'text-red-600';
      case 'catastrophic': return 'text-purple-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-slate-600';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'catastrophic': return 'bg-purple-50 border-purple-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'low': return 'bg-green-50 border-green-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const selectedRequest = requests.find(r => r.reqNumber === selectedReq);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Request Dependency Graph</h1>
            <FilterActiveBadge />
          </div>
          <p className="text-slate-500 mt-1">Manage blocking relationships and dependencies</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Work - Deepest Unblocked (Expanded) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Target className="text-blue-600" size={20} />
            Priority Work Queue
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Complete these to unblock the most downstream work
          </p>

          {filteredDeepestUnblocked.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle size={40} className="mx-auto mb-2 text-green-400" />
              {globalFiltersEnabled && deepestUnblocked.length > 0 ? (
                <>
                  <p>No matching items</p>
                  <p className="text-sm mt-1">Try adjusting the global filters</p>
                </>
              ) : (
                <>
                  <p>No blocking chains found</p>
                  <p className="text-sm mt-1">All requests are unblocked!</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDeepestUnblocked.map((req, idx) => {
                const isExpanded = expandedPriority === req.reqNumber;
                const fullRequest = requests.find(r => r.reqNumber === req.reqNumber);

                return (
                  <div
                    key={req.reqNumber}
                    className={`rounded-lg border transition-colors ${getPriorityBg(req.priority)}`}
                  >
                    <div
                      onClick={() => setExpandedPriority(isExpanded ? null : req.reqNumber)}
                      className="p-3 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {req.reqNumber}
                              {req.priority === 'critical' || req.priority === 'catastrophic' ? (
                                <Zap size={14} className="text-red-500" />
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-[160px]">
                              {req.title}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className={`text-lg font-bold ${getPriorityColor(req.priority)}`}>
                              {req.blocksCount}
                            </div>
                            <div className="text-xs text-slate-400">unblocks</div>
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded border ${getPhaseColor(req.currentPhase)}`}>
                          {req.currentPhase}
                        </span>
                        <span className={`text-xs font-medium ${getPriorityColor(req.priority)}`}>
                          {req.priority}
                        </span>
                        {req.depth > 1 && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Info size={10} />
                            {req.depth} levels deep
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && fullRequest && (
                      <div className="px-3 pb-3 border-t border-slate-200 mt-2 pt-3">
                        <div className="text-sm mb-2">
                          <span className="font-medium">Full Title:</span>
                          <p className="text-slate-600 mt-1">{fullRequest.title}</p>
                        </div>

                        {fullRequest.blocking.length > 0 && (
                          <div className="mt-3">
                            <span className="text-xs font-medium text-slate-700">
                              Will unblock these requests:
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {fullRequest.blocking.map(blockedReq => (
                                <span
                                  key={blockedReq}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedReq(blockedReq);
                                  }}
                                  className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded cursor-pointer hover:bg-red-200"
                                >
                                  {blockedReq}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReq(req.reqNumber);
                          }}
                          className="mt-3 w-full text-xs text-blue-600 hover:text-blue-700 py-1"
                        >
                          View full details
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Blocking Relationships Graph */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={20} />
            Blocking Relationships
          </h2>

          {edges.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
              <p className="text-lg">No blocking relationships</p>
              <p className="text-sm mt-1">All requests are unblocked</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-slate-50 overflow-auto max-h-[500px]">
                {requests
                  .filter(r => r.blocking.length > 0)
                  .map((blocker) => (
                    <div key={blocker.reqNumber} className="mb-6 last:mb-0">
                      {/* Blocker node */}
                      <div
                        onClick={() => setSelectedReq(blocker.reqNumber)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedReq === blocker.reqNumber
                            ? 'border-blue-500 bg-blue-100'
                            : 'border-amber-400 bg-amber-50 hover:bg-amber-100'
                        }`}
                      >
                        <div className="w-2 h-2 bg-amber-500 rounded-full" />
                        <span className="font-medium text-sm">{blocker.reqNumber}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getPhaseColor(blocker.currentPhase)}`}>
                          {blocker.currentPhase}
                        </span>
                      </div>

                      {/* Arrow and blocked items with actions */}
                      <div className="ml-4 mt-2 border-l-2 border-slate-300 pl-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <ArrowRight size={14} />
                          <span>blocks {blocker.blocking.length} request(s):</span>
                        </div>
                        <div className="space-y-2">
                          {blocker.blocking.map((blockedReq) => {
                            const blockedInfo = requests.find(r => r.reqNumber === blockedReq);
                            return (
                              <div
                                key={blockedReq}
                                className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
                                  selectedReq === blockedReq
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-red-200 bg-red-50 hover:bg-red-100'
                                }`}
                              >
                                <div
                                  onClick={() => setSelectedReq(blockedReq)}
                                  className="flex items-center gap-2 cursor-pointer flex-1"
                                >
                                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                                  <span className="font-medium text-sm">{blockedReq}</span>
                                  {blockedInfo && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${getPhaseColor(blockedInfo.currentPhase)}`}>
                                      {blockedInfo.currentPhase}
                                    </span>
                                  )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveClick(blockedReq, blocker.reqNumber);
                                    }}
                                    className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                                    title="Approve blocker"
                                  >
                                    <ThumbsUp size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeclineClick(blockedReq, blocker.reqNumber);
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                    title="Remove blocker"
                                  >
                                    <ThumbsDown size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Blocked requests without known blockers */}
                {requests
                  .filter(r => r.isBlocked && r.blockedBy.length === 0 && r.blocking.length === 0)
                  .map((req) => (
                    <div
                      key={req.reqNumber}
                      onClick={() => setSelectedReq(req.reqNumber)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer mr-2 mb-2 ${
                        selectedReq === req.reqNumber
                          ? 'border-blue-500 bg-blue-100'
                          : 'border-red-300 bg-red-50 hover:bg-red-100'
                      }`}
                    >
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="font-medium text-sm">{req.reqNumber}</span>
                      <span className="text-xs text-red-600">(blocked - unknown blocker)</span>
                    </div>
                  ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full" />
                  <span className="text-slate-600">Blocker (work first)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-slate-600">Blocked (waiting)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsUp size={14} className="text-green-600" />
                  <span className="text-slate-600">Approve blocker</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsDown size={14} className="text-red-600" />
                  <span className="text-slate-600">Remove blocker</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Request Details */}
      {selectedRequest && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Request Details: {selectedRequest.reqNumber}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-slate-700 mb-2">Title</h3>
              <p className="text-slate-600">{selectedRequest.title}</p>

              <div className="mt-4 flex gap-3 flex-wrap">
                <span className={`px-2 py-1 rounded text-sm ${getPhaseColor(selectedRequest.currentPhase)}`}>
                  {selectedRequest.currentPhase}
                </span>
                <span className={`px-2 py-1 rounded text-sm ${getPriorityColor(selectedRequest.priority)} bg-slate-100`}>
                  {selectedRequest.priority}
                </span>
                {selectedRequest.isBlocked && (
                  <span className="px-2 py-1 rounded text-sm bg-red-100 text-red-800">
                    BLOCKED
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-slate-700 mb-2">Blocked By ({selectedRequest.blockedBy.length})</h3>
                {selectedRequest.blockedBy.length === 0 ? (
                  <p className="text-slate-400 text-sm">None</p>
                ) : (
                  <div className="space-y-1">
                    {selectedRequest.blockedBy.map((blocker) => (
                      <div
                        key={blocker}
                        onClick={() => setSelectedReq(blocker)}
                        className="text-sm bg-amber-50 text-amber-800 px-2 py-1 rounded cursor-pointer hover:bg-amber-100 flex items-center justify-between"
                      >
                        <span>{blocker}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineClick(selectedRequest.reqNumber, blocker);
                          }}
                          className="text-red-600 hover:text-red-700"
                          title="Remove this blocker"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium text-slate-700 mb-2">Blocking ({selectedRequest.blocking.length})</h3>
                {selectedRequest.blocking.length === 0 ? (
                  <p className="text-slate-400 text-sm">None</p>
                ) : (
                  <div className="space-y-1">
                    {selectedRequest.blocking.map((blocked) => (
                      <div
                        key={blocked}
                        onClick={() => setSelectedReq(blocked)}
                        className="text-sm bg-red-50 text-red-800 px-2 py-1 rounded cursor-pointer hover:bg-red-100"
                      >
                        {blocked}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-amber-600">{deepestUnblocked.length}</div>
          <div className="text-slate-500 text-sm">Blocker Requests</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-red-600">
            {requests.filter(r => r.isBlocked).length}
          </div>
          <div className="text-slate-500 text-sm">Blocked Requests</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{edges.length}</div>
          <div className="text-slate-500 text-sm">Blocking Relationships</div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={actionState.type === 'approve'}
        title="Approve Blocker"
        message={
          <div>
            <p className="mb-2">
              Confirm that <span className="font-semibold">{actionState.blockingReq}</span> is a valid
              dependency for <span className="font-semibold">{actionState.blockedReq}</span>?
            </p>
            {actionState.cascadeAffected.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-2">
                  <AlertIcon size={16} />
                  Cascade Impact
                </div>
                <p className="text-sm text-blue-600">
                  When this blocker is completed, it will also unblock:
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {actionState.cascadeAffected.map(req => (
                    <span key={req} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {req}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
        confirmLabel="Approve"
        confirmVariant="success"
        onConfirm={handleConfirmAction}
        onCancel={() => setActionState({ type: null, blockedReq: '', blockingReq: '', cascadeAffected: [] })}
        isLoading={actionLoading}
        showNotes
        notes={actionNotes}
        onNotesChange={setActionNotes}
      />

      <ConfirmDialog
        isOpen={actionState.type === 'decline'}
        title="Remove Blocker"
        message={
          <div>
            <p className="mb-2">
              Remove <span className="font-semibold">{actionState.blockingReq}</span> as a blocker
              for <span className="font-semibold">{actionState.blockedReq}</span>?
            </p>
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                <AlertIcon size={16} />
                Warning
              </div>
              <p className="text-sm text-amber-600 mt-1">
                This will allow {actionState.blockedReq} to proceed without waiting for {actionState.blockingReq}.
                Make sure this dependency is no longer required.
              </p>
            </div>
          </div>
        }
        confirmLabel="Remove Blocker"
        confirmVariant="danger"
        onConfirm={handleConfirmAction}
        onCancel={() => setActionState({ type: null, blockedReq: '', blockingReq: '', cascadeAffected: [] })}
        isLoading={actionLoading}
        showNotes
        notes={actionNotes}
        onNotesChange={setActionNotes}
      />
    </div>
  );
}
