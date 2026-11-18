#!/bin/sh
set -eu

PORT="${PORT:-8000}"
SQLITE_PATH="${SQLITE_PATH:-/data/db.sqlite3}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-60}"
GUNICORN_GRACEFUL_TIMEOUT="${GUNICORN_GRACEFUL_TIMEOUT:-30}"

# Fail fast if production secret is missing or still a placeholder
if [ -z "${SECRET_KEY:-}" ] || [ "$SECRET_KEY" = "" ] || [ "$SECRET_KEY" = "build-only-not-for-runtime" ]; then
  if [ "${DEBUG:-false}" != "true" ] && [ "${DEBUG:-false}" != "1" ]; then
    echo "ERROR: SECRET_KEY must be set to a strong value when DEBUG is false." >&2
    exit 1
  fi
  export SECRET_KEY="${SECRET_KEY:-dev-insecure-key-only-for-local}"
  echo "WARNING: using insecure SECRET_KEY (DEBUG mode)." >&2
fi

mkdir -p "$(dirname "$SQLITE_PATH")"

echo "Running migrations..."
python manage.py migrate --noinput

<<<<<<< HEAD
echo "Starting gunicorn on 0.0.0.0:${PORT}"
=======
echo "Collecting static files..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo "Starting gunicorn on 0.0.0.0:${PORT} (workers=${WEB_CONCURRENCY})"
>>>>>>> 98561c7ee7127a896de576a7c5cf32bad7754b80
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${WEB_CONCURRENCY}" \
  --timeout "${GUNICORN_TIMEOUT}" \
  --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT}" \
  --keep-alive 5 \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  --enable-stdio-inheritance
