# ⚠️ MANDATORY TESTING ADDENDUM - ALL AGENTS MUST READ

**Status:** ✅ ACTIVE - IMMEDIATE COMPLIANCE REQUIRED
**Effective Date:** 2025-12-08
**Applies To:** ALL AGENTS WITHOUT EXCEPTION

---

## 🚨 YOUR WORK WILL BE AUTOMATICALLY VERIFIED

**The Orchestrator will run these commands AFTER you submit work:**

```bash
# Backend Build - MUST PASS
cd Implementation/print-industry-erp/backend && npm run build

# Frontend Build - MUST PASS
cd Implementation/print-industry-erp/frontend && npm run build

# Backend Tests - MUST PASS
cd Implementation/print-industry-erp/backend && npm run test --passWithNoTests
```

**If ANY of these fail, your work is REJECTED and routed back to you.**

You should run these yourself BEFORE claiming work is complete. If you break the build, you fix the build.

---

## 🚨 CRITICAL RULE CHANGE

**ALL AGENTS MUST FUNCTIONALLY TEST THEIR WORK BEFORE MARKING IT COMPLETE.**

This is **NOT optional**. This is **NOT just debugging**. This means **ACTUALLY USING** what you built to verify it works.

---

## The New Standard

```
OLD WAY (NO LONGER ACCEPTABLE):
Create code → Mark complete → Move on

NEW WAY (MANDATORY):
Create code → TEST IN ACTUAL USE → Verify it works → Mark complete
```

---

## What "Testing" Means

