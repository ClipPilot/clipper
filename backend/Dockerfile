# Multi-stage Dockerfile for Node.js backend with ffmpeg and Puppeteer

# Stage 1: Build stage
FROM node:22-slim AS builder

# Install pnpm and build dependencies for native modules (tensorflow)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

# Copy package files for all workspaces
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY packages/shared-db/package.json ./packages/shared-db/

# Install ALL dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY backend ./backend
COPY packages/shared-db ./packages/shared-db

# Build shared-db first
WORKDIR /app/packages/shared-db
RUN pnpm run build

# Build backend
WORKDIR /app/backend
RUN pnpm run build

# Stage 2: Production stage
FROM node:22-slim

# Install system dependencies for ffmpeg, Puppeteer, and TensorFlow native addon
RUN apt-get update && apt-get install -y \
    # TensorFlow native runtime dependencies
    libstdc++6 \
    # ffmpeg and dependencies
    ffmpeg \
    # Puppeteer/Chrome dependencies
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
    # Additional utilities
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Puppeteer
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy entire workspace from builder (this preserves pnpm's symlink structure)
COPY --from=builder /app ./

# Create output directory for video processing
RUN mkdir -p /app/backend/output && chmod 777 /app/backend/output

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PUPPETEER_SKIP_DOWNLOAD=true

# Run the application from the monorepo root
CMD ["node", "backend/dist/server.js"]
