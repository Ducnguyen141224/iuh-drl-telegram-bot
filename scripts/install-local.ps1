$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$taskName = 'IUH-DRL-Local'
$nodePath = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$launcherPath = Join-Path $PSScriptRoot 'run-local-hidden.vbs'
$wscriptPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
if (-not (Test-Path -LiteralPath $launcherPath)) { throw 'Missing hidden launcher: scripts\run-local-hidden.vbs' }
$actionArgs = '//B //Nologo "' + $launcherPath + '" "' + $nodePath + '"'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    $ownedAction = $existing.Actions | Where-Object { $_.Arguments -and $_.Arguments.Contains($projectDirectory) }
    if (-not $ownedAction) { throw 'A task with this name exists for a different project. No changes made.' }
}

$action = New-ScheduledTaskAction -Execute $wscriptPath -Argument $actionArgs -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$description = "IUH Telegram activity watcher. Project: $projectDirectory"
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description $description -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State, Description
