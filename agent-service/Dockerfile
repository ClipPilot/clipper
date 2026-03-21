# Multi-stage Dockerfile for Mastra Agent Service

# Stage 1: Build
FROM node:22-slim AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY agent-service/package.json ./agent-service/
COPY packages/shared-db/package.json ./packages/shared-db/

RUN pnpm install --frozen-lockfile

COPY agent-service ./agent-service
COPY packages/shared-db ./packages/shared-db

WORKDIR /app/packages/shared-db
RUN pnpm run build

WORKDIR /app/agent-service
RUN pnpm run build

# Stage 2: Production
FROM node:22-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/agent-service/.mastra/output ./

ENV NODE_ENV=production \
    PORT=4111

EXPOSE 4111

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4111/health || exit 1

CMD ["node", "index.mjs"]
