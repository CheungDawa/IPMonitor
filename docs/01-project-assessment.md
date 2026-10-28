# IPMonitor Web 现状评估报告

**文档编号：** `docs/01-project-assessment.md`  
**评估日期：** 2026-10-27  
**评估对象：** IPMonitor 现有仓库 (`https://github.com/CheungDawa/IPMonitor`)  
**目标演进：** IPMonitor Web (轻量级 B/S 网络设备监控系统)

---

## 1. 当前项目架构审查

现有 IPMonitor 是一个基于 Python 的单文件桌面 GUI 应用程序（C/S 单机形态），主要技术组成如下：

- **代码结构**：
  - `main.py`（1196 行）：集成了 Tkinter 界面、Windows 11 样式配置、后台探活线程池、告警异步队列、配置管理、Excel 导入导出、系统托盘（pystray）以及单实例互斥锁。
  - `config.example.json`（57 行）：JSON 格式示例配置，包含监控策略、告警渠道、邮件配置及示例 targets 列表。
  - `requirements.txt`：仅包含 `pystray>=0.19.5`、`Pillow>=10.0.0`、`openpyxl>=3.1.0`。
  - `test_self_check.py`（62 行）：原生 assert 形式的基础回归自检脚本，覆盖路径、TCP 探测、ARP 探测、Excel 读写及静音时段算法。
- **运行依赖**：
  - 核心界面依赖 Python 内置的 `tkinter`，并在 Windows 下通过 `winreg` 注册表操作开机自启。
  - 进程互斥依赖 Windows 原生 `ctypes.windll.kernel32.CreateMutexW`（回退为本地 TCP 54321 端口绑定）。
  - 探针通过系统子进程 `ping`、Windows 原生 `iphlpapi.SendARP`（回退 `ping` + `arp -a`）以及原生 `socket.create_connection` 完成。
- **存储方案**：
  - 采用单一文件 `config.json` 扁平存储所有系统配置与资产清单，未采用关系型或时序数据库，无状态变更持久化。

---

## 2. 当前已实现功能清单

1. **多协议设备探活**：
   - ICMP Ping：支持 Windows/Linux 平台分支，具备 TTL 与“无法访问/超时”中文过滤。
   - TCP 端口连通性探测：基于 `socket.create_connection`，带超时释放。
   - ARP 快速检测：Windows 下调用 `iphlpapi.SendARP` 直接解析二层 MAC，备用回退子进程。
2. **告警机制与风暴抑制**：
   - 支持 Windows 托盘气泡弹窗通知。
   - 支持企业微信、钉钉、飞书自定义 Webhook 机器人消息推送（支持 Markdown 与文本卡片）。
   - 支持 SMTP 邮件告警（SSL/TLS、免打扰静音时段过滤）。
   - 告警风暴抑制：告警工作线程具备 0.5s 窗口期微批量合并机制（单次最多合并 20 条事件）。
3. **资产管理与数据交互**：
   - 基础设备增删改、关键字实时过滤。
   - 基于 `openpyxl` 的 Excel 资产导出与导入。
4. **单实例保护与自启**：
   - 命名互斥体防多开、Windows 启动注册表管理。

---

## 3. 可以复用的代码与业务逻辑

经过代码分析，现有代码中以下高质量核心逻辑可直接提取为独立服务组件或工具模块复用：

1. **探活内核**（`main.py` L716-L781）：
   - `ping_check(addr)`：子进程 ping 调用与跨平台结果解析逻辑。
   - `tcp_check(addr, port)`：标准 TCP 套接字检测与超时释放。
   - `arp_check(addr)`：Windows 原生 SendARP 与跨平台适配逻辑（需抽象为探针接口并处理 Linux 容器兼容性）。
2. **多渠道通知驱动**（`main.py` L782-L950）：
   - Webhook 消息体组装（企业微信 markdown、钉钉 markdown、飞书 interactive/text）。
   - SMTP 邮件发送驱动及 STARTTLS/SSL 支持。
   - 静音时段算法 `check_quiet_hour(hour, start, end)`（支持跨午夜时间段校验）。
   - 告警风暴合并器（微批次队列汇聚算法）。
3. **Excel 数据处理**（`main.py` L550-L625）：
   - 字段规范映射与空值/类型转换容错逻辑。
4. **配置合并容错**（`main.py` L211-L221）：
   - `deep_fix_config` 递归字段补齐逻辑，可复用于旧版 `config.json` 平滑迁移至数据库。

---

## 4. 需要修复的缺陷与现存局限性

