# IPMonitor Web 部署与运维运维指南

本文档介绍 **IPMonitor Web** 的生产级容器化部署、本地原生部署、数据持久化、热备份与故障恢复方案。

---

## 1. 方案一：Docker Compose 一键部署 (推荐)

### 1.1 前置要求
- 已安装 Docker 与 Docker Compose (Docker 20.10+ / Compose v2+)
- 开放 Web 访问端口（默认 `8000`）

### 1.2 部署步骤

1. **获取代码并进入目录**
   ```bash
   git clone https://github.com/CheungDawa/IPMonitor.git
   cd IPMonitor
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   ```
   编辑 `.env` 文件，生产环境建议将 `SECRET_KEY` 替换为强随机密钥：
   ```env
   PORT=8000
   SECRET_KEY=your_secure_random_string_32_characters_long
   ```

3. **构建并启动容器**
   ```bash
   docker compose up -d --build
   ```

4. **检查容器运行状态**
   ```bash
   docker compose ps
   docker compose logs -f
   ```

5. **访问 Web 控制台**
   - 浏览器打开：`http://服务器IP:8000`
   - 默认初始管理员账号：`admin`
   - 默认初始密码：`admin123` (首次登录后建议在“系统设置”修改密码)

---

## 2. 方案二：本地原生 Python 部署

### 2.1 环境要求
- Python 3.10+ (推荐 3.12)
- Node.js 18+ (仅在二次修改前端时需要，已自带编译产物)

### 2.2 启动步骤

1. **创建并激活虚拟环境**
   ```bash
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **启动 Web 监控服务**
   ```bash
   python run.py
   ```
   服务将监听 `http://0.0.0.0:8000`。后台监控引擎与通知分发调度器将随 Web 服务一同拉起。

---

## 3. 数据持久化与在线热备份

### 3.1 持久化目录结构
- `./data/`：存放 SQLite 数据库文件 `ipmonitor.db` 及预写日志 `ipmonitor.db-wal`。
- `./backups/`：存放全量在线热备份快照文件。

### 3.2 手动/定时在线热备份
IPMonitor Web 内置了基于 SQLite 官方 Online Backup API 的安全热备份机制：
1. **通过 Web 界面创建备份**：
   - 登录系统进入“系统设置”页面，点击“立即创建在线备份”；
   - 系统将在不阻塞数据库读写的情况下瞬间生成全量快照，文件存放于 `backups/ipmonitor_backup_YYYYMMDD_HHMMSS.db`。
2. **通过系统 API 触发备份**：
   ```bash
   curl -X POST http://localhost:8000/api/v1/system/backup -H "Authorization: Bearer <TOKEN>"
   ```

### 3.3 数据库恢复操作
若需将系统恢复到指定备份点：
1. 停止监控服务：
   ```bash
   docker compose down
   # 或终止本地 python 进程
   ```
2. 备份当前数据（防误操作）：
   ```bash
   cp data/ipmonitor.db data/ipmonitor.db.bak
   ```
3. 复制目标快照覆盖主数据库：
   ```bash
   cp backups/ipmonitor_backup_20261027_xxxxxx.db data/ipmonitor.db
   rm -f data/ipmonitor.db-wal data/ipmonitor.db-shm
   ```
4. 重新启动服务：
   ```bash
   docker compose up -d
   ```

---

## 4. 常见排障与环境约束

### 4.1 ICMP Ping 权限问题 (Docker 容器内)
- 在 Linux Docker 容器中执行 Ping 需要 `NET_RAW` 内核能力。
- 本项目的 `compose.yaml` 中已显式配置：
  ```yaml
  cap_add:
    - NET_RAW
  ```
  保证无特权容器即可正常执行 ICMP 探测。

### 4.2 ARP 探测局限性说明
- **Windows 本地运行**：自动调用原生 `iphlpapi.SendARP`，具备毫秒级解析二层 MAC 的能力。
- **Docker 容器运行**：容器默认运行在 Docker 虚拟桥接网络 (`bridge`) 下，属于独立虚拟三层网段，无法直接跨三层路由解析局域网物理机的 ARP 二层报文。
- **解决方案**：若必须使用 ARP 协议探测局域网同网段设备，可在 `compose.yaml` 中将网络模式改为宿主机网络：
  ```yaml
  network_mode: "host"
  ```
- 若未开启 host 网络，系统探针会自动识别并安全降级，明确提示“ARP 缓存未解析到物理地址”，绝不伪造成功结果。
