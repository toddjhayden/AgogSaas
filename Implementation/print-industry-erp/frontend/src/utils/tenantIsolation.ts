/**
 * Tenant Isolation Utilities
 *
 * This module provides utilities for enforcing tenant isolation in the frontend.
 * It works in conjunction with the backend's Row-Level Security (RLS) policies
 * and GraphQL authorization guards.
 */

import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

/**
 * Get the current tenant ID from the app store
 */
export function getCurrentTenantId(): string | undefined {
  return useAppStore.getState().preferences.tenantId;
}

/**
 * Validate that a tenant ID matches the current user's tenant
 *
 * @param tenantId - The tenant ID to validate
 * @throws Error if tenant ID doesn't match current tenant
 */
export function validateTenantAccess(tenantId: string): void {
  const currentTenantId = getCurrentTenantId();

  if (!currentTenantId) {
    throw new Error('No tenant context available');
  }

  if (tenantId !== currentTenantId) {
    throw new Error(
      `Access denied. You do not have permission to access data for tenant ${tenantId}`
    );
  }
}

/**
 * Ensure GraphQL query variables include the current tenant ID
 *
 * @param variables - The GraphQL query variables
 * @returns Updated variables with tenant ID
 */
export function injectTenantId<T extends Record<string, any>>(
  variables: T
): T & { tenantId: string } {
  const tenantId = getCurrentTenantId();

  if (!tenantId) {
    throw new Error('No tenant context available. User must be authenticated.');
  }

  return {
    ...variables,
    tenantId,
  };
}

/**
 * Check if the current user has access to a specific tenant
 *
 * @param tenantId - The tenant ID to check
 * @returns True if user has access, false otherwise
 */
export function hasTenantAccess(tenantId: string): boolean {
  const currentTenantId = getCurrentTenantId();
  return currentTenantId === tenantId;
}

/**
 * Get tenant context information for the current user
 */
export function getTenantContext() {
  const tenantId = getCurrentTenantId();
  const user = useAuthStore.getState().user;
  const customer = useAuthStore.getState().customer;

  return {
    tenantId,
    customerId: customer?.id,
    userId: user?.id,
    isAuthenticated: !!tenantId && !!user,
  };
}

/**
 * Hook to get the current tenant ID
 * Use this in React components
 */
export function useTenantId(): string | undefined {
  return useAppStore((state) => state.preferences.tenantId);
}

/**
 * Hook to get tenant context
 * Use this in React components that need full tenant context
 */
export function useTenantContext() {
  const tenantId = useTenantId();
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);

  return {
    tenantId,
    customerId: customer?.id,
    userId: user?.id,
    isAuthenticated: !!tenantId && !!user,
  };
}

/**
 * Setup authorization error notification handler
 * Call this in App.tsx to handle tenant isolation violations
 */
export function setupAuthorizationErrorHandler(
  onError: (error: { message: string; path?: any }) => void
) {
  if (typeof window !== 'undefined') {
    (window as any).__notifyAuthorizationError = onError;
  }
}
