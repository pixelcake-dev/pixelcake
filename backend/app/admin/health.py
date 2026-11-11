"""
Admin Dashboard Health Checks
Real-time monitoring for API and Database status
"""

import os
import time
from typing import Dict, Any, Optional
from sqlalchemy import text, select, func
from sqlalchemy.exc import SQLAlchemyError

from app.database import AsyncSessionLocal, engine
from app.models import User, Project, ProjectVersion, DeviceTemplate, ConnectionTemplate, UserPreferences
from app.config import settings


async def check_database() -> Dict[str, Any]:
    """
    Test database connection and measure latency

    Returns:
        dict: {
            "status": "connected" | "error",
            "latency_ms": float,
            "error": str (optional)
        }
    """
    try:
        start = time.time()

        async with AsyncSessionLocal() as session:
            # Simple ping query
            await session.execute(text("SELECT 1"))

        latency = (time.time() - start) * 1000  # Convert to milliseconds

        return {
            "status": "connected",
            "latency_ms": round(latency, 2)
        }
    except Exception as e:
        return {
            "status": "error",
            "latency_ms": 0,
            "error": str(e)
        }


async def check_api() -> Dict[str, Any]:
    """
    Check if main API endpoints are responsive

    Returns:
        dict: {
            "status": "online" | "error",
            "error": str (optional)
        }
    """
    try:
        # API is running if this code executes
        # In production, could make actual HTTP requests to critical endpoints
        return {
            "status": "online"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


async def get_db_stats() -> Dict[str, int]:
    """
    Get record count for all tables

    Returns:
        dict: {"users": 5, "projects": 12, ...}
    """
    stats = {}

    try:
        async with AsyncSessionLocal() as session:
            # Count users
            result = await session.execute(select(func.count()).select_from(User))
            stats["users"] = result.scalar()

            # Count projects
            result = await session.execute(select(func.count()).select_from(Project))
            stats["projects"] = result.scalar()

            # Count project versions
            result = await session.execute(select(func.count()).select_from(ProjectVersion))
            stats["project_versions"] = result.scalar()

            # Count device templates
            result = await session.execute(select(func.count()).select_from(DeviceTemplate))
            stats["device_templates"] = result.scalar()

            # Count connection templates
            result = await session.execute(select(func.count()).select_from(ConnectionTemplate))
            stats["connection_templates"] = result.scalar()

            # Count user preferences
            result = await session.execute(select(func.count()).select_from(UserPreferences))
            stats["user_preferences"] = result.scalar()
    except Exception as e:
        # Return zeros if error
        stats = {
            "users": 0,
            "projects": 0,
            "project_versions": 0,
            "device_templates": 0,
            "connection_templates": 0,
            "user_preferences": 0,
            "error": str(e)
        }

    return stats


async def get_db_size() -> Dict[str, Any]:
    """
    Get database size (SQLite: file size, PostgreSQL: pg_database_size)

    Returns:
        dict: {
            "size_bytes": int,
            "size_human": str (e.g., "88 KB", "1.2 MB")
        }
    """
    try:
        if "sqlite" in settings.DATABASE_URL.lower():
            # SQLite: get file size
            db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("./", "")
            db_path = os.path.join(os.getcwd(), db_path)

            if os.path.exists(db_path):
                size_bytes = os.path.getsize(db_path)
            else:
                size_bytes = 0

        elif "postgresql" in settings.DATABASE_URL.lower():
            # PostgreSQL: query pg_database_size
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    text("SELECT pg_database_size(current_database())")
                )
                size_bytes = result.scalar()
        else:
            size_bytes = 0

        # Convert to human-readable format
        size_human = _format_bytes(size_bytes)

        return {
            "size_bytes": size_bytes,
            "size_human": size_human
        }
    except Exception as e:
        return {
            "size_bytes": 0,
            "size_human": "0 B",
            "error": str(e)
        }


async def get_pg_metrics() -> Optional[Dict[str, Any]]:
    """
    Get PostgreSQL-specific metrics (cache hit ratio, connections, etc.)
    Returns None if not using PostgreSQL

    Returns:
        dict or None: {
            "connections_active": int,
            "connections_max": int,
            "cache_hit_ratio": float,
            "transactions_commit": int,
            "transactions_rollback": int
        }
    """
    if "postgresql" not in settings.DATABASE_URL.lower():
        return None

    try:
        metrics = {}

        async with AsyncSessionLocal() as session:
            # Active connections
            result = await session.execute(
                text("SELECT count(*) FROM pg_stat_activity")
            )
            metrics["connections_active"] = result.scalar()

            # Max connections
            result = await session.execute(
                text("SELECT setting::int FROM pg_settings WHERE name = 'max_connections'")
            )
            metrics["connections_max"] = result.scalar()

            # Cache hit ratio
            result = await session.execute(
                text("""
                    SELECT
                        CASE
                            WHEN (blks_hit + blks_read) > 0
                            THEN round(100.0 * blks_hit / (blks_hit + blks_read), 2)
                            ELSE 0
                        END as cache_hit_ratio
                    FROM pg_stat_database
                    WHERE datname = current_database()
                """)
            )
            metrics["cache_hit_ratio"] = result.scalar()

            # Transactions
            result = await session.execute(
                text("""
                    SELECT xact_commit, xact_rollback
                    FROM pg_stat_database
                    WHERE datname = current_database()
                """)
            )
            row = result.fetchone()
            metrics["transactions_commit"] = row[0] if row else 0
            metrics["transactions_rollback"] = row[1] if row else 0

        return metrics
    except Exception as e:
        return {
            "error": str(e)
        }


async def get_all_health() -> Dict[str, Any]:
    """
    Aggregate all health check data

    Returns:
        dict: Complete health status for dashboard
    """
    # Run all checks concurrently would be ideal, but for simplicity run sequentially
    db_check = await check_database()
    api_check = await check_api()
    db_stats = await get_db_stats()
    db_size = await get_db_size()
    pg_metrics = await get_pg_metrics()

    return {
        "timestamp": time.time(),
        "database": db_check,
        "api": api_check,
        "stats": db_stats,
        "size": db_size,
        "postgresql": pg_metrics  # Will be None if not PostgreSQL
    }


def _format_bytes(bytes_value: int) -> str:
    """
    Convert bytes to human-readable format

    Args:
        bytes_value: Size in bytes

    Returns:
        str: Formatted string (e.g., "1.2 MB", "88 KB")
    """
    if bytes_value == 0:
        return "0 B"

    units = ["B", "KB", "MB", "GB", "TB"]
    unit_index = 0
    size = float(bytes_value)

    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1

    return f"{size:.1f} {units[unit_index]}"
