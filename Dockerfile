# ==========================================
# 阶段 1: 前端静态资源构建 (Node 20 Alpine)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package.json ./
RUN npm install --registry=https://registry.npmmirror.com

COPY frontend/ ./
RUN npm run build

# ==========================================
# 阶段 2: Python 后端与完整单体容器运行环境
# ==========================================
FROM python:3.12-slim

# 调整国内 Debian 镜像源并安装网络探测工具 (iputils-ping, curl)
RUN sed -i 's/deb.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true && \
    apt-get update && \
    apt-get install -y --no-install-recommends iputils-ping curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 拷贝后端代码与工程资产
COPY backend/ ./backend/
COPY docs/ ./docs/
COPY run.py ./

# 挂载前端打包产物
COPY --from=frontend-builder /build/dist ./frontend/dist

# 创建持久化卷存储目录
RUN mkdir -p /app/data /app/backups

# 暴露 Web 端口
EXPOSE 8000

# 容器健康检查探针
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# 启动 IPMonitor Web
CMD ["python", "run.py"]
