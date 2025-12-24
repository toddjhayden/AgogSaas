# Import AGOG Tasks into Windows Task Scheduler

## Task Definition Files Created

Three XML files ready to import:
- `AGOG-Orchestrator.xml` - Strategic Orchestrator
- `AGOG-Listener.xml` - Host Agent Listener
- `AGOG-Daemons.xml` - Proactive Daemons (Recovery, Value Chain, POs, Metrics)

## How to Import

### Option 1: Task Scheduler GUI (Recommended)

1. Press `Win + R`, type `taskschd.msc`, press Enter
2. In Task Scheduler, right-click **Task Scheduler Library**
3. Select **Import Task...**
4. Browse to: `D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\`
5. Select `AGOG-Orchestrator.xml`
6. Click **Open**
7. **IMPORTANT**: In the import dialog, change the **User** from `SYSTEM` to your account (`toddj`) if you're not running as Administrator
8. Click **OK**
9. Repeat for `AGOG-Listener.xml` and `AGOG-Daemons.xml`

### Option 2: Command Line (Requires Admin)

```cmd
cd D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend
schtasks /Create /TN "AGOG-Orchestrator" /XML AGOG-Orchestrator.xml
schtasks /Create /TN "AGOG-Listener" /XML AGOG-Listener.xml
schtasks /Create /TN "AGOG-Daemons" /XML AGOG-Daemons.xml
```

## Task Configuration

Each task is configured with:
- **Trigger**: At system startup (BootTrigger)
- **User**: SYSTEM (highest privileges)
- **Run Level**: Highest Available
- **Allow on batteries**: Yes
- **Don't stop on batteries**: Yes
- **Restart on failure**: 3 attempts, 1 minute interval
- **Multiple instances**: Ignore new (prevents duplicates)
- **Time limit**: None (runs indefinitely)

## After Import

### Verify Tasks Exist
```powershell
Get-ScheduledTask | Where-Object { $_.TaskName -like 'AGOG-*' } | Format-Table TaskName,State
```

### Start Tasks Manually (Test)
```cmd
schtasks /Run /TN AGOG-Orchestrator
schtasks /Run /TN AGOG-Listener
schtasks /Run /TN AGOG-Daemons
```

### Check Task Status
```cmd
schtasks /Query /TN AGOG-Orchestrator /V
schtasks /Query /TN AGOG-Listener /V
schtasks /Query /TN AGOG-Daemons /V
```

## Advantages Over Startup Folder

- ✅ Runs on system boot (not just login)
- ✅ Automatic restart on failure (3 attempts, 1 min interval)
- ✅ Runs as SYSTEM user (higher privileges)
- ✅ More reliable recovery
- ✅ Can be managed remotely

## Remove Startup Folder VBS Files

After importing tasks, you can remove the VBS files from Startup folder:
```powershell
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AGOG-*.vbs"
```

## Troubleshooting

**"Access denied" when importing:**
- Open Task Scheduler as Administrator
- Or change User from SYSTEM to your account in the import dialog

**Task shows as "Ready" but not running:**
- Right-click task → Run
- Or reboot to trigger the BootTrigger

**Task failed to start:**
- Check Event Viewer → Windows Logs → Application
- Look for Task Scheduler errors
- Verify batch file paths are correct
