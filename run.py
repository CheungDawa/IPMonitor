"""
IPMonitor Web 主服务启动入口
支持原生 Python 环境运行以及 PyInstaller 独立二进制 EXE 运行
"""
import sys
import os
import multiprocessing

# Windows 终端 GBK 兼容性保护
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 保证根目录在 sys.path 中
if getattr(sys, "frozen", False):
    # PyInstaller 冻结环境
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import uvicorn
from backend.app.main import app

def main():
    multiprocessing.freeze_support()
    
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    
    print("==================================================")
    print("[*] 正在启动 IPMonitor Web 服务...")
    print(f"[*] 访问地址: http://localhost:{port}")
    print(f"[*] API 文档: http://localhost:{port}/docs")
    print("==================================================")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )

if __name__ == "__main__":
    main()
