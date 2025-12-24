# Find ALL AGOG tasks in all folders

Write-Host "Searching for ALL AGOG tasks in Task Scheduler..." -ForegroundColor Yellow
Write-Host ""

# Get all tasks including subfolders
$allTasks = Get-ScheduledTask | Where-Object { $_.TaskName -like '*AGOG*' }

Write-Host "Found $($allTasks.Count) AGOG-related tasks:" -ForegroundColor Cyan
Write-Host ""

foreach ($task in $allTasks) {
    Write-Host "Name: $($task.TaskName)" -ForegroundColor White
    Write-Host "  Path: $($task.TaskPath)" -ForegroundColor Gray
    Write-Host "  State: $($task.State)" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Host "Summary table:" -ForegroundColor Green
$allTasks | Select-Object TaskName,TaskPath,State | Format-Table -AutoSize
