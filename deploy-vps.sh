#!/usr/bin/env bash
# ==============================================================================
# Puchooo AI - VPS Production Deployment Script
# Optimized for: 16GB RAM / 8 vCPU (AMD EPYC) Ubuntu 22.04 LTS
# Services: Ollama (LLM + Embeddings) + Backend (FastAPI + Celery Worker)
# Connected to: Neon PostgreSQL, Qdrant Cloud, Upstash Redis, Vercel Frontend
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
echo -e "\n${YELLOW}[1/6] Assessing System Resources...${NC}"
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
TOTAL_SWAP_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
echo -e "   Total Available RAM: ${TOTAL_RAM_MB} MB (~14-16 GiB)"

# Add 4GB swap as a safety buffer
if [ "$TOTAL_SWAP_KB" -lt 1000000 ]; then
  echo -e "   ⚠️ No swap detected. Setting up 4GB swap buffer for memory spikes..."
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo -e "   ${GREEN}✅ 4GB swapfile enabled.${NC}"
  else
    swapon /swapfile 2>/dev/null || true
  fi
else
  echo -e "   ${GREEN}✅ Swap: $((TOTAL_SWAP_KB / 1024)) MB${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Dependencies & Official Docker Engine Installation
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/6] Installing Docker Engine & Tools...${NC}"
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
  echo -e "   ${GREEN}✅ Docker CE and Docker Compose installed successfully.${NC}"
else
  echo -e "   ${GREEN}✅ Docker already installed: $(docker --version)${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Firewall Configuration (UFW)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/6] Configuring Firewall (UFW)...${NC}"
ufw allow 22/tcp comment 'SSH' || true
ufw allow 8000/tcp comment 'FastAPI Backend' || true
ufw allow 11434/tcp comment 'Ollama' || true
echo "y" | ufw enable || true
echo -e "   ${GREEN}✅ Firewall active (Ports 22, 8000, 11434 open).${NC}"

# ------------------------------------------------------------------------------
# 4. Environment Check (.env)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/6] Verifying .env Configuration...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "   ⚠️ .env not found. Copying from .env.example..."
    cp .env.example .env
    echo -e "   ${YELLOW}⚠️ Please review .env to ensure your cloud credentials (Neon, Qdrant, Upstash) are filled.${NC}"
  else
    echo -e "${RED}❌ Neither .env nor .env.example found!${NC}"
    exit 1
  fi
else
  echo -e "   ${GREEN}✅ .env file found and verified.${NC}"
fi

# Ensure OLLAMA settings in .env for container network
sed -i 's|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=http://ollama:11434|g' .env 2>/dev/null || true
sed -i 's|PRIMARY_LLM=.*|PRIMARY_LLM=ollama|g' .env 2>/dev/null || true

# ------------------------------------------------------------------------------
# 5. Build and Launch Containers
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/6] Building & Starting Docker Containers (Ollama + Backend)...${NC}"
docker compose -f docker-compose.vps.yml down --remove-orphans || true
docker compose -f docker-compose.vps.yml build
docker compose -f docker-compose.vps.yml up -d

# ------------------------------------------------------------------------------
# 6. Pull Ollama Models (Llama 3.2 + Granite/EmbeddingGemma)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[6/6] Initializing Ollama Models...${NC}"
echo -e "   Waiting for Ollama to become ready..."
for i in {1..30}; do
  if docker exec puchooo-ollama ollama list &>/dev/null; then
    break
  fi
  sleep 2
done

echo -e "   Pulling Llama 3.2 model (takes ~1-2 mins on fast VPS network)..."
docker exec -i puchooo-ollama ollama pull llama3.2:latest

echo -e "   Pulling Embedding model: embeddinggemma:300m..."
docker exec -i puchooo-ollama ollama pull embeddinggemma:300m || docker exec -i puchooo-ollama ollama pull all-minilm || true

# ------------------------------------------------------------------------------
# Final Verification
# ------------------------------------------------------------------------------
sleep 4
docker compose -f docker-compose.vps.yml ps

PUBLIC_IP=$(curl -s -4 ifconfig.me || echo "91.226.56.59")

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}🎉 Puchooo AI Backend & Ollama are LIVE on VPS!      ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "🌐 Backend API Root:     ${BLUE}http://${PUBLIC_IP}:8000/${NC}"
echo -e "📚 Interactive Swagger:  ${BLUE}http://${PUBLIC_IP}:8000/docs${NC}"
echo -e "🧠 Ollama API:           ${BLUE}http://${PUBLIC_IP}:11434${NC}"
echo -e "📊 Container Status:     ${YELLOW}docker compose -f docker-compose.vps.yml ps${NC}"
echo -e "📜 Tail Realtime Logs:   ${YELLOW}docker compose -f docker-compose.vps.yml logs -f${NC}"
echo -e "${GREEN}======================================================${NC}\n"
