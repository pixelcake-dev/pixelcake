"""
User Model
Handles user authentication and profile data
"""

from sqlalchemy import Column, String, TIMESTAMP, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class User(Base):
    """User model for authentication"""

    __tablename__ = "users"

    # Primary Key (usando String invece di UUID per compatibilità SQLite)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Authentication
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    device_templates = relationship("DeviceTemplate", back_populates="user", cascade="all, delete-orphan")
    connection_templates = relationship("ConnectionTemplate", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, username={self.username})>"
