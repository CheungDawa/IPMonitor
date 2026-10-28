import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.models.base import Base
from backend.app.models.device import Device
from backend.app.models.event import DeviceEvent
from backend.app.models.probe_log import ProbeLog
from backend.app.models.alert import AlertRecord
from backend.app.engine.probes import tcp_probe, ping_probe, ProbeResult
from backend.app.engine.scheduler import MonitorEngine

def test_probes():
    # 1. TCP 检测未开放的随机端口 (如 65432)，应安全返回 False，不挂死
    res = tcp_probe("127.0.0.1", 65432, timeout_sec=1)
    assert res.success is False
    assert "连接" in res.error_message or "超时" in res.error_message

    # 2. Ping 本地回环 127.0.0.1
    res_ping = ping_probe("127.0.0.1", timeout_sec=2)
    assert res_ping.success is True
    assert res_ping.latency_ms is not None

def test_engine_state_machine():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()

    monitor = MonitorEngine()

    try:
        # 创建待测设备
        dev = Device(
            name="核心交换机",
            ip_address="192.168.1.254",
            method="ping",
            status="UNKNOWN",
            failure_count=0,
            retry_count=3,
            enabled=True
        )
        db.add(dev)
        db.commit()
        db.refresh(dev)

        # 1. 首次探测成功 -> 状态迁为 ONLINE
        ok_res = ProbeResult(True, latency_ms=5.2)
        monitor._apply_probe_result(db, dev, ok_res)
        assert dev.status == "ONLINE"
        assert dev.failure_count == 0
        assert db.query(ProbeLog).count() == 1
        assert db.query(DeviceEvent).count() == 1
        assert db.query(DeviceEvent).first().to_status == "ONLINE"

        # 2. 第 1 次失败 -> failure_count=1，状态仍为 ONLINE (丢包重试中，未达阈值 3)
        fail_res = ProbeResult(False, error_message="Request timed out")
        monitor._apply_probe_result(db, dev, fail_res)
        assert dev.status == "ONLINE"
        assert dev.failure_count == 1
        assert db.query(DeviceEvent).count() == 1 # 不产生新的事件

        # 3. 第 2 次失败 -> failure_count=2，状态仍为 ONLINE
        monitor._apply_probe_result(db, dev, fail_res)
        assert dev.status == "ONLINE"
        assert dev.failure_count == 2

        # 4. 第 3 次失败 -> 达到阈值 3，确认离线 OFFLINE，产生 offline 事件和告警
        monitor._apply_probe_result(db, dev, fail_res)
        assert dev.status == "OFFLINE"
        assert dev.failure_count == 3
        assert dev.offline_since is not None
        events = db.query(DeviceEvent).all()
        assert len(events) == 2
        assert events[1].to_status == "OFFLINE"
        assert events[1].event_type == "offline"

        # 5. 设备恢复探测成功 -> 状态转为 ONLINE，记录离线时长与 recovery 事件
        monitor._apply_probe_result(db, dev, ok_res)
        assert dev.status == "ONLINE"
        assert dev.failure_count == 0
        assert dev.offline_since is None
        events = db.query(DeviceEvent).all()
        assert len(events) == 3
        assert events[2].to_status == "ONLINE"
        assert events[2].event_type == "online"

    finally:
        db.close()
