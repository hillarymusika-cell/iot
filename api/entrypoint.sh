#!/bin/sh
set -e

PORT="${PORT:-8000}"
SQLITE_PATH="${SQLITE_PATH:-/data/db.sqlite3}"

mkdir -p "$(dirname "$SQLITE_PATH")"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo "Starting gunicorn on 0.0.0.0:${PORT}"
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
