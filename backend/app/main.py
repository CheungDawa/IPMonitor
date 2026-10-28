import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.core.exceptions import (
    AppException,
    app_exception_handler,
    validation_exception_handler,
    global_exception_handler
)
from backend.app.services.migration import init_db
from backend.app.engine.scheduler import monitor_engine
from backend.app.services.excel_service import generate_excel_template

# API 路由引入
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.groups import router as groups_router
from backend.app.api.v1.devices import router as devices_router
from backend.app.api.v1.map import router as map_router
from backend.app.api.v1.dashboard import router as dashboard_router
from backend.app.api.v1.alerts import router as alerts_router
from backend.app.api.v1.notifications import router as notifications_router
from backend.app.api.v1.excel import router as excel_router
from backend.app.api.v1.reports import router as reports_router
from backend.app.api.v1.system import router as system_router
from backend.app.api.v1.cockpit import router as cockpit_router

FRONTEND_DIST = settings.RESOURCE_DIR / "frontend" / "dist"
if not FRONTEND_DIST.exists():
    FRONTEND_DIST = settings.BASE_DIR / "frontend" / "dist"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. 初始化数据库表结构与平滑迁移
    logger.info("启动生命周期：正在初始化系统数据库...")
    init_db()
    # 2. 预先生成官方 Excel 模板
    try:
        generate_excel_template()
    except Exception as e:
        logger.warning(f"预生成 Excel 模板警告: {e}")
    # 3. 启动独立监控调度守护引擎
    logger.info("启动生命周期：正在启动后台独立监控引擎...")
    monitor_engine.start()
    yield
    # 4. 关闭后台引擎
    logger.info("关闭生命周期：正在终止后台监控引擎...")
    monitor_engine.stop()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# 跨域中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 统一异常拦截
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# 注册 API 路由
api_v1_routers = [
    auth_router,
    groups_router,
    devices_router,
    map_router,
    dashboard_router,
    alerts_router,
    notifications_router,
    excel_router,
    reports_router,
    system_router,
    cockpit_router
]

for r in api_v1_routers:
    app.include_router(r, prefix="/api/v1")

@app.get("/health", tags=["健康检查"])
def health_check():
    """容器与服务健康探针"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "engine_running": monitor_engine.is_running()
    }

# 静态资源与前端单页应用 (SPA) 挂载
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # 排除 API 请求
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"code": 404, "message": "API endpoint not found"})
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"message": "Frontend index.html not found"})
