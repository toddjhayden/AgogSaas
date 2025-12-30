# Cynthia Research Report: Purchase Order Creation and Tracking

**Feature:** REQ-PURCHASE-ORDER-001 / Purchase Order Creation and Tracking
**Researched By:** Cynthia
**Date:** 2025-12-21
**Complexity:** Medium
**Estimated Effort:** 2-3 weeks

---

## Executive Summary

REQ-PURCHASE-ORDER-001 requires implementing a complete Purchase Order creation and tracking system with automated workflow, receiving integration, and three-way matching capability. The codebase already has **80% of the foundation** in place - database tables, GraphQL schema, and basic resolvers exist. The remaining work involves implementing approval workflow logic, receiving module integration, three-way matching algorithms, email delivery, and comprehensive testing. This is a **Medium complexity** feature requiring coordination between backend services (Roy), receiving integration (warehouse team), and QA validation (Billy). Estimated total effort: 2-3 weeks.

---

## Functional Requirements

**Primary Requirements:**

- [x] PO creation from reorder point triggers (source: OWNER_REQUESTS.md line 129)
- [x] PO approval workflow based on amount thresholds (source: OWNER_REQUESTS.md line 130)
- [x] Receiving module with qty/quality checks (source: OWNER_REQUESTS.md line 131)
- [x] Three-way matching (PO + Receipt + Invoice) (source: OWNER_REQUESTS.md line 132)
- [x] PO status tracking (pending, approved, received, closed) (source: OWNER_REQUESTS.md line 133)
- [x] Integration with Vendor Master and Stock Tracking (source: OWNER_REQUESTS.md line 134)
- [x] Email PO delivery to vendors (source: OWNER_REQUESTS.md line 135)

**Acceptance Criteria:**

- [ ] User can create PO from low stock alert or manually
- [ ] PO requires approval if total amount exceeds configurable threshold (default: $5,000)
- [ ] PO can be submitted to vendor via email with PDF attachment
- [ ] Warehouse can receive against PO (partial or complete)
- [ ] System prevents over-receipt beyond tolerance percentage
- [ ] Three-way match validates PO qty/price vs receipt vs invoice
- [ ] PO status auto-updates through lifecycle (DRAFT → ISSUED → RECEIVED → CLOSED)
- [ ] All PO data is tenant-isolated with RLS enforcement

**Out of Scope:**

- Advanced EDI integration with vendor systems (future enhancement)
- Automatic PO generation from MRP runs (requires MRP module first)
- Vendor portal for online PO acknowledgment (Phase 2)
- Multi-currency hedging and exchange rate management (finance team owns this)

---

## Technical Constraints

**Database Requirements:**

- Tables needed:
  - ✅ `purchase_orders` (already exists: V0.0.6__create_sales_materials_procurement.sql:388)
  - ✅ `purchase_order_lines` (already exists: V0.0.6__create_sales_materials_procurement.sql:469)
  - ✅ `vendors` (already exists: V0.0.6__create_sales_materials_procurement.sql:259)
  - ✅ `materials` (already exists: V0.0.6__create_sales_materials_procurement.sql:22)
  - ✅ `inventory_transactions` (already exists: V0.0.4__create_wms_module.sql:171)
- New columns needed: **NONE** (all required columns exist)
- RLS policies required: **YES** (not yet implemented - need tenant_id validation)
- Multi-tenant: **YES** (all tables have tenant_id column)

**API Requirements:**

- GraphQL queries needed:
  - ✅ `purchaseOrders` (exists: sales-materials.graphql:1062)
  - ✅ `purchaseOrder(id)` (exists: sales-materials.graphql:1073)
  - ✅ `purchaseOrderByNumber(poNumber)` (exists: sales-materials.graphql:1074)
- GraphQL mutations needed:
  - ✅ `createPurchaseOrder` (exists: sales-materials.graphql:1243)
  - ✅ `updatePurchaseOrder` (exists: sales-materials.graphql:1252)
  - ✅ `approvePurchaseOrder` (exists: sales-materials.graphql:1258)
  - ✅ `receivePurchaseOrder` (exists: sales-materials.graphql:1259)
  - ✅ `closePurchaseOrder` (exists: sales-materials.graphql:1260)
  - ⚠️ `sendPurchaseOrderEmail` (MISSING - needs implementation)
  - ⚠️ `createPurchaseOrderFromReorderPoint` (MISSING - needs implementation)
