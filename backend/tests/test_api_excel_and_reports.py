import io
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.security import create_access_token
from backend.app.services.excel_service import TEMPLATE_PATH, generate_excel_template
from openpyxl import Workbook

client = TestClient(app)
token = create_access_token("admin")
headers = {"Authorization": f"Bearer {token}"}

def test_excel_template_and_export():
    # 1. 验证下载模板
    res = client.get("/api/v1/excel/template")
    assert res.status_code == 200
    assert len(res.content) > 1000

    # 2. 构造一个测试 Excel 上传预检 (包含 1 个有效行和 1 个错误行)
    wb = Workbook()
    ws = wb.active
    ws.title = "设备导入"
    ws.append(["设备名称*", "IP地址*", "探测方式*", "端口", "设备类型", "所属分组", "设备地址", "纬度", "经度", "坐标系"])
    # 正常行
    ws.append(["测试服务器A", "10.10.10.1", "ping", "", "server", "办公区", "北京市海淀区", 39.9, 116.4, "WGS-84"])
    # 错误行 (IP 非法，且仅填了纬度未填经度)
    ws.append(["测试错误机", "999.999.999.999", "tcp", "invalid_port", "nas", "", "", 39.9, "", "WGS-84"])

    buf = io.BytesIO()
    wb.save(buf)
    file_bytes = buf.getvalue()

    # 3. 预检请求
    pre_res = client.post("/api/v1/excel/precheck", files={"file": ("test.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert pre_res.status_code == 200
    pdata = pre_res.json()["data"]
    assert pdata["valid_count"] == 1
    assert pdata["error_count"] >= 1
    assert len(pdata["errors"]) > 0

    # 4. 设备导出 API
    exp_res = client.get("/api/v1/excel/export")
    assert exp_res.status_code == 200
    assert len(exp_res.content) > 500

def test_dashboard_and_reports():
    # 1. 仪表盘统计
    dash_res = client.get("/api/v1/dashboard/stats")
    assert dash_res.status_code == 200
    d_data = dash_res.json()["data"]
    assert "total_devices" in d_data
    assert "uptime_ratio" in d_data

    # 2. 故障趋势
    trend_res = client.get("/api/v1/dashboard/fault-trend")
    assert trend_res.status_code == 200
    assert "points" in trend_res.json()["data"]

    # 3. 运维报表统计
    rep_res = client.get("/api/v1/reports/statistics?days=7")
    assert rep_res.status_code == 200
    assert "total_outages" in rep_res.json()["data"]

    # 4. 导出多工作表报表 Excel
    rep_exp = client.get("/api/v1/reports/export-excel?days=7")
    assert rep_exp.status_code == 200
    assert len(rep_exp.content) > 1000
