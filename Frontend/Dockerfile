# ==============================================================================
# Multi-Stage Dockerfile for Puchooo AI React/Vite Frontend
# ==============================================================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Cache dependencies layer
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Set API base url argument (empty string for same-origin Nginx reverse proxying)
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build production bundle
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:alpine AS runner

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom reverse-proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
