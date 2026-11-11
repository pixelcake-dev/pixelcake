"""
Template Models
Device and Connection templates (global + custom)
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, TIMESTAMP, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class DeviceTemplate(Base):
    """Device template model (global defaults + user custom)"""

    __tablename__ = "device_templates"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Foreign Key (NULL for global templates)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Template metadata
    is_custom = Column(Boolean, default=True, index=True)

    # Template definition (full DeviceTemplate object)
    template = Column(JSON, nullable=False)

    # Timestamp
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="device_templates")

    def __repr__(self):
        template_name = self.template.get("name", "Unknown") if self.template else "Unknown"
        return f"<DeviceTemplate(id={self.id}, name={template_name}, custom={self.is_custom})>"


class ConnectionTemplate(Base):
    """Connection template model (global defaults + user custom)"""

    __tablename__ = "connection_templates"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Foreign Key (NULL for global templates)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Template metadata
    is_custom = Column(Boolean, default=True, index=True)

    # Template definition (full ConnectionTemplate object)
    template = Column(JSON, nullable=False)

    # Timestamp
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="connection_templates")

    def __repr__(self):
        template_name = self.template.get("name", "Unknown") if self.template else "Unknown"
        return f"<ConnectionTemplate(id={self.id}, name={template_name}, custom={self.is_custom})>"


class UserPreferences(Base):
    """User preferences (UI settings, language, etc.)"""

    __tablename__ = "user_preferences"

    # Primary Key (also Foreign Key)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    # Preferences (JSON)
    preferences = Column(
        JSON,
        default={
            "ui": {
                "darkMode": False,
                "theme": "pixelcake"
            },
            "locale": {
                "language": "it",
                "dateFormat": "DD/MM/YYYY",
                "unitSystem": "metric"
            }
        },
        nullable=False
    )

    # Timestamp
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="preferences")

    def __repr__(self):
        return f"<UserPreferences(user_id={self.user_id})>"
