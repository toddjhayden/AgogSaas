Write-Host "Checking AGOG Scheduled Tasks Status..." -ForegroundColor Green
Write-Host ""

$tasks = @('AGOG-Orchestrator', 'AGOG-Listener', 'AGOG-Daemons')

foreach ($taskName in $tasks) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
        $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName

        Write-Host "$taskName" -ForegroundColor Cyan
        Write-Host "  State: $($task.State)" -ForegroundColor Yellow
        Write-Host "  Last Run Time: $($taskInfo.LastRunTime)" -ForegroundColor Yellow
        Write-Host "  Last Result: $($taskInfo.LastTaskResult)" -ForegroundColor Yellow
        Write-Host "  Next Run Time: $($taskInfo.NextRunTime)" -ForegroundColor Yellow
        Write-Host ""
    }
    catch {
        Write-Host "$taskName" -ForegroundColor Red
        Write-Host "  NOT FOUND" -ForegroundColor Red
        Write-Host ""
    }
}

Write-Host "Running Node Processes (started in last hour):" -ForegroundColor Green
Get-Process | Where-Object { $_.ProcessName -like '*node*' -and $_.StartTime -gt (Get-Date).AddHours(-1) } | Select-Object Id,ProcessName,StartTime | Format-Table -AutoSize
