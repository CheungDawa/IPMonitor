import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.security import create_access_token

client = TestClient(app)
token = create_access_token("admin")
headers = {"Authorization": f"Bearer {token}"}

def test_device_and_group_lifecycle():
    uniq_name = f"测试网络分组_{uuid.uuid4().hex[:6]}"
    # 1. 创建分组
    g_res = client.post("/api/v1/groups", json={"name": uniq_name, "color": "#10B981"}, headers=headers)
    assert g_res.status_code == 200
    group_id = g_res.json()["data"]["id"]

    # 2. 校验经纬度一致性 (仅填写纬度不填经度应报错拦截)
    bad_dev_res = client.post("/api/v1/devices", json={
        "name": f"非法坐标设备_{uuid.uuid4().hex[:6]}",
        "ip_address": "10.0.0.99",
        "method": "ping",
        "latitude": 30.1234,
        "longitude": None
    }, headers=headers)
    assert bad_dev_res.status_code in (400, 422)

    # 3. 创建合法设备 (包含有效坐标)
    dev_name = f"IDC-核心出口路由_{uuid.uuid4().hex[:6]}"
    dev_res = client.post("/api/v1/devices", json={
        "name": dev_name,
        "ip_address": "10.0.0.1",
        "group_id": group_id,
        "method": "ping",
        "latitude": 39.9042,
        "longitude": 116.4074,
        "location_address": "北京市东城区长安街",
        "location_method": "manual_pin"
    }, headers=headers)
    assert dev_res.status_code == 200
    dev_id = dev_res.json()["data"]["id"]

    # 4. 获取设备详情与坐标状态
    d_get = client.get(f"/api/v1/devices/{dev_id}")
    assert d_get.status_code == 200
    d_data = d_get.json()["data"]
    assert d_data["location_status"] == "located"
    assert d_data["latitude"] == 39.9042
    assert d_data["group_id"] == group_id

    # 5. 试图删除包含设备的分组 (应被严格保护阻断，防止孤立数据或误删)
    del_g_res = client.delete(f"/api/v1/groups/{group_id}", headers=headers)
    assert del_g_res.status_code in (400, 422)
    assert "无法直接删除" in del_g_res.json()["message"]

    # 6. 删除设备后成功删除分组
    client.delete(f"/api/v1/devices/{dev_id}", headers=headers)
    del_g_ok = client.delete(f"/api/v1/groups/{group_id}", headers=headers)
    assert del_g_ok.status_code == 200
