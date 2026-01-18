/**
 * SDLC Control Store
 * Central state management using Zustand
 */

import { create } from 'zustand';
import type {
  SDLCHealthStatus,
  EntityRegistryEntry,
  EntityDependency,
  KanbanColumn,
  GeneratedDiagram,
} from '@/types';
import * as api from '@/api/sdlc-client';
import type { Recommendation, RecommendationStatus } from '@/api/sdlc-client';

interface SDLCState {
  // Health
  health: SDLCHealthStatus | null;
  healthLoading: boolean;

  // Entity Graph
  entities: EntityRegistryEntry[];
  dependencies: EntityDependency[];
  graphLoading: boolean;

  // Kanban
  kanbanColumns: KanbanColumn[];
  kanbanLoading: boolean;

  // Diagrams
  diagrams: Map<string, GeneratedDiagram>;
  diagramsLoading: boolean;

  // Recommendations
  recommendations: Recommendation[];
  recommendationsLoading: boolean;
  recommendationUpdating: string | null; // ID of recommendation being updated

  // Actions
  fetchHealth: () => Promise<void>;
  fetchDependencyGraph: () => Promise<void>;
  fetchKanban: () => Promise<void>;
  fetchDiagram: (type: string, scope?: string) => Promise<void>;
  generateDiagram: (type: string, scope?: string) => Promise<void>;

  // Recommendation Actions
  fetchRecommendations: (status?: string, urgency?: string) => Promise<void>;
  updateRecommendationStatus: (id: string, status: RecommendationStatus, reviewedBy?: string, notes?: string) => Promise<boolean>;
  approveRecommendation: (id: string, reviewedBy: string, notes?: string) => Promise<boolean>;
  rejectRecommendation: (id: string, reviewedBy: string, reason: string) => Promise<boolean>;
  moveRecommendation: (id: string, phase: RecommendationStatus) => Promise<boolean>;
}

export const useSDLCStore = create<SDLCState>((set, get) => ({
  // Initial state
  health: null,
  healthLoading: false,
  entities: [],
  dependencies: [],
  graphLoading: false,
  kanbanColumns: [],
  kanbanLoading: false,
  diagrams: new Map(),
  diagramsLoading: false,
  recommendations: [],
  recommendationsLoading: false,
  recommendationUpdating: null,

  // Fetch health status
  fetchHealth: async () => {
    set({ healthLoading: true });
    const response = await api.getHealth();
    if (response.success && response.data) {
      set({ health: response.data });
    }
    set({ healthLoading: false });
  },

  // Fetch dependency graph
  fetchDependencyGraph: async () => {
    set({ graphLoading: true });
    const response = await api.getDependencyGraph();
    if (response.success && response.data) {
      set({
        entities: response.data.nodes || [],
        dependencies: response.data.edges || [],
      });
    }
    set({ graphLoading: false });
  },

  // Fetch kanban board
  fetchKanban: async () => {
    set({ kanbanLoading: true });
    const response = await api.getKanbanBoard();
    if (response.success && response.data) {
      set({ kanbanColumns: response.data.columns || [] });
    }
    set({ kanbanLoading: false });
  },

  // Fetch a diagram
  fetchDiagram: async (type: string, scope?: string) => {
    set({ diagramsLoading: true });
    const response = await api.getDiagram(type as any, scope);
    if (response.success && response.data) {
      const key = scope ? `${type}-${scope}` : type;
      const diagrams = new Map(get().diagrams);
      diagrams.set(key, response.data);
      set({ diagrams });
    }
    set({ diagramsLoading: false });
  },

  // Generate a diagram
  generateDiagram: async (type: string, scope?: string) => {
    set({ diagramsLoading: true });
    const response = await api.generateDiagram(type as any, scope);
    if (response.success && response.data) {
      const key = scope ? `${type}-${scope}` : type;
      const diagrams = new Map(get().diagrams);
      diagrams.set(key, response.data);
      set({ diagrams });
    }
    set({ diagramsLoading: false });
  },

  // Fetch recommendations
  fetchRecommendations: async (status?: string, urgency?: string) => {
    set({ recommendationsLoading: true });
    const response = await api.getRecommendations(status, urgency);
    if (response.success && response.data) {
      set({ recommendations: response.data.recommendations || [] });
    }
    set({ recommendationsLoading: false });
  },

  // Update recommendation status
  updateRecommendationStatus: async (id: string, status: api.RecommendationStatus, reviewedBy?: string, notes?: string) => {
    set({ recommendationUpdating: id });
    const response = await api.updateRecommendationStatus(id, status, reviewedBy, notes);
    if (response.success && response.data) {
      // Update the recommendation in the local state
      const recommendations = get().recommendations.map((rec) =>
        rec.id === id ? { ...rec, status, reviewedBy, reviewedAt: new Date().toISOString() } : rec
      );
      set({ recommendations });
    }
    set({ recommendationUpdating: null });
    return response.success;
  },

  // Approve recommendation
  approveRecommendation: async (id: string, reviewedBy: string, notes?: string) => {
    return get().updateRecommendationStatus(id, 'approved', reviewedBy, notes);
  },

  // Reject recommendation
  rejectRecommendation: async (id: string, reviewedBy: string, reason: string) => {
    return get().updateRecommendationStatus(id, 'rejected', reviewedBy, reason);
  },

  // Move recommendation to a different phase
  moveRecommendation: async (id: string, phase: api.RecommendationStatus) => {
    return get().updateRecommendationStatus(id, phase);
  },
}));
