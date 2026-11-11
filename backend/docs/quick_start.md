# 🚀 Quick Start Guide

Guida rapida per avviare il backend PixelCake in **5 minuti**.

## 📋 Prerequisites

- Python 3.10 o superiore
- pip (package manager)
- Git (opzionale)

## ⚡ Setup Rapido (Development con SQLite)

### Step 1: Clone e Naviga nella Cartella

```bash
cd backend
```

### Step 2: Crea Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Installa Dipendenze

```bash
pip install -r requirements.txt
```

**Tempo stimato**: 2-3 minuti

### Step 4: Configura Environment

```bash
# Copia template configurazione
copy .env.example .env  # Windows
# oppure
cp .env.example .env    # Linux/Mac
```

**Modifica `.env`** (minimo necessario):
```bash
DATABASE_URL=sqlite+aiosqlite:///./database.db
SECRET_KEY=dev-secret-key-change-in-production
```

### Step 5: Crea Struttura Backend (Prima Volta)

```bash
# Crea cartelle necessarie
mkdir -p app/models app/schemas app/routers app/services app/utils
```

**Struttura minima**:
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # Entry point (già esistente)
│   ├── config.py        # Settings (da creare)
│   ├── database.py      # DB setup (da creare)
│   └── models/
│       └── __init__.py
├── .env
├── requirements.txt
└── database.db          # Creato automaticamente
```

### Step 6: Inizializza Database

**Opzione A: Senza Alembic (Quick & Dirty)**

Crea file `init_db.py`:
```python
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import Base
from app.models import User, Project  # Importa tutti i models

async def init_database():
    engine = create_async_engine("sqlite+aiosqlite:///./database.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database created successfully!")

if __name__ == "__main__":
    asyncio.run(init_database())
```

Esegui:
```bash
python init_db.py
```

**Opzione B: Con Alembic (Recommended)**

```bash
# Inizializza Alembic
alembic init alembic

# Crea initial migration
alembic revision --autogenerate -m "Initial schema"

# Applica migration
alembic upgrade head
```

### Step 7: Avvia Server

```bash
# Metodo 1: Direct run
python main.py

# Metodo 2: Uvicorn CLI
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Output atteso**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Step 8: Verifica Funzionamento

Apri browser: **http://localhost:8000**

Dovresti vedere:
```json
{
  "status": "ok",
  "service": "Pixelcake API",
  "version": "0.1.0"
}
```

**API Docs auto-generated**:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 🎯 Test API con cURL

### Health Check

```bash
curl http://localhost:8000/api/health
```

**Response**:
```json
{"status": "healthy"}
```

### Register User (dopo aver implementato auth)

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "Test User",
    "password": "secure-password-123"
  }'
```

### Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password-123"
  }'
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Create Project

```bash
TOKEN="your-jwt-token-here"

curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My First Network",
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
  }'
```

---

## 🗂️ File Minimi Necessari

### 1. `app/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./database.db"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
```

### 2. `app/database.py`

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Set to True to see SQL queries
    future=True
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### 3. `app/__init__.py`

```python
# Empty file (marks directory as Python package)
```

### 4. `app/models/__init__.py`

```python
from app.models.user import User
from app.models.project import Project

__all__ = ["User", "Project"]
```

---

## 🐛 Troubleshooting

### Errore: `ModuleNotFoundError: No module named 'app'`

**Soluzione**: Assicurati di essere nella cartella `backend/` e che esista `app/__init__.py`

```bash
cd backend
ls app/__init__.py  # Deve esistere
python -m app.main  # Esegui come module
```

### Errore: `ImportError: cannot import name 'Settings' from 'pydantic_settings'`

**Soluzione**: Installa dipendenza mancante

```bash
pip install pydantic-settings
```

### Errore: `sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such table: users`

**Soluzione**: Database non inizializzato

```bash
# Opzione A: Con Alembic
alembic upgrade head

# Opzione B: Con script init_db.py
python init_db.py
```

### Errore: `ValueError: secret_key must be set`

**Soluzione**: File `.env` mancante o SECRET_KEY non impostata

```bash
# Crea .env
copy .env.example .env  # Windows
cp .env.example .env    # Linux/Mac

