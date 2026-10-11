param([switch]$CheckOnly, [switch]$SkipLogin)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
$envFile = Join-Path $projectDirectory '.env'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath;$env:Path"
}

function Find-Node {
    $command = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    foreach ($directory in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if (-not $directory) { continue }
        foreach ($suffix in @('nodejs\node.exe', 'Programs\nodejs\node.exe')) {
            $candidate = Join-Path $directory $suffix
            if (Test-Path -LiteralPath $candidate) { return $candidate }
        }
    }
    return $null
}

function Find-Chrome {
    foreach ($directory in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if (-not $directory) { continue }
        $candidate = Join-Path $directory 'Google\Chrome\Application\chrome.exe'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Read-EnvSetting([string]$Name) {
    if (-not (Test-Path -LiteralPath $envFile)) { return '' }
    $content = [IO.File]::ReadAllText($envFile)
    $match = [regex]::Match($content, '(?m)^\s*' + [regex]::Escape($Name) + '\s*=([^\r\n]*)')
    if (-not $match.Success) { return '' }
    return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Set-EnvSetting([string]$Name, [string]$Value) {
    if ($Value.Contains("`r") -or $Value.Contains("`n")) { throw 'Configuration values must fit on one line.' }
    $content = [IO.File]::ReadAllText($envFile)
    $pattern = '(?m)^[ \t]*' + [regex]::Escape($Name) + '[ \t]*=[^\r\n]*'
    if ([regex]::IsMatch($content, $pattern)) {
        $replacementValue = $Name + '=' + $Value
        $content = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacementValue })
    } else { $content = $content.TrimEnd() + "`r`n" + $Name + '=' + $Value + "`r`n" }
    [IO.File]::WriteAllText($envFile, $content, $utf8)
}

function Install-Prerequisite([string]$Id, [string]$Label) {
    $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) {
        throw 'WinGet is unavailable. Install Node.js LTS from https://nodejs.org/ and Chrome from https://www.google.com/chrome/ then run this installer again.'
    }
    Write-Host "Installing $Label using WinGet. Windows may ask you to approve the installer."
    & $winget.Source install --id $Id --exact --source winget --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "$Label installation failed. Install it manually, then run this file again." }
    Refresh-Path
}