### ❌ NOT Testing:
- "I wrote the code"
- "It compiles/builds"
- "I fixed the syntax errors"
- "I ran the linter"
- "I wrote unit tests" (but didn't run them)

### ✅ IS Testing:
- "I wrote the code AND actually ran it"
- "I tested it with real data/inputs"
- "I verified the output is correct"
- "I confirmed it works as intended"
- "I have evidence it functions properly"

---

## Quick Testing Guide by Agent Type

### Backend Developers (Roy, Mike, Kyle, etc.)
**After creating an API endpoint:**
```bash
# 1. Run tests
npm run test

# 2. Start server
npm run dev

# 3. Actually call the endpoint
curl -X POST http://localhost:4000/api/your-endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# 4. Verify response is correct

# 5. Check database if data should be persisted
psql -d wms_dev -c "SELECT * FROM your_table WHERE..."

# 6. Test error cases (invalid input, missing fields)
```

### Frontend Developers (Jen, Gill, Lana, etc.)
**After creating a component/page:**
```bash
# 1. Start dev server
cd frontend && npm run dev

# 2. Open browser to http://localhost:3000

# 3. Actually use the feature you built:
   - Click buttons
   - Fill out forms
   - Navigate through the UI
   - Check console for errors
   - Verify visual appearance

# 4. Test with Playwright (E2E)
npm run test:e2e

# 5. Take screenshot as evidence
```

### QA Engineers (Billy)
**After creating tests:**
```bash
# 1. Run the tests you created
npm run test:e2e

# 2. Verify they pass when they should
# 3. Verify they fail when they should (negative testing)
# 4. Check coverage reports
npm run test:coverage

# 5. Test actual user workflows manually
```

### DevOps Engineers (Miki)
**After creating deployment configs:**
```bash
# 1. Actually run the deployment
docker-compose down
docker-compose up -d

# 2. Verify all services started
docker ps

# 3. Check health endpoints
curl http://localhost:4000/health

# 4. Check logs for errors
docker logs wms-backend --tail 50

# 5. Verify connectivity between services
```

### Database Administrators (Ron)
**After creating migrations/RLS policies:**
```sql
-- 1. Run the migration
npm run migrate

-- 2. Insert test data
INSERT INTO your_table (...) VALUES (...);

-- 3. Test RLS with different users
SET ROLE wms_app_role;
SET app.tenant_id = 'tenant1';
SELECT * FROM your_table;  -- Should see only tenant1 data

SET app.tenant_id = 'tenant2';
SELECT * FROM your_table;  -- Should see only tenant2 data

-- 4. Try to violate constraints (should fail)
INSERT INTO your_table (id, tenant_id, ...) VALUES (..., 'wrong_tenant', ...);
```

### Security Testers (Vic)
**After creating security tests:**
```bash
# 1. Run security scans
npm audit

# 2. Test for SQL injection
curl -X POST http://localhost:4000/api/login \
  -d "username=admin' OR '1'='1"
# Should be blocked!

# 3. Test authentication bypass attempts
# 4. Verify RLS enforcement
# 5. Check for XSS vulnerabilities
```

### Documentation Writers (Dana)
**After writing guides:**
```bash
# 1. Follow your own instructions from scratch
# 2. Run every command exactly as written
# 3. Verify outcomes match documentation
# 4. Check all links work
markdown-link-check your-guide.md

# 5. Test code examples actually run
```

### Deployment Specialists (Morgan, Casey, Sam)
**After creating deployment scripts:**
```bash
# 1. Actually run the deployment to target environment
./deploy-staging.sh

# 2. Verify application works
curl https://staging.example.com/health

# 3. Test rollback procedure
./rollback-staging.sh

# 4. Verify rollback worked
```

---

## Required Tools (Must Be Installed)

### All Agents:
- ✅ Node.js & npm
- ✅ Git
- ✅ curl
- ✅ Docker & docker-compose

### Testing Tools (MANDATORY):
- ✅ **Playwright** - for E2E testing (`npm install -D @playwright/test`)
- ✅ **Jest** - for unit/integration testing (already installed)
- ✅ **Supertest** - for API testing (already installed)
- ✅ psql - for database testing
- ✅ Browser (Chrome/Edge/Firefox) - for manual UI testing

**If a tool is missing, REQUEST IT IMMEDIATELY. Installation is a blocking requirement.**

---

## Evidence Requirements

Before marking work complete, you MUST provide evidence of testing:

### Acceptable Evidence:
- ✅ Command output showing tests passing
- ✅ curl responses showing API working correctly
- ✅ Screenshots of UI functioning
- ✅ Database query results
- ✅ Log entries confirming expected behavior
- ✅ Playwright test results
- ✅ Error responses for invalid inputs

### Example Evidence Format:
```markdown
## Task: Create POST /api/kits endpoint

### Implementation: ✅ Done
[Code details...]

### Testing: ✅ Done

**Automated Tests:**
```bash
$ npm run test
PASS  tests/kits.test.ts
  ✓ creates kit with valid data (45ms)
  ✓ returns 400 for invalid data (23ms)
  ✓ requires authentication (18ms)

Test Suites: 1 passed
Tests: 3 passed
```

**Manual Testing:**
```bash
$ curl -X POST http://localhost:4000/api/kits \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"kitNumber":"KIT-001","name":"Test Kit"}'

HTTP/1.1 201 Created
{
  "id": "123-456-789",
  "kitNumber": "KIT-001",
  "name": "Test Kit"
}
```

**Database Verification:**
```sql
wms_dev=# SELECT * FROM kits WHERE kit_number = 'KIT-001';
 id      | kit_number | name      | created_at
---------+------------+-----------+------------
 123-... | KIT-001    | Test Kit  | 2025-12-08
(1 row)
```

**Status:** ✅ COMPLETE - Tested and verified working
```

---

## Orchestrator Enforcement

The orchestrator WILL check for testing evidence before accepting work as complete.

**Questions the orchestrator will ask:**
- "Did you test this?"
- "What were the test results?"
- "Show me evidence it works"
- "Did you test error cases?"

**If you cannot provide evidence:**
- ❌ Work will be REJECTED
- ❌ You must go back and test properly
- ❌ Timeline will be delayed
- ❌ Trust in your work decreases

---

## What If Tests Fail?

**If your testing reveals bugs: THIS IS GOOD!**

✅ You caught it before code review
✅ Fix it immediately
✅ Re-test
✅ THEN mark complete

**Finding bugs during self-testing is SUCCESS, not failure.**

Better to find issues now than in production.

---

## Common Questions

**Q: "What if I don't know how to test this?"**
A: Ask for help, learn the tool, THEN test. Testing is part of the work.

**Q: "Testing takes too long"**
A: Testing is PART of the work, not extra. Build it into your estimates.

**Q: "Can I skip testing for small changes?"**
A: NO. Test EVERYTHING. Small bugs cause big problems.

**Q: "What if the tests fail?"**
A: Good! Fix it, re-test, then mark complete. That's the whole point.

**Q: "Do I need to test if I'm just updating documentation?"**
A: YES. Follow your own instructions to verify they work.

---

## Summary: The Non-Negotiables

1. ✅ **Test your own work** - every single time
2. ✅ **Actually USE what you built** - don't just run linters
3. ✅ **Provide evidence** - screenshots, outputs, results
4. ✅ **Test error cases** - not just happy paths
5. ✅ **Fix failures before marking complete** - never ship broken code

---

## Full Policy Document

For complete details, see: `MANDATORY_TESTING_POLICY.md`

---

**This addendum supersedes all previous testing guidelines.**
**Compliance is mandatory. No exceptions.**

---

**Document Version:** 1.0
**Last Updated:** 2025-12-08
**Status:** ACTIVE
