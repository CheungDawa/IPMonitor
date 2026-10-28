from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.core.exceptions import NotFoundException
from backend.app.models.alert import AlertRecord
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/alerts", tags=["告警中心"])

@router.get("")
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None), # active, resolved
    device_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(AlertRecord)
    if status:
        query = query.filter(AlertRecord.status == status)
    if device_id:
        query = query.filter(AlertRecord.device_id == device_id)

    total = query.count()
    records = query.order_by(AlertRecord.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in records:
        items.append({
            "id": r.id,
            "device_id": r.device_id,
            "device_name": r.device.name if r.device else "已删除设备",
            "ip_address": r.device.ip_address if r.device else "-",
            "alert_type": r.alert_type,
            "title": r.title,
            "content": r.content,
            "status": r.status,
            "triggered_at": r.triggered_at.isoformat() if r.triggered_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "duration_seconds": r.duration_seconds,
            "channels_sent": r.channels_sent
        })

    return success_response(data={
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items
    })

@router.post("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()
    if not record:
        raise NotFoundException("告警记录不存在")

    record.status = "resolved"
    record.resolved_at = datetime.now(timezone.utc)
    if record.triggered_at:
        t = record.triggered_at
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        record.duration_seconds = int((record.resolved_at - t).total_seconds())

    db.commit()
    return success_response(message="告警状态已标记为已处理")
