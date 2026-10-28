import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.models.base import Base
from backend.app.models.user import User
from backend.app.models.group import DeviceGroup
from backend.app.models.device import Device
from backend.app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from backend.app.services.migration import init_db

def test_password_and_token():
    plain = "my_secure_pass_123"
    hashed = hash_password(plain)
    assert verify_password(plain, hashed) is True
    assert verify_password("wrong_pass", hashed) is False

    token = create_access_token("admin_test")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == "admin_test"

def test_models_and_migration():
    # 使用内存 SQLite 测试
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()

    try:
        # 1. 验证用户模型
        u = User(username="test_admin", password_hash=hash_password("test"), role="admin")
        db.add(u)
        db.commit()
        assert u.id is not None
        assert u.username == "test_admin"

        # 2. 验证分组模型
        g = DeviceGroup(name="测试分组", color="#10B981")
        db.add(g)
        db.commit()
        assert g.id is not None

        # 3. 验证设备与位置模型
        d = Device(
            name="测试路由器",
            ip_address="192.168.1.1",
            group_id=g.id,
            method="ping",
            latitude=31.2304,
            longitude=121.4737,
            location_address="上海市黄浦区人民广场",
            location_status="located",
            location_method="address_search"
        )
        db.add(d)
        db.commit()
        assert d.id is not None
        assert d.status == "UNKNOWN"
        assert d.location_status == "located"
        assert d.latitude == 31.2304

        # 4. 验证关联关系
        assert len(g.devices) == 1
        assert g.devices[0].name == "测试路由器"

    finally:
        db.close()
