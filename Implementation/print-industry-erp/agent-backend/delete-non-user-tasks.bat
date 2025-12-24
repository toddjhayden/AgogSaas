@echo off
REM Delete AGOG tasks without -User suffix

echo Deleting non-User AGOG tasks...
echo.

schtasks /delete /tn "AGOG-Orchestrator" /f
schtasks /delete /tn "AGOG-Listener" /f
schtasks /delete /tn "AGOG-Daemons" /f

echo.
echo Done! Remaining tasks:
schtasks /query /fo TABLE | findstr "AGOG"
