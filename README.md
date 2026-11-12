# IoT — Apex Sensor Studio

Soil-moisture sensor platform: ESP32 devices → Django API → React dashboard.

## Stack

| Layer | Tech |
|-------|------|
| Firmware | ESP32 / Arduino (`sensor/moistureSensor`) |
| Backend | Django 5 + DRF + SimpleJWT + PostgreSQL |
| Frontend | React 18 (ESM importmap) + custom SVG chart |
| Ops | Docker Compose, GitHub Actions CI |

## Features

- **User auth** — signup / login / refresh / logout (JWT access + httpOnly refresh cookie, CSRF)
- **Device registration** — create a device, receive one-time `device_id` + `token`
- **Sensor ingest** — ESP32 posts `{"moisture": N}` with `Authorization: Bearer <token>` + `X-Device-ID`
- **Dashboard** — live moisture chart + analytics summary (`/api/sensors/analytics/`)
- **Docker** — `docker compose up --build`
- **CI** — lint/check + pytest + image build on `master` / `main`

## Quick start (local)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export SECRET_KEY=dev DEBUG=true
python manage.py migrate
python manage.py runserver 8000

# Frontend (static)
# open frontend/index.html or serve with any static server on :8080
# API base auto-detects localhost:8000
```

## Docker

```bash
docker compose up --build
# Frontend → http://localhost:8080
# API      → http://localhost:8000
# Health   → http://localhost:8000/health/
```

## API map (matches existing frontend)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/csrf/` | — | CSRF cookie + token |
| POST | `/api/auth/signup/` | — | Create account → access JWT |
| POST | `/api/auth/login/` | — | Login → access JWT |
| POST | `/api/auth/refresh/` | cookie | New access token |
| POST | `/api/auth/logout/` | JWT | Blacklist refresh |
| POST | `/api/devices/` | JWT | Register device → `{device_id, token}` |
| GET | `/api/sensors/readings/` | — | Time-series for chart |
| POST | `/api/sensors/readings/` | Device token | Ingest reading |
| GET | `/api/sensors/analytics/` | — | Aggregates (avg/min/max) |

## ESP32 credentials

After registering a device in the UI, put the values into `sensor/moistureSensor/credentials.h`:

```cpp
namespace credentials {
  const char *wifi = "...";
  const char *wifiPassword = "...";
  const char *server_url = "http://<host>:8000/api/sensors/readings/";
  const char *device_id = "<uuid>";
  const char *device_token = "<token>";
}
```

## Tests

```bash
cd backend
pytest -q
```
