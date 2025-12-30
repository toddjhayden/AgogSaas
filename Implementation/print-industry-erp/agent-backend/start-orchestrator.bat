@echo off
REM Start Strategic Orchestrator - NOW RUNS IN DOCKER
REM This bat file just ensures Docker container is running

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp

echo [%date% %time%] Starting agent-backend Docker container (contains Strategic Orchestrator)...
docker-compose -f docker-compose.agents.yml up -d agent-backend

echo Strategic Orchestrator is running in Docker container: agogsaas-agents-backend
echo Check logs: docker logs -f agogsaas-agents-backend
echo.
echo To view running daemons:
echo   - Strategic Orchestrator (scans OWNER_REQUESTS.md)
echo   - Heartbeat Monitor (Gap Fix #5)
echo   - State Reconciliation (Gap Fix #13)
echo   - Agent Error Monitor (Gap Fix #9)
pause
