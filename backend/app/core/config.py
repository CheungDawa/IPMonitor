import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

if getattr(sys, 'frozen', False):
    # PyInstaller 打包环境：
    # 资源目录（内嵌的前端静态文件、模板等）优先从 _MEIPASS 获取
    RESOURCE_DIR = Path(getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))).resolve()
    # 数据与运行根目录（数据库、日志、持久化配置）必须写在可执行文件所在的实际物理目录中
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
    RESOURCE_DIR = BASE_DIR

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")
    BASE_DIR: Path = BASE_DIR
    RESOURCE_DIR: Path = RESOURCE_DIR
    DATA_DIR: Path = DATA_DIR
    APP_NAME: str = "IPMonitor Web"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # 数据库配置 (默认 SQLite 嵌入式存储，支持 WAL 模式)
    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'ipmonitor.db'}"
    
    # 认证配置
    SECRET_KEY: str = "ipmonitor_web_super_secret_key_change_in_production_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 天长效 Token
    
    # 监控调度默认参数
    DEFAULT_INTERVAL_SECONDS: int = 60
    DEFAULT_TIMEOUT_SECONDS: int = 3
    DEFAULT_RETRIES_BEFORE_OFFLINE: int = 3
    DEFAULT_MAX_WORKERS: int = 50
    DEFAULT_RE_ALERT_MINUTES: int = 60
    
    # 地图与地理编码默认配置
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    USER_AGENT: str = "IPMonitor-Web/2.0"
    
    # 跨域设置
    CORS_ORIGINS: list[str] = ["*"]

settings = Settings()
