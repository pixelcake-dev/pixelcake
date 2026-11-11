"""
Canvas Pydantic Schemas
Input/Output validation for Canvas API endpoints
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class CanvasCreate(BaseModel):
    """Schema for creating a new canvas"""

    name: str = Field(..., min_length=1, max_length=255, description="Canvas name")
    order: Optional[int] = Field(default=0, description="Display order in project")
    is_locked: Optional[bool] = Field(default=False, description="Lock editing")
    settings: Optional[dict] = Field(
        default={
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "deviceCounter": 0,
            "connectionCounter": 0
        },
        description="Canvas settings (viewport, counters)"
    )
    devices: Optional[List[dict]] = Field(default=[], description="Network devices")
    connections: Optional[List[dict]] = Field(default=[], description="Network connections")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Building A - Ground Floor",
                "order": 1,
                "settings": {
                    "viewport": {"x": 0, "y": 0, "zoom": 1},
                    "deviceCounter": 5,
                    "connectionCounter": 3
                },
                "devices": [
                    {
                        "id": "device-1",
                        "type": "router",
                        "label": "Main Router",
                        "ip": "192.168.1.1",
                        "position": {"x": 100, "y": 100}
                    }
                ],
                "connections": [
                    {
                        "id": "conn-1",
                        "source": "device-1",
                        "target": "device-2"
                    }
                ]
            }
        }


class CanvasUpdate(BaseModel):
    """Schema for updating an existing canvas"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    order: Optional[int] = None
    is_locked: Optional[bool] = None
    settings: Optional[dict] = None
    devices: Optional[List[dict]] = None
    connections: Optional[List[dict]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Canvas Name",
                "devices": [
                    {
                        "id": "device-1",
                        "type": "switch",
                        "label": "Core Switch",
                        "ip": "192.168.1.10"
                    }
                ]
            }
        }


class CanvasResponse(BaseModel):
    """Schema for canvas response with full data"""

    id: str
    project_id: str
    name: str
    order: int
    is_locked: bool
    settings: dict
    devices: List[dict]
    connections: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CanvasList(BaseModel):
    """Schema for canvas list item (without devices/connections)"""

    id: str
    project_id: str
    name: str
    order: int
    is_locked: bool
    devices_count: int = Field(description="Number of devices")
    connections_count: int = Field(description="Number of connections")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
