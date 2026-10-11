@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo IUH Telegram Bot - Cai dat tren may moi
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-machine.ps1" %*
if errorlevel 1 (
    echo.
    echo Cai dat chua hoan tat. Xem thong bao loi phia tren va chay lai file nay.
) else (
    echo.
    echo Hoan tat. Mo Telegram va gui /status de kiem tra.
)
pause
endlocal
