@echo off
REM Start all proactive daemons in background
REM Add this to Windows Task Scheduler to run at system startup

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend

REM Set environment variables
set NATS_URL=nats://localhost:4223
set NATS_USER=agents
set NATS_PASSWORD=WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4
set OWNER_REQUESTS_PATH=D:/GitHub/agogsaas/project-spirit/owner_requests/OWNER_REQUESTS.md

REM Start proactive daemons (includes Recovery)
start /B tsx scripts/start-all-services.ts >> logs/daemons.log 2>&1

echo Daemons started. Logs: logs/daemons.log
