@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File scripts\install-local.ps1
if errorlevel 1 pause
