from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.core.exceptions import NotFoundException, ValidationException
from backend.app.models.group import DeviceGroup
from backend.app.models.device import Device
from backend.app.schemas.group import GroupCreate, GroupUpdate
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/groups", tags=["设备分组"])

@router.get("")
def list_groups(db: Session = Depends(get_db)):
    """获取所有分组及各分组关联的设备总数"""
    groups = db.query(DeviceGroup).order_by(DeviceGroup.sort_order.asc(), DeviceGroup.id.asc()).all()
    result = []
    for g in groups:
        dev_count = db.query(Device).filter(Device.group_id == g.id).count()
        result.append({
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "color": g.color,
            "sort_order": g.sort_order,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "device_count": dev_count
        })
    return success_response(data=result)

@router.post("")
def create_group(
    req: GroupCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    exists = db.query(DeviceGroup).filter(DeviceGroup.name == req.name.strip()).first()
    if exists:
        raise ValidationException(f"分组名称 '{req.name}' 已存在")
    
    group = DeviceGroup(
        name=req.name.strip(),
        description=req.description,
        color=req.color or "#3B82F6",
        sort_order=req.sort_order or 0
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return success_response(data={"id": group.id, "name": group.name}, message="分组创建成功")

@router.put("/{group_id}")
def update_group(
    group_id: int,
    req: GroupUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise NotFoundException("指定分组不存在")
    
    if req.name is not None and req.name.strip() != group.name:
        exists = db.query(DeviceGroup).filter(DeviceGroup.name == req.name.strip()).first()
        if exists:
            raise ValidationException(f"分组名称 '{req.name}' 已存在")
        group.name = req.name.strip()
        
    if req.description is not None:
        group.description = req.description
    if req.color is not None:
        group.color = req.color
    if req.sort_order is not None:
        group.sort_order = req.sort_order
        
    db.commit()
    return success_response(message="分组更新成功")

@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise NotFoundException("指定分组不存在")
    
    # 严格检查关联设备，禁止误删包含设备的分组
    associated_count = db.query(Device).filter(Device.group_id == group_id).count()
    if associated_count > 0:
        raise ValidationException(
            f"该分组下仍有 {associated_count} 台关联设备，无法直接删除！请先将设备迁移至其他分组或解绑后再操作。"
        )
        
    db.delete(group)
    db.commit()
    return success_response(message="分组已成功删除")
