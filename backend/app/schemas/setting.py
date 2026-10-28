from typing import Any, Dict
from pydantic import BaseModel

class SystemSettingResponse(BaseModel):
    key: str
    value: Any
    description: str | None = None

class SystemSettingUpdate(BaseModel):
    key: str
    value: Any
