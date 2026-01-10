/**
 * SDLC Settings Store
 * Manages SDLC API configuration and health status
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface APIHealthStatus {
  isHealthy: boolean;
  lastCheck: Date | null;
  error: string | null;
  database: boolean;
  nats: boolean;
}

interface SDLCSettingsState {
  // API Configuration
  apiUrl: string;
  apiHealth: APIHealthStatus;
  isCheckingHealth: boolean;

  // Actions
  setApiUrl: (url: string) => void;
  checkApiHealth: () => Promise<void>;
  resetToDefault: () => void;
}

const DEFAULT_API_URL = import.meta.env.VITE_SDLC_API_URL || 'https://api.agog.fyi/api';

// Preset API URLs for quick selection
export const API_URL_PRESETS = [
  { label: 'Production (VPS)', url: 'https://api.agog.fyi/api' },
  { label: 'Local Development', url: 'http://localhost:5100/api' },
];

export const useSDLCSettingsStore = create<SDLCSettingsState>()(
  persist(
    (set, get) => ({
      apiUrl: DEFAULT_API_URL,
      apiHealth: {
        isHealthy: false,
        lastCheck: null,
        error: null,
        database: false,
        nats: false,
      },
      isCheckingHealth: false,

      setApiUrl: (url: string) => {
        set({ apiUrl: url });
        // Check health after URL change
        get().checkApiHealth();
      },

      checkApiHealth: async () => {
        const { apiUrl } = get();
        set({ isCheckingHealth: true });

        try {
          // Try the agent health endpoint first (more common)
          let response = await fetch(`${apiUrl}/agent/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });

          // If agent/health doesn't work, try just /health
          if (!response.ok) {
            response = await fetch(`${apiUrl.replace('/api', '')}/health`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
            });
          }

          if (response.ok) {
            const data = await response.json();
            set({
              apiHealth: {
                isHealthy: true,
                lastCheck: new Date(),
                error: null,
                database: data.data?.database ?? false,
                nats: data.data?.nats ?? false,
              },
              isCheckingHealth: false,
            });
          } else {
            const errorText = await response.text();
            set({
              apiHealth: {
                isHealthy: false,
                lastCheck: new Date(),
                error: `API returned ${response.status}: ${errorText}`,
                database: false,
                nats: false,
              },
              isCheckingHealth: false,
            });
          }
        } catch (error) {
          set({
            apiHealth: {
              isHealthy: false,
              lastCheck: new Date(),
              error: error instanceof Error ? error.message : 'Connection failed',
              database: false,
              nats: false,
            },
            isCheckingHealth: false,
          });
        }
      },

      resetToDefault: () => {
        set({ apiUrl: DEFAULT_API_URL });
        get().checkApiHealth();
      },
    }),
    {
      name: 'sdlc-settings',
      partialize: (state) => ({ apiUrl: state.apiUrl }),
    }
  )
);

// Export a function to get the current API URL (for use in API clients)
export function getSDLCApiUrl(): string {
  return useSDLCSettingsStore.getState().apiUrl;
}
