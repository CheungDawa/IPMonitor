import pytest
from backend.app.services.migration import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """在测试会话启动时初始化测试数据库表结构与默认数据"""
    init_db()
    yield
