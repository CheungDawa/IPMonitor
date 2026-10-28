import io
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

from backend.app.core.logging import logger
from backend.app.core.database import SessionLocal
from backend.app.models.device import Device
from backend.app.models.group import DeviceGroup
from backend.app.services.geo import validate_coordinates, gcj02_to_wgs84

from backend.app.core.config import settings

TEMPLATE_PATH = settings.RESOURCE_DIR / "docs" / "templates" / "IPMonitor设备导入模板.xlsx"
if not TEMPLATE_PATH.parent.exists():
    TEMPLATE_PATH = settings.DATA_DIR / "templates" / "IPMonitor设备导入模板.xlsx"

IPV4_PATTERN = re.compile(r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")

def sanitize_formula_injection(val: Any) -> Any:
    """防止 Excel 公式注入 (以 =, +, -, @ 开头的字符串进行安全单引号转义)"""
    if isinstance(val, str) and val and val[0] in ("=", "+", "-", "@"):
        return f"'{val}"
    return val

def generate_excel_template() -> Path:
    """生成正式标准的设备导入 Excel 模板 (包含 3 个工作表与数据验证下拉框)"""
    TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()

    # ---------------- 样式定义 ----------------
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    header_font = Font(name="Microsoft YaHei", size=10, bold=True, color="FFFFFF")
    example_font = Font(name="Microsoft YaHei", size=10, italic=True, color="6B7280")
    normal_font = Font(name="Microsoft YaHei", size=10)
    thin_border = Border(
        left=Side(style='thin', color='E5E7EB'),
        right=Side(style='thin', color='E5E7EB'),
        top=Side(style='thin', color='E5E7EB'),
        bottom=Side(style='thin', color='E5E7EB')
    )
    center_align = Alignment(horizontal='center', vertical='center')
    left_align = Alignment(horizontal='left', vertical='center')

    # ================= 1. 设备导入工作表 =================
    ws1 = wb.active
    ws1.title = "设备导入"
    ws1.views.sheetView[0].showGridLines = True

    headers = [
        "设备名称*", "IP地址*", "探测方式*", "端口", "设备类型", 
        "所属分组", "设备地址", "纬度", "经度", "坐标系", 
        "定位方式", "探测超时秒", "探测间隔秒", "连续重试次数", "是否启用", "备注"
    ]
    ws1.append(headers)

    for col_num, h in enumerate(headers, 1):
        cell = ws1.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align
        cell.border = thin_border

    # 示例数据 (明确标为示例)
    sample_rows = [
        ["[示例] 核心网关", "192.168.1.1", "ping", "", "router", "机房核心", "北京市海淀区中关村南大街1号", 39.984122, 116.307484, "WGS-84", "import_coordinates", 3, 60, 3, "是", "总控主出口路由"],
        ["[示例] 存储NAS", "192.168.1.10", "tcp", 445, "nas", "办公网", "上海市浦东新区张江高科园区", "", "", "WGS-84", "import_address", 3, 60, 3, "是", "仅导入地址待定位"],
        ["[示例] 车间摄像头", "192.168.1.50", "arp", "", "camera", "监控网", "", "", "", "WGS-84", "none", 2, 120, 2, "是", "暂不定位直接监控"]
    ]

    for row_data in sample_rows:
        ws1.append(row_data)
        r_idx = ws1.max_row
        for c_idx in range(1, len(headers) + 1):
            cell = ws1.cell(row=r_idx, column=c_idx)
            cell.font = example_font
            cell.border = thin_border
            cell.alignment = left_align if c_idx in (1, 2, 7, 16) else center_align

    # 冻结首行
    ws1.freeze_panes = "A2"

    # 设置列宽
    col_widths = {
        'A': 20, 'B': 18, 'C': 12, 'D': 10, 'E': 14,
        'F': 16, 'G': 32, 'H': 14, 'I': 14, 'J': 12,
        'K': 18, 'L': 12, 'M': 12, 'N': 14, 'O': 12, 'P': 26
    }
    for col, width in col_widths.items():
        ws1.column_dimensions[col].width = width

    # 下拉验证规则
    dv_method = DataValidation(type="list", formula1='"ping,tcp,arp"', allow_blank=False)
    ws1.add_data_validation(dv_method)
    dv_method.add("C2:C500")

    dv_type = DataValidation(type="list", formula1='"server,router,switch,nas,camera,printer,workstation,other"', allow_blank=True)
    ws1.add_data_validation(dv_type)
    dv_type.add("E2:E500")

    dv_crs = DataValidation(type="list", formula1='"WGS-84,GCJ-02"', allow_blank=True)
    ws1.add_data_validation(dv_crs)
    dv_crs.add("J2:J500")

    dv_loc_method = DataValidation(type="list", formula1='"import_coordinates,import_address,none"', allow_blank=True)
    ws1.add_data_validation(dv_loc_method)
    dv_loc_method.add("K2:K500")

    dv_enabled = DataValidation(type="list", formula1='"是,否"', allow_blank=True)
    ws1.add_data_validation(dv_enabled)
    dv_enabled.add("O2:O500")

    # ================= 2. 填写说明工作表 =================
    ws2 = wb.create_sheet(title="填写说明")
    ws2.views.sheetView[0].showGridLines = True
    instructions = [
        ["字段名称", "必填", "格式规范与说明"],
        ["设备名称*", "是", "网络设备的识别名称，如'机房核心交换机'，支持中文与英文字符"],
        ["IP地址*", "是", "IPv4 地址格式 (如 192.168.1.1)，作为局域网设备的唯一识别地址"],
        ["探测方式*", "是", "可选: ping (ICMP探针)、tcp (指定端口连通性)、arp (局域网MAC探针)"],
        ["端口", "TCP必填", "探测方式为 tcp 时必须填写 1-65535 整数端口；其他协议留空即可"],
        ["设备类型", "否", "server(服务器), router(路由器), switch(交换机), nas(存储), camera(摄像头), printer(打印机), workstation(工控机), other(其他)"],
        ["所属分组", "否", "填写所属网络分组名称。若系统内不存在该分组，导入时将自动创建"],
        ["设备地址", "否", "物理部署位置说明，如'北京市海淀区中关村南大街1号'"],
        ["纬度", "坐标必填", "浮点数，范围 -90.0 至 90.0。若填写纬度则经度必须同时填写"],
        ["经度", "坐标必填", "浮点数，范围 -180.0 至 180.0。若填写经度则纬度必须同时填写"],
        ["坐标系", "否", "可选: WGS-84(默认，GPS/OSM标准) 或 GCJ-02(火星坐标)。系统会自动无损转换存储为 WGS-84"],
        ["定位方式", "否", "可选: import_coordinates(导入经纬度), import_address(仅地址待定位), none(暂不定位)"],
        ["探测超时秒", "否", "单次探针超时时间，推荐 1 - 10 秒，默认 3"],
        ["探测间隔秒", "否", "探针轮询执行周期，默认 60 秒"],
        ["连续重试次数", "否", "连续探测失败达到此阈值后正式确认离线，默认 3 次"],
        ["是否启用", "否", "填'是'或'否'，默认'是'。未启用设备不执行周期探测"],
        ["备注", "否", "设备补充备忘信息"]
    ]

    for r_idx, r_data in enumerate(instructions, 1):
        ws2.append(r_data)
        for c_idx in range(1, 4):
            c = ws2.cell(row=r_idx, column=c_idx)
            c.border = thin_border
            if r_idx == 1:
                c.fill = header_fill
                c.font = header_font
                c.alignment = center_align
            else:
                c.font = normal_font
                c.alignment = center_align if c_idx in (1, 2) else left_align

    ws2.column_dimensions['A'].width = 18
    ws2.column_dimensions['B'].width = 10
    ws2.column_dimensions['C'].width = 75

    # ================= 3. 数据字典工作表 =================
    ws3 = wb.create_sheet(title="数据字典")
    ws3.views.sheetView[0].showGridLines = True
    dict_data = [
        ["分类", "代码值", "中文名称", "业务说明"],
        ["探测方式", "ping", "ICMP Ping", "标准低时延网络连通性探测，跨平台支持"],
        ["探测方式", "tcp", "TCP 端口", "适用于 NAS、Web服务、远程桌面等开放端口的目标"],
        ["探测方式", "arp", "ARP 邻居探测", "同子网二层 MAC 地址解析，毫秒级快速检测"],
        ["设备类型", "server", "服务器", "计算节点、虚拟机宿主机、云主机"],
        ["设备类型", "router", "路由器", "网关出口、核心软路由、边界设备"],
        ["设备类型", "switch", "交换机", "汇聚交换机、接入交换机、PoE供电设备"],
        ["设备类型", "nas", "网络存储", "群晖、威联通、TrueNAS、文件存储"],
        ["设备类型", "camera", "监控摄像机", "安防网络摄像头、NVR网络硬盘录像机"],
        ["设备类型", "printer", "网络打印机", "局域网网络打印机/一体机"],
        ["设备类型", "workstation", "工作站/工控机", "运维PC、工控终端、边缘盒子"],
        ["设备类型", "other", "其他设备", "物联网传感器、智能插座等未分类资产"],
        ["坐标系", "WGS-84", "地球坐标系", "国际标准 GPS 与 OpenStreetMap 瓦片坐标系"],
        ["坐标系", "GCJ-02", "火星坐标系", "高德、腾讯等国内地图数据坐标系"],
        ["定位方式", "import_coordinates", "导入坐标", "直接使用 Excel 提供的有效经纬度"],
        ["定位方式", "import_address", "导入地址待定位", "已提供地址，后续在 Web 端点选确认"],
        ["定位方式", "none", "暂不定位", "纯网络拓扑设备，不在地图上生成标记"]
    ]

    for r_idx, r_data in enumerate(dict_data, 1):
        ws3.append(r_data)
        for c_idx in range(1, 5):
            c = ws3.cell(row=r_idx, column=c_idx)
            c.border = thin_border
            if r_idx == 1:
                c.fill = header_fill
                c.font = header_font
                c.alignment = center_align
            else:
                c.font = normal_font
                c.alignment = center_align if c_idx <= 3 else left_align

    ws3.column_dimensions['A'].width = 16
    ws3.column_dimensions['B'].width = 22
    ws3.column_dimensions['C'].width = 20
    ws3.column_dimensions['D'].width = 50

    wb.save(TEMPLATE_PATH)
    logger.info(f"标准 Excel 设备导入模板已生成: {TEMPLATE_PATH}")
    return TEMPLATE_PATH

def precheck_excel_file(file_bytes: bytes) -> Dict[str, Any]:
    """
    Excel 上传预检：
    严格验证表头、必填字段、IP 格式、经纬度规范与范围、端口要求，
    不向数据库写入任何数据，返回行级错误报告与预览行。
    """
    try:
        wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    except Exception as e:
        return {
            "success": False,
            "error": f"无法读取 Excel 文件，请确认是否为标准的 .xlsx 格式: {str(e)}"
        }

    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows or len(rows) < 1:
        return {"success": False, "error": "工作表为空，没有表头和数据"}

    header_row = [str(c).strip() if c is not None else "" for c in rows[0]]
    expected_fields = ["设备名称", "IP地址", "探测方式"]
    for ef in expected_fields:
        if not any(ef in h for h in header_row):
            return {"success": False, "error": f"缺少必须的列标题: '{ef}'"}

    # 构建列索引映射
    def find_col(*keywords):
        for idx, h in enumerate(header_row):
            for kw in keywords:
                if kw in h:
                    return idx
        return None

    col_name = find_col("设备名称")
    col_ip = find_col("IP地址", "IP")
    col_method = find_col("探测方式")
    col_port = find_col("端口")
    col_type = find_col("设备类型")
    col_group = find_col("分组")
    col_addr = find_col("设备地址", "物理地址")
    col_lat = find_col("纬度")
    col_lon = find_col("经度")
    col_crs = find_col("坐标系")
    col_loc_m = find_col("定位方式")
    col_note = find_col("备注")

    db = SessionLocal()
    try:
        existing_ips = {d.ip_address for d in db.query(Device.ip_address).all()}
    finally:
        db.close()

    errors = []
    preview_items = []
    seen_ips_in_file = {}

    for row_idx, r in enumerate(rows[1:], start=2):
        # 忽略全空行
        if not any(r):
            continue

        raw_name = str(r[col_name]).strip() if col_name is not None and r[col_name] is not None else ""
        # 忽略带 [示例] 标记的示范行
        if raw_name.startswith("[示例]") or "示例" in raw_name:
            continue

        raw_ip = str(r[col_ip]).strip() if col_ip is not None and r[col_ip] is not None else ""
        raw_method = str(r[col_method]).strip().lower() if col_method is not None and r[col_method] is not None else "ping"
        raw_port = r[col_port] if col_port is not None else None
        raw_type = str(r[col_type]).strip().lower() if col_type is not None and r[col_type] is not None else "server"
        raw_group = str(r[col_group]).strip() if col_group is not None and r[col_group] is not None else ""
        raw_address = str(r[col_addr]).strip() if col_addr is not None and r[col_addr] is not None else ""
        raw_lat = r[col_lat] if col_lat is not None else None
        raw_lon = r[col_lon] if col_lon is not None else None
        raw_crs = str(r[col_crs]).strip().upper() if col_crs is not None and r[col_crs] is not None else "WGS-84"
        raw_loc_m = str(r[col_loc_m]).strip().lower() if col_loc_m is not None and r[col_loc_m] is not None else "none"
        raw_note = str(r[col_note]).strip() if col_note is not None and r[col_note] is not None else ""

        row_errors = []

        # 1. 必填字段校验
        if not raw_name:
            row_errors.append({"field": "设备名称", "reason": "设备名称不能为空"})
        if not raw_ip:
            row_errors.append({"field": "IP地址", "reason": "IP地址不能为空"})
        elif not IPV4_PATTERN.match(raw_ip):
            row_errors.append({"field": "IP地址", "reason": f"IP地址格式不合法: {raw_ip}"})
        else:
            if raw_ip in seen_ips_in_file:
                row_errors.append({"field": "IP地址", "reason": f"Excel 文件内与第 {seen_ips_in_file[raw_ip]} 行 IP 重复: {raw_ip}"})
            else:
                seen_ips_in_file[raw_ip] = row_idx

        # 2. 探测协议校验
        if raw_method not in ("ping", "tcp", "arp"):
            row_errors.append({"field": "探测方式", "reason": f"不支持的探测协议: '{raw_method}'，必须为 ping/tcp/arp"})

        # 3. TCP 端口校验
        parsed_port = None
        if raw_method == "tcp":
            try:
                parsed_port = int(float(str(raw_port).strip()))
                if parsed_port < 1 or parsed_port > 65535:
                    row_errors.append({"field": "端口", "reason": f"TCP 端口必须在 1-65535 之间: {parsed_port}"})
            except Exception:
                row_errors.append({"field": "端口", "reason": f"TCP 探测必须提供有效的数字端口: {raw_port}"})

        # 4. 经纬度与坐标系校验
        parsed_lat = None
        parsed_lon = None
        if raw_lat is not None and str(raw_lat).strip() != "":
            try:
                parsed_lat = float(str(raw_lat).strip())
            except ValueError:
                row_errors.append({"field": "纬度", "reason": f"纬度格式错误无法转为数值: {raw_lat}"})

        if raw_lon is not None and str(raw_lon).strip() != "":
            try:
                parsed_lon = float(str(raw_lon).strip())
            except ValueError:
                row_errors.append({"field": "经度", "reason": f"经度格式错误无法转为数值: {raw_lon}"})

        valid_geo, geo_msg = validate_coordinates(parsed_lat, parsed_lon)
        if not valid_geo:
            row_errors.append({"field": "经纬度", "reason": geo_msg})

        if raw_crs not in ("WGS-84", "GCJ-02"):
            row_errors.append({"field": "坐标系", "reason": f"不支持的坐标系: '{raw_crs}'，仅支持 WGS-84 或 GCJ-02"})

        if row_errors:
            for re_item in row_errors:
                errors.append({
                    "row": row_idx,
                    "field": re_item["field"],
                    "value": str(r[header_row.index(next(h for h in header_row if re_item["field"] in h))]) if any(re_item["field"] in h for h in header_row) else "",
                    "reason": re_item["reason"]
                })
        else:
            preview_items.append({
                "row": row_idx,
                "name": raw_name,
                "ip_address": raw_ip,
                "method": raw_method,
                "port": parsed_port,
                "device_type": raw_type,
                "group_name": raw_group or "默认分组",
                "location_address": raw_address,
                "latitude": parsed_lat,
                "longitude": parsed_lon,
                "crs": raw_crs,
                "location_method": "import_coordinates" if (parsed_lat is not None and parsed_lon is not None) else ("import_address" if raw_address else "none"),
                "is_existing": raw_ip in existing_ips,
                "note": raw_note
            })

    total_valid = len(preview_items)
    total_errors = len({e["row"] for e in errors})

    return {
        "success": True,
        "total_rows": total_valid + total_errors,
        "valid_count": total_valid,
        "error_count": total_errors,
        "errors": errors,
        "preview": preview_items[:50]
    }

def execute_excel_import(
    file_bytes: bytes,
    import_mode: str = "upsert", # insert_only, upsert, skip_existing
    allow_clear_location: bool = False
) -> Dict[str, Any]:
    """
    正式执行 Excel 导入：
    - insert_only: 仅新增，遇到既有 IP 报错终止
    - upsert: 既有 IP 覆盖更新
    - skip_existing: 既有 IP 直接跳过
    保护规则：空白坐标默认绝不覆盖已有坐标，除非明确指定 allow_clear_location
    """
    precheck = precheck_excel_file(file_bytes)
    if not precheck.get("success"):
        return precheck

    if precheck["error_count"] > 0:
        return {
            "success": False,
            "error": f"预检发现 {precheck['error_count']} 处行级错误，请修正后重试",
            "errors": precheck["errors"]
        }

    db = SessionLocal()
    inserted = 0
    updated = 0
    skipped = 0

    try:
        # 分组缓存与自动创建
        group_cache = {g.name: g.id for g in db.query(DeviceGroup).all()}
        
        default_group = db.query(DeviceGroup).filter(DeviceGroup.name == "默认分组").first()
        if not default_group:
            default_group = DeviceGroup(name="默认分组", description="系统默认分组", color="#3B82F6")
            db.add(default_group)
            db.commit()
            db.refresh(default_group)
        group_cache["默认分组"] = default_group.id

        for item in precheck["preview"]:
            ip = item["ip_address"]
            grp_name = item["group_name"]
            
            # 保证分组存在
            if grp_name not in group_cache:
                new_grp = DeviceGroup(name=grp_name, color="#3B82F6")
                db.add(new_grp)
                db.commit()
                db.refresh(new_grp)
                group_cache[grp_name] = new_grp.id
            group_id = group_cache[grp_name]

            # 坐标系转换：如果输入是 GCJ-02，统一无损转换为 WGS-84 存储
            lat = item["latitude"]
            lon = item["longitude"]
            if lat is not None and lon is not None and item.get("crs") == "GCJ-02":
                lat, lon = gcj02_to_wgs84(lat, lon)

            existing_dev = db.query(Device).filter(Device.ip_address == ip).first()

            if existing_dev:
                if import_mode == "insert_only":
                    raise ValueError(f"已存在 IP 为 {ip} 的设备，冲突阻断！")
                elif import_mode == "skip_existing":
                    skipped += 1
                    continue
                else: # upsert 模式
                    existing_dev.name = item["name"]
                    existing_dev.device_type = item["device_type"]
                    existing_dev.group_id = group_id
                    existing_dev.method = item["method"]
                    existing_dev.port = item["port"]
                    existing_dev.note = item["note"]

                    # 坐标更新安全保护 (空白坐标不覆盖已有坐标)
                    if lat is not None and lon is not None:
                        existing_dev.latitude = lat
                        existing_dev.longitude = lon
                        existing_dev.location_status = "located"
                        existing_dev.location_method = "import_coordinates"
                        if item["location_address"]:
                            existing_dev.location_address = item["location_address"]
                    elif allow_clear_location:
                        existing_dev.latitude = None
                        existing_dev.longitude = None
                        existing_dev.location_status = "unlocated"
                        existing_dev.location_method = "none"
                    else:
                        # 仅在已有地址为空时补充填入新地址，保留已有坐标
                        if item["location_address"] and not existing_dev.location_address:
                            existing_dev.location_address = item["location_address"]

                    updated += 1
            else:
                # 新增设备
                is_located = (lat is not None and lon is not None)
                loc_status = "located" if is_located else "unlocated"
                loc_method = "import_coordinates" if is_located else ("import_address" if item["location_address"] else "none")

                dev = Device(
                    name=item["name"],
                    ip_address=ip,
                    device_type=item["device_type"],
                    group_id=group_id,
                    method=item["method"],
                    port=item["port"],
                    note=item["note"],
                    status="UNKNOWN",
                    failure_count=0,
                    enabled=True,
                    latitude=lat,
                    longitude=lon,
                    location_address=item["location_address"],
                    location_status=loc_status,
                    location_method=loc_method
                )
                db.add(dev)
                inserted += 1

        db.commit()

        unlocated_cnt = db.query(Device).filter(
            (Device.latitude.is_(None)) | (Device.longitude.is_(None)) | (Device.location_status == "unlocated")
        ).count()

        return {
            "success": True,
            "total_rows": len(precheck["preview"]),
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped,
            "unlocated_count": unlocated_cnt,
            "message": f"导入完成！新增 {inserted} 台，更新 {updated} 台，跳过 {skipped} 台。"
        }

    except Exception as e:
        db.rollback()
        logger.error(f"执行 Excel 导入异常: {e}", exc_info=True)
        return {"success": False, "error": f"导入失败已安全回滚: {str(e)}"}
    finally:
        db.close()

def export_devices_to_excel(devices: List[Device]) -> bytes:
    """将设备数据导出为标准 Excel 文件 (严格防范公式注入)"""
    wb = Workbook()
    ws = wb.active
    ws.title = "设备资产台账"

    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    header_font = Font(name="Microsoft YaHei", size=10, bold=True, color="FFFFFF")
    normal_font = Font(name="Microsoft YaHei", size=10)

    headers = [
        "设备ID", "设备名称", "IP地址", "状态", "设备类型", 
        "所属分组", "探测方式", "端口", "超时秒", "轮询间隔秒", 
        "重试阈值", "启用状态", "定位状态", "定位方式", "纬度(WGS-84)", 
        "经度(WGS-84)", "设备地址", "最近探测时间", "离线发生时间", "备注"
    ]
    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center')

    for d in devices:
        ws.append([
            d.id,
            sanitize_formula_injection(d.name),
            d.ip_address,
            d.status,
            d.device_type,
            d.group.name if d.group else "未分组",
            d.method,
            d.port or "",
            d.timeout_seconds,
            d.interval_seconds,
            d.retry_count,
            "是" if d.enabled else "否",
            d.location_status,
            d.location_method,
            d.latitude or "",
            d.longitude or "",
            sanitize_formula_injection(d.location_address or ""),
            d.last_probe_time.strftime("%Y-%m-%d %H:%M:%S") if d.last_probe_time else "",
            d.offline_since.strftime("%Y-%m-%d %H:%M:%S") if d.offline_since else "",
            sanitize_formula_injection(d.note or "")
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
