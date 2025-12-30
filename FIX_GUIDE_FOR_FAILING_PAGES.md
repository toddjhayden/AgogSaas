# Fix Guide for 6 Failing Frontend Pages

**Created by:** Billy (QA Engineer)
**Date:** 2024-12-24
**Priority:** P0/P1 - Required before production

---

## Quick Fix Checklist

- [ ] **Step 1:** Restart Vite dev server (fixes 2 pages immediately)
- [ ] **Step 2:** Add GraphQL schema definitions (fixes 4 pages)
- [ ] **Step 3:** Fix MUI Tooltip warning (cosmetic fix)
- [ ] **Step 4:** Re-run tests to verify 16/16 pass

**Estimated Time:** 1-2 hours total

---

## Step 1: Fix Browser Cache Issue (P0 - CRITICAL)

### Problem
Browser is serving OLD JavaScript without useState import, even though source code is correct.

### Pages Affected
- ❌ Bin Health Dashboard (`/wms/health`)
- ❌ Bin Utilization Dashboard (`/wms/bin-utilization`)

### Fix (DevOps/Miki/Berry)

```bash
# Option A: Restart Vite dev server (RECOMMENDED)
cd D:\GitHub\agogsaas\Implementation\print-industry-erp\frontend

# Kill the existing process (Ctrl+C if running, or kill PID)
# Then restart:
npm run dev

# Wait for "Local: http://localhost:3000" message
```

```bash
# Option B: Hard refresh browser (less reliable)
# In browser: Ctrl + Shift + R (Windows/Linux)
# In browser: Cmd + Shift + R (Mac)
```

### Verification
```bash
# Test the critical page
cd D:\GitHub\agogsaas
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3000/wms/health', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log(errors.length === 0 ? '✅ PASS' : '❌ FAIL: ' + errors[0]);
  await browser.close();
})();
"
```

**Expected Result:** ✅ PASS (no useState errors)

---

## Step 2: Add Missing GraphQL Schema Definitions (P1 - HIGH)

### Problem
Backend resolvers exist, but GraphQL schema files don't define the queries.
Frontend queries return 400 Bad Request.

### Pages Affected
- ❌ Purchase Orders (`/procurement/purchase-orders`)
- ❌ Create Purchase Order (`/procurement/purchase-orders/new`)
- ❌ Bin Data Quality (`/wms/data-quality`)
- ❌ Orchestrator Dashboard (`/orchestrator`)

### Investigation Results
```
Resolvers EXIST in code:
✅ src/graphql/resolvers/sales-materials.resolver.ts
   - getPurchaseOrders()
   - getPurchaseOrder()
   - getPurchaseOrderByNumber()
   - getVendors()
   - getMaterials()

Schema definitions MISSING:
❌ src/graphql/schema/sales-materials.graphql
   - No queries defined!
```

### Fix (Backend/Roy)

#### 2.1: Purchase Order Queries

**File:** `Implementation/print-industry-erp/backend/src/graphql/schema/sales-materials.graphql`

**Add to the Query type:**
```graphql
extend type Query {
  # Purchase Orders
  getPurchaseOrders(tenantId: ID!): [PurchaseOrder!]!
  getPurchaseOrder(id: ID!): PurchaseOrder
  getPurchaseOrderByNumber(poNumber: String!): PurchaseOrder

  # Vendors
  getVendors(tenantId: ID!): [Vendor!]!
  getVendor(id: ID!): Vendor

  # Materials
  getMaterials(tenantId: ID!): [Material!]!
  getMaterial(id: ID!): Material
}
```

**Verify types are defined:**
```graphql
# Make sure these types exist in the same file or are imported
type PurchaseOrder {
  id: ID!
  poNumber: String!
  tenantId: ID!
  vendorId: ID!
  status: String!
  orderDate: String!
  # ... other fields
}

type Vendor {
  id: ID!
  name: String!
  # ... other fields
}

type Material {
  id: ID!
  name: String!
  # ... other fields
}
```

#### 2.2: Verify Bin Optimization Queries

**File:** `Implementation/print-industry-erp/backend/src/graphql/schema/wms-optimization.graphql`

