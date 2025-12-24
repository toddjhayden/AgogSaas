# Query tasks using schtasks command (more complete than Get-ScheduledTask)

Write-Host "Querying AGOG tasks using schtasks.exe..." -ForegroundColor Yellow
Write-Host ""

$output = schtasks.exe /query /fo CSV | ConvertFrom-Csv
$agogTasks = $output | Where-Object { $_.TaskName -like '*AGOG*' }

Write-Host "Found $($agogTasks.Count) AGOG tasks:" -ForegroundColor Cyan
$agogTasks | Select-Object TaskName,Status,'Next Run Time','Last Run Time' | Format-Table -AutoSize

Write-Host ""
Write-Host "Tasks without -User suffix:" -ForegroundColor Yellow
$nonUserTasks = $agogTasks | Where-Object { $_.TaskName -notlike '*-User' }

if ($nonUserTasks) {
    Write-Host "Found these tasks to remove:" -ForegroundColor Red
    $nonUserTasks | Select-Object TaskName,Status | Format-Table -AutoSize

    Write-Host "Run these commands to remove them:" -ForegroundColor Yellow
    foreach ($task in $nonUserTasks) {
        $taskName = $task.TaskName -replace '\\', ''
        Write-Host "  schtasks.exe /delete /tn `"$taskName`" /f" -ForegroundColor Cyan
    }
} else {
    Write-Host "  None found!" -ForegroundColor Green
}
