"""
Templates API Router
Endpoints for managing device and connection templates
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models import DeviceTemplate, ConnectionTemplate, User
from app.schemas.template import (
    DeviceTemplateCreate,
    DeviceTemplateUpdate,
    DeviceTemplateResponse,
    ConnectionTemplateCreate,
    ConnectionTemplateUpdate,
    ConnectionTemplateResponse,
    TemplateSyncRequest,
    TemplateSyncResponse,
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


# ============================================================================
# Device Template Endpoints
# ============================================================================

@router.get("/devices", response_model=List[DeviceTemplateResponse])
async def list_device_templates(db: AsyncSession = Depends(get_db)):
    """
    Get all device templates (global + user custom)
    Returns list of device templates ordered by global first, then custom
    """
    user_id = await ensure_default_user(db)

    # Get global templates (user_id IS NULL) + user's custom templates
    result = await db.execute(
        select(DeviceTemplate)
        .where(
            or_(
                DeviceTemplate.user_id.is_(None),  # Global templates
                DeviceTemplate.user_id == user_id   # User's custom templates
            )
        )
        .order_by(DeviceTemplate.is_custom.asc(), DeviceTemplate.created_at.desc())
    )

    templates = result.scalars().all()

    return [
        DeviceTemplateResponse(
            id=t.id,
            user_id=t.user_id,
            is_custom=t.is_custom,
            template=t.template,
            created_at=t.created_at.isoformat() if t.created_at else None
        )
        for t in templates
    ]


@router.post("/devices", response_model=DeviceTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_device_template(
    template_data: DeviceTemplateCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new custom device template
    Only custom templates (isCustom=true) can be created via API
    """
    user_id = await ensure_default_user(db)

    # Create new template
    new_template = DeviceTemplate(
        user_id=user_id,
        is_custom=True,  # Always true for user-created templates
        template=template_data.template.dict()
    )

    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)

    return DeviceTemplateResponse(
        id=new_template.id,
        user_id=new_template.user_id,
        is_custom=new_template.is_custom,
        template=new_template.template,
        created_at=new_template.created_at.isoformat() if new_template.created_at else None
    )


@router.put("/devices/{template_id}", response_model=DeviceTemplateResponse)
async def update_device_template(
    template_id: str,
    template_data: DeviceTemplateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing device template
    Only custom templates owned by user can be updated
    """
    user_id = await ensure_default_user(db)

    # Get template
    result = await db.execute(
        select(DeviceTemplate).where(DeviceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device template with id {template_id} not found"
        )

    # Check if template is custom and belongs to user
    if not template.is_custom:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify global templates"
        )

    if template.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify templates created by other users"
        )

    # Update template
    template.template = template_data.template.dict()

    await db.commit()
    await db.refresh(template)

    return DeviceTemplateResponse(
        id=template.id,
        user_id=template.user_id,
        is_custom=template.is_custom,
        template=template.template,
        created_at=template.created_at.isoformat() if template.created_at else None
    )


@router.delete("/devices/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device_template(
    template_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a device template
    Only custom templates owned by user can be deleted
    """
    user_id = await ensure_default_user(db)

    # Get template
    result = await db.execute(
        select(DeviceTemplate).where(DeviceTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device template with id {template_id} not found"
        )

    # Check if template is custom and belongs to user
    if not template.is_custom:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete global templates"
        )

    if template.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete templates created by other users"
        )

    # Delete template
    await db.delete(template)
    await db.commit()

    return None


# ============================================================================
# Connection Template Endpoints
# ============================================================================

@router.get("/connections", response_model=List[ConnectionTemplateResponse])
async def list_connection_templates(db: AsyncSession = Depends(get_db)):
    """
    Get all connection templates (global + user custom)
    Returns list of connection templates ordered by global first, then custom
    """
    user_id = await ensure_default_user(db)

    # Get global templates (user_id IS NULL) + user's custom templates
    result = await db.execute(
        select(ConnectionTemplate)
        .where(
            or_(
                ConnectionTemplate.user_id.is_(None),  # Global templates
                ConnectionTemplate.user_id == user_id   # User's custom templates
            )
        )
        .order_by(ConnectionTemplate.is_custom.asc(), ConnectionTemplate.created_at.desc())
    )

    templates = result.scalars().all()

    return [
        ConnectionTemplateResponse(
            id=t.id,
            user_id=t.user_id,
            is_custom=t.is_custom,
            template=t.template,
            created_at=t.created_at.isoformat() if t.created_at else None
        )
        for t in templates
    ]


