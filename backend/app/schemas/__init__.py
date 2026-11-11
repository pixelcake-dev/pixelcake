"""
Pydantic Schemas Package
Exports all API request/response schemas
"""

from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectList,
    CanvasBasic,
)

from app.schemas.canvas import (
    CanvasCreate,
    CanvasUpdate,
    CanvasResponse,
    CanvasList,
)

__all__ = [
    # Project schemas
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ProjectList",
    "CanvasBasic",
    # Canvas schemas
    "CanvasCreate",
    "CanvasUpdate",
    "CanvasResponse",
    "CanvasList",
]
