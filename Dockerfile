# ==============================================================================
# Multi-Stage Dockerfile for Puchooo AI Backend + Celery Worker
# Designed for Zero-Cost Deployments (Render, Koyeb, Railway, Fly.io, Self-Hosted)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=2.1.1 \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Install build tools and C compiler libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}"

# Install Python dependencies using poetry.lock for exact reproducibility
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root
RUN .venv/bin/pip install --no-cache-dir sentence-transformers

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MALLOC_TRIM_THRESHOLD_=100000 \
    HF_HOME="/app/.hf_cache" \
    PATH="/app/.venv/bin:$PATH"

# Install production shared libraries:
# - libpq5: PostgreSQL C client
# - supervisor: Runs FastAPI + Celery Worker inside a single free container
# - curl: Container healthcheck probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy isolated virtualenv from builder
COPY --from=builder /app/.venv /app/.venv

# Pre-cache IBM Granite 97M Multilingual R2 model during docker build so runtime startup is instant (<1s) and requires 0 network at runtime
RUN python -c "from langchain_huggingface import HuggingFaceEmbeddings; HuggingFaceEmbeddings(model_name='ibm-granite/granite-embedding-97m-multilingual-r2', cache_folder='/app/.hf_cache')"

# Copy application source code
COPY . .

# Configure permissions for entrypoint
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 10000

# Container healthcheck probe against root endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/ || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]

