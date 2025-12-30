# Research Deliverable: PO Approval Workflow
**REQ-STRATEGIC-AUTO-1735251169000**

**Prepared by:** Cynthia (Research Analyst)
**Date:** 2025-12-26
**Feature:** PO Approval Workflow Enhancement

---

## Executive Summary

This research deliverable provides a comprehensive analysis of the existing Purchase Order (PO) infrastructure and approval workflow capabilities within the print industry ERP system. The codebase contains a **solid foundation** for PO management with basic approval tracking, but lacks advanced workflow automation features such as multi-level approvals, role-based authorization, threshold-based routing, and audit trails.

**Key Findings:**
- ✅ Complete database schema with approval fields (requires_approval, approved_by_user_id, approved_at)
- ✅ Basic GraphQL mutations for PO approval (approvePurchaseOrder)
- ✅ Frontend components with approval UI (PurchaseOrderDetailPage)
- ✅ Multi-tenant security validation (validateTenantAccess)
- ✅ User role framework exists (roles JSONB field in users table)
- ❌ No approval threshold rules or workflow routing logic
- ❌ No multi-level approval chains
- ❌ No role-based approval authorization checks
- ❌ No approval delegation or escalation
- ❌ No approval audit trail or history logging
- ❌ No notification system for approvers

**Recommendation:** Implement a configurable approval workflow engine that leverages existing infrastructure while adding threshold-based routing, multi-level approvals, RBAC integration, and comprehensive audit logging.

---

## 1. Current State Analysis

### 1.1 Database Schema

**Location:** `print-industry-erp/backend/migrations/V0.0.6__create_sales_materials_procurement.sql`

#### Purchase Orders Table (Lines 391-457)

The `purchase_orders` table includes approval-related fields:

```sql
-- Approval fields
requires_approval BOOLEAN DEFAULT FALSE,
approved_by_user_id UUID,
approved_at TIMESTAMPTZ,

-- Status field (state machine)
status VARCHAR(20) DEFAULT 'DRAFT',
-- DRAFT, ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED

-- Foreign key constraint
CONSTRAINT fk_po_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
```

**Analysis:**
- Simple binary approval model (approved vs. not approved)
- Single approver tracking (approved_by_user_id)
- Timestamp tracking (approved_at)
- No support for multi-level approval chains
- No approval history or audit trail
- No approval comments or justification fields

**Strengths:**
- Proper foreign key constraint to users table
- Timestamp for audit purposes
- Clean separation of approval status from PO status

**Gaps:**
- No `approval_level` field for multi-tier workflows
- No `approval_threshold_rule_id` for automated routing
- No `approval_notes` or `rejection_reason` fields
- No separate approval history table

### 1.2 User Authentication & Authorization

**Location:** `print-industry-erp/backend/migrations/V0.0.2__create_core_multitenant.sql` (Lines 285-374)

#### Users Table with RBAC Support

```sql
-- Role-based access control
roles JSONB DEFAULT '[]'::JSONB,
-- ['ADMIN', 'CSR', 'PRODUCTION_MANAGER', 'WAREHOUSE_MANAGER', etc.]

permissions JSONB DEFAULT '[]'::JSONB,
-- Granular permissions if needed

-- Security clearance (for 5-tier security zones)
security_clearance_level VARCHAR(20),
-- STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT
```

**Analysis:**
- JSONB-based role storage allows flexible role assignment
- GIN index on roles for efficient querying (`idx_users_roles`)
- Security clearance levels for enhanced access control
- Supports multiple roles per user

**Example roles from schema comments:**
- ADMIN
- CSR (Customer Service Representative)
- PRODUCTION_MANAGER
- WAREHOUSE_MANAGER
- Plus custom roles can be added

**Strengths:**
- Flexible JSONB structure for roles
- Indexed for performance
- Multi-role support
- Security clearance framework

**Gaps for Approval Workflow:**
- No specific approval-related roles defined (e.g., PO_APPROVER, PURCHASING_MANAGER, CFO)
- No approval authority/limit mapping (e.g., "can approve POs up to $10,000")
- No delegation mechanism for temporary approval authority
- No approval group/hierarchy definitions

### 1.3 Multi-Tenant Security

**Location:** `print-industry-erp/backend/src/common/security/tenant-validation.ts`

