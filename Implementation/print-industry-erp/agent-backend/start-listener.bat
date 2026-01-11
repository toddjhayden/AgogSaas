@echo off
setlocal enabledelayedexpansion
REM ===================================================================
REM Host Agent Listener - MUST RUN ON WINDOWS HOST
REM ===================================================================
REM This spawns Claude CLI agents (cannot run in Docker)
REM Features:
REM   - Auto-restart on crash (5 second delay)
REM   - Log rotation when > 10MB
REM   - Can run standalone or via Task Scheduler
REM
REM SETUP: Create .env.local with NATS_PASSWORD (see docker-compose.app.yml)
REM ===================================================================

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend

REM Set NATS connection info
set NATS_URL=nats://localhost:4223
set NATS_USER=agents

REM Load NATS_PASSWORD from .env.local (gitignored)
if exist .env.local (
    for /f "tokens=1,* delims==" %%a in ('findstr /B "NATS_PASSWORD" .env.local') do set %%a=%%b
)

REM Check if password is set
if "%NATS_PASSWORD%"=="" (
    echo.
    echo ERROR: NATS_PASSWORD not set.
    echo.
    echo Create .env.local in this directory with:
    echo   NATS_PASSWORD=your_password_here
    echo.
    echo Find the password in: docker-compose.app.yml ^(NATS_PASSWORD setting^)
    echo.
    pause
    exit /b 1
)

REM Create logs directory if it doesn't exist
if not exist logs mkdir logs

echo.
echo ===================================================================
echo Host Agent Listener (Windows-only component)
echo ===================================================================
echo.
echo This service:
echo   - Listens for NATS stage.started events
echo   - Spawns Claude CLI agents on Windows host
echo   - Publishes agent deliverables back to NATS
echo   - Auto-restarts on crash
echo.
echo Press Ctrl+C to stop.
echo.

:restart
REM Log rotation: Archive if > 10MB
set LOG_FILE=logs\listener.log
set MAX_SIZE=10485760
if exist "%LOG_FILE%" (
    for %%A in ("%LOG_FILE%") do set FILE_SIZE=%%~zA
    if !FILE_SIZE! GTR %MAX_SIZE% (
        set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
        set TIMESTAMP=%TIMESTAMP: =0%
        move "%LOG_FILE%" "logs\listener-%TIMESTAMP%.log.archived" >nul 2>&1
        echo [%date% %time%] Rotated listener.log (exceeded 10MB)
    )
)

echo [%date% %time%] Starting Host Agent Listener...

tsx scripts/host-agent-listener.ts 2>&1 | powershell -Command "$input | Tee-Object -FilePath 'logs\listener.log' -Append"

echo.
echo [%date% %time%] Listener exited. Restarting in 5 seconds...
echo.
timeout /t 5 /nobreak > nul
goto restart
