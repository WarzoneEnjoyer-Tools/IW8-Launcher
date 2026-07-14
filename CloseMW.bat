@echo off
NET SESSION >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Closing Modern Warfare...
taskkill /f /im ModernWarfare.exe 2>nul

echo.
echo Killed Program.
exit
