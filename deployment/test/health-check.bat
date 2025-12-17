@echo off
REM AgogSaaS Test Environment - Health Check Script (Windows)
REM Purpose: Check health status of all services
REM Usage: health-check.bat

setlocal enabledelayedexpansion

echo ================================================================================
echo   AgogSaaS Test Environment - Health Check
echo ================================================================================
echo.

set failed=0

echo === Docker Containers ===
call :check_container "test-postgres-edge" "PostgreSQL (Edge)"
call :check_container "test-backend-edge" "Backend (Edge)"
call :check_container "test-nats-edge" "NATS (Edge)"
echo.
call :check_container "test-postgres-region1" "PostgreSQL (Region 1)"
call :check_container "test-redis-region1" "Redis (Region 1)"
call :check_container "test-backend-region1" "Backend (Region 1)"
call :check_container "test-frontend-region1" "Frontend (Region 1)"
call :check_container "test-nats-region1" "NATS (Region 1)"
echo.
call :check_container "test-postgres-region2" "PostgreSQL (Region 2)"
call :check_container "test-redis-region2" "Redis (Region 2)"
call :check_container "test-backend-region2" "Backend (Region 2)"
call :check_container "test-frontend-region2" "Frontend (Region 2)"
call :check_container "test-nats-region2" "NATS (Region 2)"
echo.
call :check_container "test-prometheus" "Prometheus"
call :check_container "test-grafana" "Grafana"
call :check_container "test-alertmanager" "Alertmanager"

echo.
echo === Health Endpoints ===
call :check_health "http://localhost:5001/health" "Edge Backend Health"
call :check_health "http://localhost:6001/health" "Region 1 Backend Health"
call :check_health "http://localhost:7001/health" "Region 2 Backend Health"
call :check_health "http://localhost:6080/health" "Region 1 Frontend Health"
call :check_health "http://localhost:7080/health" "Region 2 Frontend Health"
call :check_health "http://localhost:9090/-/healthy" "Prometheus Health"
call :check_health "http://localhost:3000/api/health" "Grafana Health"
call :check_health "http://localhost:9093/-/healthy" "Alertmanager Health"

echo.
echo === Database Connectivity ===

REM Check PostgreSQL connectivity
docker exec test-postgres-edge pg_isready -U edge_user -d agog_edge >nul 2>&1
if !errorlevel! equ 0 (
    echo √ PostgreSQL Edge (agog_edge^)
) else (
    echo X PostgreSQL Edge (agog_edge^)
    set /a failed+=1
)

docker exec test-postgres-region1 pg_isready -U agogsaas_user -d agogsaas >nul 2>&1
if !errorlevel! equ 0 (
    echo √ PostgreSQL Region 1 (agogsaas^)
) else (
    echo X PostgreSQL Region 1 (agogsaas^)
    set /a failed+=1
)

docker exec test-postgres-region2 pg_isready -U agogsaas_user -d agogsaas >nul 2>&1
if !errorlevel! equ 0 (
    echo √ PostgreSQL Region 2 (agogsaas^)
) else (
    echo X PostgreSQL Region 2 (agogsaas^)
    set /a failed+=1
)

REM Check Redis connectivity
docker exec test-redis-region1 redis-cli ping 2>nul | findstr /C:"PONG" >nul
if !errorlevel! equ 0 (
    echo √ Redis Region 1
) else (
    echo X Redis Region 1
    set /a failed+=1
)

docker exec test-redis-region2 redis-cli ping 2>nul | findstr /C:"PONG" >nul
if !errorlevel! equ 0 (
    echo √ Redis Region 2
) else (
    echo X Redis Region 2
    set /a failed+=1
)

echo.
echo === GraphQL Endpoints ===
call :check_health "http://localhost:5001/graphql" "Edge GraphQL"
call :check_health "http://localhost:6001/graphql" "Region 1 GraphQL"
call :check_health "http://localhost:7001/graphql" "Region 2 GraphQL"

echo.
echo === NATS Monitoring ===
call :check_health "http://localhost:5223" "NATS Edge Monitoring"
call :check_health "http://localhost:6223" "NATS Region 1 Monitoring"
call :check_health "http://localhost:7223" "NATS Region 2 Monitoring"

echo.
echo ================================================================================
if !failed! equ 0 (
    echo √ All services are healthy!
    echo ================================================================================
    echo.
    echo ACCESS POINTS:
    echo   Frontend (Region 1^): http://localhost:6080
    echo   Frontend (Region 2^): http://localhost:7080
    echo   Grafana:            http://localhost:3000
    echo   Prometheus:         http://localhost:9090
    echo.
    exit /b 0
) else (
    echo X !failed! service(s^) are unhealthy
    echo ================================================================================
    echo.
    echo TROUBLESHOOTING:
    echo   View logs:    docker-compose -f docker-compose.test.yml logs -f [service]
    echo   Restart all:  docker-compose -f docker-compose.test.yml restart
    echo   Check status: docker-compose -f docker-compose.test.yml ps
    echo.
    exit /b 1
)

goto :eof

REM Function to check container status
:check_container
set container=%~1
set name=%~2

docker ps --format "{{.Names}}" | findstr /X "%container%" >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('docker inspect -f "{{.State.Status}}" %container% 2^>nul') do set status=%%i
    if "!status!"=="running" (
        echo √ %name% (running^)
    ) else (
        echo ⚠ %name% (status: !status!^)
        set /a failed+=1
    )
) else (
    echo X %name% (not found^)
    set /a failed+=1
)
goto :eof

REM Function to check service health
:check_health
set url=%~1
set name=%~2

curl -f -s --max-time 5 "%url%" >nul 2>&1
if !errorlevel! equ 0 (
    echo √ %name%
) else (
    echo X %name% (UNHEALTHY^)
    set /a failed+=1
)
goto :eof
