import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.geo import wgs84_to_gcj02, gcj02_to_wgs84

client = TestClient(app)

def test_coordinate_transforms():
    # 测试上海人民广场 WGS-84 (31.230416, 121.473701) 转 GCJ-02 与反转
    wgs_lat, wgs_lon = 31.230416, 121.473701
    gcj_lat, gcj_lon = wgs84_to_gcj02(wgs_lat, wgs_lon)
    # GCJ-02 会产生几百米偏移
    assert abs(gcj_lat - wgs_lat) < 0.01
    assert abs(gcj_lon - wgs_lon) < 0.01

    back_lat, back_lon = gcj02_to_wgs84(gcj_lat, gcj_lon)
    assert abs(back_lat - wgs_lat) < 0.0001
    assert abs(back_lon - wgs_lon) < 0.0001

def test_api_map_endpoints():
    res = client.get("/api/v1/map/devices")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "points" in data
    assert "total_located" in data
    assert "total_unlocated" in data

    unloc_res = client.get("/api/v1/map/unlocated")
    assert unloc_res.status_code == 200
    assert isinstance(unloc_res.json()["data"], list)

    # 坐标系转换 API 测试
    trans_res = client.post("/api/v1/map/transform-coords", json={
        "latitude": 39.9042,
        "longitude": 116.4074,
        "from_crs": "WGS-84",
        "to_crs": "GCJ-02"
    })
    assert trans_res.status_code == 200
    assert trans_res.json()["data"]["to_crs"] == "GCJ-02"
