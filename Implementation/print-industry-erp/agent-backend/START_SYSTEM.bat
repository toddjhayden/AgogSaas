@echo off
REM ===================================================================
REM AGOG AGENTIC SYSTEM - MASTER STARTUP SCRIPT (VPS SDLC MODE)
REM ===================================================================
REM
REM This starts the complete multi-agent workflow system using the
REM VPS-hosted SDLC Control API (api.agog.fyi) instead of local database.
REM
REM SDLC Services on VPS:
REM   - API: https://api.agog.fyi
REM   - GUI: https://sdlc.agog.fyi
REM
REM ===================================================================

cd /d D:\GitHub\agogsaas

REM Set NATS connection info
set NATS_URL=nats://localhost:4223
set NATS_USER=agents

REM SDLC Cloud API Configuration
set SDLC_API_URL=https://api.agog.fyi
set SDLC_AGENT_ID=local-orchestrator

REM Load NATS_PASSWORD from .env.local in agent-backend (gitignored)
if exist "D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\.env.local" (
    for /f "tokens=1,* delims==" %%a in ('findstr /B "NATS_PASSWORD" "D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\.env.local"') do set %%a=%%b
)

if "%NATS_PASSWORD%"=="" (
    echo.
    echo ERROR: NATS_PASSWORD not set.
    echo Create agent-backend\.env.local with: NATS_PASSWORD=your_password
    echo Find password in: docker-compose.app.yml
    pause
    exit /b 1
)

REM Host-side scripts use localhost for Ollama (Docker exposes port 11434)
set HOST_OLLAMA_URL=http://localhost:11434

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp

echo.
echo ===================================================================
echo AGOG AGENTIC SYSTEM STARTUP (VPS SDLC MODE)
echo ===================================================================
echo.
echo SDLC Control is hosted on VPS:
echo   - API: https://api.agog.fyi
echo   - GUI: https://sdlc.agog.fyi
echo.
echo This will start locally:
echo   1. Docker containers (NATS, Agent PostgreSQL, Ollama)
echo   2. Windows Host Listener (spawns Claude CLI agents)
echo.
echo NOTE: Local SDLC database is NOT started - using VPS instead.
echo.
echo System includes 16 deployed gap fixes:
echo   - Timeout reductions (1 hour max)
echo   - Heartbeat monitoring (every 2 min)
echo   - State reconciliation (every 5 min)
echo   - Concurrency limiting (max 5 workflows)
echo   - Agent error monitoring
echo   - Billy retry limit (max 3)
echo   - Deliverable validation
echo   - Recursion prevention (max depth 3)
echo   - And 8 more...
echo.


echo.
echo [STEP 1] Starting Docker containers (VPS mode - no local SDLC DB)...
echo.
REM Use VPS-mode compose file (excludes sdlc-db)
docker-compose -f docker-compose.agents-vps.yml up -d nats agent-postgres ollama

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start Docker containers!
    echo Check that Docker Desktop is running.
    pause
    exit /b 1
)

echo.
echo Docker containers started successfully:
echo   - agogsaas-agents-nats (NATS message queue)
echo   - agogsaas-agents-postgres (port 5434 - workflow persistence)
echo   - agogsaas-agents-ollama (port 11434 - AI models)
echo.
echo Waiting for containers to initialize...
timeout /t 10 /nobreak > nul

echo.
echo [STEP 1b] Starting Agent Backend (Strategic Orchestrator + Daemons)...
echo.
docker-compose -f docker-compose.agents-vps.yml up -d agent-backend

if errorlevel 1 (
    echo.
    echo WARNING: Failed to start agent-backend container.
    echo The orchestrator will not poll for new requests automatically.
    timeout /t 3 /nobreak > nul
) else (
    echo Agent Backend started successfully:
    echo   - agogsaas-agents-backend (Strategic Orchestrator, Recommendation Publisher)
    echo   - Uses VPS SDLC API at https://api.agog.fyi
)
echo.
echo NOT started (using VPS instead):
echo   - agogsaas-sdlc-postgres (SDLC database on VPS)
echo.
echo Waiting for agent-backend to initialize...
timeout /t 5 /nobreak > nul

echo.
echo [STEP 2] Verifying VPS SDLC API connectivity...
echo.
curl -s --max-time 5 https://api.agog.fyi/api/agent/health > nul 2>&1
if errorlevel 1 (
    echo WARNING: Could not reach VPS SDLC API at https://api.agog.fyi
    echo The system will continue but SDLC operations may fail.
    echo Check your internet connection or VPS status.
    timeout /t 3 /nobreak > nul
) else (
    echo VPS SDLC API is reachable: https://api.agog.fyi
)

echo.
echo [STEP 3] Starting Windows Host Listener...
echo.
echo The Host Listener will run in this window.
echo Press Ctrl+C to stop the entire system.
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak > nul

echo.
echo ===================================================================
echo SYSTEM RUNNING (VPS SDLC MODE)
echo ===================================================================
echo.
echo VPS Services (cloud-hosted):
echo   - SDLC Control GUI:  https://sdlc.agog.fyi
echo   - SDLC REST API:     https://api.agog.fyi/api/agent/health
echo.
echo Local Services:
echo   - NATS Monitoring:   http://localhost:8223
echo   - Host Listener:     Running in this window
echo.

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend

tsx scripts/host-agent-listener.ts

echo.
echo Host Listener exited.
pause
