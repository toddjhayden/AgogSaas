$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
Get-ChildItem -Path $startupFolder -Filter "AGOG-*.vbs" | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