@router.post("/connections", response_model=ConnectionTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_connection_template(
    template_data: ConnectionTemplateCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new custom connection template
    Only custom templates (isCustom=true) can be created via API
    """
    user_id = await ensure_default_user(db)

    # Create new template
    new_template = ConnectionTemplate(
        user_id=user_id,
        is_custom=True,  # Always true for user-created templates
        template=template_data.template.dict()
    )

    db.add(new_template)
    await db.commit()
    await db.refresh(new_template)

    return ConnectionTemplateResponse(
        id=new_template.id,
        user_id=new_template.user_id,
        is_custom=new_template.is_custom,
        template=new_template.template,
        created_at=new_template.created_at.isoformat() if new_template.created_at else None
    )


@router.put("/connections/{template_id}", response_model=ConnectionTemplateResponse)
async def update_connection_template(
    template_id: str,
    template_data: ConnectionTemplateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing connection template
    Only custom templates owned by user can be updated
    """
    user_id = await ensure_default_user(db)

    # Get template
    result = await db.execute(
        select(ConnectionTemplate).where(ConnectionTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection template with id {template_id} not found"
        )

    # Check if template is custom and belongs to user
    if not template.is_custom:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify global templates"
        )

    if template.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify templates created by other users"
        )

    # Update template
    template.template = template_data.template.dict()

    await db.commit()
    await db.refresh(template)

    return ConnectionTemplateResponse(
        id=template.id,
        user_id=template.user_id,
        is_custom=template.is_custom,
        template=template.template,
        created_at=template.created_at.isoformat() if template.created_at else None
    )


@router.delete("/connections/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection_template(
    template_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a connection template
    Only custom templates owned by user can be deleted
    """
    user_id = await ensure_default_user(db)

    # Get template
    result = await db.execute(
        select(ConnectionTemplate).where(ConnectionTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection template with id {template_id} not found"
        )

    # Check if template is custom and belongs to user
    if not template.is_custom:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete global templates"
        )

    if template.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete templates created by other users"
        )

    # Delete template
    await db.delete(template)
    await db.commit()

    return None


# ============================================================================
# Bulk Sync Endpoint (for LocalStorage migration)
# ============================================================================

@router.post("/sync", response_model=TemplateSyncResponse)
async def sync_templates(
    sync_data: TemplateSyncRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Sync all templates (upsert)
    Used for migrating custom templates from LocalStorage to database
    Only syncs custom templates (isCustom=true), skips global templates
    """
    user_id = await ensure_default_user(db)

    synced_device_templates = []
    synced_connection_templates = []

    # Sync Device Templates
    for template_data in sync_data.deviceTemplates:
        # Skip global templates (they should be seeded separately)
        if not template_data.isCustom:
            continue

        # Check if template already exists (by template.id, not DB id)
        result = await db.execute(
            select(DeviceTemplate).where(
                DeviceTemplate.user_id == user_id,
                DeviceTemplate.template['id'].astext == template_data.id
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            existing.template = template_data.dict()
            await db.commit()
            await db.refresh(existing)
            synced_device_templates.append(
                DeviceTemplateResponse(
                    id=existing.id,
                    user_id=existing.user_id,
                    is_custom=existing.is_custom,
                    template=existing.template,
                    created_at=existing.created_at.isoformat() if existing.created_at else None
                )
            )
        else:
            # Create new
            new_template = DeviceTemplate(
                user_id=user_id,
                is_custom=True,
                template=template_data.dict()
            )
            db.add(new_template)
            await db.commit()
            await db.refresh(new_template)
            synced_device_templates.append(
                DeviceTemplateResponse(
                    id=new_template.id,
                    user_id=new_template.user_id,
                    is_custom=new_template.is_custom,
                    template=new_template.template,
                    created_at=new_template.created_at.isoformat() if new_template.created_at else None
                )
            )

    # Sync Connection Templates
    for template_data in sync_data.connectionTemplates:
        # Skip global templates
        if not template_data.isCustom:
            continue

        # Check if template already exists
        result = await db.execute(
            select(ConnectionTemplate).where(
                ConnectionTemplate.user_id == user_id,
                ConnectionTemplate.template['id'].astext == template_data.id
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            existing.template = template_data.dict()
            await db.commit()
            await db.refresh(existing)
            synced_connection_templates.append(
                ConnectionTemplateResponse(
                    id=existing.id,
                    user_id=existing.user_id,
                    is_custom=existing.is_custom,
                    template=existing.template,
                    created_at=existing.created_at.isoformat() if existing.created_at else None
                )
            )
        else:
            # Create new
            new_template = ConnectionTemplate(
                user_id=user_id,
                is_custom=True,
                template=template_data.dict()
            )
            db.add(new_template)
            await db.commit()
            await db.refresh(new_template)
            synced_connection_templates.append(
                ConnectionTemplateResponse(
                    id=new_template.id,
                    user_id=new_template.user_id,
                    is_custom=new_template.is_custom,
                    template=new_template.template,
                    created_at=new_template.created_at.isoformat() if new_template.created_at else None
                )
            )

    return TemplateSyncResponse(
        deviceTemplates=synced_device_templates,
        connectionTemplates=synced_connection_templates,
        message=f"Synced {len(synced_device_templates)} device templates and {len(synced_connection_templates)} connection templates"
    )
