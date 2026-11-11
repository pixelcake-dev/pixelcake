"""
Projects API Router
Endpoints for managing network topology projects
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime

from app.database import get_db
from app.models import Project, Canvas, User
from app.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectList,
    CanvasBasic,
)

router = APIRouter()

# Hardcoded user ID for now (no authentication)
HARDCODED_USER_ID = "00000000-0000-0000-0000-000000000001"


async def ensure_default_user(db: AsyncSession) -> str:
    """
    Ensure the default hardcoded user exists in database
    Returns user ID
    """
    result = await db.execute(select(User).where(User.id == HARDCODED_USER_ID))
    user = result.scalar_one_or_none()

    if not user:
        # Create default user
        user = User(
            id=HARDCODED_USER_ID,
            email="default@pixelcake.local",
            username="Default User",
            hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYVNNcXXE3e"  # dummy hash
        )
        db.add(user)
        await db.commit()

    return HARDCODED_USER_ID


@router.get("/projects", response_model=List[ProjectList])
async def list_projects(db: AsyncSession = Depends(get_db)):
    """
    Get all projects for the current user
    Returns list of projects with canvas count
    """
    user_id = await ensure_default_user(db)

    # Get projects with canvas count
    result = await db.execute(
        select(
            Project,
            func.count(Canvas.id).label("canvases_count")
        )
        .outerjoin(Canvas, Canvas.project_id == Project.id)
        .where(Project.user_id == user_id)
        .group_by(Project.id)
        .order_by(Project.last_accessed.desc())
    )

    projects_data = result.all()

    return [
        ProjectList(
            id=project.id,
            name=project.name,
            description=project.description,
            version=project.version,
            canvases_count=canvases_count,
            created_at=project.created_at,
            updated_at=project.updated_at,
            last_accessed=project.last_accessed,
        )
        for project, canvases_count in projects_data
    ]


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new project with a default canvas
    """
    user_id = await ensure_default_user(db)

    # Create project
    new_project = Project(
        user_id=user_id,
        name=project_data.name,
        description=project_data.description,
        global_settings=project_data.global_settings or {
            "ipClass": "192.168.1.0",
            "subnet": "255.255.255.0",
            "gateway": "192.168.1.1"
        }
    )
    db.add(new_project)
    await db.flush()  # Get project ID

    # Create default canvas
    default_canvas = Canvas(
        project_id=new_project.id,
        name="Main Canvas",
        order=0,
        settings={
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "deviceCounter": 0,
            "connectionCounter": 0
        },
        devices=[],
        connections=[]
    )
    db.add(default_canvas)
    await db.commit()
    await db.refresh(new_project)

    # Load canvases relationship
    result = await db.execute(
        select(Canvas).where(Canvas.project_id == new_project.id).order_by(Canvas.order)
    )
    canvases = result.scalars().all()

    # Build response
    return ProjectResponse(
        id=new_project.id,
        user_id=new_project.user_id,
        name=new_project.name,
        description=new_project.description,
        version=new_project.version,
        is_public=new_project.is_public,
        global_settings=new_project.global_settings,
        canvases=[
            CanvasBasic(
                id=canvas.id,
                name=canvas.name,
                order=canvas.order,
                is_locked=canvas.is_locked,
                devices_count=len(canvas.devices),
                connections_count=len(canvas.connections),
                created_at=canvas.created_at,
                updated_at=canvas.updated_at,
            )
            for canvas in canvases
        ],
        created_at=new_project.created_at,
        updated_at=new_project.updated_at,
        last_accessed=new_project.last_accessed,
    )


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get a single project by ID with all canvases
    """
    user_id = await ensure_default_user(db)

    # Get project
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Update last_accessed
    project.last_accessed = datetime.now()
    await db.commit()
    await db.refresh(project)

    # Load canvases
    result = await db.execute(
        select(Canvas).where(Canvas.project_id == project_id).order_by(Canvas.order)
    )
    canvases = result.scalars().all()

    # Build response
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        version=project.version,
        is_public=project.is_public,
        global_settings=project.global_settings,
        canvases=[
            CanvasBasic(
                id=canvas.id,
                name=canvas.name,
                order=canvas.order,
                is_locked=canvas.is_locked,
                devices_count=len(canvas.devices),
                connections_count=len(canvas.connections),
                created_at=canvas.created_at,
                updated_at=canvas.updated_at,
            )
            for canvas in canvases
        ],
        created_at=project.created_at,
        updated_at=project.updated_at,
        last_accessed=project.last_accessed,
    )


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update project metadata (name, description, settings)
    """
    user_id = await ensure_default_user(db)

    # Get project
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Update fields
    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description
    if project_data.global_settings is not None:
        project.global_settings = project_data.global_settings
    if project_data.is_public is not None:
        project.is_public = project_data.is_public

    await db.commit()
    await db.refresh(project)

    # Load canvases
    result = await db.execute(
        select(Canvas).where(Canvas.project_id == project_id).order_by(Canvas.order)
    )
    canvases = result.scalars().all()

    # Build response
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        version=project.version,
        is_public=project.is_public,
        global_settings=project.global_settings,
        canvases=[
            CanvasBasic(
                id=canvas.id,
                name=canvas.name,
                order=canvas.order,
                is_locked=canvas.is_locked,
                devices_count=len(canvas.devices),
                connections_count=len(canvas.connections),
                created_at=canvas.created_at,
                updated_at=canvas.updated_at,
            )
            for canvas in canvases
        ],
        created_at=project.created_at,
        updated_at=project.updated_at,
        last_accessed=project.last_accessed,
    )


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """
    Delete a project (cascade deletes all canvases)
    """
    user_id = await ensure_default_user(db)

    # Get project
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Delete project (cascade will delete canvases)
    await db.delete(project)
    await db.commit()

    return None
