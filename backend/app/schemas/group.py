from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"
    sort_order: int = 0

class GroupCreate(GroupBase):
    pass

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

class GroupResponse(GroupBase):
    id: int
    created_at: datetime
    device_count: int = 0

    model_config = ConfigDict(from_attributes=True)
