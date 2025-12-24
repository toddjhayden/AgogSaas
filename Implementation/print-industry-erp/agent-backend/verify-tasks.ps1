Write-Host "Checking AGOG Scheduled Tasks..." -ForegroundColor Green
Write-Host ""

Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG-*' } | Select-Object TaskName,State | Format-Table -AutoSize

Write-Host ""
Write-Host "Task Details:" -ForegroundColor Yellow
Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG-*' } | ForEach-Object {
    Write-Host "  $($_.TaskName): $($_.State)" -ForegroundColor Cyan
}
