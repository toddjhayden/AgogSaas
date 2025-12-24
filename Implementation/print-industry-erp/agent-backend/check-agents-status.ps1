# Check if AGOG agents are actually running

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "AGOG AGENTS STATUS CHECK" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Check scheduled tasks
Write-Host "1. Scheduled Tasks:" -ForegroundColor Yellow
Write-Host ""
$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG*' }
if ($tasks) {
    $tasks | Select-Object TaskName,State | Format-Table -AutoSize
} else {
    Write-Host "  No AGOG tasks found!" -ForegroundColor Red
}

# Check running processes
Write-Host ""
Write-Host "2. Running Node/TSX Processes:" -ForegroundColor Yellow
Write-Host ""
$processes = Get-Process | Where-Object { $_.ProcessName -eq 'node' -or $_.ProcessName -eq 'tsx' }
if ($processes) {
    Write-Host "  Found $($processes.Count) Node/TSX processes:" -ForegroundColor Green
    $processes | Select-Object ProcessName,Id,@{Name='CPU(s)';Expression={$_.CPU}},@{Name='Memory(MB)';Expression={[math]::Round($_.WorkingSet/1MB,2)}} | Format-Table -AutoSize
} else {
    Write-Host "  ❌ No Node/TSX processes running!" -ForegroundColor Red
}

# Check recent logs
Write-Host ""
Write-Host "3. Recent Log Activity:" -ForegroundColor Yellow
Write-Host ""
if (Test-Path "logs") {
    $logFiles = Get-ChildItem logs\*.log -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($logFiles) {
        $logFiles | Select-Object Name,LastWriteTime,@{Name='Size';Expression={"$($_.Length) bytes"}} | Format-Table -AutoSize

        Write-Host ""
        Write-Host "Last 5 lines from orchestrator.log:" -ForegroundColor Cyan
        if (Test-Path "logs\orchestrator.log") {
            Get-Content "logs\orchestrator.log" -Tail 5 | ForEach-Object { Write-Host "  $_" }
        }
    } else {
        Write-Host "  No log files found" -ForegroundColor Yellow
    }
} else {
    Write-Host "  logs/ directory not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
