@echo off
REM ===================================================================
REM AGOG AGENTIC SYSTEM - SHUTDOWN SCRIPT
REM ===================================================================

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp

echo.
echo ===================================================================
echo STOPPING AGOG AGENTIC SYSTEM
echo ===================================================================
echo.
echo This will:
echo   1. Stop Docker containers (agent-backend, NATS, PostgreSQL)
echo   2. Kill any running Host Listener processes
echo.
pause

echo.
echo [STEP 1] Stopping Docker containers...
echo.
docker-compose -f docker-compose.agents.yml down

if errorlevel 1 (
    echo.
    echo WARNING: Error stopping Docker containers
    echo They may already be stopped.
) else (
    echo.
    echo Docker containers stopped successfully.
)

echo.
echo [STEP 2] Killing Host Listener processes...
echo.
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *host-agent-listener*" 2>nul
if errorlevel 1 (
    echo No Host Listener processes found (already stopped).
) else (
    echo Host Listener processes terminated.
)

echo.
echo ===================================================================
echo SYSTEM STOPPED
echo ===================================================================
echo.
echo All AGOG agentic system components have been stopped.
echo.
echo To restart: Run START_SYSTEM.bat
echo.
pause
