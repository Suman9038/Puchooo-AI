#!/bin/sh
set -e

echo "🚀 [Puchooo AI] Initializing Container..."

# Attempt Alembic DB upgrade if database is reachable
if [ -n "$LOCAL_DATABASE_URL" ]; then
    echo "📦 Checking and applying database migrations..."
    alembic upgrade head || echo "⚠️ Alembic migration skipped or up to date."
fi

echo "⚡ [Puchooo AI] Launching FastAPI and Celery Worker via Supervisord..."
exec supervisord -c /app/supervisord.conf

