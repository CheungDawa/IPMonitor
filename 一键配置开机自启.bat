@echo off
title IPMonitor Web 开机自启配置向导
cd /d "%~dp0"

echo ==================================================
echo   IPMonitor Web 开机自启与驾驶舱全屏点亮安装向导
echo ==================================================
echo.

set TARGET_BAT=%~dp0IPMonitor-驾驶舱.bat
if not exist "%TARGET_BAT%" (
    echo [错误] 未在当前目录下检测到 IPMonitor-驾驶舱.bat 文件！
    pause
    exit /b 1
)

rem 生成用于开机静默唤起的 VBS 脚本 (彻底消除启动时的黑框 cmd 窗口)
set VBS_LAUNCHER=%~dp0silent_start.vbs
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run chr(34^) ^& "%TARGET_BAT%" ^& chr(34^), 0, False
) > "%VBS_LAUNCHER%"

rem 在 Windows 用户开机自启目录生成快捷方式
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\IPMonitor-Cockpit.lnk

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_LAUNCHER%\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'IPMonitor Web 监控驾驶舱自启服务'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo [成功] 开机自启动快捷方式已注册至:
    echo        %SHORTCUT_PATH%
    echo.
    echo [生效机制]: 
    echo   1. 计算机开机登录后，系统自动静默启动后台监控探活引擎；
    echo   2. 自动全屏/窗口化弹出宜宾全景监控驾驶舱；
    echo   3. 即使中途误关闭大屏窗口，后台探活与告警亦持续稳定运行。
    echo.
    echo ==================================================
) else (
    echo [警告] 快捷方式注册失败，请尝试右键以管理员身份运行本脚本。
)

pause