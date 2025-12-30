# Finance Module Phase 1 - Deployment Guide
**REQ-STRATEGIC-AUTO-1767066329940**

**Version:** 1.0.0
**Date:** 2025-12-29
**Status:** Ready for Deployment

---

## Quick Start

### Prerequisites
- PostgreSQL 14+ with uuid-ossp extension enabled
- Node.js 18+ with TypeScript 5+
- Flyway for database migrations
- Access to development/staging environment

### Deployment Steps (15 minutes)

```bash
# 1. Database Migration
cd print-industry-erp/backend
flyway migrate
flyway info  # Verify V0.0.45 applied

# 2. Rebuild Application
npm run build

# 3. Restart Services
pm2 restart backend
# OR
docker-compose restart backend

# 4. Verify Deployment
curl http://localhost:4000/graphql
```

---

## What's New in Phase 1

### Database Changes (Migration V0.0.45)

**6 New Tables:**
1. `payment_applications` - Payment-to-invoice mapping
2. `bank_accounts` - Bank account master
3. `customers` - Customer master (AR)
4. `vendors` - Vendor master (AP)
5. `journal_entry_approvals` - JE approval workflow
6. `finance_audit_log` - Comprehensive audit trail

**Column Additions:**
- `invoices`: invoice_type, period_year, period_month, balance_due, paid_amount, payment_status, customer_id, vendor_id
- `payments`: period_year, period_month, paid_by_name, check_number, transaction_id, deposit_date, unapplied_amount

**New Indexes (Performance):**
- Invoice aging queries
- Payment reconciliation
- GL balance rollup
- Period-based reporting

### Code Changes

**New Services (5):**
1. `JournalEntryService` - GL posting with validation ✅
2. `InvoiceService` - AR/AP invoice management ✅
3. `PaymentService` - Payment processing ✅
4. `CostAllocationService` - Job costing stub (Phase 2)
5. `PeriodCloseService` - Month-end close stub (Phase 3)

**New DTOs (3 files):**
- `invoice.dto.ts` - Type-safe invoice operations
- `payment.dto.ts` - Type-safe payment operations
- `journal-entry.dto.ts` - Type-safe GL posting

**Custom Exceptions:**
- 20+ exception types for better error handling
- User-friendly error messages
- Proper HTTP status codes

**Module Updates:**
- `finance.module.ts` - All services wired with DI

---

## Verification Checklist

### 1. Database Migration Verification

```sql
-- Verify new tables exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'payment_applications',
  'bank_accounts',
  'customers',
  'vendors',
  'journal_entry_approvals',
  'finance_audit_log'
);
-- Expected: 6

-- Verify invoices columns
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'invoices'
AND column_name IN ('invoice_type', 'period_year', 'balance_due', 'paid_amount', 'customer_id', 'vendor_id');
-- Expected: 6

-- Verify payments columns
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('period_year', 'unapplied_amount', 'check_number');
-- Expected: 3

-- Verify indexes created
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('invoices', 'payments', 'payment_applications')
AND indexname LIKE 'idx_%';
-- Expected: 10+
```

### 2. Application Startup Verification

```bash
# Check logs for service initialization
pm2 logs backend | grep "JournalEntryService"
pm2 logs backend | grep "InvoiceService"
pm2 logs backend | grep "PaymentService"

# Expected output:
# [NestJS] JournalEntryService initialized
# [NestJS] InvoiceService initialized
# [NestJS] PaymentService initialized
```

### 3. GraphQL Schema Verification

```graphql
# Query introspection to verify types exist
{
  __type(name: "Invoice") {
    name
    fields {
      name
      type {
        name
      }
    }
  }
}

# Expected: Invoice type with all fields including new ones:
# - invoiceType
# - periodYear
# - periodMonth
# - balanceDue
# - paidAmount
# - paymentStatus
```

---

## Smoke Tests

### Test 1: Create Customer

```graphql
mutation {
  createCustomer(input: {
    tenantId: "YOUR_TENANT_ID"
    customerNumber: "CUST-001"
    customerName: "Test Customer"
    email: "test@example.com"
    paymentTerms: "NET_30"
    isActive: true
  }) {
    id
    customerNumber
    customerName
  }
}
```

### Test 2: Create Vendor

```graphql
mutation {
  createVendor(input: {
    tenantId: "YOUR_TENANT_ID"
    vendorNumber: "VEND-001"
    vendorName: "Test Vendor"
    email: "vendor@example.com"
    paymentTerms: "NET_30"
    isActive: true
  }) {
    id
    vendorNumber
    vendorName
  }
}
```

### Test 3: Create Invoice (After Resolver Update)

