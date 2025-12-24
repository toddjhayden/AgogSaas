@echo off
REM Windows batch file to spawn Value Chain Expert Agent

echo.
echo FIRST MESSAGE INSTRUCTIONS:
echo When the agent starts, paste this as your first message:
echo.
echo -----------------------------------------------------------
echo Read your agent definition at .claude/agents/value-chain-expert.md
echo Review Standards/README.md and familiarize yourself with all files
echo in project-spirit/ directory. Then introduce yourself and await instructions.
echo -----------------------------------------------------------
echo.
pause
echo.

node "%~dp0spawn-value-chain-expert.js" %*
