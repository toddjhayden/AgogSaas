/**
 * Global Filter Bar
 * Cross-page filtering toggle and controls
 */

import { useState } from 'react';
import {
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
  Lightbulb,
  Layers,
} from 'lucide-react';
import { useFilterStore, type FilterType, type FilterStatus, type FilterPriority } from '../stores/useFilterStore';

interface GlobalFilterToggleProps {
  compact?: boolean;
}

// Compact toggle for sidebar
export function GlobalFilterToggle({ compact = false }: GlobalFilterToggleProps) {
  const { isEnabled, toggleEnabled, type, focusedItem, resetFilters } = useFilterStore();
  const [isExpanded, setIsExpanded] = useState(false);

  if (compact) {
    return (
      <button
        onClick={toggleEnabled}
        className={`flex items-center gap-2 px-3 py-2 w-full rounded-lg transition-colors ${
          isEnabled
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
        title={isEnabled ? 'Filters active - click to disable' : 'Enable global filters'}
      >
        <Filter size={18} />
        <span className="flex-1 text-left text-sm">Filters</span>
        {isEnabled && (
          <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded">
            {type !== 'ALL' ? type : focusedItem ? 'Focus' : 'ON'}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="border-t border-slate-700 pt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-2 w-full rounded-lg transition-colors ${
          isEnabled
            ? 'bg-blue-600/20 text-blue-300'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Filter size={18} />
        <span className="flex-1 text-left text-sm font-medium">Global Filters</span>
        {isEnabled && (
          <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded mr-1">
            Active
          </span>
        )}
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="mt-2 px-2 pb-2 space-y-2">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs text-slate-400">Filter Enabled</span>
            <button
              onClick={toggleEnabled}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                isEnabled ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {isEnabled && (
            <>
              {/* Type selector */}
              <TypeSelector />

              {/* Active filters indicator */}
              {focusedItem && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded text-xs">
                  <span className="text-slate-400">Focus:</span>
                  <span className="text-blue-300 font-mono">{focusedItem}</span>
                  <button
                    onClick={() => useFilterStore.getState().clearFocus()}
                    className="ml-auto text-slate-500 hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Reset button */}
              <button
                onClick={resetFilters}
                className="w-full text-xs text-slate-400 hover:text-red-400 py-1 transition-colors"
              >
                Reset all filters
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Type selector component
function TypeSelector() {
  const { type, setType } = useFilterStore();

  const types: { value: FilterType; label: string; icon: typeof Layers }[] = [
    { value: 'ALL', label: 'All', icon: Layers },
    { value: 'REQ', label: 'Requests', icon: FileText },
    { value: 'REC', label: 'Recommendations', icon: Lightbulb },
  ];

  return (
    <div className="flex gap-1 px-1">
      {types.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setType(value)}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
            type === value
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Icon size={12} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

// Full filter bar for page headers
interface FilterBarProps {
  showSearch?: boolean;
  showStatus?: boolean;
  showPriority?: boolean;
}

export function FilterBar({ showSearch = true, showStatus = true, showPriority = true }: FilterBarProps) {
  const {
    isEnabled,
    type,
    setType,
    status,
    setStatus,
    priority,
    setPriority,
    searchTerm,
    setSearchTerm,
    focusedItem,
    clearFocus,
  } = useFilterStore();

  if (!isEnabled) return null;

  return (
    <div className="bg-white rounded-lg shadow p-3 md:p-4 mb-3 md:mb-4">
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs md:text-sm text-slate-500 hidden sm:inline">Type:</span>
          <div className="flex gap-1">
            {(['ALL', 'REQ', 'REC'] as FilterType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded transition-colors ${
                  type === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t === 'ALL' ? 'All' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        {showStatus && (
          <div className="flex items-center gap-1 md:gap-2">
            <span className="text-xs md:text-sm text-slate-500 hidden md:inline">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FilterStatus)}
              className="px-2 md:px-3 py-1 text-xs md:text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="backlog">Backlog</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="qa">QA</option>
              <option value="done">Done</option>
            </select>
          </div>
        )}

        {/* Priority Filter */}
        {showPriority && (
          <div className="flex items-center gap-1 md:gap-2">
            <span className="text-xs md:text-sm text-slate-500 hidden md:inline">Priority:</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as FilterPriority)}
              className="px-2 md:px-3 py-1 text-xs md:text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priority</option>
              <option value="catastrophic">Catastrophic</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        )}

        {/* Search */}
        {showSearch && (
          <div className="flex-1 min-w-[120px] sm:min-w-[200px] order-first sm:order-none w-full sm:w-auto">
            <div className="relative">
              <Search size={16} className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 md:pl-9 pr-3 py-1.5 text-xs md:text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Focused Item Indicator */}
        {focusedItem && (
          <div className="flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-blue-50 border border-blue-200 rounded w-full sm:w-auto">
            <span className="text-xs md:text-sm text-blue-700 truncate">
              Focus: <span className="font-mono">{focusedItem}</span>
            </span>
            <button
              onClick={clearFocus}
              className="text-blue-500 hover:text-blue-700 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Badge to show filter is active
export function FilterActiveBadge() {
  const { isEnabled, type, focusedItem } = useFilterStore();

  if (!isEnabled) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
      <Filter size={10} />
      {focusedItem ? `Focus: ${focusedItem}` : type !== 'ALL' ? type : 'Filtered'}
    </span>
  );
}

// Compact filter status that's always visible - shows current filter state
interface FilterStatusProps {
  className?: string;
}

export function FilterStatus({ className = '' }: FilterStatusProps) {
  const {
    isEnabled,
    type,
    focusedItem,
    status,
    priority,
    searchTerm,
    toggleEnabled,
    clearFocus,
    resetFilters,
  } = useFilterStore();

  const hasActiveFilters = type !== 'ALL' || focusedItem || status !== 'all' || priority !== 'all' || searchTerm;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-2 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Toggle button */}
        <button
          onClick={toggleEnabled}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium transition-colors ${
            isEnabled
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Filter size={14} />
          <span>{isEnabled ? 'Filters ON' : 'Filters OFF'}</span>
        </button>

        {/* Active filter indicators */}
        {isEnabled && hasActiveFilters && (
          <>
            {type !== 'ALL' && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                Type: {type}
              </span>
            )}
            {focusedItem && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                <span className="font-mono">{focusedItem}</span>
                <button
                  onClick={clearFocus}
                  className="hover:text-blue-900"
                  title="Clear focus"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {status !== 'all' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                Status: {status}
              </span>
            )}
            {priority !== 'all' && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                Priority: {priority}
              </span>
            )}
            {searchTerm && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full flex items-center gap-1">
                <Search size={10} />
                "{searchTerm}"
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-red-600 px-1"
              title="Reset all filters"
            >
              <X size={14} />
            </button>
          </>
        )}

        {isEnabled && !hasActiveFilters && (
          <span className="text-xs text-slate-400">No active filters</span>
        )}
      </div>
    </div>
  );
}

// Hook for double-click to filter functionality
export function useDoubleClickFilter() {
  const { focusOnReq, focusOnRec, setEnabled } = useFilterStore();

  const handleDoubleClick = (itemId: string) => {
    if (!itemId) return;

    // Enable filters first
    setEnabled(true);

    // Determine type from ID pattern
    if (itemId.startsWith('REQ-')) {
      focusOnReq(itemId);
    } else if (itemId.startsWith('REC-')) {
      focusOnRec(itemId);
    } else {
      // Generic focus (assume REQ if unclear)
      focusOnReq(itemId);
    }
  };

  return { handleDoubleClick };
}