```graphql
mutation {
  createInvoice(input: {
    tenantId: "YOUR_TENANT_ID"
    invoiceType: CUSTOMER_INVOICE
    customerId: "CUSTOMER_ID_FROM_TEST1"
    invoiceDate: "2025-12-29"
    dueDate: "2026-01-28"
    currencyCode: "USD"
    lines: [{
      description: "Test Product"
      quantity: 1
      unitPrice: 100.00
      amount: 100.00
    }]
    subtotal: 100.00
    totalAmount: 100.00
    postToGL: true
  }) {
    id
    invoiceNumber
    status
    journalEntryId
    balanceDue
  }
}

# Expected:
# - invoiceNumber: "INV-2025-00001"
# - status: "POSTED"
# - journalEntryId: NOT NULL
# - balanceDue: 100.00
```

### Test 4: Create Payment and Apply

```graphql
mutation {
  createPayment(input: {
    tenantId: "YOUR_TENANT_ID"
    paymentType: CUSTOMER_PAYMENT
    customerId: "CUSTOMER_ID_FROM_TEST1"
    paymentDate: "2025-12-29"
    amount: 100.00
    currencyCode: "USD"
    paymentMethod: CHECK
    checkNumber: "1001"
    applyToInvoices: [{
      invoiceId: "INVOICE_ID_FROM_TEST3"
      amountToApply: 100.00
    }]
    postToGL: true
  }) {
    id
    paymentNumber
    status
    unappliedAmount
  }
}

# Expected:
# - paymentNumber: "PMT-2025-00001"
# - status: "POSTED"
# - unappliedAmount: 0.00
```

### Test 5: Verify Invoice Marked as Paid

```graphql
query {
  invoice(id: "INVOICE_ID_FROM_TEST3") {
    id
    invoiceNumber
    totalAmount
    paidAmount
    balanceDue
    paymentStatus
  }
}

# Expected:
# - totalAmount: 100.00
# - paidAmount: 100.00
# - balanceDue: 0.00
# - paymentStatus: "PAID"
```

---

## Rollback Plan

### If Deployment Fails

#### Option 1: Database Rollback (Flyway)
```bash
# Undo last migration
flyway undo

# Verify rollback
flyway info
```

#### Option 2: Application Rollback
```bash
# Revert to previous git commit
git revert HEAD

# Rebuild and restart
npm run build
pm2 restart backend
```

#### Option 3: Full Rollback
```bash
# Database rollback
flyway undo

# Application rollback
git revert HEAD
npm run build
pm2 restart backend
```

---

## Performance Tuning

### Database Optimization

```sql
-- Vacuum analyze new tables
VACUUM ANALYZE payment_applications;
VACUUM ANALYZE bank_accounts;
VACUUM ANALYZE customers;
VACUUM ANALYZE vendors;
VACUUM ANALYZE journal_entry_approvals;
VACUUM ANALYZE finance_audit_log;

-- Update statistics
ANALYZE invoices;
ANALYZE payments;
ANALYZE journal_entries;
ANALYZE journal_entry_lines;
```

### Connection Pool Tuning

```typescript
// database.config.ts
export const databaseConfig = {
  max: 20,  // Maximum pool size
  min: 5,   // Minimum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};
```

---

## Monitoring

### Key Metrics to Watch

1. **Database Performance:**
   - Query time for GL balance updates
   - Invoice creation time
   - Payment application time
   - Index usage on new tables

2. **Application Performance:**
   - Service response times
   - Transaction rollback rate
   - Exception frequency

3. **Business Metrics:**
   - Invoices created per day
   - Payments processed per day
   - Average payment application time
   - Journal entries posted per day

### Monitoring Queries

```sql
-- Count new records created today
SELECT
  'Invoices' as entity,
  COUNT(*) as count_today
FROM invoices
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT
  'Payments',
  COUNT(*)
FROM payments
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT
  'Payment Applications',
  COUNT(*)
FROM payment_applications
WHERE created_at >= CURRENT_DATE;

-- Check audit log activity
SELECT
  entity_type,
  action,
  COUNT(*) as occurrences
FROM finance_audit_log
WHERE changed_at >= CURRENT_DATE
GROUP BY entity_type, action
ORDER BY entity_type, action;

-- Slow query detection
SELECT
  schemaname,
  tablename,
  seq_scan,
  idx_scan,
  seq_tup_read,
  idx_tup_fetch
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN ('invoices', 'payments', 'payment_applications')
ORDER BY seq_tup_read DESC;
```

---

## Security Checklist

### Pre-Deployment

- [ ] All sensitive data encrypted at rest
- [ ] SQL injection prevention verified (parameterized queries)
- [ ] Authentication required for all finance mutations
- [ ] Row-level security enabled for multi-tenant isolation
- [ ] Audit logging enabled for all financial transactions
- [ ] User permissions configured (FINANCE_VIEW, FINANCE_ENTRY, FINANCE_POST)

