# Install AGOG services to Windows Startup folder
# This runs automatically on login without requiring admin rights

$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

# Create VBS scripts that run batch files hidden (no visible windows)

# 1. AGOG-Orchestrator
$vbs1 = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-orchestrator.bat", 0, False
Set WshShell = Nothing
"@
$vbs1 | Out-File -FilePath "$startupFolder\AGOG-Orchestrator.vbs" -Encoding ASCII
Write-Output "Created: $startupFolder\AGOG-Orchestrator.vbs"

# 2. AGOG-Listener
$vbs2 = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-listener.bat", 0, False
Set WshShell = Nothing
"@
$vbs2 | Out-File -FilePath "$startupFolder\AGOG-Listener.vbs" -Encoding ASCII
Write-Output "Created: $startupFolder\AGOG-Listener.vbs"

# 3. AGOG-Daemons
$vbs3 = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-daemons.bat", 0, False
Set WshShell = Nothing
"@
$vbs3 | Out-File -FilePath "$startupFolder\AGOG-Daemons.vbs" -Encoding ASCII
Write-Output "Created: $startupFolder\AGOG-Daemons.vbs"

Write-Output ""
Write-Output "AGOG services installed to Startup folder successfully!"
Write-Output "They will run automatically on next login (hidden, no windows)"
Write-Output ""
Write-Output "To run them now:"
Write-Output "  wscript `"$startupFolder\AGOG-Orchestrator.vbs`""
Write-Output "  wscript `"$startupFolder\AGOG-Listener.vbs`""
Write-Output "  wscript `"$startupFolder\AGOG-Daemons.vbs`""
Write-Output ""
Write-Output "To remove from startup, delete the .vbs files from:"
Write-Output "  $startupFolder"
