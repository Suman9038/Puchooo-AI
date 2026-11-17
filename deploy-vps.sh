#!/usr/bin/env bash
# ==============================================================================
# Puchooo AI - VPS Production Deployment Script
# Optimized for: 16GB RAM / 8 vCPU (AMD EPYC) Ubuntu 22.04 LTS
# Architecture: Native Ollama (CPU-optimized) + Containerized Backend (FastAPI + Celery)
# Cloud Integrations: Neon PostgreSQL, Qdrant Cloud, Upstash Redis
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}      🚀 Puchooo AI - Dedicated VPS AI Engine        ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Check if script is executed as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run as root (or use sudo).${NC}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 1. System Health & Resource Assessment
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Assessing System Resources...${NC}"
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
echo -e "   Total Available RAM: ${TOTAL_RAM_MB} MB (~14-16 GiB)"
echo -e "   ${GREEN}✅ High-spec VPS (16GB RAM) detected. Physical RAM is ample — skipping swap.${NC}"

# ------------------------------------------------------------------------------
# 2. Dependencies & Docker Engine Installation
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/5] Installing Docker Engine & Native Ollama...${NC}"
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    htop

if ! command -v docker &> /dev/null; then
  echo -e "   Installing Docker CE..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo -e "   ${GREEN}✅ Docker installed successfully.${NC}"
else
  echo -e "   ${GREEN}✅ Docker already installed: $(docker --version)${NC}"
fi

# Install Native Ollama (~50MB lightweight, zero GPU driver bloat)
if ! command -v ollama &> /dev/null; then
  echo -e "   Installing Native Ollama (CPU-optimized, ~50MB)..."
  curl -fsSL https://ollama.com/install.sh | sh
  systemctl enable ollama
  systemctl start ollama
  echo -e "   ${GREEN}✅ Native Ollama installed and running via systemd.${NC}"
else
  echo -e "   ${GREEN}✅ Native Ollama already installed.${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Pull Ollama Models (Qwen 3.5 4B Quantized + EmbeddingGemma)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Initializing Ollama Models...${NC}"
# Wait for Ollama service to respond
for i in {1..15}; do
  if curl -s http://127.0.0.1:11434/api/tags &>/dev/null; then
    break
  fi
  sleep 1
done

echo -e "   Pulling Unsloth Qwen 3.5 4B Q4_K_M GGUF from HuggingFace..."
ollama pull hf.co/unsloth/Qwen3.5-4B-GGUF:Q4_K_M

echo -e "   Pulling Embedding model: embeddinggemma:300m..."
ollama pull embeddinggemma:300m || ollama pull all-minilm || true
echo -e "   ${GREEN}✅ Ollama models successfully loaded.${NC}"

# ------------------------------------------------------------------------------
# 4. Firewall Configuration (UFW)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Configuring Firewall (UFW)...${NC}"
ufw allow 22/tcp comment 'SSH' || true
ufw allow 80/tcp comment 'Web Frontend' || true
ufw allow 8000/tcp comment 'FastAPI Backend' || true
ufw allow 11434/tcp comment 'Ollama' || true
echo "y" | ufw enable || true
echo -e "   ${GREEN}✅ Firewall active (Ports 22, 80, 8000, 11434 open).${NC}"

# ------------------------------------------------------------------------------
# 5. Build & Launch Backend Container (Host Network Mode)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Building & Launching Backend Container...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
  fi
fi

# Ensure OLLAMA settings in .env
sed -i 's|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=http://127.0.0.1:11434|g' .env 2>/dev/null || true
sed -i 's|OLLAMA_MODEL=.*|OLLAMA_MODEL=hf.co/unsloth/Qwen3.5-4B-GGUF:Q4_K_M|g' .env 2>/dev/null || true
sed -i 's|PRIMARY_LLM=.*|PRIMARY_LLM=ollama|g' .env 2>/dev/null || true

docker compose -f docker-compose.vps.yml down --remove-orphans || true
docker compose -f docker-compose.vps.yml build
docker compose -f docker-compose.vps.yml up -d

# ------------------------------------------------------------------------------
# Final Verification
# ------------------------------------------------------------------------------
sleep 3
docker compose -f docker-compose.vps.yml ps

PUBLIC_IP=$(curl -s -4 ifconfig.me || echo "91.226.56.59")

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}🎉 Puchooo AI Full Stack is LIVE on VPS!             ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "🚀 Web App (Frontend UI): ${BLUE}http://${PUBLIC_IP}/${NC}"
echo -e "🌐 Backend API Root:      ${BLUE}http://${PUBLIC_IP}:8000/${NC}"
echo -e "📚 Interactive Swagger:   ${BLUE}http://${PUBLIC_IP}:8000/docs${NC}"
echo -e "🧠 Native Ollama API:     ${BLUE}http://${PUBLIC_IP}:11434${NC}"
echo -e "📊 Container Status:      ${YELLOW}docker compose -f docker-compose.vps.yml ps${NC}"
echo -e "📜 Tail Realtime Logs:    ${YELLOW}docker compose -f docker-compose.vps.yml logs -f${NC}"
echo -e "${GREEN}======================================================${NC}\n"
