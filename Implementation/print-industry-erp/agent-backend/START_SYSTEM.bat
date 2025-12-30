@echo off
REM ===================================================================
REM AGOG AGENTIC SYSTEM - MASTER STARTUP SCRIPT
REM ===================================================================
REM
REM This starts the complete multi-agent workflow system with all
REM 16 deployed gap fixes for workflow recovery and monitoring.
REM
REM ===================================================================

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp

echo.
echo ===================================================================
echo AGOG AGENTIC SYSTEM STARTUP
echo ===================================================================
echo.
echo This will start:
echo   1. Docker containers (NATS, PostgreSQL, agent-backend)
echo   2. Windows Host Listener (spawns Claude CLI agents)
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
echo [STEP 1] Starting Docker containers...
echo.
docker-compose -f docker-compose.agents.yml up -d

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
echo   - agogsaas-agents-postgres (workflow persistence)
echo   - agogsaas-agents-backend (orchestrator + daemons)
echo.
echo Waiting 5 seconds for containers to initialize...
timeout /t 5 /nobreak > nul

echo.
echo [STEP 2] Starting Windows Host Listener...
echo.
echo The Host Listener will run in this window.
echo Press Ctrl+C to stop the entire system.
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak > nul

echo.
echo ===================================================================
echo HOST LISTENER RUNNING
echo ===================================================================
echo.

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend

set NATS_URL=nats://localhost:4223
set NATS_USER=agents
REM NATS_PASSWORD must be set in environment before running this script
REM or loaded from .env file: for /f "tokens=1,2 delims==" %%a in (.env) do set %%a=%%b
if "%NATS_PASSWORD%"=="" (
    echo ERROR: NATS_PASSWORD environment variable is required
    echo Set it before running: set NATS_PASSWORD=your_password
    pause
    exit /b 1
)

tsx scripts/host-agent-listener.ts
