import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import * as api from '@/api/sdlc-client';
import type { RequestItem, DeepestUnblockedRequest } from '@/api/sdlc-client';

interface RequestWithBlockers extends RequestItem {
  blockedBy: string[];
  blocking: string[];
}

export default function BlockerGraphPage() {
  const [requests, setRequests] = useState<RequestWithBlockers[]>([]);
  const [deepestUnblocked, setDeepestUnblocked] = useState<DeepestUnblockedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get requests with blockers
      const [requestsRes, deepestRes] = await Promise.all([
        api.getAllRequests(),
        api.getDeepestUnblocked(20),
      ]);

      if (requestsRes.success && requestsRes.data) {
        // Filter to only requests that are blocked or blocking others
        const allRequests = requestsRes.data.requests;

        // Get blocker info for blocked requests
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

        // Also add requests that are blocking others (from deepest unblocked)
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

  // Build graph edges for visualization
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

  // Get phase color
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

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-slate-600';
    }
  };

  const selectedRequest = requests.find(r => r.reqNumber === selectedReq);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Request Dependency Graph</h1>
          <p className="text-slate-500 mt-1">Visualize blocking relationships between requests</p>
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
        {/* Priority Work - Deepest Unblocked */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="text-blue-600" size={20} />
            Priority Work
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Requests that unblock the most others - work these first!
          </p>

          {deepestUnblocked.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle size={40} className="mx-auto mb-2 text-green-400" />
              <p>No blocking chains found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deepestUnblocked.map((req, idx) => (
                <div
                  key={req.reqNumber}
                  onClick={() => setSelectedReq(req.reqNumber)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedReq === req.reqNumber
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{req.reqNumber}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[180px]">
                          {req.title}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getPriorityColor(req.priority)}`}>
                        {req.blocksCount}
                      </div>
                      <div className="text-xs text-slate-400">unblocks</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${getPhaseColor(req.currentPhase)}`}>
                      {req.currentPhase}
                    </span>
                    <span className={`text-xs ${getPriorityColor(req.priority)}`}>
                      {req.priority}
                    </span>
                  </div>
                </div>
              ))}
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
              {/* Visual graph representation */}
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

                      {/* Arrow and blocked items */}
                      <div className="ml-4 mt-2 border-l-2 border-slate-300 pl-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <ArrowRight size={14} />
                          <span>blocks {blocker.blocking.length} request(s):</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {blocker.blocking.map((blockedReq) => {
                            const blockedInfo = requests.find(r => r.reqNumber === blockedReq);
                            return (
                              <div
                                key={blockedReq}
                                onClick={() => setSelectedReq(blockedReq)}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                  selectedReq === blockedReq
                                    ? 'border-blue-500 bg-blue-100'
                                    : 'border-red-300 bg-red-50 hover:bg-red-100'
                                }`}
                              >
                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                <span className="font-medium text-sm">{blockedReq}</span>
                                {blockedInfo && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${getPhaseColor(blockedInfo.currentPhase)}`}>
                                    {blockedInfo.currentPhase}
                                  </span>
                                )}
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
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full" />
                  <span className="text-slate-600">Blocker (work first)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-slate-600">Blocked (waiting)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-slate-600">Done</span>
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

              <div className="mt-4 flex gap-3">
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
                        className="text-sm bg-amber-50 text-amber-800 px-2 py-1 rounded cursor-pointer hover:bg-amber-100"
                      >
                        {blocker}
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
    </div>
  );
}
