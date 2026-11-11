# 📚 PixelCake Backend - Documentazione Implementazione

Questa cartella contiene la documentazione completa per l'implementazione del backend PixelCake con FastAPI, SQLite/PostgreSQL, e gestione progetti multi-canvas.

## ✅ Stato Implementazione Attuale (2025-11-25)

### COMPLETATO
- ✅ **Database Layer**: SQLAlchemy 2.0 async con SQLite (dev) / PostgreSQL (prod)
- ✅ **Models**: User, Project, Canvas, ProjectVersion, Templates, UserPreferences
- ✅ **Admin Panel**: SQLAdmin con 7 model views + health monitoring dashboard
- ✅ **Alembic Migrations**: Sistema migrazione database funzionante
- ✅ **API Projects**: 5 endpoint CRUD completi (GET, POST, PUT, DELETE)
- ✅ **API Canvases**: 5 endpoint CRUD completi (GET, POST, PUT, DELETE)
- ✅ **API Templates**: 9 endpoint CRUD + sync (devices/connections templates)
- ✅ **Landing Page**: Service hub HTML con link a tutte le interfacce
- ✅ **Static Files**: Logo e favicon serviti da `/static/`
- ✅ **Pydantic Schemas**: Validation automatica input/output
- ✅ **CORS**: Configurato per frontend localhost

### IN DEVELOPMENT
- ⏳ **Authentication**: JWT endpoints (register, login) - Pianificato
- ⏳ **Export/Import**: Terraform/YAML endpoints - Pianificato

### ARCHITETTURA FINALE
```
Project (metadata container)
├── name, description, global_settings
└── Canvas[] (1-to-many)
    ├── Canvas 1: "Building A"
    │   ├── devices[] (JSONB)
    │   └── connections[] (JSONB)
    └── Canvas 2: "Building B"
```

## 📋 Indice Documentazione

### 🚀 Guide Rapide
- **[Quick Start](./quick_start.md)** - Setup in 5 minuti per iniziare subito
- **[.env.example](../.env.example)** - Template configurazione ambiente

### 📖 Guide Dettagliate

#### 1. [Introduzione e Analisi](./01_introduction_and_analysis.md)
- Panoramica progetto PixelCake
- Stack tecnologico e motivazioni architetturali
- Analisi completa frontend (TypeScript interfaces, localStorage)
- Sample topology e dimensioni dati

#### 2. [Schema Database](./02_database_schema.md)
- Schema PostgreSQL completo con JSONB
- Diagramma ER (Mermaid)
- Tabelle: users, projects, templates, preferences, versions
- Indexes e performance optimization
- Migration SQLite → PostgreSQL

#### 3. [Struttura Backend](./03_backend_structure.md)
- Albero cartelle completo
- Responsabilità di ogni modulo
- Setup Alembic per migrations
- Configurazione FastAPI

#### 4. [Modelli e Schemas](./04_models_and_schemas.md)
- SQLAlchemy ORM Models (User, Project, Template)
- Pydantic Schemas (FlowMap, NetworkDevice, Port, NIC, Connection)
- Validation rules e Config classes

#### 5. [API Reference](./05_api_reference.md)
- Tutti gli endpoint REST documentati
- Auth endpoints (register, login, me)
- Projects CRUD endpoints
- Templates endpoints
- Export/Import endpoints
- Request/Response examples con cURL

#### 6. [Autenticazione JWT](./06_authentication.md)
- Password hashing con bcrypt
- JWT token generation e verification
- FastAPI dependencies (get_current_user)
- Security best practices

#### 7. [Testing e Deployment](./07_testing_deployment.md)
- Struttura test con pytest
- Unit tests e integration tests
- Development setup (SQLite)
- Production deployment (PostgreSQL)
- Docker setup (opzionale)

#### 8. [Checklist e Troubleshooting](./08_checklist_troubleshooting.md)
- Installation checklist step-by-step
- Verification commands
- Common errors e soluzioni
- Performance tuning
- Security checklist

### 📊 Reference

#### 9. [SQL Queries Examples](./09_sql_examples.md)
- JSONB queries comuni
- Performance optimization queries
- Backup/Restore procedures

#### 10. [Frontend Integration](./10_frontend_integration.md)
- authStore.ts structure
- API client setup (axios)
- Authentication flow
- Projects sync workflow
- Error handling

---

## 🎯 Percorso Implementazione Consigliato

### Fase 1: Setup Base (1-2 ore)
1. Leggi [Quick Start](./quick_start.md)
2. Leggi [Introduzione](./01_introduction_and_analysis.md)
3. Configura ambiente con [.env.example](../.env.example)
4. Installa dipendenze da `requirements.txt`

### Fase 2: Database (1-2 ore)
1. Leggi [Schema Database](./02_database_schema.md)
2. Crea migrations con Alembic
3. Verifica schema creato

### Fase 3: Backend Core (2-3 ore)
1. Leggi [Struttura Backend](./03_backend_structure.md)
2. Crea struttura cartelle
3. Leggi [Modelli e Schemas](./04_models_and_schemas.md)
4. Implementa models e schemas

### Fase 4: API Endpoints (2-3 ore)
1. Leggi [Autenticazione JWT](./06_authentication.md)
2. Implementa auth endpoints
3. Leggi [API Reference](./05_api_reference.md)
4. Implementa projects CRUD

