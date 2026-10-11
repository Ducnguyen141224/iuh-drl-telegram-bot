$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$taskName = 'IUH-DRL-Local'
$nodePath = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$shellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$rootQuoted = $projectDirectory.Replace("'", "''")
$nodeQuoted = $nodePath.Replace("'", "''")
$serviceQuoted = (Join-Path $projectDirectory 'src\local-service.js').Replace("'", "''")
$commandText = "& { Set-Location -LiteralPath '$rootQuoted'; & '$nodeQuoted' '$serviceQuoted'" + '; exit $LASTEXITCODE }'
$actionArgs = '-NoProfile -NonInteractive -WindowStyle Hidden -Command "' + $commandText + '"'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    $ownedAction = $existing.Actions | Where-Object { $_.Arguments -and $_.Arguments.Contains($projectDirectory) }
    if (-not $ownedAction) { throw 'A task with this name exists for a different project. No changes made.' }
}

$action = New-ScheduledTaskAction -Execute $shellPath -Argument $actionArgs -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$description = "IUH Telegram activity watcher. Project: $projectDirectory"
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description $description -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State, Description
