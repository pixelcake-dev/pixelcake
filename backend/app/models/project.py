"""
Project Model
Stores network topology projects metadata
Each project contains multiple canvases (tavole)
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, TIMESTAMP, Integer, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class Project(Base):
    """Project model - container for multiple canvases"""

    __tablename__ = "projects"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Foreign Key
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Metadata
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    version = Column(String(50), default="1.0.0")
    is_public = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    last_accessed = Column(TIMESTAMP, server_default=func.now())

    # Global Project Settings (shared across all canvases)
    global_settings = Column(
        JSON,
        default={
            "ipClass": "192.168.1.0",
            "subnet": "255.255.255.0",
            "gateway": "192.168.1.1"
        },
        nullable=False
    )

    # Relationships
    owner = relationship("User", back_populates="projects")
    canvases = relationship("Canvas", back_populates="project", cascade="all, delete-orphan", order_by="Canvas.order")
    versions = relationship("ProjectVersion", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, user_id={self.user_id})>"


class ProjectVersion(Base):
    """Project version history for undo/redo functionality"""

    __tablename__ = "project_versions"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Foreign Key
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    # Version info
    version_number = Column(Integer, nullable=False)

    # Snapshot (full project state)
    snapshot = Column(JSON, nullable=False)

    # Timestamp
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="versions")

    def __repr__(self):
        return f"<ProjectVersion(id={self.id}, project_id={self.project_id}, version={self.version_number})>"
