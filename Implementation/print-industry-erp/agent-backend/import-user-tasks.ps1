# Import AGOG User Tasks into Task Scheduler
# These run under your user account at logon

Write-Host "Importing AGOG User Scheduled Tasks..." -ForegroundColor Green
Write-Host ""

$scriptPath = $PSScriptRoot
$tasks = @(
    @{Name='AGOG-Orchestrator-User'; XML='AGOG-Orchestrator-User.xml'},
    @{Name='AGOG-Listener-User'; XML='AGOG-Listener-User.xml'},
    @{Name='AGOG-Daemons-User'; XML='AGOG-Daemons-User.xml'}
)

foreach ($task in $tasks) {
    $xmlPath = Join-Path $scriptPath $task.XML

    if (Test-Path $xmlPath) {
        try {
            Write-Host "Importing $($task.Name)..." -ForegroundColor Cyan
            Register-ScheduledTask -Xml (Get-Content $xmlPath | Out-String) -TaskName $task.Name -Force
            Write-Host "  SUCCESS: $($task.Name) imported" -ForegroundColor Green
        }
        catch {
            Write-Host "  FAILED: $($task.Name)" -ForegroundColor Red
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    else {
        Write-Host "  ERROR: XML file not found - $xmlPath" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host ""
Write-Host "Verifying imported tasks..." -ForegroundColor Yellow
Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG-*' } | Select-Object TaskName,State | Format-Table -AutoSize

Write-Host ""
Write-Host "=== To start tasks IMMEDIATELY (without reboot): ===" -ForegroundColor Yellow
Write-Host "Start-ScheduledTask -TaskName 'AGOG-Orchestrator-User'" -ForegroundColor Cyan
Write-Host "Start-ScheduledTask -TaskName 'AGOG-Listener-User'" -ForegroundColor Cyan
Write-Host "Start-ScheduledTask -TaskName 'AGOG-Daemons-User'" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or run all three at once:" -ForegroundColor Yellow
Write-Host "Get-ScheduledTask | Where-Object { `$_.TaskName -like 'AGOG-*-User' } | Start-ScheduledTask" -ForegroundColor Cyan
