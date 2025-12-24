@echo off
REM Quick start for Value Chain Expert Agent
REM Uses full path to claude-code CLI

cd /d "%~dp0"

echo.
echo ========================================
echo Value Chain Expert Agent
echo ========================================
echo.
echo When the agent starts, paste this:
echo.
echo Read your agent definition at .claude/agents/value-chain-expert.md. Review Standards/README.md and familiarize yourself with all files in project-spirit/ directory. Then introduce yourself and await instructions.
echo.
echo ========================================
echo.
pause

node "C:\Users\toddj\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\cli.js" --agent ".claude\agents\value-chain-expert.md" --model sonnet --dangerously-skip-permissions
