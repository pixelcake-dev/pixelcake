# PixelCake backend

A small FastAPI service that stores projects, boards and templates in a SQLite file. It is optional: the reachability check and the terminal run in the browser and never call it. Without it the app still works, but you cannot create or open named projects.

> **Warning.** There is no login: the API uses one fixed user and the admin panel is open. For that reason `python main.py` only listens on the machine it runs on (`127.0.0.1`). Do not expose it to a network or run it on a server.

## Setup

Python 3.10 or later.

```bash
python -m venv venv
venv\Scripts\activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env         # Linux/macOS: cp .env.example .env
alembic upgrade head           # creates database.db
python -m scripts.seed_templates
python main.py
```

The server starts on port 8000.

| Address | What it is |
|---|---|
| `/` | Landing page |
| `/docs` | Interactive API documentation |
| `/docs/terminal` | Reference for the terminal command language |
| `/admin` | Database admin panel |
| `/dashboard` | Health page |

## API

| Group | Endpoints | Path |
|---|---|---|
| Projects | 5 | `/api/projects` |
| Boards (canvases) | 5 | `/api/projects/{id}/canvases` |
| Templates | 9 | `/api/templates` |

Each board is stored as JSON: the devices and the links exactly as the frontend sends them. The backend does not validate the topology and knows nothing about networking.

## Database

SQLite by default, in `database.db`, which git ignores. Schema changes go through Alembic:

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

PostgreSQL drivers are in `requirements.txt`, but that path has not been tested.

## What is missing

- Authentication and per-user data.
- Automated tests.
- Validation of what the frontend sends.

The files in [docs/](docs/) are early design notes. Parts of them describe features that were planned and never built, such as login and IaC endpoints.