#### Tenant Validation Utilities

```typescript
export function validateTenantAccess(context: any, requestedTenantId: string): void {
  // Check if user is authenticated
  if (!context?.req?.user) {
    throw new UnauthorizedException('User must be authenticated to access this resource');
  }

  // Extract user's tenant ID from JWT token
  const userTenantId = context.req.user.tenantId || context.req.user.tenant_id;

  // Validate that requested tenant matches user's tenant
  if (userTenantId !== requestedTenantId) {
    throw new ForbiddenException(
      `Access denied. You do not have permission to access data for tenant ${requestedTenantId}`
    );
  }
}
```

**Additional utilities:**
- `getTenantIdFromContext(context)` - Extracts tenant ID from JWT
- `getUserIdFromContext(context)` - Extracts user ID from JWT

**Analysis:**
- Strong multi-tenant isolation
- JWT-based authentication
- Custom exception classes (UnauthorizedException, ForbiddenException)
- Used in GraphQL resolvers

**Strengths:**
- Prevents cross-tenant data access
- Consistent pattern across resolvers
- Clear error messages

**Integration with Approval Workflow:**
- Can be extended to validate approver belongs to same tenant
- Ensures approval actions are tenant-scoped
- Foundation for tenant-specific approval rules

---

## 2. Current Approval Implementation

### 2.1 GraphQL Schema

**Location:** `print-industry-erp/backend/src/graphql/schema/sales-materials.graphql` (Lines 367-426)

#### PurchaseOrder Type

```graphql
type PurchaseOrder {
  id: ID!
  tenantId: ID!
  facilityId: ID!

  # ... other fields ...

  # Status
  status: PurchaseOrderStatus!

  # Approval
  requiresApproval: Boolean!
  approvedByUserId: ID
  approvedAt: DateTime

  # Lines
  lines: [PurchaseOrderLine!]!

  # Audit trail
  createdAt: DateTime!
  createdBy: ID
  updatedAt: DateTime
  updatedBy: ID
}

enum PurchaseOrderStatus {
  DRAFT
  ISSUED
  ACKNOWLEDGED
  PARTIALLY_RECEIVED
  RECEIVED
  CLOSED
  CANCELLED
}
```

**Analysis:**
- Clean status enumeration
- Approval fields exposed in GraphQL schema
- Consistent audit trail pattern

### 2.2 GraphQL Resolver

**Location:** `print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts` (Lines 1394-1419)

#### approvePurchaseOrder Mutation

```typescript
@Mutation('approvePurchaseOrder')
async approvePurchaseOrder(
  @Args('id') id: string,
  @Args('approvedByUserId') approvedByUserId: string,
  @Context() context: any
) {
  const result = await this.db.query(
    `UPDATE purchase_orders
     SET status = 'ISSUED', approved_by_user_id = $1, approved_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [approvedByUserId, id]
  );

  const po = this.mapPurchaseOrderRow(result.rows[0]);

  // Load lines
  const linesResult = await this.db.query(
    `SELECT * FROM purchase_order_lines WHERE purchase_order_id = $1 ORDER BY line_number`,
    [id]
  );

  po.lines = linesResult.rows.map(this.mapPurchaseOrderLineRow);

  return po;
}
```

**Critical Analysis:**

**Security Issues:**
1. ❌ **No tenant validation** - Missing `validateTenantAccess(context, tenantId)` call
2. ❌ **No authorization check** - Anyone can approve any PO regardless of role
3. ❌ **No status validation** - Can approve PO in any status (even RECEIVED or CLOSED)
4. ❌ **No duplicate approval check** - Can approve already-approved PO
5. ❌ **No amount threshold validation** - No routing based on PO value
6. ❌ **Trust client-provided approvedByUserId** - Should extract from JWT context instead

**Functional Issues:**
1. ❌ **No audit trail** - No logging of approval action
2. ❌ **No approval comments** - Can't record approval notes or rejection reasons
3. ❌ **Hard-coded status transition** - Always moves to ISSUED, no flexibility
4. ❌ **No transaction safety** - Direct UPDATE without proper error handling
5. ❌ **No notification** - No alert to PO creator or next approver

**Recommendation:** Complete rewrite with proper validation, authorization, audit logging, and workflow routing.

### 2.3 Frontend Implementation

**Location:** `print-industry-erp/frontend/src/pages/PurchaseOrderDetailPage.tsx`

#### Approval UI Logic (Lines 168-185)

```typescript
const canApprove = po.requiresApproval && !po.approvedAt && po.status === 'DRAFT';
const canIssue = po.approvedAt && po.status === 'DRAFT';
const canClose = po.status === 'RECEIVED';

