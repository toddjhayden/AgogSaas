# Create Windows Scheduled Tasks for AGOG services

Write-Host "Creating scheduled tasks..." -ForegroundColor Green

# Task 1: Strategic Orchestrator
$action1 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-orchestrator.bat'
$trigger1 = New-ScheduledTaskTrigger -AtStartup
$principal1 = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Orchestrator' -Action $action1 -Trigger $trigger1 -Principal $principal1 -Settings $settings1 -Force | Out-Null
Write-Host "✓ Created task: AGOG-Orchestrator" -ForegroundColor Cyan

# Task 2: Host Agent Listener
$action2 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-listener.bat'
$trigger2 = New-ScheduledTaskTrigger -AtStartup
$principal2 = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Listener' -Action $action2 -Trigger $trigger2 -Principal $principal2 -Settings $settings2 -Force | Out-Null
Write-Host "✓ Created task: AGOG-Listener" -ForegroundColor Cyan

# Task 3: Proactive Daemons (Recovery, Value Chain, POs, Metrics)
$action3 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-daemons.bat'
$trigger3 = New-ScheduledTaskTrigger -AtStartup
$principal3 = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$settings3 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Daemons' -Action $action3 -Trigger $trigger3 -Principal $principal3 -Settings $settings3 -Force | Out-Null
Write-Host "✓ Created task: AGOG-Daemons" -ForegroundColor Cyan

Write-Host ""
Write-Host "Scheduled tasks created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To start them now:" -ForegroundColor Yellow
Write-Host "  schtasks /Run /TN AGOG-Orchestrator"
Write-Host "  schtasks /Run /TN AGOG-Listener"
Write-Host "  schtasks /Run /TN AGOG-Daemons"
Write-Host ""
Write-Host "Current status:" -ForegroundColor Yellow
Get-ScheduledTask | Where-Object {$_.TaskName -like 'AGOG-*'} | Select-Object TaskName,State | Format-Table
