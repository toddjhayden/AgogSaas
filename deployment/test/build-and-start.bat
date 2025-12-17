@echo off
REM AgogSaaS Test Environment - Build and Start Script (Windows)
REM Purpose: Build Docker images and start complete test environment
REM Usage: build-and-start.bat

setlocal enabledelayedexpansion

echo ================================================================================
echo   AgogSaaS Test Environment - Build and Start
echo ================================================================================
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..

echo Project root: %PROJECT_ROOT%
echo.

REM Step 1: Build backend image
echo [1/5] Building backend Docker image...
cd /d "%PROJECT_ROOT%\Implementation\print-industry-erp\backend"
docker build -t agogsaas/backend:test --target production .
if errorlevel 1 (
    echo ERROR: Failed to build backend image
    exit /b 1
)
echo √ Backend image built successfully
echo.

REM Step 2: Build frontend image
echo [2/5] Building frontend Docker image...
cd /d "%PROJECT_ROOT%\Implementation\print-industry-erp\frontend"
docker build -t agogsaas/frontend:test --target production ^
  --build-arg VITE_API_URL=http://localhost:6001/graphql ^
  --build-arg VITE_WS_URL=ws://localhost:6222 ^
  --build-arg VITE_DEFAULT_LANGUAGE=en-US ^
  --build-arg VITE_ENABLE_MARKETPLACE=true ^
  --build-arg VITE_ENABLE_AI_FEATURES=false ^
  .
if errorlevel 1 (
    echo ERROR: Failed to build frontend image
    exit /b 1
)
echo √ Frontend image built successfully
echo.

REM Step 3: Stop any existing containers
echo [3/5] Stopping existing test environment...
cd /d "%SCRIPT_DIR%"
docker-compose -f docker-compose.test.yml down 2>nul
echo √ Existing environment stopped
echo.

REM Step 4: Start test environment
echo [4/5] Starting test environment...
docker-compose -f docker-compose.test.yml up -d
if errorlevel 1 (
    echo ERROR: Failed to start test environment
    exit /b 1
)
echo √ Test environment started
echo.

REM Step 5: Wait for services to be ready
echo [5/5] Waiting for services to start...
echo This may take 1-2 minutes for all services to initialize...
timeout /t 30 /nobreak >nul

echo.
echo Checking service health...
echo.

REM Check service health
call :check_health "http://localhost:5001/health" "Edge Backend"
call :check_health "http://localhost:6001/health" "Region 1 Backend"
call :check_health "http://localhost:7001/health" "Region 2 Backend"
call :check_health "http://localhost:6080/health" "Region 1 Frontend"
call :check_health "http://localhost:7080/health" "Region 2 Frontend"
call :check_health "http://localhost:9090/-/healthy" "Prometheus"
call :check_health "http://localhost:3000/api/health" "Grafana"

echo.
echo Loading seed data...
echo.

REM Check if seed data exists
if exist "%PROJECT_ROOT%\Implementation\print-industry-erp\backend\seeds\test-data.sql" (
    echo Loading seed data for Region 1 (US-EAST^)...
    docker exec test-postgres-region1 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/../seeds/test-data.sql 2>nul || (
        echo Note: Could not load seed data automatically. Run manually if needed.
    )

    echo Loading seed data for Region 2 (EU-CENTRAL^)...
    docker exec test-postgres-region2 psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/../seeds/test-data.sql 2>nul || (
        echo Note: Could not load seed data automatically. Run manually if needed.
    )
) else (
    echo Note: Seed data file not found. Skipping...
)

echo.
echo ================================================================================
echo √ Test environment is ready!
echo ================================================================================
echo.
echo ACCESS POINTS:
echo   Frontend (Region 1 - English^):    http://localhost:6080
echo   Frontend (Region 2 - Chinese^):    http://localhost:7080
echo   Backend (Edge^):                   http://localhost:5001/graphql
echo   Backend (Region 1^):               http://localhost:6001/graphql
echo   Backend (Region 2^):               http://localhost:7001/graphql
echo   Prometheus:                       http://localhost:9090
echo   Grafana:                          http://localhost:3000 (admin/changeme^)
echo   Alertmanager:                     http://localhost:9093
echo.
echo TEST ACCOUNTS:
echo   English Tenant (Region 1^):
echo     Email:    admin@americanprint.com
echo     Password: test123
echo     Tenant:   American Print Co. (PRINT-US^)
echo.
echo   Chinese Tenant (Region 2^):
echo     Email:    admin@shanghai-printing.com
echo     Password: test123
echo     Tenant:   上海印刷公司 (PRINT-CN^)
echo.
echo USEFUL COMMANDS:
echo   View logs:        docker-compose -f docker-compose.test.yml logs -f
echo   Stop environment: docker-compose -f docker-compose.test.yml down
echo   Reset data:       docker-compose -f docker-compose.test.yml down -v
echo   Health check:     health-check.bat
echo.
echo See TESTING_GUIDE.md for detailed test scenarios.
echo.

goto :eof

REM Function to check service health
:check_health
set URL=%~1
set NAME=%~2
set MAX_ATTEMPTS=30
set ATTEMPT=1

:check_loop
curl -f -s "%URL%" >nul 2>&1
if !errorlevel! equ 0 (
    echo √ %NAME% is healthy
    goto :eof
)
if !ATTEMPT! geq %MAX_ATTEMPTS% (
    echo X %NAME% failed to start
    goto :eof
)
set /a ATTEMPT+=1
timeout /t 2 /nobreak >nul
goto check_loop
