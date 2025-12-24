# Register AGOG Scheduled Tasks (running as current user)

# Task 1: AGOG-Orchestrator
$action1 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-orchestrator.bat'
$trigger1 = New-ScheduledTaskTrigger -AtStartup
$settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Orchestrator' -Action $action1 -Trigger $trigger1 -Settings $settings1 -Force
Write-Output 'Created AGOG-Orchestrator'

# Task 2: AGOG-Listener
$action2 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-listener.bat'
$trigger2 = New-ScheduledTaskTrigger -AtStartup
$settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Listener' -Action $action2 -Trigger $trigger2 -Settings $settings2 -Force
Write-Output 'Created AGOG-Listener'

# Task 3: AGOG-Daemons
$action3 = New-ScheduledTaskAction -Execute 'D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-daemons.bat'
$trigger3 = New-ScheduledTaskTrigger -AtStartup
$settings3 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AGOG-Daemons' -Action $action3 -Trigger $trigger3 -Settings $settings3 -Force
Write-Output 'Created AGOG-Daemons'

Write-Output ''
Write-Output 'All tasks registered successfully!'
Get-ScheduledTask | Where-Object {$_.TaskName -like 'AGOG-*'} | Format-Table TaskName,State
