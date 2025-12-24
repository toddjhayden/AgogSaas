Write-Host "Searching for AGOG tasks..." -ForegroundColor Green
Write-Host ""

# Search all task paths
$allTasks = Get-ScheduledTask

Write-Host "Tasks containing 'AGOG':" -ForegroundColor Yellow
$agogTasks = $allTasks | Where-Object { $_.TaskName -match 'AGOG' }
if ($agogTasks) {
    $agogTasks | Select-Object TaskName,TaskPath,State | Format-Table -AutoSize
} else {
    Write-Host "  None found" -ForegroundColor Red
}

Write-Host "Tasks containing 'Orchestrator':" -ForegroundColor Yellow
$orchTasks = $allTasks | Where-Object { $_.TaskName -match 'Orchestrator' }
if ($orchTasks) {
    $orchTasks | Select-Object TaskName,TaskPath,State | Format-Table -AutoSize
} else {
    Write-Host "  None found" -ForegroundColor Red
}

Write-Host "Tasks containing 'Listener':" -ForegroundColor Yellow
$listenerTasks = $allTasks | Where-Object { $_.TaskName -match 'Listener' }
if ($listenerTasks) {
    $listenerTasks | Select-Object TaskName,TaskPath,State | Format-Table -AutoSize
} else {
    Write-Host "  None found" -ForegroundColor Red
}

Write-Host "Tasks containing 'Daemon':" -ForegroundColor Yellow
$daemonTasks = $allTasks | Where-Object { $_.TaskName -match 'Daemon' }
if ($daemonTasks) {
    $daemonTasks | Select-Object TaskName,TaskPath,State | Format-Table -AutoSize
} else {
    Write-Host "  None found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Total tasks: $($allTasks.Count)" -ForegroundColor Cyan
