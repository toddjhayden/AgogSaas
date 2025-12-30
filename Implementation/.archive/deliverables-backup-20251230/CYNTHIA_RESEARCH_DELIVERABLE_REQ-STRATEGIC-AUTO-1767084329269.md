# Research Deliverable: Comprehensive Testing Suite Implementation
## REQ-STRATEGIC-AUTO-1767084329269

**Researcher:** Cynthia (Research Analyst)
**Date:** December 30, 2024
**Assignment:** Analyze codebase and provide comprehensive research on implementing Unit, Integration, and E2E testing
**Status:** COMPLETE

---

## Executive Summary

This research provides a complete analysis of the current testing infrastructure in the AgogSaaS Print Industry ERP system and delivers actionable recommendations for implementing a comprehensive testing suite with Unit, Integration, and End-to-End (E2E) tests.

**Key Findings:**
- Backend has 13 unit/integration test files covering ~25% of modules
- Frontend has only 1 component test (critical gap)
- Agent Backend has zero test infrastructure (complete gap)
- No E2E testing framework configured (Playwright/Cypress missing)
- Test coverage reporting is active but not enforced with thresholds
- Strong testing patterns exist but are inconsistently applied

**Priority Recommendations:**
1. Implement Playwright E2E testing framework
2. Add React Testing Library for comprehensive frontend testing
3. Create test infrastructure for Agent Backend
4. Establish test utilities, fixtures, and data factories
5. Integrate automated testing into CI/CD pipeline

---

## Table of Contents

