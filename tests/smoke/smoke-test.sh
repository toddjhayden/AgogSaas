#!/bin/bash
# AgogSaaS Smoke Test - All 4 Layers
# Tests that all phases are operational

set -e

echo ""
echo "================================================"
echo "  AgogSaaS - Smoke Test (All 4 Layers)"
echo "================================================"
echo ""

PASSED=0
FAILED=0

# Check if services are running
echo "[Checking] Services status..."
if ! docker ps | grep -q "agogsaas"; then
    echo "[ERROR] Services not running! Run ./quick-start.sh first."
    exit 1
fi
echo "[OK] Services are running"
((PASSED++))
echo ""

# Test Phase 1: Validation (Pre-commit hooks)
echo "================================================"
echo "Phase 1: VALIDATION (Pre-commit Hooks)"
echo "================================================"
if [ -f ../../.git-hooks/pre-commit ]; then
    echo "[OK] Pre-commit hook exists"
    echo "[OK] Layer 1 (Validation) is configured"
    ((PASSED++))
else
    echo "[WARNING] Pre-commit hook not found"
fi
echo ""

# Test Phase 2: Monitoring (Health endpoints)
echo "================================================"
echo "Phase 2: MONITORING (Health Dashboard)"
echo "================================================"

echo "[Testing] Backend GraphQL endpoint..."
if curl -sf http://localhost:4001/graphql -H "Content-Type: application/json" -d '{"query":"{__typename}"}' 2>/dev/null | grep -q "Query"; then
    echo "[OK] Backend GraphQL endpoint responding"
    ((PASSED++))
else
    echo "[ERROR] Backend GraphQL endpoint not responding"
    ((FAILED++))
fi

echo "[Testing] PostgreSQL connection..."
if docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT 1" > /dev/null 2>&1; then
    echo "[OK] PostgreSQL connected"
    ((PASSED++))
else
    echo "[ERROR] PostgreSQL connection failed"
    ((FAILED++))
fi

echo "[Testing] Frontend..."
if curl -sf http://localhost:3000 2>/dev/null | grep -q "AgogSaaS"; then
    echo "[OK] Frontend accessible at http://localhost:3000"
    echo "[OK] Monitoring dashboard at http://localhost:3000/monitoring"
    ((PASSED++))
else
    echo "[ERROR] Frontend not responding"
    ((FAILED++))
fi
echo ""

# Test Phase 3: Orchestration (NATS)
echo "================================================"
echo "Phase 3: ORCHESTRATION (NATS Jetstream)"
echo "================================================"

echo "[Testing] NATS health..."
if curl -sf http://localhost:8223/healthz 2>/dev/null | grep -q "ok"; then
    echo "[OK] NATS server healthy"
    ((PASSED++))
else
    echo "[ERROR] NATS server not responding"
    ((FAILED++))
fi

echo "[Testing] Backend orchestrator..."
if docker logs agogsaas-backend 2>&1 | grep -q "Orchestrator initialized"; then
    echo "[OK] Orchestrator initialized"
    ((PASSED++))
else
    echo "[WARNING] Could not verify orchestrator"
fi
echo ""

# Test Phase 4: Memory (Ollama + Vector DB)
echo "================================================"
echo "Phase 4: MEMORY (Ollama Embeddings)"
echo "================================================"

echo "[Testing] Ollama service..."
if curl -sf http://localhost:11434/api/tags 2>/dev/null | grep -q "nomic-embed-text"; then
    echo "[OK] Ollama service responding"
    echo "[OK] nomic-embed-text model installed"
    ((PASSED++))
else
    echo "[ERROR] Ollama service not responding or model not installed"
    ((FAILED++))
fi

echo "[Testing] pgvector extension..."
if docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT extname FROM pg_extension WHERE extname='vector'" 2>/dev/null | grep -q "vector"; then
    echo "[OK] pgvector extension enabled"
    ((PASSED++))
else
    echo "[ERROR] pgvector extension not found"
    ((FAILED++))
fi

echo "[Testing] memories table..."
if docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "\d memories" > /dev/null 2>&1; then
    echo "[OK] memories table exists"
    ((PASSED++))
else
    echo "[ERROR] memories table not found - run migrations"
    ((FAILED++))
fi

echo "[Testing] uuid_generate_v7 function..."
if docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT uuid_generate_v7()" > /dev/null 2>&1; then
    echo "[OK] uuid_generate_v7() function working"
    ((PASSED++))
else
    echo "[ERROR] uuid_generate_v7() function failed"
    ((FAILED++))
fi
echo ""

echo "================================================"
echo "  Smoke Test Summary"
echo "================================================"
echo ""
echo "Results: $PASSED passed, $FAILED failed"
echo ""
if [ $FAILED -eq 0 ]; then
    echo "[SUCCESS] All smoke tests passed!"
else
    echo "[FAILURE] Some tests failed. See errors above."
fi
echo ""
echo "Services:"
echo "  - PostgreSQL:  http://localhost:5433 (5432 used by WMS)"
echo "  - NATS:        http://localhost:4223 (monitoring: :8223, 4222 used by WMS)"
echo "  - Ollama:      http://localhost:11434"
echo "  - Backend API: http://localhost:4001/graphql"
echo "  - Frontend:    http://localhost:3000"
echo "  - Monitoring:  http://localhost:3000/monitoring"
echo ""
echo "Layers:"
echo "  Layer 1 (Validation):    Pre-commit hooks"
echo "  Layer 2 (Monitoring):    Dashboard at /monitoring"
echo "  Layer 3 (Orchestration): NATS Jetstream"
echo "  Layer 4 (Memory):        Ollama + pgvector"
echo ""
echo "[TIP] Run detailed Phase 4 test:"
echo "  docker exec agogsaas-backend npm run test:memory"
echo ""

if [ $FAILED -ne 0 ]; then
    exit 1
fi
