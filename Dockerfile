# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

# Install dumb-init for PID 1 handling
RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Copy dependency manifests and install production only
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev --ignore-scripts
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist/

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

USER appuser

EXPOSE 3000

# Use dumb-init to properly handle signals for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
