"""
Canvas Model
Represents a single canvas/tavola within a project
Each project can have multiple canvases for different network views
"""

from sqlalchemy import Column, String, Integer, ForeignKey, TIMESTAMP, JSON, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class Canvas(Base):
    """Canvas model - represents a single network diagram/tavola"""

    __tablename__ = "canvases"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Foreign Key
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    # Canvas Metadata
    name = Column(String(255), nullable=False, default="Untitled Canvas")
    order = Column(Integer, nullable=False, default=0)  # Display order in project
    is_locked = Column(Boolean, default=False)  # Lock editing

    # Canvas Data (JSONB)
    settings = Column(
        JSON,
        default={
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "deviceCounter": 0,
            "connectionCounter": 0
        },
        nullable=False
    )
    devices = Column(JSON, default=[], nullable=False)
    connections = Column(JSON, default=[], nullable=False)

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="canvases")

    def __repr__(self):
        return f"<Canvas(id={self.id}, name={self.name}, project_id={self.project_id})>"
