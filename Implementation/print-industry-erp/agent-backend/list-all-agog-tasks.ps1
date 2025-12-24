# List all AGOG scheduled tasks

Write-Host "All AGOG Scheduled Tasks:" -ForegroundColor Green
Write-Host ""

$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG*' }

if ($tasks) {
    $tasks | ForEach-Object {
        $taskInfo = Get-ScheduledTaskInfo -TaskName $_.TaskName
        Write-Host "Task: $($_.TaskName)" -ForegroundColor Cyan
        Write-Host "  State: $($_.State)" -ForegroundColor Yellow
        Write-Host "  User: $($_.Principal.UserId)" -ForegroundColor White
        Write-Host "  Last Run: $($taskInfo.LastRunTime)" -ForegroundColor Gray
        Write-Host "  Last Result: $($taskInfo.LastTaskResult)" -ForegroundColor Gray
        Write-Host ""
    }

    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Green
    $tasks | Select-Object TaskName,State | Format-Table -AutoSize
} else {
    Write-Host "No AGOG tasks found." -ForegroundColor Red
}
