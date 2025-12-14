# Multi-stage Dockerfile for Node.js backend with ffmpeg and Puppeteer

# Stage 1: Build stage
FROM node:22-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files for all workspaces
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY packages/shared-db/package.json ./packages/shared-db/

# Install dependencies
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

# Install system dependencies for ffmpeg and Puppeteer
RUN apt-get update && apt-get install -y \
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

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY packages/shared-db/package.json ./packages/shared-db/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/packages/shared-db/dist ./packages/shared-db/dist
COPY --from=builder /app/packages/shared-db/drizzle ./packages/shared-db/drizzle

# Create output directory for video processing
RUN mkdir -p /app/backend/output && chmod 777 /app/backend/output

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Run the application
CMD ["node", "dist/server.js"]
