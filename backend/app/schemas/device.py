from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from backend.app.services.geo import validate_coordinates

class DeviceBase(BaseModel):
    name: str
    ip_address: str
    device_type: str = "server"
    group_id: Optional[int] = None
    method: str = "ping"
    port: Optional[int] = None
    timeout_seconds: int = 3
    interval_seconds: int = 60
    retry_count: int = 3
    enabled: bool = True
    note: Optional[str] = None
    
    # 位置字段
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    formatted_address: Optional[str] = None
    location_method: str = "none"
    location_accuracy: Optional[str] = None
    location_provider: Optional[str] = None
    location_note: Optional[str] = None

class DeviceCreate(DeviceBase):
    @field_validator("longitude")
    @classmethod
    def validate_geo(cls, v, info):
        lat = info.data.get("latitude")
        valid, msg = validate_coordinates(lat, v)
        if not valid:
            raise ValueError(msg)
        return v

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    device_type: Optional[str] = None
    group_id: Optional[int] = None
    method: Optional[str] = None
    port: Optional[int] = None
    timeout_seconds: Optional[int] = None
    interval_seconds: Optional[int] = None
    retry_count: Optional[int] = None
    enabled: Optional[bool] = None
    note: Optional[str] = None

    # 位置变更
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    formatted_address: Optional[str] = None
    location_method: Optional[str] = None
    location_accuracy: Optional[str] = None
    location_provider: Optional[str] = None
    location_note: Optional[str] = None
    clear_location: Optional[bool] = False # 明确操作清空已有坐标

class DeviceResponse(DeviceBase):
    id: int
    status: str
    failure_count: int
    last_probe_time: Optional[datetime] = None
    last_online_time: Optional[datetime] = None
    offline_since: Optional[datetime] = None
    location_status: str
    location_updated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    group_name: Optional[str] = None
    group_color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
