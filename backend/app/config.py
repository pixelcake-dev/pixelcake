"""
Application Configuration
Uses pydantic-settings for type-safe environment variables
"""

from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./database.db"

    # JWT Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True

    # Logging
    LOG_LEVEL: str = "INFO"

    # Debug
    DEBUG: bool = False
    SQL_ECHO: bool = False

    # Features
    ENABLE_PROJECT_VERSIONS: bool = True
    MAX_PROJECT_VERSIONS: int = 50

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS_ORIGINS from JSON string or list"""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()
