#!/usr/bin/env bash
# ==============================================================================
# Puchooo AI Service Manager (FastAPI + Celery)
# Usage:
#   ./run.sh start    - Start both Celery worker & FastAPI server in background
#   ./run.sh stop     - Stop all services cleanly
#   ./run.sh restart  - Restart both services
#   ./run.sh status   - Check status and running processes
#   ./run.sh logs     - Live tail logs
# ==============================================================================

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

VENV_DIR="$APP_DIR/.venv"
LOG_DIR="$APP_DIR/logs"
PID_DIR="$APP_DIR/.run"

mkdir -p "$LOG_DIR" "$PID_DIR"

CELERY_PID_FILE="$PID_DIR/celery.pid"
UVICORN_PID_FILE="$PID_DIR/uvicorn.pid"

FASTAPI_LOG="$LOG_DIR/fastapi.log"
CELERY_LOG="$LOG_DIR/celery.log"

# Detect Python binaries
if [ -f "$VENV_DIR/bin/python" ]; then
    PYTHON="$VENV_DIR/bin/python"
    CELERY="$VENV_DIR/bin/celery"
    UVICORN="$VENV_DIR/bin/uvicorn"
else
    PYTHON="$(command -v python3 || command -v python)"
    CELERY="$(command -v celery)"
    UVICORN="$(command -v uvicorn)"
fi

export PYTHONPATH="$APP_DIR"
export PYTHONUNBUFFERED="1"
export C_FORCE_ROOT="true"
PORT="${PORT:-8000}"

is_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

start_services() {
    echo "=========================================="
    echo " Starting Puchooo AI Services"
    echo "=========================================="

    # 1. Run DB migrations
    echo "▶ Checking database migrations (Alembic)..."
    if [ -f "$VENV_DIR/bin/alembic" ]; then
        "$VENV_DIR/bin/alembic" upgrade head || echo " Alembic check completed with warnings."
    fi

    # 2. Start Celery Worker
    if is_running "$CELERY_PID_FILE"; then
        echo "  Celery worker is already running (PID: $(cat "$CELERY_PID_FILE"))."
    else
        echo " Starting Celery worker in background..."
        nohup "$CELERY" -A app.worker.celery.celery_app worker --loglevel=info --pool=solo > "$CELERY_LOG" 2>&1 &
        local celery_pid=$!
        echo "$celery_pid" > "$CELERY_PID_FILE"
        sleep 2
        if kill -0 "$celery_pid" 2>/dev/null; then
            echo " Celery worker started successfully (PID: $celery_pid)."
        else
            echo " Celery failed to start. Check $CELERY_LOG"
        fi
    fi

    # 3. Start FastAPI Server
    if is_running "$UVICORN_PID_FILE"; then
        echo "  FastAPI/Uvicorn is already running (PID: $(cat "$UVICORN_PID_FILE"))."
    else
        echo "▶ Starting FastAPI (Uvicorn) on port $PORT in background..."
        nohup "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" > "$FASTAPI_LOG" 2>&1 &
        local uvicorn_pid=$!
        echo "$uvicorn_pid" > "$UVICORN_PID_FILE"
        sleep 2
        if kill -0 "$uvicorn_pid" 2>/dev/null; then
            echo "✅ FastAPI started successfully (PID: $uvicorn_pid) on http://0.0.0.0:$PORT."
        else
            echo "❌ FastAPI failed to start. Check $FASTAPI_LOG"
        fi
    fi

    echo "=========================================="
    echo " Logs:"
    echo "   FastAPI : $FASTAPI_LOG"
    echo "   Celery  : $CELERY_LOG"
    echo " Commands:"
    echo "   ./run.sh status  (view status)"
    echo "   ./run.sh logs    (live stream logs)"
    echo "   ./run.sh stop    (stop services)"
    echo "=========================================="
}

stop_services() {
    echo "=========================================="
    echo " Stopping Puchooo AI Services"
    echo "=========================================="

    # Stop FastAPI
    if is_running "$UVICORN_PID_FILE"; then
        local pid
        pid=$(cat "$UVICORN_PID_FILE")
        echo "▶ Stopping FastAPI (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        for _ in {1..5}; do
            if ! kill -0 "$pid" 2>/dev/null; then break; fi
            sleep 1
        done
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$UVICORN_PID_FILE"
        echo "✅ FastAPI stopped."
    else
        echo "ℹ️  FastAPI is not running."
        rm -f "$UVICORN_PID_FILE"
    fi

    # Stop Celery
    if is_running "$CELERY_PID_FILE"; then
        local pid
        pid=$(cat "$CELERY_PID_FILE")
        echo "▶ Stopping Celery worker (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        for _ in {1..5}; do
            if ! kill -0 "$pid" 2>/dev/null; then break; fi
            sleep 1
        done
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$CELERY_PID_FILE"
        echo "✅ Celery worker stopped."
    else
        echo "ℹ️  Celery worker is not running."
        rm -f "$CELERY_PID_FILE"
    fi

    # Fallback cleanup for any stray processes
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "celery -A app.worker.celery.celery_app" 2>/dev/null || true

    echo "=========================================="
    echo " All services stopped."
    echo "=========================================="
}

status_services() {
    echo "=========================================="
    echo " Puchooo AI Service Status"
    echo "=========================================="

    if is_running "$UVICORN_PID_FILE"; then
        echo "● FastAPI (Uvicorn) : RUNNING (PID: $(cat "$UVICORN_PID_FILE"), Port: $PORT)"
    else
        echo "○ FastAPI (Uvicorn) : STOPPED"
    fi

    if is_running "$CELERY_PID_FILE"; then
        echo "● Celery Worker     : RUNNING (PID: $(cat "$CELERY_PID_FILE"))"
    else
        echo "○ Celery Worker     : STOPPED"
    fi

    echo "=========================================="
}

tail_logs() {
    echo "Tailing logs (Press Ctrl+C to exit)..."
    tail -f -n 20 "$FASTAPI_LOG" "$CELERY_LOG"
}

case "${1:-start}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 1
        start_services
        ;;
    status)
        status_services
        ;;
    logs)
        tail_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