const handleApprove = () => {
  setShowApprovalModal(true);
};

const handleConfirmApproval = async () => {
  try {
    await approvePO({
      variables: {
        id: po.id,
        approvedByUserId: 'current-user-id', // TODO: Get from auth context
      },
    });
  } catch (error) {
    console.error('Approval failed:', error);
  }
};
```

**Analysis:**

**Strengths:**
- Simple, clear approval logic
- Confirmation modal for user safety
- Status-based button visibility

**Issues:**
1. ❌ **Hard-coded user ID** - TODO comment indicates auth integration incomplete
2. ❌ **No role check** - UI doesn't validate user has approval permission
3. ❌ **No approval limit check** - Doesn't consider PO amount vs. user approval authority
4. ❌ **No approval comments field** - Can't add notes during approval
5. ❌ **Generic error handling** - Just console.error, no user feedback

#### Approval Status Display (Lines 219-226)

```typescript
{po.requiresApproval && !po.approvedAt && (
  <div className="card bg-yellow-50 border-l-4 border-yellow-400">
    <div className="flex items-center space-x-3">
      <AlertCircle className="h-5 w-5 text-yellow-600" />
      <p className="text-sm text-yellow-800">
        {t('procurement.requiresApprovalMessage')}
      </p>
    </div>
  </div>
)}
```

**Strengths:**
- Visual alert for pending approvals
- Internationalization support
- Clear color coding (yellow = pending action)

---

## 3. Comparative Analysis: Quote Approval Pattern

A more sophisticated approval pattern exists in the **Sales Quote Automation** module, which can serve as a reference implementation for PO approvals.

**Location:** `print-industry-erp/backend/src/modules/sales/services/quote-management.service.ts`

### 3.1 Threshold-Based Approval Logic

```typescript
export class QuoteManagementService {
  // Business rule thresholds (should be configurable)
  private readonly MINIMUM_MARGIN_PERCENTAGE = 15; // Minimum acceptable margin
  private readonly MANAGER_APPROVAL_THRESHOLD = 20; // Margin < 20% requires manager approval
  private readonly VP_APPROVAL_THRESHOLD = 10; // Margin < 10% requires VP approval

  constructor(private readonly db: Pool) {
    this.pricingService = new QuotePricingService(db);
  }

  // ... approval validation methods ...
}
```

### 3.2 Approval Level Enumeration

**Location:** `print-industry-erp/backend/src/modules/sales/interfaces/quote-management.interface.ts` (Lines 183-188)

```typescript
export enum ApprovalLevel {
  SALES_REP = 'SALES_REP',
  SALES_MANAGER = 'SALES_MANAGER',
  SALES_VP = 'SALES_VP',
  CFO = 'CFO'
}

