@echo off
REM Start Host Agent Listener - MUST RUN ON WINDOWS HOST
REM This spawns Claude CLI agents (cannot run in Docker)
REM Add to Task Scheduler: Run at startup, restart on failure

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend

set NATS_URL=nats://localhost:4223
set NATS_USER=agents
set NATS_PASSWORD=WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4

echo.
echo ===================================================================
echo Starting Host Agent Listener (Windows-only component)
echo ===================================================================
echo.
echo This service:
echo   - Listens for NATS stage.started events
echo   - Spawns Claude CLI agents on Windows host
echo   - Publishes agent deliverables back to NATS
echo.
echo [%date% %time%] Starting Host Agent Listener...
echo.

tsx scripts/host-agent-listener.ts >> logs\listener.log 2>&1
