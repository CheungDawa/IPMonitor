import time
import json
import smtplib
import ssl
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
import queue
import threading
import httpx
from typing import Optional, Dict, Any
from backend.app.core.logging import logger
from backend.app.core.database import SessionLocal
from backend.app.models.setting import SystemSetting
from backend.app.models.alert import AlertRecord

class NotificationHub:
    def __init__(self):
        self.queue = queue.Queue()
        self.stop_event = threading.Event()
        self.worker_thread = None

    def start(self):
        if self.worker_thread and self.worker_thread.is_alive():
            return
        self.stop_event.clear()
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True, name="NotificationWorker")
        self.worker_thread.start()
        logger.info("告警与通知分发调度器已启动。")

    def stop(self):
        self.stop_event.set()
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=2.0)
        logger.info("告警与通知分发调度器已安全停止。")

    def emit_alert(self, device_id: int, alert_type: str, title: str, content: str, duration_sec: Optional[int] = None):
        """将告警事件入队，同时在数据库中保存 AlertRecord"""
        db = SessionLocal()
        try:
            record = AlertRecord(
                device_id=device_id,
                alert_type=alert_type,
                title=title,
                content=content,
                status="active" if alert_type in ("offline", "continuous_offline") else "resolved",
                triggered_at=datetime.now(timezone.utc),
                duration_seconds=duration_sec,
                resolved_at=datetime.now(timezone.utc) if alert_type == "recovery" else None
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            record_id = record.id
        except Exception as e:
            logger.error(f"保存告警记录失败: {e}")
            record_id = None
        finally:
            db.close()

        self.queue.put({
            "record_id": record_id,
            "device_id": device_id,
            "alert_type": alert_type,
            "title": title,
            "content": content,
            "timestamp": datetime.now(timezone.utc)
        })

    def _worker_loop(self):
        while not self.stop_event.is_set():
            try:
                try:
                    item = self.queue.get(timeout=1.0)
                except queue.Empty:
                    continue

                batch = [item]
                # 0.5s 窗口期汇聚最多 20 条，防止大面积断网引起的告警风暴
                time.sleep(0.5)
                while len(batch) < 20 and not self.queue.empty():
                    batch.append(self.queue.get_nowait())

                self._process_batch(batch)

            except Exception as e:
                logger.error(f"告警队列分发循环异常: {e}", exc_info=True)

    def _get_notification_configs(self) -> tuple[Dict[str, Any], Dict[str, Any]]:
        db = SessionLocal()
        alert_cfg = {}
        email_cfg = {}
        try:
            alert_setting = db.query(SystemSetting).filter(SystemSetting.key == "alert").first()
            if alert_setting:
                alert_cfg = json.loads(alert_setting.value)
            email_setting = db.query(SystemSetting).filter(SystemSetting.key == "email").first()
            if email_setting:
                email_cfg = json.loads(email_setting.value)
        except Exception as e:
            logger.error(f"读取通知配置失败: {e}")
        finally:
            db.close()
        return alert_cfg, email_cfg

    def _process_batch(self, batch: list[dict]):
        alert_cfg, email_cfg = self._get_notification_configs()
        sent_channels = []

        if len(batch) == 1:
            title = batch[0]["title"]
            content = batch[0]["content"]
        else:
            title = f"🔴 [合并告警] 检测到 {len(batch)} 台设备状态变更"
            content = f"以下是集中状态变更通知 (共 {len(batch)} 条)：\n" + "="*40 + "\n\n"
            for b in batch:
                content += f"【{b['title']}】\n{b['content']}\n" + "-"*40 + "\n"

        # 1. Webhook 分发 (企业微信 / 钉钉 / 飞书)
        if alert_cfg.get("webhook_enabled", False):
            url = alert_cfg.get("webhook_url", "").strip()
            hook_type = alert_cfg.get("webhook_type", "wecom").strip().lower()
            if url:
                success, msg = send_webhook(hook_type, url, title, content)
                if success:
                    sent_channels.append(f"webhook:{hook_type}")
                    logger.info(f"Webhook [{hook_type}] 发送成功: {title}")
                else:
                    logger.warning(f"Webhook [{hook_type}] 发送失败: {msg}")

        # 2. 邮件分发 (SMTP)
        if email_cfg.get("enabled", False):
            # 免打扰时段判定
            now_hour = datetime.now().hour
            is_quiet = False
            if email_cfg.get("quiet_hours_enabled", False):
                start_h = email_cfg.get("quiet_start_hour", 22)
                end_h = email_cfg.get("quiet_end_hour", 8)
                is_quiet = check_quiet_hour(now_hour, start_h, end_h)

            if is_quiet:
                logger.info("邮件告警：当前处于免打扰时段，已跳过发送。")
            else:
                success, msg = send_email(email_cfg, title, content)
                if success:
                    sent_channels.append("email")
                    logger.info(f"SMTP 邮件发送成功: {title}")
                else:
                    logger.warning(f"SMTP 邮件发送失败: {msg}")

        # 更新记录的渠道标识
        if sent_channels:
            channel_str = ",".join(sent_channels)
            db = SessionLocal()
            try:
                for b in batch:
                    rec_id = b.get("record_id")
                    if rec_id:
                        rec = db.query(AlertRecord).filter(AlertRecord.id == rec_id).first()
                        if rec:
                            rec.channels_sent = channel_str
                db.commit()
            except Exception:
                pass
            finally:
                db.close()

def check_quiet_hour(hour: int, start: int, end: int) -> bool:
    """免打扰时段判断，支持跨午夜判断 (例如 22:00 至 次日 08:00)"""
    if start > end:
        return hour >= start or hour < end
    return start <= hour < end

def send_webhook(hook_type: str, url: str, title: str, content: str) -> tuple[bool, str]:
    try:
        headers = {"Content-Type": "application/json"}
        if hook_type == "wecom":
            payload = {
                "msgtype": "markdown",
                "markdown": {"content": f"### {title}\n{content}"}
            }
        elif hook_type == "dingtalk":
            payload = {
                "msgtype": "markdown",
                "markdown": {"title": title, "text": f"### {title}\n\n{content}"}
            }
        elif hook_type == "feishu":
            payload = {
                "msg_type": "post",
                "content": {
                    "post": {
                        "zh_cn": {
                            "title": title,
                            "content": [[{"tag": "text", "text": content}]]
                        }
                    }
                }
            }
        else:
            payload = {"msgtype": "text", "text": {"content": f"{title}\n{content}"}}

        with httpx.Client(timeout=8.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                res_json = resp.json()
                # 钉钉 errcode == 0, 企微 errcode == 0, 飞书 code == 0
                err_code = res_json.get("errcode", res_json.get("code", 0))
                if err_code == 0:
                    return True, "ok"
                return False, f"API 状态码异常: {res_json}"
            return False, f"HTTP 请求失败 ({resp.status_code})"
    except Exception as e:
        return False, str(e)

def send_email(cfg: Dict[str, Any], title: str, content: str) -> tuple[bool, str]:
    try:
        smtp_server = cfg.get("smtp_server", "")
        smtp_port = int(cfg.get("smtp_port", 465))
        use_ssl = cfg.get("use_ssl", True)
        sender_email = cfg.get("sender_email", "")
        password = cfg.get("password", "")
        recipient_email = cfg.get("recipient_email", "")
        cc_email = cfg.get("cc_email", "")

        if not smtp_server or not sender_email or not recipient_email:
            return False, "SMTP 配置不完整"

        msg = EmailMessage()
        msg["Subject"] = title
        msg["From"] = sender_email
        msg["To"] = recipient_email
        if cc_email:
            msg["Cc"] = cc_email
        msg.set_content(content)

        recipients = [recipient_email]
        if cc_email:
            recipients.extend([e.strip() for e in cc_email.split(",") if e.strip()])

        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context, timeout=10) as server:
                if password:
                    server.login(sender_email, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_server, smtp_port, timeout=10) as server:
                try:
                    server.starttls()
                except Exception:
                    pass
                if password:
                    server.login(sender_email, password)
                server.send_message(msg)

        return True, "ok"
    except Exception as e:
        return False, str(e)

notification_hub = NotificationHub()
