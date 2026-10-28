from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from backend.app.core.config import settings

connect_args = {}
engine_kwargs = {
    "echo": settings.DEBUG,
}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}
    engine_kwargs["connect_args"] = connect_args
    # SQLite 属进程内轻量嵌入式数据库，采用 NullPool 杜绝 QueuePool 连接池数量限制 (5+10) 与线程池耗尽问题
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 30

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA busy_timeout=5000;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
