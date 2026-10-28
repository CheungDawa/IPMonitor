@echo off
title IPMonitor Web 态势感知驾驶舱
cd /d "%~dp0"

echo ==================================================
echo   IPMonitor Web 态势感知监控驾驶舱
echo ==================================================
echo.

rem 1. 检查是否在压缩包内部临时目录直接双击运行
echo "%~dp0" | findstr /i "AppData\Local\Temp Temp1_" >nul
if not errorlevel 1 (
    echo [严重错误] 请不要在压缩包内直接双击运行！
    echo --------------------------------------------------
    echo 请先将压缩包【全部解压缩】到一个普通文件夹（如 D:\IPMonitor 或桌面），
    echo 然后进入解压后的文件夹再次双击本脚本运行。
    echo ==================================================
    pause
    exit /b 1
)

rem 2. 定位可执行核心文件
set RUN_MODE=
if exist "%~dp0ipmonitor.exe" (
    set RUN_MODE=EXE
    set TARGET_EXE="%~dp0ipmonitor.exe"
) else if exist "%~dp0dist\ipmonitor.exe" (
    set RUN_MODE=EXE
    set TARGET_EXE="%~dp0dist\ipmonitor.exe"
) else if exist "%~dp0dist\IPMonitor\ipmonitor.exe" (
    set RUN_MODE=EXE
    set TARGET_EXE="%~dp0dist\IPMonitor\ipmonitor.exe"
) else if exist "%~dp0venv\Scripts\python.exe" (
    set RUN_MODE=PYTHON
    set TARGET_PY="%~dp0venv\Scripts\python.exe"
)

if "%RUN_MODE%"=="" (
    echo ==================================================
    echo [错误] 未在当前目录下检测到核心程序 ipmonitor.exe！
    echo --------------------------------------------------
    echo 原因排查：
    echo 1. 文件夹内缺少预编译的 ipmonitor.exe 独立文件；
    echo 2. 请确认已将压缩包完整解压到本地磁盘文件夹中。
    echo ==================================================
    pause
    exit /b 1
)

rem 3. 检查并启动后台监控引擎
tasklist /fi "imagename eq ipmonitor.exe" | find /i "ipmonitor.exe" >nul
if errorlevel 1 (
    echo [*] 正在启动后台独立监控探活引擎...
    if "%RUN_MODE%"=="EXE" (
        start "IPMonitor-Engine" /min %TARGET_EXE%
    ) else (
        start "IPMonitor-Engine" /min %TARGET_PY% run.py
    )
    rem 安全等待 2 秒
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [*] 监控引擎已在后台正常运行中。
)

rem 4. 探查可用的原生视窗浏览器 (Edge / Chrome)
echo [*] 正在唤起全景态势驾驶舱视窗...
set BROWSER_CMD=

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_CMD="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8000 --start-maximized
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_CMD="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8000 --start-maximized
) else if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_CMD="%LocalAppData%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8000 --start-maximized
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set BROWSER_CMD="%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8000 --start-maximized
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set BROWSER_CMD="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8000 --start-maximized
)

if defined BROWSER_CMD (
    start "" %BROWSER_CMD%
) else (
    start "" "http://127.0.0.1:8000"
)

echo.
echo ==================================================
echo [成功] 驾驶舱已启动！
echo   - 本地驾驶舱: http://127.0.0.1:8000
echo   - 局域网访问: http://^<本机IP^>:8000
echo   - 默认管理员: admin   默认密码: admin123
echo ==================================================
ping 127.0.0.1 -n 3 >nul