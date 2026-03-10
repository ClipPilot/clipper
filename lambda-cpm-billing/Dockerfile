# Multi-stage Dockerfile for cpm-billing Lambda
# Must be built from repo root: docker build -f lambda-cpm-billing/Dockerfile .

# Stage 1: Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files for all workspaces
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lambda-cpm-billing/package.json ./lambda-cpm-billing/
COPY packages/shared-db/package.json ./packages/shared-db/

# Install ALL dependencies (including dev dependencies for build)
RUN pnpm install

# Copy source code
COPY lambda-cpm-billing ./lambda-cpm-billing
COPY packages/shared-db ./packages/shared-db

# Build shared-db first
WORKDIR /app/packages/shared-db
RUN pnpm run build

# Build lambda
WORKDIR /app/lambda-cpm-billing
RUN pnpm run build

# Stage 2: Production Lambda stage
FROM public.ecr.aws/lambda/nodejs:20

# Install pnpm for workspace resolution
RUN npm install -g pnpm

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lambda-cpm-billing/package.json ./lambda-cpm-billing/
COPY packages/shared-db/package.json ./packages/shared-db/

# Install production dependencies only
RUN pnpm install --prod

# Copy built files
COPY --from=builder /app/lambda-cpm-billing/dist ./lambda-cpm-billing/dist
COPY --from=builder /app/packages/shared-db/dist ./packages/shared-db/dist

CMD [ "lambda-cpm-billing/dist/handler.handler" ]
