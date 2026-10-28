@echo off
title IPMonitor Web 停止服务
cd /d "%~dp0"

echo ==================================================
echo   正在停止 IPMonitor Web 监控引擎与相关进程...
echo ==================================================

taskkill /f /im ipmonitor.exe 2>nul
if errorlevel 1 (
    echo [*] 未发现正在运行的 ipmonitor.exe 进程。
) else (
    echo [*] 已成功终止 ipmonitor.exe 监控引擎。
)

echo.
echo [完成] 服务已完全停止。
echo ==================================================
ping 127.0.0.1 -n 3 >nul