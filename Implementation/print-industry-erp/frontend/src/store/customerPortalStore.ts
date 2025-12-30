import { create } from 'zustand';
import { CustomerUser } from '../graphql/types/customerPortal';

interface CustomerPortalState {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: CustomerUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  initializeAuth: () => void;
}

export const useCustomerPortalStore = create<CustomerPortalState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user, isLoading: false });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  logout: () => {
    localStorage.removeItem('customerAccessToken');
    localStorage.removeItem('customerRefreshToken');
    localStorage.removeItem('customerTokenExpiresAt');
    set({ user: null, isAuthenticated: false });
  },

  initializeAuth: () => {
    const token = localStorage.getItem('customerAccessToken');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
    // If token exists, the user state will be set after fetching customerMe query
  },
}));
