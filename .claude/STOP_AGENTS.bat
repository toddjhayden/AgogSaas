@echo off
REM ============================================================================
REM Stop AgogSaaS Agent Development System (VPS SDLC Mode)
REM ============================================================================

echo.
echo Stopping AgogSaaS Agent Development System...
echo.

echo [1/2] Stopping Docker containers...
REM Stop containers by name (excludes sdlc-postgres - no longer used locally)
docker stop agogsaas-agents-backend agogsaas-agents-postgres agogsaas-agents-nats agogsaas-agents-ollama 2>nul
echo    Done.

echo.
echo [2/2] Summary
echo ============================================================================
echo Stopped:
echo   - agogsaas-agents-backend (Strategic Orchestrator)
echo   - agogsaas-agents-postgres (Workflow Persistence)
echo   - agogsaas-agents-nats (Message Queue)
echo   - agogsaas-agents-ollama (AI Models)
echo.
echo NOT affected (VPS - always running):
echo   - SDLC API: https://api.agog.fyi
echo   - SDLC GUI: https://sdlc.agog.fyi
echo.
echo To fully remove containers and volumes:
echo   docker-compose -f docker-compose.agents-vps.yml down -v
echo.
echo To stop the old local SDLC container (if still running):
echo   docker stop agogsaas-sdlc-postgres
echo.
echo Done. Agent system stopped.
echo.
pause
