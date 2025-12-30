# Apply Security to All GraphQL Resolvers

**REQ-STRATEGIC-AUTO-1767066329944: GraphQL Authorization & Tenant Isolation**

## Instructions for Marcus (Backend Developer)

Apply the following security configuration to ALL GraphQL resolvers:

### 1. Add Imports

```typescript
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
```

### 2. Apply Decorators to Resolver Class

```typescript
@Resolver('YourResolverName')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
export class YourResolver {
  // ... resolver implementation
}
```

### 3. Add Role-Based Authorization to Mutations

For mutations that modify data, add appropriate role restrictions:

```typescript
// Admin-only operations (create/update configuration)
@Mutation('createTenant')
@Roles(UserRole.SUPER_ADMIN)
async createTenant() { ... }

// Manager/Admin operations (approve workflows)
@Mutation('approveOrder')
@Roles(UserRole.MANAGER, UserRole.ADMIN)
async approveOrder() { ... }

// Operator operations (day-to-day work)
@Mutation('createProductionRun')
@Roles(UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN)
async createProductionRun() { ... }

// Queries - usually no role restriction (authenticated users only)
@Query('workCenters')
async getWorkCenters() { ... }
```

## Resolvers to Update

- [x] operations.resolver.ts (DONE - Example)
- [ ] tenant.resolver.ts
- [ ] wms.resolver.ts
- [ ] sales-materials.resolver.ts
- [ ] forecasting.resolver.ts
- [ ] vendor-performance.resolver.ts
- [ ] finance.resolver.ts
- [ ] quote-automation.resolver.ts
- [ ] po-approval-workflow.resolver.ts
- [ ] quality-hr-iot-security-marketplace-imposition.resolver.ts
- [ ] wms-optimization.resolver.ts
- [ ] wms-data-quality.resolver.ts
- [ ] performance.resolver.ts
- [ ] spc.resolver.ts
- [ ] estimating.resolver.ts
- [ ] job-costing.resolver.ts
- [ ] test-data.resolver.ts
- [ ] health.resolver.ts
- [ ] monitoring.resolver.ts
- [ ] analytics.resolver.ts
- [ ] customer-portal.resolver.ts (uses CustomerAuthGuard - keep as is)
- [ ] imposition.resolver.ts
- [ ] smoke-test.resolver.ts

## Role Guidelines

- **SUPER_ADMIN**: Platform operations (multi-tenant management)
- **ADMIN**: Tenant administration (user management, settings)
- **MANAGER**: Department operations (approvals, reports)
- **OPERATOR**: Day-to-day operations (create orders, record production)
- **VIEWER**: Read-only access

## Testing After Implementation

```bash
# Test unauthenticated access (should return 401)
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ workCenters { id } }"}'

# Test with valid JWT (should succeed)
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query": "{ workCenters { id } }"}'

# Test cross-tenant access (should return 403)
# Use tenant A's token to access tenant B's data
```

## Priority Order

1. **P0 (Week 1)**: Core resolvers
   - tenant.resolver.ts
   - finance.resolver.ts
   - sales-materials.resolver.ts

2. **P1 (Week 2)**: Business critical
   - wms.resolver.ts
   - forecasting.resolver.ts
   - operations.resolver.ts (DONE)
   - po-approval-workflow.resolver.ts

3. **P2 (Week 3)**: Remaining resolvers
   - All other resolvers

## Notes

- customer-portal.resolver.ts already uses CustomerAuthGuard - do NOT change
- health.resolver.ts and smoke-test.resolver.ts may need public access for monitoring
- test-data.resolver.ts should be removed in production or heavily restricted
