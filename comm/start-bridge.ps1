# Relaunch the Telegram bridges (group + DM) after a reboot:  powershell -ExecutionPolicy Bypass -File comm\start-bridge.ps1
$node = "C:\Program Files\nodejs\node.exe"
$js = "C:\Users\pc\Desktop\blockdns\comm\telegram-bridge.js"
$wd = "C:\Users\pc\Desktop\blockdns"

function Start-IfNotRunning([string]$mode) {
  $existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*telegram-bridge.js $mode*" }
  if ($existing) {
    Write-Output "mode $mode already running: $($existing.ProcessId)"
    return
  }
  $args = if ($mode -eq "dm") { @($js, "dm") } else { @($js) }
  Start-Process -FilePath $node -ArgumentList $args -WorkingDirectory $wd `
    -RedirectStandardOutput "C:\Users\pc\Desktop\telegram-bridge-$mode.log" `
    -RedirectStandardError "C:\Users\pc\Desktop\telegram-bridge-$mode.err.log" `
    -WindowStyle Hidden
}

Start-IfNotRunning "group"
Start-IfNotRunning "dm"
Start-Sleep -Seconds 4
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*telegram-bridge*' } | Select-Object ProcessId, @{n='Cmd';e={$_.CommandLine.Substring(0,120)}}