try {
    Refresh-Path
    $nodePath = Find-Node
    $nodeVersion = ''
    $nodeSupported = $false
    if ($nodePath) {
        $nodeVersion = [string](& $nodePath --version)
        $nodeSupported = $nodeVersion -match '^v(\d+)\.' -and [int]$Matches[1] -ge 20
    }
    $chromePath = Find-Chrome

    if ($CheckOnly) {
        [PSCustomObject]@{
            NodeSupported = $nodeSupported
            NodeVersion = $nodeVersion
            ChromeFound = [bool]$chromePath
            WinGetFound = [bool](Get-Command winget.exe -ErrorAction SilentlyContinue)
            EnvFileExists = (Test-Path -LiteralPath $envFile)
            TelegramTokenConfigured = [bool](Read-EnvSetting 'TELEGRAM_BOT_TOKEN')
            TelegramChatConfigured = [bool](Read-EnvSetting 'TELEGRAM_CHAT_ID')
        } | Format-List
        exit 0
    }

    Write-Host 'Before migrating: stop this Telegram bot on the OLD computer.'
    Write-Host 'This installer may install Node.js LTS and Chrome if missing.'
    Write-Host '[1/6] Checking prerequisites...'
    if (-not $nodeSupported) {
        Install-Prerequisite 'OpenJS.NodeJS.LTS' 'Node.js LTS'
        $nodePath = Find-Node
        if (-not $nodePath) { throw 'Node.js not found after installation. Close this window and run the installer again.' }
        $nodeVersion = [string](& $nodePath --version)
        if (-not ($nodeVersion -match '^v(\d+)\.' -and [int]$Matches[1] -ge 20)) { throw 'Node.js 20 or newer is required.' }
    }
    # Make an installed Node outside the current PATH discoverable to npm and the task installer.
    $env:Path = (Split-Path -Parent $nodePath) + ';' + $env:Path
    if (-not $chromePath) {
        Install-Prerequisite 'Google.Chrome' 'Google Chrome'
        $chromePath = Find-Chrome
        if (-not $chromePath) { throw 'Chrome not found after installation. Install Chrome manually and run again.' }
    }

    $existingTask = Get-ScheduledTask -TaskName 'IUH-DRL-Local' -ErrorAction SilentlyContinue
    if ($existingTask) {
        $ownedAction = $existingTask.Actions | Where-Object { $_.Arguments -and $_.Arguments.Contains($projectDirectory) }
        if (-not $ownedAction) { throw 'An IUH bot task already points at another folder. Use that folder or stop/remove its task before migrating.' }
        & (Join-Path $PSScriptRoot 'stop-local.ps1')
    }

    Write-Host '[2/6] Installing project dependencies...'
    $npmPath = (Get-Command npm.cmd -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    & $npmPath ci --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed. Check your network, then run the installer again.' }

    Write-Host '[3/6] Configuring Telegram...'
    if (-not (Test-Path -LiteralPath $envFile)) {
        [IO.File]::WriteAllText($envFile, [IO.File]::ReadAllText((Join-Path $projectDirectory '.env.example')), $utf8)
    }
    if (-not (Read-EnvSetting 'TELEGRAM_BOT_TOKEN')) {
        $secureToken = Read-Host 'Paste Telegram BotFather token (input is hidden), then press Enter' -AsSecureString
        $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
        try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
        $token = $token.Trim()
        if ($token -notmatch '^\d+:[A-Za-z0-9_-]+$') { throw 'Token format is invalid. Run the installer again.' }
        Set-EnvSetting 'TELEGRAM_BOT_TOKEN' $token
        $token = $null
        $secureToken.Dispose()
    }
    Set-EnvSetting 'POLL_INTERVAL_SECONDS' '60'
    Set-EnvSetting 'HEADLESS' 'true'
    Set-EnvSetting 'CHROME_EXECUTABLE_PATH' $chromePath
    if (-not (Read-EnvSetting 'TELEGRAM_CHAT_ID')) {
        Write-Host 'Send /start to your Telegram bot now.'
        $chatId = Read-Host 'Chat ID if known (press Enter to detect from /start)'
        if ($chatId) {
            if ($chatId -notmatch '^\d+$') { throw 'Use a numeric private chat ID.' }
            Set-EnvSetting 'TELEGRAM_CHAT_ID' $chatId
        }
    }
    while ($true) {
        & $nodePath 'src/setup-telegram.js' --save-chat-id
        if ($LASTEXITCODE -eq 0) { break }
        $answer = Read-Host 'Fix the issue above, send /start if needed. Enter to retry, or Q to quit'
        if ($answer -eq 'q') { throw 'Telegram setup was not completed. You can run the installer again.' }
    }
    & $nodePath 'src/setup-telegram.js' --send-test
    if ($LASTEXITCODE -ne 0) { throw 'Telegram test message could not be sent. Check token/chat ID and rerun.' }

    Write-Host '[4/6] Saving the IUH login session...'
    if (-not $SkipLogin) {
        Write-Host 'Log in and enter the CAPTCHA in the Chrome window. The session saves automatically.'
        & $nodePath 'src/login.js' --wait
        if ($LASTEXITCODE -ne 0) { throw 'IUH login did not finish. Run the installer again, or use -SkipLogin to configure first.' }
        & $nodePath 'src/index.js' --once
        if ($LASTEXITCODE -ne 0) { Write-Warning 'The initial IUH check is not ready. The background watcher will retry and notify you.' }
    } else { Write-Host 'Login skipped. The bot will remind you to log in locally.' }

    Write-Host '[5/6] Enabling local background startup...'
    & (Join-Path $PSScriptRoot 'install-local.ps1')
    Write-Host '[6/6] Finished.'
    Write-Host 'Send /status or /events in Telegram. The bot checks IUH every 60 seconds.'
    Write-Host 'Keep this folder in its current location. Startup uses its absolute path.'
    exit 0
} catch {
    Write-Host ('Setup failed: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
