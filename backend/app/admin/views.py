"""
SQLAdmin Model Views
Admin interface for all database models
"""

from sqladmin import ModelView
from app.models import (
    User,
    Project,
    Canvas,
    ProjectVersion,
    DeviceTemplate,
    ConnectionTemplate,
    UserPreferences,
)


class UserAdmin(ModelView, model=User):
    """Admin view for User model"""

    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"

    # Columns to display in list view
    column_list = [
        User.id,
        User.email,
        User.username,
        User.created_at,
        User.updated_at,
    ]

    # Columns to display in detail view
    column_details_list = [
        User.id,
        User.email,
        User.username,
        User.hashed_password,
        User.created_at,
        User.updated_at,
    ]

    # Searchable columns
    column_searchable_list = [User.email, User.username]

    # Sortable columns
    column_sortable_list = [
        User.email,
        User.username,
        User.created_at,
        User.updated_at,
    ]

    # Default sort
    column_default_sort = [(User.created_at, True)]  # True = descending

    # Read-only columns (excluded from forms)
    form_excluded_columns = [
        User.id,
        User.created_at,
        User.updated_at,
        User.projects,
    ]

    # Page size
    page_size = 50
    page_size_options = [25, 50, 100, 200]


class ProjectAdmin(ModelView, model=Project):
    """Admin view for Project model"""

    name = "Project"
    name_plural = "Projects"
    icon = "fa-solid fa-diagram-project"

    column_list = [
        Project.id,
        Project.name,
        Project.user_id,
        Project.version,
        Project.is_public,
        Project.created_at,
        Project.last_accessed,
    ]

    column_details_list = [
        Project.id,
        Project.user_id,
        Project.name,
        Project.description,
        Project.version,
        Project.is_public,
        Project.created_at,
        Project.updated_at,
        Project.last_accessed,
        Project.global_settings,
    ]

    column_searchable_list = [Project.name, Project.user_id]

    column_sortable_list = [
        Project.name,
        Project.version,
        Project.is_public,
        Project.created_at,
        Project.updated_at,
        Project.last_accessed,
    ]

    column_default_sort = [(Project.last_accessed, True)]

    # Read-only columns (excluded from forms)
    form_excluded_columns = [
        Project.id,
        Project.created_at,
        Project.updated_at,
        Project.last_accessed,
        Project.owner,
        Project.canvases,
        Project.versions,
    ]

    page_size = 50
    page_size_options = [25, 50, 100, 200]

    # Format JSON columns for better readability
    column_formatters = {
        Project.global_settings: lambda m, a: str(m.global_settings)[:100] + "..."
        if m.global_settings and len(str(m.global_settings)) > 100
        else str(m.global_settings),
    }


class CanvasAdmin(ModelView, model=Canvas):
    """Admin view for Canvas model"""

    name = "Canvas"
    name_plural = "Canvases"
    icon = "fa-solid fa-layer-group"

    column_list = [
        Canvas.id,
        Canvas.project_id,
        Canvas.name,
        Canvas.order,
        Canvas.is_locked,
        Canvas.created_at,
    ]

    column_details_list = [
        Canvas.id,
        Canvas.project_id,
        Canvas.name,
        Canvas.order,
        Canvas.is_locked,
        Canvas.settings,
        Canvas.devices,
        Canvas.connections,
        Canvas.created_at,
        Canvas.updated_at,
    ]

    column_searchable_list = [Canvas.name, Canvas.project_id]

    column_sortable_list = [
        Canvas.name,
        Canvas.order,
        Canvas.created_at,
        Canvas.updated_at,
    ]

    column_default_sort = [(Canvas.order, False)]  # Ascending order

    form_excluded_columns = [
        Canvas.id,
        Canvas.created_at,
        Canvas.updated_at,
        Canvas.project,
    ]

    page_size = 50
    page_size_options = [25, 50, 100, 200]

    # Format JSON columns
    column_formatters = {
        Canvas.devices: lambda m, a: f"[{len(m.devices)} devices]"
        if m.devices
        else "[]",
        Canvas.connections: lambda m, a: f"[{len(m.connections)} connections]"
        if m.connections
        else "[]",
        Canvas.settings: lambda m, a: str(m.settings)[:50] + "..."
        if m.settings and len(str(m.settings)) > 50
        else str(m.settings),
    }