**Verify these exist:**
```graphql
extend type Query {
  getBinOptimizationHealth: BinOptimizationHealthCheck!
  # Should already be there - just verify
}
```

**File:** `Implementation/print-industry-erp/backend/src/graphql/schema/wms-data-quality.graphql`

**Verify these exist:**
```graphql
extend type Query {
  getBinOptimizationHealthEnhanced(
    tenantId: ID
    autoRemediate: Boolean
  ): HealthCheckResultEnhanced!

  getDataQualityMetrics(
    tenantId: ID!
    facilityId: ID
  ): DataQualityMetrics!

  getMaterialDimensionVerifications(
    tenantId: ID!
    limit: Int
  ): [MaterialDimensionVerification!]!

  getCapacityValidationFailures(
    tenantId: ID!
    limit: Int
  ): [CapacityValidationFailure!]!

  getCrossDockCancellations(
    tenantId: ID!
    limit: Int
  ): [CrossDockCancellation!]!
}
```

#### 2.3: Check Orchestrator Schema

**File:** `Implementation/print-industry-erp/backend/src/graphql/schema/orchestrator.graphql` (or similar)

**Add orchestrator queries if missing:**
```graphql
extend type Query {
  getOrchestratorStatus: OrchestratorStatus!
  getActiveWorkflows: [Workflow!]!
  getWorkflowHistory(limit: Int): [WorkflowExecution!]!
}

type OrchestratorStatus {
  running: Boolean!
  activeCount: Int!
  queuedCount: Int!
  # ... other fields
}
```

### Verification

```bash
# Start GraphQL playground
# Navigate to: http://localhost:4000/graphql

# Test purchase order query:
query TestPurchaseOrders {
  getPurchaseOrders(tenantId: "test-tenant") {
    id
    poNumber
    status
  }
}

# Should return data or empty array, NOT 400 error
```

```bash
# Or test via curl:
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { getPurchaseOrders(tenantId: \"test\") { id poNumber } }"
  }'

# Should return JSON, not 400 error
```

---

## Step 3: Fix Material-UI Tooltip Warning (P2 - MEDIUM)

### Problem
Console warning when disabled button is direct child of Tooltip.

### Page Affected
- ⚠️ Orchestrator Dashboard (`/orchestrator`)

### Error Message
```
MUI: You are providing a disabled `button` child to the Tooltip component.
A disabled element does not fire events.
Add a simple wrapper element, such as a `span`.
```

### Fix (Frontend/Jen)

**Find patterns like this:**
```tsx
<Tooltip title="Action disabled">
  <Button disabled>Click Me</Button>
</Tooltip>
```

**Replace with:**
```tsx
<Tooltip title="Action disabled">
  <span>
    <Button disabled>Click Me</Button>
  </span>
</Tooltip>
```

**Search for occurrences:**
```bash
cd Implementation/print-industry-erp/frontend
grep -r "disabled.*Button" src/pages/OrchestratorDashboard.tsx
```

---

## Step 4: Re-Run Full Test Suite

### After All Fixes Applied

```bash
# Clean run
cd D:\GitHub\agogsaas
node test-all-frontend-pages.js

# Expected output:
# ═══════════════════════════════════════════════
# 📊 TEST SUMMARY
# ═══════════════════════════════════════════════
# Total Pages Tested: 16
# ✅ Passed: 16
# ❌ Failed: 0
# 📈 Success Rate: 100.0%
# ═══════════════════════════════════════════════
```

### If Any Tests Still Fail

```bash
# Check detailed results
node -e "
const r = require('./test-results.json');
r.tests.filter(t => t.status === 'FAIL').forEach(t => {
  console.log('❌', t.name, '(' + t.path + ')');
  console.log('   Errors:', t.errors);
  console.log('   Console:', t.consoleErrors.slice(0, 2));
  console.log('');
});
"
```

---

## Additional Recommendations

### Add Pre-Commit Hook (Future)

**File:** `.husky/pre-commit` or similar

