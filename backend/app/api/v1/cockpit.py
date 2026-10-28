from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.models.device import Device
from backend.app.models.group import DeviceGroup
from backend.app.models.event import DeviceEvent
from backend.app.models.alert import AlertRecord
from backend.app.models.probe_log import ProbeLog
from backend.app.models.setting import SystemSetting

router = APIRouter(prefix="/cockpit", tags=["监控驾驶舱门户"])

@router.get("/overview")
def get_cockpit_overview(db: Session = Depends(get_db)):
    """
    驾驶舱专用全景聚合接口：
    一次性聚合并返回大屏展示所需的所有态势感知数据（统计指标、地图点位、时延排查、实时告警与事件流水），
    彻底避免前端大屏频繁调用多个分散接口。
    """
    now = datetime.now(timezone.utc)

    # 1. 核心运行指标
    total = db.query(Device).count()
    online = db.query(Device).filter(Device.status == "ONLINE").count()
    offline = db.query(Device).filter(Device.status == "OFFLINE").count()
    unknown = db.query(Device).filter(Device.status == "UNKNOWN").count()
    disabled = db.query(Device).filter(Device.status == "DISABLED").count()

    monitored = online + offline + unknown
    uptime_ratio = round((online / monitored) * 100.0, 1) if monitored > 0 else (100.0 if total > 0 and disabled == total else 0.0)

    # 2. 地图点位与分布
    located_devices = db.query(Device).filter(Device.latitude.isnot(None), Device.longitude.isnot(None)).all()
    map_points = []
    for d in located_devices:
        map_points.append({
            "id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "device_type": d.device_type,
            "group_name": d.group.name if d.group else "未分组",
            "group_color": d.group.color if d.group else "#3b82f6",
            "status": d.status,
            "method": d.method,
            "latitude": d.latitude,
            "longitude": d.longitude,
            "location_address": d.location_address,
            "location_note": d.location_note,
            "last_probe_time": d.last_probe_time.isoformat() if d.last_probe_time else None
        })

    # 3. 分组健康度矩阵
    groups = db.query(DeviceGroup).all()
    group_health = []
    for g in groups:
        g_total = db.query(Device).filter(Device.group_id == g.id).count()
        g_online = db.query(Device).filter(Device.group_id == g.id, Device.status == "ONLINE").count()
        g_offline = db.query(Device).filter(Device.group_id == g.id, Device.status == "OFFLINE").count()
        g_pct = round((g_online / g_total) * 100.0, 1) if g_total > 0 else 100.0
        group_health.append({
            "id": g.id,
            "name": g.name,
            "color": g.color,
            "total": g_total,
            "online": g_online,
            "offline": g_offline,
            "health_percent": g_pct
        })

    # 4. 关键节点最近时延遥测 (按在线节点提取最近一条成功 ProbeLog)
    latency_nodes = []
    online_devs = db.query(Device).filter(Device.status == "ONLINE").limit(8).all()
    for od in online_devs:
        last_log = (
            db.query(ProbeLog)
            .filter(ProbeLog.device_id == od.id, ProbeLog.success == True)
            .order_by(ProbeLog.id.desc())
            .first()
        )
        latency_nodes.append({
            "id": od.id,
            "name": od.name,
            "ip": od.ip_address,
            "method": od.method.upper(),
            "latency_ms": last_log.latency_ms if last_log and last_log.latency_ms is not None else 1.5
        })

    # 5. 未结活动告警
    active_alerts = (
        db.query(AlertRecord)
        .filter(AlertRecord.status == "active")
        .order_by(AlertRecord.id.desc())
        .limit(10)
        .all()
    )
    alerts_data = []
    for a in active_alerts:
        alerts_data.append({
            "id": a.id,
            "device_name": a.device.name if a.device else "已删除设备",
            "ip_address": a.device.ip_address if a.device else "-",
            "alert_type": a.alert_type,
            "title": a.title,
            "content": a.content,
            "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None
        })

    # 6. 实时状态变动流水 (Ticker)
    recent_events = (
        db.query(DeviceEvent)
        .order_by(DeviceEvent.id.desc())
        .limit(10)
        .all()
    )
    events_ticker = []
    for ev in recent_events:
        events_ticker.append({
            "id": ev.id,
            "device_name": ev.device.name if ev.device else "已删除设备",
            "ip_address": ev.device.ip_address if ev.device else "-",
            "from_status": ev.from_status,
            "to_status": ev.to_status,
            "event_type": ev.event_type,
            "duration_seconds": ev.duration_seconds,
            "details": ev.details,
            "created_at": ev.created_at.isoformat() if ev.created_at else None
        })

    # 6. 地图默认视角设定 (用户在后台可自定义中心经纬度、缩放级别与焦点名称)
    map_lat_s = db.query(SystemSetting).filter(SystemSetting.key == "map_center_lat").first()
    map_lng_s = db.query(SystemSetting).filter(SystemSetting.key == "map_center_lng").first()
    map_zoom_s = db.query(SystemSetting).filter(SystemSetting.key == "map_default_zoom").first()
    map_name_s = db.query(SystemSetting).filter(SystemSetting.key == "map_focus_name").first()

    try:
        center_lat = float(map_lat_s.value) if map_lat_s else 35.0
        center_lng = float(map_lng_s.value) if map_lng_s else 105.0
        default_zoom = int(map_zoom_s.value) if map_zoom_s else 5
        focus_name = map_name_s.value if map_name_s else "默认视角"
    except Exception:
        center_lat, center_lng, default_zoom, focus_name = 35.0, 105.0, 5, "默认视角"

    map_config = {
        "center_lat": center_lat,
        "center_lng": center_lng,
        "default_zoom": default_zoom,
        "focus_name": focus_name
    }

    return success_response(data={
        "summary": {
            "total_devices": total,
            "online_devices": online,
            "offline_devices": offline,
            "unknown_devices": unknown,
            "disabled_devices": disabled,
            "uptime_ratio": uptime_ratio,
            "active_alerts_count": len(active_alerts)
        },
        "map_points": map_points,
        "map_config": map_config,
        "total_unlocated": total - len(map_points),
        "group_health": group_health,
        "latency_nodes": latency_nodes,
        "active_alerts": alerts_data,
        "events_ticker": events_ticker,
        "server_time": now.isoformat()
    })
