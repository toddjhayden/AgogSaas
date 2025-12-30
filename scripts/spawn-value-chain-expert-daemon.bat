@echo off
REM Windows batch file to spawn Value Chain Expert Agent (NON-INTERACTIVE for daemon use)

node "%~dp0spawn-value-chain-expert-daemon.js" %*