# Edita .env e imposta:
SECRET_KEY=your-secret-key-here
```

### Porta 8000 già in uso

**Soluzione**: Cambia porta

```bash
# Nel file .env
PORT=8001

# Oppure CLI
uvicorn app.main:app --reload --port 8001
```

---

## 🔄 Workflow Development

### 1. Modifica Codice

```bash
# Backend auto-reload attivo (--reload flag)
# Ogni modifica al codice → server restart automatico
```

### 2. Test con Swagger UI

Apri http://localhost:8000/docs

- Click su endpoint
- Click "Try it out"
- Inserisci parametri
- Click "Execute"
- Vedi response

### 3. Visualizza Logs

```bash
# Terminal dove gira uvicorn mostra:
INFO:     127.0.0.1:54321 - "GET /api/health HTTP/1.1" 200 OK
```

### 4. Debug con Print

```python
# In qualsiasi endpoint
@app.get("/test")
async def test():
    print("Debug: endpoint called")  # Appare nel terminal
    return {"message": "test"}
```

---

## 📊 Admin Panel (Opzionale)

Se hai configurato SQLAdmin, accedi a:

**http://localhost:8000/admin**

Login:
- Username: `admin` (da `.env`)
- Password: `changeme` (da `.env`)

Funzionalità:
- Visualizza tutti i record database
- CRUD operations manual
- Query SQL dirette

---

## 🧪 Testing

### Run Tests

```bash
# Tutti i test
pytest

# Con coverage
pytest --cov=app tests/

# Verbose output
pytest -v

# Specific test file
pytest tests/test_auth.py

# Specific test function
pytest tests/test_auth.py::test_register_user
```

---

## 📚 Next Steps

Ora che hai il backend funzionante, procedi con:

1. **[Struttura Backend](./03_backend_structure.md)** - Organizza il codice in moduli
2. **[Modelli e Schemas](./04_models_and_schemas.md)** - Implementa SQLAlchemy models
3. **[API Reference](./05_api_reference.md)** - Implementa tutti gli endpoints
4. **[Autenticazione JWT](./06_authentication.md)** - Aggiungi auth system
5. **[Frontend Integration](./10_frontend_integration.md)** - Connetti frontend con backend

---

## 🔧 Comandi Utili

```bash
# Virtual environment
venv\Scripts\activate              # Windows activate
deactivate                         # Deactivate

# Dependencies
pip install package-name           # Install single package
pip install -r requirements.txt    # Install all
pip freeze > requirements-lock.txt # Lock versions
pip list                           # List installed

# Database
alembic revision --autogenerate -m "message"  # Create migration
alembic upgrade head               # Apply migrations
alembic downgrade -1               # Rollback last
alembic history                    # Show history
alembic current                    # Show current version

# Server
uvicorn app.main:app --reload      # Development
uvicorn app.main:app --host 0.0.0.0 --port 8000  # Production
python main.py                     # Direct run

# Testing
pytest                             # Run all tests
pytest -v                          # Verbose
pytest --cov=app tests/            # With coverage
pytest -k "test_auth"              # Run specific tests

# Code Quality
black .                            # Format code
flake8 .                           # Lint code
mypy .                             # Type check

# Database Inspection (SQLite)
sqlite3 database.db
.tables                            # List tables
.schema users                      # Show table schema
SELECT * FROM users;               # Query
.quit                              # Exit
```

---

## 🎉 Success Checklist

- [ ] Virtual environment creato e attivato
- [ ] Dipendenze installate (`pip install -r requirements.txt`)
- [ ] File `.env` configurato
- [ ] Database inizializzato
- [ ] Server avviato su http://localhost:8000
- [ ] Health check funzionante (`/api/health`)
- [ ] Swagger docs accessibile (`/docs`)
- [ ] Nessun errore nei logs

**Congratulazioni! Il backend PixelCake è operativo! 🚀**

---

## 💡 Tips

- **Usa Swagger UI** (`/docs`) per testare API interattivamente
- **Abilita SQL echo** (`.env`: `SQL_ECHO=true`) per vedere query
- **Usa Postman/Insomnia** per test API complessi
- **Configura IDE** (VSCode/PyCharm) per Python debugging
- **Git commit spesso** durante sviluppo

---

Prossimo: [Struttura Backend](./03_backend_structure.md) per organizzare il codice in moduli professionali.
