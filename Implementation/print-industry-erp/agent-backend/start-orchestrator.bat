@echo off
REM Start Strategic Orchestrator as a background service
REM Add to Task Scheduler: Run at startup, restart on failure

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend

set NATS_URL=nats://localhost:4223
set NATS_USER=agents
set NATS_PASSWORD=WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4
set OWNER_REQUESTS_PATH=D:/GitHub/agogsaas/project-spirit/owner_requests/OWNER_REQUESTS.md

echo [%date% %time%] Starting Strategic Orchestrator... >> logs\orchestrator.log 2>&1
tsx scripts/start-strategic-orchestrator.ts >> logs\orchestrator.log 2>&1
