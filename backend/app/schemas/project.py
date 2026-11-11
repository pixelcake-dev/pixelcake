"""
Project Pydantic Schemas
Input/Output validation for Project API endpoints
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class ProjectCreate(BaseModel):
    """Schema for creating a new project"""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, max_length=500, description="Project description")
    global_settings: Optional[dict] = Field(
        default={
            "ipClass": "192.168.1.0",
            "subnet": "255.255.255.0",
            "gateway": "192.168.1.1"
        },
        description="Global network settings for the project"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Infrastructure Project ABC",
                "description": "Enterprise network topology for headquarters",
                "global_settings": {
                    "ipClass": "192.168.1.0",
                    "subnet": "255.255.255.0",
                    "gateway": "192.168.1.1"
                }
            }
        }


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    global_settings: Optional[dict] = None
    is_public: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Project Name",
                "description": "Updated description"
            }
        }


class CanvasBasic(BaseModel):
    """Basic canvas info for project response"""

    id: str
    name: str
    order: int
    is_locked: bool
    devices_count: int = Field(description="Number of devices in canvas")
    connections_count: int = Field(description="Number of connections in canvas")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    """Schema for project response with canvases"""

    id: str
    user_id: str
    name: str
    description: Optional[str]
    version: str
    is_public: bool
    global_settings: dict
    canvases: List[CanvasBasic] = []
    created_at: datetime
    updated_at: datetime
    last_accessed: datetime

    class Config:
        from_attributes = True


class ProjectList(BaseModel):
    """Schema for project list item (without canvases details)"""

    id: str
    name: str
    description: Optional[str]
    version: str
    canvases_count: int = Field(description="Number of canvases in project")
    created_at: datetime
    updated_at: datetime
    last_accessed: datetime

    class Config:
        from_attributes = True
