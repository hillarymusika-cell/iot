# syntax=docker/dockerfile:1.7
# Repo-root entrypoint for hosts that always build from the repository root
# (some Render setups). Prefer api/Dockerfile with Root Directory = api.
#
#   docker build -f Dockerfile .

FROM python:3.12-slim-bookworm AS deps

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /build

# Canonical requirements live in api/; root requirements.txt is only a pointer.
# Copy the real file so pip does not try to resolve -r api/requirements.txt
# inside a stage that has no api/ tree.
COPY api/requirements.txt .
RUN python -m venv /opt/venv \
 && pip install --upgrade pip \
 && pip install -r requirements.txt

FROM python:3.12-slim-bookworm AS runtime

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
COPY --chown=app:app api/ .

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
