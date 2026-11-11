"""
Database Configuration
SQLAlchemy 2.0 async setup with FastAPI dependency injection
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.orm import declarative_base

from app.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,  # Log SQL queries if enabled
    future=True,
    pool_pre_ping=True,  # Verify connections before using
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for SQLAlchemy models
Base = declarative_base()


# Dependency for FastAPI routes
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session.

    Usage:
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(User))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Helper function to create all tables (development only)
async def create_tables():
    """Create all tables in the database. Use Alembic in production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Helper function to drop all tables (development only)
async def drop_tables():
    """Drop all tables in the database. DANGEROUS - use with caution."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
