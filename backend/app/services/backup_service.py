import os
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from backend.app.core.config import DATA_DIR, BASE_DIR
from backend.app.core.logging import logger

BACKUP_DIR = BASE_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "ipmonitor.db"

def perform_online_backup() -> Dict[str, Any]:
    """使用 SQLite 官方 Online Backup API 执行安全热备份 (不阻塞读写)"""
    if not DB_PATH.exists():
        raise FileNotFoundError("主数据库文件尚未生成，无法执行备份")

    now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"ipmonitor_backup_{now_str}.db"
    dest_path = BACKUP_DIR / backup_filename

    src_conn = sqlite3.connect(DB_PATH)
    dest_conn = sqlite3.connect(dest_path)
    try:
        src_conn.backup(dest_conn)
        logger.info(f"SQLite 数据库热备份成功完成: {dest_path}")
        file_size = dest_path.stat().st_size
        return {
            "success": True,
            "filename": backup_filename,
            "path": str(dest_path),
            "size_bytes": file_size,
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"SQLite 在线备份失败: {e}", exc_info=True)
        if dest_path.exists():
            dest_path.unlink()
        raise e
    finally:
        dest_conn.close()
        src_conn.close()

def list_backups() -> List[Dict[str, Any]]:
    """列出所有已存在的备份文件"""
    if not BACKUP_DIR.exists():
        return []
    files = []
    for f in BACKUP_DIR.glob("*.db"):
        stat = f.stat()
        files.append({
            "filename": f.name,
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    files.sort(key=lambda x: x["created_at"], reverse=True)
    return files
