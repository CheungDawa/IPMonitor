from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.models.device import Device
from backend.app.models.event import DeviceEvent
from backend.app.models.alert import AlertRecord
from backend.app.models.group import DeviceGroup

router = APIRouter(prefix="/dashboard", tags=["监控大屏"])

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """计算真实监控概览统计数据"""
    total = db.query(Device).count()
    online = db.query(Device).filter(Device.status == "ONLINE").count()
    offline = db.query(Device).filter(Device.status == "OFFLINE").count()
    unknown = db.query(Device).filter(Device.status == "UNKNOWN").count()
    disabled = db.query(Device).filter(Device.status == "DISABLED").count()

    located = db.query(Device).filter(
        Device.latitude.isnot(None),
        Device.longitude.isnot(None),
        Device.location_status == "located"
    ).count()
    unlocated = total - located

    active_alerts = db.query(AlertRecord).filter(AlertRecord.status == "active").count()

    # 在线率计算：排除已禁用的设备；若无监控设备则为 0.0%
    monitored_devices = online + offline + unknown
    if monitored_devices > 0:
        uptime_ratio = round((online / monitored_devices) * 100.0, 1)
    else:
        uptime_ratio = 100.0 if total > 0 and disabled == total else 0.0

    return success_response(data={
        "total_devices": total,
        "online_devices": online,
        "offline_devices": offline,
        "unknown_devices": unknown,
        "disabled_devices": disabled,
        "located_devices": located,
        "unlocated_devices": unlocated,
        "uptime_ratio": uptime_ratio,
        "active_alerts": active_alerts
    })

@router.get("/recent-events")
def get_recent_events(limit: int = Query(15, ge=1, le=100), db: Session = Depends(get_db)):
    """获取大屏最新状态变更时间线"""
    events = (
        db.query(DeviceEvent)
        .order_by(DeviceEvent.id.desc())
        .limit(limit)
        .all()
    )

    items = []
    for ev in events:
        items.append({
            "id": ev.id,
            "device_id": ev.device_id,
            "device_name": ev.device.name if ev.device else "已删除设备",
            "ip_address": ev.device.ip_address if ev.device else "-",
            "from_status": ev.from_status,
            "to_status": ev.to_status,
            "event_type": ev.event_type,
            "duration_seconds": ev.duration_seconds,
            "details": ev.details,
            "created_at": ev.created_at.strftime("%Y-%m-%d %H:%M:%S") if ev.created_at else None
        })

    return success_response(data=items)

@router.get("/fault-trend")
def get_fault_trend(db: Session = Depends(get_db)):
    """按时间窗口统计过去 24 小时故障与恢复趋势折线数据"""
    now = datetime.now()
    points = []
    
    # 划分 12 个点，每个点跨度 2 小时
    for i in range(11, -1, -1):
        window_start = now - timedelta(hours=(i + 1) * 2)
        window_end = now - timedelta(hours=i * 2)
        
        offline_cnt = db.query(DeviceEvent).filter(
            DeviceEvent.event_type == "offline",
            DeviceEvent.created_at >= window_start,
            DeviceEvent.created_at < window_end
        ).count()
        
        online_cnt = db.query(DeviceEvent).filter(
            DeviceEvent.event_type == "online",
            DeviceEvent.created_at >= window_start,
            DeviceEvent.created_at < window_end
        ).count()

        points.append({
            "time": window_end.strftime("%H:%M"),
            "offline_count": offline_cnt,
            "online_count": online_cnt
        })

    return success_response(data={"points": points})

@router.get("/group-summary")
def get_group_summary(db: Session = Depends(get_db)):
    """按分组汇总在线与离线比例"""
    groups = db.query(DeviceGroup).all()
    summary = []
    for g in groups:
        total = db.query(Device).filter(Device.group_id == g.id).count()
        online = db.query(Device).filter(Device.group_id == g.id, Device.status == "ONLINE").count()
        offline = db.query(Device).filter(Device.group_id == g.id, Device.status == "OFFLINE").count()
        summary.append({
            "id": g.id,
            "name": g.name,
            "color": g.color,
            "total": total,
            "online": online,
            "offline": offline
        })
    return success_response(data=summary)
