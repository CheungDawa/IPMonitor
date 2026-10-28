from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class ProbeLog(Base):
    __tablename__ = "probe_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    method = Column(String(20), nullable=False)
    success = Column(Boolean, nullable=False)
    latency_ms = Column(Float, nullable=True)
    error_message = Column(String(255), nullable=True)
    probe_time = Column(DateTime, default=datetime.now, nullable=False, index=True)

    device = relationship("Device", back_populates="probe_logs")
