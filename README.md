# IPMonitor Web - 现代化网络设备可用性监控系统

<p align="left">
  <img src="https://img.shields.io/badge/Version-2.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript%20%7C%20Vite-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/Database-SQLite%20(WAL)-003B57.svg" alt="SQLite">
  <img src="https://img.shields.io/badge/Map-Leaflet%20%7C%20WGS--84-199900.svg" alt="Leaflet">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
</p>

**IPMonitor Web** 是一款专为网络运维人员、极客与家庭实验室（Homelab）用户打造的轻量级、高颜值、可私有化部署的局域网/互联网设备连通性监控系统。具备现代化监控大屏、设备物理全景地图、双模式定位、后台独立探活引擎、立体化告警（企业微信/钉钉/飞书/邮件）、Excel 规范导入预检与标准化 Docker Compose 交付能力。

---

## ✨ 核心特性

- 🖥️ **双门户双屏架构（监控驾驶舱 + 运维管理后台）**：
  - **门户一：NOC 态势感知监控驾驶舱 (Cockpit)**：
    - 专为监控大屏、机房电视墙与日常全屏常驻设计，无需繁复菜单干扰。
    - 全屏空间 GIS 物理地图与高密设备状态卡片矩阵一键切换（带故障优先排序与告警呼吸灯）。
    - 极速聚合遥测接口（`/api/v1/cockpit/overview`），以毫秒级时延呈现全网可用度 (SLA)、设备时延 Top 10、分组健康度进度条与滚动告警播报墙。
    - 右上角内置一键全屏模式（F11 / Kiosk）、倒计时自动轮询与“进入运维后台”通道。
  - **门户二：专业运维管理后台 (Admin Console)**：
    - 经典抽屉与侧边导航布局，涵盖设备台账增删改查、双模式经纬度拾取、告警风暴抑制、多表头 Excel 导入导出与在线热备份。
    - 顶部设置“🚀 返回监控驾驶舱”快捷入口，实现大屏态势与深度运维的极速无缝流转。
- 🗺️ **设备全景地图与双模式定位**：
  - **模式 A (地址搜索定位)**：输入真实物理地址，调用地理编码服务检索候选列表并一键选定。
  - **模式 B (手动地图选点)**：直接在 Leaflet 地图上单击或按住图钉拖拽微调（`manual_pin`），支持逆地理编码反查。
  - **坐标系规范**：采用 WGS-84 标准坐标系，内置与 GCJ-02 火星坐标系的双向无损转换。
  - **未定位设备安全保护**：无坐标设备作为一等公民正常参与监控、统计与告警，提供侧边抽屉快速补全入口。
- ⚙️ **独立后台高并发监控引擎**：
  - 彻底脱离浏览器，即使所有前台页面关闭，后端后台守护引擎仍按配置持续轮询探活。
  - 严谨的状态机（`ONLINE`, `OFFLINE`, `UNKNOWN`, `DISABLED`），支持连续失败重试阈值判定。
  - 支持 **ICMP Ping**、**TCP 端口** 与 **ARP 局域网探针**，具备容器环境与跨网段自检降级。
- 📊 **规范 Excel 台账导入导出与预检**：
  - 项目内置真实标准 3-sheet 模板：`docs/templates/IPMonitor设备导入模板.xlsx`（包含设备导入、填写说明、数据字典）。
  - 严格导入预检：自动拦截 IP 格式错误、端口异常与经纬度不一致问题，输出行级错误清单。
  - 覆盖导入时坐标防抹除保护：空白坐标默认不会覆盖数据库中已有位置。
- 🔔 **闭环告警与风暴抑制**：
  - 支持 **企业微信**、**钉钉**、**飞书** 群机器人 Webhook 推送与 **SMTP 邮件** 告警。
  - 具备 0.5s 窗口期微批次聚合（最多合并 20 条），避免大面积断网引发告警刷屏。
  - 支持免打扰时段过滤与真实通道在线连通性测试。
- 📈 **历史审计与运维报表**：
  - 统计分析可用度 (Uptime %) 与平均故障恢复时长 (MTTR)。
  - 支持导出包含可用度统计、事件明细与告警历史的多工作表 Excel 报表。
- 🛡️ **轻量安全与在线热备份**：
  - 基于 SQLite 3 WAL 模式，无需外挂庞大数据库即可实现并发读写。
  - 支持 SQLite 在线热备份 API，一键生成快照，业务不中断。

---

## 🚀 部署指南

