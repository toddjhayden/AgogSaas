# Import AGOG Tasks into Task Scheduler
# NOTE: This requires Administrator privileges

Write-Host "Importing AGOG Scheduled Tasks..." -ForegroundColor Green
Write-Host ""

$scriptPath = $PSScriptRoot
$tasks = @(
    @{Name='AGOG-Orchestrator'; XML='AGOG-Orchestrator.xml'},
    @{Name='AGOG-Listener'; XML='AGOG-Listener.xml'},
    @{Name='AGOG-Daemons'; XML='AGOG-Daemons.xml'}
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

Write-Host "Verifying imported tasks..." -ForegroundColor Yellow
Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG-*' } | Select-Object TaskName,State | Format-Table -AutoSize

Write-Host ""
Write-Host "To start tasks now:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName 'AGOG-Orchestrator'" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName 'AGOG-Listener'" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName 'AGOG-Daemons'" -ForegroundColor Cyan
