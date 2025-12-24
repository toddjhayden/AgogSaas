# Check for AGOG tasks without -User suffix

Write-Host "Checking for non-User AGOG tasks..." -ForegroundColor Yellow
Write-Host ""

$allAGOGTasks = Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG*' }

Write-Host "All AGOG tasks found:" -ForegroundColor Cyan
$allAGOGTasks | Select-Object TaskName,State | Format-Table -AutoSize

Write-Host ""
Write-Host "Tasks WITHOUT '-User' suffix:" -ForegroundColor Yellow
$nonUserTasks = $allAGOGTasks | Where-Object { $_.TaskName -notlike '*-User' }

if ($nonUserTasks) {
    Write-Host "Found the following tasks to potentially remove:" -ForegroundColor Red
    $nonUserTasks | Select-Object TaskName,State | Format-Table -AutoSize

    Write-Host ""
    Write-Host "To remove these tasks, run:" -ForegroundColor Yellow
    foreach ($task in $nonUserTasks) {
        Write-Host "  Unregister-ScheduledTask -TaskName '$($task.TaskName)' -Confirm:`$false" -ForegroundColor Cyan
    }
} else {
    Write-Host "  None found. Only User tasks exist." -ForegroundColor Green
}
