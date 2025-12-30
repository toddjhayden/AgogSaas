@echo off
REM Test Recovery and Value Chain Daemons - NOW IN DOCKER
REM This was for testing - now use Docker instead

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp

echo.
echo ===================================================================
echo Recovery and Value Chain daemons are now in Docker
echo ===================================================================
echo.
echo This bat file is DEPRECATED - all daemons run in Docker now.
echo.
echo To start the system:
echo   1. docker-compose -f docker-compose.agents.yml up -d
echo   2. Run start-listener.bat (for Windows host listener)
echo.
echo To view logs:
echo   docker logs -f agogsaas-agents-backend
echo.
pause
