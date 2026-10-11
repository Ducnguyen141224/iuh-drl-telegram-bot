$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$taskName = 'IUH-DRL-Local'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    $ownedAction = $task.Actions | Where-Object { $_.Arguments -and $_.Arguments.Contains($projectDirectory) }
    if (-not $ownedAction) { throw 'Task belongs to a different project.' }
    Disable-ScheduledTask -TaskName $taskName | Out-Null
    Stop-ScheduledTask -TaskName $taskName
}
$statusPath = Join-Path $projectDirectory 'data\local-service-status.json'
if (Test-Path -LiteralPath $statusPath) {
    $status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
    $targetIds = @($status.children.'telegram-bot', $status.children.watcher, $status.pid)
    foreach ($targetId in $targetIds) {
        if (-not $targetId) { continue }
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$targetId" -ErrorAction SilentlyContinue
        if ($processInfo -and $processInfo.Name -eq 'node.exe' -and $processInfo.CommandLine.Contains((Join-Path $projectDirectory 'src'))) {
            Stop-Process -Id $targetId -Force
        }
    }
}
Write-Output 'IUH bot stopped. Login and event data have been kept.'
