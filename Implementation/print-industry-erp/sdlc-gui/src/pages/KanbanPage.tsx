import { useEffect, useMemo } from 'react';
import { useSDLCStore } from '@/stores/useSDLCStore';
import { Clock, AlertCircle, RefreshCw } from 'lucide-react';
import type { OwnerRequest } from '@/types';
import { useFilterStore } from '@/stores/useFilterStore';
import { FilterBar, FilterActiveBadge } from '@/components/GlobalFilterBar';

function RequestCard({ request }: { request: OwnerRequest }) {
  const priorityColors = {
    critical: 'border-l-red-500 bg-red-50',
    high: 'border-l-orange-500 bg-orange-50',
    medium: 'border-l-yellow-500 bg-yellow-50',
    low: 'border-l-green-500 bg-green-50',
  };

  return (
    <div
      className={`kanban-card border-l-4 ${priorityColors[request.priority] || 'border-l-gray-300'}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-slate-500">{request.reqNumber}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            request.priority === 'critical'
              ? 'bg-red-100 text-red-700'
              : request.priority === 'high'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {request.priority}
        </span>
      </div>

      <h3 className="font-medium text-slate-800 mb-2 line-clamp-2">{request.title}</h3>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{request.estimatedEffort || 'TBD'}</span>
        </div>
        {request.primaryBu && (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
            {request.primaryBu}
          </span>
        )}
      </div>

      {request.affectedEntities && request.affectedEntities.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap gap-1">
            {request.affectedEntities.slice(0, 3).map((entity) => (
              <span
                key={entity.entityName}
                className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
              >
                {entity.entityName}
              </span>
            ))}
            {request.affectedEntities.length > 3 && (
              <span className="text-xs text-slate-400">
                +{request.affectedEntities.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KanbanPage() {
  const { kanbanColumns, kanbanLoading, fetchKanban } = useSDLCStore();

  // Global filters
  const {
    isEnabled: globalFiltersEnabled,
    type: globalType,
    status: globalStatus,
    priority: globalPriority,
    searchTerm: globalSearchTerm,
    focusedItem,
  } = useFilterStore();

  useEffect(() => {
    fetchKanban();
  }, [fetchKanban]);

  // Filter requests in each column based on global filters
  const filteredColumns = useMemo(() => {
    if (!globalFiltersEnabled) return kanbanColumns;

    // If global type is set to REC only, show nothing on this board (it's for requests)
    if (globalType === 'REC') return [];

    return kanbanColumns.map((column) => {
      // If global status is set and doesn't match this column, return empty
      if (globalStatus !== 'all' && column.phaseCode.toLowerCase() !== globalStatus) {
        return { ...column, requests: [], count: 0 };
      }

      let filteredRequests = column.requests || [];

      // Priority filter
      if (globalPriority !== 'all') {
        filteredRequests = filteredRequests.filter(
          (r) => r.priority.toLowerCase() === globalPriority
        );
      }

      // Search filter
      if (globalSearchTerm) {
        const term = globalSearchTerm.toLowerCase();
        filteredRequests = filteredRequests.filter(
          (r) =>
            r.title.toLowerCase().includes(term) ||
            r.reqNumber.toLowerCase().includes(term)
        );
      }

      // Focus filter
      if (focusedItem) {
        filteredRequests = filteredRequests.filter((r) => r.reqNumber === focusedItem);
      }

      return {
        ...column,
        requests: filteredRequests,
        count: filteredRequests.length,
      };
    });
  }, [kanbanColumns, globalFiltersEnabled, globalType, globalStatus, globalPriority, globalSearchTerm, focusedItem]);

  if (kanbanLoading && kanbanColumns.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-slate-500">Loading kanban board...</div>
      </div>
    );
  }

  // Show message if global filter is set to recommendations only
  if (globalFiltersEnabled && globalType === 'REC') {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Kanban Board</h1>
            <FilterActiveBadge />
          </div>
        </div>
        <FilterBar showSearch={true} showStatus={true} showPriority={true} />
        <div className="flex items-center justify-center h-64 text-slate-500">
          <div className="text-center">
            <p>Global filter is set to show Recommendations only.</p>
            <p className="text-sm mt-1">This board displays Requests. Switch to "All" or "REQ" type to see content.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Kanban Board</h1>
          <FilterActiveBadge />
        </div>
        <button
          onClick={() => fetchKanban()}
          disabled={kanbanLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={16} className={kanbanLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Global Filter Bar */}
      <FilterBar showSearch={true} showStatus={true} showPriority={true} />

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-max">
          {filteredColumns.map((column) => {
            const isOverLimit = column.wipLimit && column.count > column.wipLimit;

            return (
              <div
                key={column.phaseCode}
                className={`phase-column w-80 flex flex-col ${
                  isOverLimit ? 'over-limit' : ''
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-700">{column.phaseName}</h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isOverLimit ? 'text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {column.count}
                      {column.wipLimit && ` / ${column.wipLimit}`}
                    </span>
                    {isOverLimit && <AlertCircle size={16} className="text-red-500" />}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto">
                  {column.requests && column.requests.length > 0 ? (
                    column.requests.map((request) => (
                      <RequestCard key={request.id} request={request} />
                    ))
                  ) : (
                    <div className="text-center text-slate-400 py-8">
                      {globalFiltersEnabled ? 'No matching requests' : 'No requests in this phase'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredColumns.length === 0 && !globalFiltersEnabled && (
            <div className="flex items-center justify-center w-full text-slate-500">
              No phases configured. Set up SDLC phases first.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
