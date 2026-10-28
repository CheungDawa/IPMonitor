from typing import Optional, List
from pydantic import BaseModel

class CandidateLocation(BaseModel):
    name: str
    formatted_address: str
    latitude: float
    longitude: float
    accuracy: Optional[str] = "address"
    provider: Optional[str] = "nominatim"

class GeocodeSearchRequest(BaseModel):
    query: str
    limit: int = 5

class CoordTransformRequest(BaseModel):
    latitude: float
    longitude: float
    from_crs: str = "WGS-84" # WGS-84, GCJ-02
    to_crs: str = "GCJ-02"

class CoordTransformResponse(BaseModel):
    latitude: float
    longitude: float
    from_crs: str
    to_crs: str

class MapDevicePoint(BaseModel):
    id: int
    name: str
    ip_address: str
    device_type: str
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    group_color: Optional[str] = None
    status: str
    latitude: float
    longitude: float
    location_address: Optional[str] = None
    formatted_address: Optional[str] = None
    location_method: str
    location_note: Optional[str] = None
    last_probe_time: Optional[str] = None
