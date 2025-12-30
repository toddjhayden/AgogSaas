@echo off
REM All daemons NOW RUN IN DOCKER (agogsaas-agents-backend)
REM This bat file just ensures Docker is running

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp

echo [%date% %time%] Starting all daemons via Docker...
docker-compose -f docker-compose.agents.yml up -d

echo.
echo ===================================================================
echo All daemons are running in Docker container: agogsaas-agents-backend
echo ===================================================================
echo.
echo Running daemons:
echo   - Strategic Orchestrator (scans OWNER_REQUESTS.md every 60s)
echo   - Progress Monitor (checks IN_PROGRESS every 30s)
echo   - Heartbeat Monitor (checks workflows every 2 min)
echo   - State Reconciliation (syncs NATS/file every 5 min)
echo   - Agent Error Monitor (handles agent failures)
echo   - Berry Auto-Deploy (auto-deploys on Billy PASS)
echo   - Deployment Executor (runs deployments)
echo   - Health Monitor (system health checks)
echo.
echo Check logs: docker logs -f agogsaas-agents-backend
echo.
pause
