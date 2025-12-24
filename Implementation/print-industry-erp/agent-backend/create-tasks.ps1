$action1 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-orchestrator.bat'
$trigger1 = New-ScheduledTaskTrigger -AtStartup
$principal1 = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Orchestrator' -Action $action1 -Trigger $trigger1 -Principal $principal1 -Settings $settings1 -Force
Write-Host "Created AGOG-Orchestrator"

$action2 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-listener.bat'
$trigger2 = New-ScheduledTaskTrigger -AtStartup
$principal2 = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Listener' -Action $action2 -Trigger $trigger2 -Principal $principal2 -Settings $settings2 -Force
Write-Host "Created AGOG-Listener"

$action3 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-daemons.bat'
$trigger3 = New-ScheduledTaskTrigger -AtStartup
$principal3 = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$settings3 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Daemons' -Action $action3 -Trigger $trigger3 -Principal $principal3 -Settings $settings3 -Force
Write-Host "Created AGOG-Daemons"

Get-ScheduledTask | Where-Object {$_.TaskName -like 'AGOG-*'} | Format-Table TaskName,State