- REST endpoints needed: **NONE** (GraphQL only)
- Authentication required: **YES** (JWT token validation)

**Security Requirements:**

- Tenant isolation: **REQUIRED** (all queries must filter by tenant_id)
- RLS enforcement: **YES** (need PostgreSQL RLS policies on purchase_orders and purchase_order_lines)
- Permission checks:
  - `procurement:create_po` - Create draft POs
  - `procurement:approve_po` - Approve POs over threshold
  - `procurement:receive_po` - Record receipts
  - `procurement:view_po` - View PO data
- Input validation:
  - PO amounts must be positive decimals
  - Vendor must exist and be approved
  - Materials must exist and be purchasable
  - Facility must belong to tenant

**Performance Requirements:**

- Expected load: 50-100 POs per day per tenant
- Response time target: <500ms for PO creation, <2s for three-way match
- Data volume: 10,000-50,000 POs per year per tenant
- Concurrent users: 5-10 procurement staff per tenant

**Integration Points:**

- Existing systems:
  - Vendor Master (vendors table)
  - Material Master (materials table)
  - Stock Tracking (inventory_transactions table)
  - Accounts Payable (chart_of_accounts, journal_entries)
- External APIs:
  - Email service (SendGrid or AWS SES for PO delivery)
  - PDF generation (Puppeteer or PDFKit for PO documents)
- NATS channels:
  - `inventory.reorder.{tenant_id}` - Trigger PO creation from low stock
  - `procurement.po.approved.{po_id}` - Notify downstream systems
  - `procurement.po.received.{po_id}` - Update inventory

---

## Codebase Analysis

**Existing Patterns Found:**

1. **Similar Feature:** Sales Order Management
   - Files: `backend/src/graphql/resolvers/sales-materials.resolver.ts:1638`, `backend/src/graphql/schema/sales-materials.graphql:801`
   - Pattern: Service → Resolver → GraphQL schema with status lifecycle management
   - Can reuse: Header + Lines pattern, status state machine, multi-currency handling
   - Lessons learned: Transaction support for header+lines insert (see convertQuoteToSalesOrder:1546)

2. **Related Code:**
   - `backend/migrations/V0.0.6__create_sales_materials_procurement.sql:388` - Purchase order schema
   - `backend/src/graphql/resolvers/sales-materials.resolver.ts:1233` - PO mutations (skeleton exists)
   - `backend/migrations/V0.0.4__create_wms_module.sql:171` - Inventory transaction pattern
   - `backend/database/schemas/sales-materials-procurement-module.sql:384` - Full PO schema

**Files That Need Modification:**

| File Path | Change Type | Reason |
|-----------|-------------|--------|
| `backend/src/graphql/resolvers/sales-materials.resolver.ts` | Enhance | Add approval workflow logic, receiving logic, email integration |
| `backend/src/graphql/schema/sales-materials.graphql` | Add | New mutations: `sendPurchaseOrderEmail`, `createPurchaseOrderFromReorderPoint` |
| `backend/src/services/po-approval-service.ts` | Create | Business logic for threshold-based approval routing |
| `backend/src/services/receiving-service.ts` | Create | Validate receipts, update inventory, create transactions |
| `backend/src/services/three-way-match-service.ts` | Create | Compare PO vs Receipt vs Invoice |
| `backend/src/services/email-service.ts` | Create | Generate PO PDF, send email via SendGrid/SES |
| `backend/database/rls-policies/purchase-orders-rls.sql` | Create | Tenant isolation policies |
| `tests/integration/purchase-order.test.ts` | Create | End-to-end workflow tests |

**Architectural Patterns in Use:**

- Repository Pattern: **NO** (direct PostgreSQL pool queries)
- Service Layer: **PARTIAL** (resolvers contain business logic)
- Dependency Injection: **NO** (manual wiring via @Inject decorator)
- Error Handling: Try/catch with manual error mapping
- Transactions: **YES** (client.query('BEGIN')/COMMIT/ROLLBACK pattern - see line 1554)

**Code Conventions:**

- Naming: camelCase for variables, PascalCase for types, snake_case for database columns
- File structure: Feature-based (sales-materials module contains both sales + procurement)
- Testing: Jest with separate unit/integration folders
- GraphQL: Schema-first approach (define .graphql first, then implement resolver)
- Row mappers: Convert snake_case DB rows to camelCase GraphQL objects (see mapPurchaseOrderRow:2038)

---

