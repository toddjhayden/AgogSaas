@echo off
REM AgogSaaS Smoke Test - All 4 Layers
REM Tests that all phases are operational

setlocal enabledelayedexpansion

echo.
echo ================================================
echo   AgogSaaS - Smoke Test (All 4 Layers)
echo ================================================
echo.

set PASSED=0
set FAILED=0

REM Check if services are running
echo [Checking] Services status...
docker ps 2>nul | findstr "agogsaas" >nul
if !errorlevel! neq 0 (
    echo [ERROR] Services not running! Run quick-start.bat first.
    exit /b 1
)
echo [OK] Services are running
set /a PASSED+=1
echo.

REM Test Phase 1: Validation (Pre-commit hooks)
echo ================================================
echo Phase 1: VALIDATION (Pre-commit Hooks)
echo ================================================
if exist ..\..\..git-hooks\pre-commit (
    echo [OK] Pre-commit hook exists
    echo [OK] Layer 1 (Validation) is configured
    set /a PASSED+=1
) else (
    echo [WARNING] Pre-commit hook not found
)
echo.

REM Test Phase 2: Monitoring (Health endpoints)
echo ================================================
echo Phase 2: MONITORING (Health Dashboard)
echo ================================================

echo [Testing] Backend GraphQL endpoint...
curl -s http://localhost:4001/graphql -H "Content-Type: application/json" -d "{\"query\":\"{__typename}\"}" 2>nul | findstr "Query" >nul
if !errorlevel! == 0 (
    echo [OK] Backend GraphQL endpoint responding
    set /a PASSED+=1
) else (
    echo [ERROR] Backend GraphQL endpoint not responding
    set /a FAILED+=1
)

echo [Testing] PostgreSQL connection...
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT 1" >nul 2>&1
if !errorlevel! == 0 (
    echo [OK] PostgreSQL connected
    set /a PASSED+=1
) else (
    echo [ERROR] PostgreSQL connection failed
    set /a FAILED+=1
)

echo [Testing] Frontend...
curl -s http://localhost:3000 2>nul | findstr "AgogSaaS" >nul
if !errorlevel! == 0 (
    echo [OK] Frontend accessible at http://localhost:3000
    echo [OK] Monitoring dashboard at http://localhost:3000/monitoring
    set /a PASSED+=1
) else (
    echo [ERROR] Frontend not responding
    set /a FAILED+=1
)
echo.

REM Test Phase 3: Orchestration (NATS)
echo ================================================
echo Phase 3: ORCHESTRATION (NATS Jetstream)
echo ================================================

echo [Testing] NATS health...
curl -s http://localhost:8223/healthz 2>nul | findstr "ok" >nul
if !errorlevel! == 0 (
    echo [OK] NATS server healthy
    set /a PASSED+=1
) else (
    echo [ERROR] NATS server not responding
    set /a FAILED+=1
)

echo [Testing] Backend orchestrator...
docker logs agogsaas-backend 2>&1 | findstr "Orchestrator initialized" >nul
if !errorlevel! == 0 (
    echo [OK] Orchestrator initialized
    set /a PASSED+=1
) else (
    echo [WARNING] Could not verify orchestrator
)
echo.

REM Test Phase 4: Memory (Ollama + Vector DB)
echo ================================================
echo Phase 4: MEMORY (Ollama Embeddings)
echo ================================================

echo [Testing] Ollama service...
curl -s http://localhost:11434/api/tags 2>nul | findstr "nomic-embed-text" >nul
if !errorlevel! == 0 (
    echo [OK] Ollama service responding
    echo [OK] nomic-embed-text model installed
    set /a PASSED+=1
) else (
    echo [ERROR] Ollama service not responding or model not installed
    set /a FAILED+=1
)

echo [Testing] pgvector extension...
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT extname FROM pg_extension WHERE extname='vector'" 2>nul | findstr "vector" >nul
if !errorlevel! == 0 (
    echo [OK] pgvector extension enabled
    set /a PASSED+=1
) else (
    echo [ERROR] pgvector extension not found
    set /a FAILED+=1
)

echo [Testing] memories table...
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "\d memories" >nul 2>&1
if !errorlevel! == 0 (
    echo [OK] memories table exists
    set /a PASSED+=1
) else (
    echo [ERROR] memories table not found - run migrations
    set /a FAILED+=1
)

echo [Testing] uuid_generate_v7 function...
docker exec agogsaas-postgres psql -U agogsaas_user -d agogsaas -c "SELECT uuid_generate_v7()" >nul 2>&1
if !errorlevel! == 0 (
    echo [OK] uuid_generate_v7() function working
    set /a PASSED+=1
) else (
    echo [ERROR] uuid_generate_v7() function failed
    set /a FAILED+=1
)
echo.

echo ================================================
echo   Smoke Test Summary
echo ================================================
echo.
echo Results: %PASSED% passed, %FAILED% failed
echo.
if !FAILED! == 0 (
    echo [SUCCESS] All smoke tests passed!
) else (
    echo [FAILURE] Some tests failed. See errors above.
)
echo.
echo Services:
echo   - PostgreSQL:  http://localhost:5433 (5432 used by WMS)
echo   - NATS:        http://localhost:4223 (monitoring: :8223, 4222 used by WMS)
echo   - Ollama:      http://localhost:11434
echo   - Backend API: http://localhost:4001/graphql
echo   - Frontend:    http://localhost:3000
echo   - Monitoring:  http://localhost:3000/monitoring
echo.
echo Layers:
echo   Layer 1 (Validation):    Pre-commit hooks
echo   Layer 2 (Monitoring):    Dashboard at /monitoring
echo   Layer 3 (Orchestration): NATS Jetstream
echo   Layer 4 (Memory):        Ollama + pgvector
echo.
echo [TIP] Run detailed Phase 4 test:
echo   docker exec agogsaas-backend npm run test:memory
echo.

if !FAILED! neq 0 (
    exit /b 1
)
