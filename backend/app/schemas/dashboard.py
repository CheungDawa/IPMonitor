from typing import Optional, List, Dict
from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    unknown_devices: int
    disabled_devices: int
    located_devices: int
    unlocated_devices: int
    uptime_ratio: float
    active_alerts: int

class RecentEventItem(BaseModel):
    id: int
    device_id: int
    device_name: str
    ip_address: str
    from_status: str
    to_status: str
    event_type: str
    duration_seconds: Optional[int] = None
    details: Optional[str] = None
    created_at: str

class TrendPoint(BaseModel):
    time: str
    offline_count: int
    online_count: int

class FaultTrendResponse(BaseModel):
    points: List[TrendPoint]
