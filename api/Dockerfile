# syntax=docker/dockerfile:1.7
# Apex Sensor Studio — Django API (SQLite + Gunicorn)
#
# Supported build contexts:
#   A) context = api/     (docker compose, Render Root Directory = api)
#        → requirements.txt is at context root
#   B) context = repo root (Render Dockerfile Path = api/Dockerfile, Root = .)
#        → requirements live at api/requirements.txt
#
# CLI examples:
#   docker build -f api/Dockerfile api
#   docker build -f api/Dockerfile .

FROM python:3.12-slim-bookworm AS deps

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /build

# Bring in whichever layout the context provides (wildcards allow missing paths on BuildKit)
COPY requirements.txt* api/requirements.txt* ./

RUN set -eux; \
    if [ -f requirements.txt ] && ! grep -q '^-r ' requirements.txt 2>/dev/null; then \
      REQ=requirements.txt; \
    elif [ -f api/requirements.txt ]; then \
      REQ=api/requirements.txt; \
    elif [ -f requirements.txt ]; then \
      REQ=requirements.txt; \
    else \
      echo "ERROR: could not find requirements.txt in build context" >&2; \
      find . -maxdepth 3 -type f -print >&2; \
      exit 1; \
    fi; \
    echo "Using dependency file: $REQ"; \
    python -m venv /opt/venv; \
    pip install --upgrade pip; \
    pip install -r "$REQ"

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

# App sources: context may be api/ or repo root
COPY --chown=app:app . /tmp/context/
RUN set -eux; \
    if [ -f /tmp/context/manage.py ]; then \
      cp -a /tmp/context/. /app/; \
    elif [ -f /tmp/context/api/manage.py ]; then \
      cp -a /tmp/context/api/. /app/; \
    else \
      echo "ERROR: manage.py not found (expected api app in context)" >&2; \
      find /tmp/context -maxdepth 3 -type f -print >&2; \
      exit 1; \
    fi; \
    rm -rf /tmp/context; \
    chmod +x /app/entrypoint.sh; \
    SECRET_KEY=build-only-not-for-runtime DEBUG=false ALLOWED_HOSTS=localhost \
      python manage.py collectstatic --noinput; \
    chown -R app:app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health/" || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
