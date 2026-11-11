"""
Template Schemas
Pydantic schemas for Device and Connection templates
"""

from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field, validator


# ============================================================================
# Device Template Schemas
# ============================================================================

class DeviceTemplateData(BaseModel):
    """Device template data structure (maps to frontend DeviceTemplate interface)"""

    id: str = Field(..., description="Unique template ID (e.g., 'tpl-pc', 'tpl-switch')")
    name: str = Field(..., min_length=1, max_length=50, description="Template name (e.g., 'PC', 'Switch')")
    type: str = Field(..., min_length=1, max_length=50, description="Device type identifier")
    icon: str = Field(..., description="Iconify icon name (e.g., 'solar:monitor-bold-duotone')")
    color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$", description="Hex color code (e.g., '#5B7C8D')")
    terraformFields: Optional[Dict[str, Any]] = Field(None, description="Terraform custom fields")
    isCustom: bool = Field(..., description="True if user-created, False if global template")
    supportsVLAN: bool = Field(..., description="Device supports VLAN configuration")
    supportsSTP: bool = Field(..., description="Device supports STP configuration")
    supportsPorts: bool = Field(..., description="Device supports port management")
    supportsNICs: bool = Field(..., description="Device supports Network Interface Cards")
    portOptions: Optional[List[int]] = Field(None, description="Available port counts (e.g., [5, 8, 16, 24, 48])")
    defaultPortCount: Optional[int] = Field(None, description="Default port count (e.g., 24)")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "tpl-switch",
                "name": "Switch",
                "type": "Switch",
                "icon": "carbon:network-4",
                "color": "#5B7C8D",
                "isCustom": False,
                "supportsVLAN": True,
                "supportsSTP": True,
                "supportsPorts": True,
                "supportsNICs": False,
                "portOptions": [5, 8, 16, 24, 48],
                "defaultPortCount": 24
            }
        }


class DeviceTemplateCreate(BaseModel):
    """Schema for creating a new device template"""

    template: DeviceTemplateData = Field(..., description="Device template data")

    @validator('template')
    def validate_custom_template(cls, v):
        """Ensure only custom templates can be created via API"""
        if not v.isCustom:
            raise ValueError("Only custom templates (isCustom=true) can be created via API")
        return v


class DeviceTemplateUpdate(BaseModel):
    """Schema for updating an existing device template"""

    template: DeviceTemplateData = Field(..., description="Updated device template data")

    @validator('template')
    def validate_custom_template(cls, v):
        """Ensure only custom templates can be updated via API"""
        if not v.isCustom:
            raise ValueError("Only custom templates (isCustom=true) can be updated via API")
        return v


class DeviceTemplateResponse(BaseModel):
    """Schema for device template response"""

    id: str = Field(..., description="Database record ID (UUID)")
    user_id: Optional[str] = Field(None, description="User ID (null for global templates)")
    is_custom: bool = Field(..., description="True if user-created, False if global")
    template: DeviceTemplateData = Field(..., description="Device template data")
    created_at: str = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True


# ============================================================================
# Connection Template Schemas
# ============================================================================

class ConnectionTemplateData(BaseModel):
    """Connection template data structure (maps to frontend ConnectionTemplate interface)"""

    id: str = Field(..., description="Unique template ID (e.g., 'conn-access', 'conn-trunk')")
    name: str = Field(..., min_length=1, max_length=50, description="Template name (e.g., 'Access', 'Trunk')")
    type: str = Field(..., min_length=1, max_length=50, description="Connection type identifier (e.g., 'access', 'trunk')")
    description: Optional[str] = Field(None, max_length=200, description="Italian description for UI")
    color: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$", description="Hex color code (e.g., '#3b82f6')")
    lineStyle: str = Field(..., pattern="^(solid|dashed|dotted)$", description="Visual line style")
    strokeWidth: float = Field(..., ge=0.5, le=10, description="Base stroke width (0.5-10)")
    strokeWidthHighlighted: Optional[float] = Field(None, ge=0.5, le=15, description="Width when highlighted")
    strokeDasharray: Optional[str] = Field(None, description="SVG dash pattern (e.g., '8 4', '1 5')")
    isCustom: bool = Field(..., description="True if user-created, False if global template")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "conn-trunk",
                "name": "Trunk",
                "type": "trunk",
                "description": "Link trunk tra switch",
                "color": "#9333ea",
                "lineStyle": "solid",
                "strokeWidth": 3.5,
                "strokeWidthHighlighted": 5,
                "isCustom": False
            }
        }


class ConnectionTemplateCreate(BaseModel):
    """Schema for creating a new connection template"""

    template: ConnectionTemplateData = Field(..., description="Connection template data")

    @validator('template')
    def validate_custom_template(cls, v):
        """Ensure only custom templates can be created via API"""
        if not v.isCustom:
            raise ValueError("Only custom templates (isCustom=true) can be created via API")
        return v


class ConnectionTemplateUpdate(BaseModel):
    """Schema for updating an existing connection template"""

    template: ConnectionTemplateData = Field(..., description="Updated connection template data")

    @validator('template')
    def validate_custom_template(cls, v):
        """Ensure only custom templates can be updated via API"""
        if not v.isCustom:
            raise ValueError("Only custom templates (isCustom=true) can be updated via API")
        return v


class ConnectionTemplateResponse(BaseModel):
    """Schema for connection template response"""

    id: str = Field(..., description="Database record ID (UUID)")
    user_id: Optional[str] = Field(None, description="User ID (null for global templates)")
    is_custom: bool = Field(..., description="True if user-created, False if global")
    template: ConnectionTemplateData = Field(..., description="Connection template data")
    created_at: str = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True


# ============================================================================
# Bulk Sync Schema
# ============================================================================

class TemplateSyncRequest(BaseModel):
    """Schema for syncing all templates (used for migration from LocalStorage)"""

    deviceTemplates: List[DeviceTemplateData] = Field([], description="Device templates to sync")
    connectionTemplates: List[ConnectionTemplateData] = Field([], description="Connection templates to sync")

    class Config:
        json_schema_extra = {
            "example": {
                "deviceTemplates": [
                    {
                        "id": "tpl-custom-1",
                        "name": "Custom Server",
                        "type": "CustomServer",
                        "icon": "mdi:server-plus",
                        "color": "#FF5733",
                        "isCustom": True,
                        "supportsVLAN": False,
                        "supportsSTP": False,
                        "supportsPorts": False,
                        "supportsNICs": True
                    }
                ],
                "connectionTemplates": [
                    {
                        "id": "conn-custom-1",
                        "name": "Custom Link",
                        "type": "custom-link",
                        "description": "Custom connection type",
                        "color": "#33FF57",
                        "lineStyle": "dashed",
                        "strokeWidth": 2.5,
                        "isCustom": True
                    }
                ]
            }
        }


class TemplateSyncResponse(BaseModel):
    """Schema for sync response"""

    deviceTemplates: List[DeviceTemplateResponse] = Field(..., description="Synced device templates")
    connectionTemplates: List[ConnectionTemplateResponse] = Field(..., description="Synced connection templates")
    message: str = Field(..., description="Success message")
