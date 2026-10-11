param([string]$OutputPath)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) {
    $OutputPath = Join-Path $projectDirectory 'dist\IUH-Telegram-Bot-Setup.zip'
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $OutputPath) { throw 'Output ZIP already exists. Use another -OutputPath to preserve it.' }
$templatePath = Join-Path $projectDirectory '.env.example'
$templateText = [IO.File]::ReadAllText($templatePath)
if ($templateText -match '(?m)^TELEGRAM_(BOT_TOKEN|CHAT_ID)=[^\r\n\s]+') {
    throw 'The example environment contains Telegram credentials. Clear the template before packaging.'
}

$relativeFiles = @('package.json', 'package-lock.json', '.env.example', '.gitignore', 'README.md', 'HUONG_DAN_CAI_DAT.md', 'Cai-dat-may-moi.bat')
$relativeFiles += Get-ChildItem -LiteralPath $projectDirectory -File | Where-Object { $_.Extension -eq '.cmd' } | ForEach-Object { $_.Name }
foreach ($folder in @('src', 'scripts', 'test')) {
    $relativeFiles += Get-ChildItem -LiteralPath (Join-Path $projectDirectory $folder) -File -Recurse | ForEach-Object {
        $_.FullName.Substring($projectDirectory.Length + 1)
    }
}
foreach ($relativeFile in $relativeFiles) {
    $contents = [IO.File]::ReadAllText((Join-Path $projectDirectory $relativeFile))
    if ($contents -match '\d{6,}:[A-Za-z0-9_-]{25,}') { throw "Possible Telegram token detected in $relativeFile. Packaging stopped." }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Directory]::CreateDirectory((Split-Path -Parent $OutputPath)) | Out-Null
$archive = [IO.Compression.ZipFile]::Open($OutputPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relativeFile in $relativeFiles) {
        $entryName = $relativeFile.Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectDirectory $relativeFile), $entryName) | Out-Null
    }
} finally { $archive.Dispose() }
Write-Output $OutputPath