export interface MarginValidationResult {
  isValid: boolean;
  minimumMarginPercentage: number;
  actualMarginPercentage: number;
  requiresApproval: boolean;
  approvalLevel: ApprovalLevel | null;
}
```

### 3.3 Quote Status Workflow

```typescript
export enum QuoteStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED_TO_ORDER = 'CONVERTED_TO_ORDER'
}
```

**Key Insights:**
- **Threshold-based routing**: Different approval levels based on margin percentage
- **Configurable rules**: Constants defined for easy configuration
- **Validation results**: Structured response with approval requirements
- **Multi-level hierarchy**: SALES_REP → SALES_MANAGER → SALES_VP → CFO
- **Clear status transitions**: Defined states with business meaning

**Applicability to PO Workflow:**
- Replace margin percentage with PO total amount
- Define approval levels: BUYER → PURCHASING_MANAGER → DIRECTOR → CFO
- Implement threshold rules (e.g., <$5K auto-approve, $5K-$50K manager, $50K+ director)
- Add validation before approval mutation executes

---

## 4. Gap Analysis

### 4.1 Database Schema Gaps

| Feature | Current State | Gap | Priority |
|---------|--------------|-----|----------|
| Multi-level approvals | Single approver field | No approval chain tracking | High |
| Approval history | None | No audit trail table | High |
| Approval rules | None | No rules engine configuration | High |
| Approval comments | None | No notes/justification field | Medium |
| Approval delegation | None | No temporary delegation mechanism | Medium |
| Approval notifications | None | No notification tracking | Medium |
| Rejection workflow | None | No rejection_reason or rejection_at fields | Medium |
| Approval thresholds | None | No threshold configuration table | High |

**Recommended New Tables:**

1. **approval_workflow_rules**
   - Defines threshold-based routing rules
   - Columns: tenant_id, min_amount, max_amount, required_approval_level, auto_approve_below_threshold

2. **po_approval_history**
   - Audit trail for all approval actions
   - Columns: po_id, approver_user_id, approval_level, action (APPROVED/REJECTED/DELEGATED), comments, approved_at

3. **approval_delegations**
   - Temporary delegation of approval authority
   - Columns: delegator_user_id, delegate_user_id, start_date, end_date, approval_level, reason

4. **approval_notifications**
   - Tracks notification delivery for pending approvals
   - Columns: po_id, recipient_user_id, notification_type, sent_at, read_at, action_taken_at

### 4.2 Authorization Gaps

| Check | Current State | Required | Priority |
|-------|--------------|----------|----------|
| User authentication | ✅ JWT-based | Continue | - |
| Tenant isolation | ✅ validateTenantAccess | Continue | - |
| Role-based approval rights | ❌ Not implemented | Check user has APPROVER role | Critical |
| Approval limit validation | ❌ Not implemented | Check PO amount vs. user approval limit | Critical |
| Approval level sequencing | ❌ Not implemented | Validate approval chain order | High |
| Duplicate approval check | ❌ Not implemented | Prevent same user approving twice | High |
| Self-approval prevention | ❌ Not implemented | Buyer cannot approve own PO | High |

### 4.3 Workflow Logic Gaps

| Feature | Current State | Required | Priority |
|---------|--------------|----------|----------|
| Threshold routing | ❌ None | Route to correct approver based on amount | Critical |
| Multi-level approval chain | ❌ Single approval | Sequential approvals for high-value POs | High |
| Parallel approvals | ❌ None | Multiple approvers at same level (e.g., 2 of 3 directors) | Medium |
| Conditional routing | ❌ None | Special routing for certain vendors/materials | Medium |
| Escalation | ❌ None | Auto-escalate if not approved within SLA | Medium |
| Delegation handling | ❌ None | Temporary delegation during vacation | Medium |
| Rejection workflow | ❌ None | Return to buyer for revision | High |

### 4.4 Audit & Compliance Gaps

| Requirement | Current State | Gap | Priority |
|-------------|--------------|-----|----------|
| Approval timestamp | ✅ approved_at field | Continue | - |
| Approver identity | ✅ approved_by_user_id | Continue | - |
| Approval comments | ❌ None | No justification for approval/rejection | High |
| Approval history | ❌ None | Can't see who approved at each level | Critical |
| Audit trail | ❌ None | No immutable log of approval actions | Critical |
| SOX compliance | ❌ Partial | Missing segregation of duties checks | High |
| Change tracking | ❌ None | No tracking if PO changed after approval | Medium |

---

## 5. Industry Best Practices

### 5.1 Approval Workflow Patterns

**Three-Tier Approval Model** (Recommended for PO workflows)

```
Level 1: BUYER ($0 - $5,000)
├─ Auto-approve for approved vendors
└─ Create PO directly, no approval needed

Level 2: PURCHASING_MANAGER ($5,001 - $50,000)
├─ Manager review required
├─ Can approve within 24 hours
└─ Escalates to Director if exceeds authority

Level 3: PURCHASING_DIRECTOR ($50,001 - $250,000)
├─ Director + Finance review
├─ Dual approval required
└─ Escalates to CFO if exceeds authority

