# Restart all AGOG User tasks to use updated batch files

Write-Host "Restarting AGOG Tasks with updated logging..." -ForegroundColor Green
Write-Host ""

$tasks = @('AGOG-Orchestrator-User', 'AGOG-Listener-User', 'AGOG-Daemons-User')

foreach ($taskName in $tasks) {
    Write-Host "Stopping $taskName..." -ForegroundColor Yellow
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    Write-Host "Starting $taskName..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 1
    Write-Host ""
}

Write-Host "Waiting for tasks to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Current task status:" -ForegroundColor Yellow
Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG-*-User' } | Select-Object TaskName,State,LastRunTime | Format-Table -AutoSize

Write-Host ""
Write-Host "Checking log files..." -ForegroundColor Yellow
Get-ChildItem logs\*.log | Sort-Object LastWriteTime -Descending | Select-Object Name,LastWriteTime,Length | Format-Table -AutoSize
