# Start all AGOG User tasks immediately

Write-Host "Starting AGOG Tasks..." -ForegroundColor Green
Write-Host ""

$tasks = @('AGOG-Orchestrator-User', 'AGOG-Listener-User', 'AGOG-Daemons-User')

foreach ($taskName in $tasks) {
    try {
        Write-Host "Starting $taskName..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $taskName
        Write-Host "  Started successfully" -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
    catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Waiting 3 seconds for tasks to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Current task status:" -ForegroundColor Yellow
Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG-*-User' } | Select-Object TaskName,State,LastRunTime | Format-Table -AutoSize

Write-Host ""
Write-Host "Checking if processes are running..." -ForegroundColor Yellow
$processes = Get-Process | Where-Object { $_.ProcessName -eq 'node' -or $_.ProcessName -eq 'tsx' }
if ($processes) {
    Write-Host "Found running Node/TSX processes:" -ForegroundColor Green
    $processes | Select-Object ProcessName,Id,StartTime | Format-Table -AutoSize
} else {
    Write-Host "No Node/TSX processes found yet. Check logs for errors." -ForegroundColor Red
}
