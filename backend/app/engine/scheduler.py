import time
import threading
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.app.core.logging import logger
from backend.app.core.database import SessionLocal
from backend.app.core.config import settings
from backend.app.models.device import Device
from backend.app.models.event import DeviceEvent
from backend.app.models.probe_log import ProbeLog
from backend.app.engine.probes import execute_probe
from backend.app.services.notifier import notification_hub

def format_duration_seconds(seconds: int) -> str:
    if not seconds or seconds < 0:
        return "0秒"
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    mins, secs = divmod(rem, 60)
    parts = []
    if days > 0:
        parts.append(f"{days}天")
    if hours > 0:
        parts.append(f"{hours}小时")
    if mins > 0:
        parts.append(f"{mins}分")
    return "".join(parts) if parts else f"{secs}秒"

class MonitorEngine:
    def __init__(self, max_workers: int = 50):
        self.max_workers = max_workers
        self.stop_event = threading.Event()
        self.worker_thread = None
        self.executor = None
        self.probing_set = set() # 正在探测中的 device_id 防止重复派发
        self.lock = threading.Lock()

    def start(self):
        if self.worker_thread and self.worker_thread.is_alive():
            return
        self.stop_event.clear()
        self.executor = ThreadPoolExecutor(max_workers=self.max_workers, thread_name_prefix="ProbeWorker")
        self.worker_thread = threading.Thread(target=self._run_loop, daemon=True, name="MonitorEngineThread")
        self.worker_thread.start()
        notification_hub.start()
        logger.info(f"▶ 独立监控守护引擎已启动 (线程池并发上限: {self.max_workers})")

    def stop(self):
        self.stop_event.set()
        if self.executor:
            self.executor.shutdown(wait=False, cancel_futures=True)
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=3.0)
        notification_hub.stop()
        logger.info("■ 独立监控守护引擎已停止。")

    def is_running(self) -> bool:
        return self.worker_thread is not None and self.worker_thread.is_alive()

    def _run_loop(self):
        while not self.stop_event.is_set():
            try:
                self._schedule_due_devices()
            except Exception as e:
                logger.error(f"监控调度轮询异常: {e}", exc_info=True)

            # 睡眠 1 秒，保持高效且及时的调度
            for _ in range(10):
                if self.stop_event.is_set():
                    break
                time.sleep(0.1)

    def _schedule_due_devices(self):
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            devices = db.query(Device).filter(Device.enabled == True).all()

            for dev in devices:
                if self.stop_event.is_set():
                    break

                with self.lock:
                    if dev.id in self.probing_set:
                        continue

                # 判断是否到了该设备的探测周期
                interval = dev.interval_seconds or settings.DEFAULT_INTERVAL_SECONDS
                is_due = False
                if dev.last_probe_time is None:
                    is_due = True
                else:
                    last_time = dev.last_probe_time
                    if last_time.tzinfo is None:
                        last_time = last_time.replace(tzinfo=timezone.utc)
                    if (now - last_time).total_seconds() >= interval:
                        is_due = True

                if is_due:
                    with self.lock:
                        self.probing_set.add(dev.id)
                    self.executor.submit(self._probe_single_device, dev.id)

        except Exception as e:
            logger.error(f"检查待探测设备异常: {e}")
        finally:
            db.close()

    def _probe_single_device(self, device_id: int):
        db = SessionLocal()
        try:
            dev = db.query(Device).filter(Device.id == device_id).first()
            if not dev or not dev.enabled:
                return

            # 执行真实探测
            timeout = dev.timeout_seconds or settings.DEFAULT_TIMEOUT_SECONDS
            res = execute_probe(dev.method, dev.ip_address, dev.port, timeout_sec=timeout)

            # 状态机更新
            self._apply_probe_result(db, dev, res)

        except Exception as e:
            logger.error(f"探测设备 #{device_id} 过程异常: {e}", exc_info=True)
        finally:
            with self.lock:
                self.probing_set.discard(device_id)
            db.close()

    def _apply_probe_result(self, db: Session, dev: Device, res):
        now = datetime.now(timezone.utc)
        now_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

        # 1. 记录探测日志
        log = ProbeLog(
            device_id=dev.id,
            method=dev.method,
            success=res.success,
            latency_ms=res.latency_ms,
            error_message=res.error_message,
            probe_time=now
        )
        db.add(log)

        # 2. 状态机迁移
        retry_threshold = dev.retry_count or settings.DEFAULT_RETRIES_BEFORE_OFFLINE
        re_alert_gap = settings.DEFAULT_RE_ALERT_MINUTES * 60

        if res.success:
            dev.failure_count = 0
            dev.last_online_time = now

            if dev.status == "OFFLINE":
                # 触发恢复
                dur_sec = 0
                if dev.offline_since:
                    off_time = dev.offline_since
                    if off_time.tzinfo is None:
                        off_time = off_time.replace(tzinfo=timezone.utc)
                    dur_sec = int((now - off_time).total_seconds())

                dur_str = format_duration_seconds(dur_sec)
                dev.status = "ONLINE"
                dev.offline_since = None
                dev.last_alert_time = None

                event = DeviceEvent(
                    device_id=dev.id,
                    from_status="OFFLINE",
                    to_status="ONLINE",
                    event_type="online",
                    duration_seconds=dur_sec,
                    details=f"设备恢复在线，探测延迟 {res.latency_ms}ms"
                )
                db.add(event)

                title = f"🟢 [恢复通知] {dev.name} 已重新上线"
                content = (
                    f"通知类型：设备恢复在线\n"
                    f"设备名称：{dev.name}\n"
                    f"IP 地址：{dev.ip_address}\n"
                    f"探测方式：{dev.method.upper()}\n"
                    f"总计离线时长：{dur_str}\n"
                    f"恢复时间：{now_str}"
                )
                notification_hub.emit_alert(dev.id, "recovery", title, content, dur_sec)
                logger.info(f"🟢 [设备恢复] {dev.name} ({dev.ip_address}) 已恢复在线，离线时长 {dur_str}")

            elif dev.status in ("UNKNOWN", "DISABLED"):
                old_status = dev.status
                dev.status = "ONLINE"
                event = DeviceEvent(
                    device_id=dev.id,
                    from_status=old_status,
                    to_status="ONLINE",
                    event_type="online",
                    details=f"探测成功确认在线，延迟 {res.latency_ms}ms"
                )
                db.add(event)
                logger.info(f"🟢 [状态确认] {dev.name} ({dev.ip_address}) 确认在线")

        else: # 探测失败
            dev.failure_count += 1
            if dev.failure_count >= retry_threshold:
                if dev.status != "OFFLINE":
                    # 首次确认离线
                    old_status = dev.status
                    dev.status = "OFFLINE"
                    dev.offline_since = now
                    dev.last_alert_time = now

                    event = DeviceEvent(
                        device_id=dev.id,
                        from_status=old_status,
                        to_status="OFFLINE",
                        event_type="offline",
                        details=f"连续 {retry_threshold} 次探测失败，原因: {res.error_message}"
                    )
                    db.add(event)

                    title = f"🔴 [告警] {dev.name} 确认离线"
                    content = (
                        f"告警类型：设备离线\n"
                        f"设备名称：{dev.name}\n"
                        f"IP 地址：{dev.ip_address}\n"
                        f"探测协议：{dev.method.upper()}\n"
                        f"失败原因：{res.error_message}\n"
                        f"告警时间：{now_str}"
                    )
                    notification_hub.emit_alert(dev.id, "offline", title, content, 0)
                    logger.warning(f"🔴 [设备离线] {dev.name} ({dev.ip_address}) 确认离线: {res.error_message}")
                else:
                    # 持续离线中的重告警抑制检查
                    if dev.last_alert_time:
                        last_alert = dev.last_alert_time
                        if last_alert.tzinfo is None:
                            last_alert = last_alert.replace(tzinfo=timezone.utc)
                        if (now - last_alert).total_seconds() >= re_alert_gap:
                            dev.last_alert_time = now
                            off_time = dev.offline_since or now
                            if off_time.tzinfo is None:
                                off_time = off_time.replace(tzinfo=timezone.utc)
                            dur_sec = int((now - off_time).total_seconds())
                            dur_str = format_duration_seconds(dur_sec)

                            title = f"🔴 [持续离线] {dev.name} 持续离线 {dur_str}"
                            content = (
                                f"告警类型：持续离线提醒\n"
                                f"设备名称：{dev.name}\n"
                                f"IP 地址：{dev.ip_address}\n"
                                f"已离线时长：{dur_str}\n"
                                f"更新时间：{now_str}"
                            )
                            notification_hub.emit_alert(dev.id, "continuous_offline", title, content, dur_sec)
                            logger.info(f"🔔 [持续离线重告警] {dev.name} 持续离线 {dur_str}")

        dev.last_probe_time = now
        db.commit()

    def trigger_probe_now(self, device_id: int) -> Dict[str, Any]:
        """立即手动探测单台设备并即时同步状态"""
        db = SessionLocal()
        try:
            dev = db.query(Device).filter(Device.id == device_id).first()
            if not dev:
                return {"success": False, "message": "设备不存在"}

            timeout = dev.timeout_seconds or settings.DEFAULT_TIMEOUT_SECONDS
            res = execute_probe(dev.method, dev.ip_address, dev.port, timeout_sec=timeout)
            self._apply_probe_result(db, dev, res)
            db.refresh(dev)

            return {
                "success": res.success,
                "latency_ms": res.latency_ms,
                "error_message": res.error_message,
                "device_status": dev.status,
                "failure_count": dev.failure_count,
                "last_probe_time": dev.last_probe_time.isoformat() if dev.last_probe_time else None
            }
        finally:
            db.close()

monitor_engine = MonitorEngine()
