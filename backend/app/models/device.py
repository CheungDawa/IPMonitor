from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), index=True, nullable=False)
    ip_address = Column(String(50), index=True, nullable=False)
    device_type = Column(String(50), default="server", nullable=False)  # server, router, switch, printer, camera, nas, workstation, other
    group_id = Column(Integer, ForeignKey("device_groups.id", ondelete="SET NULL"), nullable=True)
    
    # 监控参数配置
    method = Column(String(20), default="ping", nullable=False)  # ping, tcp, arp
    port = Column(Integer, nullable=True)
    timeout_seconds = Column(Integer, default=3, nullable=False)
    interval_seconds = Column(Integer, default=60, nullable=False)
    retry_count = Column(Integer, default=3, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    
    # 运行时状态
    status = Column(String(20), default="UNKNOWN", index=True, nullable=False)  # ONLINE, OFFLINE, UNKNOWN, DISABLED
    failure_count = Column(Integer, default=0, nullable=False)
    last_probe_time = Column(DateTime, nullable=True)
    last_online_time = Column(DateTime, nullable=True)
    offline_since = Column(DateTime, nullable=True)
    last_alert_time = Column(DateTime, nullable=True)
    
    # 地理位置字段 (Chapter 4.2 严格规范)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_address = Column(String(255), nullable=True)        # 原始/用户录入地址
    formatted_address = Column(String(255), nullable=True)       # 标准化地理编码地址
    location_method = Column(String(50), default="none", nullable=False) # address_search, manual_pin, import_coordinates, import_address, none
    location_status = Column(String(20), default="unlocated", nullable=False) # located, unlocated
    location_accuracy = Column(String(50), nullable=True)        # rooftop, street, city 等精度标识
    location_provider = Column(String(50), nullable=True)        # nominatim, manual, amap, etc.
    location_updated_at = Column(DateTime, nullable=True)
    location_note = Column(String(255), nullable=True)           # 楼栋/机房/机柜补充说明
    
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # 关联
    group = relationship("DeviceGroup", back_populates="devices")
    events = relationship("DeviceEvent", back_populates="device", cascade="all, delete-orphan")
    probe_logs = relationship("ProbeLog", back_populates="device", cascade="all, delete-orphan")
    alert_records = relationship("AlertRecord", back_populates="device", cascade="all, delete-orphan")
