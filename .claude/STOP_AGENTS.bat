@echo off
REM ============================================================================
REM Stop AgogSaaS Agent Development System
REM ============================================================================

echo.
echo Stopping AgogSaaS Agent Development System...
echo.

cd /d "D:\GitHub\agogsaas\Implementation\print-industry-erp"
docker-compose -f docker-compose.agents.yml stop

echo.
echo ✅ Agent system stopped (containers preserved)
echo.
pause
