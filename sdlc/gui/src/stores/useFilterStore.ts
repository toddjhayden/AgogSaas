/**
 * Global Filter Store
 * Cross-page filtering for REQ/REC items
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FilterType = 'ALL' | 'REQ' | 'REC';
export type FilterStatus = 'all' | 'pending' | 'in_progress' | 'blocked' | 'done' | 'qa' | 'backlog';
export type FilterPriority = 'all' | 'catastrophic' | 'critical' | 'high' | 'medium' | 'low';

interface FilterState {
  // Type filter (REQ/REC/ALL)
  type: FilterType;

  // Focus filter (specific request/recommendation to focus on)
  focusedItem: string | null;

  // Status filter
  status: FilterStatus;

  // Priority filter
  priority: FilterPriority;

  // Search term
  searchTerm: string;

  // Filter enabled state
  isEnabled: boolean;
}

interface FilterActions {
  setType: (type: FilterType) => void;
  setFocusedItem: (item: string | null) => void;
  setStatus: (status: FilterStatus) => void;
  setPriority: (priority: FilterPriority) => void;
  setSearchTerm: (term: string) => void;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
  resetFilters: () => void;

  // Convenience methods
  focusOnReq: (reqNumber: string) => void;
  focusOnRec: (recId: string) => void;
  clearFocus: () => void;
}

type FilterStore = FilterState & FilterActions;

const DEFAULT_FILTERS: FilterState = {
  type: 'ALL',
  focusedItem: null,
  status: 'all',
  priority: 'all',
  searchTerm: '',
  isEnabled: false,
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      ...DEFAULT_FILTERS,

      setType: (type) => set({ type }),

      setFocusedItem: (item) => set({ focusedItem: item }),

      setStatus: (status) => set({ status }),

      setPriority: (priority) => set({ priority }),

      setSearchTerm: (term) => set({ searchTerm: term }),

      toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),

      setEnabled: (enabled) => set({ isEnabled: enabled }),

      resetFilters: () => set(DEFAULT_FILTERS),

      // Focus on a specific request
      focusOnReq: (reqNumber) => set({
        type: 'REQ',
        focusedItem: reqNumber,
        isEnabled: true,
      }),

      // Focus on a specific recommendation
      focusOnRec: (recId) => set({
        type: 'REC',
        focusedItem: recId,
        isEnabled: true,
      }),

      // Clear focus but keep other filters
      clearFocus: () => set({ focusedItem: null }),
    }),
    {
      name: 'sdlc-filter-storage',
      partialize: (state) => ({
        type: state.type,
        focusedItem: state.focusedItem,
        status: state.status,
        priority: state.priority,
        isEnabled: state.isEnabled,
        // Don't persist searchTerm - it's usually session-specific
      }),
    }
  )
);

// Helper hook to check if an item passes the current filters
export function useFilterMatch() {
  const { type, focusedItem, status, priority, searchTerm, isEnabled } = useFilterStore();

  return (item: {
    reqNumber?: string;
    recId?: string;
    category?: string;
    currentPhase?: string;
    status?: string;
    priority?: string;
    title?: string;
  }): boolean => {
    // If filters are disabled, everything passes
    if (!isEnabled) return true;

    // Type filter
    if (type !== 'ALL') {
      const isReq = item.category === 'request' || item.reqNumber?.startsWith('REQ-');
      const isRec = item.category === 'recommendation' || item.recId;

      if (type === 'REQ' && !isReq) return false;
      if (type === 'REC' && !isRec) return false;
    }

    // Focus filter (if focused on specific item, only show that item and related items)
    if (focusedItem) {
      const itemId = item.reqNumber || item.recId || '';
      // Show if it matches the focused item
      if (itemId !== focusedItem) {
        // In the future, we could also show related/blocked items
        return false;
      }
    }

    // Status filter
    if (status !== 'all') {
      const itemStatus = item.currentPhase || item.status || '';
      if (itemStatus.toLowerCase() !== status) return false;
    }

    // Priority filter
    if (priority !== 'all') {
      const itemPriority = item.priority?.toLowerCase() || '';
      if (itemPriority !== priority) return false;
    }

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const searchableText = [
        item.reqNumber,
        item.recId,
        item.title,
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchableText.includes(term)) return false;
    }

    return true;
  };
}
