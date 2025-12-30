@echo off
REM ============================================================================
REM AgogSaaS ERP Application - Start/Stop
REM ============================================================================
REM This runs the PRODUCTION ERP application ONLY
REM NO AGENT DEPENDENCIES - Portable Edge/Cloud deployment
REM
REM Use this for:
REM   - Testing the actual ERP application
REM   - Production deployments (Edge/Cloud/Global)
REM   - User acceptance testing
REM
REM Location: D:\GitHub\agogsaas\.claude\RUN_APPLICATION.bat
REM ============================================================================

echo.
echo ============================================================================
echo   AgogSaaS ERP Application
echo   Portable Deployment - NO Agent Dependencies
echo ============================================================================
echo.

cd /d "D:\GitHub\agogsaas\Implementation\print-industry-erp"

echo [1/1] Starting ERP Application (PostgreSQL + Backend + Frontend)...
echo.
docker-compose -f docker-compose.app.yml up -d

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to start application
    pause
    exit /b 1
)

echo.
echo ============================================================================
echo   AgogSaaS ERP Application Started
echo ============================================================================
echo.
echo Services Running (3 containers):
echo   - PostgreSQL Database:  localhost:5433
echo   - GraphQL API:          http://localhost:4000/graphql
echo   - Frontend Application: http://localhost:3000
echo   - Monitoring Dashboard: http://localhost:3000/monitoring
echo.
echo This is the PRODUCTION application stack
echo ZERO AI dependencies - Pure business logic only
echo.
echo To STOP the application:
echo   docker-compose -f docker-compose.app.yml stop
echo.
echo To view logs:
echo   docker-compose -f docker-compose.app.yml logs -f
echo.
echo ============================================================================
echo.
