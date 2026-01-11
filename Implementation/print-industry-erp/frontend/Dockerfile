# ============================================================================
# Stage 1: Builder - Build React application
# ============================================================================
# NOTE: Vite 7.x requires Node.js 20.19+ or 22.12+
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application (environment variables are baked in at build time)
# These can be overridden with ARG if needed
ARG VITE_API_URL=http://localhost:4000/graphql
ARG VITE_WS_URL=ws://localhost:4222
ARG VITE_DEFAULT_LANGUAGE=en-US
ARG VITE_ENABLE_MARKETPLACE=true
ARG VITE_ENABLE_AI_FEATURES=false

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_DEFAULT_LANGUAGE=$VITE_DEFAULT_LANGUAGE
ENV VITE_ENABLE_MARKETPLACE=$VITE_ENABLE_MARKETPLACE
ENV VITE_ENABLE_AI_FEATURES=$VITE_ENABLE_AI_FEATURES

# Build the application
RUN npm run build

# ============================================================================
# Stage 2: Production - NGINX to serve static files
# ============================================================================
FROM nginx:alpine AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001 && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    chown -R nginx-app:nginx-app /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /var/run/nginx.pid

USER nginx-app

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# ============================================================================
# Stage 3: Development - Hot reload with Vite
# ============================================================================
# NOTE: Vite 7.x requires Node.js 20.19+ or 22.12+
FROM node:22-alpine AS development

WORKDIR /app

# Install dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm install

# Copy source code (can be overridden by volume mount)
COPY . .

EXPOSE 3000

# Development mode with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
