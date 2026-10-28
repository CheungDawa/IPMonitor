import math
import httpx
from typing import Optional, List, Dict, Any, Tuple
from backend.app.core.config import settings
from backend.app.core.logging import logger

# 坐标系转换常量与数学参数 (WGS-84 <-> GCJ-02 <-> BD-09)
X_PI = math.pi * 3000.0 / 180.0
A = 6378245.0
EE = 0.00669342162296594323

def out_of_china(lat: float, lon: float) -> bool:
    """判断是否在中国境外 (境外无需进行 GCJ-02 偏移)"""
    return not (72.004 <= lon <= 137.8347 and 0.8293 <= lat <= 55.8271)

def transform_lat(x: float, y: float) -> float:
    ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
    return ret

def transform_lon(x: float, y: float) -> float:
    ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
    ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
    ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
    return ret

def wgs84_to_gcj02(lat: float, lon: float) -> Tuple[float, float]:
    """WGS-84 转 GCJ-02 (火星坐标系)"""
    if out_of_china(lat, lon):
        return round(lat, 6), round(lon, 6)
    d_lat = transform_lat(lon - 105.0, lat - 35.0)
    d_lon = transform_lon(lon - 105.0, lat - 35.0)
    rad_lat = lat / 180.0 * math.pi
    magic = math.sin(rad_lat)
    magic = 1 - EE * magic * magic
    sqrt_magic = math.sqrt(magic)
    d_lat = (d_lat * 180.0) / ((A * (1 - EE)) / (magic * sqrt_magic) * math.pi)
    d_lon = (d_lon * 180.0) / (A / sqrt_magic * math.cos(rad_lat) * math.pi)
    mg_lat = lat + d_lat
    mg_lon = lon + d_lon
    return round(mg_lat, 6), round(mg_lon, 6)

def gcj02_to_wgs84(lat: float, lon: float) -> Tuple[float, float]:
    """GCJ-02 转 WGS-84 (反算)"""
    if out_of_china(lat, lon):
        return round(lat, 6), round(lon, 6)
    d_lat = transform_lat(lon - 105.0, lat - 35.0)
    d_lon = transform_lon(lon - 105.0, lat - 35.0)
    rad_lat = lat / 180.0 * math.pi
    magic = math.sin(rad_lat)
    magic = 1 - EE * magic * magic
    sqrt_magic = math.sqrt(magic)
    d_lat = (d_lat * 180.0) / ((A * (1 - EE)) / (magic * sqrt_magic) * math.pi)
    d_lon = (d_lon * 180.0) / (A / sqrt_magic * math.cos(rad_lat) * math.pi)
    mg_lat = lat + d_lat
    mg_lon = lon + d_lon
    return round(lat * 2 - mg_lat, 6), round(lon * 2 - mg_lon, 6)

def validate_coordinates(lat: Optional[float], lon: Optional[float]) -> Tuple[bool, Optional[str]]:
    """严格校验经纬度一致性"""
    if lat is None and lon is None:
        return True, None
    if (lat is None and lon is not None) or (lat is not None and lon is None):
        return False, "经度和纬度必须同时有值或同时为空"
    if lat < -90.0 or lat > 90.0:
        return False, f"纬度超出有效区间 [-90, 90]: {lat}"
    if lon < -180.0 or lon > 180.0:
        return False, f"经度超出有效区间 [-180, 180]: {lon}"
    return True, None

async def search_address_candidates(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    地理编码服务：按用户输入的地址检索候选地理位置列表
    默认使用 Nominatim OpenStreetMap 开放地理编码接口，带超时和异常降级保护
    """
    if not query or not query.strip():
        return []

    url = f"{settings.NOMINATIM_URL}/search"
    params = {
        "q": query.strip(),
        "format": "json",
        "addressdetails": 1,
        "countrycodes": "cn",
        "limit": limit
    }
    headers = {"User-Agent": settings.USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                results = resp.json()
                candidates = []
                for item in results:
                    lat = float(item.get("lat", 0))
                    lon = float(item.get("lon", 0))
                    candidates.append({
                        "name": item.get("name") or item.get("display_name", "").split(",")[0],
                        "formatted_address": item.get("display_name", ""),
                        "latitude": round(lat, 6),
                        "longitude": round(lon, 6),
                        "accuracy": item.get("type", "address"),
                        "provider": "nominatim"
                    })
                return candidates
            logger.warning(f"地理编码服务响应非 200: {resp.status_code}")
            return []
    except Exception as e:
        logger.warning(f"地理编码请求失败 (允许降级为手动选点): {e}")
        return []

async def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """逆地理编码：根据经纬度反查标准化地址"""
    url = f"{settings.NOMINATIM_URL}/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1
    }
    headers = {"User-Agent": settings.USER_AGENT}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                res = resp.json()
                return res.get("display_name")
            return None
    except Exception as e:
        logger.warning(f"逆地理编码失败: {e}")
        return None
