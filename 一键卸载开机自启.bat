@echo off
title IPMonitor Web 卸载开机自启
cd /d "%~dp0"

echo ==================================================
echo   正在清理 IPMonitor Web 开机自启配置...
echo ==================================================

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\IPMonitor-Cockpit.lnk
set VBS_LAUNCHER=%~dp0silent_start.vbs

if exist "%SHORTCUT_PATH%" (
    del /f /q "%SHORTCUT_PATH%"
    echo [*] 已从自启目录中移除开机自启项。
) else (
    echo [*] 未发现开机自启快捷方式。
)

if exist "%VBS_LAUNCHER%" (
    del /f /q "%VBS_LAUNCHER%"
)

echo.
echo [成功] 开机自启已成功解除！
echo ==================================================
pause