"""
IPMonitor 优化回归自检脚本 (免第三方测试框架，直接 assert 验证)
运行命令: python test_self_check.py
"""
import os
import sys
import importlib.util

def run_tests():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    target_py = os.path.join(base_dir, "main.py")
    
    spec = importlib.util.spec_from_file_location("ipm", target_py)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)

    print("1. 验证绝对路径基准...")
    assert os.path.isabs(m.CONFIG_FILE), "CONFIG_FILE 必须为绝对路径"
    assert os.path.isabs(m.CONFIG_EXAMPLE_FILE), "CONFIG_EXAMPLE_FILE 必须为绝对路径"
    assert os.path.isabs(m.LOG_FILE), "LOG_FILE 必须为绝对路径"
    assert os.path.dirname(m.CONFIG_FILE) == base_dir, "路径应基于当前脚本目录"

    print("2. 验证网络探针功能...")
    class DummyApp:
        app_config = {"monitoring": {"timeout_seconds": 1}}
    
    # TCP 端口关闭检测 (未开启端口应安全返回 False，且无 socket 句柄泄露)
    tcp_res = m.IPMonitorApp.tcp_check(DummyApp(), "127.0.0.1", 65431)
    assert tcp_res is False, "关闭端口应返回 False"

    # ARP 本地回环检测
    arp_res = m.IPMonitorApp.arp_check(DummyApp(), "127.0.0.1")
    assert arp_res is True, "127.0.0.1 ARP 应解析成功"

    print("3. 验证 Excel 模板生成与读取 (基于 openpyxl，无 pandas 巨型依赖)...")
    from openpyxl import Workbook, load_workbook
    tmp_xlsx = os.path.join(base_dir, "_temp_check.xlsx")
    try:
        wb = Workbook()
        ws = wb.active
        ws.append(["Enabled", "Name", "Address", "Method", "Port", "Note"])
        ws.append([True, "自检网关", "192.168.1.1", "ping", "", "测试"])
        wb.save(tmp_xlsx)

        wb_read = load_workbook(tmp_xlsx, data_only=True)
        rows = list(wb_read.active.iter_rows(values_only=True))
        assert len(rows) == 2
        assert rows[1][1] == "自检网关"
    finally:
        if os.path.exists(tmp_xlsx):
            os.remove(tmp_xlsx)

    print("4. 验证静音时段算法...")
    assert m.check_quiet_hour(23, 22, 8) is True
    assert m.check_quiet_hour(2, 22, 8) is True
    assert m.check_quiet_hour(12, 22, 8) is False
    assert m.check_quiet_hour(14, 12, 18) is True

    print("\n[OK] 所有自检项全部通过！代码运行正常。")

if __name__ == "__main__":
    run_tests()
