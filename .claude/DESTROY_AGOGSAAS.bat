@echo off
REM ============================================================================
REM AgogSaaS Complete System DESTROY (Separated Architecture v2.0)
REM ============================================================================
REM WARNING: This removes ALL containers and optionally volumes (DATA LOSS!)
REM Only use this when you want to completely reset the system
REM
REM This will destroy:
REM   1. Application Stack (PostgreSQL, Backend, Frontend, Ollama)
REM   2. Agent Development System (NATS, Strategic Orchestrator)
REM   3. Optionally: All volumes (database data, NATS history, etc.)
REM
REM Usage: Double-click this file or run from command line
REM Location: D:\GitHub\agogsaas\.claude\DESTROY_AGOGSAAS.bat
REM ============================================================================

echo.
echo ============================================================================
echo   AgogSaaS Complete System DESTROY (v2.0)
echo ============================================================================
echo.
echo WARNING: This will REMOVE all containers from BOTH systems!
echo   - Application Stack (PostgreSQL + Backend + Frontend)
echo   - Agent Development System (NATS + Orchestrator)
echo.
set /p CONFIRM="Are you sure? Type YES to continue: "

if not "%CONFIRM%"=="YES" (
    echo Cancelled.
    pause
    exit /b 0
)

REM Change to project root
cd /d "D:\GitHub\agogsaas\Implementation\print-industry-erp"

echo.
echo [1/2] Removing AGENT DEVELOPMENT system containers...
docker-compose -f docker-compose.agents.yml down
if %errorlevel% neq 0 (
    echo ERROR: Failed to remove agent system containers
) else (
    echo     ✓ Agent system containers removed
)

echo.
echo [2/2] Removing APPLICATION stack containers...
docker-compose -f docker-compose.app.yml down
if %errorlevel% neq 0 (
    echo ERROR: Failed to remove application containers
) else (
    echo     ✓ Application containers removed
)

echo.
echo ============================================================================
echo   Containers Removed
echo ============================================================================
echo.
set /p REMOVE_VOLUMES="Remove volumes too (DATA LOSS - Database + NATS history!)? Type YES: "

if "%REMOVE_VOLUMES%"=="YES" (
    echo.
    echo Removing volumes...
    docker-compose -f docker-compose.agents.yml down -v
    docker-compose -f docker-compose.app.yml down -v
    echo     ✓ All volumes removed
    echo.
    echo LOST DATA:
    echo   - PostgreSQL database (all business data)
    echo   - NATS deliverables (all agent workflow history)
    echo   - Ollama models (will re-download on next start)
    echo   - All node_modules caches
) else (
    echo.
    echo Volumes preserved. Your data is safe:
    echo   - PostgreSQL database
    echo   - NATS deliverables
    echo   - Ollama models
)

echo.
echo ============================================================================
echo   AgogSaaS System Destroyed!
echo ============================================================================
echo.
echo To start fresh:
echo   - RUN_APPLICATION.bat (for application)
echo   - RUN_AGENTS.bat (for agent system)
echo.
pause
