@echo off
REM ============================================================================
REM Stop AgogSaaS ERP Application
REM ============================================================================

echo.
echo Stopping AgogSaaS ERP Application...
echo.

cd /d "D:\GitHub\agogsaas\Implementation\print-industry-erp"
docker-compose -f docker-compose.app.yml stop

echo.
echo ✅ Application stopped (containers preserved)
echo.
pause