class ProjectVersionAdmin(ModelView, model=ProjectVersion):
    """Admin view for ProjectVersion model"""

    name = "Project Version"
    name_plural = "Project Versions"
    icon = "fa-solid fa-code-branch"

    column_list = [
        ProjectVersion.id,
        ProjectVersion.project_id,
        ProjectVersion.version_number,
        ProjectVersion.created_at,
    ]

    column_details_list = [
        ProjectVersion.id,
        ProjectVersion.project_id,
        ProjectVersion.version_number,
        ProjectVersion.snapshot,
        ProjectVersion.created_at,
    ]

    column_searchable_list = [ProjectVersion.project_id]

    column_sortable_list = [
        ProjectVersion.project_id,
        ProjectVersion.version_number,
        ProjectVersion.created_at,
    ]

    column_default_sort = [(ProjectVersion.created_at, True)]

    # Read-only columns (excluded from forms)
    form_excluded_columns = [
        ProjectVersion.id,
        ProjectVersion.created_at,
        ProjectVersion.project,
    ]

    page_size = 50
    page_size_options = [25, 50, 100, 200]

    column_formatters = {
        ProjectVersion.snapshot: lambda m, a: str(m.snapshot)[:100] + "..."
        if m.snapshot and len(str(m.snapshot)) > 100
        else str(m.snapshot),
    }


class DeviceTemplateAdmin(ModelView, model=DeviceTemplate):
    """Admin view for DeviceTemplate model"""

    name = "Device Template"
    name_plural = "Device Templates"
    icon = "fa-solid fa-microchip"

    column_list = [
        DeviceTemplate.id,
        DeviceTemplate.user_id,
        DeviceTemplate.is_custom,
        DeviceTemplate.created_at,
    ]

    column_details_list = [
        DeviceTemplate.id,
        DeviceTemplate.user_id,
        DeviceTemplate.is_custom,
        DeviceTemplate.template,
        DeviceTemplate.created_at,
    ]

    column_searchable_list = [DeviceTemplate.user_id]

    column_sortable_list = [
        DeviceTemplate.is_custom,
        DeviceTemplate.created_at,
    ]

    column_default_sort = [(DeviceTemplate.created_at, True)]

    # Read-only columns (excluded from forms)
    form_excluded_columns = [
        DeviceTemplate.id,
        DeviceTemplate.created_at,
        DeviceTemplate.user,
    ]

    page_size = 50
    page_size_options = [25, 50, 100, 200]

    column_formatters = {
        DeviceTemplate.template: lambda m, a: str(m.template)[:100] + "..."
        if m.template and len(str(m.template)) > 100
        else str(m.template),
    }


class ConnectionTemplateAdmin(ModelView, model=ConnectionTemplate):
    """Admin view for ConnectionTemplate model"""

    name = "Connection Template"
    name_plural = "Connection Templates"
    icon = "fa-solid fa-link"

    column_list = [
        ConnectionTemplate.id,
        ConnectionTemplate.user_id,
        ConnectionTemplate.is_custom,
        ConnectionTemplate.created_at,
    ]

    column_details_list = [
        ConnectionTemplate.id,
        ConnectionTemplate.user_id,
        ConnectionTemplate.is_custom,
        ConnectionTemplate.template,
        ConnectionTemplate.created_at,
    ]

    column_searchable_list = [ConnectionTemplate.user_id]

    column_sortable_list = [
        ConnectionTemplate.is_custom,
        ConnectionTemplate.created_at,
    ]

    column_default_sort = [(ConnectionTemplate.created_at, True)]

    # Read-only columns (excluded from forms)
    form_excluded_columns = [
        ConnectionTemplate.id,
        ConnectionTemplate.created_at,
        ConnectionTemplate.user,
    ]

    page_size = 50
    page_size_options = [25, 50, 100, 200]

    column_formatters = {
        ConnectionTemplate.template: lambda m, a: str(m.template)[:100] + "..."
        if m.template and len(str(m.template)) > 100
        else str(m.template),
    }


class UserPreferencesAdmin(ModelView, model=UserPreferences):
    """Admin view for UserPreferences model"""

    name = "User Preferences"
    name_plural = "User Preferences"
    icon = "fa-solid fa-sliders"

    column_list = [
        UserPreferences.user_id,
        UserPreferences.updated_at,
    ]

    column_details_list = [
        UserPreferences.user_id,
        UserPreferences.preferences,
        UserPreferences.updated_at,
    ]

    column_searchable_list = [UserPreferences.user_id]

    column_sortable_list = [
        UserPreferences.user_id,
        UserPreferences.updated_at,
    ]

    column_default_sort = [(UserPreferences.updated_at, True)]

    # Read-only columns (excluded from forms)
    form_excluded_columns = [
        UserPreferences.updated_at,
        UserPreferences.user,
    ]

    page_size = 50
    page_size_options = [25, 50, 100, 200]

    column_formatters = {
        UserPreferences.preferences: lambda m, a: str(m.preferences)[:100] + "..."
        if m.preferences and len(str(m.preferences)) > 100
        else str(m.preferences),
    }
