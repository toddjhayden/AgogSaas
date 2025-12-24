Get-Process | Where-Object { $_.ProcessName -like '*node*' } | Select-Object Id,ProcessName,StartTime | Format-Table -AutoSize
