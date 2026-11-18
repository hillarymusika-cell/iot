# IoT — Apex Sensor Studio

Soil-moisture sensor platform: ESP32 devices → Django API → React dashboard.

## Stack

| Layer | Tech |
|-------|------|
| Firmware | ESP32 / Arduino (`sensor/moistureSensor`) |
| Backend | Django 5 + DRF + SimpleJWT + **SQLite** (`api/`) |
| Frontend | React 18 (ESM importmap) + custom SVG chart |
| Ops | Docker Compose, GitHub Actions CI |

## Features

- **User auth** — signup / login / refresh / logout (JWT access + httpOnly refresh cookie, CSRF)
- **Device registration** — create a device, receive one-time `device_id` + `token`
- **Sensor ingest** — ESP32 posts `{"moisture": N}` with `Authorization: Bearer <token>` + `X-Device-ID`
- **Dashboard** — live moisture chart + analytics summary (`/api/sensors/analytics/`)
- **SQLite** — zero-config DB (persisted in Docker volume)
<<<<<<< HEAD
- **Docker** — `docker compose up --build`
- **CI** — Django checks/tests + backend and frontend Docker image builds on `master` / `main`
=======
- **Docker** — production-ready images + Compose healthchecks
- **CI** — pytest + Docker image build / smoke health on `master` / `main`
>>>>>>> 98561c7ee7127a896de576a7c5cf32bad7754b80

## Quick start (local, no Docker)

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export SECRET_KEY=dev DEBUG=true
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Second terminal:

```bash
python -m http.server 8080 --directory frontend
```

Open `http://localhost:8080`.

## Docker (local)

```bash
cp .env.example .env   # optional for local; required for prod values
docker compose up --build
# Frontend → http://localhost:8080
# API      → http://localhost:8000
# Health   → http://localhost:8000/health/
```

SQLite lives in volume `apex_sensor_sqlite` (`/data/db.sqlite3`).

## Docker (production-style host)

```bash
cp .env.example .env
# Edit .env: SECRET_KEY, ALLOWED_HOSTS, FRONTEND_URL, CORS_*, CSRF_*

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Notes:

- `DEBUG=false` refuses to start without a real `SECRET_KEY`
- Frontend nginx proxies `/api/` and `/health/` to the `backend` service
- Gunicorn workers: set `WEB_CONCURRENCY` (default 2 local / 3 prod overlay)
- Behind TLS (Render, Caddy, nginx): `X-Forwarded-Proto` is trusted for secure cookies

### Render (API service)

| Setting | Value |
|---------|--------|
| Root Directory | repository root |
| Dockerfile Path | `api/Dockerfile` |
| Health Check Path | `/health/` |
| `ALLOWED_HOSTS` | `firmwarebackend.onrender.com` |
| `FRONTEND_URL` | `https://apex-sensor-lab.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://apex-sensor-lab.onrender.com` |
| `CSRF_TRUSTED_ORIGINS` | `https://apex-sensor-lab.onrender.com` |
| Other required env | `SECRET_KEY`, `DEBUG=false` |

Persistent disk (optional): mount at `/data` and set `SQLITE_PATH=/data/db.sqlite3`.

### Render (frontend service)

Create a separate Docker Web Service for the dashboard:

| Setting | Value |
|---------|--------|
| Root Directory | repository root |
| Dockerfile Path | `frontend/Dockerfile` |
| Health Check Path | `/health/` |

The frontend uses `https://firmwarebackend.onrender.com` as its production API origin. Set the API service's CORS and CSRF trusted origins to the frontend service's exact `https://...onrender.com` URL.

## API map

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | — | Landing page |
| GET | `/api/` | — | Discover endpoints |
| GET | `/health/` | — | Health check |
| GET | `/api/health/` | — | Health check (alias) |
| GET | `/api/auth/csrf/` | — | CSRF cookie + token |
| POST | `/api/auth/signup/` | — | Create account |
| POST | `/api/auth/login/` | — | Login |
| POST | `/api/auth/refresh/` | cookie | New access token |
| POST | `/api/auth/logout/` | JWT | Blacklist refresh |
| POST | `/api/devices/` | JWT | Register device |
| GET | `/api/sensors/readings/` | — | Time-series |
| POST | `/api/sensors/readings/` | Device token | Ingest reading |
| GET | `/api/sensors/analytics/` | — | Aggregates |

## ESP32 credentials

After registering a device in the UI, put values into `sensor/moistureSensor/credentials.h`:

```cpp
namespace credentials {
  const char *wifi = "...";
  const char *wifiPassword = "...";
  const char *server_url = "http://<host>:8000/api/sensors/readings/";
  const char *device_id = "<uuid>";
  const char *device_token = "<token>";
}
```

Use a LAN IP or public API host — not `localhost` on the ESP32.

## Tests

```bash
cd api
export SECRET_KEY=dev DEBUG=true
pytest -q
```
