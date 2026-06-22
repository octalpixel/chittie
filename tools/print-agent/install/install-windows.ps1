# Install the Chittie print agent to auto-start at logon via Task Scheduler
# (console app — Task Scheduler is more reliable than `sc` for non-SCM exes).
# Run once in PowerShell on the POS terminal (the POSMAX target).
#
#   .\install-windows.ps1 [-BinPath .\chittie-print-agent.exe] [-Token secret]
#
# Uninstall: Unregister-ScheduledTask -TaskName ChittiePrintAgent -Confirm:$false

param(
  [string]$BinPath = "$PSScriptRoot\chittie-print-agent.exe",
  [string]$Token   = $env:PRINT_AGENT_TOKEN,
  [string]$AllowOrigin = $(if ($env:PRINT_AGENT_ALLOW_ORIGIN) { $env:PRINT_AGENT_ALLOW_ORIGIN } else { "*" })
)

if (-not (Test-Path $BinPath)) { Write-Error "binary not found: $BinPath"; exit 1 }

$dest = Join-Path $env:LOCALAPPDATA "ChittiePrintAgent"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Force $BinPath (Join-Path $dest "chittie-print-agent.exe")

# Per-user env so the agent (and its child SCM-less process) picks them up.
[Environment]::SetEnvironmentVariable("PRINT_AGENT_TOKEN", $Token, "User")
[Environment]::SetEnvironmentVariable("PRINT_AGENT_ALLOW_ORIGIN", $AllowOrigin, "User")

$exe      = Join-Path $dest "chittie-print-agent.exe"
$action   = New-ScheduledTaskAction -Execute $exe
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit 0
Register-ScheduledTask -TaskName "ChittiePrintAgent" -Action $action -Trigger $trigger `
  -Settings $settings -Description "Chittie receipt print agent" -Force | Out-Null
Start-ScheduledTask -TaskName "ChittiePrintAgent"

Write-Host "Chittie print agent installed + started (auto-starts at logon)."
Write-Host "Note: install the printer's vendor driver so it appears in Devices & Printers."