> ### 📦 快速下载（Windows 纯净电脑免安装绿色运行包）
> 如果您的目标 Windows 主机**没有安装任何 Python、Node.js 或 Docker 环境**，请直接前往 GitHub Releases 下载官方预编译运行包：  
> 🔗 **[点击直接下载 IPMonitor-v2.0.0-windows-x64.zip](https://github.com/CheungDawa/IPMonitor/releases/download/v2.0.0/IPMonitor-v2.0.0-windows-x64.zip)**  
> 也可以在 [GitHub Releases 页面](https://github.com/CheungDawa/IPMonitor/releases/tag/v2.0.0) 查看全部独立文件（包含单文件版 `ipmonitor.exe`）。下载解压后双击 `IPMonitor-驾驶舱.bat` 即可开箱即用！

---

### 方式一：Docker Compose 一键部署 (推荐)

系统已配置全自动化多阶段容器构建，无需在宿主机安装任何 Node.js 或 Python 环境：

```bash
# 1. 克隆项目仓库
git clone https://github.com/CheungDawa/IPMonitor.git
cd IPMonitor

# 2. 一键编译并后台启动 (自动挂载持久化数据库与数据卷)
docker compose up -d --build
```
- **访问入口**：`http://localhost:8000` (或局域网 `http://<服务器IP>:8000`)
- **默认管理员账号**：`admin`
- **默认初始密码**：`admin123`
- **数据持久化位置**：本地 `./data/ipmonitor.db` (支持在线备份到 `./backups/`)

---

### 方式二：Windows 纯净电脑免环境部署 (零环境依赖 + 开机自启全屏)

针对工控大屏、机房展示屏等**没有任何 Python/Node 环境的纯净 Windows 电脑**：

1. **直接运行/调试**：
   - 双击运行根目录下的 `IPMonitor-驾驶舱.bat`；
   - 系统将自动静默拉起后台探活引擎，并使用 Windows 原生 Edge App 视窗唤起驾驶舱（无浏览器地址栏，纯正原生大屏体验）。
2. **配置通电开机自启**：
   - 双击运行 `一键配置开机自启.bat`；
   - 计算机开机通电登录后，将自动静默启动后台探活，并立即点亮全屏监控驾驶舱。
3. **管理与维护**：
   - 停止服务：双击 `一键停止运行.bat`；
   - 卸载自启：双击 `一键卸载开机自启.bat`。

---

### 方式三：本地 Python 源码运行

```bash
# 1. 安装 Python 依赖
pip install -r requirements.txt

# 2. 启动服务 (同时托管后端 API 与编译后的静态前端)
python run.py
```

---

## 📁 目录结构

```text
IPMonitor/
├── backend/                   # 后端工程源码
│   ├── app/
│   │   ├── api/v1/            # RESTful API 路由层 (auth, devices, map, dashboard, etc.)
│   │   ├── core/              # 配置、数据库连接、统一响应、安全鉴权与异常处理
│   │   ├── models/            # SQLAlchemy 关系型数据模型
│   │   ├── schemas/           # Pydantic v2 请求与响应验证契约
│   │   ├── engine/            # 独立监控守护调度引擎与网络探针 (Ping, TCP, ARP)
│   │   └── services/          # 迁移、地理计算、Excel 导入导出与邮件通知服务
│   └── tests/                 # 自动化测试套件 (pytest, 100% 通过)
├── frontend/                  # 前端工程源码 (React 18 + TypeScript + Vite + Leaflet)
│   ├── src/
│   │   ├── components/        # 双模式定位组件 LocationPicker, 设备地图 DeviceMap
│   │   ├── views/             # 监控大屏, 设备台账, 物理地图, 告警中心, 报表中心, 系统运维
│   │   └── services/api.ts    # 前端 API 封装
│   └── dist/                  # 前端生产打包静态资源 (由 FastAPI 统一挂载)
├── docs/                      # 核心架构文档、实施计划、测试报告与模板
│   ├── templates/             # 包含正式生成的 IPMonitor设备导入模板.xlsx
│   ├── test-reports/          # 全量自动化测试报告
│   ├── DEPLOYMENT.md          # 详细部署与运维手册
│   └── USER_MANUAL.md         # 用户详细操作说明书
├── Dockerfile                 # 多阶段生产容器构建文件
├── compose.yaml               # Docker Compose 生产编排配置
├── requirements.txt           # Python 核心依赖清单
└── run.py                     # 本地一键启动入口脚本
```

---

## 🧪 自动化测试验证

系统配备全套自动化回归测试套件，执行以下命令即可全量验证：

```bash
pytest --tb=short
```

**测试门禁表现：**
- 6 个测试模块、10 项系统级集成测试 + 4 项原生自检全部通过（通过率 100%）。
- 完整覆盖认证拦截、设备/分组 CRUD、坐标合法性与转换、网络探针、状态机跃迁、Excel 预检防覆盖与报表导出。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
