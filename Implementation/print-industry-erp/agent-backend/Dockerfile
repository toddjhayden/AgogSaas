# Agent Backend - Orchestration System
# Development only - NEVER deployed to production

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose orchestrator API port
EXPOSE 4000

# Run orchestrator daemon
CMD ["npm", "run", "daemon:start"]