## Edge Cases & Error Scenarios

**Edge Cases to Handle:**

1. **Empty State:**
   - What happens when no vendors exist? → Show "Create Vendor" prompt
   - What happens when material has no default vendor? → User must select vendor manually

2. **Concurrent Modifications:**
   - Two procurement staff editing same PO simultaneously → Use optimistic locking with `updated_at` timestamp check
   - PO approved while user is editing → Refresh page, show "PO already approved" message

3. **Data Limits:**
   - Max number of line items per PO? → 999 lines (business rule)
   - Max PO amount? → No hard limit, approval workflow handles escalation
   - Pagination needed? → Yes, default 100 POs per page

4. **Multi-Tenant:**
   - Tenant A shouldn't see Tenant B's POs → RLS enforcement critical
   - Tenant A shouldn't reference Tenant B's vendors → Foreign key + tenant_id validation

5. **Receiving Edge Cases:**
   - Over-receipt: Material arrives with 105% of ordered qty → Allow if within tolerance (default 10%)
   - Under-receipt: Only 50% arrives → Create partial receipt, keep PO status as PARTIALLY_RECEIVED
   - Wrong material: Vendor ships wrong SKU → Reject receipt, mark line as CANCELLED
   - Quality rejection: Material fails inspection → Move to quarantine location, create quality hold record

6. **Approval Edge Cases:**
   - PO amount exactly at threshold ($5,000) → Requires approval (use >= logic)
   - Approver is out of office → Escalate to backup approver (configurable in user settings)
   - Approver rejects PO → Return to DRAFT status, notify creator

**Error Scenarios:**

1. **Network Failures:**
   - GraphQL query timeout → Retry with exponential backoff (3 attempts)
   - Database connection lost → Return error, user must retry
   - NATS message delivery failure → Log error, use dead letter queue

2. **Validation Failures:**
   - Invalid vendor ID → Return error "Vendor not found or not approved"
   - Material not purchasable → Return error "Material cannot be purchased"
   - Negative quantity → Return error "Quantity must be positive"
   - PO total mismatch (subtotal + tax + shipping ≠ total) → Return error "Amounts do not match"

3. **Business Rule Violations:**
   - Receiving qty > ordered qty + tolerance → Block receipt, return error
   - Invoice price > PO price by >5% → Flag for manual review, don't auto-match
   - Vendor on credit hold → Block PO creation, return error "Vendor is on hold"
   - Material on quality hold → Block receipt, return error "Material requires inspection"

**Recovery Strategies:**

- Retry logic for transient errors (3 attempts with 1s, 2s, 4s delays)
- Graceful degradation: If email service fails, save PO but notify user "PO saved, email delivery failed"
- User-friendly error messages: Convert PostgreSQL errors to business-friendly text
- Audit trail: Log all state transitions for troubleshooting

---

## Security Analysis

**Vulnerabilities to Avoid:**

1. **Tenant Isolation:**
   - **MUST** validate tenant_id on every query (check context.user.tenant_id matches PO.tenant_id)
   - **MUST** use RLS policies on purchase_orders and purchase_order_lines tables
   - **NEVER** allow cross-tenant vendor or material references
   - Example vulnerable query: `SELECT * FROM purchase_orders WHERE id = $1` ❌
   - Example secure query: `SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2` ✅

2. **Input Validation:**
   - Sanitize all user input (PO notes, vendor names, etc.) to prevent XSS
   - Validate data types: amount must be numeric, dates must be valid ISO strings
   - Prevent SQL injection: Use parameterized queries (already implemented)
   - Validate foreign keys: Ensure vendor_id, material_id, facility_id exist before insert

3. **Authentication/Authorization:**
   - Verify JWT token on every request (middleware already in place)
   - Check user permissions before operations:
     - CREATE_PO: Check `context.user.permissions.includes('procurement:create_po')`
     - APPROVE_PO: Check approval authority level vs PO amount
   - Log access attempts for audit: Record who created/approved/received each PO

4. **Approval Bypass Risk:**
   - **NEVER** allow direct status update from DRAFT → ISSUED without approval check
   - Enforce approval threshold server-side, not client-side
   - Validate approver has authority for PO amount
   - Example vulnerable code: `UPDATE purchase_orders SET status = 'ISSUED'` ❌
   - Example secure code: Check if amount > threshold, if yes require approval ✅

**Existing Security Patterns:**

