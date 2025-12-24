@echo off
REM Start Host Agent Listener as a background service
REM Add to Task Scheduler: Run at startup, restart on failure

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend

set NATS_URL=nats://localhost:4223
set NATS_USER=agents
set NATS_PASSWORD=WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4

echo [%date% %time%] Starting Host Agent Listener... >> logs\listener.log 2>&1
tsx scripts/host-agent-listener.ts >> logs\listener.log 2>&1
