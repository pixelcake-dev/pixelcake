"""
SQLAdmin Setup
Admin panel for PixelCake database management
"""

from sqladmin import Admin
import os

from app.admin.views import (
    UserAdmin,
    ProjectAdmin,
    CanvasAdmin,
    ProjectVersionAdmin,
    DeviceTemplateAdmin,
    ConnectionTemplateAdmin,
    UserPreferencesAdmin,
)

__all__ = [
    "Admin",
    "UserAdmin",
    "ProjectAdmin",
    "ProjectVersionAdmin",
    "DeviceTemplateAdmin",
    "ConnectionTemplateAdmin",
    "UserPreferencesAdmin",
]


def setup_admin(app, engine):
    """
    Setup SQLAdmin panel on /admin route

    Args:
        app: FastAPI application instance
        engine: SQLAlchemy async engine

    Returns:
        Admin: SQLAdmin instance
    """
    admin = Admin(
        app,
        engine,
        title="PixelCake Admin",
        base_url="/admin",
    )

    # Register all model views
    admin.add_view(UserAdmin)
    admin.add_view(ProjectAdmin)
    admin.add_view(CanvasAdmin)
    admin.add_view(ProjectVersionAdmin)
    admin.add_view(DeviceTemplateAdmin)
    admin.add_view(ConnectionTemplateAdmin)
    admin.add_view(UserPreferencesAdmin)

    return admin
