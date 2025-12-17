# ============================================================================
# Stage 1: Builder - Build TypeScript application
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ============================================================================
# Stage 2: Production - Minimal runtime image
# ============================================================================
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache curl postgresql-client

WORKDIR /app

# Copy package files
COPY package.json ./

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy migrations (needed for database setup)
COPY migrations ./migrations

# Copy scripts
COPY scripts ./scripts

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose ports
EXPOSE 4000 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]

# ============================================================================
# Stage 3: Development - Hot reload support
# ============================================================================
FROM node:18-alpine AS development

WORKDIR /app

# Install dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm install

# Copy source code (can be overridden by volume mount)
COPY . .

EXPOSE 4000 9090

# Development mode with hot reload
CMD ["npm", "run", "dev"]