Level 4: CFO ($250,001+)
├─ CFO approval required
├─ Board notification for $1M+
└─ Special procurement process
```

### 5.2 Segregation of Duties (SOD)

**Key Principles:**
1. **No self-approval**: Buyer cannot approve own PO
2. **No dual roles**: User who creates PO cannot receive inventory
3. **No circumvention**: Cannot split POs to avoid approval thresholds
4. **Approval hierarchy**: Cannot skip levels (must go L1→L2→L3)
5. **Four-eyes principle**: High-value POs require two approvers at same level

### 5.3 Threshold Configuration

**Configurable vs. Hard-coded:**
- ❌ **Bad**: Hard-code approval amounts in code
- ✅ **Good**: Store thresholds in database, configurable per tenant
- ✅ **Better**: Support tenant-specific AND facility-specific thresholds
- ✅ **Best**: Support vendor tier-based thresholds (strategic vendors = higher auto-approve limit)

**Example Configuration:**

| Tenant | Facility | Vendor Tier | Min Amount | Max Amount | Approval Level | Auto-Approve |
|--------|----------|-------------|------------|------------|----------------|--------------|
| ACME | All | STRATEGIC | $0 | $10,000 | BUYER | Yes |
| ACME | All | PREFERRED | $0 | $5,000 | BUYER | Yes |
| ACME | All | TRANSACTIONAL | $0 | $1,000 | BUYER | Yes |
| ACME | All | Any | $1,001 | $50,000 | PURCHASING_MANAGER | No |
| ACME | All | Any | $50,001 | $250,000 | PURCHASING_DIRECTOR | No |
| ACME | All | Any | $250,001 | NULL | CFO | No |

**Note:** This example leverages the existing vendor tier classification (STRATEGIC, PREFERRED, TRANSACTIONAL) from `vendor-tier-classification.service.ts`.

### 5.4 Notification Timing

**When to Notify:**
1. **Immediate**: When PO submitted for approval (notify approver)
2. **Reminder**: If not approved within 24 hours (escalation warning)
3. **Escalation**: If not approved within 48 hours (notify next level)
4. **Completion**: When approved/rejected (notify buyer)
5. **Change detection**: If PO edited after approval (notify approver)

**Notification Channels:**
- Email (primary)
- In-app notification badge
- SMS for urgent escalations
- Slack/Teams integration (optional)

---

## 6. Existing Infrastructure to Leverage

### 6.1 Vendor Tier Classification

**Location:** `print-industry-erp/backend/src/modules/procurement/services/vendor-tier-classification.service.ts`

The system already classifies vendors into tiers:
- **STRATEGIC**: Top 20% by spend, critical suppliers
- **PREFERRED**: Next 30%, good performance
- **TRANSACTIONAL**: Bottom 50%, commodity suppliers

**Integration Opportunity:**
- Higher auto-approve limits for STRATEGIC vendors
- Lower thresholds for TRANSACTIONAL vendors
- Automatic approval for contract-based POs with STRATEGIC vendors

### 6.2 Vendor Alert Engine

**Location:** `print-industry-erp/backend/src/modules/procurement/services/vendor-alert-engine.service.ts`

Generates alerts for vendor performance issues.

**Integration Opportunity:**
- Block auto-approval if vendor has active quality alerts
- Require manager approval for vendors with delivery issues
- Flag POs to vendors with financial risk alerts

### 6.3 User Role Framework

**Available from users table:**
- `roles` JSONB field (array of role strings)
- `security_clearance_level` (5-tier security zones)
- `default_facility_id` (for facility-specific approvals)

**Integration Opportunity:**
- Define new roles: PO_APPROVER_L1, PO_APPROVER_L2, PO_APPROVER_L3, CFO
- Check roles array before allowing approval
- Use security clearance for sensitive material procurement

### 6.4 Audit Trail Pattern

Existing tables have consistent audit columns:
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by UUID,
updated_at TIMESTAMPTZ,
updated_by UUID,
deleted_at TIMESTAMPTZ,  -- Soft delete
deleted_by UUID
```

**Integration Opportunity:**
- Apply same pattern to approval history table
- Track who initiated approval request (created_by)
- Track who approved (approved_by_user_id)
- Track any modifications (updated_by)
- Support soft deletes for data retention compliance

---

## 7. Technical Architecture Recommendations

### 7.1 Database Schema Additions

#### New Tables Required

