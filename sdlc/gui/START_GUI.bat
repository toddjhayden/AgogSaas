@echo off
REM ===================================================================
REM SDLC Control GUI - Standalone Startup
REM ===================================================================
REM
REM Starts the SDLC Control GUI on http://localhost:3020
REM Requires: SDLC Control daemon running on port 3010
REM
REM ===================================================================

echo.
echo ===================================================================
echo SDLC Control GUI
echo ===================================================================
echo.
echo Starting GUI on http://localhost:3020
echo.
echo Prerequisites:
echo   - SDLC Control daemon running (START_SYSTEM.bat)
echo   - Or: npm run sdlc:start in agent-backend
echo.

cd /d D:\GitHub\agogsaas\Implementation\print-industry-erp\sdlc-gui

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

echo.
echo Starting development server...
echo Press Ctrl+C to stop.
echo.

npm run dev
