# Multi-stage build for smaller image size
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S dbsync && \
    adduser -S -u 1001 -G dbsync dbsync

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --prefer-offline --no-audit --omit=dev && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create directories with proper permissions
RUN mkdir -p /app/logs /app/.db-sync && \
    chown -R dbsync:dbsync /app

# Switch to non-root user
USER dbsync

# Expose any ports if needed (not required for this app)
# EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command: run the CLI
CMD ["node", "dist/cli/index.js"]
