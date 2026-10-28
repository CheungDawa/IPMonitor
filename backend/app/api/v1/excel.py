from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from typing import Optional
import urllib.parse

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.core.exceptions import ValidationException
from backend.app.models.device import Device
from backend.app.services.excel_service import (
    generate_excel_template,
    precheck_excel_file,
    execute_excel_import,
    export_devices_to_excel,
    TEMPLATE_PATH
)
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/excel", tags=["Excel导入与导出"])

@router.get("/template")
def download_template():
    """下载官方标准 3-sheet 设备导入模板"""
    if not TEMPLATE_PATH.exists():
        generate_excel_template()

    filename = "IPMonitor设备导入模板.xlsx"
    encoded_filename = urllib.parse.quote(filename)
    return FileResponse(
        path=TEMPLATE_PATH,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@router.post("/precheck")
async def precheck_upload(file: UploadFile = File(...)):
    """上传 Excel 文件进行前置语法、格式与约束预检，不写入数据库"""
    if not file.filename.endswith((".xlsx", ".xlsm")):
        raise ValidationException("仅支持上传 .xlsx 格式的 Excel 文件")

    content = await file.read()
    res = precheck_excel_file(content)
    return success_response(data=res, message="预检分析完成")

@router.post("/import")
async def import_devices(
    file: UploadFile = File(...),
    import_mode: str = Form("upsert"), # upsert, insert_only, skip_existing
    allow_clear_location: bool = Form(False),
    current_user = Depends(get_current_user)
):
    """确认执行导入"""
    if not file.filename.endswith((".xlsx", ".xlsm")):
        raise ValidationException("仅支持上传 .xlsx 格式的 Excel 文件")

    content = await file.read()
    res = execute_excel_import(content, import_mode=import_mode, allow_clear_location=allow_clear_location)
    if not res.get("success"):
        raise ValidationException(res.get("error", "导入失败"))
    return success_response(data=res, message=res.get("message", "导入执行成功"))

@router.get("/export")
def export_devices(
    group_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """导出筛选后的设备清单为 Excel (.xlsx) 文件"""
    query = db.query(Device)
    if group_id is not None:
        query = query.filter(Device.group_id == group_id)
    if status:
        query = query.filter(Device.status == status.upper())
    if device_type:
        query = query.filter(Device.device_type == device_type)

    devices = query.order_by(Device.id.asc()).all()
    excel_bytes = export_devices_to_excel(devices)

    filename = "IPMonitor设备资产台账.xlsx"
    encoded_filename = urllib.parse.quote(filename)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )
