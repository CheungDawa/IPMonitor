from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class DeviceEvent(Base):
    __tablename__ = "device_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(20), nullable=False)
    to_status = Column(String(20), nullable=False)
    event_type = Column(String(50), nullable=False)  # offline, online, status_change
    duration_seconds = Column(Integer, nullable=True)  # 离线持续时长等
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False, index=True)

    device = relationship("Device", back_populates="events")
