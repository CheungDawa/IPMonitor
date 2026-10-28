import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_cockpit_overview():
    res = client.get("/api/v1/cockpit/overview")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "summary" in data
    assert "map_points" in data
    assert "group_health" in data
    assert "latency_nodes" in data
    assert "active_alerts" in data
    assert "events_ticker" in data
    assert data["summary"]["uptime_ratio"] >= 0