| 序号 | 缺陷/局限性 | 影响与风险 | 改造方案 |
|---|---|---|---|
| 1 | **桌面 GUI 强耦合** | 监控调度与 Tkinter 绑定，前端关闭则监控停止；无法在 Linux/Docker 无头服务器运行 | 解耦监控调度为后台守护服务，监控生命周期独立于任何 Web 前端连接 |
| 2 | **数据持久化缺失** | 仅有配置，无设备在线历史、事件时间线、探针记录与告警记录 | 引入 SQLite 关系型数据库，建立规范的数据模型与迁移机制 |
| 3 | **无设备唯一标识** | 现有 targets 仅为 JSON 数组，缺乏唯一 ID，无法精确追踪历史变更与增量更新 | 引入自增/UUID 唯一主键与外键关联体系 |
| 4 | **完全缺少地理位置与地图能力** | 现有模型无经纬度、地址、定位状态等字段，无法在地图上标记与选点 | 增加完整的定位字段体系，引入 Leaflet 地图与双模式定位组件 |
| 5 | **ARP 容器内不可用风险** | Linux Docker 容器默认缺乏 `NET_RAW` 或处于桥接网段，无法直接解析局域网 ARP | 在探针层增加运行环境能力自检与友好降级提示，不伪造检测结果 |
| 6 | **缺乏用户认证与 API 安全** | 任何人访问即可修改配置与资产 | 增加轻量级 JWT / Session 认证体系与安全的密码哈希（bcrypt） |
| 7 | **缺乏现代化监控大屏与报表** | 无法直观展示在线率统计、故障趋势与 MTTR 指标 | 建设现代化状态大屏、统计指标计算引擎与报表导出功能 |

---

## 5. 需要新增的功能体系

1. **后端基础层**：FastAPI RESTful API、统一响应模型、标准化异常处理、结构化日志记录。
2. **数据持久层**：SQLAlchemy ORM、SQLite（支持 WAL 并发读写）、Alembic 迁移机制、初始数据迁移工具。
3. **独立监控引擎**：基于 `asyncio`/线程池的高并发调度引擎、状态机（`ONLINE`/`OFFLINE`/`UNKNOWN`/`DISABLED`）、状态事件流水记录。
4. **设备与分组管理**：完整 CRUD、分组分类、自定监控策略覆盖。
5. **设备地图与双模式定位**：
   - 候选地址检索定位与地理编码。
   - 交互式地图手动点击/拖拽标点（manual_pin）。
   - WGS-84 与 GCJ-02 坐标系规范与转换。
   - 未定位设备统计与安全补全。
6. **现代化监控大屏**：参考现代运维面板（如哪吒监控）设计，实时统计卡片、在线率、活动告警、故障分布、设备卡片与快捷筛选。
7. **告警中心与通知闭环**：告警规则配置、活动告警与历史告警记录、故障自动恢复通知、通道连通性测试。
8. **历史记录与报表中心**：状态时间轴查询、在线率计算、MTTR 计算、Excel/CSV 报表导出。
9. **Excel 导入导出**：生成标准化 3-sheet 模板（`docs/templates/IPMonitor设备导入模板.xlsx`）、预检机制、错误行明细下载。
10. **系统设置与安全备份**：本地单管理员认证、系统运行参数、SQLite 在线备份与恢复机制。
11. **容器化交付**：Dockerfile、compose.yaml、自动化健康检查与一键部署脚本。

---

## 6. 数据迁移与兼容性风险

1. **已有配置无感迁移**：
   - 自动检测现有 `config.json`。
   - 若存在，自动将其中的 `monitoring`、`alert`、`email` 以及 `targets` 列表转换写入 SQLite 数据库，并标记为已迁移。
   - 缺失字段（如分组、经纬度、状态）赋予默认安全值，避免数据丢失。
2. **坐标系与经纬度安全**：
   - 严格约束经纬度同时有值或同时为空，避免半有效数据污染。
   - 批量导入地址时不默认批量请求外网地理编码服务，防止触发限流。

---

## 7. 推荐技术选型及理由

- **后端**：`Python 3.12` + `FastAPI` + `Pydantic v2` + `SQLAlchemy 2.0` + `Uvicorn`
  - *理由*：高效异步并发、强类型数据校验、轻量级、完美兼容已有 Python 探针和告警模块。
- **存储**：`SQLite 3`（启用 WAL 预写日志与外键约束）
  - *理由*：极简单文件嵌入式数据库，无运维开销，极度契合个人网络运维定位，支持在线备份。
- **前端**：`React 18` + `TypeScript` + `Vite` + `Tailwind CSS` + `Lucide Icons` + `Leaflet` + `ECharts`
  - *理由*：轻量现代、加载秒级、交互体验优良，单页应用可被编译为静态资源直接由 FastAPI 挂载托管，形成单容器/单执行单元，极大简化部署。
- **部署**：`Docker` + `Docker Compose`
  - *理由*：标准容器化交付，支持数据卷持久化，一键启停。

---

## 8. 当前环境约束与外部依赖

1. **操作系统**：Windows 11（PowerShell 环境，Python 3.12 虚拟环境已建立，Node.js v26.12.1 / npm 11.20.0 可用）。
2. **Git**：已配置并验证 Git 2.56.0。
3. **网络连通性**：可访问外部 GitHub 及 npm/PyPI 镜像源；地图瓦片与地理编码支持开放 OpenStreetMap / Nominatim / 高德等灵活配置。
4. **探针权限约束**：Windows 下支持 SendARP 及 ICMP ping；Docker 容器下需在 `compose.yaml` 中配置 `cap_add: [NET_RAW]` 以支持 ICMP ping。

---

## 9. 验收门禁标准

- 后端监控服务脱离浏览器常驻运行，状态判定真实准确。
- 地图支持地址搜索 + 手动选点双模式，坐标持久化无误。
- Excel 导入模板规范生成，预检错误拦截明确。
- 自动化测试用例覆盖关键路径，无伪造接口与假数据。
- 完整产出 Dockerfile、compose.yaml、备份恢复说明及交付文档。