```bash
#!/bin/sh
# Validate GraphQL schema matches resolvers

echo "🔍 Validating GraphQL schema..."

# Check for resolver methods without schema definitions
cd Implementation/print-industry-erp/backend
npm run validate:graphql

# Check for schema definitions without resolvers
npm run validate:resolvers

echo "✅ GraphQL validation passed"
```

### Add Integration Tests

**File:** `Implementation/print-industry-erp/backend/tests/graphql-integration.test.ts`

```typescript
describe('GraphQL Schema Integration', () => {
  it('should have schema definition for every resolver', async () => {
    // Parse resolvers from code
    // Parse schema from .graphql files
    // Compare and report mismatches
  });

  it('should return 200 for all known queries', async () => {
    const queries = [
      'getPurchaseOrders',
      'getBinOptimizationHealth',
      // ... etc
    ];

    for (const query of queries) {
      const result = await testQuery(query);
      expect(result.status).toBe(200);
    }
  });
});
```

---

## Troubleshooting

### "Tests still failing after restart"

1. **Check if servers are actually restarted:**
   ```bash
   # Check frontend
   curl http://localhost:3000

   # Check backend
   curl http://localhost:4000/graphql
   ```

2. **Check browser cache:**
   ```bash
   # Kill all browser instances
   taskkill /F /IM chrome.exe /T  # Windows
   # OR
   killall chrome  # Linux/Mac

   # Re-run tests (Playwright will launch fresh instance)
   ```

3. **Check Vite is using latest code:**
   ```bash
   cd Implementation/print-industry-erp/frontend

   # Clear Vite cache
   rm -rf node_modules/.vite

   # Rebuild
   npm run build

   # Restart dev server
   npm run dev
   ```

### "GraphQL queries still return 400"

1. **Check schema is loaded:**
   ```bash
   cd Implementation/print-industry-erp/backend

   # Restart backend
   npm run dev

   # Check startup logs for schema loading
   # Should see: "GraphQL schema loaded successfully"
   ```

2. **Verify in GraphQL Playground:**
   - Navigate to http://localhost:4000/graphql
   - Click "Docs" or "Schema" tab
   - Search for query name (e.g., `getPurchaseOrders`)
   - If not found: schema file not loaded or syntax error

3. **Check for TypeScript errors in schema:**
   ```bash
   cd Implementation/print-industry-erp/backend
   npm run build

   # Look for errors in schema files
   ```

### "MUI warning still appears"

1. **Search for all Tooltip occurrences:**
   ```bash
   grep -r "Tooltip" src/pages/OrchestratorDashboard.tsx
   ```

2. **Check button state logic:**
   ```tsx
   // Make sure disabled prop is actually set
   <Button disabled={someCondition}>

   // Not:
   <Button disabled={false}>  // Always enabled
   ```

---

## Success Criteria

- ✅ All 16 frontend pages load without errors
- ✅ No `ReferenceError` or `TypeError` in console
- ✅ All GraphQL queries return 200 (or graceful error)
- ✅ No critical Material-UI warnings
- ✅ Average load time < 1000ms per page
- ✅ Test suite shows: **16/16 PASS (100%)**

---

## Timeline

| Step | Owner | Time Estimate | Blocker? |
|------|-------|---------------|----------|
| 1. Restart dev server | DevOps | 5 minutes | No |
| 2. Add GraphQL schemas | Backend (Roy) | 30-60 minutes | No |
| 3. Fix MUI warning | Frontend (Jen) | 15 minutes | No |
| 4. Re-run tests | QA (Billy) | 5 minutes | Yes (waits for 1-3) |

**Total Estimated Time:** 1-2 hours
**Blocking Time:** ~5 minutes (server restart)

---

## Questions?

**Ask Billy (QA):**
- Test execution issues
- How to interpret test results
- Re-running specific tests

**Ask Roy (Backend):**
- GraphQL schema syntax
- Resolver implementation
- Backend API questions

**Ask Jen (Frontend):**
- React component issues
- Material-UI questions
- Frontend build issues

**Ask Miki/Berry (DevOps):**
- Server restart procedures
- Environment configuration
- Cache management

---

**Let's get to 100% test pass rate! 🚀**

---

**Billy, QA Engineer**
*Last Updated: 2024-12-24*
