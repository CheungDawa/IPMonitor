from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.core.exceptions import NotFoundException, ValidationException
from backend.app.models.device import Device
from backend.app.models.group import DeviceGroup
from backend.app.models.probe_log import ProbeLog
from backend.app.models.event import DeviceEvent
from backend.app.schemas.device import DeviceCreate, DeviceUpdate
from backend.app.services.geo import validate_coordinates
from backend.app.engine.scheduler import monitor_engine
from backend.app.api.deps import get_current_user

def dt_str(dt: Optional[datetime]) -> Optional[str]:
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else None

router = APIRouter(prefix="/devices", tags=["设备管理"])

@router.get("")
def list_devices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    group_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    location_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Device)
    
    if group_id is not None:
        query = query.filter(Device.group_id == group_id)
    if status:
        query = query.filter(Device.status == status.upper())
    if device_type:
        query = query.filter(Device.device_type == device_type)
    if location_status:
        query = query.filter(Device.location_status == location_status)
    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(or_(Device.name.like(s), Device.ip_address.like(s), Device.note.like(s)))

    total = query.count()
    devices = query.order_by(Device.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for d in devices:
        items.append({
            "id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "device_type": d.device_type,
            "group_id": d.group_id,
            "group_name": d.group.name if d.group else "未分组",
            "group_color": d.group.color if d.group else "#9CA3AF",
            "method": d.method,
            "port": d.port,
            "timeout_seconds": d.timeout_seconds,
            "interval_seconds": d.interval_seconds,
            "retry_count": d.retry_count,
            "enabled": d.enabled,
            "status": d.status,
            "failure_count": d.failure_count,
            "last_probe_time": dt_str(d.last_probe_time),
            "last_online_time": dt_str(d.last_online_time),
            "offline_since": dt_str(d.offline_since),
            "latitude": d.latitude,
            "longitude": d.longitude,
            "location_address": d.location_address,
            "formatted_address": d.formatted_address,
            "location_method": d.location_method,
            "location_status": d.location_status,
            "location_accuracy": d.location_accuracy,
            "location_provider": d.location_provider,
            "location_updated_at": dt_str(d.location_updated_at),
            "location_note": d.location_note,
            "note": d.note,
            "created_at": dt_str(d.created_at),
            "updated_at": dt_str(d.updated_at)
        })

    return success_response(data={
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items
    })

@router.post("")
def create_device(
    req: DeviceCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 经纬度合法性校验
    valid, msg = validate_coordinates(req.latitude, req.longitude)
    if not valid:
        raise ValidationException(msg)

    # 检查分组合法性
    if req.group_id:
        group = db.query(DeviceGroup).filter(DeviceGroup.id == req.group_id).first()
        if not group:
            raise ValidationException("指定的分组不存在")

    now = datetime.now()
    is_located = req.latitude is not None and req.longitude is not None
    loc_status = "located" if is_located else "unlocated"
    loc_method = req.location_method if is_located else "none"

    device = Device(
        name=req.name.strip(),
        ip_address=req.ip_address.strip(),
        device_type=req.device_type,
        group_id=req.group_id,
        method=req.method.lower(),
        port=req.port,
        timeout_seconds=req.timeout_seconds,
        interval_seconds=req.interval_seconds,
        retry_count=req.retry_count,
        enabled=req.enabled,
        status="UNKNOWN" if req.enabled else "DISABLED",
        failure_count=0,
        note=req.note,
        # 位置字段
        latitude=req.latitude,
        longitude=req.longitude,
        location_address=req.location_address,
        formatted_address=req.formatted_address,
        location_method=loc_method,
        location_status=loc_status,
        location_accuracy=req.location_accuracy,
        location_provider=req.location_provider,
        location_updated_at=now if is_located else None,
        location_note=req.location_note
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return success_response(data={"id": device.id, "name": device.name}, message="设备添加成功")

@router.get("/{device_id}")
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise NotFoundException("指定设备不存在")

    # 查询最近 20 条探测日志与状态变动记录
    probe_logs = (
        db.query(ProbeLog)
        .filter(ProbeLog.device_id == device_id)
        .order_by(ProbeLog.id.desc())
        .limit(20)
        .all()
    )
    events = (
        db.query(DeviceEvent)
        .filter(DeviceEvent.device_id == device_id)
        .order_by(DeviceEvent.id.desc())
        .limit(20)
        .all()
    )

    detail = {
        "id": device.id,
        "name": device.name,
        "ip_address": device.ip_address,
        "device_type": device.device_type,
        "group_id": device.group_id,
        "group_name": device.group.name if device.group else "未分组",
        "group_color": device.group.color if device.group else "#9CA3AF",
        "method": device.method,
        "port": device.port,
        "timeout_seconds": device.timeout_seconds,
        "interval_seconds": device.interval_seconds,
        "retry_count": device.retry_count,
        "enabled": device.enabled,
        "status": device.status,
        "failure_count": device.failure_count,
        "last_probe_time": dt_str(device.last_probe_time),
        "last_online_time": dt_str(device.last_online_time),
        "offline_since": dt_str(device.offline_since),
        "latitude": device.latitude,
        "longitude": device.longitude,
        "location_address": device.location_address,
        "formatted_address": device.formatted_address,
        "location_method": device.location_method,
        "location_status": device.location_status,
        "location_accuracy": device.location_accuracy,
        "location_provider": device.location_provider,
        "location_updated_at": dt_str(device.location_updated_at),
        "location_note": device.location_note,
        "note": device.note,
        "created_at": dt_str(device.created_at),
        "updated_at": dt_str(device.updated_at),
        "recent_probe_logs": [
            {
                "id": pl.id,
                "method": pl.method,
                "success": pl.success,
                "latency_ms": pl.latency_ms,
                "error_message": pl.error_message,
                "probe_time": dt_str(pl.probe_time)
            }
            for pl in probe_logs
        ],
        "recent_events": [
            {
                "id": ev.id,
                "from_status": ev.from_status,
                "to_status": ev.to_status,
                "event_type": ev.event_type,
                "duration_seconds": ev.duration_seconds,
                "details": ev.details,
                "created_at": dt_str(ev.created_at)
            }
            for ev in events
        ]
    }
    return success_response(data=detail)

@router.put("/{device_id}")
def update_device(
    device_id: int,
    req: DeviceUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise NotFoundException("指定设备不存在")

    now = datetime.now()

    # 1. 位置变更与保护逻辑
    if req.clear_location:
        # 用户明确清空已有位置 (Rule 10 in Chapter 4.3)
        device.latitude = None
        device.longitude = None
        device.location_address = None
        device.formatted_address = None
        device.location_status = "unlocated"
        device.location_method = "none"
        device.location_updated_at = now
        device.location_note = None
    elif req.latitude is not None or req.longitude is not None:
        # 提供了新的坐标，执行严格校验
        target_lat = req.latitude if req.latitude is not None else device.latitude
        target_lon = req.longitude if req.longitude is not None else device.longitude
        valid, msg = validate_coordinates(target_lat, target_lon)
        if not valid:
            raise ValidationException(msg)
        device.latitude = target_lat
        device.longitude = target_lon
        device.location_status = "located"
        device.location_method = req.location_method or "manual_pin"
        device.location_updated_at = now
        if req.formatted_address is not None:
            device.formatted_address = req.formatted_address
        if req.location_address is not None:
            device.location_address = req.location_address
        if req.location_accuracy is not None:
            device.location_accuracy = req.location_accuracy
        if req.location_provider is not None:
            device.location_provider = req.location_provider
        if req.location_note is not None:
            device.location_note = req.location_note
    else:
        # 仅修改了地址文本，未提供坐标时，不覆盖现有经纬度 (Rule 9)
        if req.location_address is not None:
            device.location_address = req.location_address
        if req.location_note is not None:
            device.location_note = req.location_note

    # 2. 基本字段更新
    if req.name is not None:
        device.name = req.name.strip()
    if req.ip_address is not None:
        device.ip_address = req.ip_address.strip()
    if req.device_type is not None:
        device.device_type = req.device_type
    if req.group_id is not None:
        if req.group_id != 0:
            group = db.query(DeviceGroup).filter(DeviceGroup.id == req.group_id).first()
            if not group:
                raise ValidationException("指定的分组不存在")
            device.group_id = req.group_id
        else:
            device.group_id = None
    if req.method is not None:
        device.method = req.method.lower()
    if req.port is not None:
        device.port = req.port
    if req.timeout_seconds is not None:
        device.timeout_seconds = req.timeout_seconds
    if req.interval_seconds is not None:
        device.interval_seconds = req.interval_seconds
    if req.retry_count is not None:
        device.retry_count = req.retry_count
    if req.note is not None:
        device.note = req.note

    # 3. 启用状态切换处理
    if req.enabled is not None and req.enabled != device.enabled:
        device.enabled = req.enabled
        if not device.enabled:
            device.status = "DISABLED"
            device.failure_count = 0
            device.offline_since = None
        else:
            device.status = "UNKNOWN"
            device.failure_count = 0

    device.updated_at = now
    db.commit()
    return success_response(message="设备信息更新成功")

@router.delete("/{device_id}")
def delete_device(
    device_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise NotFoundException("指定设备不存在")
    db.delete(device)
    db.commit()
    return success_response(message="设备已成功删除")

@router.post("/{device_id}/probe")
def probe_device_manually(device_id: int, db: Session = Depends(get_db)):
    """立即手动发起单次探测并返回真实探测结果"""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise NotFoundException("指定设备不存在")

    res = monitor_engine.trigger_probe_now(device_id)
    return success_response(data=res, message="探测任务执行完毕")
