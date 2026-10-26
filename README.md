# IPMonitor - 内网设备离线监控告警助手

<p align="left">
  <img src="https://img.shields.io/badge/Version-1.0.0-orange.svg" alt="Version">
  <img src="https://img.shields.io/badge/Python-3.9+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6.svg" alt="Platform">
</p>

**IPMonitor** 是一款面向网络运维人员和极客用户的轻量级局域网/内网设备可用性监控工具。具备现代 Fluent 风格界面，支持高并发异步探活、毫秒级状态变动检测、多渠道告警联动（桌面气泡、企业微信/钉钉/飞书群机器人、SMTP 邮件）。

---

## ✨ 核心特性

- **多协议并发探活**：
  - **ICMP Ping**：低延迟探测，内置上级网关代回与假在线过滤。
  - **TCP 端口**：针对开放特定服务的服务器/NAS 进行套接字探测，连接即刻安全释放。
  - **ARP 快速探测**：调用 Windows 内核原生 `SendARP` API，毫秒级直接解析内网二层物理地址，不依赖过期的系统 ARP 缓存。
- **立体化告警渠道**：
  - 🖥️ **Windows 系统托盘桌面气泡**：设备掉线即刻右下角弹窗提醒。
  - 🤖 **Webhook 机器人推送**：原生支持**企业微信**、**钉钉**、**飞书**自定义群机器人。
  - 📧 **SMTP 邮件告警**：支持 SSL/TLS 加密发送，具备免打扰时段设置。
  - 🛡️ **告警风暴抑制**：大批量设备同时断网时自动批次汇聚合并，避免告警刷屏。
- **资产便捷管理**：
  - 支持 **Excel（.xlsx）** 台账一键导出模板与批量覆盖导入。
  - 实时关键字过滤搜索、单项挂起/启用切换、双击编辑。
- **轻量且极速**：
  - 彻底剔除 Pandas / Numpy 等巨型依赖，仅依赖少量 GUI/表格核心库，秒级冷启动。
  - 内置 Windows 命名互斥体（Named Mutex），防止多重实例化与端口冲突。
  - 支持开机自动隐藏到系统托盘常驻后台监控。

---

## 🚀 快速上手

### 1. 克隆代码仓库
```bash
git clone https://github.com/CheungDawa/IPMonitor.git
cd IPMonitor
```

### 2. 安装运行依赖
推荐使用 Python 3.9+ 虚拟环境：
```bash
pip install -r requirements.txt
```

### 3. 运行程序
```bash
python main.py
```
> 程序首次运行时，若根目录下未发现 `config.json`，会自动从 `config.example.json` 复制生成默认配置。

---

## ⚙️ 配置文件说明 (`config.json`)

```json
{
    "monitoring": {
        "interval_seconds": 60,          // 轮询周期（秒）
        "retries_before_offline": 3,     // 确认离线前的连续失败重试阈值
        "timeout_seconds": 3,            // 单次探测超时（秒）
        "re_alert_interval_minutes": 60, // 持续离线重复提醒间隔（分钟）
        "max_concurrent_workers": 50     // 并行探测线程池上限
    },
    "alert": {
        "desktop_notify": true,          // 是否开启桌面托盘气泡通知
        "webhook_enabled": true,         // 是否启用 Webhook 机器人
        "webhook_type": "wecom",         // 平台: "wecom"(企业微信) / "dingtalk"(钉钉) / "feishu"(飞书)
        "webhook_url": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
    },
    "email": {
        "enabled": false,                // 是否开启邮件告警
        "smtp_server": "smtp.qq.com",
        "smtp_port": 465,
        "use_ssl": true,
        "sender_email": "example@qq.com",
        "password": "your_auth_token",   // 邮箱授权码/密码
        "recipient_email": "admin@example.com",
        "cc_email": "",
        "quiet_hours_enabled": false,    // 免打扰时段
        "quiet_start_hour": 22,
        "quiet_end_hour": 8
    },
    "system": {
        "auto_start": false              // 是否开机自启
    },
    "targets": [
        {
            "name": "机房网关",
            "address": "192.168.1.1",
            "method": "ping",
            "port": "",
            "note": "核心出口路由",
            "enabled": true
        }
    ]
}
```

---

## 📦 打包为独立可执行文件 (可选)

若需要将工具打包为单个无需 Python 环境的绿色版 `.exe`，推荐使用 PyInstaller：

```bash
pip install pyinstaller
pyinstaller -F -w -i NONE --name IPMonitor main.py
```
打包生成的可执行文件将存放在 `dist/IPMonitor.exe`。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。欢迎提交 Issue 或 Pull Request 贡献代码！
