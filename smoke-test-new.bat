@echo off
REM Wrapper for smoke test - calls tests/smoke/smoke-test.bat
cd /d "%~dp0"
call tests\smoke\smoke-test.bat %*
