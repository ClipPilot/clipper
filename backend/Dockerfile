# Multi-stage Dockerfile for Node.js backend with ffmpeg, Puppeteer, and TensorFlow

# Stage 1: Build stage
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY packages/shared-db/package.json ./packages/shared-db/

RUN pnpm install --frozen-lockfile

# Rebuild tfjs-node native addon from source for Linux
RUN TFJS_DIR=$(find /app/node_modules/.pnpm -type d -name "tfjs-node" -path "*/@tensorflow/tfjs-node" | head -1) \
    && cd "$TFJS_DIR" \
    && npm run build-addon-from-source

COPY backend ./backend
COPY packages/shared-db ./packages/shared-db

WORKDIR /app/packages/shared-db
RUN pnpm run build

WORKDIR /app/backend
RUN pnpm run build

# Stage 2: Production stage
FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    ffmpeg \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Puppeteer
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

COPY --from=builder /app ./

RUN mkdir -p /app/backend/output && chmod 777 /app/backend/output

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PUPPETEER_SKIP_DOWNLOAD=true

CMD ["node", "backend/dist/server.js"]