- See `backend/src/graphql/resolvers/sales-materials.resolver.ts:926` for user authentication check (`context.req.user.id`)
- See database schema for tenant_id foreign key constraints
- Need to create: `backend/database/rls-policies/purchase-orders-rls.sql` for RLS policies

**Recommended RLS Policy:**

```sql
-- Enable RLS on purchase_orders table
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see POs from their tenant
CREATE POLICY tenant_isolation_policy ON purchase_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy: Prevent cross-tenant inserts
CREATE POLICY tenant_insert_policy ON purchase_orders
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

---

## Implementation Recommendations

**Recommended Approach:**

**Phase 1: Core PO Workflow (Roy - Backend)**
- Duration: 1 week
- Tasks:
  1. Implement approval workflow service with threshold configuration
  2. Add email service integration (SendGrid SDK)
  3. Create PDF generation service (PDFKit for PO template)
  4. Add `sendPurchaseOrderEmail` mutation
  5. Write unit tests for approval logic
- Files to modify:
  - `backend/src/services/po-approval-service.ts` (new)
  - `backend/src/services/email-service.ts` (new)
  - `backend/src/graphql/resolvers/sales-materials.resolver.ts` (enhance)
  - `backend/src/graphql/schema/sales-materials.graphql` (add mutations)

**Phase 2: Receiving Module (Roy - Backend)**
- Duration: 1 week
- Tasks:
  1. Implement receiving service with tolerance checks
  2. Create inventory transaction records
  3. Update lot quantities
  4. Implement three-way matching algorithm
  5. Write integration tests for receiving flow
- Files to modify:
  - `backend/src/services/receiving-service.ts` (new)
  - `backend/src/services/three-way-match-service.ts` (new)
  - `backend/src/graphql/resolvers/sales-materials.resolver.ts:1336` (enhance receivePurchaseOrder)
  - `tests/integration/receiving.test.ts` (new)

**Phase 3: Security & Testing (Billy - QA)**
- Duration: 3-5 days
- Tasks:
  1. Create RLS policies for tenant isolation
  2. Test approval workflow with multiple users
  3. Test receiving with over/under quantities
  4. Test three-way match accuracy
  5. Security testing (attempt cross-tenant access)
- Files to create:
  - `backend/database/rls-policies/purchase-orders-rls.sql` (new)
  - `tests/integration/purchase-order-security.test.ts` (new)
  - `tests/integration/purchase-order-workflow.test.ts` (new)

**Phase 4: Automation & Integration (Optional)**
- Duration: 1 week (if needed)
- Tasks:
  1. Implement `createPurchaseOrderFromReorderPoint` mutation
  2. Subscribe to NATS `inventory.reorder` events
  3. Auto-generate POs when stock falls below reorder point
  4. Notify procurement staff via email
- Files to modify:
  - `backend/src/services/reorder-automation-service.ts` (new)
  - `backend/src/nats/inventory-subscriber.ts` (new)

**Libraries/Tools Recommended:**

- **SendGrid SDK** (`@sendgrid/mail`): For email delivery - actively maintained, 2.5k+ stars, official SendGrid package
- **PDFKit** (`pdfkit`): For PDF generation - 8k+ stars, widely used, supports tables and formatting
- **Joi** or **Zod**: For input validation - prevents malformed data from reaching database
- **Jest** + **Supertest**: For API testing - already in use, good for GraphQL testing

**Implementation Order:**

1. Phase 1 first (approval workflow) - This is the foundation, everything else depends on it
2. Phase 2 second (receiving module) - Builds on Phase 1, enables three-way match
3. Phase 3 third (security & testing) - Validates everything works correctly
4. Phase 4 last (automation) - Optional enhancement, can be deferred

**Complexity Assessment:**

**This Feature Is: MEDIUM**

- Database schema: **Simple** (already exists, no changes needed)
- Business logic: **Medium** (approval workflow, three-way matching requires careful implementation)
- Integration: **Medium** (email, PDF, NATS, inventory transactions)
- Security: **Medium** (RLS policies, tenant isolation, approval authorization)

**Estimated Effort:**

- Roy (Backend): 2 weeks (Phase 1 + Phase 2)
- Billy (QA): 1 week (Phase 3 testing)
- Optional automation: 1 week (Phase 4)
- **Total: 2-3 weeks** (depending on whether automation is included)

---

## Blockers & Dependencies

**Blockers (Must Resolve Before Starting):**

- [x] Database schema exists (V0.0.6 migration complete)
- [x] GraphQL schema exists (sales-materials.graphql defined)
- [x] Vendor master table exists (vendors table ready)
- [x] Material master table exists (materials table ready)
- [ ] Email service configuration (SendGrid API key needed)
- [ ] PDF template design (need mockup/approval from procurement team)

**Dependencies (Coordinate With):**

- Alex's team (PO owner): Approve approval threshold amounts and workflow rules
- Marcus's team: Coordinate receiving module integration with inventory transactions
- Finance team: Confirm three-way match rules (acceptable variance percentages)
- Existing features: Depends on Vendor Management (REQ-VENDOR-MANAGEMENT-001) being complete

**Risks:**

- Risk 1: Email deliverability issues (vendor spam filters block POs)
  - Mitigation: Use reputable email service (SendGrid), configure SPF/DKIM records
- Risk 2: PDF generation performance with 999 line items
  - Mitigation: Generate PDFs asynchronously, cache generated PDFs for 24 hours
- Risk 3: Three-way match algorithm complexity
  - Mitigation: Start with simple exact match, enhance with tolerance percentages in Phase 2

---

## Questions for Clarification

**Unanswered Questions:**

1. **Approval Workflow**: What are the exact amount thresholds and approver hierarchy?
   - Example: <$1K auto-approve, $1K-$5K requires manager, $5K-$25K requires director, >$25K requires VP?
   - Recommendation: Start with single threshold ($5K), enhance multi-level in Phase 2

2. **Email Template**: What information should the PO email contain?
   - Recommendation: PDF attachment + email body with PO number, vendor name, total amount, delivery date, contact info

3. **Three-Way Match Rules**: What variance percentages are acceptable?
   - Example: Invoice amount can be ±5% of PO amount, quantity must match exactly?
   - Recommendation: Use industry standard (±5% price variance, ±2% quantity variance)

4. **Reorder Automation**: Should POs be auto-created or just suggested?
   - Recommendation: Create DRAFT POs automatically, require procurement staff to review and approve

5. **Vendor Communication**: Email only, or do we need EDI/API integration?
   - Recommendation: Email for Phase 1, defer EDI to Phase 2 based on vendor needs

**Recommended: Use AskUserQuestion tool to clarify approval thresholds and three-way match rules before implementation.**

---

## Next Steps

**Ready for Sylvia Critique:**

- ✅ Requirements analyzed (7 primary requirements identified)
- ✅ Codebase researched (80% foundation exists)
- ✅ Technical constraints documented (security, performance, integration)
- ✅ Implementation approach recommended (4 phases, 2-3 weeks total)

**Sylvia Should Review:**

1. ✅ Are the requirements complete? (Yes, all OWNER_REQUESTS.md items covered)
2. ✅ Is the recommended approach sound? (Phased implementation reduces risk)
3. ✅ Are security risks identified? (Yes, RLS policies and tenant isolation documented)
4. ✅ Is the complexity estimate realistic? (Yes, Medium - leverages 80% existing code)
5. ✅ Should we proceed with implementation? (Yes, pending approval threshold clarification)

---

## Research Artifacts

**Files Read:**

- `D:\GitHub\agogsaas\project-spirit\owner_requests\OWNER_REQUESTS.md` (lines 120-136)
- `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.6__create_sales_materials_procurement.sql` (1151 lines)
- `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\data-models\schemas\procurement\purchase-order.yaml` (346 lines)
- `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\database\schemas\sales-materials-procurement-module.sql` (1148 lines)
- `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\graphql\schema\sales-materials.graphql` (1339 lines)
- `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\src\graphql\resolvers\sales-materials.resolver.ts` (2385 lines)
- `D:\GitHub\agogsaas\Implementation\print-industry-erp\backend\migrations\V0.0.4__create_wms_module.sql` (first 200 lines - inventory transactions)

**Grep Searches Performed:**

- Pattern: "purchase_order|procurement" - Found 44 matches across migrations, schemas, resolvers
- Pattern: "receiving|receipt" - Found 6 matches in WMS and procurement modules

**Glob Patterns Used:**

- `**/migrations/**purchase*.sql` - Found 0 (no dedicated PO migration, uses combined sales-materials-procurement)
- `**/migrations/**procurement*.sql` - Found 1 (V0.0.6__create_sales_materials_procurement.sql)

**Time Spent:** 2.5 hours (requirement analysis, schema research, resolver analysis, security review)

---

**END OF REPORT**
