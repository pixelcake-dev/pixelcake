"""
Canvases API Router
Endpoints for managing canvases within projects
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Project, Canvas
from app.schemas import (
    CanvasCreate,
    CanvasUpdate,
    CanvasResponse,
    CanvasList,
)

router = APIRouter()

# Hardcoded user ID (same as projects router)
HARDCODED_USER_ID = "00000000-0000-0000-0000-000000000001"


async def verify_project_access(project_id: str, db: AsyncSession) -> Project:
    """
    Verify user has access to project
    Returns project if found, raises HTTPException otherwise
    """
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == HARDCODED_USER_ID
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    return project


@router.get("/projects/{project_id}/canvases", response_model=List[CanvasList])
async def list_canvases(project_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get all canvases for a project
    Returns list without full devices/connections data
    """
    # Verify access
    await verify_project_access(project_id, db)

    # Get canvases
    result = await db.execute(
        select(Canvas)
        .where(Canvas.project_id == project_id)
        .order_by(Canvas.order)
    )
    canvases = result.scalars().all()

    return [
        CanvasList(
            id=canvas.id,
            project_id=canvas.project_id,
            name=canvas.name,
            order=canvas.order,
            is_locked=canvas.is_locked,
            devices_count=len(canvas.devices),
            connections_count=len(canvas.connections),
            created_at=canvas.created_at,
            updated_at=canvas.updated_at,
        )
        for canvas in canvases
    ]


@router.post("/projects/{project_id}/canvases", response_model=CanvasResponse, status_code=status.HTTP_201_CREATED)
async def create_canvas(
    project_id: str,
    canvas_data: CanvasCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new canvas in the project
    """
    # Verify access
    await verify_project_access(project_id, db)

    # Create canvas
    new_canvas = Canvas(
        project_id=project_id,
        name=canvas_data.name,
        order=canvas_data.order,
        is_locked=canvas_data.is_locked,
        settings=canvas_data.settings or {
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "deviceCounter": 0,
            "connectionCounter": 0
        },
        devices=canvas_data.devices or [],
        connections=canvas_data.connections or []
    )

    db.add(new_canvas)
    await db.commit()
    await db.refresh(new_canvas)

    return CanvasResponse(
        id=new_canvas.id,
        project_id=new_canvas.project_id,
        name=new_canvas.name,
        order=new_canvas.order,
        is_locked=new_canvas.is_locked,
        settings=new_canvas.settings,
        devices=new_canvas.devices,
        connections=new_canvas.connections,
        created_at=new_canvas.created_at,
        updated_at=new_canvas.updated_at,
    )


@router.get("/projects/{project_id}/canvases/{canvas_id}", response_model=CanvasResponse)
async def get_canvas(
    project_id: str,
    canvas_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single canvas by ID with full data (devices, connections)
    """
    # Verify access
    await verify_project_access(project_id, db)

    # Get canvas
    result = await db.execute(
        select(Canvas).where(
            Canvas.id == canvas_id,
            Canvas.project_id == project_id
        )
    )
    canvas = result.scalar_one_or_none()

    if not canvas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Canvas {canvas_id} not found in project {project_id}"
        )

    return CanvasResponse(
        id=canvas.id,
        project_id=canvas.project_id,
        name=canvas.name,
        order=canvas.order,
        is_locked=canvas.is_locked,
        settings=canvas.settings,
        devices=canvas.devices,
        connections=canvas.connections,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.put("/projects/{project_id}/canvases/{canvas_id}", response_model=CanvasResponse)
async def update_canvas(
    project_id: str,
    canvas_id: str,
    canvas_data: CanvasUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update canvas data (name, devices, connections, settings)
    """
    # Verify access
    await verify_project_access(project_id, db)

    # Get canvas
    result = await db.execute(
        select(Canvas).where(
            Canvas.id == canvas_id,
            Canvas.project_id == project_id
        )
    )
    canvas = result.scalar_one_or_none()

    if not canvas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Canvas {canvas_id} not found in project {project_id}"
        )

    # Check if locked
    if canvas.is_locked and canvas_data.is_locked is not True:
        # Allow unlocking, but block other modifications if locked
        if any([
            canvas_data.name is not None,
            canvas_data.order is not None,
            canvas_data.devices is not None,
            canvas_data.connections is not None,
            canvas_data.settings is not None
        ]):
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Canvas is locked. Unlock it first to make changes."
            )

    # Update fields
    if canvas_data.name is not None:
        canvas.name = canvas_data.name
    if canvas_data.order is not None:
        canvas.order = canvas_data.order
    if canvas_data.is_locked is not None:
        canvas.is_locked = canvas_data.is_locked
    if canvas_data.settings is not None:
        canvas.settings = canvas_data.settings
    if canvas_data.devices is not None:
        canvas.devices = canvas_data.devices
    if canvas_data.connections is not None:
        canvas.connections = canvas_data.connections

    await db.commit()
    await db.refresh(canvas)

    return CanvasResponse(
        id=canvas.id,
        project_id=canvas.project_id,
        name=canvas.name,
        order=canvas.order,
        is_locked=canvas.is_locked,
        settings=canvas.settings,
        devices=canvas.devices,
        connections=canvas.connections,
        created_at=canvas.created_at,
        updated_at=canvas.updated_at,
    )


@router.delete("/projects/{project_id}/canvases/{canvas_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_canvas(
    project_id: str,
    canvas_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a canvas from the project
    """
    # Verify access
    await verify_project_access(project_id, db)

    # Get canvas
    result = await db.execute(
        select(Canvas).where(
            Canvas.id == canvas_id,
            Canvas.project_id == project_id
        )
    )
    canvas = result.scalar_one_or_none()

    if not canvas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Canvas {canvas_id} not found in project {project_id}"
        )

    # Check if it's the last canvas (prevent deleting all canvases)
    result = await db.execute(
        select(Canvas).where(Canvas.project_id == project_id)
    )
    canvas_count = len(result.scalars().all())

    if canvas_count == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last canvas in a project. A project must have at least one canvas."
        )

    # Delete canvas
    await db.delete(canvas)
    await db.commit()

    return None
