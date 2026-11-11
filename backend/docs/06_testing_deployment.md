# 6. Testing, Deployment e Checklist

## 📋 Indice
- [6.1 Testing con Pytest](#61-testing-con-pytest)
- [6.2 Test Examples](#62-test-examples)
- [6.3 Deployment Development](#63-deployment-development)
- [6.4 Deployment Production](#64-deployment-production)
- [6.5 Docker Setup](#65-docker-setup)
- [6.6 Checklist Implementazione](#66-checklist-implementazione)
- [6.7 Troubleshooting](#67-troubleshooting)

---

## 6.1 Testing con Pytest

### Setup Pytest

**`tests/conftest.py`** - Pytest fixtures globali

```python
"""
Pytest Configuration and Fixtures
Provides test database and test client
"""

import pytest
import asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, get_db
from app.models import User, Project  # Import all models

# Test database URL (in-memory SQLite)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True
)

# Test session factory
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create test database session

    Creates all tables before test, drops after test
    """
    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Provide session
    async with TestSessionLocal() as session:
        yield session

    # Drop tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
def client(db_session: AsyncSession) -> TestClient:
    """
    Create test client with dependency override

    Overrides get_db to use test database
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create test user"""
    from app.models.user import User
    from app.utils.security import get_password_hash

    user = User(
        email="test@example.com",
        username="Test User",
        hashed_password=get_password_hash("testpassword123")
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
    """Get auth headers with JWT token"""
    # Register and login
    client.post("/api/auth/register", json={
        "email": "auth@example.com",
        "username": "Auth User",
        "password": "password123"
    })

    response = client.post("/api/auth/login", json={
        "email": "auth@example.com",
        "password": "password123"
    })

    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

---

### pytest.ini

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
filterwarnings =
    error
    ignore::UserWarning
    ignore::DeprecationWarning
```

---

## 6.2 Test Examples

### `tests/test_auth.py`

```python
"""
Authentication Tests
Tests for user registration, login, and JWT
"""

import pytest
from fastapi.testclient import TestClient


def test_register_user(client: TestClient):
    """Test user registration"""
    response = client.post("/api/auth/register", json={
        "email": "newuser@example.com",
        "username": "New User",
        "password": "securepass123"
    })

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["username"] == "New User"
    assert "id" in data
    assert "hashed_password" not in data  # Should not expose password


def test_register_duplicate_email(client: TestClient):
    """Test registration with duplicate email fails"""
    # First registration
    client.post("/api/auth/register", json={
        "email": "duplicate@example.com",
        "username": "User 1",
        "password": "password123"
    })

    # Second registration with same email
    response = client.post("/api/auth/register", json={
        "email": "duplicate@example.com",
        "username": "User 2",
        "password": "password456"
    })

    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_login_success(client: TestClient):
    """Test successful login"""
    # Register user
    client.post("/api/auth/register", json={
        "email": "login@example.com",
        "username": "Login User",
        "password": "password123"
    })

    # Login
    response = client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "password123"
    })

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient):
    """Test login with wrong password fails"""
    # Register user
    client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "username": "Wrong User",
        "password": "correctpass"
    })

    # Login with wrong password
    response = client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpass"
    })

    assert response.status_code == 401
    assert "incorrect" in response.json()["detail"].lower()


def test_get_current_user(client: TestClient, auth_headers: dict):
    """Test getting current user with valid token"""
    response = client.get("/api/auth/me", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "auth@example.com"
    assert data["username"] == "Auth User"


def test_get_current_user_no_token(client: TestClient):
    """Test getting current user without token fails"""
    response = client.get("/api/auth/me")

    assert response.status_code == 401
```

---

### `tests/test_projects.py`

```python
"""
Projects Tests
Tests for project CRUD operations
"""

import pytest
from fastapi.testclient import TestClient
from uuid import uuid4


def test_create_project(client: TestClient, auth_headers: dict):
    """Test creating a new project"""
    response = client.post("/api/projects", headers=auth_headers, json={
        "name": "Test Network",
        "version": "1.0.0",
        "is_public": False,
        "settings": {
            "ipClass": "192.168.1.0",
            "subnet": "255.255.255.0",
            "gateway": "192.168.1.1",
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "deviceCounter": 0,
            "connectionCounter": 0
        },
        "devices": [],
        "connections": []
    })

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Network"
    assert data["version"] == "1.0.0"
    assert "id" in data


def test_get_projects(client: TestClient, auth_headers: dict):
    """Test getting list of projects"""
    # Create 2 projects
    client.post("/api/projects", headers=auth_headers, json={
        "name": "Project 1",
        "settings": {},
        "devices": [],
        "connections": []
    })
    client.post("/api/projects", headers=auth_headers, json={
        "name": "Project 2",
        "settings": {},
        "devices": [],
        "connections": []
    })

    # Get all projects
    response = client.get("/api/projects", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] in ["Project 1", "Project 2"]


def test_get_single_project(client: TestClient, auth_headers: dict):
    """Test getting single project by ID"""
    # Create project
    create_response = client.post("/api/projects", headers=auth_headers, json={
        "name": "Single Project",
        "settings": {},
        "devices": [],
        "connections": []
    })
    project_id = create_response.json()["id"]

    # Get project
    response = client.get(f"/api/projects/{project_id}", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Single Project"


def test_update_project(client: TestClient, auth_headers: dict):
    """Test updating project"""
    # Create project
    create_response = client.post("/api/projects", headers=auth_headers, json={
        "name": "Original Name",
        "settings": {},
        "devices": [],
        "connections": []
    })
    project_id = create_response.json()["id"]

    # Update project
    response = client.put(f"/api/projects/{project_id}", headers=auth_headers, json={
        "name": "Updated Name"
    })

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"


def test_delete_project(client: TestClient, auth_headers: dict):
    """Test deleting project"""
    # Create project
    create_response = client.post("/api/projects", headers=auth_headers, json={
        "name": "To Delete",
        "settings": {},
        "devices": [],
        "connections": []
    })
    project_id = create_response.json()["id"]

    # Delete project
    response = client.delete(f"/api/projects/{project_id}", headers=auth_headers)

    assert response.status_code == 204

    # Verify deleted
    get_response = client.get(f"/api/projects/{project_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_duplicate_project(client: TestClient, auth_headers: dict):
    """Test duplicating project"""
    # Create original
    create_response = client.post("/api/projects", headers=auth_headers, json={
        "name": "Original",
        "settings": {},
        "devices": [],
        "connections": []
    })
    project_id = create_response.json()["id"]

    # Duplicate
    response = client.post(f"/api/projects/{project_id}/duplicate", headers=auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Original (Copy)"
    assert data["id"] != project_id


def test_get_project_unauthorized(client: TestClient):
    """Test getting project without auth fails"""
    response = client.get(f"/api/projects/{uuid4()}")

    assert response.status_code == 401
```

---

### Run Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_auth.py

# Run specific test function
pytest tests/test_auth.py::test_register_user

# Run with coverage
pytest --cov=app tests/

# Generate HTML coverage report
pytest --cov=app --cov-report=html tests/
# Open htmlcov/index.html in browser

# Run and show print statements
pytest -s

# Stop on first failure
pytest -x
```

---

## 6.3 Deployment Development

### Development Setup (SQLite)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/pixelcake.git
cd pixelcake/backend

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env:
DATABASE_URL=sqlite+aiosqlite:///./database.db
SECRET_KEY=dev-secret-key-not-for-production

# 5. Initialize database
alembic upgrade head

# 6. Run server
python main.py
# or
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## 6.4 Deployment Production

### Production Setup (PostgreSQL)

**1. Setup PostgreSQL**

```bash
# Install PostgreSQL 14+
# Ubuntu/Debian:
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql

postgres=# CREATE DATABASE pixelcake;
postgres=# CREATE USER pixelcake_user WITH ENCRYPTED PASSWORD 'secure-password';
postgres=# GRANT ALL PRIVILEGES ON DATABASE pixelcake TO pixelcake_user;
postgres=# \q
```

**2. Configure Backend**

```bash
# .env (PRODUCTION)
DATABASE_URL=postgresql+asyncpg://pixelcake_user:secure-password@localhost:5432/pixelcake
SECRET_KEY=CHANGE-ME-TO-RANDOM-64-CHAR-STRING  # Generate with: python -c "import secrets; print(secrets.token_urlsafe(64))"
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=["https://pixelcake.com","https://app.pixelcake.com"]
HOST=0.0.0.0
PORT=8000
RELOAD=false
LOG_LEVEL=WARNING
DEBUG=false
SQL_ECHO=false
```

**3. Install Dependencies**

```bash
pip install -r requirements.txt
```

**4. Run Migrations**

```bash
alembic upgrade head
```

**5. Run with Uvicorn (Production)**

```bash
# Direct run (simple)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# With process manager (recommended)
# Install supervisor or systemd service
```

**6. Systemd Service**

Create `/etc/systemd/system/pixelcake.service`:

```ini
[Unit]
Description=PixelCake FastAPI Backend
After=network.target postgresql.service

[Service]
Type=notify
User=pixelcake
Group=pixelcake
WorkingDirectory=/opt/pixelcake/backend
Environment="PATH=/opt/pixelcake/backend/venv/bin"
ExecStart=/opt/pixelcake/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pixelcake
sudo systemctl start pixelcake
sudo systemctl status pixelcake
```

**7. Nginx Reverse Proxy**

Create `/etc/nginx/sites-available/pixelcake`:

```nginx
server {
    listen 80;
    server_name api.pixelcake.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/pixelcake /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**8. SSL with Let's Encrypt**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.pixelcake.com
```

---

## 6.5 Docker Setup

### Dockerfile

```dockerfile
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run migrations and start server
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: pixelcake
      POSTGRES_USER: pixelcake_user
      POSTGRES_PASSWORD: secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://pixelcake_user:secure-password@db:5432/pixelcake
      SECRET_KEY: ${SECRET_KEY}
      ALGORITHM: HS256
      ACCESS_TOKEN_EXPIRE_MINUTES: 30
      CORS_ORIGINS: '["http://localhost:5173"]'
    depends_on:
      - db
    volumes:
      - .:/app

volumes:
  postgres_data:
```

### Run with Docker

```bash
# Build and start
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## 6.6 Checklist Implementazione

### ✅ Backend Core

- [ ] Virtual environment creato (`venv/`)
- [ ] Dependencies installate (`pip install -r requirements.txt`)
- [ ] File `.env` configurato
- [ ] `app/config.py` implementato
- [ ] `app/database.py` implementato
- [ ] `app/main.py` configurato con CORS

### ✅ Database

- [ ] PostgreSQL installato (production) o SQLite configurato (dev)
- [ ] Alembic inizializzato (`alembic init alembic`)
- [ ] `alembic/env.py` configurato per async
- [ ] Initial migration creata (`alembic revision --autogenerate -m "Initial"`)
- [ ] Migration applicata (`alembic upgrade head`)
- [ ] Database connection funzionante

### ✅ Models

- [ ] `app/models/user.py` implementato
- [ ] `app/models/project.py` implementato
- [ ] `app/models/template.py` implementato
- [ ] `app/models/__init__.py` con exports
- [ ] Relationships configurate
- [ ] JSONB columns definite

### ✅ Schemas

- [ ] `app/schemas/flowmap.py` implementato
- [ ] `app/schemas/project.py` implementato
- [ ] `app/schemas/user.py` implementato
- [ ] `app/schemas/template.py` implementato
- [ ] `app/schemas/__init__.py` con exports
- [ ] Validation rules aggiunte

### ✅ Security & Auth

- [ ] `app/utils/security.py` implementato
- [ ] `app/utils/dependencies.py` implementato
- [ ] Password hashing funzionante (bcrypt)
- [ ] JWT token generation funzionante
- [ ] `get_current_user` dependency funzionante

### ✅ API Endpoints

- [ ] `app/routers/auth.py` - register, login, me
- [ ] `app/routers/projects.py` - CRUD completo
- [ ] `app/routers/templates.py` - GET, POST, DELETE
- [ ] `app/routers/export.py` - JSON export
- [ ] `app/routers/__init__.py` con exports
- [ ] Routers inclusi in `app/main.py`

### ✅ Testing

- [ ] `tests/conftest.py` con fixtures
- [ ] `tests/test_auth.py` implementato
- [ ] `tests/test_projects.py` implementato
- [ ] Tutti i test passano (`pytest`)
- [ ] Coverage > 80% (`pytest --cov`)

### ✅ Documentation

- [ ] README.md aggiornato
- [ ] API docs accessibile (`/docs`)
- [ ] Postman/Insomnia collection creata (opzionale)

### ✅ Deployment

- [ ] Server configurato (Uvicorn/Gunicorn)
- [ ] Nginx reverse proxy configurato
- [ ] SSL certificate installato (Let's Encrypt)
- [ ] Systemd service creato
- [ ] Monitoring configurato (opzionale)
- [ ] Backup database automatico (opzionale)

---

## 6.7 Troubleshooting

### Database Connection Errors

**Error**: `sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) unable to open database file`

**Soluzione**:
```bash
# Verifica path database in .env
DATABASE_URL=sqlite+aiosqlite:///./database.db

# Verifica permessi cartella
chmod 755 .
```

---

**Error**: `asyncpg.exceptions.InvalidCatalogNameError: database "pixelcake" does not exist`

**Soluzione**:
```bash
# Crea database PostgreSQL
sudo -u postgres psql
CREATE DATABASE pixelcake;
\q
```

---

### Migration Errors

**Error**: `alembic.util.exc.CommandError: Can't locate revision identified by 'xyz'`

**Soluzione**:
```bash
# Reset migrations (DEVELOPMENT ONLY!)
rm -rf alembic/versions/*.py
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

---

### JWT Errors

**Error**: `jose.exceptions.JWTError: Signature verification failed`

**Soluzione**:
```bash
# Verifica SECRET_KEY in .env sia consistente
# Non cambiare SECRET_KEY in production (invalida tutti i token)
```

---

### Import Errors

**Error**: `ModuleNotFoundError: No module named 'app'`

**Soluzione**:
```bash
# Esegui da cartella backend/
cd backend
python -m app.main

# Oppure usa uvicorn
uvicorn app.main:app --reload
```

---

### Performance Issues

**Problema**: Query JSONB lente

**Soluzione**:
```sql
-- Verifica GIN indexes esistono
\d+ projects

-- Se mancano, crea indexes
CREATE INDEX idx_projects_devices_gin ON projects USING GIN (devices);
CREATE INDEX idx_projects_connections_gin ON projects USING GIN (connections);
```

---

### CORS Errors

**Error**: Browser console: `Access to XMLHttpRequest has been blocked by CORS policy`

**Soluzione**:
```python
# In app/main.py, verifica CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Summary

✅ **Testing** setup completo con pytest
✅ **Deployment** strategies per dev e production
✅ **Docker** setup per containerization
✅ **Checklist** implementazione completa
✅ **Troubleshooting** guide per common issues

### 🎉 Congratulazioni!

Hai completato l'implementazione del backend PixelCake!

**Next Steps**:
1. Testa tutti gli endpoint con Swagger UI (`/docs`)
2. Integra frontend con API
3. Deploy in production
4. Monitora performance e logs

---

**Resources**

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [Pytest Docs](https://docs.pytest.org/)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
