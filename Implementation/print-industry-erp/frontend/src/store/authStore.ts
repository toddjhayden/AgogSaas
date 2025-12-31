import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apolloClient } from '../graphql/client';
import {
  CUSTOMER_LOGIN,
  CUSTOMER_REGISTER,
  CUSTOMER_REFRESH_TOKEN,
  CUSTOMER_LOGOUT,
} from '../graphql/mutations/auth';

// Types based on backend authentication system
export interface AuthUser {
  id: string;
  customerId: string;
  tenantId: string; // Added for RLS multi-tenancy support
  email: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER_ADMIN' | 'CUSTOMER_USER' | 'APPROVER';
  mfaEnabled: boolean;
  isEmailVerified: boolean;
  preferredLanguage?: string;
  timezone?: string;
  lastLoginAt?: string;
}

export interface Customer {
  id: string;
  customer_name: string;
  customer_code: string;
}

export interface RegisterData {
  customerCode: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CustomerAuthPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
  customer: Customer;
  permissions: string[];
}

interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  isInitializing: boolean;
  user: AuthUser | null;
  customer: Customer | null;
  permissions: string[];

  // Tokens (accessToken in-memory only, refreshToken persisted)
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;

  // Token refresh management
  isRefreshing: boolean;
  refreshPromise: Promise<boolean> | null;

  // Actions
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  setAuthData: (authPayload: CustomerAuthPayload) => void;
  clearAuth: () => void;
  initAuth: () => Promise<void>;

  // Cross-tab sync
  _initCrossTabSync: () => void;
}

// Token refresh manager with mutex to prevent concurrent refreshes
class TokenRefreshManager {
  private refreshPromise: Promise<boolean> | null = null;

  async refresh(refreshToken: string): Promise<boolean> {
    // Return existing promise if refresh in progress
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create new refresh promise
    this.refreshPromise = this._doRefresh(refreshToken).finally(() => {
      // Clear promise after completion (success or failure)
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async _doRefresh(refreshToken: string): Promise<boolean> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: CUSTOMER_REFRESH_TOKEN,
        variables: { refreshToken },
      });

      if (data?.customerRefreshToken) {
        useAuthStore.getState().setAuthData(data.customerRefreshToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }
}

const refreshManager = new TokenRefreshManager();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      isInitializing: true,
      user: null,
      customer: null,
      permissions: [],
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      isRefreshing: false,
      refreshPromise: null,

      // Login action
      login: async (email: string, password: string, mfaCode?: string) => {
        try {
          const { data } = await apolloClient.mutate({
            mutation: CUSTOMER_LOGIN,
            variables: { email, password, mfaCode },
          });

          if (data?.customerLogin) {
            get().setAuthData(data.customerLogin);
          } else {
            throw new Error('Login failed: No data returned');
          }
        } catch (error: any) {
          console.error('Login error:', error);
          throw error;
        }
      },

      // Register action
      register: async (data: RegisterData) => {
        try {
          const { data: result } = await apolloClient.mutate({
            mutation: CUSTOMER_REGISTER,
            variables: data,
          });

          if (result?.customerRegister) {
            get().setAuthData(result.customerRegister);
          } else {
            throw new Error('Registration failed: No data returned');
          }
        } catch (error: any) {
          console.error('Registration error:', error);
          throw error;
        }
      },

      // Logout action
      logout: async () => {
        try {
          // Call backend logout to revoke refresh token
          await apolloClient.mutate({
            mutation: CUSTOMER_LOGOUT,
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear auth state regardless of backend response
          get().clearAuth();
        }
      },

      // Refresh access token
      refreshAccessToken: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          get().clearAuth();
          return false;
        }

        // Use refresh manager to prevent concurrent refreshes
        set({ isRefreshing: true });
        const success = await refreshManager.refresh(refreshToken);
        set({ isRefreshing: false });

        if (!success) {
          get().clearAuth();
        }

        return success;
      },

      // Set authentication data from payload
      setAuthData: (authPayload: CustomerAuthPayload) => {
        const expiresAt = new Date(authPayload.expiresAt);

        set({
          isAuthenticated: true,
          isInitializing: false,
          user: authPayload.user,
          customer: authPayload.customer,
          permissions: authPayload.permissions,
          accessToken: authPayload.accessToken,
          refreshToken: authPayload.refreshToken,
          tokenExpiresAt: expiresAt,
        });
      },

      // Clear all authentication data
      clearAuth: () => {
        set({
          isAuthenticated: false,
          isInitializing: false,
          user: null,
          customer: null,
          permissions: [],
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isRefreshing: false,
          refreshPromise: null,
        });
      },

      // Initialize authentication on app startup
      initAuth: async () => {
        const { refreshToken } = get();

        if (refreshToken) {
          // Attempt to refresh token on app initialization
          const success = await get().refreshAccessToken();

          if (!success) {
            set({ isInitializing: false });
          }
        } else {
          set({ isInitializing: false });
        }
      },

      // Initialize cross-tab synchronization
      _initCrossTabSync: () => {
        // Listen for storage events from other tabs
        window.addEventListener('storage', (e) => {
          if (e.key === 'auth-storage') {
            if (e.newValue === null) {
              // Another tab logged out, clear local state
              get().clearAuth();
            } else if (e.newValue) {
              try {
                // Another tab updated auth, sync state
                const newState = JSON.parse(e.newValue);
                const { state } = newState;

                if (state?.refreshToken) {
                  // Only sync refresh token, not access token
                  set({
                    refreshToken: state.refreshToken,
                  });
                } else {
                  // No refresh token, clear auth
                  get().clearAuth();
                }
              } catch (error) {
                console.error('Error syncing auth state:', error);
              }
            }
          }
        });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist refreshToken (not accessToken for security)
      partialize: (state) => ({
        refreshToken: state.refreshToken,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Initialize cross-tab sync on store creation
useAuthStore.getState()._initCrossTabSync();

// Setup global accessors for Apollo Client (to avoid circular dependency)
if (typeof window !== 'undefined') {
  (window as any).__getAccessToken = () => useAuthStore.getState().accessToken;
  (window as any).__refreshAccessToken = () => useAuthStore.getState().refreshAccessToken();
}

// Auto-refresh token before expiration
// Check every minute if token needs refresh (5 min buffer)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const { tokenExpiresAt, refreshAccessToken, isAuthenticated } = useAuthStore.getState();

    if (isAuthenticated && tokenExpiresAt) {
      const timeUntilExpiry = tokenExpiresAt.getTime() - Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      // Refresh if less than 5 minutes until expiration
      if (timeUntilExpiry <= fiveMinutes && timeUntilExpiry > 0) {
        refreshAccessToken();
      }
    }
  }, 60000); // Check every minute
}
