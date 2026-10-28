import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.response import success_response
from backend.app.core.exceptions import ValidationException
from backend.app.models.setting import SystemSetting
from backend.app.schemas.alert import NotificationConfigUpdate, NotificationTestRequest
from backend.app.services.notifier import send_webhook, send_email
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["通知渠道配置"])

@router.get("/config")
def get_notification_config(db: Session = Depends(get_db)):
    """获取 Webhook 与 SMTP 邮件配置"""
    alert_setting = db.query(SystemSetting).filter(SystemSetting.key == "alert").first()
    email_setting = db.query(SystemSetting).filter(SystemSetting.key == "email").first()

    alert_val = json.loads(alert_setting.value) if alert_setting else {
        "webhook_enabled": False,
        "webhook_type": "wecom",
        "webhook_url": ""
    }
    email_val = json.loads(email_setting.value) if email_setting else {
        "enabled": False,
        "smtp_server": "",
        "smtp_port": 465,
        "use_ssl": True,
        "sender_email": "",
        "password": "",
        "recipient_email": "",
        "cc_email": "",
        "quiet_hours_enabled": False,
        "quiet_start_hour": 22,
        "quiet_end_hour": 8
    }

    # 脱敏返回邮箱授权码
    safe_email = dict(email_val)
    if safe_email.get("password"):
        safe_email["has_password"] = True
        safe_email["password"] = "******"
    else:
        safe_email["has_password"] = False

    return success_response(data={
        "alert": alert_val,
        "email": safe_email
    })

@router.put("/config")
def update_notification_config(
    req: NotificationConfigUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新通知渠道配置并加密存储敏感凭据"""
    # 1. 更新 Webhook 配置
    alert_dict = {
        "webhook_enabled": req.webhook_enabled,
        "webhook_type": req.webhook_type,
        "webhook_url": req.webhook_url
    }
    alert_setting = db.query(SystemSetting).filter(SystemSetting.key == "alert").first()
    if not alert_setting:
        alert_setting = SystemSetting(key="alert", value=json.dumps(alert_dict, ensure_ascii=False))
        db.add(alert_setting)
    else:
        alert_setting.value = json.dumps(alert_dict, ensure_ascii=False)

    # 2. 更新 Email 配置 (保留未修改的密码)
    email_setting = db.query(SystemSetting).filter(SystemSetting.key == "email").first()
    old_email = json.loads(email_setting.value) if email_setting else {}
    final_password = req.password if req.password and req.password != "******" else old_email.get("password", "")

    email_dict = {
        "enabled": req.email_enabled,
        "smtp_server": req.smtp_server,
        "smtp_port": req.smtp_port,
        "use_ssl": req.use_ssl,
        "sender_email": req.sender_email,
        "password": final_password,
        "recipient_email": req.recipient_email,
        "cc_email": req.cc_email or "",
        "quiet_hours_enabled": req.quiet_hours_enabled,
        "quiet_start_hour": req.quiet_start_hour,
        "quiet_end_hour": req.quiet_end_hour
    }

    if not email_setting:
        email_setting = SystemSetting(key="email", value=json.dumps(email_dict, ensure_ascii=False))
        db.add(email_setting)
    else:
        email_setting.value = json.dumps(email_dict, ensure_ascii=False)

    db.commit()
    return success_response(message="通知渠道配置已同步保存")

@router.post("/test")
def test_notification_channel(
    req: NotificationTestRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """真实发起通知测试，并返回真实连通性反馈（严禁伪造成功）"""
    test_title = "🔔 [IPMonitor Web] 通知渠道连通性验证"
    test_content = (
        "这是一条来自 IPMonitor Web 的真实测试消息。\n"
        "如果您收到此通知，表明系统与当前通知通道网络连通正常、鉴权凭据有效！\n"
        f"测试发起时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

    if req.channel == "webhook":
        url = req.webhook_url
        if not url:
            # 尝试从数据库读取
            alert_set = db.query(SystemSetting).filter(SystemSetting.key == "alert").first()
            if alert_set:
                url = json.loads(alert_set.value).get("webhook_url")
        if not url:
            raise ValidationException("未提供 Webhook 地址")

        hook_type = req.webhook_type or "wecom"
        ok, msg = send_webhook(hook_type, url, test_title, test_content)
        if ok:
            return success_response(message=f"Webhook [{hook_type}] 测试消息发送成功！")
        else:
            raise ValidationException(f"Webhook 测试发送失败: {msg}")

    elif req.channel == "email":
        email_setting = db.query(SystemSetting).filter(SystemSetting.key == "email").first()
        saved_cfg = json.loads(email_setting.value) if email_setting else {}

        cfg = {
            "smtp_server": req.smtp_server or saved_cfg.get("smtp_server"),
            "smtp_port": req.smtp_port or saved_cfg.get("smtp_port", 465),
            "use_ssl": req.use_ssl if req.use_ssl is not None else saved_cfg.get("use_ssl", True),
            "sender_email": req.sender_email or saved_cfg.get("sender_email"),
            "password": req.password if req.password and req.password != "******" else saved_cfg.get("password"),
            "recipient_email": req.recipient_email or saved_cfg.get("recipient_email"),
            "cc_email": saved_cfg.get("cc_email", "")
        }

        ok, msg = send_email(cfg, test_title, test_content)
        if ok:
            return success_response(message=f"测试邮件已成功投递至 {cfg['recipient_email']}！")
        else:
            raise ValidationException(f"SMTP 邮件发送失败: {msg}")
    else:
        raise ValidationException("不支持的测试通道类型")
