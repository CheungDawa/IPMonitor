from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class AlertRecordResponse(BaseModel):
    id: int
    device_id: int
    device_name: Optional[str] = None
    ip_address: Optional[str] = None
    alert_type: str
    title: str
    content: str
    status: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    channels_sent: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class NotificationConfigUpdate(BaseModel):
    # Webhook
    webhook_enabled: bool = False
    webhook_type: str = "wecom"
    webhook_url: str = ""
    # Email
    email_enabled: bool = False
    smtp_server: str = ""
    smtp_port: int = 465
    use_ssl: bool = True
    sender_email: str = ""
    password: str = ""
    recipient_email: str = ""
    cc_email: Optional[str] = ""
    quiet_hours_enabled: bool = False
    quiet_start_hour: int = 22
    quiet_end_hour: int = 8

class NotificationTestRequest(BaseModel):
    channel: str # webhook, email
    webhook_type: Optional[str] = "wecom"
    webhook_url: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = 465
    use_ssl: Optional[bool] = True
    sender_email: Optional[str] = None
    password: Optional[str] = None
    recipient_email: Optional[str] = None