### Fase 5: Testing (1 ora)
1. Leggi [Testing](./07_testing_deployment.md)
2. Scrivi test per auth e projects
3. Verifica coverage

### Fase 6: Frontend Integration (1-2 ore)
1. Leggi [Frontend Integration](./10_frontend_integration.md)
2. Implementa authStore
3. Connetti UI con API

### Fase 7: Deployment (1 ora)
1. Leggi [Deployment](./07_testing_deployment.md)
2. Setup PostgreSQL production
3. Deploy con Uvicorn/Nginx

---

## 📊 Informazioni Chiave

### Dati da Persistere

| Store Frontend | LocalStorage Key | Dimensione | Backend Table |
|----------------|------------------|------------|---------------|
| projectStore (nuovo) | - | N/A | `projects` + `canvases` |
| networkStore | `pixelcake-network-v2` | ~50-70 KB | `canvases.devices` + `canvases.connections` (JSONB) |
| templateStore | `pixelcake-templates-v8` | ~10-20 KB | `device_templates`, `connection_templates` |
| uiStore | `pixelcake-ui-v1` | ~1 KB | `user_preferences` (JSONB) |
| userStore | `pixelcake-user-v1` | ~1 KB | `users` + `user_preferences` |

### Stack Tecnologico

**Backend:**
- Python 3.10+
- FastAPI 0.115.0+
- SQLAlchemy 2.0+ (async)
- PostgreSQL 14+ (JSONB support)
- Alembic 1.13+ (migrations)
- JWT authentication (python-jose)
- bcrypt password hashing

**Database Strategy:**
- **JSONB Hybrid Approach**: Schema relazionale + JSONB per FlowMap completo
- **Performance**: GIN indexes su colonne JSONB
- **Flessibilità**: Schema evolve senza breaking changes

### Sample Topology Tipico

- 33 devices (9 switch/router/firewall + 24 end devices)
- 42 connections
- Switch con 8-48 ports configurabili
- Server/PC con 1-2 NICs
- VLAN/STP configuration
- ~50-70 KB JSON serializzato

---

## 🔧 Tools e Comandi Utili

```bash
# Setup ambiente
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Database migrations
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head

# Run server
python main.py
# oppure
uvicorn app.main:app --reload

# Testing
pytest
pytest --cov=app tests/

# Admin panel
# Apri http://localhost:8000/admin
```

---

## 📞 Support

Per domande o problemi:
1. Consulta [Troubleshooting](./08_checklist_troubleshooting.md)
2. Verifica [SQL Examples](./09_sql_examples.md)
3. Rivedi [API Reference](./05_api_reference.md)

---

## 🎉 API Endpoint Implementati (19 totali)

### Projects API (`/api/projects`)
- `GET /api/projects` - Lista tutti progetti con canvas count
- `POST /api/projects` - Crea nuovo progetto (+ canvas di default)
- `GET /api/projects/{id}` - Dettaglio progetto con lista canvas
- `PUT /api/projects/{id}` - Aggiorna nome/descrizione/settings
- `DELETE /api/projects/{id}` - Elimina progetto (cascade)

### Canvases API (`/api/projects/{pid}/canvases`)
- `GET /api/projects/{pid}/canvases` - Lista canvas del progetto
- `POST /api/projects/{pid}/canvases` - Crea nuovo canvas
- `GET /api/projects/{pid}/canvases/{cid}` - Dettaglio canvas completo
- `PUT /api/projects/{pid}/canvases/{cid}` - Aggiorna canvas (devices/connections)
- `DELETE /api/projects/{pid}/canvases/{cid}` - Elimina canvas (con protezione)

### Templates API (`/api/templates`)
- `GET /api/templates/devices` - Lista tutti device templates (globali + custom utente)
- `POST /api/templates/devices` - Crea nuovo device template custom
- `PUT /api/templates/devices/{id}` - Aggiorna template custom (solo proprietario)
- `DELETE /api/templates/devices/{id}` - Elimina template custom
- `GET /api/templates/connections` - Lista tutti connection templates
- `POST /api/templates/connections` - Crea nuovo connection template custom
- `PUT /api/templates/connections/{id}` - Aggiorna template custom
- `DELETE /api/templates/connections/{id}` - Elimina template custom
- `POST /api/templates/sync` - Bulk sync templates (migrazione LocalStorage)

### Interfacce Web
- **Landing Page**: `GET /` - Service hub HTML con link a tutte le interfacce
- **Swagger Docs**: `GET /docs` - Documentazione API interattiva
- **ReDoc**: `GET /redoc` - Documentazione API alternativa
- **Admin Panel**: `GET /admin` - Gestione database SQLAdmin
- **Health Dashboard**: `GET /dashboard` - Monitoring sistema
- **Static Assets**: `/static/logo.svg`, `/static/favicon.svg`

---

**Nota**: Questa documentazione è stata creata per fornire una guida completa e autosufficiente per implementare il backend PixelCake. Ogni documento è standalone e può essere letto indipendentemente, ma seguire l'ordine consigliato sopra garantisce una comprensione progressiva e completa.

Ultimo aggiornamento: 2025-11-25
