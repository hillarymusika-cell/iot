# syntax=docker/dockerfile:1.7
# Apex Sensor Studio — Django API (SQLite + Gunicorn)
#
# Build context MUST be the api/ directory (where requirements.txt lives):
#   docker compose  →  context: ./api
#   CLI             →  docker build -f api/Dockerfile api
#   Render          →  Root Directory = api
#
# Runtime env (required in prod):
#   SECRET_KEY, ALLOWED_HOSTS, FRONTEND_URL, CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS

FROM python:3.12-slim-bookworm AS deps

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /build

# requirements.txt is at the root of the build context (api/requirements.txt on the host)
COPY requirements.txt /build/requirements.txt
RUN python -m venv /opt/venv \
 && pip install --upgrade pip \
 && pip install -r /build/requirements.txt

FROM python:3.12-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="apex-sensor-api" \
      org.opencontainers.image.description="Apex Sensor Studio Django API" \
      org.opencontainers.image.source="https://github.com/hillarymusika-cell/iot"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings \
    PORT=8000 \
    SQLITE_PATH=/data/db.sqlite3 \
    WEB_CONCURRENCY=2 \
    GUNICORN_TIMEOUT=60 \
    GUNICORN_GRACEFUL_TIMEOUT=30 \
    DEBUG=false

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1000 app \
 && useradd --system --uid 1000 --gid app --home /app --shell /usr/sbin/nologin app \
 && mkdir -p /data /app \
 && chown -R app:app /data /app

WORKDIR /app

COPY --from=deps /opt/venv /opt/venv
COPY --chown=app:app . .

RUN chmod +x /app/entrypoint.sh \
 && SECRET_KEY=build-only-not-for-runtime \
    DEBUG=false \
    ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health/" || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
