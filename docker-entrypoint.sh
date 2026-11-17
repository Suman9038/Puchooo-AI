#!/bin/sh
set -e

echo "🚀 [Puchooo AI] Initializing Container..."

# Attempt Alembic DB upgrade if database is reachable
if [ -n "$LOCAL_DATABASE_URL" ]; then
    echo "📦 Checking database connectivity & running migrations..."
    for i in 1 2 3 4 5; do
        if alembic upgrade head; then
            echo "✅ Database migrations applied successfully."
            break
        else
            echo "⏳ Database not ready yet or migration pending, retrying in 3 seconds ($i/5)..."
            sleep 3
        fi
    done
fi

echo "⚡ [Puchooo AI] Launching FastAPI and Celery Worker via Supervisord..."
exec supervisord -c /app/supervisord.conf
