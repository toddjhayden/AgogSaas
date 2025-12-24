# Remove AGOG system-level tasks (keep only User versions)

Write-Host "Removing system-level AGOG tasks..." -ForegroundColor Yellow
Write-Host "(Keeping the -User versions)" -ForegroundColor Green
Write-Host ""

$tasksToRemove = @('AGOG-Orchestrator', 'AGOG-Listener', 'AGOG-Daemons')

foreach ($taskName in $tasksToRemove) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

        if ($task) {
            Write-Host "Removing: $taskName..." -ForegroundColor Cyan
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "  ✅ Removed successfully" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Task not found: $taskName" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  ❌ Failed to remove $taskName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Remaining AGOG tasks:" -ForegroundColor Green
Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG*' } | Select-Object TaskName,State | Format-Table -AutoSize

Write-Host ""
Write-Host "✅ Done! Only User versions remain." -ForegroundColor Green
