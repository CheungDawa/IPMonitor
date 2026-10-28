@echo off
chcp 65001 >nul
title IPMonitor Web
cd /d "%~dp0"

if exist "venv\Scripts\python.exe" (
    echo ==================================================
    echo 🚀 正在启动 IPMonitor Web 服务...
    echo 🌐 访问地址: http://localhost:8000
    echo 📚 API 文档: http://localhost:8000/docs
    echo ==================================================
    "venv\Scripts\python.exe" run.py
) else (
    echo [错误] 未找到虚拟环境 venv\Scripts\python.exe，请先创建环境并安装依赖。
    pause
)