**1. approval_workflow_rules**
```sql
CREATE TABLE approval_workflow_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    min_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    max_amount DECIMAL(18,4),
    required_approval_level VARCHAR(50) NOT NULL,
    auto_approve BOOLEAN DEFAULT FALSE,
    approval_sla_hours INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**2. po_approval_history**
```sql
CREATE TABLE po_approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    approver_user_id UUID NOT NULL,
    approval_level VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    comments TEXT,
    action_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**3. Purchase Orders Table Modifications**
```sql
ALTER TABLE purchase_orders ADD COLUMN current_approval_level VARCHAR(50);
ALTER TABLE purchase_orders ADD COLUMN next_approval_level VARCHAR(50);
ALTER TABLE purchase_orders ADD COLUMN submitted_for_approval_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN rejection_reason TEXT;
```

---

## 8. Implementation Recommendations

### 8.1 Immediate Actions (Week 1)

1. **Security Fix**: Patch existing `approvePurchaseOrder` mutation
   - Add tenant validation
   - Add authorization check
   - Extract user ID from JWT (don't trust client)
   - Add status validation (only approve DRAFT status)
   - Add audit logging

2. **Database Schema**: Create approval workflow tables
   - approval_workflow_rules
   - po_approval_history
   - approval_delegations
   - Alter purchase_orders

3. **Service Layer**: Implement ApprovalWorkflowService
   - Basic approval flow
   - Authorization checks
   - Audit trail logging

### 8.2 Phased Rollout

**Phase 1: Foundation (2 weeks)**
- Multi-level approval workflow
- Proper authorization checks
- Audit trail logging
- Security fixes

**Phase 2: Notifications (1 week)**
- Email notifications
- Delegation support
- Pending approvals dashboard

**Phase 3: Advanced Features (1 week)**
- Vendor tier integration
- Auto-escalation
- Enhanced UI
- Approval analytics

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Approval accuracy | 100% | No unauthorized approvals |
| Audit trail completeness | 100% | All approvals logged |
| SLA compliance | ≥95% | % approved within deadline |
| Auto-approval rate | 60-70% | % auto-approved below threshold |

---

## 10. Conclusion

The existing PO infrastructure provides a **solid foundation** for implementing a comprehensive approval workflow. The database schema, GraphQL layer, frontend components, and multi-tenant security framework are all in place. However, the current approval implementation has **critical security gaps** and lacks advanced workflow features.

**Key Takeaways:**

1. **Existing Strengths:**
   - Complete PO CRUD operations
   - Basic approval tracking
   - Multi-tenant isolation
   - User role framework
   - Vendor tier classification

2. **Critical Gaps:**
   - No authorization checks in approval mutation
   - No multi-level approval support
   - No threshold-based routing
   - No audit trail
   - No delegation mechanism
   - No notifications

3. **Recommended Approach:**
   - Phase 1: Fix security issues + basic multi-level approval (2 weeks)
   - Phase 2: Add delegation + notifications (1 week)
   - Phase 3: Advanced features + vendor tier integration (1 week)
   - **Total Estimated Time: 4 weeks**

**This research deliverable provides the complete blueprint for Marcus (Implementation) to build a production-ready PO approval workflow system.**

---

## Appendix: Related Files Reference

### Database Migrations
- `print-industry-erp/backend/migrations/V0.0.6__create_sales_materials_procurement.sql` - Lines 391-525
- `print-industry-erp/backend/migrations/V0.0.2__create_core_multitenant.sql` - Lines 285-374

### Backend Services
- `print-industry-erp/backend/src/modules/procurement/services/vendor-tier-classification.service.ts`
- `print-industry-erp/backend/src/modules/sales/services/quote-management.service.ts`
- `print-industry-erp/backend/src/common/security/tenant-validation.ts`

### GraphQL Layer
- `print-industry-erp/backend/src/graphql/schema/sales-materials.graphql` - Lines 367-486
- `print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts` - Lines 1394-1419

### Frontend Components
- `print-industry-erp/frontend/src/pages/PurchaseOrderDetailPage.tsx`
- `print-industry-erp/frontend/src/pages/PurchaseOrdersPage.tsx`
- `print-industry-erp/frontend/src/graphql/queries/purchaseOrders.ts`

---

**End of Research Deliverable**

*This document provides comprehensive research findings for REQ-STRATEGIC-AUTO-1735251169000 (PO Approval Workflow) and serves as the blueprint for implementation by Marcus (Implementation Specialist).*
