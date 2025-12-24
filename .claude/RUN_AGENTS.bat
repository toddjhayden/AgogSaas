@echo off
REM ============================================================================
REM AgogSaaS Agent Development System - Start/Stop
REM ============================================================================
REM This runs the DEVELOPMENT-ONLY agent orchestration system
REM NEVER deployed to production - local/CI only
REM
REM Use this for:
REM   - Automated feature development
REM   - Processing OWNER_REQUESTS.md
REM   - Agent workflow orchestration
REM
REM Location: D:\GitHub\agogsaas\.claude\RUN_AGENTS.bat
REM ============================================================================

echo.
echo ============================================================================
echo   AgogSaaS Agent Development System
echo   DEVELOPMENT ONLY - Never deployed to production
echo ============================================================================
echo.

cd /d "D:\GitHub\agogsaas\Implementation\print-industry-erp"

echo [1/1] Starting Agent Orchestration System (Agent DB + NATS + Ollama + Backend)...
echo.
docker-compose -f docker-compose.agents.yml up -d

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start agent system
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   AgogSaaS Agent System Started
echo ============================================================================
echo.
echo Services Running:
echo   - Agent PostgreSQL:     localhost:5434 (pgvector for memory/embeddings)
echo   - NATS Jetstream:       localhost:4223 (client), localhost:8223 (monitoring)
echo   - Ollama AI:            localhost:11434 (model server)
echo   - Agent Backend:        localhost:4002
echo   - Strategic Orchestrator: Running
echo.
echo Monitoring:
echo   - NATS Monitor:         http://localhost:8223
echo   - OWNER_REQUESTS.md:    Scanned every 60 seconds
echo   - Agent Deliverables:   backend/agent-output/deliverables/
echo.
echo Agent Workflow:
echo   1. Edit project-spirit/owner_requests/OWNER_REQUESTS.md
echo   2. Set Status: NEW
echo   3. Save file
echo   4. Orchestrator spawns: Cynthia → Sylvia → Roy → Jen → Billy → Priya
echo.
echo To STOP the agent system:
echo   docker-compose -f docker-compose.agents.yml stop
echo.
echo To view orchestrator logs:
echo   docker-compose -f docker-compose.agents.yml logs -f agent-backend
echo.
echo ============================================================================
echo.
pause
