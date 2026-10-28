import json
import os
import platform
try:
    import psutil
except ImportError:
    psutil = None
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.core.exceptions import ValidationException
from backend.app.models.setting import SystemSetting
from backend.app.services.backup_service import perform_online_backup, list_backups
from backend.app.api.deps import get_current_admin

router = APIRouter(prefix="/system", tags=["系统管理与运维"])

@router.get("/status")
def get_system_status():
    """获取系统运行时资源与宿主环境状态"""
    mem_total = 0
    mem_used = 0
    mem_percent = 0.0
    cpu_percent = 0.0
    cpu_count = 1
    if psutil:
        mem = psutil.virtual_memory()
        mem_total = round(mem.total / (1024 * 1024), 1)
        mem_used = round(mem.used / (1024 * 1024), 1)
        mem_percent = mem.percent
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True)

    return success_response(data={
        "os": platform.system(),
        "os_release": platform.release(),
        "python_version": platform.python_version(),
        "cpu_count": cpu_count,
        "cpu_percent": cpu_percent,
        "memory_total_mb": mem_total,
        "memory_used_mb": mem_used,
        "memory_percent": mem_percent
    })

@router.get("/settings")
def get_all_settings(db: Session = Depends(get_db)):
    """获取全部系统参数配置"""
    settings_records = db.query(SystemSetting).all()
    res = {}
    for s in settings_records:
        try:
            res[s.key] = json.loads(s.value)
        except Exception:
            res[s.key] = s.value
    return success_response(data=res)

@router.put("/settings")
def update_settings(payload: dict, db: Session = Depends(get_db), current_user = Depends(get_current_admin)):
    """保存或更新系统参数配置"""
    for k, v in payload.items():
        record = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        val_str = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
        if record:
            record.value = val_str
        else:
            record = SystemSetting(key=k, value=val_str)
            db.add(record)
    db.commit()
    return success_response(message="系统配置更新成功")

@router.post("/backup")
def trigger_backup(current_user = Depends(get_current_admin)):
    """手动触发 SQLite 在线安全热备份"""
    res = perform_online_backup()
    return success_response(data=res, message="数据库备份创建成功")

@router.get("/backups")
def get_backups(current_user = Depends(get_current_admin)):
    """获取备份文件清单"""
    files = list_backups()
    return success_response(data=files)
