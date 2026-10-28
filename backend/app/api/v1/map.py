from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.core.exceptions import ValidationException
from backend.app.models.device import Device
from backend.app.services.geo import (
    search_address_candidates,
    reverse_geocode,
    wgs84_to_gcj02,
    gcj02_to_wgs84,
    validate_coordinates
)
from backend.app.schemas.geo import CoordTransformRequest

router = APIRouter(prefix="/map", tags=["地图与位置管理"])

@router.get("/devices")
def get_map_devices(
    group_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """获取所有具备有效经纬度的设备点位，供地图渲染"""
    query = db.query(Device).filter(Device.latitude.isnot(None), Device.longitude.isnot(None))

    if group_id is not None:
        query = query.filter(Device.group_id == group_id)
    if status:
        query = query.filter(Device.status == status.upper())
    if device_type:
        query = query.filter(Device.device_type == device_type)

    devices = query.all()
    unlocated_count = db.query(Device).filter(
        (Device.latitude.is_(None)) | (Device.longitude.is_(None)) | (Device.location_status == "unlocated")
    ).count()

    points = []
    for d in devices:
        points.append({
            "id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "device_type": d.device_type,
            "group_id": d.group_id,
            "group_name": d.group.name if d.group else "未分组",
            "group_color": d.group.color if d.group else "#3B82F6",
            "status": d.status,
            "method": d.method,
            "latitude": d.latitude,
            "longitude": d.longitude,
            "location_address": d.location_address,
            "formatted_address": d.formatted_address,
            "location_method": d.location_method,
            "location_note": d.location_note,
            "last_probe_time": d.last_probe_time.isoformat() if d.last_probe_time else None
        })

    return success_response(data={
        "points": points,
        "total_located": len(points),
        "total_unlocated": unlocated_count
    })

@router.get("/unlocated")
def get_unlocated_devices(db: Session = Depends(get_db)):
    """获取未定位设备列表，方便在后台或地图侧边抽屉中快速补充位置"""
    devices = db.query(Device).filter(
        (Device.latitude.is_(None)) | (Device.longitude.is_(None)) | (Device.location_status == "unlocated")
    ).order_by(Device.id.asc()).all()

    items = []
    for d in devices:
        items.append({
            "id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "device_type": d.device_type,
            "group_name": d.group.name if d.group else "未分组",
            "status": d.status,
            "location_address": d.location_address,
            "location_note": d.location_note
        })
    return success_response(data=items)

@router.get("/geocode")
async def geocode_address(query: str = Query(..., min_length=1), limit: int = Query(5, ge=1, le=10)):
    """真实调用地理编码服务，按用户输入地址检索候选点位列表"""
    candidates = await search_address_candidates(query=query, limit=limit)
    return success_response(data=candidates)

@router.get("/reverse-geocode")
async def reverse_geocode_coord(lat: float = Query(...), lon: float = Query(...)):
    """根据点击坐标反查标准化地址"""
    valid, msg = validate_coordinates(lat, lon)
    if not valid:
        raise ValidationException(msg)
    addr = await reverse_geocode(lat, lon)
    return success_response(data={"formatted_address": addr or ""})

@router.post("/transform-coords")
def transform_coordinates(req: CoordTransformRequest):
    """坐标系转换：支持 WGS-84 与 GCJ-02 互转"""
    valid, msg = validate_coordinates(req.latitude, req.longitude)
    if not valid:
        raise ValidationException(msg)

    from_crs = req.from_crs.upper()
    to_crs = req.to_crs.upper()

    if from_crs == to_crs:
        target_lat, target_lon = req.latitude, req.longitude
    elif from_crs == "WGS-84" and to_crs == "GCJ-02":
        target_lat, target_lon = wgs84_to_gcj02(req.latitude, req.longitude)
    elif from_crs == "GCJ-02" and to_crs == "WGS-84":
        target_lat, target_lon = gcj02_to_wgs84(req.latitude, req.longitude)
    else:
        raise ValidationException(f"不支持的坐标转换规则: {from_crs} -> {to_crs}")

    return success_response(data={
        "latitude": target_lat,
        "longitude": target_lon,
        "from_crs": from_crs,
        "to_crs": to_crs
    })
