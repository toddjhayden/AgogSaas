import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface KPIFavorite {
  id: string;
  name: string;
  category: string;
}

export interface UserPreferences {
  language: 'en' | 'zh';
  selectedFacility: string | null;
  theme: 'light' | 'dark';
  tenantId?: string; // Added for multi-tenant support
}

interface AppState {
  // User preferences
  preferences: UserPreferences;
  setLanguage: (language: 'en' | 'zh') => void;
  setFacility: (facilityId: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setTenantId: (tenantId: string) => void; // Added for multi-tenant support

  // KPI favorites
  kpiFavorites: KPIFavorite[];
  addKPIFavorite: (kpi: KPIFavorite) => void;
  removeKPIFavorite: (kpiId: string) => void;

  // Dashboard layouts (saved custom layouts)
  dashboardLayouts: Record<string, any>;
  saveDashboardLayout: (dashboardId: string, layout: any) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial preferences
      preferences: {
        language: 'en',
        selectedFacility: null,
        theme: 'light',
      },

      setLanguage: (language) =>
        set((state) => ({
          preferences: { ...state.preferences, language },
        })),

      setFacility: (facilityId) =>
        set((state) => ({
          preferences: { ...state.preferences, selectedFacility: facilityId },
        })),

      setTheme: (theme) =>
        set((state) => ({
          preferences: { ...state.preferences, theme },
        })),

      setTenantId: (tenantId) => {
        set((state) => ({
          preferences: { ...state.preferences, tenantId },
        }));
        // Update global accessor for GraphQL client
        if (typeof window !== 'undefined') {
          (window as any).__getTenantId = () => tenantId;
        }
      },

      // KPI favorites
      kpiFavorites: [],

      addKPIFavorite: (kpi) =>
        set((state) => ({
          kpiFavorites: [...state.kpiFavorites, kpi],
        })),

      removeKPIFavorite: (kpiId) =>
        set((state) => ({
          kpiFavorites: state.kpiFavorites.filter((kpi) => kpi.id !== kpiId),
        })),

      // Dashboard layouts
      dashboardLayouts: {},

      saveDashboardLayout: (dashboardId, layout) =>
        set((state) => ({
          dashboardLayouts: {
            ...state.dashboardLayouts,
            [dashboardId]: layout,
          },
        })),
    }),
    {
      name: 'agogsaas-storage',
    }
  )
);
