import json
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from backend.app.core.database import Base, engine, SessionLocal
from backend.app.core.security import hash_password
from backend.app.core.logging import logger
from backend.app.models.user import User
from backend.app.models.group import DeviceGroup
from backend.app.models.device import Device
from backend.app.models.alert import AlertRule, AlertRecord
from backend.app.models.setting import SystemSetting

from backend.app.core.config import settings

CONFIG_FILE = settings.BASE_DIR / "config.json"
CONFIG_EXAMPLE_FILE = settings.BASE_DIR / "config.example.json"

def init_db(db: Session = None):
    """创建所有表结构并执行种子数据迁移"""
    logger.info("正在初始化数据库表结构...")
    Base.metadata.create_all(bind=engine)
    
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
        
    try:
        # 1. 初始化默认管理员账号
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            logger.info("未检测到管理员账号，正在创建默认管理员账号: admin / admin123")
            admin_user = User(
                username="admin",
                password_hash=hash_password("admin123"),
                email="admin@example.com",
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            
        # 2. 初始化默认设备分组
        default_group = db.query(DeviceGroup).filter(DeviceGroup.name == "默认分组").first()
        if not default_group:
            default_group = DeviceGroup(
                name="默认分组",
                description="系统初始默认分组",
                color="#3B82F6",
                sort_order=1
            )
            db.add(default_group)
            db.commit()
            db.refresh(default_group)

        # 3. 初始化默认告警规则
        default_rule = db.query(AlertRule).first()
        if not default_rule:
            default_rule = AlertRule(
                name="通用默认告警规则",
                failure_threshold=3,
                re_alert_interval_minutes=60,
                notify_recovery=True,
                enabled=True,
                channels="wecom,dingtalk,feishu,email"
            )
            db.add(default_rule)
            db.commit()

        # 4. 平滑迁移旧版 config.json / config.example.json
        migrate_legacy_config(db, default_group.id)

        # 5. 平滑校准历史 UTC 告警记录为宿主机本地时间
        migrate_utc_to_local_time(db)
        
    except Exception as e:
        logger.error(f"数据库初始化或迁移异常: {e}", exc_info=True)
        db.rollback()
        raise e
    finally:
        if close_db:
            db.close()

def migrate_legacy_config(db: Session, default_group_id: int):
    """读取已有的 config.json 或 config.example.json 并迁移至数据库"""
    target_config_file = None
    if CONFIG_FILE.exists():
        target_config_file = CONFIG_FILE
    elif CONFIG_EXAMPLE_FILE.exists():
        target_config_file = CONFIG_EXAMPLE_FILE
        
    if not target_config_file:
        logger.info("未找到旧版配置文件，跳过迁移。")
        return

    try:
        with open(target_config_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            
        # 迁移系统配置项
        for section in ["monitoring", "alert", "email", "system"]:
            if section in cfg:
                setting_record = db.query(SystemSetting).filter(SystemSetting.key == section).first()
                if not setting_record:
                    db.add(SystemSetting(
                        key=section,
                        value=json.dumps(cfg[section], ensure_ascii=False),
                        description=f"从旧版配置文件迁移的 {section} 配置"
                    ))
        db.commit()
        
        # 迁移已有目标资产 (仅在设备表完全为空时导入，避免覆盖现有数据)
        existing_devices_count = db.query(Device).count()
        if existing_devices_count == 0 and "targets" in cfg and isinstance(cfg["targets"], list):
            logger.info(f"检测到设备表为空，正在从 {target_config_file.name} 迁移 {len(cfg['targets'])} 条资产记录...")
            for item in cfg["targets"]:
                name = item.get("name", "未命名设备")
                addr = item.get("address", "").strip()
                if not addr:
                    continue
                method = item.get("method", "ping").lower()
                port = None
                raw_port = item.get("port")
                if raw_port and str(raw_port).strip().isdigit():
                    port = int(str(raw_port).strip())
                note = item.get("note", "")
                enabled = item.get("enabled", True)
                
                device = Device(
                    name=name,
                    ip_address=addr,
                    device_type="server",
                    group_id=default_group_id,
                    method=method,
                    port=port,
                    enabled=enabled,
                    status="UNKNOWN",
                    failure_count=0,
                    note=note,
                    location_status="unlocated",
                    location_method="none"
                )
                db.add(device)
            db.commit()
            logger.info("旧版资产数据平滑迁移成功。")
            
    except Exception as e:
        logger.warning(f"迁移旧版配置发生告警 (非致命): {e}")
        db.rollback()

def migrate_utc_to_local_time(db: Session):
    """检测并平滑升级历史 UTC 告警记录为当前宿主机的本地时间"""
    try:
        import re
        from datetime import timezone, timedelta
        local_now = datetime.now()
        utc_now = datetime.now(timezone.utc).replace(tzinfo=None)
        offset = local_now - utc_now
        
        # 如果时差小于 1 分钟（例如系统本身就是 UTC 时区），无需调整
        if abs(offset.total_seconds()) < 60:
            return

        records = db.query(AlertRecord).filter(AlertRecord.content.like("%UTC%")).all()
        if not records:
            return

        logger.info(f"检测到 {len(records)} 条历史 UTC 告警记录，正在平滑校准为宿主机本地时间 (偏移量: {offset})...")
        for r in records:
            if r.triggered_at:
                r.triggered_at = r.triggered_at + offset
            if r.resolved_at:
                r.resolved_at = r.resolved_at + offset
            
            def _replace_utc_time(m):
                time_str = m.group(1)
                try:
                    dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                    local_dt = dt + offset
                    return "告警时间：" + local_dt.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    return f"告警时间：{time_str}"

            def _replace_recovery_time(m):
                time_str = m.group(1)
                try:
                    dt = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                    local_dt = dt + offset
                    return "恢复时间：" + local_dt.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    return f"恢复时间：{time_str}"

            r.content = re.sub(r"告警时间：(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) UTC", _replace_utc_time, r.content)
            r.content = re.sub(r"恢复时间：(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) UTC", _replace_recovery_time, r.content)
            r.content = r.content.replace(" UTC", "")
        
        db.commit()
        logger.info("历史告警记录已全部成功校准至宿主机本地时间。")
    except Exception as e:
        db.rollback()
        logger.warning(f"历史告警时间校准跳过: {e}")
