# 3. Struttura Backend e Configurazione

## 📋 Indice
- [3.1 Albero Cartelle Completo](#31-albero-cartelle-completo)
- [3.2 Responsabilità Moduli](#32-responsabilità-moduli)
- [3.3 File Configurazione](#33-file-configurazione)
- [3.4 Setup Alembic](#34-setup-alembic)
- [3.5 Main Application](#35-main-application)

---

## 3.1 Albero Cartelle Completo

```
backend/
├── app/
│   ├── __init__.py                 # Package marker
│   ├── main.py                     # FastAPI application entry point
│   ├── config.py                   # Settings con pydantic-settings
│   ├── database.py                 # SQLAlchemy async setup
│   │
│   ├── models/                     # SQLAlchemy ORM Models
│   │   ├── __init__.py
│   │   ├── user.py                 # User model
│   │   ├── project.py              # Project model (JSONB)
│   │   └── template.py             # DeviceTemplate, ConnectionTemplate models
│   │
│   ├── schemas/                    # Pydantic validation schemas
│   │   ├── __init__.py
│   │   ├── flowmap.py              # FlowMap, NetworkDevice, Port, NIC, Connection
│   │   ├── project.py              # ProjectCreate, ProjectUpdate, ProjectResponse
│   │   ├── user.py                 # UserCreate, UserLogin, Token, UserResponse
│   │   └── template.py             # TemplateCreate, TemplateResponse
│   │
│   ├── routers/                    # API endpoint routers
│   │   ├── __init__.py
│   │   ├── auth.py                 # POST /register, /login, GET /me
│   │   ├── projects.py             # CRUD /projects
│   │   ├── templates.py            # CRUD /templates
│   │   ├── export.py               # POST /export/json, /export/terraform
│   │   └── import_tf.py            # POST /import/tfstate
│   │
│   ├── services/                   # Business logic layer
│   │   ├── __init__.py
│   │   ├── auth.py                 # JWT generation, password verification
│   │   ├── terraform.py            # Terraform file generation
│   │   └── parser.py               # .tfstate parsing logic
│   │
│   └── utils/                      # Utility functions
│       ├── __init__.py
│       ├── dependencies.py         # FastAPI dependencies (get_db, get_current_user)
│       └── security.py             # Password hashing, token verification
│
├── alembic/                        # Database migrations
│   ├── versions/                   # Migration files
│   │   └── 001_initial_schema.py
│   ├── env.py                      # Alembic environment config
│   └── script.py.mako              # Migration template
│
├── tests/                          # Test suite
│   ├── __init__.py
│   ├── conftest.py                 # pytest fixtures
│   ├── test_auth.py                # Auth endpoint tests
│   ├── test_projects.py            # Projects CRUD tests
│   ├── test_templates.py           # Templates tests
│   └── test_export.py              # Export/Import tests
│
├── docs/                           # Documentation (questa cartella!)
│   ├── README.md
│   ├── 01_introduction_and_analysis.md
│   ├── 02_database_schema.md
│   ├── 03_backend_structure.md     # Questo file
│   └── ...
│
├── logs/                           # Application logs (opzionale)
│   └── pixelcake.log
│
├── .env                            # Environment variables (NON committare!)
├── .env.example                    # Template environment
├── .gitignore                      # Git ignore rules
├── alembic.ini                     # Alembic configuration
├── requirements.txt                # Python dependencies
├── main.py                         # Entry point (uvicorn runner)
├── README.md                       # Backend documentation
└── database.db                     # SQLite database (development)
```

---

## 3.2 Responsabilità Moduli

### 📦 `app/` - Application Package

Package principale contenente tutta la logica applicativa.

---

### 🚀 `app/main.py` - FastAPI Application

**Responsabilità**:
- Inizializza FastAPI app
- Configura CORS
- Include routers
- Setup middleware
- Configura SQLAdmin (opzionale)
- Health check endpoints

**Dipendenze**:
- FastAPI core
- CORS middleware
- Routers
- Database engine

**File completo**:
```python
"""
PixelCake Backend - FastAPI Application
Main entry point for the API server
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, projects, templates, export, import_tf

# Create FastAPI app
app = FastAPI(
    title="PixelCake API",
    description="Infrastructure as Code Visual Designer Backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(templates.router, prefix="/api/templates", tags=["Templates"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(import_tf.router, prefix="/api/import", tags=["Import"])

# Root endpoint
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "PixelCake API",
        "version": "1.0.0",
    }

# API health check
@app.get("/api/health")
async def health_check():
    """API health check"""
    return {"status": "healthy"}

# Startup event
@app.on_event("startup")
async def startup():
    """Execute on application startup"""
    print("🚀 PixelCake API started")
    print(f"📊 Database: {settings.DATABASE_URL}")
    print(f"🔐 JWT Algorithm: {settings.ALGORITHM}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown():
    """Execute on application shutdown"""
    print("👋 PixelCake API shutting down")
```

---

### ⚙️ `app/config.py` - Settings

**Responsabilità**:
- Load environment variables da `.env`
- Configurazione app centralizzata
- Type-safe settings con Pydantic

**File completo**:
```python
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

    # Admin Panel (opzionale)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    ADMIN_SECRET_KEY: str = "admin-secret-key"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str | None = None

    # Features
    ENABLE_PROJECT_VERSIONS: bool = True
    MAX_PROJECT_VERSIONS: int = 50
    ENABLE_PUBLIC_PROJECTS: bool = False

    # Debug
    DEBUG: bool = False
    SQL_ECHO: bool = False

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
```

---

### 🗄️ `app/database.py` - Database Setup

**Responsabilità**:
- SQLAlchemy async engine
- Session factory
- Dependency injection per FastAPI
- Base class per models

**File completo**:
```python
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
```

---

### 📊 `app/models/` - SQLAlchemy ORM Models

**Responsabilità**:
- Definizione schema database
- Relazioni tra tabelle
- JSONB columns
- Validazioni database-level

**Struttura**:
- `user.py` - User model (auth, profile)
- `project.py` - Project model (JSONB FlowMap)
- `template.py` - DeviceTemplate, ConnectionTemplate models

**Pattern comune**:
```python
from sqlalchemy import Column, String, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.database import Base

class ModelName(Base):
    __tablename__ = "table_name"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    # ... other columns
```

---

### 📝 `app/schemas/` - Pydantic Schemas

**Responsabilità**:
- Request validation
- Response serialization
- Type safety
- Auto-generated OpenAPI docs

**Struttura**:
- `flowmap.py` - FlowMap, NetworkDevice, Port, NIC, NetworkConnection
- `project.py` - ProjectCreate, ProjectUpdate, ProjectResponse
- `user.py` - UserCreate, UserLogin, Token, UserResponse
- `template.py` - DeviceTemplateCreate, ConnectionTemplateCreate

**Pattern comune**:
```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class SchemaBase(BaseModel):
    """Base schema con config comune"""
    class Config:
        from_attributes = True  # Abilita ORM mode

class SchemaCreate(BaseModel):
    """Schema per creazione (solo campi obbligatori)"""
    name: str = Field(..., min_length=1, max_length=255)

class SchemaUpdate(BaseModel):
    """Schema per update (tutti campi opzionali)"""
    name: Optional[str] = None

class SchemaResponse(SchemaBase):
    """Schema per response (include campi auto-generati)"""
    id: str
    name: str
    created_at: datetime
```

---

### 🛣️ `app/routers/` - API Endpoints

**Responsabilità**:
- Definizione endpoints REST
- Request handling
- Response formatting
- Dependency injection (auth, db)

**Struttura**:
- `auth.py` - POST /register, /login, GET /me
- `projects.py` - GET/POST/PUT/DELETE /projects
- `templates.py` - GET/POST/DELETE /templates
- `export.py` - POST /export/json, /export/terraform
- `import_tf.py` - POST /import/tfstate

**Pattern comune**:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectResponse
from app.utils.dependencies import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=list[ProjectResponse])
async def get_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all projects for current user"""
    # Implementation
    pass

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new project"""
    # Implementation
    pass
```

---

### 🔧 `app/services/` - Business Logic

**Responsabilità**:
- Logica applicativa complessa
- Separazione da endpoint logic
- Riusabilità

**Struttura**:
- `auth.py` - JWT creation, password hashing/verification
- `terraform.py` - Terraform file generation logic
- `parser.py` - .tfstate parsing

**Pattern comune**:
```python
"""Auth service - JWT and password utilities"""

from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

---

### 🛠️ `app/utils/` - Utilities

**Responsabilità**:
- FastAPI dependencies
- Helper functions
- Security utilities

**Struttura**:
- `dependencies.py` - get_current_user, etc.
- `security.py` - Token verification, security helpers

**Example `dependencies.py`**:
```python
"""FastAPI dependencies"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.config import settings
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user
```

---

## 3.3 File Configurazione

### `alembic.ini`

**Scopo**: Configurazione Alembic migrations

```ini
# A generic, single database configuration.

[alembic]
# Path to migration scripts
script_location = alembic

# Template used to generate migration files
file_template = %%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d_%%(rev)s_%%(slug)s

# Timezone for migration timestamps
timezone = UTC

# Max length of new migration file names (excluding extension)
# truncate_slug_length = 40

# Set to 'true' to run the environment during the 'revision' command
# revision_environment = false

# Set to 'true' to allow .pyc and .pyo files without a source .py file to be detected as revisions
# sourceless = false

# Version location specification
# version_locations = %(here)s/bar:%(here)s/bat:alembic/versions

# The output encoding used when revision files are written from script.py.mako
# output_encoding = utf-8

# Database URL (overridden by env.py from settings)
sqlalchemy.url = sqlite:///./database.db

[post_write_hooks]
# post_write_hooks defines scripts or Python functions that are run on newly generated revision scripts.
# See the documentation for further detail and examples

# format using "black" - use the console_scripts runner, against the "black" entrypoint
# hooks = black
# black.type = console_scripts
# black.entrypoint = black
# black.options = -l 79 REVISION_SCRIPT_FILENAME

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

---

### `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
*.egg-info/
dist/
build/

# Database
*.db
*.db-journal
*.sqlite
*.sqlite3

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# Testing
.coverage
htmlcov/
.pytest_cache/

# Alembic
# DO NOT ignore alembic/versions/ - commit migrations!

# Terraform exports
terraform_exports/
*.tf
*.tfstate
*.tfstate.backup
```

---

## 3.4 Setup Alembic

### Inizializzazione

```bash
cd backend
alembic init alembic
```

### `alembic/env.py` (Async Support)

```python
"""Alembic environment configuration with async support"""

from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import asyncio

# Import your models here
from app.database import Base
from app.models import User, Project  # Import all models
from app.config import settings

# Alembic Config object
config = context.config

# Override sqlalchemy.url from settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async support."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

## 3.5 Main Application

### `main.py` (Root Level)

**Scopo**: Entry point per eseguire il server

```python
"""
PixelCake Backend - Main Entry Point
Run with: python main.py
"""

if __name__ == "__main__":
    import uvicorn
    from app.config import settings

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        log_level=settings.LOG_LEVEL.lower()
    )
```

---

## Summary

✅ **Struttura completa** con separazione concerns
✅ **Config centralizzata** con pydantic-settings
✅ **Database async** con SQLAlchemy 2.0
✅ **Alembic migrations** per schema evolution
✅ **Pattern consistenti** in tutti i moduli

### Comandi Setup Completo

```bash
# 1. Crea cartelle
mkdir -p app/models app/schemas app/routers app/services app/utils
mkdir -p alembic/versions tests docs logs

# 2. Crea __init__.py files
touch app/__init__.py app/models/__init__.py app/schemas/__init__.py
touch app/routers/__init__.py app/services/__init__.py app/utils/__init__.py
touch tests/__init__.py

# 3. Setup Alembic
alembic init alembic

# 4. Crea .env
cp .env.example .env

# 5. Install dependencies
pip install -r requirements.txt

# 6. Run migrations
alembic upgrade head

# 7. Start server
python main.py
```

### Next Steps

1. **[Modelli e Schemas](./04_models_and_schemas.md)** - Implementa SQLAlchemy models
2. **[API Reference](./05_api_reference.md)** - Implementa endpoints
3. **[Quick Start](./quick_start.md)** - Setup pratico

---

**Domande Frequenti**

**Q: Perché separare routers, services, e utils?**
A: Separation of concerns - routers gestiscono HTTP, services contengono business logic, utils sono helper riusabili.

**Q: Quando usare async def vs def normale?**
A: Usa `async def` per tutti gli endpoint e funzioni che accedono al database. Usa `def` per utility pure (es. password hashing).

**Q: Come organizzare models con molte tabelle?**
A: Un file per domain (user.py, project.py, template.py). Se crescono troppo, crea sottocartelle (models/auth/, models/network/).