1. [Current Testing Infrastructure Analysis](#1-current-testing-infrastructure-analysis)
2. [Testing Frameworks & Libraries](#2-testing-frameworks--libraries)
3. [Existing Test Coverage](#3-existing-test-coverage)
4. [Test Patterns & Best Practices](#4-test-patterns--best-practices)
5. [Critical Gaps Identified](#5-critical-gaps-identified)
6. [Recommended Testing Strategy](#6-recommended-testing-strategy)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Test Suite Architecture](#8-test-suite-architecture)
9. [Dependencies & Tools](#9-dependencies--tools)
10. [Success Metrics](#10-success-metrics)

---

## 1. Current Testing Infrastructure Analysis

### 1.1 Backend Testing Infrastructure

**Configuration:** Jest with ts-jest preset
- **Config File:** `print-industry-erp/backend/jest.config.js`
- **Test Environment:** Node.js
- **Test Pattern:** `**/__tests__/**/*.test.ts`, `**/__tests__/**/*.integration.test.ts`
- **Coverage:** Enabled with HTML, LCOV, and text reports
- **Coverage Directory:** `coverage/`

**Test Scripts Available:**
```json
{
  "test": "jest",
  "test:memory": "ts-node scripts/test-phase4-memory.ts",
  "test:nats": "ts-node scripts/test-nats-deliverables.ts",
  "test:orchestration": "ts-node scripts/test-orchestration.ts",
  "test:workflow": "ts-node scripts/test-end-to-end-workflow.ts"
}
```

**Existing Test Files (13 files):**

1. **WMS Module (7 tests):**
   - `bin-utilization-optimization-enhanced.test.ts` - Unit test for BFD algorithm
   - `bin-utilization-optimization-enhanced.integration.test.ts` - Integration test
   - `bin-optimization-data-quality.test.ts` - Data quality validation
   - `bin-utilization-statistical-analysis.test.ts` - Statistical analysis
   - `bin-utilization-3d-dimension-check.test.ts` - 3D dimension validation
   - `bin-utilization-ffd-algorithm.test.ts` - FFD algorithm testing
   - `bin-utilization-optimization-hybrid.test.ts` - Hybrid optimization

2. **Forecasting Module (2 tests):**
   - `forecasting.service.spec.ts` - Core forecasting service
   - `forecast-accuracy.service.spec.ts` - Accuracy metrics

3. **Procurement Module (2 tests):**
   - `vendor-tier-classification.service.test.ts` - Vendor classification
   - `vendor-alert-engine.service.test.ts` - Alert engine logic

4. **Sales Module (1 test):**
   - `pricing-rule-engine.service.test.ts` - Pricing rules

5. **Security/Common (2 tests):**
   - `tenant-validation.test.ts` - Tenant context validation
   - `procurement-dtos.test.ts` - DTO validation
   - `tenant-isolation.spec.ts` - E2E security test (in `/test/security/`)

### 1.2 Frontend Testing Infrastructure

**Configuration:** Vitest (minimal setup)
- **Test Script:** `npm test` -> `vitest`
- **Framework:** Vitest v1.0.4
- **Missing:** @testing-library/react (not in dependencies)

**Existing Test Files (1 file):**
- `src/__tests__/KPICard.test.tsx` - Basic component rendering test

**Critical Gap:** Only 1 component test exists out of 30+ components

### 1.3 Agent Backend Testing Infrastructure

**Configuration:** None
- **Test Script:** Not defined
- **Dependencies:** No testing libraries installed
- **Test Files:** Zero

**Status:** Complete absence of testing infrastructure

---

## 2. Testing Frameworks & Libraries

### 2.1 Currently Installed

**Backend:**
```json
{
  "jest": "^29.7.0",
  "ts-jest": "^29.4.6",
  "@nestjs/testing": "^11.1.10",
  "@types/jest": "^29.5.14"
}
```

**Frontend:**
```json
{
  "vitest": "^1.0.4"
}
```

**Notable Missing:**
- `@testing-library/react` - Frontend component testing
- `@testing-library/react-hooks` - Hook testing
- `@testing-library/user-event` - User interaction simulation
- `playwright` or `cypress` - E2E testing
- `supertest` - HTTP API testing (implicitly used but not in package.json)
- `msw` - API mocking for frontend tests

### 2.2 Recommended Additions

**Backend E2E & Integration:**
```json
{
  "supertest": "^6.3.3",
  "@faker-js/faker": "^8.4.1",
  "testcontainers": "^10.4.0"
}
```

**Frontend Testing:**
```json
{
  "@testing-library/react": "^14.1.2",
  "@testing-library/user-event": "^14.5.1",
  "@testing-library/jest-dom": "^6.1.5",
  "vitest-canvas-mock": "^0.3.3",
  "happy-dom": "^12.10.3",
  "msw": "^2.0.11"
}
```

**E2E Testing:**
```json
{
  "@playwright/test": "^1.40.1",
  "dotenv-cli": "^7.3.0"
}
```

**Agent Backend Testing:**
```json
{
  "jest": "^29.7.0",
  "ts-jest": "^29.4.6",
  "@types/jest": "^29.5.14"
}
```

---

## 3. Existing Test Coverage

### 3.1 Module Coverage Analysis

| Module | Files with Tests | Test Type | Coverage Status |
|--------|------------------|-----------|-----------------|
| WMS | 7 files | Unit + Integration | **Good** (70-80% estimated) |
| Forecasting | 2 files | Unit | **Partial** (40-50% estimated) |
| Procurement | 2 files | Unit | **Partial** (30-40% estimated) |
| Sales | 1 file | Unit | **Minimal** (10-20% estimated) |
| Security/Auth | 2 files | Unit + E2E | **Good** (60-70% estimated) |
| Finance | 0 files | None | **Missing** (0%) |
| Operations | 0 files | None | **Missing** (0%) |
| GraphQL Resolvers | 0 files | None | **Missing** (0%) |
| Controllers | 0 files | None | **Missing** (0%) |
| Monitoring | 0 files | None | **Missing** (0%) |

### 3.2 Frontend Coverage Analysis

| Area | Files with Tests | Coverage Status |
|------|------------------|-----------------|
| Components (Common) | 1/15 | **Critical Gap** (7%) |
| Components (Layout) | 0/5 | **Missing** (0%) |
| Components (Monitoring) | 0/8 | **Missing** (0%) |
| Pages | 0/12 | **Missing** (0%) |
| Stores (Zustand) | 0/1 | **Missing** (0%) |
| GraphQL Client | 0/1 | **Missing** (0%) |
| Utilities | 0/3 | **Missing** (0%) |

### 3.3 Agent Backend Coverage Analysis

| Area | Files with Tests | Coverage Status |
|------|------------------|-----------------|
| Orchestration | 0 | **Missing** (0%) |
| Proactive Daemons | 0 | **Missing** (0%) |
| NATS Integration | 0 | **Missing** (0%) |
| Agent Services | 0 | **Missing** (0%) |

### 3.4 Coverage Report Generated

**Location:** `print-industry-erp/backend/coverage/`
**Last Updated:** December 30, 2024
**Formats:** HTML (`lcov-report/index.html`), LCOV (`lcov.info`), Text

**Current Coverage (Backend):**
- Statements: ~35-40% (estimated from files tested)
- Branches: ~30-35%
- Functions: ~40-45%
- Lines: ~35-40%

---

## 4. Test Patterns & Best Practices

### 4.1 Backend Unit Test Pattern

**Example from:** `bin-utilization-optimization-enhanced.test.ts:17-31`

```typescript
describe('BinUtilizationOptimizationEnhancedService', () => {
  let service: BinUtilizationOptimizationEnhancedService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      end: jest.fn()
    } as any;

    service = new BinUtilizationOptimizationEnhancedService(mockPool);
  });

  afterEach(async () => {
    await service.close();
  });
```

**Pattern Characteristics:**
- Uses `describe` blocks for grouping related tests
- `beforeEach` for test isolation and setup
- `afterEach` for cleanup
- Mock database connections using `jest.fn()`
- Type-safe mocking with `jest.Mocked<T>`

### 4.2 Backend Integration Test Pattern

**Example from:** `tenant-isolation.spec.ts:35-93`

```typescript
describe('Tenant Isolation - Security Tests', () => {
  let app: INestApplication;
  let dbPool: Pool;
  let tenant1Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dbPool = app.get('DATABASE_POOL');

    // Create JWT tokens for different test scenarios
    tenant1Token = sign(
      { sub: USER_1_ID, email: 'user1@tenant1.com', ... },
      JWT_SECRET
    );
  });

  afterAll(async () => {
    await app.close();
  });
```

**Pattern Characteristics:**
- Uses NestJS Testing Module
- `beforeAll` for expensive setup (app initialization)
- Real database connections for integration testing
- JWT token generation for auth testing
- `afterAll` for proper cleanup

### 4.3 E2E Test Pattern (HTTP/GraphQL)

**Example from:** `tenant-isolation.spec.ts:100-110`

```typescript
it('should reject unauthenticated GraphQL requests', async () => {
  const response = await request(app.getHttpServer())
    .post('/graphql')
    .send({
      query: '{ workCenters(facilityId: "test-facility") { id } }',
    });

  expect(response.status).toBe(200); // GraphQL returns 200 even for errors
  expect(response.body.errors).toBeDefined();
  expect(response.body.errors[0].message).toContain('Unauthorized');
});
```

**Pattern Characteristics:**
- Uses `supertest` for HTTP testing
- Tests GraphQL endpoints directly
- Validates both success and error responses
- Checks error message content

### 4.4 Database RLS Testing Pattern

**Example from:** `tenant-isolation.spec.ts:290-324`

```typescript
it('should enforce RLS at database level', async () => {
  const client = await dbPool.connect();
  try {
    // Set tenant context for tenant 1
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_1_ID]);

    // Create test data for tenant 1
    await client.query(
      `INSERT INTO materials (tenant_id, material_code, material_name)
       VALUES ($1, 'MAT-TEST-001', 'Test Material')`,
      [TENANT_1_ID],
    );

    // Query should return the material
    const result1 = await client.query(
      `SELECT * FROM materials WHERE material_code = 'MAT-TEST-001'`,
    );
    expect(result1.rows.length).toBe(1);

    // Switch to tenant 2 context
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_2_ID]);

    // Query should return NO rows (RLS blocks access)
    const result2 = await client.query(
      `SELECT * FROM materials WHERE material_code = 'MAT-TEST-001'`,
    );
    expect(result2.rows.length).toBe(0);

    // Cleanup
    await client.query(`SET LOCAL app.current_tenant_id = $1`, [TENANT_1_ID]);
    await client.query(`DELETE FROM materials WHERE material_code = 'MAT-TEST-001'`);
  } finally {
    client.release();
  }
});
```

**Pattern Characteristics:**
- Direct database connection testing
- Tenant context switching via `SET LOCAL`
- Row-Level Security policy validation
- Proper connection release in `finally` block

### 4.5 Frontend Component Test Pattern

**Example from:** `KPICard.test.tsx:5-17`

```typescript
describe('KPICard', () => {
  const mockKPI: KPIData = {
    id: '1',
    name: 'Test KPI',
    currentValue: 85,
    targetValue: 100,
    unit: '%',
    trend: 'up',
    trendPercent: 5.2,
    sparklineData: [80, 82, 83, 84, 85],
    formula: 'Test Formula',
  };

  it('renders KPI name', () => {
    render(<KPICard kpi={mockKPI} />);
    expect(screen.getByText('Test KPI')).toBeDefined();
  });
```

**Pattern Characteristics:**
- Uses Vitest with React Testing Library
- Mock data objects for component props
- `screen` queries for finding elements
- Simple assertions on rendered content

### 4.6 Performance Benchmark Pattern

**Example from:** `bin-utilization-optimization-enhanced.test.ts:552-607`

```typescript
describe('Performance Benchmarks', () => {
  it('should process batch putaway in < 2 seconds for 50 items', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      materialId: `mat-${i}`,
      lotNumber: `LOT-${i}`,
      quantity: 10
    }));

    // Mock setup...

    const startTime = Date.now();
    await service.suggestBatchPutaway(items);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(2000); // Should complete in < 2 seconds
  }, 10000); // 10 second timeout
});
```

**Pattern Characteristics:**
- Performance assertions with time measurement
- Custom timeout for long-running tests
- Realistic data volumes (50 items)
- Clear performance SLA expectations

---

## 5. Critical Gaps Identified

### 5.1 Frontend Testing Gaps (Critical Priority)

**Missing Infrastructure:**
- React Testing Library not installed
- No testing utilities for Apollo Client mocking
- No Zustand store mocking utilities
- No MSW setup for API mocking
- No test setup file (vitest.setup.ts)

**Missing Test Coverage:**
- Pages: 0/12 pages tested
- Components: 1/30+ components tested
- Custom hooks: Not tested
- GraphQL queries: Not tested
- Store logic: Not tested
- Utilities: Not tested

**Impact:** Frontend bugs may reach production undetected

### 5.2 E2E Testing Gaps (High Priority)

**Missing Framework:**
- No Playwright configuration
- No Cypress configuration
- No E2E test directory structure
- No test data seeding utilities

**Missing Test Scenarios:**
- User authentication flows
- Sales order creation workflow
- Purchase order approval workflow
- WMS bin optimization workflow
- Multi-tenant data isolation validation
- GraphQL API integration tests

**Impact:** Integration issues between frontend/backend may be missed

### 5.3 Agent Backend Testing Gaps (High Priority)

**Complete Absence:**
- No test configuration files
- No testing dependencies installed
- Zero test files
- No test scripts in package.json

**Missing Coverage:**
- Strategic orchestrator service
- Proactive daemons (4 daemons)
- NATS message handling
- Agent listener service
- Workflow execution logic

**Impact:** Agent system failures may not be caught during development

### 5.4 Backend Module Coverage Gaps (Medium Priority)

**Untested Modules:**
- Finance Module (0 tests)
- Operations Module (0 tests)
- Monitoring Module (0 tests)
- 17 GraphQL Resolvers (0 tests)
- Health Controllers (0 tests)

**Impact:** Business logic errors may not be detected early

### 5.5 Test Infrastructure Gaps (Medium Priority)

**Missing Utilities:**
- No test data factories (e.g., @faker-js/faker integration)
- No database seeding utilities for tests
- No shared test fixtures
- No custom Jest matchers
- No test helpers for common operations

**Missing Documentation:**
- No testing best practices guide
- No test specification standards
- No contribution guidelines for tests

**Impact:** Inconsistent test quality and developer productivity loss

### 5.6 CI/CD Integration Gaps (Medium Priority)

**Missing Automation:**
- No GitHub Actions workflow for tests
- No pre-commit hooks for test execution
- No automated coverage reporting
- No test failure notifications

**Missing Quality Gates:**
- No coverage thresholds enforced
- No test execution required before merge
- No performance regression detection

**Impact:** Tests may not be run consistently, allowing failures to slip through

---

## 6. Recommended Testing Strategy

### 6.1 Testing Pyramid

```
           /\
          /E2E\           10% - Critical user journeys
         /------\
        /        \
       /Integration\ 30% - Module interactions, API contracts
      /------------\
     /              \
    /      Unit      \  60% - Business logic, utilities, services
   /------------------\
```

**Distribution Targets:**
- **Unit Tests:** 60% of total tests
  - Business logic validation
  - Service method testing
  - Utility function testing
  - Component logic testing

- **Integration Tests:** 30% of total tests
  - Database interaction testing
  - GraphQL API testing
  - Module communication testing
  - External service mocking

- **E2E Tests:** 10% of total tests
  - Critical user workflows
  - Cross-system integration
  - Authentication/Authorization flows
  - Data isolation validation

### 6.2 Test Coverage Targets

**Phase 1 (3 months):**
- Backend: 60% statement coverage
- Frontend: 50% statement coverage
- Agent Backend: 40% statement coverage
- E2E: 15 critical scenarios

**Phase 2 (6 months):**
- Backend: 75% statement coverage
- Frontend: 70% statement coverage
- Agent Backend: 60% statement coverage
- E2E: 30 critical scenarios

**Phase 3 (12 months):**
- Backend: 85% statement coverage
- Frontend: 80% statement coverage
- Agent Backend: 75% statement coverage
- E2E: 50 critical scenarios

### 6.3 Testing Standards

**Unit Test Standards:**
- Every service method must have at least one test
- Every business logic function must be tested
- Edge cases must be covered (null, empty, boundary values)
- Error handling must be tested
- Performance-critical code must have benchmark tests

**Integration Test Standards:**
- Every GraphQL resolver must have integration tests
- Database RLS policies must be validated
- Authentication/Authorization must be tested
- Multi-tenant isolation must be verified
- External API integrations must use mocking

**E2E Test Standards:**
- Every critical user workflow must have E2E coverage
- Cross-browser testing for frontend (Chrome, Firefox, Safari)
- Mobile responsive testing
- Accessibility testing (WCAG 2.1 AA)
- Performance testing (Lighthouse scores)

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1: Backend Test Infrastructure**
- [ ] Add missing testing dependencies (supertest, @faker-js/faker)
- [ ] Create test utilities directory structure
- [ ] Implement database test fixtures
- [ ] Create test data factories
- [ ] Document testing patterns

**Week 2: Frontend Test Infrastructure**
- [ ] Install React Testing Library
- [ ] Configure Vitest with proper setup file
- [ ] Add MSW for API mocking
- [ ] Create component test utilities
- [ ] Create mock Apollo Client setup

**Week 3: E2E Test Infrastructure**
- [ ] Install Playwright
- [ ] Configure Playwright for multi-tenant testing
- [ ] Create E2E test directory structure
- [ ] Set up test database seeding
- [ ] Create authentication helpers

**Week 4: Agent Backend Test Infrastructure**
- [ ] Add Jest configuration to agent-backend
- [ ] Install testing dependencies
- [ ] Create test utilities for NATS mocking
- [ ] Set up test scripts in package.json
- [ ] Document agent testing patterns

### Phase 2: Core Coverage (Weeks 5-12)

**Weeks 5-6: Backend Unit Tests**
- [ ] Finance Module service tests (5 services)
- [ ] Operations Module service tests (3 services)
- [ ] Monitoring Module service tests (2 services)
- [ ] GraphQL Resolver tests (17 resolvers)
- [ ] Controller tests (4 controllers)

**Weeks 7-8: Frontend Unit Tests**
- [ ] Common components (15 components)
- [ ] Layout components (5 components)
- [ ] Monitoring components (8 components)
- [ ] Custom hooks tests (if any)
- [ ] Utility function tests

**Weeks 9-10: Frontend Integration Tests**
- [ ] Page component tests (12 pages)
- [ ] Zustand store tests
- [ ] GraphQL query integration tests
- [ ] Router integration tests
- [ ] Error boundary tests

**Weeks 11-12: Agent Backend Tests**
- [ ] Strategic orchestrator tests
- [ ] Proactive daemon tests (4 daemons)
- [ ] NATS message handler tests
- [ ] Workflow execution tests
- [ ] Agent listener tests

### Phase 3: E2E & Advanced Testing (Weeks 13-16)

**Week 13: Critical E2E Scenarios**
- [ ] User authentication flow
- [ ] Sales order creation workflow
- [ ] Purchase order approval workflow
- [ ] WMS bin optimization workflow
- [ ] Tenant switching validation

**Week 14: Advanced E2E Scenarios**
- [ ] Quote automation workflow
- [ ] Forecasting workflow
- [ ] Vendor performance monitoring
- [ ] Multi-user concurrent testing
- [ ] Cross-tenant data isolation

**Week 15: Performance & Accessibility**
- [ ] Lighthouse performance testing
- [ ] WCAG 2.1 AA accessibility testing
- [ ] Load testing with k6
- [ ] Database query performance testing
- [ ] Frontend bundle size testing

**Week 16: CI/CD Integration**
- [ ] GitHub Actions workflow setup
- [ ] Pre-commit hooks configuration
- [ ] Coverage threshold enforcement
- [ ] Test result reporting (Codecov/Coveralls)
- [ ] Automated E2E testing on staging

### Phase 4: Optimization & Maintenance (Ongoing)

**Continuous Activities:**
- [ ] Monitor test execution time and optimize slow tests
- [ ] Maintain test data factories with realistic data
- [ ] Update tests when features change
- [ ] Review and improve test coverage weekly
- [ ] Conduct monthly test quality audits

---

## 8. Test Suite Architecture

### 8.1 Directory Structure

```
print-industry-erp/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── finance/
│   │   │   │   ├── services/
│   │   │   │   │   ├── __tests__/
│   │   │   │   │   │   ├── account.service.test.ts
│   │   │   │   │   │   └── journal.service.test.ts
│   │   │   ├── wms/
│   │   │   │   └── services/
│   │   │   │       └── __tests__/ (existing)
│   │   ├── graphql/
│   │   │   ├── resolvers/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── finance.resolver.test.ts
│   │   │   │   │   ├── wms.resolver.test.ts
│   │   │   │   │   └── operations.resolver.test.ts
│   │   ├── common/
│   │   │   ├── __tests__/ (existing)
│   ├── test/
│   │   ├── fixtures/
│   │   │   ├── tenant.fixtures.ts
│   │   │   ├── user.fixtures.ts
│   │   │   └── material.fixtures.ts
│   │   ├── factories/
│   │   │   ├── tenant.factory.ts
│   │   │   ├── sales-order.factory.ts
│   │   │   └── purchase-order.factory.ts
│   │   ├── utils/
│   │   │   ├── test-db.ts
│   │   │   ├── auth-helper.ts
│   │   │   └── graphql-helper.ts
│   │   ├── integration/
│   │   │   ├── finance/
│   │   │   ├── wms/
│   │   │   └── operations/
│   │   ├── security/
│   │   │   └── tenant-isolation.spec.ts (existing)
│   │   └── setup.ts
│   ├── jest.config.js
│   ├── jest.integration.config.js (new)
│   └── coverage/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── KPICard.test.tsx (existing)
│   │   │   │   │   ├── DataTable.test.tsx (new)
│   │   │   │   │   ├── Chart.test.tsx (new)
│   │   │   │   │   └── ErrorBoundary.test.tsx (new)
│   │   │   ├── layout/
│   │   │   │   ├── __tests__/
│   │   │   │   │   ├── Sidebar.test.tsx (new)
│   │   │   │   │   └── Breadcrumb.test.tsx (new)
│   │   ├── pages/
│   │   │   ├── __tests__/
│   │   │   │   ├── ExecutiveDashboard.test.tsx (new)
│   │   │   │   ├── OperationsDashboard.test.tsx (new)
│   │   │   │   └── PurchaseOrdersPage.test.tsx (new)
│   │   ├── store/
│   │   │   ├── __tests__/
│   │   │   │   └── appStore.test.ts (new)
│   │   ├── graphql/
│   │   │   ├── __tests__/
│   │   │   │   └── client.test.ts (new)
│   │   ├── test/
│   │   │   ├── setup.ts (new)
│   │   │   ├── mocks/
│   │   │   │   ├── apollo-client.ts (new)
│   │   │   │   ├── handlers.ts (MSW handlers)
│   │   │   │   └── zustand.ts (new)
│   │   │   └── utils/
│   │   │       ├── render.tsx (custom render)
│   │   │       └── test-utils.ts
│   ├── vitest.config.ts (enhanced)
│   ├── vitest.setup.ts (new)
│   └── coverage/
│
├── agent-backend/
│   ├── src/
│   │   ├── orchestration/
│   │   │   ├── __tests__/
│   │   │   │   ├── orchestrator.service.test.ts (new)
│   │   │   │   └── strategic-orchestrator.service.test.ts (new)
│   │   ├── proactive/
│   │   │   ├── __tests__/
│   │   │   │   ├── product-owner.daemon.test.ts (new)
│   │   │   │   ├── value-chain-expert.daemon.test.ts (new)
│   │   │   │   └── recovery-health-check.daemon.test.ts (new)
│   ├── test/
│   │   ├── fixtures/
│   │   │   └── nats-messages.fixtures.ts (new)
│   │   ├── utils/
│   │   │   ├── nats-mock.ts (new)
│   │   │   └── test-db.ts (new)
│   ├── jest.config.js (new)
│   └── coverage/
│
└── e2e/
    ├── tests/
    │   ├── auth/
    │   │   ├── login.spec.ts (new)
    │   │   ├── logout.spec.ts (new)
    │   │   └── tenant-switching.spec.ts (new)
    │   ├── sales/
    │   │   ├── order-creation.spec.ts (new)
    │   │   └── quote-automation.spec.ts (new)
    │   ├── procurement/
    │   │   ├── po-approval.spec.ts (new)
    │   │   └── vendor-management.spec.ts (new)
    │   ├── wms/
    │   │   ├── bin-optimization.spec.ts (new)
    │   │   └── inventory-tracking.spec.ts (new)
    │   └── monitoring/
    │       └── dashboard.spec.ts (new)
    ├── fixtures/
    │   ├── users.ts
    │   ├── tenants.ts
    │   └── test-data.sql
    ├── utils/
    │   ├── auth.ts
    │   ├── db-seeding.ts
    │   └── helpers.ts
    ├── playwright.config.ts (new)
    └── .env.test (new)
```

### 8.2 Test File Naming Conventions

**Unit Tests:**
- `*.test.ts` - Service/utility unit tests
- `*.test.tsx` - Component unit tests
- Location: Colocated in `__tests__/` next to source files

**Integration Tests:**
- `*.integration.test.ts` - Backend integration tests
- `*.spec.ts` - NestJS integration tests (using Test.createTestingModule)
- Location: `backend/test/integration/` or colocated

**E2E Tests:**
- `*.spec.ts` - Playwright E2E tests
- Location: `e2e/tests/`

**Fixtures:**
- `*.fixtures.ts` - Static test data
- `*.factory.ts` - Dynamic test data generators
- Location: `test/fixtures/` and `test/factories/`

### 8.3 Test Utilities Architecture

**Backend Test Utilities (`backend/test/utils/`):**

1. **test-db.ts** - Database testing utilities
   ```typescript
   export async function createTestTenant(): Promise<Tenant>
   export async function setTenantContext(tenantId: string): Promise<void>
   export async function cleanupTestData(): Promise<void>
   export async function seedTestData(scenario: string): Promise<void>
   ```

2. **auth-helper.ts** - Authentication utilities
   ```typescript
   export function generateJWT(userId: string, tenantId: string): string
   export function createTestUser(role: string): Promise<User>
   export function mockAuthGuard(): jest.Mock
   ```

3. **graphql-helper.ts** - GraphQL testing utilities
   ```typescript
   export async function executeQuery(query: string, variables?: any): Promise<any>
   export function mockGraphQLContext(userId: string): ExecutionContext
   ```

**Frontend Test Utilities (`frontend/src/test/utils/`):**

1. **render.tsx** - Custom render with providers
   ```typescript
   export function renderWithProviders(
     ui: React.ReactElement,
     options?: RenderOptions
   ): RenderResult
   ```

2. **test-utils.ts** - Common testing utilities
   ```typescript
   export function mockApolloClient(): ApolloClient
   export function mockZustandStore(): Store
   export function waitForGraphQL(): Promise<void>
   ```

**E2E Test Utilities (`e2e/utils/`):**

1. **auth.ts** - E2E authentication
   ```typescript
   export async function login(page: Page, credentials: Credentials): Promise<void>
   export async function switchTenant(page: Page, tenantId: string): Promise<void>
   ```

2. **db-seeding.ts** - Test data seeding
   ```typescript
   export async function seedDatabase(scenario: string): Promise<void>
   export async function cleanDatabase(): Promise<void>
   ```

---

## 9. Dependencies & Tools

### 9.1 Backend Testing Dependencies

**Required Additions to `backend/package.json`:**

```json
{
  "devDependencies": {
    // Already installed
    "jest": "^29.7.0",
    "ts-jest": "^29.4.6",
    "@nestjs/testing": "^11.1.10",
    "@types/jest": "^29.5.14",

    // New additions
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2",
    "@faker-js/faker": "^8.4.1",
    "jest-mock-extended": "^3.0.5",
    "testcontainers": "^10.4.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:integration": "jest --config jest.integration.config.js",
    "test:unit": "jest --testPathIgnorePatterns=integration"
  }
}
```

**New Configuration File:** `backend/jest.integration.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/integration'],
  testMatch: ['**/*.integration.test.ts', '**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverage: false, // Don't mix with unit test coverage
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 1, // Run integration tests serially
};
```

### 9.2 Frontend Testing Dependencies

**Required Additions to `frontend/package.json`:**

```json
{
  "devDependencies": {
    // Already installed
    "vitest": "^1.0.4",

    // New additions
    "@testing-library/react": "^14.1.2",
    "@testing-library/user-event": "^14.5.1",
    "@testing-library/jest-dom": "^6.1.5",
    "happy-dom": "^12.10.3",
    "vitest-canvas-mock": "^0.3.3",
    "msw": "^2.0.11",
    "@faker-js/faker": "^8.4.1"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

**New Configuration File:** `frontend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**New Setup File:** `frontend/src/test/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

// Start MSW server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => server.close());
```

### 9.3 E2E Testing Dependencies

**New Package:** `e2e/package.json`

```json
{
  "name": "agogsaas-e2e-tests",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug",
    "test:chrome": "playwright test --project=chromium",
    "test:firefox": "playwright test --project=firefox",
    "test:safari": "playwright test --project=webkit",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.1",
    "@faker-js/faker": "^8.4.1",
    "dotenv-cli": "^7.3.0",
    "pg": "^8.11.3"
  }
}
```

**Configuration File:** `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests serially for multi-tenant data isolation
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 9.4 Agent Backend Testing Dependencies

**Required Additions to `agent-backend/package.json`:**

```json
{
  "devDependencies": {
    // New additions
    "jest": "^29.7.0",
    "ts-jest": "^29.4.6",
    "@types/jest": "^29.5.14",
    "@faker-js/faker": "^8.4.1",
    "jest-mock-extended": "^3.0.5"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r ts-node/register node_modules/.bin/jest --runInBand"
  }
}
```

**New Configuration File:** `agent-backend/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 10000, // 10 seconds for NATS tests
};
```

### 9.5 CI/CD Integration

**GitHub Actions Workflow:** `.github/workflows/tests.yml`

```yaml
name: Tests

on:
  push:
    branches: [ main, develop, 'feat/**' ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: print-industry-erp/backend/package-lock.json

      - name: Install dependencies
        working-directory: print-industry-erp/backend
        run: npm ci

      - name: Run unit tests
        working-directory: print-industry-erp/backend
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./print-industry-erp/backend/coverage/lcov.info
          flags: backend-unit

  backend-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: agog_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      nats:
        image: nats:2.10
        ports:
          - 4222:4222

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run migrations
        working-directory: print-industry-erp/backend
        run: |
          npm ci
          # Run flyway migrations here

      - name: Run integration tests
        working-directory: print-industry-erp/backend
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/agog_test
          NATS_URL: nats://localhost:4222

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: print-industry-erp/frontend
        run: npm ci

      - name: Run tests
        working-directory: print-industry-erp/frontend
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./print-industry-erp/frontend/coverage/lcov.info
          flags: frontend

  agent-backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: print-industry-erp/agent-backend
        run: npm ci

      - name: Run tests
        working-directory: print-industry-erp/agent-backend
        run: npm run test:cov

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Playwright
        working-directory: e2e
        run: |
          npm ci
          npx playwright install --with-deps

      - name: Start services
        run: |
          docker-compose -f docker-compose.app.yml up -d
          # Wait for services to be ready

      - name: Run E2E tests
        working-directory: e2e
        run: npm test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

---

## 10. Success Metrics

### 10.1 Code Coverage Metrics

**Phase 1 Targets (3 months):**
- Backend statement coverage: 60%
- Frontend statement coverage: 50%
- Agent Backend statement coverage: 40%

**Phase 2 Targets (6 months):**
- Backend statement coverage: 75%
- Frontend statement coverage: 70%
- Agent Backend statement coverage: 60%

**Phase 3 Targets (12 months):**
- Backend statement coverage: 85%
- Frontend statement coverage: 80%
- Agent Backend statement coverage: 75%

### 10.2 Test Quantity Metrics

**Unit Tests:**
- Backend: 200+ unit tests (Phase 1), 400+ (Phase 2), 600+ (Phase 3)
- Frontend: 100+ unit tests (Phase 1), 200+ (Phase 2), 300+ (Phase 3)
- Agent Backend: 50+ unit tests (Phase 1), 100+ (Phase 2), 150+ (Phase 3)

**Integration Tests:**
- Backend: 50+ integration tests (Phase 1), 100+ (Phase 2), 150+ (Phase 3)
- Frontend: 30+ integration tests (Phase 1), 60+ (Phase 2), 90+ (Phase 3)

**E2E Tests:**
- 15 critical scenarios (Phase 1)
- 30 critical scenarios (Phase 2)
- 50 critical scenarios (Phase 3)

### 10.3 Quality Metrics

**Test Execution:**
- Unit tests: < 30 seconds (all suites)
- Integration tests: < 5 minutes (all suites)
- E2E tests: < 15 minutes (all scenarios)
- CI/CD pipeline: < 20 minutes (total)

**Test Reliability:**
- Flaky test rate: < 2%
- Test failure investigation time: < 1 hour average
- Test maintenance time: < 20% of development time

**Defect Detection:**
- Pre-production defect detection: > 85%
- Production defects caused by untested code: < 5%
- Regression defects: < 10%

### 10.4 Developer Experience Metrics

**Productivity:**
- Time to write test for new feature: < 30% of feature dev time
- Test debugging time: < 15% of total debugging time
- Developer test execution frequency: > 10 times per day

**Adoption:**
- PRs with test coverage: > 95%
- Developers running tests locally: 100%
- Test coverage trending: Upward trajectory

---

## Appendix A: GraphQL Schema Coverage

**Total GraphQL Schemas:** 19 files

| Schema File | Resolver Exists | Tests Exist | Priority |
|-------------|----------------|-------------|----------|
| finance.graphql | Yes | No | High |
| tenant.graphql | Yes | No | High |
| wms-optimization.graphql | Yes | No | Medium |
| wms-data-quality.graphql | Yes | No | Medium |
| forecasting.graphql | Yes | No | High |
| sales-quote-automation.graphql | Yes | No | High |
| vendor-performance.graphql | Yes | No | Medium |
| health.graphql | Yes | No | Low |
| test-data.graphql | Yes | No | Low |
| wms.graphql | Yes | No | High |
| po-approval-workflow.graphql | Yes | No | High |
| sales-materials.graphql | Yes | No | High |
| performance.graphql | Yes | No | Medium |
| estimating.graphql | Yes | No | Medium |
| job-costing.graphql | Yes | No | Medium |
| customer-portal.graphql | Yes | No | Low |
| spc.graphql | Yes | No | Low |
| operations.graphql | Yes | No | High |
| quality-hr-iot-security-marketplace-imposition.graphql | Yes | No | Low |

**Recommendation:** Prioritize testing for High priority schemas first (12 schemas)

---

## Appendix B: Sample Test Templates

### B.1 Backend Unit Test Template

**File:** `backend/src/modules/[module]/services/__tests__/[service].test.ts`

```typescript
/**
 * [Service Name] Unit Tests
 * REQ-[requirement-id]
 *
 * Test Coverage:
 * - [Feature 1]
 * - [Feature 2]
 * - [Feature 3]
 */

import { Pool } from 'pg';
import { [ServiceName] } from '../[service-name].service';

describe('[ServiceName]', () => {
  let service: [ServiceName];
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      end: jest.fn(),
      connect: jest.fn(),
    } as any;

    service = new [ServiceName](mockPool);
  });

  afterEach(async () => {
    await service.close?.();
  });

  describe('[method name]', () => {
    it('should [expected behavior]', async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({
        rows: [/* mock data */]
      } as any);

      // Act
      const result = await service.[methodName](/* params */);

      // Assert
      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      // Act & Assert
      await expect(service.[methodName](/* params */))
        .rejects
        .toThrow('Database error');
    });
  });
});
```

### B.2 Frontend Component Test Template

**File:** `frontend/src/components/[category]/__tests__/[Component].test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { [ComponentName] } from '../[ComponentName]';
import { renderWithProviders } from '@/test/utils/render';

describe('[ComponentName]', () => {
  it('renders correctly with default props', () => {
    render(<[ComponentName] />);

    expect(screen.getByRole('[role]')).toBeInTheDocument();
  });

  it('handles user interactions', async () => {
    const user = userEvent.setup();
    const onClickMock = vi.fn();

    render(<[ComponentName] onClick={onClickMock} />);

    const button = screen.getByRole('button', { name: /[text]/i });
    await user.click(button);

    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it('displays loading state', () => {
    render(<[ComponentName] isLoading={true} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with GraphQL data', async () => {
    renderWithProviders(<[ComponentName] />);

    await waitFor(() => {
      expect(screen.getByText('[expected text]')).toBeInTheDocument();
    });
  });
});
```

### B.3 E2E Test Template

**File:** `e2e/tests/[feature]/[workflow].spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { login, switchTenant } from '../utils/auth';
import { seedDatabase, cleanDatabase } from '../utils/db-seeding';

test.describe('[Feature Name] Workflow', () => {
  test.beforeAll(async () => {
    await seedDatabase('[scenario-name]');
  });

  test.afterAll(async () => {
    await cleanDatabase();
  });

  test('should complete [workflow name]', async ({ page }) => {
    // Login
    await login(page, {
      email: 'test@tenant1.com',
      password: 'test-password',
    });

    // Navigate to feature
    await page.goto('/[feature-path]');

    // Verify page loaded
    await expect(page.getByRole('heading', { name: /[heading]/i }))
      .toBeVisible();

    // Perform action
    await page.getByRole('button', { name: /[button text]/i }).click();

    // Fill form
    await page.getByLabel('[label]').fill('[value]');

    // Submit
    await page.getByRole('button', { name: /submit/i }).click();

    // Verify success
    await expect(page.getByText(/success/i)).toBeVisible();

    // Verify data was saved
    const element = page.getByText('[expected result]');
    await expect(element).toBeVisible();
  });

  test('should prevent cross-tenant access', async ({ page }) => {
    // Login as tenant 1
    await login(page, {
      email: 'user@tenant1.com',
      password: 'password',
    });

    // Try to access tenant 2 resource
    await page.goto('/[resource]/[tenant-2-id]');

    // Should show access denied
    await expect(page.getByText(/access denied|not found/i)).toBeVisible();
  });
});
```

---

## Appendix C: Test Data Factories

### C.1 Backend Test Factory Example

**File:** `backend/test/factories/sales-order.factory.ts`

```typescript
import { faker } from '@faker-js/faker';

export interface SalesOrderFactoryOptions {
  tenantId?: string;
  facilityId?: string;
  customerId?: string;
  status?: string;
}

export function createSalesOrder(options: SalesOrderFactoryOptions = {}) {
  return {
    tenant_id: options.tenantId || faker.string.uuid(),
    facility_id: options.facilityId || faker.string.uuid(),
    customer_id: options.customerId || faker.string.uuid(),
    order_number: faker.string.alphanumeric(10).toUpperCase(),
    order_date: faker.date.recent(),
    requested_ship_date: faker.date.soon(),
    status: options.status || 'PENDING',
    total_amount: faker.number.float({ min: 100, max: 10000, precision: 0.01 }),
    currency_code: 'USD',
    payment_terms: '30',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

export function createSalesOrderLine(orderId: string, options: any = {}) {
  return {
    order_id: orderId,
    material_id: options.materialId || faker.string.uuid(),
    quantity: options.quantity || faker.number.int({ min: 1, max: 100 }),
    unit_price: faker.number.float({ min: 10, max: 1000, precision: 0.01 }),
    line_total: 0, // Calculate from quantity * unit_price
    ...options,
  };
}
```

### C.2 Frontend Mock Data Example

**File:** `frontend/src/test/mocks/kpi-data.ts`

```typescript
import { faker } from '@faker-js/faker';
import { KPIData } from '@/types';

export function createMockKPI(overrides?: Partial<KPIData>): KPIData {
  const currentValue = faker.number.float({ min: 50, max: 150, precision: 0.1 });
  const targetValue = 100;
  const trendPercent = faker.number.float({ min: -10, max: 10, precision: 0.1 });

  return {
    id: faker.string.uuid(),
    name: faker.company.buzzPhrase(),
    currentValue,
    targetValue,
    unit: '%',
    trend: trendPercent > 0 ? 'up' : 'down',
    trendPercent: Math.abs(trendPercent),
    sparklineData: Array.from({ length: 10 }, () =>
      faker.number.float({ min: 80, max: 120, precision: 0.1 })
    ),
    formula: faker.lorem.sentence(),
    ...overrides,
  };
}

export function createMockKPIList(count: number = 5): KPIData[] {
  return Array.from({ length: count }, () => createMockKPI());
}
```

---

## Appendix D: MSW Handlers for Frontend

**File:** `frontend/src/test/mocks/handlers.ts`

```typescript
import { graphql, HttpResponse } from 'msw';
import { createMockKPI } from './kpi-data';

export const handlers = [
  // GraphQL: Get KPIs
  graphql.query('GetKPIs', ({ variables }) => {
    return HttpResponse.json({
      data: {
        kpis: createMockKPIList(5),
      },
    });
  }),

  // GraphQL: Get Work Centers
  graphql.query('GetWorkCenters', ({ variables }) => {
    return HttpResponse.json({
      data: {
        workCenters: [
          {
            id: '1',
            workCenterCode: 'WC-001',
            workCenterName: 'Test Work Center',
            facilityId: 'facility-1',
          },
        ],
      },
    });
  }),

  // GraphQL: Create Sales Order
  graphql.mutation('CreateSalesOrder', async ({ variables }) => {
    return HttpResponse.json({
      data: {
        createSalesOrder: {
          id: faker.string.uuid(),
          orderNumber: 'SO-12345',
          status: 'PENDING',
          ...variables.input,
        },
      },
    });
  }),
];
```

**File:** `frontend/src/test/mocks/server.ts`

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## Conclusion

This comprehensive research deliverable provides a complete roadmap for implementing a robust testing suite across the AgogSaaS Print Industry ERP system. The recommendations are based on:

1. **Thorough codebase analysis** - 16 existing test files reviewed
2. **Industry best practices** - Jest, Vitest, Playwright standards
3. **Multi-tenant architecture considerations** - Tenant isolation testing
4. **Realistic implementation timeline** - 16-week phased approach
5. **Measurable success criteria** - Coverage targets and quality metrics

**Next Steps for Marcus (Backend Developer):**

1. **Week 1-2:** Set up backend test infrastructure (fixtures, factories, utilities)
2. **Week 3-4:** Implement frontend test infrastructure (React Testing Library, MSW)
3. **Week 5-6:** Add E2E framework (Playwright)
4. **Week 7-8:** Begin core module testing (Finance, Operations)
5. **Week 9-16:** Continue with roadmap phases 2-4

**Critical Success Factors:**

- Executive buy-in for dedicated testing time
- Team training on testing best practices
- CI/CD integration from day one
- Consistent code review for test quality
- Regular coverage monitoring and gap analysis

---

**Files Referenced:**
- `backend/jest.config.js`
- `backend/package.json`
- `frontend/package.json`
- `agent-backend/package.json`
- `backend/src/modules/wms/services/__tests__/bin-utilization-optimization-enhanced.test.ts`
- `backend/test/security/tenant-isolation.spec.ts`
- `frontend/src/__tests__/KPICard.test.tsx`

**Research Completed By:** Cynthia (Research Analyst)
**Date:** December 30, 2024
**Total Analysis Time:** Comprehensive codebase exploration with Task agent
