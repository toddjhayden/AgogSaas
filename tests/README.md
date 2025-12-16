# AgogSaaS Testing

**📍 Navigation Path:** [AGOG Home](../README.md) → Testing

This directory contains all testing infrastructure for AgogSaaS.

---

## Test Organization

```
tests/
├── smoke/              # Smoke tests (quick validation)
│   ├── smoke-test.bat  # Windows smoke test
│   └── smoke-test.sh   # Linux/Mac smoke test
├── integration/        # Integration tests
└── e2e/               # End-to-end tests
```

---

## Quick Start

### Run Smoke Tests

**From repository root:**

Windows:
```bash
tests\smoke\smoke-test.bat
```

Linux/Mac:
```bash
./tests/smoke/smoke-test.sh
```

**What smoke tests check:**
- ✅ All Docker containers running
- ✅ Layer 1: Pre-commit hooks configured
- ✅ Layer 2: Backend API, Frontend, PostgreSQL, Monitoring
- ✅ Layer 3: NATS Jetstream, Orchestrator
- ✅ Layer 4: Ollama embeddings, pgvector, memories table

**Expected output:**
```
Results: 12 passed, 0 failed
[SUCCESS] All smoke tests passed!
```

---

## Test Types

### Smoke Tests (tests/smoke/)

**Purpose:** Quick validation that all major components are operational

**When to run:**
- After starting services (`docker-compose up`)
- After making configuration changes
- Before committing code
- As part of CI/CD pipeline

**Runtime:** ~10 seconds

---

### Integration Tests (tests/integration/)

**Purpose:** Test interactions between components

**Examples:**
- Backend → Database queries
- Backend → NATS messaging
- Backend → Ollama embeddings
- GraphQL resolver chains

**Status:** TODO - Not yet implemented

---

### End-to-End Tests (tests/e2e/)

**Purpose:** Test complete user workflows

**Examples:**
- User creates feature request
- Agents research and implement
- QA validates
- Analytics report generated

**Status:** TODO - Not yet implemented

---

## Phase-Specific Tests

### Phase 4 Memory Test

**Run detailed memory system test:**
```bash
docker exec agogsaas-backend npm run test:memory
```

**Location:** `Implementation/print-industry-erp/backend/scripts/test-phase4-memory.ts`

**What it tests:**
1. ✅ Store memories with embeddings
2. ✅ Semantic search with relevance scoring
3. ✅ Agent-specific filtering
4. ✅ Memory type filtering
5. ✅ Recent memory retrieval

---

## Writing Tests

### Smoke Test Guidelines

Smoke tests should:
- ✅ Be fast (<30 seconds total)
- ✅ Test one thing per check
- ✅ Return clear PASS/FAIL status
- ✅ Provide actionable error messages
- ✅ Work without manual setup

Example check:
```batch
echo [Testing] PostgreSQL connection...
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT 1" >nul 2>&1
if !errorlevel! == 0 (
    echo [OK] PostgreSQL connected
    set /a PASSED+=1
) else (
    echo [ERROR] PostgreSQL connection failed
    set /a FAILED+=1
)
```

---

## CI/CD Integration

### GitHub Actions (Future)

```yaml
name: Smoke Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Start services
        run: ./quick-start.sh
      - name: Run smoke tests
        run: ./tests/smoke/smoke-test.sh
```

---

## Troubleshooting

### Smoke Test Fails

1. **Check services are running:**
   ```bash
   docker ps | grep agogsaas
   ```

2. **Check logs:**
   ```bash
   docker logs agogsaas-backend
   docker logs agogsaas-postgres
   ```

3. **Restart services:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

4. **Re-run smoke test:**
   ```bash
   tests\smoke\smoke-test.bat
   ```

---

## Test Results Documentation

Test results are documented in:
- `docs/SYSTEM_TEST_RESULTS_2025-12-10.md` - Latest test results
- `docs/REPOSITORY_AUDIT_2025-12-10.md` - Repository structure validation

---

[⬆ Back to top](#agogsaas-testing) | [🏠 AGOG Home](../README.md) | [📚 Docs](../docs/README.md)