### Post-Deployment

- [ ] Review audit log for unexpected activity
- [ ] Verify RLS policies applied
- [ ] Check exception logs for security errors
- [ ] Validate user access controls working

---

## Common Issues & Solutions

### Issue 1: Migration Fails - "Column already exists"

**Solution:**
```sql
-- Drop column if exists and retry
ALTER TABLE invoices DROP COLUMN IF EXISTS invoice_type;
-- Then re-run migration
```

### Issue 2: Service Injection Error

**Error:** `Nest can't resolve dependencies of the InvoiceService (?)`

**Solution:**
```typescript
// Ensure DATABASE_POOL is provided in app.module.ts
{
  provide: 'DATABASE_POOL',
  useFactory: async () => {
    const pool = new Pool(dbConfig);
    return pool;
  },
}
```

### Issue 3: GraphQL Schema Mismatch

**Error:** `Cannot return null for non-nullable field Invoice.invoiceType`

**Solution:**
- Ensure migration V0.0.45 applied successfully
- Check that `invoice_type` column exists with default value
- Verify GraphQL schema matches database schema

---

## Next Steps

### Immediate (Week 1)

1. **Update FinanceResolver**
   - Inject services in constructor
   - Replace "Not yet implemented" mutations with service calls
   - Add error handling wrappers

2. **Create Seed Data**
   - Sample chart of accounts
   - Test customers and vendors
   - Sample exchange rates

3. **Unit Tests**
   - Test invoice validation logic
   - Test payment application logic
   - Test journal entry balance validation

### Short-Term (Week 2)

4. **Integration Tests**
   - End-to-end invoice-to-payment cycle
   - Multi-invoice payment application
   - GL posting verification

5. **Documentation**
   - API documentation for new mutations
   - User guide for AR/AP workflow
   - Admin guide for setup

### Phase 2 (2 weeks)

6. **Cost Allocation Service**
   - Implement job costing logic
   - Machine/labor hour tracking
   - Overhead allocation rules

7. **Production Integration**
   - WIP tracking
   - Material cost posting
   - Job profitability reports

### Phase 3 (1 week)

8. **Period Close Service**
   - GL balance calculation
   - Period validation
   - Trial balance verification

---

## Support & Escalation

### Issue Triage

- **Critical (Production Down):** Immediate escalation to DevOps team
- **High (Feature Broken):** Log issue, notify development team within 4 hours
- **Medium (Performance):** Schedule fix for next sprint
- **Low (Enhancement):** Add to backlog

### Contact Information

- **DevOps Team:** devops@company.com
- **Backend Team:** backend-dev@company.com
- **Finance Module Owner:** roy@company.com

---

## Appendix A: Database Schema Diagram

```
┌─────────────────┐
│   customers     │
├─────────────────┤
│ id              │──┐
│ customer_number │  │
│ customer_name   │  │
│ payment_terms   │  │
└─────────────────┘  │
                     │
┌─────────────────┐  │    ┌──────────────────┐
│    invoices     │  │    │   payments       │
├─────────────────┤  │    ├──────────────────┤
│ id              │  │    │ id               │──┐
│ customer_id     │◄─┘    │ customer_id      │  │
│ vendor_id       │       │ amount           │  │
│ total_amount    │       │ unapplied_amount │  │
│ paid_amount     │◄─┐    └──────────────────┘  │
│ balance_due     │  │                           │
│ payment_status  │  │    ┌──────────────────────┤
│ journal_entry_id│──┼───►│ payment_applications │
└─────────────────┘  │    ├──────────────────────┤
                     └────│ payment_id           │
                          │ invoice_id           │
┌─────────────────┐       │ amount_applied       │
│    vendors      │       └──────────────────────┘
├─────────────────┤
│ id              │──┐
│ vendor_number   │  │
│ vendor_name     │  │
│ payment_terms   │  │
└─────────────────┘  │
                     │
        ┌────────────┘
        ▼
    (vendor_id in invoices)
```

---

## Appendix B: Service Architecture

```
┌─────────────────────────────────────────────────┐
│           GraphQL Resolver Layer                │
│  (Thin layer - delegates to services)           │
└──────────────────┬──────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Invoice │  │ Payment │  │ Journal │
│ Service │  │ Service │  │ Entry   │
│         │  │         │  │ Service │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     │  ┌─────────┴────────┐   │
     │  │                  │   │
     └──┼──────────────────┼───┘
        │                  │
        ▼                  ▼
┌──────────────┐    ┌─────────────┐
│  PostgreSQL  │    │ Audit Log   │
│  Database    │    │ Service     │
└──────────────┘    └─────────────┘
```

---

**Deployment Guide Version:** 1.0.0
**Last Updated:** 2025-12-29
**Document Owner:** Roy (Backend Developer)
