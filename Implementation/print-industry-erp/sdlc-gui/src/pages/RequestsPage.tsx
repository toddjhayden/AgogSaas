import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Search, Filter, ChevronDown, ChevronUp, Clock, AlertCircle } from 'lucide-react';
import * as api from '@/api/sdlc-client';
import type { RequestItem } from '@/api/sdlc-client';
import { useFilterStore } from '@/stores/useFilterStore';
import { FilterBar, FilterActiveBadge } from '@/components/GlobalFilterBar';

type LocalFilterType = 'all' | 'request' | 'recommendation';
type SortField = 'createdAt' | 'priority' | 'title' | 'currentPhase';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

const CATEGORY_COLORS: Record<string, string> = {
  request: 'bg-blue-100 text-blue-800',
  recommendation: 'bg-purple-100 text-purple-800',
};

const PHASE_COLORS: Record<string, string> = {
  backlog: 'bg-slate-100 text-slate-700',
  research: 'bg-cyan-100 text-cyan-700',
  review: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
  qa: 'bg-amber-100 text-amber-700',
  staging: 'bg-teal-100 text-teal-700',
  done: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  pending: 'bg-purple-100 text-purple-700',
  recommendation: 'bg-purple-100 text-purple-700',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [summary, setSummary] = useState<{
    totalRequests: number;
    totalRecommendations: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global filters
  const {
    isEnabled: globalFiltersEnabled,
    type: globalType,
    status: globalStatus,
    priority: globalPriority,
    searchTerm: globalSearchTerm,
    focusedItem,
  } = useFilterStore();

  // Local filters and sorting
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [localFilterType, setLocalFilterType] = useState<LocalFilterType>('all');
  const [localFilterPriority, setLocalFilterPriority] = useState<string>('all');
  const [localFilterPhase, setLocalFilterPhase] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Effective filters (global takes precedence when enabled)
  const effectiveSearchTerm = globalFiltersEnabled && globalSearchTerm ? globalSearchTerm : localSearchTerm;
  const effectivePriority = globalFiltersEnabled && globalPriority !== 'all' ? globalPriority : localFilterPriority;

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);

    const response = await api.getAllRequests();
    if (response.success && response.data) {
      setRequests(response.data.requests);
      setSummary(response.data.summary);
    } else {
      setError(response.error || 'Failed to fetch requests');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Get unique phases for filter dropdown
  const uniquePhases = useMemo(() => {
    const phases = new Set(requests.map((r) => r.currentPhase));
    return Array.from(phases).sort();
  }, [requests]);

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Global filters (when enabled)
    if (globalFiltersEnabled) {
      // Type filter from global
      if (globalType !== 'ALL') {
        filtered = filtered.filter((r) => {
          if (globalType === 'REQ') return r.category === 'request';
          if (globalType === 'REC') return r.category === 'recommendation';
          return true;
        });
      }

      // Status filter from global
      if (globalStatus !== 'all') {
        filtered = filtered.filter((r) => r.currentPhase.toLowerCase() === globalStatus);
      }

      // Focus filter - show only focused item
      if (focusedItem) {
        filtered = filtered.filter((r) => r.reqNumber === focusedItem);
      }
    }

    // Search filter (use effective search term)
    if (effectiveSearchTerm) {
      const term = effectiveSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.reqNumber.toLowerCase().includes(term) ||
          r.description?.toLowerCase().includes(term)
      );
    }

    // Local type filter (only if global type not set)
    if (!globalFiltersEnabled || globalType === 'ALL') {
      if (localFilterType !== 'all') {
        filtered = filtered.filter((r) => r.category === localFilterType);
      }
    }

    // Priority filter (use effective priority)
    if (effectivePriority !== 'all') {
      filtered = filtered.filter((r) => r.priority === effectivePriority);
    }

    // Phase filter (local only - doesn't conflict with global status)
    if (localFilterPhase !== 'all' && (!globalFiltersEnabled || globalStatus === 'all')) {
      filtered = filtered.filter((r) => r.currentPhase === localFilterPhase);
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'currentPhase':
          cmp = a.currentPhase.localeCompare(b.currentPhase);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [requests, globalFiltersEnabled, globalType, globalStatus, globalPriority, focusedItem, effectiveSearchTerm, effectivePriority, localFilterType, localFilterPhase, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">All Requests</h1>
            <FilterActiveBadge />
          </div>
          {summary && (
            <p className="text-sm text-slate-500 mt-1">
              {summary.totalRequests} requests, {summary.totalRecommendations} recommendations
            </p>
          )}
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Global Filter Bar */}
      <FilterBar showSearch={true} showStatus={true} showPriority={true} />

      {/* Page-Level Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search (disabled when global search is active) */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, REQ number, or description..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              disabled={globalFiltersEnabled && !!globalSearchTerm}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          {/* Type Filter (disabled when global type is set) */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={localFilterType}
              onChange={(e) => setLocalFilterType(e.target.value as LocalFilterType)}
              disabled={globalFiltersEnabled && globalType !== 'ALL'}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="all">All Types</option>
              <option value="request">Requests</option>
              <option value="recommendation">Recommendations</option>
            </select>
          </div>

          {/* Priority Filter (disabled when global priority is set) */}
          <select
            value={localFilterPriority}
            onChange={(e) => setLocalFilterPriority(e.target.value)}
            disabled={globalFiltersEnabled && globalPriority !== 'all'}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Phase Filter (disabled when global status is set) */}
          <select
            value={localFilterPhase}
            onChange={(e) => setLocalFilterPhase(e.target.value)}
            disabled={globalFiltersEnabled && globalStatus !== 'all'}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="all">All Phases</option>
            {uniquePhases.map((phase) => (
              <option key={phase} value={phase}>
                {phase.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-500 mb-2">
        Showing {filteredRequests.length} of {requests.length} items
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500">Loading requests...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
              <div className="text-red-500">{error}</div>
              <button onClick={fetchRequests} className="mt-2 text-blue-600 hover:underline">
                Try again
              </button>
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500">No requests found matching your filters</div>
          </div>
        ) : (
          <div className="overflow-auto h-full -webkit-overflow-scrolling-touch">
            <table className="w-full text-sm min-w-[640px] md:min-w-0">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-2 md:px-4 py-3 text-left font-medium text-slate-600 w-8"></th>
                  <th
                    className="px-2 md:px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort('title')}
                  >
                    <div className="flex items-center gap-1">
                      Request <SortIcon field="title" />
                    </div>
                  </th>
                  <th className="px-2 md:px-4 py-3 text-left font-medium text-slate-600 hidden sm:table-cell">Type</th>
                  <th
                    className="px-2 md:px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort('priority')}
                  >
                    <div className="flex items-center gap-1">
                      Priority <SortIcon field="priority" />
                    </div>
                  </th>
                  <th
                    className="px-2 md:px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort('currentPhase')}
                  >
                    <div className="flex items-center gap-1">
                      Phase <SortIcon field="currentPhase" />
                    </div>
                  </th>
                  <th className="px-2 md:px-4 py-3 text-left font-medium text-slate-600 hidden lg:table-cell">BU</th>
                  <th
                    className="px-2 md:px-4 py-3 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-100 hidden md:table-cell"
                    onClick={() => toggleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      Created <SortIcon field="createdAt" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <>
                    <tr
                      key={req.id}
                      className={`border-t hover:bg-slate-50 cursor-pointer ${
                        expandedId === req.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    >
                      <td className="px-2 md:px-4 py-3">
                        {expandedId === req.id ? (
                          <ChevronUp size={16} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-400" />
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-3">
                        <div className="font-medium text-slate-800 line-clamp-2">{req.title}</div>
                        <div className="text-xs text-slate-500">{req.reqNumber}</div>
                        {/* Show type inline on mobile */}
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded mt-1 sm:hidden ${
                            CATEGORY_COLORS[req.category] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {req.category}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3 hidden sm:table-cell">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${
                            CATEGORY_COLORS[req.category] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {req.category}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded border ${
                            PRIORITY_COLORS[req.priority] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${
                            PHASE_COLORS[req.currentPhase] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {req.currentPhase.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-slate-600 hidden lg:table-cell">{req.primaryBu || '-'}</td>
                      <td className="px-2 md:px-4 py-3 text-slate-500 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(req.createdAt)}
                        </div>
                      </td>
                    </tr>
                    {expandedId === req.id && (
                      <tr key={`${req.id}-expanded`} className="bg-slate-50 border-t">
                        <td colSpan={7} className="px-2 md:px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium text-slate-700 mb-2">Description</h4>
                              <div className="text-sm text-slate-600 whitespace-pre-wrap bg-white p-3 rounded border max-h-48 overflow-auto">
                                {req.description || 'No description available'}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium text-slate-700 mb-1">Details</h4>
                                <div className="text-sm space-y-1">
                                  <div>
                                    <span className="text-slate-500">Source:</span>{' '}
                                    <span className="text-slate-700">{req.source}</span>
                                  </div>
                                  {req.assignedTo && (
                                    <div>
                                      <span className="text-slate-500">Assigned To:</span>{' '}
                                      <span className="text-slate-700">{req.assignedTo}</span>
                                    </div>
                                  )}
                                  {req.tags.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-slate-500">Tags:</span>
                                      {req.tags.map((tag) => (
                                        <span
                                          key={tag}
                                          className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-slate-500">Updated:</span>{' '}
                                    <span className="text-slate-700">{formatDate(req.updatedAt)}</span>
                                  </div>
                                  {/* Show hidden columns info on mobile */}
                                  <div className="md:hidden">
                                    <span className="text-slate-500">Created:</span>{' '}
                                    <span className="text-slate-700">{formatDate(req.createdAt)}</span>
                                  </div>
                                  {req.primaryBu && (
                                    <div className="lg:hidden">
                                      <span className="text-slate-500">Business Unit:</span>{' '}
                                      <span className="text-slate-700">{req.primaryBu}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
