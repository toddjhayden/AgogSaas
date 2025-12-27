/**
 * UNIT TESTS: Tenant Validation Utilities
 *
 * Purpose: Test multi-tenant security validation functions
 * Feature: REQ-STRATEGIC-AUTO-1766657618088 - Vendor Scorecards
 * Author: Roy (Backend specialist)
 * Date: 2025-12-25
 *
 * Coverage:
 * - validateTenantAccess() - Ensures users can only access their tenant's data
 * - getTenantIdFromContext() - Extracts tenant ID from JWT context
 * - getUserIdFromContext() - Extracts user ID from JWT context
 *
 * Security Test Scenarios:
 * - ✅ Valid access: User accessing their own tenant's data
 * - ❌ Invalid access: User attempting to access another tenant's data
 * - ❌ Unauthenticated: No user in context
 * - ❌ Missing tenant: User authenticated but no tenant info
 */

import {
  validateTenantAccess,
  getTenantIdFromContext,
  getUserIdFromContext,
} from '../tenant-validation';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('Tenant Validation Utilities', () => {
  describe('validateTenantAccess', () => {
    it('should pass when user accesses their own tenant data', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            tenantId: 'tenant-abc',
          },
        },
      };

      // Should not throw
      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).not.toThrow();
    });

    it('should pass when user accesses their own tenant data (using tenant_id)', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            tenant_id: 'tenant-abc', // snake_case variant
          },
        },
      };

      // Should not throw
      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).not.toThrow();
    });

    it('should throw ForbiddenException when user attempts to access another tenant', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            tenantId: 'tenant-abc',
          },
        },
      };

      expect(() => {
        validateTenantAccess(context, 'tenant-xyz');
      }).toThrow(ForbiddenException);

      expect(() => {
        validateTenantAccess(context, 'tenant-xyz');
      }).toThrow('Access denied. You do not have permission to access data for tenant tenant-xyz');
    });

    it('should throw UnauthorizedException when user is not authenticated', () => {
      const context = {
        req: {
          // No user object
        },
      };

      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).toThrow(UnauthorizedException);

      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).toThrow('User must be authenticated to access this resource');
    });

    it('should throw UnauthorizedException when context is null', () => {
      const context = null;

      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when context.req is null', () => {
      const context = {
        req: null,
      };

      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no tenant information', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            // No tenantId or tenant_id
          },
        },
      };

      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).toThrow(UnauthorizedException);

      expect(() => {
        validateTenantAccess(context, 'tenant-abc');
      }).toThrow('User tenant information is missing. Please re-authenticate.');
    });
  });

  describe('getTenantIdFromContext', () => {
    it('should extract tenantId from context (camelCase)', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            tenantId: 'tenant-abc',
          },
        },
      };

      const tenantId = getTenantIdFromContext(context);
      expect(tenantId).toBe('tenant-abc');
    });

    it('should extract tenant_id from context (snake_case)', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            tenant_id: 'tenant-xyz',
          },
        },
      };

      const tenantId = getTenantIdFromContext(context);
      expect(tenantId).toBe('tenant-xyz');
    });

    it('should prefer tenantId over tenant_id if both exist', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            tenantId: 'tenant-camel',
            tenant_id: 'tenant-snake',
          },
        },
      };

      const tenantId = getTenantIdFromContext(context);
      expect(tenantId).toBe('tenant-camel');
    });

    it('should throw UnauthorizedException when user is not authenticated', () => {
      const context = {
        req: {},
      };

      expect(() => {
        getTenantIdFromContext(context);
      }).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when tenant information is missing', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
          },
        },
      };

      expect(() => {
        getTenantIdFromContext(context);
      }).toThrow(UnauthorizedException);

      expect(() => {
        getTenantIdFromContext(context);
      }).toThrow('User tenant information is missing. Please re-authenticate.');
    });
  });

  describe('getUserIdFromContext', () => {
    it('should extract user ID from context', () => {
      const context = {
        req: {
          user: {
            id: 'user-123',
            tenantId: 'tenant-abc',
          },
        },
      };

      const userId = getUserIdFromContext(context);
      expect(userId).toBe('user-123');
    });

    it('should throw UnauthorizedException when user is not authenticated', () => {
      const context = {
        req: {},
      };

      expect(() => {
        getUserIdFromContext(context);
      }).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user ID is missing', () => {
      const context = {
        req: {
          user: {
            tenantId: 'tenant-abc',
            // No id field
          },
        },
      };

      expect(() => {
        getUserIdFromContext(context);
      }).toThrow(UnauthorizedException);

      expect(() => {
        getUserIdFromContext(context);
      }).toThrow('User information is missing. Please re-authenticate.');
    });
  });
});
