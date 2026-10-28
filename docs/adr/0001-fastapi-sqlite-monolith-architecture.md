# ADR 0001: 采用 FastAPI + SQLite(WAL) + React 模块化单体交付架构

## 状态
已接受 (Accepted)

## 上下文
现有 IPMonitor 为单机 Tkinter 桌面应用，存在以下局限：
1. 监控线程依赖图形界面窗口存在，不能在 Linux 服务器或后台 headless 模式常驻运行；
2. 资产存储于单一扁平 JSON 文件，无关系型约束、状态流水与审计记录；
3. 需要升级为现代化的 Web 应用，提供大屏监控、双模式地图定位、资产管理与报表导出。

项目定位为个人使用的轻量级网络运维监控系统，部署目标以单机或 Docker Compose 为主，要求极简部署、秒级启动、免除外部重型数据库依赖。

## 决策
1. **后端架构**：采用 Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy 2.0，构建模块化单体后端。
2. **数据存储**：默认使用 SQLite 3，开启 WAL (Write-Ahead Logging) 预写日志与外键约束。利用 Python 内置 SQLite 模块，无需启动额外的 PostgreSQL/MySQL 容器服务，大幅节省资源；通过 SQLite 在线备份 API 提供安全热备份。
3. **监控引擎**：将监控探活循环作为独立的后台守护服务，通过 FastAPI lifespan 事件由后台线程管理，完全脱离任何 Web 客户端连接，即使所有浏览器关闭仍持续运行。
4. **前端架构**：采用 React + TypeScript + Vite + Ant Design / Tailwind CSS，编译构建产物直接挂载于 FastAPI 的静态资源目录，或由反向代理托管，实现单容器一键拉起。

## 后果
- 优点：架构清晰，部署极简（单容器即可交付全部功能），内存占用低（常规运行 <100MB），兼容现有 Python 探测与告警代码。
- 约束：SQLite 适用于单节点部署，若未来有分布式集群或超大规模设备需求，通过 SQLAlchemy 可低成本切换至 PostgreSQL。
